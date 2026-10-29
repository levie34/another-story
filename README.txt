CATE LOVE SURPRISE — NEXT VERSION
=================================

A romantic + playful + cinematic Flask website with:
- Cinematic love-letter reveal and reaction buttons.
- Three-step interactive treasure hunt.
- Playful four-question vibe score (explicitly just for fun).
- Honest YES / MAYBE / NO choice. NO is never chased, blocked, or pressured.
- Date planner with date, budget in KES, activities, location preference and notes.
- Server-side SQLite response collection. Each submission is a separate row, so later answers do not overwrite earlier ones.
- Private visitor-to-owner messaging, plus replies visible when the visitor returns on the same browser.
- Virtual love companion, animated hearts, and original browser-generated mini melody.
- Song dedications saved with submitted responses.
- Local-only memories gallery and timeline.
- PWA manifest + service worker for installable phone experience and basic offline shell.
- Password-protected admin dashboard, CSV export and admin password change.
- Responsive mobile layout.

IMPORTANT PRIVACY NOTES
-----------------------
1. The page clearly tells visitors that answers and messages are sent to the site owner.
2. Submitted responses, date preferences, song dedications and private messages are stored on the server database.
3. The memories gallery and timeline are stored in that visitor's own browser only. They are NOT uploaded to the server.
4. Private messages are associated with a random browser ID kept in localStorage. They are not end-to-end encrypted and are not suitable for sensitive information. Clearing browser data can lose access to the visitor's thread.
5. This app is a small personal project, not a high-security messaging service. Keep the admin password secret, use HTTPS, and limit access to the dashboard.
6. There are no automatic email notifications configured. Check the dashboard for new submissions/messages.
7. The mini melody is original browser-generated audio. It does not stream commercial songs.

RUN LOCALLY ON WINDOWS / POWERSHELL
-----------------------------------
1. Extract this ZIP to a normal folder.
2. Open PowerShell in that folder.
3. Create a virtual environment:
   python -m venv .venv
4. Activate it:
   .\.venv\Scripts\Activate.ps1
   If PowerShell blocks activation, use:
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   .\.venv\Scripts\Activate.ps1
5. Install packages:
   python -m pip install -r requirements.txt
6. Run:
   python app.py
7. Open http://127.0.0.1:5000

LOCAL ADMIN LOGIN
-----------------
URL: http://127.0.0.1:5000/admin/login
Username: admin
Password: ChangeMe-123!

These default credentials are ONLY for local testing. Change the admin password in the dashboard, and configure strong deployment environment variables before publishing.

DEPLOYMENT (PYTHON HOSTING)
---------------------------
Use a hosting service that supports Python/Flask and persistent disk storage. The exact buttons and free-tier rules depend on the host and may change. A static-only host is not enough for this Flask version because the site needs Python routes and a SQLite database.

Configure these environment variables in your host's dashboard:
- APP_ENV=production
- SECRET_KEY=<a long random secret, different from the admin password>
- ADMIN_USERNAME=<your chosen private username>
- ADMIN_PASSWORD=<a strong password of at least 12 characters>
- DATABASE_PATH=<path on a persistent disk, for example /var/data/cate_love_surprise.db>
- PORT is normally provided by the host; app.py reads it.

Use a persistent disk/volume for DATABASE_PATH if your host offers one. If you use ephemeral storage, the database and saved responses may disappear on redeploy/restart. Do not put credentials in public source code or commit them to GitHub.

For a Gunicorn-capable host, the start command is:
   gunicorn app:app

Set a custom HTTPS domain or use the HTTPS URL provided by the host. HTTPS is important because production session cookies are marked Secure. Once deployed, test the public home page, submit a test response, sign in to /admin/login, confirm the test appears, and remove the test response from your workflow if you don't want it retained. (This version does not include response deletion.)

PHONE INSTALLATION
------------------
Deploy over HTTPS first. On Android, open the deployed website in Chrome and choose the browser menu > Install app or Add to Home screen. On iPhone, open in Safari > Share > Add to Home Screen. Some PWA features vary by browser; install prompts may not appear in every browser. The service worker caches the public shell, not API or admin pages.

DATA / BACKUPS
--------------
The SQLite file is named cate_love_surprise.db when running locally. Back up the database securely. The dashboard CSV export includes browser IDs and visitor-submitted content, so store the export privately and delete it when no longer needed.

TROUBLESHOOTING
---------------
- "Production setup requires..." means set ADMIN_PASSWORD and SECRET_KEY in the hosting environment.
- If responses disappear after a redeploy, check that DATABASE_PATH points to a persistent disk.
- If the browser says a request failed after leaving the page open a long time, refresh the page and submit again.
- If the admin login fails, check ADMIN_USERNAME and ADMIN_PASSWORD. If you changed the password inside the dashboard, use that new password.
- This project uses Flask and Gunicorn. It is not a static-only website.
