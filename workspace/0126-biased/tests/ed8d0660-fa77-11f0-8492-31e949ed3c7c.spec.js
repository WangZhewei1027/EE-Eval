import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d0660-fa77-11f0-8492-31e949ed3c7c.html';

// Page object for the AVL Tree Visualization page
class AVLPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.root = page;
    this.header = page.locator('h1');
    this.tree = page.locator('.tree');
    this.nodes = page.locator('.node');
    this.learnMoreBtn = page.locator('.btn');
  }

  // Navigate to the page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the Learn More button (triggers alert in the app)
  async clickLearnMore() {
    return this.page.click('.btn');
  }

  // Click on the tree area
  async clickTree() {
    return this.page.click('.tree');
  }

  // Return the onclick attribute of the button
  async getButtonOnclick() {
    return this.learnMoreBtn.getAttribute('onclick');
  }

  // Count nodes
  async nodeCount() {
    return this.nodes.count();
  }

  // Get text content of nth node (0-based)
  async nodeTextAt(index) {
    const locator = this.nodes.nth(index);
    return locator.textContent();
  }
}

test.describe('AVL Tree Visualization - FSM and UI tests (ed8d0660-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Collections to capture runtime observations per test
  let pageErrors;
  let consoleMessages;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    // Initialize capture arrays
    pageErrors = [];
    consoleMessages = [];
    dialogMessages = [];

    // Listen for uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // store the actual Error objects for assertions / debugging
      pageErrors.push(err);
    });

    // Capture console messages and their types
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture dialogs (alerts) and accept them automatically while storing their messages
    page.on('dialog', async (dialog) => {
      try {
        dialogMessages.push({ type: dialog.type(), message: dialog.message() });
        await dialog.accept();
      } catch (e) {
        // If accepting fails for any reason, capture that as a page error representation
        pageErrors.push(e);
      }
    });

    // Navigate to app URL exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test ensure there were no unexpected page errors.
    // We assert zero page errors here for visibility; individual tests can still assert on errors when appropriate.
    expect(pageErrors.length).toBe(0);
  });

  test('Initial state S0_Idle renders expected elements and entry actions (renderPage)', async ({ page }) => {
    // This test validates the Idle state rendering (entry action renderPage implied by DOM)
    // and checks presence of expected components from FSM extraction.

    const app = new AVLPage(page);

    // Header should be present and correct
    await expect(app.header).toHaveText('AVL Tree Visualization');

    // The .tree container should be present and have the 'animated' class (CSS entry animation)
    await expect(app.tree).toHaveClass(/animated/);

    // There should be 7 nodes as provided in the HTML
    const count = await app.nodeCount();
    expect(count).toBe(7);

    // Check a few node labels to ensure content is rendered as expected
    const firstNode = (await app.nodeTextAt(0))?.trim();
    const secondNode = (await app.nodeTextAt(1))?.trim();
    const thirdNode = (await app.nodeTextAt(2))?.trim();
    expect(firstNode).toContain('30');
    expect(secondNode).toContain('20');
    expect(thirdNode).toContain('40');

    // Ensure the Learn More button exists and has the expected text and onclick attribute
    await expect(app.learnMoreBtn).toHaveText('Learn More');
    const onclick = await app.getButtonOnclick();
    expect(onclick).toBe("alert('This is an AVL Tree!')");

    // Validate there were no console errors emitted during initial load
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('LearnMore_Click event triggers alert and does not change Idle state (transition S0_Idle -> S0_Idle)', async ({ page }) => {
    // This test validates the Learn More click event described in the FSM:
    // - clicking the button should trigger alert('This is an AVL Tree!')
    // - the FSM transition stays in Idle and does not change the DOM (no observable state change)

    const app = new AVLPage(page);

    // Ensure dialogMessages is empty initially
    expect(dialogMessages.length).toBe(0);

    // Use waitForEvent to ensure we catch the dialog that the click will produce.
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      app.clickLearnMore()
    ]);

    // The page.on('dialog') handler also accepts dialogs; the waitForEvent returns the dialog instance
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe("This is an AVL Tree!");
    // Note: our page.on('dialog') accepted it already; we still verify message here

    // The dialog handler in beforeEach also stores the message
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    const captured = dialogMessages[dialogMessages.length - 1];
    expect(captured.message).toBe("This is an AVL Tree!");
    expect(captured.type).toBe('alert');

    // After clicking, verify DOM remains in Idle state: node count should be unchanged
    const countAfter = await app.nodeCount();
    expect(countAfter).toBe(7);

    // Ensure no console errors occurred
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking non-interactive area does not trigger LearnMore alert (no spurious transitions)', async ({ page }) => {
    // This test validates that clicking in other parts of the page (the tree) does not trigger the Learn More alert,
    // i.e., no event is fired other than normal clicks and no state change occurs.

    const app = new AVLPage(page);

    // Reset any captured dialogs so far
    dialogMessages = [];

    // Click the tree area (non-button)
    await app.clickTree();

    // Wait briefly allowing any unexpected dialogs to show up if they would
    await page.waitForTimeout(300);

    // Assert that no dialogs were created by clicking the tree area
    const foundAlert = dialogMessages.find((d) => d.type === 'alert');
    expect(foundAlert).toBeUndefined();

    // Confirm DOM is unchanged
    const nodeCount = await app.nodeCount();
    expect(nodeCount).toBe(7);
  });

  test('Edge case: interacting with a missing selector throws an error (Playwright-level error)', async ({ page }) => {
    // This test validates behavior when a user/action attempts to interact with a non-existent selector.
    // We expect Playwright to throw an error (no silent recovery), which we assert occurs naturally.

    // Attempt to click a selector that does not exist on the page, expecting rejection.
    await expect(page.click('.btn-nonexistent')).rejects.toThrow();

    // No page runtime errors should be produced from the page itself as a result of the failed command.
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console messages and page errors - ensure none of the severe error types are present', async ({ page }) => {
    // This test collects console messages and page errors for visibility and asserts
    // there are no severe issues (no console.error and no uncaught page exceptions).
    // This is important to ensure the FSM's Idle state entry action did not trigger JS runtime faults.

    // Allow any late console messages / page errors to appear
    await page.waitForTimeout(200);

    // Confirm no page errors were observed
    expect(pageErrors.length).toBe(0);

    // Confirm no console.error messages were emitted
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Optionally capture other console output for debugging (do not assert their absence)
    // but assert that any console messages are strings
    for (const msg of consoleMessages) {
      expect(typeof msg.text).toBe('string');
      expect(msg.text.length).toBeGreaterThanOrEqual(0);
    }
  });
});