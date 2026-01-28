import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models import User, Program, Semester, Course, Widget

BASE_DIR = Path(__file__).parent
env_path = BASE_DIR / ".env"
if env_path.exists():
    load_dotenv(env_path)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "semestra.db")
SQLITE_URL = os.getenv("SQLITE_URL", f"sqlite:///{DB_PATH}")
POSTGRES_URL = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")

if not POSTGRES_URL:
    raise SystemExit("POSTGRES_URL or DATABASE_URL must be set to a Postgres connection string.")

if POSTGRES_URL.startswith("postgres://"):
    POSTGRES_URL = POSTGRES_URL.replace("postgres://", "postgresql://", 1)

sqlite_engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})
postgres_engine = create_engine(POSTGRES_URL)

Base.metadata.create_all(bind=sqlite_engine)
Base.metadata.create_all(bind=postgres_engine)

SqliteSession = sessionmaker(bind=sqlite_engine)
PostgresSession = sessionmaker(bind=postgres_engine)

sqlite_db = SqliteSession()
postgres_db = PostgresSession()

def copy_table(model):
    rows = sqlite_db.query(model).all()
    if not rows:
        return
    payload = []
    columns = [col.name for col in model.__table__.columns]
    for row in rows:
        payload.append({col: getattr(row, col) for col in columns})
    postgres_db.execute(model.__table__.insert(), payload)
    postgres_db.commit()

try:
    copy_table(User)
    copy_table(Program)
    copy_table(Semester)
    copy_table(Course)
    copy_table(Widget)
finally:
    sqlite_db.close()
    postgres_db.close()

print("Migration complete.")
