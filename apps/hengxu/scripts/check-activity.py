"""Check that history and business writes commit or roll back together."""
import sqlite3
from pathlib import Path
import json

db=sqlite3.connect(':memory:')
db.executescript(Path('drizzle/0000_initial_business.sql').read_text(encoding='utf-8'))
upgrade=Path('drizzle/0001_activity.sql').read_text(encoding='utf-8')
db.executescript(upgrade)
db.executescript(upgrade)  # Safe to apply on an upgraded database.
db.execute("INSERT INTO studio_entries(id,user_id,type,amount_cents,date,category,account,note) VALUES('entry-01','user-01','expense',10,'2026-10-28','软件订阅','微信','测试')")
db.commit()
assert db.execute('SELECT count(*) FROM studio_activity').fetchone()[0]==1
db.execute("UPDATE studio_entries SET amount_cents=10 WHERE id='entry-01'")
assert db.execute('SELECT count(*) FROM studio_activity').fetchone()[0]==1
db.execute("UPDATE studio_entries SET amount_cents=20 WHERE id='entry-01'")
before,after=db.execute('SELECT before_json,after_json FROM studio_activity ORDER BY id DESC LIMIT 1').fetchone()
assert json.loads(before)['amount_cents']==10 and json.loads(after)['amount_cents']==20
db.execute("UPDATE studio_entries SET deleted_at='2026-10-28' WHERE id='entry-01'")
db.execute("UPDATE studio_entries SET deleted_at=NULL WHERE id='entry-01'")
assert [r[0] for r in db.execute('SELECT action FROM studio_activity ORDER BY id')]==['create','update','delete','restore']
db.commit()
count=db.execute('SELECT count(*) FROM studio_activity').fetchone()[0]
try:
 with db:
  db.execute("UPDATE studio_entries SET amount_cents=30 WHERE id='entry-01'")
  db.execute("INSERT INTO studio_entries(id,user_id,type,amount_cents,date,category,account) VALUES('entry-01','user-01','expense',30,'2026-10-28','软件订阅','微信')")
except sqlite3.IntegrityError:pass
assert db.execute('SELECT count(*) FROM studio_activity').fetchone()[0]==count
assert db.execute('SELECT amount_cents FROM studio_entries').fetchone()[0]==20
db.execute("INSERT OR IGNORE INTO studio_entries(id,user_id,type,amount_cents,date,category,account) VALUES('entry-01','user-01','expense',30,'2026-10-28','软件订阅','微信')")
assert db.execute('SELECT count(*) FROM studio_activity').fetchone()[0]==count
print('PASS: idempotent migration, exact snapshots, no-op and duplicate exclusion, delete/restore history, transaction rollback')
