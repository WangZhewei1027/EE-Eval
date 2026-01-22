import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f17fb9d0-d366-11f0-9b19-a558354ece3e.html';

/**
 * Page object to encapsulate interactions with the Linked List app.
 */
class LinkedListPage {
  constructor(page) {
    this.page = page;
  }

  input() {
    return this.page.locator('#nodeValue');
  }

  appendButton() {
    return this.page.locator('button[onclick="appendNode()"]');
  }

  prependButton() {
    return this.page.locator('button[onclick="prependNode()"]');
  }

  deleteButton() {
    return this.page.locator('button[onclick="deleteNode()"]');
  }

  clearButton() {
    return this.page.locator('button[onclick="clearList()"]');
  }

  findButton() {
    return this.page.locator('button[onclick="findNode()"]');
  }

  visualization() {
    return this.page.locator('#listVisualization');
  }

  infoDiv() {
    return this.page.locator('#operationInfo');
  }

  emptyMessage() {
    return this.page.locator('#emptyMessage');
  }

  async fillInput(value) {
    // Clear then type to simulate user typing
    await this.input().fill('');
    if (value !== '') {
      await this.input().type(value);
    }
  }

  async appendValue(value) {
    await this.fillInput(value);
    await this.appendButton().click();
  }

  async prependValue(value) {
    await this.fillInput(value);
    await this.prependButton().click();
  }

  async deleteValue(value) {
    await this.fillInput(value);
    await this.deleteButton().click();
  }

  async findValue(value) {
    await this.fillInput(value);
    await this.findButton().click();
  }

  async clearList() {
    await this.clearButton().click();
  }

  async pressEnterInInput() {
    await this.input().press('Enter');
  }

  async getNodes() {
    return this.page.locator('.node');
  }

  async nodeCount() {
    return await this.getNodes().count();
  }

  async nodeDataAt(index) {
    const node = this.page.locator(`#node-${index} .data`);
    return (await node.innerText()).trim();
  }

  async nodeStyleAt(index) {
    const node = this.page.locator(`#node-${index}`);
    return await this.page.evaluate((el) => {
      return {
        backgroundColor: el.style.backgroundColor,
        borderColor: el.style.borderColor
      };
    }, await node.elementHandle());
  }

  async operationInfoText() {
    return (await this.infoDiv().innerText()).trim();
  }

  async hasPointerArrows() {
    return (await this.page.locator('.pointer').count()) > 0;
  }

  async getVisualizationHtml() {
    return await this.visualization().innerHTML();
  }
}

test.describe('Linked List Visualization (f17fb9d0-d366-11f0-9b19-a558354ece3e)', () => {
  // Shared arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors for observation and assertions
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({}, testInfo) => {
    // Ensure no uncaught page errors happened during the test run.
    // The app is loaded as-is; if runtime errors occur they will be captured and cause this assertion to fail.
    expect(pageErrors, `Expected no uncaught page errors (test: ${testInfo.title})`).toHaveLength(0);

    // Fail if any console messages of type 'error' were emitted - these signal runtime issues
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors, `Expected no console.error messages (test: ${testInfo.title})`).toHaveLength(0);
  });

  test.describe('Initial state (Idle) and basic DOM checks', () => {
    test('renders idle state with empty message and input constraints', async ({ page }) => {
      // Validate initial Idle state: emptyMessage should be visible
      const app = new LinkedListPage(page);

      // The FSM entry action renderPage() is represented by the initial DOM content.
      await expect(app.emptyMessage()).toBeVisible();
      const vizHtml = await app.getVisualizationHtml();
      expect(vizHtml).toContain('Linked list is empty. Add some nodes to get started!');

      // Input should have maxlength attribute enforced (10)
      const maxlength = await page.getAttribute('#nodeValue', 'maxlength');
      expect(maxlength).toBe('10');

      // The operation info area exists and contains descriptive text (not necessarily the operation message until ops happen)
      const infoText = await app.operationInfoText();
      expect(infoText).toContain('Linked List Operations:'); // header content was present in initial HTML
    });
  });

  test.describe('Append and Prepend operations', () => {
    test('Append Node adds a node and updates visualization and info', async ({ page }) => {
      // Validate the AppendNode event and S1_NodeAppended state
      const app = new LinkedListPage(page);

      // Append a value via button click
      await app.appendValue('A');

      // After append, empty message should be gone
      await expect(app.emptyMessage()).toHaveCount(0);

      // There should be exactly one node with the provided data
      expect(await app.nodeCount()).toBe(1);
      expect(await app.nodeDataAt(0)).toBe('A');

      // Operation info should reflect append operation and list size/head
      const info = await app.operationInfoText();
      expect(info).toContain('Appended node with value: A');
      expect(info).toContain('List Size:');
      expect(info).toContain('Head: A');

      // Visual pointer for end should show 'NULL'
      const vizHtml = await app.getVisualizationHtml();
      expect(vizHtml).toContain('NULL');
    });

    test('Prepend Node on empty list creates new head (S2_NodePrepended)', async ({ page }) => {
      const app = new LinkedListPage(page);

      await app.prependValue('X');

      expect(await app.nodeCount()).toBe(1);
      expect(await app.nodeDataAt(0)).toBe('X');

      const info = await app.operationInfoText();
      expect(info).toContain('Prepended node with value: X');
      expect(info).toContain('Head: X');
    });

    test('Prepend Node on non-empty list places node at head', async ({ page }) => {
      const app = new LinkedListPage(page);

      // Start with append, then prepend
      await app.appendValue('tail');
      await app.prependValue('head');

      // Two nodes: head should be 'head' at index 0
      expect(await app.nodeCount()).toBe(2);
      expect(await app.nodeDataAt(0)).toBe('head');
      expect(await app.nodeDataAt(1)).toBe('tail');

      const info = await app.operationInfoText();
      expect(info).toContain('Prepended node with value: head');
      expect(info).toContain('List Size:');
      expect(info).toContain('Head: head');
    });
  });

  test.describe('Delete operation and edge cases (S3_NodeDeleted)', () => {
    test('Delete a middle node removes first occurrence and updates info', async ({ page }) => {
      const app = new LinkedListPage(page);

      // Build list: 1 -> 2 -> 3
      await app.appendValue('1');
      await app.appendValue('2');
      await app.appendValue('3');

      expect(await app.nodeCount()).toBe(3);

      // Delete '2'
      await app.deleteValue('2');

      // Now nodes should be 1 -> 3
      expect(await app.nodeCount()).toBe(2);
      expect(await app.nodeDataAt(0)).toBe('1');
      expect(await app.nodeDataAt(1)).toBe('3');

      const info = await app.operationInfoText();
      expect(info).toContain('Deleted node with value: 2');
      expect(info).toContain('List Size:');
    });

    test('Delete non-existing value shows not found message', async ({ page }) => {
      const app = new LinkedListPage(page);

      // Build list with single item
      await app.appendValue('alpha');

      // Attempt to delete a value not present
      await app.deleteValue('beta');

      const info = await app.operationInfoText();
      expect(info).toContain('Node with value beta not found');
      // List should be unchanged
      expect(await app.nodeCount()).toBe(1);
      expect(await app.nodeDataAt(0)).toBe('alpha');
    });

    test('Delete with value on empty list shows "List is empty"', async ({ page }) => {
      const app = new LinkedListPage(page);

      // Ensure empty
      await expect(app.emptyMessage()).toBeVisible();
      // Provide a value and click delete - should trigger the "List is empty" message in LinkedList.delete
      await app.deleteValue('z');

      const info = await app.operationInfoText();
      expect(info).toContain('List is empty');
    });
  });

  test.describe('Clear list operation (S5_ListCleared)', () => {
    test('Clear List empties the linked list and shows cleared message', async ({ page }) => {
      const app = new LinkedListPage(page);

      // Build list
      await app.appendValue('one');
      await app.appendValue('two');

      expect(await app.nodeCount()).toBe(2);

      // Clear it
      await app.clearList();

      // Visualization should revert to empty message
      await expect(app.emptyMessage()).toBeVisible();

      const info = await app.operationInfoText();
      // The implementation's updateVisualization uses: "Cleared the entire linked list"
      expect(info).toContain('Cleared the entire linked list');
      expect(info).toContain('List Size: 0');
      expect(info).toContain('Head: NULL');
    });
  });

  test.describe('Find operation and highlighting (S4_NodeFound)', () => {
    test('Find an existing node highlights it and shows found message', async ({ page }) => {
      const app = new LinkedListPage(page);

      // Build list
      await app.appendValue('apple');
      await app.appendValue('banana');
      await app.appendValue('cherry');

      // Find banana (position 1)
      await app.findValue('banana');

      // The node at index 1 should have inline style changed by highlightNode
      const styles = await app.nodeStyleAt(1);

      // Highlighting sets backgroundColor '#ffeb3b' and borderColor '#ff9800' via inline styles
      // The returned style strings may be RGB; check that the inline style contains hex converted to rgb equivalents or the hex itself.
      const bg = styles.backgroundColor;
      const border = styles.borderColor;
      // Accept either the hex string or rgb commas (browser returns rgb)
      const acceptableBg = bg === 'rgb(255, 235, 59)' || bg === '#ffeb3b' || bg === 'rgba(255, 235, 59, 1)';
      const acceptableBorder = border === 'rgb(255, 152, 0)' || border === '#ff9800' || border === 'rgba(255, 152, 0, 1)';
      expect(acceptableBg).toBeTruthy();
      expect(acceptableBorder).toBeTruthy();

      const info = await app.operationInfoText();
      expect(info).toContain('Found "banana" at position 1');
    });

    test('Find non-existing node shows not found message', async ({ page }) => {
      const app = new LinkedListPage(page);

      await app.appendValue('red');
      await app.appendValue('green');

      await app.findValue('blue');

      const info = await app.operationInfoText();
      expect(info).toContain('Node with value blue not found');

      // No node should be highlighted; ensure nodes have default border color
      const styles0 = await app.nodeStyleAt(0);
      const styles1 = await app.nodeStyleAt(1);
      // Default borderColor set inline by updateVisualization: '#007bff' or left as default. Accept either.
      const defaultBorderPossible = ['#007bff', 'rgb(0, 123, 255)', ''];
      expect(defaultBorderPossible.includes(styles0.borderColor)).toBeTruthy();
      expect(defaultBorderPossible.includes(styles1.borderColor)).toBeTruthy();
    });
  });

  test.describe('Keyboard interaction (Enter key triggers Append) and input constraints', () => {
    test('Pressing Enter in input triggers append (EnterKeyPress -> S1_NodeAppended)', async ({ page }) => {
      const app = new LinkedListPage(page);

      // Focus and press Enter to append
      await app.fillInput('EnterMe');
      await app.pressEnterInInput();

      // Node should be appended
      expect(await app.nodeCount()).toBe(1);
      expect(await app.nodeDataAt(0)).toBe('EnterMe');

      const info = await app.operationInfoText();
      expect(info).toContain('Appended node with value: EnterMe');
    });

    test('Input maxlength is enforced when appending via Enter', async ({ page }) => {
      const app = new LinkedListPage(page);

      // Attempt to type 11 characters (maxlength is 10)
      const longValue = '12345678901'; // 11 chars
      await app.fillInput(longValue);
      await app.pressEnterInInput();

      // The stored data should be trimmed to maxlength (10). Because browser enforces maxlength on input typing,
      // the appended value is expected to be the first 10 characters (implementation trims whitespace only,
      // but the input will block the 11th character).
      // We'll verify the appended node's data length <= 10
      expect(await app.nodeCount()).toBe(1);
      const data = await app.nodeDataAt(0);
      expect(data.length).toBeLessThanOrEqual(10);
      // Also ensure the data starts with the longValue's first character sequence
      expect(data).toBe(longValue.slice(0, data.length));
    });
  });

  test.describe('Visual structure assertions and additional edge cases', () => {
    test('Pointers and NULL are present for multiple nodes', async ({ page }) => {
      const app = new LinkedListPage(page);

      await app.appendValue('n1');
      await app.appendValue('n2');

      // There should be a pointer arrow between nodes
      expect(await app.hasPointerArrows()).toBeTruthy();

      // The last node should display 'NULL' in its .next element
      const vizHtml = await app.getVisualizationHtml();
      expect(vizHtml).toMatch(/NULL/);
    });

    test('Multiple operations preserve list consistency', async ({ page }) => {
      const app = new LinkedListPage(page);

      await app.appendValue('a');
      await app.appendValue('b');
      await app.prependValue('z'); // z a b

      expect(await app.nodeCount()).toBe(3);
      expect(await app.nodeDataAt(0)).toBe('z');
      expect(await app.nodeDataAt(1)).toBe('a');
      expect(await app.nodeDataAt(2)).toBe('b');

      // Delete head
      await app.deleteValue('z'); // a b
      expect(await app.nodeCount()).toBe(2);
      expect(await app.nodeDataAt(0)).toBe('a');

      // Clear
      await app.clearList();
      await expect(app.emptyMessage()).toBeVisible();
    });
  });

  test.describe('FSM entry/exit action verification (as observable in DOM)', () => {
    test('Idle entry action implied by presence of initial empty message', async ({ page }) => {
      // The FSM indicated renderPage() on entering Idle. The page's initial DOM content includes the emptyMessage.
      const app = new LinkedListPage(page);
      await expect(app.emptyMessage()).toBeVisible();
      // This test simply asserts that the entry effect is present in the DOM (renderPage() is not defined to call).
      const vizHtml = await app.getVisualizationHtml();
      expect(vizHtml).toContain('Linked list is empty. Add some nodes to get started!');
    });
  });
});