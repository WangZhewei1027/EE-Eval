import { test, expect } from '@playwright/test';

test.setTimeout(60000); // allow enough time for long animation timeline

// Page Object Model for the Query Optimization visualization page
class QueryOptPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Controls
    this.optimizeBtn = page.locator('#optimizeBtn');
    this.resetBtn = page.locator('#resetBtn');
    // Groups / visual containers
    this.planGroup = page.locator('#planGroup');
    this.optGroup = page.locator('#optGroup');
    // Text nodes & cost values
    this.actionText = page.locator('#actionText');
    this.costValue = page.locator('#costValue');
    this.rootCost = page.locator('#rootCost');
    this.rootOptCost = page.locator('#rootOptCost');
  }

  async goto(url) {
    await this.page.goto(url);
  }

  async clickOptimize() {
    await this.optimizeBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  // Helper to get inline style opacity as float (or null if not present)
  async getOpacity(locator) {
    const style = await locator.evaluate((el) => el.getAttribute('style') || window.getComputedStyle(el).opacity ? null : null);
    // Instead of relying on attribute, read computed style
    const v = await locator.evaluate((el) => window.getComputedStyle(el).opacity);
    return parseFloat(v);
  }

  // Safe text retrieval trimmed
  async textOf(locator) {
    return (await locator.textContent())?.trim();
  }

  // Convenience to wait a bit (ms)
  async wait(ms) {
    await this.page.waitForTimeout(ms);
  }
}

describe('Query Optimization — Visualization (FSM validation)', () => {
  // URL provided by the test harness
  const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f801a1-fa77-11f0-a6a1-c765f41a13c7.html';

  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors for assertions
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // store the console message objects (type and text)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // store page errors (unhandled exceptions)
      pageErrors.push(err);
    });

    // Navigate to the application
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Basic sanity: no unexpected page errors were thrown during test
    expect(pageErrors, 'no unhandled page errors').toEqual([]);
    // Also assert there were no console.error messages
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors, 'no console.error messages').toEqual([]);
  });

  // Group: Initial State and entry actions
  test.describe('Initial State (S0_Initial) validations', () => {
    test('Initial on-load state shows initial plan, hides optimized plan and sets initial values', async ({ page }) => {
      const p = new QueryOptPage(page);

      // Verify visual containers: planGroup visible, optGroup hidden (opacity)
      const planOpacity = await p.getOpacity(p.planGroup);
      const optOpacity = await p.getOpacity(p.optGroup);

      // planGroup expected visible (opacity near 1), optGroup expected hidden (opacity near 0)
      expect(planOpacity).toBeGreaterThan(0.9);
      expect(optOpacity).toBeLessThan(0.5);

      // Verify cost and texts reflect setInitial() entry action
      const costText = await p.textOf(p.costValue);
      expect(costText).toBe('213.74'); // costValue set by setInitial()

      const rootCostText = await p.textOf(p.rootCost);
      expect(rootCostText).toContain('213.74');

      const rootOptCostText = await p.textOf(p.rootOptCost);
      expect(rootOptCostText).toContain('42.13');

      const action = await p.textOf(p.actionText);
      // setInitial sets: 'Analyzing statistics • Rewriting joins'
      expect(action).toContain('Analyzing statistics • Rewriting joins');

      // Buttons should be enabled in initial state
      await expect(p.optimizeBtn).toBeEnabled();
      await expect(p.resetBtn).toBeEnabled();
    });
  });

  // Group: Optimizing state (S1) and transitions
  test.describe('Optimizing State (S1_Optimizing) and transitions', () => {
    test('Clicking Optimize transitions to Optimizing state: buttons disabled and timeline begins', async ({ page }) => {
      const p = new QueryOptPage(page);

      // Click optimize -> runOptimization should start
      await p.clickOptimize();

      // Immediately, buttons should be disabled while animating
      await expect(p.optimizeBtn).toBeDisabled();
      await expect(p.resetBtn).toBeDisabled();

      // The first timeline step (delay 0) updates the actionText to mention 'Estimating cardinalities'
      // Give a small allowance for the function to run
      await p.wait(300);
      const actionNow = await p.textOf(p.actionText);
      expect(actionNow).toContain('Estimating cardinalities');

      // Clicking Optimize again while animating should have no adverse effect (guarded by animating flag)
      // We assert that clicking again does not throw and buttons remain disabled
      await p.clickOptimize();
      await p.wait(200);
      await expect(p.optimizeBtn).toBeDisabled();
      await expect(p.resetBtn).toBeDisabled();
    });

    test('Clicking Reset during animation does not reset (reset is ignored while animating)', async ({ page }) => {
      const p = new QueryOptPage(page);

      // Start optimization
      await p.clickOptimize();

      // Wait a short time to ensure animating=true in runOptimization
      await p.wait(150);

      // Attempt reset while animating: per implementation, resetBtn listener checks animating and returns
      await p.clickReset();

      // Provide short wait then assert that the animation is still in progress by checking buttons remain disabled
      await p.wait(200);
      await expect(p.optimizeBtn).toBeDisabled();
      await expect(p.resetBtn).toBeDisabled();

      // Also ensure the actionText remained part of the optimization timeline rather than reset to initial actionText
      const afterResetAttemptAction = await p.textOf(p.actionText);
      expect(afterResetAttemptAction).not.toBe('Analyzing statistics • Rewriting joins');
    });

    test('Optimization completes and moves to Optimized state (S2_Optimized): final visuals and costs', async ({ page }) => {
      const p = new QueryOptPage(page);

      // Start optimization
      await p.clickOptimize();

      // Wait until the final timeline step runs (timeline schedules final step around ~13700ms).
      // Allow a margin for timing jitter.
      await p.wait(14000);

      // After completion, actionText should reflect optimized message
      const finalAction = await p.textOf(p.actionText);
      expect(finalAction).toBe('Optimized • Lower I/O and CPU usage');

      // Cost value should have animated down to 42.13
      const finalCost = await p.textOf(p.costValue);
      // The animateCost ensures toFixed(2), so exact match
      expect(finalCost).toBe('42.13');

      // The optimized group should now be visible and initial plan hidden
      const planOpacityAfter = await p.getOpacity(p.planGroup);
      const optOpacityAfter = await p.getOpacity(p.optGroup);
      expect(planOpacityAfter).toBeLessThan(0.5);
      expect(optOpacityAfter).toBeGreaterThan(0.8);

      // Buttons should be re-enabled after completion
      await expect(p.optimizeBtn).toBeEnabled();
      await expect(p.resetBtn).toBeEnabled();
    });
  });

  // Group: Reset transitions and edge cases
  test.describe('Reset transitions and edge cases', () => {
    test('Reset after optimization returns to Initial state (S0_Initial)', async ({ page }) => {
      const p = new QueryOptPage(page);

      // Run optimize & wait for completion
      await p.clickOptimize();
      await p.wait(14000);

      // Confirm optimized state achieved
      expect(await p.textOf(p.actionText)).toBe('Optimized • Lower I/O and CPU usage');
      expect(await p.textOf(p.costValue)).toBe('42.13');

      // Click Reset to return to initial state
      await p.clickReset();
      // small delay for setInitial to take effect
      await p.wait(200);

      // Verify visuals and texts reset to initial values
      const planOpacity = await p.getOpacity(p.planGroup);
      const optOpacity = await p.getOpacity(p.optGroup);
      expect(planOpacity).toBeGreaterThan(0.9);
      expect(optOpacity).toBeLessThan(0.5);

      expect(await p.textOf(p.costValue)).toBe('213.74');
      expect(await p.textOf(p.actionText)).toContain('Analyzing statistics • Rewriting joins');
    });

    test('Rapid multiple Optimize clicks do not schedule duplicate animations (guarded by animating)', async ({ page }) => {
      const p = new QueryOptPage(page);

      // Rapidly click optimize multiple times
      await p.clickOptimize();
      await p.clickOptimize();
      await p.clickOptimize();

      // Buttons must be disabled while animating
      await expect(p.optimizeBtn).toBeDisabled();
      await expect(p.resetBtn).toBeDisabled();

      // Wait a short time for first stage updates
      await p.wait(500);
      const actionSnapshot = await p.textOf(p.actionText);
      // Should be progressing through optimization, not reset and not duplicated in a way that errors
      expect(actionSnapshot).toContain('Estimating cardinalities');

      // Wait to completion to ensure no stacking effects (if duplicates would have stacked, timeline behavior would have been erratic)
      await p.wait(14000);
      // Final completion should be as single run
      expect(await p.textOf(p.actionText)).toBe('Optimized • Lower I/O and CPU usage');
      expect(await p.textOf(p.costValue)).toBe('42.13');
    });
  });

  // Additional edge-case test: ensure UI remains stable if reset clicked when already in initial state
  test('Click Reset in initial state is idempotent and leaves UI stable', async ({ page }) => {
    const p = new QueryOptPage(page);

    // Ensure initial state present
    expect(await p.textOf(p.costValue)).toBe('213.74');

    // Click reset in initial state
    await p.clickReset();
    await p.wait(100);

    // State should remain initial
    expect(await p.textOf(p.costValue)).toBe('213.74');
    expect(await p.textOf(p.actionText)).toContain('Analyzing statistics • Rewriting joins');
    const planOpacity = await p.getOpacity(p.planGroup);
    const optOpacity = await p.getOpacity(p.optGroup);
    expect(planOpacity).toBeGreaterThan(0.9);
    expect(optOpacity).toBeLessThan(0.5);
  });

  // Additional verification that no runtime errors were emitted and no console.error logs occurred during the suite
  // (This is asserted in afterEach; we still include a minimal check here to highlight console observation)
  test('Console and runtime error observation - no unexpected errors during a full optimize cycle', async ({ page }) => {
    const p = new QueryOptPage(page);

    // Run full cycle
    await p.clickOptimize();
    await p.wait(14000);
    await p.clickReset();
    await p.wait(200);

    // Validate we captured console messages and page errors arrays are empty (checked in afterEach)
    // But assert at least that we observed some console messages (info/debug) or none is also acceptable.
    // We only assert there were no console.error messages (done in afterEach).
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    // A loose assertion: we observed zero or more console messages; primary requirement is absence of errors.
  });
});