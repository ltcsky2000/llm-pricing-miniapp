#!/usr/bin/env python3
"""
LLM 模型定价爬虫 — 自建服务器版
替代微信云函数 updatePricing，输出 JSON 到文件
用法: python3 scraper.py [--output /path/to/latest.json]
"""

import json, re, sys, os, time, shutil
from datetime import datetime, timezone, timedelta

import requests

# ============================================================
# 种子数据 — 首次运行时使用
# ============================================================
SEED_DATA = [
  {    "n":"Qwen3-8B",
    "p":"天翼云",
    "pc":"#0078D4",
    "i":0.3,
    "o":0.6,
    "cw":"128K",
    "t":"稠密小模型",
    "id":1},
  {    "n":"Qwen3-4B",
    "p":"天翼云",
    "pc":"#0078D4",
    "i":0.3,
    "o":0.6,
    "cw":"32K",
    "t":"稠密小模型",
    "id":2},
  {    "n":"Qwen3.5-35B-A3B",
    "p":"天翼云",
    "pc":"#0078D4",
    "i":0.4,
    "o":3.2,
    "in_":"≤128K",
    "cw":"256K",
    "t":"MoE轻量",
    "d":"极致低价MoE",
    "id":3},
  {    "n":"BGE-m3 (Embedding)",
    "p":"天翼云",
    "pc":"#0078D4",
    "i":0.5,
    "o":0,
    "in_":"Embedding",
    "cw":"8K",
    "t":"Embedding",
    "id":4,
    "tg":"📊 嵌入"},
  {    "n":"Qwen3.5-122B-A10B",
    "p":"天翼云",
    "pc":"#0078D4",
    "i":0.8,
    "o":6.4,
    "in_":"≤128K",
    "cw":"256K",
    "t":"MoE模型",
    "d":"中杯MoE高性价比",
    "id":6},
  {    "n":"Qwen3-14B",
    "p":"天翼云",
    "pc":"#0078D4",
    "i":0.8,
    "o":1.6,
    "cw":"128K",
    "t":"稠密模型",
    "id":7},
  {    "n":"DeepSeek-V4-Flash",
    "p":"DeepSeek",
    "pc":"#4D6BFE",
    "i":1,
    "o":2,
    "cp":0.02,
    "in_":"缓存未命中",
    "cw":"1M",
    "mo":"384K",
    "t":"轻量模型",
    "cap":"JSON/Tools/思考",
    "d":"高性能轻量模型",
    "isHot":True,
    "s":["https://api-docs.deepseek.com/zh-cn/quick_start/pricing"],
    "id":8},
  {    "n":"DeepSeek-V4-Flash(天翼云)",
    "p":"天翼云",
    "pc":"#0078D4",
    "i":1,
    "o":2,
    "in_":"标准时段",
    "cw":"1M",
    "t":"轻量模型",
    "s":["https://www.ctyun.cn/document/11061839/11062267"],
    "id":9,
    "cp":0.02},
  {    "n":"GLM4.6V",
    "p":"天翼云",
    "pc":"#0078D4",
    "i":1,
    "o":3,
    "in_":"≤32K",
    "cw":"128K",
    "t":"多模态",
    "cap":"视觉理解",
    "d":"多模态视觉模型",
    "id":10,
    "tg":"👁️ 视觉"},
  {    "n":"Qwen3-Next-80B-A3B",
    "p":"天翼云",
    "pc":"#0078D4",
    "i":1,
    "o":4,
    "cw":"128K",
    "t":"MoE模型",
    "id":11},
  {    "n":"Qwen3-30B-A3B",
    "p":"天翼云",
    "pc":"#0078D4",
    "i":1,
    "o":4,
    "cw":"128K",
    "t":"MoE轻量",
    "id":12},
  {    "n":"Qwen3-32B",
    "p":"天翼云",
    "pc":"#0078D4",
    "i":1,
    "o":4,
    "cw":"128K",
    "t":"稠密模型",
    "id":13},
  {    "n":"Qwen3.5-397B-A17B",
    "p":"天翼云",
    "pc":"#0078D4",
    "i":1.2,
    "o":7.2,
    "in_":"≤128K;优惠¥0.6",
    "on":"优惠¥3.6",
    "cw":"256K",
    "t":"MoE旗舰",
    "cap":"JSON/Tools/思考",
    "d":"Qwen旗舰397B",
    "isHot":True,
    "id":15},
  {    "n":"DeepSeek-R1",
    "p":"DeepSeek",
    "pc":"#4D6BFE",
    "i":2,
    "o":8,
    "in_":"≤4K",
    "cw":"1M",
    "mo":"64K",
    "t":"推理模型",
    "cap":"思考/推理",
    "d":"顶配推理模型",
    "isHot":True,
    "s":["https://api-docs.deepseek.com/zh-cn/quick_start/pricing"],
    "id":16,
    "tg":"🧠 推理"},
  {    "n":"Qwen3-72B",
    "p":"天翼云",
    "pc":"#0078D4",
    "i":2,
    "o":8,
    "cw":"128K",
    "t":"稠密模型",
    "id":17},
  {    "n":"Qwen3.5-397B-A17B(Think)",
    "p":"天翼云",
    "pc":"#0078D4",
    "i":2,
    "o":8,
    "in_":"≤128K;优惠¥1.2",
    "on":"优惠¥4.8",
    "cw":"256K",
    "t":"MoE旗舰",
    "cap":"思考/推理",
    "d":"Qwen旗舰推理",
    "id":18,
    "tg":"🧠 推理"},
  {    "n":"Qwen3.7-Max",
    "p":"阿里百炼",
    "pc":"#FF6A00",
    "i":2,
    "o":8,
    "cw":"128K",
    "t":"旗舰模型",
    "d":"通义千问最强",
    "isHot":True,
    "id":20},
  {    "n":"DeepSeek-V4-Pro",
    "p":"DeepSeek",
    "pc":"#4D6BFE",
    "i":3,
    "o":10,
    "cp":0.1,
    "in_":"缓存未命中",
    "cw":"1M",
    "mo":"128K",
    "t":"旗舰模型",
    "cap":"JSON/Tools/思考",
    "d":"高性能旗舰",
    "isHot":True,
    "s":["https://api-docs.deepseek.com/zh-cn/quick_start/pricing"],
    "id":21},
  {    "n":"Qwen3.5-32B-A3B",
    "p":"天翼云",
    "pc":"#0078D4",
    "i":0.5,
    "o":2,
    "cw":"128K",
    "t":"MoE模型",
    "id":22},
  {    "n":"GLM-5.1",
    "p":"智谱",
    "pc":"#5B4CC4",
    "i":6,
    "o":24,
    "in_":"≤32K;阶梯",
    "on":"阶梯",
    "cw":"128K",
    "t":"旗舰模型",
    "cap":"JSON/工具/思考",
    "d":"智谱旗舰",
    "isHot":True,
    "id":23,
    "tg":"🧠 推理"},
  {    "n":"GLM-5-Turbo",
    "p":"智谱",
    "pc":"#5B4CC4",
    "i":1.5,
    "o":6,
    "in_":"≤32K;阶梯",
    "on":"阶梯",
    "cw":"128K",
    "t":"高性能",
    "d":"高性价比",
    "id":24},
  {    "n":"GLM-5",
    "p":"智谱",
    "pc":"#5B4CC4",
    "i":3,
    "o":12,
    "in_":"≤32K",
    "cw":"128K",
    "t":"旗舰模型",
    "d":"智谱5代",
    "id":25},
  {    "n":"GLM-4.7",
    "p":"智谱",
    "pc":"#5B4CC4",
    "i":0.5,
    "o":2,
    "in_":"≤32K",
    "cw":"128K",
    "t":"通用模型",
    "d":"高性价比",
    "id":26},
  {    "n":"GLM-4.5-Air",
    "p":"智谱",
    "pc":"#5B4CC4",
    "i":0.5,
    "o":0.5,
    "cw":"128K",
    "t":"轻量模型",
    "d":"极致低价",
    "id":27},
  {    "n":"GLM-4.7-FlashX",
    "p":"智谱",
    "pc":"#5B4CC4",
    "i":0,
    "o":0,
    "in_":"限时免费",
    "cw":"128K",
    "t":"轻量模型",
    "d":"限时免费",
    "isHot":True,
    "id":28},
  {    "n":"GLM-5V-Turbo",
    "p":"智谱",
    "pc":"#5B4CC4",
    "i":1.5,
    "o":6,
    "cw":"128K",
    "t":"多模态",
    "cap":"视觉理解",
    "d":"多模态视觉",
    "id":29,
    "tg":"👁️ 视觉"},
  {    "n":"GLM-4.6V",
    "p":"智谱",
    "pc":"#5B4CC4",
    "i":1,
    "o":3,
    "cw":"128K",
    "t":"多模态",
    "cap":"视觉理解",
    "d":"视觉模型",
    "id":30,
    "tg":"👁️ 视觉"},
  {    "n":"GLM-4.6V-Flash",
    "p":"智谱",
    "pc":"#5B4CC4",
    "i":0,
    "o":0,
    "in_":"限时免费",
    "cw":"128K",
    "t":"多模态",
    "cap":"视觉理解",
    "d":"免费视觉",
    "isHot":True,
    "id":31,
    "tg":"👁️ 视觉"},
  {    "n":"DeepSeek-V4-Flash",
    "p":"硅基流动",
    "pc":"#7C3AED",
    "i":1,
    "o":2,
    "cw":"1M",
    "t":"轻量模型",
    "d":"硅基流动托管",
    "id":32},
  {    "n":"DeepSeek-V4-Pro",
    "p":"硅基流动",
    "pc":"#7C3AED",
    "i":3,
    "o":10,
    "cw":"1M",
    "t":"旗舰模型",
    "d":"硅基流动托管",
    "id":33},
  {    "n":"DeepSeek-R1",
    "p":"硅基流动",
    "pc":"#7C3AED",
    "i":2,
    "o":8,
    "cw":"1M",
    "t":"推理模型",
    "cap":"思考/推理",
    "d":"硅基流动托管",
    "id":34,
    "tg":"🧠 推理"},
  {    "n":"Qwen3.7-Max",
    "p":"硅基流动",
    "pc":"#7C3AED",
    "i":2,
    "o":8,
    "cw":"128K",
    "t":"旗舰模型",
    "d":"硅基流动托管",
    "id":35},
  {    "n":"Qwen3-235B-A22B",
    "p":"硅基流动",
    "pc":"#7C3AED",
    "i":3,
    "o":12,
    "cw":"128K",
    "t":"MoE旗舰",
    "id":36},
  {    "n":"Kimi-K2.5",
    "p":"硅基流动",
    "pc":"#7C3AED",
    "i":1,
    "o":4,
    "cw":"128K",
    "t":"旗舰模型",
    "d":"Kimi最新",
    "isHot":True,
    "id":37},
  {    "n":"Pro/Lite/V1/Free",
    "p":"硅基流动",
    "pc":"#7C3AED",
    "i":0,
    "o":0,
    "in_":"免费",
    "cw":"32K",
    "t":"免费模型",
    "d":"硅基免费模型",
    "id":38},
  {    "n":"BAAI/BGE系列",
    "p":"硅基流动",
    "pc":"#7C3AED",
    "i":0.3,
    "o":0,
    "in_":"Embedding",
    "cw":"512",
    "t":"Embedding",
    "id":39,
    "tg":"📊 嵌入"},
  {    "n":"Qwen3-Embedding",
    "p":"硅基流动",
    "pc":"#7C3AED",
    "i":0.3,
    "o":0,
    "in_":"Embedding",
    "cw":"32K",
    "t":"Embedding",
    "id":40,
    "tg":"📊 嵌入"},
]

# ============================================================
# 工具函数
# ============================================================

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"

def fetch(url, timeout=15):
    """GET 请求，返回文本"""
    resp = requests.get(url, headers={"User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9"}, timeout=timeout)
    resp.raise_for_status()
    return resp.text

def find_models(models, name_pattern, provider=None):
    """模糊匹配模型名，可选过滤 provider"""
    lower = name_pattern.lower()
    result = [m for m in models if m.get("n") and lower in m["n"].lower()]
    if provider:
        result = [m for m in result if m.get("p") == provider]
    return result

def load_existing(path):
    """加载已有数据"""
    if os.path.exists(path):
        with open(path) as f:
            existing = json.load(f)
            return existing.get("data", [])
    return []

def save_result(models, output_path):
    """写入 JSON 到文件"""
    bj_tz = timezone(timedelta(hours=8))
    ds = datetime.now(bj_tz).strftime("%Y-%m-%d")
    now = datetime.now(timezone.utc).isoformat()
    result = {
        "code": 0,
        "data": models,
        "updateTime": ds,
        "updatedAt": now
    }
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(result, f, ensure_ascii=False)

# ============================================================
# 爬虫函数
# ============================================================

def scrape_deepseek(models):
    """DeepSeek 官方定价页"""
    html = fetch("https://api-docs.deepseek.com/zh-cn/quick_start/pricing")
    if not html:
        return
    # V4-Flash
    m = re.search(r"deepseek-v4-flash[\s\S]{0,500}?缓存命中[：:]\s*([\d.]+)\s*元[\s\S]{0,200}?缓存未命中[：:]\s*([\d.]+)\s*元[\s\S]{0,200}?输出[：:]\s*([\d.]+)\s*元", html, re.I)
    if m and float(m.group(3)) >= 1:
        c, i, o = float(m.group(1)), float(m.group(2)), float(m.group(3))
        for mod in find_models(models, "DeepSeek-V4-Flash"):
            mod["i"], mod["o"], mod["cp"] = i, o, c
    # V4-Pro
    m = re.search(r"deepseek-v4-pro[\s\S]{0,500}?缓存命中[：:]\s*([\d.]+)\s*元[\s\S]{0,200}?缓存未命中[：:]\s*([\d.]+)\s*元[\s\S]{0,200}?输出[：:]\s*([\d.]+)\s*元", html, re.I)
    if m and float(m.group(3)) >= 3:
        c, i, o = float(m.group(1)), float(m.group(2)), float(m.group(3))
        for mod in find_models(models, "DeepSeek-V4-Pro"):
            mod["i"], mod["o"], mod["cp"] = i, o, c


def scrape_bailian(models):
    """阿里百炼定价页"""
    html = fetch("https://help.aliyun.com/zh/model-studio/model-pricing")
    if not html:
        return
    m = re.search(r"qwen3\.7[.-]max[\s\S]{0,300}?([\d.]+)\s*元[\s\S]{0,200}?([\d.]+)\s*元", html, re.I)
    if m:
        ip, op = float(m.group(1)), float(m.group(2))
        for mod in find_models(models, "qwen3.7-max"):
            mod["i"], mod["o"] = ip, op


def scrape_ctyun(models):
    """天翼云文档页 — 解析定价表格"""
    html = fetch("https://www.ctyun.cn/document/11061839/11062267")
    if not html:
        return
    table = re.search(r"<tbody>[\s\S]{0,50000}</tbody>", html)
    if not table:
        return
    content = table.group(0)

    updated = 0
    for match in re.finditer(r'<tr><td[^>]*rowspan="(\d+)">([^<]+)</td>', content):
        name = match.group(2).strip()
        if "输入" in name or "输出" in name:
            continue

        start = match.start()
        remaining = content[start:]
        next_match = re.search(r'<tr><td[^>]*rowspan="\d+">', remaining[150:])
        block_end = 150 + next_match.start() if next_match else len(remaining)
        block = remaining[:block_end]

        inp = re.search(r'<(?:td|p|span)[^>]*>输[入]</[^>]*>(?:[\s\S]{0,50}?<[^>]*>)?[\s\S]{0,30}?<td(?!\s*class="td1)[^>]*>([\d.]+)</td>', block)
        outp = re.search(r'<(?:td|p|span)[^>]*>输[出]</[^>]*>(?:[\s\S]{0,50}?<[^>]*>)?[\s\S]{0,30}?<td(?!\s*class="td1)[^>]*>([\d.]+)</td>', block)
        if not inp or not outp:
            continue

        ip, op = float(inp.group(1)), float(outp.group(1))
        clean_name = re.sub(r"（.*?）", "", name).replace("-Instruct", "")
        matches = find_models(models, clean_name, provider="天翼云")
        for mod in matches:
            mod["i"], mod["o"] = ip, op
            updated += 1

    if updated:
        print(f"[天翼云] 更新 {updated} 个模型价格")


def scrape_siliconflow(models):
    """硅基流动定价页"""
    html = fetch("https://siliconflow.cn/pricing")
    if not html:
        return
    sections = re.split(r"对话模型|生图模型|语音模型|视频模型", html)
    if len(sections) < 2:
        print("[硅基流动] 未找到定价区域")
        return

    chat_section = sections[1]
    lines = [l.strip() for l in chat_section.split("\n") if l.strip()]
    updated = 0
    vendors = ["deepseek-ai","Kimi","Z-ai","nex-agi","MiniMaxAI","Tongyi-MAI","Baidu","Qwen","Stepfun-ai","inclusionAI","hunyuan","ByteDance","BAAI","Kolors","youdao"]

    for i, line in enumerate(lines):
        if line in vendors:
            continue
        if line.startswith("¥") or line.startswith("免费") or line.startswith("输入") or line.startswith("展开") or \
           line == "-" or line.startswith("厂商") or line.startswith("模型") or line.startswith("输入价格") or \
           line.startswith("输出价格") or line.startswith("缓存价格") or line.startswith("1314") or len(line) < 2:
            continue

        # 收集后续价格行
        next_lines = []
        for j in range(i + 1, min(i + 8, len(lines))):
            nl = lines[j]
            if nl and not nl.startswith("展开") and not nl.startswith("输入[") and not nl.startswith("1314"):
                next_lines.append(nl)

        prices = []
        for nl in next_lines:
            if nl.startswith("¥"):
                try:
                    prices.append(float(nl.replace("¥ ", "").replace(",", "")))
                except ValueError:
                    pass

        if len(prices) >= 2:
            ip, op = prices[0], prices[1]
            name_only = re.sub(r"\(.*?\)", "", line).strip()
            matches = find_models(models, name_only, provider="硅基流动")
            for mod in matches:
                mod["i"], mod["o"] = ip, op
                updated += 1
                print(f"  [OK] {line}: ¥{ip}→¥{op}")

    if updated:
        print(f"[硅基流动] 更新 {updated} 个模型价格")


def scrape_zhipu(models):
    """智谱定价页"""
    html = fetch("https://bigmodel.cn/pricing")
    if not html:
        return

    model_prices = [
        {"name": "GLM-5.1", "pat": [
            re.compile(r"GLM-5\.1[\s\S]{0,200}?输入长度\s*\[0,\s*32\)[\s\S]{0,200}?([\d.]+)元[\s\S]{0,100}?([\d.]+)元"),
        ]},
        {"name": "GLM-5-Turbo", "pat": [
            re.compile(r"GLM-5-Turbo[\s\S]{0,200}?输入长度\s*\[0,\s*32\)[\s\S]{0,200}?([\d.]+)元[\s\S]{0,100}?([\d.]+)元"),
        ]},
        {"name": "GLM-5", "pat": [
            re.compile(r"GLM-5[^T][\s\S]{0,200}?输入长度\s*\[0,\s*32\)[\s\S]{0,200}?([\d.]+)元[\s\S]{0,100}?([\d.]+)元"),
        ]},
        {"name": "GLM-4.7", "pat": [
            re.compile(r"GLM-4\.7[^F][^V][\s\S]{0,200}?输入长度\s*\[0,\s*32\)[\s\S]{0,200}?输出长度\s*\[0,\s*0\.2\)[\s\S]{0,200}?([\d.]+)元[\s\S]{0,100}?([\d.]+)元"),
        ]},
        {"name": "GLM-4.5-Air", "pat": [
            re.compile(r"GLM-4\.5-Air[\s\S]{0,200}?输入长度\s*\[0,\s*32\)[\s\S]{0,200}?输出长度\s*\[0,\s*0\.2\)[\s\S]{0,200}?([\d.]+)元[\s\S]{0,100}?([\d.]+)元"),
        ]},
        {"name": "GLM-4.7-FlashX", "pat": [
            re.compile(r"GLM-4\.7-FlashX[\s\S]{0,200}?([\d.]+)元[\s\S]{0,100}?([\d.]+)元[\s\S]{0,100}?限时免费"),
        ]},
        {"name": "GLM-5V-Turbo", "pat": [
            re.compile(r"GLM-5V-Turbo[\s\S]{0,200}?输入长度\s*\[0,\s*32\)[\s\S]{0,200}?([\d.]+)元[\s\S]{0,100}?([\d.]+)元"),
        ]},
        {"name": "GLM-4.6V", "pat": [
            re.compile(r"GLM-4\.6V[^s][^F][\s\S]{0,200}?输入长度\s*\[0,\s*32\)[\s\S]{0,200}?([\d.]+)元[\s\S]{0,100}?([\d.]+)元"),
        ]},
    ]

    updated = 0
    for mp in model_prices:
        for pat in mp["pat"]:
            m = pat.search(html)
            if m:
                ip, op = float(m.group(1)), float(m.group(2))
                matches = [mod for mod in models if mod.get("n") and mp["name"] in mod["n"] and mod.get("p") == "智谱"]
                for mod in matches:
                    mod["i"], mod["o"] = ip, op
                    updated += 1
                    print(f"  [OK] {mp['name']}: ¥{ip}→¥{op}")
                break

    if updated:
        print(f"[智谱] 更新 {updated} 个模型")


# ============================================================
# 主函数
# ============================================================

def main(output_path="/opt/llm-pricing/data/latest.json", sync_path=None):
    start = time.time()
    print(f"[scraper] 开始执行, 输出: {output_path}")

    # 加载已有数据或种子数据
    models = load_existing(output_path)
    is_seeded = False
    if not models:
        import copy
        models = copy.deepcopy(SEED_DATA)
        is_seeded = True
        print(f"[INIT] 导入 {len(models)} 条种子数据")
    else:
        # 合并种子中的新模型
        existing_ids = {m["id"] for m in models}
        new_models = [m for m in SEED_DATA if m["id"] not in existing_ids]
        if new_models:
            import copy
            models.extend(copy.deepcopy(new_models))
            providers = list({m["p"] for m in new_models})
            print(f"[MERGE] 新增 {len(new_models)} 个模型 ({', '.join(providers)})")
        print(f"[LOAD] {len(models)} 条")

    errors = []

    # 依次执行爬虫
    for name, fn in [("DeepSeek", scrape_deepseek), ("阿里百炼", scrape_bailian),
                      ("天翼云", scrape_ctyun), ("硅基流动", scrape_siliconflow),
                      ("智谱", scrape_zhipu)]:
        try:
            fn(models)
        except Exception as e:
            err_msg = f"{name}: {e}"
            errors.append(err_msg)
            print(f"[ERROR] {err_msg}")

    # 保存
    try:
        save_result(models, output_path)
        elapsed = time.time() - start
        print(f"[SAVE] {len(models)} 条 | 耗时 {elapsed:.1f}s")
        # 同步到 1Panel 网站目录
        if sync_path:
            os.makedirs(os.path.dirname(sync_path), exist_ok=True)
            shutil.copy2(output_path, sync_path)
            print(f"[SYNC] → {sync_path}")
    except Exception as e:
        errors.append(f"Save: {e}")
        print(f"[ERROR] Save: {e}")

    elapsed = time.time() - start
    scraper_status = {
        "deepseek": not any(e.startswith("DeepSeek") for e in errors),
        "bailian": not any(e.startswith("阿里百炼") for e in errors),
        "ctyun": not any(e.startswith("天翼云") for e in errors),
        "siliconflow": not any(e.startswith("硅基流动") for e in errors),
        "zhipu": not any(e.startswith("智谱") for e in errors),
    }
    print(f"[DONE] 总耗时 {elapsed:.1f}s | scrapers: {scraper_status}")

    return {
        "code": 0,
        "modelCount": len(models),
        "isSeeded": is_seeded,
        "totalTime": f"{elapsed:.1f}s",
        "scrapers": scraper_status,
        "errors": errors if errors else None
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="LLM 模型定价爬虫")
    parser.add_argument("--output", "-o", default="/opt/llm-pricing/data/latest.json", help="输出 JSON 路径")
    parser.add_argument("--sync", "-s", default="/opt/1panel/www/sites/api.ltcsky.net/index/pricing/latest.json", help="同步到 1Panel 网站目录")
    args = parser.parse_args()
    result = main(args.output, args.sync)
    print(json.dumps(result, ensure_ascii=False, indent=2))
