// 云函数：获取最新模型定价数据
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const result = await db.collection('pricing').doc('latest').get()
    return {
      code: 0,
      data: result.data.models || [],
      updateTime: result.data.updateTime || ''
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
