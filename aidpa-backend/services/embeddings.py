"""
Embedding service using Google Gemini text-embedding-004.

Switched from local fastembed (nomic-ai/nomic-embed-text-v1.5) to Gemini API
to avoid the ~270MB model download that caused OOM kills on Railway.

Output: 768-dimensional vectors (same as nomic-embed-text-v1.5).

Asymmetric search via Gemini task_type parameter:
  mode="document" -> RETRIEVAL_DOCUMENT  (used when STORING a dataset digest)
  mode="query"    -> RETRIEVAL_QUERY     (used when SEARCHING by question)

This mirrors the nomic search_document / search_query prefix behaviour,
ensuring question and document embeddings align in the same vector space.
"""

import logging
import os
from typing import List, Literal

import google.generativeai as genai

log = logging.getLogger("aidpa.embeddings")

_MODEL_NAME = "models/text-embedding-004"

_TASK_TYPES = {
    "document": "RETRIEVAL_DOCUMENT",
    "query":    "RETRIEVAL_QUERY",
}

_cache: dict[str, list[float]] = {}

_configured = False


def _ensure_configured() -> None:
    global _configured
    if not _configured:
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError("GOOGLE_API_KEY environment variable is not set.")
        genai.configure(api_key=api_key)
        _configured = True


def embed_text(
    text: str,
    mode: Literal["document", "query"] = "document",
) -> List[float]:
    """
    Embeds a single text string and returns a 768-dimensional float list.

    Args:
        text: The text to embed.
        mode: "document" when storing a dataset digest (RETRIEVAL_DOCUMENT task).
              "query" when searching by a user question (RETRIEVAL_QUERY task).

    Returns:
        A list of 768 floats ready for insertion into Supabase pgvector.
    """
    cache_key = f"{mode}:{text}"
    if cache_key in _cache:
        log.debug("Embedding cache hit | mode=%s | text_len=%d", mode, len(text))
        return _cache[cache_key]

    _ensure_configured()

    task_type = _TASK_TYPES[mode]

    log.debug("Embedding text | model=%s | mode=%s | task_type=%s", _MODEL_NAME, mode, task_type)

    result = genai.embed_content(
        model=_MODEL_NAME,
        content=text,
        task_type=task_type,
        output_dimensionality=768,
    )

    embedding = result["embedding"]
    _cache[cache_key] = embedding
    return embedding
