import { test, expect } from '@playwright/test';

// Test file for application ID: 520c0610-fa76-11f0-a09b-87751f540fd8
// URL under test:
// http://127.0.0.1:5500/workspace/0126-balanced/html/520c0610-fa76-11f0-a09b-87751f540fd8.html
//
// These tests load the page exactly as-is, observe console logs and page errors,
// allow runtime errors to happen naturally, and assert that they occur.
// We do NOT modify or patch the page environment in any way.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520c0610-fa76-11f0-a09b-87751f540fd8.html';

// Page object representing the static Hash Functions page
class HashFunctionsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async title() {
    return this.page.title();
  }

  async headingText() {
    const h = await this.page.locator('h1').first();
    return h.textContent();
  }

  async paragraphsText() {
    return this.page.locator('p').allTextContents();
  }

  async hasInteractiveElements() {
    // Detect common interactive form and anchor elements
    const count = await this.page.evaluate(() => {
      return document.querySelectorAll('button, a, input, textarea, select, [role="button"]').length;
    });
    return count > 0;
  }

  async globalRenderPageExists() {
    return this.page.evaluate(() => {
      try {
        return typeof window.renderPage === 'function';
      } catch (e) {
        // If accessing window.renderPage throws for any reason, return false to allow test assertions
        return false;
      }
    });
  }
}

test.describe('Hash Functions interactive application (static)', () => {
  // Capture page errors and console messages for each test
  test('renders static content matching FSM "Idle" evidence', async ({ page }) => {
    // This test validates that the static content described in the FSM (S0_Idle)
    // is present on the page: an <h1> with "Hash Functions" and an explanatory paragraph.
    const pageObj = new HashFunctionsPage(page);

    // Attach listeners BEFORE navigation so we capture errors that occur during load
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    await pageObj.goto();

    // Title check
    const title = await pageObj.title();
    expect(title).toBe('Hash Functions');

    // Heading check
    const hText = (await pageObj.headingText())?.trim();
    expect(hText).toBe('Hash Functions');

    // Paragraphs should include the expected explanation about hash functions
    const paragraphs = await pageObj.paragraphsText();
    const joined = paragraphs.join('\n');
    expect(joined).toContain('Hash functions are one-way functions that take input data and produce a fixed-size string of characters, known as a hash value or digest.');

    // The FSM entry action mentions renderPage(); the HTML/JS provided does not define renderPage.
    // We assert that there is no global renderPage function.
    const hasRenderPage = await pageObj.globalRenderPageExists();
    expect(hasRenderPage).toBe(false);

    // Assert that page errors were captured during or after load.
    // The page uses Node-style crypto.createHash which will cause an error in browser contexts.
    // Accept either a TypeError about createHash not being a function or a ReferenceError mentioning crypto.
    const errorTexts = pageErrors.map(e => String(e && e.message ? e.message : e));
    const consoleErrorTexts = consoleMessages.filter(m => m.type === 'error').map(m => m.text);

    const combinedErrors = [...errorTexts, ...consoleErrorTexts].join(' | ');

    // There should be at least one error related to crypto/createHash usage
    const matchesCryptoError = /createHash|crypto|not a function|ReferenceError|TypeError/i.test(combinedErrors);
    expect(matchesCryptoError).toBe(true);
  });

  test('no interactive elements or transitions are present (matches FSM: no events/transitions)', async ({ page }) => {
    // This test verifies the FSM claim that the page is static and contains no interactive UI controls.
    const pageObj1 = new HashFunctionsPage(page);

    // Attach listeners to capture runtime errors for completeness (they are expected)
    const pageErrors1 = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    await pageObj.goto();

    // The page should not contain interactive elements (buttons, inputs, anchors used as buttons, etc.)
    const hasInteractive = await pageObj.hasInteractiveElements();
    expect(hasInteractive).toBe(false);

    // As an extra check, there are no script-connected event handlers detected by the FSM.
    // Here we assert that there are no inline script tags that attach events to DOM elements.
    // We do a DOM inspection to ensure no 'onclick' attributes exist.
    const inlineOnClickCount = await page.evaluate(() => {
      return document.querySelectorAll('[onclick]').length;
    });
    expect(inlineOnClickCount).toBe(0);

    // Confirm that at least one page error occurred due to the Node-style crypto usage.
    // This asserts that we observed runtime errors without attempting to patch them.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('console output does not contain successful hash results and errors are observable', async ({ page }) => {
    // This test confirms that the page did not successfully compute and log hash values
    // (because the Node 'crypto' API is not available in the browser), and that we observed errors.
    const pageObj2 = new HashFunctionsPage(page);

    const pageErrors2 = [];
    const consoleMessages1 = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    await pageObj.goto();

    // Ensure we did not see console.log outputs for the hash values ("Hash value for Hello, World!" or "MD5 hash")
    const logs = consoleMessages.filter(m => m.type === 'log').map(m => m.text);
    const printedHash = logs.some(t => /Hash value for\s*Hello, World!|MD5 hash value for/i.test(t));
    // Because the script is expected to throw before the console.log lines, we assert that these logs are absent.
    expect(printedHash).toBe(false);

    // Ensure at least one pageerror exists and contains details about crypto/createHash misuse.
    const errorMessages = pageErrors.map(e => String(e && e.message ? e.message : e));
    const errorFound = errorMessages.some(msg => /createHash|crypto|not a function|ReferenceError|TypeError/i.test(msg));
    expect(errorFound).toBe(true);
  });

  test('edge case: accessing non-existent global functions does not crash the test harness', async ({ page }) => {
    // This test attempts to read some globals that the FSM or page references (e.g., renderPage),
    // verifying that probing these globals does not modify the page or attempt to repair errors.
    const pageObj3 = new HashFunctionsPage(page);

    // No listeners needed for this simple DOM/global check, but keep them for safety
    const pageErrors3 = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await pageObj.goto();

    // Accessing a non-existent global should return false from our helper
    const hasRenderPage1 = await pageObj.globalRenderPageExists();
    expect(hasRenderPage).toBe(false);

    // Confirm that probing globals did not clear the naturally occurring page errors.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });
});