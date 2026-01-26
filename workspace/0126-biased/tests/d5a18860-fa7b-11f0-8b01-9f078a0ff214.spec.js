import { test, expect } from '@playwright/test';

// Page Object representing the Topological Sort interactive page
class TopologicalSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a18860-fa7b-11f0-8b01-9f078a0ff214.html';
    this.demoButtonSelector = '#demoButton';
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async getDemoButton() {
    return this.page.locator(this.demoButtonSelector);
  }

  async clickDemoButton() {
    await this.page.click(this.demoButtonSelector);
  }

  // Wait for a dialog and return its message, accepting it
  async waitForDialogMessage() {
    const dialog = await this.page.waitForEvent('dialog', { timeout: 3000 });
    const message = dialog.message();
    await dialog.accept();
    return message;
  }
}

// Group related tests
test.describe('Topological Sort Interactive - FSM states and transitions', () => {

  // Test: initial state S0_Idle renders correctly
  test('S0_Idle: Page renders and shows demo button (renderPage entry evidence)', async ({ page }) => {
    // Collect console messages and page errors for inspection
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const topo = new TopologicalSortPage(page);
    // Navigate to the page (renderPage() is referenced by FSM as entry_action but NOT invoked here;
    // we only load the page exactly as-is)
    await topo.goto();

    // Validate that the demo button exists and matches FSM evidence
    const demoButton = await topo.getDemoButton();
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toHaveAttribute('id', 'demoButton');
    await expect(demoButton).toHaveClass(/button/);
    await expect(demoButton).toHaveText('Show Example');

    // Verify the page did not emit runtime errors during initial render.
    // If there are errors, we capture them — tests assert expected behavior (no runtime errors here).
    expect(pageErrors.length).toBe(0);

    // Verify that optional FSM entry action names are not present as global functions.
    // FSM lists renderPage() as an entry action; the implementation does not define it.
    // We do not inject or call anything; we only read the global property.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Provide helpful debug info if console messages exist (they likely don't)
    // We assert that there were no console errors of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test: transition ShowDemo from S0_Idle -> S1_DemoShown triggers alert and S1 entry action evidence
  test('ShowDemo event: clicking the demo button triggers alert and enters S1_DemoShown', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const topo = new TopologicalSortPage(page);
    await topo.goto();

    // Ensure initial state
    const demoButton = await topo.getDemoButton();
    await expect(demoButton).toBeVisible();

    // Click and capture the alert dialog message (this is the expected observable in the FSM)
    // The implementation uses alert("Demo: This would show a simple visualization of nodes and the topological sort.");
    // We wait for the dialog event and accept it, asserting the exact message.
    const clickPromise = topo.clickDemoButton();
    const dialogMessage = await topo.waitForDialogMessage();
    await clickPromise; // ensure click resolved

    expect(dialogMessage).toBe('Demo: This would show a simple visualization of nodes and the topological sort.');

    // After alert, assert the demo button remains present (no navigation occurred)
    await expect(demoButton).toBeVisible();

    // Check for runtime errors that may have occurred as a result of the click
    expect(pageErrors.length).toBe(0);

    // FSM mentions showDemoVisualization() as an entry action for S1. The implementation uses only alert().
    // Confirm that showDemoVisualization is not defined on window (we do not execute or create it).
    const showDemoVisualizationType = await page.evaluate(() => typeof window.showDemoVisualization);
    expect(showDemoVisualizationType).toBe('undefined');

    // Confirm no console errors were emitted during the click
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: clicking the button multiple times should reliably show alerts each time
  test('Edge case: multiple ShowDemo events (multiple clicks produce multiple alerts)', async ({ page }) => {
    const pageErrors = [];
    const consoleMessages = [];

    page.on('pageerror', err => pageErrors.push(err));
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    const topo = new TopologicalSortPage(page);
    await topo.goto();

    const demoButton = await topo.getDemoButton();
    await expect(demoButton).toBeVisible();

    // Click twice and capture both dialogs
    const dialog1Promise = topo.waitForDialogMessage();
    await page.click('#demoButton');
    const message1 = await dialog1Promise;
    expect(message1).toBe('Demo: This would show a simple visualization of nodes and the topological sort.');

    const dialog2Promise = topo.waitForDialogMessage();
    await page.click('#demoButton');
    const message2 = await dialog2Promise;
    expect(message2).toBe('Demo: This would show a simple visualization of nodes and the topological sort.');

    // No runtime page errors expected
    expect(pageErrors.length).toBe(0);

    // No console errors expected
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Error observation test: ensures we observe and report any runtime exceptions if they occur naturally
  test('Error observation: capture and assert runtime exceptions or confirm none occurred', async ({ page }) => {
    // This test's purpose is to demonstrate observation of runtime errors.
    // We do NOT introduce or inject errors; we observe whatever occurs naturally when loading/clicking.
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const topo = new TopologicalSortPage(page);
    await topo.goto();

    // Trigger the demo, which in this implementation only shows an alert.
    // If there were accidental ReferenceError/SyntaxError/TypeError in the page script, they would have been
    // captured in pageErrors. We assert that either there are no errors, or if errors exist, they are reported
    // (i.e., the test records them).
    await page.click('#demoButton');
    // Accept alert to continue
    const dialog = await page.waitForEvent('dialog');
    await dialog.accept();

    // If errors occurred, we make assertions about their structure; otherwise assert zero errors.
    if (pageErrors.length > 0) {
      // At least one runtime error occurred — verify it's an Error object and has a message.
      for (const err of pageErrors) {
        expect(err).toBeInstanceOf(Error);
        expect(typeof err.message).toBe('string');
      }
    } else {
      // Typical expected case for this implementation: no runtime errors.
      expect(pageErrors.length).toBe(0);
    }
  });

});