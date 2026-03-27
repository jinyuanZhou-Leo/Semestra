# input:  [Environment variables, SQLAlchemy engine/session/base, and SQLAlchemy schema inspection helpers]
# output: [Database engine, session factory, declarative base, FK pragma hook, and runtime schema compatibility checks]
# pos:    [Database bootstrap and connection configuration plus startup-time schema drift detection]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from sqlalchemy import event
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Load local .env for development so DB_PATH can be configured without code changes.
if ENVIRONMENT == "development":
    env_local_path = BASE_DIR / ".env"
    if env_local_path.exists():
        load_dotenv(env_local_path)

DATABASE_URL = os.getenv("DATABASE_URL")
DB_PATH = os.getenv("DB_PATH")

if DATABASE_URL:
    SQLITE_URL = DATABASE_URL
else:
    if DB_PATH:
        db_path = Path(DB_PATH)
        if not db_path.is_absolute():
            db_path = BASE_DIR / db_path
    else:
        db_path = BASE_DIR / "semestra.db"
    DB_PATH = str(db_path)
    SQLITE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLITE_URL, connect_args={"check_same_thread": False}
)

@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

REQUIRED_RUNTIME_SCHEMA = {
    "semesters": {
        "lifecycle_state",
        "creation_step",
        "draft_updated_at",
        "review_ready",
    },
    "widgets": {
        "title",
    },
    "program_plugin_installations": {
        "id",
        "program_id",
        "plugin_id",
        "version",
        "is_enabled",
        "auth_state",
        "program_settings",
    },
    "semester_plugin_activations": {
        "id",
        "semester_id",
        "program_plugin_installation_id",
        "semester_overrides",
        "setup_state",
        "is_enabled",
    },
}


def collect_runtime_schema_issues(bind) -> list[str]:
    inspector = inspect(bind)
    issues: list[str] = []
    table_names = set(inspector.get_table_names())
    for table_name, required_columns in REQUIRED_RUNTIME_SCHEMA.items():
        if table_name not in table_names:
            issues.append(f"missing table '{table_name}'")
            continue
        column_names = {
            column["name"]
            for column in inspector.get_columns(table_name)
        }
        for column_name in sorted(required_columns - column_names):
            issues.append(f"missing column '{table_name}.{column_name}'")
    return issues


def assert_runtime_schema_compatible(bind) -> None:
    issues = collect_runtime_schema_issues(bind)
    if not issues:
        return
    issue_summary = ", ".join(issues)
    raise RuntimeError(
        "Database schema is incompatible with the running backend. "
        f"Detected {issue_summary}. "
        "Run `uv run alembic -c alembic.ini upgrade head` in `backend/`."
    )

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
