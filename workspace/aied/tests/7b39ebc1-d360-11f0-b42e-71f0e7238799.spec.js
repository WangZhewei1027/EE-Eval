import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b39ebc1-d360-11f0-b42e-71f0e7238799.html';

/**
 * Page Object for the Stack application.
 * Encapsulates selectors and common interactions.
 */
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#stackValue');
    this.pushButton = page.locator('button[onclick="pushValue()"]');
    this.popButton = page.locator('button[onclick="popValue()"]');
    this.viewButton = page.locator('button[onclick="viewStack()"]');
    this.stackDiv = page.locator('#stack');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setInput(value) {
    await this.input.fill(value);
  }

  async pushValue(value) {
    if (value !== undefined) {
      await this.setInput(value);
    }
    await this.pushButton.click();
  }

  async popValue() {
    await this.popButton.click();
  }

  async viewStack() {
    await this.viewButton.click();
  }

  async getStackText() {
    return await this.stackDiv.innerText();
  }
}

/**
 * Collect console errors and page errors for each test run.
 * Each test will assert that there are no unexpected console/page errors,
 * and will surface them if present.
 */
test.describe('Stack Implementation FSM tests - Application ID 7b39ebc1-d360-11f0-b42e-71f0e7238799', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages of type 'error'
    page.on('console', (msg) => {
      // Only collect errors for diagnostics
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location ? msg.location() : undefined,
          });
        }
      } catch (e) {
        // Ignore collection errors - let original errors surface normally
      }
    });

    // Capture page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err.message,
        stack: err.stack,
      });
    });

    // Navigate to the application page (fresh load per test)
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test ensure no page errors or console errors were emitted.
    // Tests will assert these counts individually as well, but this provides
    // consistent cleanup/diagnostics.
  });

  test.describe('State: Idle (S0_Idle) - Initial render and UI presence', () => {
    test('Initial render should display input, buttons, and an empty Current Stack', async ({ page }) => {
      // Arrange
      const app = new StackPage(page);

      // Assert UI elements are present
      await expect(app.input).toBeVisible();
      await expect(app.pushButton).toBeVisible();
      await expect(app.popButton).toBeVisible();
      await expect(app.viewButton).toBeVisible();
      await expect(app.stackDiv).toBeVisible();

      // The initial entry action renderPage() is expected to have been called by page load.
      // The viewStack() should have set the stack text to "Current Stack: " (empty)
      const stackText = await app.getStackText();
      expect(stackText).toBe('Current Stack: ');

      // No console or page errors should have occurred during initial render
      expect(consoleErrors.length, 'No console.error messages during initial render').toBe(0);
      expect(pageErrors.length, 'No page errors during initial render').toBe(0);
    });
  });

  test.describe('Transitions and Events', () => {
    test('PushValue event transitions to Value Pushed (S1_ValuePushed) and updates DOM', async ({ page }) => {
      // This test validates:
      // - pushValue pushes the provided value onto the stack
      // - viewStack() is called (observed via DOM update)
      // - the input is cleared after pushing

      const app = new StackPage(page);

      // Act: push a single value and verify DOM update
      await app.pushValue('one');

      // After pushing, the entry action for S1_ValuePushed should call viewStack()
      await expect(app.stackDiv).toHaveText('Current Stack: one');

      // The input should be cleared by the implementation after a successful push
      await expect(app.input).toHaveValue('');

      // Ensure no console/page errors
      expect(consoleErrors.length, 'No console.error messages after push').toBe(0);
      expect(pageErrors.length, 'No page errors after push').toBe(0);
    });

    test('Multiple Push operations maintain order (LIFO perspective when popping later)', async ({ page }) => {
      // Validate pushing multiple values results in the expected sequence in view()
      const app = new StackPage(page);

      await app.pushValue('first');
      await app.pushValue('second');
      await app.pushValue('third');

      // viewStack should show items in push order separated by ', '
      await expect(app.stackDiv).toHaveText('Current Stack: first, second, third');

      expect(consoleErrors.length, 'No console.error messages after multiple pushes').toBe(0);
      expect(pageErrors.length, 'No page errors after multiple pushes').toBe(0);
    });

    test('ViewStack event (S0_Idle -> S0_Idle) shows current stack without changing it', async ({ page }) => {
      const app = new StackPage(page);

      // Prepare the stack with values
      await app.pushValue('alpha');
      await app.pushValue('beta');

      // Save current stack text
      const before = await app.getStackText();

      // Act: click the "View Stack" button - should not change the stack content
      await app.viewStack();

      const after = await app.getStackText();
      expect(after, 'View Stack should not mutate the stack').toBe(before);

      expect(consoleErrors.length, 'No console.error messages after view stack').toBe(0);
      expect(pageErrors.length, 'No page errors after view stack').toBe(0);
    });

    test('PopValue event transitions to Value Popped (S2_ValuePopped): pops top value and alerts it', async ({ page }) => {
      // This test validates:
      // - popValue() returns the latest pushed value and alerts it
      // - viewStack() is called after popping and DOM updates accordingly

      const app = new StackPage(page);

      // Push two values, then pop one, expect alert with the last pushed
      await app.pushValue('one');
      await app.pushValue('two');

      // Listen for the dialog once and assert its message
      const [dialogPromise] = await Promise.all([
        page.waitForEvent('dialog'),
        app.popValue(), // trigger pop which causes an alert
      ]);

      // Assert dialog message equals the popped value ("two")
      expect(dialogPromise.message()).toBe('two');
      await dialogPromise.accept();

      // After popping, the stack view should update to contain only the remaining element
      await expect(app.stackDiv).toHaveText('Current Stack: one');

      expect(consoleErrors.length, 'No console.error messages after pop with items').toBe(0);
      expect(pageErrors.length, 'No page errors after pop with items').toBe(0);
    });

    test('PopValue on empty stack alerts "Stack is empty" and leaves DOM unchanged', async ({ page }) => {
      // Validate popping when stack is empty triggers the expected alert text
      const app = new StackPage(page);

      // Ensure stack is empty initially
      await expect(app.stackDiv).toHaveText('Current Stack: ');

      // Wait for dialog produced by pop on empty stack
      const [dialogPromise] = await Promise.all([
        page.waitForEvent('dialog'),
        app.popValue(),
      ]);

      expect(dialogPromise.message()).toBe('Stack is empty');
      await dialogPromise.accept();

      // Stack DOM should remain the same (empty)
      await expect(app.stackDiv).toHaveText('Current Stack: ');

      expect(consoleErrors.length, 'No console.error messages after pop on empty stack').toBe(0);
      expect(pageErrors.length, 'No page errors after pop on empty stack').toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Pushing an empty input should not modify the stack', async ({ page }) => {
      // If input is empty, pushValue() should be a no-op according to implementation check (if (value) ...)
      const app = new StackPage(page);

      // Ensure input is empty
      await app.setInput('');
      await app.pushValue(); // clicking push while input is empty

      // Stack should remain empty
      await expect(app.stackDiv).toHaveText('Current Stack: ');

      // No alert should be triggered; therefore no dialog events captured.
      // Also ensure no console / page errors occurred.
      expect(consoleErrors.length, 'No console.error messages after pushing empty input').toBe(0);
      expect(pageErrors.length, 'No page errors after pushing empty input').toBe(0);
    });

    test('Stress: push many items then pop them all to verify stability', async ({ page }) => {
      // This test pushes 20 items and then pops them all verifying DOM and alerts for each pop.
      const app = new StackPage(page);

      const items = Array.from({ length: 20 }, (_, i) => `n${i + 1}`);

      for (const item of items) {
        await app.pushValue(item);
      }

      // Validate last pushed is at the end of the view
      const expectedView = 'Current Stack: ' + items.join(', ');
      await expect(app.stackDiv).toHaveText(expectedView);

      // Pop all items and collect alert messages to ensure LIFO order
      const poppedMessages = [];
      for (let i = items.length - 1; i >= 0; i--) {
        const expected = items[i];
        const [dialog] = await Promise.all([
          page.waitForEvent('dialog'),
          app.popValue(),
        ]);
        poppedMessages.push(dialog.message());
        await dialog.accept();
      }

      // Ensure popped messages are in LIFO order
      expect(poppedMessages).toEqual(items.slice().reverse());

      // After all pops, stack should be empty
      await expect(app.stackDiv).toHaveText('Current Stack: ');

      expect(consoleErrors.length, 'No console.error messages after stress test').toBe(0);
      expect(pageErrors.length, 'No page errors after stress test').toBe(0);
    });
  });

  test.describe('Diagnostics: Console and Page Error Observation', () => {
    test('No ReferenceError, SyntaxError, or TypeError should be emitted during normal usage', async ({ page }) => {
      // This test performs a few operations and then asserts that no page errors or console errors occurred.
      const app = new StackPage(page);

      // Perform a few operations
      await app.pushValue('diag1');
      await app.viewStack();
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        app.popValue(),
      ]);
      // Accept the dialog to continue
      await dialog.accept();

      // At this point, collect errors captured by listeners set in beforeEach
      // The requirement is to "observe console logs and page errors" and let any ReferenceError/SyntaxError/TypeError happen naturally.
      // Here we assert that none occurred during these normal interactions.
      if (consoleErrors.length > 0 || pageErrors.length > 0) {
        // Surface the collected errors to make debugging easier if they exist
        // But still assert so test fails if unexpected errors occurred.
        console.error('Collected console errors:', consoleErrors);
        console.error('Collected page errors:', pageErrors);
      }

      expect(consoleErrors.length, 'No console.error messages observed').toBe(0);
      expect(pageErrors.length, 'No unhandled page errors observed').toBe(0);
    });
  });
});