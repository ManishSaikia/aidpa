import logging
import os

log = logging.getLogger("aidpa.cost_tracker")

# ── Pricing constants (gemini-3.1-flash-lite) ─────────────────────────────────
# Override via env vars if the model changes.
_PRICE_INPUT  = float(os.getenv("GEMINI_PRICE_INPUT_PER_TOKEN",  "0.000000075"))   # $0.075 / 1M
_PRICE_OUTPUT = float(os.getenv("GEMINI_PRICE_OUTPUT_PER_TOKEN", "0.000000300"))   # $0.30  / 1M


def log_api_cost(
    user_id: str | None,
    model: str,
    endpoint: str,
    input_tokens: int,
    output_tokens: int,
) -> None:
    if not (input_tokens or output_tokens):
        return

    cost_usd = (input_tokens * _PRICE_INPUT) + (output_tokens * _PRICE_OUTPUT)

    try:
        from db.pg_connection import get_supabase_client
        sb = get_supabase_client()
        sb.table("api_cost_log").insert({
            "user_id":       user_id,
            "model":         model,
            "endpoint":      endpoint,
            "input_tokens":  input_tokens,
            "output_tokens": output_tokens,
            "cost_usd":      round(cost_usd, 8),
        }).execute()
        log.info(
            "api_cost model=%s endpoint=%s in=%d out=%d cost=$%.6f",
            model, endpoint, input_tokens, output_tokens, cost_usd,
        )
    except Exception as exc:
        log.warning("api_cost log failed: %s", exc)
