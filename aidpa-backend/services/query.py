import concurrent.futures
import math
import sqlglot
import sqlglot.expressions as exp
from typing import Any

from db.connection import DB_PATH, get_ro_connection

import duckdb as _duckdb   # used inside thread-local helpers

_SQL_TIMEOUT_SECONDS = 30

# ── Validation ────────────────────────────────────────────────────────────────

def _validate_sql(sql: str) -> None:
    try:
        statements = sqlglot.parse(sql, dialect="duckdb")
    except sqlglot.errors.ParseError as exc:
        raise ValueError(f"SQL parse error: {exc}") from exc

    if not statements:
        raise ValueError("No SQL statement provided.")

    if len(statements) > 1:
        raise ValueError(
            f"Only a single SELECT statement is permitted. "
            f"Received {len(statements)} statements."
        )

    statement = statements[0]

    if not isinstance(statement, exp.Select):
        kind = type(statement).__name__
        raise ValueError(
            f"Only SELECT statements are permitted. Received: {kind}"
        )


# ── Pagination helpers ────────────────────────────────────────────────────────

def _paginate(sql: str, page: int, page_size: int) -> str:
    offset = (page - 1) * page_size
    return (
        f"SELECT * FROM ({sql}) _paginated_result "
        f"LIMIT {page_size} OFFSET {offset}"
    )


def _count_sql(sql: str) -> str:
    return f"SELECT COUNT(*) FROM ({sql}) _count_subquery"



def _run_count_and_page(sql: str, page_sql: str) -> tuple[int, list, list]:
    conn = _duckdb.connect(DB_PATH, read_only=True)
    try:
        total_count: int = conn.execute(_count_sql(sql)).fetchone()[0]
        cursor = conn.execute(page_sql)
        description = cursor.description
        rows = cursor.fetchall()
        return total_count, description, rows
    finally:
        conn.close()


def _run_query(sql: str) -> tuple[list, list]:
    conn = _duckdb.connect(DB_PATH, read_only=True)
    try:
        cursor = conn.execute(sql)
        return cursor.description, cursor.fetchall()
    finally:
        conn.close()


# ── Public execution functions ────────────────────────────────────────────────

def execute_paginated_query(
    sql: str,
    page: int = 1,
    page_size: int = 100,
) -> dict[str, Any]:
    _validate_sql(sql)
    page_sql = _paginate(sql, page, page_size)

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(_run_count_and_page, sql, page_sql)
        try:
            total_count, description, rows = future.result(
                timeout=_SQL_TIMEOUT_SECONDS
            )
        except concurrent.futures.TimeoutError:
            raise TimeoutError(
                f"SQL query exceeded {_SQL_TIMEOUT_SECONDS}s. "
                "Try a more specific question or add filters."
            )

    columns = [d[0] for d in description]
    total_pages = max(1, math.ceil(total_count / page_size))

    return {
        "columns":     columns,
        "rows":        [dict(zip(columns, row)) for row in rows],
        "row_count":   len(rows),
        "total_count": total_count,
        "page":        page,
        "page_size":   page_size,
        "total_pages": total_pages,
    }


def execute_query(sql: str) -> list[dict[str, Any]]:
    _validate_sql(sql)

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(_run_query, sql)
        try:
            description, rows = future.result(timeout=_SQL_TIMEOUT_SECONDS)
        except concurrent.futures.TimeoutError:
            raise TimeoutError(
                f"SQL query exceeded {_SQL_TIMEOUT_SECONDS}s. "
                "Try a more specific question or add filters."
            )

    columns = [d[0] for d in description]
    return [dict(zip(columns, row)) for row in rows]
