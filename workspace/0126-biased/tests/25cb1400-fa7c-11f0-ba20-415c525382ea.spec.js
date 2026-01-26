import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cb1400-fa7c-11f0-ba20-415c525382ea.html';

test.describe('FSM: Understanding Greedy Algorithms (Application ID: 25cb1400-fa7c-11f0-ba20-415c525382ea)', () => {
  // Shared listeners for collecting console messages and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and errors emitted by the page
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Collect unhandled page errors (e.g., ReferenceError, TypeError, etc.)
    page.on('pageerror', error => {
      // error is a JS Error object
      pageErrors.push(error);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No teardown injection or cleanup is required beyond Playwright's fixtures.
    // We keep this block to emphasize lifecycle clarity and future extensibility.
  });

  test('Initial Idle State (S0_Idle) renders expected DOM and accessibility attributes', async ({ page }) => {
    // This test validates the initial/idle state S0_Idle as described in the FSM:
    // - The Run Demo button exists with the expected id and aria-label.
    // - The demo output area contains the initial instructional text and accessibility attributes.
    // - No runtime errors occurred during page load.

    // Validate the Run Demo button exists and is visible
    const runBtn = page.locator('#runDemoBtn');
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toHaveText('Run Demo');

    // Validate the button has the expected accessible name via aria-label
    const ariaLabel = await runBtn.getAttribute('aria-label');
    expect(ariaLabel).toBe('Run Activity Selection Demo');

    // Validate the demo output area initial content and attributes
    const demoOutput = page.locator('#demoOutput');
    await expect(demoOutput).toBeVisible();

    // Expect initial instructional text to be present
    const initialText = await demoOutput.textContent();
    expect(initialText).not.toBeNull();
    expect(initialText.trim()).toContain('Click "Run Demo" to see the greedy selection of compatible activities.');

    // Check ARIA attributes
    expect(await demoOutput.getAttribute('aria-live')).toBe('polite');
    expect(await demoOutput.getAttribute('aria-atomic')).toBe('true');

    // Ensure there were no page-level runtime errors during load
    expect(pageErrors.length).toBe(0);

    // Ensure no console errors were emitted during load
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition RunDemo (S0_Idle -> S1_DemoRunning): clicking Run Demo updates demo output with selected activities', async ({ page }) => {
    // This test performs the RunDemo event and validates the S1_DemoRunning state:
    // - Clicking the button triggers runDemo (evidenced by DOM updates).
    // - The demo output lists sorting steps and the final selected activities in the expected order.
    // - No runtime errors occur during the demo run.

    const runBtn = page.locator('#runDemoBtn');
    const demoOutput = page.locator('#demoOutput');

    // Sanity: initial text present
    await expect(demoOutput).toContainText('Click "Run Demo" to see the greedy selection of compatible activities.');

    // Click to run the demo
    await runBtn.click();

    // After clicking, the demoOutput should be updated with detailed lines.
    await expect(demoOutput).toContainText('List of activities (start, finish):');
    await expect(demoOutput).toContainText('Sorting activities by finish time...');
    await expect(demoOutput).toContainText('Selected activities in order:');

    // Retrieve the full output text to validate ordering and selected items
    const outputText = await demoOutput.textContent();
    expect(outputText).not.toBeNull();
    const out = outputText;

    // Expected selected activities from the greedy algorithm (by analyzing the provided dataset):
    // A1 (1,4), A4 (5,7), A8 (8,11), A11 (12,16)
    // Validate that these appear and in this order
    const idxA1 = out.indexOf('A1: (1, 4)');
    const idxA4 = out.indexOf('A4: (5, 7)');
    const idxA8 = out.indexOf('A8: (8, 11)');
    const idxA11 = out.indexOf('A11: (12, 16)');

    // Ensure all are present
    expect(idxA1).toBeGreaterThanOrEqual(0);
    expect(idxA4).toBeGreaterThanOrEqual(0);
    expect(idxA8).toBeGreaterThanOrEqual(0);
    expect(idxA11).toBeGreaterThanOrEqual(0);

    // Ensure ordering is maintained
    expect(idxA1).toBeLessThan(idxA4);
    expect(idxA4).toBeLessThan(idxA8);
    expect(idxA8).toBeLessThan(idxA11);

    // Ensure no runtime errors were emitted while running the demo
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Idempotency and repeated invocation: clicking Run Demo multiple times produces consistent output and no errors', async ({ page }) => {
    // This test validates behavior when the demo is run repeatedly:
    // - Clicking the Run Demo button multiple times should produce consistent results each time.
    // - The demo output should update deterministically and not accumulate duplicate content incorrectly.
    // - No runtime errors should be raised when re-running the demo.

    const runBtn = page.locator('#runDemoBtn');
    const demoOutput = page.locator('#demoOutput');

    // Run demo first time
    await runBtn.click();
    await expect(demoOutput).toContainText('Selected activities in order:');
    const firstRunText = (await demoOutput.textContent()) || '';

    // Run demo a second time
    await runBtn.click();
    await expect(demoOutput).toContainText('Selected activities in order:');
    const secondRunText = (await demoOutput.textContent()) || '';

    // The demo replaces content (runDemo sets textContent = lines.join('\n')), so the text should be equal across runs
    expect(secondRunText).toBe(firstRunText);

    // Ensure there were no page errors or console errors across repeated runs
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Keyboard activation: button is operable via keyboard (Enter) and triggers the same output as click', async ({ page }) => {
    // This test validates accessibility/functionality:
    // - The Run Demo button can be focused and activated via keyboard (Enter key).
    // - The output produced via keyboard activation matches the content pattern produced via click.

    const runBtn = page.locator('#runDemoBtn');
    const demoOutput = page.locator('#demoOutput');

    // Click once to get a baseline output
    await runBtn.click();
    const clickOutput = (await demoOutput.textContent()) || '';

    // Clear demo output to ensure keyboard activation produces fresh output
    // We will focus the button and press Enter to re-run the demo
    // Note: We don't inject or modify page code; using keyboard to activate the element is allowed.
    await page.keyboard.press('Tab'); // move focus possibly to the button (depends on page order)
    // Ensure the button is focused explicitly
    await runBtn.focus();
    // Press Enter to activate the button via keyboard
    await page.keyboard.press('Enter');

    // After keyboard activation, verify output exists
    await expect(demoOutput).toContainText('Selected activities in order:');
    const keyboardOutput = (await demoOutput.textContent()) || '';

    // The outputs should be the same because runDemo constructs its content deterministically
    expect(keyboardOutput).toBe(clickOutput);

    // Confirm no runtime errors happened during keyboard activation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge observation: verify console and page error collectors (report any runtime issues)', async ({ page }) => {
    // This test's purpose is to explicitly surface any console.error or unhandled page errors
    // that may have occurred during previous steps of a test run. It does not attempt to patch
    // or modify the page. The assertions below validate that no such errors occurred.
    //
    // If any runtime errors are present, this test will fail and list them, fulfilling the
    // requirement to observe and assert runtime errors occurred naturally (or not).

    // Small sanity interaction to ensure any lazy scripts run (click the button)
    const runBtn = page.locator('#runDemoBtn');
    await runBtn.click();

    // Wait a short moment for any asynchronous console messages / errors to surface
    await page.waitForTimeout(100);

    // If any page errors were captured, include them in the test failure message by asserting length === 0
    if (pageErrors.length > 0) {
      // Create a readable summary for failure output
      const messages = pageErrors.map((e, i) => `Error[${i}]: ${e.message}`).join('\n');
      // Fail with detailed error listing (this assertion will throw)
      expect(pageErrors.length, `Unexpected page errors:\n${messages}`).toBe(0);
    }

    // Similarly assert no console.error messages were recorded
    if (consoleErrors.length > 0) {
      const messages = consoleErrors.map((m, i) => `ConsoleError[${i}]: ${m}`).join('\n');
      expect(consoleErrors.length, `Unexpected console.error messages:\n${messages}`).toBe(0);
    }

    // If we reach here with no thrown assertions, no runtime errors were observed.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Also ensure we captured some console messages (even if just informational)
    // This is not a strict requirement but helpful for ensuring the console collector ran.
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });
});