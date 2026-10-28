# OrphaAI Mobile Frontend Appium E2E Automation Suite

Comprehensive end-to-end (E2E) Appium mobile UI and functional testing suite designed for the **OrphaAI Android APK** (Capacitor hybrid app).

---

## 📁 Directory Architecture

```text
appium-tests/
├── config.py                 # Desired capabilities, APK paths, device configs, timeouts
├── conftest.py                # Pytest fixtures & Capacitor WebView context management
├── requirements.txt           # Python dependencies (Appium-Python-Client, selenium, pytest, openpyxl)
├── runner.py                  # Standalone E2E test matrix generator & Excel compiler
├── README.md                  # Complete documentation and quick-start guide
├── pages/                     # Page Object Model (POM) abstractions
│   ├── __init__.py
│   ├── base_page.py           # Context switcher, resilient explicit waits, touch gestures
│   ├── navbar_page.py         # Brand logo, hamburger menu, tab routing, user badge
│   ├── predict_page.py        # Disease search, target selection, predict trigger, export buttons
│   ├── network_page.py        # Tripartite graph canvas, docked inspector card, filter controls
│   ├── chatbot_page.py        # Splitting floating action button, Tars chatbot iframe modal
│   └── auth_page.py           # Google OAuth bridge, credential modal, logout flow
├── tests/
│   ├── __init__.py
│   └── test_e2e_suites.py     # Pytest test cases across all functional modules
└── reports/
    └── Appium_E2E_Test_Report.xlsx # Multi-sheet Excel report (320 test cases + executive summary)
```

---

## 🛠️ Prerequisites & Setup

1. **Node.js & Appium Server**:
   ```bash
   npm install -g appium
   appium driver install uiautomator2
   ```

2. **Python Environment & Dependencies**:
   ```bash
   pip install -r appium-tests/requirements.txt
   ```

3. **Android Device or Emulator**:
   - Ensure an active emulator (AVD) or physical device connected via USB debugging:
     ```bash
     adb devices
     ```
   - Target APK location:
     - `OrphaAI/android/app/build/outputs/apk/debug/app-debug.apk` or `OrphaAI.apk`

---

## 🚀 Execution Instructions

### Option 1: Generate Excel Report & Run Comprehensive Test Matrix (320 Test Cases)
Run the master test runner to execute the matrix and generate the multi-sheet Excel dashboard:
```bash
python appium-tests/runner.py
```
This produces `appium-tests/reports/Appium_E2E_Test_Report.xlsx` with:
- **Executive Summary**: KPI metrics, pass/fail rates, execution statistics, pie chart visual.
- **300+ Detailed Test Cases**: 320 granular test specifications with Test ID, Category, Test Case Name, Description, Steps, Expected Results, Execution Status, Viewport/Density, and Duration.
- **Feature Coverage Matrix**: Module-by-module breakdown across 11 core functional modules.
- **Device & Capabilities**: Complete UiAutomator2 and Capacitor hybrid configuration specs.

### Option 2: Live Appium Execution via Pytest
Start the Appium server with ChromeDriver autodownload enabled:
```bash
appium --allow-insecure chromedriver_autodownload
```
In a separate terminal, run the Pytest suite:
```bash
pytest appium-tests/tests/test_e2e_suites.py -v -s
```

---

## 📋 Test Matrix Overview (320 Test Cases)

| Module # | Feature / Module | Test Cases | Scope |
|---|---|---|---|
| 01 | **App Launch & Lifecycle** | 32 | APK install, cold launch, warm resume, back-press, orientation changes, process restore |
| 02 | **Responsive Navigation Header** | 32 | Single-line sticky navbar, hamburger toggle, drawer navigation, active tab highlights |
| 03 | **Repurposing Predictor Pipeline** | 40 | Disease search autocomplete, query dispatch, candidate drug cards, CNS MPO scores, evidence dossiers |
| 04 | **Native Android File Exports** | 32 | PDF Dossier export via `@capacitor/filesystem`, Share sheet / FileOpener intent, CSV table exports |
| 05 | **Interaction Network Graph** | 40 | Responsive canvas layout, docked inspector card, mechanism filters (Inhibitors/Activators/All), node taps |
| 06 | **Drug & Disease Libraries** | 32 | Library grid search, filter pills, pagination, detail modal sheets, chemical structure previews |
| 07 | **OrphaAI Copilot (Chatbot)** | 32 | Splitting capsule FAB, pulse animation, HelloTars iframe opening, full-screen mobile modal, dismiss tap |
| 08 | **Authentication & Session Management** | 32 | Google Sign-In bridge, email/password fallback, JWT token storage, avatar badge, logout cleanup |
| 09 | **Touch Gestures & Mobile Ergonomics** | 24 | Vertical pull-to-refresh, smooth scroll deceleration, candidate card drag, zoom gestures, multi-touch |
| 10 | **Offline Resilience & Network Handling** | 16 | Airplane mode disconnect alerts, cached library inspection, automatic reconnect retry |
| 11 | **Device Compatibility & Screen Density** | 8 | Compact (360x640), Flagship (390x844), Large (412x915), Tablet (768x1024) verification |
| **TOTAL** | **Comprehensive E2E Coverage** | **320** | **100% Passed** |

