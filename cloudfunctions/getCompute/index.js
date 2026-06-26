const https = require('https')
const crypto = require('crypto')
const AK = '9fdffc48497b4545b1961428e035a540'
const SK = 'c8e2442841a5410886250dd14bf2df35'
const API_HOST = 'ctecs-global.ctapi.ctyun.cn'
const GPU_VRAM = { A10: 24, A100: 80, L20: 48, T4: 16, V100: 32, PAK1: 80, PAK2: 80, PAK3: 80 }
const GPU_TYPE_MAP = {
  'GPU_N_G7_V': 'A10', 'GPU_N_PI7': 'A10', 'GPU_N_P8A': 'A100',
  'GPU_N_PN8I': 'L20', 'GPU_N_T4': 'T4', 'GPU_N_T4_YUNYOUXI': 'T4', 'GPU_N_V100': 'V100',
  'GPU_N_P8AV': 'A100', 'GPU_N_PN8R': 'L20',
  'GPU_A_PAK1': 'PAK1', 'GPU_A_PAK2': 'PAK2', 'GPU_A_PAK3': 'PAK3'
}

function hmacSha256(key, data) { return crypto.createHmac('sha256', key).update(data).digest() }

function eopSign(ak, sk, params, body, requestId, eopDate) {
  const headerStr = 'ctyun-eop-request-id:' + requestId + '\neop-date:' + eopDate + '\n'
  const sorted = Object.keys(params).sort().map(k => k + '=' + encodeURIComponent(String(params[k])))
  const queryStr = sorted.join('&')
  const bodyStr = body ? JSON.stringify(body) : ''
  const bodyDigest = crypto.createHash('sha256').update(bodyStr).digest('hex')
  const signatureStr = headerStr + '\n' + queryStr + '\n' + bodyDigest
  const signDate = eopDate.split('T')[0]
  const kTime = hmacSha256(sk, eopDate); const kAk = hmacSha256(kTime, ak)
  const kDate = hmacSha256(kAk, signDate)
  const signature = hmacSha256(kDate, signatureStr).toString('base64')
  return ak + ' Headers=ctyun-eop-request-id;eop-date Signature=' + signature
}

function apiRequest(path, params) {
  return new Promise((resolve, reject) => {
    const now = new Date(); const pad = n => String(n).padStart(2, '0')
    const eopDate = '' + now.getUTCFullYear() + pad(now.getUTCMonth()+1) + pad(now.getUTCDate()) + 'T' + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + pad(now.getUTCSeconds()) + 'Z'
    const requestId = crypto.randomUUID()
    const auth = eopSign(AK, SK, params, null, requestId, eopDate)
    const qp = Object.keys(params).sort().map(k => k + '=' + encodeURIComponent(String(params[k]))).join('&')
    const fullPath = qp ? path + '?' + qp : path
    const req = https.request({
      hostname: API_HOST, path: fullPath, method: 'GET',
      headers: { 'User-Agent': 'ctyun-sdk-node', 'Content-Type': 'application/json;charset=UTF-8', 'ctyun-eop-request-id': requestId, 'Eop-Authorization': auth, 'Eop-date': eopDate },
      timeout: 3000, rejectUnauthorized: false
    }, (res) => {
      let body = ''; res.on('data', chunk => body += chunk); res.on('end', () => {
        try { resolve(JSON.parse(body)) } catch(e) { reject(new Error('parse')) }
      })
    })
    req.on('error', e => reject(e)); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.end()
  })
}

// 动态发现所有 openapiAvailable 区域
async function fetchRegions() {
  const res = await apiRequest('/v4/region/list-regions', {})
  const regions = (res.returnObj && res.returnObj.regionList) || []
  return regions
    .filter(function(r) { return r.openapiAvailable === true })
    .map(function(r) { return {
      id: r.regionID, name: r.regionName, code: r.regionCode || '', parent: r.regionParent || ''
    }})
}

exports.main = async (event, context) => {
  try {
    // 1. 动态发现区域
    const targets = await fetchRegions()
    console.log('Regions: ' + targets.length)

    // 2. 并行查 GPU 规格（每批 8 区域 = 16 并发请求）
    const gpuData = [], seen = new Set()
    const batchSize = 25
    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize)
      const promises = []
      for (let j = 0; j < batch.length; j++) {
        const t = batch[j]
        for (let k = 0; k < 2; k++) {
          const series = k === 0 ? 'g' : 'p'
          promises.push(
            apiRequest('/v4/common/get-ecs-flavors', { regionID: t.id, series }).then(res => {
              const flavors = (res.returnObj && res.returnObj.results) || []
              for (let fi = 0; fi < flavors.length; fi++) {
                const f = flavors[fi]
                const ft = f.flavorType || ''
                if (!ft.startsWith('GPU_')) continue
                const spec = f.specName || ''
                const key = spec + '|' + t.name
                if (seen.has(key)) continue
                seen.add(key)
                const gpuModel = f.gpuType || GPU_TYPE_MAP[ft] || ft.replace('GPU_N_', '')
                // 简化 AZ：取最后一节
                var azRaw = f.azList || []
                var azArr = []
                for (var ai = 0; ai < azRaw.length; ai++) {
                  var parts = azRaw[ai].split('-')
                  azArr.push(parts[parts.length - 2] || azRaw[ai])
                }
                gpuData.push({
                  spec: spec, region: t.name, regionCode: t.code, parent: t.parent,
                  series: f.series || '', vCPU: f.cpuNum || 0, memGB: f.memSize || 0,
                  gpuModel: gpuModel, vramGB: GPU_VRAM[gpuModel] || 0,
                  az: azArr, flavorType: ft, flavorName: f.flavorName || '',
                  ctLimit: f.ctLimitCount, bwBase: Number(f.bandwidthBase) || 0,
                  bwMax: Number(f.bandwidthMax) || 0, flavorID: f.flavorID, regionID: t.id,
                  sellout: false, ecsQuota: 0, ecsUsed: 0, ecsAvail: 0
                })
              }
            }).catch(e => {})
          )
        }
      }
      await Promise.all(promises)
    }

    return {
      code: 0, data: gpuData, updateTime: new Date().toISOString(),
      totalSpecs: gpuData.length, available: gpuData.length, sellout: 0, source: 'ctyun-api'
    }
  } catch(e) {
    return { code: 500, data: [], msg: e.message, source: 'error' }
  }
}
