import os
from pathlib import Path

# Resolve absolute canonical database path in project root instance folder
PROJECT_ROOT = Path(__file__).resolve().parent
while PROJECT_ROOT.name in ("backend", "scripts", "services") and PROJECT_ROOT.parent != PROJECT_ROOT:
    PROJECT_ROOT = PROJECT_ROOT.parent

CANONICAL_DB_PATH = os.path.abspath(os.path.join(PROJECT_ROOT, "instance", "orphaai.db"))

def get_database_uri() -> str:
    """
    Retrieves and normalizes SQLALCHEMY_DATABASE_URI from environment.
    Uses absolute CANONICAL_DB_PATH for SQLite to ensure Flask, seed_db, and scripts
    always connect to the exact same database file.
    Converts legacy 'postgres://' prefixes to 'postgresql://' for SQLAlchemy 2.0+.
    """
    db_url = os.getenv("DATABASE_URL", "").strip()
    if not db_url:
        os.makedirs(os.path.dirname(CANONICAL_DB_PATH), exist_ok=True)
        db_path_str = CANONICAL_DB_PATH.replace("\\", "/")
        return f"sqlite:///{db_path_str}"
    
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
        
    return db_url
