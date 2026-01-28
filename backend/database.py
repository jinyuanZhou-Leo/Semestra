from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Default to local SQLite for development, override with DATABASE_URL for Postgres
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "semestra.db")
DEFAULT_SQLITE_URL = f"sqlite:///{DB_PATH}"

database_url = os.getenv("DATABASE_URL", DEFAULT_SQLITE_URL)
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}

engine = create_engine(
    database_url, connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
