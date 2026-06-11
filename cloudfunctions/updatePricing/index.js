// 云函数：每日更新模型定价数据（定时触发 + 手动调用）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const https = require('https')

// 种子数据
const SEED_DATA = [{"n":"Qwen3-8B","p":"天翼云","pc":"#0078D4","i":0.3,"o":0.6,"cw":"128K","t":"稠密小模型","id":1},{"n":"Qwen3-4B","p":"天翼云","pc":"#0078D4","i":0.3,"o":0.6,"cw":"32K","t":"稠密小模型","id":2},{"n":"Qwen3.5-35B-A3B","p":"天翼云","pc":"#0078D4","i":0.4,"o":3.2,"in_":"≤128K","cw":"256K","t":"MoE轻量","d":"极致低价MoE","id":3},{"n":"BGE-m3 (Embedding)","p":"天翼云","pc":"#0078D4","i":0.5,"o":0,"in_":"Embedding","cw":"8K","t":"Embedding","id":4},{"n":"Qwen3.5-122B-A10B","p":"天翼云","pc":"#0078D4","i":0.8,"o":6.4,"in_":"≤128K","cw":"256K","t":"MoE模型","d":"中杯MoE高性价比","id":6},{"n":"Qwen3-14B","p":"天翼云","pc":"#0078D4","i":0.8,"o":1.6,"cw":"128K","t":"稠密模型","id":7},{"n":"DeepSeek-V4-Flash","p":"DeepSeek","pc":"#4D6BFE","i":1.0,"o":2.0,"cp":0.02,"in_":"缓存未命中","cw":"1M","mo":"384K","t":"轻量模型","cap":"JSON/Tools/思考","d":"高性能轻量模型","isHot":true,"s":["https://api-docs.deepseek.com/zh-cn/quick_start/pricing"],"id":8},{"n":"DeepSeek-V4-Flash(天翼云)","p":"天翼云","pc":"#0078D4","i":1.0,"o":2.0,"in_":"标准时段","cw":"1M","t":"轻量模型","s":["https://www.ctyun.cn/document/11061839/11062267"],"id":9,"cp":0.02},{"n":"GLM4.6V","p":"天翼云","pc":"#0078D4","i":1.0,"o":3.0,"in_":"≤32K","cw":"128K","t":"多模态","cap":"视觉理解","d":"多模态视觉模型","id":10},{"n":"Qwen3-Next-80B-A3B","p":"天翼云","pc":"#0078D4","i":1.0,"o":4.0,"cw":"128K","t":"MoE模型","id":11},{"n":"Qwen3-30B-A3B","p":"天翼云","pc":"#0078D4","i":1.0,"o":4.0,"cw":"128K","t":"MoE轻量","id":12},{"n":"Qwen3-32B","p":"天翼云","pc":"#0078D4","i":1.0,"o":4.0,"cw":"128K","t":"稠密模型","id":13},{"n":"Gemini 2.5 Flash","p":"Google","pc":"#4285F4","i":1.02,"o":4.08,"in_":"约$0.15/1M","on":"约$0.6/1M","cw":"1M","t":"轻量模型","d":"Google高性价比","s":["https://ai.google.dev/pricing"],"id":14},{"n":"Qwen3.5-397B-A17B","p":"天翼云","pc":"#0078D4","i":1.2,"o":7.2,"in_":"≤128K;优惠¥0.6","on":"优惠¥3.6","cw":"256K","t":"MoE旗舰","cap":"JSON/Tools/思考","d":"Qwen旗舰397B","isHot":true,"id":15},{"n":"DeepSeek-R1","p":"DeepSeek","pc":"#4D6BFE","i":2.0,"o":8.0,"in_":"≤4K","cw":"1M","mo":"64K","t":"推理模型","cap":"思考/推理","d":"顶配推理模型","isHot":true,"s":["https://api-docs.deepseek.com/zh-cn/quick_start/pricing"],"id":16},{"n":"Qwen3-72B","p":"天翼云","pc":"#0078D4","i":2.0,"o":8.0,"cw":"128K","t":"稠密模型","id":17},{"n":"DeepSeek-V4-Flash(优惠)","p":"天翼云","pc":"#0078D4","i":1.0,"o":2.0,"in_":"优惠时段","cw":"1M","t":"轻量模型","id":19,"cp":0.02},{"n":"GLM4.6A","p":"天翼云","pc":"#0078D4","i":2.0,"o":5.0,"in_":"≤32K","cw":"128K","t":"轻量模型","id":20},{"n":"gemini-2.5-pro","p":"Google","pc":"#4285F4","i":7.04,"o":35.2,"in_":"≤200K","cw":"1M","t":"旗舰模型","d":"Google高端旗舰","id":21},{"n":"claude-sonnet-4(天翼云)","p":"天翼云","pc":"#0078D4","i":3.0,"o":15.0,"cw":"200K","t":"旗舰模型","id":22},{"n":"Gemini 2.5 Pro","p":"Google","pc":"#4285F4","i":9.52,"o":47.6,"in_":"≤200K","on":"约$7/1M","cw":"1M","t":"旗舰模型","d":"多模态旗舰","id":26},{"n":"DeepSeek-R1(天翼云)","p":"天翼云","pc":"#0078D4","i":2.0,"o":8.0,"in_":"≤4K","cw":"1M","t":"推理模型","id":28},{"n":"Gemini 2.0 Flash","p":"Google","pc":"#4285F4","i":0.68,"o":2.72,"in_":"约$0.1/1M","on":"约$0.4/1M","cw":"1M","t":"轻量模型","d":"高速低延迟","id":34},{"n":"Hunyuan-Large","p":"天翼云","pc":"#0078D4","i":4.0,"o":12.0,"cw":"256K","t":"稠密模型","d":"腾讯混元大模型","isNew":true,"id":35},{"n":"ERNIE-4.5-Turbo","p":"天翼云","pc":"#0078D4","i":1.0,"o":3.0,"cw":"128K","t":"轻量模型","d":"百度文心轻量","id":36},{"n":"Mistral Large 2","p":"天翼云","pc":"#0078D4","i":2.0,"o":6.0,"cw":"128K","t":"稠密模型","id":37},{"n":"qwen3.7-max","p":"阿里百炼","pc":"#FF6A00","i":12.0,"o":36.0,"cw":"1M","t":"旗舰模型","d":"阿里千问旗舰","isHot":true,"s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":38},{"n":"qwen3.7-plus","p":"阿里百炼","pc":"#FF6A00","i":2.0,"o":8.0,"cw":"1M","t":"中杯模型","d":"百炼高性价比","in_":"≤256K","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":39},{"n":"qwq-plus","p":"阿里百炼","pc":"#FF6A00","i":1.6,"o":4.0,"cw":"128K","t":"推理模型","cap":"思考/推理","d":"百炼推理模型","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":40},{"n":"deepseek-v4-pro","p":"阿里百炼","pc":"#FF6A00","i":12.0,"o":24.0,"cw":"1M","t":"旗舰模型","cap":"上下文缓存","d":"百炼平台旗舰","in_":"缓存折扣","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":41},{"n":"deepseek-v4-flash","p":"阿里百炼","pc":"#FF6A00","i":1.0,"o":2.0,"cw":"1M","t":"轻量模型","cap":"上下文缓存","d":"百炼平台轻量","in_":"缓存折扣","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":42},{"n":"kimi-k2.6","p":"阿里百炼","pc":"#FF6A00","i":6.5,"o":27.0,"cw":"1M","t":"旗舰模型","cap":"思考/推理","d":"月之暗面Kimi","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":43},{"n":"glm-5.1","p":"阿里百炼","pc":"#FF6A00","i":6.0,"o":24.0,"cw":"200K","t":"旗舰模型","cap":"思考/推理","d":"智谱旗舰GLM","in_":"≤32K","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":44},{"n":"MiniMax-M2.7","p":"阿里百炼","pc":"#FF6A00","i":2.1,"o":8.4,"cw":"128K","t":"中杯模型","cap":"思考/推理","d":"稀宇科技Minimax","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":45}];

const COLL = 'pricing'
const DOC_ID = 'latest'

function fetchUrl(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'zh-CN,zh;q=0.9' },
      timeout
    }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
  })
}

async function loadModels() {
  try { const r = await db.collection(COLL).doc(DOC_ID).get(); return r.data.models || [] }
  catch (e) { return [] }
}

async function saveModels(models) {
  const ds = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
  const data = { models, updateTime: ds, updatedAt: db.serverDate() }
  try { await db.collection(COLL).doc(DOC_ID).set(data) }
  catch (e) { await db.collection(COLL).add({ data: { _id: DOC_ID, ...data } }) }
}

// 辅助：模糊匹配模型名
function findModel(models, namePattern) {
  const lower = namePattern.toLowerCase()
  return models.filter(m => m.n && m.n.toLowerCase().includes(lower))
}

// DeepSeek
async function scrapeDeepSeek(models) {
  const html = await fetchUrl('https://api-docs.deepseek.com/zh-cn/quick_start/pricing')
  if (!html) return
  let m = html.match(/deepseek-v4-flash[\s\S]{0,500}?缓存命中[：:]\s*([\d.]+)\s*元[\s\S]{0,200}?缓存未命中[：:]\s*([\d.]+)\s*元[\s\S]{0,200}?输出[：:]\s*([\d.]+)\s*元/i)
  if (m && parseFloat(m[3]) >= 1) {
    const c = parseFloat(m[1]), i = parseFloat(m[2]), o = parseFloat(m[3])
    findModel(models, 'DeepSeek-V4-Flash').forEach(mod => { mod.i = i; mod.o = o; mod.cp = c })
  }
  m = html.match(/deepseek-v4-pro[\s\S]{0,500}?缓存命中[：:]\s*([\d.]+)\s*元[\s\S]{0,200}?缓存未命中[：:]\s*([\d.]+)\s*元[\s\S]{0,200}?输出[：:]\s*([\d.]+)\s*元/i)
  if (m && parseFloat(m[3]) >= 3) {
    const c = parseFloat(m[1]), i = parseFloat(m[2]), o = parseFloat(m[3])
    findModel(models, 'DeepSeek-V4-Pro').forEach(mod => { mod.i = i; mod.o = o; mod.cp = c })
  }
}

// 阿里百炼
async function scrapeBailian(models) {
  const html = await fetchUrl('https://help.aliyun.com/zh/model-studio/model-pricing')
  if (!html) return
  const m = html.match(/qwen3\.7[.-]max[\s\S]{0,300}?([\d.]+)\s*元[\s\S]{0,200}?([\d.]+)\s*元/i)
  if (m) { const ip = parseFloat(m[1]), op = parseFloat(m[2]); findModel(models, 'qwen3.7-max').forEach(mod => { mod.i = ip; mod.o = op }) }
}

// 天翼云 — 从文档页解析定价表格
async function scrapeCtyun(models) {
  const html = await fetchUrl('https://www.ctyun.cn/document/11061839/11062267')
  if (!html) return
  // 提取定价表格的 tbody
  const table = html.match(/<tbody>[\s\S]{0,50000}<\/tbody>/)
  if (!table) return
  const content = table[0]

  // 提取所有模型条目：模型名 → 输入价格 → 输出价格
  // 匹配每个模型块
  const modelBlocks = content.matchAll(/<tr><td[^>]*rowspan="(\d+)">([^<]+)<\/td>/g)
  let updated = 0
  for (const match of modelBlocks) {
    let name = match[2].trim()
    if (name.includes('输入') || name.includes('输出')) continue

    // 从模型名开始到下一个模型或表格结束
    const start = match.index
    const remaining = content.slice(start)
    const nextMatch = remaining.slice(150).match(/<tr><td[^>]*rowspan="\d+">/)
    const blockEnd = nextMatch ? 150 + nextMatch.index : remaining.length
    const block = remaining.slice(0, blockEnd)

    // 找第一个输入/输出价格（非 td1 class 的 <td>）
    const inp = block.match(/<(?:td|p|span)[^>]*>输[入]<\/[^>]*>(?:[\s\S]{0,50}?<[^>]*>)?[\s\S]{0,30}?<td(?!\s*class="td1)[^>]*>([\d.]+)<\/td>/)
    const outp = block.match(/<(?:td|p|span)[^>]*>输[出]<\/[^>]*>(?:[\s\S]{0,50}?<[^>]*>)?[\s\S]{0,30}?<td(?!\s*class="td1)[^>]*>([\d.]+)<\/td>/)
    if (!inp || !outp) continue

    const ip = parseFloat(inp[1]), op = parseFloat(outp[1])
    // 模糊匹配数据库中的天翼云模型
    const matches = findModel(models, name.replace(/（.*?）/g, '').replace(/-Instruct/g, ''))
    const ctyunMatches = matches.filter(m => m.p === '天翼云')
    if (ctyunMatches.length > 0) {
      ctyunMatches.forEach(mod => { mod.i = ip; mod.o = op })
      updated += ctyunMatches.length
    }
  }
  if (updated > 0) console.log(`[天翼云] 更新 ${updated} 个模型价格`)
}

// Google — 从 AI Dev 页面解析
async function scrapeGoogle(models) {
  const html = await fetchUrl('https://ai.google.dev/gemini-api/docs/pricing')
  if (!html) return
  // 提取模型块：模型名 → Input price → Output price
  // Gemini 2.5 Flash 等模型出现在 h2 + 表格结构中
  const modelNames = ['Gemini 2.5 Flash', 'Gemini 2.5 Pro', 'Gemini 2.0 Flash']
  let updated = 0
  for (const modelName of modelNames) {
    // 找模型名附近的价格
    const escaped = modelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const block = html.match(new RegExp(escaped + '[\\s\\S]{0,2000}?' + 'Input price[\\s\\S]{0,150}?\\$([\\d.]+)[\\s\\S]{0,500}?Output price[\\s\\S]{0,150}?\\$([\\d.]+)', 'i'))
    if (block) {
      const usdInput = parseFloat(block[1])
      const usdOutput = parseFloat(block[2])
      const cnyInput = Math.round(usdInput * 7.2 * 100) / 100
      const cnyOutput = Math.round(usdOutput * 7.2 * 100) / 100
      findModel(models, modelName).forEach(mod => { mod.i = cnyInput; mod.o = cnyOutput })
      updated++
      console.log(`  [OK] ${modelName}: ¥${cnyInput}→¥${cnyOutput}`)
    }
  }
  if (updated > 0) console.log(`[Google] 更新 ${updated} 个模型`)
}

// 主函数
exports.main = async (event, context) => {
  console.log('[updatePricing] 开始执行')
  let models = await loadModels()
  let isSeeded = false
  if (!models || models.length === 0) {
    models = JSON.parse(JSON.stringify(SEED_DATA))
    isSeeded = true
    console.log(`[INIT] 导入 ${models.length} 条种子数据`)
  } else {
    console.log(`[LOAD] ${models.length} 条`)
  }

  const errors = []
  try { await scrapeDeepSeek(models) } catch (e) { errors.push('DeepSeek: ' + e.message) }
  try { await scrapeBailian(models) } catch (e) { errors.push('阿里百炼: ' + e.message) }
  try { await scrapeCtyun(models) } catch (e) { errors.push('天翼云: ' + e.message) }
  try { await scrapeGoogle(models) } catch (e) { errors.push('Google: ' + e.message) }

  await saveModels(models)
  console.log(`[SAVE] ${models.length} 条`)

  return { code: 0, modelCount: models.length, isSeeded, scrapers: { deepseek: !errors.some(e=>e.startsWith('DeepSeek')), bailian: !errors.some(e=>e.startsWith('阿里百炼')), ctyun: !errors.some(e=>e.startsWith('天翼云')), google: !errors.some(e=>e.startsWith('Google')) }, errors: errors.length ? errors : undefined }
}
