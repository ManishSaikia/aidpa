import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from dependencies.auth import get_current_user, AuthUser
from models.embed import EmbedResponse, PruneResponse, SimilarDataset, SimilarDatasetsResponse
from services.analysis_result import build_analysis_result
from services.digest import build_text_digest
from services.embeddings import embed_text
from services.storage import get_upload
from services.vector_store import (
    get_stored_embedding,
    prune_old_embeddings,
    search_similar,
    store_embedding,
)

router = APIRouter(prefix="/datasets", tags=["embeddings"])


def _run_embed(dataset_id: str, user_id: str | None = None) -> EmbedResponse:
    upload = get_upload(dataset_id)
    if upload is None:
        raise ValueError(f"Dataset '{dataset_id}' not found.")

    analysis  = build_analysis_result(dataset_id)
    digest    = build_text_digest(analysis)

    embedding = embed_text(digest, mode="document")

    from datetime import datetime, timezone
    meta = {
        "entry_type":    "analysis",
        "row_count":     analysis.total_rows,
        "total_columns": analysis.total_columns,
        "column_names":  list(analysis.columns.keys()),
        "analysed_at":   datetime.now(timezone.utc).isoformat(),
        "user_id":       user_id,
    }

    stored = store_embedding(
        dataset_id=dataset_id,
        filename=upload["filename"],
        text_digest=digest,
        embedding=embedding,
        metadata=meta,
        user_id=user_id,
    )

    msg = (
        "Embedding stored successfully in Supabase."
        if stored
        else "Skipped — a near-duplicate embedding already exists (similarity > 0.95)."
    )

    return EmbedResponse(
        dataset_id=dataset_id,
        filename=upload["filename"],
        digest_preview=digest[:300],
        embedding_dims=len(embedding),
        message=msg,
    )


@router.post("/{dataset_id}/embed", response_model=EmbedResponse)
async def embed_dataset(
    dataset_id: str,
    current_user: AuthUser = Depends(get_current_user),
):
    """
    Generates and stores an embedding for a dataset's analysis in Supabase pgvector.

    Call this explicitly when you want to persist a dataset to long-term memory.
    Near-duplicate datasets (similarity > 0.95) are automatically skipped.
    Re-calling with the same dataset_id overwrites the existing embedding.
    """
    try:
        result = await asyncio.to_thread(_run_embed, dataset_id, current_user.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return result


@router.get("/{dataset_id}/similar", response_model=SimilarDatasetsResponse)
async def find_similar_datasets(
    dataset_id: str,
    top_k: int = Query(default=5, ge=1, le=20, description="Number of similar datasets to return."),
    current_user: AuthUser = Depends(get_current_user),
):
    """
    Finds the most semantically similar previously-embedded datasets for the current user.
    """
    def _run_search():
        stored = get_stored_embedding(dataset_id)
        if stored is None:
            raise ValueError(
                f"Dataset '{dataset_id}' has not been embedded yet. "
                "Call POST /datasets/{dataset_id}/embed first."
            )
        query_vector = embed_text(stored["text_digest"], mode="document")
        return search_similar(
            query_vector,
            top_k=top_k,
            exclude_dataset_id=dataset_id,
            user_id=current_user.user_id,
        )

    try:
        raw_results = await asyncio.to_thread(_run_search)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    results = [
        SimilarDataset(
            dataset_id=r["dataset_id"],
            filename=r["filename"],
            similarity=round(r["similarity"], 4),
            text_digest=r["text_digest"],
        )
        for r in raw_results
    ]

    return SimilarDatasetsResponse(query_dataset_id=dataset_id, results=results)


@router.delete("/embeddings/prune", response_model=PruneResponse)
async def prune_embeddings(
    older_than_days: int = Query(
        default=90,
        ge=1,
        description="Delete your embeddings older than this many days.",
    ),
    current_user: AuthUser = Depends(get_current_user),
):
    """
    Deletes the calling user's analysis_embeddings rows older than N days.
    Only affects your own embeddings.
    """
    try:
        deleted = await asyncio.to_thread(
            prune_old_embeddings, older_than_days, current_user.user_id
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return PruneResponse(
        deleted_count=deleted,
        older_than_days=older_than_days,
        message=f"Pruned {deleted} of your embedding(s) older than {older_than_days} days.",
    )
