"""
OrphaAI Copilot Chatbot Page Object
Covers splitting capsule floating launcher, rotation animation, iframe embed, and close button.
"""

from selenium.webdriver.common.by import By
from pages.base_page import BasePage


class ChatbotPage(BasePage):
    CAPSULE_LAUNCHER_BUTTON = (By.XPATH, "//button[@aria-label='Toggle AI Assistant']")
    CHATBOT_MODAL_CONTAINER = (By.XPATH, "//*[contains(text(), 'OrphaAI Copilot')]/ancestor::div[contains(@class, 'rounded-3xl')]")
    COPILOT_HEADER = (By.XPATH, "//span[contains(text(), 'OrphaAI Copilot')]")
    STATUS_PULSE_DOT = (By.XPATH, "//span[contains(@class, 'bg-emerald-400') and contains(@class, 'animate-pulse')]")
    CLOSE_BUTTON = (By.XPATH, "//button[@aria-label='Close Assistant']")
    HELLOTARS_IFRAME = (By.XPATH, "//iframe[contains(@src, 'chatbot.hellotars.com')]")

    def toggle_capsule(self):
        self.click(self.CAPSULE_LAUNCHER_BUTTON)

    def close_copilot(self):
        self.click(self.CLOSE_BUTTON)

    def is_copilot_open(self):
        return self.is_displayed(self.CHATBOT_MODAL_CONTAINER)

