import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d833f310-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the demo area
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#run-demo');
    this.log = page.locator('#demo-log');
    this.demoArrayText = page.locator('#demo-array-text');

    // Captured console and page errors
    /** @type {Array<import('@playwright/test').ConsoleMessage>} */
    this.consoleMessages = [];
    /** @type {Array<Error>} */
    this.pageErrors = [];
  }

  // Initialize listeners and navigate to the page
  async init() {
    // Listen to console messages and page errors before navigation to capture any load-time issues
    this.page.on('console', (msg) => {
      this.consoleMessages.push(msg);
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });

    await this.page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for the demo elements to be present
    await expect(this.runBtn).toBeVisible();
    await expect(this.log).toBeVisible();
    await expect(this.demoArrayText).toBeVisible();
  }

  // Click the Run demo button
  async clickRun() {
    await this.runBtn.click();
  }

  // Read the raw text content of the demo log
  async logText() {
    return (await this.log.textContent()) ?? '';
  }

  // Return an array of log lines split by newline (trimmed)
  async logLines() {
    const text = await this.logText();
    return text.split('\n').map((l) => l.trim());
  }

  // Wait until the log contains a particular substring
  async waitForLogContains(substring, timeout = 5000) {
    await this.page.waitForFunction(
      ({ selector, substring }) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        return el.textContent && el.textContent.includes(substring);
      },
      { selector: '#demo-log', substring },
      { timeout }
    );
  }

  // Retrieve numbers from "Extract min = X" lines in the log (in the order they appear)
  async parseExtractedValues() {
    const lines = await this.logLines();
    const extracted = [];
    const re = /Extract min\s*=\s*([+-]?\d+)/;
    for (const line of lines) {
      const m = line.match(re);
      if (m) {
        extracted.push(Number(m[1]));
      }
    }
    return extracted;
  }

  // Helper to get console errors (messages of type 'error')
  consoleErrors() {
    return this.consoleMessages.filter((m) => m.type() === 'error' || m.type() === 'assert');
  }
}

test.describe('Min-Heap Demo (FSM: Idle -> DemoRunning)', () => {
  let demo;

  test.beforeEach(async ({ page }) => {
    demo = new DemoPage(page);
    await demo.init();
  });

  test.afterEach(async () => {
    // Nothing to teardown besides letting Playwright close the page context
  });

  test('Idle state: initial DOM reflects the Idle FSM state and no runtime errors on load', async () => {
    // This test validates the S0_Idle state:
    // - The demo log should show the idle message (evidence from FSM).
    // - The Run demo button and demo array text should be present with correct attributes.
    // - There should be no uncaught page errors or console errors on initial load.

    const logText = await demo.logText();
    // Evidence string from FSM entry for Idle
    expect(logText).toContain('Demo log ready. Press "Run demo" to start');

    // Button exists and has expected attributes and text
    await expect(demo.runBtn).toBeVisible();
    await expect(demo.runBtn).toHaveText('Run demo');
    await expect(demo.runBtn).toHaveAttribute('aria-controls', 'demo-log');
    await expect(demo.runBtn).toHaveClass(/btn/);

    // Demo array text should show the preset array
    await expect(demo.demoArrayText).toHaveText('[9, 4, 7, 1, 0, 3, 6, 2, 5]');

    // No page errors or console errors should have occurred during load
    const pageErrors = demo.pageErrors;
    const consoleErrors = demo.consoleErrors();
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition on RunDemo_Click: clicking Run demo moves to Demo Running and appends expected log lines', async () => {
    // This test validates the transition S0_Idle -> S1_DemoRunning:
    // - Clicking the button should call resetLog and start with "Demo log starting..."
    // - The log should include Initial array, Final min-heap array, and All elements extracted messages.
    // - The extracted values should appear and be in ascending order.
    // - No uncaught page errors or console errors should happen during demo run.

    // Click the Run demo button to trigger the demo
    await demo.clickRun();

    // Wait for the reset log and some expected lines to appear
    await demo.waitForLogContains('Demo log starting...');
    await demo.waitForLogContains('Initial array: [9, 4, 7, 1, 0, 3, 6, 2, 5]');
    await demo.waitForLogContains('Final min-heap array: [1, 2, 4, 3, 7, 8, 5]');
    await demo.waitForLogContains('All elements extracted in ascending order.');

    // Verify that the log contains lines that indicate swaps and heapify steps (evidence of buildMinHeapWithLog)
    const lines = await demo.logLines();
    const hasHeapifyCall = lines.some((l) => l.includes('Calling heapifyDown'));
    expect(hasHeapifyCall).toBe(true);

    // Parse the extracted min values from "Extract min = X" lines and check ascending order
    const extracted = await demo.parseExtractedValues();
    expect(extracted.length).toBeGreaterThan(0);

    // Verify ascending order
    for (let i = 1; i < extracted.length; ++i) {
      expect(extracted[i - 1]).toBeLessThanOrEqual(extracted[i]);
    }

    // Verify that final extracted sequence length matches original array size (sanity)
    expect(extracted.length).toBe(9); // preset has 9 elements

    // Confirm demo-array-text was reset to preset during run
    await expect(demo.demoArrayText).toHaveText('[9, 4, 7, 1, 0, 3, 6, 2, 5]');

    // Ensure no uncaught errors during the run
    const pageErrors = demo.pageErrors;
    const consoleErrors = demo.consoleErrors();
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Idempotency and repeated runs: re-running the demo resets the log and completes again', async () => {
    // The demo is supposed to be idempotent: re-running will reset and produce the same result.
    // This test clicks the Run demo twice and checks the log resets and reproduces final messages.

    // First run
    await demo.clickRun();
    await demo.waitForLogContains('Demo log starting...');
    await demo.waitForLogContains('Final min-heap array: [1, 2, 4, 3, 7, 8, 5]');
    await demo.waitForLogContains('All elements extracted in ascending order.');

    // Capture log snapshot after first run
    const afterFirstRun = await demo.logText();

    // Second run (should reset and produce the same core lines)
    await demo.clickRun();
    // Wait for new run's starting marker to appear again
    await demo.waitForLogContains('Demo log starting...');

    // Ensure that the log begins with the reset text and includes the final lines again
    const afterSecondRun = await demo.logText();
    expect(afterSecondRun).toContain('Demo log starting...');
    expect(afterSecondRun).toContain('Final min-heap array: [1, 2, 4, 3, 7, 8, 5]');
    expect(afterSecondRun).toContain('All elements extracted in ascending order.');

    // The content after the second run should not be identical to the content after the first run if timestamps or extra spacing differ,
    // but importantly it must contain the same essential evidence lines. For robustness, assert both snapshots contain the initial array line.
    expect(afterFirstRun).toContain('Initial array: [9, 4, 7, 1, 0, 3, 6, 2, 5]');
    expect(afterSecondRun).toContain('Initial array: [9, 4, 7, 1, 0, 3, 6, 2, 5]');

    // No uncaught errors should have occurred
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.consoleErrors().length).toBe(0);
  });

  test('Robustness: rapid multiple clicks do not cause unhandled exceptions', async () => {
    // Edge-case: simulate rapid user interactions (multiple clicks in quick succession).
    // We should observe no uncaught page errors, and at least one successful demo completion.

    // Rapidly trigger the button a few times
    await Promise.all([
      demo.clickRun(),
      demo.clickRun(),
      demo.clickRun()
    ]);

    // Wait for expected final evidence to appear at least once
    await demo.waitForLogContains('All elements extracted in ascending order.', 10000);

    // Ensure that "Beginning repeated extract-min:" is present, indicating extraction occurred
    await demo.waitForLogContains('Beginning repeated extract-min:', 5000);

    // Ensure no page errors or console errors were emitted during rapid interactions
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.consoleErrors().length).toBe(0);

    // Ensure that at least one full extraction sequence produced the expected number of extracts
    const extracted = await demo.parseExtractedValues();
    // There should be at least 9 extraction lines total across runs (one full run)
    expect(extracted.length).toBeGreaterThanOrEqual(9);
  });

  test('Log content details: validate specific swap and array-change lines from heapify logging', async () => {
    // This test inspects the textual log appended by buildMinHeapWithLog and extractAllWithLog
    // to confirm the detailed evidence lines are present and in sensible order.

    await demo.clickRun();

    // Wait for the build and final messages
    await demo.waitForLogContains('Calling heapifyDown on index 2', 5000);
    await demo.waitForLogContains('  -> array becomes: [1, 2, 4, 3, 7, 8, 5]', 5000);
    await demo.waitForLogContains('Final min-heap array: [1, 2, 4, 3, 7, 8, 5]', 5000);

    const lines = await demo.logLines();

    // Find a swap line (evidence of heapifyDown doing swaps)
    const swapLine = lines.find((l) => l.includes('swap index'));
    expect(swapLine).toBeTruthy();

    // Confirm that the 'Final min-heap' line appears after at least one 'Calling heapifyDown' line
    const idxCalling = lines.findIndex((l) => l.includes('Calling heapifyDown'));
    const idxFinal = lines.findIndex((l) => l.includes('Final min-heap array:'));
    expect(idxCalling).toBeGreaterThanOrEqual(0);
    expect(idxFinal).toBeGreaterThan(idxCalling);

    // Confirm that the 'All elements extracted in ascending order.' line is present and comes after 'Final min-heap'
    const idxExtractedAll = lines.findIndex((l) => l.includes('All elements extracted in ascending order.'));
    expect(idxExtractedAll).toBeGreaterThan(idxFinal);

    // No runtime errors occurred during this detailed run
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.consoleErrors().length).toBe(0);
  });
});