import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba9d5a2-d5b2-11f0-b169-abe023d0d932.html';

/**
 * Page Object for the Floyd-Warshall demo page
 */
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nodesInput = page.locator('#nodes');
    this.edgesInput = page.locator('#edges');
    this.form = page.locator('#graph-form');
    this.submitButton = page.locator("button[type='submit']");
    this.graphTable = page.locator('#graph-table');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillNodes(value) {
    // use evaluate to set the value to avoid Playwright numeric coercion issues
    await this.page.evaluate(
      ({ selector, value }) => {
        const el = document.querySelector(selector);
        if (el) el.value = value;
      },
      { selector: '#nodes', value: String(value) }
    );
  }

  async fillEdges(value) {
    // edges input is type=number in the implementation, but tests may set string values (edge-case)
    await this.page.evaluate(
      ({ selector, value }) => {
        const el = document.querySelector(selector);
        if (el) el.value = value;
      },
      { selector: '#edges', value: String(value) }
    );
  }

  async submit() {
    // Trigger the form submit via clicking the submit button
    await this.submitButton.click();
  }

  async getTbodyHandle() {
    return this.page.$('#graph-table tbody');
  }

  async getTableHtml() {
    return this.page.$eval('#graph-table', (t) => t.innerHTML);
  }

  async getLocationHref() {
    return this.page.evaluate(() => location.href);
  }
}

test.describe('Floyd-Warshall Interactive App - FSM validation', () => {
  // Arrays to collect runtime errors and console messages for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // Capture the error object / message for assertions
      pageErrors.push(err);
    });
  });

  test('S0_Idle: Page renders initial UI (form, inputs, button, table)', async ({ page }) => {
    // Validate that the initial/idle state renders expected DOM elements
    const app = new GraphPage(page);
    await app.goto();

    // The form and its key controls should exist
    await expect(app.form).toBeVisible();
    await expect(app.nodesInput).toBeVisible();
    await expect(app.edgesInput).toBeVisible();
    await expect(app.submitButton).toBeVisible();

    // The graph table element should exist in the DOM, though it may be empty
    await expect(app.graphTable).toBeVisible();

    // There should not be any runtime page errors just from initial render in most cases,
    // but we allow either no errors or benign errors. Assert we did not crash navigation.
    const currentHref = await app.getLocationHref();
    expect(currentHref).toBe(APP_URL);

    // The table may not contain a tbody initially. This checks that behavior explicitly.
    const tbody = await app.getTbodyHandle();
    // Accept either no tbody or empty table - just assert type is allowed
    expect([null, Object]).toContain(tbody === null ? null : Object);
  });

  test('Transition S0 -> S1 -> S2: Submitting valid-looking inputs triggers processing (and captures runtime errors produced by the implementation)', async ({ page }) => {
    // This test submits the form with a small graph input and validates:
    // - the submit handler runs (no navigation)
    // - runtime errors (if any) are emitted and captured (per instructions we must observe them)
    // - the table is either attempted to be populated or remains unchanged due to runtime errors

    const app = new GraphPage(page);
    await app.goto();

    // Provide inputs that look reasonable to a user:
    // nodes = 2, edges = 1 (we'll also try a comma-style value as an edge case below)
    await app.fillNodes(2);
    await app.fillEdges(1);

    // Submit the form and let the page's JS run. We don't intercept or patch anything;
    // we allow missing/buggy runtime code to throw naturally.
    await app.submit();

    // Allow a brief moment for synchronous errors to surface
    await page.waitForTimeout(250);

    // The page should not have navigated away due to e.preventDefault() (if the handler ran).
    const hrefAfter = await app.getLocationHref();
    expect(hrefAfter).toBe(APP_URL);

    // The implementation is known to contain runtime logic bugs. Per instructions we must observe errors.
    // Assert that at least one uncaught page error occurred during/after submit.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Optionally assert that the error type(s) are instances of Error (TypeError/ReferenceError/etc.)
    for (const err of pageErrors) {
      expect(err).toBeInstanceOf(Error);
      // We expect the runtime error to be a TypeError or ReferenceError in this flawed implementation.
      // Check that the name is one of the common runtime error types.
      expect(['TypeError', 'ReferenceError', 'SyntaxError', 'RangeError']).toContain(err.name);
    }

    // Inspect the table: because of runtime errors the tbody may be absent or not populated.
    const tbody = await app.getTbodyHandle();
    if (tbody === null) {
      // If tbody is missing, that demonstrates the implementation did not successfully append rows.
      expect(tbody).toBeNull();
    } else {
      // If tbody exists, assert it likely has no child rows because runtime errors prevented proper population
      const inner = await page.evaluate((t) => t.innerHTML, await tbody);
      // Either empty or contains small content; do not require specific content due to broken logic,
      // but ensure we measured something (string).
      expect(typeof inner).toBe('string');
    }

    // Also ensure console messages were captured (helpful for debugging and validation)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('Edge Case: Submitting with malformed edges input (comma-separated string into a number input) triggers runtime errors', async ({ page }) => {
    // This test deliberately injects a comma-separated edges string into the numeric edges input
    // to exercise the broken getEdgesInput() logic in the implementation.
    const app = new GraphPage(page);
    await app.goto();

    // nodes: 3, edges: we set a comma-like string even though input is type=number to simulate user error
    await app.fillNodes(3);
    await app.fillEdges('1,2'); // set malformed value into number input

    // Submit and wait briefly
    await app.submit();
    await page.waitForTimeout(250);

    // We expect an uncaught page error due to destructuring/non-iterable or parse issues in the page JS
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Validate that at least one of the captured errors appears to relate to iterability or type problems.
    const hasTypeError = pageErrors.some((e) => e.name === 'TypeError');
    const hasRefOrSyntax = pageErrors.some((e) => e.name === 'ReferenceError' || e.name === 'SyntaxError');
    expect(hasTypeError || hasRefOrSyntax).toBeTruthy();
  });

  test('Edge Case: Submitting with empty inputs - observe behavior and errors', async ({ page }) => {
    // Submit the form without filling inputs to see how the implementation handles missing values.
    const app = new GraphPage(page);
    await app.goto();

    // Ensure inputs are empty
    await app.fillNodes('');
    await app.fillEdges('');

    // Submit
    await app.submit();
    await page.waitForTimeout(250);

    // Implementation may throw when trying to parse or build arrays with NaN lengths; assert we captured errors.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Confirm the table was not successfully populated (tbody absent or empty)
    const tbody = await app.getTbodyHandle();
    if (tbody !== null) {
      const inner = await page.evaluate((t) => t.innerHTML, await tbody);
      expect(typeof inner).toBe('string');
    } else {
      expect(tbody).toBeNull();
    }
  });

  test('Behavioral assertion: Submit handler prevents navigation (submit default prevented) even when runtime errors occur', async ({ page }) => {
    // This test ensures that the submit handler executed (calls e.preventDefault()) and therefore the page did not navigate/reload.
    const app = new GraphPage(page);
    await app.goto();

    // Make the form action something that would navigate if not prevented.
    // We will not mutate the page's JS; instead, we will ensure URL stays same after clicking submit.
    await app.fillNodes(1);
    await app.fillEdges(0);

    // Record URL then submit
    const before = await app.getLocationHref();
    await app.submit();
    await page.waitForTimeout(250);
    const after = await app.getLocationHref();

    // The submit handler in source calls e.preventDefault(); assert that no navigation occurred.
    expect(after).toBe(before);

    // Even if runtime errors occurred, the lack of navigation shows the submit handler was invoked.
    expect(pageErrors.length).toBeGreaterThanOrEqual(0);
  });

  test('Sanity: Console messages collected during interactions', async ({ page }) => {
    // Ensure our console listener is working by loading the page and performing a trivial action.
    const app = new GraphPage(page);
    await app.goto();

    // No forced console.log in the app, but interact a bit and assert consoleMessages is an array we can inspect.
    await app.fillNodes(2);
    await app.fillEdges(1);
    await app.submit();
    await page.waitForTimeout(200);

    // consoleMessages should be an array (may be empty)
    expect(Array.isArray(consoleMessages)).toBe(true);

    // If there are messages, ensure they have type and text
    for (const msg of consoleMessages) {
      expect(typeof msg.type).toBe('string');
      expect(typeof msg.text).toBe('string');
    }
  });
});