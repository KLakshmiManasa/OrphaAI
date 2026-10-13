#!/usr/bin/env python3
"""
OrphaAI — Database Migration & Index Creation Script
Builds normalized schema and explicit performance indexes on disease.name, drug.name, and target_gene.symbol.
"""

import sys
from pathlib import Path
from sqlalchemy import create_engine, text

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent if SCRIPT_DIR.name in ("scripts", "backend") else SCRIPT_DIR
BACKEND_DIR = SCRIPT_DIR.parent / "backend" if (SCRIPT_DIR.parent / "backend").exists() else SCRIPT_DIR.parent

sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(BACKEND_DIR))
if (PROJECT_ROOT / "backend").exists():
    sys.path.insert(0, str(PROJECT_ROOT / "backend"))

try:
    from models import Base, idx_disease_name, idx_drug_name, idx_target_symbol, idx_evidence_tier
except ImportError:
    from backend.models import Base, idx_disease_name, idx_drug_name, idx_target_symbol, idx_evidence_tier

def run_migration():
    db_path = BACKEND_DIR / "instance" / "orphaai.db"
    if not db_path.parent.exists():
        db_path.parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine(f"sqlite:///{db_path}")
    print(f"[*] Running database schema migration on {db_path}...")

    # Create all tables defined in models.py
    Base.metadata.create_all(engine)

    # Build explicit performance indices
    indices = [
        ("idx_disease_name", "diseases", "name"),
        ("idx_drug_name", "drugs", "name"),
        ("idx_target_gene_symbol", "target_genes", "symbol"),
        ("idx_evidence_tier", "repurposing_evidences", "evidence_tier"),
    ]

    with engine.connect() as conn:
        for idx_name, table_name, column_name in indices:
            sql = f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table_name} ({column_name});"
            conn.execute(text(sql))
            print(f"[OK] Index created/verified: {idx_name} ON {table_name}({column_name})")
        conn.commit()

    print("[OK] Migration executed successfully.")

if __name__ == "__main__":
    run_migration()
