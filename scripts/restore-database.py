"""Administrator-only restore. Stop the app first; a pre-restore snapshot is mandatory."""
import argparse
import sqlite3
import subprocess
import runpy
from pathlib import Path

helpers = runpy.run_path(str(Path(__file__).with_name("backup-database.py")))
parser = argparse.ArgumentParser()
parser.add_argument("snapshot")
parser.add_argument("--state", required=True)
parser.add_argument("--backup-directory", required=True)
parser.add_argument("--service", default="qingzhang")
parser.add_argument("--confirm", action="store_true")
args = parser.parse_args()
if not args.confirm:
    parser.error("Explicit --confirm is required after reviewing the snapshot")
if subprocess.run(["systemctl", "is-active", "--quiet", args.service], check=False).returncode == 0:
    parser.error("Stop the application service before restoring")
source = Path(args.snapshot).resolve(strict=True)
target = helpers["find_database"](args.state).resolve(strict=True)
if source == target:
    parser.error("Snapshot and active database must differ")
with sqlite3.connect(f"file:{source.as_posix()}?mode=ro", uri=True) as snapshot:
    if snapshot.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        raise RuntimeError("Snapshot is corrupt")
    tables = {row[0] for row in snapshot.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if not {"users", "transactions", "notes", "sessions", "user_settings", "transfers", "category_budgets", "recurring_rules", "recurring_events", "wheels"}.issubset(tables):
        raise RuntimeError("Snapshot schema is incompatible with this version")
    print("Pre-restore snapshot:", helpers["backup"](target, args.backup_directory, "before-restore"))
    with sqlite3.connect(target, timeout=30) as active:
        snapshot.backup(active)
        # Invalidate restored sessions so old backup cookies cannot regain access.
        active.execute("DELETE FROM sessions")
        active.commit()
        if active.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("Restored database failed its integrity check")
print("Restore complete. Start the application service after checking the result.")
