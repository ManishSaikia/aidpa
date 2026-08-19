import logging
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.connection import init_db
from dependencies.auth import get_current_user
from middleware.logging_middleware import LoggingMiddleware
from routers import health, upload, dataset
from routers.chat import router as chat_router
from routers.errors import register_error_handlers
from routers.jobs import router as jobs_router
from routers.query import router as query_router
from routers.agent import router as agent_router
from routers.embed import router as embed_router
from routers.user import router as user_router

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:%(name)s:%(message)s",
)

log = logging.getLogger("aidpa.main")


# ── App lifespan (startup / shutdown) ─────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────────
    init_db()

    postgres_url = os.environ.get("POSTGRES_DIRECT_URL")
    if postgres_url:
        try:
            from db.pg_pool import init_pool
            from services.agent import init_checkpointer
            pool = init_pool()
            init_checkpointer(pool)
        except Exception as exc:
            log.warning(
                "Could not initialise PostgresSaver checkpointer (%s). "
                "Agent will fall back to InMemorySaver — sessions will NOT persist across restarts.",
                exc,
            )
    else:
        log.warning(
            "POSTGRES_DIRECT_URL not set — agent using InMemorySaver (sessions lost on restart). "
            "Add the Supabase direct connection URI (port 5432) to .env to enable persistent sessions."
        )

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    if postgres_url:
        try:
            from db.pg_pool import close_pool
            close_pool()
        except Exception:
            pass


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="AI-Powered Data Pipeline Analyst (aidpa)",
    description="Modularized FastAPI server for analyzing data pipelines.",
    lifespan=lifespan,
)

_ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(LoggingMiddleware)

register_error_handlers(app)

_auth = [Depends(get_current_user)]

app.include_router(health.router)

app.include_router(upload.router,    dependencies=_auth)
app.include_router(dataset.router,   dependencies=_auth)
app.include_router(jobs_router,      dependencies=_auth)
app.include_router(chat_router,      dependencies=_auth)
app.include_router(query_router,     dependencies=_auth)
app.include_router(agent_router,     dependencies=_auth)
app.include_router(embed_router,     dependencies=_auth)
app.include_router(user_router,      dependencies=_auth)


