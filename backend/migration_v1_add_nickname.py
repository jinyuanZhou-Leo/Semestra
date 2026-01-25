import sqlite3
import os

# Database file path
DB_FILE = "semestra.db"

def add_nickname_column():
    if not os.path.exists(DB_FILE):
        print(f"Database file {DB_FILE} not found.")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(users)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "nickname" in columns:
            print("Column 'nickname' already exists in 'users' table.")
        else:
            print("Adding 'nickname' column to 'users' table...")
            cursor.execute("ALTER TABLE users ADD COLUMN nickname TEXT")
            conn.commit()
            print("Column 'nickname' added successfully.")
            
    except sqlite3.Error as e:
        print(f"An error occurred: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    add_nickname_column()
