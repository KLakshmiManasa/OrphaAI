"""
OrphaAI Appium E2E Automation — Configuration & Desired Capabilities
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# APK location (prioritize fresh Gradle debug APK, fallback to root APK)
DEFAULT_APK_PATH = os.path.join(
    BASE_DIR, "OrphaAI", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"
)
if not os.path.exists(DEFAULT_APK_PATH):
    DEFAULT_APK_PATH = os.path.join(BASE_DIR, "OrphaAI.apk")

APPIUM_SERVER_URL = os.environ.get("APPIUM_SERVER_URL", "http://127.0.0.1:4723")

DESIRED_CAPABILITIES = {
    "platformName": "Android",
    "automationName": "UiAutomator2",
    "deviceName": os.environ.get("ANDROID_DEVICE_NAME", "Android Emulator"),
    "platformVersion": os.environ.get("ANDROID_PLATFORM_VERSION", "14.0"),
    "app": os.environ.get("APP_PATH", DEFAULT_APK_PATH),
    "appPackage": "com.orphaai.app",
    "appActivity": ".MainActivity",
    "noReset": False,
    "fullReset": False,
    "autoGrantPermissions": True,
    "newCommandTimeout": 300,
    "chromedriverAutodownload": True,
    "recreateChromeDriverSessions": True,
}

# Timeout configurations
IMPLICIT_WAIT = 10
EXPLICIT_WAIT = 20
PAGE_LOAD_TIMEOUT = 30

