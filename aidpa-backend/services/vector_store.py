import logging
import os
from typing import Any, Dict, List, Optional

from supabase import create_client

from services.embeddings import embed_text

log = logging.getLogger("aidpa.vector_store")

_TABLE              = "analysis_embeddings"
_DEDUP_THRESHOLD    = 0.95
_client             = None


def _get_client():
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_KEY must be set in .env to use the vector store."
            )
        _client = create_client(url, key)
    return _client


def store_embedding(
    dataset_id: str,
    filename: str,
    text_digest: str,
    embedding: List[float],
    metadata: Optional[Dict[str, Any]] = None,
    user_id: Optional[str] = None,
) -> bool:
    """
    Upserts an analysis embedding into Supabase.

    Before storing, checks if a near-duplicate already exists.
    If the most similar existing embedding has similarity > 0.95, storage is
    skipped and False is returned.

    metadata: optional JSONB payload stored alongside the embedding.
    user_id:  written to the dedicated user_id UUID column (migration 006).

    Returns True if stored, False if skipped as near-duplicate.
    """
    existing = search_similar(embedding, top_k=1, exclude_dataset_id=dataset_id)
    if existing and existing[0]["similarity"] >= _DEDUP_THRESHOLD:
        log.info(
            "Skipping storage — near-duplicate found | dataset=%s | "
            "most_similar=%s | similarity=%.3f",
            dataset_id,
            existing[0]["dataset_id"],
            existing[0]["similarity"],
        )
        return False

    row: Dict[str, Any] = {
        "dataset_id":  dataset_id,
        "filename":    filename,
        "text_digest": text_digest,
        "embedding":   embedding,
        "metadata":    metadata,
    }
    if user_id:
        row["user_id"] = user_id

    client = _get_client()
    client.table(_TABLE).upsert(row, on_conflict="dataset_id").execute()

    log.info("Stored embedding | dataset=%s | dims=%d | user=%s", dataset_id, len(embedding), user_id)
    return True


def search_similar(
    query_embedding: List[float],
    top_k: int = 5,
    exclude_dataset_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Finds the top-k most similar analyses using cosine similarity.
    When user_id is provided, restricts results to that user's embeddings.
    """
    params: Dict[str, Any] = {
        "query_embedding": query_embedding,
        "match_count":     top_k,
        "exclude_id":      exclude_dataset_id,
    }
    if user_id:
        params["filter_user_id"] = user_id

    client = _get_client()
    response = client.rpc("match_analyses", params).execute()
    return response.data or []


def search_by_question(
    question: str,
    top_k: int = 3,
    exclude_dataset_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Embeds the question and finds the most relevant past dataset analyses.
    When user_id is provided, retrieves only that user's memories.
    """
    query_vec = embed_text(question, mode="query")
    results = search_similar(
        query_vec,
        top_k=top_k,
        exclude_dataset_id=exclude_dataset_id,
        user_id=user_id,
    )
    log.info(
        "Question similarity search | top_%d results | user=%s | question=%r",
        top_k, user_id, question[:60],
    )
    return results


def get_stored_embedding(dataset_id: str) -> Optional[Dict[str, Any]]:
    """Returns the stored embedding metadata for a dataset, or None if not found."""
    client = _get_client()
    result = (
        client.table(_TABLE)
        .select("dataset_id, filename, created_at, text_digest")
        .eq("dataset_id", dataset_id)
        .maybe_single()
        .execute()
    )
    return result.data


def prune_old_embeddings(older_than_days: int, user_id: str | None = None) -> int:
    """
    Deletes embeddings older than N days for a specific user.
    user_id is required — without it the function is a no-op (returns 0).
    """
    if not user_id:
        log.warning("prune_old_embeddings called without user_id — skipping.")
        return 0

    client = _get_client()
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(days=older_than_days)).isoformat()

    result = (
        client.table(_TABLE)
        .delete()
        .lt("created_at", cutoff)
        .eq("user_id", user_id)
        .execute()
    )
    deleted = len(result.data) if result.data else 0
    log.info("Pruned %d embeddings older than %d days for user=%s", deleted, older_than_days, user_id)
    return deleted
