import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b3cf90-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page object for interacting with the demo page
class DemoPage {
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoButton');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRun() {
    await this.button.click();
  }

  async getOutputText() {
    return this.output.innerText();
  }

  // Wait for a substring to appear in the demo output with a configurable timeout
  async waitForOutputContains(substring, timeout = 5000) {
    await expect(this.output).toContainText(substring, { timeout });
  }

  // Wait for substring to NOT be present
  async waitForOutputNotContains(substring, timeout = 2000) {
    await expect(this.output).not.toContainText(substring, { timeout });
  }
}

test.describe('Comprehensive Guide to Indexing - FSM tests', () => {
  let demo;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // capture console messages and page errors for assertions
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Save console messages for inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Save page errors thrown during execution
      pageErrors.push(err);
    });

    demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // No special teardown; listeners are attached to page fixture which is destroyed per test.
  });

  test('S0_Idle: Initial Idle state is rendered with Run Demonstration button', async () => {
    // Validate that the page rendered the idle state components:
    // - The demo button should be visible and have expected label
    // - The output area should show initial placeholder text
    await expect(demo.button).toBeVisible();
    await expect(demo.button).toHaveText('Run Demonstration');

    await expect(demo.output).toBeVisible();
    await expect(demo.output).toContainText('Output will appear here...');

    // Verify onEnter action renderPage() is not present in the global scope.
    // The FSM mentioned renderPage() as an entry action, but the implementation does not define it.
    // Calling renderPage() in the page context should therefore throw a ReferenceError.
    await expect(demo.page.evaluate(() => renderPage())).rejects.toThrow(/renderPage is not defined/);

    // No unexpected runtime page errors should have occurred just by loading the page.
    expect(pageErrors.length).toBe(0);
  });

  test.describe('States and transitions during the demonstration run', () => {
    test('S0 -> S1: Clicking the button starts the demonstration (immediate output update)', async () => {
      // Click the button and assert immediate transition to Demonstration Running state:
      // output should immediately contain the "Simulating search in unindexed table (full scan)..." message.
      await demo.clickRun();
      await demo.waitForOutputContains('Simulating search in unindexed table (full scan)...', 2000);

      // still no page runtime errors during the immediate action
      expect(pageErrors.length).toBe(0);
    });

    test('S2 Full Scan In Progress and S3 Full Scan Completed messages appear in sequence', async () => {
      // Start demonstration
      await demo.clickRun();

      // S2: After ~500ms, expect the 50% scanned message to appear
      await demo.waitForOutputContains('Scanned 5,000 records (50%)... still searching', 2000);

      // S3: After the subsequent timeout (~1000ms after the 50% message), expect full scan completed message
      await demo.waitForOutputContains('Scanned all 10,000 records. Found target after 7,842 comparisons.', 3000);

      // Also expect the demo to report a total time for full scan
      await demo.waitForOutputContains('Total time: 120ms', 500);

      // After full scan completion the page appends "Now simulating indexed search..."
      await demo.waitForOutputContains('Now simulating indexed search...', 1000);

      // Ensure no page errors were thrown during these timed transitions
      expect(pageErrors.length).toBe(0);
    });

    test('S4 -> S5: Indexed search traversal and completion messages appear', async () => {
      // Start demonstration
      await demo.clickRun();

      // Wait for full scan to complete and the indexed simulation to start
      await demo.waitForOutputContains('Now simulating indexed search...', 3000);

      // S4: Traversing B-tree index...
      await demo.waitForOutputContains('Traversing B-tree index...', 3000);

      // S5: Found record after 14 comparisons (3 tree levels).
      await demo.waitForOutputContains('Found record after 14 comparisons (3 tree levels).', 5000);

      // Final summary line confirming speedup
      await demo.waitForOutputContains('Index search was 24x faster than full table scan!', 1000);

      // Ensure runtime didn't produce uncaught page errors during full demonstration
      expect(pageErrors.length).toBe(0);

      // Also validate that some console messages captured (if any) do not include fatal errors
      // We don't assert a strict number because the demo doesn't log to console by design.
      const fatalConsole = consoleMessages.find(m => m.type === 'error');
      expect(fatalConsole).toBeUndefined();
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Clicking the Run button while the demo is in progress resets the output (restarts demo)', async () => {
      // Start the demo
      await demo.clickRun();

      // Wait for the 50% scanned message
      await demo.waitForOutputContains('Scanned 5,000 records (50%)... still searching', 2000);

      // Click again while in-progress; implementation resets demoOutput.innerHTML on click.
      await demo.clickRun();

      // Immediately after re-click, the output should contain the initial "Simulating search..." message again
      await demo.waitForOutputContains('Simulating search in unindexed table (full scan)...', 2000);

      // And the intermediate "Scanned 5,000 records..." from the previous run should no longer be present
      // (because the handler sets innerHTML = ... which replaces previous contents)
      await demo.waitForOutputNotContains('Scanned 5,000 records (50%)... still searching', 2000);

      // Let this restarted run finish to make sure no page errors occur across repeated clicks
      await demo.waitForOutputContains('Found record after 14 comparisons (3 tree levels).', 6000);

      expect(pageErrors.length).toBe(0);
    });

    test('Calling non-existent FSM lifecycle functions triggers ReferenceError as observed in page context', async () => {
      // The FSM mentions startDemonstration() and finishDemonstration() in meta/actions,
      // but the implementation does not define these functions. Calling them should throw ReferenceError.

      // Attempt to call startDemonstration() in the page context and assert a ReferenceError occurs
      await expect(demo.page.evaluate(() => startDemonstration())).rejects.toThrow(/startDemonstration is not defined/);

      // Attempt to call finishDemonstration() in the page context and assert a ReferenceError occurs
      await expect(demo.page.evaluate(() => finishDemonstration())).rejects.toThrow(/finishDemonstration is not defined/);

      // renderPage() was already tested in initial idle test, but assert again here for completeness
      await expect(demo.page.evaluate(() => renderPage())).rejects.toThrow(/renderPage is not defined/);
    });

    test('Multiple rapid clicks do not produce uncaught page errors', async () => {
      // Rapidly click the button multiple times
      await demo.button.click();
      await demo.button.click();
      await demo.button.click();

      // Allow time for the nested timeouts to run; final completion should still occur without pageerror events
      await demo.waitForOutputContains('Found record after 14 comparisons (3 tree levels).', 8000);

      // There should be no page errors from the runtime during these rapid clicks
      expect(pageErrors.length).toBe(0);
    });
  });
});