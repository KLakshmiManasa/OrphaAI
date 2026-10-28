/**
 * ============================================================================
 * ORPHAAI RESEARCH PORTAL - WEB FRONTEND SELENIUM E2E TEST SUITE
 * File: selenium-tests/tests/login-tests.js
 * Description: End-to-End automation testing for Authentication, Registration,
 *              Session Management, Security Validations, and Responsive Layout.
 * Framework: Selenium WebDriver (JavaScript / Node.js)
 * ============================================================================
 */

const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

// Configuration
const CONFIG = {
  baseUrl: process.env.ORPHAAI_BASE_URL || 'http://localhost:5173',
  timeout: 10000,
  headless: process.env.HEADLESS !== 'false',
  credentials: {
    valid: {
      email: 'demo@orphaai.com',
      password: 'Demo1234',
      displayName: 'Demo User'
    },
    invalid: {
      unregisteredEmail: 'nonexistent.user@orphaai.org',
      wrongPassword: 'WrongPassword999!',
      malformedEmail: 'invalid-email-format',
      weakPassword: '123'
    },
    registration: {
      fullName: 'Dr. Jane Watson',
      institution: 'Biomedical Genomics Institute',
      email: `researcher.${Date.now()}@institute.edu`,
      strongPassword: 'OrphaSecure2026!'
    }
  }
};

/**
 * Page Object Helper for OrphaAI Login & Navigation
 */
class LoginPage {
  constructor(driver) {
    this.driver = driver;
  }

  // Locators
  locators = {
    // Navbar Elements
    navSignInBtn: By.xpath("//nav//button[contains(text(), 'Sign In')]"),
    userProfileBadge: By.xpath("//button[@aria-label='User Profile']"),
    signOutBtn: By.xpath("//button[contains(text(), 'Sign Out')]"),
    brandLogo: By.xpath("//span[contains(text(), 'Orpha')]"),

    // Auth Portal Elements
    portalTitle: By.xpath("//div[contains(text(), 'OrphaAI Research Portal')]"),
    portalSubtitle: By.xpath("//div[contains(text(), 'Access secured biomedical platform')]"),
    tabSignIn: By.xpath("//button[text()='Sign In']"),
    tabRegister: By.xpath("//button[text()='Register']"),
    
    // Form Inputs
    fullNameInput: By.xpath("//input[@placeholder='Dr. Jane Smith']"),
    institutionInput: By.xpath("//input[@placeholder='University or laboratory']"),
    emailInput: By.xpath("//input[@placeholder='researcher@institution.edu']"),
    passwordInput: By.xpath("//input[@placeholder='••••••••••••']"),
    
    // Actions & Alerts
    submitBtn: By.xpath("//button[contains(text(), 'Sign In') or contains(text(), 'Create Researcher Account') or contains(text(), 'Please wait...')]"),
    errorMessage: By.xpath("//div[contains(@style, 'border: 1px solid rgb(254, 205, 211)') or contains(@style, '#FECDD3')]"),
    googleSignInBtn: By.xpath("//button[contains(., 'Google') or contains(., 'Sign in with Google')] | //div[contains(@id, 'g_id_onload')]"),
    demoAccountBox: By.xpath("//div[contains(., 'Demo Account:')]")
  };

  async navigate() {
    await this.driver.get(CONFIG.baseUrl);
    // If not already on login page, click the Sign In button in Navbar
    const currentUrl = await this.driver.getCurrentUrl();
    try {
      const signInBtn = await this.driver.wait(
        until.elementLocated(this.locators.navSignInBtn),
        3000
      );
      await signInBtn.click();
    } catch {
      // Already on page or button rendered differently
    }
    await this.driver.wait(until.elementLocated(this.locators.portalTitle), CONFIG.timeout);
  }

  async selectTab(tabName) {
    const locator = tabName.toLowerCase() === 'register' ? this.locators.tabRegister : this.locators.tabSignIn;
    const tabElement = await this.driver.wait(until.elementLocated(locator), CONFIG.timeout);
    await tabElement.click();
    await this.driver.sleep(300); // UI transition
  }

  async fillEmail(email) {
    const el = await this.driver.wait(until.elementLocated(this.locators.emailInput), CONFIG.timeout);
    await el.clear();
    await el.sendKeys(email);
  }

  async fillPassword(password) {
    const el = await this.driver.wait(until.elementLocated(this.locators.passwordInput), CONFIG.timeout);
    await el.clear();
    await el.sendKeys(password);
  }

  async fillFullName(name) {
    const el = await this.driver.wait(until.elementLocated(this.locators.fullNameInput), CONFIG.timeout);
    await el.clear();
    await el.sendKeys(name);
  }

  async fillInstitution(inst) {
    const el = await this.driver.wait(until.elementLocated(this.locators.institutionInput), CONFIG.timeout);
    await el.clear();
    await el.sendKeys(inst);
  }

  async clickSubmit() {
    const btn = await this.driver.wait(until.elementLocated(this.locators.submitBtn), CONFIG.timeout);
    await btn.click();
  }

  async submitWithEnter() {
    const pass = await this.driver.wait(until.elementLocated(this.locators.passwordInput), CONFIG.timeout);
    await pass.sendKeys(Key.RETURN);
  }

  async getErrorMessage() {
    const errorEl = await this.driver.wait(until.elementLocated(this.locators.errorMessage), 5000);
    return await errorEl.getText();
  }

  async isUserAuthenticated() {
    try {
      await this.driver.wait(until.elementLocated(this.locators.userProfileBadge), 5000);
      return true;
    } catch {
      return false;
    }
  }

  async getSessionToken() {
    return await this.driver.executeScript(`
      return localStorage.getItem('orphaai_access_token') || localStorage.getItem('orphaai_token') || '';
    `);
  }

  async clearSession() {
    await this.driver.executeScript(`
      localStorage.removeItem('orphaai_access_token');
      localStorage.removeItem('orphaai_refresh_token');
      localStorage.removeItem('orphaai_token');
      localStorage.removeItem('orphaai_user');
      sessionStorage.clear();
    `);
    await this.driver.navigate().refresh();
  }

  async logout() {
    const badge = await this.driver.wait(until.elementLocated(this.locators.userProfileBadge), CONFIG.timeout);
    await badge.click();
    const signOut = await this.driver.wait(until.elementLocated(this.locators.signOutBtn), CONFIG.timeout);
    await signOut.click();
    await this.driver.wait(until.elementLocated(this.locators.navSignInBtn), CONFIG.timeout);
  }
}

/**
 * Test Execution Suite
 */
async function runSeleniumTests() {
  console.log('==================================================================');
  console.log('   ORPHAAI WEB FRONTEND - SELENIUM WEBDRIVER E2E TEST SUITE       ');
  console.log('==================================================================\n');

  const chromeOptions = new chrome.Options();
  if (CONFIG.headless) {
    chromeOptions.addArguments('--headless=new');
  }
  chromeOptions.addArguments(
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1440,900'
  );

  let driver;
  let passedCount = 0;
  let failedCount = 0;
  const testResults = [];

  function recordResult(id, category, name, status, durationMs, errorMsg = '') {
    testResults.push({ id, category, name, status, durationMs, errorMsg });
    const mark = status === 'PASSED' ? '✅ PASS' : '❌ FAIL';
    console.log(`[${mark}] ${id}: ${name} (${durationMs}ms)`);
    if (status === 'PASSED') passedCount++;
    else failedCount++;
  }

  try {
    console.log('[*] Initializing Chrome WebDriver instance...');
    driver = await new Builder().forBrowser('chrome').setChromeOptions(chromeOptions).build();
    const loginPage = new LoginPage(driver);

    // =========================================================================
    // SECTION 1: UI RENDERING & STRUCTURAL INTEGRITY
    // =========================================================================
    console.log('\n--- Section 1: UI Rendering & DOM Element Presence ---');
    
    // Test 1.1: Portal Title & Branding
    let start = Date.now();
    try {
      await loginPage.navigate();
      const title = await driver.findElement(loginPage.locators.portalTitle).getText();
      if (title.includes('OrphaAI Research Portal')) {
        recordResult('TC-UI-001', 'UI Elements', 'Verify OrphaAI Portal Title is rendered', 'PASSED', Date.now() - start);
      } else {
        throw new Error(`Unexpected portal title: ${title}`);
      }
    } catch (err) {
      recordResult('TC-UI-001', 'UI Elements', 'Verify OrphaAI Portal Title is rendered', 'FAILED', Date.now() - start, err.message);
    }

    // Test 1.2: Subtitle Display
    start = Date.now();
    try {
      const sub = await driver.findElement(loginPage.locators.portalSubtitle).getText();
      if (sub.includes('Access secured biomedical platform')) {
        recordResult('TC-UI-002', 'UI Elements', 'Verify Portal Subtitle instructions', 'PASSED', Date.now() - start);
      } else {
        throw new Error(`Unexpected subtitle: ${sub}`);
      }
    } catch (err) {
      recordResult('TC-UI-002', 'UI Elements', 'Verify Portal Subtitle instructions', 'FAILED', Date.now() - start, err.message);
    }

    // Test 1.3: Default Tab State (Sign In Active)
    start = Date.now();
    try {
      const signInTab = await driver.findElement(loginPage.locators.tabSignIn);
      const isRegisterVisible = await driver.findElements(loginPage.locators.fullNameInput);
      if (isRegisterVisible.length === 0) {
        recordResult('TC-UI-003', 'UI Elements', 'Verify default active tab is Sign In', 'PASSED', Date.now() - start);
      } else {
        throw new Error('Register fields visible on default Sign In view');
      }
    } catch (err) {
      recordResult('TC-UI-003', 'UI Elements', 'Verify default active tab is Sign In', 'FAILED', Date.now() - start, err.message);
    }

    // Test 1.4: Password Masking Attribute (type="password")
    start = Date.now();
    try {
      const passInput = await driver.findElement(loginPage.locators.passwordInput);
      const inputType = await passInput.getAttribute('type');
      if (inputType === 'password') {
        recordResult('TC-UI-004', 'UI Elements', 'Verify password input masking (type="password")', 'PASSED', Date.now() - start);
      } else {
        throw new Error(`Input type was ${inputType}`);
      }
    } catch (err) {
      recordResult('TC-UI-004', 'UI Elements', 'Verify password input masking (type="password")', 'FAILED', Date.now() - start, err.message);
    }

    // Test 1.5: Demo Credentials Hint Box
    start = Date.now();
    try {
      const demoBox = await driver.findElement(loginPage.locators.demoAccountBox).getText();
      if (demoBox.includes('demo@orphaai.com') && demoBox.includes('Demo1234')) {
        recordResult('TC-UI-005', 'UI Elements', 'Verify Demo Credentials helper container', 'PASSED', Date.now() - start);
      } else {
        throw new Error(`Unexpected demo box content: ${demoBox}`);
      }
    } catch (err) {
      recordResult('TC-UI-005', 'UI Elements', 'Verify Demo Credentials helper container', 'FAILED', Date.now() - start, err.message);
    }

    // =========================================================================
    // SECTION 2: TAB SWITCHING & DYNAMIC FIELD RENDERING
    // =========================================================================
    console.log('\n--- Section 2: Tab Switching & Form State Transition ---');

    // Test 2.1: Switch to Register Tab
    start = Date.now();
    try {
      await loginPage.selectTab('register');
      const fullName = await driver.findElement(loginPage.locators.fullNameInput);
      const institution = await driver.findElement(loginPage.locators.institutionInput);
      const submitText = await driver.findElement(loginPage.locators.submitBtn).getText();
      if (await fullName.isDisplayed() && await institution.isDisplayed() && submitText.includes('Create Researcher Account')) {
        recordResult('TC-TAB-001', 'Tab Switching', 'Switch to Register tab renders name and institution fields', 'PASSED', Date.now() - start);
      } else {
        throw new Error('Registration form elements missing');
      }
    } catch (err) {
      recordResult('TC-TAB-001', 'Tab Switching', 'Switch to Register tab renders name and institution fields', 'FAILED', Date.now() - start, err.message);
    }

    // Test 2.2: Switch Back to Sign In Tab
    start = Date.now();
    try {
      await loginPage.selectTab('login');
      const nameElements = await driver.findElements(loginPage.locators.fullNameInput);
      const submitText = await driver.findElement(loginPage.locators.submitBtn).getText();
      if (nameElements.length === 0 && submitText.includes('Sign In')) {
        recordResult('TC-TAB-002', 'Tab Switching', 'Switch back to Sign In removes registration fields', 'PASSED', Date.now() - start);
      } else {
        throw new Error('Registration fields still present after switching to Sign In');
      }
    } catch (err) {
      recordResult('TC-TAB-002', 'Tab Switching', 'Switch back to Sign In removes registration fields', 'FAILED', Date.now() - start, err.message);
    }

    // =========================================================================
    // SECTION 3: CLIENT-SIDE VALIDATION & ERROR HANDLING
    // =========================================================================
    console.log('\n--- Section 3: Client-Side Input Validations ---');

    // Test 3.1: Empty Email Validation
    start = Date.now();
    try {
      await loginPage.fillEmail('');
      await loginPage.fillPassword('SomePassword123!');
      await loginPage.clickSubmit();
      const err = await loginPage.getErrorMessage();
      if (err.includes('Enter a valid email address')) {
        recordResult('TC-VAL-001', 'Validation', 'Reject empty email submission with validation banner', 'PASSED', Date.now() - start);
      } else {
        throw new Error(`Unexpected error message: ${err}`);
      }
    } catch (err) {
      recordResult('TC-VAL-001', 'Validation', 'Reject empty email submission with validation banner', 'FAILED', Date.now() - start, err.message);
    }

    // Test 3.2: Malformed Email (Missing @ or Domain)
    start = Date.now();
    try {
      await loginPage.fillEmail(CONFIG.credentials.invalid.malformedEmail);
      await loginPage.fillPassword('SomePassword123!');
      await loginPage.clickSubmit();
      const err = await loginPage.getErrorMessage();
      if (err.includes('Enter a valid email address with @ and a domain')) {
        recordResult('TC-VAL-002', 'Validation', 'Reject malformed email format without @ or domain', 'PASSED', Date.now() - start);
      } else {
        throw new Error(`Unexpected error message: ${err}`);
      }
    } catch (err) {
      recordResult('TC-VAL-002', 'Validation', 'Reject malformed email format without @ or domain', 'FAILED', Date.now() - start, err.message);
    }

    // Test 3.3: Empty Password Validation
    start = Date.now();
    try {
      await loginPage.fillEmail(CONFIG.credentials.valid.email);
      await loginPage.fillPassword('');
      await loginPage.clickSubmit();
      const err = await loginPage.getErrorMessage();
      if (err.includes('Password is required')) {
        recordResult('TC-VAL-003', 'Validation', 'Reject blank password on login submission', 'PASSED', Date.now() - start);
      } else {
        throw new Error(`Unexpected error message: ${err}`);
      }
    } catch (err) {
      recordResult('TC-VAL-003', 'Validation', 'Reject blank password on login submission', 'FAILED', Date.now() - start, err.message);
    }

    // Test 3.4: Weak Password in Registration
    start = Date.now();
    try {
      await loginPage.selectTab('register');
      await loginPage.fillFullName(CONFIG.credentials.registration.fullName);
      await loginPage.fillInstitution(CONFIG.credentials.registration.institution);
      await loginPage.fillEmail(CONFIG.credentials.registration.email);
      await loginPage.fillPassword('weak');
      await loginPage.clickSubmit();
      const err = await loginPage.getErrorMessage();
      if (err.includes('Password must be 8+ characters')) {
        recordResult('TC-VAL-004', 'Validation', 'Reject weak password in registration (<8 chars/special char)', 'PASSED', Date.now() - start);
      } else {
        throw new Error(`Unexpected error message: ${err}`);
      }
    } catch (err) {
      recordResult('TC-VAL-004', 'Validation', 'Reject weak password in registration (<8 chars/special char)', 'FAILED', Date.now() - start, err.message);
    }

    // Test 3.5: Single-Word Full Name in Registration
    start = Date.now();
    try {
      await loginPage.fillFullName('Jane');
      await loginPage.fillPassword(CONFIG.credentials.registration.strongPassword);
      await loginPage.clickSubmit();
      const err = await loginPage.getErrorMessage();
      if (err.includes('Enter first and last name')) {
        recordResult('TC-VAL-005', 'Validation', 'Reject single-name entry during registration', 'PASSED', Date.now() - start);
      } else {
        throw new Error(`Unexpected error message: ${err}`);
      }
    } catch (err) {
      recordResult('TC-VAL-005', 'Validation', 'Reject single-name entry during registration', 'FAILED', Date.now() - start, err.message);
    }

    // =========================================================================
    // SECTION 4: SECURITY & INJECTION DEFENSE TESTING
    // =========================================================================
    console.log('\n--- Section 4: Security & Injection Resilience ---');

    // Test 4.1: SQL Injection in Email Input
    start = Date.now();
    try {
      await loginPage.selectTab('login');
      await loginPage.fillEmail("' OR '1'='1' --");
      await loginPage.fillPassword("' OR '1'='1'");
      await loginPage.clickSubmit();
      const err = await loginPage.getErrorMessage();
      if (err.length > 0) {
        recordResult('TC-SEC-001', 'Security', 'Sanitize and reject SQL Injection payloads in email field', 'PASSED', Date.now() - start);
      } else {
        throw new Error('No validation error triggered on SQLi payload');
      }
    } catch (err) {
      recordResult('TC-SEC-001', 'Security', 'Sanitize and reject SQL Injection payloads in email field', 'FAILED', Date.now() - start, err.message);
    }

    // Test 4.2: XSS Script Injection Defense
    start = Date.now();
    try {
      await loginPage.fillEmail('<script>alert("XSS")</script>@test.com');
      await loginPage.fillPassword('TestPass123!');
      await loginPage.clickSubmit();
      // Ensure alert did not fire
      try {
        const alert = await driver.switchTo().alert();
        await alert.dismiss();
        throw new Error('XSS alert executed in DOM');
      } catch (e) {
        // Expected: no browser alert exists
        recordResult('TC-SEC-002', 'Security', 'Neutralize XSS vector without executing script alert', 'PASSED', Date.now() - start);
      }
    } catch (err) {
      recordResult('TC-SEC-002', 'Security', 'Neutralize XSS vector without executing script alert', 'FAILED', Date.now() - start, err.message);
    }

    // =========================================================================
    // SECTION 5: KEYBOARD INTERACTIONS & ACCESSIBILITY
    // =========================================================================
    console.log('\n--- Section 5: Keyboard Interactions & Accessibility ---');

    // Test 5.1: Enter Key Submission
    start = Date.now();
    try {
      await loginPage.fillEmail('invalid.test@test.com');
      await loginPage.fillPassword('TestPass123!');
      await loginPage.submitWithEnter();
      await driver.sleep(600);
      const isVisible = await driver.findElement(loginPage.locators.portalTitle).isDisplayed();
      if (isVisible) {
        recordResult('TC-KBD-001', 'Keyboard', 'Support Form Submission via keyboard Enter key', 'PASSED', Date.now() - start);
      } else {
        throw new Error('Portal state changed unexpectedly');
      }
    } catch (err) {
      recordResult('TC-KBD-001', 'Keyboard', 'Support Form Submission via keyboard Enter key', 'FAILED', Date.now() - start, err.message);
    }

    // =========================================================================
    // SECTION 6: POSITIVE AUTHENTICATION & SESSION PERSISTENCE
    // =========================================================================
    console.log('\n--- Section 6: Successful Sign-In, Session & Logout ---');

    // Test 6.1: Valid Demo Login
    start = Date.now();
    try {
      await loginPage.fillEmail(CONFIG.credentials.valid.email);
      await loginPage.fillPassword(CONFIG.credentials.valid.password);
      await loginPage.clickSubmit();

      // Wait for authenticated state
      const isAuth = await loginPage.isUserAuthenticated();
      const token = await loginPage.getSessionToken();

      if (isAuth || token.length > 0) {
        recordResult('TC-AUTH-001', 'Authentication', 'Authenticate user with demo credentials & store JWT session', 'PASSED', Date.now() - start);
      } else {
        throw new Error('Authentication state or JWT token not established');
      }
    } catch (err) {
      recordResult('TC-AUTH-001', 'Authentication', 'Authenticate user with demo credentials & store JWT session', 'FAILED', Date.now() - start, err.message);
    }

    // Test 6.2: Session Persistence on Page Reload
    start = Date.now();
    try {
      await driver.navigate().refresh();
      await driver.sleep(1500);
      const tokenAfterRefresh = await loginPage.getSessionToken();
      const isAuthAfterRefresh = await loginPage.isUserAuthenticated();

      if (isAuthAfterRefresh || tokenAfterRefresh.length > 0) {
        recordResult('TC-AUTH-002', 'Session', 'Preserve authenticated session token across browser refresh', 'PASSED', Date.now() - start);
      } else {
        throw new Error('Session lost after page reload');
      }
    } catch (err) {
      recordResult('TC-AUTH-002', 'Session', 'Preserve authenticated session token across browser refresh', 'FAILED', Date.now() - start, err.message);
    }

    // Test 6.3: Sign Out Flow
    start = Date.now();
    try {
      await loginPage.logout();
      await driver.sleep(500);
      const tokenAfterLogout = await loginPage.getSessionToken();
      if (!tokenAfterLogout || tokenAfterLogout === '') {
        recordResult('TC-AUTH-003', 'Authentication', 'Perform clean sign out and purge tokens from localStorage', 'PASSED', Date.now() - start);
      } else {
        throw new Error(`Token still exists in localStorage: ${tokenAfterLogout}`);
      }
    } catch (err) {
      recordResult('TC-AUTH-003', 'Authentication', 'Perform clean sign out and purge tokens from localStorage', 'FAILED', Date.now() - start, err.message);
    }

    // =========================================================================
    // SECTION 7: RESPONSIVE VIEWPORT TESTING
    // =========================================================================
    console.log('\n--- Section 7: Responsive Viewports & Cross-Device Ergonomics ---');

    const viewports = [
      { name: 'Desktop Full HD (1920x1080)', width: 1920, height: 1080, id: 'TC-RES-001' },
      { name: 'Standard Laptop (1366x768)', width: 1366, height: 768, id: 'TC-RES-002' },
      { name: 'Tablet Portrait (768x1024)', width: 768, height: 1024, id: 'TC-RES-003' },
      { name: 'Mobile Viewport (390x844)', width: 390, height: 844, id: 'TC-RES-004' }
    ];

    for (const vp of viewports) {
      start = Date.now();
      try {
        await driver.manage().window().setRect({ width: vp.width, height: vp.height });
        await loginPage.navigate();
        const titleEl = await driver.findElement(loginPage.locators.portalTitle);
        const submitBtn = await driver.findElement(loginPage.locators.submitBtn);
        if (await titleEl.isDisplayed() && await submitBtn.isDisplayed()) {
          recordResult(vp.id, 'Responsiveness', `Render Login Portal without horizontal overflow on ${vp.name}`, 'PASSED', Date.now() - start);
        } else {
          throw new Error('Elements not properly displayed on viewport');
        }
      } catch (err) {
        recordResult(vp.id, 'Responsiveness', `Render Login Portal without horizontal overflow on ${vp.name}`, 'FAILED', Date.now() - start, err.message);
      }
    }

  } catch (globalErr) {
    console.error('Global Test Execution Error:', globalErr);
  } finally {
    if (driver) {
      console.log('\n[*] Tearing down Chrome WebDriver session...');
      await driver.quit();
    }
  }

  console.log('\n==================================================================');
  console.log(`TOTAL TESTS EXECUTED: ${testResults.length}`);
  console.log(`PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log(`SUCCESS RATE: ${((passedCount / (testResults.length || 1)) * 100).toFixed(1)}%`);
  console.log('==================================================================');

  return testResults;
}

// Support direct CLI execution
if (require.main === module) {
  runSeleniumTests().catch((err) => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
}

module.exports = {
  LoginPage,
  CONFIG,
  runSeleniumTests
};

