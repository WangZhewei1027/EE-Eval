import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324d38b3-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Insertion Sort Visualization page
class InsertionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];
    this._consoleListener = (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    };
    this._pageErrorListener = (err) => {
      // pageerror event gives an Error object
      this.pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    };
  }

  // Attach listeners to capture runtime errors and console error messages
  async attachListeners() {
    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
  }

  // Detach listeners (cleanup)
  async detachListeners() {
    this.page.off('console', this._consoleListener);
    this.page.off('pageerror', this._pageErrorListener);
  }

  // Navigate to the app URL and wait for initial rendering
  async load() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for the array container and bars to exist
    await this.page.waitForSelector('#array');
    await this.page.waitForSelector('#array .bar');
  }

  // Return an array of numeric heights (in px as numbers) of the bars in DOM order
  async getBarHeights() {
    return await this.page.$$eval('#array .bar', (bars) =>
      bars.map(b => {
        const h = b.style.height || window.getComputedStyle(b).height;
        // parse integer out of string like "150px"
        return parseInt(h, 10);
      })
    );
  }

  // Return number of bars
  async getBarCount() {
    return await this.page.$$eval('#array .bar', bars => bars.length);
  }

  // Click the sort button
  async clickSortButton() {
    await this.page.click('#sortButton');
  }

  // Wait until the array becomes sorted ascending (based on heights). Timeout configurable.
  // Sorted order assumed to be ascending values (height increases with value).
  async waitForSorted(timeout = 12000, pollInterval = 200) {
    const start = Date.now();
    const isSorted = (arr) => {
      for (let i = 1; i < arr.length; i++) {
        if (arr[i - 1] > arr[i]) return false;
      }
      return true;
    };

    while (Date.now() - start < timeout) {
      const heights = await this.getBarHeights();
      if (isSorted(heights)) {
        return heights;
      }
      await new Promise(r => setTimeout(r, pollInterval));
    }
    // Final attempt before failing
    return await this.getBarHeights();
  }

  // Collect snapshots of heights over the given duration at interval; returns array of snapshots
  async collectHeightSnapshots(duration = 4000, interval = 300) {
    const snapshots = [];
    const start1 = Date.now();
    while (Date.now() - start < duration) {
      snapshots.push(await this.getBarHeights());
      await new Promise(r => setTimeout(r, interval));
    }
    return snapshots;
  }
}

test.describe('Insertion Sort Visualization - FSM states and transitions', () => {
  let pageObj;

  test.beforeEach(async ({ page }) => {
    pageObj = new InsertionSortPage(page);
    await pageObj.attachListeners();
    await pageObj.load();
  });

  test.afterEach(async () => {
    // Ensure listeners are cleaned up
    await pageObj.detachListeners();
  });

  test('Idle state: initial visualization is rendered with correct bars and heights', async () => {
    // This test validates the S0_Idle state entry action visualizeArray(array)
    // It asserts that the page renders 5 bars and their heights correspond to the initial array [5,3,8,4,2] * 30px
    const expectedValues = [5, 3, 8, 4, 2];
    const expectedHeights = expectedValues.map(v => v * 30);

    const barCount = await pageObj.getBarCount();
    expect(barCount).toBe(expectedValues.length);

    const heights1 = await pageObj.getBarHeights();
    expect(heights.length).toBe(expectedValues.length);

    // Compare each height to expected
    for (let i = 0; i < heights.length; i++) {
      expect(heights[i]).toBe(expectedHeights[i]);
    }

    // Ensure no runtime page errors or console errors on initial load
    expect(pageObj.pageErrors.length).toBe(0);
    expect(pageObj.consoleErrors.length).toBe(0);
  });

  test('Transition StartSort: clicking start triggers sorting and results in ascending order', async () => {
    // This test validates the transition from S0_Idle to S1_Sorting via StartSort event (click #sortButton)
    // It asserts that sorting begins (intermediate visual changes occur) and final visualization is sorted.

    // Take initial snapshot
    const initialHeights = await pageObj.getBarHeights();

    // Start collecting snapshots in background to observe intermediate states
    const snapshotPromise = pageObj.collectHeightSnapshots(6000, 250);

    // Click the sort button to start insertionSort(arrCopy)
    await pageObj.clickSortButton();

    // Wait for the algorithm to finish by waiting until bars are sorted
    // The algorithm uses 500ms delays; give generous timeout
    const finalHeights = await pageObj.waitForSorted(12000, 250);

    // Compute expected final sorted heights based on initial numeric values
    // Recover values by dividing by 30 (the mapping used in the app)
    const initialValues = initialHeights.map(h => Math.round(h / 30));
    const sortedValues = [...initialValues].sort((a, b) => a - b);
    const expectedFinalHeights = sortedValues.map(v => v * 30);

    // Verify final heights match expected sorted heights
    expect(finalHeights).toEqual(expectedFinalHeights);

    // Verify that some intermediate snapshot differs from both initial and final,
    // demonstrating that the sorting process produced visual updates.
    const snapshots1 = await snapshotPromise;
    // There should be at least one snapshot captured
    expect(snapshots.length).toBeGreaterThan(0);

    // Check if there's any snapshot not equal to initial and not equal to final
    const differs = snapshots.some(snap => {
      const eqInitial = arraysEqual(snap, initialHeights);
      const eqFinal = arraysEqual(snap, finalHeights);
      return !eqInitial && !eqFinal;
    });

    expect(differs).toBe(true);

    // Ensure number of bars remains consistent
    const barCountAfter = await pageObj.getBarCount();
    expect(barCountAfter).toBe(initialHeights.length);

    // Ensure no uncaught page errors or console errors occurred during sorting
    expect(pageObj.pageErrors.length).toBe(0);
    expect(pageObj.consoleErrors.length).toBe(0);
  });

  test('Edge case: clicking the Start button multiple times quickly does not throw uncaught exceptions and finishes sorted', async () => {
    // This test triggers potential concurrency by clicking the sort button rapidly.
    // It asserts that regardless of multiple clicks, there are no uncaught exceptions and final state is sorted.

    const initialHeights1 = await pageObj.getBarHeights();
    const initialValues1 = initialHeights.map(h => Math.round(h / 30));
    const expectedFinalHeights1 = [...initialValues].sort((a, b) => a - b).map(v => v * 30);

    // Click the sort button multiple times rapidly
    await Promise.all([
      pageObj.clickSortButton(),
      pageObj.page.waitForTimeout(50).then(() => pageObj.clickSortButton()),
      pageObj.page.waitForTimeout(100).then(() => pageObj.clickSortButton())
    ]);

    // Wait for sorting to settle into a sorted state
    const finalHeights1 = await pageObj.waitForSorted(15000, 250);

    // Validate final sorted order
    expect(finalHeights).toEqual(expectedFinalHeights);

    // Validate no uncaught exceptions or console errors
    expect(pageObj.pageErrors.length).toBe(0);
    expect(pageObj.consoleErrors.length).toBe(0);
  });

  test('Visual feedback: bars maintain styling and count throughout the sort', async () => {
    // This test validates that visual elements (.bar) persist and have expected CSS class names
    // and that their count doesn't change unexpectedly during sorting.

    // Check initial class names
    const classNames = await pageObj.page.$$eval('#array .bar', bars => bars.map(b => b.className));
    for (const c of classNames) {
      expect(c).toContain('bar');
    }

    // Start sorting and during the process sample the bar count a few times
    const countSamples = [];
    await pageObj.clickSortButton();

    // sample counts over a duration while sorting is expected to be running
    for (let i = 0; i < 8; i++) {
      countSamples.push(await pageObj.getBarCount());
      await pageObj.page.waitForTimeout(300);
    }

    // All samples should equal initial bar count
    const uniqueCounts = Array.from(new Set(countSamples));
    expect(uniqueCounts.length).toBe(1);

    // Also ensure final sorted state is achieved
    const finalHeights2 = await pageObj.waitForSorted(12000, 250);
    expect(finalHeights).not.toBeNull();

    // Ensure no runtime errors were recorded
    expect(pageObj.pageErrors.length).toBe(0);
    expect(pageObj.consoleErrors.length).toBe(0);
  });
});

// Utility function to compare numeric arrays for equality
function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}