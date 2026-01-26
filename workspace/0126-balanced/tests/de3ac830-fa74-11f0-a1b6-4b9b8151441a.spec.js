import { test, expect } from '@playwright/test';

// Test file for Application ID: de3ac830-fa74-11f0-a1b6-4b9b8151441a
// HTML served at:
// http://127.0.0.1:5500/workspace/0126-balanced/html/de3ac830-fa74-11f0-a1b6-4b9b8151441a.html

// Page object encapsulating interactions with the Doubly Linked List demo
class DllPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#nodeValue');
    this.btnPrepend = page.locator("button[onclick='prepend()']");
    this.btnAppend = page.locator("button[onclick='append()']");
    this.btnRemove = page.locator("button[onclick='removeNode()']");
    this.btnTraverseForward = page.locator("button[onclick='traverseForward()']");
    this.btnTraverseBackward = page.locator("button[onclick='traverseBackward()']");
    this.btnClear = page.locator("button[onclick='clearList()']");
    this.output = page.locator('#output');
    this.visualization = page.locator('#visualization');
  }

  async goto(url) {
    await this.page.goto(url, { waitUntil: 'load' });
  }

  async setInput(value) {
    await this.input.fill(String(value));
  }

  async clickPrepend() {
    await this.btnPrepend.click();
  }

  async clickAppend() {
    await this.btnAppend.click();
  }

  async clickRemove() {
    await this.btnRemove.click();
  }

  async clickTraverseForward() {
    await this.btnTraverseForward.click();
  }

  async clickTraverseBackward() {
    await this.btnTraverseBackward.click();
  }

  async clickClear() {
    await this.btnClear.click();
  }

  async getOutputText() {
    return (await this.output.innerText()).trim();
  }

  async getVisualizationText() {
    return (await this.visualization.innerText()).trim();
  }

  async getVisualizationNodeCount() {
    return await this.visualization.locator('.node').count();
  }

  async getVisualizationNodeValues() {
    // Extract values shown as [value] in visualization nodes
    const nodes = this.visualization.locator('.node');
    const count = await nodes.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      const html = await nodes.nth(i).innerHTML();
      // The strong tag contains [value]
      // We will extract the digits/characters inside brackets
      const match = html.match(/\[([^\]]+)\]/);
      values.push(match ? match[1].trim() : '');
    }
    return values;
  }

  async isInputEmpty() {
    return (await this.input.inputValue()).length === 0;
  }

  async getDllState() {
    // Safely read the dll object from the page if present
    return await this.page.evaluate(() => {
      return {
        hasDll: typeof dll !== 'undefined',
        headIsNull: (typeof dll !== 'undefined') ? (dll.head === null) : null,
        tailIsNull: (typeof dll !== 'undefined') ? (dll.tail === null) : null,
        length: (typeof dll !== 'undefined') ? dll.length : null
      };
    });
  }
}

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3ac830-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Doubly Linked List Demo - FSM coverage tests', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events to capture any errors or logs emitted by the page
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Basic initial state tests
  test.describe('Initial State (S0_Empty)', () => {
    test('Initial page loads and shows empty list evidence', async ({ page }) => {
      // This test validates entry actions for the initial state (dll.visualize())
      // and evidence that the list is empty: output shows message and dll.head is null.
      const dllPage = new DllPage(page);
      await dllPage.goto(APP_URL);

      // Verify output displays "List is currently empty."
      const outputText = await dllPage.getOutputText();
      expect(outputText).toContain('List is currently empty.');

      // Verify visualization shows "List is empty"
      const visText = await dllPage.getVisualizationText();
      expect(visText).toContain('List is empty');

      // Verify dll object exists and head is null (FSM evidence)
      const dllState = await dllPage.getDllState();
      expect(dllState.hasDll).toBe(true);
      expect(dllState.headIsNull).toBe(true);
      expect(dllState.tailIsNull).toBe(true);
      expect(dllState.length).toBe(0);

      // Assert no runtime page errors occurred during load
      expect(pageErrors.length).toBe(0);
      // Assert there are no console.error messages
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });
  });

  // Tests for transitions that mutate the list
  test.describe('Mutating operations (Prepend, Append, Remove)', () => {
    test('Prepend from empty transitions to non-empty (S0 -> S1)', async ({ page }) => {
      // This test validates Prepend event: adds node, updates output and visualization.
      const dllPage = new DllPage(page);
      await dllPage.goto(APP_URL);

      await dllPage.setInput(10);
      await dllPage.clickPrepend();

      // Output should show prepended message and current forward list
      const output = await dllPage.getOutputText();
      expect(output).toContain('Prepended 10 to the list.');
      expect(output).toContain('Current list (forward): 10');

      // Visualization should contain one node showing [10]
      const nodeCount = await dllPage.getVisualizationNodeCount();
      expect(nodeCount).toBe(1);
      const values = await dllPage.getVisualizationNodeValues();
      expect(values).toEqual(['10']);

      // Input should be cleared after operation
      expect(await dllPage.isInputEmpty()).toBe(true);

      // dll state should reflect non-empty list
      const dllState = await dllPage.getDllState();
      expect(dllState.headIsNull).toBe(false);
      expect(dllState.tailIsNull).toBe(false);
      expect(dllState.length).toBe(1);

      // Ensure no unexpected errors
      expect(pageErrors.length).toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });

    test('Append from empty transitions to non-empty (S0 -> S1)', async ({ page }) => {
      // Validate Append event works when starting from empty list.
      const dllPage = new DllPage(page);
      await dllPage.goto(APP_URL);

      await dllPage.setInput(20);
      await dllPage.clickAppend();

      const output = await dllPage.getOutputText();
      expect(output).toContain('Appended 20 to the list.');
      expect(output).toContain('Current list (forward): 20');

      const values = await dllPage.getVisualizationNodeValues();
      expect(values).toEqual(['20']);

      const dllState = await dllPage.getDllState();
      expect(dllState.length).toBe(1);

      expect(pageErrors.length).toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });

    test('Prepend and Append produce correct forward and backward structure', async ({ page }) => {
      // Validate multiple mutations: prepend, append produce correct traversal results.
      const dllPage = new DllPage(page);
      await dllPage.goto(APP_URL);

      // Start from empty: prepend 1, append 2, prepend 0 => expected order [0,1,2]
      await dllPage.setInput(1);
      await dllPage.clickPrepend();

      await dllPage.setInput(2);
      await dllPage.clickAppend();

      await dllPage.setInput(0);
      await dllPage.clickPrepend();

      // Check visualization node values in order
      const visValues = await dllPage.getVisualizationNodeValues();
      expect(visValues).toEqual(['0', '1', '2']);

      // Traverse forward via button
      await dllPage.clickTraverseForward();
      const forwardText = await dllPage.getOutputText();
      expect(forwardText).toContain('List traversed forward: 0 ⇄ 1 ⇄ 2');

      // Traverse backward via button
      await dllPage.clickTraverseBackward();
      const backwardText = await dllPage.getOutputText();
      expect(backwardText).toContain('List traversed backward: 2 ⇄ 1 ⇄ 0');

      // Confirm no runtime errors
      expect(pageErrors.length).toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });

    test('Remove existing node and attempt to remove non-existing node', async ({ page }) => {
      // Validate Remove event removes nodes and updateOutput handles both success and failure.
      const dllPage = new DllPage(page);
      await dllPage.goto(APP_URL);

      // Create list [5,6,7]
      await dllPage.setInput(6);
      await dllPage.clickAppend();
      await dllPage.setInput(5);
      await dllPage.clickPrepend();
      await dllPage.setInput(7);
      await dllPage.clickAppend();

      // Remove middle value 6
      await dllPage.setInput(6);
      await dllPage.clickRemove();
      const afterRemoveText = await dllPage.getOutputText();
      expect(afterRemoveText).toContain('Removed 6 from the list.');
      // Remaining should be [5,7]
      expect(afterRemoveText).toContain('Current list (forward): 5 ⇄ 7');
      const visValuesAfter = await dllPage.getVisualizationNodeValues();
      expect(visValuesAfter).toEqual(['5', '7']);

      // Attempt to remove non-existing value 99
      await dllPage.setInput(99);
      await dllPage.clickRemove();
      const notFoundText = await dllPage.getOutputText();
      expect(notFoundText).toContain('Value 99 not found in the list.');
      // List should remain unchanged
      const visValuesFinal = await dllPage.getVisualizationNodeValues();
      expect(visValuesFinal).toEqual(['5', '7']);

      // No runtime errors expected
      expect(pageErrors.length).toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });
  });

  // Tests for traversal and clearing (state transitions S1 -> S1 and S1 -> S0)
  test.describe('Traversal and Clear (S1_NonEmpty and Clear to S0)', () => {
    test('Traverse forward/backward reflect the current list contents', async ({ page }) => {
      // Ensure traversals produce correct output strings after mutations.
      const dllPage = new DllPage(page);
      await dllPage.goto(APP_URL);

      // Build list [A,B,C] using numbers to keep things simple
      await dllPage.setInput(100);
      await dllPage.clickAppend();
      await dllPage.setInput(200);
      await dllPage.clickAppend();
      await dllPage.setInput(300);
      await dllPage.clickAppend();

      // Traverse forward
      await dllPage.clickTraverseForward();
      const fwd = await dllPage.getOutputText();
      expect(fwd).toContain('List traversed forward: 100 ⇄ 200 ⇄ 300');

      // Traverse backward
      await dllPage.clickTraverseBackward();
      const bwd = await dllPage.getOutputText();
      expect(bwd).toContain('List traversed backward: 300 ⇄ 200 ⇄ 100');

      expect(pageErrors.length).toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });

    test('Clear transitions from non-empty to empty (S1 -> S0) and visual evidence', async ({ page }) => {
      // Validate Clear event empties the dll and updates UI accordingly.
      const dllPage = new DllPage(page);
      await dllPage.goto(APP_URL);

      // Create non-empty list
      await dllPage.setInput(9);
      await dllPage.clickAppend();

      // Ensure it's non-empty first
      const beforeClearState = await dllPage.getDllState();
      expect(beforeClearState.length).toBeGreaterThan(0);

      // Clear the list
      await dllPage.clickClear();
      const output = await dllPage.getOutputText();
      expect(output).toContain('List cleared. List is now empty.');

      // Visualization should show the empty placeholder
      const visText = await dllPage.getVisualizationText();
      expect(visText).toContain('List is empty');

      // dll internal state should be reset
      const dllState = await dllPage.getDllState();
      expect(dllState.headIsNull).toBe(true);
      expect(dllState.tailIsNull).toBe(true);
      expect(dllState.length).toBe(0);

      expect(pageErrors.length).toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });
  });

  // Edge cases and input validation
  test.describe('Edge cases and error scenarios', () => {
    test('Prepend without value shows validation message', async ({ page }) => {
      // Clicking prepend with empty input should prompt the user to enter a value.
      const dllPage = new DllPage(page);
      await dllPage.goto(APP_URL);

      // Ensure input is empty
      await dllPage.input.fill('');
      await dllPage.clickPrepend();

      const out = await dllPage.getOutputText();
      expect(out).toContain('Please enter a value');

      // No mutation should have occurred
      const dllState = await dllPage.getDllState();
      expect(dllState.length).toBe(0);

      expect(pageErrors.length).toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });

    test('Append without value shows validation message', async ({ page }) => {
      const dllPage = new DllPage(page);
      await dllPage.goto(APP_URL);

      await dllPage.input.fill('');
      await dllPage.clickAppend();

      const out = await dllPage.getOutputText();
      expect(out).toContain('Please enter a value');

      const dllState = await dllPage.getDllState();
      expect(dllState.length).toBe(0);

      expect(pageErrors.length).toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });

    test('Remove without value shows validation message', async ({ page }) => {
      const dllPage = new DllPage(page);
      await dllPage.goto(APP_URL);

      await dllPage.input.fill('');
      await dllPage.clickRemove();

      const out = await dllPage.getOutputText();
      expect(out).toContain('Please enter a value to remove');

      expect(pageErrors.length).toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });
  });

  // Validate that no unexpected runtime errors (ReferenceError, SyntaxError, TypeError) occurred during tests
  test.describe('Console and runtime error observations', () => {
    test('No pageerrors or console.error messages emitted during normal operations', async ({ page }) => {
      // This test performs a sequence of interactions and finally asserts the captured console/page errors.
      const dllPage = new DllPage(page);
      await dllPage.goto(APP_URL);

      // Perform a few interactions
      await dllPage.setInput(1);
      await dllPage.clickAppend();
      await dllPage.setInput(2);
      await dllPage.clickAppend();
      await dllPage.clickTraverseForward();
      await dllPage.clickTraverseBackward();
      await dllPage.setInput(2);
      await dllPage.clickRemove();
      await dllPage.clickClear();

      // After interactions, assert there were no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Also assert there were no console.error messages emitted
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);

      // If any console warnings exist, allow but record them (not failing the test)
      const warningMessages = consoleMessages.filter(m => m.type === 'warning');
      // At minimum, the code should not produce fatal errors
      // Provide an assertion that fatal error types are absent
      const fatalTypes = consoleMessages.filter(m => ['error', 'exception'].includes(m.type));
      expect(fatalTypes.length).toBe(0);
    });
  });
});