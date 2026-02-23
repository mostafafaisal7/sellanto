"""
Passenger WSGI entry point for cPanel deployment.
This file is loaded by CloudLinux Passenger to serve the Django application.
"""
try:
    import pymysql
    pymysql.install_as_MySQLdb()
except ImportError:
    pass

import sys
import os

INTERP = "/home/movtkisd/virtualenv/abedintechllc.com/3.11/bin/python"
if sys.executable != INTERP:
    os.execl(INTERP, INTERP, *sys.argv)

sys.path.insert(0, '/home/movtkisd/abedintechllc.com')
os.environ['DJANGO_SETTINGS_MODULE'] = 'socialsync.settings'

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
