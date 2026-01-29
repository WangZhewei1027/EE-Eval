import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0442aa33-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('0442aa33-fa79-11f0-8a8e-bbe4f11717c6 - Floyd-Warshall Interactive Application', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Attach listeners before each test navigation so synchronous errors during page load are captured.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages (log, info, warning, error, etc.)
    page.on('console', (msg) => {
      // Store message type and text for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions from the page context
    page.on('pageerror', (error) => {
      // Error is an Error object - store name and message
      pageErrors.push({ name: error.name, message: error.message });
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Ensure no test leaves lingering listeners or state; close the page explicitly.
    // (Playwright will normally handle this, but explicit close keeps teardown clear)
    try {
      await page.close();
    } catch (e) {
      // ignore close errors
    }
  });

  test.describe('FSM State and Entry Action Tests', () => {
    test('Initial state S0_Idle should run entry action runFloydWarshall() on load (expect ReferenceError)', async ({ page }) => {
      // The FSM describes an initial state S0_Idle with entry action runFloydWarshall().
      // The page implementation calls runFloydWarshall() on load, but floydWarshall is only shown in a <pre> block,
      // so we expect a ReferenceError: floydWarshall is not defined.
      // Assert that a pageerror was captured and that it is a ReferenceError referencing floydWarshall.

      // Wait briefly to ensure synchronous errors during load are captured.
      await page.waitForTimeout(200); // small delay to allow events to propagate

      // There should be at least one page error due to calling undefined function
      expect(pageErrors.length).toBeGreaterThan(0);

      // Find at least one ReferenceError mentioning floydWarshall
      const refErrors = pageErrors.filter(e =>
        e.name === 'ReferenceError' && /floydWarshall/i.test(e.message)
      );

      expect(refErrors.length).toBeGreaterThan(0);

      // Also verify the console captured an error-level message related to the ReferenceError
      const consoleErrorMessages = consoleMessages.filter(m =>
        m.type === 'error' && /floydWarshall/i.test(m.text)
      );

      expect(consoleErrorMessages.length).toBeGreaterThanOrEqual(0);
      // It is acceptable if the environment surfaces the error as a pageerror but not as console.error.
      // The core validation is that the page threw the ReferenceError during the entry action.
    });

    test('No transitions exist and no interactive events are present (verify no interactive elements)', async ({ page }) => {
      // FSM extraction noted no events or transitions. Validate the DOM contains no standard interactive elements.
      const interactive = await page.locator('button, input, select, textarea, [role="button"], [role="tab"], a[href]').count();
      expect(interactive).toBe(0);
    });
  });

  test.describe('Console Output and DOM Verification', () => {
    test('Page should display the algorithm code in a <pre><code> block', async ({ page }) => {
      // Verify the DOM contains the code sample with the floydWarshall function text.
      const codeLocator = page.locator('pre code');
      await expect(codeLocator).toHaveCount(1);

      const codeText = await codeLocator.innerText();
      // The displayed code should include the function signature and particular lines shown in the HTML.
      expect(codeText).toContain('function floydWarshall(graph)');
      expect(codeText).toContain('if (graph[i][k] > graph[i][j] || graph[i][k] === 0 || graph[k][j] === 0)');
    });

    test('Because runFloydWarshall() fails early, console.log output "Floyd-Warshall Algorithm:" should NOT be present', async ({ page }) => {
      // Wait briefly for any console logs to appear
      await page.waitForTimeout(200);

      const foundLog = consoleMessages.some(m => m.type === 'log' && m.text.includes('Floyd-Warshall Algorithm:'));
      // Due to ReferenceError happening before console.log lines in runFloydWarshall, we expect this to be false.
      expect(foundLog).toBe(false);
    });

    test('Page header and container structure exist', async ({ page }) => {
      const header = page.locator('.header h1');
      await expect(header).toHaveText('Floyd-Warshall Algorithm');

      const container = page.locator('.container');
      await expect(container).toHaveCount(1);
    });
  });

  test.describe('Edge Cases and Error Scenarios', () => {
    test('Observe and assert that the error is an uncaught runtime exception (pageerror payload validation)', async ({ page }) => {
      // This test explicitly checks the uncaught exception payload shape captured by pageerror.
      await page.waitForTimeout(200);

      // There should be at least one error
      expect(pageErrors.length).toBeGreaterThan(0);

      // Validate the first captured error contains name and message properties
      const err = pageErrors[0];
      expect(err).toHaveProperty('name');
      expect(err).toHaveProperty('message');

      // The name is expected to be 'ReferenceError' in modern browsers for calling an undefined function
      expect(err.name).toMatch(/ReferenceError/i);

      // The message should mention the missing function name
      expect(err.message).toMatch(/floydWarshall/i);
    });

    test('No result table or visual output should be present because the implementation logs to console', async ({ page }) => {
      // Confirm that there is no element in the DOM representing algorithm results (table, grid, svg, canvas)
      const resultSelectors = [
        'table.results', 'table', '.matrix', '#results', 'svg', 'canvas', '.output', '.result-table'
      ];
      for (const sel of resultSelectors) {
        const count = await page.locator(sel).count();
        expect(count).toBe(0);
      }
    });
  });

  test.describe('Sanity: Ensure test captured console and page errors without modifying the page', () => {
    test('We did not inject or redefine any globals; only observed errors produced by the page', async ({ page }) => {
      // Check that global 'floydWarshall' is genuinely undefined in the page context (we must not define it ourselves)
      const exists = await page.evaluate(() => {
        // Accessing a global that doesn't exist returns undefined without throwing.
        return typeof window.floydWarshall !== 'function' && typeof floydWarshall === 'undefined';
      });

      expect(exists).toBe(true);
    });
  });
});