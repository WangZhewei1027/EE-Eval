import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9b8512-fa78-11f0-857d-d58e82d5de73.html';

// Page Object for the regression app
class RegressionApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.animateBtnSelector = '#animateBtn';
    this.canvasSelector = '#regressionCanvas';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure core elements are present
    await Promise.all([
      this.page.waitForSelector(this.animateBtnSelector, { state: 'visible' }),
      this.page.waitForSelector(this.canvasSelector, { state: 'visible' }),
    ]);
  }

  async getAnimateButton() {
    return await this.page.$(this.animateBtnSelector);
  }

  async getAnimateText() {
    return await this.page.$eval(this.animateBtnSelector, btn => btn.textContent);
  }

  async getAnimateAriaPressed() {
    return await this.page.$eval(this.animateBtnSelector, btn => btn.getAttribute('aria-pressed'));
  }

  async getAnimateAriaLabel() {
    return await this.page.$eval(this.animateBtnSelector, btn => btn.getAttribute('aria-label'));
  }

  async clickAnimate() {
    await this.page.click(this.animateBtnSelector);
  }

  async canvasDataUrl() {
    return await this.page.$eval(this.canvasSelector, (c) => {
      // toDataURL may throw in some environments, let it surface naturally
      return c.toDataURL();
    });
  }

  // Wait until the animate button indicates animation has started (aria-pressed === 'true')
  async waitForAnimationStart(timeout = 2000) {
    await this.page.waitForFunction(
      (sel) => document.getElementById(sel.slice(1)).getAttribute('aria-pressed') === 'true',
      this.animateBtnSelector,
      { timeout }
    );
  }

  // Wait until the animate button indicates animation has ended (aria-pressed === 'false' and textContent === 'Animate')
  async waitForAnimationEnd(timeout = 12000) {
    await this.page.waitForFunction(
      (sel) => {
        const btn = document.getElementById(sel.slice(1));
        return btn && btn.getAttribute('aria-pressed') === 'false' && btn.textContent === 'Animate';
      },
      this.animateBtnSelector,
      { timeout }
    );
  }
}

test.describe('Linear Regression — FSM and UI behaviors', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for observation
    page.on('console', (msg) => {
      try {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        consoleMessages.push({ type: 'console', text: '<unserializable console message>' });
      }
    });

    // Capture page errors (ReferenceError, TypeError, SyntaxError, runtime exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app
    const app = new RegressionApp(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // Assert that there were no uncaught page errors during the test.
    // The implementation must not be modified; if there are runtime errors they will be reported here.
    expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e => e.toString()).join(', ')}`).toEqual([]);
  });

  test.describe('State S0: Static View (initial state)', () => {
    test('Initial static view is rendered and button is correctly configured', async ({ page }) => {
      // This test validates the Static View (S0) entry conditions:
      // - The canvas has been initially drawn (drawStaticView -> non-empty dataURL)
      // - The animate button exists with expected text and accessibility attributes

      const app = new RegressionApp(page);

      // Button text should be "Animate" initially
      const btnText = await app.getAnimateText();
      expect(btnText).toBe('Animate');

      // aria-pressed should be "false" initially
      const ariaPressed = await app.getAnimateAriaPressed();
      expect(ariaPressed).toBe('false');

      // aria-label should be correctly set for accessibility
      const ariaLabel = await app.getAnimateAriaLabel();
      expect(ariaLabel).toBe('Toggle animation of regression fit');

      // Canvas should exist and provide a non-empty data URL (indicates drawing occurred)
      const dataUrl = await app.canvasDataUrl();
      expect(typeof dataUrl).toBe('string');
      // Data URL should be long enough to represent an actual image
      expect(dataUrl.length).toBeGreaterThan(1000);
    });
  });

  test.describe('Event: AnimateClick and Transitions between S0 <-> S1', () => {
    test('Clicking Animate starts animation (S0 -> S1) and updates DOM', async ({ page }) => {
      // This test validates the transition triggered by AnimateClick:
      // - Clicking the button sets animating state via DOM observable changes:
      //   button text changes to show progress and aria-pressed becomes "true".
      // - The canvas visually changes during animation (dataURL changes).
      // - Clicking again while animating does not re-trigger or break the UI (early return in handler).

      const app = new RegressionApp(page);

      // Capture the canvas before animation begins (static view)
      const before = await app.canvasDataUrl();

      // Start animation
      await app.clickAnimate();

      // Wait for DOM to reflect that animation started (aria-pressed true)
      await app.waitForAnimationStart(3000);

      // Confirm button text indicates animation in progress (use substring, since char is ellipsis)
      const btnTextDuring = await app.getAnimateText();
      expect(btnTextDuring.includes('Animating')).toBeTruthy();

      // aria-pressed must be "true"
      const ariaPressedDuring = await app.getAnimateAriaPressed();
      expect(ariaPressedDuring).toBe('true');

      // Capture canvas a short time after animation started — it should differ from the static image
      await page.waitForTimeout(300); // give some frames to change the canvas
      const mid = await app.canvasDataUrl();
      expect(mid).not.toBe(before);

      // Attempt a second click while animating — handler should ignore it (if animating) and not crash
      // We expect the button state to remain "Animating…"
      await app.clickAnimate();
      await page.waitForTimeout(100); // small pause to let any accidental side effects surface
      const btnTextAfterSecondClick = await app.getAnimateText();
      expect(btnTextAfterSecondClick.includes('Animating')).toBeTruthy();
      const ariaPressedAfterSecondClick = await app.getAnimateAriaPressed();
      expect(ariaPressedAfterSecondClick).toBe('true');
    });

    test('Animation completes and returns to Static View (S1 -> S0)', async ({ page }) => {
      // This test validates that after the animation runs to completion:
      // - The animate button text returns to "Animate"
      // - aria-pressed resets to "false"
      // - The canvas content returns to the static final rendering (equal to initial static draw)

      const app = new RegressionApp(page);

      // Capture the canvas initial static image
      const staticBefore = await app.canvasDataUrl();

      // Start animation
      await app.clickAnimate();

      // Ensure it started
      await app.waitForAnimationStart(3000);

      // Wait for the animation to finish; animationDuration is small but we allow up to 12s
      await app.waitForAnimationEnd(12000);

      // After completion, button text must be exactly "Animate"
      const btnTextFinal = await app.getAnimateText();
      expect(btnTextFinal).toBe('Animate');

      // aria-pressed must be 'false'
      const ariaPressedFinal = await app.getAnimateAriaPressed();
      expect(ariaPressedFinal).toBe('false');

      // Canvas after animation should match the static draw (initial static draw)
      const staticAfter = await app.canvasDataUrl();

      // The final canvas state should be equal to the initial static state (drawStaticView is used initially)
      expect(staticAfter).toBe(staticBefore);
    });

    test('Restarting animation after completion works (S0 -> S1 again) and completes', async ({ page }) => {
      // This test ensures the transition is re-entrant:
      // After animation completes, clicking Animate again should start a fresh animation.

      const app = new RegressionApp(page);

      // Start + finish first run to ensure we are back to S0
      await app.clickAnimate();
      await app.waitForAnimationStart(3000);
      await app.waitForAnimationEnd(12000);

      // Start second run
      await app.clickAnimate();
      await app.waitForAnimationStart(3000);

      // During second run, ensure aria-pressed is true
      const ariaDuringSecond = await app.getAnimateAriaPressed();
      expect(ariaDuringSecond).toBe('true');

      // Wait for completion again
      await app.waitForAnimationEnd(12000);

      const ariaAfterSecond = await app.getAnimateAriaPressed();
      expect(ariaAfterSecond).toBe('false');
      const btnText = await app.getAnimateText();
      expect(btnText).toBe('Animate');
    });
  });

  test.describe('Edge cases and runtime observation', () => {
    test('Rapid repeated clicks do not crash the page and no uncaught exceptions are thrown', async ({ page }) => {
      // This test tries to click the animate button repeatedly to exercise the guard clause:
      // "if (animating) return;" and asserts that there are no unexpected runtime errors.

      const app = new RegressionApp(page);

      // Rapidly click the animate button multiple times
      for (let i = 0; i < 6; i++) {
        await app.clickAnimate();
        // tiny delay between rapid clicks
        await page.waitForTimeout(80);
      }

      // Wait a bit for any runtime errors to appear via pageerror
      await page.waitForTimeout(600);

      // If animation started, wait for it to complete to leave the page in stable state
      try {
        await app.waitForAnimationEnd(12000);
      } catch (e) {
        // If animation never started, that's okay - we just ensure there were no uncaught exceptions
      }

      // Check that there are no page errors captured (this is asserted globally in afterEach as well)
      expect(pageErrors.length).toBe(0);
    });

    test('Observe console messages (informational) and ensure no unexpected console.error', async ({ page }) => {
      // This test collects console messages and asserts none are of type 'error' as an additional check.
      // It does not modify the page or its scripts.

      // Give the page a short moment to emit any console logs
      await page.waitForTimeout(200);

      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      // We expect no console.error calls from the application in normal operation
      expect(errorConsoleMessages, `Found console.error messages: ${JSON.stringify(errorConsoleMessages)}`).toHaveLength(0);
    });
  });
});