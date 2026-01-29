import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0442f854-fa79-11f0-8a8e-bbe4f11717c6.html';

// Simple Page Object to encapsulate interactions and console/pageerror collection
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Collect console messages and page errors for assertions
    this.consoleMessages = [];
    this.pageErrors = [];

    // Bind handlers early to capture any messages/errors during navigation
    this.page.on('console', (msg) => {
      // store the ConsoleMessage object for detailed inspection
      this.consoleMessages.push(msg);
    });

    this.page.on('pageerror', (err) => {
      // store the Error object thrown in page
      this.pageErrors.push(err);
    });
  }

  // Navigate to the application URL
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Return the button element handle (if present)
  async getButtonHandle() {
    return await this.page.$('.button');
  }

  // Click the Solve Problem button
  async clickSolve() {
    await this.page.click('.button');
  }

  // Count console messages that appear to be the "Result" from solveProblem
  _countResultConsoleMessages() {
    return this.consoleMessages.filter((msg) => {
      try {
        const text = msg.text();
        // The implementation logs two args: "Result: ", "Hello, World!"
        // Playwright ConsoleMessage.text() often concatenates args with spaces.
        return text.includes('Result') || text.includes('Hello, World!') || text.includes('Hello, World');
      } catch (e) {
        return false;
      }
    }).length;
  }

  // Wait until expected number of result messages have appeared or timeout
  async waitForResultMessages(expectedCount = 1, timeout = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (this._countResultConsoleMessages() >= expectedCount) {
        return;
      }
      // small delay to avoid busy loop
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`Timed out waiting for ${expectedCount} result console messages (observed ${this._countResultConsoleMessages()})`);
  }
}

test.describe('Dynamic Programming App (FSM validation): 0442f854-fa79-11f0-8a8e-bbe4f11717c6', () => {

  // Validate the Idle state (S0_Idle) expectations and entry actions
  test.describe('State: Idle (S0_Idle)', () => {

    test('Initial render shows header and Solve Problem button; entry action renderPage() is not present', async ({ page }) => {
      // Setup page object and navigate
      const app = new AppPage(page);
      await app.goto();

      // Validate structural elements: header and button exist
      const header = await page.$('.header h1');
      expect(header).not.toBeNull();
      expect((await header.textContent()).trim()).toBe('Dynamic Programming');

      const button = await app.getButtonHandle();
      expect(button).not.toBeNull();
      // Ensure button displays the expected text
      expect((await button.textContent()).trim()).toBe('Solve Problem');

      // FSM entry action for S0_Idle mentions renderPage()
      // Verify whether renderPage exists on the global window.
      // The implementation provided does not define renderPage(), so assert it's undefined.
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');

      // solveProblem function should exist but should not have been executed yet.
      const solveType = await page.evaluate(() => typeof window.solveProblem);
      expect(solveType).toBe('function');

      // No page runtime errors should have occurred on initial load
      expect(app.pageErrors.length).toBe(0);
    });

  });

  // Validate the transition from Idle to Solving triggered by clicking the button
  test.describe('Transition: SolveProblemClick (S0_Idle -> S1_Solving)', () => {

    test('Clicking the Solve Problem button triggers solveProblem() and logs the result to console', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      // Ensure there are no result logs prior to clicking
      expect(app._countResultConsoleMessages()).toBe(0);

      // Click the button to trigger the transition / processing state
      await app.clickSolve();

      // The implementation uses setTimeout(..., 2000) to log the result.
      // Wait for at least one "Result" console message to appear.
      await app.waitForResultMessages(1, 6000);

      // Assert that at least one console message matches the expected output
      const found = app.consoleMessages.some((msg) => {
        const text = msg.text();
        return text.includes('Result') || text.includes('Hello, World!');
      });
      expect(found).toBe(true);

      // No page runtime errors should have occurred during the transition
      expect(app.pageErrors.length).toBe(0);
    });

    test('Multiple quick clicks schedule multiple completions (edge case)', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      // Click the button twice in quick succession to schedule two timeouts
      await app.clickSolve();
      await app.clickSolve();

      // Expect at least two result logs to appear (both timeouts should fire)
      await app.waitForResultMessages(2, 8000);

      const count = app._countResultConsoleMessages();
      expect(count).toBeGreaterThanOrEqual(2);

      // No page runtime errors should have occurred as a result of multiple clicks
      expect(app.pageErrors.length).toBe(0);
    });

    test('Ensure console output formatting contains both "Result" and "Hello, World!" components', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      await app.clickSolve();
      await app.waitForResultMessages(1, 6000);

      // Inspect the last console message that looks like the result
      const resultMsgs = app.consoleMessages.filter((m) => {
        const t = m.text();
        return t.includes('Result') || t.includes('Hello, World');
      });
      expect(resultMsgs.length).toBeGreaterThanOrEqual(1);

      const last = resultMsgs[resultMsgs.length - 1];
      const text = last.text();

      // The implementation logs two arguments; the concatenated text should include both parts
      expect(text).toMatch(/Result/);
      expect(text).toMatch(/Hello/);
      expect(text).toMatch(/World/);

      // Confirm again no page errors
      expect(app.pageErrors.length).toBe(0);
    });

  });

  // Error handling and negative scenarios
  test.describe('Errors and unexpected behaviors', () => {

    test('No ReferenceError, SyntaxError, or TypeError should have occurred during normal usage', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      // Perform normal interaction
      await app.clickSolve();
      await app.waitForResultMessages(1, 6000);

      // Collect types of page errors (if any)
      const errorTypes = app.pageErrors.map(e => e && e.name ? e.name : String(e));

      // Assert that there were no page errors at all. If there were, list them for debugging.
      expect(errorTypes.length).toBe(0);
    });

    test('Clicking when button is missing should throw - simulate via DOM removal (edge behavior on page)', async ({ page }) => {
      const app = new AppPage(page);
      await app.goto();

      // Remove the button from the DOM to simulate an edge scenario where the UI is broken.
      // Note: This is introspective to the test environment and does NOT patch app logic.
      await page.evaluate(() => {
        const btn = document.querySelector('.button');
        if (btn && btn.parentElement) btn.parentElement.removeChild(btn);
      });

      // Attempt to click the button now should fail; ensure playwright throws a descriptive error.
      let clickError = null;
      try {
        await app.clickSolve();
      } catch (e) {
        clickError = e;
      }

      // We expect an error because the button is no longer in the DOM; assert that an error occurred.
      expect(clickError).not.toBeNull();

      // No page runtime errors originating from the application code should have appeared
      // (the thrown error is from Playwright due to missing element, not page JS errors)
      expect(app.pageErrors.length).toBe(0);
    });

  });

});