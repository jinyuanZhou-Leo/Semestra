import json
import os
import sqlite3
from pathlib import Path

from dotenv import load_dotenv

DEFAULT_GPA_SCALING = '{"90-100": 4.0, "85-89": 4.0, "80-84": 3.7, "77-79": 3.3, "73-76": 3.0, "70-72": 2.7, "67-69": 2.3, "63-66": 2.0, "60-62": 1.7, "57-59": 1.3, "53-56": 1.0, "50-52": 0.7, "0-49": 0}'
DEFAULT_COURSE_CREDIT = 0.5


def resolve_db_path() -> Path | None:
    base_dir = Path(__file__).resolve().parent
    environment = os.getenv("ENVIRONMENT", "development")

    # Keep behavior consistent with runtime config for local development.
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


def parse_user_setting(raw_setting: str | None) -> dict:
    if not raw_setting:
        return {}
    try:
        parsed = json.loads(raw_setting)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def migrate():
    db_path = resolve_db_path()
    if not db_path:
        return
    if not db_path.exists():
        print(f"Database not found: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cursor.execute("PRAGMA table_info(users)")
        table_info = cursor.fetchall()
        if not table_info:
            print("Table 'users' not found. Nothing to migrate.")
            return

        columns = [info[1] for info in table_info]
        has_old_gpa = "gpa_scaling_table" in columns
        has_old_credit = "default_course_credit" in columns

        if "user_setting" not in columns:
            print("Adding 'user_setting' column to 'users' table...")
            cursor.execute("ALTER TABLE users ADD COLUMN user_setting TEXT")
            conn.commit()
            print("Column added.")
        else:
            print("'user_setting' column already exists.")

        select_columns = ["id", "user_setting"]
        if has_old_gpa:
            select_columns.append("gpa_scaling_table")
        if has_old_credit:
            select_columns.append("default_course_credit")

        cursor.execute(f"SELECT {', '.join(select_columns)} FROM users")
        users = cursor.fetchall()

        updated_count = 0
        for row in users:
            row_idx = 0
            user_id = row[row_idx]
            row_idx += 1
            raw_user_setting = row[row_idx]
            row_idx += 1

            old_gpa = row[row_idx] if has_old_gpa else None
            if has_old_gpa:
                row_idx += 1
            old_default_credit = row[row_idx] if has_old_credit else None

            merged = parse_user_setting(raw_user_setting)

            existing_gpa = merged.get("gpa_scaling_table")
            if not isinstance(existing_gpa, str) or not existing_gpa:
                merged["gpa_scaling_table"] = old_gpa if old_gpa else DEFAULT_GPA_SCALING

            existing_credit = merged.get("default_course_credit")
            if not isinstance(existing_credit, (int, float)):
                if old_default_credit is not None:
                    try:
                        merged["default_course_credit"] = float(old_default_credit)
                    except Exception:
                        merged["default_course_credit"] = DEFAULT_COURSE_CREDIT
                else:
                    merged["default_course_credit"] = DEFAULT_COURSE_CREDIT

            normalized_user_setting = json.dumps(merged)
            if raw_user_setting != normalized_user_setting:
                cursor.execute(
                    "UPDATE users SET user_setting = ? WHERE id = ?",
                    (normalized_user_setting, user_id),
                )
                updated_count += 1

        conn.commit()
        print(f"Migration complete. Updated {updated_count} user rows.")
        if has_old_gpa or has_old_credit:
            print("Old columns were kept for safety: gpa_scaling_table, default_course_credit.")
    except Exception as exc:
        conn.rollback()
        print(f"Migration failed: {exc}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
