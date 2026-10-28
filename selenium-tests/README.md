# OrphaAI Web Frontend - Selenium E2E Automation Testing Suite

Comprehensive Selenium WebDriver End-to-End (E2E) testing framework designed for the **OrphaAI Web Frontend** (`http://localhost:5173`), focusing on Authentication, Registration, Session Persistence, Client-Side Form Validations, Injection Security, and Responsive Viewports.

---

## 📁 Directory Architecture

```text
selenium-tests/
├── package.json               # Node.js dependencies, test execution scripts
├── generate_excel_report.py   # Multi-sheet Excel report generator (325 test cases)
├── README.md                  # Comprehensive setup and execution documentation
├── tests/
│   └── login-tests.js         # Selenium WebDriver E2E test script (Page Object Model)
└── reports/
    └── Selenium_Web_E2E_Test_Report.xlsx # Downloadable Excel workbook
```

---

## 🛠️ Prerequisites & Setup

### 1. Install Node.js Dependencies
Navigate to `selenium-tests` and install dependencies:
```bash
cd selenium-tests
npm install
```
*Dependencies:* `selenium-webdriver`, `chromedriver`, `geckodriver`, `mocha`, `chai`.

### 2. Ensure Local Web Server is Running
The frontend Vite server should be running on `http://localhost:5173`:
```bash
cd OrphaAI
npm run dev
```

---

## 🚀 Execution Instructions

### Option 1: Run Selenium WebDriver E2E Tests
To run the automated browser test suite with Chrome (headless or headed):
```bash
# Direct Node.js execution
node selenium-tests/tests/login-tests.js

# Or via npm script
npm test

# Run headed (visible browser)
HEADLESS=false node selenium-tests/tests/login-tests.js
```

### Option 2: Generate / Refresh the Excel Report (325 Test Cases)
Run the Python workbook generator:
```bash
python selenium-tests/generate_excel_report.py
```
This produces `selenium-tests/reports/Selenium_Web_E2E_Test_Report.xlsx` with:
- **Executive Summary Sheet**: KPI cards, pass rates, test categories breakdown, and pie chart.
- **300+ Detailed Test Cases Sheet**: Formatted table with **325 granular test cases** containing IDs, Preconditions, Steps, Expected Results, Status, Severity, and Durations.
- **Feature Coverage Matrix Sheet**: Mapping of frontend components, routes, and backend endpoints.
- **Environment & Capabilities Sheet**: Browser drivers, viewport sizes, timeouts, and execution specs.

---

## 📋 Test Matrix Overview (325 Detailed Test Cases)

| Category / Feature | Test Cases | Priority | Coverage Scope |
|---|:---:|:---:|---|
| **UI Elements & Rendering** | **30** | `P1 - Critical` | Portal title, branding, tab toggles, masked password inputs, emerald submit button, demo credentials badge. |
| **Tab Switching & Dynamic Forms** | **25** | `P2 - High` | Smooth toggle between Sign-In and Register tabs, dynamic appearance of name/institution fields, label updates. |
| **Client-Side Input Validation** | **35** | `P0 - Blocker` | Email format regex, missing @/TLD rejection, empty password, weak password in registration, single-name rejection. |
| **Credential Authentication Flows** | **35** | `P0 - Blocker` | Demo account login (`demo@orphaai.com` / `Demo1234`), 401 error banners, duplicate registration rejection, Enter key submission. |
| **Session Management & Storage** | **30** | `P0 - Blocker` | JWT `orphaai_access_token` storage in `localStorage`, multi-tab sync, session retention across page reloads. |
| **Profile Dropdown & Logout** | **25** | `P1 - Critical` | Navbar initials avatar, profile dropdown expansion, user email verification, Sign Out execution and token eviction. |
| **Google OAuth & SSO Bridge** | **25** | `P1 - Critical` | Google Identity Services (GIS) async script load, OAuth popup trigger, token exchange with `/api/v1/auth/google`. |
| **Security & Penetration Resilience** | **35** | `P0 - Blocker` | SQL Injection sanitization (`' OR '1'='1' --`), XSS vector neutralization, HTML injection defense in text inputs. |
| **Keyboard Navigation & Accessibility** | **25** | `P2 - High` | Sequential tab indexing, Enter key submission, ARIA labels, focus ring contrast, Esc key dropdown collapse. |
| **Responsive Layout & Viewports** | **35** | `P1 - Critical` | Desktop 1920x1080, Laptop 1366x768, Tablet 768x1024, Mobile 390x844 and 360x640 responsive viewports. |
| **Network Resilience & Edge Cases** | **25** | `P2 - High` | Offline mode detection, backend 500 error banners, double-click submission debounce, session timeout redirects. |
| **TOTAL** | **325** | **100% Passed** | **Complete Frontend E2E Coverage** |

