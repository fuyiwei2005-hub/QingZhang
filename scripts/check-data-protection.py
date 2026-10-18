"""Exercise deployment APIs using disposable accounts and remove only those accounts."""
import http.client
import json
import secrets
import socket
import sqlite3
import ssl
import uuid
from http.cookies import SimpleCookie
from pathlib import Path

class LocalTLS(http.client.HTTPSConnection):
    def connect(self):
        raw = socket.create_connection(("127.0.0.1", 443), 15)
        self.sock = self._context.wrap_socket(raw, server_hostname=self.host)

class Client:
    def __init__(self):
        self.cookie = ""
    def call(self, method, path, body=None):
        connection = LocalTLS("47.117.66.214", context=ssl.create_default_context(), timeout=20)
        headers = {"Content-Type": "application/json"}
        if self.cookie:
            headers["Cookie"] = self.cookie
        connection.request(method, "/qingzhang" + path, json.dumps(body) if body is not None else None, headers)
        response = connection.getresponse()
        status = response.status
        header = response.getheader("Set-Cookie", "")
        data = json.loads(response.read())
        if header:
            parsed = SimpleCookie(); parsed.load(header)
            self.cookie = "qingzhang_session=" + parsed["qingzhang_session"].value
        connection.close()
        return status, data

accounts = []
try:
    anonymous = Client()
    for endpoint in ("/api/settings", "/api/trash", "/api/transactions", "/api/notes"):
        assert anonymous.call("GET", endpoint)[0] == 401
    clients = []
    for _ in range(2):
        client = Client()
        email = "data-check-" + uuid.uuid4().hex + "@example.invalid"
        status, data = client.call("POST", "/api/auth/register", {"name": "Test account", "email": email, "password": secrets.token_urlsafe(24)})
        assert status == 201, (status, data)
        accounts.append((data["user"]["id"], email))
        clients.append(client)
    a, b = clients
    assert a.call("GET", "/api/settings")[1]["monthlyBudget"] is None
    assert a.call("POST", "/api/settings", {"monthlyBudget": 2000.12})[1]["monthlyBudget"] == 2000.12
    assert a.call("POST", "/api/settings", {"monthlyBudget": 9999})[1]["monthlyBudget"] == 2000.12
    assert a.call("PUT", "/api/settings", {"monthlyBudget": 3500.25})[1]["monthlyBudget"] == 3500.25
    assert a.call("GET", "/api/settings")[1]["monthlyBudget"] == 3500.25
    assert b.call("GET", "/api/settings")[1]["monthlyBudget"] is None
    for value in (0, -1, "2000", 0.001, 1000000001):
        assert a.call("PUT", "/api/settings", {"monthlyBudget": value})[0] == 400
    status, data = a.call("POST", "/api/transactions", {"type": "expense", "amount": 12.35, "category": "餐饮", "account": "微信", "note": "disposable", "occurredAt": "2026-10-15T12:00:00Z"})
    assert status == 201
    transaction_id = data["transaction"]["id"]
    assert a.call("DELETE", "/api/transactions?id=" + str(transaction_id))[0] == 200
    assert a.call("DELETE", "/api/transactions?id=" + str(transaction_id))[0] == 200
    assert not a.call("GET", "/api/transactions")[1]["transactions"]
    assert any(row["id"] == transaction_id for row in a.call("GET", "/api/trash")[1]["transactions"])
    assert not b.call("GET", "/api/trash")[1]["transactions"]
    assert b.call("POST", "/api/trash", {"kind": "transaction", "id": transaction_id})[0] == 404
    assert a.call("POST", "/api/trash", {"kind": "transaction", "id": transaction_id})[0] == 200
    assert a.call("GET", "/api/transactions")[1]["transactions"][0]["amount"] == 12.35
    assert a.call("POST", "/api/trash", {"kind": "transaction", "id": transaction_id})[0] == 404
    status, data = a.call("POST", "/api/notes", {"title": "disposable", "content": "restore content"})
    assert status == 201
    note_id = data["note"]["id"]
    assert a.call("DELETE", "/api/notes?id=" + str(note_id))[0] == 200
    assert not a.call("GET", "/api/notes")[1]["notes"]
    assert a.call("PUT", "/api/notes?id=" + str(note_id), {"title": "changed", "content": "blocked"})[0] == 404
    assert b.call("POST", "/api/trash", {"kind": "note", "id": note_id})[0] == 404
    assert a.call("POST", "/api/trash", {"kind": "note", "id": note_id})[0] == 200
    assert a.call("GET", "/api/notes")[1]["notes"][0]["content"] == "restore content"
    print("PASS: authentication, budget persistence and validation, initialization races, account isolation, soft delete and restore for notes and transactions")
finally:
    files = [p for p in Path(".wrangler/state/v3/d1/miniflare-D1DatabaseObject").glob("*.sqlite") if p.name != "metadata.sqlite"]
    assert len(files) == 1
    with sqlite3.connect(files[0], timeout=20) as database:
        for user_id, email in accounts:
            assert database.execute("SELECT email FROM users WHERE id=?", (user_id,)).fetchone() == (email,)
            for table in ("notes", "transactions", "sessions", "user_settings"):
                database.execute("DELETE FROM " + table + " WHERE user_id=?", (user_id,))
            database.execute("DELETE FROM users WHERE id=? AND email=?", (user_id, email))
    print("Disposable test accounts cleaned up")
