import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d7b91-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the Counting Sort Visualization page
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#startButton');
    this.barsContainer = page.locator('#barsContainer');
    this.bars = page.locator('#barsContainer .bar');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickStart() {
    await this.startButton.click();
  }

  async barsCount() {
    return this.bars.count();
  }

  async getBarHeights() {
    return this.page.$$eval('#barsContainer .bar', nodes => nodes.map(n => n.style.height));
  }

  async allBarsHaveSortedClass() {
    return this.page.$$eval('#barsContainer .bar', nodes => nodes.every(n => n.classList.contains('bar-sorted')));
  }
}

test.describe('Counting Sort Visualization - FSM states and transitions', () => {
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    // Collect runtime page errors and console.error messages for assertions
    pageErrors = [];
    consoleErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test('Idle state: initial page load should show Start button and no bars rendered', async ({ page }) => {
    // This test validates the initial S0_Idle conditions as implemented in the page:
    // - The Start Sorting button exists and is visible
    // - The bars container exists and initially has no .bar children (implementation does not auto-render on load)
    // - No page runtime errors or console.error messages occurred during initial load
    const app = new CountingSortPage(page);
    await app.goto();

    await expect(app.startButton).toBeVisible();
    await expect(app.barsContainer).toBeVisible();

    const initialBarsCount = await app.barsCount();
    // The implementation does not call renderBars on load (render is triggered on click), so expect 0 bars initially.
    expect(initialBarsCount).toBe(0);

    // Verify the startButton.onclick handler is assigned (evidence of event binding)
    const onclickType = await page.evaluate(() => typeof document.getElementById('startButton').onclick);
    expect(onclickType).toBe('function');

    // Ensure no unexpected page errors or console.error on load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('StartSorting transition: clicking Start Sorting renders and completes counting sort', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Sorting when the user clicks #startButton:
    // - After clicking, the bars container is populated
    // - Final arrangement matches the expected sorted heights
    // - All bars are marked with the .bar-sorted class at the end of sorting (sortedIndex final)
    const app = new CountingSortPage(page);
    await app.goto();

    // Ensure no bars/sorted classes before the click
    let beforeSortedClassExists = await page.$$eval('#barsContainer .bar', nodes => nodes.some(n => n.classList.contains('bar-sorted')));
    expect(beforeSortedClassExists).toBe(false);

    // Click the start button to trigger render and countingSort
    await app.clickStart();

    // countingSort is synchronous in implementation; after click completes, sorting should be finished.
    const finalBarsCount = await app.barsCount();
    expect(finalBarsCount).toBe(10); // inputArray has 10 elements

    // Verify final bar heights correspond to the sorted array [1,2,3,3,4,5,6,7,8,9] * 30px
    const heights = await app.getBarHeights(); // e.g. ['30px','60px', ...]
    const numericHeights = heights.map(h => parseFloat(h));
    const expectedSorted = [1,2,3,3,4,5,6,7,8,9].map(v => v * 30);
    expect(numericHeights).toEqual(expectedSorted);

    // Verify all bars have the 'bar-sorted' class after sorting completes (sortedIndex should be final index)
    const allSorted = await app.allBarsHaveSortedClass();
    expect(allSorted).toBe(true);

    // Ensure no runtime pageerrors or console.error messages occurred during the interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Multiple clicks: clicking Start multiple times re-runs sorting without throwing runtime errors', async ({ page }) => {
    // This test validates repeated transitions and idempotency under repeated user clicks.
    const app = new CountingSortPage(page);
    await app.goto();

    // First click
    await app.clickStart();
    const firstCount = await app.barsCount();
    expect(firstCount).toBe(10);
    const firstSorted = await app.allBarsHaveSortedClass();
    expect(firstSorted).toBe(true);

    // Second click - should re-render and re-sort; still should end up sorted and not throw errors
    await app.clickStart();
    const secondCount = await app.barsCount();
    expect(secondCount).toBe(10);
    const secondSorted = await app.allBarsHaveSortedClass();
    expect(secondSorted).toBe(true);

    // No unexpected runtime errors from repeated interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case & error scenario: calling countingSort(null) should raise a TypeError inside the page', async ({ page }) => {
    // This test intentionally invokes countingSort with an invalid argument to surface runtime errors
    // and assert that the environment lets the TypeError happen naturally (we do NOT patch the app).
    await page.goto(APP_URL);

    // Attempt to call countingSort(null) inside page context and capture the thrown error message.
    const result = await page.evaluate(() => {
      try {
        // This call is expected to throw (e.g., spread operator on null is invalid)
        countingSort(null);
        return { ok: true, message: null };
      } catch (e) {
        // Return the error name and message for assertion
        return { ok: false, name: e && e.name, message: e && e.toString() };
      }
    });

    // We expect an error occurred and it is of type TypeError (or at least the call failed).
    expect(result.ok).toBe(false);
    // Some engines may include differing text; ensure we at least observed an Error name or message.
    expect(typeof result.name).toBe('string');
    // Prefer checking for TypeError name if available
    if (result.name) {
      expect(result.name.toLowerCase()).toContain('type');
    } else {
      // fallback: ensure some message is present
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  test('renderBars can handle an empty array (edge-case) and produce zero bars', async ({ page }) => {
    // This test calls renderBars([]) and ensures the DOM reflects zero bars after the call.
    const app = new CountingSortPage(page);
    await app.goto();

    // Call renderBars with an empty array in the page context
    await page.evaluate(() => {
      // Call the function as implemented; if it throws, the evaluate will reject and the test will fail.
      renderBars([]);
    });

    const finalCount = await app.barsCount();
    expect(finalCount).toBe(0);

    // No runtime page errors or console.error occurred during this call
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Detect unexpected runtime errors or console.error messages during a sequence of interactions', async ({ page }) => {
    // This test performs a series of typical interactions and then asserts that no unexpected runtime
    // errors or console.error messages were recorded by our page listeners.
    const app = new CountingSortPage(page);
    await app.goto();

    // Perform interactions: click start, then call renderBars([]) to clear, then click start again
    await app.clickStart();
    await page.evaluate(() => renderBars([]));
    await app.clickStart();

    // Ensure final state is sorted again
    const finalCount = await app.barsCount();
    expect(finalCount).toBe(10);
    const finalSorted = await app.allBarsHaveSortedClass();
    expect(finalSorted).toBe(true);

    // Assert that our listeners did not capture any page errors or console.errors during these interactions.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});