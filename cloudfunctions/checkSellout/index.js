const https = require('https')
const crypto = require('crypto')
const AK = '9fdffc48497b4545b1961428e035a540'
const SK = 'c8e2442841a5410886250dd14bf2df35'
const API_HOST = 'ctecs-global.ctapi.ctyun.cn'

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
  return ak + ' Headers=ctyun-eop-request-id;eop-date Signature=' + hmacSha256(kDate, signatureStr).toString('base64')
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

// 批量查询售罄状态
// 入参: { specs: [{regionID, flavorID}, ...] }
exports.main = async (event, context) => {
  try {
    const specs = event.specs || []
    if (specs.length === 0) return { code: 0, results: [] }

    const results = new Array(specs.length)
    const batchSize = 25  // 每批 8 并发

    for (let i = 0; i < specs.length; i += batchSize) {
      const batch = specs.slice(i, i + batchSize)
      const promises = []
      for (let j = 0; j < batch.length; j++) {
        const idx = i + j
        const s = batch[j]
        if (!s.regionID || !s.flavorID) {
          results[idx] = { sellout: false, ecsQuota: 0, ecsUsed: 0, ecsAvail: 0 }
          continue
        }
        promises.push(
          apiRequest('/v4/region/check-demand', {
            regionID: s.regionID, productType: 'ecs', flavorID: s.flavorID
          }).then(res => {
            const robj = res.returnObj
            if (robj) {
              const qi = robj.quotaInfo || {}, ui = robj.usedInfo || {}
              results[idx] = {
                sellout: robj.sellout === true,
                ecsQuota: qi.ecsCountQuota || 0,
                ecsUsed: ui.ecsCount || 0,
                ecsAvail: (qi.ecsCountQuota || 0) - (ui.ecsCount || 0)
              }
            } else {
              results[idx] = { sellout: true, ecsQuota: 0, ecsUsed: 0, ecsAvail: 0 }
            }
          }).catch(e => {
            results[idx] = { sellout: true, ecsQuota: 0, ecsUsed: 0, ecsAvail: 0 }
          })
        )
      }
      await Promise.all(promises)
    }

    return { code: 0, results: results }
  } catch(e) {
    return { code: 500, results: [], msg: e.message }
  }
}
