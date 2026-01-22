import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f1818e91-d366-11f0-9b19-a558354ece3e.html';

class BinarySearchPage {
  /**
   * Page Object for Binary Search Visualizer
   * Encapsulates common interactions and queries
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.searchBtn = page.locator('#searchBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.arrayElements = page.locator('#arrayElements');
    this.logSection = page.locator('#logSection');
    this.comparisonCount = page.locator('#comparisonCount');
    this.stepCount = page.locator('#stepCount');
  }

  async navigate() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for initial initializeArray() log entry to be present
    await expect(this.logSection.locator('.log-entry')).toHaveCountGreaterThan(0, { timeout: 2000 }).catch(() => {});
  }

  async setTarget(value) {
    await this.targetInput.fill(String(value));
  }

  async clickSearch() {
    await this.searchBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getLogTexts() {
    return this.logSection.locator('.log-entry').allTextContents();
  }

  async countArrayElements() {
    return this.arrayElements.locator('.element').count();
  }

  async getElementClass(index) {
    const locator = this.page.locator(`#element-${index}`);
    return locator.getAttribute('class');
  }

  async getComparisonCount() {
    return this.comparisonCount.innerText();
  }

  async getStepCount() {
    return this.stepCount.innerText();
  }
}

// Helper assertion to wait for locator count > given (since Playwright has toHaveCount but not >)
expect.extend({
  async toHaveCountGreaterThan(locator, expected, options = {}) {
    const { timeout = 2000 } = options;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const count = await locator.count();
      if (count > expected) {
        return {
          pass: true,
          message: () => `expected locator.count() > ${expected}`,
        };
      }
      await new Promise(r => setTimeout(r, 50));
    }
    const final = await locator.count();
    return {
      pass: final > expected,
      message: () => `expected locator.count() > ${expected}, got ${final}`,
    };
  },
});

// Capture test-level console and error messages
test.describe('Binary Search Visualizer - FSM based tests', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for later assertions
    page.on('console', msg => {
      try {
        consoleMessages.push(msg.text());
      } catch {
        consoleMessages.push(String(msg));
      }
    });

    // Collect page errors
    page.on('pageerror', error => {
      pageErrors.push(error.message || String(error));
    });
  });

  test.describe('S0_Idle (Initial) state validations', () => {
    test('Initial load triggers initializeArray and displays elements and logs', async ({ page }) => {
      const app = new BinarySearchPage(page);
      await app.navigate();

      // Validate no runtime page errors occurred during load
      expect(pageErrors).toEqual([]);

      // The array should be initialized and elements generated
      const count = await app.countArrayElements();
      expect(count).toBeGreaterThanOrEqual(1); // default array should produce multiple elements

      // comparison and step counters should be zero on initial load
      await expect(app.comparisonCount).toHaveText('0');
      await expect(app.stepCount).toHaveText('0');

      // Log should contain initial "Array initialized"
      const logs = await app.getLogTexts();
      const hasInit = logs.some(l => l.includes('Array initialized'));
      expect(hasInit).toBeTruthy();

      // Ensure the console didn't emit exceptions
      const hasErrorConsole = consoleMessages.some(m => /error|uncaught/i.test(m));
      expect(hasErrorConsole).toBeFalsy();
    });
  });

  test.describe('S1_Searching state and transitions', () => {
    test('Clicking Start triggers search: observe start log, step and comparison counts and found message', async ({ page }) => {
      const app = new BinarySearchPage(page);
      await app.navigate();

      // Ensure target is default 13; set explicitly to be deterministic
      await app.setTarget(13);

      // Click search and assert "Starting binary search..." appears
      await app.clickSearch();

      // After clicking, initializeArray() is called synchronously, then "Starting..." is logged,
      // and binarySearch is scheduled after 500ms. Wait for the Starting log to appear.
      await page.waitForFunction(() => {
        const logs = Array.from(document.querySelectorAll('#logSection .log-entry')).map(e => e.textContent || '');
        return logs.some(t => t.includes('Starting binary search for'));
      }, null, { timeout: 1500 });

      // Verify that a "Starting binary search" message exists for our target
      const logsAfterStart = await app.getLogTexts();
      expect(logsAfterStart.some(l => l.includes('Starting binary search for 13'))).toBeTruthy();

      // Wait for the synchronous step & comparison counters to update (binarySearch updates these synchronously)
      await expect(app.stepCount).toHaveText('1', { timeout: 3000 });
      await expect(app.comparisonCount).toHaveText('1', { timeout: 3000 });

      // The binary search schedules a "Found ..." log via setTimeout; wait for it (allow up to 4s)
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('#logSection .log-entry')).some(el => (el.textContent || '').includes('Found 13'));
      }, null, { timeout: 5000 });

      const logsFinal = await app.getLogTexts();
      const foundEntry = logsFinal.find(l => l.includes('Found 13 at index'));
      expect(foundEntry).toBeTruthy();

      // After the scheduled highlight runs, the found element should eventually get the 'found' class
      // Wait for up to 3 seconds for the class change
      await page.waitForFunction(() => {
        const el = document.getElementById('element-6');
        return el && el.className && el.className.includes('found');
      }, null, { timeout: 3000 });

      const elClass = await app.getElementClass(6);
      expect(elClass).toContain('found');

      // Ensure no uncaught page errors during the search
      expect(pageErrors).toEqual([]);
    });

    test('Starting search twice quickly appends multiple starting logs (S1 -> S1 transition)', async ({ page }) => {
      const app = new BinarySearchPage(page);
      await app.navigate();

      // Clear target to a valid number and perform two quick search clicks
      await app.setTarget(9);
      await Promise.all([
        app.clickSearch(),
        app.clickSearch(), // second click immediately
      ]);

      // Wait for at least two "Starting binary search" entries to appear
      await page.waitForFunction(() => {
        const texts = Array.from(document.querySelectorAll('#logSection .log-entry')).map(e => e.textContent || '');
        return texts.filter(t => t.includes('Starting binary search for')).length >= 2;
      }, null, { timeout: 3000 });

      const logs = await app.getLogTexts();
      const countStart = logs.filter(l => l.includes('Starting binary search for')).length;
      expect(countStart).toBeGreaterThanOrEqual(2);

      // No uncaught errors expected
      expect(pageErrors).toEqual([]);
    });

    test('Searching for an absent target logs "not found" after search completes', async ({ page }) => {
      const app = new BinarySearchPage(page);
      await app.navigate();

      // Pick a target not in the default array
      await app.setTarget(1000);
      await app.clickSearch();

      // Wait for the synchronous "Starting binary search..." log
      await page.waitForFunction(() => {
        const texts = Array.from(document.querySelectorAll('#logSection .log-entry')).map(e => e.textContent || '');
        return texts.some(t => t.includes('Starting binary search for'));
      }, null, { timeout: 1500 });

      // The final "not found" message is scheduled via setTimeout with cumulative steps*1000 delays.
      // Wait up to 8 seconds for the "not found" log to appear.
      await page.waitForFunction(() => {
        const texts = Array.from(document.querySelectorAll('#logSection .log-entry')).map(e => e.textContent || '');
        return texts.some(t => t.includes('not found in the array'));
      }, null, { timeout: 8000 });

      const logs = await app.getLogTexts();
      expect(logs.some(l => l.includes('not found in the array'))).toBeTruthy();

      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('S2_Reset (Reset) state validations', () => {
    test('Clicking Reset re-initializes the array and clears counters and logs appropriately', async ({ page }) => {
      const app = new BinarySearchPage(page);
      await app.navigate();

      // Perform a search to change counters and logs
      await app.setTarget(5);
      await app.clickSearch();

      // Wait for at least the starting log to ensure initialize and start occurred
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('#logSection .log-entry')).some(e => (e.textContent || '').includes('Starting binary search for'));
      }, null, { timeout: 2000 });

      // Now click reset
      await app.clickReset();

      // After reset, initializeArray() is called and a new "Array initialized" log should exist
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('#logSection .log-entry')).some(e => (e.textContent || '').includes('Array initialized'));
      }, null, { timeout: 1500 });

      // Counters should be reset to zero
      await expect(app.comparisonCount).toHaveText('0');
      await expect(app.stepCount).toHaveText('0');

      // All elements should be returned to 'normal' class quickly
      // Wait briefly to allow DOM updates
      await page.waitForTimeout(100);
      const count = await app.countArrayElements();
      for (let i = 0; i < Math.min(count, 20); i++) {
        const cls = await app.getElementClass(i);
        expect(cls).toContain('normal');
      }

      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Edge cases and error handling', () => {
    test('Entering an invalid target (non-number) triggers alert and aborts search', async ({ page }) => {
      const app = new BinarySearchPage(page);
      await app.navigate();

      // Set target to an empty string to cause isNaN check to trigger alert
      await app.setTarget('');
      // Listen for dialog
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog', { timeout: 2000 }),
        app.clickSearch(),
      ]);

      // Validate the alert message
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Please enter a valid target number');
      await dialog.dismiss();

      // Ensure no "Starting binary search" log was appended due to invalid target
      const logs = await app.getLogTexts();
      expect(logs.some(l => l.includes('Starting binary search'))).toBeFalsy();

      // Ensure no uncaught errors
      expect(pageErrors).toEqual([]);
    });

    test('Console and page error monitoring: ensure no uncaught JS errors on normal interactions', async ({ page }) => {
      const app = new BinarySearchPage(page);
      await app.navigate();

      // Do several interactions
      await app.setTarget(7);
      await app.clickSearch();

      // Wait for "Found" or at least step log to appear
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('#logSection .log-entry')).some(e => (e.textContent || '').includes('Step'));
      }, null, { timeout: 3000 });

      await app.clickReset();

      // Assert that no page errors were recorded during these interactions
      expect(pageErrors).toEqual([]);

      // Additionally ensure console did not surface severe errors
      const severeConsole = consoleMessages.filter(m => /uncaught|error|exception/i.test(m));
      expect(severeConsole.length).toBe(0);
    });
  });
});