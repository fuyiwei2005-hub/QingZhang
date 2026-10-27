"""Exercise only disposable Studio accounts, including atomic payment limits."""
import argparse,http.cookiejar,json,secrets,sqlite3,uuid,urllib.request,urllib.error
from pathlib import Path
from datetime import datetime,timezone
from concurrent.futures import ThreadPoolExecutor
p=argparse.ArgumentParser();p.add_argument('--base-url',default='http://127.0.0.1:5180');p.add_argument('--live-ai',action='store_true');a=p.parse_args()
class Client:
 def __init__(self):self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def call(self,method,path,body=None):
  r=urllib.request.Request(a.base_url.rstrip('/')+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json'},method=method)
  for attempt in range(3):
   try:
    with self.opener.open(r,timeout=85) as response:return response.status,json.load(response)
   except urllib.error.HTTPError as e:
    raw=e.read()
    if e.code==503 and b"worker restarted mid-request" in raw and attempt<2:continue
    try:return e.code,json.loads(raw)
    except ValueError:raise AssertionError((e.code,raw[:300]))
def uid():return str(uuid.uuid4())
files=[p for p in Path('.wrangler/state/v3/d1/miniflare-D1DatabaseObject').glob('*.sqlite') if p.name!='metadata.sqlite'];assert len(files)==1
accounts=[];today=datetime.now(timezone.utc).astimezone().date().isoformat()
try:
 assert Client().call('GET','/api/studio')[0]==401
 assert Client().call('POST','/api/studio',{})[0]==401
 assert Client().call('POST','/api/studio/ai',{})[0]==401
 clients=[]
 for _ in range(2):
  c=Client();email='studio-test-'+uuid.uuid4().hex+'@example.invalid';status,data=c.call('POST','/api/auth/register',{'name':'Studio test','email':email,'password':secrets.token_urlsafe(24)});assert status==201,(status,data)
  accounts.append((data['user']['id'],email));clients.append(c)
 x,y=clients
 customer=uid();project=uid();task=uid()
 assert x.call('POST','/api/studio',{'op':'client','id':customer,'name':'Test client'})[0]==200
 create={'op':'project','id':project,'title':'Test project','clientId':customer,'contractAmount':100,'stages':[{'title':'Full payment','amount':100,'dueDate':today}],'taskTitle':'Delivery'}
 assert y.call('POST','/api/studio',create)[0]==400
 assert x.call('POST','/api/studio',{**create,'stages':[{'title':'Too much','amount':100.01}]})[0]==400
 assert x.call('GET','/api/studio')[1]['projects']==[]
 assert x.call('POST','/api/studio',create)[0]==200
 assert x.call('POST','/api/studio',create)[0]==200
 data=x.call('GET','/api/studio')[1];assert len(data['projects'])==len(data['tasks'])==len(data['stages'])==1
 assert y.call('GET','/api/studio')[1]['projects']==[]
 stage=data['stages'][0]['id'];entry=uid()
 base={'op':'entry','id':entry,'projectId':project,'stageId':stage,'type':'income','amount':60.1,'date':today,'category':'服务收入','account':'银行卡','note':'Test income'}
 assert y.call('POST','/api/studio',base)[0]==400
 assert x.call('POST','/api/studio',{**base,'date':'2026-02-30'})[0]==400
 assert x.call('POST','/api/studio',{**base,'amount':.001})[0]==400
 assert x.call('POST','/api/studio',base)[0]==200
 assert x.call('POST','/api/studio',base)[0]==200
 assert len(x.call('GET','/api/studio')[1]['entries'])==1
 # Concurrent attempts can fill, but never overfill, the remaining 39.90.
 with ThreadPoolExecutor(2) as pool:out=list(pool.map(lambda _:x.call('POST','/api/studio',{**base,'id':uid(),'amount':30}),range(2)))
 assert sorted(r[0] for r in out)==[200,400],out
 data=x.call('GET','/api/studio')[1];assert sum(e['amountCents'] for e in data['entries'])==9010
 assert x.call('PATCH','/api/studio',{'op':'stage','id':stage,'projectId':project,'title':'Full payment','amount':90})[0]==400
 assert x.call('PATCH','/api/studio',{**create,'contractAmount':99,'status':'archived'})[0]==400
 assert x.call('PATCH','/api/studio',{**create,'status':'archived'})[0]==200
 assert x.call('POST','/api/studio',{'op':'stage','id':uid(),'projectId':project,'title':'Extra','amount':1})[0]==400
 assert x.call('PATCH','/api/studio',{'op':'task','id':data['tasks'][0]['id'],'done':True})[0]==200
 assert y.call('PATCH','/api/studio',{'op':'task','id':data['tasks'][0]['id'],'done':True})[0]==400
 # Soft delete, receipt replacement, and capacity checks on restore/edit.
 assert x.call('PATCH','/api/studio',{'op':'deleteEntry','id':entry})[0]==200
 assert x.call('POST','/api/studio',{**base,'id':uid(),'amount':70})[0]==200
 assert x.call('PATCH','/api/studio',{'op':'restore','id':entry})[0]==400
 assert x.call('PATCH','/api/studio',{**base,'amount':80})[0]==400
 cost={'op':'entry','id':uid(),'projectId':project,'type':'expense','amount':.3,'date':today,'category':'软件订阅','account':'微信','note':'Test cost'}
 assert x.call('POST','/api/studio',cost)[0]==200
 # Test Studio confirmation without a billable model call.
 draft=uid();row={'type':'expense','amount':12.35,'date':today,'category':'软件订阅','account':'微信','note':'AI test'}
 def seed(key,rows):
  with sqlite3.connect(files[0],timeout=30) as db:db.execute("INSERT INTO ai_requests (id,user_id,day,status,created_at,result) VALUES (?,?,?,'studio_ready',?,?)",(key,accounts[0][0],today,datetime.now(timezone.utc).isoformat(),json.dumps({'kind':'studio','rows':rows})))
 seed(draft,[row])
 commit={'id':draft,'mode':'confirm','consent':True,'projectId':project,'rows':[{**row,'index':0,'confirmed':True}]}
 assert y.call('POST','/api/studio/ai',commit)[0]==404
 assert x.call('POST','/api/studio/ai',{**commit,'rows':[{**row,'index':0,'confirmed':False}]})[0]==400
 with ThreadPoolExecutor(2) as pool:out=list(pool.map(lambda _:x.call('POST','/api/studio/ai',commit),range(2)))
 assert all(r[0]==200 and r[1]['count']==1 for r in out),out
 data=x.call('GET','/api/studio')[1];assert len([e for e in data['entries'] if e['sourceKey']])==1
 # Full stage: mixed AI batch must fail in its entirety, including expense.
 batch=uid();incoming={**row,'type':'income','category':'服务收入','amount':.01};seed(batch,[row,incoming])
 before=len(data['entries']);bad={**commit,'id':batch,'stageId':stage,'rows':[{**row,'index':0,'confirmed':True},{**incoming,'index':1,'confirmed':True}]}
 assert x.call('POST','/api/studio/ai',bad)[0]==400
 assert len(x.call('GET','/api/studio')[1]['entries'])==before
 if a.live_ai:
  status,draft_result=x.call('POST','/api/studio/ai',{'id':uid(),'mode':'draft','consent':True,'text':today+'用微信支付软件订阅12.35元。'})
  assert status==200 and draft_result['mode']=='draft' and any(r['amount']==12.35 and r['type']=='expense' for r in draft_result['rows']),(status,draft_result)
  status,query=x.call('POST','/api/studio/ai',{'id':uid(),'mode':'query','consent':True,'text':'本月实际支出一共多少？'})
  assert status==200 and query['scope']=='cashflow' and query['expense']==1265,(status,query)
  print('PASS: live model drafting and system-calculated business query using synthetic inputs')
 print('PASS: Studio auth, scoped CRUD, atomic project creation, exact cents, payment concurrency limits, edit/restore limits, archiving, tasks, AI draft ownership and idempotent atomic confirmation')
finally:
 with sqlite3.connect(files[0],timeout=30) as db:
  for user_id,email in accounts:
   assert db.execute('SELECT email FROM users WHERE id=?',(user_id,)).fetchone()==(email,)
   for table in ('studio_tasks','studio_entries','studio_stages','studio_projects','studio_clients','ai_requests','sessions'):db.execute('DELETE FROM '+table+' WHERE user_id=?',(user_id,))
   db.execute('DELETE FROM users WHERE id=? AND email=?',(user_id,email))
 print('Disposable Studio accounts cleaned up')
