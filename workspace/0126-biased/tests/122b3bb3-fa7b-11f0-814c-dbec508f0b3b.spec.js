import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122b3bb3-fa7b-11f0-814c-dbec508f0b3b.html';

/**
 * Page object encapsulating interactions with the Priority Queue page.
 */
class PriorityQueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.addBtn = page.locator('#add-btn');
    this.removeBtn = page.locator('#remove-btn');
    this.displayBtn = page.locator('#display-btn');
    this.saveBtn = page.locator('#save-btn');
    this.priorityInput = page.locator('#priority-level');
    this.itemNameInput = page.locator('#item-name');
    this.itemValueInput = page.locator('#item-value');
    this.tableBody = page.locator('#item-tbody');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickAdd() {
    await this.addBtn.click();
  }

  async clickRemove() {
    await this.removeBtn.click();
  }

  async clickDisplay() {
    await this.displayBtn.click();
  }

  async clickSave() {
    await this.saveBtn.click();
  }

  async setItemName(name) {
    await this.itemNameInput.fill(name);
  }

  async setItemValue(value) {
    await this.itemValueInput.fill(value);
  }

  async setPriorityLevel(value) {
    // Note: the application implementation does not read this input when saving,
    // but we expose it to validate that changing it has no unintended side effects.
    await this.priorityInput.fill(String(value));
  }

  async getTableRows() {
    const rows = await this.tableBody.locator('tr').elementHandles();
    const result = [];
    for (const row of rows) {
      const tds = await row.$$('td');
      const cells = [];
      for (const td of tds) {
        const txt = (await td.innerText()).trim();
        cells.push(txt);
      }
      result.push(cells);
    }
    return result;
  }
}

test.describe('Priority Queue - FSM states & transitions (122b3bb3-fa7b-11f0-814c-dbec508f0b3b)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught page errors (e.g., ReferenceError, TypeError, SyntaxError)
    page.on('pageerror', (err) => {
      // store the error object for assertions
      pageErrors.push(err);
    });

    // Capture console messages (including console.error)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Nothing to tear down beyond automatic Playwright cleanup. We keep hooks for clarity.
  });

  test.describe('Initial state (S0_Idle) and entry actions', () => {
    test('should load the page and have the expected controls present', async ({ page }) => {
      // Validate DOM elements exist as described by the FSM evidence
      const pq = new PriorityQueuePage(page);

      await expect(pq.addBtn).toBeVisible();
      await expect(pq.removeBtn).toBeVisible();
      await expect(pq.displayBtn).toBeVisible();
      await expect(pq.saveBtn).toBeVisible();
      await expect(pq.priorityInput).toBeVisible();
      await expect(pq.itemNameInput).toBeVisible();
      await expect(pq.itemValueInput).toBeVisible();
      await expect(pq.tableBody).toBeVisible();

      // Entry action updateItemTable() should have initialized the table to empty
      const rows = await pq.getTableRows();
      expect(rows.length).toBe(0);

      // Assert that there were no uncaught page errors during load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Event: AddItem (click #add-btn) and transition validations', () => {
    test('clicking Add without setting item fields adds an item with empty name/value and expected priority', async ({ page }) => {
      const pq = new PriorityQueuePage(page);

      // Ensure table initially empty
      let rows = await pq.getTableRows();
      expect(rows.length).toBe(0);

      // Click Add - per implementation this pushes {priorityLevel: parseInt(priorityLevels.shift()), itemName: itemName, itemValue: itemValue}
      await pq.clickAdd();

      // Table should be updated (updateItemTable called)
      rows = await pq.getTableRows();
      expect(rows.length).toBe(1);

      // The first item should have priority "1" and empty name/value
      const [priority, name, value] = rows[0];
      expect(priority).toBe('1');
      expect(name).toBe('');
      expect(value).toBe('');

      // No runtime errors should have occurred as a result
      expect(pageErrors.length).toBe(0);
    });

    test('multiple Add operations consume priorityLevels sequentially', async ({ page }) => {
      const pq = new PriorityQueuePage(page);

      // Reset by reloading to ensure fresh priorityLevels
      await pq.goto();

      // Add three items (without setting fields)
      await pq.clickAdd();
      await pq.clickAdd();
      await pq.clickAdd();

      const rows = await pq.getTableRows();
      expect(rows.length).toBe(3);

      // Priorities should be 1,2,3 in order
      expect(rows[0][0]).toBe('1');
      expect(rows[1][0]).toBe('2');
      expect(rows[2][0]).toBe('3');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Event: SaveItem (click #save-btn) and transition validations', () => {
    test('saving an item uses input fields and updates the table', async ({ page }) => {
      const pq = new PriorityQueuePage(page);

      // Set inputs to custom values
      await pq.setItemName('Task A');
      await pq.setItemValue('High');

      // Click Save - implementation uses priorityLevels.shift() (not the priority input)
      await pq.clickSave();

      const rows = await pq.getTableRows();
      expect(rows.length).toBe(1);

      // Because the test page was loaded fresh, first priority shift is 1
      expect(rows[0][0]).toBe('1');
      expect(rows[0][1]).toBe('Task A');
      expect(rows[0][2]).toBe('High');

      expect(pageErrors.length).toBe(0);
    });

    test('changing the visible priority input does NOT affect saved priority (edge case)', async ({ page }) => {
      const pq = new PriorityQueuePage(page);

      // Change the priority input to an extreme value (this input is not read by save in the implementation)
      await pq.setPriorityLevel(9999);

      // Fill fields and save
      await pq.setItemName('Task B');
      await pq.setItemValue('Low');
      await pq.clickSave();

      const rows = await pq.getTableRows();
      // There should be 1 row (fresh page) or 2 if previous test ran in same context — we reloaded per test so 1
      expect(rows.length).toBe(1);
      // Priority should be from the internal priorityLevels array, starting at 1
      expect(rows[0][0]).toBe('1');
      expect(rows[0][1]).toBe('Task B');
      expect(rows[0][2]).toBe('Low');

      // Priority input change should not have caused any errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Event: DisplayQueue (click #display-btn) and transition validations', () => {
    test('Display recreates table rows to show current queue (no data mutation expected)', async ({ page }) => {
      const pq = new PriorityQueuePage(page);

      // Prepare data: save two items
      await pq.setItemName('Alpha');
      await pq.setItemValue('1');
      await pq.clickSave();

      await pq.setItemName('Beta');
      await pq.setItemValue('2');
      await pq.clickSave();

      // The table should show two rows
      let rows = await pq.getTableRows();
      expect(rows.length).toBe(2);
      expect(rows[0][1]).toBe('Alpha');
      expect(rows[1][1]).toBe('Beta');

      // Calling Display should not alter the queue, but will replace the table contents
      await pq.clickDisplay();

      // After display, ensure data still present and unchanged
      rows = await pq.getTableRows();
      expect(rows.length).toBe(2);
      expect(rows[0][1]).toBe('Alpha');
      expect(rows[1][1]).toBe('Beta');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Event: RemoveItem (click #remove-btn) and transition validations', () => {
    test('Remove pops the front of the queue and updates table', async ({ page }) => {
      const pq = new PriorityQueuePage(page);

      // Save two items so we can remove one
      await pq.setItemName('First');
      await pq.setItemValue('A');
      await pq.clickSave();

      await pq.setItemName('Second');
      await pq.setItemValue('B');
      await pq.clickSave();

      // Confirm both saved
      let rows = await pq.getTableRows();
      expect(rows.length).toBe(2);
      expect(rows[0][1]).toBe('First');

      // Remove first item (queue.shift())
      await pq.clickRemove();

      rows = await pq.getTableRows();
      expect(rows.length).toBe(1);
      expect(rows[0][1]).toBe('Second');

      expect(pageErrors.length).toBe(0);
    });

    test('Removing when queue is empty is a no-op and causes no errors (edge case)', async ({ page }) => {
      const pq = new PriorityQueuePage(page);

      // Ensure table empty
      let rows = await pq.getTableRows();
      expect(rows.length).toBe(0);

      // Click remove when empty - implementation guards with if (queue.length > 0)
      await pq.clickRemove();

      // Still empty
      rows = await pq.getTableRows();
      expect(rows.length).toBe(0);

      // No errors should have been thrown
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Integration flows and error/console observation', () => {
    test('complex flow: Add(empty)->Save(named)->Display->Remove->Remove(empty) and observe console/page errors', async ({ page }) => {
      const pq = new PriorityQueuePage(page);

      // Start empty
      let rows = await pq.getTableRows();
      expect(rows.length).toBe(0);

      // Add (will push empty values)
      await pq.clickAdd();
      rows = await pq.getTableRows();
      expect(rows.length).toBe(1);
      expect(rows[0][1]).toBe(''); // empty name

      // Save a named item
      await pq.setItemName('Complex Task');
      await pq.setItemValue('X');
      await pq.clickSave();
      rows = await pq.getTableRows();
      expect(rows.length).toBe(2);

      // Display explicitly
      await pq.clickDisplay();
      rows = await pq.getTableRows();
      expect(rows.length).toBe(2);
      expect(rows[1][1]).toBe('Complex Task');

      // Remove twice: first will remove first item, second will remove the remaining
      await pq.clickRemove();
      await pq.clickRemove();

      rows = await pq.getTableRows();
      expect(rows.length).toBe(0);

      // Attempt remove again (no-op)
      await pq.clickRemove();
      rows = await pq.getTableRows();
      expect(rows.length).toBe(0);

      // Inspect captured console messages for any 'error' type entries
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
      // We expect no console.error messages in normal operation
      expect(consoleErrors.length).toBe(0);

      // Assert no uncaught page errors were observed
      expect(pageErrors.length).toBe(0);
    });
  });
});