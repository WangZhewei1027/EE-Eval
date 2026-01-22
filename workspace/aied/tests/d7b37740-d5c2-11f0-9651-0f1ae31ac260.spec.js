import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b37740-d5c2-11f0-9651-0f1ae31ac260.html';

/**
 * Page Object for the Selection Sort Visualization app.
 */
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generateBtn = page.locator('#generate');
    this.sortBtn = page.locator('#sort');
    this.arraySizeInput = page.locator('#arraySize');
    this.arrayBars = page.locator('#array .bar');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getArraySizeValue() {
    return parseInt(await this.arraySizeInput.inputValue(), 10);
  }

  async setArraySize(value) {
    // Use fill to replace current value
    await this.arraySizeInput.fill(String(value));
    // blur to ensure any input listeners pick up the value
    await this.arraySizeInput.evaluate((el) => el.blur());
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickSort() {
    await this.sortBtn.click();
  }

  async getBarsCount() {
    return await this.arrayBars.count();
  }

  async getBarText(index) {
    return (await this.arrayBars.nth(index).textContent())?.trim();
  }

  async getAllBarTexts() {
    const count = await this.getBarsCount();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.getBarText(i));
    }
    return texts;
  }

  async isGenerateDisabled() {
    return await this.generateBtn.isDisabled();
  }

  async isSortDisabled() {
    return await this.sortBtn.isDisabled();
  }

  async isArraySizeDisabled() {
    return await this.arraySizeInput.isDisabled();
  }

  // Wait for any visual indicator of progress (current/min) to appear during sorting
  async waitForProgressIndicator(timeout = 5000) {
    await this.page.waitForSelector('#array .bar.current, #array .bar.min', { timeout });
  }

  // Wait until all bars have the 'sorted' class (sorting complete)
  async waitForAllSorted(timeout = 15000) {
    await this.page.waitForFunction(() => {
      const bars = Array.from(document.querySelectorAll('#array .bar'));
      if (bars.length === 0) return false;
      return bars.every(b => b.classList.contains('sorted'));
    }, null, { timeout });
  }
}

test.describe('Selection Sort Visualization - FSM tests', () => {
  // Collect console messages and page errors for each test and assert none are error-level
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Store Error instances for assertions
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Assert no uncaught page errors occurred during the test
    expect(pageErrors.length, `Expected no uncaught page errors, but found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

    // Assert no console messages of type 'error' were emitted
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length, `Expected no console.error messages, but found: ${errorConsole.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test('Initial Idle state renders array on load (S0_Idle)', async ({ page }) => {
    // This test validates the initial state S0_Idle: on load init() should render the array
    const app = new AppPage(page);
    await app.goto();

    // The app calls init() on load. The initial array size input value is 10 per HTML.
    const sizeValue = await app.getArraySizeValue();
    expect(sizeValue).toBe(10);

    const barsCount = await app.getBarsCount();
    // There should be bars equal to the initial input value (10)
    expect(barsCount).toBe(sizeValue);

    // None of the bars should be marked 'sorted' immediately after initial render
    const sortedBars = await page.locator('#array .bar.sorted').count();
    expect(sortedBars).toBe(0);

    // Visual sanity: ensure each bar has numeric text between 10 and 99
    const texts = await app.getAllBarTexts();
    for (const t of texts) {
      const num = Number(t);
      expect(Number.isInteger(num)).toBe(true);
      expect(num).toBeGreaterThanOrEqual(10);
      expect(num).toBeLessThanOrEqual(99);
    }
  });

  test('Generate Array transition: S0_Idle -> S1_ArrayGenerated (Generate button)', async ({ page }) => {
    // This test exercises the GenerateArray event and transition to S1_ArrayGenerated
    const app = new AppPage(page);
    await app.goto();

    // Set a smaller array size to make assertions simpler
    await app.setArraySize(5);
    await app.clickGenerate();

    // After clicking Generate, bars should reflect the requested size (clamped within min/max)
    const barsCount = await app.getBarsCount();
    expect(barsCount).toBe(5);

    // Ensure rendered values are within expected bounds
    const texts = await app.getAllBarTexts();
    for (const t of texts) {
      const num = Number(t);
      expect(Number.isInteger(num)).toBe(true);
      expect(num).toBeGreaterThanOrEqual(10);
      expect(num).toBeLessThanOrEqual(99);
    }

    // The Generate action corresponds to init() and renderArray()
    // No bars should be marked 'sorted' immediately after generation
    expect(await page.locator('#array .bar.sorted').count()).toBe(0);
  });

  test('Sorting transition: S1_ArrayGenerated -> S2_Sorting (Start Sorting) and visual progression', async ({ page }) => {
    // This test validates starting the sorting visualization, intermediate visual cues, and completion.
    const app = new AppPage(page);
    await app.goto();

    // Use minimal size to keep sorting duration short
    await app.setArraySize(5);
    await app.clickGenerate();

    // Snapshot pre-sort first bar value to demonstrate generate is effective
    const beforeFirstBar = await app.getBarText(0);

    // Start sorting
    const sortClickPromise = app.clickSort();

    // Immediately after clicking sort, controls should be disabled
    await sortClickPromise;
    expect(await app.isGenerateDisabled()).toBe(true);
    expect(await app.isSortDisabled()).toBe(true);
    expect(await app.isArraySizeDisabled()).toBe(true);

    // While sorting, there should be visual indicators: 'current' or 'min'
    await app.waitForProgressIndicator(8000);

    // Attempt to click generate during sorting; generate button is disabled, so nothing should change.
    // Capture first bar text during sorting then attempt click; ensure it does not immediately change due to ignored click.
    const midFirstBar = await app.getBarText(0);
    await page.click('#generate').catch(() => {
      // If the button is disabled the click may be ignored; Playwright may still dispatch, so guard
    });
    // Short wait to give any (unexpected) generate handler time to run (shouldn't)
    await page.waitForTimeout(200);
    const midFirstBarAfterClick = await app.getBarText(0);
    expect(midFirstBarAfterClick).toBe(midFirstBar);

    // Wait for full sort completion (all bars should end up with 'sorted' class)
    await app.waitForAllSorted(20000);

    // After sorting completes, all bars have 'sorted' class
    const sortedCount = await page.locator('#array .bar.sorted').count();
    const totalBars = await app.getBarsCount();
    expect(sortedCount).toBe(totalBars);

    // Buttons and input should be re-enabled after sort completes and sorting flag reset
    expect(await app.isGenerateDisabled()).toBe(false);
    expect(await app.isSortDisabled()).toBe(false);
    expect(await app.isArraySizeDisabled()).toBe(false);

    // Ensure the array has changed from the original generated array (most likely after swaps).
    const afterFirstBar = await app.getBarText(0);
    // It's possible the first element didn't swap in selection sort for some arrays; this assertion is soft:
    // We assert that either it changed or at least the array is now sorted ascending.
    if (afterFirstBar === beforeFirstBar) {
      // Verify ascending order as fallback assertion
      const finalTexts = (await app.getAllBarTexts()).map(Number);
      for (let i = 1; i < finalTexts.length; i++) {
        expect(finalTexts[i]).toBeGreaterThanOrEqual(finalTexts[i - 1]);
      }
    } else {
      // If changed, ensure final array is sorted ascending
      const finalTexts = (await app.getAllBarTexts()).map(Number);
      for (let i = 1; i < finalTexts.length; i++) {
        expect(finalTexts[i]).toBeGreaterThanOrEqual(finalTexts[i - 1]);
      }
    }
  }, 30000); // increased timeout for full sorting run

  test('Edge case: arraySize below min is clamped to 5', async ({ page }) => {
    // This test validates input clamping behavior used by init()
    const app = new AppPage(page);
    await app.goto();

    // Set below minimum and generate
    await app.setArraySize(2); // below min 5
    await app.clickGenerate();

    // Should be clamped to 5
    const barsCount = await app.getBarsCount();
    expect(barsCount).toBe(5);
  });

  test('Edge case: arraySize above max is clamped to 20', async ({ page }) => {
    // This test validates clamping above max
    const app = new AppPage(page);
    await app.goto();

    // Set above maximum and generate
    await app.setArraySize(25); // above max 20
    await app.clickGenerate();

    // Should be clamped to 20
    const barsCount = await app.getBarsCount();
    expect(barsCount).toBe(20);
  });

  test('Robustness: clicking sort multiple times should not throw and is ignored while sorting', async ({ page }) => {
    // This test attempts to click the sort button multiple times and ensures no uncaught exceptions occur
    const app = new AppPage(page);
    await app.goto();

    // Use small size and generate
    await app.setArraySize(5);
    await app.clickGenerate();

    // Start sorting
    await app.clickSort();

    // Immediately attempt to click sort again (should be disabled or ignored)
    await page.click('#sort').catch(() => {
      // click may throw if disabled, ignore that
    });

    // Wait for completion
    await app.waitForAllSorted(20000);

    // After completion, verify no page errors were captured (see afterEach assertion)
    // Also verify buttons re-enabled
    expect(await app.isSortDisabled()).toBe(false);
    expect(await app.isGenerateDisabled()).toBe(false);
  }, 30000);
});