import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f828b1-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object for the visual demo
class VisualPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#playBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.scene = page.locator('#scene');
    this.packet = page.locator('#packet');
    this.packetResp = page.locator('#packetResp');
    this.bubbleReq = page.locator('#bubbleReq');
    this.bubbleRes = page.locator('#bubbleRes');
    this.statusBadge = page.locator('#statusBadge');
    this.statusText = page.locator('#statusText');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the app has initialized (reset() runs on load)
    await this.page.waitForLoadState('networkidle');
  }

  async clickSend() {
    await this.playBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async pressEnterOnPlay() {
    await this.playBtn.focus();
    await this.page.keyboard.up('Enter'); // ensure no stuck key
    await this.page.keyboard.press('Enter');
  }

  async pressEnterOnReset() {
    await this.resetBtn.focus();
    await this.page.keyboard.up('Enter');
    await this.page.keyboard.press('Enter');
  }

  async getPlayAriaPressed() {
    return this.playBtn.getAttribute('aria-pressed');
  }

  async sceneHasAnimateClass() {
    return this.scene.evaluate((el) => el.classList.contains('animate'));
  }

  async statusBadgeOpacity() {
    return this.statusBadge.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return parseFloat(s.opacity);
    });
  }

  async getStatusChipHasStatusClass() {
    return this.statusText.evaluate((el) => el.classList.contains('status'));
  }

  async getInlineStyle(selector) {
    return this.page.$eval(selector, (el) => el.getAttribute('style') || '');
  }

  async bubbleOpacity(selector) {
    return this.page.$eval(selector, (el) => {
      const s = window.getComputedStyle(el);
      return parseFloat(s.opacity);
    });
  }
}

test.describe('HTTP Visual Guide - FSM states & transitions', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled exceptions in page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // detach listeners to avoid cross-test accumulation
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test.describe('Initial / Idle state (S0_Idle)', () => {
    test('loads and initializes in Idle with reset() applied', async ({ page }) => {
      // Validate the initial state after page load
      const app = new VisualPage(page);
      await app.goto();

      // Comments: Validate that the page initialized and reset() ran.
      // reset() sets packet inline style and hides bubbles/status.
      const ariaPressed = await app.getPlayAriaPressed();
      expect(ariaPressed).toBe('false'); // play button should be unpressed

      const sceneAnimate = await app.sceneHasAnimateClass();
      expect(sceneAnimate).toBe(false); // no animation class at idle

      // inline styles set by reset()
      const packetStyle = await app.getInlineStyle('#packet');
      expect(packetStyle).toMatch(/translateY\(0\)/); // reset transform applied
      const packetOpacity = await app.bubbleOpacity('#packet');
      expect(packetOpacity).toBeGreaterThanOrEqual(0); // computed opacity available

      // bubbles and status hidden
      const bubbleReqOpacity = await app.bubbleOpacity('#bubbleReq');
      const bubbleResOpacity = await app.bubbleOpacity('#bubbleRes');
      expect(bubbleReqOpacity).toBeCloseTo(0, 1);
      expect(bubbleResOpacity).toBeCloseTo(0, 1);
      const statusOpacity = await app.statusBadgeOpacity();
      expect(statusOpacity).toBeCloseTo(0, 1);

      // Ensure no fatal page errors like ReferenceError/SyntaxError/TypeError occurred during load
      const fatalErrors = pageErrors.filter(e =>
        /ReferenceError|SyntaxError|TypeError/i.test(String(e))
      );
      expect(fatalErrors).toEqual([]);
    });
  });

  test.describe('Animating state (S1_Animating) and transitions', () => {
    test('Send Request (click #playBtn) transitions to Animating and reveals status after sequence', async ({ page }) => {
      const app = new VisualPage(page);
      await app.goto();

      // Monitor DOM for the live region appended by startAnimation() to announce "Sending HTTP request"
      // Immediately click to start animation
      await app.clickSend();

      // After clicking, aria-pressed should be "true" while running
      let ariaPressed = await app.getPlayAriaPressed();
      expect(ariaPressed).toBe('true');

      // scene should have animate class added
      let sceneAnimated = await app.sceneHasAnimateClass();
      expect(sceneAnimated).toBe(true);

      // Status badge should appear after ~3200ms (startAnimation uses setTimeout 3200)
      // Wait up to 5s for status badge opacity to become > 0
      await page.waitForFunction(() => {
        const el = document.getElementById('statusBadge');
        if (!el) return false;
        return parseFloat(window.getComputedStyle(el).opacity) > 0;
      }, { timeout: 6000 });

      const statusVisibleOpacity = await app.statusBadgeOpacity();
      expect(statusVisibleOpacity).toBeGreaterThan(0);

      // statusText chip should have 'status' class applied by startAnimation
      const hasStatusClass = await app.getStatusChipHasStatusClass();
      expect(hasStatusClass).toBe(true);

      // After 4200ms startAnimation sets running=false and sets aria-pressed back to false
      // Wait until aria-pressed toggles back or timeout
      await page.waitForFunction(() => {
        const btn = document.getElementById('playBtn');
        return btn && btn.getAttribute('aria-pressed') === 'false';
      }, { timeout: 7000 });

      ariaPressed = await app.getPlayAriaPressed();
      expect(ariaPressed).toBe('false');

      // The scene class remains 'animate' until reset() - ensure animate class is still present
      sceneAnimated = await app.sceneHasAnimateClass();
      expect(sceneAnimated).toBe(true);

      // Validate there were no unexpected fatal runtime errors during the animation
      const fatalErrorsDuring = pageErrors.filter(e =>
        /ReferenceError|SyntaxError|TypeError/i.test(String(e))
      );
      expect(fatalErrorsDuring).toEqual([]);
    });

    test('Reset (click #resetBtn) from Animating should remove animate class and reset visual elements', async ({ page }) => {
      const app = new VisualPage(page);
      await app.goto();

      // Start animation
      await app.clickSend();

      // Ensure animation began
      await expect(app.scene).toHaveClass(/animate/);

      // Click reset while animating
      await app.clickReset();

      // After reset: scene should no longer have animate class
      await page.waitForFunction(() => {
        const scene = document.getElementById('scene');
        return scene && !scene.classList.contains('animate');
      }, { timeout: 2000 });

      const sceneAnimated = await app.sceneHasAnimateClass();
      expect(sceneAnimated).toBe(false);

      // playBtn should reflect not pressed
      const ariaPressed = await app.getPlayAriaPressed();
      expect(ariaPressed).toBe('false');

      // packet and packetResp should have been reset to their base inline styles by reset()
      const packetStyle = await app.getInlineStyle('#packet');
      expect(packetStyle).toMatch(/translateY\(0\)/);
      const packetRespStyle = await app.getInlineStyle('#packetResp');
      expect(packetRespStyle).toMatch(/translateY\(140px\)/);

      // status badge should be hidden and chip shouldn't have status class
      const statusOpacity = await app.statusBadgeOpacity();
      expect(statusOpacity).toBeCloseTo(0, 1);
      const statusHasClass = await app.getStatusChipHasStatusClass();
      // The code removes the 'status' class in reset(); expect false
      expect(statusHasClass).toBe(false);
    });

    test('Keyboard Enter activates play and reset buttons', async ({ page }) => {
      const app = new VisualPage(page);
      await app.goto();

      // Press Enter on playBtn
      await app.pressEnterOnPlay();

      // aria-pressed should become true
      await page.waitForFunction(() => document.getElementById('playBtn').getAttribute('aria-pressed') === 'true', { timeout: 2000 });
      let ariaPressed = await app.getPlayAriaPressed();
      expect(ariaPressed).toBe('true');

      // Press Enter on resetBtn to reset animation early
      await app.pressEnterOnReset();

      // After reset, aria-pressed should be false and scene shouldn't have animate
      await page.waitForFunction(() => document.getElementById('playBtn').getAttribute('aria-pressed') === 'false', { timeout: 2000 });
      ariaPressed = await app.getPlayAriaPressed();
      expect(ariaPressed).toBe('false');
      const sceneAnimated = await app.sceneHasAnimateClass();
      expect(sceneAnimated).toBe(false);
    });

    test('Edge case: rapid double click of Send Request does not create duplicate runs (startAnimation guard)', async ({ page }) => {
      const app = new VisualPage(page);
      await app.goto();

      // Before any action, count live region nodes (startAnimation appends one per start)
      const initialLiveCount = await page.evaluate(() => document.querySelectorAll('div[aria-live="polite"]').length);

      // Rapidly click twice
      await app.clickSend();
      await app.clickSend();

      // Immediately count live region nodes - because startAnimation has a guard if running, second click should be ignored
      const immediateLiveCount = await page.evaluate(() => document.querySelectorAll('div[aria-live="polite"]').length);

      // There must be at least one new live node compared to initial (the start), but double click should not add a second one immediately
      expect(immediateLiveCount - initialLiveCount).toBeLessThanOrEqual(1);

      // Wait for the live region to be removed (startAnimation removes after 1200ms)
      await page.waitForTimeout(1400);
      const laterLiveCount = await page.evaluate(() => document.querySelectorAll('div[aria-live="polite"]').length);
      expect(laterLiveCount).toBe(initialLiveCount); // cleanup happened

      // Ensure play button ultimately returns to unpressed
      await page.waitForFunction(() => document.getElementById('playBtn').getAttribute('aria-pressed') === 'false', { timeout: 6000 });
      const finalAria = await app.getPlayAriaPressed();
      expect(finalAria).toBe('false');
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Clicking Reset when idle keeps UI stable', async ({ page }) => {
      const app = new VisualPage(page);
      await app.goto();

      // Click reset in idle state
      await app.clickReset();

      // Nothing should break: scene still no animate, status remains hidden
      const sceneAnimated = await app.sceneHasAnimateClass();
      expect(sceneAnimated).toBe(false);

      const statusOpacity = await app.statusBadgeOpacity();
      expect(statusOpacity).toBeCloseTo(0, 1);

      // No page errors introduced by clicking reset in idle
      const fatalErrors = pageErrors.filter(e =>
        /ReferenceError|SyntaxError|TypeError/i.test(String(e))
      );
      expect(fatalErrors).toEqual([]);
    });

    test('Collect console messages and assert no fatal runtime errors occurred', async ({ page }) => {
      const app = new VisualPage(page);
      await app.goto();

      // Run a small interaction to possibly surface runtime issues
      await app.clickSend();
      await page.waitForTimeout(100); // give a moment for any synchronous console errors

      // Check captured console messages for 'error' type and fatal exceptions list
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      // The UI should not emit console errors; assert zero error messages
      expect(errorConsoleMessages).toEqual([]);

      // Page errors (uncaught exceptions) should be empty or at least not contain fatal JS errors
      const fatalPageErrors = pageErrors.filter(e =>
        /ReferenceError|SyntaxError|TypeError/i.test(String(e))
      );
      // Assert no fatal page-level errors occurred
      expect(fatalPageErrors).toEqual([]);
    });
  });
});