# 🚀 Quick Start Guide - After Data Leakage Fix

## For Immediate Development Testing

The critical security fixes are now in place! You can start developing immediately with SQLite.

---

## ✅ What's Fixed

- ✅ **Duplicate signal handler removed** - No more race conditions in user creation
- ✅ **Row-level locking added** - Diamond wallet operations are now ACID-compliant
- ✅ **Atomic transactions enabled** - All database operations wrapped in transactions
- ✅ **Security monitoring active** - Middleware detects cross-user data leakage
- ✅ **Environment-based database config** - Easy switch between SQLite and PostgreSQL

---

## 🏃 Start Development Server (SQLite)

The system now defaults to SQLite for development. Just run:

```bash
# No additional setup needed!
python manage.py runserver
```

**That's it!** The server will use SQLite automatically.

---

## 🔧 Configuration Options

### Option 1: SQLite (Current Default - No Setup Required)

✅ **Already configured** - Just run the server
- File: `db.sqlite3` in project root
- No additional packages needed
- Perfect for development and testing
- ⚠️ **Not safe for production** with concurrent users

### Option 2: PostgreSQL (For Production or Testing Production Config)

If you want to test with PostgreSQL locally:

```bash
# 1. Install PostgreSQL adapter
pip install psycopg2-binary

# 2. Install PostgreSQL server (if not already installed)
# Windows: Download from https://www.postgresql.org/download/windows/
# Mac: brew install postgresql
# Linux: sudo apt-get install postgresql

# 3. Create database
psql -U postgres
CREATE DATABASE sellanto_db;
CREATE USER sellanto_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE sellanto_db TO sellanto_user;
\q

# 4. Update .env file (create from .env.example)
DB_ENGINE=postgresql
DB_NAME=sellanto_db
DB_USER=sellanto_user
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

# 5. Run migrations
python manage.py migrate

# 6. Start server
python manage.py runserver
```

---

## 📋 First-Time Setup Checklist

### If This Is Your First Time Running After the Fix:

1. **Run migrations** (if not already done):
   ```bash
   python manage.py migrate
   ```

2. **Start the server**:
   ```bash
   python manage.py runserver
   ```

3. **Test user creation**:
   - Open browser: http://localhost:8000
   - Create a test account
   - Verify you see your own data (not someone else's!)

4. **Check security logs** (optional):
   ```bash
   tail -f security.log
   ```

---

## ✅ Verify the Fixes Are Working

### Test 1: Create Multiple Users Quickly

```bash
# In one terminal
curl -X POST http://localhost:8000/api/v1/auth/register-with-brand/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser1",
    "email": "test1@example.com",
    "password": "TestPass123!",
    "password_confirm": "TestPass123!",
    "brand_name": "Brand 1",
    "industry": "Tech",
    "target_region": "US",
    "voice_tone": "professional"
  }'

# In another terminal (run immediately)
curl -X POST http://localhost:8000/api/v1/auth/register-with-brand/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser2",
    "email": "test2@example.com",
    "password": "TestPass123!",
    "password_confirm": "TestPass123!",
    "brand_name": "Brand 2",
    "industry": "Finance",
    "target_region": "UK",
    "voice_tone": "formal"
  }'
```

**Expected Result:**
- Both users created successfully
- Each user has their own correct data
- No cross-contamination

### Test 2: Run Load Test (Optional)

```bash
# Install aiohttp for load testing
pip install aiohttp

# Run concurrent user creation test
python test_concurrent_user_creation.py --users 10 --concurrent 5

# Expected: 0 data leakage issues
```

---

## 🔍 Monitoring

### Check Security Logs

The system now logs security events to `security.log`:

```bash
# Watch security events in real-time
tail -f security.log

# Check for data leakage warnings
grep "DATA LEAKAGE" security.log

# Check for concurrent registration patterns
grep "CONCURRENT REGISTRATION" security.log
```

**What to look for:**
- ✅ Normal: Impersonation logs (if using admin features)
- ✅ Normal: Concurrent registration notices (< 10/day)
- 🚨 **ALERT**: "POTENTIAL DATA LEAKAGE" messages → investigate immediately

---

## 🐛 Troubleshooting

### Issue: "ModuleNotFoundError: No module named 'psycopg2'"

**Solution:** You don't need PostgreSQL for development. The system defaults to SQLite.

If you see this error, it means `DB_ENGINE=postgresql` is set in your `.env` file.

**Fix:**
1. Remove or comment out `DB_ENGINE=postgresql` from `.env`
2. Or set `DB_ENGINE=sqlite` explicitly
3. Restart server

### Issue: "django.db.utils.OperationalError: unable to open database file"

**Solution:** Run migrations first:
```bash
python manage.py migrate
```

### Issue: Migration conflicts

**Solution:** Check migration status:
```bash
python manage.py showmigrations

# If there are conflicts, reset migrations (development only!)
# ⚠️ WARNING: This deletes all data!
rm db.sqlite3
python manage.py migrate
```

---

## 🚀 Production Deployment

When ready to deploy to production:

1. **Review:** `CRITICAL_DATA_LEAKAGE_FIX_DEPLOYMENT.md`
2. **Set up PostgreSQL** (required for production)
3. **Update `.env`** with `DB_ENGINE=postgresql`
4. **Install:** `pip install psycopg2-binary`
5. **Run migrations:** `python manage.py migrate`
6. **Test:** Run load tests in staging first
7. **Deploy:** Follow deployment checklist
8. **Monitor:** Watch `security.log` for 24 hours

---

## 📚 Additional Resources

- **[DATA_LEAKAGE_FIX_SUMMARY.md](DATA_LEAKAGE_FIX_SUMMARY.md)** - Executive summary
- **[CRITICAL_DATA_LEAKAGE_FIX_DEPLOYMENT.md](CRITICAL_DATA_LEAKAGE_FIX_DEPLOYMENT.md)** - Full deployment guide
- **[USER_DATA_ISOLATION_BEST_PRACTICES.md](USER_DATA_ISOLATION_BEST_PRACTICES.md)** - Coding guidelines

---

## ✅ Development Workflow

```bash
# Daily development workflow:

# 1. Start server
python manage.py runserver

# 2. Make changes to code

# 3. Run tests (if you have them)
python manage.py test

# 4. Check security logs occasionally
tail -f security.log

# 5. Before committing, verify no regressions
python test_concurrent_user_creation.py --users 5 --concurrent 3
```

---

## 🎉 You're Ready!

The critical security fixes are in place and the system is ready for development.

**For development:** Use SQLite (default, no setup)
**For production:** Use PostgreSQL (see deployment guide)

All the critical fixes work with **both** databases:
- ✅ No duplicate signal handlers
- ✅ Atomic transactions
- ✅ Row-level locking
- ✅ Security monitoring

**Start coding!** 🚀
