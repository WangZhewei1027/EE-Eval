import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7186a2b0-d362-11f0-85a0-d3271c47ca09.html';

// Page Object Model for the simple static page
class SimplePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Returns the full body text
  async bodyText() {
    return (await this.page.locator('body').innerText()).trim();
  }

  // Count of interactive elements: buttons, inputs, anchors
  async countInteractiveElements() {
    const btns = await this.page.locator('button').count();
    const inputs = await this.page.locator('input, textarea, select').count();
    const anchors = await this.page.locator('a').count();
    return { buttons: btns, inputs, anchors, total: btns + inputs + anchors };
  }

  // Check if a global variable exists on the window
  async hasGlobalVariable(varName) {
    return this.page.evaluate((name) => Object.prototype.hasOwnProperty.call(window, name), varName);
  }

  // Get the typeof a global variable
  async typeOfGlobal(varName) {
    return this.page.evaluate((name) => typeof window[name], varName);
  }
}

test.describe('Application FSM: S0_Idle (static page)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors before each test
    pageErrors = [];
    consoleMessages = [];

    // Collect console messages (all types) during page load and interaction
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err.message,
        stack: err.stack,
      });
    });

    // Navigate to the application page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // No teardown required beyond Playwright's automatic handling, but we keep this hook for clarity
  test.afterEach(async () => {
    // Intentionally left blank - placeholder for potential cleanup
  });

  test('S0_Idle: renders the expected static content (entry action renderPage() should not be required)', async ({ page }) => {
    // Use the Page Object to interact with the page
    const p = new SimplePage(page);

    // The FSM's evidence expects: a variable named "myVariable" to the value of 10.
    // The provided HTML implementation is the plain sentence; verify it is present verbatim.
    const body = await p.bodyText();
    expect(body).toContain('a variable named "myVariable" to the value of 10.');

    // Ensure no runtime page errors were raised during load
    expect(pageErrors).toHaveLength(0);

    // Ensure console did not emit error-level messages during load
    const errorConsoleMsgs = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMsgs).toHaveLength(0);
  });

  test('S0_Idle: has no interactive elements (no transitions expected)', async ({ page }) => {
    // Verify the page contains no buttons, inputs, or links as noted by the FSM extraction
    const p = new SimplePage(page);
    const counts = await p.countInteractiveElements();

    // The FSM extraction noted "No interactive elements or event handlers were found."
    expect(counts.total).toBe(0);
    expect(counts.buttons).toBe(0);
    expect(counts.inputs).toBe(0);
    expect(counts.anchors).toBe(0);
  });

  test('S0_Idle: global variable "myVariable" is not implicitly set by the page', async ({ page }) => {
    const p = new SimplePage(page);

    // The FSM evidence suggests a variable named myVariable should be set to 10.
    // The HTML/JS contains no script, so the variable should not exist.
    const hasMyVar = await p.hasGlobalVariable('myVariable');
    expect(hasMyVar).toBe(false);

    // typeof should be 'undefined'
    const type = await p.typeOfGlobal('myVariable');
    expect(type).toBe('undefined');
  });

  test('Entry action "renderPage()" is not present/executed (no implicit ReferenceError during load)', async ({ page }) => {
    // The FSM lists an entry action renderPage(), but the implementation contains no scripts.
    // We assert that no ReferenceError or other pageerror regarding renderPage occurred during load.
    // If the page had attempted to call a missing function at load, we'd have captured a pageerror.
    const renderPageErrors = pageErrors.filter((e) => e.message.includes('renderPage'));
    expect(renderPageErrors).toHaveLength(0);

    // Also assert that no console messages reference renderPage
    const renderPageConsole = consoleMessages.filter((m) => m.text.includes('renderPage'));
    expect(renderPageConsole).toHaveLength(0);
  });

  test('Edge case: ensure no unexpected runtime exceptions or syntax errors on the page', async ({ page }) => {
    // This test explicitly asserts that no page-level exceptions occurred during navigation.
    // It validates the environment remains stable for a static content page.
    expect(pageErrors.length).toBe(0);

    // Also verify that console messages do not include 'SyntaxError' or 'ReferenceError'
    const problematicConsole = consoleMessages.filter((m) =>
      /ReferenceError|SyntaxError|TypeError/.test(m.text)
    );
    expect(problematicConsole).toHaveLength(0);
  });

  test('Observability: capture console and page errors arrays are accessible for debugging', async ({ page }) => {
    // This test ensures our collectors are populated (or empty) and accessible for inspection.
    // It does not assert a specific length beyond being defined arrays.
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);

    // For clarity, ensure that both arrays are defined even if empty
    expect(consoleMessages).not.toBeNull();
    expect(pageErrors).not.toBeNull();
  });

  // Since FSM lists no transitions or events, include a test explicitly asserting that no transitions can be triggered
  test('No transitions available: interaction attempts do not change state or DOM', async ({ page }) => {
    // Attempt generic interactions that should be no-ops on this static page.
    // Because there are no interactive elements, these actions are inert.
    // Verify the body text remains unchanged after no-op interactions.
    const p = new SimplePage(page);
    const before = await p.bodyText();

    // Try clicking at the center of the page (not targeting any element)
    await page.mouse.click(10, 10);

    const after = await p.bodyText();
    expect(after).toBe(before);

    // Confirm still no global variable created by user interactions
    const hasMyVar = await p.hasGlobalVariable('myVariable');
    expect(hasMyVar).toBe(false);
  });
});