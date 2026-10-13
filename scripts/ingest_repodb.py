#!/usr/bin/env python3
"""
OrphaAI — repoDB & ClinicalTrials.gov Negative Controls Ingestion Script
Parses and ingests failed/terminated clinical trial records into OrphaAI database (orphaai.db).

Usage:
    python scripts/ingest_repodb.py [optional_path_to_repodb_csv]
"""

import os
import sys
import csv
from pathlib import Path

# Ensure backend directory is in python path
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent if SCRIPT_DIR.name in ("scripts", "backend") else SCRIPT_DIR
BACKEND_DIR = PROJECT_ROOT / "backend" / "backend" if (PROJECT_ROOT / "backend" / "backend").exists() else PROJECT_ROOT / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    from config import CANONICAL_DB_PATH
except ImportError:
    try:
        from backend.config import CANONICAL_DB_PATH
    except ImportError:
        CANONICAL_DB_PATH = os.path.abspath(os.path.join(PROJECT_ROOT, "instance", "orphaai.db"))

from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()

class RepurposingRecord(Base):
    __tablename__ = "repurposing_records"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    disease             = Column(String(255), index=True, nullable=False)
    drug_name           = Column(String(255), index=True, nullable=False)
    clinical_phase      = Column(String(100), default="Investigational")
    disease_area        = Column(String(255), default="General")
    mechanism_of_action = Column(Text, default="")
    target_genes        = Column(Text, default="")
    evidence_strength   = Column(String(100), default="Investigational")
    action_type         = Column(String(50), default="Unknown", index=True)
    therapeutic_direction = Column(String(30), default="Modulation", index=True)
    trial_id            = Column(String(100), default="")
    failure_reason      = Column(Text, default="")
    is_negative_control = Column(Boolean, default=False, index=True)

# Curated repoDB / ClinicalTrials.gov Negative Controls dataset
DEFAULT_REPODB_NEGATIVE_CONTROLS = [
    {
        "disease": "Breast Cancer",
        "drug_name": "iniparib",
        "status": "Terminated / Ineffective",
        "trial_id": "NCT00938652",
        "failure_reason": "Lack of efficacy in Phase III trial for Triple-Negative Breast Cancer",
        "disease_area": "Oncology",
        "target_genes": "PARP1",
        "mechanism_of_action": "PARP1 inhibitor (failed phase III primary overall survival endpoint)",
        "action_type": "Inhibitor",
        "therapeutic_direction": "Downregulation/Inhibition",
    },
    {
        "disease": "Triple-Negative Breast Cancer",
        "drug_name": "iniparib",
        "status": "Terminated / Ineffective",
        "trial_id": "NCT00938652",
        "failure_reason": "Failed Phase III trial: Did not significantly improve overall survival or progression-free survival",
        "disease_area": "Oncology",
        "target_genes": "PARP1",
        "mechanism_of_action": "PARP1 inhibitor (investigational negative control)",
        "action_type": "Inhibitor",
        "therapeutic_direction": "Downregulation/Inhibition",
    },
    {
        "disease": "Alzheimer's Disease",
        "drug_name": "semagacestat",
        "status": "Terminated / Ineffective",
        "trial_id": "NCT00594568",
        "failure_reason": "Terminated in Phase III due to cognitive worsening and increased risk of skin cancer",
        "disease_area": "Neurology",
        "target_genes": "PSEN1, PSEN2",
        "mechanism_of_action": "Gamma-secretase inhibitor (failed Phase III cognitive efficacy endpoint)",
        "action_type": "Inhibitor",
        "therapeutic_direction": "Downregulation/Inhibition",
    },
    {
        "disease": "Alzheimer's Disease",
        "drug_name": "atabecestat",
        "status": "Withdrawn - Safety",
        "trial_id": "NCT02569398",
        "failure_reason": "Withdrawn in Phase II/III due to severe hepatic enzyme elevation and liver toxicity",
        "disease_area": "Neurology",
        "target_genes": "BACE1",
        "mechanism_of_action": "BACE1 inhibitor (halted due to drug-induced liver injury)",
        "action_type": "Inhibitor",
        "therapeutic_direction": "Downregulation/Inhibition",
    },
    {
        "disease": "Alzheimer's Disease",
        "drug_name": "solanezumab",
        "status": "Terminated / Ineffective",
        "trial_id": "NCT02768402",
        "failure_reason": "Phase III trial halted: Failed to slow cognitive decline in preclinical or mild AD patients",
        "disease_area": "Neurology",
        "target_genes": "APP",
        "mechanism_of_action": "Anti-amyloid beta monoclonal antibody (negative control)",
        "action_type": "Modulator",
        "therapeutic_direction": "Modulation",
    },
    {
        "disease": "Alzheimer's Disease",
        "drug_name": "bapineuzumab",
        "status": "Terminated / Ineffective",
        "trial_id": "NCT00574132",
        "failure_reason": "Failed Phase III: Did not meet co-primary endpoints of cognitive and functional improvement",
        "disease_area": "Neurology",
        "target_genes": "APP",
        "mechanism_of_action": "Anti-amyloid beta monoclonal antibody",
        "action_type": "Modulator",
        "therapeutic_direction": "Modulation",
    },
    {
        "disease": "Colorectal Cancer",
        "drug_name": "tivozanib",
        "status": "Terminated / Ineffective",
        "trial_id": "NCT00782080",
        "failure_reason": "Phase III trial stopped due to lack of progression-free survival benefit compared to standard care",
        "disease_area": "Oncology",
        "target_genes": "KDR, FLT1, FLT4",
        "mechanism_of_action": "VEGFR tyrosine kinase inhibitor",
        "action_type": "Inhibitor",
        "therapeutic_direction": "Downregulation/Inhibition",
    },
    {
        "disease": "Non-Small Cell Lung Cancer",
        "drug_name": "bavituximab",
        "status": "Terminated / Ineffective",
        "trial_id": "NCT01999686",
        "failure_reason": "Phase III trial halted after interim analysis showed no overall survival advantage",
        "disease_area": "Oncology",
        "target_genes": "PS",
        "mechanism_of_action": "Phosphatidylserine-targeting antibody",
        "action_type": "Modulator",
        "therapeutic_direction": "Modulation",
    },
    {
        "disease": "Non-Small Cell Lung Cancer",
        "drug_name": "figitumumab",
        "status": "Withdrawn - Safety",
        "trial_id": "NCT00673049",
        "failure_reason": "Phase III trial closed early due to increased toxicities and fatal adverse events",
        "disease_area": "Oncology",
        "target_genes": "IGF1R",
        "mechanism_of_action": "IGF-1R inhibitor monoclonal antibody",
        "action_type": "Inhibitor",
        "therapeutic_direction": "Downregulation/Inhibition",
    },
    {
        "disease": "Osteoarthritis",
        "drug_name": "tanezumab",
        "status": "Terminated / Ineffective",
        "trial_id": "NCT02528253",
        "failure_reason": "FDA advisory panel voted against approval due to severe joint safety risks (rapidly progressive OA)",
        "disease_area": "Rheumatology",
        "target_genes": "NGF",
        "mechanism_of_action": "Anti-NGF monoclonal antibody",
        "action_type": "Inhibitor",
        "therapeutic_direction": "Downregulation/Inhibition",
    },
    {
        "disease": "Renal Cell Carcinoma",
        "drug_name": "sonepcizumab",
        "status": "Terminated / Ineffective",
        "trial_id": "NCT01762037",
        "failure_reason": "Phase II study failed to meet primary progression-free survival endpoint",
        "disease_area": "Oncology",
        "target_genes": "S1PR1",
        "mechanism_of_action": "Sphingosine-1-phosphate neutralizing antibody",
        "action_type": "Modulator",
        "therapeutic_direction": "Modulation",
    },
    {
        "disease": "Pancreatic Cancer",
        "drug_name": "veliparib",
        "status": "Terminated / Ineffective",
        "trial_id": "NCT01585805",
        "failure_reason": "Phase II trial did not demonstrate significant response rate improvement in combination therapy",
        "disease_area": "Oncology",
        "target_genes": "PARP1, PARP2",
        "mechanism_of_action": "PARP inhibitor",
        "action_type": "Inhibitor",
        "therapeutic_direction": "Downregulation/Inhibition",
    },
]

def load_repodb_csv(csv_path: str) -> list:
    records = []
    if not os.path.exists(csv_path):
        return DEFAULT_REPODB_NEGATIVE_CONTROLS

    with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            status = row.get("status") or row.get("status_name") or row.get("phase") or "Terminated / Ineffective"
            if not any(k in status.lower() for k in ["terminated", "failed", "withdrawn", "ineffective", "suspended", "refused"]):
                continue

            records.append({
                "disease": row.get("ind_name") or row.get("disease") or row.get("indication") or "Unspecified",
                "drug_name": row.get("drug_name") or row.get("pert_iname") or "Unknown Drug",
                "status": status,
                "trial_id": row.get("nct_id") or row.get("trial_id") or row.get("NCT_ID") or "",
                "failure_reason": row.get("failure_reason") or row.get("reason") or f"Trial terminated ({status})",
                "disease_area": row.get("disease_area") or "General",
                "target_genes": row.get("target_genes") or row.get("targets") or "",
                "mechanism_of_action": row.get("mechanism_of_action") or row.get("moa") or "",
                "action_type": row.get("action_type") or "Inhibitor",
                "therapeutic_direction": row.get("therapeutic_direction") or "Downregulation/Inhibition",
            })
    return records if records else DEFAULT_REPODB_NEGATIVE_CONTROLS

def ingest_negative_controls(csv_file=None):
    if csv_file:
        records = load_repodb_csv(csv_file)
    else:
        records = DEFAULT_REPODB_NEGATIVE_CONTROLS

    print(f"Ingesting {len(records)} repoDB / ClinicalTrials.gov negative control records...")

    db_paths = list(dict.fromkeys([
        Path(CANONICAL_DB_PATH),
        BACKEND_DIR / "instance" / "orphaai.db",
        BACKEND_DIR / "orphaai.db",
        PROJECT_ROOT / "instance" / "orphaai.db",
    ]))

    total_added = 0
    for db_path in db_paths:
        if not db_path.parent.exists():
            db_path.parent.mkdir(parents=True, exist_ok=True)

        engine = create_engine(f"sqlite:///{db_path}")
        Base.metadata.create_all(engine)

        Session = sessionmaker(bind=engine)
        session = Session()

        for r in records:
            dis_name = str(r["disease"]).strip().title()
            drug_name = str(r["drug_name"]).strip()

            # Check if negative control entry exists
            existing = session.query(RepurposingRecord).filter(
                RepurposingRecord.disease == dis_name,
                RepurposingRecord.drug_name == drug_name,
                RepurposingRecord.is_negative_control == True
            ).first()

            if not existing:
                item = RepurposingRecord(
                    disease=dis_name,
                    drug_name=drug_name,
                    clinical_phase=r.get("status", "Terminated / Ineffective"),
                    disease_area=r.get("disease_area", "General"),
                    mechanism_of_action=r.get("mechanism_of_action", f"Negative control trial ({r.get('trial_id', 'NCT')})"),
                    target_genes=r.get("target_genes", ""),
                    evidence_strength="Failed / Negative Control",
                    action_type=r.get("action_type", "Inhibitor"),
                    therapeutic_direction=r.get("therapeutic_direction", "Downregulation/Inhibition"),
                    trial_id=r.get("trial_id", ""),
                    failure_reason=r.get("failure_reason", "Trial terminated due to lack of efficacy or toxicity"),
                    is_negative_control=True,
                )
                session.add(item)
                total_added += 1
            else:
                existing.evidence_strength = "Failed / Negative Control"
                existing.trial_id = r.get("trial_id", "")
                existing.failure_reason = r.get("failure_reason", "Trial terminated due to lack of efficacy or toxicity")
                existing.is_negative_control = True

        session.commit()
        cnt = session.query(RepurposingRecord).filter_by(is_negative_control=True).count()
        session.close()
        print(f"Successfully updated database at {db_path} ({cnt} negative control entries active).")

    return len(records)

if __name__ == "__main__":
    path_arg = sys.argv[1] if len(sys.argv) > 1 else None
    count = ingest_negative_controls(path_arg)
    print(f"Ingestion complete! {count} repoDB negative control records integrated into OrphaAI database.")
