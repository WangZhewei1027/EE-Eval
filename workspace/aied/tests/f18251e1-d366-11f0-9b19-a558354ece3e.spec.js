import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f18251e1-d366-11f0-9b19-a558354ece3e.html';

/**
 * Page Object for the Sliding Window Visualization app
 * Encapsulates interactions and queries used across tests
 */
class SlidingWindowPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.windowSize = page.locator('#windowSize');
    this.algorithm = page.locator('#algorithm');
    this.resetBtn = page.locator('button[onclick="resetArray()"]');
    this.slideBtn = page.locator('button[onclick="slideWindow()"]');
    this.autoBtn = page.locator('button[onclick="autoSlide()"]');
    this.stopBtn = page.locator('button[onclick="stopAutoSlide()"]');
    this.arrayContainer = page.locator('#arrayContainer');
    this.currentWindowText = page.locator('#currentWindow');
    this.currentResultText = page.locator('#currentResult');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for initializeArray to populate elements (array elements should be present)
    await this.page.waitForTimeout(50); // small wait to let onload handlers run
  }

  async getArrayElements() {
    return this.page.locator('.array-element');
  }

  async countArrayElements() {
    return await this.getArrayElements().count();
  }

  async getArrayValues() {
    const count = await this.countArrayElements();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(await this.getArrayElements().nth(i).textContent());
    }
    return values.map(v => v && v.trim());
  }

  async getHighlightedIndices() {
    const count = await this.countArrayElements();
    const indices = [];
    for (let i = 0; i < count; i++) {
      const bg = await this.getArrayElements().nth(i).evaluate(el => getComputedStyle(el).backgroundColor);
      // highlighted window uses color '#ff6b6b' (rgb(255,107,107))
      if (bg === 'rgb(255, 107, 107)' || bg.includes('255, 107, 107')) {
        indices.push(i);
      }
    }
    return indices;
  }

  async getSlidingWindowRect() {
    const el = this.page.locator('.sliding-window');
    const count = await el.count();
    if (count === 0) return null;
    return await el.boundingBox();
  }

  async getCurrentWindowText() {
    return (await this.currentWindowText.textContent())?.trim();
  }

  async getCurrentResultText() {
    return (await this.currentResultText.textContent())?.trim();
  }

  async setWindowSize(value) {
    // Use evaluate to ensure change event is dispatched as app expects
    await this.page.evaluate((val) => {
      const el = document.getElementById('windowSize');
      el.value = val;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, String(value));
    // small delay to allow handlers to run
    await this.page.waitForTimeout(50);
  }

  async selectAlgorithm(value) {
    await this.algorithm.selectOption(value);
    // selecting option fires 'change' (Playwright triggers change)
    await this.page.waitForTimeout(30);
  }

  async clickReset() {
    await this.resetBtn.click();
    await this.page.waitForTimeout(50);
  }

  async clickSlide() {
    await this.slideBtn.click();
    await this.page.waitForTimeout(50);
  }

  async clickAuto() {
    await this.autoBtn.click();
    // autoSlide uses interval, don't wait here
  }

  async clickStop() {
    await this.stopBtn.click();
    await this.page.waitForTimeout(50);
  }
}

test.describe('Sliding Window Visualization - FSM and UI integration tests', () => {
  // capture console and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.describe('State S0_Idle -> S1_ArrayInitialized (initialization)', () => {
    test('initial load initializes array and displays current window and result', async ({ page }) => {
      // This test validates the onload initializeArray() entry action
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Assertions: array elements are rendered, currentWindow and currentResult show expected format
      const count = await app.countArrayElements();
      expect(count).toBeGreaterThan(0);

      const currentWindow = await app.getCurrentWindowText();
      // should be in format: [a, b, c] or [ ] (non-empty initial array so not empty)
      expect(currentWindow).toMatch(/^\[.*\]$/);

      const currentResult = await app.getCurrentResultText();
      expect(currentResult.length).toBeGreaterThan(0);

      // Ensure sliding-window element exists for default window size 3 (unless array shorter)
      const rect = await app.getSlidingWindowRect();
      if (count >= 3) {
        expect(rect).not.toBeNull();
        expect(rect.width).toBeGreaterThan(0);
      } else {
        // If array shorter, sliding-window may not appear
        expect(rect === null || rect.width === 0).toBeTruthy();
      }

      // Ensure no uncaught page errors were thrown during initialization
      expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toHaveLength(0);

      // Ensure no console messages with level 'error' were emitted
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors, `Console error messages: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    });
  });

  test.describe('Event: WindowSizeChange', () => {
    test('changing window size resets window start and updates UI (S0/S2 transitions)', async ({ page }) => {
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Record initial currentWindow and highlighted indices
      const initialWindow = await app.getCurrentWindowText();
      const initialHighlighted = await app.getHighlightedIndices();

      // Change window size to 2
      await app.setWindowSize(2);
      const afterChangeWindow = await app.getCurrentWindowText();
      const highlighted2 = await app.getHighlightedIndices();

      // The currentWindow should have been recalculated (start reset to 0), so text should differ or match but indices should begin at 0
      expect(afterChangeWindow.startsWith('[')).toBeTruthy();
      expect(highlighted2.length).toBeLessThanOrEqual(2);
      // The highlighted indices should start from 0 due to reset on change
      if (highlighted2.length > 0) {
        expect(highlighted2[0]).toBe(0);
      }

      // Change window size to a large value (> array length) to exercise edge case
      const arrCount = await app.countArrayElements();
      await app.setWindowSize(Math.max(arrCount + 5, 20));
      // When windowSize > array.length updateSlidingWindow returns early -> no sliding-window element
      const rect = await app.getSlidingWindowRect();
      expect(rect).toBeNull();
    });
  });

  test.describe('Event: SlideWindow and state S2_WindowSlid', () => {
    test('clicking Slide Window moves the sliding window one position to the right while within bounds', async ({ page }) => {
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Ensure windowSize is small (3) for predictable behavior
      await app.setWindowSize(3);

      // Capture initial highlighted indices and sliding window left position
      const initialHighlighted = await app.getHighlightedIndices();
      const initialRect = await app.getSlidingWindowRect();

      // Click Slide Window once (S1 -> S2)
      await app.clickSlide();

      const afterHighlighted = await app.getHighlightedIndices();
      const afterRect = await app.getSlidingWindowRect();

      // If there was room to slide, sliding window left should increase (rect.left increases)
      if (initialRect && afterRect) {
        expect(afterRect.x).toBeGreaterThanOrEqual(initialRect.x);
      }

      // highlighted indices should shift right by 1 if sliding occurred
      if (initialHighlighted.length > 0 && afterHighlighted.length > 0) {
        expect(afterHighlighted[0]).toBe(initialHighlighted[0] + 1);
      }

      // Slide repeatedly to the end and ensure no out-of-bounds sliding occurs
      const count = await app.countArrayElements();
      // perform slides enough times
      for (let i = 0; i < count + 5; i++) {
        await app.clickSlide();
      }
      // After excessive slides, highlighted indices should still be within bounds
      const finalHighlighted = await app.getHighlightedIndices();
      finalHighlighted.forEach(idx => {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(count);
      });
    });
  });

  test.describe('Event: AutoSlide and state S3_AutoSliding', () => {
    test('Auto Slide starts automatic sliding, Stop stops it, and transitions behave correctly', async ({ page }) => {
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Ensure deterministic small window for quicker sliding
      await app.setWindowSize(2);

      const initialWindowText = await app.getCurrentWindowText();

      // Start auto sliding (S1 -> S3)
      await app.clickAuto();

      // Wait for a bit over one interval (interval = 1000ms in app)
      await page.waitForTimeout(1150);

      const midWindowText = await app.getCurrentWindowText();
      // It should have changed due to auto slide (unless array small and wrapped to 0)
      expect(midWindowText).not.toBeNull();

      // Wait another tick to ensure sliding continues
      await page.waitForTimeout(1100);
      const laterWindowText = await app.getCurrentWindowText();
      expect(laterWindowText).not.toBeNull();

      // Now click Stop to go to S0_Idle
      await app.clickStop();

      // Record the window state after stopping
      const stoppedWindow = await app.getCurrentWindowText();

      // Wait additional time to ensure no more auto increments happen
      await page.waitForTimeout(1200);
      const afterWaitWindow = await app.getCurrentWindowText();

      // After stopping, the window text should remain the same
      expect(afterWaitWindow).toBe(stoppedWindow);
    });
  });

  test.describe('Event: ResetArray and transitions to S1_ArrayInitialized', () => {
    test('Reset Array generates a new array of length 8 and re-initializes state', async ({ page }) => {
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Ensure some initial state
      const beforeCount = await app.countArrayElements();

      // Click Reset Array (S2 -> S1 transition in FSM when in S2)
      await app.clickReset();

      // After reset, array should be length 8 per implementation
      const afterCount = await app.countArrayElements();
      expect(afterCount).toBe(8);

      // currentWindow should be reset to start at index 0
      const highlighted = await app.getHighlightedIndices();
      if (highlighted.length > 0) {
        expect(highlighted[0]).toBe(0);
      }

      // currentResult should be present and reflect algorithm (default maxSum)
      const result = await app.getCurrentResultText();
      expect(result).toMatch(/(Sum:|Average:|Unique characters:)/);
    });
  });

  test.describe('Algorithm selection and result updates', () => {
    test('Selecting different algorithms updates the displayed result correctly', async ({ page }) => {
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Ensure windowSize is 3 for predictable slices
      await app.setWindowSize(3);

      // read current window array values to compute expected results
      const windowText = await app.getCurrentWindowText(); // e.g. "[2, 1, 5]"
      const nums = (windowText.replace(/[\[\]\s]/g, '') === '') ? [] : windowText.replace(/[\[\]\s]/g, '').split(',').map(Number);

      // Select maxSum
      await app.selectAlgorithm('maxSum');
      const maxSumText = await app.getCurrentResultText();
      const expectedSum = nums.reduce((s, n) => s + n, 0);
      expect(maxSumText).toContain(String(expectedSum));

      // Select average
      await app.selectAlgorithm('average');
      const avgText = await app.getCurrentResultText();
      if (nums.length > 0) {
        const avg = (nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(2);
        expect(avgText).toContain(avg);
      } else {
        // If empty window, ensure no crash and some text exists
        expect(avgText.length).toBeGreaterThan(0);
      }

      // Select longestSubstring (unique elements)
      await app.selectAlgorithm('longestSubstring');
      const uniqText = await app.getCurrentResultText();
      const uniqCount = new Set(nums.map(String)).size;
      expect(uniqText).toContain(String(uniqCount));
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Setting window size to 1 works and slide behavior remains correct', async ({ page }) => {
      const app = new SlidingWindowPage(page);
      await app.goto();

      await app.setWindowSize(1);
      const highlighted = await app.getHighlightedIndices();
      // Only one element should be highlighted
      expect(highlighted.length).toBeLessThanOrEqual(1);

      // Slide across all elements
      const count = await app.countArrayElements();
      for (let i = 0; i < count - 1; i++) {
        await app.clickSlide();
      }
      const finalHighlighted = await app.getHighlightedIndices();
      expect(finalHighlighted[0]).toBe(count - 1);

      // Try sliding beyond last element - should not change index
      await app.clickSlide();
      const stillFinal = await app.getHighlightedIndices();
      expect(stillFinal[0]).toBe(count - 1);
    });

    test('No unexpected console errors or uncaught page errors during interactions', async ({ page }) => {
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Perform a sequence of interactions
      await app.setWindowSize(2);
      await app.clickAuto();
      await page.waitForTimeout(1200);
      await app.clickStop();
      await app.selectAlgorithm('average');
      await app.clickReset();
      await app.clickSlide();

      // Allow any final async logs to surface
      await page.waitForTimeout(100);

      // Assert no uncaught page errors were recorded during the interactions
      expect(pageErrors, `Page errors encountered: ${pageErrors.map(e => e.message).join(' | ')}`).toHaveLength(0);

      // Assert no console messages of type 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors, `Console error messages encountered: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    });
  });
});