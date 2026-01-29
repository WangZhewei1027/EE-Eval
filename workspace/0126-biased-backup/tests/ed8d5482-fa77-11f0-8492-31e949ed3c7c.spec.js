import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d5482-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page Object for the Insertion Sort Visualization page.
 * Encapsulates common actions and queries to keep tests readable.
 */
class InsertionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.errors = [];
    this.consoleMessages = [];
    this._onPageError = (err) => {
      // Capture page errors as strings for assertions
      this.errors.push(err);
    };
    this._onConsole = (message) => {
      this.consoleMessages.push(message);
    };
  }

  async initListeners() {
    this.page.on('pageerror', this._onPageError);
    this.page.on('console', this._onConsole);
  }

  async removeListeners() {
    this.page.off('pageerror', this._onPageError);
    this.page.off('console', this._onConsole);
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the script had a chance to run and render initial bars.
    await this.page.waitForSelector('#bars .bar');
  }

  async getBarsCount() {
    return await this.page.locator('#bars .bar').count();
  }

  async getBarHeights() {
    const bars = this.page.locator('#bars .bar');
    const count = await bars.count();
    const heights = [];
    for (let i = 0; i < count; i++) {
      const h = await bars.nth(i).evaluate((el) => {
        // compute height in pixels (style.height should be like '123px')
        return window.getComputedStyle(el).height;
      });
      heights.push(h);
    }
    return heights;
  }

  async getStartButton() {
    return this.page.locator("button[onclick='startSorting()']");
  }

  async clickStart() {
    const button = await this.getStartButton();
    await button.click();
  }

  // Wait for next pageerror and return it (or timeout)
  async waitForPageError(options = {}) {
    return await this.page.waitForEvent('pageerror', options);
  }

  async snapshotBarsInnerHTML() {
    return await this.page.locator('#bars').innerHTML();
  }
}

/**
 * Tests for the Insertion Sort Visualization FSM and the provided HTML/JS implementation.
 *
 * Notes:
 * - The original implementation defines startSorting as a top-level const.
 *   Because top-level lexical declarations (let/const) do not create properties on window,
 *   the inline onclick="startSorting()" attribute tries to call a global named startSorting,
 *   which does not exist as a window property and will raise a ReferenceError at click time.
 *
 * - The tests intentionally load the page "as-is" and observe console/page errors
 *   rather than patching or defining globals. Tests assert that the ReferenceError occurs.
 */

test.describe('Insertion Sort Visualization - FSM validation', () => {
  test.beforeEach(async ({ page }) => {
    // No-op here; each test will create its own Page Object and init listeners.
  });

  test.afterEach(async ({ page }) => {
    // Ensure any leftover listeners are removed to avoid cross-test leakage.
    page.removeAllListeners?.();
  });

  test('Initial state S0_Idle: renderBars() ran and bars are present (Idle state)', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) entry action: renderBars()
    const app = new InsertionSortPage(page);
    await app.initListeners();

    await app.goto();

    // There should be 20 bars rendered as per the numberOfBars constant in the page.
    const count = await app.getBarsCount();
    expect(count).toBe(20);

    // Bars should have CSS class 'bar' and no 'active' or 'sorted' classes initially.
    const activeCount = await page.locator('#bars .bar.active').count();
    const sortedCount = await page.locator('#bars .bar.sorted').count();
    expect(activeCount).toBe(0);
    expect(sortedCount).toBe(0);

    // Heights should be present and parseable (e.g., '123px').
    const heights = await app.getBarHeights();
    expect(heights.length).toBe(20);
    for (const h of heights) {
      expect(typeof h).toBe('string');
      expect(h).toMatch(/^\d+px$/);
      // ensure minimum height at least 20px as implementation uses +20
      const num = parseInt(h.replace('px', ''), 10);
      expect(num).toBeGreaterThanOrEqual(20);
    }

    // The Start Sort button with the inline onclick handler should exist.
    const button = await app.getStartButton();
    await expect(button).toHaveCount(1);
    // Validate that the button text is visible
    await expect(button).toHaveText(/Start Sort/i);

    // There should be no page errors before clicking (initial script should run fine).
    expect(app.errors.length).toBe(0);

    await app.removeListeners();
  });

  test('Transition StartSort: clicking Start Sort triggers page error due to missing global startSorting (ReferenceError)', async ({ page }) => {
    // This test validates the StartSort event and expects a ReferenceError to occur
    // because startSorting is declared as a const and is not accessible as a global function
    // by the inline onclick attribute.
    const app = new InsertionSortPage(page);
    await app.initListeners();

    await app.goto();

    // Snapshot the bars' innerHTML before clicking to detect whether renderBars() was called as an exit action.
    const beforeHTML = await app.snapshotBarsInnerHTML();

    // Click the Start Sort button and wait for the pageerror event.
    // The click should cause a ReferenceError: startSorting is not defined
    const [errorEvent] = await Promise.all([
      app.waitForPageError({ timeout: 3000 }),
      app.clickStart()
    ]);

    // Assert that the captured page error mentions startSorting and is a ReferenceError.
    // Different browsers can produce slightly different error messages; be permissive.
    expect(errorEvent).toBeTruthy();
    const msg = errorEvent.message || String(errorEvent);
    expect(msg).toMatch(/startSorting/i);
    // Many browsers produce "is not defined" text; if present, assert that as well.
    expect(msg.toLowerCase()).toMatch(/(not defined|is not defined|undefined)/);

    // After the click that produced an error, verify that the DOM did not unexpectedly re-render.
    // Because the onclick couldn't invoke the defined const startSorting, the sorting loop never ran.
    const afterHTML = await app.snapshotBarsInnerHTML();
    expect(afterHTML).toBe(beforeHTML);

    // Bars should still be present and unmodified in count.
    const count = await app.getBarsCount();
    expect(count).toBe(20);

    await app.removeListeners();
  });

  test('Edge case: multiple rapid clicks produce multiple ReferenceErrors (robust error observation)', async ({ page }) => {
    // Validate behavior when user spam-clicks Start Sort: multiple page errors should be emitted.
    const app = new InsertionSortPage(page);
    await app.initListeners();

    await app.goto();

    // Perform three rapid clicks and collect errors. Each click should cause its own ReferenceError.
    const errorPromises = [];
    for (let i = 0; i < 3; i++) {
      errorPromises.push(app.waitForPageError({ timeout: 3000 }));
      // fire-and-forget click
      await app.clickStart();
    }

    // Await all errors
    const errors = await Promise.all(errorPromises);
    expect(errors.length).toBe(3);

    for (const err of errors) {
      const msg = err.message || String(err);
      expect(msg).toMatch(/startSorting/i);
    }

    // Ensure that there are at least three captured errors in the Page Object as well.
    expect(app.errors.length).toBeGreaterThanOrEqual(3);

    await app.removeListeners();
  });

  test('FSM observation: Attempted transition does not reach S1_Sorting (no active/sorted progression due to error)', async ({ page }) => {
    // This test attempts to validate that the transition from Idle to Sorting cannot complete.
    // If the S1_Sorting entry action (startSorting) cannot be invoked, we should not observe the visual
    // consequences of the Sorting state (bars being marked 'active' or 'sorted' over time).
    const app = new InsertionSortPage(page);
    await app.initListeners();

    await app.goto();

    // Confirm initial counts
    expect(await app.getBarsCount()).toBe(20);
    expect(await page.locator('#bars .bar.active').count()).toBe(0);
    expect(await page.locator('#bars .bar.sorted').count()).toBe(0);

    // Click to attempt to start sorting (will throw ReferenceError)
    await Promise.all([
      app.waitForPageError({ timeout: 3000 }),
      app.clickStart()
    ]);

    // Give a short time to see if any visual changes happen despite the error
    await page.waitForTimeout(500);

    // No bars should be marked active or sorted by the application's sorting logic.
    // (If the sorting logic had run, we'd expect some bars to become 'active' or 'sorted'.)
    expect(await page.locator('#bars .bar.active').count()).toBe(0);
    expect(await page.locator('#bars .bar.sorted').count()).toBe(0);

    // Ensure the bars still exist
    expect(await app.getBarsCount()).toBe(20);

    await app.removeListeners();
  });

  test('Resilience check: console messages and page errors captured and accessible for debugging', async ({ page }) => {
    // This test demonstrates that we capture both console messages and page errors
    // and that they can be examined after user interaction.
    const app = new InsertionSortPage(page);
    await app.initListeners();

    await app.goto();

    // There may be no console output in the implementation, but we assert our listener is active.
    // Trigger the known ReferenceError by clicking.
    const error = await Promise.race([
      app.waitForPageError({ timeout: 3000 }),
      (async () => {
        await app.clickStart();
        // fallback timeout if no error; return null
        await new Promise((r) => setTimeout(r, 1000));
        return null;
      })()
    ]);

    // We expect an error to be captured; if not, fail with a clear message (makes test output actionable).
    expect(error).not.toBeNull();
    if (error) {
      expect(error.message).toMatch(/startSorting/i);
    }

    // Console messages (if any) are captured as well (not required to be present).
    // We assert that we can access the collected consoleMessages array safely.
    expect(Array.isArray(app.consoleMessages)).toBe(true);

    await app.removeListeners();
  });
});