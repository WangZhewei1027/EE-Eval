import { test, expect } from '@playwright/test';

// Page object for interacting with the Heap Sort demo page
class HeapSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b1fad4-fa7c-11f0-9fa6-d1bbe297d459.html';
    this.runButtonSelector = ".button[onclick='demoHeapSort()']";
    this.resultSelector = '#demoResult';
  }

  // Navigate to the page
  async goto() {
    await this.page.goto(this.url);
  }

  // Return the Run Demo button locator
  runButton() {
    return this.page.locator(this.runButtonSelector);
  }

  // Click the Run Demo button
  async clickRunDemo() {
    await this.page.click(this.runButtonSelector);
  }

  // Get the innerText of the demo result container
  async getDemoResultText() {
    return (await this.page.locator(this.resultSelector).innerText()).trim();
  }

  // Wait until the demo header appears in the result area
  async waitForDemoHeader() {
    await this.page.waitForSelector(`${this.resultSelector} h3`, { state: 'visible' });
  }
}

// Group tests that validate FSM states, transitions and runtime errors
test.describe('Heap Sort Demo (FSM: Idle -> Demo Running)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Per-test setup: create a fresh page and listeners
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console events
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture all unhandled page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // err is an Error object; capture its name and message for assertions
      pageErrors.push({
        name: err && err.name ? err.name : 'UnknownError',
        message: err && err.message ? err.message : String(err),
        stack: err && err.stack ? err.stack : '',
      });
    });
  });

  // Test: Verify the initial Idle state renders the Run Demo button
  test('S0_Idle: page loads and shows Run Demo button', async ({ page }) => {
    const heapPage = new HeapSortPage(page);

    // Load the page exactly as-is (do not modify global environment)
    await heapPage.goto();

    // Validate that the Run Demo button exists and matches the FSM selector
    const runButton = heapPage.runButton();
    await expect(runButton).toHaveCount(1);
    await expect(runButton).toBeVisible();
    await expect(runButton).toHaveText('Run Demo');

    // Verify the button has the onclick attribute exactly as in the FSM
    const onclick = await runButton.getAttribute('onclick');
    expect(onclick).toBe('demoHeapSort()');

    // The demo result container should exist but be empty initially
    const demoResult = page.locator(heapPage.resultSelector);
    await expect(demoResult).toBeVisible();
    const initialText = (await demoResult.innerText()).trim();
    // Initially there should be no demonstration output
    expect(initialText).toBe('');

    // Assert no unexpected page errors have occurred on initial load
    // Collect errors of interest (ReferenceError, TypeError, SyntaxError)
    const interestingErrors = pageErrors.filter(e =>
      ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name)
    );
    // There should be zero such errors on a clean load
    expect(interestingErrors.length).toBe(0);
  });

  // Test: Clicking Run Demo transitions to Demo Running and produces expected content
  test('Transition: Run Demo -> Demo Running produces heap visualization and final sorted array', async ({ page }) => {
    const heapPage = new HeapSortPage(page);

    // Navigate to the page
    await heapPage.goto();

    // Ensure preconditions (button present)
    await expect(heapPage.runButton()).toBeVisible();

    // Click the Run Demo button to trigger demoHeapSort() (S0 -> S1)
    // This checks the event/transition defined in the FSM
    await heapPage.clickRunDemo();

    // Wait for the demo header to appear, indicating demoHeapSort started
    await heapPage.waitForDemoHeader();

    // Grab the demo result text to assert expected observables
    const resultText = await heapPage.getDemoResultText();

    // The FSM expects the observables "Heap Sort Demonstration" and "Building max heap..."
    expect(resultText).toContain('Heap Sort Demonstration');
    expect(resultText).toContain('Building max heap...');

    // The implementation appends heapify steps and final sorted array; validate key phrases
    expect(resultText).toContain('Heapify index');
    expect(resultText).toContain('Max heap built:');
    expect(resultText).toContain('Sorting phase begins...');
    expect(resultText).toContain('Heapified:');
    expect(resultText).toContain('Final sorted array:');

    // Validate that the final sorted array matches the expected outcome from the HTML example
    // The demo's final array should be [5, 6, 7, 11, 12, 13]
    expect(resultText).toContain('[5, 6, 7, 11, 12, 13]');

    // Ensure no uncaught page errors of main types occurred during the run
    const interestingErrors = pageErrors.filter(e =>
      ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name)
    );
    // The demo implementation is expected to run without uncaught exceptions
    expect(interestingErrors.length).toBe(0);

    // Also assert there are no console.error messages emitted during the demo run
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: Clicking the Run Demo button multiple times
  test('Edge case: Multiple clicks of Run Demo are handled (idempotent run)', async ({ page }) => {
    const heapPage = new HeapSortPage(page);

    await heapPage.goto();

    // Click once, wait for completion
    await heapPage.clickRunDemo();
    await heapPage.waitForDemoHeader();

    const firstRunText = await heapPage.getDemoResultText();
    expect(firstRunText).toContain('Final sorted array:');
    expect(firstRunText).toContain('[5, 6, 7, 11, 12, 13]');

    // Click the button a second time; implementation resets innerHTML at start of demoHeapSort()
    await heapPage.clickRunDemo();
    await heapPage.waitForDemoHeader();

    const secondRunText = await heapPage.getDemoResultText();
    // After second click the demo should still finish and show the final sorted array
    expect(secondRunText).toContain('Final sorted array:');
    expect(secondRunText).toContain('[5, 6, 7, 11, 12, 13]');

    // The demo header should be present only once in the final DOM structure (it overwrites previous content)
    const headers = await page.locator(`${heapPage.resultSelector} h3`).count();
    expect(headers).toBe(1);

    // Confirm no new uncaught runtime errors were introduced by repeated runs
    const interestingErrors = pageErrors.filter(e =>
      ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name)
    );
    expect(interestingErrors.length).toBe(0);
  });

  // Test: Validate that the FSM-specified selector is present and actionable
  test("FSM component check: the button selector \".button[onclick='demoHeapSort()']\" should be actionable", async ({ page }) => {
    const heapPage = new HeapSortPage(page);
    await heapPage.goto();

    // Verify the selector exists in the DOM and is a button element with expected attributes
    const locator = page.locator(".button[onclick='demoHeapSort()']");
    await expect(locator).toHaveCount(1);
    await expect(locator).toHaveAttribute('class', 'button');
    await expect(locator).toHaveAttribute('onclick', 'demoHeapSort()');

    // Clicking via the selector should trigger the demo as per FSM event RunDemo
    await locator.click();
    await heapPage.waitForDemoHeader();
    const text = await heapPage.getDemoResultText();
    expect(text).toContain('Heap Sort Demonstration');
  });

  // Test: Observe console logs and page errors during full lifecycle and assert none of the critical error types occurred
  test('Runtime observation: capture console messages and page errors (no ReferenceError/TypeError/SyntaxError expected)', async ({ page }) => {
    const heapPage = new HeapSortPage(page);

    await heapPage.goto();

    // Trigger demo to exercise the script
    await heapPage.clickRunDemo();
    await heapPage.waitForDemoHeader();

    // Wait a short time to flush any late microtask errors
    await page.waitForTimeout(100);

    // Log captured console messages for debug output via test.info()
    // (We don't modify page; just assert on collected messages)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');

    // Assert there are no console.error messages
    expect(errorConsoleMessages.length).toBe(0);

    // Inspect pageErrors for critical JS errors
    const criticalPageErrors = pageErrors.filter(e =>
      ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name)
    );

    // The page's implementation should not produce these uncaught errors
    expect(criticalPageErrors.length).toBe(0);

    // For completeness, ensure we captured at least some console activity (info/debug) if present; but it's optional
    // This assertion is lenient: we allow zero messages but keep the captured array for diagnostics
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});