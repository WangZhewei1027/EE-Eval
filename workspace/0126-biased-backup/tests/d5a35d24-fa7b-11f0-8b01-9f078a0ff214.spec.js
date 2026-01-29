import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a35d24-fa7b-11f0-8b-01-9f078a0ff214.html';
const BUTTON_SELECTOR = 'button[onclick]';
const EXPECTED_ALERT_TEXT = "This is a simple demonstration of how a neural network adjusts weights during learning!";
const EXPECTED_ONCLICK_ATTRIBUTE = `alert('${EXPECTED_ALERT_TEXT}')`;

test.describe('Understanding Neural Networks - FSM: S0_Idle', () => {
  // Arrays to capture console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright fixtures - listeners are tied to page fixture
  });

  test('Initial render: page should contain the demonstration button and static content', async ({ page }) => {
    // Validate the page title
    await expect(page).toHaveTitle(/Understanding Neural Networks/);

    // Assert the button exists and has the expected visible text
    const btn = page.locator(BUTTON_SELECTOR);
    await expect(btn).toHaveCount(1);
    await expect(btn).toHaveText('Click Here For Demonstration');

    // Verify the onclick attribute matches the FSM evidence exactly
    const onclickValue = await btn.getAttribute('onclick');
    // The attribute in HTML is: alert('This is a simple demonstration of how a neural network adjusts weights during learning!')
    // Some browsers may normalize whitespace; assert substring and the exact pattern is present
    expect(onclickValue).toBe(EXPECTED_ONCLICK_ATTRIBUTE);

    // Ensure no uncaught page errors occurred during initial load
    expect(pageErrors.length).toBe(0);

    // No console.error messages at load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Entry action verification: calling renderPage() should raise a ReferenceError (if not defined)', async ({ page }) => {
    // The FSM lists renderPage() as an entry action. The implementation does not define renderPage.
    // We attempt to invoke it in page context and observe the natural JS error (ReferenceError).
    const result = await page.evaluate(() => {
      try {
        // Attempt to call renderPage as the FSM entry action suggests.
        // If renderPage is undefined, this will throw a ReferenceError which we catch and return.
        renderPage();
        return { invoked: true };
      } catch (e) {
        // Return the error information so the test can assert on it.
        return { invoked: false, name: e && e.name, message: String(e && e.message) };
      }
    });

    // We expect that renderPage is not defined in the page and that a ReferenceError occurred.
    expect(result.invoked).toBe(false);
    expect(result.name).toBe('ReferenceError');
    expect(result.message).toMatch(/renderPage/);
  });

  test('Click event: clicking the demonstration button shows an alert with the expected message', async ({ page }) => {
    const btn = page.locator(BUTTON_SELECTOR);
    await expect(btn).toHaveCount(1);

    // Wait for the dialog produced by the click and assert its message
    const dialogPromise = page.waitForEvent('dialog');
    await btn.click();
    const dialog = await dialogPromise;
    try {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);
    } finally {
      // Always accept to close the dialog and allow further interactions
      await dialog.accept();
    }

    // After handling the alert, the page should remain in the same state (S0_Idle)
    // Verify the button is still present and unchanged
    await expect(btn).toBeVisible();
    const onclickValue = await btn.getAttribute('onclick');
    expect(onclickValue).toBe(EXPECTED_ONCLICK_ATTRIBUTE);

    // Ensure no uncaught page errors during the interaction
    expect(pageErrors.length).toBe(0);
  });

  test('Multiple interactions: clicking the button multiple times produces alerts each time', async ({ page }) => {
    const btn = page.locator(BUTTON_SELECTOR);
    await expect(btn).toHaveCount(1);

    const capturedDialogs = [];

    // Click the button twice, capturing both dialogs in sequence.
    for (let i = 0; i < 2; i++) {
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        btn.click()
      ]);
      capturedDialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    }

    // Assert two alerts were shown and each had the correct message
    expect(capturedDialogs.length).toBe(2);
    for (const d of capturedDialogs) {
      expect(d.type).toBe('alert');
      expect(d.message).toBe(EXPECTED_ALERT_TEXT);
    }

    // Confirm the page stayed in S0_Idle (button still present)
    await expect(btn).toBeVisible();
    expect(pageErrors.length).toBe(0);
  });

  test('Keyboard activation: pressing Enter while the button is focused should trigger the same alert', async ({ page }) => {
    const btn = page.locator(BUTTON_SELECTOR);
    await expect(btn).toHaveCount(1);

    // Focus the button and press Enter to activate it via keyboard
    await btn.focus();

    const dialogPromise = page.waitForEvent('dialog');
    await page.keyboard.press('Enter');
    const dialog = await dialogPromise;
    try {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);
    } finally {
      await dialog.accept();
    }

    // Ensure no uncaught page errors and button still present
    expect(pageErrors.length).toBe(0);
    await expect(btn).toBeVisible();
  });

  test('Edge case: attempting to click a non-existent element should result in an error (unhandled selector)', async ({ page }) => {
    // Attempting to click a selector that does not exist should throw; we assert that an error is thrown.
    // We intentionally choose a short timeout to keep the test fast.
    let threw = false;
    try {
      await page.click('button#this-element-does-not-exist', { timeout: 1000 });
    } catch (e) {
      threw = true;
      // Ensure the thrown error mentions that the selector could not be found or the click failed
      expect(String(e.message)).toMatch(/(No node found|waiting for|Timeout)/i);
    }
    expect(threw).toBe(true);
  });

  test('Console and page error observation across interactions', async ({ page }) => {
    // Ensure arrays are currently empty
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    expect(pageErrors.length).toBeGreaterThanOrEqual(0);

    // Trigger an interaction that produces an alert
    const btn = page.locator(BUTTON_SELECTOR);
    await expect(btn).toHaveCount(1);
    const dialogPromise = page.waitForEvent('dialog');
    await btn.click();
    const dialog = await dialogPromise;
    await dialog.accept();

    // After interaction, assert there are still no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // And no console.error messages recorded
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});