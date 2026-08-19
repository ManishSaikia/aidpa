"""
Embedding service using fastembed with nomic-ai/nomic-embed-text-v1.5.

The model is loaded once (module-level singleton) and reused across calls.
First call triggers a ~270MB model download to the fastembed cache directory.
Subsequent server starts load from cache in ~1-2 seconds.

Output: 768-dimensional vectors.

Asymmetric search (nomic-embed-text-v1.5 supports this via prefix tokens):
  mode="document" → prepends "search_document: " — used when STORING a dataset digest.
  mode="query"    → prepends "search_query: "    — used when SEARCHING by question.

Using the correct mode ensures the model aligns question and document embeddings
in the same space, dramatically improving retrieval accuracy for asymmetric queries.
"""

import logging
from typing import List, Literal

from fastembed import TextEmbedding

log = logging.getLogger("aidpa.embeddings")

_MODEL_NAME = "nomic-ai/nomic-embed-text-v1.5"

_model: TextEmbedding | None = None

_PREFIXES = {
    "document": "search_document: ",
    "query":    "search_query: ",
}

_cache: dict[str, list[float]] = {}


def _get_model() -> TextEmbedding:
    global _model
    if _model is None:
        log.info(
            "Loading embedding model '%s' (first-time download may take a moment)...",
            _MODEL_NAME,
        )
        _model = TextEmbedding(model_name=_MODEL_NAME)
        log.info("Embedding model loaded.")
    return _model


def embed_text(
    text: str,
    mode: Literal["document", "query"] = "document",
) -> List[float]:
    """
    Embeds a single text string and returns a 768-dimensional float list.

    Args:
        text: The text to embed.
        mode: "document" when storing a dataset digest (adds 'search_document:' prefix).
              "query" when searching by a user question (adds 'search_query:' prefix).

    Returns:
        A list of 768 floats ready for insertion into Supabase pgvector.
    """
    prefixed = _PREFIXES[mode] + text

    if prefixed in _cache:
        log.debug("Embedding cache hit | mode=%s | text_len=%d", mode, len(text))
        return _cache[prefixed]

    model = _get_model()
    vectors = list(model.embed([prefixed]))
    result = vectors[0].tolist()
    _cache[prefixed] = result
    return result
