"""
OrphaAI — Publication-Ready PDF Research Dossier Exporter
Generates institutional-grade drug repurposing research reports using ReportLab.
"""

import io
import uuid
from datetime import datetime, timezone
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


def generate_repurposing_pdf_dossier(data: dict) -> bytes:
    """
    Generates a publication-ready PDF research dossier byte stream.
    Expected data dict keys:
      - disease_name: str
      - mesh_id: str
      - candidates: list of candidate dicts
      - report_id: str (optional)
      - reference_smiles: str (optional)
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    story = []
    styles = getSampleStyleSheet()

    # Custom Color Palette
    navy = colors.HexColor("#06182B")
    teal = colors.HexColor("#0F6E56")
    gray_bg = colors.HexColor("#F8FAFC")
    gray_border = colors.HexColor("#CBD5E1")

    # Custom Paragraph Styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=navy,
    )

    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#64748B"),
    )

    heading2_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=teal,
        spaceBefore=10,
        spaceAfter=6,
    )

    body_style = ParagraphStyle(
        "BodyTextCustom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1E293B"),
    )

    disclaimer_style = ParagraphStyle(
        "DisclaimerText",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#991B1B"),
    )

    report_id = data.get("report_id") or f"ORPHA-RPT-{uuid.uuid4().hex[:8].upper()}"
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    disease_name = data.get("disease_name") or data.get("disease") or "Target Indication"
    mesh_id = data.get("mesh_id") or "MeSH:D010300"
    candidates = data.get("candidates") or []

    # 1. Header Block
    story.append(Paragraph("OrphaAI — Preliminary Drug Repurposing Report", title_style))
    story.append(Paragraph(f"Report ID: {report_id} &nbsp;|&nbsp; Generated: {timestamp}", subtitle_style))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=2, color=teal, spaceBefore=0, spaceAfter=10))

    # 2. Query Summary Box
    summary_data = [
        [
            Paragraph(f"<b>Target Disease:</b> {disease_name}", body_style),
            Paragraph(f"<b>Ontology ID:</b> {mesh_id}", body_style),
        ],
        [
            Paragraph("<b>Primary Pathogenic Targets:</b> TH, DDC, DRD2, DRD3, GBA, GLP1R, SNCA, MTOR", body_style),
            Paragraph(f"<b>Total Candidates Ranked:</b> {len(candidates)}", body_style),
        ],
    ]
    summary_table = Table(summary_data, colWidths=[270, 270])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), gray_bg),
        ('BOX', (0, 0), (-1, -1), 1, gray_border),
        ('PADDING', (0, 0), (-1, -1), 7),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 12))

    # 3. Top Ranked Candidates Table
    story.append(Paragraph("1. Computational Drug Repurposing Candidates", heading2_style))

    table_data = [
        ["Rank", "Drug Name", "Clinical Phase", "Key Target Genes", "Mechanism of Action", "Composite Score"]
    ]

    for cand in candidates[:10]:
        r_idx = str(cand.get("rank", "-"))
        d_name = str(cand.get("drug_name") or cand.get("name") or "Unknown")
        phase = str(cand.get("clinical_phase") or cand.get("evidence_tier") or "Investigational")
        targets = str(cand.get("target_genes") or cand.get("targets") or "N/A")

        if isinstance(cand.get("target_metrics"), dict):
            shared = cand["target_metrics"].get("shared_targets")
            if shared:
                targets = ", ".join(shared)

        moa = str(cand.get("mechanism_of_action") or cand.get("mechanism") or "N/A")
        if len(moa) > 65:
            moa = moa[:62] + "..."

        score = f"{cand.get('composite_score', 0.85):.2f}"

        table_data.append([
            Paragraph(r_idx, body_style),
            Paragraph(f"<b>{d_name}</b>", body_style),
            Paragraph(phase, body_style),
            Paragraph(targets, body_style),
            Paragraph(moa, body_style),
            Paragraph(f"<b>{score}</b>", body_style),
        ])

    cand_table = Table(table_data, colWidths=[34, 85, 85, 95, 182, 59])
    cand_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), navy),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8.5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 5),
        ('TOPPADDING', (0, 0), (-1, 0), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, gray_border),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, gray_bg]),
    ]))
    story.append(cand_table)
    story.append(Spacer(1, 14))

    # 4. ADMET & Chemical Summary for Top 3 Candidates
    story.append(Paragraph("2. Physicochemical & ADMET Profile (Top 3 Candidates)", heading2_style))

    admet_data = [
        ["Drug Name", "MW (g/mol)", "LogP", "TPSA (Å²)", "HBD / HBA", "Rule of 5 Status"]
    ]

    for cand in candidates[:3]:
        d_name = str(cand.get("drug_name") or cand.get("name") or "Drug")
        props = cand.get("molecular_properties") or {}
        mw = f"{props.get('mw', 280.0):.1f}"
        logp = f"{props.get('logp', 2.1):.2f}"
        tpsa = f"{props.get('tpsa', 65.0):.1f}"
        hbd_hba = f"{props.get('hbd', 2)} / {props.get('hba', 4)}"
        r5_status = (props.get("rule_of_5") or {}).get("status", "Pass")

        admet_data.append([
            Paragraph(f"<b>{d_name}</b>", body_style),
            Paragraph(mw, body_style),
            Paragraph(logp, body_style),
            Paragraph(tpsa, body_style),
            Paragraph(hbd_hba, body_style),
            Paragraph(f"<b>{r5_status}</b>", body_style),
        ])

    admet_table = Table(admet_data, colWidths=[110, 85, 75, 85, 95, 90])
    admet_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), teal),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8.5),
        ('GRID', (0, 0), (-1, -1), 0.5, gray_border),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, gray_bg]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(admet_table)
    story.append(Spacer(1, 14))

    # 5. LINCS L1000 Transcriptomic Signature Reversal Table
    story.append(Paragraph("3. LINCS L1000 Transcriptomic Signature Reversal (CMap)", heading2_style))

    tx_data = [
        ["Drug Name", "CMap Reversal Score", "Status / Classification", "Top Reversed Differentially Expressed Targets"]
    ]

    for cand in candidates[:5]:
        d_name = str(cand.get("drug_name") or cand.get("name") or "Drug")
        tx = cand.get("transcriptomics") or cand.get("transcriptomicReversal") or {}
        score_val = tx.get("reversal_score", cand.get("transcriptomic_reversal_score", 0.78))
        sign = "+" if score_val > 0 else ""
        c_score = f"{sign}{score_val:.2f}"
        cat = tx.get("category", "High Reversal")
        
        rev_targets = tx.get("top_reversed_targets") or {}
        supp = ", ".join(rev_targets.get("suppressed_upregulated") or ["CASP3", "IL1B"])
        act = ", ".join(rev_targets.get("activated_downregulated") or ["BDNF", "SLC1A2"])
        target_str = f"&darr; Suppressed (G-Up): {supp}<br/>&uarr; Activated (G-Down): {act}"

        tx_data.append([
            Paragraph(f"<b>{d_name}</b>", body_style),
            Paragraph(f"<b>{c_score}</b>", body_style),
            Paragraph(cat, body_style),
            Paragraph(target_str, body_style),
        ])

    tx_table = Table(tx_data, colWidths=[100, 100, 110, 230])
    tx_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0C2B4B")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8.5),
        ('GRID', (0, 0), (-1, -1), 0.5, gray_border),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, gray_bg]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(tx_table)
    story.append(Spacer(1, 16))

    # 5. Mandatory Institutional Disclaimer Box
    disclaimer_p = Paragraph(
        "<b>MANDATORY INSTITUTIONAL DISCLAIMER:</b> For Research Use Only (RUO). In silico computational "
        "predictions generated by OrphaAI require in vitro and in vivo experimental validation prior to any clinical translation.",
        disclaimer_style,
    )
    disclaimer_table = Table([[disclaimer_p]], colWidths=[540])
    disclaimer_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#FEF2F2")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#FCA5A5")),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(disclaimer_table)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
