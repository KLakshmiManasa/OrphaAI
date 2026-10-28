"""
Interaction Network Graph Page Object
Covers tripartite interactome, drug radial view, mechanism filters, and docked inspector card.
"""

from selenium.webdriver.common.by import By
from pages.base_page import BasePage


class NetworkPage(BasePage):
    GRAPH_CANVAS = (By.XPATH, "//div[contains(@class, 'min-h-[340px]') or contains(@style, 'height')]//canvas | //div//svg")
    NETWORK_INSPECTOR_CARD = (By.XPATH, "//*[contains(text(), 'Network Inspector')]/ancestor::div[contains(@class, 'rounded-2xl') or contains(@style, 'border')]")
    
    FILTER_ALL = (By.XPATH, "//button[contains(text(), 'All Mechanisms')]")
    FILTER_INHIBITOR = (By.XPATH, "//button[contains(text(), 'Inhibitor')]")
    FILTER_ACTIVATOR = (By.XPATH, "//button[contains(text(), 'Activator') or contains(text(), 'Agonist')]")
    
    LEGEND_CARD = (By.XPATH, "//*[contains(text(), 'Edge Direction') or contains(text(), 'Disease Target')]")
    DISEASE_SELECT_DROPDOWN = (By.XPATH, "//select | //div[contains(@class, 'select')]")

    def filter_by_inhibitors(self):
        self.click(self.FILTER_INHIBITOR)

    def filter_by_activators(self):
        self.click(self.FILTER_ACTIVATOR)

    def filter_all(self):
        self.click(self.FILTER_ALL)

