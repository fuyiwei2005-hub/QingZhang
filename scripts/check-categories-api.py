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
try:
 assert Client().call("GET","/api/categories")[0]==401
 clients=[]
 for _ in range(2):
  c=Client();email="category-test-"+uuid.uuid4().hex+"@example.invalid"
  status,data=c.call("POST","/api/auth/register",{"name":"Category test","email":email,"password":secrets.token_urlsafe(24)})
  assert status==201,(status,data)
  accounts.append((data["user"]["id"],email));clients.append(c)
 a,b=clients
 assert a.call("POST","/api/categories",{"type":"expense","name":" 宠物护理 "})[0]==201
 assert a.call("POST","/api/categories",{"type":"income","name":"稿费"})[0]==201
 assert "宠物护理" in a.call("GET","/api/categories")[1]["expenses"]
 assert "稿费" in a.call("GET","/api/categories")[1]["incomes"]
 assert "宠物护理" not in b.call("GET","/api/categories")[1]["expenses"]
 assert a.call("POST","/api/categories",{"type":"expense","name":"宠物护理"})[0]==409
 assert a.call("POST","/api/categories",{"type":"expense","name":"餐饮"})[0]==409
 for body in [{"type":"other","name":"A"},{"type":"income","name":" "},{"type":"expense","name":"A"*21}]:assert a.call("POST","/api/categories",body)[0]==400
 payload={"type":"expense","name":"并发分类"}
 with ThreadPoolExecutor(2) as pool: statuses=list(pool.map(lambda _:a.call("POST","/api/categories",payload)[0],range(2)))
 assert sorted(statuses)==[201,409],statuses
 assert a.call("GET","/api/categories")[1]["expenses"].count("并发分类")==1
 assert a.call("PUT","/api/category-budgets",{"budgets":{"宠物护理":123.45}})[0]==200
 assert b.call("PUT","/api/category-budgets",{"budgets":{"宠物护理":123.45}})[0]==400
 for type,category in [("expense","宠物护理"),("income","稿费")]:
  row={"type":type,"category":category,"account":"微信","amount":12.35,"note":"category test","occurredAt":"2026-10-26T12:00:00Z"}
  assert a.call("POST","/api/transactions",row)[0]==201
  rule={**row,"startDate":"2026-10-26","frequency":"monthly"}
  assert a.call("POST","/api/recurring",rule)[0]==201
  assert b.call("POST","/api/recurring",rule)[0]==400
 assert {r["category"] for r in a.call("GET","/api/transactions")[1]["transactions"]}=={"宠物护理","稿费"}
 print("PASS: persistent income/expense categories, isolation, duplicate races, budgets, transactions and recurring rules")
finally:
 files=[p for p in Path(".wrangler/state/v3/d1/miniflare-D1DatabaseObject").glob("*.sqlite") if p.name!="metadata.sqlite"]
 assert len(files)==1
 with sqlite3.connect(files[0],timeout=30) as db:
  for user_id,email in accounts:
   assert db.execute("SELECT email FROM users WHERE id=?",(user_id,)).fetchone()==(email,)
   for table in ("custom_categories","category_budgets","recurring_rules","transactions","sessions"):db.execute("DELETE FROM "+table+" WHERE user_id=?",(user_id,))
   db.execute("DELETE FROM users WHERE id=? AND email=?",(user_id,email))
 print("Disposable accounts cleaned up")