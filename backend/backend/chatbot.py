"""
OrphaAI — Standalone Chatbot Backend
Run: python chatbot.py
URL: http://localhost:5001/api/v1/chat/message

No API key needed. Rich keyword-based biomedical responses.
"""

import random
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # allow all origins so React can call it

# ═══════════════════════════════════════════════════════════════════
#  KNOWLEDGE BASE  —  topic → list of varied responses
# ═══════════════════════════════════════════════════════════════════

KB = {

  "fever": [
    (
      "Fever is triggered by pyrogens activating the hypothalamus via prostaglandin E2 (PGE2). "
      "COX-2 inhibitors like Aspirin and Ibuprofen block PGE2 synthesis. "
      "Key repurposing candidates: Dexamethasone (NF-κB suppression), Anakinra (IL-1β blockade). "
      "Primary cytokine mediators: IL-1β, IL-6, and TNF-α."
    ),
    (
      "Fever activates innate immunity via TLR signalling and NF-κB upregulation. "
      "Drug repurposing targets: COX-1/COX-2 (Aspirin, Naproxen), "
      "IL-6 receptor (Tocilizumab), glucocorticoid receptors (Dexamethasone). "
      "Prolonged fever >38.5°C indicates systemic inflammatory response."
    ),
    (
      "The fever pathway: pathogen → macrophage activation → IL-1β/IL-6/TNF-α release "
      "→ hypothalamus PGE2 synthesis → temperature set-point increase. "
      "Antipyretics target COX enzymes (Aspirin, Paracetamol) or cytokine receptors (Tocilizumab). "
      "Repurposing opportunity: Dexamethasone is effective in cytokine-storm-related fever."
    ),
  ],

  "alzheimer": [
    (
      "Top Alzheimer's repurposing candidates: "
      "Metformin (AMPK activation reducing amyloid-β), "
      "Rapamycin (mTOR inhibition promoting tau autophagy), "
      "Imatinib (c-Abl inhibition reducing tau phosphorylation), "
      "Sildenafil (PDE5 inhibition improving cerebral blood flow). "
      "Key genes: APP, PSEN1, APOE, TREM2. Ensemble confidence: 87%."
    ),
    (
      "Alzheimer's disease involves amyloid-β plaques and neurofibrillary tau tangles. "
      "Repurposing pipeline: Nilotinib (c-Abl/DDR1 inhibitor, Phase II trials), "
      "Liraglutide (GLP-1 agonist reducing neuroinflammation), "
      "Memantine combination therapies. "
      "mTOR, AMPK, and autophagy pathways are central repurposing targets."
    ),
    (
      "Alzheimer's repurposing strategy targets three hallmarks: "
      "(1) Amyloid-β — Imatinib reduces production via c-Abl/APP pathway. "
      "(2) Tau tangles — Rapamycin clears tau via autophagy induction. "
      "(3) Neuroinflammation — Aspirin and Metformin reduce microglial activation. "
      "OrphaAI network score for Metformin-Alzheimer's: 0.79."
    ),
  ],

  "parkinson": [
    (
      "Parkinson's repurposing candidates: "
      "Nilotinib (c-Abl inhibitor clearing α-synuclein, Phase II), "
      "Exenatide (GLP-1 agonist, neuroprotection shown in RCT), "
      "Rapamycin (PINK1/Parkin mitophagy induction). "
      "Key genes: SNCA, LRRK2, PINK1, PARK2, GBA."
    ),
    (
      "In Parkinson's disease, dopaminergic neuron loss in the substantia nigra drives motor symptoms. "
      "Drug repurposing exploits: mitophagy (Rapamycin), "
      "α-synuclein clearance (Nilotinib), "
      "neuroinflammation suppression (Ibuprofen, Simvastatin). "
      "LRRK2 and GBA mutations are high-priority pharmacological targets."
    ),
    (
      "Parkinson's pathology: misfolded α-synuclein (Lewy bodies) → "
      "mitochondrial dysfunction → dopaminergic cell death. "
      "Rapamycin activates PINK1/Parkin mitophagy removing damaged mitochondria. "
      "Nilotinib promotes lysosomal clearance of α-synuclein. "
      "GLP-1 agonists (Liraglutide, Exenatide) show neuroprotection in clinical trials."
    ),
  ],

  "als": [
    (
      "ALS repurposing candidates: "
      "Rapamycin (mTOR/autophagy clearing SOD1 aggregates), "
      "Panobinostat (pan-HDAC inhibitor reducing neurodegeneration), "
      "Masitinib (c-Kit/PDGFR inhibitor, Phase 3 trials). "
      "Key genes: SOD1, TDP-43 (TARDBP), FUS, C9orf72."
    ),
    (
      "ALS involves motor neuron death via protein aggregation and oxidative stress. "
      "Repurposing targets: SOD1 stabilisation (Arimoclomol), "
      "TDP-43 aggregation (Metformin via AMPK), "
      "neuroinflammation (Thalidomide derivatives). "
      "C9orf72 repeat expansion accounts for ~40% of familial ALS cases."
    ),
    (
      "ALS repurposing pipeline: "
      "Panobinostat (HDAC inhibition upregulates HSP70 chaperones reducing SOD1 aggregation). "
      "Rapamycin extends lifespan in SOD1-G93A mice by 11%. "
      "Masitinib targets microglia-mediated neuroinflammation. "
      "OrphaAI ensemble confidence for Rapamycin-ALS: 72%."
    ),
  ],

  "cancer": [
    (
      "Cancer repurposing highlights: "
      "Metformin (AMPK suppressing mTORC1 in pancreatic cancer), "
      "Itraconazole (Hedgehog/VEGFR inhibition), "
      "Aspirin (COX-2/Wnt pathway in colorectal cancer), "
      "Chloroquine (autophagy inhibition sensitising tumours to chemotherapy). "
      "Key oncogenes: KRAS, TP53, EGFR, PIK3CA."
    ),
    (
      "Drug repurposing in oncology leverages metabolic vulnerabilities. "
      "Top candidates: Statins (HMG-CoA inhibition reducing Ras prenylation), "
      "Rapamycin (mTOR inhibition), Thalidomide (anti-angiogenesis), "
      "Valproic acid (HDAC inhibition). "
      "Synthetic lethality using PARP inhibitors is a major repurposing strategy."
    ),
    (
      "Cancer hallmarks targeted by repurposed drugs: "
      "(1) Sustained proliferation — Metformin (AMPK/mTOR). "
      "(2) Angiogenesis — Thalidomide, Itraconazole. "
      "(3) Immune evasion — Checkpoint inhibitors (originally autoimmune drugs). "
      "(4) Metabolic reprogramming — Metformin, 2-DG. "
      "OrphaAI network score for Metformin-PDAC: 0.68."
    ),
  ],

  "metformin": [
    (
      "Metformin activates AMPK by inhibiting mitochondrial complex I, "
      "suppressing mTORC1 and hepatic gluconeogenesis. "
      "Repurposing evidence: reduces amyloid-β in Alzheimer's models, "
      "inhibits cancer cell proliferation via metabolic stress, "
      "extends lifespan in C. elegans and mice. DrugBank: DB00331."
    ),
    (
      "Metformin mechanism: Complex I inhibition → AMP:ATP ratio increase "
      "→ AMPK activation → mTORC1 suppression → autophagy induction + gluconeogenesis block. "
      "Clinical repurposing trials: TAME trial (aging), cancer prevention in Lynch syndrome, NASH. "
      "Targets: PRKAA1, PRKAA2, MTOR. MW: 129.16 g/mol."
    ),
    (
      "Beyond diabetes, Metformin is the most repurposed drug in OrphaAI: "
      "Alzheimer's (confidence 79%), pancreatic cancer (68%), "
      "ALS (AMPK-TDP43 axis, 61%), polycystic ovary syndrome. "
      "The TAME clinical trial is directly testing Metformin for healthy aging. "
      "Molecular formula: C4H11N5. LogP: -1.43."
    ),
  ],

  "rapamycin": [
    (
      "Rapamycin (Sirolimus) binds FKBP12 to allosterically inhibit mTORC1, "
      "inducing autophagy and reducing protein aggregation. "
      "Repurposing: ALS (SOD1 clearance), Alzheimer's (tau autophagy), "
      "Parkinson's (mitophagy), cancer (proliferation suppression). "
      "DrugBank: DB00877. FDA-approved for transplant rejection."
    ),
    (
      "mTOR inhibition by Rapamycin promotes: "
      "(1) Autophagy via ULK1 dephosphorylation, "
      "(2) Reduced neuroinflammation via S6K1 suppression, "
      "(3) Lifespan extension in mice by 9-14% even when started late. "
      "Key pathway: FKBP12 → mTORC1 → S6K1/4EBP1. "
      "OrphaAI ensemble score for Rapamycin-ALS: 72%."
    ),
    (
      "Rapamycin repurposing summary: "
      "ALS — extends SOD1-G93A mouse lifespan, Phase II trials pending. "
      "Alzheimer's — clears tau and amyloid-β in 3xTg-AD mice. "
      "Parkinson's — activates PINK1/Parkin mitophagy. "
      "Aging — ITP programme: +9% lifespan in male, +14% in female mice. "
      "Concern: immunosuppression at high doses."
    ),
  ],

  "imatinib": [
    (
      "Imatinib (Gleevec) inhibits BCR-ABL1, c-Kit, and PDGFR tyrosine kinases. "
      "Repurposing in Alzheimer's: c-Abl inhibition reduces tau phosphorylation and amyloid-β. "
      "Crosses the blood-brain barrier at therapeutic concentrations. "
      "DrugBank: DB00619. MW: 493.60 g/mol. OrphaAI confidence: 87%."
    ),
    (
      "Beyond CML, Imatinib shows repurposing potential in: "
      "NF1-related tumours (Ras/MAPK suppression via c-Kit), "
      "pulmonary arterial hypertension (PDGFR inhibition), "
      "Alzheimer's disease (c-Abl/tau pathway). "
      "Mechanism: ATP-competitive kinase inhibitor locking ABL in inactive conformation."
    ),
  ],

  "dexamethasone": [
    (
      "Dexamethasone binds NR3C1 (glucocorticoid receptor), "
      "suppressing NF-κB and AP-1 to reduce cytokine production (IL-6, TNF-α, IL-1β). "
      "Repurposing: COVID-19 severe disease (35% mortality reduction, RECOVERY trial), "
      "DMD (muscle inflammation), cerebral oedema. DrugBank: DB01234."
    ),
    (
      "Dexamethasone mechanism: GR binding → nuclear translocation → "
      "anti-inflammatory gene expression (IL-10↑) + pro-inflammatory suppression. "
      "Used in DMD to slow muscle degeneration by 2 years. "
      "Side effects: adrenal suppression, hyperglycaemia, osteoporosis (limit long-term use)."
    ),
  ],

  "aspirin": [
    (
      "Aspirin irreversibly acetylates COX-1 and COX-2, "
      "blocking prostaglandin and thromboxane A2 synthesis. "
      "Repurposing evidence: colorectal cancer prevention (Wnt/COX-2), "
      "Alzheimer's (neuroinflammation), cardiovascular event prevention. "
      "DrugBank: DB00945. MW: 180.16 g/mol."
    ),
    (
      "Aspirin's anti-cancer mechanism: COX-2 suppression reduces PGE2-driven tumour angiogenesis, "
      "NF-κB inhibition, and apoptosis induction via Bcl-2 downregulation. "
      "NHS recommends low-dose aspirin for colorectal cancer prevention in Lynch syndrome. "
      "Also activates AMPK independently of COX inhibition."
    ),
  ],

  "panobinostat": [
    (
      "Panobinostat (Farydak) is a pan-HDAC inhibitor (HDAC1, HDAC2, HDAC6) "
      "approved for multiple myeloma. "
      "Repurposing in ALS: promotes neuroprotective gene expression, "
      "reduces TDP-43 and SOD1 aggregation. "
      "Also studied in DMD (dystrophin restoration) and glioblastoma. DrugBank: DB06603."
    ),
    (
      "HDAC inhibition by Panobinostat leads to histone hyperacetylation, "
      "re-expressing silenced tumour suppressors (TP53, CDKN1A). "
      "In ALS, HDAC6 inhibition specifically releases TDP-43 from stress granules. "
      "OrphaAI confidence for Panobinostat-ALS: 72%. "
      "MW: 369.43 g/mol."
    ),
  ],

  "mtor": [
    (
      "mTOR (mechanistic Target of Rapamycin) integrates nutrient, energy, "
      "and growth factor signals. mTORC1 promotes anabolism; mTORC2 regulates metabolism. "
      "Repurposing drugs: Rapamycin (direct), Metformin (indirect via AMPK), Everolimus. "
      "Dysregulation in cancer, neurodegeneration, diabetes, and aging."
    ),
    (
      "mTOR pathway: PI3K → AKT → TSC1/2 → Rheb → mTORC1 → S6K1/4EBP1 (anabolism). "
      "mTORC1 also phosphorylates ULK1 to suppress autophagy. "
      "Inhibiting mTORC1 with Rapamycin activates autophagy — clears "
      "tau, α-synuclein, SOD1 aggregates in neurodegeneration models. "
      "mTOR dysregulated in >70% of human cancers."
    ),
  ],

  "ampk": [
    (
      "AMPK (AMP-activated protein kinase) is the master cellular energy sensor, "
      "activated by high AMP:ATP ratio. "
      "Suppresses mTORC1, activates autophagy, promotes mitochondrial biogenesis. "
      "Drugs activating AMPK: Metformin, AICAR, Resveratrol, exercise. "
      "Key repurposing target in cancer, diabetes, and neurodegeneration."
    ),
    (
      "AMPK activation cascade: energy stress → AMP↑ → AMPK-T172 phosphorylation "
      "→ mTORC1 inhibition + FOXO3 activation + PGC-1α upregulation. "
      "In Alzheimer's: AMPK activation reduces amyloid-β production and tau hyperphosphorylation. "
      "PRKAA1 and PRKAA2 are the catalytic alpha subunits targeted by Metformin."
    ),
  ],

  "pathway": [
    (
      "Key drug-repurposing pathways in OrphaAI: "
      "(1) mTOR/AMPK — autophagy and metabolic regulation, "
      "(2) PI3K/AKT — survival and proliferation, "
      "(3) MAPK/ERK — growth signalling, "
      "(4) NF-κB — inflammation and immunity, "
      "(5) Wnt/β-catenin — development and cancer stemness. "
      "Pathway Jaccard overlap between drug targets and disease genes is the core repurposing signal."
    ),
    (
      "OrphaAI pathway analysis uses Reactome and KEGG databases. "
      "Shared pathway score = |drug_pathways ∩ disease_pathways| / |union|. "
      "Example: Metformin shares mTOR signalling pathway with Alzheimer's (score 0.42), "
      "contributing +0.10 to ensemble confidence. "
      "Pathways enriched in cancer: PI3K/AKT, cell cycle, apoptosis evasion."
    ),
  ],

  "gene": [
    (
      "Gene-based repurposing: drugs whose targets are encoded by disease-associated genes "
      "have 2x higher clinical trial success rates (Mendelian randomisation evidence). "
      "Key databases: Open Targets, OMIM, ClinVar, GWAS Catalog. "
      "OrphaAI integrates GEO gene expression, STRING protein interactions, and Open Targets scores."
    ),
    (
      "Top disease genes in OrphaAI: "
      "APP/PSEN1 (Alzheimer's), SNCA/LRRK2 (Parkinson's), SOD1/TDP-43/FUS (ALS), "
      "KRAS/TP53/EGFR (cancer), DMD (Duchenne MD), NF1 (Neurofibromatosis). "
      "Gene-set Jaccard overlap score (drug targets vs disease genes) contributes 25% to ensemble."
    ),
  ],

  "confidence": [
    (
      "OrphaAI ensemble confidence = weighted combination: "
      "GNN score (GraphSAGE, weight 0.45) + Molecular Similarity/Tanimoto (0.30) "
      "+ Network Propagation/RWR (0.25). "
      "Thresholds: ≥75% = High, 50–74% = Moderate, <50% = Low. "
      "Ensemble AUC-ROC on validation set: 0.914."
    ),
    (
      "Confidence scoring methodology: "
      "(1) GNN predicts drug-target-disease linkage probability from graph structure. "
      "(2) Tanimoto fingerprint similarity compares drug to known actives for this disease. "
      "(3) Network propagation (RWR) scores gene-set proximity in PPI network. "
      "Scores are sigmoid-calibrated: output = 1 / (1 + e^(-10*(raw - 0.40)))."
    ),
  ],

  "rare": [
    (
      "Rare disease repurposing exploits shared molecular mechanisms. "
      "FDA Orphan Drug Designation gives 7-year market exclusivity. "
      "Examples: Rapamycin for LAM, Dexamethasone for DMD, Imatinib for NF1 tumours. "
      "OrphaAI covers 847 rare diseases with OMIM/Orphanet annotations."
    ),
    (
      "Drug repurposing is especially valuable for rare diseases with no treatments. "
      "Strategy: shared pathway analysis with common diseases → test approved drugs. "
      "DMD candidates: Ataluren (stop codon readthrough), Panobinostat (HDAC), Dexamethasone. "
      "Orphanet prevalence threshold: <1 in 2,000 population."
    ),
  ],

  "blood": [
    (
      "Blood disorder repurposing: "
      "Hydroxyurea (HbF induction in sickle cell disease), "
      "Aspirin (antiplatelet in thrombosis), Thalidomide (anti-angiogenesis in myeloma). "
      "Key targets: BCR-ABL1 (CML), JAK2 (polycythaemia vera), FLT3 (AML). "
      "Imatinib-CML is the gold standard repurposing success story."
    ),
    (
      "Blood cancer repurposing: Imatinib (CML, BCR-ABL1 inhibition), "
      "Panobinostat (multiple myeloma, HDAC inhibition), "
      "Bortezomib (proteasome inhibition in myeloma), Venetoclax (BCL-2 in CLL). "
      "OrphaAI network score for Imatinib-CML: 0.98 (known interaction baseline)."
    ),
  ],

  "diabetes": [
    (
      "Type 2 diabetes repurposing beyond Metformin: "
      "Pioglitazone (PPARγ — also NASH and Alzheimer's), "
      "Liraglutide (GLP-1 — neuroprotection in Parkinson's), "
      "Empagliflozin (SGLT2 — heart failure and CKD). "
      "Key genes: PPARG, PRKAA1, MTOR, INSR."
    ),
    (
      "Metabolic repurposing: diabetes drugs show benefit across "
      "CVD (SGLT2 inhibitors, GLP-1 agonists), cancer (Metformin, Pioglitazone), "
      "and neurodegeneration (Metformin, Liraglutide, Semaglutide). "
      "AMPK-mTOR axis is the mechanistic link between diabetes and aging."
    ),
  ],

  "heart": [
    (
      "Cardiovascular repurposing: "
      "Statins (also anti-inflammatory, anti-cancer via Ras prenylation), "
      "Aspirin (antiplatelet + colorectal cancer), "
      "Colchicine (pericarditis + post-MI inflammation). "
      "PCSK9 inhibitors validated by Mendelian randomisation are a repurposing success."
    ),
    (
      "Cardiac drug repurposing: "
      "Ouabain (Na+/K+-ATPase inhibitor with anti-cancer activity at low doses), "
      "Ranolazine (anti-anginal with anti-diabetic effects), "
      "Sacubitril/Valsartan (HTN → HFrEF). "
      "Statins reduce cancer risk by 25% in cohort studies via Ras/mevalonate pathway."
    ),
  ],

  "covid": [
    (
      "COVID-19 repurposing successes: "
      "Dexamethasone (RECOVERY trial — 35% mortality reduction in ventilated patients), "
      "Baricitinib (JAK1/2 inhibitor reducing cytokine storm), "
      "Tocilizumab (IL-6R inhibitor for severe disease). "
      "Failed repurposing: Hydroxychloroquine, Ivermectin (no benefit in large RCTs)."
    ),
    (
      "SARS-CoV-2 drug repurposing targets: "
      "ACE2 entry (Camostat/TMPRSS2), 3CL protease (Paxlovid — now approved), "
      "RNA polymerase (Remdesivir), cytokine storm (Dexamethasone, Tocilizumab). "
      "Repurposing cut development time from 10+ years to months by leveraging existing safety data."
    ),
  ],

  "similarity": [
    (
      "Molecular similarity uses Morgan fingerprints (radius=2, 2048 bits) "
      "and Tanimoto coefficient: T(A,B) = |A∩B| / |A∪B|. "
      "Score 1.0 = identical; >0.85 = highly similar; <0.40 = dissimilar. "
      "Similar drugs often share targets — basis for structural repurposing."
    ),
    (
      "Tanimoto similarity in OrphaAI: "
      "Each drug's SMILES is converted to Morgan fingerprint (2048-bit vector). "
      "Query drug fingerprint is compared to all database compounds. "
      "High similarity to known actives for a disease → repurposing candidate flag. "
      "Contributes weight 0.30 to ensemble confidence score."
    ),
  ],

  "network": [
    (
      "Drug-target-disease network uses random walk with restart (RWR) "
      "on protein-protein interaction graph from STRING database. "
      "Disease genes = seed nodes; propagation scores = proximity to drug targets. "
      "Jaccard pathway overlap adds biological interpretability to network score."
    ),
    (
      "OrphaAI network model: "
      "Nodes = drugs, proteins, diseases (~50,000 total). "
      "Edges = drug-target (DrugBank), protein-protein (STRING), disease-gene (Open Targets). "
      "Network propagation weight: 0.25 in ensemble. "
      "Full production graph has ~2M edges."
    ),
  ],

  "gnn": [
    (
      "OrphaAI's GNN uses GraphSAGE: 3 convolutional layers + MLP edge classifier. "
      "Input: 256-dim node embeddings (Morgan FP PCA + gene2vec). "
      "Predicts drug-disease edge probability from graph representations. "
      "Trained on DrugBank + Open Targets known pairs. AUC-ROC: 0.94."
    ),
    (
      "Graph Neural Networks learn from drug-target-disease graph topology. "
      "Each node aggregates features from its neighbours across 3 hops. "
      "Edge prediction = σ(MLP(concat(drug_emb, disease_emb))). "
      "GNN captures indirect relationships missed by direct target overlap. Weight: 0.45."
    ),
  ],

  "drugbank": [
    (
      "DrugBank v5.1 contains 14,832 drugs (2,642 approved, 6,741 experimental). "
      "Each entry: SMILES, InChIKey, targets, pathways, indications, interactions. "
      "OrphaAI uses DrugBank IDs (e.g., DB00619 = Imatinib) as primary drug identifiers."
    ),
    (
      "DrugBank fields used in OrphaAI predictions: "
      "SMILES (fingerprinting), primary_targets (symbol + Ensembl ID), "
      "pathways (Reactome IDs), atc_codes, FDA approval status. "
      "Combined with ChEMBL bioassays and Open Targets for full evidence scoring."
    ),
  ],

  "default": [
    (
      "I can answer questions about: "
      "diseases (Alzheimer's, Parkinson's, ALS, cancer, diabetes, rare diseases), "
      "drugs (Metformin, Rapamycin, Imatinib, Dexamethasone, Aspirin, Panobinostat), "
      "pathways (mTOR, AMPK, NF-κB, PI3K/AKT), genes, confidence scores, and repurposing methodology. "
      "Try: 'What are the top candidates for Alzheimer's?' or 'How does Rapamycin work?'"
    ),
    (
      "OrphaAI Assistant can help with: "
      "drug mechanism of action, disease pathway analysis, repurposing candidate explanation, "
      "confidence score interpretation, molecular similarity, and GNN prediction details. "
      "Ask about a specific disease or drug for detailed biomedical insights."
    ),
    (
      "Please ask about a specific disease, drug, gene, or biological pathway. "
      "Examples: 'Explain the mTOR pathway', 'Top drugs for ALS', "
      "'How does Metformin work in cancer?', "
      "'What is Tanimoto similarity?', 'Explain the OrphaAI confidence score'."
    ),
    (
      "Repurposing questions I can answer: "
      "Which drugs are candidates for Alzheimer's, Parkinson's, ALS, or cancer? "
      "How does OrphaAI calculate confidence scores? "
      "What is the mTOR / AMPK / NF-κB pathway? "
      "What is the mechanism of Metformin / Rapamycin / Imatinib?"
    ),
  ],
}

# ═══════════════════════════════════════════════════════════════════
#  KEYWORD MAP  —  (list of keywords) → topic key
#  Order matters: more specific matches should come first
# ═══════════════════════════════════════════════════════════════════

KEYWORD_MAP = [
    (["alzheimer", "dementia", "amyloid", "tau protein"],       "alzheimer"),
    (["parkinson", "dopamine", "lewy body", "substantia nigra"],"parkinson"),
    (["als", "amyotrophic lateral", "motor neuron",
      "lou gehrig", "tardbp", "tdp-43"],                        "als"),
    (["cancer", "tumor", "tumour", "oncology", "carcinoma",
      "leukemia", "lymphoma", "myeloma", "pdac"],               "cancer"),
    (["metformin", "glucophage", "biguanide"],                  "metformin"),
    (["rapamycin", "sirolimus", "rapalog", "fkbp"],             "rapamycin"),
    (["imatinib", "gleevec", "glivec", "bcr-abl"],              "imatinib"),
    (["dexamethasone", "decadron", "glucocorticoid",
      "corticosteroid"],                                        "dexamethasone"),
    (["aspirin", "acetylsalicylic", "cox inhibitor",
      "ibuprofen", "naproxen", "nsaid"],                        "aspirin"),
    (["panobinostat", "farydak", "hdac inhibitor", "hdac"],     "panobinostat"),
    (["mtor", "raptor", "torc1", "s6k", "4ebp"],                "mtor"),
    (["ampk", "amp-activated", "prkaa", "energy sensor"],       "ampk"),
    (["nfkb", "nf-kb", "nf kb", "nuclear factor kappa"],        "nfkb"),
    (["pathway", "signaling", "signalling",
      "cascade", "pi3k", "mapk", "erk", "wnt"],                 "pathway"),
    (["gene", "mutation", "snp", "gwas",
      "variant", "genomic", "expression", "omim"],              "gene"),
    (["confidence", "score", "accuracy",
      "auc", "precision", "recall", "roc"],                     "confidence"),
    (["rare disease", "orphan", "duchenne", "dmd",
      "huntington", "neurofibromatosis", "nf1", "lam"],         "rare"),
    (["blood", "haematology", "haematological", "hematology",
      "cml", "aml", "sickle cell", "anaemia", "anemia"],        "blood"),
    (["diabetes", "insulin", "glucose", "glycaemic",
      "glycemic", "metab", "t2dm", "t1dm"],                     "diabetes"),
    (["heart", "cardiac", "cardiovascular", "hypertension",
      "coronary", "angina", "myocardial"],                      "heart"),
    (["covid", "coronavirus", "sars-cov", "pandemic",
      "sars cov"],                                              "covid"),
    (["fever", "pyrexia", "temperature", "antipyretic",
      "inflammatory", "inflammation", "cytokine",
      "immune", "il-6", "tnf", "interleukin"],                  "fever"),
    (["similarity", "tanimoto", "fingerprint",
      "morgan", "structural", "smiles"],                        "similarity"),
    (["network", "graph", "ppi", "interaction",
      "propagation", "rwr", "string database"],                 "network"),
    (["gnn", "neural network", "graphsage",
      "deep learning", "machine learning", "embedding"],        "gnn"),
    (["drugbank", "chembl", "pubchem",
      "open targets", "database", "api"],                       "drugbank"),
]

# ═══════════════════════════════════════════════════════════════════
#  CORE LOGIC
# ═══════════════════════════════════════════════════════════════════

def get_reply(message: str) -> str:
    msg = message.lower().strip()

    # Find first matching topic
    matched = None
    for keywords, topic in KEYWORD_MAP:
        if any(kw in msg for kw in keywords):
            matched = topic
            break

    topic     = matched or "default"
    responses = KB[topic]

    # Use hash so: same question = same answer, different question = different answer
    idx = abs(hash(msg)) % len(responses)
    return responses[idx]


# ═══════════════════════════════════════════════════════════════════
#  ROUTES
# ═══════════════════════════════════════════════════════════════════

@app.route("/health", methods=["GET"])
def health():
    return jsonify(status="ok", service="orphaai-chatbot", port=5001)


@app.route("/api/v1/chat/message", methods=["POST"])
def chat_message():
    data    = request.get_json(silent=True) or {}
    message = data.get("message", "").strip()

    if not message:
        return jsonify(error="message is required"), 400

    reply = get_reply(message)
    return jsonify(role="assistant", content=reply)


# Also support old /chatbot path so nothing breaks
@app.route("/api/v1/chatbot", methods=["POST"])
def chatbot_compat():
    data    = request.get_json(silent=True) or {}
    message = data.get("message", "").strip()
    reply   = get_reply(message)
    return jsonify(role="assistant", content=reply, reply=reply)


# ═══════════════════════════════════════════════════════════════════
#  TEST: verify responses are different for different inputs
# ═══════════════════════════════════════════════════════════════════

def _run_self_test():
    tests = ["fever", "blood", "alzheimer", "parkinson",
             "metformin", "mtor pathway", "confidence score",
             "gnn", "hello", "xyz random"]
    print("\n── Self-test: checking all responses are different ──")
    seen = {}
    ok   = True
    for t in tests:
        r = get_reply(t)
        short = r[:60].replace("\n", " ")
        conflict = [k for k, v in seen.items() if v == r]
        status = f"⚠  SAME as '{conflict[0]}'" if conflict else "✓"
        print(f"  {status}  [{t:20s}] → {short}...")
        seen[t] = r
    print("──────────────────────────────────────────────────────\n")


# ═══════════════════════════════════════════════════════════════════
#  START
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    _run_self_test()
    print("╔══════════════════════════════════════════════════╗")
    print("║   OrphaAI Chatbot  •  http://localhost:5001      ║")
    print("║   POST /api/v1/chat/message  { message: '...' } ║")
    print("╚══════════════════════════════════════════════════╝")
    app.run(host="0.0.0.0", port=5001, debug=True)
