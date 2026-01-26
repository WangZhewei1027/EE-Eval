import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a13a45-fa7b-11f0-8b-01-9f078a0ff214.html';

// Page object for the DFS explanation page
class DfsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '.button';
    this.containerSelector = '.container';
    this.headingSelector = 'h1';
    this.exampleSelector = '.example pre';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeadingText() {
    return this.page.textContent(this.headingSelector);
  }

  async getButtonText() {
    return this.page.textContent(this.buttonSelector);
  }

  async getButtonAttribute(attr) {
    return this.page.getAttribute(this.buttonSelector, attr);
  }

  async clickDemoButton() {
    await this.page.click(this.buttonSelector);
  }

  async isContainerVisible() {
    return this.page.isVisible(this.containerSelector);
  }

  async exampleText() {
    return this.page.textContent(this.exampleSelector);
  }
}

test.describe('FSM: Depth-First Search (DFS) Explained - Application tests', () => {
  // Shared per-test listeners/collections
  let consoleMessages;
  let pageErrors;
  let dfsPage;

  // Set up before each test: navigate and attach listeners
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect uncaught page errors (runtime exceptions in the page)
    page.on('pageerror', (err) => {
      // err is a Error object with message and stack
      pageErrors.push(err.message || String(err));
    });

    dfsPage = new DfsPage(page);
    await dfsPage.goto();
  });

  test.describe('State: S0_Idle (Idle)', () => {
    test('renders static content and button on load (entry state)', async ({ page }) => {
      // This test validates the entry state rendering (S0_Idle). It checks static content,
      // presence of the demonstration button and that no unexpected page errors occurred during load.

      // Heading should display the topic title
      const heading = await dfsPage.getHeadingText();
      expect(heading).toContain('Understanding Depth-First Search (DFS)');

      // The demonstration button should exist and have the expected text
      const buttonText = await dfsPage.getButtonText();
      expect(buttonText).toBe('Demonstration (Limited)');

      // The container should be visible and the example block present
      expect(await dfsPage.isContainerVisible()).toBeTruthy();
      const example = await dfsPage.exampleText();
      expect(example).toContain('A'); // crude check that example pre exists with some content

      // The button should have an onclick attribute that calls alert (per FSM evidence)
      const onclickAttr = await dfsPage.getButtonAttribute('onclick');
      expect(onclickAttr).toContain("alert('DFS Demonstration:");

      // No runtime errors should have been emitted during page load for this clean render
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Event: ButtonClick and Transition: S0_Idle -> S0_Idle', () => {
    test('clicking the demonstration button shows an alert dialog with expected message', async ({ page }) => {
      // This test validates the ButtonClick event: clicking the button triggers an alert dialog
      // with the exact message defined in the onclick attribute, and that the page remains in the same state.

      const expectedMessage = "DFS Demonstration: This button currently does not perform any action. Refer to the textual content for learning DFS!";

      // Listen for a single dialog and assert its message, then accept it.
      page.once('dialog', async (dialog) => {
        try {
          expect(dialog.message()).toBe(expectedMessage);
        } finally {
          await dialog.accept();
        }
      });

      // Perform the click which should trigger the alert dialog
      await dfsPage.clickDemoButton();

      // After the dialog is accepted, page should still show the same content (state unchanged)
      expect(await dfsPage.getButtonText()).toBe('Demonstration (Limited)');
      expect(await dfsPage.getHeadingText()).toContain('Understanding Depth-First Search (DFS)');

      // No pageerror should have occurred as a result of clicking the button
      expect(pageErrors).toHaveLength(0);
    });

    test('clicking the button multiple times triggers the alert each time', async ({ page }) => {
      // Validate repeated event: repeated clicks produce repeated alert dialogs with the same message

      const expectedMessage = "DFS Demonstration: This button currently does not perform any action. Refer to the textual content for learning DFS!";
      let dialogCount = 0;

      page.on('dialog', async (dialog) => {
        dialogCount++;
        expect(dialog.message()).toBe(expectedMessage);
        await dialog.accept();
      });

      // Click three times and allow dialog handlers to run
      await dfsPage.clickDemoButton();
      await dfsPage.clickDemoButton();
      await dfsPage.clickDemoButton();

      // Wait a short moment to ensure dialogs processed
      await page.waitForTimeout(50);

      expect(dialogCount).toBe(3);
      // Ensure still no runtime page errors
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('OnEnter/OnExit actions and error scenarios', () => {
    test('renderPage onEnter action is not implemented; calling it synchronously throws ReferenceError', async ({ page }) => {
      // FSM mentions an entry action renderPage() but the HTML does not define it.
      // This test intentionally calls renderPage() in the page context and asserts that the evaluation fails
      // with a ReferenceError (or a message indicating renderPage is not defined).
      await expect(page.evaluate(() => {
        // Direct synchronous call in the page context - should throw a ReferenceError in the browser context.
        // We deliberately do not catch it here to let the runtime produce the natural error.
        return renderPage();
      })).rejects.toThrow(/renderPage is not defined|ReferenceError/i);
    });

    test('calling undefined renderPage asynchronously results in an uncaught page error (observed via pageerror)', async ({ page }) => {
      // This test schedules an asynchronous call to renderPage (which doesn't exist).
      // The uncaught exception should be emitted as a pageerror event and be captured by our listener.

      // Prepare a promise that resolves when a pageerror is observed
      const pageErrorPromise = new Promise((resolve) => {
        const handler = (err) => {
          // We resolve with the message so we can assert its contents below
          resolve(err.message || String(err));
        };
        page.once('pageerror', handler);
      });

      // Schedule an asynchronous call inside the page which will cause an unhandled ReferenceError
      // Note: we do not wrap this call in try/catch inside the page because we want it to surface as pageerror.
      await page.evaluate(() => setTimeout(() => {
        // eslint-disable-next-line no-undef
        renderPage();
      }, 0));

      // Wait for the pageerror to be captured
      const errorMessage = await pageErrorPromise;

      // The observed runtime error message should mention renderPage is not defined / ReferenceError
      expect(errorMessage).toMatch(/renderPage is not defined|ReferenceError/i);

      // Also assert that our collected pageErrors array contains that message
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      expect(pageErrors.join(' ')).toMatch(/renderPage is not defined|ReferenceError/i);
    });

    test('edge case: verify onclick attribute contains the expected alert invocation string', async () => {
      // Validate that the inline onclick attribute indeed contains the expected alert call (evidence from FSM)
      const onclick = await dfsPage.getButtonAttribute('onclick');
      expect(typeof onclick).toBe('string');
      expect(onclick).toContain("alert('DFS Demonstration:");
      // Ensure no additional unexpected characters (basic sanity)
      expect(onclick).toContain('Refer to the textual content for learning DFS!');
    });
  });

  test.describe('Observability: console and runtime diagnostics', () => {
    test('no unexpected console.error messages during normal usage', async ({ page }) => {
      // This test exercises the page (loads it and clicks the button) and asserts there are no console.error messages.
      // We already capture console messages in consoleMessages array.

      // Click the button once to exercise the onclick alert path (dialogs are handled below)
      page.once('dialog', async (dialog) => {
        await dialog.accept();
      });
      await dfsPage.clickDemoButton();

      // Small wait to capture console events if any
      await page.waitForTimeout(50);

      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      // There should be no console.error entries during typical operation of this page
      expect(errorConsoleMessages.length).toBe(0);

      // Also verify pageErrors did not collect any runtime exceptions for this path
      expect(pageErrors.length).toBe(0);
    });

    test('observes and records console messages and page errors arrays are populated when errors occur', async ({ page }) => {
      // This test purposefully causes a runtime page error (via asynchronous call to renderPage) and verifies
      // that our listeners populated the arrays accordingly.

      // Schedule an asynchronous error as in previous test
      const pageErrorPromise = new Promise((resolve) => {
        page.once('pageerror', (err) => resolve(err.message || String(err)));
      });

      await page.evaluate(() => setTimeout(() => {
        // This will cause an unhandled ReferenceError in the page environment
        // eslint-disable-next-line no-undef
        renderPage();
      }, 0));

      const message = await pageErrorPromise;
      expect(message).toMatch(/renderPage is not defined|ReferenceError/i);

      // Ensure pageErrors array captured the same
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      expect(pageErrors.join(' ')).toMatch(/renderPage is not defined|ReferenceError/i);
    });
  });
});