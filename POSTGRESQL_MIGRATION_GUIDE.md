# PostgreSQL Migration Guide

This guide explains how to migrate from SQLite to PostgreSQL for production deployment.

## Why Migrate to PostgreSQL?

SQLite has fundamental limitations for production use:

- **File-level locking**: All writes block ALL other database access
- **No concurrent writes**: Only one write operation at a time
- **"Database is locked" errors**: Common with multiple users/requests
- **Limited scalability**: Not designed for web applications with concurrent users

PostgreSQL provides:

✅ **Row-level locking**: Multiple users can write simultaneously
✅ **True concurrency**: Handles thousands of concurrent connections
✅ **ACID compliance**: Production-grade data integrity
✅ **Better performance**: Optimized for web applications
✅ **Advanced features**: Full-text search, JSON fields, etc.

## Prerequisites

- PostgreSQL 12+ installed
- Python package: `psycopg2-binary`

## Installation Steps

### 1. Install PostgreSQL

**Windows:**
```bash
# Download from https://www.postgresql.org/download/windows/
# Or use Chocolatey:
choco install postgresql
```

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Install Python PostgreSQL Driver

```bash
# Activate your virtual environment
source venv/bin/activate  # Linux/macOS
# or
venv\scripts\activate  # Windows

# Install psycopg2
pip install psycopg2-binary
```

### 3. Create PostgreSQL Database and User

```bash
# Access PostgreSQL shell
sudo -u postgres psql  # Linux/macOS
# or
psql -U postgres  # Windows (if PATH is configured)

# In PostgreSQL shell:
CREATE DATABASE sellanto_db;
CREATE USER sellanto_user WITH PASSWORD 'your_secure_password_here';
ALTER ROLE sellanto_user SET client_encoding TO 'utf8';
ALTER ROLE sellanto_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE sellanto_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE sellanto_db TO sellanto_user;

# Exit PostgreSQL shell
\q
```

### 4. Update Environment Variables

Create or update your `.env` file:

```ini
# Database Configuration
DB_ENGINE=postgresql
DB_NAME=sellanto_db
DB_USER=sellanto_user
DB_PASSWORD=your_secure_password_here
DB_HOST=localhost
DB_PORT=5432

# Optional: Keep your other settings
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=True
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key
```

### 5. Migrate Database Schema

```bash
# Run Django migrations
python manage.py migrate

# Create a superuser
python manage.py createsuperuser
```

### 6. (Optional) Migrate Existing SQLite Data

If you have existing data in SQLite that you want to preserve:

```bash
# Export data from SQLite
python manage.py dumpdata --natural-foreign --natural-primary \
    -e contenttypes -e auth.Permission \
    --indent 2 > data_backup.json

# Switch to PostgreSQL (update .env)
# Then load the data
python manage.py loaddata data_backup.json
```

**Note**: This approach may have issues with primary keys. For production migrations, consider using [django-dumpdata-plus](https://pypi.org/project/django-dumpdata-plus/) or manual migration scripts.

### 7. Verify the Migration

```bash
# Start the development server
python manage.py runserver

# Test database connectivity
python manage.py dbshell
# Should connect to PostgreSQL, not SQLite
\dt  # List tables
\q   # Exit
```

## Configuration Details

Your `settings.py` already has PostgreSQL configuration (lines 134-152):

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='sellanto_db'),
        'USER': config('DB_USER', default='sellanto_user'),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
        'ATOMIC_REQUESTS': True,  # ✅ Safe with PostgreSQL
        'CONN_MAX_AGE': 600,  # Connection pooling (10 minutes)
        'OPTIONS': {
            'connect_timeout': 10,
            'options': '-c default_transaction_isolation=read committed',
        },
    }
}
```

## Troubleshooting

### Issue: `psycopg2` installation fails

**Solution**: Install build dependencies

```bash
# Ubuntu/Debian
sudo apt-get install python3-dev libpq-dev

# macOS
brew install postgresql

# Then retry
pip install psycopg2-binary
```

### Issue: Can't connect to PostgreSQL

**Solution**: Check PostgreSQL is running

```bash
# Linux
sudo systemctl status postgresql

# macOS
brew services list

# Windows
# Check Services app or Task Manager for "postgresql" service
```

**Solution**: Verify `pg_hba.conf` allows local connections

Edit `/etc/postgresql/[version]/main/pg_hba.conf` (Linux) or equivalent:

```
# Allow local connections with password
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
```

Then restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### Issue: Migration errors

**Solution**: Drop and recreate the database

```bash
sudo -u postgres psql
DROP DATABASE sellanto_db;
CREATE DATABASE sellanto_db;
GRANT ALL PRIVILEGES ON DATABASE sellanto_db TO sellanto_user;
\q

python manage.py migrate
```

## Performance Tuning (Production)

For production deployments, add these settings to `.env`:

```ini
# Production PostgreSQL settings
DB_CONN_MAX_AGE=600  # Connection pooling (10 minutes)
DB_CONN_HEALTH_CHECKS=True  # Verify connections before use
```

And update `settings.py`:

```python
DATABASES = {
    'default': {
        # ... existing config ...
        'CONN_MAX_AGE': config('DB_CONN_MAX_AGE', default=600, cast=int),
        'CONN_HEALTH_CHECKS': config('DB_CONN_HEALTH_CHECKS', default=True, cast=bool),
    }
}
```

## Rollback to SQLite (Development Only)

If you need to switch back to SQLite:

```ini
# .env
DB_ENGINE=sqlite
# or remove the DB_ENGINE variable entirely (defaults to sqlite)
```

```bash
python manage.py migrate
```

## Benefits After Migration

After migrating to PostgreSQL, you will notice:

✅ **No more "database is locked" errors**
✅ **Faster response times** under load
✅ **Support for concurrent users** without blocking
✅ **Production-ready data integrity**
✅ **Scalability** for growth

## Support

For issues or questions:
- Django PostgreSQL docs: https://docs.djangoproject.com/en/stable/ref/databases/#postgresql-notes
- PostgreSQL docs: https://www.postgresql.org/docs/
- Project issues: Create an issue in the repository

---

**Last Updated**: 2026-04-17
**Django Version**: 6.0.3
**PostgreSQL Version**: 12+
