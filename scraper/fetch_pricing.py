#!/usr/bin/env python3
"""LLM Token price scraper - generates app.js for WeChat Mini Program"""
import json, re, os, ssl, urllib.request
from datetime import datetime, timezone, timedelta

BJT = timezone(timedelta(hours=8))
PROJECT_DIR = "/projects/llm-pricing-miniapp"
APP_JS = os.path.join(PROJECT_DIR, "app.js")

FALLBACK = [
  {"n":"Qwen3-8B","p":"天翼云","i":0.3,"o":0.6,"cw":"128K","t":"稠密小模型","pc":"#0078D4","id":1},
  {"n":"DeepSeek-V4-Flash","p":"DeepSeek","i":1.0,"o":2.0,"cp":0.02,"cw":"1M","mo":"384K","t":"轻量模型","cap":"JSON/Tools/思考","isHot":True,"pc":"#4D6BFE","s":["https://api-docs.deepseek.com/zh-cn/quick_start/pricing"],"id":8},
  {"n":"DeepSeek-R1","p":"DeepSeek","i":2.0,"o":8.0,"cw":"1M","mo":"64K","t":"推理模型","cap":"思考/推理","isHot":True,"pc":"#4D6BFE","s":["https://api-docs.deepseek.com/zh-cn/quick_start/pricing"],"id":16},
  {"n":"GPT-4.1","p":"OpenAI","i":12.8,"o":51.2,"cw":"1M","mo":"32K","t":"旗舰模型","cap":"JSON/Tools","pc":"#10A37F","s":["https://platform.openai.com/docs/pricing"],"id":27},
  {"n":"claude-sonnet-4-20250514","p":"Anthropic","i":3.0,"o":15.0,"cw":"200K","mo":"8K","t":"旗舰模型","pc":"#CC7832","id":18},
  {"n":"qwen3.7-max","p":"阿里百炼","i":12.0,"o":36.0,"cw":"1M","t":"旗舰模型","isHot":True,"pc":"#FF6A00","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":38},
  {"n":"qwen3.7-plus","p":"阿里百炼","i":2.0,"o":8.0,"cw":"1M","t":"中杯模型","pc":"#FF6A00","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":39},
  {"n":"deepseek-v4-pro","p":"阿里百炼","i":12.0,"o":24.0,"cw":"1M","t":"旗舰模型","pc":"#FF6A00","s":["https://help.aliyun.com/zh/model-studio/model-pricing"],"id":41},
]

def fetch(url, t=15):
  ctx = ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
  req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0","Accept-Language":"zh-CN,zh;q=0.9"})
  try: return urllib.request.urlopen(req, timeout=t, context=ctx).read().decode("utf-8","replace")
  except: return None

def load_data():
  if not os.path.exists(APP_JS): return FALLBACK
  with open(APP_JS) as f: c = f.read()
  m = re.search(r"var models = (\[.*\]);", c, re.DOTALL)
  if m:
    try: return json.loads(m.group(1))
    except: pass
  return FALLBACK

def expand_code():
  return """function expand(m) {
  return { id:m.id, name:m.n, provider:m.p, providerColor:m.pc,
    inputPrice:m.i, outputPrice:m.o, cachePrice:m.cp,
    inputNote:m["in_"], outputNote:m.on, contextWindow:m.cw, maxOutput:m.mo,
    modelType:m.t, capabilities:m.cap, desc:m.d, sources:m.s,
    isHot:m.isHot, isNew:m.isNew }
}"""

def write_data(models):
  update = datetime.now(BJT).strftime("%Y-%m-%d")
  js = "var models = " + json.dumps(models, ensure_ascii=False, separators=(",",":"))
  js += ";\n\n" + expand_code()
  js += "\n\nApp({\n  onLaunch() {},\n  globalData: { models: models, expand: expand, updateTime: '" + update + "' }\n})\n"
  with open(APP_JS, "w") as f: f.write(js)
  os.chmod(APP_JS, 0o644)
  print(f"[DONE] {len(models)} models -> {APP_JS}")

def main():
  models = load_data()
  print(f"[LOAD] {len(models)} models")
  html = fetch("https://api-docs.deepseek.com/zh-cn/quick_start/pricing")
  if html:
    for pattern, name, min_output in [
      (r"deepseek-v4-flash.*?缓存命中.*?([\d.]+)元.*?缓存未命中.*?([\d.]+)元.*?输出.*?([\d.]+)元", "DeepSeek-V4-Flash", 1),
      (r"deepseek-v4-pro.*?缓存命中.*?([\d.]+)元.*?缓存未命中.*?([\d.]+)元.*?输出.*?([\d.]+)元", "DeepSeek-V4-Pro", 3),
    ]:
      m = re.search(pattern, html, re.DOTALL|re.IGNORECASE)
      if m and float(m.group(3)) >= min_output:
        cache, miss, output = float(m.group(1)), float(m.group(2)), float(m.group(3))
        for mod in models:
          if name in mod.get("n",""):
            mod["i"] = miss; mod["o"] = output; mod["cp"] = cache
            print(f"  [OK] {name}: ¥{miss}→¥{output}")
  write_data(models)

if __name__ == "__main__": main()
