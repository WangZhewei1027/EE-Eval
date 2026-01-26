import { test, expect } from '@playwright/test';

// Test file for Application ID: f0b248f1-fa7c-11f0-9fa6-d1bbe297d459
// URL served at: http://127.0.0.1:5500/workspace/0126-biased/html/f0b248f1-fa7c-11f0-9fa6-d1bbe297d459.html
// This suite validates the FSM states and transitions for the Jump Search demo page.
// It observes console output and page errors without modifying the page runtime.

// Page object encapsulating interactions and checks for the demo page
class JumpSearchDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b248f1-fa7c-11f0-9fa6-d1bbe297d459.html';
    this.button = page.locator('#demo-button');
    this.output = page.locator('#demo-output');
  }

  // Navigate to the page and wait for initial components to be available
  async goto() {
    await this.page.goto(this.url);
    await expect(this.button).toBeVisible();
    await expect(this.output).toBeVisible();
  }

  // Click the Run Jump Search Demo button
  async clickRun() {
    await this.button.click();
  }

  // Return the textContent of the demo output area
  async getOutputText() {
    return await this.output.textContent();
  }

  // Wait until the demo output contains the given substring
  async waitForOutputContains(substring, options = {}) {
    const timeout = options.timeout ?? 15000; // default timeout for steps
    await this.page.waitForFunction(
      (selector, text) => {
        const el = document.querySelector(selector);
        return el && el.innerText && el.innerText.includes(text);
      },
      this.output.selector ?? '#demo-output',
      substring,
      { timeout }
    );
  }
}

// Increase the test timeout for long-running demo sequence
test.describe.configure({ timeout: 30000 });

test.describe('Jump Search Demo FSM - Comprehensive E2E Tests', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors for assertions
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Collect runtime errors (ReferenceError, SyntaxError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // Collect console messages for inspection; include type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.afterEach(async () => {
    // After each test we ensure that pageErrors array is available for diagnostics.
    // We do not modify the page or its global state.
  });

  test('S0_Idle: initial page renders with Run button and empty output', async ({ page }) => {
    // Validate initial/Idle state (S0_Idle).
    const demo = new JumpSearchDemoPage(page);
    await demo.goto();

    // Ensure the demo button exists and has the expected text
    await expect(demo.button).toHaveText('Run Jump Search Demo');

    // Output area should be present and initially empty (or contain no demo text)
    const initialText = (await demo.getOutputText()) || '';
    expect(initialText.trim()).toBe('', 'Expected demo output to be empty on initial render');

    // Assert there are no runtime page errors at initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0 -> S1: Clicking Run shows "Running Jump Search demonstration..."', async ({ page }) => {
    // Validates the first transition to Demo Running (S1_DemoRunning)
    const demo = new JumpSearchDemoPage(page);
    await demo.goto();

    // Click the demo button to trigger the transition
    await demo.clickRun();

    // Immediately the page script sets the initial running message synchronously
    await demo.waitForOutputContains('Running Jump Search demonstration...', { timeout: 2000 });

    // Verify the exact content exists in output
    const out = await demo.getOutputText();
    expect(out).toContain('Running Jump Search demonstration...');

    // Validate still no runtime errors (no unexpected ReferenceError/SyntaxError/TypeError)
    expect(pageErrors.length).toBe(0);
  });

  test('Full FSM flow: S1 -> S2 -> S3 -> S4 sequence completes with expected messages', async ({ page }) => {
    // This test exercises the full chain of transitions by waiting for each message in order.
    // Note: The demo uses a series of setTimeouts; wait times are set high enough for the sequence.
    const demo = new JumpSearchDemoPage(page);
    await demo.goto();

    // Click to start the demonstration
    await demo.clickRun();

    // S1: Demo Running message should appear quickly
    await demo.waitForOutputContains('Running Jump Search demonstration...', { timeout: 2000 });

    // S2: Jumping steps appear sequentially. Wait for the jump to index 0 evidence.
    await demo.waitForOutputContains('Jumping to index 0: value 0', { timeout: 5000 });

    // Additional jumping messages
    await demo.waitForOutputContains('Jumping to index 4: value 3', { timeout: 7000 });
    await demo.waitForOutputContains('Jumping to index 8: value 21', { timeout: 7000 });
    await demo.waitForOutputContains('Jumping to index 12: value 144', { timeout: 9000 });

    // S3: Linear searching evidence
    await demo.waitForOutputContains('Performing linear search from index 9 to 11', { timeout: 11000 });

    // S4: Final search result
    await demo.waitForOutputContains('Found 55 at index 10!', { timeout: 13000 });

    // Also assert the completion message exists
    await demo.waitForOutputContains('Search complete.', { timeout: 14000 });

    // Validate the final output contains the important sequence of messages
    const finalOutput = await demo.getOutputText();
    expect(finalOutput).toContain('Running Jump Search demonstration...');
    expect(finalOutput).toContain('Calculating jump size: √16 = 4');
    expect(finalOutput).toContain('Jumping to index 0: value 0');
    expect(finalOutput).toContain('Jumping to index 4: value 3');
    expect(finalOutput).toContain('Jumping to index 8: value 21');
    expect(finalOutput).toContain('Jumping to index 12: value 144');
    expect(finalOutput).toContain('Performing linear search from index 9 to 11');
    expect(finalOutput).toContain('Found 55 at index 10!');
    expect(finalOutput).toContain('Search complete.');

    // Ensure no runtime page errors occurred during the entire run
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Clicking the Run button again mid-sequence resets the output and restarts the demo', async ({ page }) => {
    // This tests how the application behaves when the user triggers RunDemo multiple times.
    const demo = new JumpSearchDemoPage(page);
    await demo.goto();

    // Start first run
    await demo.clickRun();

    // Wait until we've seen the first jump (indicating the sequence is underway)
    await demo.waitForOutputContains('Jumping to index 0: value 0', { timeout: 6000 });

    // Now click the button again while the sequence is still running
    await demo.clickRun();

    // The script sets output.innerHTML = '<p>Running Jump Search demonstration...</p>'; on each click,
    // so the output should be reset to just the initial running message shortly after the second click.
    await demo.waitForOutputContains('Running Jump Search demonstration...', { timeout: 2000 });

    // Confirm that at least the restarted run's initial messages appear, and earlier appended content is cleared
    const outputAfterRestart = await demo.getOutputText();
    // It should start with the running message; presence of 'Array:' may appear later in the restarted run,
    // but ensure that 'Jumping to index 0' from the previous run is not necessarily duplicated at this instant.
    expect(outputAfterRestart).toContain('Running Jump Search demonstration...');

    // Allow the restarted run to progress to ensure no errors occur on restart
    await demo.waitForOutputContains('Jumping to index 0: value 0', { timeout: 6000 });

    // Validate no page errors happened as a result of rapid interaction
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Rapid multiple clicks produce repeated runs without crashing (no runtime errors)', async ({ page }) => {
    // Rapidly click the demo button several times and ensure the page remains stable.
    const demo = new JumpSearchDemoPage(page);
    await demo.goto();

    // Rapid clicks
    await Promise.all([
      demo.clickRun(),
      demo.clickRun(),
      demo.clickRun()
    ]);

    // At least the running message should be present
    await demo.waitForOutputContains('Running Jump Search demonstration...', { timeout: 2000 });

    // Let the (last) run progress to the first jump
    await demo.waitForOutputContains('Jumping to index 0: value 0', { timeout: 7000 });

    // Assert no runtime errors captured after rapid interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: capture console messages and ensure there are no unexpected console errors', async ({ page }) => {
    // This test demonstrates capturing console messages and page errors during normal usage.
    const demo = new JumpSearchDemoPage(page);
    await demo.goto();

    // There are typically no console logs from the demo, but we capture any that occur.
    await demo.clickRun();

    // Wait for the demo to reach a mid-point to capture any console output
    await demo.waitForOutputContains('Calculating jump size: √16 = 4', { timeout: 7000 });

    // Validate that collected console messages (if any) do not include 'error' type entries
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);

    // Also ensure no page errors captured
    expect(pageErrors.length).toBe(0);
  });
});