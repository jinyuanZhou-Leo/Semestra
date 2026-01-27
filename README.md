# Semestra

A modern semester management application for students to organize courses, track academic progress, and manage assignments.

## Tech Stack

- **Backend**: Python FastAPI + SQLite
- **Frontend**: React + Vite + TypeScript

---

## Requirements

| Component | Version |
|-----------|---------|
| Python | >= 3.10 |
| Node.js | >= 18.x |
| npm | >= 9.x |

---

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Semestra
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Start the server (development mode)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be running at `http://localhost:8000`

> **Tip**: You can also use `uv` package manager: `uv run uvicorn main:app --reload`

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be running at `http://localhost:5173`

---

## Production Deployment

### Backend

```bash
cd backend

# Use Gunicorn (recommended)
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

### Frontend

```bash
cd frontend

# Build for production
npm run build

# The build output is in the dist/ directory
# Deploy to any static file server (Nginx, Apache, Vercel, etc.)
```

---

## API Proxy Configuration

In development, the frontend proxies API requests to the backend via Vite:

| Frontend Path | Backend Target |
|---------------|----------------|
| `/api/*` | `http://127.0.0.1:8000/*` |
| `/docs` | `http://127.0.0.1:8000/docs` |

For production, configure Nginx or another reverse proxy to achieve the same effect.

---

## Project Structure

```
Semestra/
├── backend/                # Backend source code
│   ├── main.py            # FastAPI entry point
│   ├── models.py          # Database models
│   ├── schemas.py         # Pydantic schemas
│   ├── crud.py            # Database operations
│   ├── auth.py            # Authentication module
│   ├── requirements.txt   # Python dependencies
│   └── semestra.db        # SQLite database
├── frontend/              # Frontend source code
│   ├── src/               # Source files
│   ├── dist/              # Build output
│   ├── package.json       # Node.js dependencies
│   └── vite.config.ts     # Vite configuration
└── README.md              # This file
```

---

## Running Tests

### Backend Tests

```bash
cd backend
pytest
```

### Frontend Tests

```bash
cd frontend
npm run test
```

---

## API Documentation

Once the backend is running, visit `http://localhost:8000/docs` to view the interactive Swagger UI documentation.

---

## FAQ

### Where is the database?
The SQLite database file is located at `backend/semestra.db`. It is automatically created on first run.

### Frontend can't connect to backend?
Make sure the backend is running on port 8000. The frontend dev server will automatically proxy requests.

### How to reset the database?
Delete `backend/semestra.db` and restart the backend. A new database will be created.

---

## Quick Start Script

**macOS/Linux (`start.sh`)**:
```bash
#!/bin/bash
# Start backend
cd backend && source .venv/bin/activate && uvicorn main:app --reload &
# Start frontend
cd frontend && npm run dev
```

**Windows (`start.bat`)**:
```batch
@echo off
start cmd /k "cd backend && .venv\Scripts\activate && uvicorn main:app --reload"
start cmd /k "cd frontend && npm run dev"
```

---

## License

MIT License

---

*Last updated: 2026-01-26*
