import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b3bf42-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page object model for the Integration Testing Demo page
class IntegrationTestPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runTestBtn');
    this.resultDiv = page.locator('#testResults');
  }

  // Navigate to the page and ensure it is loaded
  async goto() {
    await this.page.goto(APP_URL);
    // Ensure essential elements are present
    await expect(this.runBtn).toBeVisible();
    await expect(this.resultDiv).toBeVisible();
  }

  // Click the run integration test button
  async clickRun() {
    await this.runBtn.click();
  }

  // Returns whether run button is disabled
  async isRunButtonDisabled() {
    return await this.runBtn.evaluate((btn) => btn.disabled);
  }

  // Get the resultDiv textContent
  async getResultText() {
    return await this.resultDiv.textContent();
  }

  // Get the resultDiv innerHTML
  async getResultHTML() {
    return await this.resultDiv.evaluate((el) => el.innerHTML);
  }

  // Wait until the "Running integration tests..." intermediate state is present
  async waitForRunningState(timeout = 2000) {
    await this.page.waitForFunction(
      () => {
        const el = document.getElementById('testResults');
        return el && el.textContent === 'Running integration tests...';
      },
      null,
      { timeout }
    );
  }

  // Wait until results are rendered (i.e., there is at least one <strong> within result div)
  async waitForResultsRendered(timeout = 5000) {
    await this.page.waitForFunction(
      () => {
        const el = document.getElementById('testResults');
        return el && el.querySelectorAll('strong').length >= 1;
      },
      null,
      { timeout }
    );
  }

  // Count <strong> elements in results
  async countResultStrongElements() {
    return await this.resultDiv.evaluate((el) => el.querySelectorAll('strong').length);
  }

  // Return array of objects for each result: { status, className, text }
  async parseResults() {
    return await this.resultDiv.evaluate((el) => {
      const nodes = Array.from(el.querySelectorAll('strong'));
      return nodes.map((node) => {
        const statusText = node.textContent || '';
        const className = node.className || '';
        // the surrounding text after the <strong> contains the test description and optional error
        const fullText = node.parentElement ? node.parentElement.textContent || '' : statusText;
        return {
          statusText: statusText.trim(),
          className,
          fullText: fullText.trim(),
        };
      });
    });
  }
}

test.describe('Integration Testing Demo - FSM validation', () => {
  // Collect console messages and page errors for each test to assert no unexpected errors occur.
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages and page errors
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app
    const model = new IntegrationTestPage(page);
    await model.goto();
  });

  test.afterEach(async ({ page }) => {
    // Small stabilization pause to ensure any late console events are captured
    await page.waitForTimeout(50);
    // Assert that there were no uncaught page errors during the test run
    // The application is well-formed; we assert that no runtime errors occurred by default.
    expect(pageErrors.map((e) => e.message)).toEqual([]);
    // Optionally ensure no console.error messages were emitted
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors).toEqual([]);
  });

  test('S0_Idle: initial Idle state - button visible and enabled, no results shown', async ({ page }) => {
    const model = new IntegrationTestPage(page);

    // Verify Idle state evidence: button exists with correct text and enabled
    await expect(model.runBtn).toBeVisible();
    await expect(model.runBtn).toHaveText('Run Integration Test');
    const disabled = await model.isRunButtonDisabled();
    expect(disabled).toBe(false);

    // Result div should be empty initially (Idle state's evidence)
    const resultText = await model.getResultText();
    // Allow either empty string or null depending on renderer; assert it's effectively empty
    expect(resultText ? resultText.trim() : '').toBe('');
  });

  test('Transition S0_Idle -> S1_TestRunning: clicking runs tests shows running message and disables button', async ({ page }) => {
    const model = new IntegrationTestPage(page);

    // Click button to trigger RunTest event
    await model.clickRun();

    // Immediately after click, the button should be disabled (onEnter action this.disabled = true)
    const disabledDuringRun = await model.isRunButtonDisabled();
    expect(disabledDuringRun).toBe(true);

    // The result div should immediately show the running message (evidence for Test Running state)
    await model.waitForRunningState();
    const runningText = await model.getResultText();
    expect(runningText.trim()).toBe('Running integration tests...');
  });

  test('Transition S1_TestRunning -> S2_TestCompleted: tests complete and results are rendered; button re-enabled', async ({ page }) => {
    const model = new IntegrationTestPage(page);

    // Start the test run
    await model.clickRun();

    // Verify RUNNING intermediate state
    await model.waitForRunningState();

    // Wait for results to be rendered
    await model.waitForResultsRendered();

    // After completion, button should be re-enabled (on exit action this.disabled = false)
    // The code sets this.disabled = false in finally block, so the button should be enabled again
    await expect(model.runBtn).toBeEnabled();
    const disabledAfter = await model.isRunButtonDisabled();
    expect(disabledAfter).toBe(false);

    // There should be three <strong> elements representing three test results
    const strongCount = await model.countResultStrongElements();
    expect(strongCount).toBe(3);

    // Parse the results and assert statuses and classes match expected outputs
    const parsed = await model.parseResults();
    // The integrationTest implementation yields statuses 'PASS' or 'FAIL' and uses class 'pass' or 'fail'
    expect(parsed.length).toBe(3);

    // First test should be PASS for successful registration
    expect(parsed[0].statusText).toContain('PASS:');
    expect(parsed[0].className).toBe('pass');
    expect(parsed[0].fullText).toContain('Successful registration');

    // Second test is expected to PASS because integrationTest catches the invalid email error and records PASS for that test
    expect(parsed[1].statusText).toContain('PASS:');
    expect(parsed[1].className).toBe('pass');
    expect(parsed[1].fullText).toContain('Registration with invalid email should fail');

    // Third test: taken email should result in PASS (because the test expects a failure and catches it)
    expect(parsed[2].statusText).toContain('PASS:');
    expect(parsed[2].className).toBe('pass');
    expect(parsed[2].fullText).toContain('Registration with taken email should fail');
  });

  test('Edge case: button remains disabled during run and additional clicks do not trigger duplicate runs', async ({ page }) => {
    const model = new IntegrationTestPage(page);

    // Start test run
    await model.clickRun();

    // Immediately ensure the button is disabled
    const disabledDuringRun = await model.isRunButtonDisabled();
    expect(disabledDuringRun).toBe(true);

    // Attempt to click while disabled. Playwright's click may attempt to perform the action but the browser will not fire events on disabled controls.
    // We expect that clicking a disabled button will not throw in the test, but will not cause changes to the UI (no new "Running..." messages).
    // Capture the current result HTML snapshot
    const beforeHTML = await model.getResultHTML();

    // Try to click; this should not cause a second run. We deliberately do not modify page internals.
    // Wrap in try/catch in case Playwright rejects clicking a disabled button on some versions; we treat that as acceptable (no extra run).
    try {
      await model.runBtn.click({ timeout: 500 }).catch(() => {});
    } catch (e) {
      // ignore: test verifies no duplicate run state, not click behavior
    }

    // Wait a tiny bit and ensure the result HTML hasn't been changed to start a new run (it should still indicate running or be replaced by the eventual results only once)
    await page.waitForTimeout(100);
    const afterHTML = await model.getResultHTML();

    // The content should either still be the running message or the same HTML snapshot (no duplication)
    // We assert that we did not trigger multiple "Running integration tests..." messages concatenated or multiple result blocks.
    // Simple heuristic: beforeHTML should be a substring of afterHTML or vice versa, but not contain duplicated "Running integration tests..." occurrences.
    const runningCountBefore = (beforeHTML.match(/Running integration tests\.\.\./g) || []).length;
    const runningCountAfter = (afterHTML.match(/Running integration tests\.\.\./g) || []).length;
    expect(runningCountAfter).toBeLessThanOrEqual(1);

    // Wait for final results to finish to keep test stable
    await model.waitForResultsRendered();
  });

  test('S3_TestFailed: verify that an uncaught "Test run failed:" message is not present for normal runs (negative test)', async ({ page }) => {
    const model = new IntegrationTestPage(page);

    // Run the integration tests normally
    await model.clickRun();
    await model.waitForResultsRendered();

    // The click handler's catch branch would set resultDiv.innerHTML = `<span class="fail">Test run failed: ${e.message}</span>`;
    // For the provided implementation, integrationTest is robust and exceptions are caught internally; therefore an uncaught top-level failure should not appear.
    const resultHTML = await model.getResultHTML();

    // Assert that there is no top-level "Test run failed:" message inserted by the outer catch block
    expect(resultHTML).not.toContain('Test run failed:');

    // Also assert no span.fail exists with that exact prefix
    const hasTopLevelFailPrefix = resultHTML.includes('<span class="fail">Test run failed:');
    expect(hasTopLevelFailPrefix).toBe(false);
  });
});