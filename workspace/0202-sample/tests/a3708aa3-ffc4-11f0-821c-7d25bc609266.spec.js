import { test, expect } from '@playwright/test';

// Test file: a3708aa3-ffc4-11f0-821c-7d25bc609266.spec.js
// This suite validates the interactive "Understanding Weighted Graphs" demo
// It follows the FSM states: S0_Idle -> S1_DemoRunning -> S2_DemoCompleted
// It also observes console messages and page errors without modifying the page runtime.

// Page Object Model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#runDemoBtn');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    // Navigate to the provided HTML page exactly as specified
    await this.page.goto('http://127.0.0.1:5500/workspace/0202-sample/html/a3708aa3-ffc4-11f0-821c-7d25bc609266.html', {
      waitUntil: 'domcontentloaded'
    });
  }

  async clickRun() {
    await this.runButton.click();
  }

  async getOutputText() {
    return await this.output.textContent();
  }
}

test.describe('Weighted Graph Demo - FSM state and transition tests', () => {
  // Arrays to collect runtime issues for assertions
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  // Attach listeners before each test to observe console and page errors naturally
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions (ReferenceError, TypeError, SyntaxError, etc.) if they happen
      pageErrors.push(err);
    });
  });

  // Sanity test: initial page render (S0_Idle)
  test('S0_Idle: Initial render shows Run button and empty demo output with correct ARIA attributes', async ({ page }) => {
    const demo = new DemoPage(page);
    // Navigate to the page exactly as-is
    await demo.goto();

    // Validate the Run button is visible and has expected text
    await expect(demo.runButton).toBeVisible();
    await expect(demo.runButton).toHaveText('Run Shortest Path Demo from Node A');

    // Validate the demo output region exists and is initially empty
    await expect(demo.output).toBeVisible();
    const text = (await demo.getOutputText()) || '';
    expect(text.trim()).toBe('', 'Expected demo output to be empty in Idle state (S0_Idle)');

    // Verify ARIA and role attributes as described in the FSM components
    await expect(demo.output).toHaveAttribute('aria-live', 'polite');
    await expect(demo.output).toHaveAttribute('role', 'region');

    // Ensure no unexpected runtime errors occurred during initial load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test transition: clicking the button should enter Demo Running state (S1_DemoRunning)
  test('Transition S0_Idle -> S1_DemoRunning: Clicking Run sets immediate "Running Dijkstra\'s algorithm..." message', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Click the run button to trigger the demo (RunDemo event)
    await demo.clickRun();

    // Immediately after click, verify the demoOutput shows the running message (S1 entry action)
    const outputAfterClick = await demo.getOutputText();
    expect(outputAfterClick).toBeTruthy();
    expect(outputAfterClick).toContain("Running Dijkstra's algorithm...", 'Demo should indicate it started running immediately (S1_DemoRunning evidence)');

    // Confirm that the "running" message is present at the start of the output
    expect(outputAfterClick.startsWith("Running Dijkstra's algorithm...")).toBe(true);

    // No uncaught exceptions are expected at this stage
    expect(pageErrors.length).toBe(0, `No page errors expected on entering Demo Running; observed: ${pageErrors.map(e => e.toString()).join('; ')}`);
    expect(consoleErrors.length).toBe(0, `No console.error expected on entering Demo Running; observed: ${consoleErrors.join('; ')}`);
  });

  // Test the full transition to Demo Completed (S2_DemoCompleted) and validate final results
  test('Transition S1_DemoRunning -> S2_DemoCompleted: Demo completes and displays final shortest paths and distances', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Trigger the demo
    await demo.clickRun();

    // Wait for the final expected observable text to appear in the demoOutput
    // The script uses a 200ms setTimeout; give generous timeout for slower environments
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.textContent && el.textContent.includes('Final shortest paths and distances from A:');
    }, { timeout: 5000 });

    // Grab the final text
    const finalText = (await demo.getOutputText()) || '';
    expect(finalText).toContain('Final shortest paths and distances from A:', 'Final state (S2_DemoCompleted) should include the summary header');

    // Validate that distances and paths for all four nodes (A,B,C,D) are present and correct
    // The expected results from the Dijkstra implementation in the page:
    // A: Distance = 0, Path = A
    // B: Distance = 5, Path = A → B
    // C: Distance = 9, Path = A → B → D → C
    // D: Distance = 8, Path = A → B → D
    expect(finalText).toContain(' - A: Distance = 0, Path = A');
    expect(finalText).toContain(' - B: Distance = 5, Path = A → B');
    expect(finalText).toContain(' - C: Distance = 9, Path = A → B → D → C');
    expect(finalText).toContain(' - D: Distance = 8, Path = A → B → D');

    // Verify there is no residual "Running Dijkstra's algorithm..." prefix left in final output
    expect(finalText.startsWith("Running Dijkstra's algorithm...")).toBe(false);

    // Check that no runtime errors were thrown while running/completing the demo
    expect(pageErrors.length).toBe(0, `No page errors expected during completion; observed: ${pageErrors.map(e => e.toString()).join('; ')}`);
    expect(consoleErrors.length).toBe(0, `No console.error expected during completion; observed: ${consoleErrors.join('; ')}`);
  });

  // Edge case: clicking multiple times rapidly should always reset to Running then complete with final results
  test('Edge case: Multiple quick clicks reset output to Running and still produce final results', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Rapidly click the Run button three times
    await demo.clickRun();
    // Click again immediately before completion
    await demo.clickRun();
    await demo.clickRun();

    // Immediately after clicks, latest state should show Running message
    const immediateText = await demo.getOutputText();
    expect(immediateText).toContain("Running Dijkstra's algorithm...");
    expect(immediateText.startsWith("Running Dijkstra's algorithm...")).toBe(true);

    // Wait for demo to complete (final text)
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.textContent && el.textContent.includes('Final shortest paths and distances from A:');
    }, { timeout: 5000 });

    const finalText = (await demo.getOutputText()) || '';
    // Validate final results still present and correct after multiple clicks
    expect(finalText).toContain('Final shortest paths and distances from A:');
    expect(finalText).toContain(' - B: Distance = 5, Path = A → B');

    // No uncaught exceptions should have been thrown as a result of multiple clicks
    expect(pageErrors.length).toBe(0, `No page errors expected after multiple clicks; observed: ${pageErrors.map(e => e.toString()).join('; ')}`);
    expect(consoleErrors.length).toBe(0, `No console.error expected after multiple clicks; observed: ${consoleErrors.join('; ')}`);
  });

  // Observability test: confirm there's no unexpected ReferenceError/SyntaxError/TypeError
  test('Runtime observability: Ensure no ReferenceError, SyntaxError, or TypeError occurred during page usage', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Perform a normal run to trigger the algorithm (to potentially reveal runtime issues)
    await demo.clickRun();
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.textContent && el.textContent.includes('Final shortest paths and distances from A:');
    }, { timeout: 5000 });

    // Assert that no page errors were observed
    // If any pageErrors are present, they will be instances of Error; check their names/text for the specific error types
    const errorNames = pageErrors.map(err => (err && err.name) ? err.name : String(err));
    expect(errorNames).not.toContain('ReferenceError', 'No ReferenceError should be thrown by the page runtime');
    expect(errorNames).not.toContain('SyntaxError', 'No SyntaxError should be thrown by the page runtime');
    expect(errorNames).not.toContain('TypeError', 'No TypeError should be thrown by the page runtime');

    // Also scan console.error messages for mention of these error types
    const consoleErrorText = consoleErrors.join('\n');
    expect(consoleErrorText).not.toContain('ReferenceError');
    expect(consoleErrorText).not.toContain('SyntaxError');
    expect(consoleErrorText).not.toContain('TypeError');

    // Final sanity: assert that there are simply zero pageErrors and zero consoleErrors
    expect(pageErrors.length).toBe(0, `Expected zero uncaught page errors; observed ${pageErrors.length}`);
    expect(consoleErrors.length).toBe(0, `Expected zero console.error messages; observed ${consoleErrors.length}`);
  });

  // Verify some static content is present (not altering runtime) to ensure the page content is intact
  test('Static content sanity: page contains explanation headings and example adjacency matrix', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Confirm presence of main heading and a table (adjacency matrix) included in the static HTML
    await expect(page.locator('h1')).toHaveText(/Understanding Weighted Graphs/i);
    await expect(page.locator('table')).toBeVisible();
    // Check the example block exists
    await expect(page.locator('.example')).toBeVisible();

    // No runtime errors introduced by static inspection
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});