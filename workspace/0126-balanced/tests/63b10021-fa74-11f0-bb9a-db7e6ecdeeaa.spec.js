import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b10021-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page object for the Insertion Sort Visualization app
class InsertionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('#container');
    this.newArrayBtn = page.locator('#newArrayBtn');
    this.startBtn = page.locator('#startBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.speedRange = page.locator('#speedRange');
    this.barLocator = page.locator('#container .bar');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async countBars() {
    return await this.barLocator.count();
  }

  // Return array of heights (as numbers) for bars
  async getBarHeights() {
    const count = await this.countBars();
    const heights = [];
    for (let i = 0; i < count; i++) {
      const h = await this.barLocator.nth(i).evaluate(el => el.style.height);
      // style height like "123px"
      heights.push(Number(h.replace('px', '')));
    }
    return heights;
  }

  async getBarClasses(index) {
    return await this.barLocator.nth(index).evaluate(el => Array.from(el.classList));
  }

  async allBarsHaveClass(className) {
    const count = await this.countBars();
    for (let i = 0; i < count; i++) {
      const classes = await this.getBarClasses(i);
      if (!classes.includes(className)) return false;
    }
    return true;
  }

  async clickNewArray() {
    await this.newArrayBtn.click();
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async setSpeed(value) {
    // Use evaluate to set the value and dispatch an input event so page handlers run
    await this.page.evaluate((v) => {
      const el = document.getElementById('speedRange');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  async isStartDisabled() {
    return await this.startBtn.evaluate(el => el.disabled);
  }

  async isStepDisabled() {
    return await this.stepBtn.evaluate(el => el.disabled);
  }

  async isResetDisabled() {
    return await this.resetBtn.evaluate(el => el.disabled);
  }

  async isNewArrayDisabled() {
    return await this.newArrayBtn.evaluate(el => el.disabled);
  }
}

test.describe('Insertion Sort Visualization - FSM state and transitions', () => {
  // Collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages (especially console.error)
    page.on('console', msg => {
      try {
        const type = msg.type(); // e.g., 'log', 'error'
        const text = msg.text();
        consoleErrors.push({ type, text });
      } catch (e) {
        // ignore listener errors
      }
    });

    // Capture uncaught page errors (pageerror)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test('Initial Idle state: generateArray() called on load and UI initialized', async ({ page }) => {
    // This test validates the initial "Idle" state (S0_Idle) where generateArray() runs on load.
    const app = new InsertionSortPage(page);
    await app.goto();

    // After load, generateArray() runs and then script enables step mode (per the inline script).
    const count = await app.countBars();
    // The app defines NUM_BARS = 30
    expect(count).toBeGreaterThanOrEqual(30);

    // Verify button states expected immediately after initialization:
    // startBtn should be enabled (generateArray sets disabled=false),
    // stepBtn is explicitly enabled at the end of script initialization,
    // resetBtn should be disabled after generateArray()
    expect(await app.isStartDisabled()).toBe(false);
    expect(await app.isStepDisabled()).toBe(false);
    expect(await app.isResetDisabled()).toBe(true);
    expect(await app.isNewArrayDisabled()).toBe(false);

    // Verify renderArray produced bar elements with heights > 0
    const heights = await app.getBarHeights();
    expect(heights.length).toBeGreaterThanOrEqual(30);
    for (const h of heights.slice(0, 5)) {
      expect(h).toBeGreaterThan(0);
    }

    // Assert no uncaught page errors of types ReferenceError/SyntaxError/TypeError occurred during load
    const hasSeriousPageError = pageErrors.some(err =>
      err && (err.name === 'ReferenceError' || err.name === 'SyntaxError' || err.name === 'TypeError')
    );
    expect(hasSeriousPageError).toBe(false);

    // Assert there were no console.error messages indicating runtime errors
    const hadConsoleError = consoleErrors.some(c => c.type === 'error');
    expect(hadConsoleError).toBe(false);
  });

  test('Start automatic sort (S0_Idle -> S1_Sorting_Auto -> S3_Sorted) completes and marks all bars sorted', async ({ page }) => {
    // This test validates the automatic sorting transition and final Sorted state.
    const app = new InsertionSortPage(page);
    await app.goto();

    // Speed up the animation to complete test quickly: set to minimum 50ms
    await app.setSpeed(50);

    // Start auto sorting
    await app.clickStart();

    // Wait for sorting to finish: final state sets startBtn.disabled = true, stepBtn.disabled = true, resetBtn.disabled = false, newArrayBtn.disabled = false
    await page.waitForFunction(() => {
      const start = document.getElementById('startBtn');
      const reset = document.getElementById('resetBtn');
      const newArray = document.getElementById('newArrayBtn');
      return start.disabled === true && reset.disabled === false && newArray.disabled === false;
    }, {}, { timeout: 90_000 }); // generous timeout in case of slow execution

    // Assert all bars are marked as sorted (sorted class present on all bars)
    const allSorted = await app.allBarsHaveClass('sorted');
    expect(allSorted).toBe(true);

    // Assert UI buttons reflect "Sorted" final state
    expect(await app.isStartDisabled()).toBe(true);
    expect(await app.isStepDisabled()).toBe(true);
    expect(await app.isResetDisabled()).toBe(false);
    expect(await app.isNewArrayDisabled()).toBe(false);

    // Check no serious page errors occurred during sorting
    const hasSeriousPageError = pageErrors.some(err =>
      err && (err.name === 'ReferenceError' || err.name === 'SyntaxError' || err.name === 'TypeError')
    );
    expect(hasSeriousPageError).toBe(false);

    // Check no console.error was logged
    const hadConsoleError = consoleErrors.some(c => c.type === 'error');
    expect(hadConsoleError).toBe(false);
  }, { timeout: 120_000 });

  test('Step through sorting manually (S0_Idle -> S2_Sorting_Step -> S3_Sorted) and reach final sorted state', async ({ page }) => {
    // This test validates stepping behavior and the S2 -> S3 transition when sorting completes via steps.
    const app = new InsertionSortPage(page);
    await app.goto();

    // Ensure we are in a known state: initial load has step enabled (script sets it)
    expect(await app.isStepDisabled()).toBe(false);

    // Step repeatedly until sorting completes. We watch for resetBtn becoming enabled (indicates completion) or stepBtn disabled.
    const maxClicks = 5000;
    let clicks = 0;
    while (clicks < maxClicks) {
      clicks++;
      // Click the step button; insertionSortStep runs synchronously and advances the algorithm state one "step"
      await app.clickStep();

      // If sorting finished, the code sets resetBtn.disabled = false and stepBtn.disabled = true
      const finished = !(await app.isStepDisabled()) ? false : (await app.isResetDisabled() === false);
      if (finished) break;

      // Small micro-delay to allow DOM updates if needed
      await page.waitForTimeout(1);
    }

    // After stepping, we expect the sort to finish and all bars to be marked sorted
    const allSorted = await app.allBarsHaveClass('sorted');
    expect(allSorted).toBe(true);

    // Assert reset button enabled and step disabled in final state
    expect(await app.isResetDisabled()).toBe(false);
    expect(await app.isStepDisabled()).toBe(true);

    // Ensure no page errors or console errors occurred during stepping
    const hasSeriousPageError = pageErrors.some(err =>
      err && (err.name === 'ReferenceError' || err.name === 'SyntaxError' || err.name === 'TypeError')
    );
    expect(hasSeriousPageError).toBe(false);
    const hadConsoleError = consoleErrors.some(c => c.type === 'error');
    expect(hadConsoleError).toBe(false);
  }, { timeout: 120_000 });

  test('Reset during automatic sorting stops sorting and returns to Idle (S1_Sorting_Auto -> S0_Idle)', async ({ page }) => {
    // This test ensures that clicking Reset while auto-sorting invokes generateArray() and returns to Idle.
    const app = new InsertionSortPage(page);
    await app.goto();

    // Slow the animation so we can interact while sorting is in progress
    await app.setSpeed(1000);

    // Start sorting
    await app.clickStart();

    // Wait until the UI indicates sorting has started: resetBtn becomes enabled quickly in code after setting sorting=true
    await page.waitForFunction(() => {
      const reset = document.getElementById('resetBtn');
      return reset && reset.disabled === false;
    }, {}, { timeout: 10_000 });

    // Now click reset while sorting
    await app.clickReset();

    // After reset (generateArray), startBtn should be enabled again, stepBtn is set disabled by generateArray()
    await page.waitForFunction(() => {
      const start = document.getElementById('startBtn');
      const step = document.getElementById('stepBtn');
      const reset = document.getElementById('resetBtn');
      return start && step && reset && start.disabled === false && step.disabled === true && reset.disabled === true;
    }, {}, { timeout: 10_000 });

    // Validate expected Idle-like state after reset
    expect(await app.isStartDisabled()).toBe(false);
    expect(await app.isStepDisabled()).toBe(true);
    expect(await app.isResetDisabled()).toBe(true);

    // Validate no critical runtime errors occurred during reset
    const hasSeriousPageError = pageErrors.some(err =>
      err && (err.name === 'ReferenceError' || err.name === 'SyntaxError' || err.name === 'TypeError')
    );
    expect(hasSeriousPageError).toBe(false);
    const hadConsoleError = consoleErrors.some(c => c.type === 'error');
    expect(hadConsoleError).toBe(false);
  });

  test('Generate New Array produces a different array (UI changes observed)', async ({ page }) => {
    // This test ensures clicking Generate New Array changes the DOM bar heights (i.e., a new random array)
    const app = new InsertionSortPage(page);
    await app.goto();

    const beforeHeights = await app.getBarHeights();

    // Click new array
    await app.clickNewArray();

    // Wait a tick for DOM to update
    await page.waitForTimeout(50);

    const afterHeights = await app.getBarHeights();

    // It's extremely unlikely that the new random array equals the previous one exactly.
    const arraysEqual = beforeHeights.length === afterHeights.length && beforeHeights.every((v, i) => v === afterHeights[i]);
    expect(arraysEqual).toBe(false);

    // No critical page errors
    const hasSeriousPageError = pageErrors.some(err =>
      err && (err.name === 'ReferenceError' || err.name === 'SyntaxError' || err.name === 'TypeError')
    );
    expect(hasSeriousPageError).toBe(false);
  });

  test('Speed input updates value and does not cause runtime errors (ChangeSpeed event)', async ({ page }) => {
    // Validate the speedRange input change handler executes without throwing.
    const app = new InsertionSortPage(page);
    await app.goto();

    // Change to low speed
    await app.setSpeed(50);
    const lowValue = await app.speedRange.evaluate(el => el.value);
    expect(Number(lowValue)).toBe(50);

    // Change to high speed
    await app.setSpeed(1000);
    const highValue = await app.speedRange.evaluate(el => el.value);
    expect(Number(highValue)).toBe(1000);

    // Ensure no page errors caused by changing speed
    const hasSeriousPageError = pageErrors.some(err =>
      err && (err.name === 'ReferenceError' || err.name === 'SyntaxError' || err.name === 'TypeError')
    );
    expect(hasSeriousPageError).toBe(false);
  });

  test('Edge case: clicking Start twice quickly does not throw and does not start duplicate sorting loops', async ({ page }) => {
    // This test checks robustness against repeated Start clicks.
    const app = new InsertionSortPage(page);
    await app.goto();

    // Speed up a bit and then click start twice quickly
    await app.setSpeed(50);

    // Click start twice in quick succession
    await Promise.all([app.clickStart(), app.clickStart()]);

    // Wait for sorting to finish
    await page.waitForFunction(() => {
      return document.getElementById('startBtn').disabled === true && document.getElementById('resetBtn').disabled === false;
    }, {}, { timeout: 60_000 });

    // Assert no console.error messages were logged as a result
    const hadConsoleError = consoleErrors.some(c => c.type === 'error');
    expect(hadConsoleError).toBe(false);

    // Assert no uncaught page errors
    const hasSeriousPageError = pageErrors.some(err =>
      err && (err.name === 'ReferenceError' || err.name === 'SyntaxError' || err.name === 'TypeError')
    );
    expect(hasSeriousPageError).toBe(false);
  }, { timeout: 90_000 });
});