import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e164720-d5c5-11f0-92ee-f5994b4f4c99.html';

test.describe('Graph interactive application - FSM S0_Idle and runtime errors', () => {
  let consoleMessages;
  let pageErrors;

  // Capture console messages and page errors for each test run
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages (info/warn/error/debug)
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Listen to uncaught exceptions on the page
    page.on('pageerror', err => {
      // err is an Error object; store its message for assertions
      pageErrors.push(err.message || String(err));
    });

    // Navigate to the page and wait for load so inline scripts run/attempt to run
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // small cleanup: capture final DOM or console if needed (no modifications)
    await page.close();
  });

  test('S0_Idle: Page renders static content (heading and description)', async ({ page }) => {
    // Validate the main heading exists and matches expected static content
    const heading = await page.locator('h1').textContent();
    expect(heading).toBeTruthy();
    expect(heading.trim()).toBe('Graph');

    // Validate the descriptive paragraph is present and contains expected text
    const paragraph = await page.locator('p').textContent();
    expect(paragraph).toBeTruthy();
    expect(paragraph).toContain('Graph is a mathematical structure');

    // Validate the graph container exists
    const graphExists = await page.locator('#graph').count();
    expect(graphExists).toBe(1);
  });

  test('Validate that no interactive controls are present (matches FSM: no event handlers detected)', async ({ page }) => {
    // The FSM extraction indicated no interactive elements; assert there are no common form controls or buttons
    const interactiveCount = await page.locator('button, input, select, textarea, [role="button"]').count();
    expect(interactiveCount).toBe(0);
  });

  test('Entry action renderPage() is not available on window (onEnter check)', async ({ page }) => {
    // FSM indicated an entry action renderPage(); the implementation does not define it.
    // We assert that renderPage is not a defined function on the window.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Additionally check that other named functions in the JS are not available due to script errors
    const addEdgeType = await page.evaluate(() => typeof window.addEdge);
    const removeEdgeType = await page.evaluate(() => typeof window.removeEdge);
    const drawGraphType = await page.evaluate(() => typeof window.drawGraph);

    // It's expected that the malformed script prevents these functions from being defined.
    expect(['undefined', 'function']).toContain(addEdgeType); // robust: could be undefined or function depending on parse
    expect(['undefined', 'function']).toContain(removeEdgeType);
    expect(['undefined', 'function']).toContain(drawGraphType);

    // However, given the many syntax errors, prefer to assert at least one is undefined
    const atLeastOneUndefined = [renderPageType, addEdgeType, removeEdgeType, drawGraphType].some(t => t === 'undefined');
    expect(atLeastOneUndefined).toBeTruthy();
  });

  test('Clicking on graph container does not create new nodes (no event bindings)', async ({ page }) => {
    // Record the number of child elements inside #graph before click
    const beforeCount = await page.locator('#graph').evaluate(node => node.childElementCount);

    // Simulate a user click on the graph container
    await page.locator('#graph').click();

    // Wait a short time to allow any event handlers (if present) to execute
    await page.waitForTimeout(200);

    // Verify no new children were added, since there are no event handlers expected
    const afterCount = await page.locator('#graph').evaluate(node => node.childElementCount);
    expect(afterCount).toBe(beforeCount);
  });

  test('Runtime: Observe and assert that JS errors/syntax errors occur due to malformed script', async ({ page }) => {
    // Aggregate errors from pageerror and console.error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    const totalErrorCount = pageErrors.length + consoleErrors.length;

    // Expect at least one error to have occurred because the provided HTML contains syntax/runtime issues
    expect(totalErrorCount).toBeGreaterThan(0);

    // Check that at least one error message includes likely substrings from the faulty implementation.
    // We look for signs of parsing/runtime problems: 'Unexpected', 'SyntaxError', 'ReferenceError', 'raph', 'Node'
    const combinedMessages = [...pageErrors, ...consoleErrors].join(' | ');

    const likelyIndicators = ['Unexpected', 'SyntaxError', 'ReferenceError', 'raph', 'Node', 'undefined'];
    const hasIndicator = likelyIndicators.some(ind => combinedMessages.includes(ind));
    expect(hasIndicator).toBeTruthy();

    // For debugging clarity in failures, attach the captured messages to the assertion message if none matched.
    if (!hasIndicator) {
      // Force a failure with console content to help diagnose test environment differences
      throw new Error('Expected at least one recognizable JS error indicator in console/page errors. Captured messages: ' + combinedMessages);
    }
  });

  test('Edge case: verify that global DOM mutation attempts did not succeed due to script failure', async ({ page }) => {
    // The script tries to create many Node instances and append them; because Node is not a browser DOM constructor,
    // these operations should not have succeeded. We assert that the #graph container does not contain many children.
    const childCount = await page.locator('#graph').evaluate(node => node.childElementCount);

    // Reasonable threshold: the malformed script should not have appended dozens of child nodes.
    // Accept either 0 (no children) or small number but assert it's less than an excessive threshold (e.g., 5).
    expect(childCount).toBeLessThan(5);
  });

  test('Smoke: ensure no unexpected global repair functions were injected (we do not modify the page)', async ({ page }) => {
    // Confirm we did not accidentally create any helper globals on the page by inspecting a few names
    const globals = await page.evaluate(() => {
      return {
        hasRepairFunction: typeof window.__repairScript === 'function',
        hasInjectedVar: typeof window.__injected === 'undefined' ? false : true
      };
    });

    // We expect no such injected globals
    expect(globals.hasRepairFunction).toBe(false);
    expect(globals.hasInjectedVar).toBe(false);
  });
});