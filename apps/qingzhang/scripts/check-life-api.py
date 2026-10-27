"""Integration checks using disposable accounts. Run in target instance root."""
import argparse, http.cookiejar, json, secrets, sqlite3, uuid, urllib.request, urllib.error
from pathlib import Path
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
parser=argparse.ArgumentParser()
parser.add_argument("--base-url",default="http://127.0.0.1:5175")
args=parser.parse_args()
class Client:
 def __init__(self): self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def call(self,method,path,body=None):
  request=urllib.request.Request(args.base_url.rstrip("/")+path,data=json.dumps(body).encode() if body is not None else None,headers={"Content-Type":"application/json"},method=method)
  try:
   with self.opener.open(request,timeout=30) as response:return response.status,json.load(response)
  except urllib.error.HTTPError as error:return error.code,json.load(error)
accounts=[]
today=datetime.now(timezone(timedelta(hours=8))).date().isoformat()
try:
 assert Client().call("GET","/api/life")[0]==401
 clients=[]
 for _ in range(2):
  c=Client();email="life-test-"+uuid.uuid4().hex+"@example.invalid"
  status,data=c.call("POST","/api/auth/register",{"name":"Life test","email":email,"password":secrets.token_urlsafe(24)})
  assert status==201,(status,data)
  accounts.append((data["user"]["id"],email));clients.append(c)
 a,b=clients
 payloads=[
  {"kind":"shopping","title":"Milk","group":"Food","amount":12.35,"done":False},
  {"kind":"subscription","title":"Monthly fee","amount":20,"date":"2026-01-31","frequency":"monthly","active":True},
  {"kind":"goal","title":"Travel","amount":1000,"date":None},
  {"kind":"debt","title":"Loan","person":"Friend","amount":100,"date":None,"direction":"lent"},
  {"kind":"anniversary","title":"Birthday","date":"2000-02-29","yearly":True},
  {"kind":"habit","title":"Read","active":True}]
 items=[]
 for payload in payloads:
  status,res=a.call("POST","/api/life",payload);assert status==201,(status,res);items.append(res["item"])
 assert len(a.call("GET","/api/life")[1]["items"])==6
 assert b.call("GET","/api/life")[1]["items"]==[]
 shopping,subscription,goal,debt,anniversary,habit=items
 assert b.call("PUT","/api/life",{"id":shopping["id"],"version":1,"data":payloads[0]})[0]==404
 assert b.call("DELETE",f'/api/life?id={shopping["id"]}')[0]==404
 assert b.call("PATCH","/api/life",{"id":goal["id"],"action":"event","amount":1,"date":today,"key":str(uuid.uuid4())})[0]==404
 edited={**payloads[0],"title":"Updated milk"}
 assert a.call("PUT","/api/life",{"id":shopping["id"],"version":1,"data":edited})[0]==200
 assert a.call("PUT","/api/life",{"id":shopping["id"],"version":1,"data":edited})[0]==409
 purchase={"id":shopping["id"],"action":"purchase","amount":12.35,"date":today,"category":"日用","account":"微信"}
 with ThreadPoolExecutor(2) as pool: results=list(pool.map(lambda _:a.call("PATCH","/api/life",purchase),range(2)))
 assert all(r[0]==200 for r in results),results
 txs=a.call("GET","/api/transactions")[1]["transactions"]
 assert len(txs)==1 and txs[0]["amount"]==12.35,txs
 for amount in [.1,.2]:assert a.call("PATCH","/api/life",{"id":goal["id"],"action":"event","amount":amount,"date":today,"key":str(uuid.uuid4())})[0]==200
 repayments=[{"id":debt["id"],"action":"event","amount":60,"date":today,"key":str(uuid.uuid4())} for _ in range(2)]
 with ThreadPoolExecutor(2) as pool: statuses=list(pool.map(lambda p:a.call("PATCH","/api/life",p)[0],repayments))
 assert sorted(statuses)==[200,409],statuses
 assert a.call("PATCH","/api/life",{"id":debt["id"],"action":"event","amount":40,"date":today,"key":str(uuid.uuid4())})[0]==200
 for _ in range(2):assert a.call("PATCH","/api/life",{"id":habit["id"],"action":"event","date":today})[0]==200
 for _ in range(2):assert a.call("PATCH","/api/life",{"id":subscription["id"],"action":"event","date":"2026-01-31"})[0]==200
 assert a.call("PATCH","/api/life",{"id":subscription["id"],"action":"event","date":"2026-02-28"})[0]==200
 state=a.call("GET","/api/life")[1]
 assert len([e for e in state["events"] if e["itemId"]==habit["id"]])==1
 assert len([e for e in state["events"] if e["itemId"]==subscription["id"]])==2
 event=next(e for e in state["events"] if e["itemId"]==goal["id"])
 assert b.call("PATCH","/api/life",{"id":goal["id"],"action":"removeEvent","eventId":event["id"]})[0]==404
 assert a.call("PATCH","/api/life",{"id":goal["id"],"action":"removeEvent","eventId":event["id"]})[0]==200
 for payload in [{**payloads[2],"amount":1.234},{**payloads[4],"date":"2026-02-30"},{**payloads[3],"amount":-1}]:assert a.call("POST","/api/life",payload)[0]==400
 assert a.call("DELETE",f'/api/life?id={habit["id"]}')[0]==200
 assert not any(e["itemId"]==habit["id"] for e in a.call("GET","/api/life")[1]["events"])
 print("PASS: six modules, CRUD, conflict protection, tenant isolation, shopping idempotency, repayment race, habit uniqueness, bills and event undo")
finally:
 files=[p for p in Path(".wrangler/state/v3/d1/miniflare-D1DatabaseObject").glob("*.sqlite") if p.name!="metadata.sqlite"]
 assert len(files)==1
 with sqlite3.connect(files[0],timeout=30) as db:
  for user_id,email in accounts:
   assert db.execute("SELECT email FROM users WHERE id=?",(user_id,)).fetchone()==(email,)
   for table in ("life_events","life_items","transactions","sessions"):db.execute("DELETE FROM "+table+" WHERE user_id=?",(user_id,))
   db.execute("DELETE FROM users WHERE id=? AND email=?",(user_id,email))
 print("Disposable accounts cleaned up")
