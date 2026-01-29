import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9877d2-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object for the Sliding Window page
 */
class SlidingWindowPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Elements
  prevBtn() { return this.page.locator('#prevBtn'); }
  nextBtn() { return this.page.locator('#nextBtn'); }
  overlay() { return this.page.locator('.window-overlay'); }
  infoBox() { return this.page.locator('.info-box'); }
  slots() { return this.page.locator('.slot'); }
  inWindowSlots() { return this.page.locator('.slot.in-window'); }

  // Helpers
  async waitForLoadAndInitialUpdate() {
    // Wait for the page load and the script's setTimeout-based info update to have occurred.
    await this.page.waitForLoadState('load');
    // The infoBox text update is delayed by ~420ms in the implementation.
    await this.page.waitForFunction(() => {
      const box = document.querySelector('.info-box');
      return box && box.textContent && box.textContent.trim().startsWith('Window covering indices');
    }, { timeout: 2000 });
  }

  async clickNext() {
    await this.nextBtn().click();
  }

  async clickPrev() {
    await this.prevBtn().click();
  }

  async keyUpOnButton(selector, key = 'Enter') {
    // Focus then dispatch keyup
    const el = this.page.locator(selector);
    await el.focus();
    await el.dispatchEvent('keyup', { key });
  }

  async getInfoText() {
    return (await this.infoBox().innerText()).trim();
  }

  async waitForInfoToContain(substring, timeout = 2000) {
    await this.page.waitForFunction((sub) => {
      const box = document.querySelector('.info-box');
      return box && box.textContent && box.textContent.includes(sub);
    }, substring, { timeout });
  }

  async getPrevDisabled() {
    return this.prevBtn().isDisabled();
  }

  async getNextDisabled() {
    return this.nextBtn().isDisabled();
  }

  async getOverlayOpacity() {
    return await this.overlay().evaluate((el) => getComputedStyle(el).opacity);
  }

  async getOverlayLeftAndWidth() {
    return await this.overlay().evaluate((el) => {
      return {
        left: el.style.left || getComputedStyle(el).left,
        width: el.style.width || getComputedStyle(el).width
      };
    });
  }

  async getInWindowValues() {
    // Return the array of texts for in-window slots
    const count = await this.inWindowSlots().count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push((await this.inWindowSlots().nth(i).innerText()).trim());
    }
    return values;
  }

  async getSlotIndices() {
    const count = await this.slots().count();
    const indices = [];
    for (let i = 0; i < count; i++) {
      indices.push(await this.slots().nth(i).getAttribute('data-index'));
    }
    return indices;
  }
}

test.describe('Sliding Window Visualization - FSM and UI validation', () => {
  // Capture console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Listen to page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page and wait until load
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Ensure no unexpected runtime errors occurred during the test.
    // We assert there are zero page errors and no console messages of type 'error'.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    // If errors exist, print them in the assertion message to help debugging.
    expect(pageErrors.length, `Expected no uncaught page errors, found: ${pageErrors.map(e => e.toString()).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error messages, found: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test('Initial state (S0 Idle -> S1 WindowAtStart): overlay initial opacity, prev disabled, info text updated', async ({ page }) => {
    const app = new SlidingWindowPage(page);

    // Wait for page load and the info update triggered by the page script
    await app.waitForLoadAndInitialUpdate();

    // Validate overlay was initially set in script to be invisible then faded in.
    // After the script's fade-in timeout (~400ms), the overlay should be visible (opacity 1).
    const overlayOpacity = await app.getOverlayOpacity();
    expect(['1', '1.0']).toContain(overlayOpacity);

    // Validate prev is disabled at start (S1_WindowAtStart evidence)
    const prevDisabled = await app.getPrevDisabled();
    expect(prevDisabled).toBe(true);

    // Validate next is enabled
    const nextDisabled = await app.getNextDisabled();
    expect(nextDisabled).toBe(false);

    // Validate info text shows indices [0 ... 3] and the corresponding window values
    // Wait explicitly for the expected indices and values text
    await app.waitForInfoToContain('Window covering indices [0 ... 3]: [7, 2, 9, 4]');
    const infoText = await app.getInfoText();
    expect(infoText).toContain('Window covering indices [0 ... 3]: [7, 2, 9, 4]');

    // Validate the DOM highlights the correct in-window slots with their values
    const inWindowValues = await app.getInWindowValues();
    expect(inWindowValues.join(', ')).toBe('7, 2, 9, 4');

    // Validate overlay computed left and width are present and non-empty strings
    const overlayDims = await app.getOverlayLeftAndWidth();
    expect(overlayDims.left).toBeTruthy();
    expect(overlayDims.width).toBeTruthy();
  });

  test('S1 -> S2: clicking Next moves the window to [1 ... 4] and enables Prev', async ({ page }) => {
    const app = new SlidingWindowPage(page);

    await app.waitForLoadAndInitialUpdate();

    // Click Next once (transition S1_WindowAtStart -> S2_WindowInMiddle)
    await app.clickNext();

    // The info update is delayed; wait for it
    await app.waitForInfoToContain('Window covering indices [1 ... 4]: [2, 9, 4, 5]');

    const infoText = await app.getInfoText();
    expect(infoText).toContain('Window covering indices [1 ... 4]: [2, 9, 4, 5]');

    // Prev should now be enabled (not disabled) per S2 evidence
    const prevDisabled = await app.getPrevDisabled();
    expect(prevDisabled).toBe(false);

    // Next should remain enabled at this middle position
    const nextDisabled = await app.getNextDisabled();
    expect(nextDisabled).toBe(false);

    // Verify in-window slots show expected values
    const inWindowValues = await app.getInWindowValues();
    expect(inWindowValues.join(', ')).toBe('2, 9, 4, 5');
  });

  test('S2 -> S3: advance to window covering indices [6 ... 9] and verify highlight and overlay', async ({ page }) => {
    const app = new SlidingWindowPage(page);

    await app.waitForLoadAndInitialUpdate();

    // Move to position 1 first
    await app.clickNext();
    await app.waitForInfoToContain('Window covering indices [1 ... 4]: [2, 9, 4, 5]');

    // From position 1, click Next repeatedly until we hit the specific indices [6 ... 9]
    // This tests the sequential NextButtonClick events and the resulting transitions.
    let attempts = 0;
    const targetText = 'Window covering indices [6 ... 9]: [3, 6, 1, 0]';
    while (attempts < 10) {
      const info = await app.getInfoText();
      if (info.includes(targetText)) break;
      await app.clickNext();
      // Wait for the info update for each step
      // The update has ~420ms delay; allow up to 1000ms per step.
      await app.page.waitForTimeout(450);
      attempts++;
    }

    // Ensure we reached the desired state at some point
    const finalInfo = await app.getInfoText();
    expect(finalInfo).toContain('[6 ... 9]: [3, 6, 1, 0]');

    // Verify in-window values correspond to the expected slice
    const inWindowValues = await app.getInWindowValues();
    expect(inWindowValues.join(', ')).toBe('3, 6, 1, 0');

    // Overlay left and width should be consistent and set
    const overlayDims = await app.getOverlayLeftAndWidth();
    expect(overlayDims.left).toBeTruthy();
    expect(overlayDims.width).toBeTruthy();

    // At this point, ensure Prev is enabled (since we are not at position 0)
    expect(await app.getPrevDisabled()).toBe(false);
  });

  test('S3 -> S2: clicking Prev from window [6 ... 9] moves to [5 ... 8]', async ({ page }) => {
    const app = new SlidingWindowPage(page);

    await app.waitForLoadAndInitialUpdate();

    // Move forward until we reach the indices [6 ... 9] as above
    await app.clickNext();
    await app.waitForInfoToContain('Window covering indices [1 ... 4]: [2, 9, 4, 5]');

    // Advance to [6 ... 9]
    for (let i = 0; i < 6; i++) {
      await app.clickNext();
      await app.page.waitForTimeout(450);
    }

    // Confirm we are at [6 ... 9]
    await app.waitForInfoToContain('[6 ... 9]: [3, 6, 1, 0]');

    // Click Prev once to transition back (S3_WindowAtEnd -> S2_WindowInMiddle per FSM)
    await app.clickPrev();

    // Wait for update and assert the expected indices [5 ... 8]: [8, 3, 6, 1]
    await app.waitForInfoToContain('Window covering indices [5 ... 8]: [8, 3, 6, 1]');

    const infoText = await app.getInfoText();
    expect(infoText).toContain('Window covering indices [5 ... 8]: [8, 3, 6, 1]');

    // Verify the in-window slot values
    const inWindowValues = await app.getInWindowValues();
    expect(inWindowValues.join(', ')).toBe('8, 3, 6, 1');

    // Prev should still be enabled (we are not at position 0)
    expect(await app.getPrevDisabled()).toBe(false);
  });

  test('Keyboard accessibility: keyup Enter/Space triggers button click behavior', async ({ page }) => {
    const app = new SlidingWindowPage(page);

    await app.waitForLoadAndInitialUpdate();

    // At start, prev is disabled. Simulate keyup Enter on prev -> should do nothing.
    await app.keyUpOnButton('#prevBtn', 'Enter');
    // Wait briefly to allow any change if occurred
    await page.waitForTimeout(300);
    // Info should still be initial indices [0 ... 3]
    let infoText = await app.getInfoText();
    expect(infoText).toContain('Window covering indices [0 ... 3]: [7, 2, 9, 4]');

    // Now test keyup on Next with Space to move forward
    await app.keyUpOnButton('#nextBtn', ' ');
    // Wait for update
    await app.waitForInfoToContain('Window covering indices [1 ... 4]: [2, 9, 4, 5]');
    infoText = await app.getInfoText();
    expect(infoText).toContain('Window covering indices [1 ... 4]: [2, 9, 4, 5]');

    // Now simulate multiple Space keyups to go to the end; ensure it doesn't exceed bounds
    for (let i = 0; i < 20; i++) {
      await app.keyUpOnButton('#nextBtn', ' ');
      await page.waitForTimeout(200);
    }

    // After many keyups, next should be disabled at the maximum position
    const nextDisabled = await app.getNextDisabled();
    expect(nextDisabled).toBe(true);

    // And the info should reflect a valid final window covering the highest indices (no out-of-bounds)
    const finalInfo = await app.getInfoText();
    // It should start with 'Window covering indices ['; ensure no NaN or undefined present
    expect(finalInfo).toMatch(/Window covering indices \[\d+ \.\.\. \d+\]: \[.*\]/);
  });

  test('Edge cases: clicking Prev when disabled and rapid clicks do not cause exceptions or out-of-bounds', async ({ page }) => {
    const app = new SlidingWindowPage(page);

    await app.waitForLoadAndInitialUpdate();

    // Ensure prev disabled at start and clicking it does nothing harmful
    expect(await app.getPrevDisabled()).toBe(true);
    await app.clickPrev(); // should be a no-op
    await page.waitForTimeout(300);
    expect(await app.getInfoText()).toContain('Window covering indices [0 ... 3]: [7, 2, 9, 4]');

    // Rapidly click Next many times to attempt to push beyond bounds
    for (let i = 0; i < 50; i++) {
      await app.clickNext();
    }
    // Allow final update to settle
    await page.waitForTimeout(600);

    // Ensure next is disabled at the upper bound and info shows a valid final window
    expect(await app.getNextDisabled()).toBe(true);
    const finalText = await app.getInfoText();
    expect(finalText).toMatch(/Window covering indices \[\d+ \.\.\. \d+\]: \[.*\]/);

    // Rapidly click Prev many times to attempt to push below zero
    for (let i = 0; i < 50; i++) {
      await app.clickPrev();
    }
    await page.waitForTimeout(600);

    // Ensure prev is disabled at lower bound (position 0) and info is valid
    expect(await app.getPrevDisabled()).toBe(true);
    const resetText = await app.getInfoText();
    expect(resetText).toMatch(/Window covering indices \[0 \.\.\. \d+\]: \[.*\]/);
  });
});