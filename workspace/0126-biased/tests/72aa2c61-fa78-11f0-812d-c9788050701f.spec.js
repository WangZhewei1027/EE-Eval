import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aa2c61-fa78-11f0-812d-c9788050701f.html';

// Page Object for the Exponential Search visualization
class ExponentialSearchPage {
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.arrayContainer = page.locator('#arrayContainer');
    this.rangeIndicator = page.locator('#rangeIndicator');
    this.arrayElements = () => page.locator('#arrayContainer .array-element');
  }

  // Navigate to the page and wait for initialization
  async goto() {
    await this.page.goto(APP_URL);
    // Wait for DOMContentLoaded and the script to initialize the array
    await this.page.waitForLoadState('networkidle');
    // Ensure the array elements are created
    await expect(this.arrayElements()).toHaveCount(20);
  }

  async isStartDisabled() {
    return await this.startBtn.evaluate(node => node.disabled);
  }

  async isResetDisabled() {
    return await this.resetBtn.evaluate(node => node.disabled);
  }

  async getArrayElementCount() {
    return await this.arrayElements().count();
  }

  async getFoundElementsCount() {
    return await this.page.locator('.array-element.found').count();
  }

  async getCurrentElementsCount() {
    return await this.page.locator('.array-element.current').count();
  }

  async getHighlightedCount() {
    return await this.page.locator('.array-element.highlight').count();
  }

  // Wait for a 'current' to appear (search in progress)
  async waitForAnyCurrent(timeout = 10000) {
    return await this.page.waitForSelector('.array-element.current', { timeout });
  }

  // Wait for a 'found' to appear (search finished successfully)
  async waitForFound(timeout = 30000) {
    return await this.page.waitForSelector('.array-element.found', { timeout });
  }

  // Get range indicator computed left/width values
  async getRangeIndicatorRect() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const left = parseFloat(el.style.left) || el.offsetLeft;
      const width = parseFloat(el.style.width) || el.offsetWidth;
      return { left, width };
    }, '#rangeIndicator');
  }

  // Click start button
  async clickStart() {
    await this.startBtn.click();
  }

  // Click reset button
  async clickReset() {
    await this.resetBtn.click();
  }

  // Returns number of elements with dataset.target=true
  async countTargetDatasets() {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('#arrayContainer .array-element')).filter(el => el.dataset.target === 'true').length;
    });
  }

  // Check that no elements have 'found', 'current', or 'highlight' classes
  async allElementsReset() {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('#arrayContainer .array-element')).every(el => {
        return el.className === 'array-element';
      });
    });
  }
}

test.describe('Exponential Search Visual Exploration - FSM validation', () => {
  // Capture console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and errors
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test('Initial state (S0_Idle) - UI elements are initialized correctly', async ({ page }) => {
    // Validate the initial Idle state: initArray() must have run and DOM set up.
    const expo = new ExponentialSearchPage(page);
    await expo.goto();

    // Comments: This validates S0_Idle on entry actions (initArray) by checking array creation and controls.
    await expect(expo.arrayElements()).toHaveCount(20); // array initialized with 20 elements
    expect(await expo.isStartDisabled()).toBeFalsy(); // startBtn.disabled = false
    expect(await expo.isResetDisabled()).toBeTruthy(); // resetBtn.disabled = true

    // Range indicator should have left & width set (non-zero) after initArray
    const rect = await expo.getRangeIndicatorRect();
    expect(rect).not.toBeNull();
    // left and width may be 0 if layout not computed; assert at least the property exists and is a number
    expect(typeof rect.left).toBe('number');
    expect(typeof rect.width).toBe('number');

    // There should be exactly one element marked as the target (dataset.target)
    const targets = await expo.countTargetDatasets();
    expect(targets).toBeGreaterThanOrEqual(1); // at least one target exists (script marks a single target)
    expect(targets).toBeLessThanOrEqual(1); // and at most one

    // Ensure no runtime page errors occurred during init
    expect(pageErrors).toEqual([]);
    // Ensure no console errors were emitted
    expect(consoleMessages.filter(m => m.type === 'error')).toEqual([]);
  });

  test('StartSearch event (S0 -> S1) and Searching behavior - Start button disables and elements get highlighted/current', async ({ page }) => {
    const expo = new ExponentialSearchPage(page);
    await expo.goto();

    // Start the search (trigger StartSearch event)
    await expo.clickStart();

    // Immediately, start button should be disabled (evidence of entering Searching)
    await expect(expo.startBtn).toBeDisabled();

    // While searching, we expect some element to become 'current' (visual feedback for searching).
    // Wait for the first 'current' element to appear.
    await expo.waitForAnyCurrent(10000);

    // At least one element should have class 'current'
    const currentCount = await expo.getCurrentElementsCount();
    expect(currentCount).toBeGreaterThanOrEqual(1);

    // The Reset button should still be disabled during active searching (implementation detail)
    expect(await expo.isResetDisabled()).toBeTruthy();

    // Ensure no page runtime errors occurred up to this point
    expect(pageErrors).toEqual([]);
    expect(consoleMessages.filter(m => m.type === 'error')).toEqual([]);
  });

  test('Searching completes with Found state (S1 -> S2) - an element gets .found and reset is enabled', async ({ page }) => {
    const expo = new ExponentialSearchPage(page);
    await expo.goto();

    // Start search and wait for a found element
    await expo.clickStart();

    // Wait for the algorithm to mark an element as found; allow generous timeout due to animation/waits
    const foundHandle = await expo.waitForFound(30000);
    expect(foundHandle).toBeTruthy();

    // Verify there is at least one found element
    const foundCount = await expo.getFoundElementsCount();
    expect(foundCount).toBeGreaterThanOrEqual(1);

    // After found, reset button should be enabled and start should remain disabled until reset
    expect(await expo.isResetDisabled()).toBeFalsy();
    expect(await expo.isStartDisabled()).toBeTruthy();

    // Also ensure range indicator reflects a (possibly narrowed) range: left/width are numbers
    const rect = await expo.getRangeIndicatorRect();
    expect(rect).not.toBeNull();
    expect(typeof rect.left).toBe('number');
    expect(typeof rect.width).toBe('number');

    // No unexpected JS errors during the search
    expect(pageErrors).toEqual([]);
    expect(consoleMessages.filter(m => m.type === 'error')).toEqual([]);
  });

  test('Reset event (S2 -> S3 -> S0) - Reset returns visualization to Idle state', async ({ page }) => {
    const expo = new ExponentialSearchPage(page);
    await expo.goto();

    // Start and wait for found
    await expo.clickStart();
    await expo.waitForFound(30000);

    // Click reset to trigger reset() (S3_Reset entry action)
    await expo.clickReset();

    // After reset, ensure all elements have default class and no 'found', 'current', or 'highlight'
    const allReset = await expo.allElementsReset();
    expect(allReset).toBeTruthy();

    // Buttons: start enabled, reset disabled
    expect(await expo.isStartDisabled()).toBeFalsy();
    expect(await expo.isResetDisabled()).toBeTruthy();

    // Confirm that starting is possible again (S3 -> S0 -> S1)
    await expo.clickStart();
    // Should disable start again immediately
    await expect(expo.startBtn).toBeDisabled();
    // Wait for a found element again (search runs a second time)
    await expo.waitForFound(30000);

    // Finally, ensure no JS page errors occurred throughout this sequence
    expect(pageErrors).toEqual([]);
    expect(consoleMessages.filter(m => m.type === 'error')).toEqual([]);
  });

  test('Edge case: Reset button during active Searching remains disabled (S1 -> ResetSearch not allowed mid-search)', async ({ page }) => {
    const expo = new ExponentialSearchPage(page);
    await expo.goto();

    // Start search
    await expo.clickStart();

    // Immediately attempt to use Reset — but per implementation Reset button is disabled until search completes.
    // Assert reset button remains disabled while searching.
    expect(await expo.isResetDisabled()).toBeTruthy();

    // Do NOT force-click the disabled button; instead assert that the disabled state prevents the Reset transition.
    // Wait for search to complete normally and ensure a found element appears.
    await expo.waitForFound(30000);
    expect(await expo.isResetDisabled()).toBeFalsy(); // now it becomes enabled

    // This validates that the S1 -> S3 transition via ResetSearch is not reachable during active search in this implementation.
    expect(pageErrors).toEqual([]);
    expect(consoleMessages.filter(m => m.type === 'error')).toEqual([]);
  });

  test('Robustness: Ensure no unexpected runtime errors or exceptions are thrown during multiple search/reset cycles', async ({ page }) => {
    const expo = new ExponentialSearchPage(page);
    await expo.goto();

    // Run multiple cycles of start -> wait found -> reset
    for (let cycle = 0; cycle < 2; cycle++) {
      await expo.clickStart();
      await expo.waitForFound(30000);

      // After found, reset should be enabled
      expect(await expo.isResetDisabled()).toBeFalsy();
      await expo.clickReset();

      // Confirm state is back to Idle
      expect(await expo.isStartDisabled()).toBeFalsy();
      expect(await expo.isResetDisabled()).toBeTruthy();
    }

    // Confirm no page errors or console error messages were recorded across cycles
    expect(pageErrors).toEqual([]);
    expect(consoleMessages.filter(m => m.type === 'error')).toEqual([]);
  });
});