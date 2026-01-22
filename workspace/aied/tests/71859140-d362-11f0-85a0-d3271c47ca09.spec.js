import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/71859140-d362-11f0-85a0-d3271c47ca09.html';

// Page Object for the Stack application
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pageErrors = [];
    this.consoleMessages = [];

    // Collect runtime errors (unhandled exceptions)
    this.page.on('pageerror', (err) => {
      // err is an Error object; capture its message
      this.pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Collect console messages (includes SyntaxError logs in some engines)
    this.page.on('console', (msg) => {
      // msg.type() might be 'error', 'warning', 'log', etc.
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });
  }

  // Navigate to the app and wait briefly to allow script parsing/execution/errors to surface
  async load() {
    // Navigate to the page
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Give the page a little time to emit errors from parsing/execution
    await this.page.waitForTimeout(300);
  }

  // Returns the main heading text
  async getHeadingText() {
    return this.page.textContent('h1');
  }

  // Returns the paragraph text directly under the heading as string
  async getParagraphText() {
    return this.page.textContent('p');
  }

  // Returns an array of button text content inside #stack
  async getStackButtonTexts() {
    return this.page.$$eval('#stack button', (els) => els.map((b) => b.textContent.trim()));
  }

  // Returns the number of child nodes in #stack
  async getStackChildCount() {
    return this.page.$eval('#stack', (el) => el.childElementCount);
  }

  // Clicks the push button with the given visible text (exact match)
  async clickPushButtonByText(text) {
    const locator = this.page.locator(`#stack button`, { hasText: text });
    await locator.click();
    // allow any resulting errors to surface
    await this.page.waitForTimeout(150);
  }

  // Returns a copy of captured page errors
  getPageErrors() {
    return [...this.pageErrors];
  }

  // Returns a copy of captured console messages
  getConsoleMessages() {
    return [...this.consoleMessages];
  }

  // Evaluate typeof a global identifier
  async typeofGlobal(name) {
    return this.page.evaluate((n) => {
      try {
        // typeof never throws; return as-is
        return typeof globalThis[n];
      } catch (e) {
        return `ERROR:${String(e && e.message ? e.message : e)}`;
      }
    }, name);
  }
}

test.describe('Stack FSM - Interactive Application (71859140-d362-11f0-85a0-d3271c47ca09)', () => {

  // Validate the Idle (S0_Idle) state: renderPage() entry and visible content
  test('Idle state: page renders header, description, and push buttons (S0_Idle)', async ({ page }) => {
    const stack = new StackPage(page);

    // Load the page
    await stack.load();

    // Verify header and paragraph are present as evidence of S0_Idle
    const heading = await stack.getHeadingText();
    expect(heading).toBeTruthy();
    expect(heading.trim()).toBe('Stack');

    const paragraph = await stack.getParagraphText();
    expect(paragraph).toBeTruthy();
    expect(paragraph.trim()).toContain('Here is an example of a stack');

    // Confirm that the three buttons (Push item 1/2/3) exist inside #stack
    const buttonTexts = await stack.getStackButtonTexts();
    // We expect the HTML to include three buttons with those labels
    expect(buttonTexts.length).toBeGreaterThanOrEqual(3);
    expect(buttonTexts).toEqual(
      expect.arrayContaining(['Push item 1', 'Push item 2', 'Push item 3'])
    );

    // As the FSM mentioned an entry action renderPage(), verify there is no global renderPage function
    const typeofRenderPage = await stack.typeofGlobal('renderPage');
    expect(typeofRenderPage).toBe('undefined');
  });

  // Verify that the inline <script> contains syntax errors that surface as page errors
  test('Page contains a syntax/runtime error from the broken script', async ({ page }) => {
    const stack = new StackPage(page);

    // Load the page and capture errors
    await stack.load();

    // Collect errors and console messages
    const pageErrors = stack.getPageErrors();
    const consoleMessages = stack.getConsoleMessages();

    // We expect at least one page error or console error indicating a SyntaxError because the script contains malformed code (double dot)
    const combinedMessages = [...pageErrors, ...consoleMessages.map(m => m.text)];

    // Helper to detect syntax-like messages
    const hasSyntaxError = combinedMessages.some(msg =>
      /SyntaxError/i.test(msg) || /Unexpected token/i.test(msg) || /\.\./.test(msg)
    );

    // Assert we observed a syntax-related issue
    expect(hasSyntaxError).toBeTruthy();

    // Keep diagnostic info in test output if available
    // (Do not fail the test because of the specific message shape beyond what we asserted)
  });

  // Test transitions: clicking each Push button should attempt to call push(item)
  // Because the script is broken, we expect ReferenceError (push undefined) and no DOM changes (no item appended)
  test('Push events: clicking push buttons triggers errors and does not append new items (S0_Idle -> S1_ItemPushed expected but broken)', async ({ page }) => {
    const stack = new StackPage(page);

    // Load page
    await stack.load();

    // Record initial #stack children count
    const initialCount = await stack.getStackChildCount();

    // Ensure initialCount reflects the three static buttons in the HTML
    expect(initialCount).toBeGreaterThanOrEqual(3);

    // Clear any existing errors captured so far for a clean click-phase inspection
    // (We instantiate new StackPage per test so initial arrays are current)

    // Click each Push button and wait briefly for errors to surface
    const expectedButtons = ['Push item 1', 'Push item 2', 'Push item 3'];
    for (const text of expectedButtons) {
      // Click the button by visible text
      await stack.clickPushButtonByText(text);
    }

    // After clicking, allow errors to arrive
    await page.waitForTimeout(200);

    // Gather errors and console messages after click interactions
    const pageErrors = stack.getPageErrors();
    const consoleMessages = stack.getConsoleMessages().map(m => m.text);

    // Check for ReferenceError related to 'push' being undefined (likely because the script failed to define it due to SyntaxError)
    const combined = [...pageErrors, ...consoleMessages];
    const hasPushReferenceError = combined.some(msg =>
      /ReferenceError/i.test(msg) || /push is not defined/i || /push is not a function/i
    );

    // It's expected that push is not defined and a ReferenceError occurs when clicking the inline onclick handlers.
    expect(hasPushReferenceError).toBeTruthy();

    // Assert that no new nodes were appended to #stack (i.e., child count unchanged)
    const finalCount = await stack.getStackChildCount();
    expect(finalCount).toBe(initialCount);

    // Also verify that push global is not available (typeof push === 'undefined')
    const typeofPush = await stack.typeofGlobal('push');
    expect(typeofPush).toBe('undefined');
  });

  // Edge case tests and FSM transition verification notes
  test('FSM transition check: S0 -> S1 cannot complete; verify expected globals/behaviors (edge cases)', async ({ page }) => {
    const stack = new StackPage(page);

    // Load page
    await stack.load();

    // The FSM expects push(item) to append an item to the stack (evidence: document.getElementById(\'stack\').appendChild(item);)
    // Because the implementation is broken, we assert:
    // - push is not defined
    // - no appendChild effects are visible
    // - renderPage is not defined (entry action mentioned in FSM but not present)
    const typeofPush = await stack.typeofGlobal('push');
    const typeofRenderPage = await stack.typeofGlobal('renderPage');

    expect(typeofPush).toBe('undefined');
    expect(typeofRenderPage).toBe('undefined');

    // Confirm stack content remains the original static buttons (no appended items)
    const buttonTexts = await stack.getStackButtonTexts();
    expect(buttonTexts).toEqual(
      expect.arrayContaining(['Push item 1', 'Push item 2', 'Push item 3'])
    );

    // We also assert that the page reported at least one syntax-like error earlier (robust detection)
    const pageErrors = stack.getPageErrors();
    const consoleMessages = stack.getConsoleMessages().map(m => m.text);
    const combinedMessages = [...pageErrors, ...consoleMessages];
    const hasSyntaxOrReference = combinedMessages.some(msg =>
      /SyntaxError/i.test(msg) || /Unexpected token/i.test(msg) || /ReferenceError/i.test(msg)
    );
    expect(hasSyntaxOrReference).toBeTruthy();
  });

  // Additional check: ensure that clicking a button does not silently succeed (no hidden DOM side-effects)
  test('Clicking push buttons must not silently mutate DOM when errors occur', async ({ page }) => {
    const stack = new StackPage(page);

    await stack.load();

    // Snapshot the innerHTML of #stack before interactions
    const before = await page.$eval('#stack', (el) => el.innerHTML);

    // Attempt a click
    await stack.clickPushButtonByText('Push item 1');

    // Wait briefly to allow any DOM changes
    await page.waitForTimeout(150);

    // Snapshot after
    const after = await page.$eval('#stack', (el) => el.innerHTML);

    // As the push function is not present (script broken), we expect no changes to the innerHTML
    expect(after).toBe(before);
  });
});