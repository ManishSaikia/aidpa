import logging
import os
from typing import Any, Dict

from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent

from services.agent_tools import build_tools
from services.analysis_result import build_analysis_result
from services.storage import get_upload

log = logging.getLogger("aidpa.agent")

_MAX_CONTEXT_CHARS = 8000
_MODEL = "gemini-3.1-flash-lite"


_checkpointer = None


def init_checkpointer(pool) -> None:
    global _checkpointer
    from langgraph.checkpoint.postgres import PostgresSaver
    saver = PostgresSaver(pool)
    saver.setup()        # must succeed -- tables created before we accept requests
    _checkpointer = saver  # only assigned after a successful setup()
    log.info("Agent checkpointer: PostgresSaver initialised.")


def _get_checkpointer():
    if _checkpointer is not None:
        return _checkpointer
    from langgraph.checkpoint.memory import InMemorySaver
    log.warning(
        "PostgresSaver not initialised — falling back to InMemorySaver. "
        "Set POSTGRES_DIRECT_URL in .env for persistent sessions."
    )
    return InMemorySaver()


# ── Agent cache (compiled graph, in-memory per process) ───────────────────────

_agent_cache: Dict[str, Any] = {}


def _build_system_prompt(filename: str, column_names: list) -> str:
    col_list = ", ".join(column_names[:60])
    if len(column_names) > 60:
        col_list += f" ... and {len(column_names) - 60} more"
    return (
        f"You are an expert data analyst assistant. "
        f"You are analysing the dataset '{filename}'.\n\n"
        f"Available columns:\n{col_list}\n\n"
        "You have three tools:\n"
        "  • run_sql        — execute a DuckDB SELECT query\n"
        "  • get_column_stats — get mean, std, nulls, top values for one column\n"
        "  • detect_anomalies — find statistical outliers in a numeric column\n\n"
        "Always use tools to retrieve data before answering. "
        "Do not invent statistics. "
        "After receiving tool results, give a concise, plain-English answer.\n\n"
        "IMPORTANT — tool argument formatting:\n"
        "  • Do NOT escape single quotes in SQL strings. "
        "Write ILIKE '%value%' not ILIKE \\'%value%\\'.\n"
        "  • Single quotes never need escaping inside JSON strings."
    )


def _get_or_build_agent(dataset_id: str):
    if dataset_id in _agent_cache:
        return _agent_cache[dataset_id]

    upload = get_upload(dataset_id)
    if upload is None:
        raise ValueError(f"Dataset '{dataset_id}' not found.")

    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set in .env")

    analysis = build_analysis_result(dataset_id)
    column_names = list(analysis.columns.keys())

    llm = ChatGoogleGenerativeAI(
        model=_MODEL,
        google_api_key=api_key,
    )

    tools = build_tools(dataset_id)
    system_prompt = _build_system_prompt(upload["filename"], column_names)

    agent = create_react_agent(
        model=llm,
        tools=tools,
        checkpointer=_get_checkpointer(),
        prompt=system_prompt,
    )

    _agent_cache[dataset_id] = agent
    log.info("Agent built | dataset=%s | columns=%d", dataset_id, len(column_names))
    return agent


def _build_long_term_context(question: str, dataset_id: str, user_id: str | None = None) -> str:
    try:
        from services.vector_store import search_by_question
        results = search_by_question(
            question, top_k=3,
            exclude_dataset_id=dataset_id,
            user_id=user_id,
        )
    except Exception as exc:
        log.debug("Long-term memory retrieval skipped: %s", exc)
        return ""

    if not results:
        return ""

    _SIMILARITY_THRESHOLD = 0.75
    results = [r for r in results if r["similarity"] >= _SIMILARITY_THRESHOLD]

    if not results:
        log.debug(
            "Long-term memory: all results below threshold (%.2f) — skipping context injection.",
            _SIMILARITY_THRESHOLD,
        )
        return ""

    lines = ["Relevant past dataset analyses (for context):\n"]
    total_chars = 0

    for i, r in enumerate(results, 1):
        sim = round(r["similarity"], 3)
        header = f"{i}. {r['filename']} (similarity: {sim}):\n"
        digest_snippet = r["text_digest"]

        remaining = _MAX_CONTEXT_CHARS - total_chars - len(header)
        if remaining <= 0:
            break
        if len(digest_snippet) > remaining:
            digest_snippet = digest_snippet[:remaining] + "..."

        block = header + digest_snippet + "\n"
        lines.append(block)
        total_chars += len(block)

    lines.append("---\n")
    return "\n".join(lines)


def run_agent(session_id: str, dataset_id: str, question: str, user_id: str | None = None) -> str:
    agent = _get_or_build_agent(dataset_id)
    config = {"configurable": {"thread_id": session_id}}

    long_term_ctx = _build_long_term_context(question, dataset_id, user_id=user_id)
    augmented_question = (
        long_term_ctx + "Your question: " + question
        if long_term_ctx
        else question
    )

    log.info(
        "Agent turn | session=%s dataset=%s user=%s | question=%r | ctx_chars=%d",
        session_id, dataset_id, user_id, question, len(long_term_ctx),
    )

    result = agent.invoke(
        {"messages": [{"role": "user", "content": augmented_question}]},
        config,
    )

    final_message = result["messages"][-1]
    raw_content = final_message.content if hasattr(final_message, "content") else str(final_message)

    if isinstance(raw_content, list):
        answer = "".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in raw_content
        )
    else:
        answer = raw_content

    log.info("Agent turn complete | session=%s | answer_len=%d", session_id, len(answer))
    return answer


def clear_session(session_id: str) -> None:
    cp = _get_checkpointer()
    try:
        if hasattr(cp, "delete_thread"):
            cp.delete_thread(session_id)
        else:
            cp.delete_checkpoints({"configurable": {"thread_id": session_id}})
    except Exception as exc:
        log.warning("clear_session(%s) failed: %s", session_id, exc)

