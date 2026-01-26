import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8df0c1-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page Object for the Topological Sort Visualization page.
 * Encapsulates interactions and common assertions for clarity and reuse.
 */
class TopoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Navigate to the app URL
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Locator helpers
  startButton() {
    return this.page.locator('#startButton');
  }

  nodes() {
    return this.page.locator('#nodes .node');
  }

  arrows() {
    return this.page.locator('.arrow');
  }

  container() {
    return this.page.locator('#container');
  }

  // Click the Start button
  async clickStart() {
    await this.startButton().click();
  }

  // Click at center of body (for negative test cases)
  async clickBodyCenter() {
    await this.page.click('body', { position: { x: 10, y: 10 } });
  }

  // Evaluate arbitrary expression in page context
  async evalExpression(expr) {
    return await this.page.evaluate(expr);
  }
}

// Group tests related to the FSM and UI behaviors
test.describe('Topological Sort Visualization (FSM) - ed8df0c1-fa77-11f0-8492-31e949ed3c7c', () => {
  let topo;
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  // Setup before each test: attach listeners to capture console messages, page errors and dialogs,
  // then navigate to the page.
  test.beforeEach(async ({ page }) => {
    topo = new TopoPage(page);

    // Arrays to collect runtime information
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Capture console events (info, warn, error, log, etc.)
    page.on('console', (msg) => {
      // store both type and text for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled runtime errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      // store Error objects so tests can assert details if necessary
      pageErrors.push(err);
    });

    // Capture dialogs (alerts) and automatically accept them so the tests continue without blocking.
    page.on('dialog', async (dialog) => {
      try {
        dialogMessages.push({ type: dialog.type(), message: dialog.message() });
      } finally {
        // Accept/dismiss to allow the page to continue; we do not alter page code.
        await dialog.accept();
      }
    });

    // Navigate to the application page
    await topo.goto();
  });

  // Clean up listeners after each test to avoid interference (Playwright auto-cleans between tests,
  // but we avoid accidental cross-test state here).
  test.afterEach(async ({ page }) => {
    // Remove listeners by replacing them with no-ops (the test harness will dispose pages between tests).
    // No explicit teardown needed because Playwright provides a fresh page per test by default.
  });

  test.describe('State: Idle (S0_Idle) - initial render verification', () => {
    test('renders the container, nodes, arrows and Start button (Idle state evidence)', async () => {
      // Validate container exists and is visible
      await expect(topo.container()).toBeVisible();

      // Validate the Start Sort button is present, visible and has the expected text
      const start = topo.startButton();
      await expect(start).toBeVisible();
      await expect(start).toHaveText('Start Sort');
      await expect(start).toHaveAttribute('id', 'startButton');

      // Validate nodes count matches the HTML implementation (6 nodes A-F)
      await expect(topo.nodes()).toHaveCount(6);

      // Validate arrows count (4 arrows in the markup)
      await expect(topo.arrows()).toHaveCount(4);

      // Validate that the Start button is located within #controls area (ensures correct structure)
      const controlsParent = await topo.page.locator('#controls').locator('#startButton');
      await expect(controlsParent).toHaveCount(1);

      // FSM "entry action" for Idle mentions renderPage() in the FSM model,
      // but the implementation does not provide a global renderPage function.
      // Assert that there is no global renderPage function to confirm we didn't accidentally get one.
      const renderPageType = await topo.evalExpression('typeof window.renderPage');
      expect(renderPageType).toBe('undefined');

      // Assert that no runtime page errors occurred during initial rendering.
      // Collect console messages of type 'error' (if any)
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition: StartSort (S0_Idle -> S1_Sorting)', () => {
    test('clicking Start Sort triggers an alert with the expected Sorting entry action text', async () => {
      // Precondition: no dialogs captured yet
      expect(dialogMessages.length).toBe(0);

      // Perform the event per FSM: click the start button
      await topo.clickStart();

      // After clicking, the page should have emitted an alert with the exact message
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const lastDialog = dialogMessages[dialogMessages.length - 1];
      expect(lastDialog.type).toBe('alert');
      expect(lastDialog.message).toBe('Topological Sort starts here!');

      // Ensure the Start button still exists in the DOM after the transition
      await expect(topo.startButton()).toBeVisible();

      // Confirm that no runtime page errors occurred as a result of the click
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('clicking outside the Start button does not trigger the Sorting alert (negative case)', async () => {
      // Click somewhere else on the page (body). The alert should not appear because listener is only on #startButton
      await topo.clickBodyCenter();

      // Wait briefly to ensure no dialog appears (short timeout)
      // Since dialog handler automatically accepts, we can check that no new dialogs were added.
      // Give a small delay to let any unexpected dialogs appear.
      await topo.page.waitForTimeout(200);

      // There should be still zero dialogs (if previous tests in same file captured dialogs, this test runs in isolation per Playwright default)
      // Using >= 0 check; specifically ensure no new dialogs were added from this click (we only have those captured earlier in this test).
      // Because Playwright provides fresh page per test, we expect zero dialogs here.
      expect(dialogMessages.length).toBe(0);

      // No runtime errors resulted from clicking the body
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('rapid multiple clicks queue multiple alerts (edge case)', async () => {
      // Rapidly click the Start button three times
      const clicks = 3;

      // Perform clicks without awaiting dialogs (dialogs are handled by the page.on('dialog') listener)
      for (let i = 0; i < clicks; i++) {
        await topo.clickStart();
      }

      // Allow a small delay to let dialogs be handled and recorded
      await topo.page.waitForTimeout(200);

      // We should have recorded exactly 'clicks' dialog messages
      expect(dialogMessages.length).toBe(clicks);

      // All dialog messages should match the expected alert text
      for (const d of dialogMessages) {
        expect(d.type).toBe('alert');
        expect(d.message).toBe('Topological Sort starts here!');
      }

      // No additional runtime page errors should have occurred because of multiple alerts
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Robustness and error observation', () => {
    test('no unexpected console.error or runtime exceptions during normal usage', async () => {
      // Perform a normal click to trigger the Sorting alert once
      await topo.clickStart();

      // Wait a little to ensure events are processed
      await topo.page.waitForTimeout(100);

      // Assert there were no console.error messages collected
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);

      // Assert there were no unhandled page errors (ReferenceError, TypeError, SyntaxError, etc.)
      expect(pageErrors.length).toBe(0);

      // If a runtime error had occurred naturally in the page environment, it would be captured in `pageErrors`.
      // We explicitly assert that none occurred in the course of loading and interacting with the app.
    });

    test('verify that the Start button has event listener by observing behavior (sanity check)', async () => {
      // Basic sanity: the Start button's click handler should be present; clicking should trigger an alert.
      await topo.clickStart();

      // Wait briefly
      await topo.page.waitForTimeout(100);

      // Ensure we got at least one dialog message from the handler
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      expect(dialogMessages[0].message).toBe('Topological Sort starts here!');
    });
  });
});