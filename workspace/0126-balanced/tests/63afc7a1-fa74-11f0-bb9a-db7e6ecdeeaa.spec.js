import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63afc7a1-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Doubly Linked List Demo
class DoublyLinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.inputValue = page.locator('#inputValue');
    this.addHeadBtn = page.locator('#addHeadBtn');
    this.addTailBtn = page.locator('#addTailBtn');
    this.removeHeadBtn = page.locator('#removeHeadBtn');
    this.removeTailBtn = page.locator('#removeTailBtn');
    this.searchValue = page.locator('#searchValue');
    this.searchBtn = page.locator('#searchBtn');
    this.clearSearchBtn = page.locator('#clearSearchBtn');
    this.clearListBtn = page.locator('#clearListBtn');
    this.listContainer = page.locator('#listContainer');
    this.infoBox = page.locator('#infoBox');
    this.nodeLocator = page.locator('.node');
    this.arrowLocator = page.locator('.arrows');
  }

  async addHead(value) {
    await this.inputValue.fill(value);
    await this.addHeadBtn.click();
  }

  async addTail(value) {
    await this.inputValue.fill(value);
    await this.addTailBtn.click();
  }

  async removeHead() {
    await this.removeHeadBtn.click();
  }

  async removeTail() {
    await this.removeTailBtn.click();
  }

  async search(value) {
    await this.searchValue.fill(value);
    await this.searchBtn.click();
  }

  async clearSearch() {
    await this.clearSearchBtn.click();
  }

  async clearListAccept() {
    // Accept the confirm dialog to clear the list
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.clearListBtn.click()
    ]);
    await dialog.accept();
  }

  async clearListDismiss() {
    // Dismiss the confirm dialog (cancel)
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.clearListBtn.click()
    ]);
    await dialog.dismiss();
  }

  async getNodeTexts() {
    return this.nodeLocator.allTextContents();
  }

  async getInfoText() {
    return this.infoBox.textContent();
  }

  async getListInnerHTML() {
    return this.listContainer.innerHTML();
  }

  async countNodes() {
    return this.nodeLocator.count();
  }

  async countArrows() {
    return this.arrowLocator.count();
  }

  async nodeHasCurrentClassByText(text) {
    const nodes = this.nodeLocator;
    const count = await nodes.count();
    for (let i = 0; i < count; i++) {
      const el = nodes.nth(i);
      const txt = (await el.textContent())?.trim();
      if (txt === text) {
        return await el.evaluate((node) => node.classList.contains('current'));
      }
    }
    return false;
  }
}

test.describe('Doubly Linked List Demo - FSM and UI behavior', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // afterEach left intentionally simple; listeners are per-page and cleared automatically
  });

  test('Initial state S0_Empty: renders empty message and info', async ({ page }) => {
    // Validate initial empty state rendering and info message
    const p = new DoublyLinkedListPage(page);

    // list container should show the empty message
    await expect(p.listContainer).toHaveText('The list is empty.');

    // info box should indicate empty list prompt per entry action
    await expect(p.infoBox).toHaveText('Doubly Linked List is empty. Add some nodes!');

    // there should be zero nodes rendered
    await expect(p.nodeLocator).toHaveCount(0);

    // No runtime page errors were emitted during initial load
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Adding nodes (AddHead & AddTail) and required UI updates', () => {
    test('AddHead from empty to non-empty updates DOM and info and focuses input', async ({ page }) => {
      const p1 = new DoublyLinkedListPage(page);

      // Add 'A' at head
      await p.addHead('A');

      // Node should appear, exactly one node with text 'A'
      await expect(p.nodeLocator).toHaveCount(1);
      const texts = await p.getNodeTexts();
      expect(texts).toEqual(['A']);

      // Info box should reflect added at head and length 1
      await expect(p.infoBox).toHaveText('Added "A" at head. List length: 1');

      // Input should be cleared after adding
      await expect(p.inputValue).toHaveValue('');

      // Focus should return to inputField
      const activeId = await page.evaluate(() => document.activeElement?.id);
      expect(activeId).toBe('inputValue');

      // No console errors
      const consoleErrors1 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Adding multiple heads preserves order (new head at left) and shows arrows', async ({ page }) => {
      const p2 = new DoublyLinkedListPage(page);

      await p.addHead('A'); // list: A
      await p.addHead('B'); // list: B, A
      await p.addHead('C'); // list: C, B, A

      // Expect three nodes in order C, B, A
      const texts1 = await p.getNodeTexts();
      expect(texts).toEqual(['C', 'B', 'A']);

      // There should be 2 arrows between 3 nodes
      const arrows = await p.countArrows();
      expect(arrows).toBe(2);

      // Info should reflect last operation
      await expect(p.infoBox).toHaveText('Added "C" at head. List length: 3');

      // Ensure no runtime errors during operations
      const consoleErrors2 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('AddTail from empty to non-empty updates DOM and info', async ({ page }) => {
      const p3 = new DoublyLinkedListPage(page);

      await p.addTail('X');

      await expect(p.nodeLocator).toHaveCount(1);
      const texts2 = await p.getNodeTexts();
      expect(texts).toEqual(['X']);

      await expect(p.infoBox).toHaveText('Added "X" at tail. List length: 1');

      // No page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Adding tails appends nodes to the right and arrows count matches', async ({ page }) => {
      const p4 = new DoublyLinkedListPage(page);

      await p.addTail('1');
      await p.addTail('2');
      await p.addTail('3');

      const texts3 = await p.getNodeTexts();
      expect(texts).toEqual(['1', '2', '3']);

      const arrows1 = await p.countArrows();
      expect(arrows).toBe(2);

      await expect(p.infoBox).toHaveText('Added "3" at tail. List length: 3');

      const consoleErrors3 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Removing nodes (RemoveHead & RemoveTail)', () => {
    test('RemoveHead reduces length and updates info when non-empty', async ({ page }) => {
      const p5 = new DoublyLinkedListPage(page);

      // prepare list: A -> B -> C
      await p.addTail('A');
      await p.addTail('B');
      await p.addTail('C');

      // Remove head should remove 'A'
      await p.removeHead();

      const texts4 = await p.getNodeTexts();
      expect(texts).toEqual(['B', 'C']);

      await expect(p.infoBox).toHaveText('Removed head node with value "A". List length: 2');
    });

    test('RemoveTail reduces length and updates info when non-empty', async ({ page }) => {
      const p6 = new DoublyLinkedListPage(page);

      // prepare list: 1 -> 2 -> 3
      await p.addTail('1');
      await p.addTail('2');
      await p.addTail('3');

      // Remove tail should remove '3'
      await p.removeTail();

      const texts5 = await p.getNodeTexts();
      expect(texts).toEqual(['1', '2']);

      await expect(p.infoBox).toHaveText('Removed tail node with value "3". List length: 2');
    });

    test('RemoveHead on empty list results in informational message and no crash', async ({ page }) => {
      const p7 = new DoublyLinkedListPage(page);

      // Ensure list is empty initially
      await expect(p.nodeLocator).toHaveCount(0);

      await p.removeHead();

      // Info should indicate nothing to remove
      await expect(p.infoBox).toHaveText('List is empty. Nothing to remove.');

      // Still empty
      await expect(p.nodeLocator).toHaveCount(0);

      // No page errors
      expect(pageErrors.length).toBe(0);
    });

    test('RemoveTail on empty list results in informational message and no crash', async ({ page }) => {
      const p8 = new DoublyLinkedListPage(page);

      await expect(p.nodeLocator).toHaveCount(0);

      await p.removeTail();

      await expect(p.infoBox).toHaveText('List is empty. Nothing to remove.');

      await expect(p.nodeLocator).toHaveCount(0);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Search and ClearSearch behaviors', () => {
    test('Search finds a node, highlights it, and updates info', async ({ page }) => {
      const p9 = new DoublyLinkedListPage(page);

      // Prepare nodes: alpha, beta, gamma
      await p.addTail('alpha');
      await p.addTail('beta');
      await p.addTail('gamma');

      // Search for 'beta'
      await p.search('beta');

      // Info should indicate found
      await expect(p.infoBox).toHaveText('Value "beta" found in the list.');

      // The node with text 'beta' should have the 'current' class
      const isCurrent = await p.nodeHasCurrentClassByText('beta');
      expect(isCurrent).toBe(true);

      // Clear search
      await p.clearSearch();

      // Ensure highlight cleared and search value cleared
      const isCurrentAfterClear = await p.nodeHasCurrentClassByText('beta');
      expect(isCurrentAfterClear).toBe(false);

      await expect(p.infoBox).toHaveText('Search highlight cleared.');
      await expect(p.searchValue).toHaveValue('');
    });

    test('Search for missing value shows not-found message and no highlight', async ({ page }) => {
      const p10 = new DoublyLinkedListPage(page);

      await p.addTail('10');
      await p.addTail('20');

      await p.search('999');

      await expect(p.infoBox).toHaveText('Value "999" not found in the list.');

      // no node should have 'current'
      const nodesCount = await p.countNodes();
      for (let i = 0; i < nodesCount; i++) {
        const el1 = p.nodeLocator.nth(i);
        const hasCurrent = await el.evaluate((n) => n.classList.contains('current'));
        expect(hasCurrent).toBe(false);
      }
    });

    test('Search with empty input triggers alert dialog (error scenario)', async ({ page }) => {
      const p11 = new DoublyLinkedListPage(page);

      // Ensure searchValue is empty
      await p.searchValue.fill('');

      // Wait for dialog triggered by clicking searchBtn
      const dialogPromise = page.waitForEvent('dialog');

      await p.searchBtn.click();

      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      // Expect the exact alert message as in implementation
      expect(dialog.message()).toBe('Please enter a value to search.');
      await dialog.accept();

      // Also ensure info hasn't been set to a mistaken value
      // (implementation returns early on alert)
      const info = await p.getInfoText();
      // It could either remain the initial or previous; ensure it doesn't say "found" for empty
      expect(info.includes('found')).toBe(false);
    });
  });

  test.describe('ClearList (confirmation) behavior and transitions', () => {
    test('ClearList cancellation leaves list intact', async ({ page }) => {
      const p12 = new DoublyLinkedListPage(page);

      await p.addTail('one');
      await p.addTail('two');

      // Dismiss the confirm dialog => list should remain
      const dialogPromise1 = page.waitForEvent('dialog');
      await p.clearListBtn.click();
      const dialog1 = await dialogPromise;
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toBe('Are you sure you want to clear the entire list?');
      await dialog.dismiss();

      // List should still contain nodes
      await expect(p.nodeLocator).toHaveCount(2);
      const texts6 = await p.getNodeTexts();
      expect(texts).toEqual(['one', 'two']);
    });

    test('ClearList acceptance clears list and updates info', async ({ page }) => {
      const p13 = new DoublyLinkedListPage(page);

      await p.addTail('uno');
      await p.addTail('dos');

      // Accept the confirm dialog to clear the list
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        p.clearListBtn.click()
      ]);
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();

      // After clearing, list should be empty and info reflects clearing
      await expect(p.nodeLocator).toHaveCount(0);
      await expect(p.listContainer).toHaveText('The list is empty.');
      await expect(p.infoBox).toHaveText('List cleared.');
    });
  });

  test.describe('Edge cases: validation alerts and resilience', () => {
    test('Attempting to add when input is empty triggers alert (AddHead)', async ({ page }) => {
      const p14 = new DoublyLinkedListPage(page);

      // Ensure inputValue empty
      await p.inputValue.fill('');

      // Click addHead and assert alert appears
      const dialogPromise2 = page.waitForEvent('dialog');
      await p.addHeadBtn.click();
      const dialog2 = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Please enter a value to add.');
      await dialog.accept();

      // Ensure list still empty
      await expect(p.nodeLocator).toHaveCount(0);
      await expect(p.infoBox).not.toHaveText('Added');
    });

    test('Attempting to add when input is empty triggers alert (AddTail)', async ({ page }) => {
      const p15 = new DoublyLinkedListPage(page);

      await p.inputValue.fill('');

      const dialogPromise3 = page.waitForEvent('dialog');
      await p.addTailBtn.click();
      const dialog3 = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Please enter a value to add.');
      await dialog.accept();

      await expect(p.nodeLocator).toHaveCount(0);
    });
  });

  test('Sanity: ensure no uncaught runtime errors across a sequence of operations', async ({ page }) => {
    const p16 = new DoublyLinkedListPage(page);

    // Perform a mixed sequence of operations
    await p.addHead('alpha');
    await p.addTail('beta');
    await p.addHead('gamma');
    await p.search('beta'); // should highlight beta
    await p.clearSearch();
    await p.removeTail(); // removes beta
    await p.removeHead(); // removes gamma
    // Now only 'alpha' should remain (or removed depending order) - verify DOM is consistent
    const nodes1 = await p.getNodeTexts();
    // Nodes should be zero or one depending on prior operations; ensure DOM consistent count matches arrows logic
    const nodeCount = nodes.length;
    const arrowCount = await p.countArrows();
    expect(arrowCount).toBe(Math.max(0, nodeCount - 1));

    // No uncaught page errors throughout
    expect(pageErrors.length).toBe(0);
    const consoleErrors4 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});