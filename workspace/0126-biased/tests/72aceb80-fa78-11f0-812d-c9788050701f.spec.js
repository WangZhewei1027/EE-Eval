import { test, expect } from '@playwright/test';

test.setTimeout(20000);

class VisualSuitePage {
  /**
   * Page object wrapper for the Unit Testing | Visual Symphony page
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runSelector = '#runTests';
    this.progressSelector = '#testProgress';
    this.outputSelector = '#testOutput';
    this.lineSelector = '.test-line';
  }

  async goto(url) {
    await this.page.goto(url);
  }

  // Click the Run Tests button
  async clickRun() {
    await this.page.click(this.runSelector);
  }

  // Returns the inline style.width value (e.g. "0", "50%", "100%") or empty string if not set inline
  async getProgressInlineWidth() {
    return await this.page.$eval(this.progressSelector, (el) => el.style.width || '');
  }

  // Returns the computed pixel width like "0px", "123.4px"
  async getProgressComputedWidth() {
    return await this.page.$eval(this.progressSelector, (el) => {
      return window.getComputedStyle(el).width;
    });
  }

  // Returns the number of .test-line elements currently in the output
  async countOutputLines() {
    return await this.page.$$eval(this.lineSelector, (els) => els.length);
  }

  // Returns an array of textContent of .test-line elements
  async getOutputLinesText() {
    return await this.page.$$eval(this.lineSelector, (els) => els.map(e => e.textContent));
  }

  // Wait for a line containing the provided substring text to appear
  async waitForLineContaining(text, timeout = 7000) {
    await this.page.waitForFunction(
      (sel, txt) => {
        const els = Array.from(document.querySelectorAll(sel));
        return els.some(e => e.textContent && e.textContent.includes(txt));
      },
      this.lineSelector,
      text,
      { timeout }
    );
  }

  // Wait until inline progress width becomes exactly the target value (e.g. "100%", "0")
  async waitForProgressInlineWidth(value, timeout = 7000) {
    await this.page.waitForFunction(
      (sel, val) => document.querySelector(sel)?.style?.width === val,
      this.progressSelector,
      value,
      { timeout }
    );
  }
}

test.describe('72aceb80-fa78-11f0-812d-c9788050701f — FSM & UI tests', () => {
  const URL =
    'http://127.0.0.1:5500/workspace/0126-biased/html/72aceb80-fa78-11f0-812d-c9788050701f.html';

  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console messages for assertions
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // store pageerror objects for later inspection
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the page under test
    await page.goto(URL);
  });

  test.afterEach(async ({ page }) => {
    // Give the page a moment to settle any late async tasks
    await page.waitForTimeout(200);
    // Ensure no unexpected page errors were thrown during the test run
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
  });

  test.describe('State S0_Idle (Initial load)', () => {
    test('Page loads into Idle state: elements present and no test output', async ({ page }) => {
      const ui = new VisualSuitePage(page);

      // Validate that the main interactive elements are present (evidence of DOMContentLoaded)
      await expect(page.locator('#runTests')).toBeVisible();
      await expect(page.locator('#testOutput')).toBeVisible();
      await expect(page.locator('#testProgress')).toBeVisible();

      // testOutput should start empty (S0_Idle entry action renderPage() is represented by DOMContentLoaded)
      const outputCount = await ui.countOutputLines();
      expect(outputCount).toBe(0);

      // Computed progress width should be zero pixels (CSS sets width: 0)
      const computedWidth = await ui.getProgressComputedWidth();
      // We expect the progress visual width to be zero on initial load
      expect(computedWidth).toMatch(/^0(px)?$/);

      // Inline style width likely empty initially; ensure inline is empty string
      const inlineWidth = await ui.getProgressInlineWidth();
      expect(inlineWidth === '' || inlineWidth === '0' || inlineWidth === '0%').toBeTruthy();

      // No console errors were emitted during initial load
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    });
  });

  test.describe('Transition S0_Idle -> S1_Testing (RunTests_Click)', () => {
    test('Clicking Run Tests enters Testing, clears previous output, and begins emitting lines', async ({ page }) => {
      const ui = new VisualSuitePage(page);

      // Ensure starting fresh: no lines
      expect(await ui.countOutputLines()).toBe(0);

      // Click the run button and verify immediate clearing behavior
      await ui.clickRun();

      // The click handler clears previous output by setting innerHTML = '' and testProgress.style.width = '0'
      // Check the inline width becomes '0' as per implementation
      await ui.waitForProgressInlineWidth('0');

      // Immediately after click, there should be no .test-line elements (cleared)
      expect(await ui.countOutputLines()).toBe(0);

      // The simulation should start appending lines. The first line appears immediately or within 800ms.
      await ui.waitForLineContaining('Starting test suite...', 1500);

      // After a short delay, progress should have started increasing (inline style becomes something like "5%")
      // Wait briefly and ensure inline width is not exactly '0' anymore (progress started)
      await page.waitForTimeout(600);
      const inlineWidthAfterStart = await ui.getProgressInlineWidth();
      // Progress may still be '0' if interval hasn't fired yet; accept either but assert eventually reaches > '0'
      // We'll wait up to 3000ms for inline to become non-empty and nonzero
      await page.waitForFunction(
        (sel) => {
          const w = document.querySelector(sel).style.width;
          return w && w !== '' && w !== '0';
        },
        ui.progressSelector,
        { timeout: 3000 }
      );

      const inlineWidthNow = await ui.getProgressInlineWidth();
      expect(inlineWidthNow.length).toBeGreaterThan(0);

      // Verify no uncaught exceptions were thrown while starting tests
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition S1_Testing -> S2_Completed (TestExecution_Complete)', () => {
    test('Completes test execution: all lines appended and progress reaches 100%', async ({ page }) => {
      const ui = new VisualSuitePage(page);

      // Start test run
      await ui.clickRun();

      // Wait for the final "Tests complete" line which indicates completion of the test execution flow.
      // The implementation schedules 5 lines, last one is at index 4 -> delay 4 * 800ms = 3200ms. Allow a margin.
      await ui.waitForLineContaining('Tests complete: 2 passed, 1 failed', 7000);

      // After the "Tests complete" line appears, the script's progressInterval should have also reached 100
      // The implementation sets inline style width to `${progress}%`, so after completion it should be "100%"
      await ui.waitForProgressInlineWidth('100%', 5000);

      const inlineWidthFinal = await ui.getProgressInlineWidth();
      expect(inlineWidthFinal).toBe('100%');

      // Assert that exactly 5 test-line elements have been appended
      const lines = await ui.getOutputLinesText();
      expect(lines.length).toBe(5);
      expect(lines[0]).toContain('Starting test suite...');
      expect(lines[lines.length - 1]).toContain('Tests complete: 2 passed, 1 failed');

      // Verify presence of specific result classes in appended lines
      const successCount = await page.$$eval('.test-line.success-line', els => els.length);
      const errorCount = await page.$$eval('.test-line.error-line', els => els.length);
      const infoCount = await page.$$eval('.test-line.info-line', els => els.length);

      expect(successCount).toBeGreaterThanOrEqual(2); // two success lines expected
      expect(errorCount).toBeGreaterThanOrEqual(1);   // one error line expected
      expect(infoCount).toBeGreaterThanOrEqual(2);    // starting and final info lines

      // Confirm no page errors during the long-running execution
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and repeated interactions', () => {
    test('Clicking Run Tests while a run is in progress clears and restarts the execution', async ({ page }) => {
      const ui = new VisualSuitePage(page);

      // Start first run
      await ui.clickRun();

      // Allow the first run to begin emitting the first line
      await ui.waitForLineContaining('Starting test suite...', 1500);

      // Now click Run Tests again quickly while it is running
      await ui.clickRun();

      // Per implementation, the click handler immediately clears output and sets inline width to '0'
      // Assert cleared output and inline width '0' immediately after second click
      await ui.waitForProgressInlineWidth('0', 2000);
      const linesAfterSecondClick = await ui.countOutputLines();
      expect(linesAfterSecondClick).toBe(0);

      // The run should restart: wait for the new "Starting test suite..." line to reappear
      await ui.waitForLineContaining('Starting test suite...', 3000);

      // Wait for completion of the restarted run
      await ui.waitForLineContaining('Tests complete: 2 passed, 1 failed', 7000);

      // Ensure progress reached 100% again
      await ui.waitForProgressInlineWidth('100%', 5000);
      expect(await ui.getProgressInlineWidth()).toBe('100%');

      // Validate no errors were thrown during rapid repeated interactions
      expect(pageErrors.length).toBe(0);
    });

    test('Multiple rapid clicks do not cause uncaught exceptions', async ({ page }) => {
      const ui = new VisualSuitePage(page);

      // Rapidly click the run button 5 times
      for (let i = 0; i < 5; i++) {
        await ui.clickRun();
        // small spacing similar to a fast user
        await page.waitForTimeout(120);
      }

      // After a burst of clicks, ensure we still get eventual completion
      await ui.waitForLineContaining('Tests complete: 2 passed, 1 failed', 9000);
      await ui.waitForProgressInlineWidth('100%', 5000);

      // Sanity checks on counts of lines are coarse because multiple starts may produce partial runs,
      // but we at least assert there is the final completion line and progress hit 100%.
      expect((await ui.getOutputLinesText()).some(t => t.includes('Tests complete: 2 passed, 1 failed'))).toBeTruthy();

      // Confirm no uncaught page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Observability: console and runtime errors', () => {
    test('No unexpected console errors or runtime exceptions during a normal run', async ({ page }) => {
      const ui = new VisualSuitePage(page);

      // Clear previous recorded messages
      consoleMessages = [];
      pageErrors = [];

      // Run tests normally and wait for completion
      await ui.clickRun();
      await ui.waitForLineContaining('Tests complete: 2 passed, 1 failed', 7000);
      await ui.waitForProgressInlineWidth('100%', 5000);

      // Inspect console for messages of type 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');

      // We assert that there are no console.error messages emitted as part of the normal flow
      expect(consoleErrors.length).toBe(0);

      // And no uncaught page errors should be recorded
      expect(pageErrors.length).toBe(0);
    });

    test('If runtime errors were present they would be captured by pageerror (this test asserts no errors)', async ({ page }) => {
      // This test demonstrates capturing pageerror events. We assert none happened during navigation/setup.
      expect(pageErrors.length).toBe(0);
    });
  });
});