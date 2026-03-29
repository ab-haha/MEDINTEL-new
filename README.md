# 🏥 MedIntel - Medical Document Processing

AI-powered platform for extracting pharmaceutical stock data from PDF reports.

**Upload PDF** → **AI Analysis** → **Dashboard Visualization** → **Export CSV/Excel**

---

## What is MedIntel?

MedIntel processes medical distributor stock reports by:
- Extracting tables from PDFs
- Generating AI insights
- Displaying results in a professional dashboard
- Exporting data to CSV/Excel

**Tech Stack:**
- **Frontend:** Next.js 16 + React 19 + Tailwind CSS
- **Backend:** Flask + PyMuPDF + LLMs (Ollama/Groq)
- **Database:** SQLite caching

---

## System Architecture

```
┌─────────────────────────────────────────────┐
│     Next.js Frontend (Port 3000)            │
│  • Upload Zone (drag-drop PDF)              │
│  • Dashboard (3 tabs)                       │
│  • Data Table (searchable, sortable)        │
│  • PDF Viewer                               │
└────────────┬────────────────────────────────┘
             │ HTTP POST /api/process-document
             ▼
┌─────────────────────────────────────────────┐
│        Flask Backend (Port 5000)             │
│  ┌─ Extract PDF (PyMuPDF)                  │
│  ├─ Check Cache (SQLite)                   │
│  ├─ AI Analysis:                            │
│  │  1. Try Ollama (local)                  │
│  │  2. Try Groq API (cloud)                │
│  │  3. Offline extraction (fallback)       │
│  ├─ Generate insights                      │
│  └─ Return JSON results                    │
└────────────┬────────────────────────────────┘
             │
             ▼
   ┌─────────────────────┐
   │  SQLite Cache DB    │
   │  (avoid reprocessing)
   └─────────────────────┘
```

---

## Project Structure

```
medical-platform/
├── frontend/                 # React dashboard (Next.js)
│   ├── src/app/             # Main page
│   ├── src/components/      # UI components
│   └── package.json         # Dependencies
│
├── backend/                 # Flask API server
│   ├── app.py              # Main API
│   ├── ai_service.py       # LLM integration
│   ├── extractor.py        # PDF extraction
│   └── requirements.txt     # Python packages
│
└── README.md
```

---

## Prerequisites

- **Node.js** 18+ (frontend)
- **Python** 3.10+ (backend)
- **Ollama** (optional, for local AI)

---

## Quick Start

### 1. Setup Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:
```
NEXT_PUBLIC_API_BASE=http://localhost:5000
```

Run:
```bash
npm run dev
# Frontend: http://localhost:3000
```

---

### 2. Setup Backend

```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env`:
```bash
FLASK_ENV=development
FLASK_DEBUG=1

# Optional: Ollama (local AI)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# Groq API (cloud AI fallback)
GROQ_API_KEY=your-key
GROQ_MODEL=openai/gpt-oss-120b

# CORS
CORS_ORIGINS=http://localhost:3000
```

Run:
```bash
python app.py
# API: http://localhost:5000
```

---

## How to Use

1. **Visit** `http://localhost:3000`
2. **Drag & drop** a PDF file (medical stock report)
3. **Wait** for processing (3-5 seconds)
4. **View** results in dashboard tabs:
   - **Overview:** KPI stats + AI insights
   - **Data:** Searchable, sortable table
   - **Document:** PDF preview
5. **Export** as CSV or Excel

---

## API Endpoints

### `GET /api/health`
Health check.

```bash
curl http://localhost:5000/api/health
```

### `POST /api/process-document`
Upload PDF for processing.

```bash
curl -F "file=@report.pdf" http://localhost:5000/api/process-document
```

**Response:**
```json
{
  "insights": ["Item A sold 500 units", "Item B out of stock"],
  "extracted_report": [
    {"CODE": "P001", "PRODUCT": "Item A", "SALES": "500"},
    {"CODE": "P002", "PRODUCT": "Item B", "SALES": "0"}
  ],
  "metadata": {
    "filename": "report.pdf",
    "page_count": 5,
    "row_count": 50
  }
}
```

---

## Frontend Components

| Component | Purpose |
|-----------|---------|
| `DashboardHeader` | Top navigation with file info |
| `SplitDashboard` | Tabbed interface (Overview/Data/Doc) |
| `DataTable` | Searchable, sortable table |
| `StatsCards` | KPI metrics display |
| `InsightsCard` | AI-generated insights |
| `UploadZone` | Drag-drop PDF upload |
| `AbstractLoader` | Loading animation |
| `ErrorDisplay` | Error messages |

---

## Backend Components

| File | Purpose |
|------|---------|
| `app.py` | Flask routes and API |
| `ai_service.py` | LLM integration (Ollama→Groq→Offline) |
| `extractor.py` | PDF text extraction |
| `offline_extractor.py` | Fallback extraction (no AI) |
| `database.py` | SQLite caching |

---

## Design

**Medical Light Theme:**
- Primary: Emerald green (`#059669`)
- Background: Crisp white (`#FCFBF8`)
- Text: Slate gray (`#1C1E23`)
- Accents: Light emerald (`#EDFCF9`)

---

## Production Build

### Frontend
```bash
cd frontend
npm run build
npm start
```

### Backend
```bash
cd backend
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **CORS Error** | Check `CORS_ORIGINS` in `.env` |
| **Ollama fails** | Verify: `curl localhost:11434/api/tags` |
| **Groq error** | Verify API key in `.env` |
| **PDF won't process** | Ensure PDF has readable text |
| **Database locked** | Restart backend |

---

## Debug Mode

**Backend:**
```bash
export FLASK_DEBUG=1
python app.py
```

**Frontend:**
```bash
npm run dev
```

---

## License

Educational and research purposes.

---

**Status:** 🟢 Production Ready | March 2025
