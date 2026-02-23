# input:  [sqlite3, dotenv, pathlib]
# output: [Migration routine for week_pattern to alternating schema]
# pos:    [One-off schema migration script]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import os
import sqlite3
from pathlib import Path

from dotenv import load_dotenv


def resolve_db_path() -> Path | None:
    base_dir = Path(__file__).resolve().parent
    environment = os.getenv("ENVIRONMENT", "development")

    # Keep migration lookup behavior consistent with runtime config.
    if environment == "development":
        env_local_path = base_dir / ".env"
        if env_local_path.exists():
            load_dotenv(env_local_path)

    database_url = os.getenv("DATABASE_URL")
    if database_url:
        if database_url.startswith("sqlite:///"):
            return Path(database_url.replace("sqlite:///", "", 1))
        print(f"Unsupported DATABASE_URL for this migration: {database_url}")
        return None

    db_path = os.getenv("DB_PATH")
    if db_path:
        resolved = Path(db_path)
        if not resolved.is_absolute():
            resolved = base_dir / resolved
        return resolved

    return base_dir / "semestra.db"


def migrate() -> None:
    db_path = resolve_db_path()
    if not db_path:
        return
    if not db_path.exists():
        print(f"Database not found: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            UPDATE course_sections
            SET week_pattern = 'ALTERNATING'
            WHERE week_pattern IN ('ODD', 'EVEN')
            """
        )
        updated_sections = cursor.rowcount

        cursor.execute(
            """
            UPDATE course_events
            SET week_pattern = 'ALTERNATING'
            WHERE week_pattern IN ('ODD', 'EVEN')
            """
        )
        updated_events = cursor.rowcount

        conn.commit()
        print(
            "Migration complete. "
            f"Updated sections: {updated_sections}, updated events: {updated_events}."
        )
    except Exception as exc:
        conn.rollback()
        print(f"Migration failed: {exc}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
