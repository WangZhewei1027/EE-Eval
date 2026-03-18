import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a330a65-ffc5-11f0-8b43-1ffa87931c43.html';

test.describe('Binary Search Demo - FSM tests (Application ID: 5a330a65-ffc5-11f0-8b43-1ffa87931c43)', () => {
  // We'll collect any page errors and console messages to assert on them.
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Observe uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Observe console events for debugging and assertions
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure initial display is ready
    await expect(page.locator('#arrayContainer')).toBeVisible();
    await expect(page.locator('#searchInput')).toBeVisible();
    await expect(page.locator('#startBtn')).toBeVisible();
    await expect(page.locator('#resetBtn')).toBeVisible();
    await expect(page.locator('#log')).toBeVisible();
  });

  test.afterEach(async () => {
    // Assert that there were no uncaught page errors during the test run.
    // If any page errors occurred, fail the test and provide diagnostic info.
    expect(pageErrors.length, `Expected no uncaught page errors but found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });

  test('Initial Idle state: displayArray() executed and controls have expected initial states', async ({ page }) => {
    // This test validates the Idle (S0_Idle) state's entry action displayArray()
    // and initial UI control states as per the FSM.
    // Expect 12 array items rendered (from array length in implementation).
    const items = page.locator('#arrayContainer .arrayItem');
    await expect(items).toHaveCount(12);

    // Check contents of a couple of items to ensure displayArray created correct elements
    await expect(page.locator('#item-0')).toHaveText('3');
    await expect(page.locator('#item-11')).toHaveText('101');

    // Controls: search input enabled, start enabled, reset disabled initially
    await expect(page.locator('#searchInput')).toBeEnabled();
    await expect(page.locator('#startBtn')).toBeEnabled();
    await expect(page.locator('#resetBtn')).toBeDisabled();

    // Log should be empty initially
    await expect(page.locator('#log')).toHaveText('');
  });

  test('StartSearch transition: starting search logs start message and disables/enables controls', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Searching triggered by StartSearch event.
    // It verifies onEnter action startSearch() logs the starting message and disables controls.
    const searchInput = page.locator('#searchInput');
    const startBtn = page.locator('#startBtn');
    const resetBtn = page.locator('#resetBtn');
    const log = page.locator('#log');

    // Enter a valid target that exists (42) so the search will run
    await searchInput.fill('42');
    await startBtn.click();

    // Expect immediate start log entry
    await expect(log).toContainText('Starting binary search for target 42...');

    // While searching: search input and start button disabled, reset button enabled
    await expect(searchInput).toBeDisabled();
    await expect(startBtn).toBeDisabled();
    await expect(resetBtn).toBeEnabled();

    // Highlight should have applied low (index 0) and high (index 11)
    await expect(page.locator('#item-0')).toHaveClass(/low/);
    await expect(page.locator('#item-11')).toHaveClass(/high/);

    // After first interval tick, there should be a 'Checking middle index' entry.
    // Wait up to 6s to accommodate the 1.5s interval cadence (use margin).
    await page.waitForFunction(() => {
      const logEl = document.getElementById('log');
      return logEl && logEl.innerText.includes('Checking middle index');
    }, { timeout: 6000 });

    // Confirm at least one "Checking middle index" log exists
    await expect(log).toContainText('Checking middle index');
  });

  test('Found state: search locates an existing target and marks the item as found', async ({ page }) => {
    // This test validates the S1_Searching -> S2_Found transition and evidence:
    // document.getElementById('item-' + mid).classList.add('found')
    const searchInput = page.locator('#searchInput');
    const startBtn = page.locator('#startBtn');
    const log = page.locator('#log');

    // Choose a known item value 42 (index 5 per implementation)
    await searchInput.fill('42');
    await startBtn.click();

    // Wait for the 'found' log entry which indicates S2_Found
    await page.waitForFunction(() => {
      const logEl = document.getElementById('log');
      return logEl && logEl.innerText.includes('Target 42 found at index');
    }, { timeout: 30000 });

    // Assert the final found message is present
    await expect(log).toContainText('Target 42 found at index 5!');

    // Ensure the corresponding DOM item has the 'found' class
    await expect(page.locator('#item-5')).toHaveClass(/found/);

    // After finalization, the controls should be re-enabled for new searches and reset disabled
    await expect(page.locator('#searchInput')).toBeEnabled();
    await expect(page.locator('#startBtn')).toBeEnabled();
    await expect(page.locator('#resetBtn')).toBeDisabled();

    // Additionally, ensure that after the found event no further 'Checking middle index' entries appear.
    // Capture count of "Checking middle index" occurrences and wait 2 seconds to see none are appended.
    const initialCount = await page.evaluate(() => {
      const text = document.getElementById('log').innerText;
      return (text.match(/Checking middle index/g) || []).length;
    });

    await page.waitForTimeout(2100);

    const laterCount = await page.evaluate(() => {
      const text = document.getElementById('log').innerText;
      return (text.match(/Checking middle index/g) || []).length;
    });

    expect(laterCount, 'No further checking steps after found (interval cleared)').toBe(initialCount);
  });

  test('NotFound state: search ends with not found message for non-existent target', async ({ page }) => {
    // This test validates the S1_Searching -> S3_NotFound transition and evidence:
    // logMessage(`Target ${target} not found in the array.`)
    const searchInput = page.locator('#searchInput');
    const startBtn = page.locator('#startBtn');
    const log = page.locator('#log');

    // Choose a value not present in the array, e.g., 1000
    await searchInput.fill('1000');
    await startBtn.click();

    // Wait for the not found message (should occur after a few steps)
    await page.waitForFunction(() => {
      const logEl = document.getElementById('log');
      return logEl && logEl.innerText.includes('Target 1000 not found in the array.');
    }, { timeout: 30000 });

    // Assert final not found message present
    await expect(log).toContainText('Target 1000 not found in the array.');

    // Controls should be re-enabled (search finished)
    await expect(page.locator('#searchInput')).toBeEnabled();
    await expect(page.locator('#startBtn')).toBeEnabled();
    await expect(page.locator('#resetBtn')).toBeDisabled();
  });

  test('Reset event: clicking Reset mid-search stops the search and restores Idle state', async ({ page }) => {
    // This test validates the Reset event transition and ensures onExit actions are performed:
    // - clearInterval(intervalId) should stop the ongoing steps
    // - reset() should restore UI to Idle state (displayArray)
    const searchInput = page.locator('#searchInput');
    const startBtn = page.locator('#startBtn');
    const resetBtn = page.locator('#resetBtn');
    const log = page.locator('#log');

    // Start a search with a target that will take multiple steps (e.g., 94)
    await searchInput.fill('94');
    await startBtn.click();

    // Wait for at least one checking log to ensure search started
    await page.waitForFunction(() => {
      const logEl = document.getElementById('log');
      return logEl && logEl.innerText.includes('Checking middle index');
    }, { timeout: 6000 });

    // Reset button should be enabled now; click it to trigger reset()
    await expect(resetBtn).toBeEnabled();
    await resetBtn.click();

    // After reset: log cleared, searchInput value cleared, resetBtn disabled, array items restored and without special classes
    await expect(page.locator('#log')).toHaveText('');
    await expect(page.locator('#searchInput')).toHaveValue('');
    await expect(resetBtn).toBeDisabled();
    await expect(startBtn).toBeEnabled();

    // Ensure no array item has low/mid/high/found classes (only default 'arrayItem' class)
    for (let i = 0; i < 12; i++) {
      const cls = await page.locator(`#item-${i}`).getAttribute('class');
      // The base class should be 'arrayItem' and should not include highlight classes
      expect(cls).toBe('arrayItem');
    }

    // Additionally, confirm no further "Checking middle index" entries appear after reset (i.e., interval stopped)
    const currentCount = await page.evaluate(() => {
      const text = document.getElementById('log').innerText;
      return (text.match(/Checking middle index/g) || []).length;
    });

    await page.waitForTimeout(2100);

    const laterCount = await page.evaluate(() => {
      const text = document.getElementById('log').innerText;
      return (text.match(/Checking middle index/g) || []).length;
    });

    expect(laterCount, 'No checking steps should occur after reset (interval cleared)').toBe(currentCount);
  });

  test('Invalid input: clicking Start without a numeric target shows alert and does not start search', async ({ page }) => {
    // This test validates the edge case of invalid input handling: startSearch() should alert and abort.
    const searchInput = page.locator('#searchInput');
    const startBtn = page.locator('#startBtn');
    const resetBtn = page.locator('#resetBtn');
    const log = page.locator('#log');

    // Ensure input is empty
    await searchInput.fill('');

    // Listen for dialog and assert its message
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    // Click Start; should trigger alert and not start searching
    await startBtn.click();

    // Allow a small timeout for dialog to be handled
    await page.waitForTimeout(500);

    expect(dialogMessage, 'Alert must be shown for invalid input').toBe('Please enter a valid number as the target.');

    // Confirm no search started: resetBtn should remain disabled and log should be empty
    await expect(resetBtn).toBeDisabled();
    await expect(log).toHaveText('');
    await expect(searchInput).toBeEnabled();
  });
});