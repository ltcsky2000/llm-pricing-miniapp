// 云函数：每日更新模型定价数据（定时触发 + 手动调用）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const https = require('https')

// 种子数据
const SEED_DATA = [{"n":"Qwen3-8B","p":"天翼云","pc":"#0078D4","i":0.3,"o":0.6,"cw":"128K","t":"稠密小模型","id":1},{"n":"Qwen3-4B","p":"天翼云","pc":"#0078D4","i":0.3,"o":0.6,"cw":"32K","t":"稠密小模型","id":2},{"n":"Qwen3.5-35B-A3B","p":"天翼云","pc":"#0078D4","i":0.4,"o":3.2,"in_":"≤128K","cw":"256K","t":"MoE轻量","d":"极致低价MoE","id":3},{"n":"BGE-m3 (Embedding)","p":"天翼云","pc":"#0078D4","i":0.5,"o":0,"in_":"Embedding","cw":"8K","t":"Embedding","id":4,"tg":"📊 嵌入"},{"n":"Qwen3.5-122B-A10B","p":"天翼云","pc":"#0078D4","i":0.8,"o":6.4,"in_":"≤128K","cw":"256K","t":"MoE模型","d":"中杯MoE高性价比","id":6},{"n":"Qwen3-14B","p":"天翼云","pc":"#0078D4","i":0.8,"o":1.6,"cw":"128K","t":"稠密模型","id":7},{"n":"DeepSeek-V4-Flash","p":"DeepSeek","pc":"#4D6BFE","i":1.0,"o":2.0,"cp":0.02,"in_":"缓存未命中","cw":"1M","mo":"384K","t":"轻量模型","cap":"JSON/Tools/思考","d":"高性能轻量模型","isHot":true,"s":["https://api-docs.deepseek.com/zh-cn/quick_start/pricing"],"id":8},{"n":"DeepSeek-V4-Flash(天翼云)","p":"天翼云","pc":"#0078D4","i":1.0,"o":2.0,"in_":"标准时段","cw":"1M","t":"轻量模型","s":["https://www.ctyun.cn/document/11061839/11062267"],"id":9,"cp":0.02},{"n":"GLM4.6V","p":"天翼云","pc":"#0078D4","i":1.0,"o":3.0,"in_":"≤32K","cw":"128K","t":"多模态","cap":"视觉理解","d":"多模态视觉模型","id":10,"tg":"👁️ 视觉"},{"n":"Qwen3-Next-80B-A3B","p":"天翼云","pc":"#0078D4","i":1.0,"o":4.0,"cw":"128K","t":"MoE模型","id":11},{"n":"Qwen3-30B-A3B","p":"天翼云","pc":"#0078D4","i":1.0,"o":4.0,"cw":"128K","t":"MoE轻量","id":12},{"n":"Qwen3-32B","p":"天翼云","pc":"#0078D4","i":1.0,"o":4.0,"cw":"128K","t":"稠密模型","id":13},{"n":"Gemini 2.5 Flash","p":"Google","pc":"#4285F4","i":1.02,"o":4.08,"in_":"约$0.15/1M","on":"约$0.6/1M","cw":"1M","t":"轻量模型","d":"Google高性价比","s":["https://ai.google.dev/pricing"],"id":14},{"n":"Qwen3.5-397B-A17B","p":"天翼云","pc":"#0078D4","i":1.2,"o":7.2,"in_":"≤128K;优惠¥0.6","on":"优惠¥3.6","cw":"256K","t":"MoE旗舰","cap":"JSON/Tools/思考","d":"Qwen旗舰397B","isHot":true,"id":15},{"n":"DeepSeek-R1","p":"DeepSeek","pc":"#4D6BFE","i":2.0,"o":8.0,"in_":"≤4K","cw":"1M","mo":"64K","t":"推理模型","cap":"思考/推理","d":"顶配推理模型","isHot":true,"s":["https://api-docs.deepseek.com/zh-cn/quick_start/pricing"],"id":16,"tg":"🧠 推理"},{"n":"Qwen3-72B","p":"天翼云","pc":"#0078D4","i":2.0,"o":8.0,"cw":"128K","t":"稠密模型","id":17},{"n":"DeepSeek-V4-Flash(优惠)","p":"天翼云","pc":"#0078D4","i":1.0,"o":2.0,"in_":"优惠时段","cw":"1M","t":"轻量模型","id":19,"cp":0.02},{"n":"GLM4.6A","p":"天翼云","pc":"#0078D4","i":2.0,"o":5.0,"in_":"≤32K","cw":"128K","t":"轻量模型","id":20},{"n":"gemini-2.5-pro","p":"Google","pc":"#4285F4","i":7.04,"o":35.2,"in_":"≤200K","cw":"1M","t":"旗舰模型","d":"Google高端旗舰","id":21},{"n":"claude-sonnet-4(天翼云)","p":"天翼云","pc":"#0078D4","i":3.0,"o":15.0,"cw":"200K","t":"旗舰模型","id":22},{"n":"Gemini 2.5 Pro","p":"Google","pc":"#4285F4","i":9.52,"o":47.6,"in_":"≤200K","on":"约$7/1M","cw":"1M","t":"旗舰模型","d":"多模态旗舰","id":26},{"n":"DeepSeek-R1(天翼云)","p":"天翼云","pc":"#0078D4","i":2.0,"o":8.0,"in_":"≤4K","cw":"1M","t":"推理模型","id":28,"tg":"🧠 推理"},{"n":"Gemini 2.0 Flash","p":"Google","pc":"#4285F4","i":0.68,"o":2.72,"in_":"约$0.1/1M","on":"约$0.4/1M","cw":"1M","t":"轻量模型","d":"高速低延迟","id":34},{"n":"Hunyuan-Large","p":"天翼云","pc":"#0078D4","i":4.0,"o":12.0,"cw":"256K","t":"稠密模型","d":"腾讯混元大模型","isNew":true,"id":35},{"n":"ERNIE-4.5-Turbo","p":"天翼云","pc":"#0078D4","i":1.0,"o":3.0,"cw":"128K","t":"轻量模型","d":"百度文心轻量","id":36},{"n":"Mistral Large 2","p":"天翼云","pc":"#0078D4","i":2.0,"o":6.0,"cw":"128K","t":"稠密模型","id":37},{"n":"qwen3.7-max","p":"阿里百炼","pc":"#FF6A00","i":12.0,"o":36.0,"cw":"1M","t":"旗舰模型","d":"阿里千问旗舰","isHot":true,"s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":38},{"n":"qwen3.7-plus","p":"阿里百炼","pc":"#FF6A00","i":2.0,"o":8.0,"cw":"1M","t":"中杯模型","d":"百炼高性价比","in_":"≤256K","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":39},{"n":"qwq-plus","p":"阿里百炼","pc":"#FF6A00","i":1.6,"o":4.0,"cw":"128K","t":"推理模型","cap":"思考/推理","d":"百炼推理模型","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":40,"tg":"🧠 推理"},{"n":"deepseek-v4-pro","p":"阿里百炼","pc":"#FF6A00","i":12.0,"o":24.0,"cw":"1M","t":"旗舰模型","cap":"上下文缓存","d":"百炼平台旗舰","in_":"缓存折扣","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":41},{"n":"deepseek-v4-flash","p":"阿里百炼","pc":"#FF6A00","i":1.0,"o":2.0,"cw":"1M","t":"轻量模型","cap":"上下文缓存","d":"百炼平台轻量","in_":"缓存折扣","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":42},{"n":"kimi-k2.6","p":"阿里百炼","pc":"#FF6A00","i":6.5,"o":27.0,"cw":"1M","t":"旗舰模型","cap":"思考/推理","d":"月之暗面Kimi","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":43},{"n":"glm-5.1","p":"阿里百炼","pc":"#FF6A00","i":6.0,"o":24.0,"cw":"200K","t":"旗舰模型","cap":"思考/推理","d":"智谱旗舰GLM","in_":"≤32K","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":44},{"n":"MiniMax-M2.7","p":"阿里百炼","pc":"#FF6A00","i":2.1,"o":8.4,"cw":"128K","t":"中杯模型","cap":"思考/推理","d":"稀宇科技Minimax","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":45},{"n":"DeepSeek-V4-Pro(SiliconFlow)","p":"硅基流动","pc":"#00BCD4","i":3.0,"o":6.0,"cp":0.03,"cw":"1M","t":"旗舰模型","cap":"JSON/Tools","id":46},{"n":"DeepSeek-V4-Flash(SiliconFlow)","p":"硅基流动","pc":"#00BCD4","i":1.0,"o":2.0,"cp":0.02,"cw":"1M","t":"轻量模型","cap":"JSON/Tools","id":47},{"n":"DeepSeek-V3.2","p":"硅基流动","pc":"#00BCD4","i":2.0,"o":3.0,"cp":0.2,"cw":"1M","t":"稠密模型","id":48},{"n":"Qwen3.6-35B-A3B","p":"硅基流动","pc":"#00BCD4","i":0.4,"o":3.2,"in_":"≤128K","cw":"256K","t":"MoE轻量","id":49},{"n":"Qwen3.6-27B","p":"硅基流动","pc":"#00BCD4","i":0.6,"o":4.8,"in_":"≤128K","cw":"256K","t":"稠密模型","id":50},{"n":"Qwen3.5-397B-A17B(SiliconFlow)","p":"硅基流动","pc":"#00BCD4","i":1.2,"o":7.2,"in_":"≤128K","cw":"256K","t":"MoE旗舰","cap":"JSON/Tools/思考","d":"Qwen旗舰","id":51},{"n":"Qwen3.5-122B-A10B(SiliconFlow)","p":"硅基流动","pc":"#00BCD4","i":0.8,"o":6.4,"in_":"≤128K","cw":"256K","t":"MoE模型","id":52},{"n":"Qwen3.5-35B-A3B(SiliconFlow)","p":"硅基流动","pc":"#00BCD4","i":0.4,"o":3.2,"in_":"≤128K","cw":"256K","t":"MoE轻量","id":53},{"n":"Kimi-K2.6(Pro)","p":"硅基流动","pc":"#00BCD4","i":6.5,"o":27.0,"cp":1.1,"cw":"1M","t":"旗舰模型","cap":"思考/推理","d":"月之暗面Kimi旗舰","id":54},{"n":"Kimi-K2.5(Pro)","p":"硅基流动","pc":"#00BCD4","i":4.0,"o":21.0,"cp":0.7,"cw":"1M","t":"旗舰模型","d":"月之暗面Kimi","id":55},{"n":"GLM-5.1(Pro)","p":"硅基流动","pc":"#00BCD4","i":6.0,"o":24.0,"cp":1.3,"in_":"≤32K","cw":"200K","t":"旗舰模型","d":"智谱旗舰","id":56},{"n":"MiniMax-M2.5(Pro)","p":"硅基流动","pc":"#00BCD4","i":2.1,"o":8.4,"cp":0.21,"cw":"128K","t":"中杯模型","id":57},{"n":"Step-3.5-Flash","p":"硅基流动","pc":"#00BCD4","i":0.7,"o":2.1,"cw":"128K","t":"轻量模型","d":"阶跃星辰","id":58},{"n":"Seed-OSS-36B-Instruct","p":"硅基流动","pc":"#00BCD4","i":1.5,"o":4.0,"cw":"1M","t":"稠密模型","d":"字节跳动Seed","id":59},{"n":"Z-Image-Turbo","p":"硅基流动","pc":"#00BCD4","i":0.1,"o":0,"in_":"¥0.10/张","cw":"N/A","t":"🎨 生图","d":"通义万相生图","tg":"🎨 生图","id":60},{"n":"Qwen-Image","p":"硅基流动","pc":"#00BCD4","i":0.3,"o":0,"in_":"¥0.30/张","cw":"N/A","t":"🎨 生图","d":"千问生图模型","tg":"🎨 生图","id":61},{"n":"Kolors","p":"硅基流动","pc":"#00BCD4","i":0,"o":0,"in_":"免费","cw":"N/A","t":"🎨 生图","d":"可图生图模型(免费)","tg":"🎨 生图","id":62},{"n":"CosyVoice2-0.5B","p":"硅基流动","pc":"#00BCD4","i":0.05,"o":0,"in_":"¥0.05/千字符","cw":"N/A","t":"🎤 语音","d":"语音合成","tg":"🎤 语音","id":63},{"n":"SenseVoiceSmall","p":"硅基流动","pc":"#00BCD4","i":0,"o":0,"in_":"免费","cw":"N/A","t":"🎤 语音","d":"语音识别(免费)","tg":"🎤 语音","id":64},{"n":"Wan2.2-T2V-A14B","p":"硅基流动","pc":"#00BCD4","i":2.0,"o":0,"in_":"¥2.00/个","cw":"N/A","t":"🎬 视频","d":"文生视频","tg":"🎬 视频","id":65},{"n":"Wan2.2-I2V-A14B","p":"硅基流动","pc":"#00BCD4","i":2.0,"o":0,"in_":"¥2.00/个","cw":"N/A","t":"🎬 视频","d":"图生视频","tg":"🎬 视频","id":66},{"n":"GLM-5.1(智谱)","p":"智谱","pc":"#7856FF","i":6.0,"o":24.0,"cp":1.3,"in_":"≤32K","cw":"200K","t":"旗舰模型","d":"智谱旗舰长程任务","isNew":true,"id":67},{"n":"GLM-5-Turbo","p":"智谱","pc":"#7856FF","i":5.0,"o":22.0,"cp":1.2,"in_":"≤32K","cw":"200K","t":"旗舰模型","d":"高性能旗舰","isNew":true,"id":68},{"n":"GLM-5","p":"智谱","pc":"#7856FF","i":4.0,"o":18.0,"cp":1.0,"in_":"≤32K","cw":"200K","t":"旗舰模型","d":"旗舰模型","id":69},{"n":"GLM-4.7","p":"智谱","pc":"#7856FF","i":2.0,"o":8.0,"cp":0.4,"in_":"≤32K","cw":"200K","t":"稠密模型","d":"最新一代GLM-4","id":70},{"n":"GLM-4.5-Air","p":"智谱","pc":"#7856FF","i":0.8,"o":2.0,"cp":0.16,"in_":"≤32K","cw":"128K","t":"轻量模型","d":"高性价比轻量","id":71},{"n":"GLM-4.7-FlashX","p":"智谱","pc":"#7856FF","i":0.5,"o":3.0,"cp":0.1,"cw":"200K","t":"轻量模型","d":"极速轻量","id":72},{"n":"GLM-4.7-Flash","p":"智谱","pc":"#7856FF","i":0,"o":0,"in_":"免费","cw":"200K","t":"轻量模型","d":"免费使用","id":73},{"n":"GLM-5V-Turbo","p":"智谱","pc":"#7856FF","i":5.0,"o":22.0,"cp":1.2,"in_":"≤32K","cw":"200K","t":"多模态","cap":"图片/视频理解","d":"视觉旗舰","tg":"👁️ 视觉","isNew":true,"id":74},{"n":"GLM-4.6V(智谱)","p":"智谱","pc":"#7856FF","i":1.0,"o":3.0,"cp":0.2,"in_":"≤32K","cw":"128K","t":"多模态","cap":"视觉理解","d":"智谱视觉模型","tg":"👁️ 视觉","id":75},{"n":"GLM-4.6V-FlashX","p":"智谱","pc":"#7856FF","i":0.15,"o":1.5,"cp":0.03,"in_":"≤32K","cw":"128K","t":"多模态","cap":"视觉理解","d":"极速视觉","tg":"👁️ 视觉","id":76},{"n":"GLM-4.6V-Flash","p":"智谱","pc":"#7856FF","i":0,"o":0,"in_":"免费","cw":"128K","t":"多模态","cap":"视觉理解","d":"免费视觉模型","tg":"👁️ 视觉","id":77},{"n":"GLM-4-Plus","p":"智谱","pc":"#7856FF","i":5.0,"o":5.0,"cw":"128K","t":"旗舰模型","d":"智谱旗舰语言模型","id":78},{"n":"GLM-4-Air","p":"智谱","pc":"#7856FF","i":0.5,"o":0.5,"cw":"128K","t":"轻量模型","d":"高性能轻量","id":79},{"n":"GLM-4-FlashX-250414","p":"智谱","pc":"#7856FF","i":0.1,"o":0.1,"cw":"128K","t":"轻量模型","d":"极速平价","id":80},{"n":"GLM-Z1-Air","p":"智谱","pc":"#7856FF","i":0.5,"o":0.5,"cw":"128K","t":"推理模型","cap":"思考/推理","d":"智谱推理模型","tg":"🧠 推理","id":81},{"n":"GLM-Z1-FlashX","p":"智谱","pc":"#7856FF","i":0.1,"o":0.1,"cw":"128K","t":"推理模型","cap":"思考/推理","d":"极速推理","tg":"🧠 推理","id":82},{"n":"Embedding-3","p":"智谱","pc":"#7856FF","i":0.5,"o":0,"cw":"8K","t":"Embedding","d":"智谱向量嵌入","tg":"📊 嵌入","id":83},{"n":"CogView-4","p":"智谱","pc":"#7856FF","i":0.06,"o":0,"in_":"¥0.06/张","cw":"N/A","t":"🎨 生图","d":"智谱文生图","tg":"🎨 生图","id":84},{"n":"CogVideoX-3","p":"智谱","pc":"#7856FF","i":1.0,"o":0,"in_":"¥1.00/个","cw":"N/A","t":"🎬 视频","d":"智谱文生视频","tg":"🎬 视频","id":85},{"n":"GLM-4-Voice","p":"智谱","pc":"#7856FF","i":80.0,"o":80.0,"in_":"¥80/百万tokens","cw":"N/A","t":"🎤 语音","d":"智谱语音模型","tg":"🎤 语音","id":86},{"n":"CogTTS","p":"智谱","pc":"#7856FF","i":4.0,"o":0,"in_":"¥4/万字符","cw":"N/A","t":"🎤 语音","d":"智谱语音合成","tg":"🎤 语音","id":87}];

const COLL = 'pricing'
const DOC_ID = 'latest'

function fetchUrl(url, timeout = 10000) {
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



// 智谱 — 从定价页面解析
async function scrapeZhipu(models) {
  const html = await fetchUrl('https://bigmodel.cn/pricing')
  if (!html) return
  // 从HTML表格中提取旗舰模型价格
  // 找 GLM-5.1 / GLM-5-Turbo / GLM-5 / GLM-4.7 / GLM-4.5-Air / GLM-4.7-FlashX 等
  const modelPrices = [
    {name:'GLM-5.1', pat:[
      {re:/GLM-5\.1[\s\S]{0,200}?输入长度\s*\[0,\s*32\)[\s\S]{0,200}?([\d.]+)元[\s\S]{0,100}?([\d.]+)元/},
      {re:/GLM-5\.1[\s\S]{0,200}?输入长度\s*\[0,\s*32\)[\s\S]{0,200}?6元[\s\S]{0,100}?24元/}
    ]},
    {name:'GLM-5-Turbo', pat:[
      {re:/GLM-5-Turbo[\s\S]{0,200}?输入长度\s*\[0,\s*32\)[\s\S]{0,200}?([\d.]+)元[\s\S]{0,100}?([\d.]+)元/}
    ]},
    {name:'GLM-5', pat:[
      {re:/GLM-5[^T][\s\S]{0,200}?输入长度\s*\[0,\s*32\)[\s\S]{0,200}?([\d.]+)元[\s\S]{0,100}?([\d.]+)元/}
    ]},
    {name:'GLM-4.7', pat:[
      {re:/GLM-4\.7[^F][^V][\s\S]{0,200}?输入长度\s*\[0,\s*32\)[\s\S]{0,200}?输出长度\s*\[0,\s*0\.2\)[\s\S]{0,200}?([\d.]+)元[\s\S]{0,100}?([\d.]+)元/}
    ]},
    {name:'GLM-4.5-Air', pat:[
      {re:/GLM-4\.5-Air[\s\S]{0,200}?输入长度\s*\[0,\s*32\)[\s\S]{0,200}?输出长度\s*\[0,\s*0\.2\)[\s\S]{0,200}?([\d.]+)元[\s\S]{0,100}?([\d.]+)元/}
    ]},
    {name:'GLM-4.7-FlashX', pat:[
      {re:/GLM-4\.7-FlashX[\s\S]{0,200}?([\d.]+)元[\s\S]{0,100}?([\d.]+)元[\s\S]{0,100}?限时免费/}
    ]},
    {name:'GLM-5V-Turbo', pat:[
      {re:/GLM-5V-Turbo[\s\S]{0,200}?输入长度\s*\[0,\s*32\)[\s\S]{0,200}?([\d.]+)元[\s\S]{0,100}?([\d.]+)元/}
    ]},
    {name:'GLM-4.6V', pat:[
      {re:/GLM-4\.6V[^s][^F][\s\S]{0,200}?输入长度\s*\[0,\s*32\)[\s\S]{0,200}?([\d.]+)元[\s\S]{0,100}?([\d.]+)元/}
    ]},
  ]
  let updated = 0
  for (const mp of modelPrices) {
    for (const p of mp.pat) {
      const m = html.match(p.re)
      if (m && m[1] && m[2]) {
        const ip = parseFloat(m[1]), op = parseFloat(m[2])
        const matches = models.filter(mod => mod.n && mod.n.includes(mp.name) && mod.p === '智谱')
        if (matches.length > 0) {
          matches.forEach(mod => { mod.i = ip; mod.o = op })
          updated++
          console.log(`  [OK] ${mp.name}: ¥${ip}→¥${op}`)
        }
        break
      }
    }
  }
  if (updated > 0) console.log(`[智谱] 更新 ${updated} 个模型`)
}

// 硅基流动 — 从定价页面解析
async function scrapeSiliconFlow(models) {
  const html = await fetchUrl('https://siliconflow.cn/pricing')
  if (!html) return
  // 解析各个厂商的对话模型价格（每M Tokens）
  // 找模型名和价格对
  const sections = html.split(/对话模型|生图模型|语音模型|视频模型/)
  if (sections.length < 2) { console.log('[硅基流动] 未找到定价区域'); return }
  
  // 提取对话模型：厂商名 + 模型名 + 输入价格 + 输出价格 + 缓存价格
  // 页面结构: 厂商名\n模型名\n¥ 价格\n¥ 价格\n¥ 价格
  const chatSection = sections[1]
  const lines = chatSection.split('\n')
  let updated = 0
  let currentVendor = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    // 厂商名判断
    if (['deepseek-ai','Kimi','Z-ai','nex-agi','MiniMaxAI','Tongyi-MAI','Baidu','Qwen','Stepfun-ai','inclusionAI','hunyuan','ByteDance','BAAI','Kolors','youdao'].includes(line)) {
      currentVendor = line
      continue
    }
    // 跳过非模型行
    if (line.startsWith('¥') || line.startsWith('免费') || line.startsWith('输入') || line.startsWith('展开') || line === '-' || line.startsWith('厂商') || line.startsWith('模型') || line.startsWith('输入价格') || line.startsWith('输出价格') || line.startsWith('缓存价格') || line.startsWith('1314') || line.length < 2) continue
    
    // 可能是模型名 — 找它后面的价格
    // 下一个非空行是价格行
    let nextLines = []
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      const nl = lines[j].trim()
      if (nl && !nl.startsWith('展开') && !nl.startsWith('输入[') && !nl.startsWith('1314')) {
        nextLines.push(nl)
      }
    }
    // 找¥价格模式
    const prices = nextLines.filter(l => l.startsWith('¥')).map(l => parseFloat(l.replace('¥ ', '').replace(',', ''))).filter(v => !isNaN(v))
    const freeCount = nextLines.filter(l => l === '免费').length
    if (prices.length >= 2) {
      const ip = prices[0], op = prices[1]
      // 在数据库里找匹配模型（模糊匹配模型名）
      const nameOnly = line.replace(/\(.*?\)/g, '').trim()
      const matches = models.filter(mod => mod.n && mod.n.toLowerCase().includes(nameOnly.toLowerCase()) && mod.p === '硅基流动')
      if (matches.length > 0) {
        matches.forEach(mod => { mod.i = ip; mod.o = op })
        updated++
        console.log(`  [OK] ${line}: ¥${ip}→¥${op}`)
      }
    }
  }
  if (updated > 0) console.log(`[硅基流动] 更新 ${updated} 个模型价格`)
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
    // 合并种子数据中的新模型（如硅基流动、智谱等新增供应商）
    const existingIds = new Set(models.map(m => m.id))
    const newModels = SEED_DATA.filter(m => !existingIds.has(m.id))
    if (newModels.length > 0) {
      models = models.concat(JSON.parse(JSON.stringify(newModels)))
      console.log(`[MERGE] 新增 ${newModels.length} 个模型（${newModels.map(m=>m.p).filter((v,i,a)=>a.indexOf(v)===i).join(', ')}）`)
    }
    console.log(`[LOAD] ${models.length} 条`)
  }

  const errors = []
  try { await scrapeDeepSeek(models) } catch (e) { errors.push('DeepSeek: ' + e.message) }
  try { await scrapeBailian(models) } catch (e) { errors.push('阿里百炼: ' + e.message) }
  try { await scrapeCtyun(models) } catch (e) { errors.push('天翼云: ' + e.message) }
  try { await scrapeGoogle(models) } catch (e) { errors.push('Google: ' + e.message) }
  try { await scrapeSiliconFlow(models) } catch (e) { errors.push('硅基流动: ' + e.message) }
  try { await scrapeZhipu(models) } catch (e) { errors.push('智谱: ' + e.message) }

  await saveModels(models)
  console.log(`[SAVE] ${models.length} 条`)

  return { code: 0, modelCount: models.length, isSeeded, scrapers: { deepseek: !errors.some(e=>e.startsWith('DeepSeek')), bailian: !errors.some(e=>e.startsWith('阿里百炼')), ctyun: !errors.some(e=>e.startsWith('天翼云')), google: !errors.some(e=>e.startsWith('Google')), siliconflow: !errors.some(e=>e.startsWith('硅基流动')), zhipu: !errors.some(e=>e.startsWith('智谱')) }, errors: errors.length ? errors : undefined }
}
