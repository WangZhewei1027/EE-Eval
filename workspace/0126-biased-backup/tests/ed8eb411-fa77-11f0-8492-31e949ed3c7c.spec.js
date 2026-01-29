import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8eb411-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Mutex Visualization - FSM Validation (ed8eb411-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Shared collectors for console and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors generated during page load and interaction
    page.context()._consoleMessages = [];
    page.context()._consoleErrors = [];
    page.context()._pageErrors = [];

    page.on('console', (msg) => {
      // Record all console messages on the context to make them available to assertions
      const entry = { type: msg.type(), text: msg.text() };
      page.context()._consoleMessages.push(entry);
      if (msg.type() === 'error') {
        page.context()._consoleErrors.push(entry);
      }
    });

    page.on('pageerror', (err) => {
      // Record page-level runtime exceptions
      page.context()._pageErrors.push(err);
    });

    // Navigate to the page under test (do not modify or patch the page)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Basic smoke test: initial rendering corresponds to S0_Idle (renderPage() entry action)
  test('renders initial page and key elements (S0_Idle entry state)', async ({ page }) => {
    // Validate the main container exists
    const container = page.locator('.container');
    await expect(container).toHaveCount(1);

    // Validate header text and description presence
    const heading = page.locator('.text >> h1');
    await expect(heading).toHaveText('Welcome to the Mutex Visualization');

    const paragraph = page.locator('.text >> p');
    await expect(paragraph).toHaveText('Observe the beauty of synchronization.');

    // Validate the rotating mutex circle exists and has expected class
    const circle = page.locator('.mutex-circle');
    await expect(circle).toHaveCount(1);

    // Validate the primary button exists, is visible, enabled, and has correct text
    const button = page.locator('.button');
    await expect(button).toHaveCount(1);
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(button).toHaveText('What is Mutex?');

    // Verify evidence of inline onclick handler exists (FSM evidence)
    const onclickAttr = await page.locator('.button').getAttribute('onclick');
    // The FSM expects: onclick="alert('This is a Mutex!')"
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain("alert('This is a Mutex!')");

    // Ensure there were no runtime page errors during initial render
    expect(page.context()._pageErrors.length).toBe(0);
  });

  // Test the main event described in the FSM: clicking the button triggers an alert dialog
  test('clicking "What is Mutex?" triggers an alert with expected text (ButtonClick transition)', async ({ page }) => {
    // Prepare to capture the next dialog (alert)
    const dialogPromise = page.waitForEvent('dialog');

    // Perform the user interaction described by the FSM
    await page.click('.button');

    // Verify the dialog appears with exact expected message
    const dialog = await dialogPromise;
    try {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('This is a Mutex!');
    } finally {
      // Always accept to close the alert so subsequent tests/actions are not blocked
      await dialog.accept();
    }

    // Verify no unexpected page errors were recorded as a result of this interaction
    expect(page.context()._pageErrors.length).toBe(0);

    // Also assert there were no console.error messages produced by this interaction
    expect(page.context()._consoleErrors.length).toBe(0);
  });

  // Edge case: clicking the button multiple times should consistently produce alerts
  test('multiple rapid clicks produce an alert every time (robustness of transition)', async ({ page }) => {
    const clickCount = 3;
    const messages = [];
    for (let i = 0; i < clickCount; i++) {
      // Wait for each dialog separately to ensure deterministic behavior
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('.button');
      const dialog = await dialogPromise;
      messages.push({ type: dialog.type(), text: dialog.message() });
      await dialog.accept();
    }

    // All interactions should have produced identical alert messages and type 'alert'
    expect(messages.length).toBe(clickCount);
    for (const m of messages) {
      expect(m.type).toBe('alert');
      expect(m.text).toBe('This is a Mutex!');
    }

    // Confirm no unexpected runtime errors appeared during repeated interactions
    expect(page.context()._pageErrors.length).toBe(0);
  });

  // Verify visual/CSS features described in the HTML (animation presence)
  test('visual elements and animation exist (animation and styling assertions)', async ({ page }) => {
    // Check that the .mutex-circle has a rotate animation defined via computed style
    const animationName = await page.$eval('.mutex-circle', (el) => {
      const style = getComputedStyle(el);
      // animationName may be a comma-separated list if multiple animations are present
      return style.animationName || style.webkitAnimationName || '';
    });

    // The CSS defines @keyframes rotate, and .mutex-circle uses animation: rotate ...
    expect(animationName).toContain('rotate');

    // Validate that the pseudo-element center dot likely exists by checking ::before computed size via bounding box check
    // We cannot directly access ::before, but we can ensure the circle has expected dimensions/styles
    const dimensions = await page.$eval('.mutex-circle', (el) => {
      const rect = el.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    });

    expect(dimensions.width).toBeGreaterThan(0);
    expect(dimensions.height).toBeGreaterThan(0);
    // The CSS sets 300px for both width and height; allow some tolerance for scaling differences
    expect(dimensions.width).toBeGreaterThanOrEqual(200);
    expect(dimensions.height).toBeGreaterThanOrEqual(200);

    // Ensure no page errors were generated during style inspection
    expect(page.context()._pageErrors.length).toBe(0);
  });

  // Validate evidence and FSM metadata: inline handler presence and that state remains S0_Idle after event
  test('FSM evidence: onclick attribute and idempotent state (S0_Idle loops to itself)', async ({ page }) => {
    // Confirm the button still exists after a click (state should remain Idle)
    const btn = page.locator('.button');
    await expect(btn).toBeVisible();

    // Click once to trigger transition
    const dialog1 = await page.waitForEvent('dialog');
    await btn.click();
    const d1 = await dialog1;
    await d1.accept();

    // After transition, page should still have the same elements (Idle -> Idle)
    await expect(page.locator('.button')).toBeVisible();
    await expect(page.locator('.mutex-circle')).toBeVisible();
    await expect(page.locator('.text >> h1')).toHaveText('Welcome to the Mutex Visualization');

    // Onclick attribute remains intact as evidence of transition implementation
    const onclickAttr = await btn.getAttribute('onclick');
    expect(onclickAttr).toContain("alert('This is a Mutex!')");

    // No runtime errors should have been produced as part of these transitions
    expect(page.context()._pageErrors.length).toBe(0);
  });

  // Edge-case / error scenario: interacting with a non-existent selector
  test('interacting with a non-existent selector behaves predictably (error scenario)', async ({ page }) => {
    // Ensure the selector truly does not exist
    const nonExistent = page.locator('.this-selector-does-not-exist');
    await expect(nonExistent).toHaveCount(0);

    // Attempting to click a non-existent selector should result in Playwright throwing a TimeoutError.
    // We assert that the action is rejected rather than an unpredictable page runtime error.
    // Note: We do not modify the page; we only assert behavior of the test harness interaction.
    await expect(page.click('.this-selector-does-not-exist', { timeout: 500 })).rejects.toThrow();

    // This should not have produced page-level runtime exceptions (pageerror), only a test-level interaction failure
    expect(page.context()._pageErrors.length).toBe(0);
  });

  // Inspect collected console messages and assert there are no console.error entries (observability)
  test('no unexpected console.error or page runtime exceptions on load and interactions', async ({ page }) => {
    // Perform a benign interaction to potentially surface console messages
    // Click the button once and accept the alert if it appears
    const dialogPromise = page.waitForEvent('dialog').catch(() => null);
    await page.click('.button');
    const dialog = await dialogPromise;
    if (dialog) await dialog.accept();

    // Collect console error messages captured in the context
    const consoleErrors = page.context()._consoleErrors || [];
    const pageErrors = page.context()._pageErrors || [];

    // Assert that there were no runtime page errors
    expect(pageErrors.length).toBe(0);

    // Assert there were no console.error messages (if any appear, fail the test)
    expect(consoleErrors.length).toBe(0);

    // Optionally assert overall console messages are benign (string content exists)
    const consoleMessages = page.context()._consoleMessages || [];
    // There can be other console messages (e.g., warnings, logs). We assert they exist (>=0) and contain no 'error' types.
    for (const msg of consoleMessages) {
      expect(msg.type).not.toBe('error');
    }
  });
});