from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class AgentChatRequest(BaseModel):
    dataset_id: str = Field(description="UUID of the uploaded dataset.")
    question: str = Field(description="Plain-English question or instruction for the agent.")
    is_new_session: bool = Field(
        default=False,
        description=(
            "Set to true to start a new conversation session. "
            "The server will generate and return a session_id. "
            "Set to false to continue an existing session — session_id must be provided."
        ),
    )
    session_id: Optional[str] = Field(
        default=None,
        description=(
            "Required when is_new_session=False. "
            "Must match a session previously created with is_new_session=True."
        ),
    )


class AgentChatResponse(BaseModel):
    session_id: str = Field(
        description="The session_id for this conversation. Store and reuse for follow-up questions."
    )
    answer: str = Field(description="The agent's final answer after using tools.")


class SessionInfo(BaseModel):
    session_id: str
    dataset_id: str
    title: Optional[str] = None
    created_at: str
    last_used_at: str


class SessionListItem(BaseModel):
    session_id: str
    title: str
    created_at: str
    last_used_at: str
    message_count: int
