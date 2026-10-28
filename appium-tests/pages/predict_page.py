"""
Predictor Page Object
Covers indication search, autocomplete suggestions, candidate ranking, dossiers, and PDF/CSV exports.
"""

from selenium.webdriver.common.by import By
from pages.base_page import BasePage


class PredictPage(BasePage):
    AUTOCOMPLETE_INPUT = (By.XPATH, "//input[contains(@placeholder, 'Search or enter a disease')]")
    RUN_PREDICTION_BUTTON = (By.XPATH, "//button[contains(text(), 'Run Prediction')]")
    EXAMPLE_PILL_ALZHEIMER = (By.XPATH, "//button[contains(text(), \"Alzheimer's Disease\")]")
    EXAMPLE_PILL_ALS = (By.XPATH, "//button[contains(text(), 'Amyotrophic Lateral Sclerosis')]")
    
    CANDIDATE_CARDS = (By.XPATH, "//div[contains(@class, 'candidate-card') or contains(@style, 'border-radius: 16px')]")
    FIRST_CANDIDATE_CARD = (By.XPATH, "(//div[contains(@style, 'border-radius: 16px')])[1]")
    
    DOSSIER_EXPAND_BUTTON = (By.XPATH, "(//button[contains(text(), 'Evidence') or contains(text(), 'Dossier') or contains(text(), 'Details')])[1]")
    CNS_MPO_SCORE = (By.XPATH, "//*[contains(text(), 'CNS MPO') or contains(text(), 'Blood-Brain Barrier')]")
    
    EXPORT_PDF_BUTTON = (By.XPATH, "//button[contains(text(), 'Download PDF Dossier') or contains(text(), 'PDF')]")
    EXPORT_CSV_BUTTON = (By.XPATH, "//button[contains(text(), 'Export Raw Data (.CSV)') or contains(text(), 'CSV')]")

    def run_prediction_for(self, disease_name: str):
        self.type_text(self.AUTOCOMPLETE_INPUT, disease_name)
        time_pill = (By.XPATH, f"//div[contains(text(), '{disease_name}')]")
        if self.is_displayed(time_pill):
            self.click(time_pill)
        self.click(self.RUN_PREDICTION_BUTTON)

    def select_example_alzheimers(self):
        self.click(self.EXAMPLE_PILL_ALZHEIMER)

    def trigger_pdf_export(self):
        self.click(self.EXPORT_PDF_BUTTON)

    def trigger_csv_export(self):
        self.click(self.EXPORT_CSV_BUTTON)

