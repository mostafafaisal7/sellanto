"""
Database utility functions for handling SQLite concurrency issues
"""
import time
import functools
from django.db import OperationalError


def retry_on_db_lock(max_retries=3, initial_delay=0.1, backoff=2):
    """
    Decorator to retry database operations when encountering 'database is locked' errors.

    Args:
        max_retries: Maximum number of retry attempts (default: 3)
        initial_delay: Initial delay in seconds before first retry (default: 0.1s)
        backoff: Multiplier for exponential backoff (default: 2)

    Usage:
        @retry_on_db_lock(max_retries=3)
        def my_database_operation():
            Model.objects.create(...)
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            delay = initial_delay
            last_exception = None

            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except OperationalError as e:
                    last_exception = e
                    if 'database is locked' in str(e).lower() and attempt < max_retries:
                        # Exponential backoff: wait longer with each retry
                        time.sleep(delay)
                        delay *= backoff
                        continue
                    # Re-raise if not a lock error or max retries exceeded
                    raise

            # This should never be reached, but just in case
            raise last_exception

        return wrapper
    return decorator


def safe_model_save(instance, **kwargs):
    """
    Safely save a model instance with automatic retry on database locks.

    Args:
        instance: Django model instance to save
        **kwargs: Additional arguments to pass to save() method

    Example:
        from api.db_utils import safe_model_save
        safe_model_save(brand, update_fields=['website_url'])
    """
    @retry_on_db_lock(max_retries=3)
    def _save():
        instance.save(**kwargs)

    _save()
