import { test, expect } from '@playwright/test';

// Page Object for the Binary Tree page
class BinaryTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Navigate to the application URL
  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-balanced/html/52085c90-fa76-11f0-a09b-87751f540fd8.html', { waitUntil: 'load' });
  }

  // Get visible heading text
  async getHeadingText() {
    const el = await this.page.locator('.tree h2');
    return el.textContent();
  }

  // Get the raw text inside the <pre><code> block
  async getCodeBlockText() {
    const el1 = await this.page.locator('.tree pre code');
    return el.textContent();
  }

  // Count common interactive elements (buttons, inputs, anchors with href, textareas, selects)
  async countInteractiveElements() {
    return await this.page.evaluate(() => {
      const selectors = ['button', 'input', 'textarea', 'select', 'a[href]'];
      return selectors.reduce((count, sel) => count + document.querySelectorAll(sel).length, 0);
    });
  }

  // Count elements with class .node (visual nodes) - none expected in this static page
  async countNodeElements() {
    return await this.page.locator('.node').count();
  }

  // Return full page HTML content (for searching attributes like onclick or addEventListener)
  async getPageContent() {
    return await this.page.content();
  }

  // Click the main tree container (should not trigger interactive behavior)
  async clickTreeContainer() {
    await this.page.click('.tree');
  }
}

test.describe('52085c90-fa76-11f0-a09b-87751f540fd8 - Binary Tree Interactive App (FSM validation)', () => {
  // Arrays to collect console messages and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Setup collectors before navigation so we capture runtime errors during load
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Collect only text messages for assertions
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    page.on('pageerror', (err) => {
      // pageerror provides an Error object; capture it
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Teardown: clear arrays (good practice, though Playwright isolates tests)
    consoleMessages = [];
    pageErrors = [];
  });

  test('Page loads and displays static Binary Tree content (Idle state verification)', async ({ page }) => {
    // Validate the page loads and static content matches expectations for the Idle FSM state.
    const app = new BinaryTreePage(page);
    await app.goto();

    // The page must show the main heading "Binary Tree"
    const heading = await app.getHeadingText();
    expect(heading).toBeTruthy();
    expect(heading.trim()).toContain('Binary Tree');

    // The code block should contain the source code snippet (static, not executed)
    const codeText = await app.getCodeBlockText();
    expect(codeText).toBeTruthy();
    // Check for key identifiers present in the code snippet that demonstrate content is intact
    expect(codeText).toContain('function createNode');
    expect(codeText).toContain('function insert');
    expect(codeText).toContain('function printTree');
    expect(codeText).toContain('let values = [5, 3, 7, 2, 4, 6, 8]');

    // There should be no interactive node elements created by runtime scripts (Idle state)
    const nodeCount = await app.countNodeElements();
    expect(nodeCount).toBe(0);

    // Check that there are no typical interactive form controls or links (this page is static)
    const interactiveCount = await app.countInteractiveElements();
    expect(interactiveCount).toBe(0);
  });

  test('FSM "Idle" - no event handlers present in the DOM or scripts', async ({ page }) => {
    // Validate that the page contains no inline onclick handlers and no addEventListener occurrences,
    // consistent with the extracted FSM that detected no event handlers.
    const app1 = new BinaryTreePage(page);
    await app.goto();

    const content = await app.getPageContent();

    // Search for common handlers or event registration patterns
    expect(content).not.toMatch(/addEventListener\s*\(/);
    expect(content).not.toMatch(/onclick\s*=/);
    // The page is expected to be static; ensure no "onchange", "oninput" appear either
    expect(content).not.toMatch(/onchange\s*=/);
    expect(content).not.toMatch(/oninput\s*=/);
  });

  test('Runtime error occurs due to missing global "root" variable - assert ReferenceError', async ({ page }) => {
    // The page's visible <code> snippet is not executed, but a separate script calls printNode(root)
    // where root is not defined in the global scope. We must assert that a ReferenceError (or similar)
    // is raised and observed via pageerror.
    const app2 = new BinaryTreePage(page);
    await app.goto();

    // Give the page a moment to emit errors during load
    await page.waitForTimeout(200); // small delay to ensure event propagation

    // There should be at least one page error captured
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one of the page errors should be a ReferenceError mentioning 'root' or 'is not defined'.
    const messages = pageErrors.map(e => String(e && e.message ? e.message : e));
    const hasRootRefError = messages.some(msg => /root/.test(msg) || /is not defined/.test(msg) || /ReferenceError/.test(msg));
    expect(hasRootRefError).toBeTruthy();

    // Also confirm that no tree printing console logs were produced (the printing code is inside the <pre> block and not executed).
    // Additionally, because printNode is invoked with an undefined root (causing ReferenceError when evaluating argument),
    // there should be no console logs like numeric node values ("5", "3", etc).
    const combinedConsole = consoleMessages.join('\n');
    expect(combinedConsole).not.toContain('5');
    expect(combinedConsole).not.toContain('3');
    expect(combinedConsole).not.toContain('7');
  });

  test('Interacting with static elements does not change state or produce additional errors', async ({ page }) => {
    // Edge case: clicking the container should not create new errors or change the DOM,
    // since the application is static and expected to remain in Idle.
    const app3 = new BinaryTreePage(page);
    await app.goto();

    // Snapshot current errors and messages
    const initialErrors = pageErrors.slice();
    const initialConsole = consoleMessages.slice();

    // Perform a user interaction (click on the tree container)
    await app.clickTreeContainer();

    // Allow potential side effects to surface
    await page.waitForTimeout(100);

    // After clicking, there should be no new page errors beyond the ones already observed at load.
    // (At load we already expect the ReferenceError; ensure no additional errors were triggered by user click.)
    expect(pageErrors.length).toBeLessThanOrEqual(initialErrors.length + 1); // allow the original error if not already captured
    // Ensure console logs did not suddenly include printed node values
    const combinedConsole1 = consoleMessages.join('\n');
    expect(combinedConsole).not.toContain('2');
    expect(combinedConsole).not.toContain('4');
    expect(combinedConsole).not.toContain('6');
    expect(combinedConsole).not.toContain('8');

    // Verify DOM still contains the static code block and heading (no state change)
    const heading1 = await app.getHeadingText();
    expect(heading.trim()).toContain('Binary Tree');
    const codeText1 = await app.getCodeBlockText();
    expect(codeText).toContain('function createNode');
  });

  test('Sanity: ensure no transitions or onEnter/onExit actions exist per FSM extraction', async ({ page }) => {
    // This test ensures that the application has no signs of transitions or lifecycle actions that would
    // be required for a multi-state interactive FSM. We check for common patterns that would suggest transitions.
    const app4 = new BinaryTreePage(page);
    await app.goto();

    const content1 = await app.getPageContent();

    // No explicit state machine libraries or common lifecycle hooks are present
    expect(content).not.toMatch(/xstate|stateMachine|onEnter|onExit|onExit\s*\(|onEnter\s*\(/i);

    // Also check there are no script tags that dynamically create nodes with classes like .node (should be absent)
    expect(content).not.toMatch(/className\s*=\s*["']node["']/);
    expect(content).not.toMatch(/class="node"/);
  });
});