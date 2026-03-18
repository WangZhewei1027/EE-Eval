import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3706390-ffc4-11f0-821c-7d25bc609266.html';

// Page Object Model for the interactive application
class BinaryTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.showDemoBtn = page.locator('#showDemoBtn');
    this.demoOutput = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async clickShowDemo() {
    await this.showDemoBtn.click();
  }

  async getOutputText() {
    return await this.demoOutput.textContent();
  }

  async waitForOutputNonEmpty(timeout = 2000) {
    await expect(this.demoOutput).not.toHaveText('', { timeout });
  }
}

test.describe('FSM: Understanding Binary Trees - Interactive Traversal Demonstration', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Attach listeners per test to observe console and page errors (do not modify page code)
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });
  });

  // Test the Idle state (S0_Idle) is rendered correctly on page load
  test('S0_Idle: Page loads with "Show Traversal Demonstration" button and empty demo output', async ({ page }) => {
    // Arrange
    const model = new BinaryTreePage(page);
    await model.goto();

    // Assert: the button exists and is visible with correct text (evidence for S0_Idle)
    await expect(model.showDemoBtn).toBeVisible();
    await expect(model.showDemoBtn).toHaveText('Show Traversal Demonstration');

    // Assert: demo output region exists, is empty, and has the correct accessibility attributes
    await expect(model.demoOutput).toBeVisible();
    const ariaLive = await model.demoOutput.getAttribute('aria-live');
    const role = await model.demoOutput.getAttribute('role');
    expect(ariaLive).toBe('polite');
    expect(role).toBe('region');

    const initialText = await model.getOutputText();
    // Expect initial demo output to be empty string (state S0_Idle evidence)
    expect(initialText === '' || initialText === null).toBeTruthy();

    // Observe console & page errors: the page should not throw errors just on load
    // Capture them but do not attempt to patch or modify the application
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test the transition from S0_Idle -> S1_DemoShown via clicking the button (ShowDemo event)
  test('ShowDemo event transitions to S1_DemoShown and displays traversal results', async ({ page }) => {
    // Arrange
    const model = new BinaryTreePage(page);
    await model.goto();

    // Pre-assert: Ensure we're in S0_Idle before clicking
    const beforeText = await model.getOutputText();
    expect(beforeText === '' || beforeText === null).toBeTruthy();

    // Act: Click the button to trigger the ShowDemo event
    await model.clickShowDemo();

    // Assert: Wait for output to be populated (displayTraversalResults() entry action evidence)
    await model.waitForOutputNonEmpty();

    const output = await model.getOutputText();
    expect(output).toBeTruthy();

    // Verify the displayed text contains the expected traversal headings and values.
    // These exact sequences are produced by the inline script's tree:
    // Tree values: 10 (root), left subtree 5 -> (2,7), right subtree 12 -> (null,15)
    // Preorder: 10, 5, 2, 7, 12, 15
    // Inorder: 2, 5, 7, 10, 12, 15
    // Postorder: 2, 7, 5, 15, 12, 10
    expect(output).toContain('Traversals result in:');
    expect(output).toContain('Preorder (Root, Left, Right): 10, 5, 2, 7, 12, 15');
    expect(output).toContain('Inorder (Left, Root, Right): 2, 5, 7, 10, 12, 15');
    expect(output).toContain('Postorder (Left, Right, Root): 2, 7, 5, 15, 12, 10');

    // Verify that the ASCII representation of the tree is included (spacing preserved by pre-wrap)
    expect(output).toContain('10');
    expect(output).toContain('5');
    expect(output).toContain('12');
    // Basic shape check: right child arrow/backslash lines should be present in the output block
    expect(output).toContain('\\');

    // Confirm no unexpected runtime errors were emitted during the interaction
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test repeated interactions and idempotence: clicking multiple times should result in consistent output
  test('Clicking the Show Traversal Demonstration button multiple times keeps traversal output consistent', async ({ page }) => {
    const model = new BinaryTreePage(page);
    await model.goto();

    // First click: generate output
    await model.clickShowDemo();
    await model.waitForOutputNonEmpty();
    const firstOutput = await model.getOutputText();
    expect(firstOutput).toContain('Traversals result in:');

    // Second click: should overwrite with the same content (no duplication)
    await model.clickShowDemo();
    // Small wait to allow handler to run again (it is synchronous but keep consistent check)
    await model.page.waitForTimeout(50);
    const secondOutput = await model.getOutputText();

    // They should be identical (the handler constructs the same string each time)
    expect(secondOutput).toBe(firstOutput);

    // Confirm no new page errors or console error messages appeared after repeated clicks
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge-case: Ensure the demo output area respects whitespace and preformatted content styling
  test('Demo output preserves whitespace and formatting (pre-wrap) for readability', async ({ page }) => {
    const model = new BinaryTreePage(page);
    await model.goto();

    // Verify CSS property for white-space is present in the stylesheet by inspecting computed style
    // Note: We do not modify the page; we just read computed style which reflects the included CSS
    const whiteSpace = await model.demoOutput.evaluate((el) => {
      return window.getComputedStyle(el).whiteSpace;
    });
    // The stylesheet sets white-space: pre-wrap;
    expect(whiteSpace).toBe('pre-wrap');

    // Trigger the demo to populate content and confirm spacing-lines (ASCII art) are present
    await model.clickShowDemo();
    await model.waitForOutputNonEmpty();
    const output = await model.getOutputText();

    // The top of the output includes a block showing "10" indented - check for leading spaces followed by 10
    // We look for a substring with multiple spaces followed by 10 (common in the ASCII art)
    expect(output).toMatch(/\s{6,}10/);

    // Ensure no page errors occurred while rendering formatted text
    expect(pageErrors.length).toBe(0);
  });

  // Validate accessibility and DOM evidence for FSM states and transitions
  test('FSM evidence: #showDemoBtn trigger exists and #demo-output displays textContent on transition', async ({ page }) => {
    const model = new BinaryTreePage(page);
    await model.goto();

    // Evidence: event handler registration is present in source; while we cannot introspect listeners directly
    // we can assert the button exists and clicking it updates the demo-output.textContent (as FSM evidence mentions)
    await expect(model.showDemoBtn).toBeVisible();
    await expect(model.demoOutput).toBeVisible();

    // Click to transition state
    await model.clickShowDemo();
    await model.waitForOutputNonEmpty();
    const textBefore = await model.getOutputText();
    expect(typeof textBefore).toBe('string');
    expect(textBefore.length).toBeGreaterThan(10); // reasonable content length

    // As an edge check: ensure the demo-output element's textContent is not empty (verifies "outputDiv.textContent = outputText;")
    const textContent = await model.demoOutput.evaluate(el => el.textContent);
    expect(textContent && textContent.trim().length).toBeGreaterThan(0);

    // Confirm no runtime exceptions were thrown
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});