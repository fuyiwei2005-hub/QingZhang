"""Verify WAL backups close cleanly and contain a consistent snapshot."""
import importlib.util
import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path

spec = importlib.util.spec_from_file_location("backup", Path(__file__).with_name("backup-database.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with tempfile.TemporaryDirectory(prefix="hengxu-backup-check-") as temporary:
    folder = Path(temporary)
    source = folder / "source.sqlite"
    with closing(sqlite3.connect(source)) as database:
        database.execute("PRAGMA journal_mode=WAL")
        database.execute("CREATE TABLE records (amount INTEGER)")
        database.execute("INSERT INTO records VALUES (12345)")
        database.commit()
        database.execute("INSERT INTO records VALUES (99999)")
        snapshot = module.backup(source, folder / "backups")
        with closing(sqlite3.connect(snapshot)) as saved:
            assert saved.execute("SELECT SUM(amount) FROM records").fetchone()[0] == 12345
            assert saved.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        assert list((folder / "backups").iterdir()) == [snapshot], "Unclosed backup sidecars remain"
        database.rollback()
print("PASS: consistent WAL snapshot, closed connections and no pending sidecars")
