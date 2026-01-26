import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cde600-fa79-11f0-8075-e54a10595dde.html';

/**
 * Page Object for the Interactive Linked List page.
 * Encapsulates common interactions and queries against the DOM.
 */
class LinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nodeInput = page.locator('input#nodeValue');
    this.addButton = page.locator("button[onclick='addNode()']");
    this.deleteInput = page.locator('input#deleteValue');
    this.deleteButton = page.locator("button[onclick='deleteNode()']");
    this.displayButton = page.locator("button[onclick='displayList()']");
    this.clearButton = page.locator("button[onclick='clearList()']");
    this.output = page.locator('#output');
  }

  // Navigate to the application page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Add a node with the provided value (fills input and clicks Add Node)
  async addNode(value) {
    await this.nodeInput.fill(value);
    await this.addButton.click();
  }

  // Delete a node with the provided value (fills input and clicks Delete Node)
  async deleteNode(value) {
    await this.deleteInput.fill(value);
    await this.deleteButton.click();
  }

  // Click the Display List button
  async displayList() {
    await this.displayButton.click();
  }

  // Click the Clear List button
  async clearList() {
    await this.clearButton.click();
  }

  // Return the current output text
  async getOutputText() {
    return (await this.output.innerText()).trim();
  }

  // Return current value in node input (useful to validate it's cleared)
  async getNodeInputValue() {
    return this.nodeInput.inputValue();
  }

  // Return current value in delete input
  async getDeleteInputValue() {
    return this.deleteInput.inputValue();
  }

  // Ensure core UI controls are visible (basic sanity)
  async expectControlsVisible() {
    await expect(this.addButton).toBeVisible();
    await expect(this.deleteButton).toBeVisible();
    await expect(this.displayButton).toBeVisible();
    await expect(this.clearButton).toBeVisible();
    await expect(this.nodeInput).toBeVisible();
    await expect(this.deleteInput).toBeVisible();
    await expect(this.output).toBeVisible();
  }
}

// Global helper to attach console/pageerror listeners and expose collected arrays
async function attachErrorCollectors(page) {
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    consoleMessages.push(msg);
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err);
  });

  return { consoleMessages, pageErrors };
}

/**
 * Test suite for the Interactive Linked List application.
 * Tests cover all FSM states/transitions:
 *  - S0_Idle (initial state)
 *  - S1_NodeAdded (Add Node)
 *  - S2_NodeDeleted (Delete Node)
 *  - S3_ListDisplayed (Display List)
 *  - S4_ListCleared (Clear List)
 *
 * The tests also:
 *  - Observe console messages and page errors (assert none occurred)
 *  - Validate DOM updates and input clearing behaviors
 *  - Cover edge cases: adding empty value, deleting non-existent value, clearing empty list
 */
test.describe('Interactive Linked List - FSM validation and UI behavior', () => {
  // Each test gets a fresh page
  test.beforeEach(async ({ page }) => {
    // nothing global required here; each test will instantiate LinkedListPage and goto
  });

  // Sanity / health check: page loads, elements present, no runtime errors
  test('Page loads and initial state (S0_Idle) has required controls and no runtime errors', async ({ page }) => {
    // Attach collectors for console and page errors
    const { consoleMessages, pageErrors } = await attachErrorCollectors(page);

    const app = new LinkedListPage(page);
    await app.goto();

    // Validate presence of controls and that initial output is 'List is empty'
    await app.expectControlsVisible();

    // Check initial output text - should reflect empty list state
    await app.displayList();
    const output = await app.getOutputText();
    expect(output).toBe('List is empty');

    // Assert no runtime page errors captured
    const errorConsoleCount = consoleMessages.filter(m => m.type() === 'error').length;
    expect(errorConsoleCount, 'No console errors should be emitted during load').toBe(0);
    expect(pageErrors.length, 'No page errors should be thrown during load').toBe(0);
  });

  test.describe('Add Node (S1_NodeAdded) tests', () => {
    test('Adding a single node updates list and clears input', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachErrorCollectors(page);
      const app = new LinkedListPage(page);
      await app.goto();

      // Add node 'A'
      await app.addNode('A');

      // After add, the input should be cleared (as per implementation)
      const nodeInputValue = await app.getNodeInputValue();
      expect(nodeInputValue).toBe('', 'nodeValue input should be cleared after adding a node');

      // Display list and verify the node appears (S3 verification combined)
      await app.displayList();
      const output = await app.getOutputText();
      expect(output).toBe('A', 'Added single node should be displayed as "A"');

      // Ensure no console errors or page errors
      const errorConsoleCount = consoleMessages.filter(m => m.type() === 'error').length;
      expect(errorConsoleCount).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Adding multiple nodes preserves order: A -> B -> C', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachErrorCollectors(page);
      const app = new LinkedListPage(page);
      await app.goto();

      // Add nodes A, B, C
      await app.addNode('A');
      await app.addNode('B');
      await app.addNode('C');

      // Display and assert order
      await app.displayList();
      const output = await app.getOutputText();
      expect(output).toBe('A -> B -> C', 'Nodes should be appended in order added');

      // No runtime errors
      const errorConsoleCount = consoleMessages.filter(m => m.type() === 'error').length;
      expect(errorConsoleCount).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: adding empty value does nothing', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachErrorCollectors(page);
      const app = new LinkedListPage(page);
      await app.goto();

      // Add empty value (should not add)
      await app.nodeInput.fill(''); // empty
      await app.addButton.click();

      // Display should still say empty
      await app.displayList();
      const output = await app.getOutputText();
      expect(output).toBe('List is empty', 'Adding an empty value should not change the list');

      // No runtime errors
      const errorConsoleCount = consoleMessages.filter(m => m.type() === 'error').length;
      expect(errorConsoleCount).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Delete Node (S2_NodeDeleted) tests', () => {
    test('Deleting a middle node removes it and clears delete input', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachErrorCollectors(page);
      const app = new LinkedListPage(page);
      await app.goto();

      // Prepare list: X -> Y -> Z
      await app.addNode('X');
      await app.addNode('Y');
      await app.addNode('Z');

      // Delete 'Y'
      await app.deleteNode('Y');

      // After deletion, delete input should be cleared
      const deleteInputValue = await app.getDeleteInputValue();
      expect(deleteInputValue).toBe('', 'deleteValue input should be cleared after deletion');

      // Display and assert that Y is gone
      await app.displayList();
      const output = await app.getOutputText();
      expect(output).toBe('X -> Z', 'Middle node Y should be removed from the list');

      // No runtime errors
      const errorConsoleCount = consoleMessages.filter(m => m.type() === 'error').length;
      expect(errorConsoleCount).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Deleting head node updates head correctly', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachErrorCollectors(page);
      const app = new LinkedListPage(page);
      await app.goto();

      // Add a single value H1 then delete it (head deletion scenario)
      await app.addNode('H1');

      // Ensure present
      await app.displayList();
      expect(await app.getOutputText()).toBe('H1');

      // Delete head
      await app.deleteNode('H1');

      // Display should say empty
      await app.displayList();
      expect(await app.getOutputText()).toBe('List is empty', 'Deleting the only node should result in empty list');

      // No runtime errors
      const errorConsoleCount = consoleMessages.filter(m => m.type() === 'error').length;
      expect(errorConsoleCount).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Deleting a non-existent value does not throw and leaves list unchanged', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachErrorCollectors(page);
      const app = new LinkedListPage(page);
      await app.goto();

      // Prepare list: M -> N
      await app.addNode('M');
      await app.addNode('N');

      // Try deleting Z which does not exist
      await app.deleteNode('Z');

      // List should remain M -> N
      await app.displayList();
      const output = await app.getOutputText();
      expect(output).toBe('M -> N', 'Deleting a non-existent value should not change the list');

      // No runtime errors
      const errorConsoleCount = consoleMessages.filter(m => m.type() === 'error').length;
      expect(errorConsoleCount).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Display List (S3_ListDisplayed) tests', () => {
    test('Display shows "List is empty" when no nodes present', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachErrorCollectors(page);
      const app = new LinkedListPage(page);
      await app.goto();

      // Directly click display
      await app.displayList();
      const output = await app.getOutputText();
      expect(output).toBe('List is empty');

      // No runtime errors
      const errorConsoleCount = consoleMessages.filter(m => m.type() === 'error').length;
      expect(errorConsoleCount).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Display reflects current list after mixed operations', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachErrorCollectors(page);
      const app = new LinkedListPage(page);
      await app.goto();

      // Add several, delete one, then display
      await app.addNode('1');
      await app.addNode('2');
      await app.addNode('3');
      await app.deleteNode('2');

      await app.displayList();
      const output = await app.getOutputText();
      expect(output).toBe('1 -> 3', 'Display should show the up-to-date list after operations');

      // No runtime errors
      const errorConsoleCount = consoleMessages.filter(m => m.type() === 'error').length;
      expect(errorConsoleCount).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Clear List (S4_ListCleared) tests', () => {
    test('Clear List shows cleared message and empties list', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachErrorCollectors(page);
      const app = new LinkedListPage(page);
      await app.goto();

      // Add nodes, then clear
      await app.addNode('Alpha');
      await app.addNode('Beta');

      // Clear the list
      await app.clearList();

      // After clearing, output should show 'List cleared.'
      const clearedMessage = await app.getOutputText();
      expect(clearedMessage).toBe('List cleared.', 'Clear List should show the cleared message');

      // Display after clearing should reflect an empty list
      await app.displayList();
      const outputAfterDisplay = await app.getOutputText();
      expect(outputAfterDisplay).toBe('List is empty', 'After clearing, display should show list is empty');

      // No runtime errors
      const errorConsoleCount = consoleMessages.filter(m => m.type() === 'error').length;
      expect(errorConsoleCount).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Clearing an already empty list still shows cleared message', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachErrorCollectors(page);
      const app = new LinkedListPage(page);
      await app.goto();

      // Ensure list empty, then clear
      await app.displayList();
      expect(await app.getOutputText()).toBe('List is empty');

      await app.clearList();
      expect(await app.getOutputText()).toBe('List cleared.');

      // No runtime errors
      const errorConsoleCount = consoleMessages.filter(m => m.type() === 'error').length;
      expect(errorConsoleCount).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('DOM and event handler verification', () => {
    test('Buttons have expected onclick handlers and inputs have placeholders', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachErrorCollectors(page);
      const app = new LinkedListPage(page);
      await app.goto();

      // Verify the presence of onclick attributes by querying outerHTML snippets
      const addButtonHtml = await page.locator("button[onclick='addNode()']").evaluate(node => node.outerHTML);
      expect(addButtonHtml).toContain('onclick="addNode()"');

      const deleteButtonHtml = await page.locator("button[onclick='deleteNode()']").evaluate(node => node.outerHTML);
      expect(deleteButtonHtml).toContain('onclick="deleteNode()"');

      const displayButtonHtml = await page.locator("button[onclick='displayList()']").evaluate(node => node.outerHTML);
      expect(displayButtonHtml).toContain('onclick="displayList()"');

      const clearButtonHtml = await page.locator("button[onclick='clearList()']").evaluate(node => node.outerHTML);
      expect(clearButtonHtml).toContain('onclick="clearList()"');

      // Check placeholders on inputs
      const nodePlaceholder = await page.locator('input#nodeValue').getAttribute('placeholder');
      expect(nodePlaceholder).toBe('Enter node value');

      const deletePlaceholder = await page.locator('input#deleteValue').getAttribute('placeholder');
      expect(deletePlaceholder).toBe('Enter value to delete');

      // No runtime errors
      const errorConsoleCount = consoleMessages.filter(m => m.type() === 'error').length;
      expect(errorConsoleCount).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});