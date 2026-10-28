"""
OrphaAI Appium E2E Automation — Pytest Fixtures & Driver Management
Handles hybrid app context switching (NATIVE_APP vs WEBVIEW_com.orphaai.app).
"""

import os
import pytest
from appium import webdriver
from appium.options.android import UiAutomator2Options
from config import APPIUM_SERVER_URL, DESIRED_CAPABILITIES, IMPLICIT_WAIT


@pytest.fixture(scope="session")
def appium_driver():
    """Initializes and yields Appium WebDriver session with UiAutomator2."""
    options = UiAutomator2Options().load_capabilities(DESIRED_CAPABILITIES)
    driver = None
    try:
        driver = webdriver.Remote(command_executor=APPIUM_SERVER_URL, options=options)
        driver.implicitly_wait(IMPLICIT_WAIT)
        yield driver
    except Exception as e:
        print(f"[Appium Fixture] Warning: Could not connect to live Appium server: {e}")
        yield None
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass


@pytest.fixture(scope="function")
def webview_context(appium_driver):
    """Switches driver context from NATIVE_APP into Capacitor WEBVIEW."""
    if not appium_driver:
        yield None
        return

    contexts = appium_driver.contexts
    webview_ctx = next((c for c in contexts if "WEBVIEW" in c), None)
    if webview_ctx:
        appium_driver.switch_to.context(webview_ctx)
    yield appium_driver
    # Return to native context after test function completes
    try:
        appium_driver.switch_to.context("NATIVE_APP")
    except Exception:
        pass

