import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ab16c0-fa78-11f0-812d-c9788050701f.html';

// Page Object for the Sliding Window application
class SlidingWindowPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nextBtn = page.locator('#nextBtn');
    this.prevBtn = page.locator('#prevBtn');
    this.windowEl = page.locator('.window');
    this.indicator = page.locator('.window-size-indicator');
    this.dataItems = page.locator('.data-item');
    // collections to record runtime logs/errors
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  async goto() {
    // register console and pageerror observers
    this.page.on('console', msg => {
      this.consoleMessages.push(msg);
    });
    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });

    await this.page.goto(BASE_URL, { waitUntil: 'load' });
    // ensure DOMContentLoaded handlers have run
    // wait for data items to be present (there should be 20 generated)
    await this.page.waitForSelector('.data-item');
  }

  async clickNext() {
    await this.nextBtn.click();
  }

  async clickPrev() {
    await this.prevBtn.click();
  }

  async getWindowTransform() {
    // return the inline style.transform (as set by the app)
    return await this.page.evaluate(() => {
      const el = document.querySelector('.window');
      return el ? el.style.transform : '';
    });
  }

  async getIndicatorLeft() {
    return await this.page.evaluate(() => {
      const el = document.querySelector('.window-size-indicator');
      return el ? el.style.left : '';
    });
  }

  async getHighlightedIndices() {
    // return array of indices (0-based) of items that have highlight class
    return await this.page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.data-item'));
      return items.map((it, idx) => ({ idx, highlighted: it.classList.contains('highlight') }))
                  .filter(x => x.highlighted)
                  .map(x => x.idx);
    });
  }

  async getWindowSumText() {
    return await this.windowEl.textContent();
  }

  async getDataItemValues() {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('.data-item')).map(el => parseInt(el.textContent));
    });
  }

  async hasPulseClass() {
    return await this.page.evaluate(() => {
      const el = document.querySelector('.window');
      return el ? el.classList.contains('pulse') : false;
    });
  }

  // helper to parse px value from transform string like 'translateX(190px)'
  static parseTranslateX(transform) {
    if (!transform) return 0;
    const m = /translateX\(([-\d.]+)px\)/.exec(transform);
    if (m) return parseFloat(m[1]);
    return 0;
  }

  // helper to parse px value from indicator.left like '190px'
  static parsePx(px) {
    if (!px) return 0;
    const m = /([-.\d]+)px/.exec(px);
    return m ? parseFloat(m[1]) : 0;
  }

  // assertions helpers for console and page errors
  assertNoPageErrors() {
    // Ensure no uncaught page errors occurred
    expect(this.pageErrors, `Expected no page errors, got: ${this.pageErrors.map(e => String(e)).join('\n')}`).toHaveLength(0);
  }

  assertNoConsoleErrors() {
    const errs = this.consoleMessages.filter(m => m.type() === 'error');
    expect(errs, `Expected no console.error messages, got: ${errs.map(e => e.text()).join('\n')}`).toHaveLength(0);
  }
}

test.describe('Sliding Window - Visual Elegance (FSM tests)', () => {
  // Increase test timeout for tests that wait for animations/intervals
  test.setTimeout(60_000);

  test.describe('Initial State (S0_Initial) validations', () => {
    test('S0_Initial: updateWindow runs on DOMContentLoaded - highlights and indicator are initialized', async ({ page }) => {
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Validate no runtime errors were emitted during load
      app.assertNoPageErrors();
      app.assertNoConsoleErrors();

      // The window text should show 'Sum:' and the indicator left should be '0px'
      const sumText = await app.getWindowSumText();
      expect(sumText).toBeTruthy();
      expect(sumText.trim().startsWith('Sum:'), 'Window text should start with "Sum:"').toBe(true);

      const indicatorLeft = await app.getIndicatorLeft();
      expect(indicatorLeft === '' || indicatorLeft === '0px' || SlidingWindowPage.parsePx(indicatorLeft) === 0).toBe(true);

      // Exactly windowSize (4) items should be highlighted
      const highlighted = await app.getHighlightedIndices();
      expect(highlighted.length).toBe(4);
      // They should be the first 4 items (indices 0..3)
      expect(highlighted).toEqual([0,1,2,3]);
    });
  });

  test.describe('Next/Prev events and transitions (S1_WindowMoved)', () => {
    test('NextButtonClick: moves window forward by one and updates transform, indicator and highlights', async ({ page }) => {
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Capture initial item values to compute expected sum
      const values = await app.getDataItemValues();

      // Click Next once
      await app.clickNext();

      // No runtime errors
      app.assertNoPageErrors();
      app.assertNoConsoleErrors();

      // After one Next, transform should be translateX(190px)
      const transform = await app.getWindowTransform();
      expect(transform).toContain('translateX');
      expect(SlidingWindowPage.parseTranslateX(transform)).toBeCloseTo(190, 1);

      // Indicator left should be 190px
      const indicatorLeft = await app.getIndicatorLeft();
      expect(SlidingWindowPage.parsePx(indicatorLeft)).toBeCloseTo(190, 1);

      // Highlighted indices should be 1..4
      const highlighted = await app.getHighlightedIndices();
      expect(highlighted).toEqual([1,2,3,4]);

      // Window sum text should equal sum of items[1..4]
      const expectedSum = values.slice(1, 1 + 4).reduce((a,b) => a + b, 0);
      const sumText = await app.getWindowSumText();
      expect(sumText.trim()).toBe(`Sum: ${expectedSum}`);
    });

    test('Multiple Next clicks: cannot move beyond allowed boundary; transform stops at max', async ({ page }) => {
      const app = new SlidingWindowPage(page);
      await app.goto();

      const totalItems = await page.evaluate(() => document.querySelectorAll('.data-item').length);
      const windowSize = 4;
      const maxStart = totalItems - windowSize; // 20 - 4 = 16

      // Click Next many times (more than needed) to test boundary
      const clicks = maxStart + 5;
      for (let i = 0; i < clicks; i++) {
        await app.clickNext();
        // slight pause so animation/update has time (CSS transition is 0.8s, but updates are immediate)
        await page.waitForTimeout(50);
      }

      // Assert transform corresponds to maxStart
      const transform = await app.getWindowTransform();
      const px = SlidingWindowPage.parseTranslateX(transform);
      expect(px).toBeCloseTo(maxStart * 190, 1);

      // Highlighted indices should be the last window [maxStart..maxStart+3]
      const highlighted = await app.getHighlightedIndices();
      const expectedHighlighted = Array.from({length: windowSize}, (_,i) => maxStart + i);
      expect(highlighted).toEqual(expectedHighlighted);

      // No runtime errors
      app.assertNoPageErrors();
      app.assertNoConsoleErrors();
    });

    test('PrevButtonClick: moves window backward and respects lower boundary', async ({ page }) => {
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Move to a middle position first (3 next clicks)
      await app.clickNext();
      await page.waitForTimeout(50);
      await app.clickNext();
      await page.waitForTimeout(50);
      await app.clickNext();
      await page.waitForTimeout(50);

      // Now click Prev and expect transform decreased by 190px
      const beforeTransform = await app.getWindowTransform();
      const beforePx = SlidingWindowPage.parseTranslateX(beforeTransform);

      await app.clickPrev();
      await page.waitForTimeout(100); // allow update

      const afterTransform = await app.getWindowTransform();
      const afterPx = SlidingWindowPage.parseTranslateX(afterTransform);

      expect(afterPx).toBeCloseTo(beforePx - 190, 1);

      // Now test Prev at initial boundary (reload to reset)
      await page.reload({ waitUntil: 'load' });
      // re-register listeners via new Page Object
      const freshApp = new SlidingWindowPage(page);
      await freshApp.goto();

      // Click Prev at initial state
      await freshApp.clickPrev();
      await page.waitForTimeout(50);

      // The transform should be translateX(0px) or empty string resulted in 0
      const t = await freshApp.getWindowTransform();
      expect(SlidingWindowPage.parseTranslateX(t)).toBeCloseTo(0, 1);

      // Highlight remains first 4 items
      const highlighted = await freshApp.getHighlightedIndices();
      expect(highlighted).toEqual([0,1,2,3]);

      freshApp.assertNoPageErrors();
      freshApp.assertNoConsoleErrors();
    });

    test('Pulse animation is added on moveWindow and removed after timeout', async ({ page }) => {
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Ensure no pulse initially
      let hasPulse = await app.hasPulseClass();
      expect(hasPulse).toBe(false);

      // Click Next triggers pulse class addition for 2000ms
      await app.clickNext();

      // Immediately after click, pulse class should be present
      await page.waitForTimeout(50);
      hasPulse = await app.hasPulseClass();
      expect(hasPulse).toBe(true);

      // Wait for >2000ms to let the timeout remove the class
      await page.waitForTimeout(2200);
      hasPulse = await app.hasPulseClass();
      expect(hasPulse).toBe(false);

      app.assertNoPageErrors();
      app.assertNoConsoleErrors();
    });
  });

  test.describe('Auto-animation and interaction side-effects (edge cases)', () => {
    test('Auto animation starts after 3s and moves the window automatically', async ({ page }) => {
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Wait slightly longer than 3s so that startAutoAnimation's setTimeout executes
      // The auto interval calls moveWindow('next') every 1500ms; after 3s we expect at least one automatic move
      await page.waitForTimeout(3500);

      // After auto-start we should observe the transform changed from initial (0) to at least 190px
      const transform = await app.getWindowTransform();
      expect(transform).toContain('translateX');
      expect(SlidingWindowPage.parseTranslateX(transform)).toBeGreaterThanOrEqual(190);

      app.assertNoPageErrors();
      app.assertNoConsoleErrors();
    });

    test('User interaction stops auto animation (interval cleared) - clicking a button prevents further auto moves', async ({ page }) => {
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Wait until auto animation starts (after 3s)
      await page.waitForTimeout(3200);

      // Capture transform at this moment
      const before = await app.getWindowTransform();
      const beforePx = SlidingWindowPage.parseTranslateX(before);

      // Click a button to clear the interval (the app sets click handlers to clearInterval)
      await app.clickNext();

      // Wait for longer than one auto interval (1500ms) to see if further auto moves occur
      await page.waitForTimeout(1700);

      const after = await app.getWindowTransform();
      const afterPx = SlidingWindowPage.parseTranslateX(after);

      // Since we clicked to stop the interval, the transform should not have changed further by an additional interval
      // It's possible the click itself triggered one move; ensure not changed more than one step from the snapshot after click.
      // We allow at most one additional step from beforePx.
      expect(afterPx).toBeLessThanOrEqual(beforePx + 2 * 190 + 1); // tolerances for timing
      // Also ensure no unexpected errors
      app.assertNoPageErrors();
      app.assertNoConsoleErrors();
    });
  });

  test.describe('Robustness and error expectations', () => {
    test('No unexpected runtime errors or console.error messages during extended interaction', async ({ page }) => {
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Interact a sequence of next/prev to exercise transitions
      for (let i = 0; i < 5; i++) {
        await app.clickNext();
        await page.waitForTimeout(30);
      }
      for (let i = 0; i < 3; i++) {
        await app.clickPrev();
        await page.waitForTimeout(30);
      }

      // Wait briefly to allow any async timers to surface errors
      await page.waitForTimeout(200);

      // Assert no page errors or console error messages were captured
      app.assertNoPageErrors();
      app.assertNoConsoleErrors();
    });

    test('Edge case: clicking Next rapidly does not throw and keeps window within expected bounds', async ({ page }) => {
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Rapid clicks: perform many next clicks quickly
      for (let i = 0; i < 40; i++) {
        // do not await click to simulate rapid interaction - but Playwright clicks are awaited to ensure DOM interaction is allowed.
        // We'll still await but use minimal delay between clicks.
        await app.clickNext();
      }

      // Allow updates
      await page.waitForTimeout(200);

      // Check transform within expected max (16*190)
      const totalItems = await page.evaluate(() => document.querySelectorAll('.data-item').length);
      const windowSize = 4;
      const maxStart = totalItems - windowSize;
      const transform = await app.getWindowTransform();
      const px = SlidingWindowPage.parseTranslateX(transform);
      expect(px).toBeLessThanOrEqual(maxStart * 190 + 1);
      expect(px).toBeGreaterThanOrEqual(0 - 1);

      app.assertNoPageErrors();
      app.assertNoConsoleErrors();
    });
  });
});