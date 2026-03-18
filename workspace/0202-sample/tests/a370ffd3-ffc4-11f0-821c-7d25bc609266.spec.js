import { test, expect } from '@playwright/test';

// Test file for application ID: a370ffd3-ffc4-11f0-821c-7d25bc609266
// Served at: http://127.0.0.1:5500/workspace/0202-sample/html/a370ffd3-ffc4-11f0-821c-7d25bc609266.html
//
// This suite validates the FSM states and transitions described in the specification:
// - S0_Idle: initial rendered page with Run BFS Demo button and empty output
// - S1_Running: after clicking the button, BFS runs and output is populated with visit order
//
// The tests also observe console messages and uncaught page errors (pageerror events) without
// modifying the application environment. They assert that behavior and DOM changes match expectations,
// verify accessibility-related attributes, check edge cases (multiple clicks, keyboard activation),
// and confirm that the bfs implementation is not leaked to the global scope (closure-scoped).

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a370ffd3-ffc4-11f0-821c-7d25bc609266.html';

// Page object for the minimal demo
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  runButton() {
    return this.page.locator('#run-demo');
  }

  outputPre() {
    return this.page.locator('#demo-output');
  }

  async clickRun() {
    await this.runButton().click();
  }

  async pressRunWithKeyboard(key = 'Enter') {
    await this.runButton().focus();
    await this.page.keyboard.press(key);
  }

  async outputText() {
    return (await this.outputPre().innerText()).trim();
  }

  // Wait until output contains the expected substring
  async waitForOutputContains(substring, options = { timeout: 2000 }) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.innerText.includes(substr);
      },
      '#demo-output',
      substring,
      options
    );
  }
}

test.describe('BFS Demo FSM: Idle and Running states', () => {
  // Capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Ensure a clean navigation for each test
    await page.goto('about:blank');

    // Attach listeners early to capture any errors during navigation/load
    page.__consoleMessages = [];
    page.__pageErrors = [];

    page.on('console', (msg) => {
      // store all console messages for assertions or debugging
      page.__consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', (err) => {
      // store uncaught exceptions (ReferenceError, TypeError, etc.)
      page.__pageErrors.push(err);
    });

    // Now navigate to the app
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Clear listeners to avoid cross-test leakage
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('S0_Idle: initial UI is rendered with Run BFS Demo button and empty output', async ({ page }) => {
    // Validate initial Idle state rendering and attributes.
    // This test checks evidence for S0_Idle from the FSM:
    // - Button with id #run-demo exists with correct text and attributes
    // - Output <pre id="demo-output"> is present and initially empty
    // - No uncaught page errors occurred during load

    const demo = new DemoPage(page);

    const button = demo.runButton();
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('id', 'run-demo');
    await expect(button).toHaveClass(/btn-demo/);
    await expect(button).toHaveAttribute('aria-label', 'Run BFS demonstration');
    await expect(button).toHaveText('Run BFS Demo');

    const output = demo.outputPre();
    await expect(output).toBeVisible();
    // Initially, the output should be empty (no BFS run yet)
    const initialText = await output.innerText();
    expect(initialText.trim()).toBe('', 'Expected initial demo output to be empty in Idle state');

    // Verify accessibility-related attributes on the output element
    await expect(output).toHaveAttribute('aria-live', 'polite');
    await expect(output).toHaveAttribute('aria-atomic', 'true');

    // Assert that no uncaught exceptions happened during load (pageerror events)
    expect(page.__pageErrors.length).toBe(0);
    // Also assert there are no console messages of type 'error'
    const consoleErrors = page.__consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_Running: clicking Run BFS transitions to Running and displays BFS visit order', async ({ page }) => {
    // Validate the transition RunBFS leading from S0_Idle to S1_Running:
    // - Clicking the button triggers BFS execution (observed via output text)
    // - Output contains the expected visit order: A → B → C → D → E → F
    // - No uncaught exceptions occur during the transition

    const demo = new DemoPage(page);

    // Precondition: output should be empty
    const before = await demo.outputText();
    expect(before).toBe('', 'Precondition: output must be empty before running BFS');

    // Click the button to trigger BFS (this is the RunBFS event)
    await demo.clickRun();

    // Wait for expected output to appear
    const expectedSequence = 'A → B → C → D → E → F';
    await demo.waitForOutputContains(expectedSequence);

    const outputText = await demo.outputText();

    // Check full message prefix and visit order
    expect(outputText).toContain('BFS Visit Order starting at node A:', 'Output should contain the expected prefix');
    expect(outputText).toContain(expectedSequence, 'Output should contain the expected BFS sequence');

    // Ensure the output exactly uses the unicode arrow separator and nodes in the right order
    const expectedFull = 'BFS Visit Order starting at node A:\nA → B → C → D → E → F';
    // Normalize whitespace differences and compare
    expect(outputText.replace(/\r\n/g, '\n')).toBe(expectedFull);

    // Verify that no uncaught exceptions were thrown during click handling
    expect(page.__pageErrors.length).toBe(0);

    // Also examine console; no console.error entries expected
    const consoleErrs = page.__consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('Event: keyboard activation (Enter) triggers BFS the same as clicking', async ({ page }) => {
    // Validate keyboard accessibility: pressing Enter while the button is focused should run BFS.
    // This simulates a user triggering the RunBFS event via keyboard, transitioning to S1_Running.

    const demo = new DemoPage(page);

    // Ensure clean state by reloading the page content for determinism
    await page.reload({ waitUntil: 'load' });

    // Focus the run button and press Enter
    await demo.pressRunWithKeyboard('Enter');

    // Expected visit order
    const expectedSequence = 'A → B → C → D → E → F';
    await demo.waitForOutputContains(expectedSequence);

    const outputText = await demo.outputText();
    expect(outputText).toContain(expectedSequence);

    // No uncaught exceptions on keyboard activation
    expect(page.__pageErrors.length).toBe(0);
  });

  test('Edge case: multiple rapid clicks should produce the same BFS output and not duplicate nodes', async ({ page }) => {
    // This tests clicking the Run BFS button multiple times rapidly (an edge case)
    // and validates that output remains the same and the application does not crash.

    const demo = new DemoPage(page);

    // Rapidly click the button 3 times
    await Promise.all([
      demo.clickRun(),
      demo.clickRun(),
      demo.clickRun()
    ]);

    const expectedSequence = 'A → B → C → D → E → F';
    await demo.waitForOutputContains(expectedSequence);

    const outputText = await demo.outputText();
    // Output should still show the correct BFS order once, not duplicate nodes
    // We assert the exact expected full string
    const expectedFull = 'BFS Visit Order starting at node A:\nA → B → C → D → E → F';
    expect(outputText.replace(/\r\n/g, '\n')).toBe(expectedFull);

    // No uncaught exceptions should be present
    expect(page.__pageErrors.length).toBe(0);

    // Also ensure console.error was not triggered
    const consoleErrs = page.__consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('Implementation detail: bfs is closure-scoped and not exported to window (no global leakage)', async ({ page }) => {
    // The HTML implements bfs inside an IIFE. This test asserts that there is no global window.bfs function,
    // which demonstrates encapsulation and matches the provided implementation (bfs defined inside the script).
    const isBfsOnWindow = await page.evaluate(() => typeof window.bfs);
    // Expect 'undefined' as bfs should not be a global function based on the provided implementation.
    expect(isBfsOnWindow).toBe('undefined');
  });

  test('Observability: gather console messages and page errors during interaction and report if any exist', async ({ page }) => {
    // This test purposefully inspects captured console and pageerror entries to ensure we are observing runtime behavior.
    // It does not mutate runtime; it only asserts that there are no unexpected runtime errors.
    const demo = new DemoPage(page);

    // Trigger normal usage
    await demo.clickRun();
    await demo.waitForOutputContains('A → B → C → D → E → F');

    // If any page errors occurred, fail the test and include the error messages for debugging
    if (page.__pageErrors.length > 0) {
      // Provide diagnostic messages in expectation failure
      const messages = page.__pageErrors.map(e => String(e.stack || e)).join('\n\n---\n\n');
      expect(page.__pageErrors.length, `Unexpected page errors detected:\n\n${messages}`).toBe(0);
    } else {
      // Otherwise assert there are zero page errors
      expect(page.__pageErrors.length).toBe(0);
    }

    // Also assert that no console.error messages were observed
    const consoleErrors = page.__consoleMessages.filter(m => m.type === 'error');
    if (consoleErrors.length > 0) {
      const diagnostic = consoleErrors.map(c => c.text).join('\n');
      expect(consoleErrors.length, `Console error messages detected:\n${diagnostic}`).toBe(0);
    } else {
      expect(consoleErrors.length).toBe(0);
    }
  });

});