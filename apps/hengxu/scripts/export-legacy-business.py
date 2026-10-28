"""Export only legacy shared accounts and Studio business records. No sessions or personal records."""
import argparse,json,os,sqlite3
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--state',required=True);p.add_argument('--output',required=True);a=p.parse_args()
files=[f for f in Path(a.state).glob('v3/d1/miniflare-D1DatabaseObject/*.sqlite') if f.name!='metadata.sqlite']
if len(files)!=1:raise SystemExit('Expected one source database')
tables=('users','studio_clients','studio_projects','studio_stages','studio_entries','studio_tasks')
output=Path(a.output);output.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
fd=os.open(output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
try:
 with sqlite3.connect(f'file:{files[0].resolve().as_posix()}?mode=ro',uri=True,timeout=30) as db,os.fdopen(fd,'w',encoding='utf-8') as dest:
  db.row_factory=sqlite3.Row;db.execute('BEGIN');counts={}
  for table in tables:
   rows=db.execute('SELECT * FROM '+table).fetchall();counts[table]=len(rows)
   for row in rows:
    columns=','.join('"'+k+'"' for k in row.keys());values=','.join(db.execute('SELECT quote(?)',(v,)).fetchone()[0] for v in row)
    dest.write(f'INSERT INTO "{table}" ({columns}) VALUES ({values});\n')
  totals=dict(db.execute("SELECT type,sum(amount_cents) FROM studio_entries WHERE deleted_at IS NULL GROUP BY type").fetchall())
  manifest={'counts':counts,'totals':totals};db.rollback()
 output.with_suffix('.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8');os.chmod(output.with_suffix('.json'),0o600)
 print(json.dumps(manifest))
except BaseException:
 if output.exists():output.unlink()
 raise
