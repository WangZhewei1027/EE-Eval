import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5af4b01-fa7c-11f0-adc7-178f556b1ee0.html';

// Page object encapsulating interactions and queries for the Linked List page
class LinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Array} consoleMessages - array reference to collect page console messages
   * @param {Array} pageErrors - array reference to collect page errors
   */
  constructor(page, consoleMessages, pageErrors) {
    this.page = page;
    this.consoleMessages = consoleMessages;
    this.pageErrors = pageErrors;
  }

  // Return main heading text
  async headingText() {
    return this.page.locator('h1').innerText();
  }

  // Return whether a visible button with the given text exists
  async demoButtonCount() {
    return this.page.locator('button', { hasText: 'Demonstrate Linked List' }).count();
  }

  // Return code inside the first <pre> block as text (if present)
  async preText() {
    const pre = this.page.locator('pre');
    const count = await pre.count();
    if (count === 0) return '';
    return pre.first().innerText();
  }

  // Attempt to click the "Demonstrate Linked List" button (caller should handle errors)
  async clickDemoButton() {
    const locator = this.page.locator('button', { hasText: 'Demonstrate Linked List' }).first();
    await locator.click();
  }

  // Return captured console messages
  getConsoleMessages() {
    return this.consoleMessages.slice();
  }

  // Return captured page errors
  getPageErrors() {
    return this.pageErrors.slice();
  }
}

test.describe('Linked List interactive application (f5af4b01-fa7c-11f0-adc7-178f556b1ee0)', () => {
  let page;
  let linkedListPage;
  let consoleMessages;
  let pageErrors;

  // Setup: create a new page and attach listeners to capture console messages and page errors
  test.beforeEach(async ({ context }) => {
    page = await context.newPage();

    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for later assertions
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect uncaught page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the provided static HTML page
    await page.goto(APP_URL, { waitUntil: 'load' });

    linkedListPage = new LinkedListPage(page, consoleMessages, pageErrors);
  });

  // Teardown: close page
  test.afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test('Idle state (S0_Idle): Page renders static content and includes code block with demo code', async () => {
    // Validate main heading is present and correct
    const heading = await linkedListPage.headingText();
    expect(heading).toBe('Linked List');

    // Validate main descriptive text is present somewhere on the page
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('Linked List is a data structure');

    // The FSM expects a button to be rendered on entry (renderPage). Check for the button.
    const demoBtnCount = await linkedListPage.demoButtonCount();
    // Note: The implementation places the demo button creation code inside a <pre> block, so
    // we expect that the visual button might not actually be present in the DOM.
    // This assertion documents the observed behavior (edge case).
    expect(demoBtnCount).toBe(0);

    // Verify that the <pre> block includes the demo code snippet (evidence exists as static text)
    const preText = await linkedListPage.preText();
    expect(preText).toContain("demoButton.onclick = function() {");
    expect(preText).toContain("console.log('Linked List Demonstration');");

    // Ensure no unexpected console log 'Linked List Demonstration' was emitted during initial load
    const hasDemoConsole = linkedListPage.getConsoleMessages().some(m => m.text.includes('Linked List Demonstration'));
    expect(hasDemoConsole).toBe(false);
  });

  test('Transition (DemonstrateClick): Attempting to click the demonstration button when it is not present', async () => {
    // This test validates the transition event behavior when the expected control is missing.
    const count = await linkedListPage.demoButtonCount();
    expect(count).toBe(0); // Confirm missing button (edge case)

    // Attempting to click a non-existent control should not silently succeed.
    // Use a safe pattern: try to click and assert that Playwright throws for missing element.
    let clickThrew = false;
    try {
      // This will throw if no element matches.
      await linkedListPage.clickDemoButton();
    } catch (err) {
      clickThrew = true;
      // The error message should indicate no element was found or interaction failed
      expect(String(err.message)).toMatch(/(no node found|Element is not attached|0 elements)/i);
    }
    expect(clickThrew).toBe(true);

    // Since the demo button was not clicked (because it doesn't exist), the FSM transition S0 -> S1
    // could not occur. Confirm that no console log indicating S1 entry was produced.
    const demoLogs = linkedListPage.getConsoleMessages().filter(m => m.text.includes('Linked List Demonstration'));
    expect(demoLogs.length).toBe(0);
  });

  test('FSM S1_Demonstrating onEnter action not triggered: no "Linked List Demonstration" console output', async () => {
    // This test explicitly asserts that the S1 entry action (console.log) did not run.
    const messages = linkedListPage.getConsoleMessages();
    const demoMessages = messages.filter(m => m.text.includes('Linked List Demonstration'));
    // Because the demonstration button was not appended/executed, the console.log should not appear.
    expect(demoMessages.length).toBe(0);

    // Also ensure that other console messages (if any) are collected and are of expected types
    for (const m of messages) {
      expect(typeof m.type).toBe('string');
      expect(typeof m.text).toBe('string');
    }
  });

  test('Edge case: accessing demoButton as a global should throw ReferenceError in page context', async () => {
    // The implementation places demoButton creation inside a <pre> block instead of a script,
    // so the demoButton global variable should NOT exist. Accessing it directly (not using typeof)
    // should raise a ReferenceError from the page context. We assert that this natural ReferenceError occurs.
    let threw = false;
    try {
      // Accessing demoButton without typeof should throw a ReferenceError in the browser context
      await page.evaluate(() => demoButton);
      // If the above line does not throw, fail explicitly
      throw new Error('Accessing demoButton did not throw as expected');
    } catch (err) {
      threw = true;
      // The thrown error originates from the page context; assert it looks like a ReferenceError
      const message = String(err.message || err);
      expect(message).toMatch(/(ReferenceError|is not defined|not defined)/i);
    }
    expect(threw).toBe(true);
  });

  test('Runtime diagnostics: observe console types and page errors for regressions', async () => {
    // This test captures any console error messages and uncaught page errors and asserts that
    // the current static page does not produce runtime exceptions during load.
    const consoleErrors = linkedListPage.getConsoleMessages().filter(m => m.type === 'error');
    const pageErrs = linkedListPage.getPageErrors();

    // Document observed counts for debugging context; assert both are zero for this static page.
    // If the application had a script that threw, these arrays would be non-empty and the assertions
    // would catch regressions introduced in the page implementation.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrs.length).toBe(0);
  });
});