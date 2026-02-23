# input:  [sqlite3, pathlib, local database file]
# output: [Migration function adding course.program_id and FK constraints]
# pos:    [One-off schema migration script]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import sqlite3
import os
from pathlib import Path

# Database path
BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "semestra.db"

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("Checking if 'program_id' column exists in 'courses' table...")
    cursor.execute("PRAGMA table_info(courses)")
    columns = [info[1] for info in cursor.fetchall()]
    
    if "program_id" in columns:
        print("'program_id' column already exists.")
    else:
        print("Adding 'program_id' column to 'courses' table...")
        # Add column allowing NULL initially
        cursor.execute("ALTER TABLE courses ADD COLUMN program_id VARCHAR")
        conn.commit()
        print("Column added.")

    print("Populating 'program_id' for existing courses...")
    # Fetch all courses
    cursor.execute("SELECT id, semester_id FROM courses")
    courses = cursor.fetchall()
    
    updated_count = 0
    for course_id, semester_id in courses:
        if semester_id:
            # Find program_id from semester
            cursor.execute("SELECT program_id FROM semesters WHERE id = ?", (semester_id,))
            result = cursor.fetchone()
            if result:
                program_id = result[0]
                cursor.execute("UPDATE courses SET program_id = ? WHERE id = ?", (program_id, course_id))
                updated_count += 1
    
    conn.commit()
    print(f"Updated {updated_count} courses with program_id.")
    
    # Ideally we would set NOT NULL constraint, but SQLite doesn't support adding constraints to existing columns easily
    # without recreating the table. For now, we'll rely on application logic.

    print("Migration complete.")
    conn.close()

if __name__ == "__main__":
    migrate()
