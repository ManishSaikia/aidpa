import json
import logging
import os
from typing import AsyncIterator

from google import genai
from google.genai import types as genai_types

from models.analysis_result import AnalysisResult
from services.prompt_renderer import render_prompt

_MODEL = "gemini-3.1-flash-lite"
_MAX_TOKENS = 2048

log = logging.getLogger("aidpa.llm")


async def _stream_messages(
    dataset_id: str,
    system_prompt: str,
    user_message: str,
) -> AsyncIterator[str]:
    """
    Streams tokens from Google AI Studio (Gemini) as SSE-formatted strings.

    SSE events emitted:
      data: {"token": "..."}   — text chunk
      data: {"error": "..."}   — error
      data: [DONE]             — stream finished
    """
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        yield f"data: {json.dumps({'error': 'GOOGLE_API_KEY is not set in .env'})}\n\n"
        yield "data: [DONE]\n\n"
        return

    client = genai.Client(api_key=api_key)

    log.info(
        "LLM request | dataset=%s model=%s",
        dataset_id, _MODEL,
    )

    try:
        async for chunk in client.aio.models.generate_content_stream(
            model=_MODEL,
            contents=user_message,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=_MAX_TOKENS,
            ),
        ):
            text = chunk.text if chunk.text else ""
            if text:
                yield f"data: {json.dumps({'token': text})}\n\n"

        yield "data: [DONE]\n\n"

    except Exception as exc:
        log.error("LLM stream error | dataset=%s | %s", dataset_id, exc)
        yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        yield "data: [DONE]\n\n"


# ── User messages (fixed strings — no templates needed) ──────────────────────

_NARRATION_USER_MSG = "Write the narrative analysis of this dataset now."
_ANOMALY_EXPLANATION_USER_MSG = (
    "Analyse the flagged rows and hypothesise the most likely causes for each anomaly."
)


# ── Public streaming functions ───────────────────────────────────────────────

async def stream_analysis_response(
    analysis: AnalysisResult,
    question: str,
) -> AsyncIterator[str]:
    system_prompt = render_prompt("system_qa.j2", analysis=analysis)
    async for event in _stream_messages(
        dataset_id=analysis.dataset_id,
        system_prompt=system_prompt,
        user_message=question,
    ):
        yield event


async def stream_narration_response(
    analysis: AnalysisResult,
) -> AsyncIterator[str]:
    system_prompt = render_prompt("system_narration.j2", analysis=analysis)
    async for event in _stream_messages(
        dataset_id=analysis.dataset_id,
        system_prompt=system_prompt,
        user_message=_NARRATION_USER_MSG,
    ):
        yield event


async def stream_anomaly_explanation_response(
    analysis: AnalysisResult,
    anomaly_context: dict,
) -> AsyncIterator[str]:
    method = anomaly_context.get("method", "zscore")
    method_label = (
        "Z-score (|z| > 3)"
        if method == "zscore"
        else "IQR fences (Q1−1.5×IQR, Q3+1.5×IQR)"
    )

    flagged_col_names = {
        entry["column"] for entry in anomaly_context.get("columns_analyzed", [])
    }
    flagged_columns = {
        name: col
        for name, col in analysis.columns.items()
        if name in flagged_col_names and col.inferred_type == "numeric"
    }

    system_prompt = render_prompt(
        "system_anomaly_explain.j2",
        analysis=analysis,
        anomaly_context=anomaly_context,
        method_label=method_label,
        flagged_columns=flagged_columns,
    )
    async for event in _stream_messages(
        dataset_id=analysis.dataset_id,
        system_prompt=system_prompt,
        user_message=_ANOMALY_EXPLANATION_USER_MSG,
    ):
        yield event
