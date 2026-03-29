"""
Offline (local, no-LLM) table extraction fallback using PyMuPDF.

When both Ollama and Groq are unavailable, this module directly extracts
tabular data from the PDF.

Strategy priority:
  1. PyMuPDF find_tables() — for PDFs with real table structures
  2. Fixed-width text parser — for monospaced/DOS-style text tables
     (column-aligned text with dash separators)

It also generates basic rule-based insights (no AI required).
"""

import re
import logging
import fitz  # PyMuPDF
from collections import OrderedDict

log = logging.getLogger(__name__)
MAX_PAGES = 20


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _clean_cell(val) -> str:
    """Normalise a cell value to a clean string."""
    if val is None:
        return ""
    s = str(val).strip()
    s = re.sub(r"\s+", " ", s)
    return s


def _try_float(val: str) -> float | None:
    """Try to parse a string as a float; return None on failure."""
    try:
        return float(val.replace(",", "").strip())
    except (ValueError, AttributeError):
        return None


def _is_dash_line(line: str) -> bool:
    """Check if a line is a separator made of dashes/equals."""
    stripped = line.strip()
    if not stripped:
        return False
    non_sep = re.sub(r"[-=+|_ ]", "", stripped)
    return len(non_sep) == 0 and len(stripped) >= 10


# ──────────────────────────────────────────────────────────────────────────────
# Strategy 1: PyMuPDF find_tables() — for structured PDF tables
# ──────────────────────────────────────────────────────────────────────────────

def _try_pymupdf_tables(doc: fitz.Document, total_pages: int) -> dict | None:
    """Attempt extraction via PyMuPDF's find_tables(). Returns None if no tables found."""
    all_headers: list[str] = []
    all_rows: list[list[str]] = []
    header_found = False

    for page_num in range(total_pages):
        page = doc[page_num]
        try:
            tables = page.find_tables()
            if not tables or len(tables.tables) == 0:
                continue

            for table in tables:
                extracted = table.extract()
                if not extracted or len(extracted) == 0:
                    continue

                if not header_found:
                    candidate_headers = [_clean_cell(c) for c in extracted[0]]
                    non_empty = [h for h in candidate_headers if h]
                    if len(non_empty) >= 3:
                        all_headers = candidate_headers
                        header_found = True
                        data_rows = extracted[1:]
                    else:
                        data_rows = extracted
                else:
                    first_row = [_clean_cell(c) for c in extracted[0]]
                    if _rows_match(first_row, all_headers):
                        data_rows = extracted[1:]
                    else:
                        data_rows = extracted

                for row in data_rows:
                    cells = [_clean_cell(c) for c in row]
                    if all(c == "" or c == "-" for c in cells):
                        continue
                    all_rows.append(cells)

        except Exception:
            continue

    if not header_found or not all_rows:
        return None

    return {"headers": all_headers, "rows": all_rows}


# ──────────────────────────────────────────────────────────────────────────────
# Strategy 2: Fixed-Width Text Parser — for monospaced/DOS-style tables
# ──────────────────────────────────────────────────────────────────────────────

def _detect_column_boundaries(header_line: str) -> list[tuple[int, int]]:
    """
    Detect column boundaries from a fixed-width header line by finding
    runs of non-space characters separated by 2+ spaces.
    
    Returns list of (start, end) character positions for each column.
    """
    boundaries: list[tuple[int, int]] = []
    i = 0
    length = len(header_line)

    while i < length:
        # Skip leading spaces
        while i < length and header_line[i] == " ":
            i += 1
        if i >= length:
            break

        start = i

        # Consume non-space characters (and single spaces within column names)
        while i < length:
            if header_line[i] != " ":
                i += 1
            elif i + 1 < length and header_line[i + 1] != " ":
                # Single space — part of the column name (e.g., "NEAR EXP.")
                i += 1
            else:
                break

        end = i
        if end > start:
            boundaries.append((start, end))

    return boundaries


def _split_fixed_width(line: str, boundaries: list[tuple[int, int]]) -> list[str]:
    """Split a line into fields using pre-computed column boundaries."""
    fields: list[str] = []
    for i, (start, _) in enumerate(boundaries):
        if i + 1 < len(boundaries):
            end = boundaries[i + 1][0]
        else:
            end = len(line)
        field = line[start:end].strip() if start < len(line) else ""
        fields.append(field)
    return fields


def _try_text_table_parse(doc: fitz.Document, total_pages: int) -> dict | None:
    """
    Parse fixed-width text tables from the PDF.
    Works for DOS-style or monospaced reports where columns are aligned
    with spaces and separated by dash lines.
    """
    # Gather all text lines across pages
    all_lines: list[str] = []
    for page_num in range(total_pages):
        page = doc[page_num]
        text = page.get_text("text")
        if text:
            all_lines.extend(text.split("\n"))

    if not all_lines:
        return None

    # ── Find the header line ─────────────────────────────────────────────
    # Look for a line surrounded by dash separators that contains
    # recognizable column-like words (at least 3 words, mostly uppercase).
    header_line = None
    header_idx = -1

    for i, line in enumerate(all_lines):
        stripped = line.strip()
        if not stripped or _is_dash_line(stripped):
            continue

        # A header candidate MUST:
        # - come after a dash separator line (within 2 lines above)
        # - have 5+ distinct whitespace-separated tokens (column names)
        # - be mostly uppercase
        has_dash_before = any(
            _is_dash_line(all_lines[j].strip())
            for j in range(max(0, i - 2), i)
        )
        if not has_dash_before:
            continue

        tokens = stripped.split()
        if len(tokens) < 5:
            continue

        upper_ratio = sum(1 for t in tokens if t.isupper() or t.replace(".", "").replace("-", "").isupper()) / len(tokens)
        if upper_ratio >= 0.5:
            header_line = line  # Keep original (not stripped) to preserve positions
            header_idx = i
            break

    if header_line is None:
        return None

    # ── Detect column boundaries from the header ─────────────────────────
    boundaries = _detect_column_boundaries(header_line)
    if len(boundaries) < 3:
        return None

    headers = [header_line[s:e].strip() for s, e in boundaries]
    log.info("Detected %d columns from fixed-width header: %s", len(headers), headers)

    # ── Extract data rows ────────────────────────────────────────────────
    data_rows: list[list[str]] = []
    # Start after the header line (and any dash lines that follow it)
    start_idx = header_idx + 1
    while start_idx < len(all_lines) and _is_dash_line(all_lines[start_idx].strip()):
        start_idx += 1

    for line in all_lines[start_idx:]:
        stripped = line.strip()

        # Stop at the totals separator
        if _is_dash_line(stripped):
            # Check if the NEXT non-dash, non-empty line looks like a total row
            # If so, we've reached the end of data
            continue

        if not stripped:
            continue

        # Parse the line using column boundaries
        fields = _split_fixed_width(line, boundaries)

        # Validate: at least 2 non-empty fields
        non_empty = sum(1 for f in fields if f.strip())
        if non_empty < 2:
            continue

        # Skip total/summary rows
        first = fields[0].lower().strip() if fields else ""
        if any(kw in first for kw in ["total", "grand", "page ", "printed", "---"]):
            continue

        # Skip rows that are clearly just numbers (totals row without label)
        # by checking if the first field is empty and most fields are numeric
        if not fields[0].strip():
            numeric_count = sum(1 for f in fields if _try_float(f) is not None)
            if numeric_count >= len(fields) * 0.6:
                continue  # Likely a totals row

        data_rows.append(fields)

    if not data_rows:
        return None

    return {"headers": headers, "rows": data_rows}


# ──────────────────────────────────────────────────────────────────────────────
# Public Interface
# ──────────────────────────────────────────────────────────────────────────────

def extract_tables_offline(file_bytes: bytes) -> dict:
    """
    Extract all tables from a PDF using multiple strategies.

    Returns the same shape as the AI service:
        {
            "insights": [...],
            "extracted_report": [
                {"Col1": "val", "Col2": "val", ...},
                ...
            ],
            "extraction_mode": "offline"
        }
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    total_pages = min(len(doc), MAX_PAGES)

    # Strategy 1: PyMuPDF structured table detection
    result = _try_pymupdf_tables(doc, total_pages)
    if result:
        log.info("Offline: extracted via PyMuPDF find_tables()")

    # Strategy 2: Fixed-width text parser
    if result is None:
        result = _try_text_table_parse(doc, total_pages)
        if result:
            log.info("Offline: extracted via fixed-width text parser")

    doc.close()

    if result is None:
        return {
            "insights": [
                "No structured table data could be detected in this document. "
                "The PDF may contain scanned images or non-standard layouts."
            ],
            "extracted_report": [],
            "extraction_mode": "offline",
        }

    # ── Build structured rows preserving exact column order ─────────────
    headers = result["headers"]
    rows = result["rows"]
    num_cols = len(headers)
    report: list[dict] = []

    for row_cells in rows:
        padded = row_cells[:num_cols] + [""] * max(0, num_cols - len(row_cells))
        row_dict = OrderedDict()
        for i, header in enumerate(headers):
            key = header if header else f"Col_{i+1}"
            row_dict[key] = padded[i]
        report.append(row_dict)

    # Filter noise
    report = _filter_noise_rows(report, headers)

    # Generate insights
    insights = _generate_offline_insights(report, headers)

    return {
        "insights": insights,
        "extracted_report": report,
        "extraction_mode": "offline",
    }


# ──────────────────────────────────────────────────────────────────────────────
# Shared Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _rows_match(row_a: list[str], row_b: list[str]) -> bool:
    """Check if two rows are essentially the same (repeated header detection)."""
    if len(row_a) != len(row_b):
        return False
    matches = sum(
        1 for a, b in zip(row_a, row_b) if a.lower().strip() == b.lower().strip()
    )
    return matches >= len(row_a) * 0.7


def _filter_noise_rows(
    report: list[dict], headers: list[str]
) -> list[dict]:
    """Remove rows that are likely subtotals, footers, or decoration."""
    filtered = []
    for row in report:
        values = list(row.values())
        non_empty_count = sum(1 for v in values if v and v.strip())
        if non_empty_count < 2:
            continue
        first_val = values[0].lower().strip() if values else ""
        if any(kw in first_val for kw in ["total", "grand total", "page ", "printed"]):
            continue
        filtered.append(row)
    return filtered


def _find_col(headers: list[str], *needles: str) -> int | None:
    """Find the index of a column matching one of the needles (case-insensitive)."""
    for needle in needles:
        nl = needle.lower()
        for i, h in enumerate(headers):
            if nl in h.lower():
                return i
    return None


def _generate_offline_insights(
    report: list[dict], headers: list[str]
) -> list[str]:
    """Generate simple, rule-based insights without any AI."""
    if not report:
        return ["No tabular data was found for analysis."]

    insights: list[str] = []
    keys = list(report[0].keys())
    num_items = len(report)

    insights.append(
        f"Successfully extracted {num_items} product rows with "
        f"{len(keys)} columns from the document using offline extraction."
    )

    # ── Sales analysis ──────────────────────────────────────────
    sales_idx = _find_col(headers, "sale", "sales", "sold")
    if sales_idx is not None:
        sales_key = keys[sales_idx] if sales_idx < len(keys) else None
        if sales_key:
            zero_sales = sum(
                1 for r in report if _try_float(r.get(sales_key, "0")) == 0
            )
            if zero_sales > 0:
                insights.append(
                    f"{zero_sales} out of {num_items} products had zero sales — "
                    f"potential dead stock or discontinued items."
                )
            # Top seller
            top = max(
                report,
                key=lambda r: _try_float(r.get(sales_key, "0")) or 0,
            )
            name_key = keys[0] if keys else None
            if name_key and (_try_float(top.get(sales_key, "0")) or 0) > 0:
                for k in keys:
                    if any(n in k.lower() for n in ["name", "product", "item", "description"]):
                        name_key = k
                        break
                insights.append(
                    f"Top-selling product: \"{top.get(name_key, 'N/A')}\" "
                    f"with sales of {top.get(sales_key, 'N/A')}."
                )

    # ── Closing stock analysis ──────────────────────────────────
    cl_qty_idx = _find_col(headers, "cl.stock", "cl.qty", "cl qty", "closing", "clqty", "cls qty", "qoh")
    if cl_qty_idx is not None:
        cl_key = keys[cl_qty_idx] if cl_qty_idx < len(keys) else None
        if cl_key:
            zero_stock = sum(
                1 for r in report if _try_float(r.get(cl_key, "0")) == 0
            )
            if zero_stock > 0:
                insights.append(
                    f"{zero_stock} products have zero closing stock — "
                    f"potential stock-out risk, especially if they had recent sales."
                )

    # ── Stock value analysis ────────────────────────────────────
    cl_val_idx = _find_col(headers, "amount-ii", "cl.val", "cl val", "clval", "value", "stock val", "qohvalue")
    if cl_val_idx is not None:
        val_key = keys[cl_val_idx] if cl_val_idx < len(keys) else None
        if val_key:
            total_val = sum(
                _try_float(r.get(val_key, "0")) or 0 for r in report
            )
            if total_val > 0:
                formatted = f"₹{total_val:,.2f}"
                insights.append(
                    f"Total closing stock value: {formatted}."
                )

    if len(insights) < 3:
        insights.append(
            "This data was extracted using offline mode (no AI). "
            "Column names and row order exactly match the original document."
        )

    return insights[:5]
