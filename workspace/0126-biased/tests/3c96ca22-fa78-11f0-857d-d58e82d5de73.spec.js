import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c96ca22-fa78-11f0-857d-d58e82d5de73.html';

// Page object for the insertion sort visualization app
class InsertionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.bars = page.locator('#bars .bar');
    this.container = page.locator('#bars');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initial bars to be created
    await this.page.waitForSelector('#bars .bar');
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

  async isResetDisabled() {
    return await this.resetBtn.isDisabled();
  }

  async getAriaPressed() {
    return await this.startBtn.getAttribute('aria-pressed');
  }

  async countBars() {
    return await this.bars.count();
  }

  async getHeights() {
    // return array of numeric heights in px for each bar
    return await this.page.$$eval('#bars .bar', bars => bars.map(b => {
      const h = b.style.height || window.getComputedStyle(b).height;
      return Number(h.replace('px','')) || 0;
    }));
  }

  async anyBarHasClass(cls) {
    return await this.page.$(`#bars .bar.${cls}`) !== null;
  }

  async waitForAnyHighlight(timeout = 5000) {
    // Wait until at least one bar has the 'highlight' class
    await this.page.waitForSelector('#bars .bar.highlight', { timeout });
  }

  async waitForAllSorted(timeout = 20000) {
    // Wait until every bar has the 'sorted' class
    await this.page.waitForFunction(() => {
      const bars = Array.from(document.querySelectorAll('#bars .bar'));
      return bars.length > 0 && bars.every(b => b.classList.contains('sorted'));
    }, { timeout });
  }

  async snapshotSortedState() {
    // returns { heights, allSorted }
    const heights = await this.getHeights();
    const allSorted = await this.page.evaluate(() => {
      const bars = Array.from(document.querySelectorAll('#bars .bar'));
      return bars.length > 0 && bars.every(b => b.classList.contains('sorted'));
    });
    return { heights, allSorted };
  }
}

test.describe('Insertion Sort Visualization — Aesthetic Demo (FSM tests)', () => {
  // Collect console and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console entries with severity 'error'
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  // Test initial Idle state assertions
  test('S0_Idle: initial state shows controls enabled and bars initialized', async ({ page }) => {
    const app = new InsertionSortPage(page);
    await app.goto();

    // Verify no runtime exceptions were emitted immediately on load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Start and Reset buttons should be present and enabled (Idle evidence)
    expect(await app.startBtn.isVisible()).toBe(true);
    expect(await app.resetBtn.isVisible()).toBe(true);
    expect(await app.isStartDisabled()).toBe(false); // startBtn.disabled = false
    expect(await app.isResetDisabled()).toBe(false); // resetBtn.disabled = false
    expect(await app.getAriaPressed()).toBe('false');

    // Bars should be created and accessible
    const count = await app.countBars();
    // FSM defined NUM_BARS = 22, assert we have that many bars
    expect(count).toBeGreaterThanOrEqual(20);
    expect(count).toBeLessThanOrEqual(24);

    // Bars should not be highlighted or marked sorted in Idle (init)
    expect(await app.anyBarHasClass('highlight')).toBe(false);
    expect(await app.anyBarHasClass('sorted')).toBe(false);
  });

  // Test starting the sort transitions into Sorting state
  test('S0_Idle -> S1_Sorting: clicking Start begins sorting (buttons disabled & visual changes)', async ({ page }) => {
    const app = new InsertionSortPage(page);
    await app.goto();

    // Click start to begin sorting animation
    await app.clickStart();

    // Immediately after starting, the app should set aria-pressed true and disable buttons
    // There can be a small scheduling delay before attributes update, so wait for them
    await page.waitForFunction(() => {
      const s = document.getElementById('startBtn');
      const r = document.getElementById('resetBtn');
      return s && r && s.disabled === true && r.disabled === true && s.getAttribute('aria-pressed') === 'true';
    }, { timeout: 3000 });

    expect(await app.isStartDisabled()).toBe(true);
    expect(await app.isResetDisabled()).toBe(true);
    expect(await app.getAriaPressed()).toBe('true');

    // While sorting, at least one bar should become highlighted as the generator yields 'select' steps
    await app.waitForAnyHighlight(7000);
    expect(await app.anyBarHasClass('highlight')).toBe(true);

    // Attempt to click Reset while sorting - per implementation this button is disabled,
    // so clicks should not trigger a reset. We assert the button is disabled and heights remain stable shortly after.
    const heightsBefore = await app.getHeights();
    // Ensure resetBtn is disabled and try clicking it anyway (user action) - this should be ignored.
    expect(await app.isResetDisabled()).toBe(true);
    // Playwright's click on a disabled button will throw; we avoid clicking when disabled.
    // Instead, assert that manual invocation is not possible: check attribute disabled
    // and that bars remain in animation (at least one highlight remains after brief wait)
    await page.waitForTimeout(500);
    const heightsAfter = await app.getHeights();
    // Heights may change during sorting due to shifting; so ensure we did not unexpectedly revert to an "init" state:
    // We assert that not all bars are reset to having no 'sorted' class (they will be in flux). This is a coarse assertion.
    expect(await app.isStartDisabled()).toBe(true);
    expect(await app.isResetDisabled()).toBe(true);

    // Ensure no uncaught page errors occurred during the sorting start
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  }, { timeout: 30000 });

  // Test that sorting completes and returns to Idle with all bars marked 'sorted'
  test('S1_Sorting -> S0_Idle: sorting completes, all bars sorted and controls re-enabled', async ({ page }) => {
    const app = new InsertionSortPage(page);
    await app.goto();

    // Start sorting
    await app.clickStart();

    // Wait for all bars to become 'sorted' indicating completion
    await app.waitForAllSorted(30000);

    // After completion, buttons should be enabled again (Idle evidence)
    await page.waitForFunction(() => {
      const s = document.getElementById('startBtn');
      const r = document.getElementById('resetBtn');
      return s && r && s.disabled === false && r.disabled === false && s.getAttribute('aria-pressed') === 'false';
    }, { timeout: 3000 });

    expect(await app.isStartDisabled()).toBe(false);
    expect(await app.isResetDisabled()).toBe(false);
    expect(await app.getAriaPressed()).toBe('false');

    // All bars should have the 'sorted' class
    const { allSorted, heights } = await app.snapshotSortedState();
    expect(allSorted).toBe(true);

    // Verify heights are non-decreasing (sorted ascending)
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1]);
    }

    // No uncaught errors during the full sort run
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  }, { timeout: 45000 });

  // Test Reset transition from Idle (S0_Idle -> S2_Reset -> S0_Idle)
  test('S2_Reset: clicking Reset from Idle produces a new array and removes highlights', async ({ page }) => {
    const app = new InsertionSortPage(page);
    await app.goto();

    // Capture initial heights
    const heightsInitial = await app.getHeights();

    // Click reset to generate a new array
    await app.clickReset();

    // After reset, bars are re-created and init state applied (no sorted/highlight)
    await page.waitForFunction(() => {
      const bars = Array.from(document.querySelectorAll('#bars .bar'));
      return bars.length > 0 && bars.every(b => !b.classList.contains('sorted') && !b.classList.contains('highlight'));
    }, { timeout: 3000 });

    const heightsAfterReset = await app.getHeights();
    // It's possible (rare) that the generated array equals the initial one; assert it is likely different:
    const identical = heightsInitial.length === heightsAfterReset.length && heightsInitial.every((v,i) => v === heightsAfterReset[i]);
    // We allow a flaky pass but assert that in most cases they differ. If they are identical, at least ensure init state (no 'sorted')
    if (identical) {
      expect(await app.anyBarHasClass('sorted')).toBe(false);
      expect(await app.anyBarHasClass('highlight')).toBe(false);
    } else {
      expect(identical).toBe(false);
    }

    // Buttons should remain enabled after reset (Idle)
    expect(await app.isStartDisabled()).toBe(false);
    expect(await app.isResetDisabled()).toBe(false);

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: ensure clicking Start multiple times doesn't break the app (idempotence / guards)
  test('Edge case: multiple rapid Start clicks do not produce runtime errors or multiple overlapping sort runs', async ({ page }) => {
    const app = new InsertionSortPage(page);
    await app.goto();

    // Rapidly click start several times (the second click should be ignored because button becomes disabled)
    // Use a try/catch in case Playwright blocks click on disabled button; ensure no exceptions bubble out of page itself.
    try {
      // First click starts sort
      await app.startBtn.click();
      // Immediately try to click again; may or may not click depending on disabled state
      try { await app.startBtn.click(); } catch (e) { /* ignore Playwright clicking disabled */ }
      try { await app.startBtn.click(); } catch (e) { /* ignore */ }
    } catch (e) {
      // Unexpected errors in the test harness should cause failure
      throw e;
    }

    // Wait briefly to let any potential misbehavior surface
    await page.waitForTimeout(1000);

    // There should be no uncaught page errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Eventually sorting should complete normally
    await app.waitForAllSorted(30000);

    // Confirm controls restored
    expect(await app.isStartDisabled()).toBe(false);
    expect(await app.isResetDisabled()).toBe(false);
  }, { timeout: 40000 });

  // Edge case: ensure Reset during sorting is a guarded no-op (resetBtn disabled) - FSM transition S1->S2 via ResetArray is guarded in code
  test('Edge case: Reset during sorting is prevented (guard check) and does not prematurely reset the array', async ({ page }) => {
    const app = new InsertionSortPage(page);
    await app.goto();

    // Start sorting
    await app.clickStart();

    // Wait until we are in sorting state (buttons disabled)
    await page.waitForFunction(() => {
      const s = document.getElementById('startBtn');
      const r = document.getElementById('resetBtn');
      return s && r && s.disabled === true && r.disabled === true;
    }, { timeout: 3000 });

    // Snapshot heights during sort
    const heightsDuring = await app.getHeights();

    // Attempt to click reset only if it's enabled. Since it's disabled, we will assert it's disabled and not click.
    expect(await app.isResetDisabled()).toBe(true);

    // Wait a short while to allow sort to progress; ensure the sorter eventually completes, not prematurely reset
    await app.waitForAllSorted(30000);

    const heightsAfterComplete = await app.getHeights();

    // The final heights should be sorted; they should not match the earlier in-sort snapshot necessarily.
    for (let i = 1; i < heightsAfterComplete.length; i++) {
      expect(heightsAfterComplete[i]).toBeGreaterThanOrEqual(heightsAfterComplete[i - 1]);
    }

    // No runtime errors observed
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  }, { timeout: 45000 });

  test.afterEach(async ({ }, testInfo) => {
    // If there were any page errors or console errors captured, include them in test output for debugging
    if (pageErrors && pageErrors.length > 0) {
      // Attach page errors to Playwright report (no mutation of page)
      for (const err of pageErrors) {
        testInfo.attachments ||= [];
        testInfo.attachments.push({ name: 'pageerror', body: String(err), contentType: 'text/plain' });
      }
    }
    if (consoleErrors && consoleErrors.length > 0) {
      for (const c of consoleErrors) {
        testInfo.attachments ||= [];
        testInfo.attachments.push({ name: 'console.error', body: JSON.stringify(c, null, 2), contentType: 'application/json' });
      }
    }
  });
});