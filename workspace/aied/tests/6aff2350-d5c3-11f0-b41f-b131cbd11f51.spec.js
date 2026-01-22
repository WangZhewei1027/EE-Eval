import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6aff2350-d5c3-11f0-b41f-b131cbd11f51.html';

class LinkedListPage {
  /**
   * Page object for the Linked List demonstration page.
   * Captures console and page errors as arrays passed in from the test.
   */
  constructor(page, consoleErrors = [], pageErrors = []) {
    this.page = page;
    this.consoleErrors = consoleErrors;
    this.pageErrors = pageErrors;

    // Bind listeners to gather runtime issues
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
    this.page.on('pageerror', err => {
      this.pageErrors.push(err.message);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the UI to initialize (updateDisplay is called on load)
    await this.page.waitForSelector('#linkedListContainer');
  }

  // Input and button actions
  async setInputValue(value) {
    const input = this.page.locator('#nodeValue');
    await input.fill(String(value));
  }

  async clearInput() {
    await this.page.locator('#nodeValue').fill('');
  }

  async clickAddToHead() {
    await this.page.click("button[onclick='addToHead()']");
  }

  async clickAddToTail() {
    await this.page.click("button[onclick='addToTail()']");
  }

  async clickRemoveFromHead() {
    await this.page.click("button[onclick='removeFromHead()']");
  }

  async clickRemoveFromTail() {
    await this.page.click("button[onclick='removeFromTail()']");
  }

  async clickSearch() {
    await this.page.click("button[onclick='searchNode()']");
  }

  async clickClearList() {
    await this.page.click("button[onclick='clearList()']");
  }

  // DOM queries and helpers
  async getSizeText() {
    return (await this.page.locator('#listSize').innerText()).trim();
  }

  async getHeadText() {
    return (await this.page.locator('#headValue').innerText()).trim();
  }

  async getTailText() {
    return (await this.page.locator('#tailValue').innerText()).trim();
  }

  async getLinkedListContainerText() {
    return (await this.page.locator('#linkedListContainer').innerText()).trim();
  }

  async getNodeCount() {
    // nodes are created with class 'node-content' and ids 'node-<index>'
    return await this.page.locator('.node-content').count();
  }

  async getNodeValues() {
    const count = await this.getNodeCount();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push((await this.page.locator(`#node-${i}`).innerText()).trim());
    }
    return values;
  }

  async getLogEntries() {
    const entries = this.page.locator('#logContainer .log-entry');
    const n = await entries.count();
    const arr = [];
    for (let i = 0; i < n; i++) {
      arr.push((await entries.nth(i).innerText()).trim());
    }
    return arr;
  }

  async lastLogEntryText() {
    const entries = this.page.locator('#logContainer .log-entry');
    const n = await entries.count();
    if (n === 0) return '';
    return (await entries.nth(n - 1).innerText()).trim();
  }

  async getNodeBackgroundColor(index) {
    const el = this.page.locator(`#node-${index}`);
    await expect(el).toBeVisible({ timeout: 2000 });
    // Use evaluate to get computed style to handle CSS/background precedence
    return await el.evaluate(node => {
      return window.getComputedStyle(node).backgroundColor;
    });
  }
}

test.describe('Linked List Demonstration - FSM state & transitions', () => {
  let consoleErrors;
  let pageErrors;
  let llPage;

  test.beforeEach(async ({ page }) => {
    // arrays to collect runtime issues
    consoleErrors = [];
    pageErrors = [];
    llPage = new LinkedListPage(page, consoleErrors, pageErrors);
    await llPage.goto();
  });

  test.afterEach(async () => {
    // Allow any pending async UI tasks to finish briefly
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  test.describe('Initial Idle state (S0_Idle)', () => {
    test('Initial display shows empty list and zero size', async () => {
      // Validate idle entry actions (updateDisplay) have been applied
      // Size should be 0, head and tail must be 'null', container shows "List is empty"
      expect(await llPage.getSizeText()).toBe('0');
      expect(await llPage.getHeadText()).toBe('null');
      expect(await llPage.getTailText()).toBe('null');

      const containerText = await llPage.getLinkedListContainerText();
      expect(containerText).toContain('List is empty');

      // No operations logged initially
      const logs = await llPage.getLogEntries();
      expect(logs.length).toBe(0);

      // No runtime errors should have occurred during initialization
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Adding nodes (Transitions to S1_NodeAddedToHead and S2_NodeAddedToTail)', () => {
    test('Add to Head increases size and places node at head', async () => {
      // Add value 10 to head
      await llPage.setInputValue(10);
      await llPage.clickAddToHead();

      // size and head/tail should update
      expect(await llPage.getSizeText()).toBe('1');
      expect(await llPage.getHeadText()).toBe('10');
      expect(await llPage.getTailText()).toBe('10');

      // node exists in DOM and is the head (node-0)
      expect(await llPage.getNodeCount()).toBe(1);
      const values = await llPage.getNodeValues();
      expect(values).toEqual(['10']);

      // Log should contain the add message with timestamp prefix
      const lastLog = await llPage.lastLogEntryText();
      expect(lastLog).toContain('Added 10 to head');
      expect(lastLog.startsWith('[')).toBeTruthy();
      expect(lastLog.includes('Added 10 to head')).toBeTruthy();

      // No runtime errors during operation
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Add to Tail appends node to the end', async () => {
      // Seed: add head 1, then tail 2
      await llPage.setInputValue(1);
      await llPage.clickAddToHead();

      await llPage.setInputValue(2);
      await llPage.clickAddToTail();

      expect(await llPage.getSizeText()).toBe('2');
      expect(await llPage.getHeadText()).toBe('1');
      expect(await llPage.getTailText()).toBe('2');

      const values = await llPage.getNodeValues();
      expect(values).toEqual(['1', '2']);

      // Log entries include added messages for both operations
      const logs = await llPage.getLogEntries();
      expect(logs.some(l => l.includes('Added 1 to head'))).toBeTruthy();
      expect(logs.some(l => l.includes('Added 2 to tail'))).toBeTruthy();

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Removing nodes (S3_NodeRemovedFromHead and S4_NodeRemovedFromTail)', () => {
    test('Remove from Head decreases size and removes head node', async () => {
      // Prepare: add 100, then 200
      await llPage.setInputValue(100);
      await llPage.clickAddToHead();
      await llPage.setInputValue(200);
      await llPage.clickAddToTail();

      // Current list: [100, 200]
      expect(await llPage.getSizeText()).toBe('2');
      expect(await llPage.getHeadText()).toBe('100');

      // Remove head -> removes 100
      await llPage.clickRemoveFromHead();

      expect(await llPage.getSizeText()).toBe('1');
      expect(await llPage.getHeadText()).toBe('200');
      expect(await llPage.getTailText()).toBe('200');

      const lastLog = await llPage.lastLogEntryText();
      expect(lastLog).toContain('Removed 100 from head');

      // Removing until empty: remove one more should clear list
      await llPage.clickRemoveFromHead();
      expect(await llPage.getSizeText()).toBe('0');
      expect(await llPage.getHeadText()).toBe('null');
      expect(await llPage.getLinkedListContainerText()).toContain('List is empty');

      const logs = await llPage.getLogEntries();
      expect(logs.some(l => l.includes('Removed 200 from head') || l.includes('Removed 200 from tail'))).toBeTruthy();

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Remove from Tail decreases size and removes tail node', async () => {
      // Prepare: add 5 -> head, 6 -> tail, 7 -> tail
      await llPage.setInputValue(5);
      await llPage.clickAddToHead();
      await llPage.setInputValue(6);
      await llPage.clickAddToTail();
      await llPage.setInputValue(7);
      await llPage.clickAddToTail();

      // Confirm list [5,6,7]
      expect(await llPage.getSizeText()).toBe('3');
      expect(await llPage.getTailText()).toBe('7');

      // Remove tail -> removes 7
      await llPage.clickRemoveFromTail();

      expect(await llPage.getSizeText()).toBe('2');
      expect(await llPage.getTailText()).toBe('6');

      const lastLog = await llPage.lastLogEntryText();
      expect(lastLog).toContain('Removed 7 from tail');

      // Remove tail twice to empty the list
      await llPage.clickRemoveFromTail(); // removes 6
      await llPage.clickRemoveFromTail(); // removes 5 -> now empty

      expect(await llPage.getSizeText()).toBe('0');
      expect(await llPage.getHeadText()).toBe('null');
      expect(await llPage.getTailText()).toBe('null');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Removing from empty list logs "List is empty" and does not change size', async () => {
      // Ensure list empty at start of test
      expect(await llPage.getSizeText()).toBe('0');

      await llPage.clickRemoveFromHead();
      let lastLog = await llPage.lastLogEntryText();
      expect(lastLog).toContain('List is empty');

      await llPage.clickRemoveFromTail();
      lastLog = await llPage.lastLogEntryText();
      expect(lastLog).toContain('List is empty');

      expect(await llPage.getSizeText()).toBe('0');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Searching nodes and highlighting (S5_NodeSearched)', () => {
    test('Search finds an existing node and highlights it temporarily', async () => {
      // Create list [11,22,33]
      await llPage.setInputValue(11);
      await llPage.clickAddToHead();
      await llPage.setInputValue(22);
      await llPage.clickAddToTail();
      await llPage.setInputValue(33);
      await llPage.clickAddToTail();

      const values = await llPage.getNodeValues();
      expect(values).toEqual(['11', '22', '33']);

      // Search for 22 (position 1)
      await llPage.setInputValue(22);
      await llPage.clickSearch();

      // Verify log reports found
      const lastLog = await llPage.lastLogEntryText();
      expect(lastLog).toContain('Found 22 at position 1');

      // Immediately check background color of node-1 (should be highlighted #e74c3c -> rgb(231, 76, 60))
      // Wait a small amount to let inline style apply
      await llPage.page.waitForTimeout(50);
      const bg = await llPage.getNodeBackgroundColor(1);

      // Background might be returned in rgb(...) format; assert it matches the highlight color
      expect(bg === 'rgb(231, 76, 60)' || bg === 'rgba(231, 76, 60, 1)').toBeTruthy();

      // Wait for highlight to revert (setTimeout 1000ms in app)
      await llPage.page.waitForTimeout(1100);
      const bgAfter = await llPage.getNodeBackgroundColor(1);
      // After revert it should be the default blue #3498db => rgb(52, 152, 219)
      expect(bgAfter === 'rgb(52, 152, 219)' || bgAfter === 'rgba(52, 152, 219, 1)').toBeTruthy();

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Search for non-existent node logs not found message', async () => {
      // Ensure empty list or known content
      await llPage.clickClearList();
      expect(await llPage.getSizeText()).toBe('0');

      await llPage.setInputValue(999);
      await llPage.clickSearch();

      const lastLog = await llPage.lastLogEntryText();
      expect(lastLog).toContain('999 not found in the list');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Clearing list (S6_ListCleared) and edge cases', () => {
    test('Clear List empties the list and logs the action', async () => {
      // Add some nodes
      await llPage.setInputValue(7);
      await llPage.clickAddToHead();
      await llPage.setInputValue(8);
      await llPage.clickAddToTail();

      expect(await llPage.getSizeText()).toBe('2');

      await llPage.clickClearList();

      expect(await llPage.getSizeText()).toBe('0');
      expect(await llPage.getHeadText()).toBe('null');
      expect(await llPage.getTailText()).toBe('null');
      expect((await llPage.getLinkedListContainerText()).toLowerCase()).toContain('list is empty');

      const lastLog = await llPage.lastLogEntryText();
      expect(lastLog).toContain('List cleared');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Edge cases: adding/searching with invalid input logs error and does not mutate list', async () => {
      // Ensure empty
      await llPage.clickClearList();
      expect(await llPage.getSizeText()).toBe('0');

      // Attempt to add with empty input
      await llPage.clearInput();
      await llPage.clickAddToHead();
      let lastLog = await llPage.lastLogEntryText();
      expect(lastLog).toContain('Please enter a valid number');
      expect(await llPage.getSizeText()).toBe('0');

      // Attempt to add with non-number characters (input is type=number, playwright will set empty string)
      await llPage.setInputValue('abc'); // fill will coerce to 'abc' but parsed in app -> NaN
      await llPage.clickAddToTail();
      lastLog = await llPage.lastLogEntryText();
      expect(lastLog).toContain('Please enter a valid number');
      expect(await llPage.getSizeText()).toBe('0');

      // Attempt to search with empty input
      await llPage.clearInput();
      await llPage.clickSearch();
      lastLog = await llPage.lastLogEntryText();
      expect(lastLog).toContain('Please enter a valid number');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Runtime observations: console and page errors', () => {
    test('No runtime console errors or unhandled page errors during interactions', async () => {
      // Perform a series of interactions to potentially surface runtime errors
      await llPage.setInputValue(1);
      await llPage.clickAddToHead();
      await llPage.setInputValue(2);
      await llPage.clickAddToTail();
      await llPage.setInputValue(2);
      await llPage.clickSearch();
      await llPage.clickRemoveFromHead();
      await llPage.clickRemoveFromTail();
      await llPage.clickClearList();

      // Short pause to allow any asynchronous exceptions to surface
      await llPage.page.waitForTimeout(200);

      // Assert that no console errors or page errors were captured
      // If the page had ReferenceError/SyntaxError/TypeError they would be recorded above.
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});