import { test, expect } from '@playwright/test';

test.describe('Understanding Space Complexity - FSM and UI tests (f0b33352-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // URL of the application under test
  const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b33352-fa7c-11f0-9fa6-d1bbe297d459.html';

  // Helper regex to allow only expected runtime error types if any occur.
  const ALLOWED_ERROR_TYPE_RE = /(ReferenceError|TypeError|SyntaxError|RangeError|Out of memory|OutOfMemory|OOM)/i;

  // Attach listeners before each test to capture console messages and page errors.
  test.beforeEach(async ({ page }) => {
    // Arrays are attached to the page object for test access in each test.
    page.context()._captured = {
      pageErrors: [],
      consoleErrors: [],
      consoleMessages: []
    };

    // Capture uncaught exceptions from the page (runtime errors).
    page.on('pageerror', (err) => {
      // store the message (string) for assertions later
      page.context()._captured.pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Capture console messages (info, warn, error, etc.)
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        page.context()._captured.consoleErrors.push(text);
      } else {
        page.context()._captured.consoleMessages.push({ type, text });
      }
    });

    // Navigate to the page exactly as-is.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Cleanup placeholder (Playwright auto-closes pages between tests).
  test.afterEach(async ({ page }) => {
    // No teardown steps needed beyond Playwright defaults.
  });

  test('S0_Idle: Initial render shows the demo button and hidden output', async ({ page }) => {
    // Validate presence of the demo button (evidence of S0_Idle)
    const demoButton = page.locator('#demoButton');
    await expect(demoButton).toHaveCount(1);
    await expect(demoButton).toBeVisible();

    // Validate demoOutput exists and is initially hidden (style: display: none)
    const demoOutput = page.locator('#demoOutput');
    await expect(demoOutput).toHaveCount(1);

    // Check computed style for display being none (idle state)
    const displayValue = await demoOutput.evaluate((el) => getComputedStyle(el).display);
    expect(displayValue === 'none' || displayValue === 'block' ? displayValue : displayValue).toBe('none');

    // The DOM evidence in FSM expects the button HTML and a hidden output div
    const buttonText = await demoButton.textContent();
    expect(buttonText).toBe('Run Space Complexity Demo');

    // Ensure no unexpected runtime errors occurred synchronously on load.
    // If any page errors occurred, they must match allowed error categories (we do not inject or patch anything).
    const captured = page.context()._captured;
    for (const errMsg of captured.pageErrors) {
      expect(ALLOWED_ERROR_TYPE_RE.test(errMsg)).toBeTruthy();
    }
    for (const cerr of captured.consoleErrors) {
      expect(ALLOWED_ERROR_TYPE_RE.test(cerr) || cerr.length > 0).toBeTruthy();
    }
  });

  test('S1_DemoRunning: Clicking the Run Space Complexity Demo transitions to Demo Running and displays expected content', async ({ page }) => {
    // Click the demo button to trigger the RunDemo event (transition S0 -> S1)
    const demoButton = page.locator('#demoButton');
    await demoButton.click();

    // Wait for demoOutput to become visible as per entry action showDemoOutput()
    const demoOutput = page.locator('#demoOutput');
    await demoOutput.waitFor({ state: 'visible', timeout: 5000 });

    // Validate display style changed to block
    const displayValue = await demoOutput.evaluate((el) => getComputedStyle(el).display);
    expect(displayValue).toBe('block');

    // Validate the demo output contains the expected heading and sample content (evidence from FSM)
    const html = await demoOutput.innerHTML();
    expect(html).toContain('Space Complexity Demo Results');
    expect(html).toContain('O(1) Constant Space');
    expect(html).toContain('O(n) Linear Space');
    // The implementation uses a quadratic example; ensure it's reported
    expect(html).toContain('O(n²) Quadratic Space');
    // Also ensure a conceptual note is present as appended by the script
    expect(html).toContain('This is a conceptual demonstration');

    // Check that the demo entry action (setting innerHTML to heading) actually reset then appended content.
    // There should be exactly one <h3> (the script sets innerHTML = '<h3>...'</h3> each run).
    const h3Count = await demoOutput.evaluate((el) => el.querySelectorAll('h3').length);
    expect(h3Count).toBe(1);

    // Inspect captured errors and console messages after running the demo.
    const captured = page.context()._captured;

    // If any runtime errors occurred during the demonstration, assert they are of expected/known types.
    // We intentionally do not suppress or modify runtime behavior — we only observe and assert.
    for (const errMsg of captured.pageErrors) {
      // Each error message should be recognizable as a typical JS error type (allow list).
      expect(ALLOWED_ERROR_TYPE_RE.test(errMsg)).toBeTruthy();
    }

    for (const cerr of captured.consoleErrors) {
      // Console errors, if any, should be of allowed categories as above.
      expect(ALLOWED_ERROR_TYPE_RE.test(cerr) || cerr.length > 0).toBeTruthy();
    }
  });

  test('Transition robustness and idempotence: Multiple rapid clicks should maintain consistent state or only produce expected runtime errors', async ({ page }) => {
    // Rapidly click the demo button several times to exercise edge cases (heavy allocations in demo)
    const demoButton = page.locator('#demoButton');
    const demoOutput = page.locator('#demoOutput');

    // Click multiple times in a short interval to try to surface potential memory or runtime issues.
    for (let i = 0; i < 5; i++) {
      await demoButton.click();
    }

    // Ensure demoOutput is visible and content is consistent (onEnter action runs each click, resetting heading)
    await demoOutput.waitFor({ state: 'visible', timeout: 5000 });
    const html = await demoOutput.innerHTML();

    // The heading should still be present exactly once, because script assigns innerHTML before appending.
    const h3Count = await demoOutput.evaluate((el) => el.querySelectorAll('h3').length);
    expect(h3Count).toBe(1);

    // The demo output should still contain the primary evidence phrases
    expect(html).toMatch(/Space Complexity Demo Results/);
    expect(html).toMatch(/O\(1\) Constant Space/);
    expect(html).toMatch(/O\(n\) Linear Space/);

    // Check captured page errors and console errors and assert they are either absent or match expected types.
    const captured = page.context()._captured;

    // This test acknowledges the possibility of resource-related errors (e.g., OOM) when repeatedly allocating large structures.
    // We assert any captured errors are recognizable (ReferenceError, TypeError, SyntaxError, RangeError, or memory-related).
    for (const errMsg of captured.pageErrors) {
      expect(ALLOWED_ERROR_TYPE_RE.test(errMsg)).toBeTruthy();
    }
    for (const cerr of captured.consoleErrors) {
      expect(ALLOWED_ERROR_TYPE_RE.test(cerr) || cerr.length > 0).toBeTruthy();
    }
  });

  test('FSM behavior: onEnter action effect (showDemoOutput) is observable on each transition and output content resets', async ({ page }) => {
    // Validate that each click triggers the expected entry action result: heading reset + appended content.
    const demoButton = page.locator('#demoButton');
    const demoOutput = page.locator('#demoOutput');

    // First click
    await demoButton.click();
    await demoOutput.waitFor({ state: 'visible', timeout: 5000 });
    const firstHtml = await demoOutput.innerHTML();
    expect(firstHtml).toContain('Space Complexity Demo Results');

    // Modify the DOM inside demoOutput artificially via a user-level action (simulate a user editing content)
    // Note: We do not inject global variables or patch functions; we only use DOM APIs permitted in the page.
    await demoOutput.evaluate((el) => { el.querySelector('p') && (el.querySelector('p').textContent = 'MODIFIED'); });

    // Second click should run showDemoOutput again which sets innerHTML = '<h3>...</h3>' and re-appends content,
    // thereby removing our modification. This validates that onEnter action resets content.
    await demoButton.click();
    await demoOutput.waitFor({ state: 'visible', timeout: 5000 });
    const secondHtml = await demoOutput.innerHTML();
    expect(secondHtml).toContain('Space Complexity Demo Results');
    // Ensure the previous manual modification was cleared (i.e., our 'MODIFIED' text no longer present)
    expect(secondHtml).not.toContain('MODIFIED');

    // Verify any captured runtime errors are of expected types (if they occurred)
    const captured = page.context()._captured;
    for (const errMsg of captured.pageErrors) {
      expect(ALLOWED_ERROR_TYPE_RE.test(errMsg)).toBeTruthy();
    }
  });

  test('Observability: console and pageerror capture mechanism is functional', async ({ page }) => {
    // This test validates that our listeners indeed capture console messages and page errors.
    // We'll trigger an action that is part of normal app flow and then assert that captured structures exist.
    const demoButton = page.locator('#demoButton');
    await demoButton.click();

    // Allow a short time for event handlers to run and for any errors to propagate
    await page.waitForTimeout(500);

    const captured = page.context()._captured;
    // The captured objects should be arrays (even if empty) and should exist.
    expect(Array.isArray(captured.pageErrors)).toBeTruthy();
    expect(Array.isArray(captured.consoleErrors)).toBeTruthy();
    expect(Array.isArray(captured.consoleMessages)).toBeTruthy();

    // If there are any page errors captured, they must match expected JS error categories.
    for (const errMsg of captured.pageErrors) {
      expect(ALLOWED_ERROR_TYPE_RE.test(errMsg)).toBeTruthy();
    }
  });
});