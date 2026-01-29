import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c98c5f1-fa78-11f0-857d-d58e82d5de73.html';

// Page Object Model encapsulating interactions and queries for the Time Complexity app
class TimeComplexityPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.animateSelector = '#animateBtn';
    this.curveSelector = '.curve-path';
  }

  // Navigate to the app and wait for the load event to complete
  async goto() {
    await this.page.goto(APP_URL);
    await this.page.waitForLoadState('load');
  }

  // Click the main animate/reset button
  async clickAnimate() {
    await this.page.click(this.animateSelector);
  }

  // Get the button's visible text
  async getButtonText() {
    return this.page.textContent(this.animateSelector);
  }

  // Get the aria-pressed attribute on the button
  async getAriaPressed() {
    return this.page.getAttribute(this.animateSelector, 'aria-pressed');
  }

  // Return arrays of computed strokeDashoffset and strokeDasharray for all curves
  async getCurvesComputedStyles() {
    return this.page.$$eval(this.curveSelector, (els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        return {
          strokeDashoffset: cs.strokeDashoffset,
          strokeDasharray: cs.strokeDasharray,
        };
      })
    );
  }

  // Return array of inline style.strokeDashoffset values for all curves
  async getCurvesInlineOffsets() {
    return this.page.$$eval(this.curveSelector, (els) =>
      els.map((el) => el.style.strokeDashoffset || '')
    );
  }

  // Wait until a specific curve's computed strokeDashoffset equals expected string (with timeout)
  async waitForCurveComputedOffset(index, expected, opts = {}) {
    const { timeout = 3000 } = opts;
    await this.page.waitForFunction(
      (sel, idx, exp) => {
        const els = Array.from(document.querySelectorAll(sel));
        if (!els[idx]) return false;
        return getComputedStyle(els[idx]).strokeDashoffset === exp;
      },
      this.curveSelector,
      index,
      expected,
      { timeout }
    );
  }

  // Utility: number of curves present
  async countCurves() {
    return this.page.$$eval(this.curveSelector, (els) => els.length);
  }
}

test.describe('Time Complexity — FSM and UI integration tests', () => {
  // Individual tests will attach their own listeners to capture console messages and page errors.
  // These containers will be filled per test to assert on runtime issues without modifying the page.
  test('Idle state on load: resetCurves() invoked and curves are hidden', async ({ page }) => {
    // Capture page errors and console messages for assertion (observe runtime issues)
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    const app = new TimeComplexityPage(page);
    await app.goto();

    // Validate button exists and initial attributes/text reflect Idle state
    const btnText = await app.getButtonText();
    expect(btnText).toBe('Animate Curves'); // UI text must start as "Animate Curves"

    const aria = await app.getAriaPressed();
    expect(aria).toBe('false'); // Should be not pressed in Idle

    // All curves should be in hidden state: computed strokeDashoffset equals strokeDasharray
    const computed = await app.getCurvesComputedStyles();
    expect(computed.length).toBeGreaterThan(0); // ensure curves exist
    for (const c of computed) {
      // entry action resetCurves() should have set dashoffset == dasharray
      expect(c.strokeDashoffset).toBe(c.strokeDasharray);
    }

    // Assert that no uncaught page errors happened during load
    expect(pageErrors.length).toBe(0);

    // Bonus: no unexpected console errors of type 'error'
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S0 -> S1 transition: clicking AnimateCurves triggers animateCurves and updates UI', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new TimeComplexityPage(page);
    await app.goto();

    // Click to start animation (S0 -> S1)
    await app.clickAnimate();

    // After click, button should show Reset Animation and aria-pressed true
    await expect(page.locator('#animateBtn')).toHaveText('Reset Animation');
    const aria = await app.getAriaPressed();
    expect(aria).toBe('true');

    // The animateCurves() entry action sets inline strokeDashoffset to '0' in a staggered fashion.
    // The first curve is updated immediately (i * 180 with i=0). Verify first curve becomes '0'.
    await app.waitForCurveComputedOffset(0, '0', { timeout: 2000 });

    // Verify at least one curve has strokeDashoffset '0' (drawn)
    const computedAfter = await app.getCurvesComputedStyles();
    const anyDrawn = computedAfter.some((c) => c.strokeDashoffset === '0');
    expect(anyDrawn).toBe(true);

    // No uncaught page errors during interaction
    expect(pageErrors.length).toBe(0);
  });

  test('S1 -> S2 transition: clicking while animating reverses curves (staggered hide) and updates UI', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new TimeComplexityPage(page);
    await app.goto();

    // Start animation
    await app.clickAnimate();
    await app.waitForCurveComputedOffset(0, '0', { timeout: 2000 });

    // Click again to reverse (S1 -> S2). This triggers staggered setTimeouts to restore strokeDashoffset to dasharray.
    await app.clickAnimate();

    // Immediately after reversing click, button text is set back to "Animate Curves" and aria-pressed false
    await expect(page.locator('#animateBtn')).toHaveText('Animate Curves');
    const aria = await app.getAriaPressed();
    expect(aria).toBe('false');

    // The reversing uses staggered timeouts of i*140ms. Wait long enough for at least the first few curves to revert.
    // We'll wait up to 1500ms to allow multiple curves to have been reset.
    await page.waitForTimeout(1500);

    const computedAfterReverse = await app.getCurvesComputedStyles();
    // At least one of the curves should have strokeDashoffset equal to its dasharray (hidden again)
    const anyReset = computedAfterReverse.some((c) => c.strokeDashoffset === c.strokeDasharray);
    expect(anyReset).toBe(true);

    // Verify that there were no uncaught JS errors during the reversing sequence
    expect(pageErrors.length).toBe(0);
  });

  test('S2 -> S0 transition: automatic reset after timeout restores Idle (resetCurves called)', async ({ page }) => {
    // This test validates that after the animation timeout (12s) the app resets to Idle and calls resetCurves().
    // Note: This requires waiting ~12s because the implementation triggers resetCurves via setTimeout(..., 12000).
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new TimeComplexityPage(page);
    await app.goto();

    // Start animation -> now animated true
    await app.clickAnimate();
    await app.waitForCurveComputedOffset(0, '0', { timeout: 2000 });

    // Click to reverse so that the code path sets animated = false and sets the 12s reset timeout
    await app.clickAnimate();

    // Confirm UI currently shows "Animate Curves"
    await expect(page.locator('#animateBtn')).toHaveText('Animate Curves');
    const aria = await app.getAriaPressed();
    expect(aria).toBe('false');

    // Wait slightly more than 12s to allow the scheduled resetCurves() call to run
    await page.waitForTimeout(12250);

    // After reset, computed strokeDashoffset should equal strokeDasharray for all curves again
    const computedAfterReset = await app.getCurvesComputedStyles();
    for (const c of computedAfterReset) {
      expect(c.strokeDashoffset).toBe(c.strokeDasharray);
    }

    // Button should be in Idle text and aria state
    await expect(page.locator('#animateBtn')).toHaveText('Animate Curves');
    const ariaAfter = await app.getAriaPressed();
    expect(ariaAfter).toBe('false');

    // No uncaught errors occurred during the long-running reset behavior
    expect(pageErrors.length).toBe(0);
  }, 30000); // Extended timeout to allow the 12s wait

  test('Edge case: rapid repeated clicks should not throw errors and UI remains stable', async ({ page }) => {
    // This test simulates rapid user interactions to ensure no uncaught exceptions are thrown
    // and button states / curve styles remain consistent (no runtime patches).
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    const app = new TimeComplexityPage(page);
    await app.goto();

    // Rapidly click the animate button multiple times
    for (let i = 0; i < 6; i++) {
      await app.clickAnimate();
      // very short pause to simulate rapid clicks
      await page.waitForTimeout(80);
    }

    // Allow some time for any pending timeouts for animations/reversals to apply
    await page.waitForTimeout(1200);

    // Ensure there were no uncaught page errors throughout
    expect(pageErrors.length).toBe(0);

    // Check the button's text is either 'Animate Curves' or 'Reset Animation' — both are valid states after rapid interactions
    const btnText = await app.getButtonText();
    expect(['Animate Curves', 'Reset Animation']).toContain(btnText);

    // Check aria-pressed is a valid boolean string
    const aria = await app.getAriaPressed();
    expect(['true', 'false']).toContain(aria);

    // Ensure the DOM still contains the expected number of curves and that values are sane (dasharray present)
    const count = await app.countCurves();
    expect(count).toBeGreaterThanOrEqual(6);

    const computed = await app.getCurvesComputedStyles();
    for (const c of computed) {
      // dasharray should be present and a non-empty string
      expect(typeof c.strokeDasharray).toBe('string');
      expect(c.strokeDasharray.length).toBeGreaterThan(0);
    }

    // Confirm there were no console messages of type 'error'
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});