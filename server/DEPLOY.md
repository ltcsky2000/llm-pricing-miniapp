# 自建服务器部署指南

将 LLM 定价爬虫从微信云函数迁移到自建 Debian 服务器（1Panel + OpenResty）。

## 架构

```
Linux cron (每天 9:00)
      │
  scraper.py ──→ /opt/llm-pricing/data/latest.json
                      │
  OpenResty 静态 serve ──→ https://api.ltcsky.net/pricing/latest.json
                      │
  小程序 wx.request ──→ 优先请求自建 API
                      │
  微信云函数 ──────────→ 回退数据源
```

---

## 1. 上传文件到云主机

```bash
# 在云主机上创建目录
mkdir -p /opt/llm-pricing/data

# 上传 scraper.py（从本机）
scp server/scraper.py root@<your-host>:/opt/llm-pricing/
```

## 2. 安装 Python 依赖

```bash
# Debian 12 已自带 python3
apt install python3-requests -y
# 或 pip
pip3 install requests
```

## 3. 首次运行，生成种子数据

```bash
python3 /opt/llm-pricing/scraper.py --output /opt/llm-pricing/data/latest.json
```

验证输出：
```bash
cat /opt/llm-pricing/data/latest.json | python3 -m json.tool | head -30
```

## 4. 配置 OpenResty（通过 1Panel）

### 4.1 创建网站

1Panel → 网站 → 创建网站 → 静态网站：
- **域名**: `api.ltcsky.net`（需先在 DNS 解析到该主机）
- **网站目录**: `/opt/llm-pricing/data`
- **SSL**: 启用，自动申请 Let's Encrypt 证书

### 4.2 添加 CORS 头（重要！小程序跨域需要）

1Panel → 网站 → `api.ltcsky.net` → 配置文件 → 在 server 块中添加：

```nginx
# 在 location / 块内添加
location / {
    # ... 原有配置 ...
}

# 允许小程序跨域访问
add_header Access-Control-Allow-Origin *;
add_header Access-Control-Allow-Methods GET,OPTIONS;
add_header Access-Control-Allow-Headers Content-Type;

# 确保 JSON 正确 Content-Type
location ~ \.json$ {
    default_type application/json;
    add_header Access-Control-Allow-Origin *;
}
```

### 4.3 验证

```bash
curl -s https://api.ltcsky.net/pricing/latest.json | python3 -m json.tool | head -10
```

应返回：
```json
{
    "code": 0,
    "data": [...],
    "updateTime": "2026-06-17"
}
```

## 5. 配置定时任务（cron）

### 方式 A：Linux 系统 cron

```bash
crontab -e
# 添加：
0 9 * * * /usr/bin/python3 /opt/llm-pricing/scraper.py --output /opt/llm-pricing/data/latest.json >> /var/log/llm-pricing.log 2>&1
```

### 方式 B：1Panel 计划任务

1Panel → 计划任务 → 创建：
- **名称**: LLM定价更新
- **执行周期**: 每天 09:00
- **脚本**: `/usr/bin/python3 /opt/llm-pricing/scraper.py --output /opt/llm-pricing/data/latest.json`

---

## 6. 小程序后台配置

登录 [微信公众平台](https://mp.weixin.qq.com/) → 开发 → 开发管理 → 服务器域名：
- **request 合法域名**: 添加 `https://api.ltcsky.net`

---

## 7. 数据格式说明

输出的 JSON 格式与微信云函数 `getPricing` 完全一致：

```json
{
  "code": 0,
  "data": [
    {
      "n": "DeepSeek-V4-Flash",
      "p": "DeepSeek",
      "pc": "#4D6BFE",
      "i": 1.0,
      "o": 2.0,
      "cp": 0.02,
      "cw": "1M",
      "t": "轻量模型",
      "id": 8,
      ...
    }
  ],
  "updateTime": "2026-06-17",
  "updatedAt": "2026-06-17T01:00:00.000Z"
}
```

---

## 常见问题

**Q: 爬虫报 SSL 错误？**
A: 云主机可能需要 CA 证书：`apt install ca-certificates -y`

**Q: 小程序请求 403/跨域错误？**
A: 检查 OpenResty 配置中的 CORS 头是否生效：`curl -I https://api.ltcsky.net/pricing/latest.json`

**Q: 如何手动触发更新？**
A: `python3 /opt/llm-pricing/scraper.py`
