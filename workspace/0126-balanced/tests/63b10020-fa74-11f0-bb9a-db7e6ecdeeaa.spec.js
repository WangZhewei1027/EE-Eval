import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b10020-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Selection Sort Visualization page
class SelectionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Attach listeners to collect console and page errors for assertions
    this.page.on('console', (msg) => {
      // collect console messages for later inspection
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    this.page.on('pageerror', (err) => {
      // collect uncaught exceptions
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(BASE_URL);
    // Wait for initial render: the array-container should be populated
    await this.page.waitForSelector('#array-container .bar', { timeout: 2000 });
  }

  async getBarCount() {
    return await this.page.$$eval('#array-container .bar', (bars) => bars.length);
  }

  async getArrayValues() {
    // returns array of numbers displayed in the bars (text of span)
    return await this.page.$$eval('#array-container .bar span', (spans) =>
      spans.map((s) => Number(s.textContent.trim()))
    );
  }

  async clickStart() {
    await this.page.click('#btn-start');
  }

  async clickReset() {
    await this.page.click('#btn-reset');
  }

  async isStartDisabled() {
    return await this.page.$eval('#btn-start', (b) => b.disabled);
  }

  async isResetDisabled() {
    return await this.page.$eval('#btn-reset', (b) => b.disabled);
  }

  async waitForCurrentBar(timeout = 2000) {
    // Wait for an element with .bar.current to appear (renderArray sets this on entry to sorting)
    return await this.page.waitForSelector('#array-container .bar.current', { timeout });
  }

  async snapshotBarsClasses() {
    return await this.page.$$eval('#array-container .bar', (bars) =>
      bars.map((bar) => Array.from(bar.classList))
    );
  }
}

test.describe('Selection Sort Visualization - FSM states and transitions', () => {
  // Each test will create its own page and SelectionSortPage instance.
  test.beforeEach(async ({ page }) => {
    // No-op here; instances will be created inside tests so console capture is per-test.
  });

  test('Initial Idle state: initialize() runs on load and array is rendered', async ({ page }) => {
    // This test validates the initial "Idle" state S0_Idle entry action initialize()
    const app = new SelectionSortPage(page);
    await app.goto();

    // Validate that initialize() resulted in an array render
    const count = await app.getBarCount();
    expect(count).toBeGreaterThan(0);
    // The FSM description expects arraySize = 30; verify number of bars equals 30
    expect(count).toBe(30);

    // Start and Reset buttons should be enabled in Idle state
    expect(await app.isStartDisabled()).toBe(false);
    expect(await app.isResetDisabled()).toBe(false);

    // There should be no uncaught page errors on initial load
    expect(app.pageErrors.length).toBe(0);

    // Also ensure at least one bar's label matches its height-derived number (basic DOM sanity)
    const values = await app.getArrayValues();
    expect(values.length).toBe(30);
    for (const v of values) {
      expect(typeof v).toBe('number');
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  test('StartSorting event transitions to Sorting state: selectionSort() invoked and UI updates', async ({ page }) => {
    // This test validates clicking the Start Sorting button triggers the Sorting state S1_Sorting
    // and runs selectionSort() (entry action), which should disable controls and highlight bars.

    const app = new SelectionSortPage(page);
    await app.goto();

    // Capture array snapshot prior to starting
    const beforeValues = await app.getArrayValues();

    // Click Start - selectionSort() should be called; as part of entry it renders current/min immediately
    await app.clickStart();

    // Immediately after click, buttons should be disabled (sorting = true in implementation)
    await expect(async () => {
      const disabled = await app.isStartDisabled();
      if (!disabled) throw new Error('Start button not disabled yet');
    }).toPass();

    expect(await app.isStartDisabled()).toBe(true);
    expect(await app.isResetDisabled()).toBe(true);

    // The sorting routine calls renderArray({ current: i, min: min_idx, sortedIndices })
    // We should quickly see a bar with class 'current' or 'min'
    const currentBarHandle = await app.waitForCurrentBar(2000);
    expect(currentBarHandle).toBeTruthy();

    // Ensure that there is at least one bar with class 'min' as well, soon after starting
    const minBar = await page.$('#array-container .bar.min');
    expect(minBar).not.toBeNull();

    // clicking start again while sorting should not create a duplicate parallel sort (guard in code)
    // clicking again should not enable the button or cause errors. We'll click twice.
    await app.clickStart();
    await app.clickStart();

    // Still should remain disabled
    expect(await app.isStartDisabled()).toBe(true);

    // Verify no uncaught page errors were emitted during starting
    expect(app.pageErrors.length).toBe(0);

    // We won't wait for full sorting to complete (it can be long). Instead assert that some UI changed compared to initial snapshot:
    const midValues = await app.getArrayValues();
    // During sorting, values might or might not change immediately (swaps happen later),
    // but at minimum the DOM structure exists and lengths match
    expect(midValues.length).toBe(beforeValues.length);

    // Snapshot classes to ensure sorting highlights exist
    const classesSnapshot = await app.snapshotBarsClasses();
    // Expect presence of 'current' or 'min' in at least one bar's classes
    const hasHighlight = classesSnapshot.some((clsList) => clsList.includes('current') || clsList.includes('min') || clsList.includes('sorted'));
    expect(hasHighlight).toBe(true);
  });

  test('ResetArray event during sorting is ignored (edge case) and does not reinitialize array', async ({ page }) => {
    // This test validates the FSM behavior when Reset is triggered during Sorting:
    // Implementation prevents initialize() when sorting is true.
    const app = new SelectionSortPage(page);
    await app.goto();

    // Start sorting
    await app.clickStart();

    // Wait until we confirm sorting started (buttons disabled)
    await expect(async () => {
      const d = await app.isStartDisabled();
      if (!d) throw new Error('sorting not started yet');
    }).toPass();

    // Snapshot values while sorting
    const snapshotWhileSorting = await app.getArrayValues();

    // Attempt to click Reset while sorting - implementation should ignore it
    await app.clickReset();

    // Give a small delay to allow any possible (but disallowed) reinitialize to occur
    await page.waitForTimeout(300);

    // Buttons should remain disabled (still sorting)
    expect(await app.isStartDisabled()).toBe(true);
    expect(await app.isResetDisabled()).toBe(true);

    // Values should remain the same as before the reset click (no reinitialize)
    const snapshotAfterResetAttempt = await app.getArrayValues();
    expect(snapshotAfterResetAttempt.length).toBe(snapshotWhileSorting.length);
    // Confirm array contents haven't been replaced wholesale (deep equality)
    expect(snapshotAfterResetAttempt).toEqual(snapshotWhileSorting);

    // No uncaught errors should have been produced by this sequence
    expect(app.pageErrors.length).toBe(0);
  });

  test('ResetArray event when idle transitions to Idle and reinitializes the array', async ({ page }) => {
    // This test validates clicking Reset when not sorting calls initialize() and produces a (likely) different array.
    const app = new SelectionSortPage(page);
    await app.goto();

    // Ensure we are idle: buttons enabled
    expect(await app.isStartDisabled()).toBe(false);
    expect(await app.isResetDisabled()).toBe(false);

    // Snapshot current array
    const before = await app.getArrayValues();

    // We'll attempt Reset up to a few times to avoid flakiness if random generator produces identical array.
    let changed = false;
    let after = before;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await app.clickReset();
      // small wait for initialize() rendering to occur
      await page.waitForTimeout(200);
      after = await app.getArrayValues();
      // If arrays differ at any index, consider reset effective
      if (after.length !== before.length) {
        changed = true;
        break;
      }
      for (let i = 0; i < after.length; i++) {
        if (after[i] !== before[i]) {
          changed = true;
          break;
        }
      }
      if (changed) break;
      // If not changed, try again (very unlikely)
    }

    expect(after.length).toBe(before.length);
    expect(changed, 'Reset should produce a different randomized array within a few attempts').toBe(true);

    // After reset in idle, buttons remain enabled
    expect(await app.isStartDisabled()).toBe(false);
    expect(await app.isResetDisabled()).toBe(false);

    // Ensure there were no page errors during reset interaction
    expect(app.pageErrors.length).toBe(0);
  });

  test('Observes console logs and page errors during interactions (no unexpected runtime errors)', async ({ page }) => {
    // This test explicitly collects console messages and page errors during multiple interactions
    const app = new SelectionSortPage(page);
    await app.goto();

    // Interact: start -> short wait -> attempt reset (ignored) -> do nothing else
    await app.clickStart();
    // Wait for quick render update
    await app.waitForCurrentBar(2000);

    // Attempt reset which should be ignored during sorting
    await app.clickReset();
    await page.waitForTimeout(300);

    // We will not wait for full sort; instead reload to get back to Idle and ensure initialize runs on reload
    await page.reload();
    // Wait for initial render
    await page.waitForSelector('#array-container .bar', { timeout: 2000 });

    // Now check captured console messages for any console.error types
    const errors = app.consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    // We expect no console errors or warnings for this well-behaved app
    expect(errors.length).toBe(0);

    // Also expect no uncaught page errors
    expect(app.pageErrors.length).toBe(0);
  });
});