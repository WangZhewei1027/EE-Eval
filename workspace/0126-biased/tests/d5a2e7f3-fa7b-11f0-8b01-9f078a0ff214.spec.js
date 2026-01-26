import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a2e7f3-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('Design Patterns Explained - Singleton FSM validation', () => {
  // Capture console messages and uncaught page errors for each test run
  test.beforeEach(async ({ page }) => {
    // Ensure a fresh capture for each test
    page._capturedConsoleMessages = [];
    page._capturedPageErrors = [];

    page.on('console', (msg) => {
      // store all console messages (including errors) for inspection
      page._capturedConsoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', (err) => {
      // store uncaught exceptions
      page._capturedPageErrors.push(err);
    });

    // Load the application page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Test the Idle state (S0_Idle): page render and presence of the demo button
  test('S0_Idle: Page renders and shows the "See Singleton Pattern in Action" button', async ({ page }) => {
    // Verify page title and main content loaded
    await expect(page).toHaveTitle(/Design Patterns Explained/);

    // The FSM evidence includes a button with selector .demo-button
    const button = await page.waitForSelector('.demo-button', { state: 'visible' });
    expect(button).not.toBeNull();

    // Verify button text content
    const text = await button.textContent();
    expect(text).toContain('See Singleton Pattern in Action');

    // Verify button has the onclick attribute that ties to demonstrateSingleton()
    const onclick = await button.getAttribute('onclick');
    expect(onclick).toBe('demonstrateSingleton()');

    // Verify that the FSM's S0_Idle entry action 'renderPage()' is not present in the global scope.
    // The implementation does not define renderPage(), so it should be undefined.
    const renderPageType = await page.evaluate(() => typeof renderPage);
    expect(renderPageType).toBe('undefined');

    // Assert that loading the page did not produce uncaught page errors
    expect(page._capturedPageErrors.length).toBe(0);

    // Also assert there were no console errors (but allow other console messages)
    const consoleErrors = page._capturedConsoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test the transition event ClickSeeSingleton which should move from S0_Idle to S1_SingletonDemonstrated
  test('ClickSeeSingleton: Clicking the demo button displays alert that both instances are the same', async ({ page }) => {
    // Prepare to capture the alert dialog produced by demonstrateSingleton()
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('.demo-button'),
    ]);

    // The FSM evidence expects an alert: "Both instances are the same: " + (instance1 === instance2)
    // We expect the boolean to be true
    const message = dialog.message();
    expect(message).toContain('Both instances are the same:');
    // It should indicate true
    expect(message).toMatch(/Both instances are the same:\s*true/);

    // Accept the dialog to continue
    await dialog.accept();

    // No uncaught page errors should have occurred during this interaction
    expect(page._capturedPageErrors.length).toBe(0);

    // No console errors
    const consoleErrors = page._capturedConsoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Validate that repeated interactions are consistent (click twice)
  test('S1_SingletonDemonstrated repeated: Clicking the demo button multiple times shows consistent alerts', async ({ page }) => {
    // First click - get dialog
    const [dialog1] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('.demo-button'),
    ]);
    expect(dialog1.message()).toMatch(/Both instances are the same:\s*true/);
    await dialog1.accept();

    // Second click - should still produce an alert and remain true
    const [dialog2] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('.demo-button'),
    ]);
    expect(dialog2.message()).toMatch(/Both instances are the same:\s*true/);
    await dialog2.accept();

    // Confirm no uncaught page errors or console errors
    expect(page._capturedPageErrors.length).toBe(0);
    const consoleErrors = page._capturedConsoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: invoking demonstrateSingleton programmatically should behave the same as clicking
  test('Edge case: programmatic call to demonstrateSingleton triggers alert with expected message', async ({ page }) => {
    // Call the function from the page context and observe the dialog
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.evaluate(() => {
        // Call the function defined in the global scope of the page
        // This will naturally trigger the alert without any code injection on our side.
        demonstrateSingleton();
      })
    ]);

    expect(dialog.message()).toMatch(/Both instances are the same:\s*true/);
    await dialog.accept();

    // Ensure no uncaught page errors occurred during the programmatic invocation
    expect(page._capturedPageErrors.length).toBe(0);
    const consoleErrors = page._capturedConsoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case and error scenario: direct construction via new Singleton() should throw when an instance already exists
  test('Edge case: new Singleton() throws an Error when an instance already exists', async ({ page }) => {
    // Ensure an instance exists by calling getInstance() via evaluate
    await page.evaluate(() => {
      // This uses the page's implementation to create the singleton instance
      // No return value required
      Singleton.getInstance();
    });

    // Now attempt to call new Singleton() directly and capture whether it throws
    const result = await page.evaluate(() => {
      try {
        // Attempt to new the Singleton directly; per implementation, constructor
        // should throw if Singleton.instance exists
        new Singleton();
        return { threw: false, message: null };
      } catch (e) {
        return { threw: true, message: e && e.message ? e.message : String(e) };
      }
    });

    expect(result.threw).toBe(true);
    // The implementation throws: "Use getInstance() to get the single instance of this class."
    expect(result.message).toContain('Use getInstance()');

    // No uncaught page errors should be present (the thrown error was caught and surfaced to our evaluate result)
    expect(page._capturedPageErrors.length).toBe(0);

    // Check console error count remains zero as constructor threw a caught exception (not an uncaught page error)
    const consoleErrors = page._capturedConsoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Verify that missing FSM-declared functions (like renderPage) do not cause hidden runtime errors on load
  test('FSM verification: renderPage entry action is declared in FSM but not implemented - verify missing function and absence of runtime errors', async ({ page }) => {
    // Confirm renderPage is indeed not implemented
    const renderPageExists = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(renderPageExists).toBe(false);

    // Confirm no page errors were emitted during load despite the FSM mentioning renderPage
    expect(page._capturedPageErrors.length).toBe(0);

    // Confirm console has no errors
    const consoleErrors = page._capturedConsoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // After all interactions, ensure that the page's global Singleton instance is actually the same when accessed multiple ways
  test('Final check: Singleton.getInstance() always returns same reference when compared across calls', async ({ page }) => {
    // Compare references by returning true/false from page context
    const same = await page.evaluate(() => {
      const a = Singleton.getInstance();
      const b = Singleton.getInstance();
      return a === b;
    });

    expect(same).toBe(true);

    // No uncaught errors
    expect(page._capturedPageErrors.length).toBe(0);
    const consoleErrors = page._capturedConsoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});