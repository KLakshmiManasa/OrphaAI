"""
OrphaAI — Formalized Database Models
Standardized biomedical schema for institutional-grade drug repurposing research.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, JSON, Index
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Disease(Base):
    __tablename__ = "diseases"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    name             = Column(String(255), nullable=False, index=True)
    mesh_id          = Column(String(50), nullable=True, index=True)   # e.g., MeSH:D010300
    mondo_id         = Column(String(50), nullable=True, index=True)   # e.g., MONDO:0005180
    disease_area     = Column(String(255), nullable=True)
    synonyms         = Column(JSON, default=list)                     # JSON array of aliases

    omim_id          = Column(String(30), nullable=True, index=True)
    efo_id           = Column(String(30), nullable=True, index=True)
    icd10_code       = Column(String(20), nullable=True)
    description      = Column(Text, default="")
    disease_type     = Column(String(50), nullable=True, index=True)
    associated_genes = Column(JSON, default=list)
    pathways         = Column(JSON, default=list)
    is_rare          = Column(Boolean, default=False)
    created_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    evidences        = relationship("RepurposingEvidence", back_populates="disease", cascade="all, delete-orphan")

    def to_dict(self, full=False):
        d = {
            "id": self.id,
            "name": self.name,
            "mesh_id": self.mesh_id,
            "mondo_id": self.mondo_id,
            "disease_area": self.disease_area,
            "synonyms": self.synonyms or [],
            "omimId": self.omim_id,
            "efoId": self.efo_id,
            "icd10Code": self.icd10_code,
            "diseaseType": self.disease_type,
            "isRare": self.is_rare,
            "associatedGenes": self.associated_genes or [],
        }
        if full:
            d.update({
                "description": self.description,
                "pathways": self.pathways or [],
            })
        return d


class Drug(Base):
    __tablename__ = "drugs"

    id                     = Column(Integer, primary_key=True, autoincrement=True)
    name                   = Column(String(255), nullable=False, index=True)
    drugbank_id            = Column(String(50), nullable=True, index=True)
    chembl_id              = Column(String(50), nullable=True, index=True)
    inchikey               = Column(String(50), nullable=True, index=True)
    smiles                 = Column(Text, nullable=True)
    pubchem_cid            = Column(String(50), nullable=True, index=True)
    clinical_phase_highest = Column(String(100), default="Investigational")

    brand_names            = Column(JSON, default=list)
    description            = Column(Text, default="")
    indication             = Column(Text, default="")
    drug_class             = Column(String(255), default="")
    mechanism              = Column(Text, default="")
    molecular_formula      = Column(String(100), default="")
    molecular_weight       = Column(Float, nullable=True)
    logp                   = Column(Float, nullable=True)
    status                 = Column(String(50), index=True, default="approved")
    fda_year               = Column(Integer, nullable=True)
    primary_targets        = Column(JSON, default=list)
    pathways               = Column(JSON, default=list)
    atc_codes              = Column(JSON, default=list)
    source                 = Column(String(50), default="manual")
    created_at             = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    evidences              = relationship("RepurposingEvidence", back_populates="drug", cascade="all, delete-orphan")

    def to_dict(self, full=False):
        d = {
            "id": self.id,
            "drugbankId": self.drugbank_id,
            "chemblId": self.chembl_id,
            "name": self.name,
            "inchikey": self.inchikey,
            "smiles": self.smiles,
            "pubchem_cid": self.pubchem_cid,
            "clinical_phase_highest": self.clinical_phase_highest,
            "brandNames": self.brand_names or [],
            "drugClass": self.drug_class,
            "indication": self.indication,
            "status": self.status,
            "molecularWeight": self.molecular_weight,
            "primaryTargets": self.primary_targets or [],
        }
        if full:
            d.update({
                "description": self.description,
                "mechanism": self.mechanism,
                "molecularFormula": self.molecular_formula,
                "logp": self.logp,
                "atcCodes": self.atc_codes or [],
                "pathways": self.pathways or [],
                "fdaYear": self.fda_year,
            })
        return d


class TargetGene(Base):
    __tablename__ = "target_genes"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    symbol     = Column(String(100), nullable=False, index=True)  # e.g. EGFR
    uniprot_id = Column(String(50), nullable=True, index=True)   # e.g. P00533
    full_name  = Column(String(255), nullable=True)

    evidences  = relationship("RepurposingEvidence", back_populates="target_gene", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "symbol": self.symbol,
            "uniprot_id": self.uniprot_id,
            "full_name": self.full_name,
        }


class RepurposingEvidence(Base):
    __tablename__ = "repurposing_evidences"

    id                   = Column(Integer, primary_key=True, autoincrement=True)
    disease_id           = Column(Integer, ForeignKey("diseases.id"), nullable=False, index=True)
    drug_id              = Column(Integer, ForeignKey("drugs.id"), nullable=False, index=True)
    target_id            = Column(Integer, ForeignKey("target_genes.id"), nullable=True, index=True)

    evidence_tier        = Column(String(100), nullable=False, index=True)
    mechanism_of_action  = Column(Text, default="")
    citation_pmid        = Column(String(100), nullable=True)
    nct_id               = Column(String(100), nullable=True)
    data_source          = Column(String(100), nullable=False, default="Broad Repurposing Hub v2025")

    disease              = relationship("Disease", back_populates="evidences")
    drug                 = relationship("Drug", back_populates="evidences")
    target_gene          = relationship("TargetGene", back_populates="evidences")

    def to_dict(self):
        return {
            "id": self.id,
            "disease_id": self.disease_id,
            "drug_id": self.drug_id,
            "target_id": self.target_id,
            "disease_name": self.disease.name if self.disease else None,
            "drug_name": self.drug.name if self.drug else None,
            "target_symbol": self.target_gene.symbol if self.target_gene else None,
            "evidence_tier": self.evidence_tier,
            "mechanism_of_action": self.mechanism_of_action,
            "citation_pmid": self.citation_pmid,
            "nct_id": self.nct_id,
            "data_source": self.data_source,
        }


idx_disease_name = Index("idx_disease_name", Disease.name)
idx_drug_name = Index("idx_drug_name", Drug.name)
idx_target_symbol = Index("idx_target_gene_symbol", TargetGene.symbol)
idx_evidence_tier = Index("idx_evidence_tier", RepurposingEvidence.evidence_tier)
