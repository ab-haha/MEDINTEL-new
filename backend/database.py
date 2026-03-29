"""
SQLite caching layer for processed medical documents.
Uses SHA-256 hash of the PDF file as the primary key.
"""

import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "medical_cache.db")


def get_connection():
    """Get a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database schema."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS processed_documents (
            file_hash TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            result_json TEXT NOT NULL,
            processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


def get_cached_result(file_hash: str) -> dict | None:
    """Retrieve a cached result by file hash. Returns None if not found."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT result_json FROM processed_documents WHERE file_hash = ?",
        (file_hash,),
    )
    row = cursor.fetchone()
    conn.close()
    if row:
        return json.loads(row["result_json"])
    return None


def save_result(file_hash: str, filename: str, result: dict):
    """Save a processed result to the cache."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT OR REPLACE INTO processed_documents (file_hash, filename, result_json)
        VALUES (?, ?, ?)
        """,
        (file_hash, filename, json.dumps(result)),
    )
    conn.commit()
    conn.close()
