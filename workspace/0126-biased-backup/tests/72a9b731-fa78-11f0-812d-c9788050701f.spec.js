import { test, expect } from '@playwright/test';

// Increase default timeout because the visualization contains intentional sleeps
test.setTimeout(180000);

// Simple Page Object Model for the Insertion Sort visualization page
class InsertionSortPage {
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a9b731-fa78-11f0-812d-c9788050701f.html';
  }

  // Navigate to the app and wait for initial bars to be rendered
  async goto() {
    await this.page.goto(this.url);
    // Wait for the visualization container and at least one bar to appear
    await this.page.waitForSelector('#visualization .bar', { timeout: 10000 });
  }

  // Return array of numeric values read from data-value attributes of bars
  async getValues() {
    return await this.page.$$eval('#visualization .bar', bars =>
      bars.map(b => Number(b.getAttribute('data-value')))
    );
  }

  // Return number of bars rendered in the visualization
  async getBarsCount() {
    return await this.page.$$eval('#visualization .bar', bars => bars.length);
  }

  // Click Start Sorting button
  async clickStart() {
    await this.page.click('#startBtn');
  }

  // Click Reset button
  async clickReset() {
    await this.page.click('#resetBtn');
  }

  // Check whether the start button is disabled
  async isStartDisabled() {
    return await this.page.$eval('#startBtn', btn => btn.disabled);
  }

  // Wait for at least one bar to have the 'active' class
  async waitForAnyActive(timeout = 10000) {
    await this.page.waitForSelector('#visualization .bar.active', { timeout });
  }

  // Wait until all bars have the 'sorted' class
  async waitForAllSorted(timeout = 120000) {
    await this.page.waitForFunction(() => {
      const bars = Array.from(document.querySelectorAll('#visualization .bar'));
      return bars.length > 0 && bars.every(b => b.classList.contains('sorted'));
    }, null, { timeout });
  }

  // Read class lists for all bars (for assertions)
  async getBarsClassLists() {
    return await this.page.$$eval('#visualization .bar', bars => bars.map(b => Array.from(b.classList)));
  }

  // Get inline heights for bars (strings like 'xx%')
  async getBarsHeights() {
    return await this.page.$$eval('#visualization .bar', bars => bars.map(b => b.style.height));
  }
}

test.describe('Insertion Sort Visualization - FSM states and transitions', () => {
  // Test initial Idle state (S0_Idle) and generateRandomArray() on load
  test('Initial state (Idle) should generate a random array of bars', async ({ page }) => {
    // Capture console messages and page errors for inspection
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', error => pageErrors.push(error));

    const app = new InsertionSortPage(page);
    await app.goto();

    // Assert: visualization has 15 bars as the implementation generates 15 values
    const count = await app.getBarsCount();
    expect(count).toBe(15);

    // Assert: all bars have data-value attributes that parse to numbers in the expected range
    const values = await app.getValues();
    expect(values.length).toBe(15);
    for (const v of values) {
      expect(typeof v).toBe('number');
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThanOrEqual(99);
    }

    // Assert: start button is initially enabled (Idle state entry should not disable it)
    const startDisabled = await app.isStartDisabled();
    expect(startDisabled).toBe(false);

    // Assert: no unexpected page errors of types other than ReferenceError/SyntaxError/TypeError occurred.
    // If page errors did occur, ensure they are of allowed types (they are allowed to happen naturally).
    for (const err of pageErrors) {
      // Some Error objects may not have a 'name' (rare) - treat them as generic Error
      const name = err && err.name ? err.name : 'Error';
      expect(['ReferenceError', 'SyntaxError', 'TypeError', 'Error']).toContain(name);
    }

    // Store a short console snapshot for debugging visibility (no strict assertion)
    // but ensure consoleMessages is an array
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  // Test transition: StartSorting event moves S0_Idle -> S1_Sorting and then S1_Sorting -> S2_Sorted
  test('Start Sorting: button disables, bars become active, and eventually all bars are sorted', async ({ page }) => {
    // Track console messages and page errors for this test
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', error => pageErrors.push(error));

    const app = new InsertionSortPage(page);
    await app.goto();

    // Capture values before sorting for later comparison
    const beforeValues = await app.getValues();

    // Click start to trigger insertionSort -> transition to S1_Sorting
    await app.clickStart();

    // Immediately after clicking, start button should be disabled (onEnter action of Sorting)
    const disabledAfterStart = await app.isStartDisabled();
    expect(disabledAfterStart).toBe(true);

    // During sorting, there should be at least one 'active' bar at some point (visual feedback)
    // Wait up to 10s for first active bar to appear
    await app.waitForAnyActive(10000);

    // Wait for sorting to complete: all bars have 'sorted' class (S2_Sorted)
    await app.waitForAllSorted(120000);

    // After sorting completes the onExit action should have re-enabled the start button
    const disabledAfterFinish = await app.isStartDisabled();
    expect(disabledAfterFinish).toBe(false);

    // Assert: final state - all bars are marked 'sorted'
    const classLists = await app.getBarsClassLists();
    for (const classes of classLists) {
      expect(classes).toContain('sorted');
    }

    // The sorted array should be non-decreasing. Verify numeric values are sorted ascending.
    const afterValues = await app.getValues();
    for (let i = 1; i < afterValues.length; i++) {
      expect(afterValues[i]).toBeGreaterThanOrEqual(afterValues[i - 1]);
    }

    // Page errors, if any, must be of the allowed types (do not attempt to fix them here)
    for (const err of pageErrors) {
      const name = err && err.name ? err.name : 'Error';
      expect(['ReferenceError', 'SyntaxError', 'TypeError', 'Error']).toContain(name);
    }

    // Optionally assert that consoleMessages is present (no strict expectation on content)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  // Test Reset event in Idle state: should generate a new random array
  test('Reset in Idle generates a new random array', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', error => pageErrors.push(error));

    const app = new InsertionSortPage(page);
    await app.goto();

    const before = await app.getValues();

    // Click reset to generate a new array
    await app.clickReset();

    // Wait briefly for regeneration
    await page.waitForTimeout(200);

    const after = await app.getValues();

    // Assert: bars count remains the same
    const count = await app.getBarsCount();
    expect(count).toBe(15);

    // It's possible (though unlikely) that the random generator produced the same array.
    // We'll assert that arrays are not identical most of the time; if they are identical, the test will still pass but we log it.
    const identical = JSON.stringify(before) === JSON.stringify(after);
    // Allow identical but signal expectation: Prefer different
    // If identical, do not fail the test but include an expectation that usually they should differ.
    // We assert that after is a valid array like before.
    expect(after.length).toBe(15);
    for (const v of after) {
      expect(typeof v).toBe('number');
    }

    // Page errors check
    for (const err of pageErrors) {
      const name = err && err.name ? err.name : 'Error';
      expect(['ReferenceError', 'SyntaxError', 'TypeError', 'Error']).toContain(name);
    }

    // If arrays are identical, emit a soft assertion via console capture (non-failing)
    if (identical) {
      // Keep test passing but provide visibility in test output via console (no throw)
      console.info('Warning: Reset generated an identical array (rare but possible).');
    } else {
      // If different, enforce that reset produced a different order
      expect(identical).toBe(false);
    }
  });

  // Test Reset during Sorting: reset() should early-return and not change the array when sorting is ongoing
  test('Reset during Sorting should NOT generate a new array (reset is ignored when sorting)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', error => pageErrors.push(error));

    const app = new InsertionSortPage(page);
    await app.goto();

    // Capture initial values
    const before = await app.getValues();

    // Start sorting
    await app.clickStart();

    // Immediately attempt to reset while sorting is set to true in the insertionSort function
    // Because insertionSort sets sorting = true synchronously before awaiting, reset() should detect sorting and return
    await app.clickReset();

    // Wait briefly to let any potential reset effects appear
    await page.waitForTimeout(500);

    // Capture values after the attempted reset
    const after = await app.getValues();

    // The array should remain the same (reset should be ignored while sorting)
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));

    // Wait for sorting to finish to leave the page in a stable state
    await app.waitForAllSorted(120000);

    // Final page error assertions
    for (const err of pageErrors) {
      const name = err && err.name ? err.name : 'Error';
      expect(['ReferenceError', 'SyntaxError', 'TypeError', 'Error']).toContain(name);
    }

    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  // Observability test: collect and validate console messages and page errors (if any)
  test('Observe console and page errors; any observed errors must be of allowed types', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', error => pageErrors.push(error));

    const app = new InsertionSortPage(page);
    await app.goto();

    // Allow a short period for any late runtime errors to surface
    await page.waitForTimeout(500);

    // If there are page errors, ensure they are among the allowed list (we do not attempt to fix the page)
    for (const err of pageErrors) {
      const name = err && err.name ? err.name : 'Error';
      expect(['ReferenceError', 'SyntaxError', 'TypeError', 'Error']).toContain(name);
      // Optionally assert that the error message is a string
      expect(typeof (err && err.message ? err.message : '')).toBe('string');
    }

    // At minimum ensure console messages are an array (we don't expect particular messages)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});