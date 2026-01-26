import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b4b9f0-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object Model for the AST demo page
class ASTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demo-button');
    this.visualization = page.locator('#ast-visualization');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickDemoButton() {
    await this.button.click();
  }

  async getVisualizationInnerHTML() {
    return this.page.evaluate(() => document.getElementById('ast-visualization').innerHTML);
  }

  async hasHeader() {
    return this.visualization.locator('h3').count();
  }

  async getVisualizationText() {
    return this.visualization.textContent();
  }
}

test.describe('FSM: Comprehensive Guide to AST - f0b4b9f0...', () => {
  // Capture console messages and page errors for each test run
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // reset collectors
    pageErrors = [];
    consoleMessages = [];

    // Observe page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      // store error objects for assertions
      pageErrors.push(err);
    });

    // Capture console messages and their types
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Navigate to the application page (SUT)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Teardown is handled by Playwright fixtures; these hooks can be used for logging if needed.
    // We intentionally do not modify the page or global state.
  });

  test.describe('State S0_Idle (Initial Render)', () => {
    test('S0: Page renders and Idle state shows button and placeholder visualization', async ({ page }) => {
      const ast = new ASTPage(page);

      // Validate the idle state's expected UI elements are present
      await expect(ast.button).toBeVisible();
      await expect(ast.button).toHaveText('Show AST for: 2 * (3 + 4)');

      // The visualization area should contain the placeholder text before any interaction
      await expect(ast.visualization).toBeVisible();
      await expect(ast.visualization).toContainText('AST visualization will appear here when you click the button.');

      // This FSM state lists an entry action renderPage() — while we cannot observe function calls,
      // the expected result of that action is that the page content was rendered. We assert that.
      const vizHTML = await ast.getVisualizationInnerHTML();
      expect(typeof vizHTML).toBe('string');
      expect(vizHTML.length).toBeGreaterThan(0);

      // Assert there were no uncaught page errors during initial render
      // (If any runtime ReferenceError/SyntaxError/TypeError happen naturally, they will be collected
      // and this assertion will fail — which is intended per the test policy.)
      expect(pageErrors.length).toBe(0);

      // Assert no console error-level messages were emitted during initial render
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Event: ShowAST (Transition S0 -> S1)', () => {
    test('Clicking the demo button displays the AST visualization (S1_AST_Shown)', async ({ page }) => {
      const ast = new ASTPage(page);

      // Pre-condition: ensure we're in Idle (no AST header present)
      await expect(ast.visualization.locator('h3')).toHaveCount(0);

      // Trigger the ShowAST event (user clicks the button)
      await ast.clickDemoButton();

      // After the click, AST visualization should appear: verify header
      const header = ast.visualization.locator('h3');
      await expect(header).toHaveCount(1);
      await expect(header).toHaveText('AST for: 2 * (3 + 4)');

      // Verify JSON representation is present and contains expected AST structure keywords/values
      // JSON was injected via JSON.stringify(ast, null, 2) — check operator and literal values
      await expect(ast.visualization).toContainText('"operator": "*"');
      await expect(ast.visualization).toContainText('"value": 2');
      await expect(ast.visualization).toContainText('"value": 3');
      await expect(ast.visualization).toContainText('"value": 4');
      await expect(ast.visualization).toContainText('BinaryExpression(*)');
      await expect(ast.visualization).toContainText('Literal(2)');

      // Ensure transition produced the expected DOM changes (innerHTML now contains an <h3>)
      const vizHTML = await ast.getVisualizationInnerHTML();
      expect(vizHTML.includes('<h3>AST for: 2 * (3 + 4)</h3>')).toBeTruthy();

      // Assert no page errors were emitted during the transition and rendering
      expect(pageErrors.length).toBe(0);

      // Check console messages for error severity
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Edge case: Clicking the demo button multiple times remains stable and idempotent', async ({ page }) => {
      const ast = new ASTPage(page);

      // Click once to render AST
      await ast.clickDemoButton();
      await expect(ast.visualization.locator('h3')).toHaveCount(1);

      // Click again and ensure no duplicate headers or corrupted content
      await ast.clickDemoButton();

      // There should still only be a single header indicating one visualization rendered
      await expect(ast.visualization.locator('h3')).toHaveCount(1);

      // The JSON block should still contain the expected AST content
      await expect(ast.visualization).toContainText('"operator": "*"');
      await expect(ast.visualization).toContainText('"value": 2');

      // Ensure no runtime errors occurred during repeated interactions
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Edge case: No click should not show AST header (stay in Idle)', async ({ page }) => {
      const ast = new ASTPage(page);

      // Do not click; assert header absent and placeholder remains
      await expect(ast.visualization.locator('h3')).toHaveCount(0);
      await expect(ast.visualization).toContainText('AST visualization will appear here when you click the button.');

      // no page errors expected
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console and runtime errors observation', () => {
    test('Observe and assert console messages and page errors are as expected', async ({ page }) => {
      const ast = new ASTPage(page);

      // Capture baseline counts
      const initialPageErrors = pageErrors.length;
      const initialConsoleErrors = consoleMessages.filter((m) => m.type === 'error').length;

      // Trigger user interaction that exercises the JS
      await ast.clickDemoButton();

      // Wait briefly to ensure any async console messages or errors appear
      await page.waitForTimeout(100);

      // Collect summaries
      const totalPageErrors = pageErrors.length;
      const totalConsoleErrors = consoleMessages.filter((m) => m.type === 'error').length;

      // This application is expected to run without uncaught exceptions.
      // If any ReferenceError/SyntaxError/TypeError happen naturally, these assertions will fail,
      // surfacing the issues as required by the testing policy.
      expect(totalPageErrors).toBe(initialPageErrors); // no new page errors expected
      expect(totalConsoleErrors).toBe(initialConsoleErrors); // no new console errors expected

      // Also validate that console did not emit obvious runtime error text
      const errorLikeText = consoleMessages.some((m) =>
        /ReferenceError|TypeError|SyntaxError/i.test(m.text)
      );
      expect(errorLikeText).toBeFalsy();
    });
  });
});