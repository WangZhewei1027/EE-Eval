import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f0d72-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object Model for the Query Optimization Demo page
class QueryPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#query');
    this.button = page.locator('button[onclick="optimizeQuery()"]');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setQuery(text) {
    await this.input.fill(text);
  }

  async clickOptimize() {
    await this.button.click();
  }

  async getResultInnerHTML() {
    return await this.result.innerHTML();
  }

  async getResultText() {
    return await this.result.textContent();
  }

  async getButtonOnClickAttribute() {
    return await this.button.getAttribute('onclick');
  }

  async isInputVisible() {
    return await this.input.isVisible();
  }

  async getInputPlaceholder() {
    return await this.input.getAttribute('placeholder');
  }
}

test.describe('Query Optimization Demo - FSM tests (324f0d72-fa73-11f0-a9d0-d7a1991987c6)', () => {
  // Arrays to capture console messages and page errors per test
  let consoleMessages;
  let consoleErrorMessages;
  let pageErrors;
  let consoleHandler;
  let pageErrorHandler;

  test.beforeEach(async ({ page }) => {
    // Initialize capture arrays
    consoleMessages = [];
    consoleErrorMessages = [];
    pageErrors = [];

    // Handlers to capture console and page errors
    consoleHandler = (msg) => {
      // Store the full console message object summary
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
      if (msg.type() === 'error') {
        consoleErrorMessages.push(msg.text());
      }
    };
    pageErrorHandler = (err) => {
      // Page errors (uncaught exceptions) are captured here
      pageErrors.push(err);
    };

    // Attach handlers to the Playwright page
    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup listeners to avoid cross-test interference
    if (consoleHandler) page.off('console', consoleHandler);
    if (pageErrorHandler) page.off('pageerror', pageErrorHandler);
  });

  test('S0_Idle: Initial Idle state renders expected components and entry action presence checked', async ({ page }) => {
    // This test validates the Idle state (S0_Idle):
    // - The input and button are present and visible
    // - The input has the expected placeholder
    // - The page does not throw runtime errors on load
    // - The FSM-specified entry action renderPage() is not implemented on the page (we assert its absence)
    const qp = new QueryPage(page);

    // Verify input is visible and has the expected placeholder (evidence from FSM)
    expect(await qp.isInputVisible()).toBe(true);
    expect(await qp.getInputPlaceholder()).toBe('SELECT * FROM users WHERE age > 30');

    // Verify the Optimize Query button is present and has the expected onclick attribute
    const onclickAttr = await qp.getButtonOnClickAttribute();
    expect(onclickAttr).toBe('optimizeQuery()');

    // Verify there were no uncaught page errors during initial render
    expect(pageErrors.length).toBe(0);

    // Verify there are no console errors emitted during initial render
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // We assert that there are no console errors/warnings on page load for a healthy initial state.
    expect(consoleErrors.length).toBe(0);

    // Verify that FSM-specified entry action "renderPage" is not defined on the page (the implementation does not define it).
    // We check the global type of renderPage on the page. If undefined, the entry action wasn't implemented.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Confirm optimizeQuery is exposed as a function on window (so the button's onclick has a target)
    const optimizeQueryType = await page.evaluate(() => typeof window.optimizeQuery);
    expect(optimizeQueryType).toBe('function');
  });

  test('Transition OptimizeQueryClick: SELECT * with WHERE should replace SELECT * and append ORDER BY/LIMIT', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_QueryOptimized triggered by clicking the Optimize Query button.
    // It ensures the optimization rules implemented in the page script are applied:
    // - "SELECT *" is replaced by "SELECT id, name, email"
    // - When WHERE exists without ORDER BY or LIMIT, " ORDER BY id LIMIT 10" is appended
    const qp = new QueryPage(page);

    const originalQuery = 'SELECT * FROM users WHERE age > 30';
    await qp.setQuery(originalQuery);
    await qp.clickOptimize();

    // Wait for the result text to update and include "Original Query" and "Optimized Query"
    await expect(qp.result).toHaveText(/Original Query:/, { timeout: 2000 });

    const resultHTML = await qp.getResultInnerHTML();
    // Ensure both original and optimized query labels are present
    expect(resultHTML).toContain('<strong>Original Query:</strong>');
    expect(resultHTML).toContain('<strong>Optimized Query:</strong>');

    // Check that SELECT * was replaced with SELECT id, name, email
    expect(resultHTML).toContain('SELECT id, name, email FROM users WHERE age > 30');

    // Check that ORDER BY id LIMIT 10 was appended because there was a WHERE but no ORDER BY/LIMIT
    expect(resultHTML).toContain('ORDER BY id LIMIT 10');

    // Ensure no runtime page errors occurred as a result of the optimization interaction
    expect(pageErrors.length).toBe(0);
    // Ensure there were no console errors emitted by the page during this interaction
    const consoleErrorsDuring = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrorsDuring.length).toBe(0);
  });

  test('Transition OptimizeQueryClick: query without WHERE should append WHERE id IS NOT NULL', async ({ page }) => {
    // Validates that when a query has no WHERE clause, the optimizer appends " WHERE id IS NOT NULL"
    const qp = new QueryPage(page);

    const originalQuery = 'SELECT id FROM users';
    await qp.setQuery(originalQuery);
    await qp.clickOptimize();

    const resultText = await qp.getResultText();
    // Original query should be echoed
    expect(resultText).toContain(originalQuery);
    // Optimized query should contain WHERE id IS NOT NULL appended
    expect(resultText).toMatch(/Optimized Query:.*WHERE id IS NOT NULL/);

    // No uncaught page errors expected
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: empty input should result in optimized query containing "WHERE id IS NOT NULL"', async ({ page }) => {
    // Edge case where the user input is empty. The implementation appends " WHERE id IS NOT NULL" to an empty string.
    // This test asserts that behavior is preserved as-is.
    const qp = new QueryPage(page);

    await qp.setQuery(''); // empty input
    await qp.clickOptimize();

    const resultText = await qp.getResultText();

    // Original Query label will be present; original query value is empty string
    expect(resultText).toContain('Original Query:'); // original may be empty but label present
    // Optimized query should include the appended WHERE clause even for an empty input
    expect(resultText).toMatch(/Optimized Query:.*WHERE id IS NOT NULL/);

    // Validate no runtime exceptions occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Event/Handler verification: clicking the button invokes optimizeQuery via onclick attribute', async ({ page }) => {
    // This test asserts that the button's onclick attribute points to optimizeQuery() and that invoking it updates DOM.
    const qp = new QueryPage(page);

    // Ensure onclick attribute is present as expected by FSM extraction
    expect(await qp.getButtonOnClickAttribute()).toBe('optimizeQuery()');

    // Spy on the result content prior to clicking to confirm change after click
    const before = await qp.getResultText();

    // Provide a sample query and click
    const sample = 'SELECT * FROM users WHERE age > 20';
    await qp.setQuery(sample);
    await qp.clickOptimize();

    // After clicking, result must have been updated (non-equal to before)
    const after = await qp.getResultText();
    expect(after).not.toBe(before);
    expect(after).toContain('Original Query:');
    expect(after).toContain('Optimized Query:');

    // Confirm no runtime page errors were thrown during the click
    expect(pageErrors.length).toBe(0);
  });

  test('Diagnostics: capture and assert console and page error captures behave as expected during interactions', async ({ page }) => {
    // This test demonstrates observation of console messages and page errors during multiple interactions.
    // It does not enforce that errors exist; it asserts that our capture mechanisms are functioning and that no unexpected errors occurred.

    const qp = new QueryPage(page);

    // Perform a sequence of interactions
    await qp.setQuery('SELECT * FROM users WHERE id > 5');
    await qp.clickOptimize();

    await qp.setQuery('SELECT id FROM users');
    await qp.clickOptimize();

    await qp.setQuery('');
    await qp.clickOptimize();

    // After interactions we should have captured console messages (if any) and possibly pageErrors.
    // The implementation is correct and shouldn't emit errors; assert zero uncaught page errors.
    expect(pageErrors.length).toBe(0);

    // We also expect no console error messages
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);

    // The consoleMessages array should contain zero or more informational messages; ensure we captured the sequence.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});