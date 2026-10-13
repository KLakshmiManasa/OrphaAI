"""
OrphaAI — Clinical Trial Identifier (NCT ID) Resolver Service
Provides authentic ClinicalTrials.gov NCT identifier resolution for drug repurposing candidates.
"""

import re
import urllib.parse
from typing import Dict, Optional

# Verified store of curated ClinicalTrials.gov identifiers for key repurposed compounds
VERIFIED_TRIALS_MAP: Dict[tuple, str] = {
    ("idebenone", "alzheimer"): "NCT00004812",
    ("idebenone", "alzheimer's disease"): "NCT00004812",
    ("idebenone", "alzheimers"): "NCT00004812",
    ("iniparib", "triple-negative breast cancer"): "NCT00938652",
    ("iniparib", "breast cancer"): "NCT00938652",
    ("exenatide", "parkinson"): "NCT01973569",
    ("exenatide", "parkinson's disease"): "NCT01973569",
    ("exenatide", "parkinsons"): "NCT01973569",
    ("metformin", "breast cancer"): "NCT01101425",
    ("sildenafil", "cystic fibrosis"): "NCT00659529",
    # Negative controls & additional verified trials
    ("verubecestat", "alzheimer"): "NCT01953601",
    ("verubecestat", "alzheimer's disease"): "NCT01953601",
    ("solanezumab", "alzheimer"): "NCT02768402",
    ("solanezumab", "alzheimer's disease"): "NCT02768402",
    ("bapineuzumab", "alzheimer"): "NCT00574132",
    ("bapineuzumab", "alzheimer's disease"): "NCT00574132",
    ("tivozanib", "colorectal cancer"): "NCT00782080",
    ("bavituximab", "non-small cell lung cancer"): "NCT01999686",
    ("figitumumab", "non-small cell lung cancer"): "NCT00673049",
    ("tanezumab", "osteoarthritis"): "NCT02528253",
    ("sonepcizumab", "renal cell carcinoma"): "NCT01762037",
    ("veliparib", "pancreatic cancer"): "NCT01585805",
}

# Compound-level curated fallback NCT mapping
COMPOUND_TRIAL_FALLBACK: Dict[str, str] = {
    "idebenone": "NCT00004812",
    "iniparib": "NCT00938652",
    "exenatide": "NCT01973569",
    "metformin": "NCT01101425",
    "sildenafil": "NCT00659529",
}

NCT_REGEX = re.compile(r"^NCT\d{8}$", re.IGNORECASE)


def is_valid_nct(nct_str: Optional[str]) -> bool:
    """Returns True if string is a valid ClinicalTrials.gov NCT identifier (format NCT + 8 digits) and not a dummy."""
    if not nct_str or not isinstance(nct_str, str):
        return False
    clean = nct_str.strip().upper()
    if clean in ("NCT00000000", "NCT0000000", "NCT"):
        return False
    return bool(NCT_REGEX.match(clean))


def resolve_nct_id(drug_name: str, disease_name: str, existing_trial_id: str = "") -> str:
    """
    Resolves an authentic NCT ID for a drug-disease pair.
    1. Validates existing_trial_id if present and non-synthetic.
    2. Checks curated VERIFIED_TRIALS_MAP for compound + disease combination.
    3. Checks COMPOUND_TRIAL_FALLBACK for drug name.
    4. Returns empty string if no verified NCT ID is cataloged.
    """
    if is_valid_nct(existing_trial_id):
        return existing_trial_id.strip().upper()

    drug_clean = re.sub(r"[^a-z0-9]+", " ", str(drug_name or "").lower()).strip()
    disease_clean = re.sub(r"[^a-z0-9]+", " ", str(disease_name or "").lower()).strip()

    # Search pair in verified store
    for (d_key, dis_key), nct_val in VERIFIED_TRIALS_MAP.items():
        if d_key in drug_clean:
            if dis_key in disease_clean or disease_clean in dis_key:
                return nct_val

    # Compound-level fallback
    for d_key, nct_val in COMPOUND_TRIAL_FALLBACK.items():
        if d_key in drug_clean:
            return nct_val

    return ""


def build_clinical_trials_url(drug_name: str, disease_name: str, trial_id: str = "") -> str:
    """
    Constructs a ClinicalTrials.gov URL:
    - Direct study link if trial_id is valid: https://clinicaltrials.gov/study/{trial_id}
    - Targeted search link fallback: https://clinicaltrials.gov/search?cond={disease}&intr={drug}
    """
    resolved = resolve_nct_id(drug_name, disease_name, trial_id)
    if resolved:
        return f"https://clinicaltrials.gov/study/{resolved}"

    cond_enc = urllib.parse.quote_plus(disease_name or "")
    intr_enc = urllib.parse.quote_plus(drug_name or "")
    return f"https://clinicaltrials.gov/search?cond={cond_enc}&intr={intr_enc}"
