#!/usr/bin/env python3
"""
OrphaAI — Broad Institute Repurposing Hub Dataset Downloader
Retrieves the complete Broad Institute Drug Repurposing Hub dataset (repurposing_drugs_20200324.txt)
and saves it to backend/backend/data/repurposing_drugs.tsv.
"""

import sys
import urllib.request
from pathlib import Path

DATASET_URL = "https://s3.amazonaws.com/data.clue.io/repurposing/downloads/repurposing_drugs_20200324.txt"

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent if SCRIPT_DIR.name in ("scripts", "backend") else SCRIPT_DIR
TARGET_PATH = PROJECT_ROOT / "backend" / "backend" / "data" / "repurposing_drugs.tsv"

def download_dataset(target_path: Path = TARGET_PATH):
    target_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading Broad Repurposing Hub dataset from:\n  {DATASET_URL}")

    req = urllib.request.Request(DATASET_URL, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read()
            with open(target_path, "wb") as f:
                f.write(content)
            print(f"Successfully saved full Broad Repurposing Hub dataset ({len(content):,} bytes) to:\n  {target_path}")
            return target_path
    except Exception as e:
        print(f"Error downloading dataset: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    download_dataset()
