"""
Navbar & Navigation Page Object
Covers sticky header, brand logo, hamburger drawer, and route transitions.
"""

from selenium.webdriver.common.by import By
from pages.base_page import BasePage


class NavbarPage(BasePage):
    # Locators
    BRAND_LOGO = (By.XPATH, "//*[contains(text(), 'Orpha') and contains(text(), 'AI')]")
    HAMBURGER_BUTTON = (By.XPATH, "//button[@aria-label='Toggle navigation menu']")
    DRAWER_CONTAINER = (By.XPATH, "//div[contains(@style, 'position: fixed') or contains(@class, 'drawer')]")
    
    NAV_HOME = (By.XPATH, "//button[contains(text(), 'Home') or text()='Home']")
    NAV_PREDICT = (By.XPATH, "//button[contains(text(), 'Predict') or text()='Predict']")
    NAV_NETWORK = (By.XPATH, "//button[contains(text(), 'Interaction Network') or text()='Interaction Network']")
    NAV_DRUGS = (By.XPATH, "//button[contains(text(), 'Drug Library') or text()='Drug Library']")
    NAV_DISEASES = (By.XPATH, "//button[contains(text(), 'Disease Library') or text()='Disease Library']")
    
    USER_AVATAR = (By.XPATH, "//div[contains(@style, 'border-radius: 50%') or contains(@class, 'rounded-full')]")
    SIGN_IN_BUTTON = (By.XPATH, "//button[contains(text(), 'Sign In')]")

    def open_drawer(self):
        if not self.is_displayed(self.NAV_HOME):
            self.click(self.HAMBURGER_BUTTON)

    def navigate_to(self, tab_name: str):
        self.open_drawer()
        tab_map = {
            "home": self.NAV_HOME,
            "predict": self.NAV_PREDICT,
            "network": self.NAV_NETWORK,
            "drugs": self.NAV_DRUGS,
            "diseases": self.NAV_DISEASES,
        }
        target = tab_map.get(tab_name.lower())
        if target:
            self.click(target)

