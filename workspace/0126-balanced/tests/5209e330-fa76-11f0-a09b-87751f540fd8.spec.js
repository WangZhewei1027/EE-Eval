import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5209e330-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for the Big-Theta page
class BigThetaPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.showButton = page.locator("button[onclick='showBigTheta()']");
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickShowBigTheta() {
    await this.showButton.click();
  }

  async hasBigThetaElement() {
    return await this.page.evaluate(() => document.getElementById('bigTheta') !== null);
  }

  async getShowBigThetaSource() {
    return await this.page.evaluate(() => {
      return window.showBigTheta ? window.showBigTheta.toString() : null;
    });
  }

  async hasRenderPageFunction() {
    return await this.page.evaluate(() => typeof window.renderPage === 'function');
  }

  async getButtonAttribute(attr) {
    return await this.showButton.getAttribute(attr);
  }

  async isButtonVisible() {
    return await this.showButton.isVisible();
  }

  async getTitleText() {
    return await this.page.textContent('h1');
  }
}

test.describe('Big-Theta Interactive Application (FSM tests)', () => {
  // Will collect runtime errors and console messages per test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors (uncaught exceptions) - we should observe errors caused by showBigTheta()
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Also collect console messages for additional evidence (warnings/errors/info)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // give a short breathing room for any late errors to surface
    // (not modifying page or functions - just waiting)
    await new Promise((r) => setTimeout(r, 50));
    // Nothing else to teardown; Playwright fixture handles page close
  });

  test('Idle state: initial render verifies presence of static content and expected initial state', async ({ page }) => {
    // Purpose: validate the S0_Idle state per FSM:
    // - Page loads
    // - The "Show Big-Theta" button is present
    // - There is no #bigTheta element yet
    // - No runtime errors occurred on load (renderPage() is not invoked by the page)
    const p = new BigThetaPage(page);

    // Verify page title/content loaded
    await expect(p.getTitleText()).resolves.toContain('Big-Theta Notation');

    // Verify the expected button exists and is visible
    await expect(p.isButtonVisible()).resolves.toBe(true);
    await expect(p.getButtonAttribute('onclick')).resolves.toBe('showBigTheta()');

    // Verify FSM's mentioned entry action renderPage() is not present on the window (the HTML does not define it)
    const hasRenderPage = await p.hasRenderPageFunction();
    expect(hasRenderPage).toBe(false);

    // Verify #bigTheta element does not exist initially
    const hasBigTheta = await p.hasBigThetaElement();
    expect(hasBigTheta).toBe(false);

    // Ensure no page errors were emitted during load
    expect(pageErrors.length).toBe(0);

    // No console error messages on initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: clicking "Show Big-Theta" triggers showBigTheta() and results in a runtime error due to missing #bigTheta', async ({ page }) => {
    // Purpose: validate transition S0_Idle -> S1_ShowBigTheta on ShowBigThetaClick
    // We intentionally allow runtime error to occur and assert that it does occur (per instructions).
    const p = new BigThetaPage(page);

    // Ensure the function exists on window
    const source = await p.getShowBigThetaSource();
    expect(typeof source === 'string' && source.length > 0).toBe(true);
    // The function should contain evidence of attempting to set innerHTML to 'O(1)'
    expect(source).toContain("const bigTheta = 'O(1)'");
    expect(source).toContain("innerHTML");

    // Prepare to capture the pageerror event produced by the function (uncaught TypeError expected)
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'), // wait for uncaught exception
      p.clickShowBigTheta(), // trigger the function via button click
    ]);

    // Assert that a page error occurred and it's a TypeError related to innerHTML / null element
    expect(error).toBeTruthy();
    // Error message can vary across engines; check for indicative substrings
    const msg = String(error.message || error.toString() || '');
    expect(msg.toLowerCase()).toContain('innerhtml');

    // Document should still not contain #bigTheta (the function attempted to write to it but element is absent)
    const hasBigThetaAfter = await p.hasBigThetaElement();
    expect(hasBigThetaAfter).toBe(false);

    // Ensure the pageErrors collected include the caught error (length >= 1)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Console should at least show an error-level entry related to the uncaught exception or browser reporting
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    // Either console emitted an error or pageerror exists; at least one should indicate the problem
    const foundRelevantConsole = consoleErrorMessages.some(text => text.toLowerCase().includes('innerhtml') || text.toLowerCase().includes('cannot'));
    // We assert that either a console error mentions innerHTML/cannot OR pageerror exists (we already asserted pageerror).
    expect(foundRelevantConsole || pageErrors.length > 0).toBe(true);
  });

  test('Edge case: multiple clicks produce repeated runtime errors (one per invocation)', async ({ page }) => {
    // Purpose: verify repeated triggering of the transition causes repeated runtime errors
    const p = new BigThetaPage(page);

    // Click twice and wait for two pageerror events
    const errorEvents = [];
    const capture = async () => {
      const ev = await page.waitForEvent('pageerror', { timeout: 2000 });
      errorEvents.push(ev);
    };

    // Start waiting for two errors, then trigger two clicks
    const waiter1 = capture();
    const waiter2 = capture();

    // Trigger two clicks; each should produce an uncaught error when showBigTheta runs
    await p.clickShowBigTheta();
    await p.clickShowBigTheta();

    // Await both error captures
    await Promise.all([waiter1, waiter2]);

    // There should be at least two captured errors
    expect(errorEvents.length).toBeGreaterThanOrEqual(2);
    // Each error message should reference innerHTML (evidence the same bug occurs each time)
    for (const ev of errorEvents) {
      const text = String(ev.message || ev.toString() || '');
      expect(text.toLowerCase()).toContain('innerhtml');
    }
  });

  test('FSM observables: verify showBigTheta function source contains expected observable assignment', async ({ page }) => {
    // Purpose: assert that the function body contains the observable described in the FSM:
    // expected_observables: "bigTheta.innerHTML = 'O(1)';"
    const p = new BigThetaPage(page);

    const source = await p.getShowBigThetaSource();
    expect(source).not.toBeNull();

    // The function should contain the constant assignment and attempt to set innerHTML to 'O(1)'
    expect(source).toContain("const bigTheta = 'O(1)'");
    // It should reference bigTheta and innerHTML assignment as per FSM evidence
    expect(source).toMatch(/bigTheta.*innerHTML/);
  });

  test('Robustness: clicking the button does not create a #bigTheta element implicitly (no fallback creation)', async ({ page }) => {
    // Purpose: ensure the page does not implicitly create the missing element; the function attempts to write to it only
    const p = new BigThetaPage(page);

    // Click and consume the resulting pageerror
    const [err] = await Promise.all([page.waitForEvent('pageerror'), p.clickShowBigTheta()]);
    expect(err).toBeTruthy();

    // After the error, assert that there is still no element with id "bigTheta"
    const exists = await p.page.evaluate(() => !!document.getElementById('bigTheta'));
    expect(exists).toBe(false);
  });

  test('Documentation checks: static page lists example complexities (sanity check of content)', async ({ page }) => {
    // Purpose: verify the static examples in the page content (helps validate initial Idle state's render)
    await expect(page.locator('ul')).toContainText('O(1)');
    await expect(page.locator('ul')).toContainText('O(log n)');
    await expect(page.locator('ul')).toContainText('O(n)');
    await expect(page.locator('ul')).toContainText('O(n log n)');
  });
});