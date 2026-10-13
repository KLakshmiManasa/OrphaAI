"""
OrphaAI — Clinical Trial Identifier (NCT ID) Resolver Service (Root mirror)
"""
from backend.backend.services.trial_resolver import (
    VERIFIED_TRIALS_MAP,
    COMPOUND_TRIAL_FALLBACK,
    is_valid_nct,
    resolve_nct_id,
    build_clinical_trials_url,
)
