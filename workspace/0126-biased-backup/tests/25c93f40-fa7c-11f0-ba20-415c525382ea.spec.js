import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25c93f40-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoBtn = page.locator('#demo-btn');
    this.demoArea = page.locator('#demo-area');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure the page main elements are present
    await expect(this.demoBtn).toBeVisible();
    await expect(this.demoArea).toBeVisible();
  }

  async clickDemoButton() {
    // Use Playwright user-gesture click
    await this.demoBtn.click();
  }
}

test.describe('BST Insertions Demo - FSM Validation (Application ID: 25c93f40-fa7c-11f0-ba20-415c525382ea)', () => {
  // Collect console messages and page errors during tests so we can assert on them
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test('Initial Idle state: button and demo area are rendered and ready', async ({ page }) => {
    // This test validates the S0_Idle state: initial renderPage() has produced the button and demo area.
    const demo = new DemoPage(page);
    await demo.goto();

    // The FSM evidence expects a button with id demo-btn and text "Show Insertions Demo"
    await expect(demo.demoBtn).toHaveText('Show Insertions Demo');

    // Button should be enabled in Idle
    await expect(demo.demoBtn).toBeEnabled();

    // demo-area should be present and initially empty
    await expect(demo.demoArea).toHaveText('', { timeout: 2000 });

    // demo-area should have aria attributes as per implementation
    const ariaLive = await page.getAttribute('#demo-area', 'aria-live');
    const ariaAtomic = await page.getAttribute('#demo-area', 'aria-atomic');
    expect(ariaLive).toBe('polite');
    expect(ariaAtomic).toBe('true');

    // Ensure no runtime page errors (ReferenceError/SyntaxError/TypeError) occurred during initial load
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking demo button transitions to DemoRunning (S1_DemoRunning): button disabled and text updates', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_DemoRunning on ShowInsertionsDemo event (click).
    // It confirms onEnter actions: disableDemoButton() and clearDemoArea() as implemented.
    test.setTimeout(40000); // ensure enough time for the full run in subsequent tests

    const demo = new DemoPage(page);
    await demo.goto();

    // Click the demo button to start the demonstration
    await demo.clickDemoButton();

    // Immediately after click, the code sets demoBtn.disabled = true and changes text
    await expect(demo.demoBtn).toBeDisabled();
    await expect(demo.demoBtn).toHaveText('Demonstration Running...');

    // The implementation clears the demoArea before starting the first step
    // We assert that the demoArea has been cleared (empty string) quickly after click
    await expect(demo.demoArea).toHaveText('', { timeout: 2000 });

    // Verify no page-level errors immediately after entering DemoRunning
    expect(pageErrors.length).toBe(0);
    const runtimeConsoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(runtimeConsoleErrors.length).toBe(0);
  });

  test('DemoRunning step-by-step logs appear and final Insert Complete state reached (S2_InsertComplete)', async ({ page }) => {
    // This test validates:
    // - repeated insertion logs while in S1_DemoRunning (evidence: "Inserting value: " and "Current tree structure:")
    // - eventual transition to S2_InsertComplete with "All insertions completed."
    // - exit action enableDemoButton() which re-enables the button and restores its text.

    // The demo uses 9 insertion steps with setTimeout 1800ms between steps.
    // We allow a generous timeout for the entire flow.
    test.setTimeout(60000);

    const demo = new DemoPage(page);
    await demo.goto();

    // Start demo
    await demo.clickDemoButton();

    // Assertions while demo runs:
    // Wait for the first insertion log to appear ("Inserting value: 8")
    await expect(demo.demoArea).toContainText('Inserting value: 8', { timeout: 10000 });

    // Also verify the demo area includes 'Current tree structure:' (printed after each insertion)
    await expect(demo.demoArea).toContainText('Current tree structure:', { timeout: 10000 });

    // Wait for a later insertion to appear to ensure multiple steps ran
    // We'll wait for insertion of last value 13 and final completion message.
    await expect(demo.demoArea).toContainText('Inserting value: 13', { timeout: 40000 });

    // Finally wait for completion message
    await expect(demo.demoArea).toContainText('All insertions completed.', { timeout: 45000 });

    // After completion, button should be re-enabled and text restored to 'Show Insertions Demo'
    await expect(demo.demoBtn).toBeEnabled();
    await expect(demo.demoBtn).toHaveText('Show Insertions Demo');

    // Ensure the demo area contains tree ASCII characters produced by prettyPrint for at least one step
    // We check for a tree-like ASCII character appearing, e.g., '└──' which is used in prettyPrint
    await expect(demo.demoArea).toContainText('└──', { timeout: 1000 });

    // Validate no unexpected runtime errors occurred during the demo run (pageerror events)
    const pageErrorTypes = pageErrors.map(e => e.name || e.constructor.name || String(e));
    const hasSeriousErrors = pageErrorTypes.some(t => /ReferenceError|SyntaxError|TypeError/.test(t));
    expect(hasSeriousErrors).toBeFalsy();

    // Also assert that there were no console errors during the run
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: start demo again after completion triggers a fresh run', async ({ page }) => {
    // This test validates restarting the demo after reaching the final state (S2_InsertComplete)
    test.setTimeout(60000);

    const demo = new DemoPage(page);
    await demo.goto();

    // Start first run
    await demo.clickDemoButton();

    // Wait for completion
    await expect(demo.demoArea).toContainText('All insertions completed.', { timeout: 45000 });

    // Capture current demoArea content to compare after second run begins
    const contentAfterFirstRun = await demo.demoArea.textContent();

    // Click the button again to start a fresh demonstration
    await demo.clickDemoButton();

    // Immediately after clicking, the demoArea should have been cleared as per implementation
    // and button should be disabled and show running text
    await expect(demo.demoBtn).toBeDisabled();
    await expect(demo.demoBtn).toHaveText('Demonstration Running...');
    // demoArea should be cleared (become empty) before steps start
    await expect(demo.demoArea).toHaveText('', { timeout: 2000 });

    // Wait for first insertion of the second run
    await expect(demo.demoArea).toContainText('Inserting value: 8', { timeout: 10000 });

    // Ensure the content differs from the previous run (i.e., it was cleared and re-populated)
    const contentDuringSecondRun = await demo.demoArea.textContent();
    expect(contentDuringSecondRun).not.toBe(contentAfterFirstRun);

    // Wait for the second run to complete as well
    await expect(demo.demoArea).toContainText('All insertions completed.', { timeout: 45000 });

    // Confirm no page-level uncaught errors were introduced by the restart
    expect(pageErrors.length).toBe(0);
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('Robustness check: no unexpected ReferenceError/SyntaxError/TypeError occurred during entire test lifecycle', async ({ page }) => {
    // This test aggregates the recorded pageErrors and console error types and asserts they do not contain fatal JS errors.
    // Note: We still allow other console.info/debug logs; we only fail the test if fatal exceptions were observed.
    const demo = new DemoPage(page);
    await demo.goto();

    // Start and wait for completion to exercise the flows
    await demo.clickDemoButton();
    await expect(demo.demoArea).toContainText('All insertions completed.', { timeout: 45000 });

    // Now inspect the recorded pageErrors
    // pageErrors may contain Error objects; assert none are ReferenceError/SyntaxError/TypeError
    for (const err of pageErrors) {
      const name = err.name || err.constructor.name || '';
      expect(name).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }

    // Inspect console messages for 'error' types that indicate runtime exceptions
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    // If any console errors exist, fail the test with diagnostic information
    expect(consoleErrors.length).toBe(0);
  });
});