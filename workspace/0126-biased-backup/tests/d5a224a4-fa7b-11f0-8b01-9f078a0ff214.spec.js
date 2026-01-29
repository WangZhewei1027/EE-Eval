import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a224a4-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('Application d5a224a4-fa7b-11f0-8b01-9f078a0ff214 - FSM & UI tests', () => {
  // Capture console messages and page errors for each test to validate runtime behavior.
  test.beforeEach(async ({ page }) => {
    // Reset listeners/collections for each test
    page._consoleMessages = [];
    page._pageErrors = [];

    page.on('console', msg => {
      // store console messages for assertions
      page._consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', err => {
      // store page errors for assertions
      page._pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // small sanity check: make sure the page variable is present
    // (this is just to ensure teardown doesn't throw)
    expect(page).toBeTruthy();
  });

  test.describe('FSM State: S0_Idle (Idle)', () => {
    test('S0_Idle: page loads and renders the main heading and content (entry evidence)', async ({ page }) => {
      // This test validates that the Idle state evidence is present on initial render:
      // - <h1>Understanding Virtual Memory</h1> should exist
      // - Page should contain descriptive content paragraphs
      await page.goto(APP_URL);

      const heading = await page.locator('h1').textContent();
      expect(heading).toBe('Understanding Virtual Memory');

      // Ensure there is at least one paragraph of explanatory text
      const paragraphs = await page.locator('.container p').allTextContents();
      expect(paragraphs.length).toBeGreaterThanOrEqual(1);
      expect(paragraphs[0]).toContain('Virtual memory is a memory management technique');

      // Verify there are currently no page errors on plain load
      expect(page._pageErrors.length).toBe(0);
    });

    test('S0_Idle: entry action renderPage() is referenced by FSM but not implemented -> invoking it causes ReferenceError', async ({ page }) => {
      // This test intentionally invokes the undefined entry action renderPage()
      // to validate that a ReferenceError occurs naturally (per requirements).
      await page.goto(APP_URL);

      // Prepare to capture a pageerror event that will be emitted if the call
      // results in an unhandled exception on the page. We also attempt a direct
      // evaluate and expect it to reject.
      let capturedPageError = null;
      const pageErrorPromise = new Promise(resolve => {
        const handler = err => {
          capturedPageError = err;
          // resolve immediately on the first page error
          resolve(err);
        };
        page.on('pageerror', handler);
      });

      // Attempt to call renderPage() directly in page context WITHOUT try/catch
      // so the error propagates and triggers a pageerror event. We expect the
      // evaluate to reject because renderPage is not defined.
      let evaluateError = null;
      try {
        // eslint-disable-next-line no-undef
        await page.evaluate(() => {
          // Intentionally call undefined function to reproduce ReferenceError
          // per FSM entry action verification requirement.
          return renderPage(); // eslint-disable-line no-undef
        });
      } catch (err) {
        evaluateError = err;
      }

      // Wait for the pageerror event to be captured (if any)
      await pageErrorPromise;

      // Assert that evaluate indeed rejected with an error mentioning renderPage
      expect(evaluateError).toBeTruthy();
      expect(evaluateError.message.toLowerCase()).toContain('renderpage');

      // Assert that the pageerror was emitted and its message references the missing function
      expect(capturedPageError).toBeTruthy();
      // The browser-side error message typically contains 'renderPage is not defined'
      expect(String(capturedPageError.message).toLowerCase()).toContain('renderpage');
      expect(String(capturedPageError.message).toLowerCase()).toMatch(/not defined|is not defined/);
    });
  });

  test.describe('FSM Transition: ShowMemoryUsageExample (S0 -> S1 Demonstration)', () => {
    test('Transition event exists: link with .button selector and correct attributes', async ({ page }) => {
      // This test validates the component evidence in the DOM: the link exists,
      // has the expected text content and attributes (href, onclick).
      await page.goto(APP_URL);

      const button = page.locator('a.button');
      await expect(button).toHaveCount(1);

      const btnText = await button.textContent();
      expect(btnText.trim()).toBe('Show Memory Usage Example');

      const href = await button.getAttribute('href');
      expect(href).toBe('javascript:void(0);');

      const onclick = await button.getAttribute('onclick');
      // The FSM evidence expects onclick="demonstrate();"
      expect(onclick).toBe('demonstrate();');
    });

    test('S1_Demonstration: clicking the button triggers demonstrate() which opens an alert dialog', async ({ page }) => {
      // This test validates the transition by simulating a user click and
      // asserting that the alert dialog appears with the expected explanatory text.
      await page.goto(APP_URL);

      // Listen for dialog and capture its message
      let dialogMessage = null;
      page.on('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      // Click the button which has onclick="demonstrate();"
      await page.click('a.button');

      // Wait briefly for the dialog handler to run
      await page.waitForTimeout(100); // small wait to ensure dialog event processed

      // The demonstrate() function shows a descriptive alert about swapping to disk.
      expect(dialogMessage).toBeTruthy();
      expect(dialogMessage).toContain('In a real-world scenario');
      expect(dialogMessage).toContain('swap');
      expect(dialogMessage).toContain('virtual memory');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Clicking a non-existent selector throws a Playwright error', async ({ page }) => {
      // Validate behavior when attempting to interact with a missing element.
      // Expect Playwright to throw because the selector is not found.
      await page.goto(APP_URL);

      // Attempt to click an element that does not exist and assert rejection.
      let thrown = null;
      try {
        await page.click('.non-existent-selector', { timeout: 1000 });
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeTruthy();
      // Error message should indicate that no node was found for selector
      const msg = String(thrown.message).toLowerCase();
      expect(msg).toMatch(/(no node found|element.*not found|waiting for)/);
    });

    test('Ensure no unexpected console "error" level messages on normal interaction (except expected page errors)', async ({ page }) => {
      // This test ensures that normal usage (loading and clicking the button)
      // does not produce console.error messages. Note: we previously validated
      // that calling renderPage() produces a page error; here we test the
      // normal user flow.
      await page.goto(APP_URL);

      // Clear any previous captured messages
      page._consoleMessages = [];
      page._pageErrors = [];

      // Click the demonstration button and accept the dialog
      page.on('dialog', async d => d.accept());
      await page.click('a.button');

      // Wait a short time for any console messages to be emitted
      await page.waitForTimeout(100);

      // Filter console messages for error level
      const errorMessages = page._consoleMessages.filter(m => m.type === 'error');
      expect(errorMessages.length).toBe(0);

      // Also assert there were no page errors during this flow
      expect(page._pageErrors.length).toBe(0);
    });
  });

  test.describe('Evidence verification and content checks', () => {
    test('HTML evidence: the button element contains the exact onclick attribute string expected by FSM', async ({ page }) => {
      // Confirm that the DOM contains the exact evidence string onclick="demonstrate();"
      await page.goto(APP_URL);

      const elementOnclick = await page.locator('a.button').getAttribute('onclick');
      expect(elementOnclick).toBe('demonstrate();');

      // Verify that the outerHTML includes the evidence snippet (basic sanity check)
      const outer = await page.locator('a.button').evaluate(node => node.outerHTML);
      expect(outer).toContain('onclick="demonstrate();');
      expect(outer).toContain('class="button"');
      expect(outer).toContain('Show Memory Usage Example');
    });
  });
});