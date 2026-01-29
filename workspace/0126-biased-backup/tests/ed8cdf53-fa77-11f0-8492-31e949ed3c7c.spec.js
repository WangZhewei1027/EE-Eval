import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8cdf53-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page Object for the BST Visualization page.
 * Encapsulates common interactions and queries used by the tests below.
 */
class BSTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('#bst-container');
    this.showButton = page.locator('#showTree');
    this.nodeLocator = page.locator('.node');
    this.linkLocator = page.locator('.link');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the basic UI to be ready
    await this.page.waitForLoadState('networkidle');
    await expect(this.showButton).toBeVisible();
    await expect(this.container).toBeVisible();
  }

  async getContainerInnerHTML() {
    const html = await this.container.evaluate((el) => el.innerHTML);
    return html;
  }

  async clickShowTree() {
    await this.showButton.click();
  }

  async nodeCount() {
    return await this.nodeLocator.count();
  }

  async linkCount() {
    return await this.linkLocator.count();
  }

  async firstNodeText() {
    return await this.nodeLocator.first().innerText();
  }

  async firstNodeStyle() {
    return await this.nodeLocator.first().evaluate((el) => {
      return { left: el.style.left, top: el.style.top };
    });
  }
}

test.describe('Binary Search Tree Visualization - FSM and UI tests', () => {
  // Collect console messages and page errors per test
  test.beforeEach(async ({ page }) => {
    // Ensure any console and page errors are observable during each test.
    // We don't modify the page; we only observe.
  });

  test('Idle State (S0_Idle) - initial render shows Show BST button and empty container', async ({ page }) => {
    // Capture console and page errors for assertions later in the test
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const bst = new BSTPage(page);
    // Navigate to the page (renders the page as-is)
    await bst.goto();

    // Validate Idle state evidence:
    // - The "Show BST" button exists and has correct text (evidence from FSM)
    await expect(bst.showButton).toBeVisible();
    await expect(bst.showButton).toHaveText('Show BST');

    // - The BST container should initially be empty (entry action renderPage produced empty state)
    const initialHTML = await bst.getContainerInnerHTML();
    expect(initialHTML.trim()).toBe('', 'Expected BST container to be empty in Idle state');

    // Validate there are no page errors or console errors on initial render.
    // Tests are observing runtime errors naturally; assert none occurred.
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Assert that no ReferenceError/TypeError/SyntaxError text appeared in console
    const joined = consoleMessages.map((m) => m.text).join(' ');
    expect(joined).not.toMatch(/ReferenceError/);
    expect(joined).not.toMatch(/TypeError/);
    expect(joined).not.toMatch(/SyntaxError/);
  });

  test('Transition ShowTreeClick: Clicking Show BST transitions to Tree Visible (S1_TreeVisible)', async ({ page }) => {
    // Capture console and page errors for assertions later in the test
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const bst = new BSTPage(page);
    await bst.goto();

    // Pre-condition: idle state, no nodes present
    expect(await bst.nodeCount()).toBe(0);

    // Trigger the event described in the FSM: ShowTreeClick
    await bst.clickShowTree();

    // After transition, the entry action for S1_TreeVisible is positionNodes(...) which
    // results in node DOM elements being created inside the container.
    // Validate that nodes are present in the container (expected observable).
    const nodes = await bst.nodeCount();
    // Observe actual implementation behavior: due to how positionNodes chooses midIndex,
    // the provided script will create one root node (based on midIndex of provided array).
    // We assert the actual observed behavior (single node created).
    expect(nodes).toBeGreaterThan(0);
    // Specifically, the current implementation results in a single node (value 1 at center index).
    // Assert we have at least one node; then assert expected details on the first node.
    expect(nodes).toBe(1);

    // Validate node content and placement reflect the positionNodes call with x=400,y=20
    const firstText = await bst.firstNodeText();
    expect(firstText.trim()).toBe('1', 'Expected the rendered root node to display value "1" (implementation-specific)');

    const styles = await bst.firstNodeStyle();
    expect(styles.left).toBe('400px');
    expect(styles.top).toBe('20px');

    // Links: given only one node is rendered, there should be no .link elements
    const links = await bst.linkCount();
    expect(links).toBe(0);

    // Validate that the container was cleared before nodes were added.
    // We cannot directly observe the intermediate state (clear then create) synchronously from outside,
    // but we can assert the final state is non-empty and that initial state was empty (already checked).
    const afterHTML = await bst.getContainerInnerHTML();
    expect(afterHTML.trim().length).toBeGreaterThan(0);

    // Validate again there were no runtime page errors during or after the transition.
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Ensure console does not contain ReferenceError/TypeError/SyntaxError traces.
    const joined = consoleMessages.map((m) => m.text).join(' ');
    expect(joined).not.toMatch(/ReferenceError/);
    expect(joined).not.toMatch(/TypeError/);
    expect(joined).not.toMatch(/SyntaxError/);
  });

  test('Idempotent / Edge case: Clicking Show BST multiple times clears and re-renders (no duplicate accumulation)', async ({ page }) => {
    // Observe console and page errors during this interaction
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const bst = new BSTPage(page);
    await bst.goto();

    // Click the button twice to simulate repeated user actions
    await bst.clickShowTree();
    const countAfterFirst = await bst.nodeCount();
    // Implementation currently produces a single node; assert at least one
    expect(countAfterFirst).toBeGreaterThan(0);

    // Click again - expected behavior per implementation: container is cleared and nodes re-created
    await bst.clickShowTree();
    const countAfterSecond = await bst.nodeCount();

    // The container should not accumulate duplicate nodes; it should be cleared and re-rendered.
    // The implementation creates the same structure again, so counts should be equal.
    expect(countAfterSecond).toBe(countAfterFirst);

    // Confirm the first node still has expected text and position after repeated clicks
    expect(await bst.firstNodeText()).toBe('1');
    const styles = await bst.firstNodeStyle();
    expect(styles.left).toBe('400px');
    expect(styles.top).toBe('20px');

    // There should be no JS runtime errors as a result of repeated clicks
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Ensure no ReferenceError/TypeError/SyntaxError occurred
    const joined = consoleMessages.map((m) => m.text).join(' ');
    expect(joined).not.toMatch(/ReferenceError/);
    expect(joined).not.toMatch(/TypeError/);
    expect(joined).not.toMatch(/SyntaxError/);
  });

  test('Negative/Edge checks: ensure unexpected selectors do not exist and application does not crash when interacting with unknown elements', async ({ page }) => {
    // This test ensures robustness: clicking other parts of the page or querying missing elements
    // does not produce runtime errors in the page environment.
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const bst = new BSTPage(page);
    await bst.goto();

    // Try to click a non-existent selector - this should be handled by Playwright (it will throw if forced),
    // so we only query its existence and ensure it's absent in the DOM, rather than invoking a click.
    const nonExistent = page.locator('#doesNotExist');
    expect(await nonExistent.count()).toBe(0);

    // Query for unexpected structural nodes
    const unexpectedNode = page.locator('.nonexistent-class');
    expect(await unexpectedNode.count()).toBe(0);

    // Ensure the page still functions after these checks: click show tree and validate nodes render
    await bst.clickShowTree();
    expect(await bst.nodeCount()).toBeGreaterThan(0);

    // No runtime errors during these interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Also check no standard JS error names were logged
    const joined = consoleMessages.map((m) => m.text).join(' ');
    expect(joined).not.toMatch(/ReferenceError/);
    expect(joined).not.toMatch(/TypeError/);
    expect(joined).not.toMatch(/SyntaxError/);
  });
});