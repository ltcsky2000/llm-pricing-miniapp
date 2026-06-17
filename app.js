var models = [{"n":"Qwen3-8B","p":"天翼云","pc":"#0078D4","i":0.3,"o":0.6,"cw":"128K","t":"稠密小模型","id":1},{"n":"Qwen3-4B","p":"天翼云","pc":"#0078D4","i":0.3,"o":0.6,"cw":"32K","t":"稠密小模型","id":2},{"n":"Qwen3.5-35B-A3B","p":"天翼云","pc":"#0078D4","i":0.4,"o":3.2,"in_":"≤128K","cw":"256K","t":"MoE轻量","d":"极致低价MoE","id":3},{"n":"BGE-m3 (Embedding)","p":"天翼云","pc":"#0078D4","i":0.5,"o":0,"in_":"Embedding","cw":"8K","t":"Embedding","id":4,"tg":"📊 嵌入"},{"n":"Qwen3.5-122B-A10B","p":"天翼云","pc":"#0078D4","i":0.8,"o":6.4,"in_":"≤128K","cw":"256K","t":"MoE模型","d":"中杯MoE高性价比","id":6},{"n":"Qwen3-14B","p":"天翼云","pc":"#0078D4","i":0.8,"o":1.6,"cw":"128K","t":"稠密模型","id":7},{"n":"DeepSeek-V4-Flash","p":"DeepSeek","pc":"#4D6BFE","i":1.0,"o":2.0,"cp":0.02,"in_":"缓存未命中","cw":"1M","mo":"384K","t":"轻量模型","cap":"JSON/Tools/思考","d":"高性能轻量模型","isHot":true,"s":["https://api-docs.deepseek.com/zh-cn/quick_start/pricing"],"id":8},{"n":"DeepSeek-V4-Flash(天翼云)","p":"天翼云","pc":"#0078D4","i":1.0,"o":2.0,"in_":"标准时段","cw":"1M","t":"轻量模型","s":["https://www.ctyun.cn/document/11061839/11062267"],"id":9,"cp":0.02},{"n":"GLM4.6V","p":"天翼云","pc":"#0078D4","i":1.0,"o":3.0,"in_":"≤32K","cw":"128K","t":"多模态","cap":"视觉理解","d":"多模态视觉模型","id":10,"tg":"👁️ 视觉"},{"n":"Qwen3-Next-80B-A3B","p":"天翼云","pc":"#0078D4","i":1.0,"o":4.0,"cw":"128K","t":"MoE模型","id":11},{"n":"Qwen3-30B-A3B","p":"天翼云","pc":"#0078D4","i":1.0,"o":4.0,"cw":"128K","t":"MoE轻量","id":12},{"n":"Qwen3-32B","p":"天翼云","pc":"#0078D4","i":1.0,"o":4.0,"cw":"128K","t":"稠密模型","id":13},{"n":"Qwen3.5-397B-A17B","p":"天翼云","pc":"#0078D4","i":1.2,"o":7.2,"in_":"≤128K;优惠¥0.6","on":"优惠¥3.6","cw":"256K","t":"MoE旗舰","cap":"JSON/Tools/思考","d":"Qwen旗舰397B","isHot":true,"id":15},{"n":"DeepSeek-R1","p":"DeepSeek","pc":"#4D6BFE","i":2.0,"o":8.0,"in_":"≤4K","cw":"1M","mo":"64K","t":"推理模型","cap":"思考/推理","d":"顶配推理模型","isHot":true,"s":["https://api-docs.deepseek.com/zh-cn/quick_start/pricing"],"id":16,"tg":"🧠 推理"},{"n":"Qwen3-72B","p":"天翼云","pc":"#0078D4","i":2.0,"o":8.0,"cw":"128K","t":"稠密模型","id":17},{"n":"Qwen3.5-397B-A17B(Think)","p":"天翼云","pc":"#0078D4","i":2.0,"o":8.0,"in_":"≤128K;优惠¥1.2","on":"优惠¥4.8","cw":"256K","t":"MoE旗舰","cap":"思考/推理","d":"Qwen旗舰推理","id":18,"tg":"🧠 推理"},{"n":"Qwen3.7-Max","p":"阿里百炼","pc":"#FF6A00","i":2.0,"o":8.0,"cw":"128K","t":"旗舰模型","d":"通义千问最强","isHot":true,"id":20},{"n":"DeepSeek-V4-Pro","p":"DeepSeek","pc":"#4D6BFE","i":3.0,"o":10.0,"cp":0.1,"in_":"缓存未命中","cw":"1M","mo":"128K","t":"旗舰模型","cap":"JSON/Tools/思考","d":"高性能旗舰","isHot":true,"s":["https://api-docs.deepseek.com/zh-cn/quick_start/pricing"],"id":21},{"n":"Qwen3.5-32B-A3B","p":"天翼云","pc":"#0078D4","i":0.5,"o":2.0,"cw":"128K","t":"MoE模型","id":22},{"n":"GLM-5.1","p":"智谱","pc":"#5B4CC4","i":6.0,"o":24.0,"in_":"≤32K;阶梯","on":"阶梯","cw":"128K","t":"旗舰模型","cap":"JSON/工具/思考","d":"智谱旗舰","isHot":true,"id":23,"tg":"🧠 推理"},{"n":"GLM-5-Turbo","p":"智谱","pc":"#5B4CC4","i":1.5,"o":6.0,"in_":"≤32K;阶梯","on":"阶梯","cw":"128K","t":"高性能","d":"高性价比","id":24},{"n":"GLM-5","p":"智谱","pc":"#5B4CC4","i":3.0,"o":12.0,"in_":"≤32K","cw":"128K","t":"旗舰模型","d":"智谱5代","id":25},{"n":"GLM-4.7","p":"智谱","pc":"#5B4CC4","i":0.5,"o":2.0,"in_":"≤32K","cw":"128K","t":"通用模型","d":"高性价比","id":26},{"n":"GLM-4.5-Air","p":"智谱","pc":"#5B4CC4","i":0.5,"o":0.5,"cw":"128K","t":"轻量模型","d":"极致低价","id":27},{"n":"GLM-4.7-FlashX","p":"智谱","pc":"#5B4CC4","i":0,"o":0,"in_":"限时免费","cw":"128K","t":"轻量模型","d":"限时免费","isHot":true,"id":28},{"n":"GLM-5V-Turbo","p":"智谱","pc":"#5B4CC4","i":1.5,"o":6.0,"cw":"128K","t":"多模态","cap":"视觉理解","d":"多模态视觉","id":29,"tg":"👁️ 视觉"},{"n":"GLM-4.6V","p":"智谱","pc":"#5B4CC4","i":1.0,"o":3.0,"cw":"128K","t":"多模态","cap":"视觉理解","d":"视觉模型","id":30,"tg":"👁️ 视觉"},{"n":"GLM-4.6V-Flash","p":"智谱","pc":"#5B4CC4","i":0,"o":0,"in_":"限时免费","cw":"128K","t":"多模态","cap":"视觉理解","d":"免费视觉","isHot":true,"id":31,"tg":"👁️ 视觉"},{"n":"DeepSeek-V4-Flash","p":"硅基流动","pc":"#7C3AED","i":1.0,"o":2.0,"cw":"1M","t":"轻量模型","d":"硅基流动托管","id":32},{"n":"DeepSeek-V4-Pro","p":"硅基流动","pc":"#7C3AED","i":3.0,"o":10.0,"cw":"1M","t":"旗舰模型","d":"硅基流动托管","id":33},{"n":"DeepSeek-R1","p":"硅基流动","pc":"#7C3AED","i":2.0,"o":8.0,"cw":"1M","t":"推理模型","cap":"思考/推理","d":"硅基流动托管","id":34,"tg":"🧠 推理"},{"n":"Qwen3.7-Max","p":"硅基流动","pc":"#7C3AED","i":2.0,"o":8.0,"cw":"128K","t":"旗舰模型","d":"硅基流动托管","id":35},{"n":"Qwen3-235B-A22B","p":"硅基流动","pc":"#7C3AED","i":3.0,"o":12.0,"cw":"128K","t":"MoE旗舰","id":36},{"n":"Kimi-K2.5","p":"硅基流动","pc":"#7C3AED","i":1.0,"o":4.0,"cw":"128K","t":"旗舰模型","d":"Kimi最新","isHot":true,"id":37},{"n":"Pro/Lite/V1/Free","p":"硅基流动","pc":"#7C3AED","i":0,"o":0,"in_":"免费","cw":"32K","t":"免费模型","d":"硅基免费模型","id":38},{"n":"BAAI/BGE系列","p":"硅基流动","pc":"#7C3AED","i":0.3,"o":0,"in_":"Embedding","cw":"512","t":"Embedding","id":39,"tg":"📊 嵌入"},{"n":"Qwen3-Embedding","p":"硅基流动","pc":"#7C3AED","i":0.3,"o":0,"in_":"Embedding","cw":"32K","t":"Embedding","id":40,"tg":"📊 嵌入"}];

function expand(m) {
  return { id:m.id, name:m.n, provider:m.p, providerColor:m.pc,
    inputPrice:m.i, outputPrice:m.o, cachePrice:m.cp,
    inputNote:m["in_"], outputNote:m.on, contextWindow:m.cw, maxOutput:m.mo,
    modelType:m.t, capabilities:m.cap, desc:m.d, sources:m.s,
    isHot:m.isHot, isNew:m.isNew, tag:m.tg }
}

// ============================================================
// 自建服务器 API 配置
// ============================================================
var SELF_HOSTED_API = 'https://api.ltcsky.net/pricing/latest.json'

// 数据源类型: 'auto' | 'selfhosted' | 'cloud'
function getDataSource() {
  try { return wx.getStorageSync('dataSource') || 'auto' } catch(e) { return 'auto' }
}

function setDataSource(source) {
  wx.setStorageSync('dataSource', source)
}

App({
  onLaunch: function() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-d9gnqbtvuc0aebb26',
        traceUser: true
      })
    }
  },
  globalData: {
    models: models,
    expand: expand,
    updateTime: '2026-06-11',
    SELF_HOSTED_API: SELF_HOSTED_API,
    getDataSource: getDataSource,
    setDataSource: setDataSource
  }
})
