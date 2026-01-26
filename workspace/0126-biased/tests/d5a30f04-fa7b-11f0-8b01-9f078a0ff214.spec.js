import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a30f04-fa7b-11f0-8b01-9f078a0ff214.html';

// Page object representing the interactive demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Collect console messages and page errors for assertions
    this.consoleMessages = [];
    this.pageErrors = [];

    // Attach listeners to observe runtime behavior (console logs & uncaught errors)
    this.page.on('console', (msg) => {
      // store full console message objects for analysis
      this.consoleMessages.push(msg);
    });
    this.page.on('pageerror', (err) => {
      // store Error objects emitted by the page
      this.pageErrors.push(err);
    });
  }

  // Navigate to the application URL
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Return the first element matching the button selector
  async getButton() {
    return this.page.locator('.button').first();
  }

  // Click the "Show Demonstration" button and handle dialog via handler
  async clickShowDemo(expectDialog = true) {
    if (expectDialog) {
      const messages = [];
      this.page.once('dialog', async (dialog) => {
        messages.push(dialog.message());
        await dialog.accept();
      });
      await this.getButton().click();
      // Wait a tick to ensure dialog handler ran
      await this.page.waitForTimeout(50);
      return messages[0];
    } else {
      await this.getButton().click();
      return undefined;
    }
  }

  // Retrieve attribute from the button (onclick attribute)
  async getButtonOnclickAttr() {
    const btn = await this.getButton();
    return btn.getAttribute('onclick');
  }

  // Retrieve button text content
  async getButtonText() {
    const btn = await this.getButton();
    return btn.textContent();
  }

  // Retrieve main heading text
  async getHeadingText() {
    return this.page.textContent('h1');
  }

  // Intentionally try to invoke the entry action renderPage() that is declared in FSM but not present
  // This should naturally produce a ReferenceError inside the page context if the function is missing
  async invokeRenderPage() {
    // Note: We intentionally evaluate a function call that likely doesn't exist in the page.
    // Per instructions, we must let ReferenceError happen naturally and assert that it occurs.
    return this.page.evaluate(() => {
      // Calling renderPage() inside page context; if missing, this will throw a ReferenceError.
      return renderPage();
    });
  }
}

test.describe('Understanding Static Typing — FSM driven tests', () => {
  // Each test will create a new page and DemoPage instance via the Playwright page fixture
  test.describe('States and DOM verification', () => {
    test('S0_Idle: initial render shows expected content and no immediate runtime errors', async ({ page }) => {
      // This test validates the Idle state entry: page should render and show the main content,
      // the "Show Demonstration" button exists and has an inline onclick attribute.
      const demo = new DemoPage(page);
      await demo.goto();

      // Validate heading and button text presence
      const heading = await demo.getHeadingText();
      expect(heading).toContain('Understanding Static Typing');

      const buttonText = await demo.getButtonText();
      expect(buttonText).toBeTruthy();
      expect(buttonText.trim()).toBe('Show Demonstration');

      // Validate onclick attribute exists and contains the expected snippet (evidence)
      const onclickAttr = await demo.getButtonOnclickAttr();
      expect(onclickAttr).toBeTruthy();
      expect(onclickAttr).toContain("This is a simple demonstration of static typing principles");

      // At initial load, assert that there are no uncaught page errors recorded immediately.
      // (If the implementation had an immediate runtime error, it would be captured here.)
      expect(demo.pageErrors.length).toBe(0);

      // Also assert that there are no console messages of type 'error' recorded initially.
      const consoleErrors = demo.consoleMessages.filter(m => m.type() === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Events and transitions', () => {
    test('ShowDemonstration event: clicking the button triggers an alert and represents transition to S1_DemonstrationShown', async ({ page }) => {
      // This test validates the FSM transition: clicking the .button should trigger an alert dialog
      // with the expected message. We assert that the dialog appears and content matches the evidence.
      const demo = new DemoPage(page);
      await demo.goto();

      // Ensure no prior page errors
      expect(demo.pageErrors.length).toBe(0);

      // Click the button and capture the dialog message
      const dialogMessage = await demo.clickShowDemo(true);

      // Validate that the dialog was triggered and contains the expected message
      expect(dialogMessage).toBeTruthy();
      expect(dialogMessage).toContain('This is a simple demonstration of static typing principles');
      expect(dialogMessage).toContain('Please refer to the text for comprehensive understanding.');

      // After handling the dialog, ensure no unexpected page errors were emitted as a result
      expect(demo.pageErrors.length).toBe(0);

      // Edge case: clicking the button again triggers another alert (multiple transitions)
      const dialogMessage2 = await demo.clickShowDemo(true);
      expect(dialogMessage2).toBeTruthy();
      expect(dialogMessage2).toContain('This is a simple demonstration of static typing principles');
    });
  });

  test.describe('Error scenarios & FSM entry_actions verification', () => {
    test('Invoking FSM entry action renderPage() (not implemented) should naturally produce a ReferenceError', async ({ page }) => {
      // This test intentionally attempts to invoke the entry action named in the FSM (renderPage()).
      // The HTML/JS does not define renderPage(), so calling it should cause a ReferenceError
      // inside the page context. We must not patch the page; we let the error happen and assert it.
      const demo = new DemoPage(page);
      await demo.goto();

      // Sanity: ensure the renderPage function is not present as a property on window (best-effort check)
      const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
      // We don't assert that it must be missing (it might exist in some environments), but typically it is undefined.
      // If it is present, invoking it could succeed; handle both cases.
      if (hasRenderPage) {
        // If renderPage exists unexpectedly, call it and ensure it doesn't crash the page.
        // We still call it inside evaluate to follow the "let it happen naturally" rule.
        await page.evaluate(() => {
          try {
            // call and ignore return
            return window.renderPage();
          } catch (e) {
            // rethrow to be observed by test harness
            throw e;
          }
        });
        // If it existed and executed, there should be no ReferenceError in the pageErrors
        const refErrors = demo.pageErrors.filter(e => e.message && e.message.includes('renderPage'));
        expect(refErrors.length).toBe(0);
      } else {
        // renderPage is not defined. Calling it should reject the evaluate() promise with a ReferenceError.
        // Use Playwright's expect().rejects to assert that evaluate rejects.
        await expect(demo.invokeRenderPage()).rejects.toThrow(/renderPage|is not defined|ReferenceError/);

        // The pageerror handler should capture a ReferenceError object
        // Wait briefly to allow pageerror to be emitted and captured
        await page.waitForTimeout(50);
        const matched = demo.pageErrors.some(err => {
          return err && err.message && /renderPage|is not defined|ReferenceError/.test(err.message);
        });
        expect(matched).toBe(true);
      }
    });

    test('Observing console & pageerror lifecycle: ensure errors are surfaced to the test harness', async ({ page }) => {
      // This test demonstrates capturing console messages and page errors when runtime errors happen.
      // We will cause a ReferenceError (if renderPage not present) and assert both the thrown promise
      // and the recorded pageerror / console messages include useful information.
      const demo = new DemoPage(page);
      await demo.goto();

      // Clear any existing captures
      demo.consoleMessages.length = 0;
      demo.pageErrors.length = 0;

      // Attempt to call a clearly missing global to produce a ReferenceError (use a unique name to avoid collisions)
      const missingFnName = '__nonexistent_unique_fn_for_test__';
      // Ensure not defined, then call it in page context
      const exists = await page.evaluate((name) => typeof window[name] !== 'undefined', missingFnName);
      if (exists) {
        // If present (very unlikely), skip the invocation to avoid interfering
        test.skip(true, `Global ${missingFnName} unexpectedly exists in page context.`);
        return;
      }

      // Invoke it and assert rejection
      const invocation = page.evaluate((name) => {
        // Intentionally call a globally undefined identifier to provoke a ReferenceError.
        // Using eval to construct identifier dynamically to avoid static analysis in this test runner.
        return eval(`${name}()`); // eslint-disable-line no-eval
      }, missingFnName);

      await expect(invocation).rejects.toThrow(/is not defined|ReferenceError/);

      // Give time for pageerror to be emitted
      await page.waitForTimeout(50);

      // Assert that pageErrors captured at least one ReferenceError
      expect(demo.pageErrors.length).toBeGreaterThanOrEqual(1);
      const hasRef = demo.pageErrors.some(err => /ReferenceError|is not defined/.test(err.message));
      expect(hasRef).toBe(true);

      // Also check console for error-level messages (some environments may log uncaught exceptions)
      const consoleErrors = demo.consoleMessages.filter(m => m.type() === 'error');
      // It's acceptable if console errors are zero or more; assert that if present, they include the missing name
      if (consoleErrors.length > 0) {
        const found = consoleErrors.some(m => m.text().includes(missingFnName) || /ReferenceError/.test(m.text()));
        // It's sufficient that at least one console error references the missing function or ReferenceError
        expect(found).toBe(true);
      }
    });
  });
});