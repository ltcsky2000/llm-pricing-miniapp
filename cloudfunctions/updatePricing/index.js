// 云函数：每日更新模型定价数据（定时触发 + 手动调用）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const https = require('https')
const http = require('http')

// 种子数据（从现有 app.js 提取，首次部署时导入数据库）
const SEED_DATA = require('../seed_data.js')

const COLLECTION = 'pricing'
const DOC_ID = 'latest'

// 获取 URL 内容
function fetchUrl(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      },
      timeout: timeout
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
  })
}

// 从数据库中读取模型列表
async function loadModels() {
  try {
    const result = await db.collection(COLLECTION).doc(DOC_ID).get()
    return result.data.models || []
  } catch (e) {
    return []
  }
}

// 保存模型列表到数据库
async function saveModels(models) {
  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  const data = { models, updateTime: dateStr, updatedAt: db.serverDate() }

  try {
    await db.collection(COLLECTION).doc(DOC_ID).set(data)
  } catch (e) {
    // 文档不存在，先创建
    await db.collection(COLLECTION).add({
      data: { _id: DOC_ID, ...data }
    })
  }
}

// 爬取 DeepSeek 定价
async function scrapeDeepSeek(models) {
  console.log('[DeepSeek] 开始爬取...')
  const html = await fetchUrl('https://api-docs.deepseek.com/zh-cn/quick_start/pricing')
  if (!html) { console.log('[DeepSeek] 获取页面失败'); return }

  // DeepSeek V4 Flash
  let m = html.match(/deepseek-v4-flash[\s\S]{0,500}?缓存命中[：:]\s*([\d.]+)\s*元[\s\S]{0,200}?缓存未命中[：:]\s*([\d.]+)\s*元[\s\S]{0,200}?输出[：:]\s*([\d.]+)\s*元/i)
  if (m && parseFloat(m[3]) >= 1) {
    const cache = parseFloat(m[1]), miss = parseFloat(m[2]), output = parseFloat(m[3])
    models.forEach(mod => {
      if (mod.n && mod.n.includes('DeepSeek-V4-Flash')) {
        mod.i = miss; mod.o = output; mod.cp = cache
        console.log(`  [OK] DeepSeek-V4-Flash: ¥${miss}→¥${output}`)
      }
    })
  }

  // DeepSeek V4 Pro
  m = html.match(/deepseek-v4-pro[\s\S]{0,500}?缓存命中[：:]\s*([\d.]+)\s*元[\s\S]{0,200}?缓存未命中[：:]\s*([\d.]+)\s*元[\s\S]{0,200}?输出[：:]\s*([\d.]+)\s*元/i)
  if (m && parseFloat(m[3]) >= 3) {
    const cache = parseFloat(m[1]), miss = parseFloat(m[2]), output = parseFloat(m[3])
    models.forEach(mod => {
      if (mod.n && (mod.n.includes('DeepSeek-V4-Pro') || mod.n.includes('deepseek-v4-pro'))) {
        mod.i = miss; mod.o = output; mod.cp = cache
        console.log(`  [OK] DeepSeek-V4-Pro: ¥${miss}→¥${output}`)
      }
    })
  }
}

// 爬取阿里百炼定价
async function scrapeBailian(models) {
  console.log('[阿里百炼] 开始爬取...')
  const html = await fetchUrl('https://help.aliyun.com/zh/model-studio/model-pricing')
  if (!html) { console.log('[阿里百炼] 获取页面失败'); return }
  // 阿里百炼页面是服务端渲染，表格格式比较规整
  // 提取 qwen3.7-max 价格
  const m = html.match(/qwen3\.7[.-]max[\s\S]{0,300}?([\d.]+)\s*元[\s\S]{0,200}?([\d.]+)\s*元/i)
  if (m) {
    const inputP = parseFloat(m[1]), outputP = parseFloat(m[2])
    models.forEach(mod => {
      if (mod.n && mod.n.toLowerCase().includes('qwen3.7-max')) {
        mod.i = inputP; mod.o = outputP
        console.log(`  [OK] qwen3.7-max: ¥${inputP}→¥${outputP}`)
      }
    })
  }
}

// 主函数
exports.main = async (event, context) => {
  console.log('[updatePricing] 开始执行')

  // 1. 加载现有数据（或种子数据）
  let models = await loadModels()
  let isSeeded = false
  if (!models || models.length === 0) {
    models = JSON.parse(JSON.stringify(SEED_DATA)) // 深拷贝种子数据
    isSeeded = true
    console.log(`[INIT] 数据库为空，导入 ${models.length} 条种子数据`)
  } else {
    console.log(`[LOAD] 从数据库加载 ${models.length} 条模型数据`)
  }

  // 2. 爬取各厂商最新价格
  const errors = []
  try { await scrapeDeepSeek(models) } catch (e) { errors.push(`DeepSeek: ${e.message}`) }
  try { await scrapeBailian(models) } catch (e) { errors.push(`阿里百炼: ${e.message}`) }

  // 3. 保存到数据库
  await saveModels(models)
  console.log(`[SAVE] 成功保存 ${models.length} 条模型数据`)

  return {
    code: 0,
    modelCount: models.length,
    isSeeded,
    errors: errors.length ? errors : undefined
  }
}
