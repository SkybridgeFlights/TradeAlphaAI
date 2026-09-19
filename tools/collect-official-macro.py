#!/usr/bin/env python3
"""TradeAlphaAI official macro collector.

Polls public, machine-readable government/central-bank APIs only.  It stores
immutable snapshots so release values/revisions can be merged into the website
calendar without scraping HTML or fabricating consensus forecasts.
"""
from __future__ import annotations
import argparse, csv, io, json, os, pathlib, time, urllib.parse, urllib.request
from datetime import datetime, timezone

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"data"/"official-macro-snapshots.json"
UA="TradeAlphaAI/1.0 economic-calendar collector"
TIMEOUT=20

SERIES={
 "bls":{
   "CUUR0000SA0":{"event_type":"CPI","country":"US","unit":"index","source_name":"U.S. Bureau of Labor Statistics"},
   "CUUR0000SA0L1E":{"event_type":"Core CPI","country":"US","unit":"index","source_name":"U.S. Bureau of Labor Statistics"},
   "CES0000000001":{"event_type":"NFP","country":"US","unit":"thousand jobs","source_name":"U.S. Bureau of Labor Statistics"},
   "LNS14000000":{"event_type":"Unemployment Rate","country":"US","unit":"%","source_name":"U.S. Bureau of Labor Statistics"},
 },
 "ecb":{
   "ECB,FM,1.0/M.U2.EUR.4F.KR.MRR_FR.LEV":{"event_type":"ECB Rate Decision","country":"EU","unit":"%","source_name":"European Central Bank"}
 }
}

def now(): return datetime.now(timezone.utc).isoformat().replace("+00:00","Z")
def req(url, method="GET", body=None, headers=None):
    h={"User-Agent":UA,"Accept":"application/json,text/csv;q=0.9,*/*;q=0.1"}
    if headers: h.update(headers)
    data=None if body is None else json.dumps(body).encode()
    if data: h["Content-Type"]="application/json"
    r=urllib.request.Request(url,data=data,headers=h,method=method)
    with urllib.request.urlopen(r,timeout=TIMEOUT) as x: return x.read(), dict(x.headers)

def number(v):
    try:return float(str(v).replace(",","").strip())
    except:return None

def collect_bls():
    ids=list(SERIES["bls"])
    body,_=req("https://api.bls.gov/publicAPI/v2/timeseries/data/","POST",
               {"seriesid":ids,"latest":True})
    j=json.loads(body); out=[]
    for s in j.get("Results",{}).get("series",[]):
        meta=SERIES["bls"].get(s.get("seriesID")); rows=s.get("data") or []
        if not meta or not rows: continue
        vals=[r for r in rows if r.get("period","").startswith("M") and r.get("period")!="M13"]
        if not vals: continue
        r=vals[0]; prev=vals[1] if len(vals)>1 else None
        out.append({**meta,"series_id":s["seriesID"],"period":f'{r.get("year")}-{r.get("period")}',
          "actual":number(r.get("value")),"previous":number(prev.get("value")) if prev else None,
          "observed_at":now(),"source_url":f'https://data.bls.gov/timeseries/{s["seriesID"]}'})
    return out

def collect_ecb():
    out=[]
    for key,meta in SERIES["ecb"].items():
        url="https://data-api.ecb.europa.eu/service/data/"+key+"?lastNObservations=2&format=csvdata"
        raw,_=req(url); text=raw.decode("utf-8-sig","replace")
        rows=list(csv.DictReader(io.StringIO(text)))
        if not rows: continue
        rows=sorted(rows,key=lambda r:r.get("TIME_PERIOD",""))
        r=rows[-1]; p=rows[-2] if len(rows)>1 else None
        out.append({**meta,"series_id":key,"period":r.get("TIME_PERIOD"),
          "actual":number(r.get("OBS_VALUE")),"previous":number(p.get("OBS_VALUE")) if p else None,
          "observed_at":now(),"source_url":"https://data.ecb.europa.eu/"})
    return out

def collect_ons_probe():
    # Health/discovery probe: ONS API is open/no-key. Dataset-specific mappings
    # are added only after a series is verified, never guessed.
    raw,_=req("https://api.beta.ons.gov.uk/v1/datasets?limit=1")
    json.loads(raw)
    return {"provider":"ons","status":"ok","observed_at":now()}

def collect_statcan_probe():
    raw,_=req("https://www150.statcan.gc.ca/t1/wds/rest/getAllCubesListLite")
    json.loads(raw)
    return {"provider":"statcan","status":"ok","observed_at":now()}

def collect_abs_probe():
    # Public no-key SDMX endpoint; a tiny structure request verifies reachability.
    raw,_=req("https://api.data.abs.gov.au/dataflow/ABS?format=csvfile")
    return {"provider":"abs","status":"ok" if raw else "empty","observed_at":now()}

def load():
    try:return json.loads(OUT.read_text("utf-8"))
    except:return {"schema_version":"1.0","updated_at":None,"observations":[],"provider_health":{}}

def key(x): return "|".join(str(x.get(k,"")) for k in ("source_name","series_id","period","actual"))
def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--write",action="store_true"); args=ap.parse_args()
    old=load(); obs=list(old.get("observations",[])); health={}
    collectors=[("bls",collect_bls),("ecb",collect_ecb)]
    for name,fn in collectors:
        try:
            rows=fn(); obs.extend(rows); health[name]={"status":"ok","count":len(rows),"checked_at":now()}
        except Exception as e: health[name]={"status":"error","reason":str(e)[:180],"checked_at":now()}
    for name,fn in [("ons",collect_ons_probe),("statcan",collect_statcan_probe),("abs",collect_abs_probe)]:
        try: health[name]=fn()
        except Exception as e: health[name]={"provider":name,"status":"error","reason":str(e)[:180],"observed_at":now()}
    uniq={key(x):x for x in obs}
    rows=sorted(uniq.values(),key=lambda x:(x.get("observed_at",""),x.get("series_id","")))[-5000:]
    out={"schema_version":"1.0","updated_at":now(),"observations":rows,"provider_health":health}
    print(json.dumps({"updated_at":out["updated_at"],"new_total":len(rows),"provider_health":health},indent=2))
    if args.write:
        OUT.parent.mkdir(parents=True,exist_ok=True); OUT.write_text(json.dumps(out,indent=2)+"\n","utf-8")
if __name__=="__main__": main()
