import { test, expect } from '@playwright/test';

// Test file for application ID: d8344131-fa7b-11f0-b314-ad8654ee5de8
// URL (served by test harness): http://127.0.0.1:5500/workspace/0126-biased/html/d8344131-fa7b-11f0-b314-ad8654ee5de8.html
//
// This test suite validates the FSM described in the prompt:
// - S0_Idle: initial rendering (button present, demo log contains prompt)
// - S1_DemoRunning: triggered by clicking #runDemo, button disabled, log cleared then populated step-by-step by runKahn
//
// The tests also observe console messages and page errors and assert their expected absence (i.e., let any runtime errors surface naturally).

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8344131-fa7b-11f0-b314-ad8654ee5de8.html';

// Page object for the demo area to keep tests organized and readable
class DemoPage {
  constructor(page) {
    this.page = page;
  }

  // Element locators
  runDemoButton() {
    return this.page.locator('#runDemo');
  }

  demoLog() {
    return this.page.locator('#demoLog');
  }

  // Click the demo button (normal click, not forced)
  async clickRunDemo() {
    const btn = this.runDemoButton();
    await btn.click();
  }

  // Wait until the Kahn demonstration finishes by waiting for a known final line
  // We expect the demo to eventually append a line containing 'Order = [A, B, C, D, E]'
  async waitForKahnCompletion(timeout = 2000) {
    await expect(this.demoLog()).toContainText('Kahn completed', { timeout });
    await expect(this.demoLog()).toContainText('Order = [A, B, C, D, E]', { timeout });
  }
}

test.describe('Directed Graphs — Kahn demo FSM tests', () => {
  let consoleMessages;
  let pageErrors;

  // Setup before each test: navigate to the page and attach listeners to capture console and page errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page (info, warn, error, etc.)
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // Swallow any unexpected inspection errors while still letting natural console errors appear
      }
    });

    // Capture unhandled exceptions that reach the page context
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the static HTML page as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // no-op teardown: listeners are attached to the page fixture and will be cleaned up by Playwright
    // We keep this hook for symmetry and for any future cleanup needs.
  });

  test('S0_Idle: initial render shows Run demo button and instructional log', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) as described in the FSM:
    // - The page should render the demo button with the expected id/class/text
    // - The demo log should contain the initial instructional text
    // - No runtime page errors (ReferenceError, TypeError, SyntaxError) should have occurred during load

    const demo = new DemoPage(page);

    // Button exists, visible, enabled, has expected label and class
    await expect(demo.runDemoButton()).toBeVisible();
    await expect(demo.runDemoButton()).toBeEnabled();
    await expect(demo.runDemoButton()).toHaveAttribute('id', 'runDemo');
    await expect(demo.runDemoButton()).toHaveClass(/demo-btn/);
    await expect(demo.runDemoButton()).toHaveText('Run demonstration: Kahn\'s topological sort');

    // The demo log contains the instructional initial text described in HTML implementation
    await expect(demo.demoLog()).toBeVisible();
    await expect(demo.demoLog()).toContainText('Click the button to see step-by-step Kahn\'s algorithm on the example DAG.');

    // Assert that no uncaught page errors were observed during initial load
    // (We let any ReferenceError/SyntaxError/TypeError occur naturally. If any did occur, this assertion will fail.)
    expect(pageErrors.length, `Expected no page errors on initial load, found: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // There should be no console.error of severity 'error' emitted during load
    const severe = consoleMessages.filter(m => m.type === 'error');
    expect(severe.length, `Expected no console.error messages on initial load, found: ${JSON.stringify(severe)}`).toBe(0);
  });

  test('Transition RunDemoClick: clicking Run demonstration transitions to Demo Running state and prints steps', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_DemoRunning triggered by clicking #runDemo:
    // - The click handler disables the button immediately
    // - The log is cleared by the click handler
    // - After a brief delay runKahn prints step-by-step lines and final order
    // - No runtime page errors should be thrown during the interaction

    const demo = new DemoPage(page);

    // Sanity: ensure we're in Idle state before clicking
    await expect(demo.runDemoButton()).toBeEnabled();
    await expect(demo.demoLog()).toContainText('Click the button to see step-by-step Kahn');

    // Click the Run Demo button
    // The handler sets demoBtn.disabled = true and log.textContent = "" synchronously
    await demo.clickRunDemo();

    // Immediately after click: button should be disabled (exit-actions in FSM)
    await expect(demo.runDemoButton()).toBeDisabled();

    // Immediately after click: log should have been cleared by the click handler
    // The click handler calls log.textContent = "" before scheduling runKahn with setTimeout
    // Wait briefly for the immediate synchronous change to take effect
    await expect(demo.demoLog()).toHaveText('', { timeout: 500 });

    // Now wait for the Kahn demo output to begin and complete.
    // The script uses setTimeout(..., 50) before runKahn, which appends many lines.
    // Wait for a representative set of lines:
    await expect(demo.demoLog()).toContainText('Graph:', { timeout: 2000 });
    await expect(demo.demoLog()).toContainText('Step 1: compute in-degrees', { timeout: 2000 });

    // Wait until completion lines appear. The demo prints "Kahn completed" and "Order = [...]"
    await demo.waitForKahnCompletion(3000);

    // Verify final expected topological order appears in the log
    await expect(demo.demoLog()).toContainText('Order = [A, B, C, D, E]');

    // Ensure no page errors occurred during the run
    expect(pageErrors.length, `Expected no page errors during demo run, found: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // Ensure console did not emit error messages during the run
    const consoleErrorsDuringRun = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorsDuringRun.length, `Expected no console.error during demo run, found: ${JSON.stringify(consoleErrorsDuringRun)}`).toBe(0);
  });

  test('Edge case: clicking the demo button a second time should not re-run because button is disabled', async ({ page }) => {
    // This test ensures the demo button remains disabled after the first click.
    // Attempting to interact with a disabled control should not re-trigger the demo flow.
    // We do not patch or override the page; we only observe natural behavior.

    const demo = new DemoPage(page);

    // Click once to trigger the demo
    await demo.clickRunDemo();

    // Ensure disabled
    await expect(demo.runDemoButton()).toBeDisabled();

    // Capture current log content length
    const before = await demo.demoLog().textContent();

    // Attempting to click a disabled button via Playwright normally throws. We verify that:
    let clickThrew = false;
    try {
      // This will throw because the element is disabled
      await demo.runDemoButton().click({ timeout: 1000 });
    } catch (err) {
      clickThrew = true;
      // Expect the thrown error message to indicate the element is not enabled/clickable.
      // We don't assert the exact message string to avoid brittleness across Playwright versions,
      // but we assert it is an Error with a message.
      expect(err).toBeInstanceOf(Error);
      expect(err.message.length).toBeGreaterThan(0);
    }
    expect(clickThrew, 'Expected clicking a disabled button to throw an error in Playwright').toBe(true);

    // Ensure the log did not grow as a result of the attempted second click.
    const after = await demo.demoLog().textContent();
    expect(after, 'Expected demo log to remain unchanged after attempted second click').toContain(before || '');
  });

  test('Reloading page returns to Idle state and allows demo to be run again', async ({ page }) => {
    // This test checks that after a full reload the page returns to Idle state (S0_Idle),
    // and the demo can be run again from a clean state.

    const demo = new DemoPage(page);

    // Run demo once to change state
    await demo.clickRunDemo();
    await demo.waitForKahnCompletion(3000);

    // Reload the page (this should re-render initial page content, similar to "renderPage()" entry action)
    await page.reload({ waitUntil: 'load' });

    // After reload, the run button should be enabled again and demo log should show the initial prompt text
    await expect(demo.runDemoButton()).toBeVisible();
    await expect(demo.runDemoButton()).toBeEnabled();
    await expect(demo.demoLog()).toContainText('Click the button to see step-by-step Kahn\'s algorithm on the example DAG.');

    // No page errors should have been captured during reload
    expect(pageErrors.length, `Expected no page errors after reload, found: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  test('Observes and reports any runtime exceptions or console.error messages (if present)', async ({ page }) => {
    // This test intentionally reports any runtime errors or console.error messages captured during the test run.
    // We do not cause errors artificially; we only assert the captured arrays are accessible and contain expected types.
    // If errors exist, the test will fail below; that allows the harness to surface ReferenceError/TypeError/SyntaxError naturally.

    // At this point, consoleMessages and pageErrors have been populated by earlier navigation and interactions.
    // We assert that their structures are as expected (arrays) and that items (if any) have message/text fields.
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);

    // If there are page errors, fail with their messages to make diagnostics clear.
    if (pageErrors.length > 0) {
      // create a combined message for debugging
      const msgs = pageErrors.map(e => `${e.name}: ${e.message}`).join(' | ');
      throw new Error(`Page errors were observed during tests: ${msgs}`);
    }

    // If there are console errors, fail and include their texts
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    if (consoleErrors.length > 0) {
      const msgs = consoleErrors.map(m => m.text).join(' | ');
      throw new Error(`Console.error messages were observed during tests: ${msgs}`);
    }

    // If we reach here, no page errors or console.error messages were found.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});