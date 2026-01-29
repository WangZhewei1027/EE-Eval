import { test, expect } from '@playwright/test';

class DemoPage {
  /**
   * Page object for the ternary search demo.
   * Encapsulates interactions and common assertions.
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#run');
    this.output = page.locator('#out');
  }

  async goto(url) {
    await this.page.goto(url);
  }

  async clickRun() {
    await this.runButton.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  /**
   * Wait until the output contains the provided substring.
   * Uses page.waitForFunction to poll the DOM directly.
   */
  async waitForOutputContains(substring, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.indexOf(substr) !== -1;
      },
      ['#out', substring],
      { timeout }
    );
  }

  /**
   * Wait until output contains the finished marker "Finished after".
   */
  async waitForFinished(timeout = 5000) {
    await this.waitForOutputContains('Finished after', timeout);
  }
}

test.describe('Ternary Search Demo - FSM validation (d83579b1-fa7b-11f0-b314-ad8654ee5de8)', () => {
  const url =
    'http://127.0.0.1:5500/workspace/0126-biased/html/d83579b1-fa7b-11f0-b314-ad8654ee5de8.html';

  // Collect console messages and page errors for assertions across tests.
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Observe console messages
    page.on('console', (msg) => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // ignore any unexpected local inspection errors
      }
    });

    // Observe page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('Initial state S0_Idle: page renders and shows idle message', async ({ page }) => {
    // This test validates the initial "Idle" state entry action (renderPage())
    // and the presence of the initial console text described in the FSM evidence.
    const demo = new DemoPage(page);
    await demo.goto(url);

    // Verify the Run demo button exists and is visible
    await expect(demo.runButton).toBeVisible();
    await expect(demo.runButton).toHaveText('Run demo');

    // Verify the out console contains the initial idle hint text
    const outText = await demo.getOutputText();
    expect(outText).toContain('Press "Run demo" to start. Output will appear here.');

    // Ensure no unexpected page errors occurred on initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_RunningDemo on click: output cleared, iteration logs and final result produced', async ({ page }) => {
    // This test validates the RunDemo_Click event and the S1 running demo behavior:
    // - out is cleared when click handler begins
    // - starting log messages are present
    // - iteration logs are emitted
    // - final summary ("Finished after", "Approximate maximum", "True maximum") present
    const demo = new DemoPage(page);
    await demo.goto(url);

    // Capture the initial output before clicking
    const initialOut = await demo.getOutputText();
    expect(initialOut).toContain('Press "Run demo" to start. Output will appear here.');

    // Click the Run demo button to start the demonstration
    await demo.clickRun();

    // Immediately after clicking, the script clears out.textContent = "";
    // The page code then appends logs synchronously. Wait for the "Starting ternary search" line to appear.
    await demo.waitForOutputContains('Starting ternary search on f(x) = -(x-2)^2 + 3');

    // Confirm the initial interval log (exact formatting expected by FSM evidence)
    await demo.waitForOutputContains('Initial interval: [-5.0000, 10.0000]');

    // Confirm at least one iteration log appears
    await demo.waitForOutputContains('iter 1:');

    // Wait until the run finishes and the final "Finished after" line appears
    await demo.waitForFinished(10000);

    // Read the entire output and perform assertions on contents and numeric results
    const fullOut = await demo.getOutputText();

    // It should not contain the original idle message anymore (clicked cleared it)
    expect(fullOut).not.toContain('Press "Run demo" to start. Output will appear here.');

    // It must contain iteration traces and the finished summary
    expect(fullOut).toContain('Finished after');
    expect(fullOut).toContain('Approximate maximum at x ≈');
    expect(fullOut).toContain('True maximum is at x = 2, f = 3');

    // Extract the approximate x and f values from the output and assert they are close to true values
    const approxMatch = fullOut.match(/Approximate maximum at x ≈\s*([0-9eE\+\-\.]+), f ≈\s*([0-9eE\+\-\.]+)/);
    expect(approxMatch).not.toBeNull();

    if (approxMatch) {
      const approxX = parseFloat(approxMatch[1]);
      const approxF = parseFloat(approxMatch[2]);
      // The approximation should be close to the true max x=2 and f=3 within a reasonable tolerance
      expect(Math.abs(approxX - 2)).toBeLessThan(1e-3);
      expect(Math.abs(approxF - 3)).toBeLessThan(1e-3);
    }

    // Ensure no page errors (uncaught exceptions) were produced during the run
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1_RunningDemo -> S1_RunningDemo (re-run): clicking again clears previous output and repeats demo', async ({ page }) => {
    // This test validates that clicking "Run demo" while already in the demo (or re-running) behaves as expected:
    // - previous output exists after first run
    // - clicking again clears previous output (out becomes empty initially in handler)
    // - new output begins with "Starting ternary search..." and completes
    const demo = new DemoPage(page);
    await demo.goto(url);

    // Run the demo once
    await demo.clickRun();
    await demo.waitForFinished(10000);
    const firstRunOutput = await demo.getOutputText();
    expect(firstRunOutput).toContain('Finished after');

    // Now click "Run demo" again to trigger the S1->S1 transition per FSM
    // Before clicking, ensure there is substantial output to be cleared
    expect(firstRunOutput.length).toBeGreaterThan(30);

    // Click again
    await demo.clickRun();

    // Immediately after clicking, the page's handler sets out.textContent = "";
    // We verify that the previous output content is not present in the fresh output.
    // Wait for the new "Starting ternary search" to confirm the second run started.
    await demo.waitForOutputContains('Starting ternary search on f(x) = -(x-2)^2 + 3', 10000);

    const secondRunOutputStart = await demo.getOutputText();

    // The fresh output should start with the starting logs and should not contain the trailing lines from the first run
    expect(secondRunOutputStart).toContain('Starting ternary search on f(x) = -(x-2)^2 + 3');
    // It should not still include the "True maximum is at x = 2, f = 3" from the previous run as the content was cleared first
    // (It will reappear later when the second run finishes.)
    expect(secondRunOutputStart).not.toContain('True maximum is at x = 2, f = 3');

    // Wait for the second run to finish
    await demo.waitForFinished(10000);
    const secondRunFull = await demo.getOutputText();
    expect(secondRunFull).toContain('Finished after');
    expect(secondRunFull).toContain('Approximate maximum at x ≈');

    // Ensure both runs did not produce uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases and error observation: rapid clicks and console/page error monitoring', async ({ page }) => {
    // This test observes console messages and page errors while performing a few quick interactions.
    // It asserts that the page does not produce unexpected runtime errors (no ReferenceError/SyntaxError/TypeError).
    const demo = new DemoPage(page);
    await demo.goto(url);

    // Rapidly trigger the demo a few times in succession.
    // The page code runs synchronously so clicks will effectively be processed sequentially.
    await demo.clickRun();
    // While it is running (synchronously), clicks will be queued by the browser, but we still attempt a couple more.
    // This verifies the app is resilient to repeated clicks and doesn't throw.
    await demo.clickRun();
    await demo.clickRun();

    // Wait for the last run to finish
    await demo.waitForFinished(15000);

    // Collect a snapshot of console messages (informational for test debugging)
    // We don't assert on specific console outputs because the page's log function writes to DOM not console,
    // but we do assert there were no page errors (uncaught exceptions).
    // Print a minimal expectation: console messages array is an Array (may be empty).
    expect(Array.isArray(consoleMessages)).toBe(true);

    // Assert no uncaught page errors occurred during rapid interactions
    expect(pageErrors.length).toBe(0);
  });
});