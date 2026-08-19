import duckdb
from contextlib import contextmanager
from pathlib import Path

DB_PATH = str(Path(__file__).parent / "aidpa.db")

@contextmanager
def get_db_connection():
    conn = duckdb.connect(DB_PATH)
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def get_ro_connection():
    conn = duckdb.connect(DB_PATH, read_only=True)
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    """Initialise DuckDB tables.

    Note: chat sessions (previously `agent_sessions`) have been moved to
    Supabase. Run db/migrations/002_chat_sessions.sql in the Supabase SQL
    editor once. DuckDB now stores only data tables (ds_{id}).
    """
    pass  # no DuckDB-managed tables remain
