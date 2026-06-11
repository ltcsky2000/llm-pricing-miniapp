#!/usr/bin/env node
/**
 * 数据库初始化脚本
 * 在微信开发者工具中，右键云函数目录 -> 在终端中打开
 * 然后执行: node init_database.js
 *
 * 或者直接在云函数中首次调用 updatePricing 时会自动导入种子数据
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: process.env.CLOUD_ENV || 'YOUR-ENV-ID' })
const db = cloud.database()
const SEED_DATA = require('./seed_data.js')

async function main() {
  console.log('正在检查数据库...')
  try {
    const result = await db.collection('pricing').doc('latest').get()
    console.log(`数据库已有 ${result.data.models.length} 条数据，无需初始化`)
    console.log(`更新日期: ${result.data.updateTime}`)
    return
  } catch (e) {
    console.log('数据库为空，开始导入种子数据...')
  }

  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  
  await db.collection('pricing').add({
    data: {
      _id: 'latest',
      models: SEED_DATA,
      updateTime: dateStr,
      createdAt: db.serverDate()
    }
  })
  
  console.log(`✓ 成功导入 ${SEED_DATA.length} 条模型数据`)
  console.log(`✓ 数据日期: ${dateStr}`)
  console.log('\n现在可以在小程序中查看实时数据了！')
}

main().catch(console.error)
