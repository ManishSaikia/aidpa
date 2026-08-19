from pathlib import Path

from jinja2 import Environment, FileSystemLoader

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# ── Custom filters ──────────────────────────────────────────────────────────


def _format_top_values(values) -> str:
    if not values:
        return ""
    return ", ".join(f"{v['value']}({v['count']})" for v in values)


def _format_number(value) -> str:
    try:
        return f"{int(value):,}"
    except (TypeError, ValueError):
        return str(value)


# ── Jinja2 environment ──────────────────────────────────────────────────────
# trim_blocks  : removes the newline that follows a {% %} tag.
# lstrip_blocks: strips leading whitespace before {% %} tags.
# Together these prevent blank lines from cluttering rendered output.

_env = Environment(
    loader=FileSystemLoader(str(_PROMPTS_DIR)),
    autoescape=False,   # prompts are plain text, never HTML
    trim_blocks=True,
    lstrip_blocks=True,
)
_env.filters["format_top"] = _format_top_values
_env.filters["format_number"] = _format_number


def render_prompt(template_name: str, **kwargs) -> str:
    return _env.get_template(template_name).render(**kwargs)
