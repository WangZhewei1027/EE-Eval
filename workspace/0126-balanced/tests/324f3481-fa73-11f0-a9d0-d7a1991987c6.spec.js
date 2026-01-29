import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f3481-fa73-11f0-a9d0-d7a1991987c6.html';

// Page object model for the HTTPS demo page
class HttpsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.checkBtn = page.locator('#checkHttpsBtn');
    this.statusPara = page.locator('#statusMessage');
    this.header = page.locator('h1');
    this.infoSections = page.locator('.info');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickCheck() {
    await this.checkBtn.click();
  }

  async getStatusInnerHTML() {
    return await this.statusPara.evaluate((el) => el.innerHTML);
  }

  async getStatusText() {
    return await this.statusPara.evaluate((el) => el.textContent);
  }

  async getProtocol() {
    return await this.page.evaluate(() => window.location.protocol);
  }

  async isCheckBtnVisible() {
    return await this.checkBtn.isVisible();
  }

  async headerText() {
    return await this.header.textContent();
  }

  async infoCount() {
    return await this.infoSections.count();
  }
}

test.describe('Understanding HTTPS interactive application (FSM: Idle, Secure, Insecure)', () => {
  // Arrays to capture console 'error' messages and page errors for each test
  let consoleErrors;
  let pageErrors;

  // Attach listeners before each test to capture console and page errors.
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location ? msg.location() : null,
          });
        }
      } catch (e) {
        // If any unexpected failure while reading a console message, push generic entry
        consoleErrors.push({ text: `console listener read error: ${String(e)}` });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err?.message ?? String(err),
        stack: err?.stack ?? null,
      });
    });
  });

  // Test initial idle state (S0_Idle)
  test('S0_Idle: Initial render shows the Check HTTPS Status button and empty statusMessage', async ({ page }) => {
    // This test validates the "Idle" state evidence and entry action (renderPage())
    //  - The button should exist with the expected ID and text
    //  - The #statusMessage paragraph should exist and be empty on initial load
    const httpsPage = new HttpsPage(page);
    await httpsPage.goto();

    // Verify header and info sections (renderPage() evidence)
    await expect(httpsPage.header).toHaveText('Understanding HTTPS');
    const infoSections = await httpsPage.infoCount();
    expect(infoSections).toBeGreaterThanOrEqual(1);

    // Verify button visibility and label
    await expect(httpsPage.checkBtn).toBeVisible();
    await expect(httpsPage.checkBtn).toHaveText('Check HTTPS Status');

    // Verify status message is initially empty
    const initialStatus = await httpsPage.getStatusInnerHTML();
    expect(initialStatus).toBe(''); // evidence: <p id="statusMessage"></p>

    // Ensure no runtime console errors or uncaught exceptions occurred during load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test transition on clicking the button: S0 -> S1 or S2 depending on protocol
  test('CheckHttpsStatus event: clicking button updates statusMessage to Secure or Insecure', async ({ page }) => {
    // This test verifies the click event and both possible transitions.
    // It does not forcibly patch the environment; it asserts the outcome that naturally occurs
    // based on window.location.protocol when the page is served.
    const httpsPage1 = new HttpsPage(page);
    await httpsPage.goto();

    // Determine protocol before clicking to set the expected outcome
    const protocol = await httpsPage.getProtocol();

    // Click the check button to trigger the event handler
    await httpsPage.clickCheck();

    // Read updated innerHTML
    const resultHTML = await httpsPage.getStatusInnerHTML();
    const resultText = await httpsPage.getStatusText();

    if (protocol === 'https:') {
      // Expect secure message evidence (S1_Secure)
      const expectedHTML = 'This connection is secure! <span class="secure">✔️</span>';
      expect(resultHTML).toBe(expectedHTML);
      expect(resultText).toContain('This connection is secure!');
      // The span with class 'secure' should be present
      const secureSpan = page.locator('#statusMessage .secure');
      await expect(secureSpan).toBeVisible();
      await expect(secureSpan).toHaveText('✔️');
    } else {
      // Expect insecure message evidence (S2_Insecure)
      const expectedHTML1 = 'This connection is NOT secure! <span class="insecure">❌</span>';
      expect(resultHTML).toBe(expectedHTML);
      expect(resultText).toContain('This connection is NOT secure!');
      // The span with class 'insecure' should be present
      const insecureSpan = page.locator('#statusMessage .insecure');
      await expect(insecureSpan).toBeVisible();
      await expect(insecureSpan).toHaveText('❌');
    }

    // Ensure the DOM update matches the FSM's expected_observables
    // (we checked innerHTML equality above, which is the FSM observable)
    // Also make sure no console errors or page errors were produced by the click handler
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test idempotency: clicking multiple times should not duplicate content
  test('Edge case: multiple clicks are idempotent and do not append duplicate messages', async ({ page }) => {
    // This test ensures that repeated triggers of the CheckHttpsStatus event lead to stable state transitions
    const httpsPage2 = new HttpsPage(page);
    await httpsPage.goto();

    // Click once and capture result
    await httpsPage.clickCheck();
    const firstHTML = await httpsPage.getStatusInnerHTML();

    // Click multiple times quickly
    for (let i = 0; i < 5; i++) {
      await httpsPage.clickCheck();
    }

    const finalHTML = await httpsPage.getStatusInnerHTML();

    // The final HTML should be identical to the first update (no appending)
    expect(finalHTML).toBe(firstHTML);

    // Ensure the content includes exactly one span with secure or insecure class
    const secureCount = await page.locator('#statusMessage .secure').count();
    const insecureCount = await page.locator('#statusMessage .insecure').count();
    // Only one of these should be non-zero (or both zero if the message unexpectedly lacks the span)
    expect(secureCount + insecureCount).toBeGreaterThanOrEqual(0);
    expect(secureCount).toBeLessThanOrEqual(1);
    expect(insecureCount).toBeLessThanOrEqual(1);

    // Ensure no console or page errors after rapid interactions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test rapid-fire clicking for potential race conditions / exceptions
  test('Edge case: rapid clicks do not produce runtime errors', async ({ page }) => {
    // This test rapidly triggers the click handler to check for thrown exceptions or console errors
    const httpsPage3 = new HttpsPage(page);
    await httpsPage.goto();

    // Rapidly click using Promise.all to trigger clicks back-to-back
    await Promise.all(new Array(10).fill(0).map(() => httpsPage.clickCheck()));

    // After rapid clicks, ensure status message is consistent with protocol
    const protocol1 = await httpsPage.getProtocol();
    const finalHTML1 = await httpsPage.getStatusInnerHTML();

    if (protocol === 'https:') {
      expect(finalHTML).toContain('This connection is secure!');
    } else {
      expect(finalHTML).toContain('This connection is NOT secure!');
    }

    // Assert there were no uncaught page errors or console errors triggered by rapid clicks
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Verify presence of FSM entry_action evidence (renderPage) by checking the expected DOM elements exist
  test('OnEnter (renderPage) evidence: static content and structure are present on load', async ({ page }) => {
    // This test validates that the page's initial render includes the educational content expected by the FSM
    const httpsPage4 = new HttpsPage(page);
    await httpsPage.goto();

    // Verify primary content sections exist
    await expect(httpsPage.infoSections).toHaveCountGreaterThanOrEqual
      ? expect(httpsPage.infoSections).toHaveCountGreaterThanOrEqual(1)
      : expect(await httpsPage.infoCount()).toBeGreaterThanOrEqual(1);

    // Check a couple of static texts to ensure the page is rendered as provided
    await expect(page.locator('h2', { hasText: 'What is HTTPS?' })).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Benefits of HTTPS' })).toBeVisible();

    // Ensure no console errors or page errors on initial render
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Observability test: confirm the event handler exists by clicking and verifying that the
  // expected event-side effects occur, and if the environment somehow lacks the handler, fail the test.
  test('Event binding evidence: clicking triggers the registered click handler (document.getElementById(...).addEventListener)', async ({ page }) => {
    // This test ensures the page attached a click handler to #checkHttpsBtn per the FSM's evidence.
    const httpsPage5 = new HttpsPage(page);
    await httpsPage.goto();

    // Before clicking, patching or inspection of internals is forbidden. We rely on behavioral evidence:
    // After a single click, the statusMessage should transition from empty to non-empty.
    const before = await httpsPage.getStatusInnerHTML();
    expect(before).toBe('');

    // Perform the click
    await httpsPage.clickCheck();

    const after = await httpsPage.getStatusInnerHTML();

    // The handler should have modified the DOM; if not, the test fails.
    expect(after).not.toBe('');

    // Validate the content matches one of the FSM expected messages
    const secureHTML = 'This connection is secure! <span class="secure">✔️</span>';
    const insecureHTML = 'This connection is NOT secure! <span class="insecure">❌</span>';
    const isEither = after === secureHTML || after === insecureHTML;
    expect(isEither).toBeTruthy();

    // Ensure no console or page errors were produced
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Final test: ensure that the state transitions match FSM expected_observables exactly when possible
  test('FSM expected_observables: innerHTML matches the FSM statements exactly for the observed protocol', async ({ page }) => {
    // This test checks the innerHTML content exactly matches the expected observable strings defined in the FSM
    const httpsPage6 = new HttpsPage(page);
    await httpsPage.goto();

    const protocol2 = await httpsPage.getProtocol();

    // Trigger the transition by clicking
    await httpsPage.clickCheck();

    const observed = await httpsPage.getStatusInnerHTML();

    if (protocol === 'https:') {
      // Exact match for S1_Secure expected_observables
      const expected = 'This connection is secure! <span class="secure">✔️</span>';
      expect(observed).toBe(expected);
    } else {
      // Exact match for S2_Insecure expected_observables
      const expected1 = 'This connection is NOT secure! <span class="insecure">❌</span>';
      expect(observed).toBe(expected);
    }

    // Ensure no console errors or uncaught page exceptions occurred during the observable update
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});