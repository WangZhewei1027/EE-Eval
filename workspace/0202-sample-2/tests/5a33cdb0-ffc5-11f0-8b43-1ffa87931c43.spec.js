import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a33cdb0-ffc5-11f0-8b43-1ffa87931c43.html';

// Page Object for the Sliding Window Visualization
class SlidingWindowPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayContainer = page.locator('#array-container');
    this.inputArray = page.locator('#input-array');
    this.inputK = page.locator('#input-k');
    this.startBtn = page.locator('#start-btn');
    this.prevBtn = page.locator('#prev-btn');
    this.nextBtn = page.locator('#next-btn');
    this.autoBtn = page.locator('#auto-btn');
    this.message = page.locator('#message');
  }

  async goto() {
    await this.page.goto(BASE);
  }

  async getElementsCount() {
    return await this.arrayContainer.locator('.element').count();
  }

  async getElementClasses(index) {
    const el = this.arrayContainer.locator('.element').nth(index);
    const classAttr = await el.getAttribute('class');
    return classAttr ? classAttr.split(/\s+/) : [];
  }

  async getMessageText() {
    return (await this.message.textContent())?.trim() ?? '';
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickNext() {
    await this.nextBtn.click();
  }

  async clickPrev() {
    await this.prevBtn.click();
  }

  async clickAuto() {
    await this.autoBtn.click();
  }

  async fillArray(value) {
    await this.inputArray.fill(value);
  }

  async fillK(value) {
    await this.inputK.fill(String(value));
  }

  async prevDisabled() {
    return await this.prevBtn.isDisabled();
  }

  async nextDisabled() {
    return await this.nextBtn.isDisabled();
  }

  async autoButtonText() {
    return (await this.autoBtn.textContent())?.trim() ?? '';
  }
}

test.describe('Sliding Window Visualization - FSM and UI tests', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // Capture console messages for inspection
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', error => {
      // Capture page errors (uncaught exceptions)
      pageErrors.push(error);
    });
  });

  test.afterEach(async () => {
    // Assert that no uncaught page errors of critical types occurred during the test
    // We explicitly check for ReferenceError, SyntaxError, TypeError instances.
    const criticalErrors = pageErrors.filter(e =>
      e instanceof ReferenceError || e instanceof SyntaxError || e instanceof TypeError ||
      // some runtimes supply Error with name property — check names too
      ['ReferenceError', 'SyntaxError', 'TypeError'].includes(e?.name)
    );

    // Also check for console error-level messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');

    // If there are any critical errors or console error messages, fail the test with details.
    expect(criticalErrors.length, `No critical page errors should appear. Found: ${criticalErrors.length}`).toBe(0);
    expect(consoleErrors.length, `No console.error messages should appear. Found: ${consoleErrors.length}`).toBe(0);
  });

  test('Initial render -> S0_Idle entry and transition to S1_Visualizing (array rendered, window highlighted, message updated, controls updated)', async ({ page }) => {
    // This test validates the initial rendering and the entry actions:
    // renderArray(), highlightWindow(currentIndex), updateMessage(currentIndex), updateControls()
    const vue = new SlidingWindowPage(page);
    await vue.goto();

    // Initial script on the page calls startVisualization(), so visualization should already be active.
    // Validate array elements rendered (should be 6 according to default input)
    await expect(vue.arrayContainer).toBeVisible();
    const count = await vue.getElementsCount();
    expect(count).toBe(6);

    // Validate initial message (sums for array [2,1,5,1,3,2] with k=3 -> first sum is 8)
    const msg = await vue.getMessageText();
    expect(msg).toBe('Window [0..2] sum = 8');

    // Validate highlight classes for window [0..2] and current element at index 2
    for (let i = 0; i < 6; i++) {
      const classes = await vue.getElementClasses(i);
      if (i >= 0 && i <= 2) {
        expect(classes).toContain('window');
      } else {
        expect(classes).not.toContain('window');
      }
    }
    // index 2 should also have 'current'
    const classes2 = await vue.getElementClasses(2);
    expect(classes2).toContain('current');

    // Controls: prev disabled, next enabled
    expect(await vue.prevDisabled()).toBe(true);
    expect(await vue.nextDisabled()).toBe(false);
  });

  test('NextClick and PrevClick transitions within S1_Visualizing: navigate windows and update UI & controls', async ({ page }) => {
    // This test verifies clicking Next and Prev updates the window highlight, message and controls, and calls stopAutoPlay() when applicable.
    const vue = new SlidingWindowPage(page);
    await vue.goto();

    // Ensure starting at index 0
    expect(await vue.getMessageText()).toMatch(/^Window \[0\.\./);

    // Click Next -> should move to index 1
    await vue.clickNext();
    await page.waitForTimeout(100); // small wait to let DOM update
    let msg = await vue.getMessageText();
    expect(msg).toBe('Window [1..3] sum = 7');

    // Elements 1..3 should be window, and current at 3
    for (let i = 0; i < 6; i++) {
      const classes = await vue.getElementClasses(i);
      if (i >= 1 && i <= 3) {
        expect(classes).toContain('window');
      } else {
        expect(classes).not.toContain('window');
      }
    }
    expect((await vue.getElementClasses(3))).toContain('current');
    expect(await vue.prevDisabled()).toBe(false);
    expect(await vue.nextDisabled()).toBe(false);

    // Click Next twice to reach last index (3)
    await vue.clickNext();
    await page.waitForTimeout(50);
    await vue.clickNext();
    await page.waitForTimeout(100);
    msg = await vue.getMessageText();
    expect(msg).toBe('Window [3..5] sum = 6');

    // Next should now be disabled (we are at the last window)
    expect(await vue.nextDisabled()).toBe(true);
    expect(await vue.prevDisabled()).toBe(false);

    // Click Prev to go back to index 2
    await vue.clickPrev();
    await page.waitForTimeout(100);
    msg = await vue.getMessageText();
    expect(msg).toBe('Window [2..4] sum = 9');
  });

  test('AutoPlayClick transition toggles autoplay and advances windows over time', async ({ page }) => {
    // This test ensures toggleAutoPlay() starts/stops autoplay and that auto play advances the current window.
    const vue = new SlidingWindowPage(page);
    await vue.goto();

    // Ensure at initial index 0
    expect(await vue.getMessageText()).toMatch(/^Window \[0\.\./);

    // Start autoplay
    await vue.clickAuto();
    // Button text should change to "Pause"
    await expect(vue.autoBtn).toHaveText('Pause');

    // Wait a bit longer than the autoplay interval (1500ms) to ensure a step occurred
    await page.waitForTimeout(1600);

    // After one autoplay step, message should show index 1
    let msg = await vue.getMessageText();
    expect(msg).toBe('Window [1..3] sum = 7');

    // Pause autoplay by clicking Auto again
    await vue.clickAuto();
    await page.waitForTimeout(100); // allow state to update
    expect(await vue.autoButtonText()).toBe('Auto Play');

    // Ensure that no further automatic progression happens after pause (wait > interval)
    await page.waitForTimeout(1600);
    msg = await vue.getMessageText();
    // Should remain at the same index (1)
    expect(msg).toBe('Window [1..3] sum = 7');
  });

  test('Edge cases and error scenarios: invalid array and k too large trigger alerts', async ({ page }) => {
    // This test verifies validation and error handling via alert dialogs:
    // - empty/invalid array -> alert
    // - k > array.length -> alert

    const vue = new SlidingWindowPage(page);
    await vue.goto();

    // 1) Empty array input should trigger an alert on Start
    await vue.fillArray('');
    const dialogPromise1 = page.waitForEvent('dialog');
    await vue.clickStart();
    const dialog1 = await dialogPromise1;
    expect(dialog1.message()).toContain('Please enter a valid array');
    await dialog1.dismiss();

    // Restore a valid array
    await vue.fillArray('2,1,5,1,3,2');

    // 2) k too large should trigger an alert
    await vue.fillK('10'); // larger than array length (6)
    const dialogPromise2 = page.waitForEvent('dialog');
    await vue.clickStart();
    const dialog2 = await dialogPromise2;
    expect(dialog2.message()).toContain('Window size k cannot be larger than the array length');
    await dialog2.dismiss();

    // Reset k to valid value
    await vue.fillK('3');
    // Finally, clicking Start with valid inputs should not trigger an alert and should render visualization again
    let dialogRaised = false;
    page.once('dialog', () => { dialogRaised = true; }); // if any dialog appears mark it
    await vue.clickStart();
    await page.waitForTimeout(100);
    expect(dialogRaised).toBe(false);
    expect(await vue.getMessageText()).toBe('Window [0..2] sum = 8');
  });

  test('Verify onEnter/onExit-like behaviors: startVisualization called on initial load and stopAutoPlay invoked when navigating', async ({ page }) => {
    // This test checks the observable effects of entry/exit actions:
    // - startVisualization() is invoked on load (initial visualization exists)
    // - stopAutoPlay() is invoked when moving via Prev/Next (we test by starting autoplay then clicking Next and observing the auto button text resets)
    const vue = new SlidingWindowPage(page);
    await vue.goto();

    // startVisualization was executed on initial load; message should be set
    expect(await vue.getMessageText()).toBe('Window [0..2] sum = 8');

    // Start autoplay
    await vue.clickAuto();
    await expect(vue.autoBtn).toHaveText('Pause');

    // Click Next (should call stopAutoPlay inside the click handler)
    await vue.clickNext();
    await page.waitForTimeout(100);

    // After clicking Next while autoplay was active, autoplay should be stopped and the auto button text should be "Auto Play"
    expect(await vue.autoButtonText()).toBe('Auto Play');

    // Also confirm the message corresponds to the Next click (index 1)
    expect(await vue.getMessageText()).toBe('Window [1..3] sum = 7');
  });
});