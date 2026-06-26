// 云函数：获取最新模型定价数据
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const result = await db.collection('pricing').doc('latest').get()
    var doc = result.data
    // 兼容两种文档格式: {models:[]} 和 {data:{models:[]}}
    var models = doc.models || (doc.data && doc.data.models) || []
    // 兼容数组被误包一层的情况 [[...]] → [...]
    if (models.length === 1 && Array.isArray(models[0])) {
      models = models[0]
    }
    var updateTime = doc.updateTime || (doc.data && doc.data.updateTime) || ''
    return {
      code: 0,
      data: models,
      updateTime: updateTime
    }
  } catch (e) {
    // 数据库为空时，返回空数据让小程序用 fallback
    return {
      code: 404,
      data: [],
      updateTime: '',
      msg: '数据库暂无数据，请先部署 updatePricing 或导入种子数据'
    }
  }
}
