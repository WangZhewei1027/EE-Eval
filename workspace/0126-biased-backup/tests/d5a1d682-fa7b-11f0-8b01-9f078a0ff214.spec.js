import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a1d682-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('Understanding Time Complexity - FSM validation (d5a1d682-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Shared collectors for console messages and page errors observed during each test
  let consoleMessages = [];
  let pageErrors = [];
  let consoleHandler;
  let pageErrorHandler;

  // Setup: navigate to the page and attach observers for console and page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages with type and text for later assertions
    consoleHandler = (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case msg.text() throws (shouldn't), capture the error message
        consoleMessages.push({ type: 'unknown', text: `<<error retrieving text: ${e}>>` });
      }
    };
    page.on('console', consoleHandler);

    // Collect any uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.)
    pageErrorHandler = (err) => {
      pageErrors.push(err);
    };
    page.on('pageerror', pageErrorHandler);

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  // Teardown: remove listeners to avoid cross-test interference
  test.afterEach(async ({ page }) => {
    try {
      page.off('console', consoleHandler);
    } catch (e) {
      // ignore if already removed
    }
    try {
      page.off('pageerror', pageErrorHandler);
    } catch (e) {
      // ignore if already removed
    }
  });

  test('Idle state: initial render shows content and the demo button', async ({ page }) => {
    // Validate page title and main heading -- ensures renderPage() (FSM S0 entry) didn't crash the page
    await expect(page).toHaveTitle(/Understanding Time Complexity/i);
    const heading = page.locator('h1');
    await expect(heading).toHaveText(/Understanding Time Complexity/i);

    // Validate presence of the button described in the FSM and its attributes
    const demoButton = page.locator('button.button');
    await expect(demoButton).toHaveCount(1);
    await expect(demoButton).toHaveText('Show Time Complexity Demo');

    // Verify the button has the onclick attribute that matches the FSM evidence
    const onclickAttr = await demoButton.getAttribute('onclick');
    expect(onclickAttr).toBe('showDemo()');

    // Verify showDemo is defined on the window (script is present)
    const showDemoType = await page.evaluate(() => typeof window.showDemo);
    expect(showDemoType).toBe('function');

    // At initial render no alert/dialogs should have been shown yet (Idle state)
    // We didn't attach a global dialog handler; ensure no page errors were emitted on load
    expect(pageErrors.length).toBe(0);

    // Also ensure there are no console error messages
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
    expect(consoleErrorMessages.length).toBe(0);
  });

  test('Transition ShowDemo (S0 -> S1): clicking the button triggers alert with expected message', async ({ page }) => {
    // This test validates the FSM transition: clicking the .button triggers showDemo() which shows an alert
    const expectedAlertText = "This is a simple demonstration of time complexity concepts. Look for the explanations in the text above on how different algorithms can vary in time complexity!";

    // Wait for the dialog to appear as a result of clicking the button
    const dialogPromise = page.waitForEvent('dialog');
    await page.click('button.button');
    const dialog = await dialogPromise;

    // Verify the dialog is an alert and contains the expected message
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe(expectedAlertText);

    // Accept the alert to allow the page to continue
    await dialog.accept();

    // After the action, ensure no page errors were emitted as a result of calling showDemo()
    expect(pageErrors.length).toBe(0);

    // Confirm the console didn't log any unexpected errors during the flow
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
    expect(consoleErrorMessages.length).toBe(0);
  });

  test('Transition via dispatchEvent: synthetic click triggers same alert (verifies onclick binding works with events)', async ({ page }) => {
    // Clicking via dispatchEvent should also trigger the onclick handler and produce an alert
    const dialogPromise = page.waitForEvent('dialog');

    // Dispatch a MouseEvent click on the button from the page context
    await page.evaluate(() => {
      const btn = document.querySelector('button.button');
      if (!btn) throw new Error('Demo button not found in page context');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('This is a simple demonstration of time complexity concepts');
    await dialog.accept();

    // Validate no new page errors appeared
    expect(pageErrors.length).toBe(0);
  });

  test('Multiple rapid clicks produce multiple alert dialogs (reproducibility and stability)', async ({ page }) => {
    // Click the button three times in rapid succession and confirm three dialogs are produced
    const clickCount = 3;
    const dialogPromises = [];

    // Start waiting for multiple dialog events
    for (let i = 0; i < clickCount; i++) {
      dialogPromises.push(page.waitForEvent('dialog'));
    }

    // Trigger clicks without awaiting dialogs between them to simulate rapid user clicks
    for (let i = 0; i < clickCount; i++) {
      // Use the locator click to ensure proper bubbling and invocation of onclick
      page.click('button.button');
    }

    // Await all dialogs and accept them
    const dialogs = await Promise.all(dialogPromises);
    expect(dialogs.length).toBe(clickCount);
    for (const dlg of dialogs) {
      expect(dlg.type()).toBe('alert');
      expect(dlg.message()).toContain('This is a simple demonstration of time complexity concepts');
      await dlg.accept();
    }

    // Ensure no page errors due to rapid repeated invocations
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: clicking a non-existent selector should throw - error scenario handling', async ({ page }) => {
    // This test intentionally attempts to click a selector that does not exist to validate error handling behavior.
    // We expect Playwright to reject the promise with an error (no node found).
    // Use a short timeout to fail fast.
    const nonexistentSelector = '.this-selector-does-not-exist-12345';

    // Playwright's click will reject; assert that a rejection occurs
    await expect(page.click(nonexistentSelector, { timeout: 1000 })).rejects.toThrow();

    // No page runtime errors should be present as a result of this test (the error is from the test engine)
    expect(pageErrors.length).toBe(0);
  });

  test('Verification of FSM entry action for DemoShown: showDemo executed on transition (observed via alert)', async ({ page }) => {
    // This is a focused check that when transitioning to S1 (DemoShown), the entry action showDemo() runs.
    // The evidence for the entry action in the implementation is the alert itself.
    const dialogPromise = page.waitForEvent('dialog');
    await page.click('button.button');
    const dialog = await dialogPromise;

    // Validate alert text equals FSM evidence
    expect(dialog.message()).toContain('This is a simple demonstration of time complexity concepts');
    await dialog.accept();

    // Confirm that the showDemo function exists and is callable (sanity check after the event)
    const isCallable = await page.evaluate(() => {
      try {
        return typeof window.showDemo === 'function';
      } catch (e) {
        return false;
      }
    });
    expect(isCallable).toBe(true);
  });

  test('Inspect DOM content described in the FSM: ensure descriptive sections are present', async ({ page }) => {
    // Validate presence of several explanatory sections referenced in the HTML that support the FSM context
    await expect(page.locator('h2', { hasText: 'What is Time Complexity?' })).toHaveCount(1);
    await expect(page.locator('h2', { hasText: 'Big O Notation' })).toHaveCount(1);
    await expect(page.locator('h3', { hasText: '1. Constant Time - O(1)' })).toHaveCount(1);
    await expect(page.locator('h3', { hasText: '2. Linear Time - O(n)' })).toHaveCount(1);
    await expect(page.locator('h3', { hasText: '3. Quadratic Time - O(n²)' })).toHaveCount(1);

    // Ensure code examples are present within <pre> tags as per the HTML (not executed)
    const preCount = await page.locator('pre').count();
    expect(preCount).toBeGreaterThanOrEqual(3);

    // No page errors during DOM inspection
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console and page errors across interactions (no unexpected runtime errors)', async ({ page }) => {
    // Perform a typical interaction to ensure we capture any runtime errors that might arise during normal usage
    const dialogPromise = page.waitForEvent('dialog');
    await page.click('button.button');
    const dialog = await dialogPromise;
    await dialog.accept();

    // After interactions, assert that there were no uncaught page errors reported
    expect(pageErrors.length).toBe(0, `Expected no page errors, but found: ${pageErrors.map(e => String(e)).join('; ')}`);

    // Also assert there were no console.error messages logged
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
    expect(consoleErrors.length).toBe(0, `Unexpected console errors: ${JSON.stringify(consoleErrors)}`);
  });
});