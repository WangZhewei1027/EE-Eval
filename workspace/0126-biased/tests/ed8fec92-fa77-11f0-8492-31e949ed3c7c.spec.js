import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8fec92-fa77-11f0-8492-31e949ed3c7c.html';

// Page object to encapsulate interactions with the Garbage Collection Visualization page
class GarbagePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.start = '#start';
    this.stop = '#stop';
    this.garbage = '.garbage';
    this.title = '#title';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickStart() {
    await this.page.click(this.start);
  }

  async clickStop() {
    await this.page.click(this.stop);
  }

  async isStartVisible() {
    return this.page.isVisible(this.start);
  }

  async isStopVisible() {
    return this.page.isVisible(this.stop);
  }

  async garbageCount() {
    return this.page.$$eval(this.garbage, nodes => nodes.length);
  }

  // Wait until at least `n` garbage elements exist or timeout
  async waitForGarbageCountAtLeast(n, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, expected) => document.querySelectorAll(sel).length >= expected,
      this.garbage,
      n,
      { timeout }
    );
    return this.garbageCount();
  }

  // Wait until garbage count becomes exactly 0
  async waitForNoGarbage(timeout = 3000) {
    await this.page.waitForFunction(
      sel => document.querySelectorAll(sel).length === 0,
      this.garbage,
      { timeout }
    );
  }

  // Get computed display style for start/stop
  async getStartDisplay() {
    return this.page.$eval(this.start, el => getComputedStyle(el).display);
  }

  async getStopDisplay() {
    return this.page.$eval(this.stop, el => getComputedStyle(el).display);
  }

  // Get title text
  async getTitleText() {
    return this.page.$eval(this.title, el => el.textContent);
  }
}

test.describe('Garbage Collection Visualization - FSM and UI tests', () => {
  // Arrays to capture console error messages and page errors (uncaught exceptions).
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore monitoring errors
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err?.message ?? String(err));
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test assert that the page did not produce runtime exceptions or console errors.
    // This validates that the application's runtime did not throw ReferenceError/SyntaxError/TypeError during normal operations.
    expect(pageErrors, `Detected uncaught page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Detected console.error messages: ${consoleErrors.join(' | ')}`).toHaveLength(0);

    // Attempt to close the page to release resources (Playwright will handle it, but explicit safety is fine)
    try {
      await page.close();
    } catch (e) {
      // ignore page close errors in teardown
    }
  });

  test.describe('State S0_Idle (initial) validations', () => {
    test('Initial Idle state shows Start and hides Stop; title present', async ({ page }) => {
      const app = new GarbagePage(page);
      // Navigate to the page in its initial state
      await app.goto();

      // Validate title is present and correct (basic sanity of renderPage-like behavior)
      const title = await app.getTitleText();
      expect(title).toBeTruthy();
      expect(title).toContain('Garbage Collection');

      // Verify FSM evidence: Start button visible, Stop button hidden
      expect(await app.isStartVisible()).toBe(true);
      expect(await app.isStopVisible()).toBe(false);

      // Computed style checks match evidence
      const startDisplay = await app.getStartDisplay();
      const stopDisplay = await app.getStopDisplay();
      expect(startDisplay).toBe('inline-block' || 'block' || startDisplay); // allow typical button display
      expect(stopDisplay).toBe('none');

      // No garbage elements on initial render
      const initialGarbage = await app.garbageCount();
      expect(initialGarbage).toBe(0);
    });
  });

  test.describe('Transitions: StartAnimation (S0 -> S1) and StopAnimation (S1 -> S0)', () => {
    test('StartAnimation: clicking Start hides Start, shows Stop, and spawns garbage elements', async ({ page }) => {
      const app = new GarbagePage(page);
      await app.goto();

      // Click Start to transition to S1_Animating
      await app.clickStart();

      // After entering S1_Animating, start button should be hidden and stop visible
      expect(await app.isStartVisible()).toBe(false);
      expect(await app.isStopVisible()).toBe(true);

      // The entry action startAnimation should set inline display styles accordingly
      const startDisplayAfter = await app.getStartDisplay();
      const stopDisplayAfter = await app.getStopDisplay();
      expect(startDisplayAfter).toBe('none');
      expect(stopDisplayAfter).not.toBe('none');

      // The animation spawns garbage elements periodically (every ~800ms). Wait for at least 2 to assert the interval is active.
      // Use a slightly generous timeout to avoid flakes.
      const count = await app.waitForGarbageCountAtLeast(2, 6000);
      expect(count).toBeGreaterThanOrEqual(2);

      // Validate some properties of the garbage elements (they should have width/height styles set)
      const garbageStyles = await page.$$eval('.garbage', nodes =>
        nodes.slice(0, 3).map(n => ({
          width: n.style.width,
          height: n.style.height,
          left: n.style.left,
          className: n.className
        }))
      );
      expect(garbageStyles.length).toBeGreaterThan(0);
      garbageStyles.forEach(s => {
        // widths should be non-empty strings like "20px" etc.
        expect(typeof s.width).toBe('string');
        expect(s.className).toContain('garbage');
      });
    });

    test('StopAnimation: clicking Stop reveals Start, hides Stop, clears garbage and stops creation', async ({ page }) => {
      const app = new GarbagePage(page);
      await app.goto();

      // Start first so there is garbage to clear
      await app.clickStart();
      await app.waitForGarbageCountAtLeast(1, 5000);

      // Click Stop to transition back to Idle
      await app.clickStop();

      // After stopping, Start should be visible and Stop hidden (evidence of exit_actions)
      expect(await app.isStartVisible()).toBe(true);
      expect(await app.isStopVisible()).toBe(false);

      // All existing .garbage elements should be removed by stopAnimation()
      await app.waitForNoGarbage(3000);
      expect(await app.garbageCount()).toBe(0);

      // Additionally, ensure no new garbage appears after stopping (wait longer than creation interval)
      await page.waitForTimeout(1700); // interval was 800ms in app; wait double to be safe
      expect(await app.garbageCount()).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Rapid double-click Start: multiple interval creation should still be stoppable and cleaned up', async ({ page }) => {
      const app = new GarbagePage(page);
      await app.goto();

      // Rapidly click Start twice to simulate potential double-interval creation
      await Promise.all([app.clickStart(), app.clickStart()]);

      // Wait for multiple garbage items to confirm intervals are producing items
      const count = await app.waitForGarbageCountAtLeast(3, 8000);
      expect(count).toBeGreaterThanOrEqual(3);

      // Now stop and verify cleanup and stoppage of further creation
      await app.clickStop();
      await app.waitForNoGarbage(3000);
      expect(await app.garbageCount()).toBe(0);

      // Wait some time to ensure no new garbage appears after stop
      await page.waitForTimeout(2000);
      expect(await app.garbageCount()).toBe(0);
    });

    test('Attempting to click Stop while it is hidden should result in a visibility/timeout error (Playwright-level)', async ({ page }) => {
      const app = new GarbagePage(page);
      await app.goto();

      // Confirm Stop is hidden initially per FSM
      expect(await app.isStopVisible()).toBe(false);

      // Attempting to click a non-visible element with the default click behavior should reject.
      // We assert that Playwright rejects the action because the element is not visible/clickable.
      let threw = false;
      try {
        await app.clickStop(); // should throw due to not visible
      } catch (err) {
        threw = true;
        // The error from Playwright usually contains 'element is not visible' or 'waiting for element to be visible'
        const msg = err && err.message ? err.message.toLowerCase() : '';
        expect(msg.includes('visible') || msg.includes('timeout') || msg.includes('hidden')).toBeTruthy();
      }
      expect(threw).toBe(true);
    });
  });

  test.describe('Robustness: sanity checks and small integration scenarios', () => {
    test('Start then immediately Stop should do a start->stop roundtrip without leaving garbage', async ({ page }) => {
      const app = new GarbagePage(page);
      await app.goto();

      // Start
      await app.clickStart();
      // Immediately stop
      await app.clickStop();

      // This should result in no garbage leftover
      await app.waitForNoGarbage(3000);
      expect(await app.garbageCount()).toBe(0);

      // Buttons should be back to initial state
      expect(await app.isStartVisible()).toBe(true);
      expect(await app.isStopVisible()).toBe(false);
    });
  });
});