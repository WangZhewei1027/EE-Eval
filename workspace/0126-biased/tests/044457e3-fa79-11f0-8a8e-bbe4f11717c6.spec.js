import { test, expect } from '@playwright/test';

// Test file for Application ID: 044457e3-fa79-11f0-8a8e-bbe4f11717c6
// This suite validates the static "Idle" state of the Agile Methodology page,
// observes console and page errors produced by the page load (script.js reference),
// and verifies that there are no interactive transitions as described by the FSM.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/044457e3-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Agile Methodology - FSM: S0_Idle (Static Page)', () => {
  // Arrays to collect runtime errors and console error messages for each test
  let consoleErrors;
  let pageErrors;
  let consoleMessages; // capture all console messages for extra assertions

  // Attach listeners before each test to capture errors that happen during page load
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    consoleMessages = [];

    // Listen for console events (e.g., network/script load errors may appear here)
    page.on('console', (msg) => {
      const type = msg.type(); // e.g., 'error', 'warning', 'log'
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Listen for uncaught exceptions in the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  // No special teardown needed because Playwright closes pages between tests in fixtures,
  // but we still include an afterEach to expose captured diagnostics on failure if helpful.
  test.afterEach(async ({}, testInfo) => {
    // If a test failed, attach captured console and page errors to the test output for debugging
    if (testInfo.status !== testInfo.expectedStatus) {
      testInfo.attach('consoleMessages', {
        body: JSON.stringify(consoleMessages, null, 2),
        contentType: 'application/json'
      });
      testInfo.attach('consoleErrors', {
        body: JSON.stringify(consoleErrors, null, 2),
        contentType: 'application/json'
      });
      testInfo.attach('pageErrors', {
        body: JSON.stringify(pageErrors, null, 2),
        contentType: 'application/json'
      });
    }
  });

  // Page object pattern for the static Agile page
  class AgilePage {
    constructor(page) {
      this.page = page;
    }
    // Get the main header text
    async getHeaderText() {
      return this.page.textContent('header h1');
    }
    // Get the paragraph beneath the header
    async getHeaderParagraph() {
      return this.page.textContent('header p');
    }
    // Count interactive elements that would indicate transitions/events
    async countInteractiveElements() {
      return this.page.$$eval('button, input, select, textarea, a[href]', els => els.length);
    }
    // Snapshot of the main HTML body for change-detection testing
    async getBodySnapshot() {
      return this.page.$eval('body', el => el.innerHTML);
    }
    // Click a non-interactive element (header) to ensure no transitions occur
    async clickHeader() {
      await this.page.click('header h1');
    }
  }

  test('renders static content matching FSM evidence (Idle entry)', async ({ page }) => {
    // This test validates the FSM S0_Idle evidence:
    // - <h1>Agile Methodology</h1> exists
    // - the header paragraph describing Agile is present
    const agile = new AgilePage(page);

    const headerText = await agile.getHeaderText();
    expect(headerText).toBeTruthy();
    expect(headerText.trim()).toBe('Agile Methodology');

    const headerParagraph = await agile.getHeaderParagraph();
    expect(headerParagraph).toBeTruthy();
    expect(headerParagraph).toContain('Agile is a flexible and iterative approach to project management');

    // Also verify that the main sections are present and labeled
    const section1Header = await page.textContent('section.section1 h2');
    const section2Header = await page.textContent('section.section2 h2');
    const section3Header = await page.textContent('section.section3 h2');

    expect(section1Header && section1Header.trim()).toBe('Agile Principles');
    expect(section2Header && section2Header.trim()).toBe('Agile Methodology');
    expect(section3Header && section3Header.trim()).toBe('Benefits of Agile');
  });

  test('observes console and page errors produced during load (script.js / renderPage)', async ({ page }) => {
    // This test specifically validates that runtime errors (if any) are observed.
    // The HTML references script.js and the FSM mentions entry action renderPage().
    // We must not patch or modify anything; we only observe errors and assert they occur.
    // The expectation (per requirements) is that at least one console error or page error occurs.
    // NOTE: This will intentionally fail if the environment produces no errors; that is expected by the test spec.

    // Wait briefly to allow any async runtime errors to surface
    await page.waitForTimeout(300); // small pause to capture late errors

    // Combine captured errors
    const totalErrors = consoleErrors.length + pageErrors.length;

    // Attach captured diagnostics to the test output (for clarity in test reports)
    // Validate that errors occurred during load/execution
    // Per instructions, we assert that runtime errors happen naturally and are observed.
    expect(totalErrors).toBeGreaterThan(0);

    // Additionally, check that at least one error references either 'script.js' or 'renderPage' or indicates a failed load.
    const combinedMessages = [...consoleErrors, ...pageErrors].join(' | ').toLowerCase();
    const likelyIndicators = ['script.js', 'renderpage', 'failed to load', 'referenceerror', 'typeerror', 'syntaxerror', '404', 'net::err'];
    const containsIndicator = likelyIndicators.some(ind => combinedMessages.includes(ind));
    // It's acceptable if none match exactly, but we include a soft expectation:
    expect(containsIndicator).toBeTruthy();
  });

  test('verifies absence of interactive elements and transitions per FSM', async ({ page }) => {
    // FSM indicates there are no interactive elements or transitions.
    // Validate no buttons/inputs/selects/anchors with href exist.
    const agile = new AgilePage(page);
    const interactiveCount = await agile.countInteractiveElements();
    expect(interactiveCount).toBe(0);

    // Verify that clicking non-interactive content does not change the page (no transitions)
    const beforeSnapshot = await agile.getBodySnapshot();
    await agile.clickHeader();
    // Allow any potential JS to run (if it exists)
    await page.waitForTimeout(200);
    const afterSnapshot = await agile.getBodySnapshot();

    expect(afterSnapshot).toBe(beforeSnapshot);
  });

  test('edge case: reload and verify static content remains and errors are consistent', async ({ page }) => {
    // Reload the page and confirm static content remains the same and that errors re-occur or remain observable.
    const agile = new AgilePage(page);

    const beforeHeader = await agile.getHeaderText();
    expect(beforeHeader.trim()).toBe('Agile Methodology');

    // Clear captured arrays to observe new errors on reload
    consoleErrors = [];
    pageErrors = [];
    consoleMessages = [];

    await page.reload();
    // Wait a bit for any runtime errors to re-appear
    await page.waitForTimeout(300);

    // Confirm header still present after reload
    const afterHeader = await agile.getHeaderText();
    expect(afterHeader && afterHeader.trim()).toBe('Agile Methodology');

    // There should be errors observed again (per requirements about letting runtime errors happen naturally)
    const totalErrorsAfterReload = consoleErrors.length + pageErrors.length;
    expect(totalErrorsAfterReload).toBeGreaterThan(0);
  });

  test('error scenario assertion: page error messages are accessible and descriptive', async ({ page }) => {
    // Ensure that captured page errors are strings and provide some diagnostic information.
    // This test asserts that any pageErrors captured are non-empty strings and that console errors are available.
    await page.waitForTimeout(200); // allow any late errors

    // At least one of consoleErrors or pageErrors should be populated per spec
    const total = consoleErrors.length + pageErrors.length;
    expect(total).toBeGreaterThan(0);

    // Validate types and content of captured errors
    for (const msg of pageErrors) {
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
    for (const c of consoleErrors) {
      expect(typeof c).toBe('string');
      expect(c.length).toBeGreaterThan(0);
    }
  });
});