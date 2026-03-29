"""
AI routing service — Inventory Intelligence.

Zero-Sort Guarantee:
  • column_order from extractor.py is already X-coordinate sorted (left-to-right).
  • _enforce_x_order() rebuilds every row's OrderedDict using the PDF's exact
    literal header strings AS KEYS, in the X-sorted sequence.
  • No .sort() / sorted() is ever called on column names.
  • _compute_data_insights() performs pure-math audits against the actual keys
    found in the data (scans for DUMP, ISSUE/SALES, CLOSING).
"""

import json
import logging
import os
import re
from collections import OrderedDict

import requests
from groq import Groq
from offline_extractor import extract_tables_offline

log = logging.getLogger(__name__)

# ─── Configuration ────────────────────────────────────────────────────────────

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "llama3")
OLLAMA_TIMEOUT  = int(os.getenv("OLLAMA_TIMEOUT", "120"))

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# ─── System Prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are a forensic pharmaceutical data transcription engine for "Inventory Intelligence".

══ POSITIONAL INDEX-MATCH MANDATE (ABSOLUTE) ════════════════════════════════
You are a LITERAL TRANSCRIPTION ENGINE.

COLUMN RULES (non-negotiable):
1. Stop relying on column names. You must extract EXACTLY the number of values
   as there are horizontal lanes provided in the user prompt.
2. For example, if there are 11 headers provided, you must output an array of EXACTLY 11 strings for EVERY row.
3. Map Value[0] to Header[0], Value[1] to Header[1], etc.
4. If a cell is blank or contains a dash, you MUST return an empty string "" at that index. Never drop or skip a column.

HEADER / DATA RULES:
• Skip pharmacy names, addresses, GSTINs, phone numbers — they are NOT columns.
• Data rows start immediately after the header row.
• Include EVERY product row. Skip dash-separator lines and page footers.

OUTPUT FORMAT — return ONLY this JSON object (no markdown, no extra text):
{
  "extracted_report": [
    ["val0", "val1", "val2", "..."],
    ["val0", "val1", "val2", "..."]
  ]
}
"""


# ─── User Prompt Builder ──────────────────────────────────────────────────────

def _build_user_prompt(text: str, column_order: list[str]) -> str:
    """
    Inject the PDF's X-sorted literal headers into the prompt so the LLM knows
    exactly how many values to extract per row and their index mapping.
    """
    if column_order:
        numbered = "\n".join(
            f"  Index {i}: {h}" for i, h in enumerate(column_order)
        )
        header_block = (
            f"The PDF table has EXACTLY {len(column_order)} vertical lanes in this "
            f"left-to-right (X-coordinate) order:\n{numbered}\n\n"
            f"YOU MUST OUTPUT AN ARRAY OF EXACTLY {len(column_order)} VALUES PER ROW. "
            f"MAPPING MUST BE INDEX-TO-INDEX."
        )
    else:
        header_block = (
            "No pre-detected headers. Identify them from the text, returning arrays of values "
            "for each row preserving the left-to-right layout."
        )

    return (
        f"{header_block}\n\n"
        f"Here is the full PDF text (page-by-page):\n\n{text}"
    )


# ─── JSON Extraction ──────────────────────────────────────────────────────────

def _extract_json(raw: str) -> dict:
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    raise ValueError("Could not extract valid JSON from AI response")


def _validate_response(data: dict) -> bool:
    return (
        isinstance(data, dict)
        and "extracted_report" in data
        and isinstance(data["extracted_report"], list)
    )


def _index_match_enforce(rows: list, column_order: list[str]) -> list[dict]:
    """
    Rebuild every row strictly using Positional Index-to-Index mapping.
    Header[0] -> Value[0], Header[1] -> Value[1], etc.
    Every row becomes an OrderedDict preserving exact X-coordinate sequence.
    No .sort() is executed.
    """
    if not rows:
        return []
        
    if not column_order:
        # Fallback if extractor found no headers: yield whatever AI gave us, generically mapped
        if isinstance(rows[0], dict):
            return [OrderedDict(r) for r in rows]
        elif isinstance(rows[0], list):
            return [OrderedDict((f"Col_{i}", str(v)) for i, v in enumerate(r)) for r in rows]
        return []

    result = []
    num_cols = len(column_order)
    
    for row in rows:
        new_row = OrderedDict()
        
        # Pull values out sequentially
        if isinstance(row, dict):
            # Fallback if AI returned dict instead of array despite instructions
            vals = list(row.values())
        elif isinstance(row, list):
            vals = row
        else:
            continue
            
        # Pad values to ensure exact column alignment (if AI drops a column)
        while len(vals) < num_cols:
            vals.append("")
            
        # Map by absolute index
        for i, header_str in enumerate(column_order):
            new_row[header_str] = str(vals[i]) if i < len(vals) else ""
            
        result.append(new_row)

    return result


# ─── Data-Driven Math Insights ────────────────────────────────────────────────

def _parse_num(val: str) -> float:
    try:
        return float(str(val).replace(",", "").replace(" ", "").strip())
    except Exception:
        return 0.0


def _find_key(keys: list[str], *needles: str) -> str | None:
    """Return first key whose upper-cased text contains any needle (case-insensitive)."""
    for needle in needles:
        nl = needle.upper()
        for k in keys:
            if nl in k.upper():
                return k
    return None


def _compute_data_insights(report: list[dict]) -> dict:
    """
    Pure-math audit using the ACTUAL column keys in the extracted data.
    Scans for DUMP, ISSUE/SALES, CLOSING/BALANCE columns.
    Returns the 4-pillar audit dict — no AI guesswork, only arithmetic.
    """
    if not report:
        return {
            "dead_capital":          {"total_value": 0, "item_count": 0, "items": []},
            "expiry_priority":       [],
            "stockout_risk":         [],
            "total_inventory_value": 0,
        }

    keys = list(report[0].keys())        # insertion order = X-coordinate order

    # ── Identify relevant columns ─────────────────────────────────────────
    name_key    = _find_key(keys, "ITEM", "PRODUCT", "DESCRIPTION", "NAME")
    batch_key   = _find_key(keys, "BATCH", "LOT")
    exp_key     = _find_key(keys, "EXP", "EXPIRY")
    dump_key    = _find_key(keys, "DUMP")
    issue_key   = _find_key(keys, "ISSUE", "SALES", "SALE", "SOLD")
    closing_key = _find_key(keys, "CLOSING", "CL.QTY", "CL QTY", "BALANCE", "QOH")
    rate_key    = _find_key(keys, "RATE", "MRP", "PRICE")
    val_key     = _find_key(keys, "VALUE", "CL.VAL", "AMOUNT", "STOCK VAL")
    qty_key     = closing_key or _find_key(keys, "QTY", "QUANTITY")

    # ── DUMP analysis (total value lost) ─────────────────────────────────
    dead_items_raw = []
    dump_total = 0.0
    if dump_key:
        for row in report:
            dump_val = _parse_num(row.get(dump_key, "0"))
            if dump_val > 0:
                dump_total += dump_val
                name = str(row.get(name_key, "Unknown")) if name_key else "Unknown"
                dead_items_raw.append((name, dump_val))

    # ── Dead capital (zero-sales items) — if no DUMP column ──────────────
    dead_val = 0.0
    if not dump_key and issue_key:
        for row in report:
            sales = _parse_num(row.get(issue_key, "0"))
            if sales == 0:
                qty  = _parse_num(row.get(qty_key, "0") if qty_key else "0")
                rate = _parse_num(row.get(rate_key, "0") if rate_key else "0")
                val  = _parse_num(row.get(val_key, "0") if val_key else "0")
                item_val = val or (qty * rate)
                if item_val > 0:
                    dead_val += item_val
                    name = str(row.get(name_key, "Unknown")) if name_key else "Unknown"
                    dead_items_raw.append((name, item_val))

    # Sort highest financial lockup first, return top 12
    dead_items_raw.sort(key=lambda x: x[1], reverse=True)
    dead_items = [name for name, _ in dead_items_raw[:12]]
    final_dead_value = round(dump_total or dead_val, 2)

    # ── ISSUE / SALES — top movers ────────────────────────────────────────
    top_movers: list[dict] = []
    if issue_key:
        mover_rows = [
            (row, _parse_num(row.get(issue_key, "0")))
            for row in report
            if _parse_num(row.get(issue_key, "0")) > 0
        ]
        # Sort movers by sales value descending
        mover_rows.sort(key=lambda x: x[1], reverse=True)
        for row, qty in mover_rows[:8]:
            name = str(row.get(name_key, "N/A")) if name_key else "N/A"
            top_movers.append({"product": name, "qty": str(qty)})

    # ── CLOSING / BALANCE — total stock valuation ─────────────────────────
    total_val = 0.0
    if val_key:
        total_val = sum(_parse_num(r.get(val_key, "0")) for r in report)
    elif closing_key and rate_key:
        for row in report:
            total_val += _parse_num(row.get(closing_key, "0")) * _parse_num(row.get(rate_key, "0"))
    elif qty_key and rate_key:
        for row in report:
            total_val += _parse_num(row.get(qty_key, "0")) * _parse_num(row.get(rate_key, "0"))

    # ── Stock-out risk (smarter velocity check) ──────────────────────────
    stockout: list[dict] = []
    if closing_key and issue_key:
        risk_pool = []
        for row in report:
            qty = _parse_num(row.get(closing_key, ""))
            sales = _parse_num(row.get(issue_key, "0"))
            # Genuine risk: Sales exist, but stock is critically low (<= 5)
            if 0 <= qty <= 5 and sales > 0:
                risk_pool.append((row, qty, sales))
        # Sort by highest sales velocity, then lowest stock
        risk_pool.sort(key=lambda x: (x[2], -x[1]), reverse=True)
        for row, qty, _ in risk_pool[:8]:
            name = str(row.get(name_key, "Unknown")) if name_key else "Unknown"
            stockout.append({"product": name, "closing_qty": str(int(qty))})
    elif closing_key:
        # Fallback if no sales data available to cross-reference velocity
        for row in report:
            qty = _parse_num(row.get(closing_key, ""))
            if 0 <= qty <= 5:
                name = str(row.get(name_key, "Unknown")) if name_key else "Unknown"
                if len(stockout) < 8:
                    stockout.append({"product": name, "closing_qty": str(int(qty))})

    # ── Expiry priority ───────────────────────────────────────────────────
    expiry: list[dict] = []
    if exp_key:
        rows_with_exp = [
            (row, row.get(exp_key, ""))
            for row in report
            if row.get(exp_key, "").strip()
        ]
        # Sort by raw alphabetical date (works moderately well for YY-MM forms) 
        # and prioritize by taking up to top 8 near-term
        rows_with_exp.sort(key=lambda x: x[1])  
        for row, exp_date in rows_with_exp[:8]:
            expiry.append({
                "batch":   str(row.get(batch_key, "N/A")) if batch_key else "N/A",
                "product": str(row.get(name_key, "N/A")) if name_key else "N/A",
                "expiry":  exp_date,
                "qty":     str(row.get(closing_key or qty_key, "N/A")) if (closing_key or qty_key) else "N/A",
            })

    return {
        "dead_capital": {
            "total_value": final_dead_value,
            "item_count":  len(dead_items_raw), # Return total count of locked items
            "items":       dead_items,
            "column_used": dump_key or issue_key or "—",
        },
        "expiry_priority":       expiry,
        "stockout_risk":         stockout,
        "total_inventory_value": round(total_val, 2),
        "top_movers":            top_movers,
        "column_map": {
            "name":    name_key,
            "batch":   batch_key,
            "expiry":  exp_key,
            "dump":    dump_key,
            "sales":   issue_key,
            "closing": closing_key,
            "rate":    rate_key,
            "value":   val_key,
        },
    }


# ─── AI Clients ───────────────────────────────────────────────────────────────

def _call_ollama(text: str, column_order: list[str]) -> dict:
    url = f"{OLLAMA_BASE_URL}/api/chat"
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": _build_user_prompt(text, column_order)},
        ],
        "stream": False,
        "options": {"temperature": 0.0, "num_predict": 8192},
    }
    response = requests.post(url, json=payload, timeout=OLLAMA_TIMEOUT)
    response.raise_for_status()
    content = response.json().get("message", {}).get("content", "")
    parsed = _extract_json(content)
    if not _validate_response(parsed):
        raise ValueError("Ollama returned invalid response structure")
    return parsed


def _call_groq(text: str, column_order: list[str]) -> dict:
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not set")
    client = Groq(api_key=GROQ_API_KEY)
    completion = client.chat.completions.create(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": _build_user_prompt(text, column_order)},
        ],
        model=GROQ_MODEL,
        temperature=0.0,
        max_completion_tokens=8192,
        response_format={"type": "json_object"},
    )
    content = completion.choices[0].message.content
    parsed = _extract_json(content)
    if not _validate_response(parsed):
        raise ValueError("Groq returned invalid response structure")
    return parsed


# ─── Public Interface ─────────────────────────────────────────────────────────

def analyze_document(
    optimized_text: str,
    *,
    column_order: list[str] | None = None,
    file_bytes: bytes | None = None,
) -> dict:
    """
    Full pipeline:
      1. AI extraction (Ollama → Groq → Offline fallback)
      2. _enforce_x_order()  — rebuild every row with PDF literal keys in X order
      3. _compute_data_insights() — pure-math audit (DUMP/ISSUE/CLOSING scan)

    Returns:
        {
            "extracted_report": list[OrderedDict],  # keys in PDF X order
            "audit":            dict,               # 4-pillar computed audit
            "extraction_mode":  str,
        }
    """
    col_order = column_order or []
    result = None

    # ── Attempt 1: Ollama ────────────────────────────────────────────────
    try:
        result = _call_ollama(optimized_text, col_order)
        result["extraction_mode"] = "ollama"
        log.info("✓ Ollama extraction succeeded")
    except Exception as e:
        log.warning("Ollama failed: %s", e)

    # ── Attempt 2: Groq ──────────────────────────────────────────────────
    if result is None:
        try:
            result = _call_groq(optimized_text, col_order)
            result["extraction_mode"] = "groq"
            log.info("✓ Groq extraction succeeded")
        except Exception as e:
            log.warning("Groq failed: %s", e)

    # ── Attempt 3: Offline ───────────────────────────────────────────────
    if result is None and file_bytes:
        try:
            result = extract_tables_offline(file_bytes)
            result["extraction_mode"] = "offline"
            log.info("✓ Offline extraction succeeded")
        except Exception as e:
            log.warning("Offline extraction failed: %s", e)

    if result is None:
        raise RuntimeError(
            "All extraction methods failed. "
            "The PDF may not contain readable table data."
        )

    # ── Step 2: Enforce X-coordinate column order ────────────────────────
    report = result.get("extracted_report", [])
    if report and col_order and result.get("extraction_mode") != "offline":
        report = _index_match_enforce(report, col_order)
        result["extracted_report"] = report

    # ── Step 3: Pure-math audit (replaces AI-generated audit) ────────────
    result["audit"] = _compute_data_insights(report)

    return result
