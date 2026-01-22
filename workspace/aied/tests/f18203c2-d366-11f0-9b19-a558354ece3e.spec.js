import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f18203c2-d366-11f0-9b19-a558354ece3e.html';

// Page Object encapsulating interactions with the Knapsack demo app
class KnapsackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.capacity = page.locator('#capacity');
    this.itemName = page.locator('#itemName');
    this.itemWeight = page.locator('#itemWeight');
    this.itemValue = page.locator('#itemValue');
    this.addItemBtn = page.locator('#addItem');
    this.solveBtn = page.locator('#solve');
    this.resetBtn = page.locator('#reset');
    this.itemListDiv = page.locator('#itemList');
    this.knapsackContainer = page.locator('#knapsackContainer');
    this.statsDiv = page.locator('#stats');
    this.iterationTableDiv = page.locator('#iterationTable');
    this.itemRows = page.locator('.item');
    this.selectedItems = page.locator('.selected-item');
  }

  async navigate() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // The app initializes demo items on window.onload, wait for at least one demo item
    await this.page.waitForLoadState('load');
    // Wait for the demo items to be rendered by updateItemList()
    await this.page.waitForSelector('.item');
  }

  async addItem(name, weight, value) {
    await this.itemName.fill(name);
    await this.itemWeight.fill(String(weight));
    await this.itemValue.fill(String(value));
    await this.addItemBtn.click();
  }

  async solve() {
    await this.solveBtn.click();
  }

  async reset() {
    await this.resetBtn.click();
  }

  // Remove an item by visible item name (click the adjacent Remove button)
  async removeItemByName(name) {
    const itemInfo = this.page.locator('.item .item-info', { hasText: name });
    const item = itemInfo.locator('..'); // parent .item
    const removeBtn = item.locator('.remove-item');
    await removeBtn.click();
  }

  async getItemCount() {
    return await this.itemRows.count();
  }

  async getCapacityValue() {
    return await this.capacity.inputValue();
  }

  async getSelectedItemsCount() {
    return await this.selectedItems.count();
  }

  async getIterationRowCount() {
    return await this.page.locator('#iterationTable table tbody tr').count();
  }

  async getStatsText() {
    return await this.statsDiv.innerText();
  }

  // Helper to accept any dialog and capture its message
  async captureNextDialog(callback) {
    return new Promise(async (resolve) => {
      const handler = async dialog => {
        try {
          const msg = dialog.message();
          await dialog.accept();
          this.page.off('dialog', handler);
          resolve(msg);
        } catch (e) {
          this.page.off('dialog', handler);
          resolve(null);
        }
      };
      this.page.on('dialog', handler);
      await callback();
      // The promise will resolve when dialog handler runs
    });
  }
}

test.describe('Knapsack Problem Demonstration - FSM and UI tests', () => {
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  // Setup before each test: collect console messages and page errors, navigate to the app
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate and wait for demo initialization
    const kp = new KnapsackPage(page);
    await kp.navigate();
  });

  // Teardown after each test: assert there were no unexpected page errors or console errors
  test.afterEach(async () => {
    // Assert there were no uncaught exceptions in page execution
    expect(pageErrors.length, `Expected no page errors, found: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    // Assert there are no console.error messages
    expect(consoleErrors.length, `Expected no console.error messages, found: ${consoleErrors.join('; ')}`).toBe(0);
  });

  test.describe('State S0_Idle (Initial render)', () => {
    test('renders main heading and demo items on load (renderPage entry action)', async ({ page }) => {
      // Validate initial page content and demo initialization
      const kp = new KnapsackPage(page);

      // The header should be present per FSM evidence
      const header = page.locator('h1', { hasText: 'Knapsack Problem Demonstration' });
      await expect(header).toBeVisible();

      // Capacity input should have default value '15' (component evidence)
      await expect(kp.capacity).toHaveValue('15');

      // The demo initializeDemoItems() should have created 5 items
      // Confirm there are at least 5 .item entries (Camera, Laptop, Book, Water, Snacks)
      const count = await kp.getItemCount();
      expect(count).toBeGreaterThanOrEqual(5);
    });
  });

  test.describe('Event: AddItem and state S1_ItemAdded', () => {
    test('adding a valid item updates the item list and clears inputs (updateItemList entry action)', async ({ page }) => {
      const kp = new KnapsackPage(page);

      const before = await kp.getItemCount();
      // Add a new valid item
      await kp.addItem('Tent', 5, 8);

      // After adding, item count increments
      const after = await kp.getItemCount();
      expect(after).toBe(before + 1);

      // The input fields should be cleared
      await expect(kp.itemName).toHaveValue('');
      await expect(kp.itemWeight).toHaveValue('');
      await expect(kp.itemValue).toHaveValue('');
      
      // New item should appear in the list by name
      await expect(page.locator('.item .item-info', { hasText: 'Tent' })).toBeVisible();
    });

    test('adding invalid items triggers alert and does not add to list (edge case)', async ({ page }) => {
      const kp = new KnapsackPage(page);

      // Attempt to add with empty name -> triggers alert
      const before = await kp.getItemCount();
      const dialogMsg = await kp.captureNextDialog(async () => {
        await kp.addItem('', 3, 5);
      });
      expect(dialogMsg).toContain('Please enter valid item name, weight, and value');

      const after = await kp.getItemCount();
      expect(after).toBe(before); // no new item added

      // Attempt to add with invalid weight/value
      const dialogMsg2 = await kp.captureNextDialog(async () => {
        await kp.addItem('Bad', 0, -2);
      });
      expect(dialogMsg2).toContain('Please enter valid item name, weight, and value');

      const after2 = await kp.getItemCount();
      expect(after2).toBe(before);
    });
  });

  test.describe('Event: RemoveItem within S1_ItemAdded', () => {
    test('removing an item updates the list (items.splice and updateItemList evidence)', async ({ page }) => {
      const kp = new KnapsackPage(page);

      // Ensure a unique item exists, add one to remove
      await kp.addItem('RemoveMe', 2, 1);
      await expect(page.locator('.item .item-info', { hasText: 'RemoveMe' })).toBeVisible();

      const before = await kp.getItemCount();

      // Remove it by clicking its "Remove" button
      await kp.removeItemByName('RemoveMe');

      // After removal, item count decreased by 1
      const after = await kp.getItemCount();
      expect(after).toBe(before - 1);

      // Ensure the removed item text is no longer present
      await expect(page.locator('.item .item-info', { hasText: 'RemoveMe' })).toHaveCount(0);
    });
  });

  test.describe('Event: SolveKnapsack and state S2_Solved', () => {
    test('solving with items displays selected items, stats, and DP iteration table (displaySolution/displayIterations evidence)', async ({ page }) => {
      const kp = new KnapsackPage(page);

      // Ensure there are items (demo items exist). Click solve.
      await kp.solve();

      // After solving, knapsack container should show 'Selected Items' header
      await expect(kp.knapsackContainer.locator('h3', { hasText: 'Selected Items:' })).toBeVisible();

      // Stats should contain 'Total Value' and show some text
      const statsText = await kp.getStatsText();
      expect(statsText).toContain('Total Value');

      // The iteration table should be present and contain rows
      await expect(kp.iterationTableDiv.locator('table')).toBeVisible();
      const rows = await kp.getIterationRowCount();
      expect(rows).toBeGreaterThan(0);

      // Iteration table rows should include Decision column with 'Take' or 'Skip' values
      const hasDecisionText = await page.locator('#iterationTable table tbody tr td').filter({ hasText: 'Take' }).count()
        + await page.locator('#iterationTable table tbody tr td').filter({ hasText: 'Skip' }).count();
      expect(hasDecisionText).toBeGreaterThan(0);

      // Selected items displayed count should equal the number reported in stats "Items Selected:"
      // Extract reported count from stats
      const stats = statsText;
      const match = stats.match(/Items Selected:\s*(\d+)/);
      if (match) {
        const reportedSelected = Number(match[1]);
        const selectedCount = await kp.getSelectedItemsCount();
        expect(selectedCount).toBe(reportedSelected);
      }
    });

    test('solving with no items triggers alert (edge case)', async ({ page }) => {
      const kp = new KnapsackPage(page);

      // Reset to clear items
      await kp.reset();
      const countAfterReset = await kp.getItemCount();
      // After reset demo items removed, it may show 'No items added yet.' meaning zero items
      expect(countAfterReset).toBe(0);

      // Attempt to solve with no items -> alert
      const dialogMsg = await kp.captureNextDialog(async () => {
        await kp.solve();
      });
      expect(dialogMsg).toContain('Please add at least one item');

      // State should remain with empty knapsack and no iterations rendered
      await expect(kp.knapsackContainer.locator('p', { hasText: 'Knapsack is empty' })).toBeVisible();
      await expect(kp.iterationTableDiv).toHaveText(''); // nothing in the iterationTableDiv
    });

    test('solving with invalid capacity triggers alert (edge case)', async ({ page }) => {
      const kp = new KnapsackPage(page);

      // Ensure at least one item exists (re-add one)
      await kp.addItem('CapTestItem', 1, 1);
      const itemCount = await kp.getItemCount();
      expect(itemCount).toBeGreaterThan(0);

      // Set invalid capacity 0
      await kp.capacity.fill('0');

      // Attempt to solve -> should alert about invalid capacity
      const dialogMsg = await kp.captureNextDialog(async () => {
        await kp.solve();
      });
      expect(dialogMsg).toContain('Please enter a valid capacity');

      // Restore capacity to default so subsequent tests are not affected
      await kp.capacity.fill('15');
    });
  });

  test.describe('Event: Reset and state S3_Reset', () => {
    test('reset clears items, iterations, stats and resets capacity to default (resetInputs evidence)', async ({ page }) => {
      const kp = new KnapsackPage(page);

      // Ensure there are items before reset
      const before = await kp.getItemCount();
      expect(before).toBeGreaterThanOrEqual(1);

      // Solve first to populate iterations and selected items
      await kp.solve();
      const iterationRows = await kp.getIterationRowCount();
      expect(iterationRows).toBeGreaterThan(0);

      // Now perform reset
      await kp.reset();

      // Items should be cleared
      const after = await kp.getItemCount();
      expect(after).toBe(0);

      // Capacity input should be reset to '15'
      const capacityValue = await kp.getCapacityValue();
      expect(capacityValue).toBe('15');

      // Knapsack container should show placeholder message again
      await expect(kp.knapsackContainer.locator('p', { hasText: 'Knapsack is empty. Click "Solve" to see the solution.' })).toBeVisible();

      // Stats should be empty and iteration table cleared
      await expect(kp.statsDiv).toHaveText('');
      await expect(kp.iterationTableDiv).toHaveText('');
    });
  });

  // Additional sanity checks: console and runtime diagnostics are asserted in afterEach
  test.describe('Diagnostics: Console and page errors', () => {
    test('no uncaught exceptions or console.error on normal usage', async ({ page }) => {
      // This test relies on the afterEach assertions to validate no page errors or console errors occurred
      // Do a quick interaction: add and remove an item to exercise code paths
      const kp = new KnapsackPage(page);
      await kp.addItem('DiagItem', 2, 2);
      await kp.removeItemByName('DiagItem');

      // Solve once to execute knapsack() and display functions
      await kp.solve();

      // afterEach will assert there are no pageErrors or consoleErrors
    });
  });
});