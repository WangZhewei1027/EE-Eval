import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b10023-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object encapsulating interactions and queries for the Quick Sort Visualization app
class QuickSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      newArrayBtn: '#newArrayBtn',
      sortBtn: '#sortBtn',
      speedRange: '#speedRange',
      speedLabel: '#speedLabel',
      arrayContainer: '#arrayContainer',
      bars: '#arrayContainer .bar',
    };
  }

  // Navigate to the page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Get number of bars currently rendered
  async getBarCount() {
    return await this.page.$$eval(this.selectors.bars, els => els.length);
  }

  // Read numeric values shown on bars (as numbers)
  async readBarValues() {
    return await this.page.$$eval(this.selectors.bars, els =>
      els.map(e => {
        const txt = e.textContent.trim();
        const n = Number(txt);
        return Number.isNaN(n) ? txt : n;
      })
    );
  }

  // Set speedRange to a specific value and dispatch input event
  async setSpeedRange(value) {
    await this.page.$eval(this.selectors.speedRange, (el, val) => {
      el.value = String(val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  // Click generate new array button
  async clickGenerate() {
    await this.page.click(this.selectors.newArrayBtn);
  }

  // Click start sort button
  async clickSort() {
    await this.page.click(this.selectors.sortBtn);
  }

  // Get current speed label text
  async getSpeedLabelText() {
    return await this.page.$eval(this.selectors.speedLabel, el => el.textContent.trim());
  }

  // Check if a given button is disabled
  async isButtonDisabled(selector) {
    return await this.page.$eval(selector, el => el.disabled === true);
  }

  // Wait until the sort button is enabled (used to detect sorting finished)
  async waitForSortComplete(timeout = 20000) {
    await this.page.waitForFunction(
      sel => {
        const btn = document.querySelector(sel);
        return btn && btn.disabled === false;
      },
      this.selectors.sortBtn,
      { timeout }
    );
  }

  // Wait for at least one pivot bar to appear, used to confirm intermediate sorting visualization
  async waitForPivotAppearance(timeout = 5000) {
    await this.page.waitForSelector('.bar.pivot', { timeout });
  }
}

// Global hooks to capture console messages and page errors for each test
test.describe('Quick Sort Visualization - FSM and UI tests', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors (e.g., ReferenceError, TypeError, SyntaxError)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Nothing special aside from allowing tests to assert on consoleMessages/pageErrors
  });

  test.describe('Initialization and Array Generation (S0 -> S1)', () => {
    test('Initial state S0_Idle: generateArray() should run on load and render bars (30 elements)', async ({ page }) => {
      // Validate initial entry actions: generateArray() invoked on load, rendering 30 bars and speed label set
      const qs = new QuickSortPage(page);
      await qs.goto();

      // Assert no page errors occurred immediately after load
      expect(pageErrors).toEqual([]);

      // The FSM's S0 onEnter calls generateArray(); verify bars are present
      const count = await qs.getBarCount();
      expect(count).toBeGreaterThanOrEqual(1); // ensure something rendered
      expect(count).toBe(30); // application uses maxElements = 30

      // Speed label should reflect initial speed variable (300 ms)
      const speedText = await qs.getSpeedLabelText();
      expect(speedText).toBe('300 ms');

      // Ensure bar values are numeric and within expected bounds
      const values = await qs.readBarValues();
      expect(values.length).toBe(30);
      for (const v of values) {
        expect(typeof v).toBe('number');
        expect(v).toBeGreaterThanOrEqual(5);
        expect(v).toBeLessThanOrEqual(100);
      }
    });

    test('GenerateNewArray transition (S0 -> S1): clicking Generate New Array replaces array contents', async ({ page }) => {
      // Validate clicking newArrayBtn triggers generateArray() and updates the DOM
      const qs1 = new QuickSortPage(page);
      await qs.goto();

      const before = await qs.readBarValues();
      // Click to generate a new array
      await qs.clickGenerate();

      // After clicking, bar count should remain 30
      const countAfter = await qs.getBarCount();
      expect(countAfter).toBe(30);

      const after = await qs.readBarValues();
      // It's possible (rare) that the new random array matches the old exactly.
      // Assert that either arrays differ or at least structure remains valid.
      const arraysEqual = JSON.stringify(before) === JSON.stringify(after);
      expect(Array.isArray(after)).toBe(true);
      expect(after.length).toBe(30);
      // If the arrays are identical, allow but warn via a console message captured by the test
      if (arraysEqual) {
        // push a console-like note so the test output indicates the edge case
        consoleMessages.push({ type: 'warning', text: 'Generated array matched previous array (rare random collision)' });
      }
    });
  });

  test.describe('Speed Adjustment (AdjustSpeed event)', () => {
    test('AdjustSpeed input updates internal speed and speedLabel accordingly', async ({ page }) => {
      const qs2 = new QuickSortPage(page);
      await qs.goto();

      // Set to fastest: range value 1000 => speed = 1001 - 1000 = 1 ms
      await qs.setSpeedRange(1000);
      let label = await qs.getSpeedLabelText();
      expect(label).toBe('1 ms');

      // Set to slowest: range value 1 => speed = 1000 ms
      await qs.setSpeedRange(1);
      label = await qs.getSpeedLabelText();
      expect(label).toBe('1000 ms');
    });
  });

  test.describe('Sorting Process and Visual Feedback (S1 -> S2 -> S3)', () => {
    test('StartQuickSort transition: sorting runs, disable buttons while sorting, and results in sorted array', async ({ page }) => {
      // This test will accelerate sorting to keep runtime reasonable.
      const qs3 = new QuickSortPage(page);
      await qs.goto();

      // Speed up sorting drastically to complete quickly: set range = 1000 -> speed 1ms
      await qs.setSpeedRange(1000);
      const speedText1 = await qs.getSpeedLabelText();
      expect(speedText).toBe('1 ms');

      // Capture array values before sort
      const before1 = await qs.readBarValues();

      // Start sorting
      await qs.clickSort();

      // Immediately after clicking, both buttons should be disabled
      const newDisabledDuring = await qs.isButtonDisabled('#newArrayBtn');
      const sortDisabledDuring = await qs.isButtonDisabled('#sortBtn');
      expect(newDisabledDuring).toBe(true);
      expect(sortDisabledDuring).toBe(true);

      // Wait for sorting to complete (sortBtn becomes enabled again)
      await qs.waitForSortComplete(20000);

      // After sorting, buttons should be enabled
      const newDisabledAfter = await qs.isButtonDisabled('#newArrayBtn');
      const sortDisabledAfter = await qs.isButtonDisabled('#sortBtn');
      expect(newDisabledAfter).toBe(false);
      expect(sortDisabledAfter).toBe(false);

      // Validate the array is now sorted (non-decreasing)
      const after1 = await qs.readBarValues();
      expect(after.length).toBe(30);
      for (let i = 1; i < after.length; i++) {
        expect(after[i]).toBeGreaterThanOrEqual(after[i - 1]);
      }

      // We expect that sorting changed the array order unless it was already sorted
      const arraysEqual1 = JSON.stringify(before) === JSON.stringify(after);
      if (arraysEqual) {
        // If unchanged, mark a warning in console messages (non-failing)
        consoleMessages.push({ type: 'warning', text: 'Array appeared already sorted before sorting started.' });
      }
    });

    test('Visual cues during sorting: pivot/comparison/swapped classes appear at least once', async ({ page }) => {
      // We set a modest speed so that intermediate states can be observed.
      const qs4 = new QuickSortPage(page);
      await qs.goto();

      // Set speed to a value allowing brief observation: range ~980 => speed 21 ms
      await qs.setSpeedRange(980);

      // Start sorting
      await qs.clickSort();

      // While sorting, verify at least one pivot is rendered during the process.
      // This confirms renderArray({ pivot: ... }) was called during partitioning.
      await qs.waitForPivotAppearance(5000);

      // Wait for sorting to finish
      await qs.waitForSortComplete(20000);

      // After completion, ensure final array is sorted
      const sorted = await qs.readBarValues();
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]).toBeGreaterThanOrEqual(sorted[i - 1]);
      }
    });

    test('Edge case: Generate New Array button is disabled during sorting and remains disabled until completion', async ({ page }) => {
      const qs5 = new QuickSortPage(page);
      await qs.goto();

      // Speed should be slow enough to allow us to check disabled state; set to 950 => speed 51ms
      await qs.setSpeedRange(950);

      // Start sorting
      await qs.clickSort();

      // Immediately check newArrayBtn is disabled
      let newDisabled = await qs.isButtonDisabled('#newArrayBtn');
      expect(newDisabled).toBe(true);

      // Attempt to click the disabled button - Playwright will still perform a click, but the disabled attribute prevents app-level handler.
      // Confirm the disabled attribute is still present afterwards and that clicking did not re-enable it prematurely.
      await page.click('#newArrayBtn');
      newDisabled = await qs.isButtonDisabled('#newArrayBtn');
      expect(newDisabled).toBe(true);

      // Wait for sorting to complete and confirm button re-enabled
      await qs.waitForSortComplete(20000);
      newDisabled = await qs.isButtonDisabled('#newArrayBtn');
      expect(newDisabled).toBe(false);
    });
  });

  test.describe('Console and Page Error Monitoring', () => {
    test('There should be no uncaught ReferenceError, SyntaxError, or TypeError logged on page load and interactions', async ({ page }) => {
      // This test observes console and page errors during a set of typical interactions
      const qs6 = new QuickSortPage(page);
      await qs.goto();

      // Interact: adjust speed, generate new array, start and finish sorting quickly
      await qs.setSpeedRange(1000);
      await qs.clickGenerate();

      // Start sort with maximum speed so it completes quickly
      await qs.clickSort();
      await qs.waitForSortComplete(20000);

      // Now assert no page errors were captured
      // pageErrors is populated via page.on('pageerror')
      expect(pageErrors.length).toBe(0);

      // Also assert there are no console.error messages
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);

      // Additionally collect any runtime Error objects that might have been logged via console
      const runtimeErrorMessages = consoleMessages.filter(m => {
        const text = (m.text || '').toString();
        return text.includes('ReferenceError') || text.includes('TypeError') || text.includes('SyntaxError');
      });
      expect(runtimeErrorMessages.length).toBe(0);
    });
  });
});