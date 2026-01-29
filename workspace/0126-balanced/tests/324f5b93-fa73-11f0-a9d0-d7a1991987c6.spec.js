import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f5b93-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Version Control Demonstration - FSM tests (Application ID: 324f5b93-fa73-11f0-a9d0-d7a1991987c6)', () => {
  // Holders for runtime observations
  let pageErrors = [];
  let consoleMessages = [];
  let consoleErrors = [];

  // Common setup for each test: navigate to the page and wire listeners to capture console/page errors.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];
    consoleErrors = [];

    // Capture unhandled page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture all console messages and categorize errors
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Load the application exactly as provided
    await page.goto(APP_URL);

    // Wait for the core UI elements to be visible
    await expect(page.locator('#current-version')).toBeVisible();
    await expect(page.locator('#increment-version')).toBeVisible();
    await expect(page.locator('#reset-version')).toBeVisible();
  });

  test.afterEach(async () => {
    // Basic sanity: ensure we didn't observe unexpected runtime errors during tests.
    // Tests below also assert this explicitly where relevant.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Initial state S0_Version_1.0.0: page shows version 1.0.0 on load', async ({ page }) => {
    // Validate the initial visual evidence as per FSM state S0
    const versionText = await page.locator('#current-version').textContent();
    expect(versionText).toBe('1.0.0');

    // Also assert the global variable "version" on window reflects the same value (non-invasive read)
    const windowVersion = await page.evaluate(() => {
      // Read-only access; do not modify globals
      // If "version" is not defined, this will return undefined (we will assert)
      // This is safe and respects the "do not inject or patch" rule.
      return typeof window.version !== 'undefined' ? window.version : null;
    });
    // The implementation defines a global "version" variable initialized to "1.0.0"
    expect(windowVersion).toBe('1.0.0');

    // Ensure no runtime errors or console errors were emitted on initial load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: IncrementVersion from S0 -> S1 yields version 1.0.1', async ({ page }) => {
    // This validates the FSM transition from S0_Version_1.0.0 to S1_Version_1.0.1
    // Click the increment button once
    await page.click('#increment-version');

    // The visual evidence should update to 1.0.1
    await expect(page.locator('#current-version')).toHaveText('1.0.1');

    // Validate the in-page variable matches the displayed version
    const windowVersion1 = await page.evaluate(() => window.version);
    expect(windowVersion).toBe('1.0.1');

    // Confirm no runtime console errors were produced by the handler
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: IncrementVersion from S1 -> S1 increments patch to 1.0.2 (idempotent increment behavior)', async ({ page }) => {
    // Start from initial state, increment twice to reach 1.0.2
    await page.click('#increment-version'); // 1.0.1
    await page.click('#increment-version'); // 1.0.2

    // Visual check
    await expect(page.locator('#current-version')).toHaveText('1.0.2');

    // Validate numeric increment behavior by converting patch to number via page script
    const patchNumber = await page.evaluate(() => {
      const parts = window.version.split('.');
      return parseInt(parts[2], 10);
    });
    expect(patchNumber).toBe(2);

    // Ensure no runtime errors occurred during repeated increments
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: ResetVersion from S1 resets to S2 (1.0.0) and transitions back to S0 as expected', async ({ page }) => {
    // Increment once to ensure we're in S1
    await page.click('#increment-version'); // now 1.0.1
    await expect(page.locator('#current-version')).toHaveText('1.0.1');

    // Now click reset to transition to S2 (Version Reset)
    await page.click('#reset-version');

    // The expected observable: current version reset to 1.0.0
    await expect(page.locator('#current-version')).toHaveText('1.0.0');

    // And global variable should reflect reset
    const windowVersion2 = await page.evaluate(() => window.version);
    expect(windowVersion).toBe('1.0.0');

    // Verify that subsequent ResetVersion from the reset state (S2) retains S0's value (idempotency)
    await page.click('#reset-version');
    await expect(page.locator('#current-version')).toHaveText('1.0.0');

    // Check no runtime exceptions were raised
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Reset when already at 1.0.0 remains stable (no-op) and emits no errors', async ({ page }) => {
    // Ensure initial state is 1.0.0
    await expect(page.locator('#current-version')).toHaveText('1.0.0');

    // Click reset repeatedly
    await page.click('#reset-version');
    await page.click('#reset-version');
    await page.click('#reset-version');

    // Version stays the same
    await expect(page.locator('#current-version')).toHaveText('1.0.0');

    // Confirm stability of the global variable
    const windowVersion3 = await page.evaluate(() => window.version);
    expect(windowVersion).toBe('1.0.0');

    // No runtime errors should have occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Rapid multiple increments behave as sequential patch increments without errors', async ({ page }) => {
    // Rapidly click increment 5 times and assert the final patch equals 5
    const clicks = 5;
    for (let i = 0; i < clicks; i++) {
      // use a tiny delay between clicks to more closely emulate user rapid clicks, but avoid overwhelming
      await page.click('#increment-version');
    }

    // Expect version to be 1.0.5 (initial patch was 0)
    await expect(page.locator('#current-version')).toHaveText('1.0.5');

    // Validate programmatic reading of version matches expectation
    const windowVersion4 = await page.evaluate(() => window.version);
    expect(windowVersion).toBe('1.0.5');

    // Ensure no runtime errors were produced during rapid interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Very large patch increments continue to behave numerically', async ({ page }) => {
    // Click increment 12 times to reach 1.0.12 to ensure patch grows beyond single digit
    const clicks1 = 12;
    for (let i = 0; i < clicks; i++) {
      await page.click('#increment-version');
    }
    await expect(page.locator('#current-version')).toHaveText('1.0.12');

    // Ensure no runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Validate visible UI components and semantics (components evidence from FSM)', async ({ page }) => {
    // Confirm the presence and attributes of the expected components per FSM extraction_summary
    const incrementButton = page.locator('#increment-version');
    const resetButton = page.locator('#reset-version');
    const versionSpan = page.locator('#current-version');

    await expect(incrementButton).toBeVisible();
    await expect(resetButton).toBeVisible();
    await expect(versionSpan).toBeVisible();

    await expect(incrementButton).toHaveText(/Increment Version/i);
    await expect(resetButton).toHaveText(/Reset Version/i);
    await expect(versionSpan).toHaveText('1.0.0');

    // No console errors expected simply for presence checks
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observe console output stream for any unexpected errors or logs during typical operations', async ({ page }) => {
    // Perform typical operations
    await page.click('#increment-version'); // 1.0.1
    await page.click('#increment-version'); // 1.0.2
    await page.click('#reset-version');     // 1.0.0

    // Collect the captured console messages for inspection
    // There are no explicit console.log calls in implementation, so we expect few non-error console messages.
    // We assert there are NO console error messages.
    expect(consoleErrors.length).toBe(0);

    // If desired, tests could assert that console messages do not include stack traces or error-like tokens.
    // This is a conservative check to ensure runtime remained healthy:
    const errorLike = consoleMessages.some((m) => /error|exception|trace/i.test(m.text));
    expect(errorLike).toBe(false);

    // Final state check
    await expect(page.locator('#current-version')).toHaveText('1.0.0');

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Negative test: ensure no accidental modification of DOM besides expected #current-version updates', async ({ page }) => {
    // Save snapshots of important DOM parts before actions
    const headerBefore = await page.locator('h1').textContent();
    const incrementLabelBefore = await page.locator('#increment-version').textContent();
    const resetLabelBefore = await page.locator('#reset-version').textContent();

    // Perform actions that should only affect #current-version
    await page.click('#increment-version');
    await page.click('#reset-version');

    // Re-check those DOM parts remain unchanged
    const headerAfter = await page.locator('h1').textContent();
    const incrementLabelAfter = await page.locator('#increment-version').textContent();
    const resetLabelAfter = await page.locator('#reset-version').textContent();

    expect(headerAfter).toBe(headerBefore);
    expect(incrementLabelAfter).toBe(incrementLabelBefore);
    expect(resetLabelAfter).toBe(resetLabelBefore);

    // And the version visual must be 1.0.0 (reset)
    await expect(page.locator('#current-version')).toHaveText('1.0.0');

    // Ensure no runtime errors occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});