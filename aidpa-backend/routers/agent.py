import asyncio
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from dependencies.auth import get_current_user, AuthUser
from models.agent import AgentChatRequest, AgentChatResponse, SessionInfo, SessionListItem
from services.agent import clear_session as _clear_agent_memory
from services.agent import run_agent
from services.audit import log_event
from services.session_store import (
    append_message_pair,
    create_session,
    delete_session,
    get_session,
    get_session_messages,
    list_sessions,
    set_session_title,
    touch_session,
)

router = APIRouter(prefix="/agent", tags=["agent"])

_MAX_TITLE_LEN = 45


@router.post("/chat", response_model=AgentChatResponse)
async def agent_chat(
    request: AgentChatRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    if request.is_new_session:
        session_id = await asyncio.to_thread(
            create_session, request.dataset_id, current_user.user_id
        )
    else:
        if not request.session_id:
            raise HTTPException(
                status_code=400,
                detail="session_id is required when is_new_session=False.",
            )
        session = await asyncio.to_thread(get_session, request.session_id)
        if session is None:
            raise HTTPException(
                status_code=404,
                detail=f"Session '{request.session_id}' not found. "
                       "Start a new session with is_new_session=True.",
            )
        if session["dataset_id"] != request.dataset_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Session '{request.session_id}' belongs to dataset "
                    f"'{session['dataset_id']}', not '{request.dataset_id}'."
                ),
            )
        session_id = request.session_id

    try:
        answer = await asyncio.to_thread(
            run_agent,
            session_id,
            request.dataset_id,
            request.question,
            current_user.user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # Persist the exchange (title set only on first message)
    if request.is_new_session:
        q = request.question
        title = q[:_MAX_TITLE_LEN] + ("…" if len(q) > _MAX_TITLE_LEN else "")
        await asyncio.to_thread(set_session_title, session_id, title)
        # Audit: new session created
        asyncio.create_task(
            asyncio.to_thread(
                log_event,
                current_user.user_id, "agent.session_create",
                session_id, "session",
                {"dataset_id": request.dataset_id, "title": title},
            )
        )

    await asyncio.to_thread(append_message_pair, session_id, request.question, answer)

    return AgentChatResponse(session_id=session_id, answer=answer)


@router.get("/sessions", response_model=List[SessionListItem])
async def list_sessions_endpoint(
    dataset_id: str = Query(..., description="Filter sessions by dataset UUID."),
    current_user: AuthUser = Depends(get_current_user),
):
    """Return chat sessions for a dataset belonging to the calling user, newest first."""
    sessions = await asyncio.to_thread(
        list_sessions, dataset_id, current_user.user_id
    )
    return [SessionListItem(**s) for s in sessions]


@router.get("/sessions/{session_id}/messages")
async def get_messages_endpoint(
    session_id: str,
    current_user: AuthUser = Depends(get_current_user),
):
    """Return the persisted messages_json array for a session (owner only)."""
    session = await asyncio.to_thread(get_session, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    if session.get("user_id") and session["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied.")
    messages = await asyncio.to_thread(get_session_messages, session_id)
    return {"session_id": session_id, "messages": messages}


@router.get("/sessions/{session_id}", response_model=SessionInfo)
async def get_session_info(
    session_id: str,
    current_user: AuthUser = Depends(get_current_user),
):
    """Look up a session's metadata (owner only)."""
    session = await asyncio.to_thread(get_session, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    if session.get("user_id") and session["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied.")
    return SessionInfo(**session)


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session_endpoint(
    session_id: str,
    current_user: AuthUser = Depends(get_current_user),
):
    """Delete a session — owner only. Clears both Postgres row and LangGraph state."""
    session = await asyncio.to_thread(get_session, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    if session.get("user_id") and session["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied.")

    await asyncio.to_thread(delete_session, session_id)
    await asyncio.to_thread(_clear_agent_memory, session_id)

    # Audit: session deleted (fire-and-forget)
    asyncio.create_task(
        asyncio.to_thread(
            log_event,
            current_user.user_id, "agent.session_delete",
            session_id, "session",
            {"dataset_id": session.get("dataset_id")},
        )
    )
