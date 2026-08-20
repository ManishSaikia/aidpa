from typing import List

from langchain_core.tools import tool

from services.analysis_result import build_analysis_result
from services.anomaly import detect_anomalies as _detect_anomalies
from services.query import _validate_sql, execute_query
from services.storage import dataset_table_name, ensure_dataset_loaded


def build_tools(dataset_id: str) -> List:
    """
    Returns a list of three LangChain tools bound to a specific dataset.
    The dataset_id is captured via closure -- callers never pass it explicitly.
    """
    ensure_dataset_loaded(dataset_id)
    table = dataset_table_name(dataset_id)

    @tool
    def run_sql(query: str) -> str:
        """Execute a DuckDB SELECT query against the dataset and return results.

        Use this when the user asks to count, filter, group, sort, or aggregate
        data (e.g. "how many rows", "average salary by department",
        "top 10 players by rating").

        The table name is already known -- always write queries as:
            SELECT ... FROM "{table_name}" WHERE ... LIMIT N
        Replace {table_name} with the actual table name provided in your context.

        Returns a formatted table string (max 20 rows shown to keep context small).
        """
        query = query.replace("\'", "'")
        if table.lower() not in query.lower():
            return (
                f"Error: query does not reference the expected table '{table}'. "
                f"Rewrite to include FROM \"{table}\"."
            )
        try:
            _validate_sql(query)
            rows = execute_query(query)
        except Exception as exc:
            return f"SQL execution failed: {exc}"

        if not rows:
            return "Query returned no rows."

        columns = list(rows[0].keys())
        display = rows[:20]

        header = " | ".join(f"{c[:15]:<15}" for c in columns)
        separator = "-" * len(header)
        body = "\n".join(
            " | ".join(f"{str(r.get(c, ''))[:15]:<15}" for c in columns)
            for r in display
        )
        suffix = f"\n... ({len(rows) - 20} more rows not shown)" if len(rows) > 20 else ""
        return f"{header}\n{separator}\n{body}{suffix}"

    @tool
    def get_column_stats(column_name: str) -> str:
        """Get statistical summary for a single column.

        Use this when the user asks about a specific column's distribution,
        typical values, range, null rate, or whether it has outliers.
        Provide the exact column name (case-sensitive) as it appears in the dataset.

        Returns: mean, std, min, max, null count/%, outlier counts for numeric columns.
        Returns: cardinality, null count/%, top values for categorical columns.
        """
        try:
            analysis = build_analysis_result(dataset_id)
        except Exception as exc:
            return f"Error fetching stats: {exc}"

        col = analysis.columns.get(column_name)
        if col is None:
            available = ", ".join(list(analysis.columns.keys())[:20])
            return (
                f"Column '{column_name}' not found. "
                f"Available columns (first 20): {available}"
            )

        if col.inferred_type == "numeric":
            return (
                f"Column '{column_name}' [numeric]\n"
                f"  Mean:          {col.mean}\n"
                f"  Std Dev:       {col.std}\n"
                f"  Min / Max:     {col.min} / {col.max}\n"
                f"  Nulls:         {col.null_count} ({col.null_pct}%)\n"
                f"  Z-score outliers: {col.zscore_outlier_count} ({col.zscore_outlier_pct}%)\n"
                f"  IQR outliers:     {col.iqr_outlier_count} ({col.iqr_outlier_pct}%)"
            )
        else:
            top = ", ".join(
                f"{v['value']}({v['count']})" for v in (col.top_values or [])
            )
            return (
                f"Column '{column_name}' [categorical]\n"
                f"  Unique values: {col.cardinality}\n"
                f"  Nulls:         {col.null_count} ({col.null_pct}%)\n"
                f"  Top values:    {top}"
            )

    @tool
    def detect_anomalies(column_name: str) -> str:
        """Detect statistical outliers in a numeric column using Z-score and IQR.

        Use this when the user asks about anomalies, outliers, unusual or suspicious
        values in a specific column. Only works on numeric columns.

        Returns the count of flagged rows per method and a sample of flagged row indices.
        """
        try:
            result = _detect_anomalies(dataset_id)
        except Exception as exc:
            return f"Error detecting anomalies: {exc}"

        zscore_data = result["results"].get("zscore", {}).get(column_name)
        iqr_data    = result["results"].get("iqr",    {}).get(column_name)

        if zscore_data is None and iqr_data is None:
            return (
                f"Column '{column_name}' not found or is not numeric. "
                "Only numeric columns can have outliers detected."
            )

        lines = [f"Anomaly detection for '{column_name}':"]
        if zscore_data:
            sample = zscore_data["flagged_rows"][:10]
            lines.append(f"  Z-score (|z|>3): {zscore_data['count']} outliers")
            if sample:
                lines.append(f"  Sample row indices: {sample}")
        if iqr_data:
            sample = iqr_data["flagged_rows"][:10]
            lines.append(f"  IQR fences:      {iqr_data['count']} outliers")
            if sample:
                lines.append(f"  Sample row indices: {sample}")

        return "\n".join(lines)

    return [run_sql, get_column_stats, detect_anomalies]
