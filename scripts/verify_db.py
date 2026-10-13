#!/usr/bin/env python3
"""
OrphaAI — Database Verification & Analytics Script
Queries instance/orphaai.db to output total records, unique diseases, top 10 indications,
and runs test queries for complex/rare indications.
"""

import sys
from pathlib import Path
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent if SCRIPT_DIR.name in ("scripts", "backend") else SCRIPT_DIR
BACKEND_DIR = PROJECT_ROOT / "backend" / "backend" if (PROJECT_ROOT / "backend" / "backend").exists() else PROJECT_ROOT / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from seed_db import RepurposingRecord

DB_PATHS = [
    PROJECT_ROOT / "instance" / "orphaai.db",
    BACKEND_DIR / "instance" / "orphaai.db",
    BACKEND_DIR / "orphaai.db",
]

def verify_database():
    target_path = None
    for p in DB_PATHS:
        if p.exists():
            target_path = p
            break

    if not target_path:
        print("Error: Could not locate instance/orphaai.db file.", file=sys.stderr)
        sys.exit(1)

    print(f"Connecting to database:\n  {target_path}\n")

    engine = create_engine(f"sqlite:///{target_path}")
    Session = sessionmaker(bind=engine)
    session = Session()

    total_records = session.query(RepurposingRecord).count()
    unique_diseases = session.query(func.count(func.distinct(RepurposingRecord.disease))).scalar()

    print(f"==================================================")
    print(f"  OrphaAI Database Statistics")
    print(f"==================================================")
    print(f"  Total Repurposed Candidate Records: {total_records:,}")
    print(f"  Total Unique Diseases Indexed:       {unique_diseases:,}")
    print(f"==================================================\n")

    # Top 10 Diseases by Candidate Count
    top_diseases = (
        session.query(RepurposingRecord.disease, func.count(RepurposingRecord.id).label("count"))
        .group_by(RepurposingRecord.disease)
        .order_by(func.count(RepurposingRecord.id).desc())
        .limit(10)
        .all()
    )

    print("Top 10 Diseases by Number of Candidate Drugs:")
    for rank, (dis, cnt) in enumerate(top_diseases, 1):
        print(f"  {rank:2d}. {dis:<40} ({cnt} candidate drugs)")

    print("\n" + "="*50)
    print("  Sample Query Tests (Complex / Rare Indications)")
    print("="*50)

    test_queries = ["Glioblastoma", "Cystic Fibrosis", "Multiple Sclerosis", "Parkinson's Disease", "Hypertension"]
    for q in test_queries:
        records = (
            session.query(RepurposingRecord)
            .filter(RepurposingRecord.disease.ilike(f"%{q}%"))
            .all()
        )
        print(f"\nQuery Indication: '{q}' -> Found {len(records)} candidates.")
        for r in records[:5]:
            print(f"   • {r.drug_name:<25} | Phase: {r.clinical_phase:<12} | Targets: {r.target_genes or 'N/A'}")
        if len(records) > 5:
            print(f"   ... and {len(records) - 5} more candidate drugs.")

    session.close()

if __name__ == "__main__":
    verify_database()
