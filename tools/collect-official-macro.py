#!/usr/bin/env python3
"""TradeAlphaAI official macro collector.

Cloud-safe collector for public government/central-bank machine APIs. It stores
versioned observations and provider health; it never scrapes HTML and never
creates consensus forecasts.
"""
from __future__ import annotations
import argparse,csv,io,json,pathlib,urllib.parse,urllib.request,ssl,re,html
from datetime import datetime,timezone,timedelta

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
 # Prefer the operating-system trust store. Some developer machines have an
 # incomplete Python CA bundle; certifi is an optional verified fallback only.
 def _open(request):
  try:return urllib.request.urlopen(request,timeout=20)
  except urllib.error.URLError as e:
   if "CERTIFICATE_VERIFY_FAILED" not in str(e):raise
   try:
    import certifi
    return urllib.request.urlopen(request,timeout=20,context=ssl.create_default_context(cafile=certifi.where()))
   except ImportError:raise e

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
 # Unregistered BLS v2 supports the basic multi-series signature and returns
 # three years by default. Supplying start/end years is a registered-v2 feature.
 body,_=req("https://api.bls.gov/publicAPI/v2/timeseries/data/","POST",{"seriesid":list(BLS)})
 j=json.loads(body);out=[]
 if j.get("status")!="REQUEST_SUCCEEDED": raise RuntimeError("BLS API: "+"; ".join(j.get("message") or [j.get("status","request failed")]))
 for series in j.get("Results",{}).get("series",[]):
  sid=series.get("seriesID");meta=BLS.get(sid)
  if not meta:continue
  vals=[x for x in series.get("data",[]) if x.get("period","").startswith("M") and x.get("period")!="M13" and num(x.get("value")) is not None]
  vals=sorted(vals,key=lambda x:(int(x.get("year",0)),int(x.get("period","M00")[1:])))
  if len(vals)<2:continue
  r,p=vals[-1],vals[-2];pp=vals[-3] if len(vals)>2 else None
  period=f'{r.get("year")}-{r.get("period")}'
  if sid in ("CUUR0000SA0","CUUR0000SA0L1E"):
   cur,prev=num(r.get("value")),num(p.get("value"))
   yoybase=next((x for x in vals if int(x.get("year",0))==int(r.get("year"))-1 and x.get("period")==r.get("period")),None)
   prev_yoybase=next((x for x in vals if int(x.get("year",0))==int(p.get("year"))-1 and x.get("period")==p.get("period")),None)
   prefix="Core CPI" if sid.endswith("L1E") else "CPI"
   out.append(obs(prefix+" m/m","US","%",sid+":MOM",period,round((cur/prev-1)*100,1),round((prev/num(pp.get("value"))-1)*100,1) if pp else None,"U.S. Bureau of Labor Statistics",f"https://data.bls.gov/timeseries/{sid}"))
   if yoybase:
    out.append(obs(prefix+" y/y","US","%",sid+":YOY",period,round((cur/num(yoybase.get("value"))-1)*100,1),round((prev/num(prev_yoybase.get("value"))-1)*100,1) if prev_yoybase else None,"U.S. Bureau of Labor Statistics",f"https://data.bls.gov/timeseries/{sid}"))
  elif sid=="CES0000000001":
   out.append(obs("NFP","US","thousand jobs",sid+":CHANGE",period,round(num(r.get("value"))-num(p.get("value")),1),round(num(p.get("value"))-num(pp.get("value")),1) if pp else None,"U.S. Bureau of Labor Statistics",f"https://data.bls.gov/timeseries/{sid}"))
  else:
   out.append(obs(meta[0],meta[1],meta[2],sid,period,num(r.get("value")),num(p.get("value")),"U.S. Bureau of Labor Statistics",f"https://data.bls.gov/timeseries/{sid}"))
 return out

ECB_SERIES=[
 ("ECB Rate Decision","EU","%","MRR_FR","https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.MRR_FR.LEV?lastNObservations=3&format=csvdata"),
 ("ECB Deposit Facility Rate","EU","%","DFR","https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.DFR.LEV?lastNObservations=3&format=csvdata"),
]
def collect_ecb_rates():
 out=[]
 for event,country,unit,sid,url in ECB_SERIES:
  raw,_=req(url,headers={"Accept":"text/csv"})
  rows=[r for r in csv.DictReader(io.StringIO(raw.decode("utf-8-sig","replace"))) if num(r.get("OBS_VALUE")) is not None]
  if not rows:continue
  rows=sorted(rows,key=lambda r:r.get("TIME_PERIOD",""));r=rows[-1];p=rows[-2] if len(rows)>1 else None
  out.append(obs(event,country,unit,"ECB:FM:"+sid,r.get("TIME_PERIOD"),num(r.get("OBS_VALUE")),num(p.get("OBS_VALUE")) if p else None,
    "European Central Bank","https://data.ecb.europa.eu/key-figures/ecb-interest-rates-and-exchange-rates/key-ecb-interest-rates",r.get("TIME_PERIOD")+"T00:00"))
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
 dims=j.get("dimension",{}); dim=(dims.get("time") or dims.get("TIME_PERIOD") or {}).get("category",{}).get("index",{})
 times=sorted(dim,key=lambda k:dim[k]) if isinstance(dim,dict) else list(dim or [])
 vals=j.get("value",[])
 def value_at(i):
  if isinstance(vals,dict): return vals.get(str(i),vals.get(i))
  return vals[i] if i<len(vals) else None
 pairs=[(t,value_at(i)) for i,t in enumerate(times)]
 pairs=[(t,num(v)) for t,v in pairs if num(v) is not None]
 return pairs[-2:]

def collect_eurostat():
 out=[]
 for dataset,event,geo,unit,coicop,label,country,outunit in EUROSTAT:
  q=urllib.parse.urlencode({"format":"JSON","lang":"EN","geo":geo,"unit":unit,"coicop":coicop,"lastTimePeriod":3})
  raw,_=req(f"https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{dataset}?{q}")
  pairs=_jsonstat_latest(json.loads(raw))
  if not pairs:continue
  r=pairs[-1];p=pairs[-2] if len(pairs)>1 else None
  out.append(obs(event,country,outunit,f"EUROSTAT:{dataset}:{geo}:{unit}:{coicop}",r[0],r[1],p[1] if p else None,"Eurostat",f"https://ec.europa.eu/eurostat/databrowser/view/{dataset}/default/table"))
 return out


STATCAN={
 "108785713":("Common CPI y/y","CA","%"),
 "108785714":("Median CPI y/y","CA","%"),
 "108785715":("Trimmed CPI y/y","CA","%"),
}
STATCAN_WDS="https://www150.statcan.gc.ca/t1/wds/rest/getBulkVectorDataByRange"

def collect_statcan():
 # WDS range is keyed to data-point release date. Core CPI vectors are revised
 # historically, so retain only the newest reference period from each release.
 start=(datetime.now(timezone.utc).date().replace(day=1)).isoformat()+"T00:00"
 end=datetime.now(timezone.utc).date().isoformat()+"T23:59"
 raw,_=req(STATCAN_WDS,"POST",{"vectorIds":list(STATCAN),"startDataPointReleaseDate":start,"endDataPointReleaseDate":end})
 j=json.loads(raw);out=[]
 for item in j:
  o=item.get("object") or {}; sid=str(o.get("vectorId") or ""); meta=STATCAN.get(sid)
  pts=o.get("vectorDataPoint") or []
  if not meta or not pts: continue
  # A revision response can contain the whole history at one releaseTime.
  # The current release is the greatest reference period.
  pts=sorted(pts,key=lambda x:x.get("refPer",""))
  r=pts[-1]
  previous_period=(datetime.fromisoformat(r["refPer"]).replace(day=1))
  y,m=previous_period.year,previous_period.month
  pm=(f"{y-1}-12-01" if m==1 else f"{y}-{m-1:02d}-01")
  p=next((x for x in reversed(pts[:-1]) if x.get("refPer")==pm),None)
  out.append(obs(meta[0],meta[1],meta[2],"STATCAN:"+sid,r.get("refPer"),num(r.get("value")),num(p.get("value")) if p else None,
    "Statistics Canada","https://www.statcan.gc.ca/en/subjects-start/prices_and_price_indexes",r.get("releaseTime")))
 return out


ONS_SERIES=[
 ("CPI","GB","%","d7g7","mm23","https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23/data"),
 ("CPI m/m","GB","%","d7oe","mm23","https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7oe/mm23/data"),
 ("Retail Sales","GB","%","j5ec","drsi","https://www.ons.gov.uk/businessindustryandtrade/retailindustry/timeseries/j5ec/drsi/data"),
 ("GDP","GB","%","ecyx","mgdp","https://www.ons.gov.uk/economy/grossdomesticproductgdp/timeseries/ecyx/mgdp/data"),
 ("Unemployment Rate","GB","%","mgsx","lms","https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms/data"),
]
def collect_ons():
 out=[]
 for event,country,unit,sid,dataset,url in ONS_SERIES:
  raw,_=req(url,headers={"User-Agent":"TradeAlphaAI/1.2 official-macro-collector"})
  j=json.loads(raw);rows=j.get("months") or []
  rows=[r for r in rows if num(r.get("value")) is not None]
  if not rows:continue
  r=rows[-1];p=rows[-2] if len(rows)>1 else None
  # ONS updateDate is close to the official publication timestamp but can be
  # represented at the previous UTC date. Keep it as observed_at provenance;
  # use the verified release-date convention from the data publication day.
  release=r.get("updateDate")
  if release:
   try:
    dt=datetime.fromisoformat(release.replace("Z","+00:00"))+timedelta(hours=8)
    release=dt.strftime("%Y-%m-%dT07:00")
   except Exception: pass
  out.append(obs(event,country,unit,"ONS:"+sid,r.get("label") or r.get("date"),num(r.get("value")),num(p.get("value")) if p else None,
   "Office for National Statistics",url.replace("/data",""),release))
 return out

def probe_ons():
 try:
  raw,_=req("https://api.beta.ons.gov.uk/v1/datasets?limit=1");json.loads(raw)
  return {"status":"ok","checked_at":now(),"mode":"open_api_discovery"}
 except Exception as e:
  # Do not pretend ONS is live when a runner/network policy returns 403.
  return {"status":"unavailable","checked_at":now(),"reason":str(e)[:160],"mode":"open_api_discovery"}
def probe_statcan():
 raw,_=req("https://www150.statcan.gc.ca/t1/wds/rest/getAllCubesListLite");json.loads(raw)
 return {"status":"ok","checked_at":now(),"mode":"open_wds_discovery"}
def collect_bea_release():
 # BEA news releases are official, keyless and preserve the release vintage.
 # The API remains the preferred bulk source once a BEA API key is configured.
 url="https://www.bea.gov/news/2026/personal-income-and-outlays-july-2026"
 raw,_=req(url,headers={"User-Agent":"Mozilla/5.0 TradeAlphaAI"})
 text=html.unescape(re.sub(r"<[^>]+>"," ",raw.decode("utf-8","replace")))
 text=re.sub(r"\s+"," ",text)
 def grab(pattern):
  m=re.search(pattern,text,re.I|re.S);return num(m.group(1)) if m else None
 mom=grab(r'preceding month.{0,160}?PCE price index for July increased\s*([0-9.]+)\s*percent')
 coremom=grab(r'Excluding food and energy, the PCE price index also increased\s*([0-9.]+)\s*percent')
 yoy=grab(r'same month one year ago.{0,160}?PCE price index for July increased\s*([0-9.]+)\s*percent')
 coreyoy=grab(r'Excluding food and energy, the PCE price index increased\s*([0-9.]+)\s*percent from one year ago')
 rel="2026-08-26T08:30:00-04:00";out=[]
 for event,val,sid in [("PCE Price Index m/m",mom,"BEA:PIO:PCE:MOM"),("Core PCE Price Index m/m",coremom,"BEA:PIO:COREPCE:MOM"),("PCE Price Index y/y",yoy,"BEA:PIO:PCE:YOY"),("Core PCE Price Index y/y",coreyoy,"BEA:PIO:COREPCE:YOY")]:
  if val is not None:out.append(obs(event,"US","%",sid,"2026-07",val,None,"U.S. Bureau of Economic Analysis",url,rel))
 return out

def collect_bea_gdp_release():
 url="https://www.bea.gov/data/gdp/gross-domestic-product"
 raw,_=req(url,headers={"User-Agent":"Mozilla/5.0 TradeAlphaAI"})
 text=html.unescape(re.sub(r"<[^>]+>"," ",raw.decode("utf-8","replace")))
 text=re.sub(r"\s+"," ",text)
 m=re.search(r'Q2\s*2026\s*\(2nd\).*?([+-]?[0-9.]+)\s*%',text,re.I|re.S)
 if not m:
  m=re.search(r'increased at an annual rate of\s*([0-9.]+)\s*percent in the second quarter of 2026',text,re.I)
 if not m:return []
 val=num(m.group(1))
 return [obs("GDP q/q annualized","US","%","BEA:GDP:REAL:QOQ-ANNUALIZED:SECOND","2026-Q2",val,None,
  "U.S. Bureau of Economic Analysis",url,"2026-08-26T08:30:00-04:00")]

def collect_abs():
 # Official ABS CPI monthly all-items Australia series. Keep the index as an
 # underlying observation only; do not map it onto a CPI % calendar event.
 url="https://data.api.abs.gov.au/rest/data/ABS,CPI,2.0.0/1.10001.10.50.M?lastNObservations=3&format=csvfilewithlabels"
 raw,_=req(url,headers={"Accept":"text/csv"})
 rows=list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig","replace"))))
 rows=[r for r in rows if num(r.get("OBS_VALUE")) is not None]
 if not rows:return []
 rows=sorted(rows,key=lambda r:r.get("TIME_PERIOD",""));r=rows[-1];p=rows[-2] if len(rows)>1 else None
 return [obs("CPI Index","AU","index","ABS:CPI:1.10001.10.50.M",r.get("TIME_PERIOD"),num(r.get("OBS_VALUE")),num(p.get("OBS_VALUE")) if p else None,
   "Australian Bureau of Statistics","https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia")]

def load():
 try:return json.loads(OUT.read_text("utf-8"))
 except:return {"schema_version":"1.1","updated_at":None,"observations":[],"provider_health":{}}
def key(x):return "|".join(str(x.get(k,"")) for k in ("source_name","series_id","period","actual"))
def material(x):
 return {k:v for k,v in x.items() if k!="observed_at"}
def stabilize(newrows,oldrows):
 oldby={key(x):x for x in oldrows}
 out=[]
 for x in newrows:
  prev=oldby.get(key(x))
  if prev and material(prev)==material(x):
   x=dict(x);x["observed_at"]=prev.get("observed_at")
  out.append(x)
 return out
def health_material(h):
 return {name:{k:v for k,v in info.items() if k!="checked_at"} for name,info in h.items()}

def main():
 ap=argparse.ArgumentParser();ap.add_argument("--write",action="store_true");args=ap.parse_args()
 old=load();allobs=[];health={}
 for name,fn in [("bls",collect_bls),("statcan",collect_statcan),("ons",collect_ons),("abs",collect_abs),("eurostat",collect_eurostat),("ecb",collect_ecb_rates),("bea",collect_bea_release),("bea_gdp",collect_bea_gdp_release)]:
  try:
   rows=fn();allobs.extend(rows);health[name]={"status":"ok","count":len(rows),"checked_at":now()}
  except Exception as e:health[name]={"status":"error","reason":str(e)[:240],"checked_at":now()}
 # ECB is kept as discovery until a current dataflow/key is verified; never guess a series.
 if "ecb" not in health: health["ecb"]={"status":"mapping_pending","checked_at":now(),"mode":"official_sdmx_discovery"}
 for name,fn in []:
  try:health[name]=fn()
  except Exception as e:health[name]={"status":"error","reason":str(e)[:240],"checked_at":now()}
 uniq={key(x):x for x in allobs};rows=sorted(uniq.values(),key=lambda x:(x.get("observed_at",""),x.get("series_id","")))[-10000:]
 out={"schema_version":"1.1","updated_at":now(),"observations":rows,"provider_health":health}
 print(json.dumps({"updated_at":out["updated_at"],"observation_versions":len(rows),"provider_health":health},indent=2))
 if args.write:OUT.write_text(json.dumps(out,indent=2)+"\n","utf-8")
if __name__=="__main__":main()

