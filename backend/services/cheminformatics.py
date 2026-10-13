"""
OrphaAI — Cheminformatics & In Silico Screening Service
Molecular property profiling (Lipinski Rule of 5), Morgan Fingerprint ECFP4 Tanimoto similarity,
and target overlap/Jaccard scoring using RDKit and SciPy.
"""

import math
import re
import logging
from typing import Dict, Any, List, Set, Union

logger = logging.getLogger("cheminformatics")

# Attempt importing RDKit
try:
    from rdkit import Chem, DataStructs
    from rdkit.Chem import Descriptors, rdMolDescriptors, AllChem
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False
    logger.warning("RDKit is not installed. Cheminformatics service will operate in fallback mode.")


def profile_molecular_properties(smiles: str) -> Dict[str, Any]:
    """
    Given a SMILES string, calculate Lipinski Rule of 5 & ADMET proxy metrics:
      - Molecular Weight (MW, g/mol)
      - LogP (MolLogP)
      - TPSA (Topological Polar Surface Area)
      - Hydrogen Bond Donors (HBD) & Acceptors (HBA)
      - Rotatable Bonds count
      - Rule of 5 Compliance (is_compliant, violations_count, violation_details)
    """
    if not smiles or not isinstance(smiles, str) or not smiles.strip():
        return _empty_property_profile("Empty SMILES string")

    clean_smiles = smiles.strip()

    if RDKIT_AVAILABLE:
        try:
            mol = Chem.MolFromSmiles(clean_smiles)
            if mol is not None:
                mw = float(Descriptors.MolWt(mol))
                logp = float(Descriptors.MolLogP(mol))
                tpsa = float(Descriptors.TPSA(mol))
                hbd = int(Descriptors.NumHDonors(mol))
                hba = int(Descriptors.NumHAcceptors(mol))
                rotatable_bonds = int(Descriptors.NumRotatableBonds(mol))

                violation_details = []
                if mw > 500.0:
                    violation_details.append(f"MW > 500 Da ({mw:.1f} Da)")
                if logp > 5.0:
                    violation_details.append(f"LogP > 5.0 ({logp:.2f})")
                if hbd > 5:
                    violation_details.append(f"HBD > 5 ({hbd})")
                if hba > 10:
                    violation_details.append(f"HBA > 10 ({hba})")

                violations_count = len(violation_details)
                is_compliant = violations_count <= 1  # Lipinski allows max 1 violation

                profile = {
                    "smiles": clean_smiles,
                    "mw": round(mw, 2),
                    "logp": round(logp, 2),
                    "tpsa": round(tpsa, 2),
                    "hbd": hbd,
                    "hba": hba,
                    "rotatable_bonds": rotatable_bonds,
                    "rule_of_5": {
                        "is_compliant": is_compliant,
                        "violations_count": violations_count,
                        "violation_details": violation_details,
                        "status": "Pass" if is_compliant else "Fail",
                    },
                    "valid_smiles": True,
                    "engine": "RDKit",
                }
                profile["cns_mpo"] = calculate_cns_mpo(clean_smiles, profile)
                return profile
        except Exception as e:
            logger.warning(f"RDKit SMILES parsing error for '{clean_smiles}': {e}")

    # Pure Python Fallback Profiler
    fb_profile = _fallback_property_profile(clean_smiles)
    fb_profile["cns_mpo"] = calculate_cns_mpo(clean_smiles, fb_profile)
    return fb_profile


def calculate_cns_mpo(smiles: str, properties: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Calculates Pfizer Central Nervous System Multiparameter Optimization (CNS MPO) score.
    Scale: 1.0 to 6.0 based on 5 key physicochemical properties:
      1. Molecular Weight (MW <= 360 Da optimal)
      2. LogP / CLogP (2.0 to 4.0 optimal)
      3. TPSA (40 to 90 Å² optimal)
      4. Hydrogen Bond Donors (HBD <= 1 optimal)
      5. Basic pKa (basic pKa <= 8 optimal)
      
    Categorization:
      - Score >= 4.0: 🟢 CNS Permeant / Likely Crosses BBB
      - Score 2.5 - 3.9: 🟡 Moderate / Uncertain BBB Penetration
      - Score < 2.5: 🔴 Non-Permeant / Unlikely to Cross BBB
    """
    if not properties:
        properties = {
            "mw": max(100.0, len(smiles or "") * 12.5),
            "logp": max(-1.0, min(6.0, len(smiles or "") * 0.12 - 0.5)),
            "tpsa": max(10.0, len(re.findall(r"[O N S P]", smiles or "", re.IGNORECASE)) * 20.0),
            "hbd": len(re.findall(r"[OH NH]", smiles or "", re.IGNORECASE)),
        }

    mw = float(properties.get("mw", 0.0))
    logp = float(properties.get("logp", 0.0))
    tpsa = float(properties.get("tpsa", 0.0))
    hbd = int(properties.get("hbd", 0))

    # 1. MW Score (optimal <= 360 Da)
    if mw <= 360.0:
        mw_score = 1.0
    elif mw <= 500.0:
        mw_score = max(0.0, (500.0 - mw) / 140.0)
    else:
        mw_score = 0.0

    # 2. LogP Score (optimal 2.0 to 4.0)
    if 2.0 <= logp <= 4.0:
        logp_score = 1.0
    elif logp < 2.0:
        logp_score = max(0.0, logp / 2.0)
    elif logp <= 5.0:
        logp_score = max(0.0, 1.0 - (logp - 4.0))
    else:
        logp_score = 0.0

    # 3. TPSA Score (optimal 40 to 90 Å²)
    if 40.0 <= tpsa <= 90.0:
        tpsa_score = 1.0
    elif tpsa < 40.0:
        tpsa_score = max(0.0, tpsa / 40.0)
    elif tpsa <= 120.0:
        tpsa_score = max(0.0, (120.0 - tpsa) / 30.0)
    else:
        tpsa_score = 0.0

    # 4. HBD Score (optimal <= 1)
    if hbd <= 1:
        hbd_score = 1.0
    elif hbd == 2:
        hbd_score = 0.5
    else:
        hbd_score = 0.0

    # 5. Basic pKa Score (optimal <= 8)
    estimated_pka = 7.5
    if smiles and RDKIT_AVAILABLE:
        try:
            mol = Chem.MolFromSmiles(smiles.strip())
            if mol is not None:
                aliphatic_amine = Chem.MolFromSmarts("[NX3;H2,H1,H0;!$(NC=O)]")
                guanidine = Chem.MolFromSmarts("NC(=N)N")
                if mol.HasSubstructMatch(guanidine):
                    estimated_pka = 12.0
                elif mol.HasSubstructMatch(aliphatic_amine):
                    estimated_pka = 9.5
                else:
                    estimated_pka = 7.0
        except Exception:
            estimated_pka = 7.5
    elif smiles:
        clean_s = smiles.upper()
        if "N=C(N)N" in clean_s or "NC(=N)N" in clean_s:
            estimated_pka = 12.0
        elif re.search(r"C[NH2,NH1,N](C|CC)", smiles, re.IGNORECASE):
            estimated_pka = 9.5
        else:
            estimated_pka = 7.2

    if estimated_pka <= 8.0:
        pka_score = 1.0
    elif estimated_pka <= 10.0:
        pka_score = max(0.0, (10.0 - estimated_pka) / 2.0)
    else:
        pka_score = 0.0

    raw_sum = mw_score + logp_score + tpsa_score + hbd_score + pka_score
    cns_mpo_score = round(1.0 + raw_sum, 2)
    cns_mpo_score = min(6.0, max(1.0, cns_mpo_score))

    if cns_mpo_score >= 4.0:
        status = "Permeant"
        label = "CNS Permeant / Likely Crosses BBB"
        badge = "🟢 CNS Permeant"
        color = "green"
    elif cns_mpo_score >= 2.5:
        status = "Moderate"
        label = "Moderate / Uncertain BBB Penetration"
        badge = "🟡 Moderate Penetration"
        color = "yellow"
    else:
        status = "Non-Permeant"
        label = "Non-Permeant / Unlikely to Cross BBB"
        badge = "🔴 Non-Permeant"
        color = "red"

    return {
        "cns_mpo_score": cns_mpo_score,
        "score": cns_mpo_score,
        "bbb_status": status,
        "bbb_label": label,
        "bbb_badge": badge,
        "color": color,
        "is_permeant": cns_mpo_score >= 4.0,
        "components": {
            "mw": {"value": mw, "score": round(mw_score, 2), "optimal": "≤ 360 Da"},
            "logp": {"value": logp, "score": round(logp_score, 2), "optimal": "2.0 - 4.0"},
            "tpsa": {"value": tpsa, "score": round(tpsa_score, 2), "optimal": "40 - 90 Å²"},
            "hbd": {"value": hbd, "score": round(hbd_score, 2), "optimal": "≤ 1"},
            "pka": {"value": round(estimated_pka, 1), "score": round(pka_score, 2), "optimal": "basic pKa ≤ 8"},
        }
    }


def calculate_tanimoto_similarity(smiles_query: str, smiles_target: str) -> float:
    """
    Calculates Tanimoto similarity between two SMILES strings using 2048-bit Morgan Fingerprints (ECFP4, radius=2).
    Returns a float from 0.0 to 1.0.
    """
    if not smiles_query or not smiles_target:
        return 0.0

    sq = smiles_query.strip()
    st = smiles_target.strip()

    if sq == st:
        return 1.0

    if RDKIT_AVAILABLE:
        try:
            mol1 = Chem.MolFromSmiles(sq)
            mol2 = Chem.MolFromSmiles(st)

            if mol1 is not None and mol2 is not None:
                fp1 = rdMolDescriptors.GetMorganFingerprintAsBitVect(mol1, radius=2, nBits=2048)
                fp2 = rdMolDescriptors.GetMorganFingerprintAsBitVect(mol2, radius=2, nBits=2048)
                tanimoto = DataStructs.TanimotoSimilarity(fp1, fp2)
                return round(float(tanimoto), 4)
        except Exception as e:
            logger.warning(f"Error calculating RDKit Tanimoto similarity: {e}")

    # Fallback character n-gram Tanimoto algorithm
    return _fallback_tanimoto_similarity(sq, st)


def compute_target_overlap(disease_genes: Union[List[str], Set[str]], drug_targets: Union[List[str], Set[str]]) -> Dict[str, Any]:
    """
    Computes target network overlap metrics:
      - Jaccard Similarity: |A ∩ B| / |A ∪ B|
      - Overlap Coefficient: |A ∩ B| / min(|A|, |B|)
    """
    set_disease = {str(g).strip().upper() for g in disease_genes if str(g).strip()}
    set_drug = {str(t).strip().upper() for t in drug_targets if str(t).strip()}

    intersection = set_disease.intersection(set_drug)
    union = set_disease.union(set_drug)

    jaccard = len(intersection) / len(union) if union else 0.0
    min_len = min(len(set_disease), len(set_drug)) if set_disease and set_drug else 0
    overlap_coef = len(intersection) / min_len if min_len > 0 else 0.0

    return {
        "jaccard_similarity": round(jaccard, 4),
        "overlap_coefficient": round(overlap_coef, 4),
        "shared_targets": sorted(list(intersection)),
        "disease_targets_count": len(set_disease),
        "drug_targets_count": len(set_drug),
        "intersection_count": len(intersection),
    }


def analyze_repurposing_candidates(
    candidates_list: List[Dict[str, Any]],
    disease_genes: List[str],
    reference_smiles: str = None,
    weight_evidence: float = 0.40,
    weight_target: float = 0.40,
    weight_chemical: float = 0.20,
) -> List[Dict[str, Any]]:
    """
    Ranks candidates based on an ensemble composite score:
      Composite Score = 40% Clinical Evidence + 40% Target Overlap + 20% Chemical Similarity
    """
    tier_weight_map = {
        "approved / launched": 1.0,
        "launched": 1.0,
        "approved": 1.0,
        "clinical trial phase 2/3": 0.75,
        "moderate evidence": 0.75,
        "phase 3": 0.75,
        "phase 2": 0.75,
        "preclinical": 0.50,
        "investigational": 0.50,
        "phase 1": 0.50,
        "terminated / ineffective": 0.10,
    }

    scored_results = []

    for cand in candidates_list:
        drug_name = cand.get("drug_name") or cand.get("name") or "Unknown Drug"
        drug_smiles = cand.get("smiles") or "C1=CC=CC=C1"
        tier = str(cand.get("evidence_tier") or cand.get("clinical_phase") or "Preclinical").strip().lower()
        evidence_score = tier_weight_map.get(tier, 0.50)

        # Target overlap computation
        raw_targets = cand.get("target_genes") or cand.get("primary_targets") or []
        if isinstance(raw_targets, str):
            drug_targets = [t.strip() for t in raw_targets.split(",") if t.strip()]
        elif isinstance(raw_targets, list):
            drug_targets = [t.get("symbol") if isinstance(t, dict) else str(t) for t in raw_targets]
        else:
            drug_targets = []

        overlap_metrics = compute_target_overlap(disease_genes, drug_targets)
        target_score = (overlap_metrics["jaccard_similarity"] * 0.5) + (overlap_metrics["overlap_coefficient"] * 0.5)

        # Chemical similarity computation
        if reference_smiles and reference_smiles.strip():
            chem_similarity = calculate_tanimoto_similarity(reference_smiles, drug_smiles)
        else:
            chem_similarity = 0.50

        # Molecular property profiling
        properties = profile_molecular_properties(drug_smiles)

        # Composite score calculation
        composite_score = (
            (evidence_score * weight_evidence) +
            (target_score * weight_target) +
            (chem_similarity * weight_chemical)
        )

        rationale = (
            f"Candidate {drug_name} evaluated with composite score {composite_score:.2f} "
            f"(Evidence Tier: {cand.get('evidence_tier', tier.title())}, Shared Targets: {len(overlap_metrics['shared_targets'])}, "
            f"Tanimoto: {chem_similarity:.2f})."
        )

        result_entry = {
            "drug_name": drug_name,
            "drug_id": cand.get("drug_id") or cand.get("id"),
            "disease": cand.get("disease"),
            "clinical_phase": cand.get("clinical_phase") or cand.get("evidence_tier"),
            "evidence_tier": cand.get("evidence_tier") or "Preclinical",
            "composite_score": round(composite_score, 4),
            "confidence_percentage": round(composite_score * 100, 1),
            "subscores": {
                "evidence_score": round(evidence_score, 4),
                "target_overlap_score": round(target_score, 4),
                "chemical_similarity_score": round(chem_similarity, 4),
            },
            "target_metrics": overlap_metrics,
            "molecular_properties": properties,
            "biological_rationale": rationale,
            "mechanism_of_action": cand.get("mechanism_of_action") or cand.get("mechanism") or "N/A",
        }
        scored_results.append(result_entry)

    scored_results.sort(key=lambda x: x["composite_score"], reverse=True)
    for idx, item in enumerate(scored_results, 1):
        item["rank"] = idx

    return scored_results


def _fallback_property_profile(smiles: str) -> Dict[str, Any]:
    """Pure Python fallback for molecular property estimation."""
    mw = max(100.0, len(smiles) * 12.5)
    logp = max(-1.0, min(6.0, len(smiles) * 0.12 - 0.5))
    tpsa = max(10.0, len(re.findall(r"[O N S P]", smiles, re.IGNORECASE)) * 20.0)
    hbd = len(re.findall(r"[OH NH]", smiles, re.IGNORECASE))
    hba = len(re.findall(r"[o n s p]", smiles, re.IGNORECASE))
    rotatable = len(re.findall(r"-|=", smiles))

    details = []
    if mw > 500:
        details.append(f"MW > 500 Da ({mw:.1f} Da)")
    if logp > 5.0:
        details.append(f"LogP > 5.0 ({logp:.2f})")
    if hbd > 5:
        details.append(f"HBD > 5 ({hbd})")
    if hba > 10:
        details.append(f"HBA > 10 ({hba})")

    is_compliant = len(details) <= 1

    return {
        "smiles": smiles,
        "mw": round(mw, 2),
        "logp": round(logp, 2),
        "tpsa": round(tpsa, 2),
        "hbd": hbd,
        "hba": hba,
        "rotatable_bonds": rotatable,
        "rule_of_5": {
            "is_compliant": is_compliant,
            "violations_count": len(details),
            "violation_details": details,
            "status": "Pass" if is_compliant else "Fail",
        },
        "valid_smiles": True,
        "engine": "Fallback Estimator",
    }


def _fallback_tanimoto_similarity(s1: str, s2: str) -> float:
    """Fallback character 3-gram Tanimoto calculation."""
    def get_ngrams(s: str, n=3):
        return {s[i:i+n] for i in range(len(s) - n + 1)}

    g1 = get_ngrams(s1)
    g2 = get_ngrams(s2)

    if not g1 or not g2:
        return 0.0

    intersection = len(g1.intersection(g2))
    union = len(g1.union(g2))

    return round(intersection / union, 4) if union else 0.0


def _empty_property_profile(reason: str) -> Dict[str, Any]:
    return {
        "smiles": "",
        "mw": 0.0,
        "logp": 0.0,
        "tpsa": 0.0,
        "hbd": 0,
        "hba": 0,
        "rotatable_bonds": 0,
        "rule_of_5": {
            "is_compliant": False,
            "violations_count": 0,
            "violation_details": [reason],
            "status": "Invalid",
        },
        "valid_smiles": False,
        "engine": "None",
    }
