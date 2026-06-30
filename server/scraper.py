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
  {"n":"Qwen3-8B","p":"天翼云","pc":"#0078D4","i":0.3,"o":0.6,"cw":"128K","t":"稠密小模型","id":1},
  {"n":"Qwen3-4B","p":"天翼云","pc":"#0078D4","i":0.3,"o":0.6,"cw":"32K","t":"稠密小模型","id":2},
  {"n":"Qwen3.5-35B-A3B","p":"天翼云","pc":"#0078D4","i":0.4,"o":3.2,"in_":"≤128K","cw":"256K","t":"MoE轻量","d":"极致低价MoE","id":3},
  {"n":"BGE-m3 (Embedding)","p":"天翼云","pc":"#0078D4","i":0.5,"o":0,"in_":"Embedding","cw":"8K","t":"Embedding","id":4,"tg":"📊 嵌入"},
  {"n":"Qwen3.5-122B-A10B","p":"天翼云","pc":"#0078D4","i":0.8,"o":6.4,"in_":"≤128K","cw":"256K","t":"MoE模型","d":"中杯MoE高性价比","id":6},
  {"n":"Qwen3-14B","p":"天翼云","pc":"#0078D4","i":0.8,"o":1.6,"cw":"128K","t":"稠密模型","id":7},
  {"n":"DeepSeek-V4-Flash","p":"DeepSeek","pc":"#4D6BFE","i":1,"o":2,"cp":0.02,"in_":"缓存未命中","cw":"1M","mo":"384K","t":"轻量模型","cap":"JSON/Tools/思考","d":"高性能轻量模型","isHot":True,"s":["https://api-docs.deepseek.com/zh-cn/quick_start/pricing"],"id":8},
  {"n":"DeepSeek-V4-Flash(天翼云)","p":"天翼云","pc":"#0078D4","i":1,"o":2,"in_":"标准时段","cw":"1M","t":"轻量模型","s":["https://www.ctyun.cn/document/11061839/11062267"],"id":9,"cp":0.02},
  {"n":"GLM4.6V","p":"天翼云","pc":"#0078D4","i":1,"o":3,"in_":"≤32K","cw":"128K","t":"多模态","cap":"视觉理解","d":"多模态视觉模型","id":10,"tg":"👁️ 视觉"},
  {"n":"Qwen3-Next-80B-A3B","p":"天翼云","pc":"#0078D4","i":1,"o":4,"cw":"128K","t":"MoE模型","id":11},
  {"n":"Qwen3-30B-A3B","p":"天翼云","pc":"#0078D4","i":1,"o":4,"cw":"128K","t":"MoE轻量","id":12},
  {"n":"Qwen3-32B","p":"天翼云","pc":"#0078D4","i":1,"o":4,"cw":"128K","t":"稠密模型","id":13},
  {"n":"Qwen3.5-397B-A17B","p":"天翼云","pc":"#0078D4","i":1.2,"o":7.2,"in_":"≤128K;优惠¥0.6","on":"优惠¥3.6","cw":"256K","t":"MoE旗舰","cap":"JSON/Tools/思考","d":"Qwen旗舰397B","isHot":True,"id":15},
  {"n":"DeepSeek-R1","p":"DeepSeek","pc":"#4D6BFE","i":2,"o":8,"in_":"≤4K","cw":"1M","mo":"64K","t":"推理模型","cap":"思考/推理","d":"顶配推理模型","isHot":True,"s":["https://api-docs.deepseek.com/zh-cn/quick_start/pricing"],"id":16,"tg":"🧠 推理"},
  {"n":"Qwen3-72B","p":"天翼云","pc":"#0078D4","i":2,"o":8,"cw":"128K","t":"稠密模型","id":17},
  {"n":"Qwen3.5-397B-A17B(Think)","p":"天翼云","pc":"#0078D4","i":2,"o":8,"in_":"≤128K;优惠¥1.2","on":"优惠¥4.8","cw":"256K","t":"MoE旗舰","cap":"思考/推理","d":"Qwen旗舰推理","id":18,"tg":"🧠 推理"},
  {"n":"DeepSeek-V4-Pro","p":"DeepSeek","pc":"#4D6BFE","i":3,"o":10,"cp":0.1,"in_":"缓存未命中","cw":"1M","mo":"128K","t":"旗舰模型","cap":"JSON/Tools/思考","d":"高性能旗舰","isHot":True,"s":["https://api-docs.deepseek.com/zh-cn/quick_start/pricing"],"id":21},
  {"n":"Qwen3.5-32B-A3B","p":"天翼云","pc":"#0078D4","i":0.5,"o":2,"cw":"128K","t":"MoE模型","id":22},
  {"n":"GLM-5.1","p":"智谱","pc":"#5B4CC4","i":6,"o":24,"in_":"≤32K;阶梯","on":"阶梯","cw":"128K","t":"旗舰模型","cap":"JSON/工具/思考","d":"智谱旗舰","isHot":True,"id":23,"tg":"🧠 推理"},
  {"n":"GLM-5-Turbo","p":"智谱","pc":"#5B4CC4","i":1.5,"o":6,"in_":"≤32K;阶梯","on":"阶梯","cw":"128K","t":"高性能","d":"高性价比","id":24},
  {"n":"GLM-5","p":"智谱","pc":"#5B4CC4","i":3,"o":12,"in_":"≤32K","cw":"128K","t":"旗舰模型","d":"智谱5代","id":25},
  {"n":"GLM-4.7","p":"智谱","pc":"#5B4CC4","i":0.5,"o":2,"in_":"≤32K","cw":"128K","t":"通用模型","d":"高性价比","id":26},
  {"n":"GLM-4.5-Air","p":"智谱","pc":"#5B4CC4","i":0.5,"o":0.5,"cw":"128K","t":"轻量模型","d":"极致低价","id":27},
  {"n":"GLM-4.7-FlashX","p":"智谱","pc":"#5B4CC4","i":0,"o":0,"in_":"限时免费","cw":"128K","t":"轻量模型","d":"限时免费","isHot":True,"id":28},
  {"n":"GLM-5V-Turbo","p":"智谱","pc":"#5B4CC4","i":1.5,"o":6,"cw":"128K","t":"多模态","cap":"视觉理解","d":"多模态视觉","id":29,"tg":"👁️ 视觉"},
  {"n":"GLM-4.6V","p":"智谱","pc":"#5B4CC4","i":1,"o":3,"cw":"128K","t":"多模态","cap":"视觉理解","d":"视觉模型","id":30,"tg":"👁️ 视觉"},
  {"n":"GLM-4.6V-Flash","p":"智谱","pc":"#5B4CC4","i":0,"o":0,"in_":"限时免费","cw":"128K","t":"多模态","cap":"视觉理解","d":"免费视觉","isHot":True,"id":31,"tg":"👁️ 视觉"},
  {"n":"DeepSeek-V4-Flash","p":"硅基流动","pc":"#7C3AED","i":1,"o":2,"cw":"1M","t":"轻量模型","d":"硅基流动托管","id":32},
  {"n":"DeepSeek-V4-Pro","p":"硅基流动","pc":"#7C3AED","i":3,"o":10,"cw":"1M","t":"旗舰模型","d":"硅基流动托管","id":33},
  {"n":"DeepSeek-R1","p":"硅基流动","pc":"#7C3AED","i":2,"o":8,"cw":"1M","t":"推理模型","cap":"思考/推理","d":"硅基流动托管","id":34,"tg":"🧠 推理"},
  {"n":"Qwen3.7-Max","p":"硅基流动","pc":"#7C3AED","i":2,"o":8,"cw":"128K","t":"旗舰模型","d":"硅基流动托管","id":35},
  {"n":"Qwen3-235B-A22B","p":"硅基流动","pc":"#7C3AED","i":3,"o":12,"cw":"128K","t":"MoE旗舰","id":36},
  {"n":"Kimi-K2.5","p":"硅基流动","pc":"#7C3AED","i":1,"o":4,"cw":"128K","t":"旗舰模型","d":"Kimi最新","isHot":True,"id":37},
  {"n":"Pro/Lite/V1/Free","p":"硅基流动","pc":"#7C3AED","i":0,"o":0,"in_":"免费","cw":"32K","t":"免费模型","d":"硅基免费模型","id":38},
  {"n":"BAAI/BGE系列","p":"硅基流动","pc":"#7C3AED","i":0.3,"o":0,"in_":"Embedding","cw":"512","t":"Embedding","id":39,"tg":"📊 嵌入"},
  {"n":"Qwen3-Embedding","p":"硅基流动","pc":"#7C3AED","i":0.3,"o":0,"in_":"Embedding","cw":"32K","t":"Embedding","id":40,"tg":"📊 嵌入"},
  {"n":"Kimi-K2.7-Code","p":"Kimi","pc":"#FF6B9D","i":6.5,"o":27.0,"cp":1.3,"cw":"262K","t":"编程模型","cap":"代码生成","d":"Kimi最强代码模型","isHot":True,"id":66},
  {"n":"Kimi-K2.7-Code-Highspeed","p":"Kimi","pc":"#FF6B9D","i":13.0,"o":54.0,"cp":2.6,"cw":"262K","t":"编程模型","d":"K2.7高速版","id":67},
  {"n":"Kimi-K2.6","p":"Kimi","pc":"#FF6B9D","i":6.5,"o":27.0,"cp":1.1,"cw":"262K","t":"旗舰模型","cap":"多模态/思考","d":"Kimi多模态旗舰","id":68},
  {"n":"Kimi-K2.5","p":"Kimi","pc":"#FF6B9D","i":4.0,"o":21.0,"cp":0.7,"cw":"262K","t":"旗舰模型","cap":"多模态/思考","d":"月之暗面旗舰","isHot":True,"id":51,"tg":"🧠 推理"},
  {"n":"qwen3.7-max","p":"阿里百炼","pc":"#FF6A00","i":12.0,"o":36.0,"cw":"1M","t":"旗舰模型","d":"阿里千问旗舰","isHot":True,"s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":38},
  {"n":"qwen3.7-plus","p":"阿里百炼","pc":"#FF6A00","i":2.0,"o":8.0,"cw":"1M","t":"中杯模型","d":"百炼高性价比","in_":"≤256K","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":39},
  {"n":"qwq-plus","p":"阿里百炼","pc":"#FF6A00","i":1.6,"o":4.0,"cw":"128K","t":"推理模型","cap":"思考/推理","d":"百炼推理模型","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":40,"tg":"🧠 推理"},
  {"n":"deepseek-v4-pro","p":"阿里百炼","pc":"#FF6A00","i":12.0,"o":24.0,"cw":"1M","t":"旗舰模型","cap":"上下文缓存","d":"百炼平台旗舰","in_":"缓存折扣","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":41},
  {"n":"deepseek-v4-flash","p":"阿里百炼","pc":"#FF6A00","i":1.0,"o":2.0,"cw":"1M","t":"轻量模型","cap":"上下文缓存","d":"百炼平台轻量","in_":"缓存折扣","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":42},
  {"n":"kimi-k2.6","p":"阿里百炼","pc":"#FF6A00","i":6.5,"o":27.0,"cw":"1M","t":"旗舰模型","cap":"思考/推理","d":"月之暗面Kimi","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":43},
  {"n":"glm-5.1","p":"阿里百炼","pc":"#FF6A00","i":6.0,"o":24.0,"cw":"200K","t":"旗舰模型","cap":"思考/推理","d":"智谱旗舰GLM","in_":"≤32K","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":44},
  {"n":"MiniMax-M2.7","p":"阿里百炼","pc":"#FF6A00","i":2.1,"o":8.4,"cw":"128K","t":"中杯模型","cap":"思考/推理","d":"稀宇科技Minimax","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":45},
  {"n":"MiniMax-M3","p":"MiniMax","pc":"#FF4500","i":2.1,"o":8.4,"cp":0.42,"cw":"512K","t":"旗舰模型","cap":"Agent/工具/多模态","d":"MiniMax最新旗舰Agent模型","isHot":True,"id":70,"tg":"🧠 推理"},
  {"n":"MiniMax-M2.7","p":"MiniMax","pc":"#FF4500","i":2.1,"o":8.4,"cp":0.42,"cw":"256K","t":"旗舰模型","cap":"多模态","d":"M2.7旗舰","id":71},
  {"n":"MiniMax-M2.5","p":"MiniMax","pc":"#FF4500","i":2.1,"o":8.4,"cp":0.21,"cw":"256K","t":"高性能","d":"M2.5高性价比","id":72},
  {"n":"MiniMax-M2.1","p":"MiniMax","pc":"#FF4500","i":2.1,"o":8.4,"cp":0.21,"cw":"256K","t":"通用模型","d":"M2.1标准版","id":73},
  {"n":"GPT-5.5","p":"OpenAI","pc":"#10A37F","i":5.0,"o":30.0,"cp":0.5,"cw":"270K","t":"旗舰模型","cap":"编码/专业工作","d":"OpenAI最强旗舰","isHot":True,"id":80,"cu":"$"},
  {"n":"GPT-5.4","p":"OpenAI","pc":"#10A37F","i":2.5,"o":15.0,"cp":0.25,"cw":"270K","t":"高性能","d":"高性价比旗舰","id":81,"cu":"$"},
  {"n":"GPT-5.4-mini","p":"OpenAI","pc":"#10A37F","i":0.75,"o":4.5,"cp":0.075,"cw":"270K","t":"轻量模型","d":"最强mini模型","id":82,"cu":"$"},
  {"n":"Gemini-2.5-Pro","p":"Gemini","pc":"#4285F4","i":8.75,"o":35.0,"cu":"$","cw":"1M","t":"旗舰模型","cap":"多模态/思考","d":"G家旗舰","isHot":True,"id":60,"cu":"$"},
  {"n":"Gemini-2.5-Flash","p":"Gemini","pc":"#4285F4","i":1.05,"o":4.2,"cu":"$","cw":"1M","t":"轻量模型","d":"G家轻量","id":61,"cu":"$"},
  {"n":"Fable 5","p":"Anthropic","pc":"#D4A574","i":10.0,"o":50.0,"cp":12.5,"cw":"200K","t":"旗舰模型","cap":"Agent/长任务","d":"Claude最强旗舰","isHot":True,"id":90,"cu":"$"},
  {"n":"Opus 4.8","p":"Anthropic","pc":"#D4A574","i":5.0,"o":25.0,"cp":6.25,"cu":"$","cw":"200K","t":"旗舰模型","cap":"编程/企业","d":"复杂agentic编程","id":91,"cu":"$"},
  {"n":"Sonnet 4.6","p":"Anthropic","pc":"#D4A574","i":3.0,"o":15.0,"cp":3.75,"cu":"$","cw":"200K","t":"高性能","d":"智能与速度平衡","id":92,"cu":"$"},
  {"n":"Haiku 4.5","p":"Anthropic","pc":"#D4A574","i":1.0,"o":5.0,"cp":1.25,"cu":"$","cw":"200K","t":"轻量模型","d":"最快最经济","id":93,"cu":"$"},
  {"n":"Qwen2.5-0.5B-Instruct","p":"中国联通","pc":"#E60012","i":0,"o":0.6,"in_":"输入免费","cw":"32K","t":"稠密小模型","d":"联通AI-千问0.5B","id":94,"s":["https://support.cucloud.cn/document/127/591/2357.html"]},
  {"n":"Qwen2.5-1.5B-Instruct","p":"中国联通","pc":"#E60012","i":0,"o":1.6,"in_":"输入免费","cw":"32K","t":"稠密小模型","d":"联通AI-千问1.5B","id":95,"s":["https://support.cucloud.cn/document/127/591/2357.html"]},
  {"n":"Qwen2.5-3B-Instruct","p":"中国联通","pc":"#E60012","i":0.3,"o":0.9,"cw":"32K","t":"稠密模型","d":"联通AI-千问3B","id":96,"s":["https://support.cucloud.cn/document/127/591/2357.html"]},
  {"n":"Qwen2.5-7B-Instruct","p":"中国联通","pc":"#E60012","i":0.5,"o":1.0,"cw":"128K","t":"稠密模型","d":"联通AI-千问7B","id":97,"s":["https://support.cucloud.cn/document/127/591/2357.html"]},
  {"n":"Qwen2.5-14B-Instruct","p":"中国联通","pc":"#E60012","i":1.0,"o":3.0,"cw":"128K","t":"稠密模型","d":"联通AI-千问14B","id":98,"s":["https://support.cucloud.cn/document/127/591/2357.html"]},
  {"n":"Qwen2.5-32B-Instruct","p":"中国联通","pc":"#E60012","i":2.0,"o":6.0,"cw":"128K","t":"稠密模型","d":"联通AI-千问32B","id":99,"s":["https://support.cucloud.cn/document/127/591/2357.html"]},
  {"n":"Qwen2.5-72B-Instruct","p":"中国联通","pc":"#E60012","i":4.0,"o":4.0,"cw":"128K","t":"稠密模型","d":"联通AI-千问72B","id":100,"s":["https://support.cucloud.cn/document/127/591/2357.html"]},
  {"n":"DeepSeek-R1","p":"中国联通","pc":"#E60012","i":4.0,"o":16.0,"cw":"128K","t":"推理模型","cap":"思考/推理","d":"联通AI-DeepSeek推理","isHot":True,"id":101,"s":["https://support.cucloud.cn/document/127/591/2357.html"],"tg":"🧠 推理"},
  {"n":"DeepSeek-V3","p":"中国联通","pc":"#E60012","i":2.0,"o":8.0,"cw":"128K","t":"旗舰模型","d":"联通AI-DeepSeek V3","id":102,"s":["https://support.cucloud.cn/document/127/591/2357.html"]},
  {"n":"DeepSeek-V3.1","p":"中国联通","pc":"#E60012","i":4.0,"o":12.0,"cw":"128K","t":"旗舰模型","d":"联通AI-DeepSeek V3.1","isHot":True,"id":103,"s":["https://support.cucloud.cn/document/127/591/2357.html"]},
  {"n":"DeepSeek-R1-Distill-Qwen-7B","p":"中国联通","pc":"#E60012","i":0.5,"o":1.0,"cw":"128K","t":"推理模型","cap":"思考/推理","d":"联通AI-R1蒸馏7B","id":104,"s":["https://support.cucloud.cn/document/127/591/2357.html"],"tg":"🧠 推理"},
  {"n":"DeepSeek-R1-Distill-Qwen-32B","p":"中国联通","pc":"#E60012","i":1.3,"o":1.3,"cw":"128K","t":"推理模型","cap":"思考/推理","d":"联通AI-R1蒸馏32B","id":105,"s":["https://support.cucloud.cn/document/127/591/2357.html"],"tg":"🧠 推理"},
  {"n":"DeepSeek-R1-Distill-Llama-8B","p":"中国联通","pc":"#E60012","i":0.6,"o":1.2,"cw":"128K","t":"推理模型","cap":"思考/推理","d":"联通AI-R1蒸馏Llama8B","id":106,"s":["https://support.cucloud.cn/document/127/591/2357.html"],"tg":"🧠 推理"},
  {"n":"DeepSeek-R1-Distill-Llama-70B","p":"中国联通","pc":"#E60012","i":0,"o":0,"in_":"限时免费体验","cw":"128K","t":"推理模型","cap":"思考/推理","d":"联通AI-R1蒸馏70B(免费)","isHot":True,"id":107,"s":["https://support.cucloud.cn/document/127/591/2357.html"],"tg":"🧠 推理"},
  {"n":"Llama3-8B-Instruct","p":"中国联通","pc":"#E60012","i":4.0,"o":4.0,"cw":"128K","t":"稠密模型","d":"联通AI-Llama3 8B","id":108,"s":["https://support.cucloud.cn/document/127/591/2357.html"]},
  {"n":"Llama3-70B-Instruct","p":"中国联通","pc":"#E60012","i":35.0,"o":35.0,"cw":"128K","t":"旗舰模型","d":"联通AI-Llama3 70B","id":109,"s":["https://support.cucloud.cn/document/127/591/2357.html"]},
  {"n":"QwQ-32B","p":"中国联通","pc":"#E60012","i":2.0,"o":6.0,"cw":"128K","t":"推理模型","cap":"思考/推理","d":"联通AI-QwQ推理","id":110,"s":["https://support.cucloud.cn/document/127/591/2357.html"],"tg":"🧠 推理"},
  {"n":"bge-base-en-v1.5","p":"中国联通","pc":"#E60012","i":0.5,"o":0,"in_":"Embedding","cw":"512","t":"Embedding","d":"联通AI-BGE嵌入","id":111,"s":["https://support.cucloud.cn/document/127/591/2357.html"],"tg":"📊 嵌入"},
  {"n":"bge-reranker-v2-m3","p":"中国联通","pc":"#E60012","i":0.7,"o":0,"in_":"Reranker","cw":"512","t":"Reranker","d":"联通AI-BGE重排序","id":112,"s":["https://support.cucloud.cn/document/127/591/2357.html"],"tg":"📊 嵌入"},

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
    """阿里百炼定价页 — 覆盖全部模型"""
    html = fetch("https://help.aliyun.com/zh/model-studio/model-pricing")
    if not html:
        return
    updated = 0
    # 所有百炼模型名 → 页面上的匹配模式
    model_pats = [
        ("qwen3.7-max", r"qwen3\.7[.-]max[\s\S]{0,300}?([\d.]+)\s*元[\s\S]{0,200}?([\d.]+)\s*元"),
        ("qwen3.7-plus", r"qwen3\.7-plus[\s\S]{0,300}?([\d.]+)\s*元[\s\S]{0,100}?([\d.]+)\s*元"),
        ("qwq-plus", r"qwq-plus[\s\S]{0,300}?([\d.]+)\s*元[\s\S]{0,100}?([\d.]+)\s*元"),
        ("deepseek-v4-pro", r"deepseek-v4-pro[\s\S]{0,300}?([\d.]+)\s*元[\s\S]{0,100}?([\d.]+)\s*元"),
        ("deepseek-v4-flash", r"deepseek-v4-flash[\s\S]{0,300}?([\d.]+)\s*元[\s\S]{0,100}?([\d.]+)\s*元"),
        ("kimi-k2.6", r"kimi-k2\.6[\s\S]{0,300}?([\d.]+)\s*元[\s\S]{0,100}?([\d.]+)\s*元"),
        ("glm-5.1", r"glm-5\.1[\s\S]{0,300}?([\d.]+)\s*元[\s\S]{0,100}?([\d.]+)\s*元"),
        ("MiniMax-M2.7", r"MiniMax-M2\.7[\s\S]{0,300}?([\d.]+)\s*元[\s\S]{0,100}?([\d.]+)\s*元"),
    ]
    for model_name, pat in model_pats:
        m = re.search(pat, html, re.I)
        if m:
            ip, op = float(m.group(1)), float(m.group(2))
            for mod in models:
                if mod.get("n") == model_name and mod.get("p") == "阿里百炼":
                    mod["i"], mod["o"] = ip, op
                    mod.pop("stale", None)
                    updated += 1
    if updated:
        print(f"[阿里百炼] 更新 {updated} 个模型价格")


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



# Kimi — 从各模型子页面提取定价（SSR RSC payload, curl 可行）
def scrape_kimi(models):
    updated = 0
    kimi_models = find_models(models, "", provider="Kimi")

    pages = [
        ("https://platform.kimi.com/docs/pricing/chat-k25", "Kimi-K2.5"),
        ("https://platform.kimi.com/docs/pricing/chat-k26", "Kimi-K2.6"),
    ]
    for url, model_name in pages:
        try:
            html = fetch(url)
            # SSR payload: rows: [["model", "1M tokens", "¥cp", "¥ip", "¥op", ...]]
            m = re.search(r"rows:\s*\[([^\]]+)\]", html)
            if not m:
                continue
            prices = re.findall(r"¥([\d.]+)", m.group(1))
            if len(prices) < 3:
                continue
            cp, ip, op = float(prices[0]), float(prices[1]), float(prices[2])
            for mod in find_models(models, model_name, provider="Kimi"):
                mod["i"], mod["o"] = ip, op
                mod["cp"] = cp
                mod.pop("stale", None)
                updated += 1
        except Exception:
            pass

    # K2.7 Code — 两个变体在同一页
    try:
        html = fetch("https://platform.kimi.com/docs/pricing/chat-k27-code")
        m = re.search(r"rows:\s*\[([^\]]+)\][^\]]*?\[([^\]]+)\]", html)
        if m:
            pairs = [
                (find_models(models, "Kimi-K2.7-Code", provider="Kimi"), m.group(1)),
                (find_models(models, "Kimi-K2.7-Code-Highspeed", provider="Kimi"), m.group(2)),
            ]
            for mods, row in pairs:
                ps = re.findall(r"¥([\d.]+)", row)
                if len(ps) < 3:
                    continue
                cp, ip, op = float(ps[0]), float(ps[1]), float(ps[2])
                for mod in mods:
                    mod["i"], mod["o"] = ip, op
                    mod["cp"] = cp
                    mod.pop("stale", None)
                    updated += 1
    except Exception:
        pass

    if not updated:
        for m in kimi_models:
            m["stale"] = True

# MiniMax — 从按量计费文档提取定价（strip HTML 后 regex）
def scrape_minimax(models):
    updated = 0
    try:
        raw = fetch("https://platform.minimaxi.com/docs/guides/pricing-paygo")
        html = re.sub(r"<[^>]+>", " ", raw)
        html = re.sub(r"\s+", " ", html)

        # M3 — 永久五折，取折后价（每对价格中第二个）
        m3m = re.search(
            r"MiniMax-M3.{0,200}?永久五折.{0,300}?([\d.]+)\s+([\d.]+).{0,80}?([\d.]+)\s+([\d.]+).{0,80}?([\d.]+)\s+([\d.]+)",
            html
        )
        if m3m:
            ip, op, cp = float(m3m.group(2)), float(m3m.group(4)), float(m3m.group(6))
            for mod in find_models(models, "MiniMax-M3", provider="MiniMax"):
                mod["i"], mod["o"], mod["cp"] = ip, op, cp
                mod.pop("stale", None)
                updated += 1

        # 其他 M 系列 — 格式: 模型名 输入 输出 缓存读取 缓存写入
        for name in ["MiniMax-M2.7", "MiniMax-M2.5", "MiniMax-M2.1"]:  # M2 会子串匹配覆盖所有 M 系列
            m = re.search(
                re.escape(name) + r".{0,200}?([\d.]+)\s+([\d.]+).{0,80}?([\d.]+)\s+([\d.]+)",
                html
            )
            if m:
                ip, op, cp = float(m.group(1)), float(m.group(2)), float(m.group(3))
                for mod in find_models(models, name, provider="MiniMax"):
                    mod["i"], mod["o"], mod["cp"] = ip, op, cp
                    mod.pop("stale", None)
                    updated += 1
    except Exception:
        pass

    if not updated:
        for m in find_models(models, "", provider="MiniMax"):
            m["stale"] = True

# Gemini — 从 SSR HTML 表格提取 Standard 层级价格（强制英文页面）
def scrape_gemini(models):
    """从 ai.google.dev/gemini-api/docs/pricing 提取价格"""
    try:
        resp = requests.get(
            "https://ai.google.dev/gemini-api/docs/pricing",
            headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"},
            timeout=15
        )
        resp.raise_for_status()
        html = resp.text
    except Exception:
        for m in find_models(models, "", provider="Gemini"):
            m["stale"] = True
        return

    # 模型名 → 页面 heading id
    MODEL_MAP = {
        "Gemini-2.5-Pro": "gemini-2.5-pro",
        "Gemini-2.5-Flash": "gemini-2.5-flash",
    }

    updated = 0
    for model_name, heading_id in MODEL_MAP.items():
        heading_match = re.search(rf'id="{heading_id}"', html)
        if not heading_match:
            continue

        section = html[heading_match.start():heading_match.start() + 8000]
        table_match = re.search(r'<table[^>]*>(.*?)</table>', section, re.DOTALL)
        if not table_match:
            continue

        table_text = re.sub(r'<[^>]+>', ' ', table_match.group(1))
        table_text = re.sub(r'\s+', ' ', table_text).strip()

        inp = re.search(r'Input price[^$]*?\$([\d.]+)', table_text)
        outp = re.search(r'Output price[^$]*?\$([\d.]+)', table_text)
        cache = re.search(r'Context caching[^$]*?\$([\d.]+)', table_text)

        if inp and outp:
            ip = float(inp.group(1))
            op = float(outp.group(1))
            for mod in find_models(models, model_name, provider="Gemini"):
                mod["i"] = ip
                mod["o"] = op
                mod["cu"] = "$"
                if cache:
                    mod["cp"] = float(cache.group(1))
                mod.pop("stale", None)
                updated += 1

    if not updated:
        for m in find_models(models, "", provider="Gemini"):
            m["stale"] = True


# OpenAI — 从官方定价页提取（SSR HTML, curl可行，不再被Cloudflare拦截）
def scrape_openai(models):
    updated = 0
    try:
        raw = fetch("https://openai.com/zh-Hans-CN/api/pricing/")
        html = re.sub(r"<[^>]+>", " ", raw)
        html = re.sub(r"\s+", " ", html)

        # GPT-5.5: 输入→缓存输入→输出
        m55 = re.search(r"GPT-5\.5.{0,300}?US\$([\d.]+).{0,80}?US\$([\d.]+).{0,80}?US\$([\d.]+)", html)
        if m55:
            ip, cp, op = float(m55.group(1)), float(m55.group(2)), float(m55.group(3))
            for mod in models:
                if mod.get("n") == "GPT-5.5" and mod.get("p") == "OpenAI":
                    mod["i"], mod["o"], mod["cp"] = ip, op, cp
                    mod.pop("stale", None)
                    updated += 1

        # GPT-5.4 系列（先 mini 再标准版，避免子串覆盖）
        for pat, model_name in [(r"GPT-5\.4\smini", "GPT-5.4-mini"), (r"GPT-5\.4\s(?!mini)", "GPT-5.4")]:
            m = re.search(pat + r".{0,300}?US\$([\d.]+).{0,80}?US\$([\d.]+).{0,80}?US\$([\d.]+)", html)
            if m:
                ip, cp, op = float(m.group(1)), float(m.group(2)), float(m.group(3))
                for mod in models:
                    if mod.get("n") == model_name and mod.get("p") == "OpenAI":
                        mod["i"], mod["o"], mod["cp"] = ip, op, cp
                        mod["cu"] = "$"
                        mod.pop("stale", None)
                        updated += 1
    except Exception:
        pass

    if not updated:
        for m in find_models(models, "", provider="OpenAI"):
            m["stale"] = True


# Anthropic/Claude — 通过 Browserless CDP 提取（JS渲染页）
BROWSERLESS_WS = "ws://api.ltcsky.net:3000/chrome"
BROWSERLESS_HTTP = "http://api.ltcsky.net:3000"

def _browser_fetch(url, wait=10):
    """通过 Browserless CDP 获取页面渲染后的 innerText"""
    import asyncio, json as _json
    try:
        import websockets as _ws, urllib.request as _ur
    except ImportError:
        print("[Browserless] websockets not installed, skip")
        return ""
    
    async def _send_wait(ws, payload, timeout=20):
        await ws.send(_json.dumps(payload))
        msg_id = payload["id"]
        while True:
            r = _json.loads(await asyncio.wait_for(ws.recv(), timeout=timeout))
            if r.get("id") == msg_id:
                return r
    
    async def _do():
        try:
            async with _ws.connect(BROWSERLESS_WS, open_timeout=12, ping_interval=None):
                req = _ur.Request(f"{BROWSERLESS_HTTP}/json/list")
                targets = _json.loads(_ur.urlopen(req, timeout=5).read())
                if not targets:
                    return ""
                ws_url = targets[0]["webSocketDebuggerUrl"].replace("0.0.0.0", "api.ltcsky.net")
                
                async with _ws.connect(ws_url, open_timeout=10, ping_interval=None) as ws:
                    await _send_wait(ws, {"id":1,"method":"Page.enable"})
                    await _send_wait(ws, {"id":2,"method":"Page.navigate","params":{"url":url}}, timeout=25)
                    
                    # Wait for load
                    try:
                        while True:
                            r = _json.loads(await asyncio.wait_for(ws.recv(), timeout=30))
                            if r.get("method") == "Page.loadEventFired":
                                break
                    except:
                        pass
                    await asyncio.sleep(wait)
                    
                    # Extract text
                    r = await _send_wait(ws, {"id":9,"method":"Runtime.evaluate","params":{
                        "expression":"document.body.innerText","returnByValue":True}})
                    return r.get("result",{}).get("result",{}).get("value","")
        except Exception:
            return ""
    
    try:
        return asyncio.run(_do())
    except:
        return ""

def scrape_anthropic(models):
    updated = 0
    anthropic_models = find_models(models, "", provider="Anthropic")
    try:
        text = _browser_fetch("https://claude.com/pricing#api", wait=8)
        if not text:
            raise Exception("Browserless returned empty")
        
        # Parse pricing from text (format: "Fable 5\nInput\n$10 / MTok...")
        for model_name in ["Fable 5", "Opus 4.8", "Sonnet 4.6", "Haiku 4.5"]:
            idx = text.find(model_name)
            if idx < 0:
                continue
            chunk = text[idx:idx+400]
            inp = re.search(r'Input\s*\n?\$([\d.]+)\s*/\s*MTok', chunk)
            outp = re.search(r'Output\s*\n?\$([\d.]+)\s*/\s*MTok', chunk)
            cache_w = re.search(r'Write\s*\n?\$([\d.]+)\s*/\s*MTok', chunk)
            cache_r = re.search(r'Read\s*\n?\$([\d.]+)\s*/\s*MTok', chunk)
            if inp and outp:
                ip, op = float(inp.group(1)), float(outp.group(1))
                cp = float(cache_w.group(1)) if cache_w else None
                for mod in find_models(models, model_name, provider="Anthropic"):
                    mod["i"], mod["o"] = ip, op
                    mod["cu"] = "$"
                    if cp: mod["cp"] = cp
                    mod.pop("stale", None)
                    updated += 1
    except Exception as e:
        print(f"[Anthropic] Browserless failed: {e}")
    
    if not updated:
        for m in anthropic_models:
            m["stale"] = True# ============================================================

def scrape_culoud(models):
    """中国联通 — 从按量计费页提取定价（元/千tokens，需×1000转元/百万）"""
    updated = 0
    try:
        html = fetch("https://support.cucloud.cn/document/127/591/2357.html?id=2357&arcid=6518&lang=zh", timeout=15)
        if not html:
            return
        clean = re.sub(r"<[^>]+>", " ", html)
        clean = re.sub(r"\s+", " ", clean)
        if "按量计费" not in clean:
            return
        
        # Find the 按量计费 pricing section
        idx = clean.find("按量计费")
        if idx < 0:
            return
        section = clean[idx:idx+5000]
        
        # Parse model pricing: "ModelName-Input 千tokens Price" or "ModelName-Output 千tokens Price"
        # Prices are 元/千tokens, need ×1000 to get 元/百万tokens
        patterns = [
            (r"DeepSeek-R1-Input[^0-9]*([\d.]+)", "DeepSeek-R1", "i"),
            (r"DeepSeek-R1-Output[^0-9]*([\d.]+)", "DeepSeek-R1", "o"),
            (r"DeepSeek-V3\.1-Input[^0-9]*([\d.]+)", "DeepSeek-V3.1", "i"),
            (r"DeepSeek-V3\.1-Output[^0-9]*([\d.]+)", "DeepSeek-V3.1", "o"),
            (r"DeepSeek-V3-Input[^0-9]*([\d.]+)", "DeepSeek-V3", "i"),
            (r"DeepSeek-V3-Output[^0-9]*([\d.]+)", "DeepSeek-V3", "o"),
            (r"DeepSeek-R1-Distill-Qwen-7B-Input[^0-9]*([\d.]+)", "DeepSeek-R1-Distill-Qwen-7B", "i"),
            (r"DeepSeek-R1-Distill-Qwen-7B-Output[^0-9]*([\d.]+)", "DeepSeek-R1-Distill-Qwen-7B", "o"),
            (r"DeepSeek-R1-Distill-Qwen-32B-Input[^0-9]*([\d.]+)", "DeepSeek-R1-Distill-Qwen-32B", "i"),
            (r"DeepSeek-R1-Distill-Qwen-32B-Output[^0-9]*([\d.]+)", "DeepSeek-R1-Distill-Qwen-32B", "o"),
            (r"DeepSeek-R1-Distill-Llama-8B-Input[^0-9]*([\d.]+)", "DeepSeek-R1-Distill-Llama-8B", "i"),
            (r"DeepSeek-R1-Distill-Llama-8B-Output[^0-9]*([\d.]+)", "DeepSeek-R1-Distill-Llama-8B", "o"),
            # Llama-70B distill is free
            (r"Qwen2\.5-0\.5B-Instruct-Output[^0-9]*([\d.]+)", "Qwen2.5-0.5B-Instruct", "o"),
            (r"Qwen2\.5-1\.5B-Instruct-Output[^0-9]*([\d.]+)", "Qwen2.5-1.5B-Instruct", "o"),
            (r"Qwen2\.5-3B-Input[^0-9]*([\d.]+)", "Qwen2.5-3B-Instruct", "i"),
            (r"Qwen2\.5-3B-Output[^0-9]*([\d.]+)", "Qwen2.5-3B-Instruct", "o"),
            (r"Qwen2\.5-7B-Input[^0-9]*([\d.]+)", "Qwen2.5-7B-Instruct", "i"),
            (r"Qwen2\.5-7B-Output[^0-9]*([\d.]+)", "Qwen2.5-7B-Instruct", "o"),
            (r"Qwen2\.5-14B-Input[^0-9]*([\d.]+)", "Qwen2.5-14B-Instruct", "i"),
            (r"Qwen2\.5-14B-Output[^0-9]*([\d.]+)", "Qwen2.5-14B-Instruct", "o"),
            (r"Qwen2\.5-32B-Input[^0-9]*([\d.]+)", "Qwen2.5-32B-Instruct", "i"),
            (r"Qwen2\.5-32B-Output[^0-9]*([\d.]+)", "Qwen2.5-32B-Instruct", "o"),
            (r"Qwen2\.5-72B-Input[^0-9]*([\d.]+)", "Qwen2.5-72B-Instruct", "i"),
            (r"Qwen2\.5-72B-Output[^0-9]*([\d.]+)", "Qwen2.5-72B-Instruct", "o"),
            (r"Llama3-8B-Instruct[^0-9]*([\d.]+)", "Llama3-8B-Instruct", "io"),
            (r"Llama3-70B-Instruct[^0-9]*([\d.]+)", "Llama3-70B-Instruct", "io"),
            (r"QwQ_32B_Input[^0-9]*([\d.]+)", "QwQ-32B", "i"),
            (r"QwQ_32B_Output[^0-9]*([\d.]+)", "QwQ-32B", "o"),
            (r"bge_base_en_v1_5[^0-9]*([\d.]+)", "bge-base-en-v1.5", "i"),
            (r"bge_reranker_v2_m3[^0-9]*([\d.]+)", "bge-reranker-v2-m3", "i"),
        ]
        for pat, model_name, field in patterns:
            m = re.search(pat, section)
            if m:
                price_per_1k = float(m.group(1))
                price_per_1m = round(price_per_1k * 1000, 2)  # 元/千tokens → 元/百万tokens
                for mod in models:
                    if mod.get("n") == model_name and mod.get("p") == "中国联通":
                        if field == "io":
                            mod["i"], mod["o"] = price_per_1m, price_per_1m
                        else:
                            mod[field] = price_per_1m
                        mod.pop("stale", None)
                        updated += 1
    except Exception as e:
        print(f"[中国联通] scrape error: {e}")
    
    if not updated:
        for m in find_models(models, "", provider="中国联通"):
            m["stale"] = True
    else:
        print(f"[中国联通] 更新 {updated} 个模型价格")


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

    # 清理不在种子数据中的旧模型（已下架/改名）
    seed_ids = {m["id"] for m in SEED_DATA}
    removed = [m for m in models if m["id"] not in seed_ids]
    if removed:
        models = [m for m in models if m["id"] in seed_ids]
        removed_names = [f'{m["n"]}({m["p"]})' for m in removed]
        print(f"[CLEAN] 移除 {len(removed)} 个已下架模型: {', '.join(removed_names)}")

    errors = []

    # 依次执行爬虫
    for name, fn in [("DeepSeek", scrape_deepseek), ("阿里百炼", scrape_bailian),
                      ("天翼云", scrape_ctyun), ("硅基流动", scrape_siliconflow),
                      ("智谱", scrape_zhipu),
                      ("Kimi", scrape_kimi), ("MiniMax", scrape_minimax),
                      ("OpenAI", scrape_openai), ("Gemini", scrape_gemini),
                      ("Anthropic", scrape_anthropic),
                      ("中国联通", scrape_culoud)]:
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
        "kimi": not any(e.startswith("Kimi") for e in errors),
        "minimax": not any(e.startswith("MiniMax") for e in errors),
        "openai": not any(e.startswith("OpenAI") for e in errors),
        "gemini": not any(e.startswith("Gemini") for e in errors),
        "anthropic": not any(e.startswith("Anthropic") for e in errors),
        "culoud": not any(e.startswith("中国联通") for e in errors),
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
