import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79d15d1-d361-11f0-8438-11a56595a476.html';

test.describe('Binary Search Visualization - FSM states and transitions', () => {
  // Capture console errors and page errors for each test to validate runtime issues
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console 'error' messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture page error events (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Navigate to the application under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Assert that no console or page errors of critical types occurred during the test
    // We consider ReferenceError, SyntaxError, and TypeError as critical runtime issues
    const criticalPatterns = [/ReferenceError/, /SyntaxError/, /TypeError/];

    const foundCriticalConsole = consoleErrors.filter(text =>
      criticalPatterns.some(rx => rx.test(text))
    );
    const foundCriticalPage = pageErrors.filter(text =>
      criticalPatterns.some(rx => rx.test(text))
    );

    // Provide helpful expectations: tests should fail if any critical runtime errors were emitted
    expect(foundCriticalConsole, `Unexpected console errors: ${JSON.stringify(foundCriticalConsole)}`).toEqual([]);
    expect(foundCriticalPage, `Unexpected page errors: ${JSON.stringify(foundCriticalPage)}`).toEqual([]);
  });

  test('Initial state S0_Idle: array elements are created and controls are in initial state', async ({ page }) => {
    // Verify createArrayElements() ran on load by inspecting #array children
    const arrayLocator = page.locator('#array');
    await expect(arrayLocator).toBeVisible();

    // There should be 15 elements as defined in the array
    const elements = arrayLocator.locator('.element');
    await expect(elements).toHaveCount(15);

    // Check that the first and last element values are correct
    await expect(elements.nth(0)).toHaveText('3');
    await expect(elements.nth(14)).toHaveText('79');

    // Ensure the log is empty on load
    const log = page.locator('#log');
    await expect(log).toBeVisible();
    await expect(log).toHaveText('');

    // Ensure start button is enabled, reset button is disabled, input enabled
    const startBtn = page.locator('#startBtn');
    const resetBtn = page.locator('#resetBtn');
    const targetInput = page.locator('#targetInput');

    await expect(startBtn).toBeEnabled();
    await expect(resetBtn).toBeDisabled();
    await expect(targetInput).toBeEnabled();
  });

  test('Transition S0_Idle -> S1_Searching: starting search disables controls and shows progress, then finds target', async ({ page }) => {
    // This test validates the StartSearch event and the Searching state behavior.
    const startBtn = page.locator('#startBtn');
    const resetBtn = page.locator('#resetBtn');
    const targetInput = page.locator('#targetInput');
    const log = page.locator('#log');
    const arrayElements = page.locator('#array .element');

    // Use the default target 23 which exists in the array (index 4)
    // Click Start Search
    await startBtn.click();

    // Immediately after clicking, controls should be disabled during the search
    await expect(startBtn).toBeDisabled();
    await expect(resetBtn).toBeDisabled();
    await expect(targetInput).toBeDisabled();

    // The log should begin updating with the first "Checking middle index" message.
    await page.waitForFunction(() => {
      const logEl = document.getElementById('log');
      return logEl && /Checking middle index \d+/.test(logEl.textContent || '');
    }, {}, { timeout: 5000 });

    // Confirm that the first mid that is checked is present in the log (should eventually contain index 7 first)
    const logTextAfterStart = await log.textContent();
    expect(/Checking middle index \d+/.test(logTextAfterStart)).toBeTruthy();

    // Wait for the full search to complete by waiting until "Found target 23 at index 4." appears in the log
    await page.waitForFunction(() => {
      const logEl = document.getElementById('log');
      return logEl && /Found target 23 at index 4\./.test(logEl.textContent || '');
    }, {}, { timeout: 10000 });

    // At the end of the search, reset should be enabled and start should remain disabled
    await expect(resetBtn).toBeEnabled();
    await expect(startBtn).toBeDisabled();
    await expect(targetInput).toBeEnabled();

    // Verify the element at index 4 has the 'found' class applied
    const foundElement = page.locator('#array .element').filter({ has: page.locator('[data-index="4"]') });
    // Because elements have data-index attribute, locate by attribute:
    const elementIndex4 = page.locator('#array .element[data-index="4"]');
    await expect(elementIndex4).toHaveClass(/found/);

    // Verify the log contains the expected messages in sequence including "Found target"
    const finalLog = await log.textContent();
    expect(finalLog).toContain('Checking middle index');
    expect(finalLog).toContain('Found target 23 at index 4.');
  }, { timeout: 20000 });

  test('Transition S1_Searching -> S2_Reset: clicking Reset returns UI to Idle state', async ({ page }) => {
    // Start a full search first (default target 23) to enable Reset at completion
    const startBtn = page.locator('#startBtn');
    const resetBtn = page.locator('#resetBtn');
    const log = page.locator('#log');

    // Start search
    await startBtn.click();

    // Wait until search completes (found message)
    await page.waitForFunction(() => {
      const logEl = document.getElementById('log');
      return logEl && /Found target 23 at index 4\./.test(logEl.textContent || '');
    }, {}, { timeout: 10000 });

    // Now Reset button should be enabled
    await expect(resetBtn).toBeEnabled();

    // Click Reset and validate reset() entry actions: createArrayElements(), clear log, re-enable controls
    await resetBtn.click();

    // After reset, log should be empty
    await expect(log).toHaveText('');

    // All array elements should be present and none should have 'found' class
    const elements = page.locator('#array .element');
    await expect(elements).toHaveCount(15);

    // No element should have the 'found' class
    const founds = await page.$$eval('#array .element', els => els.filter(e => e.classList.contains('found')).length);
    expect(founds).toBe(0);

    // Start button enabled again and Reset disabled as per reset()
    await expect(page.locator('#startBtn')).toBeEnabled();
    await expect(page.locator('#resetBtn')).toBeDisabled();
    await expect(page.locator('#targetInput')).toBeEnabled();
  }, { timeout: 20000 });

  test('Edge case: invalid input triggers alert and search does not start', async ({ page }) => {
    // Clearing input and attempting to start should produce an alert and not start search
    const targetInput = page.locator('#targetInput');
    const startBtn = page.locator('#startBtn');

    // Clear the input
    await targetInput.fill('');

    // Listen for dialog and confirm message
    const dialogPromise = page.waitForEvent('dialog');

    // Click start (should trigger alert)
    await startBtn.click();

    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('Please enter a valid number.');
    // Dismiss the alert to continue
    await dialog.dismiss();

    // Verify search did not begin: start button should remain enabled, reset still disabled
    await expect(startBtn).toBeEnabled();
    await expect(page.locator('#resetBtn')).toBeDisabled();

    // Ensure log remains empty
    await expect(page.locator('#log')).toHaveText('');
  });

  test('Edge case: target not in array results in "not found" message and no found highlight', async ({ page }) => {
    // Enter a target that is not present and run search to exercise not-found path
    const targetInput = page.locator('#targetInput');
    const startBtn = page.locator('#startBtn');
    const log = page.locator('#log');

    await targetInput.fill('999'); // target not present
    await startBtn.click();

    // Wait until the log contains the "not found" message span
    await page.waitForFunction(() => {
      const logEl = document.getElementById('log');
      return logEl && /Result: Not found\./.test(logEl.innerHTML || '');
    }, {}, { timeout: 15000 });

    // Verify the textual 'Target 999 not found' exists in the log content
    const logText = await log.textContent();
    expect(logText).toContain('Target 999 not found in the array.');

    // Verify that no element has the 'found' class
    const founds = await page.$$eval('#array .element', els => els.filter(e => e.classList.contains('found')).length);
    expect(founds).toBe(0);

    // After completion, reset button must be enabled
    await expect(page.locator('#resetBtn')).toBeEnabled();
  }, { timeout: 20000 });

  test('Visual feedback during search: verify mid element highlights as search progresses', async ({ page }) => {
    // This test will assert that as the search progresses mid indices get the "mid" class.
    const startBtn = page.locator('#startBtn');

    // Start the search for default target 23
    await startBtn.click();

    // After initial update, expect to see mid class for index 7 at some point
    await page.waitForFunction(() => {
      const el = document.querySelector('#array .element[data-index="7"]');
      return el && el.classList.contains('mid');
    }, {}, { timeout: 5000 });

    // Later the mid should move to index 3; wait for that change
    await page.waitForFunction(() => {
      const el3 = document.querySelector('#array .element[data-index="3"]');
      return el3 && el3.classList.contains('mid');
    }, {}, { timeout: 7000 });

    // Finally wait for found state at index 4
    await page.waitForFunction(() => {
      const el4 = document.querySelector('#array .element[data-index="4"]');
      return el4 && el4.classList.contains('found');
    }, {}, { timeout: 10000 });
  }, { timeout: 20000 });
});