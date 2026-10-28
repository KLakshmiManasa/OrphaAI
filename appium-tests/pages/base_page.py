"""
Base Page Object for OrphaAI Appium Automation
Encapsulates common element interactions, explicit waits, scrolling, and hybrid context handling.
"""

import time
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from config import EXPLICIT_WAIT


class BasePage:
    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, EXPLICIT_WAIT) if driver else None

    def find(self, locator):
        return self.wait.until(EC.presence_of_element_located(locator))

    def find_visible(self, locator):
        return self.wait.until(EC.visibility_of_element_located(locator))

    def find_all(self, locator):
        return self.driver.find_elements(*locator)

    def click(self, locator):
        el = self.wait.until(EC.element_to_be_clickable(locator))
        el.click()

    def type_text(self, locator, text, clear=True):
        el = self.find_visible(locator)
        if clear:
            el.clear()
        el.send_keys(text)

    def get_text(self, locator):
        return self.find_visible(locator).text

    def is_displayed(self, locator):
        try:
            return self.find_visible(locator).is_displayed()
        except Exception:
            return False

    def switch_to_webview(self):
        if not self.driver:
            return
        for ctx in self.driver.contexts:
            if "WEBVIEW" in ctx:
                self.driver.switch_to.context(ctx)
                return

    def switch_to_native(self):
        if self.driver:
            self.driver.switch_to.context("NATIVE_APP")

    def swipe_up(self):
        if not self.driver:
            return
        self.switch_to_native()
        size = self.driver.get_window_size()
        start_x = size["width"] / 2
        start_y = size["height"] * 0.8
        end_y = size["height"] * 0.2
        self.driver.swipe(start_x, start_y, start_x, end_y, 400)
        self.switch_to_webview()

    def swipe_down(self):
        if not self.driver:
            return
        self.switch_to_native()
        size = self.driver.get_window_size()
        start_x = size["width"] / 2
        start_y = size["height"] * 0.2
        end_y = size["height"] * 0.8
        self.driver.swipe(start_x, start_y, start_x, end_y, 400)
        self.switch_to_webview()

