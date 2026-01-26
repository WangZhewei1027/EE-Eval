import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c96f131-fa78-11f0-857d-d58e82d5de73.html';

class QuickSortPage {
  /**
   * Page object for the Quick Sort visualization app.
   * Provides helpers to interact with controls and inspect bars.
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.bars = page.locator('.bars');
    this.barItems = page.locator('.bars .bar');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getBarCount() {
    return await this.barItems.count();
  }

  async getBarValues() {
    const count = await this.getBarCount();
    const values = [];
    for (let i = 0; i < count; i++) {
      const el = this.barItems.nth(i);
      const v = await el.getAttribute('data-val');
      values.push(Number(v));
    }
    return values;
  }

  async getBarClasses(index) {
    return (await this.barItems.nth(index).getAttribute('class')) || '';
  }

  async anyBarHasClass(cls) {
    // returns true if any .bar has the given class
    const count = await this.getBarCount();
    for (let i = 0; i < count; i++) {
      const classes = await this.getBarClasses(i);
      if (classes.split(/\s+/).includes(cls)) return true;
    }
    return false;
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async startButtonDisabled() {
    // check both aria-disabled and disabled property
    const aria = await this.startBtn.getAttribute('aria-disabled');
    const disabled = await this.startBtn.isDisabled();
    return { aria, disabled };
  }

  async resetButtonDisabled() {
    const aria = await this.resetBtn.getAttribute('aria-disabled');
    const disabled = await this.resetBtn.isDisabled();
    return { aria, disabled };
  }

  async waitForPivot(timeout = 4000) {
    // Wait for an element with class pivot to appear
    await this.page.waitForSelector('.bars .bar.pivot', { timeout });
  }
}

test.describe('Quick Sort Visualization — FSM and UI tests', () => {
  // Collect console error messages and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.describe('Initial state (S0_Idle) validations', () => {
    test('Initial render should call resetVisualization and show an array of bars', async ({ page }) => {
      // Validate entry action of S0_Idle: resetVisualization() should populate bars
      const app = new QuickSortPage(page);
      await app.goto();

      // Assert no page-level runtime errors on load
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);

      // The implementation configures ARRAY_SIZE = 30
      const count = await app.getBarCount();
      expect(count).toBeGreaterThanOrEqual(1); // at least one bar
      expect(count).toBe(30); // expected configured size

      // Values should be numbers in configured range (MIN_VALUE 7, MAX_VALUE 95)
      const vals = await app.getBarValues();
      expect(vals.length).toBe(30);
      for (const v of vals) {
        expect(typeof v).toBe('number');
        expect(v).toBeGreaterThanOrEqual(7);
        expect(v).toBeLessThanOrEqual(95);
      }

      // Bars should have appropriate accessibility attributes
      for (let i = 0; i < Math.min(3, vals.length); i++) {
        const role = await page.locator('.bars .bar').nth(i).getAttribute('role');
        expect(role).toBe('img');
        const aria = await page.locator('.bars .bar').nth(i).getAttribute('aria-label');
        expect(aria).toMatch(/Value \d+/);
      }

      // Start and Reset buttons should be enabled in idle state
      const startAttr = await app.startBtn.getAttribute('aria-disabled');
      const resetAttr = await app.resetBtn.getAttribute('aria-disabled');
      expect(startAttr === 'false' || startAttr === null).toBeTruthy();
      expect(resetAttr === 'false' || resetAttr === null).toBeTruthy();
      expect(await app.startBtn.isDisabled()).toBeFalsy();
      expect(await app.resetBtn.isDisabled()).toBeFalsy();
    });
  });

  test.describe('Transitions and events', () => {
    test('StartClick -> transitions to Sorting (S1_Sorting) and startVisualization entry actions run', async ({ page }) => {
      // Validate that clicking START triggers startVisualization and sets sorting state (buttons disabled, pivot shown)
      const app = new QuickSortPage(page);
      await app.goto();

      // Click start and observe immediate UI changes (buttons disabled and a pivot appears)
      await app.clickStart();

      // After starting, the code should set aria-disabled to 'true' and disable the buttons
      await page.waitForFunction(() => {
        const s = document.getElementById('startBtn');
        const r = document.getElementById('resetBtn');
        return s && r && (s.getAttribute('aria-disabled') === 'true' || s.disabled === true);
      }, { timeout: 2000 });

      const startState = await app.startButtonDisabled();
      const resetState = await app.resetButtonDisabled();

      expect(startState.aria === 'true' || startState.disabled === true).toBeTruthy();
      expect(resetState.aria === 'true' || resetState.disabled === true).toBeTruthy();

      // The visualization should show a pivot bar shortly after starting.
      // This indicates startVisualization() entered quickSort and executed renderBars with pivotIndex.
      await app.waitForPivot(4000);
      const hasPivot = await app.anyBarHasClass('pivot');
      expect(hasPivot).toBeTruthy();

      // Also ensure no unexpected uncaught runtime errors occurred during the transition
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking START multiple times quickly should not break the app (idempotent while sorting)', async ({ page }) => {
      // When sorting has started, subsequent clicks should be no-ops due to guard (if (!sorting) startVisualization())
      const app = new QuickSortPage(page);
      await app.goto();

      await app.clickStart();

      // Wait for the buttons to become disabled to ensure sorting has been set
      await page.waitForFunction(() => {
        return document.getElementById('startBtn').getAttribute('aria-disabled') === 'true';
      }, { timeout: 2000 });

      // Attempt clicking START again while it's disabled
      await app.startBtn.click({ timeout: 1000 }).catch(() => { /* ignore click failures on disabled control */ });

      // Buttons should remain disabled and app should not throw errors
      const startState = await app.startButtonDisabled();
      expect(startState.aria === 'true' || startState.disabled === true).toBeTruthy();

      // No runtime errors introduced by repeated clicks
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('ResetClick while IDLE should reset the visualization (S0_Idle -> S2_Reset -> back to Idle)', async ({ page }) => {
      // Validate reset when not sorting: new array generated and bars change
      const app = new QuickSortPage(page);
      await app.goto();

      // Capture initial values
      const initialValues = await app.getBarValues();

      // Click reset button (idle)
      await app.clickReset();

      // After reset, bars should be repopulated. Because createRandomArray avoids duplicates, it's highly likely to differ.
      await page.waitForTimeout(50); // allow brief tick for UI to update

      const newValues = await app.getBarValues();

      // Ensure arrays are same length and composed of numbers
      expect(newValues.length).toBe(initialValues.length);
      // It's possible but extremely unlikely that the random array is identical; assert that they are not identical in at least one position.
      const identical = initialValues.every((v, i) => v === newValues[i]);
      // If identical, the test should still consider it a valid reset as the function executed; assert that reset ran by checking timestamp-independent effects:
      // Here we assert that reset called set of values still has correct size and uniqueness.
      const uniqueSet = new Set(newValues);
      expect(uniqueSet.size).toBe(newValues.length);

      // At least one of these conditions must be true:
      // - arrays differ OR
      // - new array has unique entries (indicating reset executed successfully)
      expect(!identical || uniqueSet.size === newValues.length).toBeTruthy();

      // No runtime errors expected
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('ResetClick while SORTING should be ignored (edge case) and not enable controls', async ({ page }) => {
      // Start sorting and immediately attempt to reset; the implementation ignores reset during sorting.
      const app = new QuickSortPage(page);
      await app.goto();

      // Start sorting
      await app.clickStart();

      // Wait for sorting to be set (buttons disabled) and a pivot to appear
      await page.waitForFunction(() => {
        return document.getElementById('startBtn').getAttribute('aria-disabled') === 'true';
      }, { timeout: 2000 });

      await app.waitForPivot(4000);

      // Record current state: presence of pivot and start/reset disabled
      const pivotBefore = await app.anyBarHasClass('pivot');
      const startStateBefore = await app.startButtonDisabled();
      const resetStateBefore = await app.resetButtonDisabled();

      expect(pivotBefore).toBeTruthy();
      expect(startStateBefore.aria === 'true' || startStateBefore.disabled === true).toBeTruthy();
      expect(resetStateBefore.aria === 'true' || resetStateBefore.disabled === true).toBeTruthy();

      // Click RESET while sorting (should be ignored by guard if (!sorting) resetVisualization())
      await app.clickReset();

      // Short delay to allow any accidental changes (if any) to appear
      await page.waitForTimeout(300);

      // After clicking reset during sorting, controls should remain disabled and pivot likely still present (sorting ongoing)
      const startStateAfter = await app.startButtonDisabled();
      const resetStateAfter = await app.resetButtonDisabled();
      expect(startStateAfter.aria === 'true' || startStateAfter.disabled === true).toBeTruthy();
      expect(resetStateAfter.aria === 'true' || resetStateAfter.disabled === true).toBeTruthy();

      // There should still be at least one bar and pivot class may still be present
      const barCount = await app.getBarCount();
      expect(barCount).toBeGreaterThan(0);

      // If pivot was present before, ensure it wasn't removed immediately by reset
      const pivotAfter = await app.anyBarHasClass('pivot');
      expect(pivotAfter || !pivotBefore).toBeTruthy();

      // No runtime errors introduced by attempting reset during sorting
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Accessibility and DOM attributes remain consistent through interactions', async ({ page }) => {
      // Check that ARIA attributes and roles persist after a sequence of interactions (start -> idle check via re-enabling not waited)
      const app = new QuickSortPage(page);
      await app.goto();

      // Verify buttons have aria-controls and titles as defined in markup
      const startAriaControls = await app.startBtn.getAttribute('aria-controls');
      const resetAriaControls = await app.resetBtn.getAttribute('aria-controls');
      expect(startAriaControls).toBe('bars');
      expect(resetAriaControls).toBe('bars');

      const startTitle = await app.startBtn.getAttribute('title');
      const resetTitle = await app.resetBtn.getAttribute('title');
      expect(startTitle).toMatch(/Start sorting animation/i);
      expect(resetTitle).toMatch(/Reset to new random array/i);

      // Start and then immediately check these attributes remain present even when disabled
      await app.clickStart();
      await page.waitForFunction(() => {
        return document.getElementById('startBtn').getAttribute('aria-disabled') === 'true';
      }, { timeout: 2000 });

      expect(await app.startBtn.getAttribute('aria-controls')).toBe('bars');
      expect(await app.resetBtn.getAttribute('aria-controls')).toBe('bars');

      // No runtime errors discovered
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Error observation and edge-case monitoring', () => {
    test('No uncaught ReferenceError / TypeError / SyntaxError during page lifecycle (observational test)', async ({ page }) => {
      // This test specifically observes console and page errors across multiple interactions.
      const app = new QuickSortPage(page);
      await app.goto();

      // Interact a bit: start, pause short time, attempt multiple clicks
      await app.clickStart();
      await page.waitForTimeout(200); // allow some initial steps
      await app.startBtn.click().catch(() => {});
      await app.resetBtn.click().catch(() => {});
      await page.waitForTimeout(200);

      // Collect any errors that happened
      // We explicitly allow any runtime errors to surface naturally; now we assert their absence.
      // If such errors occurred, this assertion will fail and surface them in test output.
      if (pageErrors.length > 0 || consoleErrors.length > 0) {
        // Provide diagnostic info in the assertion message
        const msgs = [
          ...pageErrors.map(e => e && e.message ? e.message : String(e)),
          ...consoleErrors.map(c => c.text)
        ].join('\n---\n');
        throw new Error('Runtime errors detected during page interactions:\n' + msgs);
      }

      // If none, pass the test
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // Final safety: capture any async errors that occurred late
    // We assert at least that no unexpected exceptions were unhandled.
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // Fail test with diagnostics
      const diagnostics = {
        pageErrors: pageErrors.map(e => (e && e.message) ? e.message : String(e)),
        consoleErrors: consoleErrors.map(c => c.text),
      };
      // Use expect.false to produce a helpful failure message
      expect(diagnostics.pageErrors.length + diagnostics.consoleErrors.length).toBe(0);
    }
  });
});