import { test, expect } from '@playwright/test';

// Test file: 25c91830-fa7c-11f0-ba20-415c525382ea.spec.js
// This suite validates the interactive "Sets" demo page described by the FSM.
// It:
//  - Verifies initial (Idle) state UI elements are rendered
//  - Clicks the demo button to trigger the transition to DemoDisplayed and validates the output
//  - Ensures repeated interactions are idempotent (edge case)
//  - Observes console messages and page errors (ensures no unexpected runtime errors)
//  - Uses a small page object to organize interactions and assertions

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25c91830-fa7c-11f0-ba20-415c525382ea.html';

class SetsDemoPage {
  /**
   * Encapsulates page interactions and selectors for the Sets demo.
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runSelector = '#runDemo';
    this.demoAreaSelector = '#demoArea';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async runButton() {
    return this.page.locator(this.runSelector);
  }

  async demoArea() {
    return this.page.locator(this.demoAreaSelector);
  }

  async clickRun() {
    await (await this.runButton()).click();
  }

  async getDemoText() {
    return (await this.demoArea()).textContent();
  }
}

test.describe('Sets Demo FSM: Idle -> DemoDisplayed', () => {
  // Capture console and page errors for each test to make assertions about runtime errors
  let consoleEntries;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleEntries = [];
    pageErrors = [];

    // Collect console messages (including errors) for inspection
    page.on('console', msg => {
      // Store type and text for debugging / assertions
      consoleEntries.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    });
  });

  // Test initial Idle state: page renders and shows the run button, demo area empty
  test('Initial Idle state: button is present and demoArea is empty', async ({ page }) => {
    // Arrange: navigate and create page object
    const demo = new SetsDemoPage(page);
    await demo.goto();

    // Assert: run button exists and is visible
    const run = await demo.runButton();
    await expect(run).toBeVisible();
    await expect(run).toHaveText('Show Set Operation Results');

    // Assert: demoArea exists and is empty initially (Idle state's evidence)
    const demoArea = await demo.demoArea();
    await expect(demoArea).toBeVisible();
    const initialText = (await demoArea.textContent()) ?? '';
    // The demo area should be empty string initially (no precomputed output)
    expect(initialText.trim()).toBe('');

    // Also assert that no runtime errors occurred while rendering the page
    // (This validates that the "renderPage()" entry action from the FSM manifested without JS errors.)
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleEntries.filter(e => e.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test transition: clicking the button should produce the expected formatted output in demoArea
  test('Transition ShowSetOperationResults: clicking button updates demoArea with expected set operation results', async ({ page }) => {
    const demo = new SetsDemoPage(page);
    await demo.goto();

    // Precondition: demoArea empty
    const preText = await demo.getDemoText();
    expect((preText ?? '').trim()).toBe('');

    // Act: click the runDemo button (this is the FSM event ShowSetOperationResults)
    await demo.clickRun();

    // Build expected output string exactly as the page's script formats it
    const expectedOutput =
`Given sets:
A = { 2, 4, 6, 8 }
B = { 3, 4, 5, 6 }

A ∪ B (Union):
{ 2, 3, 4, 5, 6, 8 }

A ∩ B (Intersection):
{ 4, 6 }

A \\ B (Difference):
{ 2, 8 }
`;

    // Wait for the demoArea to be populated and compare text content exactly
    const demoArea = await demo.demoArea();
    await expect(demoArea).toHaveText(expectedOutput);

    // Additional DOM checks to ensure the update replaced (not appended) the content:
    const afterText = await demo.getDemoText();
    expect(afterText).toBe(expectedOutput);

    // Verify that the observable expected by the FSM (demoArea.textContent updated) occurred
    expect(afterText.length).toBeGreaterThan(0);
    expect(afterText.startsWith('Given sets:')).toBe(true);
    expect(afterText).toContain('A ∪ B (Union):');
    expect(afterText).toContain('{ 2, 3, 4, 5, 6, 8 }');

    // Ensure no uncaught exceptions happened during the click/update
    expect(pageErrors.length).toBe(0, `Expected no page errors, but got: ${JSON.stringify(pageErrors, null, 2)}`);

    // Also assert there are no console.error messages that may indicate runtime issues
    const consoleErrors = consoleEntries.filter(e => e.type === 'error');
    expect(consoleErrors.length).toBe(0, `Console errors were logged: ${JSON.stringify(consoleErrors, null, 2)}`);
  });

  // Edge case: clicking the button multiple times should not append duplicate results (idempotency)
  test('Edge case: repeated clicks produce the same output (no duplication/appending)', async ({ page }) => {
    const demo = new SetsDemoPage(page);
    await demo.goto();

    // Click first time and capture output
    await demo.clickRun();
    const firstOutput = (await demo.getDemoText()) ?? '';

    // Click a second time
    await demo.clickRun();
    const secondOutput = (await demo.getDemoText()) ?? '';

    // The output should be identical — the script sets demoArea.textContent, so repeated clicks replace content
    expect(secondOutput).toBe(firstOutput);

    // Assert the content remains exactly as expected (sanity check)
    expect(firstOutput).toContain('A ∪ B (Union):');
    expect(firstOutput).toContain('{ 2, 3, 4, 5, 6, 8 }');

    // No runtime errors should have occurred through repeated interaction
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleEntries.filter(e => e.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Error-scenario test: Observe and report any ReferenceError / SyntaxError / TypeError if present
  // This test does not attempt to inject or alter page behavior; it merely asserts that no such errors occurred.
  test('Runtime errors observation: no ReferenceError, SyntaxError, or TypeError were thrown during page lifecycle', async ({ page }) => {
    const demo = new SetsDemoPage(page);

    // Visit the page and perform the main interaction to exercise typical code paths
    await demo.goto();
    await demo.clickRun();

    // Examine captured pageErrors and assert none match the critical error types
    const criticalNames = ['ReferenceError', 'SyntaxError', 'TypeError'];
    const criticalErrors = pageErrors.filter(err => criticalNames.includes(err.name));

    // If there are critical errors, fail with details so these show up in test output.
    expect(criticalErrors.length).toBe(0, `Critical runtime errors detected: ${JSON.stringify(criticalErrors, null, 2)}`);

    // Also examine console error messages for typical error indicators
    const consoleErrorMsgs = consoleEntries
      .filter(e => e.type === 'error')
      .map(e => e.text);

    // Fail if console errors are present that appear to be JS exceptions
    expect(consoleErrorMsgs.length).toBe(0, `Console error messages detected: ${JSON.stringify(consoleErrorMsgs, null, 2)}`);
  });
});