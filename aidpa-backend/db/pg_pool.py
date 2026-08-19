import logging
import os

from psycopg_pool import ConnectionPool

log = logging.getLogger("aidpa.pg_pool")

_pool: ConnectionPool | None = None


def init_pool() -> ConnectionPool:
    global _pool
    url = os.environ.get("POSTGRES_DIRECT_URL")
    if not url:
        raise RuntimeError(
            "POSTGRES_DIRECT_URL is not set. "
            "Add the Supabase direct connection URI (port 5432) to .env."
        )
    _pool = ConnectionPool(
        conninfo=url,
        min_size=1,
        max_size=10,
        open=True,
        kwargs={"autocommit": True},
    )
    log.info("pg_pool: connection pool opened (min=1, max=10).")
    return _pool


def get_pool() -> ConnectionPool:
    if _pool is None:
        raise RuntimeError(
            "Connection pool is not initialised. "
            "Ensure init_pool() is called in the app lifespan startup."
        )
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        log.info("pg_pool: connection pool closed.")
        _pool = None

