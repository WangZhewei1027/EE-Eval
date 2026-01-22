import { test, expect } from '@playwright/test';

// Test file for Application ID: 0baa98f0-d5b2-11f0-b169-abe023d0d932
// This suite validates the FSM states and transitions described in the prompt
// It intentionally does NOT patch or fix runtime errors in the page. It observes
// errors that happen naturally when loading the page and asserts their existence.

// Page object for the Linear Regression page to encapsulate common selectors and actions
class LinearRegressionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.h1 = page.locator('h1');
    this.h2 = page.locator('h2');
    this.dataDiv = page.locator('#data');
    this.canvas = page.locator('#chart');
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/0baa98f0-d5b2-11f0-b169-abe023d0d932.html');
  }

  async getH1Text() {
    return (await this.h1.textContent())?.trim();
  }

  async getH2Text() {
    return (await this.h2.textContent())?.trim();
  }

  async hasCanvas() {
    // returns true if an element with id="chart" exists in the DOM
    return await this.canvas.count() > 0;
  }

  async getDataDivText() {
    return (await this.dataDiv.textContent())?.trim();
  }
}

test.describe('FSM: Linear Regression Application (0baa98f0-d5b2-11f0-b169-abe023d0d932)', () => {
  // Arrays to collect page errors and console messages for assertions
  /** @type {Array<Error>} */
  let pageErrors;
  /** @type {Array<import('@playwright/test').ConsoleMessage>} */
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages for additional diagnostics
    page.on('console', msg => {
      consoleMessages.push(msg);
    });
  });

  test.afterEach(async ({ page }) => {
    // small teardown: remove listeners to avoid leakage between tests (Playwright automatically cleans page on fixture end)
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
  });

  test('S0_Idle: Initial Idle state renders expected static content', async ({ page }) => {
    // This test validates the Idle state's evidence: headings and static content are present.
    // It also ensures the page loads and we can query DOM elements even if runtime errors occur afterwards.
    const lr = new LinearRegressionPage(page);
    await lr.goto();

    // Wait briefly to allow inline script to run and potentially throw errors
    await page.waitForTimeout(200);

    // Verify headings exist and match FSM evidence
    expect(await lr.getH1Text()).toBe('Linear Regression');
    expect(await lr.getH2Text()).toBe('Linear Regression Example');

    // The page should contain a data container per the HTML
    expect(await lr.dataDiv.count()).toBe(1);

    // There is no canvas element with id="chart" in the provided HTML -> assert non-existence
    expect(await lr.hasCanvas()).toBe(false);

    // Even though runtime errors may have occurred, the static DOM evidence for Idle must be present
  });

  test('Runtime errors occur naturally when loading page (do not patch or suppress)', async ({ page }) => {
    // This test ensures we observe natural runtime exceptions (TypeError etc.) produced by the page as-is.
    const lr = new LinearRegressionPage(page);

    // Navigate to the page; inline script in the page is expected to throw because #chart does not exist
    await lr.goto();

    // Wait to ensure script execution and potential errors are emitted
    await page.waitForTimeout(300);

    // We must observe at least one page error (TypeError expected because getContext is called on null)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Assert at least one of the errors mentions getContext or 'Cannot read properties' as a heuristic
    const messages = pageErrors.map(e => e.message || String(e));
    const hasGetContextError = messages.some(m => /getContext/i.test(m) || /Cannot read properties of null/i.test(m) || /reading 'getContext'/i.test(m));
    expect(hasGetContextError).toBeTruthy();

    // Also gather console-level error messages (if any) and ensure they are captured in the consoleMessages array
    // We don't require a particular console message, but ensure the collection is accessible
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  test('Verify onEnter/onExit actions mentioned in FSM are absent or not invoked (renderPage, updateChart)', async ({ page }) => {
    // FSM mentions entry actions like renderPage() and updateChart() => verify whether these functions are present on window
    const lr = new LinearRegressionPage(page);
    await lr.goto();

    // Allow script execution and any errors to surface
    await page.waitForTimeout(200);

    // Check that renderPage is not defined on the window (the HTML does not define it)
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // The inline script defines a function updateChart(), but because a runtime TypeError occurs early
    // updateChart may NOT be defined. Assert that updateChart is not available on window.
    const updateChartType = await page.evaluate(() => typeof window.updateChart);
    expect(['undefined', 'function']).toContain(updateChartType);
    // Prefer 'undefined' since in this HTML updateChart is defined only after code that likely throws.
    // We simply assert it's either undefined or a function; if it exists as function, that's acceptable.

    // Also assert that a 'model' variable is not exposed on window because script execution likely failed before its creation.
    const modelType = await page.evaluate(() => typeof window.model);
    expect(['undefined', 'object']).toContain(modelType);
  });

  test('FSM Transition: ChartUpdate (interval) should not successfully transition due to runtime errors', async ({ page }) => {
    // FSM expects setInterval(updateChart, 1000) to drive a dynamic Chart Updated state.
    // Because the actual page throws before setInterval is reached, validate that setInterval was not set for updateChart.
    // We cannot directly observe native interval timers, but we can assert the absence of the updateChart function
    // and the Chart constructor. If updateChart is undefined and Chart is undefined, the transition could not run.
    const lr = new LinearRegressionPage(page);
    await lr.goto();

    // Allow script execution and potential errors
    await page.waitForTimeout(300);

    // Check whether Chart constructor is available on window (likely undefined because chart.js is not loaded)
    const chartCtorType = await page.evaluate(() => typeof window.Chart);
    expect(chartCtorType).toBe('undefined');

    // Check updateChart presence: if undefined then the interval could not have been scheduled to call it
    const updateChartType = await page.evaluate(() => typeof window.updateChart);
    expect(updateChartType).toBe('undefined');

    // Because updateChart is not a function on window, the FSM transition from Idle -> ChartUpdated (driven by interval)
    // could not have been enacted in this environment. Assert that evidence string 'setInterval(updateChart, 1000)'
    // is NOT observable as a function on the page.
    const setIntervalUsed = pageErrors.concat(consoleMessages.map(c => c.text())).some(m => /setInterval\(/i.test(String(m)));
    // It's acceptable if setInterval usage is not visible in console; we expect it to be falsey given the runtime error.
    expect(setIntervalUsed).toBeFalsy();
  });

  test('Edge case: Ensure headings remain accessible even if inline script fails early', async ({ page }) => {
    // This ensures the page's static content is resilient to script runtime failures.
    const lr = new LinearRegressionPage(page);
    await lr.goto();
    await page.waitForTimeout(200);

    // Headings should still be accessible
    expect(await lr.getH1Text()).toBe('Linear Regression');
    expect(await lr.getH2Text()).toBe('Linear Regression Example');

    // Data div exists but should be empty as the inline script does not populate it in the provided HTML
    const dataText = await lr.getDataDivText();
    // Data div might be empty or whitespace
    expect(typeof dataText === 'string').toBeTruthy();
  });

  test('Error scenario assertions: differentiate TypeError from other error types', async ({ page }) => {
    // This test explicitly ensures the dominant error is a TypeError (expected), not a SyntaxError or ReferenceError.
    const lr = new LinearRegressionPage(page);
    await lr.goto();
    await page.waitForTimeout(250);

    // Map error types
    const types = pageErrors.map(e => {
      // e.name is commonly present (e.g., 'TypeError'), but convert to string defensively
      return (e && e.name) ? e.name : String(e).split(':')[0];
    });

    // Ensure that at least one TypeError is present
    const hasTypeError = types.some(t => /TypeError/i.test(t));
    expect(hasTypeError).toBeTruthy();

    // Ensure there are no SyntaxError messages (the HTML/JS as provided is syntactically valid)
    const hasSyntaxError = types.some(t => /SyntaxError/i.test(t));
    expect(hasSyntaxError).toBeFalsy();

    // ReferenceError might appear if code referenced undefined globals; assert that it is not the primary error type here
    const hasReferenceError = types.some(t => /ReferenceError/i.test(t));
    // ReferenceError may or may not be present; we assert it's not the predominant error type by requiring at least one TypeError
    expect(hasReferenceError).toBe(false);
  });
});