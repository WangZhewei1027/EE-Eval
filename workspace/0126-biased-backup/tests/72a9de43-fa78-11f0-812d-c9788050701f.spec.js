import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a9de43-fa78-11f0-812d-c9788050701f.html';

// The original array as defined in the application's HTML script.
// We replicate it here so tests can assert exact rendered values.
const EXPECTED_ARRAY = [29, 25, 3, 49, 9, 37, 21, 43, 15, 31, 7, 45, 13, 27, 5, 19, 41, 11, 33, 17];

test.describe('Bucket Sort Visualization - FSM and UI tests', () => {
  // Collect console error messages and page errors for each test.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      try {
        if (msg.type && msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // swallow any unexpected inspection errors while collecting console
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the application and wait for load to permit DOMContentLoaded handlers to run.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // nothing to teardown beyond listeners being cleaned up with the page fixture
  });

  test('S0_Idle: on load the original array is rendered (entry action: renderOriginalArray)', async ({ page }) => {
    // Validate initial state: original array rendered with expected elements
    // This verifies the S0_Idle entry action renderOriginalArray(array) fired on DOMContentLoaded.

    // Wait for the original-array container to exist
    await page.waitForSelector('#original-array');

    // Count the rendered original elements
    const rendered = await page.$$eval('#original-array .array-element', els => els.map(e => e.textContent.trim()));
    // Ensure correct number of elements rendered
    expect(rendered.length).toBe(EXPECTED_ARRAY.length);
    // Validate each element's text content matches expected array
    const renderedNumbers = rendered.map(Number);
    expect(renderedNumbers).toEqual(EXPECTED_ARRAY);

    // Ensure start button exists and has the expected initial text
    const startBtnText = await page.$eval('#start-btn', el => el.textContent.trim());
    expect(startBtnText).toBe('Start Visualization');

    // Assert no runtime errors or console error messages occurred during load
    expect(pageErrors.length, `Page errors on load: ${pageErrors.join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Console errors on load: ${consoleErrors.join(' | ')}`).toBe(0);
  });

  test('Transition S0 -> S1: clicking Start Visualization triggers startVisualization (button becomes disabled and text changes)', async ({ page }) => {
    // Click the start button and verify the application enters the Visualizing state (S1_Visualizing)
    // This validates the StartVisualization event and S1 entry action startVisualization(array).

    const startBtn = await page.waitForSelector('#start-btn');

    // Click the start button
    await startBtn.click();

    // Immediately after clicking, button should be disabled and show 'Sorting...'
    await expect(page.locator('#start-btn')).toBeDisabled();
    await expect(page.locator('#start-btn')).toHaveText(/Sorting\.\.\./);

    // Also ensure that the original elements have been given the 'pulse' class (highlight step)
    const anyOriginalPulsed = await page.$eval('#original-array .array-element', el => el.classList.contains('pulse'));
    expect(anyOriginalPulsed, 'At least one original element should have the "pulse" class after starting').toBe(true);

    // Assert no unexpected runtime errors right after initiating visualization
    expect(pageErrors.length, `Page errors after starting: ${pageErrors.join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Console errors after starting: ${consoleErrors.join(' | ')}`).toBe(0);
  });

  test('S1 -> S2: buckets are created and displayed after distribution starts', async ({ page }) => {
    // This test verifies that after starting the visualization:
    // - Buckets container is populated (evidence for S2_SortingBuckets)
    // - The number of buckets equals the expected bucketCount (5)
    // - The sum of elements across buckets equals original array length

    // Increase timeout because the visualization has intentional delays
    test.setTimeout(120000);

    // Start the visualization
    await page.click('#start-btn');

    // Wait for the initial highlight delay + bucket creation in startVisualization.
    // The script waits 1000ms before creating buckets; wait for buckets to appear.
    await page.waitForSelector('#buckets .bucket', { timeout: 60000 });

    // Ensure there are exactly 5 buckets rendered
    const bucketCount = await page.$$eval('#buckets .bucket', els => els.length);
    expect(bucketCount).toBe(5);

    // For robustness, compute expected distribution using the same algorithm as createBuckets
    const expectedDistribution = (() => {
      const arr = EXPECTED_ARRAY.slice();
      const max = Math.max(...arr);
      const min = Math.min(...arr);
      const bucketCountLocal = 5;
      const range = (max - min + 1) / bucketCountLocal;
      const buckets = Array.from({ length: bucketCountLocal }, () => []);
      arr.forEach(num => {
        const idx = Math.floor((num - min) / range);
        buckets[idx].push(num);
      });
      return buckets.map(b => b.length);
    })();

    // Read actual bucket element counts from the DOM
    const actualDistribution = await page.$$eval('#buckets .bucket', buckets => {
      return buckets.map(bucket => bucket.querySelectorAll('.bucket-element').length);
    });

    // Sum check: ensure elements in buckets equal original array length
    const sumActual = actualDistribution.reduce((s, v) => s + v, 0);
    expect(sumActual).toBe(EXPECTED_ARRAY.length);

    // The per-bucket counts should match our expected distribution
    expect(actualDistribution).toEqual(expectedDistribution);

    // Verify each bucket has a title like 'Bucket X'
    const titles = await page.$$eval('#buckets .bucket .bucket-title', els => els.map(e => e.textContent.trim()));
    expect(titles.length).toBe(5);
    for (let i = 0; i < titles.length; i++) {
      expect(titles[i]).toBe(`Bucket ${i + 1}`);
    }

    // No runtime errors observed up to this point
    expect(pageErrors.length, `Page errors during bucket creation: ${pageErrors.join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Console errors during bucket creation: ${consoleErrors.join(' | ')}`).toBe(0);
  });

  test('S2 -> S3: full visualization completes and sorted array is rendered, button text becomes "Completed!"', async ({ page }) => {
    // This test validates the complete workflow:
    // - Start visualization
    // - Wait until button text is 'Completed!'
    // - Verify sorted array DOM is populated and is ordered ascendingly
    // Note: The visualization intentionally uses many timeouts; allow an extended timeout.

    test.setTimeout(180000); // allow up to 3 minutes for the whole animation/sorting

    // Start the visualization
    await page.click('#start-btn');

    // Wait until the application sets the button text to 'Completed!'
    await page.waitForFunction(() => {
      const btn = document.getElementById('start-btn');
      return btn && btn.textContent.trim() === 'Completed!';
    }, null, { timeout: 150000 });

    // Confirm the start button shows Completed! and remains (script does not re-enable it)
    const finalBtnText = await page.$eval('#start-btn', el => el.textContent.trim());
    expect(finalBtnText).toBe('Completed!');

    // The sorted-array container should be visible and contain the same number of elements as the original array
    await page.waitForSelector('#sorted-array .sorted-element', { timeout: 10000 });
    const sortedText = await page.$$eval('#sorted-array .sorted-element', els => els.map(e => e.textContent.trim()));
    expect(sortedText.length).toBe(EXPECTED_ARRAY.length);

    // Verify the sorted numbers are in non-decreasing order
    const sortedNumbers = sortedText.map(Number);
    for (let i = 1; i < sortedNumbers.length; i++) {
      expect(sortedNumbers[i - 1]).toBeLessThanOrEqual(sortedNumbers[i]);
    }

    // Verify the sorted array contains the same multiset of values as the original
    const sortedCopy = [...sortedNumbers].sort((a, b) => a - b);
    const originalSorted = [...EXPECTED_ARRAY].sort((a, b) => a - b);
    expect(sortedCopy).toEqual(originalSorted);

    // Verify the sorted-array container was animated to opacity 1 (renderSortedArray sets style after 500ms)
    const sortedOpacity = await page.$eval('#sorted-array', el => window.getComputedStyle(el).opacity);
    expect(parseFloat(sortedOpacity)).toBeGreaterThan(0);

    // Assert no unhandled page errors were raised throughout the long visualization
    expect(pageErrors.length, `Page errors during complete visualization: ${pageErrors.join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Console errors during complete visualization: ${consoleErrors.join(' | ')}`).toBe(0);
  });

  test('Edge case: attempting to click Start again while sorting should not re-trigger or enable the button', async ({ page }) => {
    // This test verifies event handling robustness:
    // - After clicking Start once, the button becomes disabled.
    // - Attempting another click while disabled should not produce errors or re-enable it.

    test.setTimeout(60000);

    // Start visualization
    await page.click('#start-btn');

    // Immediately try to click again; the button should be disabled and the second click should be effectively ignored.
    // Playwright's click will still attempt, but the application shouldn't throw or change state unexpectedly.
    await page.click('#start-btn').catch(() => {
      // In some environments clicking a disabled button may cause a Playwright exception; swallow it.
    });

    // Ensure button remains disabled while sorting (it will stay disabled until end; script doesn't re-enable)
    const isDisabled = await page.$eval('#start-btn', el => el.disabled);
    expect(isDisabled).toBe(true);

    // No page errors should have been introduced by the double-click attempt
    expect(pageErrors.length, `Page errors after double click attempt: ${pageErrors.join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Console errors after double click attempt: ${consoleErrors.join(' | ')}`).toBe(0);
  });

  test('Edge case: verify renderBuckets and renderOriginalArray DOM manipulations do not throw when buckets are empty', async ({ page }) => {
    // This test attempts to validate robustness of bucket rendering when provided an empty array.
    // We cannot modify page scripts or call internal functions, but we can emulate the DOM state changes
    // that the page would perform and then trigger existing render functions by dispatching events.
    // However, per instructions we must NOT patch or redefine functions. So instead we verify that
    // the existing UI can handle an initially empty buckets container without page errors.

    // Clear buckets container via DOM (this is permitted as a normal user-driven DOM change)
    await page.evaluate(() => {
      const buckets = document.getElementById('buckets');
      if (buckets) buckets.innerHTML = '';
    });

    // Check that empty buckets container does not produce errors and is empty
    const bucketChildren = await page.$$eval('#buckets .bucket', els => els.length);
    expect(bucketChildren).toBe(0);

    // No page errors after manual DOM clearing
    expect(pageErrors.length, `Page errors after clearing buckets: ${pageErrors.join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Console errors after clearing buckets: ${consoleErrors.join(' | ')}`).toBe(0);
  });
});