#!/usr/bin/env python3
"""TradeAlphaAI official macro collector.

Cloud-safe collector for public government/central-bank machine APIs. It stores
versioned observations and provider health; it never scrapes HTML and never
creates consensus forecasts.
"""
from __future__ import annotations
import argparse,csv,io,json,pathlib,urllib.parse,urllib.request
from datetime import datetime,timezone

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"data"/"official-macro-snapshots.json"
UA="TradeAlphaAI/1.1 official-macro-collector"
TIMEOUT=25

BLS={
"CUUR0000SA0":("CPI","US","index"),
"CUUR0000SA0L1E":("Core CPI","US","index"),
"CES0000000001":("NFP","US","thousand jobs"),
"LNS14000000":("Unemployment Rate","US","%"),
}
# ECB official key verified against the ECB Data Portal API. Monthly MRO rate.
ECB=[("ECB,FM,1.0/M.U2.EUR.4F.KR.MRR_FR.LEV","ECB Rate Decision","EU","%")]
# Eurostat HICP annual rate, euro area aggregate. This is an official actual,
# not a consensus forecast.
EUROSTAT=[("prc_hicp_manr","HICP","EA20","RCH_A","CP00","Euro Area HICP","EU","%")]

def now(): return datetime.now(timezone.utc).isoformat().replace("+00:00","Z")
def req(url,method="GET",body=None,headers=None):
 h={"User-Agent":UA,"Accept":"application/json,text/csv;q=0.9,*/*;q=0.1"}
 if headers:h.update(headers)
 data=None if body is None else json.dumps(body).encode()
 if data:h["Content-Type"]="application/json"
 r=urllib.request.Request(url,data=data,headers=h,method=method)
 with urllib.request.urlopen(r,timeout=TIMEOUT) as x:return x.read(),dict(x.headers)
def num(v):
 try:return float(str(v).replace(",","").strip())
 except:return None
def obs(event,country,unit,series,period,actual,previous,source,url,release_time=None):
 return {"event_type":event,"country":country,"unit":unit,"series_id":series,"period":period,
 "actual":actual,"previous":previous,"release_time":release_time,"observed_at":now(),"source_name":source,"source_url":url}

def collect_bls():
 body,_=req("https://api.bls.gov/publicAPI/v2/timeseries/data/","POST",{"seriesid":list(BLS),"latest":True})
 j=json.loads(body);out=[]
 for s in j.get("Results",{}).get("series",[]):
  sid=s.get("seriesID");meta=BLS.get(sid);rows=s.get("data") or []
  if not meta:continue
  vals=[r for r in rows if r.get("period","").startswith("M") and r.get("period")!="M13"]
  if not vals:continue
  r=vals[0];p=vals[1] if len(vals)>1 else None
  out.append(obs(meta[0],meta[1],meta[2],sid,f'{r.get("year")}-{r.get("period")}',num(r.get("value")),num(p.get("value")) if p else None,"U.S. Bureau of Labor Statistics",f"https://data.bls.gov/timeseries/{sid}",r.get("releaseTime") or r.get("release_time")))
 return out

def collect_ecb():
 out=[]
 for key,event,country,unit in ECB:
  flow,keypart=key.split("/",1)
  # ECB flowRef in the data URL is the dataflow id (FM), not agency/version.
  flow_id=flow.split(",")[1]
  url=f"https://data-api.ecb.europa.eu/service/data/{flow_id}/{keypart}?lastNObservations=2&format=csvdata"
  raw,_=req(url,headers={"Accept":"text/csv"})
  rows=list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig","replace"))))
  if not rows:continue
  rows=sorted(rows,key=lambda r:r.get("TIME_PERIOD",""));r=rows[-1];p=rows[-2] if len(rows)>1 else None
  out.append(obs(event,country,unit,key,r.get("TIME_PERIOD"),num(r.get("OBS_VALUE")),num(p.get("OBS_VALUE")) if p else None,"European Central Bank","https://data.ecb.europa.eu/"))
 return out

def _jsonstat_latest(j):
 # Eurostat JSON-stat stores flattened values; for a single geo/coicop/unit
 # query only time varies, so category time ordering maps directly to values.
 dim=j.get("dimension",{}).get("time",{}).get("category",{}).get("index",{})
 times=sorted(dim,key=lambda k:dim[k]) if isinstance(dim,dict) else list(dim or [])
 vals=j.get("value",[])
 pairs=[(t,vals[i] if i<len(vals) else None) for i,t in enumerate(times)]
 pairs=[(t,num(v)) for t,v in pairs if num(v) is not None]
 return pairs[-2:]

def collect_eurostat():
 out=[]
 for dataset,event,geo,unit,coicop,label,country,outunit in EUROSTAT:
  q=urllib.parse.urlencode({"format":"JSON","lang":"EN","geo":geo,"unit":unit,"coicop":coicop})
  raw,_=req(f"https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{dataset}?{q}")
  pairs=_jsonstat_latest(json.loads(raw))
  if not pairs:continue
  r=pairs[-1];p=pairs[-2] if len(pairs)>1 else None
  out.append(obs(event,country,outunit,f"EUROSTAT:{dataset}:{geo}:{unit}:{coicop}",r[0],r[1],p[1] if p else None,"Eurostat",f"https://ec.europa.eu/eurostat/databrowser/view/{dataset}/default/table"))
 return out

def probe_ons():
 raw,_=req("https://api.beta.ons.gov.uk/v1/datasets?limit=1");json.loads(raw)
 return {"status":"ok","checked_at":now(),"mode":"open_api_discovery"}
def probe_statcan():
 raw,_=req("https://www150.statcan.gc.ca/t1/wds/rest/getAllCubesListLite");json.loads(raw)
 return {"status":"ok","checked_at":now(),"mode":"open_wds_discovery"}
def probe_abs():
 # Endpoint changed in Nov 2024. Use the current official base URL.
 raw,_=req("https://data.api.abs.gov.au/rest/dataflow/ABS/all/latest?detail=allstubs",headers={"Accept":"application/xml"})
 return {"status":"ok" if raw else "empty","checked_at":now(),"mode":"open_sdmx_discovery"}

def load():
 try:return json.loads(OUT.read_text("utf-8"))
 except:return {"schema_version":"1.1","updated_at":None,"observations":[],"provider_health":{}}
def key(x):return "|".join(str(x.get(k,"")) for k in ("source_name","series_id","period","actual"))
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--write",action="store_true");args=ap.parse_args()
 old=load();allobs=list(old.get("observations",[]));health={}
 for name,fn in [("bls",collect_bls),("eurostat",collect_eurostat)]:
  try:
   rows=fn();allobs.extend(rows);health[name]={"status":"ok","count":len(rows),"checked_at":now()}
  except Exception as e:health[name]={"status":"error","reason":str(e)[:240],"checked_at":now()}
 # ECB is kept as discovery until a current dataflow/key is verified; never guess a series.
 health["ecb"]={"status":"mapping_pending","checked_at":now(),"mode":"official_sdmx_discovery"}
 for name,fn in [("ons",probe_ons),("statcan",probe_statcan),("abs",probe_abs)]:
  try:health[name]=fn()
  except Exception as e:health[name]={"status":"error","reason":str(e)[:240],"checked_at":now()}
 uniq={key(x):x for x in allobs};rows=sorted(uniq.values(),key=lambda x:(x.get("observed_at",""),x.get("series_id","")))[-10000:]
 out={"schema_version":"1.1","updated_at":now(),"observations":rows,"provider_health":health}
 print(json.dumps({"updated_at":out["updated_at"],"observation_versions":len(rows),"provider_health":health},indent=2))
 if args.write:OUT.write_text(json.dumps(out,indent=2)+"\n","utf-8")
if __name__=="__main__":main()
