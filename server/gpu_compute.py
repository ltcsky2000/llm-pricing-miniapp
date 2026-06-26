#!/usr/bin/env python3
"""天翼云 GPU 算力信息采集 — 全国全区域版"""
import sys, os, json, time, shutil, warnings
warnings.filterwarnings('ignore')
sys.path.insert(0, '/tmp/test-ctyun/lib/python3.13/site-packages')

from ctyunsdk_ecs20220909 import EcsClient
from ctyun_python_sdk_core.client_config import ClientConfig
from ctyunsdk_ecs20220909.models.v4_region_list_regions import V4RegionListRegionsRequest
from ctyunsdk_ecs20220909.models.v4_common_get_ecs_flavors import V4CommonGetEcsFlavorsRequest
from ctyunsdk_ecs20220909.models.v4_region_check_demand import V4RegionCheckDemandRequest

AK = os.environ.get("CTYUN_AK","9fdffc48497b4545b1961428e035a540")
SK = os.environ.get("CTYUN_SK","c8e2442841a5410886250dd14bf2df35")
GPU_TYPE_MAP = {"GPU_N_G7_V":("A10",24),"GPU_N_PI7":("A10",24),"GPU_N_P8A":("A100",80),
    "GPU_N_PN8I":("L20",48),"GPU_N_T4":("T4",16),"GPU_N_T4_YUNYOUXI":("T4",16),"GPU_N_V100":("V100",32),
    "GPU_N_P8AV":("A100",80),"GPU_N_PN8R":("L20",48),
    "GPU_A_PAK1":("PAK1",80),"GPU_A_PAK2":("PAK2",80),"GPU_A_PAK3":("PAK3",80)}
GPU_FLAVOR_PREFIXES = ["GPU_"]

def safe_int(v, default=0):
    try: return int(v) if v is not None and v != '' else default
    except: return default

def safe_float(v, default=0.0):
    try: return float(v) if v is not None and v != '' else default
    except: return default

def main(output_path="/tmp/gpu_compute.json", sync_path="/opt/1panel/www/sites/api.ltcsky.net/index/compute/gpu.json"):
    start = time.time()
    config = ClientConfig(endpoint="https://ctecs-global.ctapi.ctyun.cn",
                          access_key_id=AK, access_key_secret=SK, verify_tls=False)
    client = EcsClient(config)
    
    all_regions = client.v4_region_list_regions(V4RegionListRegionsRequest())
    region_list = all_regions.returnObj["regionList"]
    
    targets = [{"regionID":r["regionID"],"regionName":r["regionName"],
                "regionCode":r.get("regionCode",""),"regionParent":r.get("regionParent","")}
               for r in region_list if r.get("openapiAvailable",False)]
    
    gpu_data = []
    seen = set()
    
    for t in targets:
        for series in ["g", "p"]:
            try:
                result = client.v4_common_get_ecs_flavors(
                    V4CommonGetEcsFlavorsRequest(regionID=t["regionID"], series=series))
                robj = result.returnObj
                if robj is None: continue
                
                for f in robj.results:
                    try:
                        ft = f.flavorType or ""
                        if not ft.startswith("GPU_"): continue
                        
                        gpu_info = GPU_TYPE_MAP.get(ft, (ft, 0))
                        gpu_model, vram = gpu_info
                        
                        spec = f.specName or ""
                        key = f"{spec}|{t['regionName']}"
                        if key in seen: continue
                        seen.add(key)
                        
                        az_raw = f.azList or []
                        az_list = [az.split("-")[2] if len(az.split("-"))>2 else az for az in az_raw]
                        
                        sellout = True
                        try:
                            chk = client.v4_region_check_demand(
                                V4RegionCheckDemandRequest(regionID=t["regionID"], productType="ecs", flavorID=f.flavorID))
                            if chk.returnObj and hasattr(chk.returnObj, 'sellout'):
                                sellout = chk.returnObj.sellout
                        except: pass
                        
                        gpu_data.append({"spec":spec,"region":t["regionName"],
                            "regionCode":t["regionCode"],"parent":t["regionParent"],
                            "series":f.series or "","vCPU":safe_int(f.cpuNum),
                            "memGB":safe_int(f.memSize),"gpuModel":gpu_model,"vramGB":vram,
                            "az":az_list,"flavorType":ft,"flavorName":f.flavorName or "",
                            "sellout":sellout,"ctLimit":f.ctLimitCount,
                            "bwBase":safe_float(f.bandwidthBase),"bwMax":safe_float(f.bandwidthMax)})
                    except Exception as e2:
                        print(f"[SKIP] {t['regionName']}/{series}: {str(e2)[:60]}")
            except Exception as e:
                err = str(e)
                if "not exists" not in err:
                    print(f"[WARN] {t['regionName']}/{series}: {err[:80]}")

    sellout_count = sum(1 for g in gpu_data if g["sellout"])
    available_count = len(gpu_data) - sellout_count
    
    output = {"code":0,"updateTime":time.strftime("%Y-%m-%dT%H:%M:%S+08:00"),
              "totalRegions":len(targets),"totalSpecs":len(gpu_data),
              "available":available_count,"sellout":sellout_count,
              "data":gpu_data,"elapsed":f"{time.time()-start:.1f}s"}
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path,"w",encoding="utf-8") as f:
        json.dump(output,f,ensure_ascii=False,indent=2)
    print(f"[GPU] {len(gpu_data)}条 ({available_count}可售/{sellout_count}售罄) -> {output_path}")
    
    if sync_path:
        try:
            os.makedirs(os.path.dirname(sync_path), exist_ok=True)
            shutil.copy2(output_path, sync_path)
            print(f"[GPU] SYNC -> {sync_path}")
        except Exception as e:
            print(f"[GPU] SYNC err: {e}")
    return output

if __name__=="__main__":
    import argparse
    p=argparse.ArgumentParser()
    p.add_argument("--output","-o",default="/tmp/gpu_compute.json")
    p.add_argument("--sync","-s",default="")
    args=p.parse_args()
    result=main(args.output,args.sync)
