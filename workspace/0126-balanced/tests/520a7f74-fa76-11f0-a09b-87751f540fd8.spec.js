import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520a7f74-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for the ACID Properties page
class AcidPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    this._consoleListener = msg => {
      // Capture console messages as plain text for assertions
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    this._pageErrorListener = err => {
      // Capture uncaught exceptions (page errors)
      // err is an Error object, capture its message
      this.pageErrors.push(err instanceof Error ? err.message : String(err));
    };
    page.on('console', this._consoleListener);
    page.on('pageerror', this._pageErrorListener);
  }

  // Navigate to the application URL and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Return captured console messages
  getConsoleMessages() {
    return this.consoleMessages.map(m => m.text);
  }

  // Return captured page errors (uncaught exceptions)
  getPageErrors() {
    return this.pageErrors;
  }

  // Get the textContent of the #result element
  async getResultText() {
    return this.page.locator('#result').textContent();
  }

  // Get the main heading text
  async getHeadingText() {
    return this.page.locator('h1').textContent();
  }

  // Return array of paragraph texts on the page
  async getParagraphsText() {
    const elems = this.page.locator('p');
    const count = await elems.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await elems.nth(i).textContent());
    }
    return texts;
  }

  // Check for presence of common interactive elements
  async countInteractiveElements() {
    // Count buttons, inputs, selects, textareas
    const buttonCount = await this.page.locator('button').count();
    const inputCount = await this.page.locator('input').count();
    const selectCount = await this.page.locator('select').count();
    const textareaCount = await this.page.locator('textarea').count();
    return buttonCount + inputCount + selectCount + textareaCount;
  }

  // Determine whether a global renderPage function exists
  async isRenderPageDefined() {
    return await this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }

  // Read the db object shape from the page (safely)
  async getDbSnapshot() {
    return await this.page.evaluate(() => {
      return {
        hasDb: typeof window.db !== 'undefined',
        currentTransactionId: window.db ? window.db.currentTransactionId : null,
        transactionsLength: window.db ? (Array.isArray(window.db.transactions) ? window.db.transactions.length : null) : null,
        // do not mutate any globals
      };
    });
  }

  // Call a named function on the page if it exists. Returns the thrown error message if calling causes an exception.
  async callFunctionIfExists(name) {
    return await this.page.evaluate(async (fnName) => {
      try {
        // Check existence first
        const fn = window[fnName];
        if (typeof fn !== 'function') {
          return { called: false, exists: false, error: null, result: null };
        }
        // Call the function; if it logs, console listener will capture it.
        const res = fn();
        return { called: true, exists: true, error: null, result: res === undefined ? null : res };
      } catch (err) {
        return { called: true, exists: true, error: err instanceof Error ? err.message : String(err), result: null };
      }
    }, name);
  }

  // Cleanup listeners to avoid duplicate capture between tests
  dispose() {
    this.page.removeListener('console', this._consoleListener);
    this.page.removeListener('pageerror', this._pageErrorListener);
  }
}

test.describe('ACID Properties interactive application - FSM and implementation validation', () => {
  // Each test will create its own AcidPage wrapper and navigate to the page.
  // We keep tests focused and descriptive.

  test('Idle state should render static elements and an empty #result container', async ({ page }) => {
    // This test validates the Idle state's evidence: presence of <div id="result"></div>
    const acid = new AcidPage(page);
    await acid.goto();

    // Validate the page heading and descriptive paragraph exist
    const heading = await acid.getHeadingText();
    expect(heading).toBe('ACID Properties');

    const paragraphs = await acid.getParagraphsText();
    // Ensure the first paragraph mentions Atomicity
    expect(paragraphs.length).toBeGreaterThanOrEqual(1);
    expect(paragraphs[0]).toContain('Atomicity:');

    // #result element exists and initially empty (the FSM state evidence expects the element)
    const resultText = await acid.getResultText();
    // The implementation doesn't write to #result in the inline script; expect empty or null string
    expect(resultText === '' || resultText === null).toBeTruthy();

    // The global db should be present per implementation
    const dbSnap = await acid.getDbSnapshot();
    expect(dbSnap.hasDb).toBeTruthy();
    expect(dbSnap.currentTransactionId).toBe(1);
    expect(dbSnap.transactionsLength).toBe(3);

    acid.dispose();
  });

  test('Verify console logs for atomicity, consistency, isolation, and durability were produced', async ({ page }) => {
    // This test checks that the inline script executed and logged the expected messages.
    const acid = new AcidPage(page);
    await acid.goto();

    // Wait a short moment for console messages to be emitted and captured
    await page.waitForTimeout(100);

    const msgs = acid.getConsoleMessages();

    // Expect all four ACID messages to be present
    const expected = [
      'Atomicity: Success',
      'Consistency: Success',
      'Isolation: Success',
      'Durability: Success'
    ];
    for (const e of expected) {
      expect(msgs.some(m => m.includes(e)), `Expected console to include: "${e}", console: ${JSON.stringify(msgs)}`).toBeTruthy();
    }

    // Ensure no uncaught page errors were emitted during the initial script execution
    const pageErrors = acid.getPageErrors();
    expect(pageErrors.length).toBe(0);

    acid.dispose();
  });

  test('FSM entry action renderPage() is declared in FSM but missing in implementation (reporting mismatch)', async ({ page }) => {
    // The FSM lists renderPage() as an entry action. The HTML does not define renderPage.
    // This test asserts that renderPage is undefined in the page context, highlighting the mismatch.
    const acid = new AcidPage(page);
    await acid.goto();

    // Check whether renderPage exists on the window
    const renderPageDefined = await acid.isRenderPageDefined();
    // We expect it to be undefined based on the provided HTML implementation
    expect(renderPageDefined).toBeFalsy();

    // Confirm there were no runtime page errors simply because renderPage is missing (missing function is not called by page)
    expect(acid.getPageErrors().length).toBe(0);

    acid.dispose();
  });

  test('There are no interactive elements or transitions to trigger — edge case validation', async ({ page }) => {
    // The FSM states/transitions indicate no interactions; implementation indeed is static.
    const acid = new AcidPage(page);
    await acid.goto();

    const interactiveCount = await acid.countInteractiveElements();
    // Expect zero interactive form controls or buttons
    expect(interactiveCount).toBe(0);

    // Additionally, ensure the document contains no inline event handlers for common events on the body
    const hasOnClick = await page.evaluate(() => {
      // Look for elements that define inline attributes starting with "on" (e.g., onclick)
      const nodes = Array.from(document.querySelectorAll('*'));
      return nodes.some(n => {
        for (let i = 0; i < n.attributes.length; i++) {
          if (n.attributes[i].name.startsWith('on')) return true;
        }
        return false;
      });
    });
    expect(hasOnClick).toBeFalsy();

    acid.dispose();
  });

  test('Edge case: calling ACID check functions with a non-existent transaction should log "No transaction found"', async ({ page }) => {
    // This test manipulates db.currentTransactionId in the page context and invokes the existing functions
    // to validate the "No transaction found" branch is reachable.
    const acid = new AcidPage(page);
    await acid.goto();

    // Set currentTransactionId to a non-existent id and then call functions that exist on the page.
    await page.evaluate(() => {
      if (window.db) {
        window.db.currentTransactionId = 9999;
      }
    });

    // Call each function if it exists and assert the function executed and console logged the "No transaction found" message.
    // Note: we capture console messages via the page object.
    // Call the function names; we intentionally avoid redefining anything.
    const functions = ['atomicity', 'consistency', 'isolation', 'durability'];
    for (const fn of functions) {
      const result = await acid.callFunctionIfExists(fn);
      // The function should exist and be callable in this implementation.
      expect(result.exists, `Expected ${fn} to exist`).toBeTruthy();
      expect(result.error, `Calling ${fn} should not throw an exception; error: ${result.error}`).toBeNull();

      // Wait briefly for console to capture the emitted message
      await page.waitForTimeout(50);
    }

    const msgs = acid.getConsoleMessages();

    // For each property, expect a "No transaction found" log to exist
    const expectedNoTx = [
      'Atomicity: No transaction found',
      'Consistency: No transaction found',
      'Isolation: No transaction found',
      'Durability: No transaction found'
    ];
    for (const expectedMsg of expectedNoTx) {
      expect(msgs.some(m => m.includes(expectedMsg)), `Expected console to include "${expectedMsg}"`).toBeTruthy();
    }

    // Ensure no uncaught exceptions were produced by these invocations
    expect(acid.getPageErrors().length).toBe(0);

    acid.dispose();
  });

  test('Sanity check: verify implementation’s transaction splitting behavior for transaction with comma-separated parts', async ({ page }) => {
    // This test changes a transaction's data to include commas and verifies success/failure logic by calling atomicity.
    const acid = new AcidPage(page);
    await acid.goto();

    // Modify the first transaction's data to include an empty segment to force a Failure path
    await page.evaluate(() => {
      if (window.db && Array.isArray(window.db.transactions) && window.db.transactions.length > 0) {
        // Create a transaction containing an empty segment when split by comma
        window.db.transactions[0].data = 'step1,,step3';
        window.db.currentTransactionId = window.db.transactions[0].id;
      }
    });

    // Clear previously captured console messages for a clean check
    acid.consoleMessages = [];

    // Call atomicity (exists in the page) which will log either Success or Failure
    const callRes = await acid.callFunctionIfExists('atomicity');
    expect(callRes.exists).toBeTruthy();
    expect(callRes.error).toBeNull();

    // Wait for console capture
    await page.waitForTimeout(50);
    const msgs = acid.getConsoleMessages();

    // Given the empty segment between commas, the implementation's logic should result in "Atomicity: Failure"
    expect(msgs.some(m => m.includes('Atomicity: Failure')), `Expected to see Atomicity: Failure in console, console: ${JSON.stringify(msgs)}`).toBeTruthy();

    // Reset is not required; just ensure no uncaught exceptions
    expect(acid.getPageErrors().length).toBe(0);

    acid.dispose();
  });

  test('Implementation does not throw ReferenceError / SyntaxError / TypeError on load (validate runtime stability)', async ({ page }) => {
    // This test ensures that the page loads without producing uncaught runtime errors.
    // Note: We do not patch or modify page environment; we only observe runtime errors.
    const acid = new AcidPage(page);
    await acid.goto();

    // Wait briefly to allow any asynchronous runtime errors to surface
    await page.waitForTimeout(100);

    const pageErrors = acid.getPageErrors();

    // Expect no uncaught ReferenceError, SyntaxError, or TypeError events during page load
    // (the inline script should run cleanly as provided)
    expect(pageErrors.length).toBe(0);

    acid.dispose();
  });
});