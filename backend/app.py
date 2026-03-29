"""
Flask application — Intelligent Medical Document Processing Platform.
Provides the /api/process-document endpoint and serves uploaded PDFs.
"""

import os
import uuid

from dotenv import load_dotenv
load_dotenv()  # Load .env before anything else reads env vars

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from database import init_db, get_cached_result, save_result
from extractor import compute_file_hash, extract_text_from_pdf
from ai_service import analyze_document

# ─── App Setup ───────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize the database on startup
init_db()


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health_check():
    """Simple health check endpoint."""
    return jsonify({"status": "ok", "message": "Medical Document API is running"})


@app.route("/api/process-document", methods=["POST"])
def process_document():
    """
    Accept a PDF file, extract text, analyze with AI, and return results.
    Uses SHA-256 caching to avoid re-processing identical documents.
    """
    # ── Validate the upload ──────────────────────────────────────────────
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are accepted"}), 400

    # ── Read file bytes and compute hash ─────────────────────────────────
    file_bytes = file.read()
    if len(file_bytes) == 0:
        return jsonify({"error": "Uploaded file is empty"}), 400

    file_hash = compute_file_hash(file_bytes)

    # ── Check cache first ────────────────────────────────────────────────
    cached = get_cached_result(file_hash)
    if cached:
        # Save the file temporarily so the frontend can preview it
        saved_filename = _save_pdf(file_bytes, file.filename)
        cached["pdf_url"] = f"/api/uploads/{saved_filename}"
        return jsonify(cached), 200

    # ── Extract and optimize text ────────────────────────────────────────
    try:
        extraction = extract_text_from_pdf(file_bytes)
        optimized_text = extraction["text"]
        page_count = extraction["page_count"]
        char_count = extraction["char_count"]
        column_order = extraction.get("column_order", [])
    except Exception as e:
        return jsonify({"error": f"Failed to extract text from PDF: {str(e)}"}), 422

    if not optimized_text or len(optimized_text.strip()) < 50:
        return jsonify({
            "error": "The PDF does not contain enough readable text for analysis."
        }), 422

    # ── Analyze: Ollama → Groq → Offline fallback ─────────────────────────
    try:
        result = analyze_document(
            optimized_text,
            column_order=column_order,
            file_bytes=file_bytes,
        )
    except RuntimeError as e:
        return jsonify({
            "error": "All extraction methods failed. "
                     "The PDF may not contain readable table data.",
            "detail": str(e)
        }), 503

    # ── Attach extraction metadata ───────────────────────────────────────
    report = result.get("extracted_report", [])
    extraction_mode = result.get("extraction_mode", "ai")
    result["metadata"] = {
        "filename": file.filename,
        "page_count": page_count,
        "char_count": char_count,
        "row_count": len(report),
        "column_count": len(report[0].keys()) if report else 0,
        "extraction_mode": extraction_mode,
        "column_order": column_order,
    }

    # ── Cache the result ─────────────────────────────────────────────────
    save_result(file_hash, file.filename, result)

    # ── Save the PDF for frontend preview ────────────────────────────────
    saved_filename = _save_pdf(file_bytes, file.filename)
    result["pdf_url"] = f"/api/uploads/{saved_filename}"

    return jsonify(result), 200


@app.route("/api/uploads/<filename>", methods=["GET"])
def serve_upload(filename):
    """Serve uploaded PDFs for the frontend PDF viewer."""
    return send_from_directory(UPLOAD_FOLDER, filename)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _save_pdf(file_bytes: bytes, original_filename: str) -> str:
    """Save PDF bytes to disk with a unique filename. Returns the filename."""
    ext = ".pdf"
    safe_name = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_FOLDER, safe_name)
    with open(filepath, "wb") as f:
        f.write(file_bytes)
    return safe_name


# ─── Entry Point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
