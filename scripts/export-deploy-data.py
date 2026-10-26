"""Export account data from the local D1 preview without active sessions."""

import sqlite3
import sys
from pathlib import Path

source, destination = map(Path, sys.argv[1:3])
database = sqlite3.connect(source)
database.row_factory = sqlite3.Row
lines = ["BEGIN TRANSACTION;"]
for table in ("users", "transactions", "notes", "user_settings", "transfers", "category_budgets", "recurring_rules", "recurring_events", "wheels", "life_items", "life_events"):
    rows = database.execute(f'SELECT * FROM "{table}"').fetchall()
    for row in rows:
        columns = ", ".join(f'"{column}"' for column in row.keys())
        values = ", ".join(database.execute("SELECT quote(?)", (value,)).fetchone()[0] for value in row)
        lines.append(f'INSERT INTO "{table}" ({columns}) VALUES ({values});')
lines.append("COMMIT;")
destination.write_text("\n".join(lines) + "\n", encoding="utf-8")
database.close()
print("Exported users, transactions, and notes; sessions excluded.")
