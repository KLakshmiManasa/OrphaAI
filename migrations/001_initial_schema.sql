-- OrphaAI Institutional Database Schema Migration
-- Migration: 001_initial_schema.sql
-- Target: SQLite / PostgreSQL compatible schema for scientific drug repurposing provenance

BEGIN TRANSACTION;

-- 1. Disease Table (MeSH / MONDO Ontologies)
CREATE TABLE IF NOT EXISTS diseases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    mesh_id VARCHAR(50),
    mondo_id VARCHAR(50),
    disease_area VARCHAR(255),
    synonyms JSON DEFAULT '[]'
);

-- 2. Drug Table (InChIKey, SMILES, PubChem)
CREATE TABLE IF NOT EXISTS drugs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    inchikey VARCHAR(50),
    smiles TEXT,
    pubchem_cid VARCHAR(50),
    clinical_phase_highest VARCHAR(100) DEFAULT 'Investigational'
);

-- 3. TargetGene Table (UniProt Mapping)
CREATE TABLE IF NOT EXISTS target_genes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol VARCHAR(100) NOT NULL,
    uniprot_id VARCHAR(50),
    full_name VARCHAR(255)
);

-- 4. RepurposingEvidence Table (Normalized Tiers & Negative Controls)
CREATE TABLE IF NOT EXISTS repurposing_evidences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    disease_id INTEGER NOT NULL,
    drug_id INTEGER NOT NULL,
    target_id INTEGER,
    evidence_tier VARCHAR(100) NOT NULL,
    mechanism_of_action TEXT DEFAULT '',
    citation_pmid VARCHAR(100),
    nct_id VARCHAR(100),
    data_source VARCHAR(100) NOT NULL DEFAULT 'Broad Repurposing Hub v2025',
    FOREIGN KEY (disease_id) REFERENCES diseases (id) ON DELETE CASCADE,
    FOREIGN KEY (drug_id) REFERENCES drugs (id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES target_genes (id) ON DELETE CASCADE
);

-- Performance Indexes (Required by OrphaAI Specifications)
CREATE INDEX IF NOT EXISTS idx_disease_name ON diseases (name);
CREATE INDEX IF NOT EXISTS idx_drug_name ON drugs (name);
CREATE INDEX IF NOT EXISTS idx_target_gene_symbol ON target_genes (symbol);
CREATE INDEX IF NOT EXISTS idx_evidence_tier ON repurposing_evidences (evidence_tier);

COMMIT;
