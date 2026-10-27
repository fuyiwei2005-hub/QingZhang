"""Checks only disposable accounts; no real AI calls or secrets required."""
import argparse,http.cookiejar,json,secrets,sqlite3,uuid,urllib.request,urllib.error
from pathlib import Path
from datetime import datetime,timezone
from concurrent.futures import ThreadPoolExecutor
parser=argparse.ArgumentParser();parser.add_argument("--base-url",default="http://127.0.0.1:5180");args=parser.parse_args()
class Client:
 def __init__(self):self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def call(self,method,path,body=None):
  req=urllib.request.Request(args.base_url.rstrip("/")+path,data=json.dumps(body).encode() if body is not None else None,headers={"Content-Type":"application/json"},method=method)
  try:
   with self.opener.open(req,timeout=30) as response:return response.status,json.load(response)
  except urllib.error.HTTPError as error:return error.code,json.load(error)
files=[p for p in Path(".wrangler/state/v3/d1/miniflare-D1DatabaseObject").glob("*.sqlite") if p.name!="metadata.sqlite"];assert len(files)==1
accounts=[]
try:
 for path in ["/api/ai","/api/ai/confirm"]:assert Client().call("POST",path,{})[0]==401
 assert Client().call("GET","/api/ai")[0]==401
 clients=[]
 for _ in range(2):
  c=Client();email="ai-test-"+uuid.uuid4().hex+"@example.invalid";status,data=c.call("POST","/api/auth/register",{"name":"AI test","email":email,"password":secrets.token_urlsafe(24)});assert status==201
  accounts.append((data["user"]["id"],email));clients.append(c)
 a,b=clients;status,config=a.call("GET","/api/ai");assert status==200 and "key" not in config and "model" not in config and "provider" not in config and 0 <= config["remaining"] <= config["userLimit"]
 payload={"id":str(uuid.uuid4()),"mode":"draft","text":"午饭12.35","consent":False}
 assert a.call("POST","/api/ai",payload)[0]==400
 assert a.call("POST","/api/ai",{**payload,"consent":True,"image":"https://example.com/image.png"})[0]==400
 if not config["enabled"]:assert a.call("POST","/api/ai",{**payload,"consent":True})[0]==503
 row={"type":"expense","amount":12.35,"date":"2026-10-27","category":"餐饮","account":"微信","note":"AI test"}
 draft_id=str(uuid.uuid4())
 with sqlite3.connect(files[0],timeout=30) as db:db.execute("INSERT INTO ai_requests (id,user_id,day,status,created_at,result) VALUES (?,?,?,'ready',?,?)",(draft_id,accounts[0][0],"2026-10-27",datetime.now(timezone.utc).isoformat(),json.dumps({"rows":[row,row]})))
 commit={"id":draft_id,"rows":[{"index":0,"entry":row,"confirmed":True}]}
 assert b.call("POST","/api/ai/confirm",commit)[0]==404
 assert a.call("POST","/api/ai/confirm",{"id":draft_id,"rows":[{"index":0,"entry":row,"confirmed":False}]})[0]==400
 assert a.call("POST","/api/ai/confirm",{"id":draft_id,"rows":[{"index":0,"entry":{**row,"date":""},"confirmed":True}]})[0]==400
 assert a.call("POST","/api/ai/confirm",{"id":draft_id,"rows":commit["rows"]*2})[0]==400
 with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda _:a.call("POST","/api/ai/confirm",commit),range(2)))
 assert all(status==200 and data["count"]==1 for status,data in results),results
 entries=a.call("GET","/api/transactions")[1]["transactions"];assert len(entries)==1 and entries[0]["amount"]==12.35
 assert b.call("GET","/api/transactions")[1]["transactions"]==[]
 assert b.call("DELETE","/api/ai/confirm?id="+draft_id)[0]==404
 assert a.call("DELETE","/api/ai/confirm?id="+draft_id)[0]==200
 assert a.call("GET","/api/transactions")[1]["transactions"]==[]
 assert a.call("POST","/api/ai/confirm",commit)[0]==409
 assert a.call("DELETE","/api/ai/confirm?id="+draft_id)[0]==200
 with sqlite3.connect(files[0],timeout=30) as db:
  assert db.execute("SELECT deleted_at FROM transactions WHERE user_id=?",(accounts[0][0],)).fetchone()[0]
 print("PASS: auth, disabled service, consent, image bounds, draft validation, account isolation, concurrent idempotent save and undo")
finally:
 with sqlite3.connect(files[0],timeout=30) as db:
  for user_id,email in accounts:
   assert db.execute("SELECT email FROM users WHERE id=?",(user_id,)).fetchone()==(email,)
   for table in ("ai_requests","transactions","sessions"):db.execute("DELETE FROM "+table+" WHERE user_id=?",(user_id,))
   db.execute("DELETE FROM users WHERE id=? AND email=?",(user_id,email))
 print("Disposable AI test accounts cleaned up")
