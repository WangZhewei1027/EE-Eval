import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a322000-ffc5-11f0-8b43-1ffa87931c43.html';

// Page object to encapsulate interactions with the linked list demo page
class LinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.valueInput = page.locator('#valueInput');
    this.indexInput = page.locator('#indexInput');
    this.pushBtn = page.locator('#pushBtn');
    this.unshiftBtn = page.locator('#unshiftBtn');
    this.insertBtn = page.locator('#insertBtn');
    this.popBtn = page.locator('#popBtn');
    this.shiftBtn = page.locator('#shiftBtn');
    this.removeBtn = page.locator('#removeBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.linkedList = page.locator('#linkedlist');
    this.emptyDiv = page.locator('#empty');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async setValue(val) {
    await this.valueInput.fill(String(val));
  }

  async setIndex(val) {
    // If nullish, clear the input
    if (val === null || val === undefined || val === '') {
      await this.indexInput.fill('');
    } else {
      await this.indexInput.fill(String(val));
    }
  }

  async clickPush() {
    await this.pushBtn.click();
  }

  async clickUnshift() {
    await this.unshiftBtn.click();
  }

  async clickInsert() {
    await this.insertBtn.click();
  }

  async clickPop() {
    await this.popBtn.click();
  }

  async clickShift() {
    await this.shiftBtn.click();
  }

  async clickRemove() {
    await this.removeBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  // Returns array of node elements
  async nodeCount() {
    return await this.linkedList.locator('.node').count();
  }

  async nodeValues() {
    const count = await this.nodeCount();
    const values = [];
    for (let i = 0; i < count; i++) {
      const node = this.linkedList.locator('.node').nth(i);
      values.push(await node.textContent());
    }
    return values;
  }

  async isEmptyVisible() {
    return await this.emptyDiv.isVisible();
  }

  // Utility: get aria-labels of nodes (useful to check index and value in label)
  async nodeAriaLabels() {
    const count = await this.nodeCount();
    const labels = [];
    for (let i = 0; i < count; i++) {
      const node = this.linkedList.locator('.node').nth(i);
      labels.push(await node.getAttribute('aria-label'));
    }
    return labels;
  }
}

test.describe('Linked List Demo - FSM states & transitions', () => {
  // Collect console errors and page errors for each test to assert no unexpected runtime errors
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });
  });

  test.describe('State S0_Empty (Empty List) validation', () => {
    test('Initial render shows empty state and no nodes', async ({ page }) => {
      // Validate initial empty state (S0_Empty)
      const p = new LinkedListPage(page);
      await p.goto();

      // The visualization should show the empty message and no nodes
      expect(await p.isEmptyVisible()).toBeTruthy();
      expect(await p.nodeCount()).toBe(0);

      // Ensure the empty div contains the expected text
      const emptyText = await page.locator('#empty').textContent();
      expect(emptyText).toContain('The linked list is empty.');

      // No runtime errors or console errors should have occurred
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Push with empty input shows validation alert (edge case)', async ({ page }) => {
      // If user clicks Push without a value, an alert should appear and nothing should change
      const p = new LinkedListPage(page);
      await p.goto();

      // Ensure value input is empty
      await p.setValue('');

      const dialogPromise = page.waitForEvent('dialog');
      await p.clickPush();
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Please enter a value.');
      await dialog.accept();

      // List should remain empty
      expect(await p.isEmptyVisible()).toBeTruthy();
      expect(await p.nodeCount()).toBe(0);

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test.describe('Transitions from Empty -> Non-Empty (Push, Unshift)', () => {
    test('Push adds node at end and transitions to Non-Empty (S1_NonEmpty)', async ({ page }) => {
      // This validates the Push event and transition S0_Empty -> S1_NonEmpty
      const p = new LinkedListPage(page);
      await p.goto();

      // Add a value using push
      await p.setValue('NodeA');

      await p.clickPush();

      // After push, empty message should be hidden and one node should exist
      expect(await p.isEmptyVisible()).toBeFalsy();
      expect(await p.nodeCount()).toBe(1);

      const values = await p.nodeValues();
      expect(values.map(v => v.trim())).toEqual(['NodeA']);

      // Value input should be cleared after push
      expect(await page.locator('#valueInput').inputValue()).toBe('');

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Unshift adds node at start and transitions to Non-Empty (S1_NonEmpty)', async ({ page }) => {
      // Validate Unshift event from empty list
      const p = new LinkedListPage(page);
      await p.goto();

      await p.setValue('First');
      await p.clickUnshift();

      expect(await p.isEmptyVisible()).toBeFalsy();
      expect(await p.nodeCount()).toBe(1);

      let values = await p.nodeValues();
      expect(values.map(v => v.trim())).toEqual(['First']);

      // Now unshift another node to ensure it goes to start
      await p.setValue('NewFirst');
      await p.clickUnshift();

      expect(await p.nodeCount()).toBe(2);
      values = await p.nodeValues();
      expect(values.map(v => v.trim())).toEqual(['NewFirst', 'First']);

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test.describe('Insert, Pop, Shift, Remove transitions within Non-Empty (S1_NonEmpty)', () => {
    test('Insert at index inserts correctly and preserves/changes length as expected', async ({ page }) => {
      // Prepare a list [A, C], then insert B at index 1 -> [A, B, C]
      const p = new LinkedListPage(page);
      await p.goto();

      await p.setValue('A');
      await p.clickPush();

      await p.setValue('C');
      await p.clickPush();

      // Confirm initial state
      expect(await p.nodeValues()).toEqual(['A', 'C']);

      // Insert without index should alert
      await p.setValue('X');
      await p.setIndex('');
      const dialogPromise1 = page.waitForEvent('dialog');
      await p.clickInsert();
      const d1 = await dialogPromise1;
      // The app asks: "Please enter an index for insertion."
      expect(d1.message()).toBe('Please enter an index for insertion.');
      await d1.accept();

      // Now provide invalid index (negative) -> getIndexValue alerts
      await p.setValue('X');
      await p.setIndex('-1');
      const dialogPromise2 = page.waitForEvent('dialog');
      await p.clickInsert();
      const d2 = await dialogPromise2;
      // The app will alert "Please enter a valid non-negative index."
      expect(d2.message()).toBe('Please enter a valid non-negative index.');
      await d2.accept();

      // Now provide out-of-bounds index > length -> alert
      await p.setValue('X');
      await p.setIndex('5'); // current length is 2
      const dialogPromise3 = page.waitForEvent('dialog');
      await p.clickInsert();
      const d3 = await dialogPromise3;
      expect(d3.message()).toContain('Index out of bounds. Max allowed index is');
      await d3.accept();

      // Finally insert properly at index 1
      await p.setValue('B');
      await p.setIndex('1');

      // No alert expected, so await click and then verify
      await p.clickInsert();

      expect(await p.nodeCount()).toBe(3);
      const values = (await p.nodeValues()).map(v => v.trim());
      expect(values).toEqual(['A', 'B', 'C']);

      // indexInput and valueInput should be cleared after successful insert
      expect(await page.locator('#valueInput').inputValue()).toBe('');
      expect(await page.locator('#indexInput').inputValue()).toBe('');

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Pop removes last node, alerts removed value, and updates visualization', async ({ page }) => {
      // Build list [1,2,3] then pop -> removed 3, list [1,2]
      const p = new LinkedListPage(page);
      await p.goto();

      await p.setValue('1');
      await p.clickPush();
      await p.setValue('2');
      await p.clickPush();
      await p.setValue('3');
      await p.clickPush();

      expect(await p.nodeValues()).toEqual(['1', '2', '3']);

      // pop produces an alert with removed value
      const dialogPromise = page.waitForEvent('dialog');
      await p.clickPop();
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Removed from end: 3');
      await dialog.accept();

      expect(await p.nodeValues()).toEqual(['1', '2']);
      expect(await p.nodeCount()).toBe(2);

      // Pop twice more to ensure tail updates; second pop removes 2
      const d2Promise = page.waitForEvent('dialog');
      await p.clickPop();
      const d2 = await d2Promise;
      expect(d2.message()).toBe('Removed from end: 2');
      await d2.accept();

      expect(await p.nodeValues()).toEqual(['1']);
      expect(await p.nodeCount()).toBe(1);

      // Pop last element -> removed 1, list becomes empty and emptyDiv visible
      const d3Promise = page.waitForEvent('dialog');
      await p.clickPop();
      const d3 = await d3Promise;
      expect(d3.message()).toBe('Removed from end: 1');
      await d3.accept();

      expect(await p.nodeCount()).toBe(0);
      expect(await p.isEmptyVisible()).toBeTruthy();

      // Now popping when empty should alert "List is empty."
      const d4Promise = page.waitForEvent('dialog');
      await p.clickPop();
      const d4 = await d4Promise;
      expect(d4.message()).toBe('List is empty.');
      await d4.accept();

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Shift removes first node, alerts removed value, and updates visualization', async ({ page }) => {
      // Build list [x,y,z] then shift -> removed x -> [y,z]
      const p = new LinkedListPage(page);
      await p.goto();

      await p.setValue('x'); await p.clickPush();
      await p.setValue('y'); await p.clickPush();
      await p.setValue('z'); await p.clickPush();

      expect(await p.nodeValues()).toEqual(['x', 'y', 'z']);

      // shift produces an alert with removed value
      const dialogPromise = page.waitForEvent('dialog');
      await p.clickShift();
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Removed from start: x');
      await dialog.accept();

      expect(await p.nodeValues()).toEqual(['y', 'z']);
      expect(await p.nodeCount()).toBe(2);

      // Shift twice more to empty the list
      const d2Promise = page.waitForEvent('dialog');
      await p.clickShift();
      const d2 = await d2Promise;
      expect(d2.message()).toBe('Removed from start: y');
      await d2.accept();

      const d3Promise = page.waitForEvent('dialog');
      await p.clickShift();
      const d3 = await d3Promise;
      expect(d3.message()).toBe('Removed from start: z');
      await d3.accept();

      expect(await p.nodeCount()).toBe(0);
      expect(await p.isEmptyVisible()).toBeTruthy();

      // Shifting when empty should alert "List is empty."
      const d4Promise = page.waitForEvent('dialog');
      await p.clickShift();
      const d4 = await d4Promise;
      expect(d4.message()).toBe('List is empty.');
      await d4.accept();

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Remove at index removes correct node and handles invalid index edge cases', async ({ page }) => {
      // Create [a,b,c,d] then remove index 2 -> removes 'c' -> [a,b,d]
      const p = new LinkedListPage(page);
      await p.goto();

      for (const v of ['a', 'b', 'c', 'd']) {
        await p.setValue(v);
        await p.clickPush();
      }
      expect(await p.nodeValues()).toEqual(['a', 'b', 'c', 'd']);

      // Attempt to remove without index -> should alert "Please enter an index to remove."
      await p.setIndex('');
      const dialogPromise1 = page.waitForEvent('dialog');
      await p.clickRemove();
      const d1 = await dialogPromise1;
      expect(d1.message()).toBe('Please enter an index to remove.');
      await d1.accept();

      // Attempt to remove with out-of-bounds index >= length -> alert
      await p.setIndex('99');
      const dialogPromise2 = page.waitForEvent('dialog');
      await p.clickRemove();
      const d2 = await dialogPromise2;
      expect(d2.message()).toContain('Index out of bounds. Max allowed index is');
      await d2.accept();

      // Remove valid index 2
      await p.setIndex('2');
      const dialogPromise3 = page.waitForEvent('dialog');
      await p.clickRemove();
      const d3 = await dialogPromise3;
      expect(d3.message()).toBe('Removed value at index 2: c');
      await d3.accept();

      expect(await p.nodeValues()).toEqual(['a', 'b', 'd']);
      expect(await p.nodeCount()).toBe(3);

      // Clean up: remove remaining nodes
      await p.setIndex('2'); // remove d
      const d4 = await page.waitForEvent('dialog');
      await p.clickRemove();
      const dialog4 = await d4;
      expect(dialog4.message()).toBe('Removed value at index 2: d');
      await dialog4.accept();

      await p.setIndex('0'); // remove a -> alert
      const d5 = await page.waitForEvent('dialog');
      await p.clickRemove();
      const dialog5 = await d5;
      expect(dialog5.message()).toBe('Removed value at index 0: a');
      await dialog5.accept();

      await p.setIndex('0'); // remove b -> alert
      const d6 = await page.waitForEvent('dialog');
      await p.clickRemove();
      const dialog6 = await d6;
      expect(dialog6.message()).toBe('Removed value at index 0: b');
      await dialog6.accept();

      expect(await p.nodeCount()).toBe(0);
      expect(await p.isEmptyVisible()).toBeTruthy();

      // Removing when empty should alert "List is empty."
      const d7Promise = page.waitForEvent('dialog');
      await p.clickRemove();
      const d7 = await d7Promise;
      expect(d7.message()).toBe('List is empty.');
      await d7.accept();

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test.describe('Clear list behavior and confirm/cancel edge cases', () => {
    test('Clear confirmed empties the list and shows empty state', async ({ page }) => {
      const p = new LinkedListPage(page);
      await p.goto();

      // Add some nodes
      await p.setValue('one'); await p.clickPush();
      await p.setValue('two'); await p.clickPush();

      expect(await p.nodeCount()).toBe(2);

      // Confirm dialog: accept
      const dialogPromise = page.waitForEvent('dialog');
      await p.clickClear();
      const dialog = await dialogPromise;
      // Confirm prompt message should be present; content may vary by browser but ensure it's non-empty
      expect(dialog.message().length).toBeGreaterThan(0);
      await dialog.accept();

      // After accepting, list should be empty
      expect(await p.nodeCount()).toBe(0);
      expect(await p.isEmptyVisible()).toBeTruthy();

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Clear canceled leaves the list intact', async ({ page }) => {
      const p = new LinkedListPage(page);
      await p.goto();

      // Add a node
      await p.setValue('keep'); await p.clickPush();
      expect(await p.nodeCount()).toBe(1);

      // Confirm dialog: dismiss (cancel)
      const dialogPromise = page.waitForEvent('dialog');
      await p.clickClear();
      const dialog = await dialogPromise;
      // Dismiss the confirmation to cancel clearing
      await dialog.dismiss();

      // The list should remain unchanged
      expect(await p.nodeCount()).toBe(1);
      expect(await p.isEmptyVisible()).toBeFalsy();

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test.describe('Accessibility and visual checks', () => {
    test('Nodes have role=listitem and aria-labels reflecting index and value', async ({ page }) => {
      const p = new LinkedListPage(page);
      await p.goto();

      await p.setValue('alpha'); await p.clickPush();
      await p.setValue('beta'); await p.clickPush();

      // Verify role and aria-label for each node
      const nodes = p.linkedList.locator('.node');
      const count = await nodes.count();
      expect(count).toBe(2);

      for (let i = 0; i < count; i++) {
        const node = nodes.nth(i);
        expect(await node.getAttribute('role')).toBe('listitem');
        const aria = await node.getAttribute('aria-label');
        expect(aria).toContain('Node ' + i);
        expect(aria).toContain('Value:');
      }

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // Final safety assertions to ensure no unexpected runtime errors occurred during the test.
    // pageErrors and consoleErrors arrays are captured in beforeEach and updated by event listeners.
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);

    // Ensure page is closed/cleanup handled by Playwright automatically.
  });
});