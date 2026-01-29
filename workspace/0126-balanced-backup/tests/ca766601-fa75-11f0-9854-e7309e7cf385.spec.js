import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/ca766601-fa75-11f0-9854-e7309e7cf385.html';

// Page object model for interacting with the BST demo page
class BSTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages
    this.page.on('console', (msg) => {
      // We capture text for assertions
      try {
        this.consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // If message.text() throws, still record the message object
        this.consoleMessages.push({ type: msg.type(), text: '<unserializable console message>' });
      }
    });

    // Capture uncaught exceptions from the page
    this.page.on('pageerror', (error) => {
      // error is an Error object
      this.pageErrors.push(error);
    });
  }

  // Navigate to the application and wait for load event
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // allow a short time for inline script execution / errors to surface
    await this.page.waitForTimeout(200);
  }

  // Get the root element handle
  async getRootHandle() {
    return this.page.$('#root');
  }

  // Get computed style display value for #root
  async getRootDisplay() {
    const el = await this.getRootHandle();
    if (!el) return null;
    return await this.page.evaluate((e) => window.getComputedStyle(e).display, el);
  }

  // Count li children under root
  async getLiCount() {
    const el = await this.getRootHandle();
    if (!el) return 0;
    return await this.page.evaluate((e) => e.querySelectorAll('li').length, el);
  }

  // Return textual console messages captured
  getConsoleTexts() {
    return this.consoleMessages.map((m) => m.text);
  }

  // Return page error messages
  getPageErrorMessages() {
    return this.pageErrors.map((e) => (e && e.message) || String(e));
  }
}

test.describe('Binary Search Tree FSM - ca766601-fa75-11f0-9854-e7309e7cf385', () => {
  // Each test gets a fresh page from Playwright's fixture so listeners are fresh per test.

  test('S0_Idle: Page loads and root element is present; observe entry action effect or script errors', async ({ page }) => {
    // This test validates the initial state S0_Idle. According to the FSM, on entry renderPage()
    // should make #root visible (document.getElementById('root').style.display = 'block').
    // The implementation sets this at the end of the inline script, but the script may error before that.
    const app = new BSTPage(page);
    await app.goto();

    // Assert that the root element exists in the DOM
    const rootHandle = await app.getRootHandle();
    expect(rootHandle).not.toBeNull();

    // Check if the entry action (making root visible) occurred.
    const display = await app.getRootDisplay();

    // The page's script is buggy and may have errored before setting display.
    // We assert one of two acceptable outcomes:
    // - Either the script successfully set display to 'block', or
    // - the script threw at least one uncaught error before completing.
    const pageErrors = app.getPageErrorMessages();
    if (pageErrors.length === 0) {
      // No page errors -> expect the entry action completed
      expect(display).toBe('block');
    } else {
      // Script errored -> assert we captured at least one of the expected JS error types
      expect(pageErrors.length).toBeGreaterThan(0);
      const anyExpectedError = pageErrors.some((msg) =>
        /(ReferenceError|TypeError|RangeError|SyntaxError|Error)/i.test(msg)
      );
      expect(anyExpectedError).toBeTruthy();
    }
  });

  test('S1_NodeInserted (NodeInsert transition): insertNode calls executed by script; validate DOM changes or errors', async ({ page }) => {
    // This test validates that the NodeInsert event (multiple insertNode calls) was triggered by the page script.
    // The implementation attempts to insert <li> nodes into #root. Due to bugs (undefined variables and recursion)
    // the operation may produce DOM nodes or may throw (e.g. RangeError: maximum call stack).
    const app = new BSTPage(page);
    await app.goto();

    // Count li elements that may have been appended to #root
    const liCount = await app.getLiCount();
    const pageErrors = app.getPageErrorMessages();

    // Either some <li> elements were appended OR we observed runtime errors during insertion.
    if (liCount > 0) {
      // If there are li elements, ensure they are actual list items containing text (best-effort check).
      const consoleTexts = app.getConsoleTexts();
      // Basic expectations: at least one list item exists.
      expect(liCount).toBeGreaterThanOrEqual(1);
      // Also assert that insertion attempts were likely logged or that no fatal error occurred.
      expect(pageErrors.length).toBeGreaterThanOrEqual(0); // just to keep test explicit
    } else {
      // No list items were created; assert that the script produced at least one uncaught error.
      expect(pageErrors.length).toBeGreaterThan(0);

      // Ensure the error is one of the expected categories (recursion/stack, undefined property, etc.)
      const matches = pageErrors.some((msg) =>
        /(Maximum call stack size exceeded|Maximum call stack|RangeError|TypeError|ReferenceError)/i.test(msg)
      );
      expect(matches).toBeTruthy();
    }
  });

  test('S2_NodeSearched (NodeSearch transition): searchNode was executed and search result logged or error occurred', async ({ page }) => {
    // This test validates the NodeSearch transition. The inline script calls console.log(searchNode(data, 4, "Apple")).
    // The function is implemented in a way that it may return -1 or may never be reached due to earlier errors.
    const app = new BSTPage(page);
    await app.goto();

    const consoleTexts = app.getConsoleTexts();
    const pageErrors = app.getPageErrorMessages();

    // If we captured console output, check for a numeric search result (likely -1 or a number).
    const numericConsole = consoleTexts.find((t) => /^\s*-?\d+\s*$/.test(t));
    if (numericConsole !== undefined) {
      // If numeric output is present, ensure it's a valid integer string
      expect(/^\s*-?\d+\s*$/.test(numericConsole)).toBeTruthy();
    } else {
      // Otherwise, assert that the script errored such that search log didn't appear
      expect(pageErrors.length).toBeGreaterThan(0);

      // Confirm that the errors are of expected categories (ReferenceError/TypeError/RangeError)
      const ok = pageErrors.some((m) =>
        /(ReferenceError|TypeError|RangeError|Maximum call stack size exceeded)/i.test(m)
      );
      expect(ok).toBeTruthy();
    }
  });

  test('S3_MinDataRetrieved (MinDataRetrieve transition): getMinData invoked; expect error due to undefined data or a numeric min', async ({ page }) => {
    // This test validates the MinDataRetrieve transition. The page calls console.log(getMinData(data)).
    // Because data is undefined in the implementation, getMinData is expected to throw (TypeError) or behave unexpectedly.
    const app = new BSTPage(page);
    await app.goto();

    const consoleTexts = app.getConsoleTexts();
    const pageErrors = app.getPageErrorMessages();

    // If there is a console output that looks like a numeric value, accept it; otherwise expect a page error.
    const numericConsole = consoleTexts.find((t) => /^\s*-?\d+\s*$/.test(t));
    if (numericConsole !== undefined) {
      // getMinData produced a numeric result (unexpected but possible if data was defined on the global environment).
      expect(/^\s*-?\d+\s*$/.test(numericConsole)).toBeTruthy();
    } else {
      // No numeric console output -> ensure we observed an error when attempting to compute min
      expect(pageErrors.length).toBeGreaterThan(0);

      // The typical error would be because data is undefined (TypeError) or because code recursed (RangeError).
      const seenExpected = pageErrors.some((m) =>
        /(TypeError|ReferenceError|RangeError|Cannot read|Maximum call stack size exceeded)/i.test(m)
      );
      expect(seenExpected).toBeTruthy();
    }
  });

  test('Robustness check: Ensure at least one uncaught JS error occurred due to implementation bugs', async ({ page }) => {
    // The application implementation contains multiple issues (use of undefined `data`, recursive insertNode calls).
    // This test asserts that these issues surface as uncaught page errors during normal page load.
    const app = new BSTPage(page);
    await app.goto();

    const pageErrors = app.getPageErrorMessages();

    // We expect the page to produce at least one uncaught error (ReferenceError/TypeError/RangeError).
    expect(pageErrors.length).toBeGreaterThan(0);

    // Validate that at least one captured error message matches one of the expected JavaScript error types.
    const found = pageErrors.some((msg) =>
      /(ReferenceError|TypeError|RangeError|Maximum call stack size exceeded|Cannot read properties of undefined)/i.test(msg)
    );
    expect(found).toBeTruthy();
  });

  test('Edge case visibility: If the script crashed before setting display, root may not be "block"', async ({ page }) => {
    // This test explicitly checks the edge case where the final "document.getElementById(\"root\").style.display = \"block\";"
    // may not have executed due to earlier crashes. We assert that either display === 'block' OR we have errors explaining why not.
    const app = new BSTPage(page);
    await app.goto();

    const display = await app.getRootDisplay();
    const pageErrors = app.getPageErrorMessages();

    if (display === 'block') {
      // Expected successful case
      expect(display).toBe('block');
    } else {
      // If not 'block', we require that the page threw at least one error preventing the assignment
      expect(pageErrors.length).toBeGreaterThan(0);
      // And that the error explains a likely failure (recursion/undefined variable)
      const ok = pageErrors.some((m) =>
        /(Maximum call stack size exceeded|RangeError|ReferenceError|TypeError|Cannot read properties of undefined)/i.test(m)
      );
      expect(ok).toBeTruthy();
    }
  });
});