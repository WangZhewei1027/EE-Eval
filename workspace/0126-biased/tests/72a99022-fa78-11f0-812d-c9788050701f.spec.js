import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a99022-fa78-11f0-812d-c9788050701f.html';

/**
 * Page Object for the Bubble Sort Visualization page
 */
class BubbleSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.visualization = page.locator('#visualization');
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.bars = page.locator('.bar');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async barCount() {
    return await this.bars.count();
  }

  async getBarDataValues() {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('.bar')).map(b => b.getAttribute('data-value'));
    });
  }

  async getBarClassesAtIndex(i) {
    return await this.page.evaluate((idx) => {
      const b = document.querySelector(`.bar[data-index="${idx}"]`);
      return b ? Array.from(b.classList) : [];
    }, i);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async isStartDisabled() {
    return await this.startBtn.isDisabled();
  }

  async waitForAnyComparingOrActive(timeout = 5000) {
    // Wait for any bar to gain 'comparing' or 'active' class which indicates sorting has begun
    await this.page.waitForFunction(() => {
      return !!document.querySelector('.bar.comparing, .bar.active');
    }, { timeout });
  }

  async waitForSortingComplete(timeout = 60000) {
    // Wait until the start button is re-enabled indicating sorting finished
    await this.page.waitForFunction(() => {
      const startBtn = document.getElementById('startBtn');
      return startBtn && !startBtn.disabled;
    }, { timeout });
  }

  async allBarsSorted() {
    return await this.page.evaluate(() => {
      const bars = Array.from(document.querySelectorAll('.bar'));
      if (bars.length === 0) return false;
      return bars.every(b => b.classList.contains('sorted'));
    });
  }

  async getVisualizationHTML() {
    return await this.page.evaluate(() => document.getElementById('visualization').innerHTML);
  }
}

/**
 * Tests grouped for the Bubble Sort Visualization FSM and UI
 */
test.describe.serial('Bubble Sort Visualization - FSM states and transitions', () => {

  test('Initial state S0_Idle: page initializes and shows bars (initialize on entry)', async ({ page }) => {
    // Capture console errors and page errors for assertions
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const app = new BubbleSortPage(page);
    await app.goto();

    // The FSM S0_Idle entry action is initialize(). Validate that bars were created
    const count = await app.barCount();
    // The HTML/JS implementation creates 15 bars in initialize()
    expect(count).toBeGreaterThan(0);
    expect(count).toBe(15);

    // Validate each bar has data-index and data-value attributes
    const dataValues = await app.getBarDataValues();
    expect(dataValues.length).toBe(15);
    for (let i = 0; i < dataValues.length; i++) {
      // Ensure data-value is numeric-ish string
      expect(dataValues[i]).toMatch(/^\d+$/);
    }

    // Start button should be enabled in idle state
    expect(await app.isStartDisabled()).toBeFalsy();

    // Ensure there were no uncaught page errors or console errors on load
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Event StartSorting: clicking Start triggers S1_Sorting (bubbleSort) and disables start button', async ({ page }) => {
    // This test validates that clicking the start button enters the Sorting state (S1_Sorting)
    // and that the UI provides visual feedback of comparing/active bars.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const app = new BubbleSortPage(page);
    await app.goto();

    // Click Start Sorting
    await app.clickStart();

    // After clicking start, the start button should become disabled (evidence of isSorting = true)
    await page.waitForFunction(() => document.getElementById('startBtn').disabled === true, { timeout: 5000 });
    expect(await app.isStartDisabled()).toBeTruthy();

    // At least one bar should get 'comparing' or 'active' while sorting is ongoing.
    // This indicates the sorting visualization is animating as expected.
    await app.waitForAnyComparingOrActive(10000);
    const anyComparingOrActive = await page.evaluate(() => !!document.querySelector('.bar.comparing, .bar.active'));
    expect(anyComparingOrActive).toBeTruthy();

    // Try clicking reset while sorting; per implementation, reset should be ignored during sorting.
    // We'll capture the visualization HTML snapshot and assert it does not fully reset immediately.
    const beforeResetHTML = await app.getVisualizationHTML();
    // Click reset while sorting
    await app.clickReset();
    // Give a short time to allow any unintended reset to occur
    await page.waitForTimeout(500);
    const afterResetHTML = await app.getVisualizationHTML();

    // If reset was ignored, the DOM should not be identical to the initial "before reset" snapshot for long,
    // because sorting continues to mutate classes and heights. Instead we assert reset did not replace the DOM
    // with a newly-initialized set (which would remove all active/comparing classes instantly).
    // It's acceptable if the HTML differs due to ongoing sorting mutations; the key expectation is that
    // the start button remains disabled (meaning sorting was not stopped by reset).
    expect(await app.isStartDisabled()).toBeTruthy();

    // Ensure no uncaught errors happened while starting sorting
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Transition S1_Sorting -> S2_Sorted: sorting completes and all bars become sorted', async ({ page }) => {
    // Sorting may take time; increase the timeout for this test.
    test.setTimeout(90000); // 90 seconds for a full sort completion if necessary

    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const app = new BubbleSortPage(page);
    await app.goto();

    // Start the sorting process
    await app.clickStart();

    // Wait for sorting to complete (start button re-enabled)
    await app.waitForSortingComplete(80000); // generous timeout to allow sorting finish

    // After completion, start button should be enabled again
    expect(await app.isStartDisabled()).toBeFalsy();

    // All bars should have the 'sorted' class according to S2_Sorted evidence
    const allSorted = await app.allBarsSorted();
    expect(allSorted).toBeTruthy();

    // Specifically ensure the last bar (n-1) has class 'sorted' as per the FSM evidence
    const lastIndex = (await app.barCount()) - 1;
    const lastBarClasses = await app.getBarClassesAtIndex(lastIndex);
    expect(lastBarClasses).toContain('sorted');

    // Ensure no uncaught page errors or console errors occurred during sorting completion
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Reset event: when idle (not sorting), Reset runs initialize() and repopulates bars', async ({ page }) => {
    // Validate that clicking Reset while idle causes a re-initialization of bars.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const app = new BubbleSortPage(page);
    await app.goto();

    // Ensure we are idle and get an initial snapshot
    expect(await app.isStartDisabled()).toBeFalsy();
    const beforeResetValues = await app.getBarDataValues();
    const beforeResetHTML = await app.getVisualizationHTML();

    // Click reset while idle - should run initialize() and repopulate with new random values
    await app.clickReset();

    // Wait for some regeneration time
    await page.waitForTimeout(200); // initialize is synchronous for DOM operations, small wait to ensure mutation

    const afterResetValues = await app.getBarDataValues();
    const afterResetHTML = await app.getVisualizationHTML();

    // After reset, the DOM should be repopulated. The most robust check is that the innerHTML changed
    // (since initialize replaces children) OR at least some data-values changed.
    const htmlChanged = beforeResetHTML !== afterResetHTML;
    const valuesChanged = JSON.stringify(beforeResetValues) !== JSON.stringify(afterResetValues);

    // It's extremely unlikely that random initialization produces identical HTML and values,
    // but to be tolerant, require at least one of these conditions.
    expect(htmlChanged || valuesChanged).toBeTruthy();

    // Also confirm we still have the same expected count of bars
    expect(await app.barCount()).toBeGreaterThan(0);

    // Confirm no uncaught errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Edge case: clicking Start multiple times should not break the app (idempotent start)', async ({ page }) => {
    // Ensure start button disabling prevents re-entrant sorting calls from breaking the app
    test.setTimeout(60000);

    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const app = new BubbleSortPage(page);
    await app.goto();

    // Click start twice rapidly
    await app.clickStart();
    // A second click should be ignored because the first call disables the button synchronously
    // but just in case, attempt to click quickly again
    try {
      await app.clickStart();
    } catch (e) {
      // If second click fails because button is disabled, that's acceptable.
    }

    // Ensure the start button remains disabled while sorting
    await page.waitForFunction(() => document.getElementById('startBtn').disabled === true, { timeout: 5000 });
    expect(await app.isStartDisabled()).toBeTruthy();

    // Wait until sorting completes (re-enabled start button)
    await app.waitForSortingComplete(60000);
    expect(await app.isStartDisabled()).toBeFalsy();

    // Confirm the app ended in a sorted state
    expect(await app.allBarsSorted()).toBeTruthy();

    // No uncaught errors should have occurred during multiple clicks
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Monitor console and page errors across lifecycle', async ({ page }) => {
    // This test explicitly captures and asserts that there are no uncaught ReferenceError/SyntaxError/TypeError
    // produced by the page during a typical user flow (load -> start -> complete -> reset).
    test.setTimeout(90000);

    const consoleErrors = [];
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const app = new BubbleSortPage(page);
    await app.goto();

    // Start sorting and wait completion
    await app.clickStart();
    await app.waitForSortingComplete(80000);

    // Reset once idle
    await app.clickReset();
    await page.waitForTimeout(200);

    // Assert there were no uncaught page errors
    expect(pageErrors).toEqual([]);

    // Assert there were no console.error messages (ReferenceError/SyntaxError/TypeError would typically appear here)
    expect(consoleErrors).toEqual([]);

    // Additionally assert that console had some messages (info/debug) during lifecycle - not required but informative
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

});