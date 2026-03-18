import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a370ffd0-ffc4-11f0-821c-7d25bc609266.html';

test.describe('FSM: Understanding Linear Search - a370ffd0-ffc4-11f0-821c-7d25bc609266', () => {
  // Helper to attach listeners for console errors and page errors and return collectors
  const attachErrorCollectors = (page) => {
    const consoleErrors = [];
    const consoleWarnings = [];
    const consoleLogs = [];
    const pageErrors = [];

    const consoleHandler = (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') consoleErrors.push(text);
      else if (type === 'warning') consoleWarnings.push(text);
      else consoleLogs.push({ type, text });
    };
    const pageErrorHandler = (err) => {
      // err is an Error object
      pageErrors.push(err && err.message ? err.message : String(err));
    };

    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);

    return {
      consoleErrors,
      consoleWarnings,
      consoleLogs,
      pageErrors,
      detach: () => {
        page.off('console', consoleHandler);
        page.off('pageerror', pageErrorHandler);
      }
    };
  };

  test.beforeEach(async ({ page }) => {
    // No global setup required beyond navigation which each test does individually.
  });

  test.afterEach(async ({ page }) => {
    // Ensure clean state after each test
    // Nothing to teardown explicitly; page fixture will handle closing.
  });

  test('S0_Idle: Initial render shows the Run Linear Search Demo button and empty demoOutput', async ({ page }) => {
    // Attach collectors to observe console and runtime errors during page load/render
    const collectors = attachErrorCollectors(page);

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Verify the page title (sanity check that the right page loaded)
    await expect(page).toHaveTitle(/Understanding Linear Search/i);

    // Check presence of the Run Demo button (evidence for S0_Idle state)
    const demoBtn = page.locator('#demoBtn');
    await expect(demoBtn).toBeVisible();
    await expect(demoBtn).toHaveText('Run Linear Search Demo');

    // Check demoOutput exists and is initially empty (Idle state's renderPage())
    const demoOutput = page.locator('#demoOutput');
    await expect(demoOutput).toBeVisible();
    await expect(demoOutput).toHaveClass(/demo-output/);
    await expect(demoOutput).toHaveAttribute('aria-live', 'polite');

    // The initial content should be empty (no demo run yet)
    const initialText = await demoOutput.textContent();
    // Could be null or empty string; assert it's falsy/empty
    expect(initialText === null || initialText.trim() === '').toBeTruthy();

    // Validate that no console or page errors occurred during initial render
    // We intentionally observe console/page errors rather than patching anything.
    collectors.detach();
    expect(collectors.consoleErrors.length).toBe(0);
    expect(collectors.pageErrors.length).toBe(0);
  });

  test('Transition RunDemo: Clicking the button runs demo (S0_Idle -> S1_DemoRunning) and updates demoOutput', async ({ page }) => {
    // Collect console errors and page errors while interacting
    const collectors = attachErrorCollectors(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    const demoBtn = page.locator('#demoBtn');
    const demoOutput = page.locator('#demoOutput');

    // Sanity: ensure initial state has no demo output
    await expect(demoOutput).toHaveText('', { timeout: 2000 });

    // Click the Run Demo button (this should trigger runDemo() per FSM transition)
    await demoBtn.click();

    // After clicking, demoOutput.textContent should be updated with the step-by-step output
    // Wait for expected content to appear
    await expect(demoOutput).toContainText('Array: [5, 3, 8, 4, 2, 7, 1]');
    await expect(demoOutput).toContainText('Target to find: 7');
    await expect(demoOutput).toContainText('Starting linear search...');
    await expect(demoOutput).toContainText('Check index 0: value is 5');
    await expect(demoOutput).toContainText('Check index 1: value is 3');
    await expect(demoOutput).toContainText('Check index 2: value is 8');
    await expect(demoOutput).toContainText('Check index 3: value is 4');
    await expect(demoOutput).toContainText('Check index 4: value is 2');
    await expect(demoOutput).toContainText('Check index 5: value is 7');
    await expect(demoOutput).toContainText('Element 7 found at index 5!');

    // The demo should stop after finding the element (no further "Check index 6" line)
    const outputText = await demoOutput.textContent();
    expect(outputText).not.toContain('Check index 6:');

    // Validate that no unexpected console or runtime errors occurred during the demo run
    collectors.detach();
    expect(collectors.consoleErrors.length).toBe(0);
    expect(collectors.pageErrors.length).toBe(0);
  });

  test('Idempotence & multiple clicks: Subsequent clicks re-run demo and produce consistent output (no exceptions)', async ({ page }) => {
    const collectors = attachErrorCollectors(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    const demoBtn = page.locator('#demoBtn');
    const demoOutput = page.locator('#demoOutput');

    // First run
    await demoBtn.click();
    await expect(demoOutput).toContainText('Element 7 found at index 5!');
    const firstRun = (await demoOutput.textContent()) || '';

    // Second run - should overwrite output with same content
    await demoBtn.click();
    await expect(demoOutput).toContainText('Element 7 found at index 5!');
    const secondRun = (await demoOutput.textContent()) || '';

    // The outputs should be identical since runDemo builds the same output each time
    expect(secondRun.trim()).toBe(firstRun.trim());

    // Rapid multiple clicks should not throw errors; ensure output remains valid after many clicks
    for (let i = 0; i < 8; i++) {
      await demoBtn.click();
    }
    await expect(demoOutput).toContainText('Element 7 found at index 5!');
    const afterRapidClicks = (await demoOutput.textContent()) || '';
    expect(afterRapidClicks.trim()).toBe(firstRun.trim());

    collectors.detach();
    // There should be no runtime page errors or console errors as a result of repeated interactions
    expect(collectors.consoleErrors.length).toBe(0);
    expect(collectors.pageErrors.length).toBe(0);
  });

  test('Edge case observation: Ensure no ReferenceError / SyntaxError / TypeError occurred during full interaction', async ({ page }) => {
    // This test is explicitly focused on observing and asserting JS runtime errors (if any)
    const collectors = attachErrorCollectors(page);

    // Navigate and perform a click to exercise the main logic
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Run the demo once
    await page.locator('#demoBtn').click();

    // After running, check collected errors
    collectors.detach();

    // We assert that no runtime errors occurred (ReferenceError/SyntaxError/TypeError would surface as page errors or console.error)
    // If the application had such errors, these arrays would be non-empty and the assertions below would fail (as required: we observe them naturally).
    expect(collectors.pageErrors.length).toBe(0);
    expect(collectors.consoleErrors.length).toBe(0);

    // For additional safety, ensure the output contains evidence of the algorithm completing successfully
    const outputText = await page.locator('#demoOutput').textContent();
    expect(outputText).toMatch(/Element\s+7\s+found\s+at\s+index\s+5!/);
  });

  test('DOM and accessibility checks: button accessible and demoOutput uses aria-live polite', async ({ page }) => {
    // Verify structural aspects that are part of the FSM evidence/components
    await page.goto(APP_URL, { waitUntil: 'load' });

    const demoBtn = page.locator('#demoBtn');
    const demoOutput = page.locator('#demoOutput');

    // The button should be focusable and actionable via keyboard as part of good UX
    await demoBtn.focus();
    await expect(demoBtn).toBeFocused();

    // Press Enter to activate the demo (simulate keyboard activation)
    await page.keyboard.press('Enter');

    // Verify demoOutput updated as a result of keyboard activation (runDemo should be bound to click, and Enter when focused should activate)
    await expect(demoOutput).toContainText('Array: [5, 3, 8, 4, 2, 7, 1]');
    await expect(demoOutput).toContainText('Element 7 found at index 5!');

    // Ensure aria-live attribute is set to polite to announce changes to assistive tech
    await expect(demoOutput).toHaveAttribute('aria-live', 'polite');
  });
});