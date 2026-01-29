import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed9061c3-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Overfitting Visualization FSM - ed9061c3-fa77-11f0-8492-31e949ed3c7c', () => {
  // Arrays to collect runtime diagnostics per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection (info/warn/error)
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case msg.type() or msg.text() throws unexpectedly, capture fallback
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the exact page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Detach listeners to keep test isolation in long test runs
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  // Page object encapsulating common interactions and queries for readability
  class OverfitPage {
    constructor(page) {
      this.page = page;
    }
    async clickAnimate() {
      await this.page.click('.button');
    }
    async getPointCount() {
      return this.page.$$eval('.point', els => els.length);
    }
    async getPointInlineTransforms() {
      return this.page.$$eval('.point', els => els.map(e => e.style.transform || ''));
    }
    async getPointInlineTransitions() {
      return this.page.$$eval('.point', els => els.map(e => e.style.transition || ''));
    }
    async getPointComputedTransitions() {
      return this.page.$$eval('.point', els => els.map(e => getComputedStyle(e).transition || ''));
    }
    async getCurveClipPath() {
      return this.page.$eval('#curve', el => el.style.clipPath || getComputedStyle(el).clipPath || '');
    }
    async getAnimateButtonText() {
      return this.page.$eval('.button', el => el.textContent.trim());
    }
    async getWindowAnimatingIfAny() {
      // Try accessing window.animating; note: `let animating` in the page script may not be exposed on window.
      return this.page.evaluate(() => {
        try {
          // If property exists, return its value, else undefined
          return window.hasOwnProperty('animating') ? window['animating'] : undefined;
        } catch (e) {
          return { error: String(e) };
        }
      });
    }
  }

  test('Initial Idle state (S0_Idle): button present, default visuals, no runtime errors', async ({ page }) => {
    // Validate initial state before any interaction
    const ui = new OverfitPage(page);

    // Button exists and has expected label
    const btnText = await ui.getAnimateButtonText();
    expect(btnText).toBe('Animate');

    // There should be 5 point elements as in the HTML
    const pointCount = await ui.getPointCount();
    expect(pointCount).toBe(5);

    // The curve should start with the original clip-path (as inline style in HTML)
    const initialClip = await ui.getCurveClipPath();
    expect(initialClip).toContain('polygon(0 0, 100% 0, 100% 100%, 0 100%)');

    // Inline transforms should be empty initially (no translate applied inline)
    const transforms = await ui.getPointInlineTransforms();
    for (const t of transforms) {
      expect(t).toBe('');
    }

    // Computed transition for points should include 'transform' as defined in CSS
    const computedTransitions = await ui.getPointComputedTransitions();
    for (const ct of computedTransitions) {
      expect(ct).toContain('transform');
    }

    // Verify whether window.animating is exposed: since the script uses `let animating` it may not be on window
    const windowAnim = await ui.getWindowAnimatingIfAny();
    // We accept either undefined (not exposed) or false if it happened to be attached; assert it's not true initially
    expect(windowAnim === true).toBeFalsy();

    // Assert that no uncaught page errors occurred during load
    expect(pageErrors.length).toBe(0);

    // Console messages should not contain error types
    const errorConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsole.length).toBe(0);
  });

  test('Click Animate transitions to Animating (S1_Animating): points move up and curve changes shape', async ({ page }) => {
    // This test validates the "onEnter" style changes for Animating state
    const ui = new OverfitPage(page);

    // Click the animate button to enter Animating state
    await ui.clickAnimate();

    // After clicking, inline transition should be set to "transform 0.5s" and transform to translateY(-15px)
    // Wait for DOM updates synchronously (no animation wait needed for inline style to be applied)
    await page.waitForTimeout(50);

    const inlineTransitions = await ui.getPointInlineTransitions();
    const inlineTransforms = await ui.getPointInlineTransforms();

    // All points should have the inline transition set and transform applied
    for (const t of inlineTransitions) {
      expect(t).toContain('transform 0.5s');
    }
    for (const tr of inlineTransforms) {
      // The inline style should be exactly translateY(-15px)
      expect(tr).toBe('translateY(-15px)');
    }

    // Curve clip-path should match the animated polygon specified in the implementation
    const newClip = await ui.getCurveClipPath();
    expect(newClip).toContain('polygon(0 80%');
    expect(newClip).toContain('75% 20%');

    // Ensure no page errors or console errors were produced by toggling animation
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsole.length).toBe(0);
  });

  test('Click Animate again transitions back to Idle (S1_Animating -> S0_Idle): points reset and curve restored', async ({ page }) => {
    // This test validates the "onExit" actions returning to Idle
    const ui = new OverfitPage(page);

    // Enter Animating
    await ui.clickAnimate();
    await page.waitForTimeout(50);

    // Exit Animating -> Idle
    await ui.clickAnimate();
    await page.waitForTimeout(50);

    // Inline transforms should now be translateY(0) as set by the 'else' branch
    const transformsAfter = await ui.getPointInlineTransforms();
    for (const tr of transformsAfter) {
      expect(tr).toBe('translateY(0)');
    }

    // Curve clip-path should be back to original polygon
    const clipAfter = await ui.getCurveClipPath();
    expect(clipAfter).toContain('polygon(0 0, 100% 0, 100% 100%, 0 100%)');

    // No page errors or console errors during toggling back and forth
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsole.length).toBe(0);
  });

  test('Rapid double-click edge case: toggling twice quickly ends in Idle and causes no errors', async ({ page }) => {
    // Simulate rapid user interactions (double click) to see if state machine still consistent
    const ui = new OverfitPage(page);

    // Rapidly click twice without waiting for animation completion
    await Promise.all([
      page.click('.button'),
      page.click('.button')
    ]);

    // Allow DOM to settle a little
    await page.waitForTimeout(50);

    // Expect final state to be Idle (since two toggles -> back to start)
    const transforms = await ui.getPointInlineTransforms();
    for (const tr of transforms) {
      expect(tr).toBe('translateY(0)');
    }

    const clip = await ui.getCurveClipPath();
    expect(clip).toContain('polygon(0 0, 100% 0, 100% 100%, 0 100%)');

    // Confirm there were no uncaught exceptions
    expect(pageErrors.length).toBe(0);

    // Ensure console didn't log errors/warnings
    const errorConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsole.length).toBe(0);
  });

  test('Multiple toggles sequence: DOM integrity maintained, points count stable, and transitions alternate', async ({ page }) => {
    // Click the toggle multiple times and check alternation of styles and DOM invariants
    const ui = new OverfitPage(page);

    const toggles = 5;
    for (let i = 0; i < toggles; i++) {
      await ui.clickAnimate();
      // small pause to let inline styles be applied
      await page.waitForTimeout(30);
    }

    // Points count should remain unchanged irrespective of animation state
    const pointCount = await ui.getPointCount();
    expect(pointCount).toBe(5);

    // Determine expected final visual state: odd toggles => Animating, even => Idle
    const expectedAnimating = toggles % 2 === 1;

    const inlineTransforms = await ui.getPointInlineTransforms();
    const curveClip = await ui.getCurveClipPath();

    if (expectedAnimating) {
      for (const tr of inlineTransforms) {
        expect(tr).toBe('translateY(-15px)');
      }
      expect(curveClip).toContain('polygon(0 80%');
    } else {
      for (const tr of inlineTransforms) {
        expect(tr).toBe('translateY(0)');
      }
      expect(curveClip).toContain('polygon(0 0, 100% 0, 100% 100%, 0 100%)');
    }

    // No runtime errors emitted across multiple rapid interactions
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsole.length).toBe(0);
  });

  test('Observability check: internal animating variable not exposed to window (edge observation)', async ({ page }) => {
    // The implementation uses `let animating = false;` in a top-level script.
    // In browsers, top-level let/const do not become properties on window. We assert that observation.
    const ui = new OverfitPage(page);
    const animVal = await ui.getWindowAnimatingIfAny();

    // It is valid for window.animating to be undefined. If it's present, it should not be true at initial load.
    // Accept undefined or false; assert it's not true initially.
    expect(animVal === true).toBeFalsy();
  });
});