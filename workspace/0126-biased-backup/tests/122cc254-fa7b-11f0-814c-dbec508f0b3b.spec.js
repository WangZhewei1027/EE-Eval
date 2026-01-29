import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122cc254-fa7b-11f0-814c-dbec508f0b3b.html';

// Page object encapsulating interactions and common assertions for the Deadlock Simulator
class DeadlockPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Buttons
    this.resetBtn = page.locator('#reset-button');
    this.increaseBtn = page.locator('#increase-value-button');
    this.decreaseBtn = page.locator('#decrease-value-button');
    this.addBtn = page.locator('#add-value-button');
    this.subtractBtn = page.locator('#subtract-value-button');
    this.saveBtn = page.locator('#save-button');
    this.loadBtn = page.locator('#load-button');
    this.maxBtn = page.locator('#max-value-button');
    this.minBtn = page.locator('#min-value-button');
    this.randomBtn = page.locator('#random-value-button');

    // Inputs
    this.valueInput = page.locator('#value-input');
    this.maxInput = page.locator('#max-value-input');
    this.minInput = page.locator('#min-value-input');
    this.randomInput = page.locator('#random-value-input');
  }

  // helper methods for actions
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  async clickReset() { await this.resetBtn.click(); }
  async clickIncrease() { await this.increaseBtn.click(); }
  async clickDecrease() { await this.decreaseBtn.click(); }
  async clickAdd() { await this.addBtn.click(); }
  async clickSubtract() { await this.subtractBtn.click(); }
  async clickSave() { await this.saveBtn.click(); }
  async clickLoad() { await this.loadBtn.click(); }
  async clickMax() { await this.maxBtn.click(); }
  async clickMin() { await this.minBtn.click(); }
  async clickRandom() { await this.randomBtn.click(); }

  async fillValue(v) { await this.valueInput.fill(String(v)); }
  async fillMax(v) { await this.maxInput.fill(String(v)); }
  async fillMin(v) { await this.minInput.fill(String(v)); }
  async fillRandom(v) { await this.randomInput.fill(String(v)); }

  async getValue() { return (await this.valueInput.inputValue()).toString(); }
  async getMax() { return (await this.maxInput.inputValue()).toString(); }
  async getMin() { return (await this.minInput.inputValue()).toString(); }
  async getRandom() { return (await this.randomInput.inputValue()).toString(); }
}

test.describe('Deadlock Simulator - 122cc254-fa7b-11f0-814c-dbec508f0b3b', () => {
  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {DeadlockPage} */
  let dp;
  let consoleErrors;
  let pageErrors;
  let consoleWarnings;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    dp = new DeadlockPage(page);

    // Capture console errors and page errors
    consoleErrors = [];
    consoleWarnings = [];
    pageErrors = [];

    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      } else if (type === 'warning') {
        consoleWarnings.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      // Unhandled runtime exceptions
      pageErrors.push(err);
    });

    // Navigate to the application page
    await dp.goto();
  });

  test.afterEach(async () => {
    // Cleanup: clear localStorage to avoid test cross-talk and close page
    try {
      await page.evaluate(() => localStorage.clear());
    } catch (e) {
      // swallow if page closed
    }
    await page.close();
  });

  test('Initial UI elements are present and have expected default values', async () => {
    // Verify all primary controls exist
    await expect(dp.resetBtn).toBeVisible();
    await expect(dp.increaseBtn).toBeVisible();
    await expect(dp.decreaseBtn).toBeVisible();
    await expect(dp.addBtn).toBeVisible();
    await expect(dp.subtractBtn).toBeVisible();
    await expect(dp.saveBtn).toBeVisible();
    await expect(dp.loadBtn).toBeVisible();
    await expect(dp.maxBtn).toBeVisible();
    await expect(dp.minBtn).toBeVisible();
    await expect(dp.randomBtn).toBeVisible();

    // Verify inputs initial values match implementation defaults
    expect(await dp.getValue()).toBe('0');
    expect(await dp.getMax()).toBe('100');
    expect(await dp.getMin()).toBe('0');
    expect(await dp.getRandom()).toBe('0');

    // There should be no JS runtime errors or console errors emitted during initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Increase, Decrease, Add and Subtract modify the current value as expected', async () => {
    // Start from default 0
    await dp.clickIncrease(); // 1
    await dp.clickIncrease(); // 2
    expect(await dp.getValue()).toBe('2');

    await dp.clickDecrease(); // 1
    expect(await dp.getValue()).toBe('1');

    await dp.clickAdd(); // +10 => 11
    expect(await dp.getValue()).toBe('11');

    await dp.clickSubtract(); // -10 => 1
    expect(await dp.getValue()).toBe('1');

    // Additional edge-case: subtract repeatedly to go negative
    await dp.clickSubtract(); // 1 - 10 = -9
    expect(await dp.getValue()).toBe('-9');

    // No unexpected console/page errors produced by these interactions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Reset sets all variables and inputs back to expected defaults', async () => {
    // Mutate values
    await dp.clickAdd(); // currentValue = 10
    await dp.clickAdd(); // 20
    await dp.fillMax('42'); // change input, does not update internal maxValue until button clicked
    await dp.fillMin('7');
    await dp.fillRandom('55');

    // Click reset should return everything to default as per implementation
    await dp.clickReset();
    expect(await dp.getValue()).toBe('0');
    expect(await dp.getMax()).toBe('100');
    expect(await dp.getMin()).toBe('0');
    expect(await dp.getRandom()).toBe('0');

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Save persists the in-memory values to localStorage and Load restores them', async () => {
    // Mutate in-memory variables by using the buttons
    // Increase to 3
    await dp.clickIncrease();
    await dp.clickIncrease();
    await dp.clickIncrease();
    expect(await dp.getValue()).toBe('3');

    // The only reliable way to set maxValue/minValue/randomValue in the current implementation is via buttons.
    // However, note the implementation binds multiple click handlers to some buttons which may override each other.
    // We proceed to save and verify observed behavior.
    await dp.clickSave();

    // Inspect localStorage entries set by Save
    const stored = await page.evaluate(() => {
      return {
        currentValue: localStorage.getItem('currentValue'),
        maxValue: localStorage.getItem('maxValue'),
        minValue: localStorage.getItem('minValue'),
        randomValue: localStorage.getItem('randomValue')
      };
    });

    // currentValue should be saved as '3'. Other saved values reflect implementation defaults unless changed before save.
    expect(stored.currentValue).toBe('3');
    // The implementation's initial in-memory values for max/min/random are 100/0/0 unless changed prior to saving.
    expect(stored.maxValue).toBe('100');
    expect(stored.minValue).toBe('0');
    expect(stored.randomValue).toBe('0');

    // Now mutate the visible UI to different values and then call Load to restore from localStorage
    await dp.clickSubtract(); // change current value from 3 to -7 (3 - 10)
    expect(await dp.getValue()).toBe('-7');

    // Call load - according to implementation it will parse localStorage and set inputs accordingly
    await dp.clickLoad();
    expect(await dp.getValue()).toBe('3'); // restored
    expect(await dp.getMax()).toBe('100');
    expect(await dp.getMin()).toBe('0');
    expect(await dp.getRandom()).toBe('0');

    // No runtime errors expected here
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Loading without a prior Save produces NaN for numeric fields (edge case)', async () => {
    // Ensure localStorage is cleared first to simulate "no saved state"
    await page.evaluate(() => localStorage.clear());

    // Click Load when nothing is saved
    await dp.clickLoad();

    // The implementation does parseInt(localStorage.getItem(...)) and then .toString(), so parsing null -> NaN -> "NaN"
    expect(await dp.getValue()).toBe('NaN');
    expect(await dp.getMax()).toBe('NaN');
    expect(await dp.getMin()).toBe('NaN');
    expect(await dp.getRandom()).toBe('NaN');

    // This is an error scenario for the app (no crash happens) - ensure no unhandled page errors were thrown
    expect(pageErrors.length).toBe(0);

    // But check that the UI now contains 'NaN' strings which the FSM expects to handle gracefully in a robust app
    // (This assertion documents the observed behavior)
    expect((await dp.getValue())).toBe('NaN');
  });

  test('Set Max/Min button handlers: duplicated listeners cause the final value to be overridden (observed implementation bug)', async () => {
    // The HTML implementation actually binds two click listeners to max/min buttons.
    // First listener reads the input value; the second one resets it to 100 (for max) or 0 (for min).
    // This test documents that observed behavior.

    // Set max input to a non-default value and click the Max button
    await dp.fillMax('42');
    // Sanity check that the field was filled as '42'
    expect(await dp.getMax()).toBe('42');

    // Click the button - because of duplicated listeners the final value is expected to be '100'
    await dp.clickMax();
    expect(await dp.getMax()).toBe('100');

    // Similarly for min: set to 7 and click min, final expected is '0' due to second listener
    await dp.fillMin('7');
    expect(await dp.getMin()).toBe('7');
    await dp.clickMin();
    expect(await dp.getMin()).toBe('0');

    // Confirm no runtime exceptions were thrown during interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Random Value button: duplicated listeners result in deterministic final value (observed behavior)', async () => {
    // The implementation also attaches two listeners to the random button:
    // - one sets a random integer between 0 and 100
    // - the other sets randomValue = 0
    // Therefore the final observed value should be '0'. This documents the implementation detail.

    // Click random button multiple times to ensure behavior is consistent
    await dp.clickRandom();
    expect(await dp.getRandom()).toBe('0');

    await dp.clickRandom();
    expect(await dp.getRandom()).toBe('0');

    // Confirm no runtime exceptions occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Comprehensive sequence: modify state, save, change, load, reset and validate transitions', async () => {
    // Increase to 2
    await dp.clickIncrease();
    await dp.clickIncrease();
    expect(await dp.getValue()).toBe('2');

    // Add 10 -> 12
    await dp.clickAdd();
    expect(await dp.getValue()).toBe('12');

    // Save this state
    await dp.clickSave();

    // Mutate to different values
    await dp.clickSubtract(); // 12 - 10 = 2
    await dp.clickSubtract(); // 2 - 10 = -8
    expect(await dp.getValue()).toBe('-8');

    // Load should bring back 12
    await dp.clickLoad();
    expect(await dp.getValue()).toBe('12');

    // Now Reset should clear to defaults
    await dp.clickReset();
    expect(await dp.getValue()).toBe('0');
    expect(await dp.getMax()).toBe('100');
    expect(await dp.getMin()).toBe('0');
    expect(await dp.getRandom()).toBe('0');

    // No page errors during this end-to-end scenario
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observe console and page errors across interactions - assert that none occurred', async () => {
    // Run a handful of interactions to ensure no unhandled exceptions or console.error logs appear
    await dp.clickIncrease();
    await dp.clickDecrease();
    await dp.clickAdd();
    await dp.clickSubtract();
    await dp.clickMax();
    await dp.clickMin();
    await dp.clickRandom();
    await dp.clickSave();
    await dp.clickLoad();
    await dp.clickReset();

    // We intentionally assert that no console errors or page errors were produced
    // The developer instructions asked us to observe console logs and page errors and to assert on them.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);

    // If any warnings occurred, we surface them in the test output (but do not fail on warnings).
    if (consoleWarnings.length > 0) {
      // attach a note for debugging - not failing the test
      console.warn('Console warnings observed during interactions:', consoleWarnings);
    }
  });

});