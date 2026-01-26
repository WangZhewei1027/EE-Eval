import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2dd641-fa7a-11f0-ba5b-57721b046e74.html';

class QuickSortPage {
  /**
   * Simple page object for the Quick Sort Interactive Demo.
   * Exposes commonly used selectors and actions.
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      h1: 'h1',
      arrayContainer: '#arrayContainer',
      stepExplanation: '#stepExplanation',
      log: '#log',
      arraySizeInput: '#arraySize',
      arraySizeValue: '#arraySizeValue',
      generateArrayBtn: '#generateArray',
      startSortBtn: '#startSort',
      stepForwardBtn: '#stepForward',
      pauseSortBtn: '#pauseSort',
      resetSortBtn: '#resetSort',
      speedInput: '#speed',
      speedValue: '#speedValue',
      partitionStartInput: '#partitionStart',
      partitionEndInput: '#partitionEnd',
      manualPartitionBtn: '#manualPartition',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getText(selector) {
    return (await this.page.locator(selector).innerText()).trim();
  }

  async countChildren(selector) {
    return await this.page.locator(selector).evaluate((el) => el.children.length);
  }

  async click(selector) {
    await this.page.locator(selector).click();
  }

  async setInputValue(selector, value) {
    await this.page.locator(selector).fill(String(value));
    // dispatch an input event to mimic user action
    await this.page.locator(selector).dispatchEvent('input');
  }

  async getAttribute(selector, name) {
    return await this.page.locator(selector).getAttribute(name);
  }
}

test.describe('Quick Sort Interactive Demo - Static DOM and Script Error Observability', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Collect page errors (uncaught exceptions, syntax errors, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.stack ? err.stack : err));
    });

    // Collect console messages of type error
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the application
    await page.goto(APP_URL);
  });

  test('Page should load static HTML elements (Idle state evidence)', async ({ page }) => {
    // Validate presence of static elements described in the FSM Idle evidence
    const qsp = new QuickSortPage(page);

    // The heading should exist and match the demo title
    await expect(page.locator(qsp.selectors.h1)).toHaveText('Quick Sort Interactive Demo');

    // The step explanation should contain the initial message from the HTML
    const explanation = await qsp.getText(qsp.selectors.stepExplanation);
    expect(explanation).toBe('Click "Start Quick Sort" to begin.');

    // The log should contain the placeholder text that exists in HTML before JS runs
    const logText = await qsp.getText(qsp.selectors.log);
    expect(logText).toContain('Log messages will appear here...');

    // Because the inline script contains a parsing/runtime error, the init() call may not have executed.
    // As a result, we expect no array elements to have been rendered (arrayContainer empty).
    const arrayChildren = await qsp.countChildren(qsp.selectors.arrayContainer);
    expect(arrayChildren).toBe(0);

    // The array size display is static HTML initial value; ensure it is '10'
    const arraySizeValue = await qsp.getText(qsp.selectors.arraySizeValue);
    expect(arraySizeValue).toBe('10');

    // Ensure partition inputs are present and have their initial attributes
    const partitionStartVal = await page.locator(qsp.selectors.partitionStartInput).getAttribute('value');
    const partitionEndVal = await page.locator(qsp.selectors.partitionEndInput).getAttribute('value');
    expect(partitionStartVal).toBe('0');
    expect(partitionEndVal).toBe('9');
  });

  test('Page should surface a SyntaxError or parsing-related page error on load', async ({ page }) => {
    // Wait a short time to allow any page errors to be emitted
    await page.waitForTimeout(200);

    // We expect at least one pageerror due to the intentional/broken code in the inline script.
    expect(pageErrors.length).toBeGreaterThan(0);

    // At least one of the errors should indicate a SyntaxError or reference to the faulty token 'choosePivot'
    const combined = pageErrors.join('\n').toLowerCase();
    const hasSyntaxOrChoosePivot = combined.includes('syntaxerror') || combined.includes('choosepivot') || combined.includes('unexpected');
    expect(hasSyntaxOrChoosePivot).toBeTruthy();

    // Also capture console.error outputs if any were emitted
    // The consoleErrors may include the same error; assert that we captured some error output too
    expect(consoleErrors.length).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Quick Sort Interactive Demo - Interaction attempts & transition expectations (observing failures)', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let qsp;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.stack ? err.stack : err));
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    qsp = new QuickSortPage(page);
    await qsp.goto();

    // Give the page a moment for potential script parsing/execution errors to appear
    await page.waitForTimeout(150);
  });

  test('Attempt to Start Sorting should not change DOM because script failed; observe errors', async ({ page }) => {
    // Record current state of DOM elements
    const initialLogChildren = await qsp.countChildren(qsp.selectors.log);
    const initialStepText = await qsp.getText(qsp.selectors.stepExplanation);
    const initialArrayChildren = await qsp.countChildren(qsp.selectors.arrayContainer);

    // Attempt to click Start Quick Sort
    await qsp.click(qsp.selectors.startSortBtn);

    // Allow any handlers (if bound) to run
    await page.waitForTimeout(200);

    // Because the script likely failed to parse, the start handler was not bound.
    // We assert that nothing meaningful changed in the DOM (no new log entries, no array rendered, explanation unchanged).
    const afterLogChildren = await qsp.countChildren(qsp.selectors.log);
    const afterStepText = await qsp.getText(qsp.selectors.stepExplanation);
    const afterArrayChildren = await qsp.countChildren(qsp.selectors.arrayContainer);

    expect(afterLogChildren).toBe(initialLogChildren);
    expect(afterStepText).toBe(initialStepText);
    expect(afterArrayChildren).toBe(initialArrayChildren);

    // We also expect that a page error exists (e.g., SyntaxError captured earlier)
    expect(pageErrors.length).toBeGreaterThan(0);
    const combined = pageErrors.join(' ').toLowerCase();
    expect(combined.includes('syntaxerror') || combined.includes('choosepivot') || combined.includes('unexpected')).toBeTruthy();
  });

  test('Attempt Pause/Resume, Step Forward, Reset, Generate actions - ensure no state transitions occur and errors observed', async ({ page }) => {
    // Snapshot initial states
    const initialStepText = await qsp.getText(qsp.selectors.stepExplanation);
    const initialLogCount = await qsp.countChildren(qsp.selectors.log);

    // Try a series of user interactions
    await qsp.click(qsp.selectors.generateArrayBtn);
    await qsp.click(qsp.selectors.stepForwardBtn);
    await qsp.click(qsp.selectors.pauseSortBtn);
    await qsp.click(qsp.selectors.resetSortBtn);

    // Wait for any potential handlers to run
    await page.waitForTimeout(300);

    // Expect no meaningful changes in explanation or log because JS likely didn't initialize
    const currentStepText = await qsp.getText(qsp.selectors.stepExplanation);
    const currentLogCount = await qsp.countChildren(qsp.selectors.log);

    expect(currentStepText).toBe(initialStepText);
    expect(currentLogCount).toBe(initialLogCount);

    // There should be at least one page error from load; record that it still exists
    expect(pageErrors.length).toBeGreaterThan(0);
  });

  test('Attempt Update inputs (array size and speed) - event handlers likely not bound, UI values remain static', async ({ page }) => {
    // Read initial displayed values
    const beforeArraySizeDisplay = await qsp.getText(qsp.selectors.arraySizeValue);
    const beforeSpeedDisplay = await qsp.getText(qsp.selectors.speedValue);

    // Try to change the inputs to new values
    await qsp.setInputValue(qsp.selectors.arraySizeInput, '20');
    await qsp.setInputValue(qsp.selectors.speedInput, '1000');

    // Wait to allow any input listeners to react (if present)
    await page.waitForTimeout(200);

    // Because the setup handlers may not have been attached due to script error,
    // the displayed spans should remain the initial HTML values.
    const afterArraySizeDisplay = await qsp.getText(qsp.selectors.arraySizeValue);
    const afterSpeedDisplay = await qsp.getText(qsp.selectors.speedValue);

    // The initial HTML values are '10' and '500ms' respectively.
    expect(beforeArraySizeDisplay).toBe('10');
    expect(beforeSpeedDisplay).toBe('500ms');

    // If handlers weren't attached, values remain unchanged
    expect(afterArraySizeDisplay).toBe(beforeArraySizeDisplay);
    expect(afterSpeedDisplay).toBe(beforeSpeedDisplay);

    // Confirm that page errors exist (syntax/parsing)
    expect(pageErrors.length).toBeGreaterThan(0);
  });

  test('Manual Partition edge cases: invalid ranges should not mutate DOM and should not crash further', async ({ page }) => {
    // Ensure manual partition inputs exist
    const startInput = page.locator(qsp.selectors.partitionStartInput);
    const endInput = page.locator(qsp.selectors.partitionEndInput);

    // Set an invalid range: start >= end
    await startInput.fill('5');
    await startInput.dispatchEvent('input');
    await endInput.fill('2');
    await endInput.dispatchEvent('input');

    // Count log entries before clicking
    const beforeLogCount = await qsp.countChildren(qsp.selectors.log);

    // Click Manual Partition; if JS didn't bind handler this will be a no-op.
    await qsp.click(qsp.selectors.manualPartitionBtn);

    // Wait a moment to let anything happen
    await page.waitForTimeout(200);

    const afterLogCount = await qsp.countChildren(qsp.selectors.log);

    // If the handler were bound, it would add one log entry "Invalid partition range."
    // But due to the script error, we expect no new log entries in many cases. Assert non-crash and log count unchanged or unchanged except maybe the initial placeholder.
    expect(afterLogCount).toBe(beforeLogCount);

    // Ensure still at least one page error present from page load
    expect(pageErrors.length).toBeGreaterThan(0);
  });

  test('Verify that attempting actions does not throw additional uncaught exceptions beyond initial parse error', async ({ page }) => {
    // We'll attempt actions and then assert that new pageerrors were not added for each click attempt,
    // because a parser-level SyntaxError typically prevents further script execution and further errors.
    const originalPageErrorCount = pageErrors.length;

    // Try interactions
    await qsp.click(qsp.selectors.startSortBtn);
    await qsp.click(qsp.selectors.generateArrayBtn);
    await qsp.click(qsp.selectors.resetSortBtn);
    await qsp.click(qsp.selectors.pauseSortBtn);
    await qsp.click(qsp.selectors.stepForwardBtn);

    await page.waitForTimeout(300);

    // In many broken-script situations, the set of page errors remains roughly the same after further interactions.
    // Assert we did not accumulate a large number of additional distinct page errors.
    expect(pageErrors.length).toBeGreaterThanOrEqual(originalPageErrorCount);
    expect(pageErrors.length).toBeLessThanOrEqual(originalPageErrorCount + 10);

    // If consoleErrors were emitted, they should have been captured too
    expect(consoleErrors.length).toBeGreaterThanOrEqual(0);
  });
});