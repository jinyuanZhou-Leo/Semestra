# input:  [sqlite3, os, local database file]
# output: [Migration function adding widget category column]
# pos:    [One-off schema migration script]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import sqlite3
import os

DB_PATH = "semestra.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(courses)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "category" not in columns:
            print("Adding 'category' column to 'courses' table...")
            cursor.execute("ALTER TABLE courses ADD COLUMN category TEXT")
            conn.commit()
            print("Migration successful.")
        else:
            print("'category' column already exists.")
            
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
