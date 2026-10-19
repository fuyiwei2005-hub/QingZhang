"""Wheel API checks with disposable accounts; run from project root on the chosen server."""
import argparse
import http.cookiejar
import json
import secrets
import sqlite3
import uuid
import urllib.request
import urllib.error
from pathlib import Path
parser = argparse.ArgumentParser()
parser.add_argument("--base-url", default="http://127.0.0.1:5175")
args = parser.parse_args()
class Client:
    def __init__(self):
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def call(self, method, path, body=None):
        request = urllib.request.Request(args.base_url.rstrip("/") + path, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json"}, method=method)
        try:
            with self.opener.open(request, timeout=20) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)
accounts = []
try:
    assert Client().call("GET", "/api/wheels")[0] == 401
    clients = []
    for _ in range(2):
        client = Client()
        email = "wheel-check-" + uuid.uuid4().hex + "@example.invalid"
        status, data = client.call("POST", "/api/auth/register", {"name": "Wheel test", "email": email, "password": secrets.token_urlsafe(24)})
        assert status == 201, (status, data)
        accounts.append((data["user"]["id"], email)); clients.append(client)
    a, b = clients
    payload = {"title": "Dinner", "options": ["Rice", "Noodles", "Soup"]}
    status, data = a.call("POST", "/api/wheels", payload)
    assert status == 201, (status, data)
    wheel_id = data["wheel"]["id"]
    assert a.call("GET", "/api/wheels")[1]["wheels"][0]["options"] == payload["options"]
    assert b.call("GET", "/api/wheels")[1]["wheels"] == []
    assert b.call("PUT", f"/api/wheels?id={wheel_id}", payload)[0] == 404
    assert b.call("DELETE", f"/api/wheels?id={wheel_id}")[0] == 404
    assert a.call("POST", "/api/wheels", {"title": "A", "options": ["A"]})[0] == 400
    updated = {"title": "New title", "options": ["A", "B"]}
    assert a.call("PUT", f"/api/wheels?id={wheel_id}", updated)[0] == 200
    assert a.call("GET", "/api/wheels")[1]["wheels"][0]["title"] == "New title"
    assert a.call("POST", "/api/wheels", payload)[0] == 201
    assert len(a.call("GET", "/api/wheels")[1]["wheels"]) == 2
    assert a.call("DELETE", f"/api/wheels?id={wheel_id}")[0] == 200
    assert len(a.call("GET", "/api/wheels")[1]["wheels"]) == 1
    print("PASS: wheel CRUD, multiple saved wheels, validation and account isolation")
finally:
    files = [p for p in Path(".wrangler/state/v3/d1/miniflare-D1DatabaseObject").glob("*.sqlite") if p.name != "metadata.sqlite"]
    assert len(files) == 1, "Run from project root with the target instance database"
    with sqlite3.connect(files[0], timeout=20) as database:
        for user_id, email in accounts:
            assert database.execute("SELECT email FROM users WHERE id=?", (user_id,)).fetchone() == (email,)
            for table in ("wheels", "sessions"):
                database.execute("DELETE FROM " + table + " WHERE user_id=?", (user_id,))
            database.execute("DELETE FROM users WHERE id=? AND email=?", (user_id, email))
    print("Disposable test accounts cleaned up")
