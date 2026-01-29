import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520883a2-fa76-11f0-a09b-87751f540fd8.html';

/**
 * Page object for the Heap app
 */
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#input');
    this.heap = page.locator('#heap');
    this.heapifyUpBtn = page.locator("button[onclick='heapifyUp()']");
    this.heapifyDownBtn = page.locator("button[onclick='heapifyDown()']");
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async setInput(value) {
    await this.input.fill(String(value));
  }

  async clickHeapifyUp() {
    await this.heapifyUpBtn.click();
  }

  async clickHeapifyDown() {
    await this.heapifyDownBtn.click();
  }

  async getHeapText() {
    return (await this.heap.innerText()).trim();
  }

  async getInputValue() {
    return await this.input.inputValue();
  }
}

test.describe('520883a2-fa76-11f0-a09b-87751f540fd8 - Heap (Max) interactive tests', () => {
  let pageErrors = [];
  let consoleMessages = [];

  // Attach listeners before each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture unhandled exceptions (pageerror) that bubble up from the page
    page.on('pageerror', (err) => {
      // err is an Error object; store its name and message for assertions
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack || ''
      });
    });

    // Capture console events for inspection
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Navigate to the application under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Best-effort: remove listeners by closing the page (Playwright closes pages automatically)
    // No additional teardown required here.
    // This comment explains teardown intent.
    await page.close();
  });

  // Helper to wait for at least one pageerror that matches a predicate within timeout.
  async function waitForPageErrorMatching(predicate, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      for (const err of pageErrors) {
        try {
          if (predicate(err)) return err;
        } catch (e) {
          // ignore predicate errors
        }
      }
      // small delay
      await new Promise((res) => setTimeout(res, 50));
    }
    return null;
  }

  test('S0_Idle: Initial render - components present and initial state validated', async ({ page }) => {
    // Ensure initial page loaded and required components exist (Idle state)
    const heapPage = new HeapPage(page);

    // Validate title and UI elements
    await expect(page).toHaveTitle(/Heap \(Max\)/);
    await expect(heapPage.input).toBeVisible();
    await expect(heapPage.heapifyUpBtn).toBeVisible();
    await expect(heapPage.heapifyDownBtn).toBeVisible();
    await expect(heapPage.heap).toBeVisible();

    // Input default value should match FSM component evidence (value "5")
    const inputVal = await heapPage.getInputValue();
    expect(inputVal).toBe('5');

    // Heap visual should be empty initially
    const heapText = await heapPage.getHeapText();
    expect(heapText).toBe('');

    // Assert that no page errors occurred simply from loading the page (renderPage() is not called by the HTML)
    // This proves the Idle state's render did not produce runtime exceptions on load.
    expect(pageErrors.length).toBe(0);

    // Also capture console messages at load (non-failing), useful for debugging if present
    // We don't require any console messages, but store them.
    // Comment: If renderPage() had been invoked but not implemented, we'd expect a ReferenceError here.
  });

  test('S1_Heapified_Up: Clicking Heapify Up triggers expected runtime errors and does not produce a valid heap output', async ({ page }) => {
    // This test validates the transition from Idle -> Heapified Up:
    // - clicking the Heapify Up button triggers heapifyUp()
    // - the implementation contains undefined variables and logic that should produce runtime errors (ReferenceError/TypeError)
    // - the heap visual (#heap) should remain unchanged (or at least not contain a valid two-number result)

    const heapPage1 = new HeapPage(page);

    // Pre-condition: ensure heap is empty
    expect(await heapPage.getHeapText()).toBe('');

    // Click Heapify Up and wait for a pageerror to be emitted
    await heapPage.clickHeapifyUp();

    // Wait for an error to be reported from the page
    const err = await waitForPageErrorMatching((e) =>
      // Match common runtime error names originating from the function's use of undefined variables
      e.name === 'ReferenceError' || e.name === 'TypeError'
    );

    // Assert that such an error was indeed observed
    expect(err).not.toBeNull();
    expect(['ReferenceError', 'TypeError']).toContain(err.name);

    // Confirm that the heap element was not populated with a valid "temp + ' ' + temp2" string
    // (Either remains empty or is not a pair of numeric tokens.)
    const heapTextAfter = await heapPage.getHeapText();
    // It should not be a pair of numbers separated by space (e.g., "12 7"). We assert it is empty or does not match numeric pair pattern.
    const numericPairRegex = /^\s*-?\d+\s+-?\d+\s*$/;
    expect(numericPairRegex.test(heapTextAfter)).toBeFalsy();

    // Also ensure we recorded the error in the pageErrors array
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('S2_Heapified_Down: Clicking Heapify Down triggers expected runtime errors and does not create a valid heap output', async ({ page }) => {
    // This test validates the transition from Idle -> Heapified Down:
    // - clicking the Heapify Down button triggers heapifyDown()
    // - the implementation is intentionally buggy and should throw runtime errors when executed
    // - the heap visual (#heap) should not contain valid output after invocation

    const heapPage2 = new HeapPage(page);

    // Ensure heap is initially empty
    expect(await heapPage.getHeapText()).toBe('');

    // Click Heapify Down and wait for page-level error(s)
    await heapPage.clickHeapifyDown();

    // Wait for either ReferenceError or TypeError to surface
    const err1 = await waitForPageErrorMatching((e) =>
      e.name === 'ReferenceError' || e.name === 'TypeError'
    );

    expect(err).not.toBeNull();
    expect(['ReferenceError', 'TypeError']).toContain(err.name);

    // After the failed operation, the heap element should not contain a valid pair of numeric tokens
    const heapTextAfter1 = await heapPage.getHeapText();
    const numericPairRegex1 = /^\s*-?\d+\s+-?\d+\s*$/;
    expect(numericPairRegex.test(heapTextAfter)).toBeFalsy();

    // Ensure pageErrors captured this error
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Edge cases: Small input values and repeated invocations still surface runtime errors (observe stability and error reporting)', async ({ page }) => {
    // This test examines edge cases and repeated interactions:
    // - set input to 1 (small boundary)
    // - invoke heapifyUp and heapifyDown multiple times
    // - verify that runtime errors are reported each time (or at least once), and the page remains responsive

    const heapPage3 = new HeapPage(page);

    // Set a boundary value
    await heapPage.setInput(1);
    expect(await heapPage.getInputValue()).toBe('1');

    // Invoke heapifyUp twice
    await heapPage.clickHeapifyUp();
    await heapPage.clickHeapifyUp();

    // Invoke heapifyDown twice
    await heapPage.clickHeapifyDown();
    await heapPage.clickHeapifyDown();

    // Wait for at least one runtime error to be captured
    const err2 = await waitForPageErrorMatching((e) =>
      e.name === 'ReferenceError' || e.name === 'TypeError'
    , 3000);

    expect(err).not.toBeNull();
    expect(['ReferenceError', 'TypeError']).toContain(err.name);

    // The application should still have interactive controls even after runtime errors:
    await expect(heapPage.heapifyUpBtn).toBeVisible();
    await expect(heapPage.heapifyDownBtn).toBeVisible();

    // Log collected console messages and page errors for transparency in test output (non-failing)
    // These are available in the test results if needed for debugging.
  });

  test('Observability: Console and page error capture behavior validated', async ({ page }) => {
    // This test ensures our instrumentation captures console messages and runtime exceptions.
    // We intentionally trigger a call that causes an error and assert our listeners captured it.

    const heapPage4 = new HeapPage(page);

    // Trigger an action expected to cause a runtime exception
    await heapPage.clickHeapifyUp();

    // Wait for an error to be captured
    const capturedError = await waitForPageErrorMatching((e) => true, 2000);
    expect(capturedError).not.toBeNull();

    // Ensure consoleMessages is an array (may be empty)
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // The captured error should include a name and message string
    expect(typeof capturedError.name).toBe('string');
    expect(typeof capturedError.message).toBe('string');
  });
});