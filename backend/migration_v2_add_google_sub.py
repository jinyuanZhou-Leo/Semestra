import sqlite3
import os

# Database file path
DB_FILE = "semestra.db"

def add_google_sub_column():
    if not os.path.exists(DB_FILE):
        print(f"Database file {DB_FILE} not found.")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    try:
        cursor.execute("PRAGMA table_info(users)")
        columns = [info[1] for info in cursor.fetchall()]

        if "google_sub" in columns:
            print("Column 'google_sub' already exists in 'users' table.")
        else:
            print("Adding 'google_sub' column to 'users' table...")
            cursor.execute("ALTER TABLE users ADD COLUMN google_sub TEXT")
            conn.commit()
            print("Column 'google_sub' added successfully.")

        # Ensure a unique index for google_sub (SQLite won't add it automatically for existing tables)
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub ON users (google_sub)")
        conn.commit()
    except sqlite3.Error as e:
        print(f"An error occurred: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    add_google_sub_column()
