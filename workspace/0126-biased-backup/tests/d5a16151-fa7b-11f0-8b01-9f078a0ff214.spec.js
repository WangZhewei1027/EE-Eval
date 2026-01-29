import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a16151-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('FSM: Dijkstra\'s Algorithm Explained (Application ID: d5a16151-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Shared state trackers for console messages and page errors
  let consoleMessages;
  let pageErrors;

  // Setup before each test: reset trackers and navigate to the page while attaching observers
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console events for inspection (info, warning, error, debug, etc.)
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', error => {
      // error is an Error object with message and stack
      pageErrors.push(error);
    });

    // Navigate to the application page under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({ page }) => {
    // Ensure no unexpected leftover dialogs; attempt to close if present (best-effort)
    page.removeAllListeners('dialog');
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial state S0_Idle: page renders static content and button exists', async ({ page }) => {
    // This test validates the initial (Idle) state:
    // - The page content (heading and explanatory text) is present
    // - The "Show Demonstration" button is present with the expected attributes
    // - No uncaught page errors occurred during load
    const title = await page.locator('h1').innerText();
    expect(title).toContain("Dijkstra's Algorithm");

    const paragraph = await page.locator('p').first().innerText();
    expect(paragraph.length).toBeGreaterThan(10); // basic content check

    // Find the demonstration button by selector used in the FSM/component definition
    const demoButton = page.locator('button[onclick*="Demonstration of Dijkstra"]');
    await expect(demoButton).toHaveCount(1);

    // Validate the visible text on the button
    await expect(demoButton).toHaveText('Show Demonstration');

    // Check the onclick attribute contains the expected alert invocation text
    const onclickAttr = await demoButton.getAttribute('onclick');
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain("alert(");
    expect(onclickAttr).toContain("Demonstration of Dijkstra");
    expect(onclickAttr).toContain("will be shown here soon");

    // Ensure there were no uncaught errors on load (edge-case: if errors do exist, they will be asserted here)
    expect(pageErrors.length, `Expected no uncaught page errors on load, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // Ensure console did not log any 'error' level messages on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, `Expected no console errors/warnings on load, got: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test('Transition ShowDemonstration: clicking button triggers alert and enters S1_DemonstrationShown', async ({ page }) => {
    // This test validates the transition from S0_Idle to S1_DemonstrationShown:
    // - Clicking the "Show Demonstration" button should open an alert with the expected message
    // - The dialog must be handled by the test (accepted)
    // - No uncaught page errors should occur as a result of the interaction
    const demoButton = page.locator('button', { hasText: 'Show Demonstration' });
    await expect(demoButton).toHaveCount(1);

    // Wait for the alert dialog to appear and capture it
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      demoButton.click(), // user triggers the Show Demonstration event
    ]);

    // Verify the alert message matches the FSM expected observable
    const expectedAlertText = "Demonstration of Dijkstra's algorithm will be shown here soon!";
    expect(dialog.message()).toBe(expectedAlertText);

    // Accept the alert to allow the page to proceed (if anything further were to happen)
    await dialog.accept();

    // After accepting, ensure there are no new page errors
    expect(pageErrors.length, `Expected no page errors after clicking button, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // The UI does not change structurally in this simple implementation, but we assert the button still exists
    await expect(demoButton).toHaveCount(1);
  });

  test('onEnter action renderPage not defined: calling renderPage() should throw (edge-case)', async ({ page }) => {
    // FSM mentions an entry_action renderPage() for S0_Idle.
    // The HTML/JS does not define renderPage(), so attempting to call it should throw.
    // We call it from the page context using eval to provoke a ReferenceError (or related error) naturally.
    // This verifies the test harness observes expected errors when onEnter actions are missing.
    await expect(page.evaluate(() => {
      // Use eval to ensure the identifier is looked up in function/global scope and causes a ReferenceError if absent.
      return eval('renderPage()');
    })).rejects.toThrow(/renderPage|is not defined|not a function/);
  });

  test('Edge case: multiple rapid clicks queue multiple alerts and are handled sequentially', async ({ page }) => {
    // This test simulates rapid user interaction by clicking the button multiple times in quick succession.
    // We expect multiple alerts to be queued; the test will accept each alert sequentially.
    const demoButton = page.locator('button', { hasText: 'Show Demonstration' });
    await expect(demoButton).toHaveCount(1);

    // Click twice quickly; browsers typically queue alerts while the previous one is open.
    // We'll handle the dialogs sequentially.
    for (let i = 0; i < 2; i++) {
      const dialogPromise = page.waitForEvent('dialog');
      await demoButton.click();
      const dialog = await dialogPromise;
      expect(dialog).toBeTruthy();
      expect(dialog.message()).toContain("Demonstration of Dijkstra");
      await dialog.accept();
    }

    // Ensure no page errors came from multiple interactions
    expect(pageErrors.length, `Expected no page errors after multiple clicks, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // Verify console didn't capture any error-level messages as a result of the rapid interactions
    const consoleErrorsAfter = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrorsAfter.length).toBe(0);
  });

  test('Observability: console and pageerror listeners capture any runtime exceptions (sanity check)', async ({ page }) => {
    // This test ensures the test harness correctly captures console and error events.
    // We deliberately verify that the collectors (consoleMessages and pageErrors) are working by generating a benign console.log
    // from the page and ensuring it was captured. We will not modify page internals, but we can cause the page to log via evaluate.
    await page.evaluate(() => console.log('PLAYWRIGHT_TEST_LOG: page logging for observability check'));

    // Small delay to ensure console handler receives the message
    await page.waitForTimeout(50);

    const found = consoleMessages.some(m => m.text && m.text.includes('PLAYWRIGHT_TEST_LOG'));
    expect(found).toBe(true);

    // Confirm still no uncaught errors
    expect(pageErrors.length).toBe(0);
  });
});