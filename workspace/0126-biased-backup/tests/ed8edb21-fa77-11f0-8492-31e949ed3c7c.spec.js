import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8edb21-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for interacting with the Virtual Memory Visualization page
class MemoryPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the important elements to be present
    await Promise.all([
      this.page.waitForSelector('#memoryCanvas'),
      this.page.waitForSelector('#startAnimation'),
    ]);
  }

  async startAnimation() {
    await this.page.click('#startAnimation');
  }

  // Returns the pages array from the page context
  async getPages() {
    return await this.page.evaluate(() => {
      // return a shallow copy to avoid transferring function references
      return window.pages ? window.pages.map(p => ({ id: p.id, loaded: p.loaded })) : null;
    });
  }

  // Returns the raw animationInterval value from the page context
  async getAnimationInterval() {
    return await this.page.evaluate(() => {
      return window.animationInterval;
    });
  }

  // Returns number of loaded pages
  async getLoadedCount() {
    return await this.page.evaluate(() => {
      if (!window.pages) return 0;
      return window.pages.filter(p => p.loaded).length;
    });
  }

  // Wait until at least expectedCount pages are loaded or timeout
  async waitForLoadedCount(expectedCount, timeout = 8000) {
    await this.page.waitForFunction(
      (count) => {
        return window.pages && window.pages.filter(p => p.loaded).length >= count;
      },
      expectedCount,
      { timeout }
    );
  }

  // Wait until all pages are loaded (or until timeout)
  async waitForAllLoaded(timeout = 15000) {
    const total = await this.page.evaluate(() => (window.pages ? window.pages.length : 0));
    await this.page.waitForFunction(
      (expectedTotal) => {
        return window.pages && window.pages.filter(p => p.loaded).length === expectedTotal;
      },
      total,
      { timeout }
    );
  }
}

test.describe('Virtual Memory Visualization - FSM validation', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events and capture them for assertions
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen to uncaught errors in the page
    page.on('pageerror', err => {
      // err is an Error object from the page context
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Attempt to close any remaining intervals by navigating away to stop background activity
    // We do not modify page globals; just navigate to about:blank to ensure a clean teardown.
    await page.goto('about:blank');
  });

  test('Initial Idle State: pages initialized and drawMemory executed', async ({ page }) => {
    // This test validates the S0_Idle state:
    // - On load, pages array exists with 8 pages
    // - All pages are initially loaded === false
    // - No animation interval is running
    // - No page errors are thrown during initial drawing

    const app = new MemoryPage(page);
    await app.goto();

    // Ensure the canvas exists and has been drawn to by checking that pages array is present
    const pages = await app.getPages();
    expect(Array.isArray(pages)).toBeTruthy();
    expect(pages.length).toBe(8);

    // All pages should be unloaded in the Idle initial drawing
    const unloadedCount = pages.filter(p => !p.loaded).length;
    expect(unloadedCount).toBe(8);

    // animationInterval should be undefined at initial idle state (not yet started)
    const animationInterval = await app.getAnimationInterval();
    // Browser may have undefined for not set; assert that it's either undefined or nully
    expect(animationInterval === undefined || animationInterval === null).toBeTruthy();

    // Ensure no runtime page errors occurred during load/draw
    expect(pageErrors.length).toBe(0);

    // Ensure console did not emit 'error' messages during initial load
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Start Animation transitions to Animating and pages load progressively', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Animating triggered by clicking #startAnimation.
    // It checks:
    // - Clicking starts an interval (animationInterval becomes a numeric id)
    // - Pages become loaded one by one roughly every second
    // - No page errors occur during animation

    const app = new MemoryPage(page);
    await app.goto();

    // Start animation
    await app.startAnimation();

    // Immediately after starting, animationInterval should be set (a numeric or handle)
    let animId = await app.getAnimationInterval();
    // In browsers setInterval returns a number (or object in some environments), assert it exists
    expect(animId).not.toBeUndefined();
    expect(animId).not.toBeNull();

    // Wait for the first page to load (should happen around ~1s)
    await app.waitForLoadedCount(1, 3000);
    let countAfter1 = await app.getLoadedCount();
    expect(countAfter1).toBeGreaterThanOrEqual(1);

    // Wait for the second page (by ~2s)
    await app.waitForLoadedCount(2, 4000);
    let countAfter2 = await app.getLoadedCount();
    expect(countAfter2).toBeGreaterThanOrEqual(2);

    // Continue to wait until all pages are loaded (8 pages). Use a generous timeout.
    await app.waitForAllLoaded(15000);
    const finalCount = await app.getLoadedCount();
    expect(finalCount).toBe(8);

    // After completion, animationInterval should have been cleared inside the animation code
    // The variable may still hold the numeric id, but interval should no longer change page state.
    // To assert this, sample the loaded count, wait a little, and confirm it's stable.
    const snapshot = await app.getLoadedCount();
    await page.waitForTimeout(2000); // wait 2s to ensure no further changes happen
    const snapshotLater = await app.getLoadedCount();
    expect(snapshotLater).toBe(snapshot);

    // No page errors and no console 'error' messages during animation
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('AnimationComplete transition: ensure onExit action clearInterval was invoked (behavioral check)', async ({ page }) => {
    // This test ensures the S1_Animating -> S0_Idle transition completes with all pages loaded,
    // and that animation stopped (no more changes).
    // We can't directly assert clearInterval changed the variable, but we can assert no further state changes occur.

    const app = new MemoryPage(page);
    await app.goto();

    // Start animation and wait for completion
    await app.startAnimation();
    await app.waitForAllLoaded(15000);

    // Confirm all pages are loaded
    const allPages = await app.getPages();
    expect(allPages.every(p => p.loaded)).toBeTruthy();

    // Confirm that after "completion", the pages remain loaded for a period (no ongoing interval toggling)
    const beforeStable = await app.getLoadedCount();
    await page.waitForTimeout(2500); // wait some time to ensure no more ticks
    const afterStable = await app.getLoadedCount();
    expect(beforeStable).toBe(afterStable);
    expect(afterStable).toBe(allPages.length);

    // Confirm again no pageerrors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: clicking Start Animation multiple times in quick succession', async ({ page }) => {
    // This test explores an edge case: user clicks Start Animation repeatedly while animation may be in progress.
    // The implementation does not clear previous interval before starting a new one, so we verify:
    // - The UI ends up in a consistent final state (all pages loaded)
    // - No uncaught errors occur as a result of multiple clicks

    const app = new MemoryPage(page);
    await app.goto();

    // Rapidly click the start button multiple times
    await Promise.all([
      app.startAnimation(),
      page.click('#startAnimation'),
      page.click('#startAnimation'),
    ]);

    // Because the implementation sets pages to false before each animatePages call,
    // the final behavior should still lead to all pages loaded eventually.
    await app.waitForAllLoaded(20000); // allow a longer timeout due to potential overlapping intervals
    const finalCount = await app.getLoadedCount();
    expect(finalCount).toBe(8);

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
    // Ensure no console 'error' messages were emitted
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('DOM and visual feedback sanity checks', async ({ page }) => {
    // This test validates a few DOM-level indicators of the simulation:
    // - The canvas element exists with the expected dimensions
    // - The start button has correct text content
    // - The header titles are present
    // - No JS runtime errors during these checks

    const app = new MemoryPage(page);
    await app.goto();

    // Check canvas dimensions
    const dimensions = await page.evaluate(() => {
      const c = document.getElementById('memoryCanvas');
      return c ? { width: c.width, height: c.height } : null;
    });
    expect(dimensions).not.toBeNull();
    expect(dimensions.width).toBe(800);
    expect(dimensions.height).toBe(400);

    // Start button exists and has expected label
    const buttonText = await page.textContent('#startAnimation');
    expect(buttonText.trim()).toBe('Start Animation');

    // Check headers
    const headerText = await page.textContent('header h1');
    expect(headerText).toContain('Virtual Memory Concept');

    const subHeaderText = await page.textContent('header h2');
    expect(subHeaderText).toContain('Observe the Allocation and Paging Process');

    // Ensure no page errors were emitted during DOM queries
    expect(pageErrors.length).toBe(0);
  });
});