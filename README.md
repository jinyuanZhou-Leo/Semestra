# Semestra

A modern semester management application for students to organize courses, track academic progress, and manage assignments.

## Tech Stack

- **Backend**: Python FastAPI + SQLite
- **Frontend**: React + Vite + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **UI Components**: Radix UI primitives

---

## Features

- 📚 **Course Management**: Organize courses by semester and track assignments
- 📊 **Grade Calculator**: Built-in GPA calculation with customizable scaling
- 🧩 **Plugin System**: Extensible widget and tab plugins for custom functionality
- 🎨 **Modern UI**: Built with Tailwind CSS and shadcn/ui components
- 🌙 **Dark Mode**: Full theme support with automatic dark mode
- 📱 **Responsive**: Works seamlessly on desktop and mobile devices

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

## Settings Inheritance

GPA scaling tables resolve in this order (highest priority first):

1. Program-level `gpa_scaling_table`
2. User-level `gpa_scaling_table`
3. App default scaling table

If a higher level has no table (or an empty/invalid one), the next level is used.

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

## Plugin Development

Semestra features an extensible plugin system for custom widgets and tabs. See [`PLUGIN_DEVELOPMENT.md`](./PLUGIN_DEVELOPMENT.md) for a comprehensive guide.

### Quick Overview

**Widget Plugins**: Small, grid-based components displayed in the Dashboard tab  
**Tab Plugins**: Full-size panels that appear as separate tabs

### UI Development Guidelines

All plugins must follow these conventions:

- **Use Tailwind CSS**: Use utility classes for styling (`className="flex gap-4 p-4"`)
- **Use shadcn/ui Components**: Import from `../../components/ui/*` for consistency
- **Theme Support**: Use Tailwind color tokens (`text-foreground`, `bg-card`, etc.)
- **Responsive Design**: Test on different screen sizes using Tailwind responsive modifiers
- **Accessibility**: Ensure keyboard navigation and ARIA labels

### Multi-size Widget Best Practice

- **Prefer one responsive component**: Use a single `.tsx` with CSS-driven scaling (`clamp()`, container queries, breakpoints, CSS variables).
- **Avoid duplicate logic**: Do not create one component file per size unless layout structure is fundamentally different.
- **Split only when structure diverges**: If compact and large layouts are very different, split into internal subviews (for example, `CompactView` and `FullView`) under one widget entry component.
- **Use size tokens**: Define size variables for spacing, typography, controls, and visual elements to keep behavior consistent.
- **Test key sizes**: Verify at minimum, medium, and maximum widget sizes to prevent overflow regressions.

**Example**:
```tsx
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

const MyWidget: React.FC<WidgetProps> = ({ settings, updateSettings }) => {
    return (
        <div className="h-full flex flex-col gap-4 p-4">
            <Input 
                value={settings.title}
                onChange={(e) => updateSettings({ ...settings, title: e.target.value })}
            />
            <Button onClick={handleAction}>Save</Button>
        </div>
    );
};
```

For detailed documentation, see [`PLUGIN_DEVELOPMENT.md`](./PLUGIN_DEVELOPMENT.md).

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

*Last updated: 2026-02-05*
