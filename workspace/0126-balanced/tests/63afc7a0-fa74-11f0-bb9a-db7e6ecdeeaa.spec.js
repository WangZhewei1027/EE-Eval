import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63afc7a0-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Linked List Demo
class LinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.valueInput = page.locator('#valueInput');
    this.appendBtn = page.locator('#appendBtn');
    this.prependBtn = page.locator('#prependBtn');
    this.removeHeadBtn = page.locator('#removeHeadBtn');
    this.removeTailBtn = page.locator('#removeTailBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.listContainer = page.locator('#linkedList');
    this.output = page.locator('#output');
    this.nodeLocator = page.locator('#linkedList .node');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // ensure scripts run and initial render completes
    await this.page.waitForLoadState('networkidle');
  }

  async append(value) {
    await this.valueInput.fill(String(value));
    await this.appendBtn.click();
  }

  async prepend(value) {
    await this.valueInput.fill(String(value));
    await this.prependBtn.click();
  }

  async removeHead() {
    await this.removeHeadBtn.click();
  }

  async removeTail() {
    await this.removeTailBtn.click();
  }

  async clearList() {
    await this.clearBtn.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async getListText() {
    return (await this.listContainer.textContent()) ?? '';
  }

  async getNodeValues() {
    const count = await this.nodeLocator.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push((await this.nodeLocator.nth(i).textContent()).trim());
    }
    return values;
  }

  async nodeCount() {
    return await this.nodeLocator.count();
  }
}

// Top-level grouping for the Linked List Demo tests
test.describe('Linked List Demo - FSM validation and UI behavior', () => {
  let consoleMessages;
  let pageErrors;

  // Attach listeners for console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Collect console messages for later assertions
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', (err) => {
      // Collect unhandled page errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });
  });

  // After each test assert that no page errors or console.error messages occurred.
  // This ensures the application runs without runtime exceptions during interactions.
  test.afterEach(async () => {
    // Assert that there were no uncaught page errors
    expect(pageErrors.length, `Expected no page errors, but found: ${pageErrors.map(e=>String(e)).join('; ')}`).toBe(0);

    // Assert that there are no console messages of type 'error'
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length, `Expected no console.error messages, but found: ${errorConsoleMsgs.map(m=>m.text).join('; ')}`).toBe(0);
  });

  test.describe('Initial state (S0_Empty) and basic rendering', () => {
    test('renders empty list text and initial output message', async ({ page }) => {
      // Validate initial state S0_Empty: list shows "The list is empty." and output shows welcome instructions
      const ll = new LinkedListPage(page);
      await ll.goto();

      const listText = (await ll.getListText()).trim();
      expect(listText).toBe('The list is empty.');

      const outputText = (await ll.getOutputText()).trim();
      // The app writes an initial message on load
      expect(outputText).toBe('Enter a value and use buttons to modify the linked list.');
    });
  });

  test.describe('Transitions from empty to non-empty (Append and Prepend)', () => {
    test('Append transitions S0_Empty -> S1_NonEmpty and renders node', async ({ page }) => {
      // This test validates the Append event and the transition to Non-Empty state
      const ll = new LinkedListPage(page);
      await ll.goto();

      // Append a value when list is empty
      await ll.append(42);

      // Verify output message
      const output = (await ll.getOutputText()).trim();
      expect(output).toBe('Appended "42" to the list.');

      // Verify the visual nodes: should have exactly one node with text "42"
      const nodes = await ll.getNodeValues();
      expect(nodes.length).toBe(1);
      expect(nodes[0]).toBe('42');

      // The list container should not show the "The list is empty." text anymore
      const listText = (await ll.getListText()).trim();
      expect(listText).not.toBe('The list is empty.');
    });

    test('Prepend transitions S0_Empty -> S1_NonEmpty and respects order', async ({ page }) => {
      // Validate Prepend and ordering when adding to non-empty list
      const ll = new LinkedListPage(page);
      await ll.goto();

      // First append 2 to move to non-empty
      await ll.append(2);
      expect((await ll.getOutputText()).trim()).toBe('Appended "2" to the list.');

      // Prepend 1 so list becomes [1,2]
      await ll.prepend(1);
      expect((await ll.getOutputText()).trim()).toBe('Prepended "1" to the list.');

      const nodes = await ll.getNodeValues();
      expect(nodes).toEqual(['1', '2']);
    });
  });

  test.describe('Removal operations while Non-Empty (RemoveHead and RemoveTail)', () => {
    test('RemoveHead removes head and updates visual and output', async ({ page }) => {
      // Prepare list with [A,B,C] and then remove head
      const ll = new LinkedListPage(page);
      await ll.goto();

      await ll.append('A');
      await ll.append('B');
      await ll.append('C');
      expect(await ll.nodeCount()).toBe(3);

      // Remove head -> should remove 'A'
      await ll.removeHead();
      expect((await ll.getOutputText()).trim()).toBe('Removed "A" from the head of the list.');

      const nodes = await ll.getNodeValues();
      expect(nodes).toEqual(['B', 'C']);
    });

    test('RemoveTail removes tail and updates visual and output, including single-element edge', async ({ page }) => {
      // Prepare list with [1,2,3], remove tail twice to hit single-element removal and then empty
      const ll = new LinkedListPage(page);
      await ll.goto();

      await ll.append(1);
      await ll.append(2);
      await ll.append(3);
      expect(await ll.nodeCount()).toBe(3);

      // Remove tail -> removes 3
      await ll.removeTail();
      expect((await ll.getOutputText()).trim()).toBe('Removed "3" from the tail of the list.');
      expect(await ll.getNodeValues()).toEqual(['1', '2']);

      // Remove tail -> removes 2, leaving single element [1]
      await ll.removeTail();
      expect((await ll.getOutputText()).trim()).toBe('Removed "2" from the tail of the list.');
      expect(await ll.getNodeValues()).toEqual(['1']);

      // Remove tail -> removes 1 and should result in empty list
      await ll.removeTail();
      expect((await ll.getOutputText()).trim()).toBe('Removed "1" from the tail of the list.');
      // When list is empty, the list container should show "The list is empty."
      expect((await ll.getListText()).trim()).toBe('The list is empty.');
    });
  });

  test.describe('Clear list transition (S1_NonEmpty -> S0_Empty)', () => {
    test('ClearList empties the list and writes cleared message', async ({ page }) => {
      // Fill list, clear, validate S0_Empty is reached
      const ll = new LinkedListPage(page);
      await ll.goto();

      await ll.append('x');
      await ll.append('y');
      expect(await ll.nodeCount()).toBe(2);

      await ll.clearList();
      expect((await ll.getOutputText()).trim()).toBe('Cleared the entire list.');
      expect((await ll.getListText()).trim()).toBe('The list is empty.');
      expect(await ll.nodeCount()).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Appending or prepending with empty input shows validation message', async ({ page }) => {
      // Validate that the UI shows prompts when value input is blank
      const ll = new LinkedListPage(page);
      await ll.goto();

      // Ensure input is empty
      await ll.valueInput.fill('');
      await ll.appendBtn.click();
      expect((await ll.getOutputText()).trim()).toBe('Please enter a value to append.');

      // Prepend empty
      await ll.valueInput.fill('');
      await ll.prependBtn.click();
      expect((await ll.getOutputText()).trim()).toBe('Please enter a value to prepend.');
    });

    test('Removing head/tail on empty list reports nothing to remove', async ({ page }) => {
      // Validate remove operations on empty list produce appropriate messages
      const ll = new LinkedListPage(page);
      await ll.goto();

      // Ensure list is empty to start
      expect((await ll.getListText()).trim()).toBe('The list is empty.');

      await ll.removeHead();
      expect((await ll.getOutputText()).trim()).toBe('List is empty. Nothing to remove from the head.');

      await ll.removeTail();
      expect((await ll.getOutputText()).trim()).toBe('List is empty. Nothing to remove from the tail.');
    });

    test('Sequence of operations maintains internal consistency', async ({ page }) => {
      // Run a longer sequence to ensure state updates and visual outputs match expected FSM behavior
      const ll = new LinkedListPage(page);
      await ll.goto();

      // Sequence: append 10, prepend 5 -> [5,10], append 15 -> [5,10,15], removeHead -> [10,15], clear -> []
      await ll.append(10);
      expect((await ll.getOutputText()).trim()).toBe('Appended "10" to the list.');

      await ll.prepend(5);
      expect((await ll.getOutputText()).trim()).toBe('Prepended "5" to the list.');

      await ll.append(15);
      expect((await ll.getOutputText()).trim()).toBe('Appended "15" to the list.');

      expect(await ll.getNodeValues()).toEqual(['5', '10', '15']);

      await ll.removeHead();
      expect((await ll.getOutputText()).trim()).toBe('Removed "5" from the head of the list.');
      expect(await ll.getNodeValues()).toEqual(['10', '15']);

      await ll.clearList();
      expect((await ll.getOutputText()).trim()).toBe('Cleared the entire list.');
      expect((await ll.getListText()).trim()).toBe('The list is empty.');
    });
  });
});