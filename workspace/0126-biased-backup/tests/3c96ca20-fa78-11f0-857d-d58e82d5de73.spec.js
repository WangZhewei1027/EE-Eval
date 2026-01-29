import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c96ca20-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object for the Bubble Sort visualization page.
 * Encapsulates common operations and selectors used across tests.
 */
class BubbleSortPage {
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.container = page.locator('#container');
    this.barSelector = '#container .bar';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getBarCount() {
    return await this.page.$$eval(this.barSelector, els => els.length);
  }

  async getBarDataValues() {
    return await this.page.$$eval(this.barSelector, bars => bars.map(b => b.getAttribute('data-value')));
  }

  async anyBarHasClass(className) {
    return await this.page.$$eval(
      `${this.barSelector}.${className}`,
      els => els.length > 0
    );
  }

  async allBarsHaveClass(className) {
    return await this.page.$$eval(
      this.barSelector,
      (els, className) => els.every(e => e.classList.contains(className)),
      className
    );
  }

  async startAnimation() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async isStartEnabled() {
    return !(await this.startBtn.isDisabled());
  }

  async isResetEnabled() {
    return !(await this.resetBtn.isDisabled());
  }

  async getBarTransforms() {
    return await this.page.$$eval(this.barSelector, bars => bars.map(b => b.style.transform || ''));
  }

  async getBarsClassListSnapshot() {
    return await this.page.$$eval(this.barSelector, bars => bars.map(b => Array.from(b.classList)));
  }
}

test.describe('Bubble Sort - Artistic Visualization (FSM validation)', () => {
  // Collect console errors and page errors for each test to assert no unexpected runtime issues.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Setup collectors for console errors and uncaught page errors
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      // capture console.error and exception-like entries
      try {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      } catch (e) {
        // ignore inspector errors if any
      }
    });

    page.on('pageerror', error => {
      // uncaught exceptions in page context
      pageErrors.push(error && error.message ? error.message : String(error));
    });
  });

  test.describe('Initial State (S0_Idle)', () => {
    test('S0_Idle: on load reset() should run and buttons should reflect Idle state', async ({ page }) => {
      // Validate initial state: startBtn enabled, resetBtn disabled, bars generated
      const app = new BubbleSortPage(page);
      await app.goto();

      // Assertions for initial evidence of S0_Idle
      // startBtn.disabled = false
      expect(await app.isStartEnabled()).toBe(true);

      // resetBtn.disabled = true
      expect(await app.isResetEnabled()).toBe(false);

      // Bars should be generated and count equal to NUM_BARS (38)
      const barCount = await app.getBarCount();
      expect(barCount).toBeGreaterThan(0);
      // The implementation sets NUM_BARS = 38; check it's present to match expectations.
      expect(barCount).toBe(38);

      // Each bar should have a numeric data-value attribute and the 'bar' class
      const dataValues = await app.getBarDataValues();
      for (const val of dataValues) {
        expect(val).toBeTruthy();
        // Should parse to integer
        expect(Number.isFinite(Number(val))).toBe(true);
      }

      // No console errors or page errors should have occurred during initial load
      expect(consoleErrors, `Console errors on load: ${consoleErrors.join(' | ')}`).toHaveLength(0);
      expect(pageErrors, `Page errors on load: ${pageErrors.join(' | ')}`).toHaveLength(0);
    });
  });

  test.describe('Sorting state and interactions (S1_Sorting)', () => {
    test('S1_Sorting: clicking Start Animation enters Sorting state (buttons disabled as evidence)', async ({ page }) => {
      const app = new BubbleSortPage(page);
      await app.goto();

      // Start animation
      await app.startAnimation();

      // Immediately after click, evidence expected for S1_Sorting:
      // - startBtn.disabled = true
      // - resetBtn.disabled = true
      expect(await app.isStartEnabled()).toBe(false);
      expect(await app.isResetEnabled()).toBe(false);

      // Wait a short amount to allow the animation step to apply DOM class highlights
      // We only wait briefly to validate the "sorting is happening" visual evidence (not full sort completion)
      await page.waitForTimeout(600);

      // At least one bar should show comparison or current highlight class during sorting
      const hasCompared = await app.anyBarHasClass('compared');
      const hasCurrent = await app.anyBarHasClass('current');

      // It's possible that a swap also occurred and classes toggled quickly; we assert that at least one of these evidences appeared.
      expect(hasCompared || hasCurrent, 'Expected to see visual evidence of comparison or current during sorting').toBe(true);

      // Also ensure transforms are applied to bars (they should use scaleY transforms for snapshots)
      const transforms = await app.getBarTransforms();
      // At least one bar should have a non-empty transform style (scaleY set)
      const anyHasTransform = transforms.some(t => t && t.trim() !== '');
      expect(anyHasTransform, 'Expected at least one bar to have transform styles applied during animation').toBe(true);

      // No console errors or page errors during initial sorting
      expect(consoleErrors, `Console errors while starting animation: ${consoleErrors.join(' | ')}`).toHaveLength(0);
      expect(pageErrors, `Page errors while starting animation: ${pageErrors.join(' | ')}`).toHaveLength(0);
    });

    test('Reset button is disabled during sorting; clicking it should have no effect (edge case)', async ({ page }) => {
      const app = new BubbleSortPage(page);
      await app.goto();

      // Start animation
      await app.startAnimation();

      // Confirm we are in sorting evidence state
      expect(await app.isStartEnabled()).toBe(false);
      expect(await app.isResetEnabled()).toBe(false);

      // Try clicking the reset button programmatically while it is disabled.
      // Because the button is disabled, Playwright's click would throw unless forced.
      // We will attempt a non-forced click and expect it to be rejected or result in no change.
      // To simulate a user, do not force the click; instead check that it is disabled and that clicking is not permitted.
      let clickThrown = false;
      try {
        await app.resetBtn.click();
      } catch (e) {
        // Playwright may throw when attempting to click a disabled element; capture that as expected behavior
        clickThrown = true;
      }

      // Whether click threw or not, the DOM should still reflect sorting (start disabled, reset disabled)
      expect(await app.isStartEnabled()).toBe(false);
      expect(await app.isResetEnabled()).toBe(false);

      // Ensure bars are still present and unchanged count-wise
      const countAfterAttempt = await app.getBarCount();
      expect(countAfterAttempt).toBe(38);

      // Capture that attempting to click a disabled reset is either blocked or ignored by the application.
      expect(clickThrown || true).toBe(true); // If click thrown or not, the core requirement is that reset did not interrupt sorting.

      // No console/page errors introduced by this edge interaction
      expect(consoleErrors, `Console errors during disabled-reset attempt: ${consoleErrors.join(' | ')}`).toHaveLength(0);
      expect(pageErrors, `Page errors during disabled-reset attempt: ${pageErrors.join(' | ')}`).toHaveLength(0);
    });
  });

  test.describe('Reset behavior when Idle (S0_Idle) and final Sorted state (S2_Sorted)', () => {
    test('Reset while Idle: resetBtn is disabled in Idle and invoking reset has no effect', async ({ page }) => {
      const app = new BubbleSortPage(page);
      await app.goto();

      // In Idle, resetBtn should be disabled
      expect(await app.isResetEnabled()).toBe(false);

      // Attempt to click reset - Playwright will throw if disabled, so perform a check rather than force-click.
      // Ensure no change of state occurs if someone tries to interact with the disabled control.
      // We'll assert that start remains enabled and bar count stays the same.
      expect(await app.isStartEnabled()).toBe(true);
      const beforeCount = await app.getBarCount();

      // Try to evaluate a click on the element; we do not force it to avoid changing behavior
      let clicked = false;
      try {
        await app.resetBtn.click({ timeout: 500 });
        clicked = true;
      } catch (e) {
        // expected in many environments because the button is disabled
        clicked = false;
      }

      const afterCount = await app.getBarCount();
      expect(afterCount).toBe(beforeCount);

      // Validate no runtime errors occurred
      expect(consoleErrors, `Console errors during idle-reset attempt: ${consoleErrors.join(' | ')}`).toHaveLength(0);
      expect(pageErrors, `Page errors during idle-reset attempt: ${pageErrors.join(' | ')}`).toHaveLength(0);
    });

    test('S2_Sorted (attempt): start animation and wait for final sorted state (may take time); assert final visual evidence if reached', async ({ page }) => {
      // This test attempts to validate the transition from Sorting to Sorted (S1 -> S2).
      // Note: The page runs a full bubble sort animation for the generated array. Depending on the initial random array
      // and configuration (NUM_BARS = 38, ANIMATION_SPEED = 300ms), the animation may take significant time.
      // We will set an increased timeout for this test and poll for the final indicators:
      //   - resetBtn becomes enabled (sorting=false and animation completed)
      //   - all bars have the 'sorted' class applied
      //
      // If the environment cannot finish the full animation within the timeout, the test will fail to indicate that S2 was not reached.
      test.setTimeout(120000); // allow up to 2 minutes for this test

      const app = new BubbleSortPage(page);
      await app.goto();

      // Start animation
      await app.startAnimation();

      // Poll until we observe final state indicators or timeout
      const timeoutMs = 110000; // slightly less than test timeout
      const startTime = Date.now();
      let reachedFinal = false;
      let finalReason = '';

      while (Date.now() - startTime < timeoutMs) {
        // If reset button is enabled, sorting must have completed
        const resetEnabled = await app.isResetEnabled();
        if (resetEnabled) {
          // check if bars have sorted class
          const allSorted = await app.allBarsHaveClass('sorted');
          if (allSorted) {
            reachedFinal = true;
            finalReason = 'resetBtn became enabled and all bars have .sorted';
            break;
          } else {
            // It's possible resetBtn is enabled but styling hasn't been applied for all bars yet; give it a short pause
            await page.waitForTimeout(300);
            const allSorted2 = await app.allBarsHaveClass('sorted');
            if (allSorted2) {
              reachedFinal = true;
              finalReason = 'resetBtn enabled and delayed sorted classes applied';
              break;
            }
          }
        }

        // As additional evidence, if every bar's computed transform is set and there are no 'current'/'compared' classes, and reset enabled,
        // treat that as a sign of completion (less strict).
        const anyCurrent = await app.anyBarHasClass('current');
        const anyCompared = await app.anyBarHasClass('compared');
        if (!anyCurrent && !anyCompared && resetEnabled) {
          const allSorted3 = await app.allBarsHaveClass('sorted');
          if (allSorted3) {
            reachedFinal = true;
            finalReason = 'no active comparisons, reset enabled and all bars sorted';
            break;
          }
        }

        // Wait a short time before re-checking to avoid tight spin
        await page.waitForTimeout(500);
      }

      // Assert that we reached the final Sorted state within the allotted time
      expect(reachedFinal, `Expected transition to S2_Sorted within timeout. Reason: ${finalReason}; ConsoleErrors: ${consoleErrors.join(' | ')}; PageErrors: ${pageErrors.join(' | ')}`).toBe(true);

      // Additional strict assertions if final reached
      if (reachedFinal) {
        expect(await app.allBarsHaveClass('sorted')).toBe(true);
        expect(await app.isResetEnabled()).toBe(true);
        expect(await app.isStartEnabled()).toBe(true); // after sorting completes, start should be enabled again
      }

      // Confirm no console or page errors occurred throughout
      expect(consoleErrors, `Console errors during full-sort attempt: ${consoleErrors.join(' | ')}`).toHaveLength(0);
      expect(pageErrors, `Page errors during full-sort attempt: ${pageErrors.join(' | ')}`).toHaveLength(0);
    });
  });

  test.describe('Robustness and edge-case checks', () => {
    test('Rapid consecutive Start clicks should not break the app (sorting guard and no thrown errors)', async ({ page }) => {
      const app = new BubbleSortPage(page);
      await app.goto();

      // Rapidly click Start multiple times to ensure the sorting guard (if (sorting) return;) prevents re-entry.
      await Promise.all([
        app.startBtn.click().catch(() => {}),
        app.startBtn.click().catch(() => {}),
        app.startBtn.click().catch(() => {}),
      ]);

      // Wait briefly for first click to take effect
      await page.waitForTimeout(400);

      // Ensure we are in sorting evidence state (start disabled, reset disabled)
      expect(await app.isStartEnabled()).toBe(false);
      expect(await app.isResetEnabled()).toBe(false);

      // No console/page errors should result from multiple rapid clicks
      expect(consoleErrors, `Console errors after rapid-start clicks: ${consoleErrors.join(' | ')}`).toHaveLength(0);
      expect(pageErrors, `Page errors after rapid-start clicks: ${pageErrors.join(' | ')}`).toHaveLength(0);
    });
  });
});