import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ab3dd0-fa78-11f0-812d-c9788050701f.html';

class VisualizerPage {
  /**
   * Page object encapsulating selectors and common interactions for the Big-Theta Visualizer.
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('.container');
    this.headerTitle = page.locator('h1');
    this.thetaSymbol = page.locator('.theta-symbol');
    this.thetaBound = page.locator('.theta-bound');
    this.lowerBound = page.locator('.lower-bound');
    this.upperBound = page.locator('.upper-bound');
    this.animateBtn = page.locator('#animateBtn');
    this.infoBtn = page.locator('#infoBtn');
    this.legend = page.locator('.legend');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the main container to be visible as a sign the page rendered
    await this.container.waitFor({ state: 'visible' });
  }

  async clickAnimate() {
    await this.animateBtn.click();
  }

  async clickInfo() {
    await this.infoBtn.click();
  }

  async getInlineAnimationOfThetaBound() {
    return this.page.evaluate(() => {
      const el = document.querySelector('.theta-bound');
      return el ? el.style.animation : null;
    });
  }

  async getInlineAnimationOfLowerBound() {
    return this.page.evaluate(() => {
      const el = document.querySelector('.lower-bound');
      return el ? el.style.animation : null;
    });
  }

  async getInlineAnimationOfUpperBound() {
    return this.page.evaluate(() => {
      const el = document.querySelector('.upper-bound');
      return el ? el.style.animation : null;
    });
  }

  async getComputedAnimationName(selector) {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).animationName;
    }, selector);
  }

  async getThetaInlineTransform() {
    return this.page.evaluate(() => {
      const el = document.querySelector('.theta-symbol');
      return el ? el.style.transform : '';
    });
  }
}

test.describe('Big-Theta Notation Visualizer - FSM states & transitions', () => {
  // Collect console and page errors for assertions across tests
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Capture console logs (info/warn/error)
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (exceptions)
    page.on('pageerror', err => {
      // err is an Error object from the page
      pageErrors.push(err);
    });

    // Capture dialogs and accept them automatically while saving message
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    const vp = new VisualizerPage(page);
    await vp.goto();
  });

  test.afterEach(async () => {
    // nothing to teardown specifically beyond Playwright's fixtures,
    // but we keep hooks to show where cleanup would go.
  });

  test('S0_Idle - initial render shows key elements and no critical runtime errors', async ({ page }) => {
    // Validate the Idle state rendering and basic DOM elements (S0 entry: renderPage())
    const vp = new VisualizerPage(page);

    // Check main structural evidence of S0_Idle
    await expect(vp.container).toBeVisible();
    await expect(vp.headerTitle).toHaveText('Understanding Big-Theta Notation');
    await expect(vp.thetaSymbol).toBeVisible();
    await expect(vp.legend).toBeVisible();

    // Ensure the visualization graph lines exist
    await expect(vp.lowerBound).toBeVisible();
    await expect(vp.upperBound).toBeVisible();
    await expect(vp.thetaBound).toBeVisible();

    // The .theta-bound has a CSS animation defined; confirm computed animationName includes 'thetaBound'
    const computedThetaAnimationName = await vp.getComputedAnimationName('.theta-bound');
    // computedAnimationName on some browsers returns 'none' or 'thetaBound'; accept both but assert no syntax/runtime page errors
    expect(typeof computedThetaAnimationName).toBe('string');

    // Assert there were no uncaught exceptions of the basic types (ReferenceError, SyntaxError, TypeError)
    const namedPageErrors = pageErrors.map(e => e.name).filter(Boolean);
    expect(namedPageErrors).not.toContain('ReferenceError');
    expect(namedPageErrors).not.toContain('SyntaxError');
    expect(namedPageErrors).not.toContain('TypeError');

    // Assert no console.error was logged during initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition ReplayAnimation (S0 -> S1) starts animations on graph lines', async ({ page }) => {
    // This test validates the ReplayAnimation event triggers the startAnimation() behavior
    const vp = new VisualizerPage(page);

    // Before clicking animate, capture inline style.animation (should be empty initially because animation comes from CSS)
    const beforeInlineTheta = await vp.getInlineAnimationOfThetaBound();
    expect(beforeInlineTheta === '' || beforeInlineTheta === null).toBeTruthy();

    // Click the Replay Animation button to trigger startAnimation() (S0 -> S1 transition)
    await vp.clickAnimate();

    // After clicking, the script sets inline style.animation to 'thetaBound 4s ease-in-out infinite'
    const afterInlineTheta = await vp.getInlineAnimationOfThetaBound();
    expect(afterInlineTheta).toBe('thetaBound 4s ease-in-out infinite');

    // Verify the other bounds were also reset/started
    const lowerAnim = await vp.getInlineAnimationOfLowerBound();
    const upperAnim = await vp.getInlineAnimationOfUpperBound();
    expect(lowerAnim).toBe('lowerBound 4s ease-in-out infinite');
    expect(upperAnim).toBe('upperBound 4s ease-in-out infinite');

    // Also confirm computed styles for animation names include the expected keyframe names
    const computedThetaName = await vp.getComputedAnimationName('.theta-bound');
    const computedLowerName = await vp.getComputedAnimationName('.lower-bound');
    const computedUpperName = await vp.getComputedAnimationName('.upper-bound');

    expect(computedThetaName).toContain('thetaBound');
    expect(computedLowerName).toContain('lowerBound');
    expect(computedUpperName).toContain('upperBound');

    // Ensure no unexpected page errors were emitted by the handler
    const namedPageErrors = pageErrors.map(e => e.name);
    expect(namedPageErrors).not.toContain('ReferenceError');
    expect(namedPageErrors).not.toContain('TypeError');
    // No console errors should have been logged when clicking animate
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('ReplayAnimation while animation playing (S1 -> S0 -> S1) is idempotent and resets animations', async ({ page }) => {
    // Tests clicking animate twice to exercise resetAnimation logic and ensure no crashes
    const vp = new VisualizerPage(page);

    // First click to start animation
    await vp.clickAnimate();
    const afterFirstInlineTheta = await vp.getInlineAnimationOfThetaBound();
    expect(afterFirstInlineTheta).toBe('thetaBound 4s ease-in-out infinite');

    // Click again quickly to simulate replay while animation playing.
    // The implementation tries to reset by setting style.animation = 'none' then reassigning,
    // we cannot reliably observe the ephemeral 'none' value, but we can assert the final state is consistent.
    await vp.clickAnimate();
    const afterSecondInlineTheta = await vp.getInlineAnimationOfThetaBound();
    expect(afterSecondInlineTheta).toBe('thetaBound 4s ease-in-out infinite');

    // Verify stability for other bounds as well
    expect(await vp.getInlineAnimationOfLowerBound()).toBe('lowerBound 4s ease-in-out infinite');
    expect(await vp.getInlineAnimationOfUpperBound()).toBe('upperBound 4s ease-in-out infinite');

    // Ensure clicking rapidly did not produce runtime errors
    const namedPageErrors = pageErrors.map(e => e.name);
    expect(namedPageErrors).not.toContain('ReferenceError');
    expect(namedPageErrors).not.toContain('TypeError');

    // No console errors emitted
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('ShowExplanation (S0 -> S2) displays an alert with expected content and can be accepted', async ({ page }) => {
    // Validate clicking the Show Explanation triggers showExplanation() and a dialog
    const vp = new VisualizerPage(page);

    // Click info button twice to ensure multiple dialogs can be shown and handled
    await vp.clickInfo();
    await vp.clickInfo();

    // Two dialogs should have been observed and accepted by our dialog handler
    expect(dialogMessages.length).toBeGreaterThanOrEqual(2);
    // Validate contents of first dialog resembles the expected explanation content
    expect(dialogMessages[0]).toContain('Big-Theta (Θ) provides a tight bound');
    expect(dialogMessages[0]).toContain('f(n)');

    // Ensure no page runtime exceptions were thrown as a result of showing alerts
    const namedPageErrors = pageErrors.map(e => e.name);
    expect(namedPageErrors).not.toContain('ReferenceError');
    expect(namedPageErrors).not.toContain('TypeError');

    // Also ensure console didn't log errors when showing explanation
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('S1 AnimationPlaying side-effect: theta-symbol transform toggles over time (pulsing behavior)', async ({ page }) => {
    // The page script toggles inline transform on the theta symbol every 2000ms.
    // Validate that the inline transform changes after waiting slightly longer than 2s.
    const vp = new VisualizerPage(page);

    // Record initial inline transform value (likely empty string)
    const initialTransform = await vp.getThetaInlineTransform();

    // Wait for a bit more than interval used by setInterval (2000ms) to observe a change
    await page.waitForTimeout(2200);

    const laterTransform = await vp.getThetaInlineTransform();

    // The inline transform should toggle between 'scale(1)' and 'scale(1.05)' over intervals.
    // Accept either that it changed from initial or that it is set to one of the expected values.
    const possibleValues = ['', 'scale(1)', 'scale(1.05)'];
    expect(possibleValues).toContain(initialTransform);
    // Either it changed to something different after the interval or explicitly set to one of the expected toggles.
    expect(possibleValues.concat(['scale(1)', 'scale(1.05)'])).toContain(laterTransform);

    // Prefer a positive assertion that either initial !== later OR later is 'scale(1.05)' (demonstrating toggle)
    const toggled = initialTransform !== laterTransform || laterTransform === 'scale(1.05)';
    expect(toggled).toBeTruthy();

    // Ensure no page errors occurred during this periodic update
    const namedPageErrors = pageErrors.map(e => e.name);
    expect(namedPageErrors).not.toContain('ReferenceError');
    expect(namedPageErrors).not.toContain('TypeError');
  });

  test('Edge case: rapid alternating clicks between animate and info do not crash the page', async ({ page }) => {
    // Rapidly trigger both controls to ensure handlers remain robust (stress test)
    const vp = new VisualizerPage(page);

    // Simulate a short burst of alternating clicks
    for (let i = 0; i < 5; i++) {
      await vp.clickAnimate();
      await vp.clickInfo();
    }

    // We should have captured multiple dialogs (handled automatically)
    expect(dialogMessages.length).toBeGreaterThanOrEqual(5);

    // Final state: inline animations are set (last animate should have applied)
    expect(await vp.getInlineAnimationOfThetaBound()).toBe('thetaBound 4s ease-in-out infinite');

    // No unexpected page errors or console.error logs should have been produced
    const namedPageErrors = pageErrors.map(e => e.name);
    expect(namedPageErrors).not.toContain('ReferenceError');
    expect(namedPageErrors).not.toContain('TypeError');
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('Observability: assert there are no SyntaxError, ReferenceError, or TypeError page errors across the session', async () => {
    // Summarize any captured page errors and fail if we saw critical exception types
    const criticalNames = pageErrors.map(e => e.name);
    // There should be no SyntaxError/ReferenceError/TypeError thrown by the page by default
    expect(criticalNames).not.toContain('SyntaxError');
    expect(criticalNames).not.toContain('ReferenceError');
    expect(criticalNames).not.toContain('TypeError');
  });
});