"""Test both local apps with disposable accounts and one shared browser cookie jar."""
import http.cookiejar,urllib.request,urllib.error,uuid,secrets,json,sqlite3
from pathlib import Path
jar=http.cookiejar.CookieJar();opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar));users=[]
def call(port,method,path,body=None):
 req=urllib.request.Request(f'http://127.0.0.1:{port}'+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json'},method=method)
 for attempt in range(3):
  try:
   with opener.open(req,timeout=20) as r:return r.status,json.load(r)
  except urllib.error.HTTPError as e:
   raw=e.read()
   if e.code==503 and b'worker restarted mid-request' in raw and attempt<2:continue
   try:return e.code,json.loads(raw)
   except ValueError:return e.code,None
try:
 email='split-test-'+uuid.uuid4().hex+'@example.invalid'
 for app,port in [('qingzhang',5189),('hengxu',5188)]:
  status,data=call(port,'POST','/api/auth/register',{'name':'Split test','email':email,'password':secrets.token_urlsafe(24)});assert status==201,(status,data)
  users.append((app,data['user']['id'],email))
  if app=='qingzhang':assert call(5188,'GET','/api/studio')[0]==401
 assert users[0][1]!=users[1][1]
 assert {'qingzhang_session','hengxu_session'} <= {c.name for c in jar}
 assert call(5189,'GET','/api/transactions')[0]==200
 assert call(5188,'GET','/api/studio')[0]==200
 assert call(5188,'GET','/api/transactions')[0]==404
 assert call(5189,'GET','/api/studio')[0]==404
 assert call(5189,'GET','/studio')[0]==404
 print('PASS: concurrent independent apps, separate users and login cookies, and isolated API/page routes')
finally:
 for app,user_id,email in users:
  files=[p for p in Path('apps',app,'.wrangler/state/v3/d1/miniflare-D1DatabaseObject').glob('*.sqlite') if p.name!='metadata.sqlite'];assert len(files)==1
  with sqlite3.connect(files[0],timeout=30) as db:
   assert db.execute('SELECT email FROM users WHERE id=?',(user_id,)).fetchone()==(email,)
   db.execute('DELETE FROM sessions WHERE user_id=?',(user_id,));db.execute('DELETE FROM users WHERE id=? AND email=?',(user_id,email))
 print('Disposable split-project test accounts cleaned up')
