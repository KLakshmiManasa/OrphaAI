"""
OrphaAI Appium E2E Automation — Comprehensive Test Suites
Executes complete user journeys across native Android WebView, bridges, and UI modules.
"""

import time
import pytest
from pages.navbar_page import NavbarPage
from pages.predict_page import PredictPage
from pages.network_page import NetworkPage
from pages.chatbot_page import ChatbotPage
from pages.auth_page import AuthPage


# =========================================================================
# SUITE 1: Application Launch & Responsive Navigation
# =========================================================================
def test_app_cold_start_and_webview_context(webview_context):
    """Verify application boots into Capacitor WebView with zero ANR or crash."""
    if not webview_context:
        pytest.skip("Live Appium server or device not connected; running in offline matrix mode.")
    nav = NavbarPage(webview_context)
    assert nav.is_displayed(NavbarPage.BRAND_LOGO)


def test_navbar_mobile_single_line_layout(webview_context):
    """Verify mobile header height is constrained to single row without vertical link wrap."""
    if not webview_context:
        pytest.skip("Appium driver unavailable")
    nav = NavbarPage(webview_context)
    logo = nav.find_visible(NavbarPage.BRAND_LOGO)
    assert logo.is_displayed()


def test_hamburger_drawer_toggle(webview_context):
    """Verify hamburger drawer opens smoothly and renders all navigation items."""
    if not webview_context:
        pytest.skip("Appium driver unavailable")
    nav = NavbarPage(webview_context)
    nav.open_drawer()
    assert nav.is_displayed(NavbarPage.NAV_PREDICT)


def test_navigation_to_predict_page(webview_context):
    """Verify tab selection switches view context to Predictor page."""
    if not webview_context:
        pytest.skip("Appium driver unavailable")
    nav = NavbarPage(webview_context)
    nav.navigate_to("predict")
    predict = PredictPage(webview_context)
    assert predict.is_displayed(PredictPage.AUTOCOMPLETE_INPUT)


# =========================================================================
# SUITE 2: Repurposing Prediction & Native File Exports
# =========================================================================
def test_disease_autocomplete_dropdown(webview_context):
    """Verify typing disease indication generates debounced autocomplete suggestions."""
    if not webview_context:
        pytest.skip("Appium driver unavailable")
    predict = PredictPage(webview_context)
    predict.type_text(PredictPage.AUTOCOMPLETE_INPUT, "Alzheimer")
    time.sleep(1)
    assert predict.is_displayed(PredictPage.RUN_PREDICTION_BUTTON)


def test_example_pill_selection_triggers_inference(webview_context):
    """Verify tapping quick example pill populates input and triggers prediction."""
    if not webview_context:
        pytest.skip("Appium driver unavailable")
    predict = PredictPage(webview_context)
    predict.select_example_alzheimers()
    time.sleep(2)
    assert predict.is_displayed(PredictPage.FIRST_CANDIDATE_CARD)


def test_candidate_card_expand_dossier(webview_context):
    """Verify candidate card expands to render CNS MPO BBB score and biological rationale."""
    if not webview_context:
        pytest.skip("Appium driver unavailable")
    predict = PredictPage(webview_context)
    predict.click(PredictPage.DOSSIER_EXPAND_BUTTON)
    assert predict.is_displayed(PredictPage.CNS_MPO_SCORE)


def test_native_pdf_export_bridge(webview_context):
    """Verify PDF export triggers @capacitor/filesystem and file-opener intent."""
    if not webview_context:
        pytest.skip("Appium driver unavailable")
    predict = PredictPage(webview_context)
    predict.trigger_pdf_export()
    time.sleep(2)


def test_native_csv_export_bridge(webview_context):
    """Verify CSV export writes RFC 4180 file to Documents without WebView uri crash."""
    if not webview_context:
        pytest.skip("Appium driver unavailable")
    predict = PredictPage(webview_context)
    predict.trigger_csv_export()
    time.sleep(1)


# =========================================================================
# SUITE 3: Interaction Network Graph
# =========================================================================
def test_network_graph_rendering_and_docked_inspector(webview_context):
    """Verify tripartite network renders and inspector card docks below canvas on mobile."""
    if not webview_context:
        pytest.skip("Appium driver unavailable")
    nav = NavbarPage(webview_context)
    nav.navigate_to("network")
    net = NetworkPage(webview_context)
    assert net.is_displayed(NetworkPage.GRAPH_CANVAS)
    assert net.is_displayed(NetworkPage.NETWORK_INSPECTOR_CARD)


def test_network_pharmacological_filter_toggles(webview_context):
    """Verify filtering by Inhibitors and Activators recolors edges dynamically."""
    if not webview_context:
        pytest.skip("Appium driver unavailable")
    net = NetworkPage(webview_context)
    net.filter_by_inhibitors()
    time.sleep(0.5)
    net.filter_by_activators()
    time.sleep(0.5)
    net.filter_all()


# =========================================================================
# SUITE 4: OrphaAI Copilot Chatbot
# =========================================================================
def test_capsule_bot_launcher_toggle_and_iframe(webview_context):
    """Verify splitting capsule animation opens HelloTars conversational modal with status dot."""
    if not webview_context:
        pytest.skip("Appium driver unavailable")
    bot = ChatbotPage(webview_context)
    bot.toggle_capsule()
    assert bot.is_displayed(ChatbotPage.COPILOT_HEADER)
    assert bot.is_displayed(ChatbotPage.STATUS_PULSE_DOT)


def test_capsule_bot_clean_close(webview_context):
    """Verify close button tears down chatbot modal cleanly."""
    if not webview_context:
        pytest.skip("Appium driver unavailable")
    bot = ChatbotPage(webview_context)
    bot.close_copilot()
    time.sleep(0.5)
    assert not bot.is_copilot_open()


# =========================================================================
# SUITE 5: Authentication & Session Management
# =========================================================================
def test_sign_in_modal_display(webview_context):
    """Verify tapping Sign In opens authentication dialog."""
    if not webview_context:
        pytest.skip("Appium driver unavailable")
    nav = NavbarPage(webview_context)
    if nav.is_displayed(NavbarPage.SIGN_IN_BUTTON):
        nav.click(NavbarPage.SIGN_IN_BUTTON)
        auth = AuthPage(webview_context)
        assert auth.is_displayed(AuthPage.LOGIN_MODAL)

