"""Run baseline and advanced API checks on the deployed app with disposable accounts."""
import runpy
import secrets
import sqlite3
import uuid
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

Client = runpy.run_path("scripts/check-data-protection.py")["Client"]
accounts = []
try:
    clients = []
    for _ in range(2):
        client = Client()
        email = "advanced-check-" + uuid.uuid4().hex + "@example.invalid"
        status, data = client.call("POST", "/api/auth/register", {"name": "Advanced test", "email": email, "password": secrets.token_urlsafe(24)})
        assert status == 201, (status, data)
        accounts.append((data["user"]["id"], email)); clients.append(client)
    a, b = clients
    assert a.call("PUT", "/api/category-budgets", {"budgets": {"餐饮": 800.25, "交通": 200}})[0] == 200
    assert a.call("GET", "/api/category-budgets")[1]["budgets"]["餐饮"] == 800.25
    assert b.call("GET", "/api/category-budgets")[1]["budgets"] == {}
    assert a.call("PUT", "/api/category-budgets", {"budgets": {"餐饮": -1}})[0] == 400
    assert a.call("GET", "/api/category-budgets")[1]["budgets"]["餐饮"] == 800.25
    transfer = {"fromAccount": "微信", "toAccount": "银行卡", "amount": 15.35, "date": "2026-10-01", "note": "temporary"}
    status, data = a.call("POST", "/api/transfers", transfer); assert status == 201, data
    transfer_id = data["transfer"]["id"]
    assert a.call("GET", "/api/transactions")[1]["transactions"] == []
    assert b.call("GET", "/api/transfers")[1]["transfers"] == []
    assert a.call("POST", "/api/transfers", {**transfer, "toAccount": "微信"})[0] == 400
    assert a.call("POST", "/api/transfers", {**transfer, "amount": 1.001})[0] == 400
    assert b.call("DELETE", "/api/transfers?id=" + str(transfer_id))[0] == 404
    assert a.call("DELETE", "/api/transfers?id=" + str(transfer_id))[0] == 200
    assert len(a.call("GET", "/api/trash")[1]["transfers"]) == 1
    assert b.call("POST", "/api/trash", {"kind": "transfer", "id": transfer_id})[0] == 404
    assert a.call("POST", "/api/trash", {"kind": "transfer", "id": transfer_id})[0] == 200
    note = {"title": "checklist", "content": "content", "pinned": True, "tags": ["生活", "计划"], "todos": [{"id": "test-task", "text": "购物", "done": False}]}
    status, data = a.call("POST", "/api/notes", note); assert status == 201, data
    nid = data["note"]["id"]
    assert data["note"]["pinned"] is True and data["note"]["tags"] == note["tags"]
    updated = {**note, "todos": [{"id": "test-task", "text": "购物", "done": True}]}
    assert a.call("PUT", "/api/notes?id=" + str(nid), updated)[0] == 200
    assert a.call("GET", "/api/notes")[1]["notes"][0]["todos"][0]["done"] is True
    assert b.call("GET", "/api/notes")[1]["notes"] == []
    assert a.call("POST", "/api/notes", {**note, "todos": note["todos"] * 2})[0] == 400
    rule = {"type": "expense", "amount": 500, "category": "居住", "account": "微信", "note": "monthly test", "frequency": "monthly", "startDate": "2026-01-31", "endDate": "2026-03-31"}
    status, data = a.call("POST", "/api/recurring", rule); assert status == 201, data
    rid = data["rule"]["id"]
    assert [p["date"] for p in a.call("GET", "/api/recurring")[1]["pending"]] == ["2026-01-31", "2026-02-28", "2026-03-31"]
    assert b.call("PATCH", "/api/recurring", {"id": rid, "action": "confirm", "date": "2026-01-31"})[0] == 404
    assert a.call("PATCH", "/api/recurring", {"id": rid, "action": "confirm", "date": "2026-01-30"})[0] == 400
    request = {"id": rid, "action": "confirm", "date": "2026-01-31"}
    with ThreadPoolExecutor(max_workers=2) as executor:
        result = list(executor.map(lambda _: a.call("PATCH", "/api/recurring", request), range(2)))
    assert all(item[0] == 200 for item in result), result
    records = a.call("GET", "/api/transactions")[1]["transactions"]
    assert len([r for r in records if r["sourceKey"] == f"recurring:{rid}:2026-01-31"]) == 1
    assert a.call("PATCH", "/api/recurring", {"id": rid, "action": "skip", "date": "2026-02-28"})[1]["status"] == "skipped"
    assert a.call("PATCH", "/api/recurring", {"id": rid, "action": "confirm", "date": "2026-02-28"})[1]["status"] == "skipped"
    assert a.call("PATCH", "/api/recurring", {"id": rid, "action": "toggle", "active": False})[0] == 200
    assert a.call("GET", "/api/recurring")[1]["pending"] == []
    assert a.call("PATCH", "/api/recurring", {"id": rid, "action": "toggle", "active": True})[0] == 200
    assert [r["date"] for r in a.call("GET", "/api/recurring")[1]["pending"]] == ["2026-03-31"]
    print("PASS: transfers excluded from income/expense, transfer trash, category budgets, pinned notes/tags/todos, recurring month-end confirmation/skip/pause and concurrent idempotency, cross-account permissions")
finally:
    files = [p for p in Path(".wrangler/state/v3/d1/miniflare-D1DatabaseObject").glob("*.sqlite") if p.name != "metadata.sqlite"]
    assert len(files) == 1
    with sqlite3.connect(files[0], timeout=20) as database:
        for user_id, email in accounts:
            assert database.execute("SELECT email FROM users WHERE id=?", (user_id,)).fetchone() == (email,)
            for table in ("notes", "transactions", "sessions", "user_settings", "transfers", "category_budgets", "recurring_events", "recurring_rules"):
                database.execute("DELETE FROM " + table + " WHERE user_id=?", (user_id,))
            database.execute("DELETE FROM users WHERE id=? AND email=?", (user_id, email))
    print("Disposable advanced-test accounts cleaned up")
