import logging

import duckdb
from fastapi import APIRouter
from fastapi.responses import JSONResponse

log = logging.getLogger("aidpa.health")

router = APIRouter(tags=["system"])


@router.get("/health", include_in_schema=True)
def health():
    return {"status": "ok"}


@router.get("/ready", include_in_schema=True)
async def ready():
    checks: dict[str, str] = {}
    all_ok = True

    # ── 1. Postgres ───────────────────────────────────────────────────────────
    try:
        from db.pg_pool import get_pool
        pool = get_pool()
        with pool.connection() as conn:
            conn.execute("SELECT 1")
        checks["postgres"] = "ok"
    except Exception as exc:
        checks["postgres"] = f"error: {str(exc)[:120]}"
        all_ok = False
        log.warning("readiness check | postgres FAILED: %s", exc)

    # ── 2. DuckDB ─────────────────────────────────────────────────────────────
    try:
        conn = duckdb.connect(":memory:")
        conn.execute("SELECT 1")
        conn.close()
        checks["duckdb"] = "ok"
    except Exception as exc:
        checks["duckdb"] = f"error: {str(exc)[:120]}"
        all_ok = False
        log.warning("readiness check | duckdb FAILED: %s", exc)

    # ── 3. Supabase REST ──────────────────────────────────────────────────────
    try:
        from db.pg_connection import get_supabase_client
        sb = get_supabase_client()
        sb.table("datasets").select("dataset_id").limit(0).execute()
        checks["supabase"] = "ok"
    except Exception as exc:
        checks["supabase"] = f"error: {str(exc)[:120]}"
        all_ok = False
        log.warning("readiness check | supabase FAILED: %s", exc)

    status_code = 200 if all_ok else 503
    return JSONResponse(
        content={
            "status": "ready" if all_ok else "not_ready",
            "checks": checks,
        },
        status_code=status_code,
    )
