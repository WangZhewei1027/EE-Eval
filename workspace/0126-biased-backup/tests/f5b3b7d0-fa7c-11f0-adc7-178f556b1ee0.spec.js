import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b3b7d0-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the Type System example page
class TypeSystemPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages and page errors for assertions
    this._consoleListener = (msg) => {
      // Store the console message text and type
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    this._pageErrorListener = (err) => {
      // Store Error objects emitted by the page (uncaught exceptions)
      this.pageErrors.push(err);
    };

    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
  }

  // Navigate to the application URL
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Return the button locator
  typeExampleButton() {
    return this.page.locator('#type-example');
  }

  // Click the example button
  async clickExample() {
    await this.typeExampleButton().click();
  }

  // Utility to wait until at least `count` console messages are captured or timeout
  async waitForConsoleMessages(count, timeout = 2000) {
    const start = Date.now();
    while (this.consoleMessages.length < count) {
      if (Date.now() - start > timeout) {
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    return this.consoleMessages.slice();
  }

  // Clear captured console messages (for test isolation)
  clearConsoleMessages() {
    this.consoleMessages.length = 0;
  }

  // Clear captured page errors
  clearPageErrors() {
    this.pageErrors.length = 0;
  }

  // Dispose listeners (called in teardown)
  async dispose() {
    this.page.off('console', this._consoleListener);
    this.page.off('pageerror', this._pageErrorListener);
  }
}

test.describe('Type System FSM - Interactive Application', () => {
  // Shared page object for each test
  let typePage;

  test.beforeEach(async ({ page }) => {
    typePage = new TypeSystemPage(page);
    // Navigate to the app for each test
    await typePage.goto();
  });

  test.afterEach(async () => {
    // Clean up listeners to avoid leaks across tests
    await typePage.dispose();
  });

  test.describe('S0_Idle (Initial State) validations', () => {
    test('renders the page and shows the "See Type Example" button (Idle state)', async () => {
      // Validate essential static content is present (h1 and some paragraphs)
      await expect(typePage.page.locator('h1')).toHaveText('Type System');

      // The FSM Idle state's evidence includes the button; assert its presence and text
      const btn = typePage.typeExampleButton();
      await expect(btn).toBeVisible();
      await expect(btn).toHaveText('See Type Example');

      // Verify there are no uncaught page errors on initial load
      expect(typePage.pageErrors.length).toBe(0);

      // The FSM entry action listed "renderPage()" in the spec, but the implementation does not expose a renderPage function.
      // Verify that no global renderPage function exists and that no ReferenceError occurred on load.
      const renderPageExists = await typePage.page.evaluate(() => typeof window.renderPage !== 'undefined');
      expect(renderPageExists).toBe(false);
      expect(typePage.pageErrors.length).toBe(0);
    });

    test('does not add example code to DOM on idle (no <code> element with the examples)', async () => {
      // The page has CSS for code blocks but the implementation logs examples to console instead of inserting into DOM.
      // Assert that no <code> element contains the expected "add(" function text initially.
      const codeElements = typePage.page.locator('code');
      await expect(codeElements).toHaveCount(0);
    });
  });

  test.describe('S1_ExampleShown (After ButtonClick) validations', () => {
    test('clicking the button logs typedExampleCode, typedCode, and code in that order', async () => {
      // Clear any previously captured messages to ensure test isolation
      typePage.clearConsoleMessages();
      typePage.clearPageErrors();

      // Click the button (this triggers console.logs in the page script)
      await typePage.clickExample();

      // Wait for three console messages to be captured
      const messages = await typePage.waitForConsoleMessages(3, 2000);

      // Assert that we received at least three console messages
      expect(messages.length).toBeGreaterThanOrEqual(3);

      // The FSM indicates the entry actions for ExampleShown include console.log(typedExampleCode), console.log(typedCode), console.log(code)
      // Assert the ordering and presence of expected substrings in the logged outputs.

      // First log should be the typedExampleCode containing result2 usage
      const first = messages[0];
      expect(first.type).toBe('log');
      expect(first.text).toContain('let result2'); // typedExampleCode includes result2
      expect(first.text).toContain("let x = 5");

      // Second log should be typedCode which contains the add function
      const second = messages[1];
      expect(second.type).toBe('log');
      expect(second.text).toContain('function add');
      expect(second.text).toContain('return x + y');

      // Third log should be code which (per implementation) is identical to typedCode
      const third = messages[2];
      expect(third.type).toBe('log');
      expect(third.text).toContain('function add');
      expect(third.text).toContain('return x + y');

      // The second and third logs are expected to be equivalent in content (trimmed)
      expect(second.text.trim()).toBe(third.text.trim());

      // Confirm no uncaught page errors occurred as a result of clicking
      expect(typePage.pageErrors.length).toBe(0);
    });

    test('multiple clicks append multiple sets of console logs (idempotent logging behavior)', async () => {
      // Ensure starting fresh
      typePage.clearConsoleMessages();
      typePage.clearPageErrors();

      // Click twice in quick succession
      await typePage.clickExample();
      await typePage.clickExample();

      // Wait for six console messages (3 per click)
      const messages = await typePage.waitForConsoleMessages(6, 3000);
      expect(messages.length).toBeGreaterThanOrEqual(6);

      // Validate that messages are grouped per click: first group contains result2, then add, then add
      expect(messages[0].text).toContain('let result2'); // 1st click, 1st log
      expect(messages[1].text).toContain('function add'); // 1st click, 2nd log
      expect(messages[2].text).toContain('function add'); // 1st click, 3rd log

      // 2nd click group
      expect(messages[3].text).toContain('let result2'); // 2nd click, 1st log
      expect(messages[4].text).toContain('function add'); // 2nd click, 2nd log
      expect(messages[5].text).toContain('function add'); // 2nd click, 3rd log

      // No page errors were thrown during rapid clicking
      expect(typePage.pageErrors.length).toBe(0);
    });

    test('edge case: clicking when button is present quickly multiple times does not mutate DOM with code blocks', async () => {
      typePage.clearConsoleMessages();
      typePage.clearPageErrors();

      // Click several times rapidly
      await Promise.all([
        typePage.clickExample(),
        typePage.clickExample(),
        typePage.clickExample(),
      ]);

      // Wait for at least 9 console logs to be captured (3 clicks * 3 logs)
      const messages = await typePage.waitForConsoleMessages(9, 4000);
      expect(messages.length).toBeGreaterThanOrEqual(9);

      // Ensure no <code> tag was injected into DOM as the implementation logs to console only
      const codeCount = await typePage.page.locator('code').count();
      expect(codeCount).toBe(0);

      // Ensure no uncaught errors occurred
      expect(typePage.pageErrors.length).toBe(0);
    });

    test('observes console message types and contents (ensures logs are of type "log")', async () => {
      typePage.clearConsoleMessages();
      typePage.clearPageErrors();

      // Click once
      await typePage.clickExample();

      // Wait for three logs
      const messages = await typePage.waitForConsoleMessages(3, 2000);
      for (let i = 0; i < 3; i++) {
        expect(messages[i].type).toBe('log');
        // Basic sanity: no message should be empty
        expect(messages[i].text.trim().length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('FSM transition/event verification', () => {
    test('transition S0_Idle -> S1_ExampleShown is triggered by clicking #type-example', async () => {
      // This test validates the event defined in the FSM (ButtonClick) triggers the expected console outputs.
      typePage.clearConsoleMessages();
      typePage.clearPageErrors();

      // Sanity check: button exists
      await expect(typePage.typeExampleButton()).toBeVisible();

      // Click the button to trigger the transition
      await typePage.clickExample();

      // Wait for the console logs that are evidence of the transition
      const messages = await typePage.waitForConsoleMessages(3, 2000);
      // At least 3 logs is our evidence of the transition; ensure those appear
      expect(messages.length).toBeGreaterThanOrEqual(3);

      // Verify the specific evidence strings referenced in the FSM are present in the logs
      // FSM evidence mentions console.log(typedExampleCode); console.log(typedCode); console.log(code);
      // Ensure the first log contains 'typedExampleCode' content (we look for a distinctive substring)
      expect(messages[0].text).toContain('let result2');
      // Ensure subsequent logs contain the function add as evidence of code and typedCode
      expect(messages[1].text).toContain('function add');
      expect(messages[2].text).toContain('function add');

      // Confirm again: no page errors
      expect(typePage.pageErrors.length).toBe(0);
    });
  });
});