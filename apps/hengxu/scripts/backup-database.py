"""Create a consistent, private SQLite snapshot; retain snapshots for 30 days."""
import argparse
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path

def find_database(state):
    files = [path for path in Path(state).glob("v3/d1/miniflare-D1DatabaseObject/*.sqlite") if path.name != "metadata.sqlite"]
    if len(files) != 1:
        raise RuntimeError(f"Expected one application database, found {len(files)}")
    return files[0]

def backup(source, folder, prefix="hengxu"):
    folder = Path(folder)
    folder.mkdir(mode=0o700, parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    destination = folder / f"{prefix}-{now:%Y%m%d-%H%M%S-%f}.sqlite"
    temporary = destination.with_suffix(".pending")
    try:
        # Transaction contexts do not close SQLite connections. Close both handles
        # before renaming the snapshot, including on Windows and in WAL mode.
        with closing(sqlite3.connect(f"file:{Path(source).resolve().as_posix()}?mode=ro", uri=True, timeout=30)) as database:
            with closing(sqlite3.connect(temporary)) as snapshot:
                database.backup(snapshot)
                if snapshot.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                    raise RuntimeError("Backup integrity check failed")
                snapshot.execute("PRAGMA journal_mode=DELETE")
        os.chmod(temporary, 0o600)
        temporary.replace(destination)
    finally:
        if temporary.exists():
            temporary.unlink()
    cutoff = now - timedelta(days=30)
    for old in folder.glob("hengxu-*.sqlite"):
        if datetime.fromtimestamp(old.stat().st_mtime, timezone.utc) < cutoff:
            old.unlink()
    return destination

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    print(backup(find_database(args.state), args.output))
