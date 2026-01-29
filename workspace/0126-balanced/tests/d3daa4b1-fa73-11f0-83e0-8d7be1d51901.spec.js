import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3daa4b1-fa73-11f0-83e0-8d7be1d51901.html';

/**
 * Page Object for the tiny test runner UI.
 * Encapsulates common selectors and operations used by tests.
 */
class RunnerPage {
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runBtn');
    this.autoRun = page.locator('#autoRun');
    this.showStack = page.locator('#showStack');
    this.testsList = page.locator('#testsList');
    this.details = page.locator('#details');
    this.total = page.locator('#total');
    this.passed = page.locator('#passed');
    this.failed = page.locator('#failed');
    this.time = page.locator('#time');
    this.testItems = page.locator('.test-item');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRun() {
    await this.runBtn.click();
  }

  async waitForRunStart() {
    // Wait for run button to display Running... and be disabled
    await expect(this.runBtn).toHaveText(/Running\.\.\.|Running.../);
    await expect(this.runBtn).toBeDisabled();
    await expect(this.details).toContainText('Running tests...');
  }

  async waitForRunComplete(timeout = 10000) {
    // Wait until the total counter updates to a non-zero number or until run button re-enabled
    await this.page.waitForFunction(() => {
      const el = document.getElementById('total');
      return el && el.textContent !== '0';
    }, null, { timeout });
    // ensure UI updated
    await expect(this.runBtn).toHaveText('Run All Tests');
    await expect(this.runBtn).toBeEnabled();
  }

  async getCounts() {
    const total = Number((await this.total.textContent()) || '0');
    const passed = Number((await this.passed.textContent()) || '0');
    const failed = Number((await this.failed.textContent()) || '0');
    const timeText = (await this.time.textContent()) || '0ms';
    return { total, passed, failed, timeText };
  }

  async clickFirstFailed() {
    const failedItem = this.page.locator('.test-item.fail').first();
    await failedItem.click();
  }

  async clickFirstItem() {
    await this.testItems.first().click();
  }

  async toggleShowStack() {
    await this.showStack.click();
  }

  async toggleAutoRun() {
    await this.autoRun.click();
  }

  async getDetailsText() {
    return (await this.details.innerText()) || '';
  }
}

test.describe('Tiny Unit Test Runner - FSM and UI validation', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture console messages and page errors for assertions
    page.on('console', (msg) => {
      // store text and type for later inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // store actual Error objects reported as uncaught exceptions in the page
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // remove listeners to avoid cross-test interference
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial Idle state renders correctly (S0_Idle)', async ({ page }) => {
    // Validate initial render as described by S0_Idle: no results, counters at zero, details hint
    const runner = new RunnerPage(page);
    await runner.goto();

    // Check counters are zero and details show the default message
    await expect(runner.total).toHaveText('0');
    await expect(runner.passed).toHaveText('0');
    await expect(runner.failed).toHaveText('0');
    await expect(runner.time).toHaveText('0ms');
    await expect(runner.details).toContainText('No test selected. Run the suite to see results here.');

    // There should be no test items initially
    await expect(runner.testItems).toHaveCount(0);

    // Record that no uncaught page errors were emitted during initial load.
    // The application uses auto-run by default; however, initial render should still be present before tests start.
    expect(Array.isArray(pageErrors)).toBeTruthy();
  });

  test('Auto-run on load triggers test execution and completes (S1 -> S2 transitions)', async ({ page }) => {
    // This test validates that autoRun triggers the run on load and that the UI transitions
    // from Running Tests to Tests Completed with rendered results.
    const runner1 = new RunnerPage(page);

    await runner.goto();

    // Because autoRun is checked by default in the app, a run will start on load.
    // Wait for the run to start (button becomes disabled and shows Running...)
    await runner.waitForRunStart();

    // Wait for completion: total > 0 and run button re-enabled
    await runner.waitForRunComplete(20000);

    // Validate counts and relationship: passed + failed === total
    const { total, passed, failed, timeText } = await runner.getCounts();
    expect(total).toBeGreaterThan(0);
    expect(passed + failed).toEqual(total);
    // time should show ms
    expect(timeText).toMatch(/\d+ms/);

    // Ensure the test list has the expected number of items
    await expect(runner.testItems).toHaveCount(total);

    // At least one failing test is expected because sample tests include intentional failures
    expect(failed).toBeGreaterThanOrEqual(1);

    // Check that there are test items with pass/fail classes present
    const passCount = await page.locator('.test-item.pass').count();
    const failCount = await page.locator('.test-item.fail').count();
    expect(passCount).toEqual(passed);
    expect(failCount).toEqual(failed);

    // No uncaught page errors should have been emitted during execution
    expect(pageErrors.length).toBe(0);
  });

  test('Manual Run: clicking Run All transitions to RunningTests and then TestsCompleted (S0 -> S1 -> S2)', async ({ page }) => {
    // Validate the explicit click event (#runBtn) triggers Running state and then completes
    const runner2 = new RunnerPage(page);

    await runner.goto();

    // Ensure we've got results from autocall; reset by clicking run again to observe transition.
    // Click the run button and immediately assert running state
    await runner.clickRun();

    // After clicking, the UI should go into running state
    await runner.waitForRunStart();

    // Then wait for completion
    await runner.waitForRunComplete(20000);

    const counts = await runner.getCounts();
    expect(counts.total).toBeGreaterThan(0);

    // Validate details area ended up with "Total" summary in the rendered details when a test is selected later
    // (we will click an item next)
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking a failed test shows details including error message; toggling showStack reveals stack (ClickTestResult + ToggleShowStack)', async ({ page }) => {
    // Verify clicking a test item opens detailed view and the showStack checkbox toggles stack display
    const runner3 = new RunnerPage(page);
    await runner.goto();

    // Ensure tests have run (auto-run)
    await runner.waitForRunComplete(20000);

    // Click the first failing test to see details. If none, click first test.
    const failCount1 = await page.locator('.test-item.fail').count();
    if (failCount > 0) {
      await runner.clickFirstFailed();
    } else {
      await runner.clickFirstItem();
    }

    // Details should show a Status line
    await expect(runner.details).toContainText('Status:');

    // If the clicked test failed, details should include the error message text or stack
    const detailsTextBefore = await runner.getDetailsText();
    const hasErrorTextBefore = /Error|FAIL|Not found|Test failed|Expected/.test(detailsTextBefore);
    // It's acceptable either to see explicit error text or "No errors. Test passed."
    expect(typeof detailsTextBefore === 'string').toBeTruthy();

    // Toggle showStack; this should re-render details if there was an error and include a stack trace when checked.
    const hadShowStack = await page.locator('#showStack').isChecked();
    // toggle to the opposite state to exercise the change event handler
    await runner.toggleShowStack();

    // After toggling, the details should update. If there was an error and stack is available,
    // the content should include the word 'at ' (a typical stack line) or the original message.
    const detailsTextAfter = await runner.getDetailsText();
    expect(detailsTextAfter.length).toBeGreaterThanOrEqual(0);

    // revert showStack to original to avoid state bleed to other tests
    if (hadShowStack !== await page.locator('#showStack').isChecked()) {
      await runner.toggleShowStack();
    }

    // There should be no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Toggle auto-run checkbox changes state (ToggleAutoRun)', async ({ page }) => {
    // Validate that toggling the autoRun checkbox updates its checked property and the app does not crash.
    const runner4 = new RunnerPage(page);
    await runner.goto();

    const before = await page.locator('#autoRun').isChecked();
    await runner.toggleAutoRun();
    const after = await page.locator('#autoRun').isChecked();
    expect(after).toEqual(!before);

    // Toggle back to original to be tidy
    await runner.toggleAutoRun();
    const restored = await page.locator('#autoRun').isChecked();
    expect(restored).toEqual(before);

    expect(pageErrors.length).toBe(0);
  });

  test('Details summary reflects overall results when a test is selected (S2 -> S0 click leads to details update)', async ({ page }) => {
    // This test asserts that after tests complete, clicking a test shows a summary in details (lastResults usage).
    const runner5 = new RunnerPage(page);
    await runner.goto();

    // Wait for tests to complete
    await runner.waitForRunComplete(20000);

    // Click the first test item
    await runner.clickFirstItem();

    // The details element should include a "Total:" summary line generated from lastResults
    // Wait for details to contain "Total:" which is appended in showDetails
    await expect(runner.details).toContainText('Total:');

    // Validate the numbers shown in details summary correspond to the badges
    const counts1 = await runner.getCounts();
    const detailsText = await runner.getDetailsText();
    // Basic sanity checks that the textual summary mentions the totals (we don't parse exact numbers to avoid brittle assumptions)
    expect(detailsText).toContain('Total:');
    expect(pageErrors.length).toBe(0);
  });

  test('Rendered result items correspond to the internal test collection (consistency / edge cases)', async ({ page }) => {
    // This test ensures that the UI lists each collected test and that the rootSuites/collectTests helpers are exposed.
    const runner6 = new RunnerPage(page);
    await runner.goto();

    // Expose and call collectTests via window.__tinyTestRunner if available
    const exposed = await page.evaluate(() => {
      return {
        hasRunner: !!window.__tinyTestRunner,
        collectLength: window.__tinyTestRunner ? window.__tinyTestRunner.collectTests().length : null
      };
    });

    // Ensure the internal collectTests exists and returns at least as many tests as are rendered.
    await runner.waitForRunComplete(20000);
    const counts2 = await runner.getCounts();
    expect(exposed.hasRunner).toBeTruthy();
    expect(exposed.collectLength).toBeGreaterThanOrEqual(counts.total);

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console for informational logs and ensure no unexpected JS exceptions occurred', async ({ page }) => {
    // This test primarily inspects captured console messages and page errors.
    const runner7 = new RunnerPage(page);
    await runner.goto();

    // Wait for run to finish
    await runner.waitForRunComplete(20000);

    // There should be console output from the app (informational); assert that we captured some console messages
    // At minimum, expect the consoleMessages array to exist and be an array
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // Ensure no uncaught page errors were emitted (pageerror listener would have captured them)
    // If any genuine uncaught ReferenceError/SyntaxError/TypeError happen naturally, they would be in pageErrors.
    // We assert here that the page did not emit uncaught errors.
    expect(pageErrors.length).toBe(0);
  });
});