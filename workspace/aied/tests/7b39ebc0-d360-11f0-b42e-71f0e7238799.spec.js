import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b39ebc0-d360-11f0-b42e-71f0e7238799.html';

// Page Object representing the linked list demo page
class LinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      input: '#nodeInput',
      addBtn: '#addBtn',
      removeBtn: '#removeBtn',
      list: '#list',
      node: '.node',
      link: '.link',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Adds a node with the given value via the UI
  async addNode(value) {
    await this.page.fill(this.selectors.input, value);
    await this.page.click(this.selectors.addBtn);
  }

  // Clicks add button without typing (useful for empty input edge-case)
  async clickAddEmpty() {
    await this.page.click(this.selectors.addBtn);
  }

  // Removes the head node via the UI
  async removeNode() {
    await this.page.click(this.selectors.removeBtn);
  }

  // Returns an array of node text values in the current DOM order
  async getNodeValues() {
    return this.page.$$eval(this.selectors.node, nodes => nodes.map(n => n.innerText));
  }

  // Returns the raw innerText of the list container (useful to verify ' -> ' links)
  async getListText() {
    return this.page.$eval(this.selectors.list, el => el.innerText);
  }

  // Returns count of link elements (the ' -> ' spans) present
  async getLinkCount() {
    return this.page.$$eval(this.selectors.link, links => links.length);
  }

  // Returns current value of the input
  async getInputValue() {
    return this.page.$eval(this.selectors.input, el => el.value);
  }
}

test.describe('Linked List Demonstration - FSM Tests', () => {
  // Record console messages and page errors observed during each test
  let consoleMessages;
  let pageErrors;
  let linkedListPage;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (info, warning, error, log)
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught exceptions on the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    linkedListPage = new LinkedListPage(page);

    // navigate after attaching listeners so we capture load-time issues
    await linkedListPage.goto();
  });

  test.afterEach(async ({ }, testInfo) => {
    // If there were page errors, include them in the test failure message
    if (pageErrors.length > 0) {
      const messages = pageErrors.map(e => e && e.message ? e.message : String(e)).join('\n---\n');
      testInfo.attach('pageErrors', { body: messages, contentType: 'text/plain' });
    }

    if (consoleMessages.length > 0) {
      const msgs = consoleMessages.map(m => `[${m.type}] ${m.text}`).join('\n');
      testInfo.attach('consoleMessages', { body: msgs, contentType: 'text/plain' });
    }
  });

  // Test initial Idle state: presence of components and empty list
  test('S0_Idle - Initial render shows input, buttons and an empty list', async ({ page }) => {
    // Validate presence of input and buttons (evidence of S0_Idle)
    await expect(page.locator('#nodeInput')).toBeVisible();
    await expect(page.locator('#addBtn')).toBeVisible();
    await expect(page.locator('#removeBtn')).toBeVisible();

    // The list should be present but empty (no .node elements)
    const nodes = await page.$$('.node');
    expect(nodes.length).toBe(0);

    // The list container should be empty string or whitespace only
    const listText = await linkedListPage.getListText();
    expect(listText.trim()).toBe('');

    // Assert no runtime errors occurred during initial render
    expect(pageErrors.length).toBe(0);
    // Also ensure no console errors were emitted
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  // Test adding a single node transitions to S1_NodeAdded
  test('S0_Idle -> S1_NodeAdded - Adding a single node updates the DOM and clears input', async () => {
    // Add node "A"
    await linkedListPage.addNode('A');

    // After adding, the input should be cleared (entry/exit action behavior)
    const inputVal = await linkedListPage.getInputValue();
    expect(inputVal).toBe('');

    // One node should be present with value 'A'
    const values = await linkedListPage.getNodeValues();
    expect(values).toEqual(['A']);

    // No link spans should exist for a single node
    const linkCount = await linkedListPage.getLinkCount();
    expect(linkCount).toBe(0);

    // No errors should have been emitted in this interaction
    expect(pageErrors.length).toBe(0);
  });

  // Test adding multiple nodes: remains in S1_NodeAdded and adds additional nodes
  test('S1_NodeAdded -> S1_NodeAdded - Adding multiple nodes appends at tail and shows links', async () => {
    // Add nodes A then B
    await linkedListPage.addNode('A');
    await linkedListPage.addNode('B');

    // DOM should reflect two nodes in order
    const values = await linkedListPage.getNodeValues();
    expect(values).toEqual(['A', 'B']);

    // There should be exactly one link span between the two nodes
    const linkCount = await linkedListPage.getLinkCount();
    expect(linkCount).toBe(1);

    // The textual representation should include the arrow '->' (as per implementation ' -> ')
    const listText = await linkedListPage.getListText();
    expect(listText.includes('->')).toBeTruthy();

    // Ensure no page errors
    expect(pageErrors.length).toBe(0);
  });

  // Test removals: S1_NodeAdded -> S2_NodeRemoved and repeated removals S2_NodeRemoved -> S2_NodeRemoved
  test('S1_NodeAdded -> S2_NodeRemoved -> S2_NodeRemoved - Removing nodes updates head and eventually empties list', async () => {
    // Set up three nodes: A, B, C
    await linkedListPage.addNode('A');
    await linkedListPage.addNode('B');
    await linkedListPage.addNode('C');

    // Validate initial sequence
    let values = await linkedListPage.getNodeValues();
    expect(values).toEqual(['A', 'B', 'C']);

    // Remove once: head should become B
    await linkedListPage.removeNode();
    values = await linkedListPage.getNodeValues();
    expect(values).toEqual(['B', 'C']);

    // Remove again: head should become C
    await linkedListPage.removeNode();
    values = await linkedListPage.getNodeValues();
    expect(values).toEqual(['C']);

    // Remove final node: list becomes empty
    await linkedListPage.removeNode();
    values = await linkedListPage.getNodeValues();
    expect(values).toEqual([]);

    // Ensure no page errors occurred during these transitions
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: Removing when list is already empty should be a no-op and not throw
  test('S2_NodeRemoved - Removing on empty list should not throw and list remains empty', async () => {
    // Ensure list is empty at start
    const initialNodes = await linkedListPage.getNodeValues();
    expect(initialNodes.length).toBe(0);

    // Attempt to remove from empty list
    await linkedListPage.removeNode();

    // Still empty and no errors
    const nodesAfter = await linkedListPage.getNodeValues();
    expect(nodesAfter.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: clicking Add Node with empty input triggers an alert dialog
  test('Edge Case - Clicking Add Node with empty input triggers "Please enter a value." alert', async ({ page }) => {
    // Ensure input is empty
    await page.fill('#nodeInput', '');

    // Wait for dialog to appear and capture it
    const dialogPromise = new Promise(resolve => {
      page.once('dialog', async dialog => {
        try {
          // Verify alert text is exactly as implemented
          expect(dialog.message()).toBe('Please enter a value.');
          // Dismiss the alert to let the test continue
          await dialog.dismiss();
          resolve(true);
        } catch (err) {
          // propagate failures
          resolve(err);
        }
      });
    });

    // Click add with empty input
    await linkedListPage.clickAddEmpty();

    const result = await dialogPromise;
    if (result instanceof Error) throw result;

    // Confirm list still empty and no page error was thrown by alert handling
    const nodes = await linkedListPage.getNodeValues();
    expect(nodes.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Monitor console messages and assert there are no console.error entries during typical usage
  test('Console Monitoring - Typical usage emits no console.error messages', async () => {
    // perform a few interactions
    await linkedListPage.addNode('X');
    await linkedListPage.addNode('Y');
    await linkedListPage.removeNode();

    // Assert there were no console.error messages captured
    const errorMessages = consoleMessages.filter(m => m.type === 'error');
    if (errorMessages.length > 0) {
      // Attach console errors to test output for debugging
      const joined = errorMessages.map(m => m.text).join('\n---\n');
      test.info().attach('consoleErrors', { body: joined, contentType: 'text/plain' });
    }
    expect(errorMessages.length).toBe(0);

    // Also ensure no runtime page errors were emitted
    expect(pageErrors.length).toBe(0);
  });

  // Quick smoke test to validate DOM structure after several operations (visual feedback)
  test('Visual Feedback - Node elements have correct classes and structure with links between nodes', async () => {
    await linkedListPage.addNode('1');
    await linkedListPage.addNode('2');
    await linkedListPage.addNode('3');

    // Nodes should have class 'node'
    const nodeHandles = await linkedListPage.page.$$(linkedListPage.selectors.node);
    expect(nodeHandles.length).toBe(3);

    for (const handle of nodeHandles) {
      const cls = await handle.getAttribute('class');
      expect(cls).toContain('node');
    }

    // Links should have class 'link' and their text should be ' -> '
    const linkHandles = await linkedListPage.page.$$(linkedListPage.selectors.link);
    expect(linkHandles.length).toBe(2);
    for (const handle of linkHandles) {
      const cls = await handle.getAttribute('class');
      expect(cls).toContain('link');
      const txt = (await handle.innerText()).trim();
      expect(txt).toBe('->' || '->' /* tolerant if whitespace trimmed */);
    }

    // Final check: no page errors
    expect(pageErrors.length).toBe(0);
  });
});