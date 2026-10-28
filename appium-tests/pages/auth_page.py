"""
Authentication Modal & Session Page Object
Covers login dialog, Google OAuth button, email/password form, and session teardown.
"""

from selenium.webdriver.common.by import By
from pages.base_page import BasePage


class AuthPage(BasePage):
    LOGIN_MODAL = (By.XPATH, "//*[contains(text(), 'Sign In to OrphaAI') or contains(text(), 'Welcome Back')]")
    EMAIL_INPUT = (By.XPATH, "//input[@type='email' or contains(@placeholder, 'email')]")
    PASSWORD_INPUT = (By.XPATH, "//input[@type='password' or contains(@placeholder, 'password')]")
    SUBMIT_LOGIN_BUTTON = (By.XPATH, "//button[@type='submit' or contains(text(), 'Sign In')]")
    GOOGLE_SIGN_IN_BUTTON = (By.XPATH, "//button[contains(text(), 'Google') or contains(@class, 'google-btn')]")
    
    LOGOUT_BUTTON = (By.XPATH, "//button[contains(text(), 'Sign Out') or contains(text(), 'Logout')]")
    ERROR_ALERT = (By.XPATH, "//div[contains(@class, 'bg-red-50') or contains(@class, 'error')]")

    def login_with_credentials(self, email: str, password: str):
        self.type_text(self.EMAIL_INPUT, email)
        self.type_text(self.PASSWORD_INPUT, password)
        self.click(self.SUBMIT_LOGIN_BUTTON)

    def trigger_google_sign_in(self):
        self.click(self.GOOGLE_SIGN_IN_BUTTON)

    def logout(self):
        self.click(self.LOGOUT_BUTTON)

