import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25c91832-fa7c-11f0-ba20-415c525382ea.html';

/**
 * Page Object for the Binary Trees demo page.
 * Encapsulates selectors and common interactions.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.showInorderBtn = page.locator('#showInorder');
    this.outputDiv = page.locator('#demoOutput');

    // Collections to capture console messages and page errors for assertions
    this.consoleMessages = [];
    this.pageErrors = [];
    this.consoleListener = msg => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    };
    this.pageErrorListener = err => {
      // Page 'pageerror' yields Error objects
      this.pageErrors.push({
        message: err.message,
        stack: err.stack ? String(err.stack) : ''
      });
    };
  }

  // Attach listeners to collect console and page errors
  async attachListeners() {
    this.page.on('console', this.consoleListener);
    this.page.on('pageerror', this.pageErrorListener);
  }

  // Remove listeners (teardown)
  async detachListeners() {
    this.page.off('console', this.consoleListener);
    this.page.off('pageerror', this.pageErrorListener);
  }

  // Navigate to the app and wait for initial load
  async goto() {
    await this.attachListeners();
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure main button is present before proceeding
    await expect(this.showInorderBtn).toBeVisible();
  }

  // Click the 'Show Inorder' button
  async clickShowInorder() {
    await this.showInorderBtn.click();
  }

  // Get the raw textContent of the demo output div
  async getOutputText() {
    return (await this.outputDiv.evaluate(el => el.textContent)) ?? '';
  }

  // Return number of captured console error messages
  getConsoleErrors() {
    return this.consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
  }
}

test.describe('Understanding Binary Trees - Interactive Demo (FSM validation)', () => {
  let demo;

  // Setup: create new page and DemoPage for each test
  test.beforeEach(async ({ page }) => {
    demo = new DemoPage(page);
    await demo.goto();
  });

  // Teardown: detach listeners for cleanliness
  test.afterEach(async () => {
    await demo.detachListeners();
  });

  test('S0_Idle: Initial state renders the button and empty output (entry actions verification)', async () => {
    // This test validates the Idle state (S0_Idle) evidence and entry actions expectations.
    // 1. The "Show Inorder Traversal for Example Tree" button must be present and visible.
    await expect(demo.showInorderBtn).toBeVisible();
    await expect(demo.showInorderBtn).toHaveText('Show Inorder Traversal for Example Tree');

    // 2. The demo output div should exist and be initially empty (Idle state's evidence).
    const initialOutput = await demo.getOutputText();
    expect(initialOutput).toBe('', 'Expected demo output to be empty on initial load (Idle state)');

    // 3. Verify ARIA attributes exist on the output container (component evidence)
    await expect(demo.outputDiv).toHaveAttribute('aria-live', 'polite');
    await expect(demo.outputDiv).toHaveAttribute('aria-atomic', 'true');

    // 4. FSM meta indicated an entry action renderPage(), but the implementation does not expose a global renderPage.
    //    We assert that renderPage is not defined on the window object (do NOT inject or patch anything).
    const renderPageType = await demo.page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // 5. Ensure no runtime page errors or console errors occurred during initial rendering.
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.getConsoleErrors().length).toBe(0);
  });

  test('Transition ShowInorder: Clicking button moves from S0_Idle -> S1_InorderDisplayed and displays correct traversal', async () => {
    // This test validates the transition triggered by the ShowInorder event.
    // 1. Click the button to trigger showInorder()
    await demo.clickShowInorder();

    // 2. Verify the output DOM changed to show the inorder traversal text exactly as expected.
    const outputText = await demo.getOutputText();

    // Expected exact text including newline and " → " separators.
    const expected = 'Inorder Traversal:\n3 → 5 → 7 → 10 → 20 → 30';
    expect(outputText).toBe(expected);

    // 3. Validate that the output visually replaces the content (textContent is used in implementation).
    await expect(demo.outputDiv).toHaveText(expected);

    // 4. Confirm that the event handler evidence exists: the button should still be present and clickable.
    await expect(demo.showInorderBtn).toBeVisible();

    // 5. No runtime errors should be observed as a result of clicking the button.
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.getConsoleErrors().length).toBe(0);
  });

  test('Idempotency and edge case: Multiple clicks do not append duplicate content or corrupt the output', async () => {
    // Validate edge case: clicking the button multiple times should produce the same clean output
    // because the implementation sets textContent rather than appending.

    // 1st click
    await demo.clickShowInorder();
    const first = await demo.getOutputText();
    const expected = 'Inorder Traversal:\n3 → 5 → 7 → 10 → 20 → 30';
    expect(first).toBe(expected);

    // 2nd click
    await demo.clickShowInorder();
    const second = await demo.getOutputText();
    expect(second).toBe(expected);

    // 3rd click
    await demo.clickShowInorder();
    const third = await demo.getOutputText();
    expect(third).toBe(expected);

    // Ensure no duplicates or extra characters are introduced after multiple clicks
    expect(first).toBe(second);
    expect(second).toBe(third);

    // Also ensure no console error or page errors were emitted in the process
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.getConsoleErrors().length).toBe(0);
  });

  test('FSM state evidence and component checks: button and output selectors and accessibility attributes', async () => {
    // Grouped assertions to validate the FSM's component evidence and correctness of DOM selectors.

    // Verify button selector exists and matches FSM evidence
    await expect(demo.page.locator('#showInorder')).toHaveCount(1);

    // Verify output selector exists and matches FSM evidence
    await expect(demo.page.locator('#demoOutput')).toHaveCount(1);

    // Confirm that the output container has CSS that allows preformatted text (white-space: pre-wrap)
    // We check the computed style for white-space to ensure pre-wrap is applied as in the HTML.
    const whiteSpace = await demo.outputDiv.evaluate(el => getComputedStyle(el).whiteSpace);
    expect(whiteSpace.includes('pre') || whiteSpace.includes('pre-wrap')).toBeTruthy();

    // Confirm button styling exists by checking a basic computed property (backgroundColor should not be empty)
    const btnBg = await demo.showInorderBtn.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(btnBg).toBeTruthy();

    // No runtime errors in these DOM inspections
    expect(demo.pageErrors.length).toBe(0);
  });

  test('Negative check: show that inorderTraversal and showInorder are not globally exposed (scoping verification)', async () => {
    // The implementation wraps functions in an IIFE. We must not attempt to modify scope.
    // Verify that internal functions are not available globally, reinforcing that we cannot call them directly.

    const globalInorderType = await demo.page.evaluate(() => typeof window.inorderTraversal);
    const globalShowInorderType = await demo.page.evaluate(() => typeof window.showInorder);

    // Both should be undefined because those functions are closed over within the IIFE.
    expect(globalInorderType).toBe('undefined');
    expect(globalShowInorderType).toBe('undefined');

    // Trigger the UI button to confirm functionality still works via event binding (black-box)
    await demo.clickShowInorder();
    await expect(demo.outputDiv).toHaveText('Inorder Traversal:\n3 → 5 → 7 → 10 → 20 → 30');

    // No errors
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.getConsoleErrors().length).toBe(0);
  });

  test('Console and page error observation: capture any runtime errors or ReferenceErrors if they occur naturally', async () => {
    // This test's purpose is to observe and assert on console/page errors that happen naturally.
    // We do NOT inject errors or modify the page. We simply assert expectations about collected errors.

    // Perform actions that exercise the page
    await demo.clickShowInorder();

    // Wait a short time to allow any asynchronous errors to surface (if any)
    await demo.page.waitForTimeout(100);

    // Collect any console errors or page errors captured
    const consoleErrors = demo.getConsoleErrors();
    const pageErrors = demo.pageErrors;

    // The canonical implementation is synchronous and correct; expect zero errors.
    // If any errors are present, we include diagnostic information in the assertion message.
    expect(consoleErrors.length, `Console errors were observed: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `Page errors were observed: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
  });
});