import logging
import os
import re
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types as genai_types

from services.prompt_renderer import render_prompt
from services.query import _validate_sql, execute_paginated_query
from services.schema import fetch_table_schema
from services.storage import dataset_table_name, ensure_dataset_loaded

log = logging.getLogger("aidpa.text_to_sql")

_MODEL = "gemini-3.1-flash-lite"
_MAX_TOKENS = 512
_CANNOT_ANSWER = "CANNOT_ANSWER"
_MAX_TOKENS_EXPLAIN = 300


def _strip_markdown_fences(text: str) -> str:
    """Removes ```sql ... ``` or ``` ... ``` wrappers that models sometimes add."""
    text = text.strip()
    text = re.sub(r"^```(?:sql)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _guard_table_name(sql: str, expected_table: str) -> None:
    if expected_table.lower() not in sql.lower():
        raise ValueError(
            f"Generated SQL does not reference the expected table '{expected_table}'. "
            "Refusing to execute."
        )


def _explain_results(
    client: genai.Client,
    dataset_id: str,
    question: str,
    columns: List[str],
    rows_sample: List[Dict[str, Any]],
    total_count: int,
) -> str:
    prompt = render_prompt(
        "result_explanation.j2",
        question=question,
        columns=columns,
        rows_sample=rows_sample[:10],
        row_count=total_count,
    )

    response = client.models.generate_content(
        model=_MODEL,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            max_output_tokens=_MAX_TOKENS_EXPLAIN,
        ),
    )

    usage = response.usage_metadata
    log.info(
        "Result explanation LLM usage | dataset=%s | prompt_tokens=%d completion_tokens=%d",
        dataset_id,
        usage.prompt_token_count if usage else 0,
        usage.candidates_token_count if usage else 0,
    )

    return (response.text or "").strip()


def generate_and_execute(
    dataset_id: str,
    question: str,
    page: int = 1,
    page_size: int = 10,
    max_retries: int = 3,
) -> Dict[str, Any]:
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set in .env")

    ensure_dataset_loaded(dataset_id)
    schema = fetch_table_schema(dataset_id)
    table_name = schema["table_name"]

    system_prompt = render_prompt("system_text_to_sql.j2", schema=schema)

    log.info(
        "Text-to-SQL request | dataset=%s | question=%r | page=%d page_size=%d",
        dataset_id, question, page, page_size,
    )

    client = genai.Client(api_key=api_key)

    contents: List[genai_types.Content] = [
        genai_types.Content(
            role="user",
            parts=[genai_types.Part(text=question)],
        )
    ]

    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        log.info(
            "Text-to-SQL attempt %d/%d | dataset=%s",
            attempt, max_retries, dataset_id,
        )

        response = client.models.generate_content(
            model=_MODEL,
            contents=contents,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=_MAX_TOKENS,
            ),
        )

        raw = (response.text or "").strip()
        usage = response.usage_metadata
        finish_reason = (
            response.candidates[0].finish_reason
            if response.candidates else None
        )

        log.info(
            "Text-to-SQL LLM usage | dataset=%s attempt=%d | "
            "prompt_tokens=%d completion_tokens=%d finish_reason=%s",
            dataset_id, attempt,
            usage.prompt_token_count if usage else 0,
            usage.candidates_token_count if usage else 0,
            finish_reason,
        )

        # Model hit the output token limit mid-query.
        if finish_reason == genai_types.FinishReason.MAX_TOKENS:
            last_error = ValueError("SQL generation was truncated (hit token limit). Try a simpler question.")
            contents.append(genai_types.Content(
                role="model", parts=[genai_types.Part(text=raw)]
            ))
            contents.append(genai_types.Content(
                role="user",
                parts=[genai_types.Part(text=(
                    "Your response was cut off before the query was complete.\n"
                    "Rewrite a shorter, simpler query that answers the same question. "
                    "Return only the SQL."
                ))],
            ))
            continue

        sql = _strip_markdown_fences(raw)

        if sql.upper().startswith(_CANNOT_ANSWER):
            raise ValueError(
                "The question cannot be answered with the available columns. "
                "Try rephrasing or ask about specific column names."
            )

        try:
            _validate_sql(sql)
            _guard_table_name(sql, table_name)
            result = execute_paginated_query(sql, page=page, page_size=page_size)

        except Exception as exc:
            last_error = exc
            log.warning(
                "Text-to-SQL attempt %d failed | dataset=%s | error=%s",
                attempt, dataset_id, exc,
            )

            if attempt == max_retries:
                break

            contents.append(genai_types.Content(
                role="model", parts=[genai_types.Part(text=raw)]
            ))
            contents.append(genai_types.Content(
                role="user",
                parts=[genai_types.Part(text=(
                    f"That query failed with this error:\n{exc}\n\n"
                    "Rewrite the query to fix this error. "
                    "Return only the corrected SQL."
                ))],
            ))
            continue

        # -- Success --
        explanation = _explain_results(
            client,
            dataset_id,
            question,
            result["columns"],
            result["rows"],
            result["total_count"],
        )

        log.info(
            "Text-to-SQL success | dataset=%s attempt=%d | "
            "rows_on_page=%d total_rows=%d total_pages=%d",
            dataset_id, attempt,
            result["row_count"], result["total_count"], result["total_pages"],
        )

        return {
            "sql":         sql,
            "columns":     result["columns"],
            "rows":        result["rows"],
            "row_count":   result["row_count"],
            "total_count": result["total_count"],
            "page":        result["page"],
            "page_size":   result["page_size"],
            "total_pages": result["total_pages"],
            "explanation": explanation,
        }

    raise ValueError(
        f"SQL generation failed after {max_retries} attempt(s). "
        f"Last error: {last_error}"
    )


def execute_raw_sql(
    dataset_id: str,
    sql: str,
    page: int = 1,
    page_size: int = 10,
) -> Dict[str, Any]:
    ensure_dataset_loaded(dataset_id)
    table_name = dataset_table_name(dataset_id)
    _validate_sql(sql)
    _guard_table_name(sql, table_name)

    result = execute_paginated_query(sql, page=page, page_size=page_size)

    log.info(
        "execute_raw_sql | dataset=%s | page=%d rows=%d total=%d",
        dataset_id, page, result["row_count"], result["total_count"],
    )

    return {
        "sql":         sql,
        "columns":     result["columns"],
        "rows":        result["rows"],
        "row_count":   result["row_count"],
        "total_count": result["total_count"],
        "page":        result["page"],
        "page_size":   result["page_size"],
        "total_pages": result["total_pages"],
        "explanation": None,
    }
