import os
import re
import json
import sqlite3
import secrets
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path

from flask import Flask, request, jsonify, render_template, redirect, url_for, session, flash, abort, make_response
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("DATABASE_PATH", str(BASE_DIR / "cate_love_surprise.db")))
APP_ENV = os.environ.get("APP_ENV", "development").lower()
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "ChangeMe-123!")
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-this-secret-key")
if APP_ENV == "production" and (not os.environ.get("ADMIN_PASSWORD") or not os.environ.get("SECRET_KEY")):
    raise RuntimeError("Production setup requires ADMIN_PASSWORD and SECRET_KEY environment variables.")
if APP_ENV == "production" and SECRET_KEY == "dev-only-change-this-secret-key":
    raise RuntimeError("Set a strong SECRET_KEY before production deployment.")

app = Flask(__name__)
app.config.update(
    SECRET_KEY=SECRET_KEY,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=(APP_ENV == "production"),
    MAX_CONTENT_LENGTH=2 * 1024 * 1024,
)

def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

def connect_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=20)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    with connect_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            visitor_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            answer TEXT,
            vibe_score INTEGER,
            activities TEXT,
            preferred_date TEXT,
            budget REAL,
            location_preference TEXT,
            date_notes TEXT,
            song_title TEXT,
            song_artist TEXT,
            dedication TEXT,
            letter_reaction TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_responses_created ON responses(created_at DESC);
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            visitor_id TEXT NOT NULL,
            sender TEXT NOT NULL CHECK(sender IN ('visitor','admin')),
            body TEXT NOT NULL,
            created_at TEXT NOT NULL,
            seen INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_messages_visitor ON messages(visitor_id, id);
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        """)
        db.execute("INSERT OR IGNORE INTO settings(key,value) VALUES('admin_password_hash',?)",
                   (generate_password_hash(ADMIN_PASSWORD),))

init_db()

def get_setting(key, default=""):
    with connect_db() as db:
        row = db.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return row["value"] if row else default

def set_setting(key, value):
    with connect_db() as db:
        db.execute("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                   (key, str(value)))

def clean_text(value, limit=1000):
    if value is None:
        return ""
    return str(value).strip()[:limit]

def valid_visitor_id(value):
    value = clean_text(value, 100)
    return value if re.fullmatch(r"[a-fA-F0-9-]{16,100}", value) else None

def csrf_token():
    if "_csrf" not in session:
        session["_csrf"] = secrets.token_urlsafe(24)
    return session["_csrf"]

@app.context_processor
def inject_globals():
    return {"csrf_token": csrf_token, "admin_logged_in": bool(session.get("admin_logged_in"))}

@app.after_request
def security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if request.path.startswith("/api/") or request.path.startswith("/admin"):
        response.headers["Cache-Control"] = "no-store"
    return response

def require_csrf():
    supplied = request.headers.get("X-CSRF-Token") or request.form.get("_csrf")
    if not supplied or not secrets.compare_digest(str(supplied), str(session.get("_csrf", ""))):
        abort(400, description="Your session token expired. Refresh the page and try again.")

def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("admin_logged_in"):
            return redirect(url_for("admin_login"))
        return fn(*args, **kwargs)
    return wrapper

@app.get("/")
def index():
    return render_template("index.html", csrf=csrf_token())

@app.get("/manifest.webmanifest")
def manifest():
    return app.send_static_file("manifest.webmanifest")

@app.get("/sw.js")
def service_worker():
    response = make_response(app.send_static_file("sw.js"))
    response.headers["Service-Worker-Allowed"] = "/"
    response.headers["Cache-Control"] = "no-cache"
    return response

@app.post("/api/response")
def save_response():
    require_csrf()
    data = request.get_json(silent=True) or {}
    visitor_id = valid_visitor_id(data.get("visitor_id"))
    if not visitor_id:
        return jsonify(ok=False, error="Please refresh the page and try again."), 400
    activities = data.get("activities", [])
    if not isinstance(activities, list):
        activities = []
    activities = [clean_text(x, 80) for x in activities[:12]]
    try:
        budget = float(data.get("budget")) if data.get("budget") not in (None, "") else None
        if budget is not None and (budget < 0 or budget > 100000000):
            budget = None
    except (TypeError, ValueError):
        budget = None
    try:
        vibe_score = int(data.get("vibe_score")) if data.get("vibe_score") not in (None, "") else None
        if vibe_score is not None:
            vibe_score = max(0, min(100, vibe_score))
    except (TypeError, ValueError):
        vibe_score = None
    with connect_db() as db:
        db.execute("""INSERT INTO responses
        (visitor_id,created_at,answer,vibe_score,activities,preferred_date,budget,location_preference,date_notes,song_title,song_artist,dedication,letter_reaction)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)""", (
            visitor_id, now_iso(), clean_text(data.get("answer"), 40), vibe_score,
            json.dumps(activities, ensure_ascii=False), clean_text(data.get("preferred_date"), 30),
            budget, clean_text(data.get("location_preference"), 100), clean_text(data.get("date_notes"), 1200),
            clean_text(data.get("song_title"), 160), clean_text(data.get("song_artist"), 160),
            clean_text(data.get("dedication"), 800), clean_text(data.get("letter_reaction"), 100)
        ))
    return jsonify(ok=True, message="Your answer has been saved. Thank you for being honest 💗")

@app.post("/api/messages")
def send_message():
    require_csrf()
    data = request.get_json(silent=True) or {}
    visitor_id = valid_visitor_id(data.get("visitor_id"))
    body = clean_text(data.get("body"), 1500)
    if not visitor_id or not body:
        return jsonify(ok=False, error="Write a message first."), 400
    with connect_db() as db:
        db.execute("INSERT INTO messages(visitor_id,sender,body,created_at) VALUES(?,?,?,?)",
                   (visitor_id, "visitor", body, now_iso()))
    return jsonify(ok=True, message="Your private message was sent.")

@app.get("/api/messages")
def get_messages():
    visitor_id = valid_visitor_id(request.args.get("visitor_id"))
    if not visitor_id:
        return jsonify(ok=False, error="Conversation not found."), 400
    with connect_db() as db:
        rows = db.execute("SELECT sender,body,created_at FROM messages WHERE visitor_id=? ORDER BY id ASC LIMIT 100",
                          (visitor_id,)).fetchall()
    return jsonify(ok=True, messages=[dict(r) for r in rows])

@app.get("/admin/login")
def admin_login():
    if session.get("admin_logged_in"):
        return redirect(url_for("admin_dashboard"))
    return render_template("login.html", csrf=csrf_token())

@app.post("/admin/login")
def admin_login_post():
    require_csrf()
    username = clean_text(request.form.get("username"), 100)
    password = request.form.get("password", "")
    stored_hash = get_setting("admin_password_hash")
    if secrets.compare_digest(username, ADMIN_USERNAME) and stored_hash and check_password_hash(stored_hash, password):
        session.clear()
        session["admin_logged_in"] = True
        session["_csrf"] = secrets.token_urlsafe(24)
        session.permanent = True
        flash("Welcome back. Keep Cate's responses private.", "success")
        return redirect(url_for("admin_dashboard"))
    flash("That username or password did not match.", "error")
    return redirect(url_for("admin_login"))

@app.post("/admin/logout")
@admin_required
def admin_logout():
    require_csrf()
    session.clear()
    return redirect(url_for("admin_login"))

@app.get("/admin")
@admin_required
def admin_dashboard():
    with connect_db() as db:
        responses = db.execute("SELECT * FROM responses ORDER BY id DESC LIMIT 250").fetchall()
        messages = db.execute("SELECT * FROM messages ORDER BY id DESC LIMIT 250").fetchall()
        total_responses = db.execute("SELECT COUNT(*) n FROM responses").fetchone()["n"]
        total_messages = db.execute("SELECT COUNT(*) n FROM messages WHERE sender='visitor'").fetchone()["n"]
        visitors = db.execute("SELECT COUNT(DISTINCT visitor_id) n FROM responses").fetchone()["n"]
    parsed = []
    for r in responses:
        item = dict(r)
        try:
            item["activities_list"] = json.loads(item.get("activities") or "[]")
        except (ValueError, TypeError):
            item["activities_list"] = []
        parsed.append(item)
    return render_template("admin.html", responses=parsed, messages=[dict(m) for m in messages],
                           total_responses=total_responses, total_messages=total_messages, visitors=visitors)

@app.post("/admin/reply")
@admin_required
def admin_reply():
    require_csrf()
    visitor_id = valid_visitor_id(request.form.get("visitor_id"))
    body = clean_text(request.form.get("body"), 1500)
    if not visitor_id or not body:
        flash("Choose a valid conversation and write a reply.", "error")
        return redirect(url_for("admin_dashboard") + "#messages")
    with connect_db() as db:
        db.execute("INSERT INTO messages(visitor_id,sender,body,created_at) VALUES(?,?,?,?)",
                   (visitor_id, "admin", body, now_iso()))
    flash("Private reply sent.", "success")
    return redirect(url_for("admin_dashboard") + "#messages")

@app.post("/admin/change-password")
@admin_required
def admin_change_password():
    require_csrf()
    current = request.form.get("current_password", "")
    new = request.form.get("new_password", "")
    stored_hash = get_setting("admin_password_hash")
    if not stored_hash or not check_password_hash(stored_hash, current):
        flash("Current password was not correct.", "error")
    elif len(new) < 12:
        flash("Use at least 12 characters for the new password.", "error")
    else:
        set_setting("admin_password_hash", generate_password_hash(new))
        flash("Admin password updated.", "success")
    return redirect(url_for("admin_dashboard") + "#security")

@app.get("/admin/export.csv")
@admin_required
def export_csv():
    import csv
    from io import StringIO
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["id","created_at","visitor_id","answer","vibe_score","activities","preferred_date","budget","location_preference","date_notes","song_title","song_artist","dedication","letter_reaction"])
    with connect_db() as db:
        rows = db.execute("SELECT id,created_at,visitor_id,answer,vibe_score,activities,preferred_date,budget,location_preference,date_notes,song_title,song_artist,dedication,letter_reaction FROM responses ORDER BY id DESC").fetchall()
    writer.writerows([list(row) for row in rows])
    response = make_response("\ufeff" + output.getvalue())
    response.headers["Content-Type"] = "text/csv; charset=utf-8"
    response.headers["Content-Disposition"] = "attachment; filename=cate-love-responses.csv"
    return response

@app.errorhandler(400)
def bad_request(error):
    if request.path.startswith("/api/"):
        return jsonify(ok=False, error=getattr(error, "description", "Invalid request.")), 400
    return getattr(error, "description", "Invalid request."), 400

@app.errorhandler(413)
def too_large(_error):
    if request.path.startswith("/api/"):
        return jsonify(ok=False, error="That request is too large."), 413
    return "That request is too large.", 413

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=(APP_ENV != "production"))
