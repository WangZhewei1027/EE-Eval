import { test, expect } from '@playwright/test';

test.setTimeout(60000); // Allow time for the animated algorithm to complete

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79d3ce1-d361-11f0-8438-11a56595a476.html';

// Helper Page Object for interacting with the demo page
class DijkstraPage {
  constructor(page) {
    this.page = page;
    this.logLocator = page.locator('#log');
    this.startSelect = page.locator('#startNode');
    this.endSelect = page.locator('#endNode');
    this.runBtn = page.locator('#runBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.canvas = page.locator('#graphCanvas');
  }

  // Navigate to the app
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Return the entire log text content
  async getLogText() {
    return (await this.logLocator.textContent()) || '';
  }

  // Wait until the log contains a given substring
  async waitForLogContains(substring, opts = {}) {
    const timeout = opts.timeout ?? 30000;
    await this.page.waitForFunction(
      (sel, text) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.includes(text);
      },
      '#log',
      substring,
      { timeout }
    );
  }

  // Select start and end node values
  async selectNodes(startValue, endValue) {
    await this.startSelect.selectOption(startValue);
    await this.endSelect.selectOption(endValue);
  }

  // Click Run Dijkstra button
  async clickRun() {
    await this.runBtn.click();
  }

  // Click Reset button
  async clickReset() {
    await this.resetBtn.click();
  }

  // Get current selected values
  async getSelectedNodes() {
    const start = await this.page.evaluate(() => document.getElementById('startNode').value);
    const end = await this.page.evaluate(() => document.getElementById('endNode').value);
    return { start, end };
  }

  // Count occurrences of a substring in the log
  async countLogOccurrences(substring) {
    const text = await this.getLogText();
    if (!text) return 0;
    return text.split(substring).length - 1;
  }
}

test.describe('Dijkstra Algorithm Demo - FSM & UI Tests', () => {
  let consoleMessages;
  let pageErrors;

  // Set up console and pageerror listeners and navigate to page for each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // collect console messages for later assertions / diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // collect uncaught exceptions
      pageErrors.push(err);
    });
  });

  // Test the initial Idle state (S0_Idle) and entry actions
  test('Initial Idle State: draws graph and shows guidance text', async ({ page }) => {
    // COMMENT: Verifies onEnter actions for S0_Idle: drawGraph() and initial log text
    const app = new DijkstraPage(page);
    await app.goto();

    // the log should contain the guidance message exactly after initialization (reset() called during init)
    const initialText = await app.getLogText();
    expect(initialText).toContain('Select start and end nodes and click "Run Dijkstra" to see the shortest path and the algorithm steps.');

    // The canvas and controls must be present
    await expect(app.canvas).toBeVisible();
    await expect(app.runBtn).toBeVisible();
    await expect(app.resetBtn).toBeVisible();
    await expect(app.startSelect).toBeVisible();
    await expect(app.endSelect).toBeVisible();

    // Start and end selects should be populated and default to different nodes per implementation
    const { start, end } = await app.getSelectedNodes();
    expect(start).toBeTruthy();
    expect(end).toBeTruthy();
    // Default endSelect.selectedIndex = 1, so expect different when more than 1 node
    expect(start === end).toBe(false);

    // There should be no uncaught page errors on initialization
    expect(pageErrors.length).toBe(0);
  });

  // Test running the algorithm from a start to an end node (S0_Idle -> S1_Running -> S2_Completed)
  test('Run Dijkstra (normal path): algorithm runs and completes with shortest path and total cost', async ({ page }) => {
    // COMMENT: Tests transition S0_Idle -> S1_Running (clearLog, drawGraph) and S1_Running -> S2_Completed (Reached destination / Shortest path)
    const app = new DijkstraPage(page);
    await app.goto();

    // Choose start and end nodes known to be connected (A -> E for example)
    await app.selectNodes('A', 'E');

    // Click Run and assert the log is cleared (S1 entry action clearLog()) and algorithm starts
    await app.clickRun();

    // After clicking Run, the log should include the starting message
    await app.waitForLogContains("Starting Dijkstra's algorithm from node A to node E.");

    // As the algorithm runs step-by-step (with timeouts), wait for completion observable: "Shortest path:" output
    await app.waitForLogContains('Shortest path:');

    // Now verify the final expected outputs are present
    const finalLog = await app.getLogText();
    expect(finalLog).toContain(`Reached destination node E.`);
    expect(finalLog).toMatch(/Shortest path:\s*[A-Z0-9\-\s>]+/);
    expect(finalLog).toMatch(/Total path cost:\s*\d+/);

    // Ensure no uncaught page errors happened during execution
    expect(pageErrors.length).toBe(0);

    // Console messages should not include uncaught exceptions (we still allow normal console logs)
    const pageErrorTexts = pageErrors.map(e => e.toString()).join('\n');
    expect(pageErrorTexts).toBe('');
  });

  // Test the edge case where start and end nodes are the same
  test('Run Dijkstra when start === end: should short-circuit and display distance 0', async ({ page }) => {
    // COMMENT: Verifies the algorithm handles the "start equals end" shortcut path
    const app = new DijkstraPage(page);
    await app.goto();

    // Set the same value for start and end, pick the currently selected start value
    const { start } = await app.getSelectedNodes();
    await app.selectNodes(start, start);

    // Click Run
    await app.clickRun();

    // The UI should immediately log the "Start and end nodes are the same. Distance is 0." message
    await app.waitForLogContains('Start and end nodes are the same. Distance is 0.');

    const logText = await app.getLogText();
    expect(logText).toContain('Start and end nodes are the same. Distance is 0.');

    // After this shortcut, no runtime errors should have occurred
    expect(pageErrors.length).toBe(0);
  });

  // Test Reset behavior when idle (S0_Idle -> S3_Reset) and when running (reset should be blocked)
  test('Reset Graph behavior: reset when idle clears UI; reset while running is ignored', async ({ page }) => {
    // COMMENT: Verifies transition S0_Idle -> S3_Reset (reset action) and ensures reset is ignored when running
    const app = new DijkstraPage(page);
    await app.goto();

    // First, ensure reset when idle restores the initial guidance text
    // Modify log to ensure reset has a visible effect: click Run and then reset after completion
    await app.selectNodes('A', 'B');
    await app.clickRun();
    // Wait for the algorithm to finish by waiting for "Shortest path:" or "Reached destination"
    await app.waitForLogContains('Shortest path:');

    // Now click Reset (idle again after algorithm finished)
    await app.clickReset();

    // The log should contain the initial guidance message after reset()
    await page.waitForFunction(() => {
      const el = document.getElementById('log');
      return el && el.textContent && el.textContent.includes('Select start and end nodes and click "Run Dijkstra"');
    });

    const postResetLog = await app.getLogText();
    expect(postResetLog).toContain('Select start and end nodes and click "Run Dijkstra" to see the shortest path and the algorithm steps.');

    // Next, verify reset is ignored while algorithm is running
    // Start a new run but attempt to click reset immediately during running
    await app.selectNodes('A', 'D');
    await app.clickRun();

    // Wait for the very first starting message to confirm running state
    await app.waitForLogContains("Starting Dijkstra's algorithm from node A to node D.");

    // Immediately click reset while running (implementation should ignore if running)
    await app.clickReset();

    // The log should NOT be reverted to the initial guidance message while running.
    // Wait a short time to let any effect (if incorrectly implemented) manifest.
    await page.waitForTimeout(400);
    const duringRunLog = await app.getLogText();
    // It should still contain the "Starting Dijkstra" line and should not show the guidance line.
    expect(duringRunLog).toContain("Starting Dijkstra's algorithm from node A to node D.");
    expect(duringRunLog).not.toContain('Select start and end nodes and click "Run Dijkstra" to see the shortest path');

    // Wait for the run to finish to keep tests stable
    await app.waitForLogContains('Shortest path:');

    // Ensure no uncaught exceptions occurred
    expect(pageErrors.length).toBe(0);
  });

  // Test clicking Run twice rapidly: second click should be ignored (S1_Running re-entrant protection)
  test('Double Run Click: second click while running should be ignored', async ({ page }) => {
    // COMMENT: Validates that the Run button respects the running lock (if running is true, further clicks do nothing)
    const app = new DijkstraPage(page);
    await app.goto();

    await app.selectNodes('A', 'C');

    // Click Run twice in quick succession
    await app.clickRun();
    await app.clickRun(); // This should have no additional effect because code checks if(running) return;

    // Wait for start log and final shortest path
    await app.waitForLogContains("Starting Dijkstra's algorithm from node A to node C.");
    await app.waitForLogContains('Shortest path:');

    // Count occurrences of the starting message to ensure it occurred only once
    const startCount = await app.countLogOccurrences("Starting Dijkstra's algorithm from node A to node C.");
    expect(startCount).toBe(1);

    // Ensure no uncaught exceptions occurred
    expect(pageErrors.length).toBe(0);
  });

  // Final test: Inspect console and page error accumulation (diagnostic) and assert no unexpected runtime errors occurred
  test('No unexpected runtime exceptions thrown during interactions (diagnostic)', async ({ page }) => {
    // COMMENT: Aggregates a sequence of interactions and asserts that no uncaught exceptions were raised.
    const app = new DijkstraPage(page);
    await app.goto();

    // Perform a sequence: run, reset (after finish), run same node case
    await app.selectNodes('B', 'F');
    await app.clickRun();
    await app.waitForLogContains('Shortest path:');

    // Reset when idle
    await app.clickReset();
    await page.waitForFunction(() => {
      const el = document.getElementById('log');
      return el && el.textContent && el.textContent.includes('Select start and end nodes');
    });

    // Run shortcut case
    const { start } = await app.getSelectedNodes();
    await app.selectNodes(start, start);
    await app.clickRun();
    await app.waitForLogContains('Start and end nodes are the same. Distance is 0.');

    // At the end of these interactions, assert that no page errors were observed
    // If any page errors occurred, we include their messages to provide clearer failure output
    if (pageErrors.length > 0) {
      const errorMessages = pageErrors.map(e => e.message || e.toString()).join('\n---\n');
      // Fail with debug info
      throw new Error(`Unexpected page errors detected:\n${errorMessages}`);
    }

    // Also assert console did not contain any 'error' type messages (diagnostic)
    const errorConsoleEntries = consoleMessages.filter(c => c.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
  });
});