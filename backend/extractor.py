"""
PDF text extraction using PyMuPDF.

Key guarantee: column_order is built from the HORIZONTAL X-COORDINATE of each
header cell's bounding box — sorted strictly left-to-right.  No alphabetical
sorting, no normalisation.  The literal text of each header cell is preserved
character-for-character (e.g. "ISSUE QTY." stays "ISSUE QTY.").
"""

import fitz  # PyMuPDF
import hashlib
import re
import unicodedata

MAX_PAGES = 20  # Hard page limit for large PDFs


# ─── Hash ─────────────────────────────────────────────────────────────────────

def compute_file_hash(file_bytes: bytes) -> str:
    """Compute SHA-256 hash of raw PDF bytes."""
    return hashlib.sha256(file_bytes).hexdigest()


# ─── Text Cleaning ────────────────────────────────────────────────────────────

def clean_text(text: str) -> str:
    """
    Strip invisible unicode and excessive whitespace without touching
    alphanumeric column names or punctuation.
    """
    cleaned = ""
    for ch in text:
        cat = unicodedata.category(ch)
        if cat.startswith(("L", "N", "P", "S", "Z")) or ch in ("\n", "\t", "\r"):
            cleaned += ch
    text = cleaned
    text = re.sub(r"[^\S\n]+", " ", text)        # collapse horizontal whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)        # collapse blank lines
    lines = [line.strip() for line in text.splitlines()]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ─── Vertical Lane Merger ──────────────────────────────────────────────────────

def _extract_vertical_lanes(doc: fitz.Document, total_pages: int) -> list[str]:
    """
    Scan for the header block and group text fragments vertically.
    If 'OPENING' (Top) and 'QTY.' (Bottom) align on the X-axis, they are merged.
    Returns the final merged strings sorted perfectly left-to-right (X-coordinate).
    """
    ANCHOR_WORDS = {
        "item", "batch", "exp", "qty", "mrp", "rate", "closing", "opening",
        "sales", "issue", "receipt", "balance", "description", "product", "name",
        "pack", "packing", "value", "amount"
    }

    for page_num in range(min(total_pages, 3)):
        page = doc[page_num]
        try:
            # get_text("words") -> [(x0,y0,x1,y1, word, block, line, word_num)]
            words = page.get_text("words")
            if not words:
                continue

            # Group words tightly by Y-coordinate rows
            rows: dict[int, list[tuple[float, float, float, float, str]]] = {}
            for w in words:
                x0, y0, x1, y1, text, *_ = w
                if not text.strip():
                    continue
                row_key = round(y0 / 4) * 4  # 4-pt bands
                rows.setdefault(row_key, []).append((x0, y0, x1, y1, text.strip()))

            sorted_y = sorted(rows.keys())
            header_start_y = None
            header_end_y = None

            # 1. Identify where headers start by matching Anchor Words
            for y_key in sorted_y:
                row_words = rows[y_key]
                lower_words = {t[4].lower().rstrip(".,:") for t in row_words}
                if len(lower_words & ANCHOR_WORDS) >= 2 and len(row_words) >= 3:
                    header_start_y = y_key
                    # Assume headers might span down approximately 30-40 pts (2-3 text lines)
                    header_end_y = header_start_y + 35
                    break

            if header_start_y is None:
                continue

            # 2. Collect all words in this vertical header band
            header_words = []
            for y_key in sorted_y:
                if header_start_y - 6 <= y_key <= header_end_y:
                    header_words.extend(rows[y_key])

            # 3. Form Vertical Lanes based on X-axis overlap
            lanes = []  # [{"x0": min_x, "x1": max_x, "words": [(y0, text)]}]

            for word in header_words:
                wx0, wy0, wx1, wy1, wtext = word
                w_mid = (wx0 + wx1) / 2
                w_width = wx1 - wx0

                matched_lane = None
                for lane in lanes:
                    l_mid = (lane["x0"] + lane["x1"]) / 2
                    
                    # Align condition: Intersecting midpoints OR 30% spatial overlap
                    overlap = max(0, min(wx1, lane["x1"]) - max(wx0, lane["x0"]))
                    if abs(w_mid - l_mid) < 25 or overlap > (w_width * 0.3):
                        matched_lane = lane
                        break
                
                if matched_lane:
                    matched_lane["x0"] = min(matched_lane["x0"], wx0)
                    matched_lane["x1"] = max(matched_lane["x1"], wx1)
                    matched_lane["words"].append((wy0, wtext))
                else:
                    lanes.append({"x0": wx0, "x1": wx1, "words": [(wy0, wtext)]})

            # 4. Enforce STRICT Left-to-Right layout
            lanes.sort(key=lambda l: l["x0"])

            # 5. Merge text top-to-bottom within each lane
            merged_headers = []
            for lane in lanes:
                lane_words = sorted(lane["words"], key=lambda t: t[0])
                merged = " ".join([t[1] for t in lane_words])
                if merged.strip():
                    merged_headers.append(merged.strip())

            if len(merged_headers) >= 3:
                return merged_headers

        except Exception:
            continue

    return []


# ─── Public Extraction ────────────────────────────────────────────────────────

def extract_text_from_pdf(file_bytes: bytes) -> dict:
    """
    Extract optimised text from a PDF for LLM consumption.
    Also extracts the exact column headers sorted by their X-coordinate
    (left-to-right reading order) — no alphabetical sorting applied.

    Returns:
        {
            "text":         str,        # cleaned full-text
            "page_count":   int,
            "char_count":   int,
            "column_order": list[str],  # literal headers in X-sorted order
        }
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    total_pages = min(len(doc), MAX_PAGES)

    # X-coordinate-sorted literal headers mapped into Vertical Lanes
    column_order = _extract_vertical_lanes(doc, total_pages)

    # Full text, page-by-page
    raw_parts: list[str] = []
    for page_num in range(total_pages):
        page = doc[page_num]
        page_text = page.get_text("text")
        if page_text and page_text.strip():
            raw_parts.append(f"--- Page {page_num + 1} ---\n{page_text}")

    doc.close()

    full_text = "\n\n".join(raw_parts)
    optimised_text = clean_text(full_text)

    return {
        "text":         optimised_text,
        "page_count":   total_pages,
        "char_count":   len(optimised_text),
        "column_order": column_order,
    }
