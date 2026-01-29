import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf4591-fa79-11f0-8075-e54a10595dde.html';

// Page object for the A* Search Visualization page
class AStarPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      start: '#start',
      goal: '#goal',
      heuristic: '#heuristic',
      runButton: '#runAStar',
      resetButton: '#reset',
      output: '#output'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getStart() {
    return (await this.page.locator(this.selectors.start).inputValue()).toString();
  }

  async setStart(value) {
    await this.page.fill(this.selectors.start, '');
    await this.page.type(this.selectors.start, value);
  }

  async getGoal() {
    return (await this.page.locator(this.selectors.goal).inputValue()).toString();
  }

  async setGoal(value) {
    await this.page.fill(this.selectors.goal, '');
    await this.page.type(this.selectors.goal, value);
  }

  async getHeuristic() {
    return (await this.page.locator(this.selectors.heuristic).inputValue()).toString();
  }

  async setHeuristic(value) {
    await this.page.fill(this.selectors.heuristic, '');
    await this.page.type(this.selectors.heuristic, value);
  }

  async clickRun() {
    await this.page.click(this.selectors.runButton);
  }

  async clickReset() {
    await this.page.click(this.selectors.resetButton);
  }

  async getOutputText() {
    return (await this.page.locator(this.selectors.output).innerText()).toString();
  }

  async runAStarAndWaitForOutput(timeout = 1000) {
    // Click run and wait until output is non-empty or timeout elapses.
    await this.clickRun();
    try {
      await this.page.waitForFunction(
        (selector) => {
          const el = document.querySelector(selector);
          return el && el.innerText && el.innerText.trim().length > 0;
        },
        this.selectors.output,
        { timeout }
      );
    } catch (e) {
      // swallow; caller can inspect output or page errors
    }
    return this.getOutputText();
  }

  async hasRunHandler() {
    return this.page.evaluate(() => {
      const el = document.getElementById('runAStar');
      return !!(el && typeof el.onclick === 'function');
    });
  }

  async hasResetHandler() {
    return this.page.evaluate(() => {
      const el = document.getElementById('reset');
      return !!(el && typeof el.onclick === 'function');
    });
  }
}

test.describe('A* Search Visualization - FSM and interactions (99cf4591-fa79-11f0-8075-e54a10595dde)', () => {
  // Collect console and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture unhandled exceptions / runtime errors on the page
    page.on('pageerror', (err) => {
      // err is a JS Error from the page context
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // No global teardown required beyond Playwright's automatic cleanup,
    // but keeping this hook makes it explicit.
  });

  test('S0_Idle - Initial render: controls visible, defaults set, no runtime errors on load', async ({ page }) => {
    const app = new AStarPage(page);
    await app.goto();

    // Verify inputs and buttons exist and have expected default values
    await expect(page.locator('#start')).toBeVisible();
    await expect(page.locator('#goal')).toBeVisible();
    await expect(page.locator('#heuristic')).toBeVisible();
    await expect(page.locator('#runAStar')).toBeVisible();
    await expect(page.locator('#reset')).toBeVisible();
    await expect(page.locator('#output')).toBeVisible();

    expect(await app.getStart()).toBe('A'); // start default as per FSM and HTML
    expect(await app.getGoal()).toBe('E'); // goal default
    expect(await app.getHeuristic()).toBe('1,2,3,1,0'); // heuristic default
    expect(await app.getOutputText()).toBe(''); // output should be empty at idle

    // Verify that event handlers are attached to buttons (evidence in FSM)
    expect(await app.hasRunHandler()).toBe(true);
    expect(await app.hasResetHandler()).toBe(true);

    // There should be no page errors just from initial load
    expect(pageErrors.length).toBe(0);

    // No console.error messages on load
    const errorConsole = consoleMessages.filter((c) => c.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('S1_Searching -> S3_PathFound - Running A* with default inputs produces a path', async ({ page }) => {
    const app = new AStarPage(page);
    await app.goto();

    // Run A* and wait for output to appear
    const output = await app.runAStarAndWaitForOutput(2000);

    // Validate the output contains the expected "Path found:" message
    expect(output.startsWith('Path found:')).toBe(true);

    // Should contain '->' separators for path nodes
    expect(output).toContain('->');

    // Ensure the output lists nodes (at least includes start and goal)
    expect(output).toContain('A');
    expect(output).toContain('E');

    // For the normal successful run, no runtime page errors should have occurred
    expect(pageErrors.length).toBe(0);

    // Also ensure console did not record errors during successful run
    const errorConsole = consoleMessages.filter((c) => c.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('S1_Searching -> S2_NoPath (edge-case) - Running A* with an invalid start triggers a runtime error', async ({ page }) => {
    const app = new AStarPage(page);
    await app.goto();

    // Intentionally set a start node that does not exist in the graph (to exercise runtime failure)
    // We do NOT modify page code; we invoke the application as-is and allow natural errors to occur.
    await app.setStart('Z');

    // Ensure heuristic still matches node count to avoid the heuristic length early-return
    await app.setHeuristic('1,2,3,1,0');

    // Clear any previously collected errors/messages so we only observe those produced by this action
    consoleMessages = [];
    pageErrors = [];

    // Click run; this is expected to produce a runtime error because graph['Z'] is undefined
    // Capture the pageerror (unhandled exception)
    await app.clickRun();

    // Wait briefly to allow any pageerror to be emitted
    await page.waitForTimeout(250);

    // We expect at least one page error to have been captured
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Inspect the first captured error - it should be a TypeError or similar from trying to iterate graph[Z]
    const firstErr = pageErrors[0];
    expect(firstErr).toBeInstanceOf(Error);

    // Message should reference inability to read properties of undefined OR graph
    // We avoid exact string match because engines differ; assert that some indicative keywords are present
    const msg = firstErr.message || '';
    const indicative = ['undefined', 'graph', 'cannot', 'Cannot', 'reading', 'of undefined', 'cannot read'];
    const hasIndicative = indicative.some((keyword) => msg.includes(keyword));
    expect(hasIndicative).toBe(true);

    // After the runtime error, the output should not contain a normal "Path found:" or the heuristic error message.
    const outputAfterError = await app.getOutputText();
    expect(outputAfterError).not.toContain('Path found:');
    expect(outputAfterError).not.toContain('Error: Heuristic weights must match number of nodes.');
  });

  test('Edge case - Heuristic mismatch shows a user-facing error message and no runtime exception', async ({ page }) => {
    const app = new AStarPage(page);
    await app.goto();

    // Provide an incorrect number of heuristic weights to trigger the length-check error
    await app.setHeuristic('1,2'); // wrong length

    // Clear previous errors
    consoleMessages = [];
    pageErrors = [];

    await app.clickRun();

    // Wait for the output to update
    await page.waitForTimeout(250);

    const output = await app.getOutputText();
    expect(output).toBe('Error: Heuristic weights must match number of nodes.');

    // This scenario should not throw page runtime errors - app handles it gracefully
    expect(pageErrors.length).toBe(0);

    // No console.error entries for this handled validation
    const errorConsole = consoleMessages.filter((c) => c.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Transition: ResetClick - Reset restores defaults and clears output (from non-idle state)', async ({ page }) => {
    const app = new AStarPage(page);
    await app.goto();

    // Modify inputs and run to produce output
    await app.setStart('B');
    await app.setGoal('D');
    await app.setHeuristic('1,2,3,1,0');

    // Run to ensure output is populated
    await app.runAStarAndWaitForOutput(2000);
    const outputBeforeReset = await app.getOutputText();
    expect(outputBeforeReset.length).toBeGreaterThan(0);

    // Click reset and validate fields restored to defaults
    await app.clickReset();

    // Wait a bit for reset to take effect
    await page.waitForTimeout(100);

    expect(await app.getStart()).toBe('A');
    expect(await app.getGoal()).toBe('E');
    expect(await app.getHeuristic()).toBe('1,2,3,1,0');
    expect(await app.getOutputText()).toBe('');
  });

  test('Repeated interactions: Running multiple times is stable and does not produce errors', async ({ page }) => {
    const app = new AStarPage(page);
    await app.goto();

    consoleMessages = [];
    pageErrors = [];

    // Run multiple times in succession
    for (let i = 0; i < 3; i++) {
      await app.clickRun();
      // Wait for output to appear/settle
      await page.waitForTimeout(200);
      const out = await app.getOutputText();
      expect(out.startsWith('Path found:')).toBe(true);
    }

    // Ensure repeated runs did not generate runtime errors
    expect(pageErrors.length).toBe(0);

    const errorConsole = consoleMessages.filter((c) => c.type === 'error');
    expect(errorConsole.length).toBe(0);
  });
});