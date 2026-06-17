# 微信云开发部署指南

## 架构说明

```
┌─────────────────┐     每天 9:00 定时触发     ┌──────────────────┐
│  updatePricing  │ ──────────────────────────→ │  云数据库 pricing │
│  (云函数·爬虫)   │      爬取·更新价格数据        │  collection       │
└─────────────────┘                             └────────┬─────────┘
                                                         │
                                               wx.cloud.callFunction
                                                         │
                                          ┌──────────────▼──────────┐
                                          │  getPricing (云函数)     │
                                          │  查询最新数据返回         │
                                          └──────────────┬──────────┘
                                                         │
                                              ┌──────────▼──────────┐
                                              │  小程序页面           │
                                              │  (自动降级到本地数据)  │
                                              └─────────────────────┘
```

- **updatePricing**: 定时云函数，每天 9:00 自动爬取各厂商最新价格 → 写入云数据库
- **getPricing**: 查询云函数，小程序调用获取最新数据
- **数据降级**: 云函数不可用时自动使用 app.js 内的本地数据

---

## 部署步骤

### 1. 开通云开发

1. 在微信开发者工具中，点击工具栏「云开发」按钮
2. 点击「开通」，选择环境名称（如 `llm-pricing-prod`）
3. 开通后记录 **环境 ID**（在云开发控制台 → 设置中可见）

### 2. 配置环境 ID

打开 `/projects/llm-pricing-miniapp/app.js`，将 `YOUR-ENV-ID` 替换为你的真实环境 ID：

```js
wx.cloud.init({
  env: 'llm-pricing-prod-xxxxxxxx', // ← 替换这里
  traceUser: true
})
```

### 3. 上传云函数

在微信开发者工具中：
1. 展开左侧 `cloudfunctions/` 目录
2. 右键 `getPricing` → 「上传并部署：云端安装依赖」
3. 右键 `updatePricing` → 「上传并部署：云端安装依赖」

**⚠️ 重要：修改 config.json 后必须单独上传触发器！**

上传云函数不会自动更新触发规则。每次修改 `config.json` 后必须：
4. 右键 `updatePricing` → 「上传触发器」

否则云端仍使用旧的 cron 表达式，定时任务可能无法正确触发。

### 4. 初始化数据库

**方法 A（推荐）—— 调用一次 updatePricing：**
1. 在云开发控制台 → 云函数 → 找到 `updatePricing`
2. 点击「测试」，直接调用
3. 首次调用会自动导入 45 条种子数据到数据库

**方法 B —— 使用初始化脚本：**
1. 在开发者工具中，右键 `cloudfunctions/` → 「在终端中打开」
2. 执行：`node init_database.js`
3. 看到 "成功导入 45 条模型数据" 即完成

### 5. 验证小程序

1. 重新编译小程序（工具栏 → 编译按钮）
2. 列表页应出现加载提示「正在获取最新价格数据...」
3. 加载完成后显示云数据库中的数据
4. 下拉刷新可重新获取最新价格

---

## 数据库结构

**集合名**: `pricing`
**文档 ID**: `latest`
**数据结构**:
```json
{
  "_id": "latest",
  "models": [
    { "n": "DeepSeek-V4-Flash", "p": "DeepSeek", "i": 1.0, "o": 2.0, ... }
  ],
  "updateTime": "2026-06-11",
  "updatedAt": "2026-06-11T01:00:00.000Z"
}
```

---

## 扩展爬虫

`cloudfunctions/updatePricing/index.js` 中的 `scrape*` 函数可随时扩展。

例如新增 OpenAI 爬取：
```js
async function scrapeOpenAI(models) {
  console.log('[OpenAI] 开始爬取...')
  const html = await fetchUrl('https://platform.openai.com/docs/pricing')
  // ...解析逻辑
}
```

然后在 `main` 函数中添加调用：
```js
try { await scrapeOpenAI(models) } catch (e) { errors.push(`OpenAI: ${e.message}`) }
```

---

## 回滚方案

如云开发遇到问题，可随时回退到纯本地模式：

1. `app.js` 中移除 `onLaunch` 里的云初始化代码
2. `pages/index/index.js` 的 `onLoad` 直接调用 `fallbackToLocal()`
3. 数据完全从 app.js 的 `globalData` 中读取

备份在：
- git tag: `backup-before-cloud-20260611`
- 目录: `/projects/llm-pricing-miniapp.backup-20260611/`
