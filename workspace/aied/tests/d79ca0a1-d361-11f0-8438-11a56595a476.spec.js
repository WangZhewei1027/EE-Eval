import { test, expect } from '@playwright/test';

test.setTimeout(120000); // Allow extra time for animations during sorting

// Helper: retrieve numeric values from the bars in the array container
async function getBarValues(page) {
  return await page.$$eval('#arrayContainer .bar', (els) =>
    els.map((el) => parseInt(el.textContent.trim(), 10))
  );
}

// Helper: wait until sorting completes (startBtn becomes enabled again)
async function waitForSortingToFinish(page, timeout = 90000) {
  await page.waitForFunction(() => {
    const btn = document.getElementById('startBtn');
    return btn && btn.disabled === false;
  }, null, { timeout });
}

test.describe('Selection Sort Visualization (FSM verification)', () => {
  // Each test captures console messages and page errors for assertions
  test.beforeEach(async ({ page }) => {
    // No-op: individual tests set up listeners to capture logs/errors where needed
  });

  // Test initial load and S0_Idle -> S1_ArrayGenerated transition
  test('Initial load should auto-generate array (Idle -> Array Generated) and render bars', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page
    await page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/d79ca0a1-d361-11f0-8438-11a56595a476.html');

    // On window.onload, generateArray(parseInt(arraySizeInput.value)) should run.
    // Wait for bars to appear
    await page.waitForSelector('#arrayContainer .bar', { timeout: 10000 });

    // The default input value is 10 per HTML; expect 10 bars
    const sizeValue = await page.$eval('#arraySize', (el) => parseInt(el.value, 10));
    const bars = await page.$$eval('#arrayContainer .bar', (els) => els.length);
    expect(bars).toBe(sizeValue);

    // Start button should be enabled (generate sets startBtn.disabled = false)
    await expect(page.locator('#startBtn')).toBeEnabled();

    // No uncaught page errors should have occurred on initial load
    expect(pageErrors.length).toBe(0);

    // No console messages of type 'error' expected; capture for debugging if any
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test generating a new array via the Generate Array button (transition S0->S1 or S1->S1)
  test('Clicking Generate Array regenerates the array and updates DOM', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/d79ca0a1-d361-11f0-8438-11a56595a476.html');
    await page.waitForSelector('#arrayContainer .bar');

    // Set an explicit smaller size for faster assertions
    await page.fill('#arraySize', '7');
    // Capture the current bars before regenerating
    const before = await getBarValues(page);

    // Click Generate Array button (event: GenerateArray)
    await page.click('#generateBtn');

    // Ensure container updated and now has 7 bars
    await page.waitForFunction(() => {
      const cnt = document.querySelectorAll('#arrayContainer .bar').length;
      const input = document.getElementById('arraySize');
      return cnt === parseInt(input.value, 10);
    }, null, { timeout: 5000 });

    const after = await getBarValues(page);
    expect(after.length).toBe(7);

    // There's a high probability the arrays differ (random generation). If they happen to be equal,
    // that's not a failure of functionality; assert only that DOM updated to the requested size.
    const arraysEqual = before.length === after.length && before.every((v, i) => v === after[i]);
    // We log but do not fail if arraysEqual === true as RNG could coincidentally match.
    // However ensure no page errors occurred during generation.
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test Start Sorting (S1_ArrayGenerated -> S2_Sorting) and completion (S2_Sorting -> S3_Sorted)
  test('Starting sorting animates steps, disables controls during sort, and results in sorted array', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/d79ca0a1-d361-11f0-8438-11a56595a476.html');
    await page.waitForSelector('#arrayContainer .bar');

    // Choose the minimum allowed size to reduce total animation duration
    await page.fill('#arraySize', '5');
    await page.click('#generateBtn');
    await page.waitForFunction(() => {
      const cnt = document.querySelectorAll('#arrayContainer .bar').length;
      const input = document.getElementById('arraySize');
      return cnt === parseInt(input.value, 10);
    }, null, { timeout: 5000 });

    // Start sorting (event: StartSorting)
    await page.click('#startBtn');

    // Immediately after starting, animateSorting should set sorting=true and disable controls
    await expect(page.locator('#startBtn')).toBeDisabled();
    await expect(page.locator('#generateBtn')).toBeDisabled();
    await expect(page.locator('#arraySize')).toBeDisabled();

    // While sorting is in progress, at least one 'selected' or 'min' or 'swapping' class should appear
    // Wait up to 6 seconds for a visual step to appear
    const stepSelector = '#arrayContainer .bar.selected, #arrayContainer .bar.min, #arrayContainer .bar.swapping';
    await page.waitForSelector(stepSelector, { timeout: 6000 });

    // Wait until sorting finishes (startBtn becomes enabled again)
    await waitForSortingToFinish(page, 90000);

    // After sorting completes, controls should be enabled
    await expect(page.locator('#startBtn')).toBeEnabled();
    await expect(page.locator('#generateBtn')).toBeEnabled();
    await expect(page.locator('#arraySize')).toBeEnabled();

    // Verify final displayed array is sorted in non-decreasing order (ascending)
    const finalValues = await getBarValues(page);
    for (let i = 1; i < finalValues.length; i++) {
      expect(finalValues[i]).toBeGreaterThanOrEqual(finalValues[i - 1]);
    }

    // Ensure there were no uncaught page errors during the sorting animation
    expect(pageErrors.length).toBe(0);

    // No console errors expected
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: invalid array size input should show an alert dialog (error scenario)
  test('Entering invalid array size and clicking Generate Array shows alert', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/d79ca0a1-d361-11f0-8438-11a56595a476.html');
    await page.waitForSelector('#arrayContainer .bar');

    // Set invalid size and expect an alert dialog when clicking generate
    await page.fill('#arraySize', '3');

    const dialogPromise = new Promise((resolve) => {
      page.once('dialog', async (dialog) => {
        try {
          // Validate dialog message is about size bounds
          expect(dialog.message()).toContain('Please enter a size between 5 and 30');
        } finally {
          await dialog.accept();
          resolve(true);
        }
      });
    });

    await page.click('#generateBtn');

    // Ensure the dialog appeared and was handled
    const dialogShown = await dialogPromise;
    expect(dialogShown).toBe(true);

    // Validate that no page errors occurred due to this invalid input
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: clicking Generate while sorting is in progress should be ignored (handler checks sorting)
  test('Clicking Generate Array during an active sort is ignored and does not interrupt sorting', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/d79ca0a1-d361-11f0-8438-11a56595a476.html');
    await page.waitForSelector('#arrayContainer .bar');

    // Use small size for faster execution
    await page.fill('#arraySize', '5');
    await page.click('#generateBtn');
    await page.waitForFunction(() => {
      const cnt = document.querySelectorAll('#arrayContainer .bar').length;
      const input = document.getElementById('arraySize');
      return cnt === parseInt(input.value, 10);
    }, null, { timeout: 5000 });

    // Start sorting
    await page.click('#startBtn');

    // Ensure sorting began: startBtn disabled
    await expect(page.locator('#startBtn')).toBeDisabled();

    // Attempt to click Generate while sorting is active. Handler should early-return without error.
    // We click and ensure no alert appears and that controls remain disabled until sort finishes.
    let dialogAppeared = false;
    page.once('dialog', async (dialog) => {
      dialogAppeared = true;
      await dialog.dismiss();
    });

    await page.click('#generateBtn').catch(() => {
      // In case clicking a disabled element throws in certain contexts, ignore.
    });

    // Ensure no alert dialog popped up as a result of this (generate should return early)
    // Give a short moment for any unexpected dialog to appear
    await page.waitForTimeout(500);
    expect(dialogAppeared).toBe(false);

    // Ensure controls still disabled while sorting continues
    await expect(page.locator('#generateBtn')).toBeDisabled();

    // Wait for sorting to finish cleanly
    await waitForSortingToFinish(page, 90000);

    // After completion, controls should be enabled again
    await expect(page.locator('#generateBtn')).toBeEnabled();

    // Ensure no page errors occurred
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});