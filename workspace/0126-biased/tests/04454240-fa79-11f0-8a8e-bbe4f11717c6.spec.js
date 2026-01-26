import { test, expect } from '@playwright/test';

// Test file for Application ID: 04454240-fa79-11f0-8a8e-bbe4f11717c6
// URL served at: http://127.0.0.1:5500/workspace/0126-biased/html/04454240-fa79-11f0-8a8e-bbe4f11717c6.html
// This suite validates the single FSM state (Idle), verifies page content,
// observes console and page errors, and asserts that runtime JS errors (ReferenceError, TypeError, SyntaxError)
// occur naturally (without modifying the page).

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04454240-fa79-11f0-8a8e-bbe4f11717c6.html';

// Simple Page Object to encapsulate selectors and common checks
class SymmetricCryptoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('.container');
    this.heading = page.locator('h1');
    this.paragraph = page.locator('.container > p');
    this.sections = page.locator('.section');
    this.scriptTag = page.locator('script[src="script.js"]');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeadingText() {
    return this.heading.textContent();
  }

  async getIntroParagraphText() {
    return this.paragraph.textContent();
  }

  async getSectionCount() {
    return this.sections.count();
  }

  async hasScriptTag() {
    return this.scriptTag.count().then(c => c > 0);
  }

  async hasInteractiveElements() {
    // Check for commonly interactive elements (buttons, inputs, links)
    const interactive = this.page.locator('button, input, textarea, select, a[href]');
    return interactive.count();
  }
}

// Utility to collect console error messages and page errors during navigation
async function collectRuntimeErrors(page, action) {
  const consoleErrors = [];
  const pageErrors = [];

  const onConsole = msg => {
    try {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    } catch (e) {
      // ignore inspection errors
    }
  };

  const onPageError = err => {
    // err is an Error object from the page context
    pageErrors.push(err);
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  try {
    await action();
    // give some extra time for async errors that happen after load
    await page.waitForTimeout(500);
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }

  return { consoleErrors, pageErrors };
}

// Group tests related to the FSM state and static content
test.describe('Symmetric Cryptography - FSM state and static content', () => {
  test.beforeEach(async ({ page }) => {
    // No special setup beyond navigation in each test
  });

  test.afterEach(async ({ page }) => {
    // small teardown delay to ensure background tasks settle
    await page.waitForTimeout(50);
  });

  test('Idle state: page renders expected heading and introductory paragraph (entry action evidence)', async ({ page }) => {
    // Validate the Idle state's evidence is present in the DOM.
    const view = new SymmetricCryptoPage(page);

    // Collect runtime errors while loading the page (per requirement to observe console/page errors)
    const { consoleErrors, pageErrors } = await collectRuntimeErrors(page, async () => {
      await view.goto();
    });

    // Verify visible content expected by the FSM state's evidence
    await expect(view.heading).toHaveText('Symmetric Cryptography');
    await expect(view.paragraph).toHaveText('Learn how to create secure encryption methods using symmetric cryptography.');

    // The FSM listed renderPage() as an entry action. We cannot call or patch anything,
    // but we assert the page structure exists as rendered static content.
    const sectionCount = await view.getSectionCount();
    // There are 6 sections present in the HTML implementation
    expect(sectionCount).toBeGreaterThanOrEqual(5);

    // Ensure the script tag referencing script.js is present (the HTML includes it)
    const hasScript = await view.hasScriptTag();
    expect(hasScript).toBe(true);

    // Confirm that any console or page errors were captured (we assert that at least one runtime error occurred).
    // Per instructions, let runtime ReferenceError/TypeError/SyntaxError happen naturally and assert they occur.
    const allErrorMessages = [
      ...consoleErrors.map(e => e.text),
      ...pageErrors.map(e => (e && e.message) || String(e))
    ];

    // For clarity in assertions, attach the errors to the test output if present
    if (allErrorMessages.length > 0) {
      console.log('Captured runtime error messages during load:', allErrorMessages);
    }

    // Assert that at least one error of the required types occurred.
    // This aligns with the task requirement to observe and assert that such errors happen naturally.
    const hasJSErrorType = allErrorMessages.some(msg => /ReferenceError|TypeError|SyntaxError/i.test(msg));
    expect(hasJSErrorType).toBe(true);
  });

  test('No interactive elements are present (FSM notes: no event handlers, no transitions)', async ({ page }) => {
    // Validate that the page contains no interactive UI controls as the FSM indicates a static page.
    const view = new SymmetricCryptoPage(page);

    await view.goto();

    // Count common interactive elements; expecting zero per FSM extraction summary
    const interactiveCount = await view.hasInteractiveElements();
    expect(interactiveCount).toBe(0);
  });

  test('Ensure section headings and content are present and consistent (edge cases)', async ({ page }) => {
    // Verify each section has a heading and paragraph; also test for missing content edge cases.
    const view = new SymmetricCryptoPage(page);
    await view.goto();

    // There should be multiple .section elements and each should contain an h2 and a p
    const sections = page.locator('.section');
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(5);

    for (let i = 0; i < count; i++) {
      const section = sections.nth(i);
      // each section should have an h2 heading
      const h2 = section.locator('h2');
      await expect(h2).toHaveCount(1);
      const p = section.locator('p');
      await expect(p).toHaveCount(1);

      // ensure heading and paragraph are non-empty strings
      const h2Text = await h2.textContent();
      const pText = await p.textContent();
      expect(typeof h2Text === 'string' && h2Text.trim().length > 0).toBe(true);
      expect(typeof pText === 'string' && pText.trim().length > 0).toBe(true);
    }
  });
});

// Group tests related to runtime error observation and console monitoring explicitly
test.describe('Runtime error observation (console and page errors)', () => {
  test('Observe console and page errors during load and assert JS error types occur', async ({ page }) => {
    // This test focuses on capturing console.error and page 'pageerror' events and asserting
    // that at least one ReferenceError, TypeError, or SyntaxError occurred naturally.

    const view = new SymmetricCryptoPage(page);

    const collected = await collectRuntimeErrors(page, async () => {
      await view.goto();
      // allow potential late microtasks to throw
      await page.waitForTimeout(300);
    });

    const consoleErrors = collected.consoleErrors;
    const pageErrors = collected.pageErrors;

    // Log captured details for debugging; tests will assert presence below
    if (consoleErrors.length) {
      console.log('Console error messages:', consoleErrors.map(e => e.text));
    }
    if (pageErrors.length) {
      console.log('Page error messages:', pageErrors.map(e => e.message));
    }

    // Combine messages for search
    const combined = [
      ...consoleErrors.map(e => e.text),
      ...pageErrors.map(e => (e && e.message) || '')
    ].join('\n');

    // Assert that at least one of the JS error types occurred
    const matches = /ReferenceError|TypeError|SyntaxError/i.test(combined);
    expect(matches).toBe(true);
  });

  test('No artificial fixes or patches are injected - natural error observation', async ({ page }) => {
    // This test ensures we did not modify the page environment; we simply load and observe.
    // We validate that the browser global 'window' does not have test-introduced helpers defined.
    // DO NOT inject or define anything; only observe the natural environment.

    await page.goto(APP_URL);
    // Wait shortly to ensure page static content is loaded
    await page.waitForTimeout(100);

    // Check that there is no global "renderPage" defined by the test harness (we must not inject)
    // Note: We do not create or modify window; we only read it.
    const hasRenderPage = await page.evaluate(() => {
      try {
        // Return true if renderPage exists on window, false otherwise
        // We don't call it; just check for existence
        return typeof window.renderPage !== 'undefined';
      } catch (e) {
        // If accessing window.renderPage throws, propagate the error string
        return `error:${String(e)}`;
      }
    });

    // The page's FSM mentioned an entry action renderPage(); the HTML did not define it.
    // We expect that renderPage is not injected by the test harness: assert it's falsy or not defined.
    // If it's defined by the page itself, that's acceptable; the key is we didn't inject it.
    // So ensure the returned value is either false or a string (error) that does not indicate test injection.
    expect(hasRenderPage === false || typeof hasRenderPage === 'string' || hasRenderPage === undefined).toBeTruthy();
  });
});