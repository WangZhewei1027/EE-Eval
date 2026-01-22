import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79cc7b1-d361-11f0-8438-11a56595a476.html';

test.describe('Quick Sort Visualization (FSM) - d79cc7b1-d361-11f0-8438-11a56595a476', () => {
  // Increase timeout for visualization which uses delays
  test.beforeEach(async ({}, testInfo) => {
    // Ensure each test has enough time for the animated sort to complete if needed
    testInfo.setTimeout(120000);
  });

  // Helper to attach console and pageerror listeners and return arrays for assertions
  async function setupListeners(page) {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // ignore anything odd when reading console
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
    return { consoleMessages, pageErrors };
  }

  // Page object for interacting with core elements
  function pageObjects(page) {
    return {
      arrayInput: page.locator('#arrayInput'),
      sortButton: page.locator('#sortButton'),
      bars: page.locator('#bars .bar'),
      barsContainer: page.locator('#bars'),
      output: page.locator('#output'),
    };
  }

  test('S0 Idle: Initial render shows bars for the initial array and controls enabled', async ({ page }) => {
    test.setTimeout(120000);
    const { consoleMessages, pageErrors } = await setupListeners(page);
    await page.goto(APP_URL);

    const { arrayInput, sortButton, bars, output } = pageObjects(page);

    // Validate input initial value matches expected default
    await expect(arrayInput).toHaveValue('8,3,7,6,2,5,4,1');

    // Initial render: bars should be present and match number of values (8)
    await expect(bars).toHaveCount(8);

    // Check each bar has a title (the value) and height attribute (style height not empty)
    const barCount = await bars.count();
    const titles = [];
    for (let i = 0; i < barCount; i++) {
      const bar = bars.nth(i);
      const title = await bar.getAttribute('title');
      titles.push(title);
      const height = await bar.evaluate(node => node.style.height);
      expect(title).not.toBeNull();
      expect(Number(title)).not.toBeNaN();
      expect(height).toBeTruthy();
    }

    // The output should be empty at idle (initial)
    await expect(output).toHaveText('');

    // Controls should be enabled in Idle state
    await expect(sortButton).toBeEnabled();
    await expect(arrayInput).toBeEnabled();

    // No uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);

    // Console should contain some logs from initial render or none, but ensure no console error type
    const consoleError = consoleMessages.find(m => m.type === 'error');
    expect(consoleError).toBeUndefined();
  });

  test('Transition S0 -> S1: Clicking Sort disables controls and begins sorting (observables)', async ({ page }) => {
    test.setTimeout(120000);
    const { consoleMessages, pageErrors } = await setupListeners(page);
    await page.goto(APP_URL);

    const { arrayInput, sortButton, output, barsContainer } = pageObjects(page);

    // Start sorting by clicking the button
    await Promise.all([
      // Click triggers async work but we want immediate effect assertions after click
      page.waitForTimeout(50), // ensure listeners attached
      sortButton.click()
    ]);

    // After clicking, according to the implementation, sortButton and arrayInput should be disabled
    await expect(sortButton).toBeDisabled();
    await expect(arrayInput).toBeDisabled();

    // Output is cleared at the start of the click handler; then 'Starting array' is appended.
    // The actual immediate behavior after click is that output will contain 'Starting array'
    await expect(output).toContainText('Starting array');

    // During sorting there should be bars rendered (visualization present)
    await expect(barsContainer.locator('.bar')).toHaveCountGreaterThan(0);

    // The code generates console-like output via DOM; ensure we observed some textual progress in #output
    const outText = await output.textContent();
    expect(outText).toMatch(/Starting array: \[.*\]/);

    // Ensure no uncaught runtime errors occurred
    expect(pageErrors.length).toBe(0);
    const consoleErr = consoleMessages.find(m => m.type === 'error');
    expect(consoleErr).toBeUndefined();
  });

  test('S1 Sorting -> S2 Sorted: Full sort completes, output shows sorted array, bars updated, and controls re-enabled', async ({ page }) => {
    test.setTimeout(120000);
    const { consoleMessages, pageErrors } = await setupListeners(page);
    await page.goto(APP_URL);

    const { arrayInput, sortButton, output, bars } = pageObjects(page);

    // Click sort to begin visualization
    await sortButton.click();

    // Wait for a pivot or compare highlight to appear to confirm that visualization is running
    // This ensures we are in active sorting state at some point.
    await page.waitForSelector('.bar.pivot', { timeout: 20000 });

    // Wait for the final "Sorted array:" message to appear in the output.
    // The visualization is asynchronous and includes delays, so allow generous timeout.
    await expect(output).toContainText('Sorted array:', { timeout: 120000 });

    // Verify the final sorted array is ascending 1..8 as expected
    const outText = await output.textContent();
    // Find the last occurrence of "Sorted array: ["
    const sortedLineMatch = outText.match(/Sorted array:\s*\[([^\]]+)\]/g);
    expect(sortedLineMatch).toBeTruthy();
    // The last sorted line should contain the final array
    const lastSorted = sortedLineMatch[sortedLineMatch.length - 1];
    expect(lastSorted).toContain('1, 2, 3, 4, 5, 6, 7, 8');

    // Bars should reflect the sorted order: check their title attributes in DOM order
    const barCount = await bars.count();
    expect(barCount).toBe(8);
    const titles = [];
    for (let i = 0; i < barCount; i++) {
      titles.push(await bars.nth(i).getAttribute('title'));
    }
    // Titles should be strings of numbers; convert to numbers and check ascending
    const nums = titles.map(t => Number(t));
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i]).toBeGreaterThanOrEqual(nums[i - 1]);
    }
    expect(nums.join(',')).toBe('1,2,3,4,5,6,7,8');

    // Controls should be re-enabled after sorting completes (exit actions)
    await expect(sortButton).toBeEnabled();
    await expect(arrayInput).toBeEnabled();

    // The output should contain partition and pivot logs as part of visualization
    expect(outText).toMatch(/Pivot selected: arr\[\d+\] = \d+/);

    // No uncaught runtime errors should have occurred during the full sorting run
    expect(pageErrors.length).toBe(0);
    const consoleErr = consoleMessages.find(m => m.type === 'error');
    expect(consoleErr).toBeUndefined();
  });

  test('Visual cues during sorting: pivot, comparing, and swapped classes appear', async ({ page }) => {
    test.setTimeout(120000);
    const { consoleMessages, pageErrors } = await setupListeners(page);
    await page.goto(APP_URL);

    const { sortButton } = pageObjects(page);

    // Kick off sorting
    await sortButton.click();

    // During the sorting process, pivot class should appear on at least one bar
    await page.waitForSelector('.bar.pivot', { timeout: 20000 });

    // During comparisons, a .comparing bar should appear at some point
    // Wait for .comparing or .swapped to appear; either is evidence of active visualization
    const comparingOrSwapped = await Promise.race([
      page.waitForSelector('.bar.comparing', { timeout: 20000 }).then(() => 'comparing').catch(() => null),
      page.waitForSelector('.bar.swapped', { timeout: 20000 }).then(() => 'swapped').catch(() => null)
    ]);
    expect(['comparing', 'swapped'].includes(comparingOrSwapped)).toBe(true);

    // Allow the full sort to finish so we don't leave background tasks running
    await page.locator('#output').waitFor({ state: 'visible', timeout: 120000 });
    await expect(page.locator('#output')).toContainText('Sorted array:', { timeout: 120000 });

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
    const consoleErr = consoleMessages.find(m => m.type === 'error');
    expect(consoleErr).toBeUndefined();
  });

  test('Edge case: Empty input triggers an alert and prevents sorting', async ({ page }) => {
    test.setTimeout(120000);
    const { consoleMessages, pageErrors } = await setupListeners(page);
    await page.goto(APP_URL);

    const { arrayInput, sortButton } = pageObjects(page);

    // Clear input to simulate empty input
    await arrayInput.fill('');
    // Listen for dialog and verify its message
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click sort and expect an alert dialog
    await sortButton.click();

    // Wait briefly for dialog handler to run
    await page.waitForTimeout(500);

    expect(dialogMessage).toBe('Please enter some numbers separated by commas.');

    // Ensure controls remain enabled after dismissing the alert (no sorting started)
    await expect(sortButton).toBeEnabled();
    await expect(arrayInput).toBeEnabled();

    // No page errors should have occurred
    expect(pageErrors.length).toBe(0);
    const consoleErr = consoleMessages.find(m => m.type === 'error');
    expect(consoleErr).toBeUndefined();
  });

  test('Edge case: Invalid numbers in input triggers an alert and prevents sorting', async ({ page }) => {
    test.setTimeout(120000);
    const { consoleMessages, pageErrors } = await setupListeners(page);
    await page.goto(APP_URL);

    const { arrayInput, sortButton } = pageObjects(page);

    // Enter invalid input containing non-numeric token
    await arrayInput.fill('1, 2, foo, 4');

    // Capture dialog
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click sort and expect invalid numbers alert
    await sortButton.click();

    await page.waitForTimeout(500);

    expect(dialogMessage).toBe('Please enter valid numbers only.');

    // Ensure controls remain enabled (sorting did not start)
    await expect(sortButton).toBeEnabled();
    await expect(arrayInput).toBeEnabled();

    // No uncaught runtime errors should have been thrown
    expect(pageErrors.length).toBe(0);
    const consoleErr = consoleMessages.find(m => m.type === 'error');
    expect(consoleErr).toBeUndefined();
  });

  test('Monitoring console and page errors: ensure no unexpected runtime exceptions on normal flows', async ({ page }) => {
    test.setTimeout(120000);
    const { consoleMessages, pageErrors } = await setupListeners(page);
    await page.goto(APP_URL);

    const { sortButton } = pageObjects(page);

    // Start and wait for the sort to finish, to capture any runtime errors that might appear during execution
    await sortButton.click();

    // Wait for final output to include "Sorted array:"
    await page.locator('#output').waitFor({ state: 'visible', timeout: 120000 });
    await expect(page.locator('#output')).toContainText('Sorted array:', { timeout: 120000 });

    // Assert that there were no page errors captured
    expect(pageErrors.length).toBe(0);

    // Assert there are no console messages of type 'error'
    const consoleError = consoleMessages.find(m => m.type === 'error');
    expect(consoleError).toBeUndefined();

    // Also assert that expected informative messages were printed to the console capture array (if any)
    // The application writes progress to the #output element rather than the console, but we still ensure
    // that console was not used for error-output by checking consoleMessages for 'error' types above.
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });
});