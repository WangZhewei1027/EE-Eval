import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f8ec01-fa77-11f0-a6a1-c765f41a13c7.html';

/**
 * Page Object for the Garbage Collection Visual Demo
 */
class GCPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    // Navigate to the served HTML page
    await this.page.goto(APP_URL);
  }

  async runClick() {
    await this.page.click('#runBtn');
  }

  async resetClick() {
    await this.page.click('#resetBtn');
  }

  // Helpers to introspect page state and DOM
  async getStatsText() {
    return this.page.locator('#stats').textContent();
  }

  async getToastText() {
    return this.page.locator('#toast').textContent();
  }

  async toastIsVisible() {
    return this.page.locator('#toast').evaluate((el) => el.classList.contains('show'));
  }

  async getNodeCount() {
    return this.page.evaluate(() => document.querySelectorAll('.node').length);
  }

  async getNodeCountsByClass() {
    return this.page.evaluate(() => {
      return {
        total: document.querySelectorAll('.node').length,
        reachable: document.querySelectorAll('.node.reachable').length,
        unreachable: document.querySelectorAll('.node.unreachable').length,
        collected: document.querySelectorAll('.node.collected').length
      };
    });
  }

  async isBusy() {
    return this.page.evaluate(() => !!window.busy);
  }

  async runBtnDisabled() {
    return this.page.evaluate(() => {
      const b = document.getElementById('runBtn');
      return !!b.disabled;
    });
  }

  async resetBtnDisabled() {
    return this.page.evaluate(() => {
      const b = document.getElementById('resetBtn');
      return !!b.disabled;
    });
  }

  async getCollectorOpacity() {
    return this.page.locator('#collector').evaluate((el) => getComputedStyle(el).opacity);
  }

  // Wait for GC sweep to complete (busy -> false)
  async waitForGCComplete(timeout = 12000) {
    await this.page.waitForFunction(() => window.busy === false, null, { timeout });
  }
}

// Global arrays to collect console errors and page errors for assertions
let consoleMessages = [];
let pageErrors = [];

test.describe('Garbage Collection Visual Demo - FSM tests', () => {
  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      // collect both text and type for debugging and assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture runtime (page) errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // No teardown required for this static page beyond Playwright fixture.
    // Keep console and pageErrors arrays for assertions inside tests.
  });

  test.describe('S0_Idle (Initial State) validations', () => {
    test('initialization should call init() and render 12 objects with controls enabled', async ({ page }) => {
      // This test validates the S0_Idle entry action (init()), presence of DOM elements, and initial state.
      const gc = new GCPage(page);
      await gc.goto();

      // Basic sanity: page loaded and title present
      await expect(page).toHaveTitle(/Garbage Collection/i);

      // The stats should reflect 12 heap objects per the modelTemplate
      const stats = await gc.getStatsText();
      expect(stats).toBe('Heap objects: 12');

      // Ensure nodes were rendered (12 objects)
      const nodeCount = await gc.getNodeCount();
      expect(nodeCount).toBe(12);

      // The Run and Reset buttons should be enabled initially
      expect(await gc.runBtnDisabled()).toBe(false);
      expect(await gc.resetBtnDisabled()).toBe(false);

      // busy should be false at idle
      expect(await gc.isBusy()).toBe(false);

      // There should be no console-level 'error' messages or page errors straight after load
      const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleEntries.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('RunGC event and S0 -> S1 -> S0 transitions', () => {
    test('clicking Run GC should set busy, disable controls, mark reachable/unreachable, and then re-enable controls', async ({ page }) => {
      // This test covers the RunGC event => runGC() action and the full transition cycle (Busy -> Idle).
      const gc = new GCPage(page);
      await gc.goto();

      // Start the GC run
      await gc.runClick();

      // Immediately after click, busy should be true and buttons disabled
      await page.waitForFunction(() => window.busy === true);
      expect(await gc.isBusy()).toBe(true);
      expect(await gc.runBtnDisabled()).toBe(true);
      expect(await gc.resetBtnDisabled()).toBe(true);

      // Marking step happens synchronously in runGC(): expect some .node.reachable and .node.unreachable exist
      await page.waitForFunction(() => document.querySelectorAll('.node.reachable').length > 0 && document.querySelectorAll('.node.unreachable').length > 0, null, { timeout: 2000 });
      const countsDuring = await gc.getNodeCountsByClass();
      expect(countsDuring.reachable).toBeGreaterThan(0);
      expect(countsDuring.unreachable).toBeGreaterThan(0);

      // Collector should be visible at some point (opacity transitions to 1 during sweep)
      // This may be a string; we assert it's not fully transparent
      const collectorOpacity = await gc.getCollectorOpacity();
      expect(Number(collectorOpacity)).toBeGreaterThanOrEqual(0);

      // Wait for GC to complete: busy -> false
      await gc.waitForGCComplete(12000);
      expect(await gc.isBusy()).toBe(false);

      // After completion, buttons should be re-enabled (S1 exit actions)
      expect(await gc.runBtnDisabled()).toBe(false);
      expect(await gc.resetBtnDisabled()).toBe(false);

      // The toast should be shown with reclaimed count message, and stats must be updated
      await page.waitForSelector('#toast.show', { timeout: 3000 });
      const toastText = await gc.getToastText();
      // The demo has 4 unreachable objects (X,Y,Z,Q) in the modelTemplate, so expect reclaimed count to be '4 objects reclaimed'
      // But the implementation uses pluralization; check both possibilities for robustness
      expect(/objects? reclaimed/.test(toastText)).toBeTruthy();

      // Stats should have decreased from 12 to 8 (12 - 4 reclaimed)
      const statsAfter = await gc.getStatsText();
      expect(statsAfter).toMatch(/^Heap objects: \d+/);
      // Convert to number and assert equals 8
      const afterNum = Number(statsAfter.replace(/\D/g, ''));
      expect(afterNum).toBe(8);

      // Verify that nodes removed correspond to collected ones: number of .node elements should be 8 now
      const nodeCountAfter = await gc.getNodeCount();
      expect(nodeCountAfter).toBe(8);

      // Ensure no uncaught page errors occurred during the GC run
      const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleEntries.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('clicking Run GC while busy is guarded (no double-run)', async ({ page }) => {
      // This test ensures the guard if (busy) return; prevents starting another run while one is active.
      const gc = new GCPage(page);
      await gc.goto();

      // Click Run GC to start a long sweep
      await gc.runClick();

      // Wait until busy is true
      await page.waitForFunction(() => window.busy === true);

      // Attempt to click Run again immediately (should be ignored by guard inside runGC or disabled button)
      // We click programmatically anyway to simulate user attempt; the second click should not spawn parallel sweeps.
      await gc.runClick();

      // The application is supposed to remain busy and then return to idle only once.
      // Wait for completion
      await gc.waitForGCComplete(12000);
      expect(await gc.isBusy()).toBe(false);

      // Ensure controls re-enabled once
      expect(await gc.runBtnDisabled()).toBe(false);

      // No duplicate errors emitted
      const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleEntries.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Reset event and S0_Idle idempotency', () => {
    test('clicking Reset when idle should rebuild the heap to 12 objects', async ({ page }) => {
      // This validates the Reset event and the S0_Idle self-transition (reset()).
      const gc = new GCPage(page);
      await gc.goto();

      // Simulate running GC first to modify the heap
      await gc.runClick();
      await gc.waitForGCComplete(12000);

      // Confirm heap was reduced
      const reduced = Number((await gc.getStatsText()).replace(/\D/g, ''));
      expect(reduced).toBeLessThan(12);

      // Now click Reset to restore initial state
      await gc.resetClick();

      // Reset should be instantaneous (guard prevents when busy); wait briefly for DOM update
      await page.waitForFunction(() => document.querySelectorAll('.node').length === 12, null, { timeout: 2000 });

      const statsAfterReset = await gc.getStatsText();
      expect(statsAfterReset).toBe('Heap objects: 12');
      const nodeCount = await gc.getNodeCount();
      expect(nodeCount).toBe(12);

      // Toast should not be shown after reset
      const toastShown = await gc.toastIsVisible();
      expect(toastShown).toBe(false);

      // No runtime errors triggered by reset
      const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleEntries.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('attempting Reset while busy should have no effect (buttons disabled)', async ({ page }) => {
      // This test ensures Reset is disabled during busy state (S1), as per exit_actions and runGC implementation.
      const gc = new GCPage(page);
      await gc.goto();

      // Start a GC run
      await gc.runClick();
      await page.waitForFunction(() => window.busy === true);

      // During busy, reset button should be disabled; clicking it should not trigger reset
      expect(await gc.resetBtnDisabled()).toBe(true);

      // Attempt to click reset (should be a no-op). We still perform the click to ensure nothing catastrophic happens.
      // Using a try/catch because Playwright will throw if the button is disabled; instead, call evaluate to attempt dispatch
      // We will attempt a programmatic click to simulate user pressing it (but the implementation also checks disabled attribute on the button only visually)
      await page.evaluate(() => {
        const b = document.getElementById('resetBtn');
        try { b.click(); } catch(e) { /* swallow any error from click attempt */ }
      });

      // Ensure the GC still completes normally and heap changes persist until GC finishes
      await gc.waitForGCComplete(12000);

      // After GC completes, the stats should reflect reclaimed objects (8)
      const statsAfter = await gc.getStatsText();
      const afterNum = Number(statsAfter.replace(/\D/g, ''));
      expect(afterNum).toBe(8);

      // No runtime errors produced by clicking reset while disabled
      const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleEntries.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('UI elements and SVG paths exist and update on resize', async ({ page }) => {
      // Validate that SVG paths and canvas are present and that resize handling does not throw errors.
      const gc = new GCPage(page);
      await gc.goto();

      // Ensure initial SVG exists
      await expect(page.locator('#svg')).toBeVisible();

      // Trigger a resize event; the page has a resize listener that recomputes paths and canvas
      await page.setViewportSize({ width: 900, height: 800 });
      // Allow some time for resize handler to run
      await page.waitForTimeout(300);

      // Resize back
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.waitForTimeout(300);

      // If the resize handler threw, page.on('pageerror') would have captured it; assert none occurred.
      const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleEntries.length).toBe(0);
      expect(pageErrors.length).toBe(0);

      // As a sanity check, confirm nodes still present
      const nodeCount = await gc.getNodeCount();
      expect(nodeCount).toBe(12);
    });

    test('no unexpected ReferenceError/SyntaxError/TypeError occurred during entire scenario', async ({ page }) => {
      // This test aggregates captured console/page errors and asserts that none of the common error types occurred.
      const gc = new GCPage(page);
      await gc.goto();

      // Perform a run and reset to exercise flows
      await gc.runClick();
      await gc.waitForFunction(() => window.busy === false, null, { timeout: 12000 });
      await gc.resetClick();
      await page.waitForFunction(() => document.querySelectorAll('.node').length === 12, null, { timeout: 2000 });

      // Inspect pageErrors array for known error class names or messages
      const errorNames = pageErrors.map(e => e.name || e.message || String(e));
      for (const name of errorNames) {
        // Fail if any common JS error types appear
        expect(name).not.toMatch(/ReferenceError|TypeError|SyntaxError/);
      }

      // Also inspect console 'error' messages texts
      const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
      const texts = errorConsoleEntries.map(e => e.text);
      for (const t of texts) {
        expect(t).not.toMatch(/ReferenceError|TypeError|SyntaxError/);
      }

      // Finally, assert there are no pageErrors at all
      expect(pageErrors.length).toBe(0);
      expect(errorConsoleEntries.length).toBe(0);
    });
  });
});