import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8e3ee0-fa77-11f0-8492-31e949ed3c7c.html';

// The known array used by the page script so we can assert bar heights precisely.
const KNOWN_ARRAY = [4, 2, 7, 3, 5, 1, 6, 8];

test.describe('Two Pointers Visualization (FSM: Idle -> Visualizing)', () => {
  let consoleErrorHandler;
  let pageErrorHandler;
  let consoleErrors = [];
  let pageErrors = [];

  // Helper to attach listeners to capture runtime/page errors and console error messages.
  async function attachErrorListeners(page) {
    consoleErrors = [];
    pageErrors = [];

    consoleErrorHandler = (msg) => {
      if (msg.type && msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    };
    pageErrorHandler = (err) => {
      pageErrors.push(err);
    };

    page.on('console', consoleErrorHandler);
    page.on('pageerror', pageErrorHandler);
  }

  // Helper to detach listeners after test completes
  async function detachErrorListeners(page) {
    if (consoleErrorHandler) page.off('console', consoleErrorHandler);
    if (pageErrorHandler) page.off('pageerror', pageErrorHandler);
    consoleErrors = [];
    pageErrors = [];
  }

  // Helper to fetch current indices that have the pointer element.
  async function getPointerIndices(page) {
    return await page.evaluate(() => {
      const container = document.getElementById('arrayContainer');
      if (!container) return [];
      const bars = Array.from(container.querySelectorAll('.bar'));
      return bars
        .map((b, i) => (b.querySelector('.pointer') ? i : -1))
        .filter((idx) => idx !== -1);
    });
  }

  // Helper to fetch inline heights of bars in px string form (e.g., "120px")
  async function getBarHeights(page) {
    return await page.evaluate(() => {
      const container = document.getElementById('arrayContainer');
      if (!container) return [];
      return Array.from(container.querySelectorAll('.bar')).map((b) => b.style.height);
    });
  }

  test.beforeEach(async ({ page }) => {
    await attachErrorListeners(page);
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    // give a tiny moment for inline script to run createBars()
    await page.waitForTimeout(50);
  });

  test.afterEach(async ({ page }) => {
    // Assert there were no page errors or console.error messages during the test.
    // This validates that the page ran without uncaught exceptions.
    expect(consoleErrors, `console.error messages were found: ${consoleErrors.join('\n')}`).toHaveLength(0);
    expect(pageErrors, `pageerror events were found: ${pageErrors.map(e => String(e)).join('\n')}`).toHaveLength(0);

    await detachErrorListeners(page);
  });

  test('Initial Idle state: createBars() runs and DOM reflects initial pointers and bar heights', async ({ page }) => {
    // This test validates the S0_Idle state "entry action" createBars() executed on load.
    // Expectations:
    // - There are 8 bars (one per array element).
    // - Pointer elements exist on the leftmost (index 0) and rightmost (index 7) bars.
    // - Each bar has the expected inline height corresponding to value * 30 px.

    const barCount = await page.locator('#arrayContainer .bar').count();
    expect(barCount).toBe(KNOWN_ARRAY.length);

    const pointerIndices = await getPointerIndices(page);
    // Initially leftPointer = 0 and rightPointer = array.length - 1, so pointers at 0 and 7
    expect(pointerIndices.sort((a, b) => a - b)).toEqual([0, KNOWN_ARRAY.length - 1]);

    const heights = await getBarHeights(page);
    const expectedHeights = KNOWN_ARRAY.map((v) => `${v * 30}px`);
    expect(heights).toEqual(expectedHeights);
  });

  test('StartVisualization event transitions to Visualizing and pointers move over time (Timer transitions)', async ({ page }) => {
    // This test validates:
    // - Clicking #startBtn triggers StartVisualization transition.
    // - The visualization schedules repeated calls to visualize() via setTimeout (Timer transition).
    // - Pointers move closer together at ~1 second intervals: expected index sequences:
    //   initial (on click) -> 0 & 7 (createBars called immediately),
    //   after ~1s -> 1 & 6,
    //   after ~2s -> 2 & 5,
    //   after ~3s -> 3 & 4 (final).
    //
    // The implementation note: visualize() calls createBars() first, then increments pointers,
    // then schedules the next call only if leftPointer <= rightPointer after increment.
    // That means the DOM update for a new pointer position happens when visualize() runs (on timeout).

    // Click start button to trigger StartVisualization (S0 -> S1)
    await page.click('#startBtn');

    // Immediately after click visualize() was invoked synchronously, which created bars with pointers at indices 0 & 7.
    let indices = await getPointerIndices(page);
    expect(indices.sort((a, b) => a - b)).toEqual([0, KNOWN_ARRAY.length - 1]);

    // Wait for the first timer to fire (~1000ms). Add small buffer to account for scheduling.
    await page.waitForTimeout(1100);
    indices = await getPointerIndices(page);
    expect(indices.sort((a, b) => a - b)).toEqual([1, KNOWN_ARRAY.length - 2]);

    // Wait for the second timer -> pointers should be at 2 & 5
    await page.waitForTimeout(1100);
    indices = await getPointerIndices(page);
    expect(indices.sort((a, b) => a - b)).toEqual([2, KNOWN_ARRAY.length - 3]);

    // Wait for the third timer -> pointers should be at 3 & 4
    await page.waitForTimeout(1100);
    indices = await getPointerIndices(page);
    expect(indices.sort((a, b) => a - b)).toEqual([3, 4]);

    // Wait a bit longer to ensure no further timers/schedules occur (visualization should stop when pointers cross)
    await page.waitForTimeout(1200);
    indices = await getPointerIndices(page);
    // still 3 & 4
    expect(indices.sort((a, b) => a - b)).toEqual([3, 4]);
  }, 20000); // extended timeout to allow for multiple setTimeout cycles

  test('Clicking start while Visualizing restarts the visualization (reset pointers)', async ({ page }) => {
    // This test validates an important transition edge case:
    // - While the visualization is in progress, clicking the start button again should reset left/right pointers
    //   back to their initial positions and cause the visualization to start anew.
    //
    // Behavior expected:
    // 1. Click start -> initial pointers 0 & 7
    // 2. Wait ~1.5s -> pointers moved to 1 & 6
    // 3. Click start again -> pointers should immediately appear at 0 & 7 (visualize called synchronously)
    // 4. After ~1s -> pointers move to 1 & 6 again (visualization restarted)

    await page.click('#startBtn');

    // Immediately confirm initial state
    let indices = await getPointerIndices(page);
    expect(indices.sort((a, b) => a - b)).toEqual([0, KNOWN_ARRAY.length - 1]);

    // Wait 1.5s so the visualization has advanced to the next state (1 & 6)
    await page.waitForTimeout(1500);
    indices = await getPointerIndices(page);
    expect(indices.sort((a, b) => a - b)).toEqual([1, KNOWN_ARRAY.length - 2]);

    // Click start while visualization in-progress -> should reset pointers immediately
    await page.click('#startBtn');

    // After clicking, visualize() runs synchronously and creates bars for left=0 right=7
    indices = await getPointerIndices(page);
    expect(indices.sort((a, b) => a - b)).toEqual([0, KNOWN_ARRAY.length - 1]);

    // Wait for one timer tick to ensure it continues behaving as a fresh visualization
    await page.waitForTimeout(1100);
    indices = await getPointerIndices(page);
    expect(indices.sort((a, b) => a - b)).toEqual([1, KNOWN_ARRAY.length - 2]);
  });

  test('No runtime ReferenceError / SyntaxError / TypeError occurred during interactions (observing console and page errors)', async ({ page }) => {
    // This test explicitly observes and asserts that the runtime produced no uncaught page errors
    // or console.error messages during normal usage (load + click + some timeouts).

    // Interact with the page to exercise several code paths
    await page.click('#startBtn');
    await page.waitForTimeout(1200);
    await page.click('#startBtn');
    await page.waitForTimeout(1200);

    // After interactions we assert that no page-level errors were emitted.
    // The afterEach hook also asserts no errors; adding explicit local assertion here for clarity.
    expect(consoleErrors.length, `Expected no console.error outputs but found: ${consoleErrors.join('\n')}`).toBe(0);
    expect(pageErrors.length, `Expected no page errors but found: ${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);
  });
});