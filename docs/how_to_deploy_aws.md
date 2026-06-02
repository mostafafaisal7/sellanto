# AWS Lightsail Deployment Guide (Follow for Every New Branch Deployment)

This guide deploys a new branch onto the **already–provisioned** Lightsail server
(instance `SaleAnto`, `13.134.91.192`, London). The server is fully set up: Python
virtualenv, Gunicorn, the `sellanto` systemd service, nginx (TLS termination), and MySQL.
You are only **updating code** on it — not building the server from scratch.

Domain served: **abedintechllc.com**.

---

## How configuration actually works (read once)

- There is **no `settings_prod.py`** in this repo. Configuration is driven by a **`.env`** file
  on the server, read via `python-decouple` in `socialsync/settings.py`.
- DB credentials, `DJANGO_DEBUG`, `DJANGO_SECRET_KEY`, email, Stripe, OAuth keys, Celery URLs
  → all come from `.env` (or `.env.production`).
- `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` are **hardcoded lists in
  `socialsync/settings.py`**. You only edit these if the branch introduces a new domain/host.
- `.env` is **not** tracked by git, so `git pull` never overwrites your production values.

---

## Before you start: check what the branch actually changes

On your local machine, diff the new branch against the currently-deployed branch so you know
which steps are mandatory:

```bash
BASE=<currently-deployed-branch>     # e.g. features/swapnil-v3.2
NEW=<branch-to-deploy>               # e.g. features/swapnil-v3.4

git diff --name-only --diff-filter=A $BASE..$NEW -- "*/migrations/*.py"   # new migrations?  -> migrate required
git diff --stat $BASE..$NEW -- requirements.txt requirements_postgresql.txt  # deps changed? -> pip install required
git diff --stat $BASE..$NEW -- socialsync/settings.py                     # settings changed? -> review ALLOWED_HOSTS/CORS/CSRF/DB
git diff --stat $BASE..$NEW -- frontend/package.json frontend/package-lock.json  # frontend deps changed? -> npm install required
```

Any change under `frontend/src/**` means a `npm run build` + `collectstatic` is required.
Backend code changes always require a `sellanto` (Gunicorn) restart.

---

## Deployment steps (run on the server over SSH, one at a time)

SSH in via the Lightsail console terminal, or `ssh -i <key.pem> bitnami@13.134.91.192`.
Paths below assume `~/sellanto` and `~/venv` — adjust if your server differs.

### 0. (Recommended) Back up the database before migrating

```bash
mysqldump -u <DB_USER> -p <DB_NAME> > ~/backup_before_deploy_$(date +%F).sql
```
`<DB_USER>` / `<DB_NAME>` come from `~/sellanto/.env`.

### 1. Activate the virtualenv and go to the project

```bash
source ~/venv/bin/activate
cd ~/sellanto
```

### 2. Fetch and switch to the target branch

```bash
git fetch origin
git checkout <branch_name>
git pull origin <branch_name>
```
If you get *"local changes would be overwritten"*, run `git status` first to see what was changed
on the server. Stash with `git stash` only if you understand the change — never silently discard
production edits.

### 3. Verify configuration (usually no change needed)

- If `socialsync/settings.py` was **not** changed by this branch and the domain is the same,
  you do not need to edit anything.
- Confirm `~/sellanto/.env` still holds correct production values:
  - `DJANGO_DEBUG=False`
  - `DJANGO_SECRET_KEY=...` (strong production key)
  - `DB_ENGINE`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`
- Only if the branch adds a new domain/host: update `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`,
  and `CSRF_TRUSTED_ORIGINS` in `socialsync/settings.py`.

### 4. Install/update dependencies (only if requirements changed)

```bash
pip install -r requirements.txt
```
Skip if `requirements.txt` was unchanged by the branch (harmless to run regardless).

### 5. Run migrations (required if the branch adds migrations)

```bash
python manage.py migrate --settings=socialsync.settings
```
**If migrations fail, stop here and fix the issue before restarting the service.**

### 6. Build the frontend (required if `frontend/src/**` changed)

```bash
cd frontend
npm install        # only if package.json / package-lock.json changed
npm run build      # outputs to frontend/dist (Vite, base path '/static/')
cd ..
```

### 7. Collect static files

```bash
python manage.py collectstatic --noinput --settings=socialsync.settings
```

### 8. Restart the application service (Gunicorn)

```bash
sudo systemctl restart sellanto
```

### 9. Restart the Celery worker (if the branch touches async tasks)

`video_studio` / `ai_video` features run on Celery + Redis. If a Celery worker service exists,
restart it too:

```bash
systemctl list-units --type=service | grep -iE 'celery|redis'   # discover service names
sudo systemctl restart <celery-service-name>                     # e.g. sellanto-celery
sudo systemctl status redis                                      # confirm Redis is running
```
If no Celery worker service exists, background video generation will not run — make sure that
is expected before relying on those features.

---

## Final verification

```bash
sudo systemctl status sellanto        # must be active (running)
```
- Open `https://abedintechllc.com` — confirm the site loads and login works.
- Smoke-test the branch's new features.
- On error, check logs:
  ```bash
  sudo journalctl -u sellanto -n 100 --no-pager
  tail -n 100 ~/sellanto/django.log
  ```
- A 502/Bad Gateway means Gunicorn failed to start — read the `journalctl` traceback.

---

## Rollback

```bash
cd ~/sellanto
git checkout <previous-branch>        # e.g. features/swapnil-v3.2
python manage.py migrate --settings=socialsync.settings
cd frontend && npm run build && cd ..
python manage.py collectstatic --noinput --settings=socialsync.settings
sudo systemctl restart sellanto
```
If a migration corrupted data/schema, restore from the `mysqldump` backup taken in step 0.

---

## Notes

- Replace `<branch_name>` / `<previous-branch>` with the actual branch names.
- Configuration lives in `.env` (there is no `settings_prod.py`).
- `ALLOWED_HOSTS` / `CORS` / `CSRF` are edited in `settings.py` only when a new domain is added.
- Make sure the frontend build completes successfully before collectstatic.
- If migrations fail, stop and fix before restarting the service.
