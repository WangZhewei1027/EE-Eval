import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a333172-ffc5-11f0-8b43-1ffa87931c43.html';

// Page Object for the Dijkstra visualization page
class DijkstraPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startNode = '#startNode';
    this.endNode = '#endNode';
    this.startBtn = '#startBtn';
    this.resetBtn = '#resetBtn';
    this.log = '#log';
    this.canvas = '#graphCanvas';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getStartBtnDisabled() {
    return await this.page.$eval(this.startBtn, (b) => b.disabled);
  }

  async getResetBtnDisabled() {
    return await this.page.$eval(this.resetBtn, (b) => b.disabled);
  }

  async getStartOptions() {
    return await this.page.$$eval(`${this.startNode} option`, (opts) =>
      opts.map((o) => ({ value: o.value, text: o.textContent }))
    );
  }

  async getEndOptions() {
    return await this.page.$$eval(`${this.endNode} option`, (opts) =>
      opts.map((o) => ({ value: o.value, text: o.textContent }))
    );
  }

  async selectStart(value) {
    await this.page.selectOption(this.startNode, value);
  }

  async selectEnd(value) {
    await this.page.selectOption(this.endNode, value);
  }

  async clickStart() {
    await Promise.all([
      this.page.waitForTimeout(0), // yield to allow dialog event handlers to attach in tests
      this.page.click(this.startBtn),
    ]);
  }

  async clickReset() {
    await this.page.click(this.resetBtn);
  }

  async getLogText() {
    return await this.page.$eval(this.log, (el) => el.textContent);
  }

  async isCanvasPresent() {
    return await this.page.$(this.canvas) !== null;
  }

  // Utility to clear start select to empty string (simulate no selection)
  async clearStartSelection() {
    await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.value = '';
    }, this.startNode);
  }
}

test.describe('Dijkstra Visualization - FSM & UI tests', () => {
  // Keep references to console errors and page errors per test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('Initial State (S0_Idle) - UI elements and resetState() on init', async ({ page }) => {
    // This test validates the initial Idle state (S0_Idle).
    // It checks that resetState() ran on init (start enabled, reset disabled),
    // that the selects were populated, canvas is present, and no console/page errors occurred.
    const d = new DijkstraPage(page);
    await d.goto();

    // Basic UI presence
    expect(await d.isCanvasPresent()).toBe(true);

    // startBtn should be enabled (resetState enables start)
    expect(await d.getStartBtnDisabled()).toBe(false);

    // resetBtn should be disabled by resetState()
    expect(await d.getResetBtnDisabled()).toBe(true);

    // startNode should have 8 options (nodes A-H)
    const startOptions = await d.getStartOptions();
    expect(startOptions.length).toBe(8);
    const ids = startOptions.map((o) => o.value).sort();
    expect(ids).toEqual(['A','B','C','D','E','F','G','H'].sort());

    // endNode should have 9 options (None + 8 nodes)
    const endOptions = await d.getEndOptions();
    expect(endOptions.length).toBe(9);
    expect(endOptions[0].value).toBe(''); // first option is None

    // The visible log should be empty due to resetState() clearing it during init
    const logText = await d.getLogText();
    // It may be an empty string; assert it does not contain the initial <em> placeholder text
    expect(logText).not.toContain('Algorithm log will appear here');

    // Ensure no console or page errors occurred during initial load
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Start Algorithm transition S0_Idle -> S1_AlgorithmRunning and reach target -> S2_AlgorithmComplete', async ({ page }) => {
    // This test validates the StartAlgorithm event triggers the algorithm to run (AlgorithmRunning),
    // and the algorithm reaches the target node producing "Reached target node X. Algorithm complete."
    // It also checks visual button state changes (start disabled while running, reset enabled),
    // and ensures no console/page errors emitted.
    const d = new DijkstraPage(page);
    await d.goto();

    // Select start A and end B (adjacent: should finish quickly)
    await d.selectStart('A');
    await d.selectEnd('B');

    // Wait for the in-page log message "Starting at node: A"
    await Promise.all([
      page.waitForFunction(
        (sel) => document.querySelector(sel) && document.querySelector(sel).textContent.includes('Starting at node: A'),
        {},
        d.log
      ),
      d.clickStart(),
    ]);

    // After starting, startBtn should be disabled and resetBtn enabled (algorithm running)
    // (Allow a tick for DOM update)
    await page.waitForTimeout(200);
    expect(await d.getStartBtnDisabled()).toBe(true);
    expect(await d.getResetBtnDisabled()).toBe(false);

    // Wait for algorithm to reach the target B and finish (the implementation logs a combined message)
    // The completion message is logged when current node === endId:
    await page.waitForFunction(
      (sel) => document.querySelector(sel) && document.querySelector(sel).textContent.includes('Reached target node B. Algorithm complete.'),
      {},
      d.log
    );

    const finalLog = await d.getLogText();
    expect(finalLog).toContain('Starting at node: A');
    expect(finalLog).toContain('Processing node');
    expect(finalLog).toContain('Reached target node B. Algorithm complete.');

    // After completion via target node, startBtn remains disabled until reset
    expect(await d.getStartBtnDisabled()).toBe(true);

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  }, 30000); // extended timeout to allow for interval-based animation

  test('Reset Algorithm returns to Idle (S2 -> S0_Idle) and clears log', async ({ page }) => {
    // This test verifies the ResetAlgorithm event returns the app to Idle:
    // resetBtn re-enables/disables controls appropriately and clears the log.
    const d = new DijkstraPage(page);
    await d.goto();

    // Start and let it reach target quickly (A -> B) to enable reset button
    await d.selectStart('A');
    await d.selectEnd('B');

    // Start
    await d.clickStart();

    // Wait until resetBtn becomes enabled
    await page.waitForFunction((sel) => !document.querySelector(sel).disabled, {}, d.resetBtn);

    // Click reset
    await d.clickReset();

    // After reset, start button should be enabled and reset disabled
    expect(await d.getStartBtnDisabled()).toBe(false);
    expect(await d.getResetBtnDisabled()).toBe(true);

    // Log should be cleared by resetState()
    const afterResetLog = await d.getLogText();
    expect(afterResetLog.trim()).toBe('');

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  }, 20000);

  test('Edge case: selecting same start and end shows alert and prevents start', async ({ page }) => {
    // This test validates the UI handles the invalid case where start === end using an alert dialog,
    // and that the algorithm does not start in that scenario.
    const d = new DijkstraPage(page);
    await d.goto();

    // Choose the same node for start and end
    await d.selectStart('C');
    await d.selectEnd('C');

    // Listen for dialog and capture its message
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    // Click start - should trigger alert and not start algorithm
    await d.clickStart();

    // Ensure an alert dialog was shown with the expected text
    await page.waitForTimeout(200); // small wait to ensure dialog event processed
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0]).toBe('Start node and end node must be different.');

    // Ensure algorithm didn't start: startBtn should still be enabled and reset still disabled
    expect(await d.getStartBtnDisabled()).toBe(false);
    expect(await d.getResetBtnDisabled()).toBe(true);

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Edge case: clicking start with no start selected shows alert and does not start', async ({ page }) => {
    // This test simulates the case where no start node is selected (startId falsy),
    // expecting an alert "Please select a start node." and no algorithm start.
    const d = new DijkstraPage(page);
    await d.goto();

    // Clear start selection to simulate no selection
    await d.clearStartSelection();

    // Capture dialog
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    // Click start - should show alert and not start
    await d.clickStart();

    // Give time for alert to appear/handler to run
    await page.waitForTimeout(200);

    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0]).toBe('Please select a start node.');

    // Ensure algorithm didn't start (buttons unchanged)
    expect(await d.getStartBtnDisabled()).toBe(false);
    expect(await d.getResetBtnDisabled()).toBe(true);

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Algorithm runs to completion without end node (processes entire graph) and logs Algorithm complete.', async ({ page }) => {
    // This test starts the algorithm with no end node selected (endId null)
    // and verifies that it runs to completion logging 'Algorithm complete.' and then disables start.
    // This will process the entire graph; allow extra time for interval ticks.
    const d = new DijkstraPage(page);
    await d.goto();

    // Select start A and ensure end is 'None' (empty string)
    await d.selectStart('A');
    await d.selectEnd(''); // None

    // Start algorithm
    await d.clickStart();

    // Wait for the final 'Algorithm complete.' log (when queue becomes empty)
    await page.waitForFunction(
      (sel) => document.querySelector(sel) && document.querySelector(sel).textContent.includes('Algorithm complete.'),
      {},
      d.log
    , { timeout: 30000 });

    const finalLog = await d.getLogText();
    expect(finalLog).toContain('Starting at node: A');
    expect(finalLog).toContain('Algorithm complete.');

    // After full completion, the start button remains disabled until reset
    expect(await d.getStartBtnDisabled()).toBe(true);

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  }, 35000); // longer timeout for full run
});