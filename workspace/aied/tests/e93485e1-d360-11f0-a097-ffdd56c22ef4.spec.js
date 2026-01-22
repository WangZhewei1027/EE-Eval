import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e93485e1-d360-11f0-a097-ffdd56c22ef4.html';

// Page Object to encapsulate common interactions with the Knapsack demo
class KnapsackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // selectors
    this.itemsList = page.locator('#itemsList');
    this.itemName = page.locator('#itemName');
    this.itemWeight = page.locator('#itemWeight');
    this.itemValue = page.locator('#itemValue');
    this.addItemBtn = page.locator('#addItemBtn');
    this.randomBtn = page.locator('#randomBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.capacityInput = page.locator('#capacityInput');
    this.runDpBtn = page.locator('#runDpBtn');
    this.runFracBtn = page.locator('#runFracBtn');
    this.animateDpBtn = page.locator('#animateDpBtn');
    this.outputArea = page.locator('#outputArea');
    this.dpTableContainer = page.locator('#dpTableContainer');
    this.fracTableContainer = page.locator('#fracTableContainer');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure initial render completed
    await expect(this.itemsList).toBeVisible();
    await expect(this.outputArea).toBeVisible();
  }

  async getItemsCount() {
    return await this.page.locator('#itemsList .item').count();
  }

  async addItem({ name = '', weight = '1', value = '0' } = {}) {
    if (name !== undefined) await this.itemName.fill(String(name));
    if (weight !== undefined) await this.itemWeight.fill(String(weight));
    if (value !== undefined) await this.itemValue.fill(String(value));
    await this.addItemBtn.click();
  }

  async clickRandom() {
    await this.randomBtn.click();
  }

  // acceptConfirm: when true accept the confirm dialog, otherwise dismiss
  async clickClear(acceptConfirm = true) {
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.clearBtn.click();
    const dialog = await dialogPromise;
    // assert it's a confirm with expected text
    // Accept or dismiss based on parameter
    if (acceptConfirm) await dialog.accept();
    else await dialog.dismiss();
  }

  async clickRunDP() {
    return await this.runDpBtn.click();
  }

  async clickRunFrac() {
    return await this.runFracBtn.click();
  }

  async clickAnimateDP() {
    return await this.animateDpBtn.click();
  }

  async getOutputText() {
    return (await this.outputArea.innerText()).trim();
  }

  async getDpTableExists() {
    return (await this.dpTableContainer.locator('table').count()) > 0;
  }

  async getFracTableExists() {
    return (await this.fracTableContainer.locator('table').count()) > 0;
  }

  async getDpSelectedCount() {
    return await this.dpTableContainer.locator('.selected').count();
  }

  async getFracRowsCount() {
    return await this.fracTableContainer.locator('tbody tr').count();
  }

  async deleteLastItem() {
    const delButtons = this.page.locator('#itemsList button[data-del]');
    const count = await delButtons.count();
    if (count === 0) throw new Error('No delete buttons found');
    await delButtons.nth(count - 1).click();
  }
}

test.describe('Knapsack Problem — Interactive Demo (FSM e93485e1-d360-11f0-a097-ffdd56c22ef4)', () => {
  // capture console errors and page errors to assert no unexpected runtime errors
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // listen to console messages and page errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // navigate to app
    const app = new KnapsackPage(page);
    await app.goto();
  });

  test.afterEach(async ({ page }) => {
    // After each test assert there were no uncaught page errors or console errors.
    // This ensures we observed runtime issues (if any).
    // If there were errors, include them in assertion message for debugging.
    if (pageErrors.length > 0) {
      console.error('Page errors observed during test:', pageErrors);
    }
    if (consoleErrors.length > 0) {
      console.error('Console errors observed during test:', consoleErrors);
    }
    expect(pageErrors.length, 'No page errors should occur').toBe(0);
    expect(consoleErrors.length, 'No console.error logs should be emitted').toBe(0);
  });

  test('Initial Idle state: default items, capacity and helper text are rendered', async ({ page }) => {
    // Validate S0_Idle initial render as described by FSM: renderItems() executed
    const app = new KnapsackPage(page);

    // There should be 3 default items A, B, C
    const cnt = await app.getItemsCount();
    expect(cnt).toBeGreaterThanOrEqual(3);

    // Capacity input default is 7
    await expect(app.capacityInput).toHaveValue('7');

    // Output area should contain the initial hint text
    const out = await app.getOutputText();
    expect(out).toContain('Try the controls: add items, set capacity, then run an algorithm.');
  });

  test('AddItem transition: adding valid item updates list, resets inputs and triggers renderItems (S1_ItemAdded)', async ({ page }) => {
    // Validate that clicking Add item results in a new item in the list and UI reset
    const app = new KnapsackPage(page);
    const before = await app.getItemsCount();

    // Fill inputs and add a new item
    await app.addItem({ name: 'D-test', weight: '5', value: '10' });

    // Items count increased by one
    const after = await app.getItemsCount();
    expect(after).toBe(before + 1);

    // Inputs reset: name cleared, weight -> 1, value -> 0
    await expect(app.itemName).toHaveValue('');
    await expect(app.itemWeight).toHaveValue('1');
    await expect(app.itemValue).toHaveValue('0');

    // New item visible with provided name and values
    const lastItem = page.locator('#itemsList .item').nth(after - 1);
    const lastText = (await lastItem.innerText()).trim();
    expect(lastText).toContain('D-test');
    expect(lastText).toContain('weight:');
    expect(lastText).toContain('value:');
  });

  test('Item deletion via Del button reduces item count (part of Item Added interactions)', async ({ page }) => {
    // Add an item then delete it via its Del button to validate edit/delete handlers and renderItems
    const app = new KnapsackPage(page);
    const initial = await app.getItemsCount();

    // Add a new item to ensure there's an item we can remove
    await app.addItem({ name: 'ToDelete', weight: '2', value: '1' });
    const afterAdd = await app.getItemsCount();
    expect(afterAdd).toBe(initial + 1);

    // Delete the last item by clicking its Del button and ensure the count decrements
    await app.deleteLastItem();
    const afterDel = await app.getItemsCount();
    expect(afterDel).toBe(afterAdd - 1);
  });

  test('GenerateRandomItems transition: clicking generate populates items and sets capacity', async ({ page }) => {
    // Validate random generation of items (S0 -> random)
    const app = new KnapsackPage(page);

    // Click random generator
    await app.clickRandom();

    // After generation, items count should be between 4 and 9 (based on implementation)
    const cnt = await app.getItemsCount();
    expect(cnt).toBeGreaterThanOrEqual(4);
    expect(cnt).toBeLessThanOrEqual(9);

    // Capacity should be updated to a positive integer
    const capValue = await app.capacityInput.inputValue();
    const cap = parseInt(capValue, 10);
    expect(Number.isInteger(cap)).toBeTruthy();
    expect(cap).toBeGreaterThanOrEqual(1);
  });

  test('ClearItems transition: confirm clears items and outputs "Cleared." (S2_ItemsCleared)', async ({ page }) => {
    // Validate that clearing items prompts confirm and on acceptance clears list and output area
    const app = new KnapsackPage(page);

    // Ensure there are items first
    const before = await app.getItemsCount();
    expect(before).toBeGreaterThanOrEqual(1);

    // Click clear and accept the confirm dialog (the helper does that)
    await app.clickClear(true);

    // After clearing, items list should be empty
    const after = await app.getItemsCount();
    expect(after).toBe(0);

    // Output area should indicate cleared
    const out = await app.getOutputText();
    expect(out).toContain('Cleared.');
    // dp and frac containers should be empty
    expect(await app.getDpTableExists()).toBe(false);
    expect(await app.getFracTableExists()).toBe(false);
  });

  test('RunDPAlgorithm transition: running DP shows results, DP table and highlights (S3_DPResultDisplayed)', async ({ page }) => {
    // Validate DP run produces result and DP table with selection info
    const app = new KnapsackPage(page);

    // Ensure there are items (default from initial state)
    const itemsBefore = await app.getItemsCount();
    expect(itemsBefore).toBeGreaterThan(0);

    // Ensure capacity is valid
    await expect(app.capacityInput).toHaveValue(/\d+/);

    // Click run DP
    await app.clickRunDP();

    // Wait for the DP table and output to be rendered
    await expect(app.dpTableContainer.locator('table')).toBeVisible({ timeout: 5000 });

    // Output should show optimal total value and chosen items
    const out = await app.getOutputText();
    expect(out).toContain('Optimal total value:');
    expect(out).toContain('Items selected (');

    // DP table should exist and have at least one row (row 0)
    const tableExists = await app.getDpTableExists();
    expect(tableExists).toBe(true);

    // There may or may not be .selected cells depending on chosen items, but we expect table population
    const selectedCount = await app.getDpSelectedCount();
    // selectedCount may be zero in degenerate cases; assert that table has numeric cells
    const numericCells = await app.dpTableContainer.locator('td').filter({ hasText: /^\d+$/ }).count();
    expect(numericCells).toBeGreaterThan(0);
  });

  test('RunFractionalAlgorithm transition: fractional greedy displays selection table and result (S4_FractionalResultDisplayed)', async ({ page }) => {
    // Validate fractional knapsack run displays fractional selection and computed value
    const app = new KnapsackPage(page);

    // Ensure items exist
    const itemsBefore = await app.getItemsCount();
    expect(itemsBefore).toBeGreaterThan(0);

    // Click fractional algorithm button
    await app.clickRunFrac();

    // Wait for fractional table and output to be visible
    await expect(app.fracTableContainer.locator('table')).toBeVisible({ timeout: 5000 });

    const out = await app.getOutputText();
    expect(out).toContain('Maximum value achievable (fractional):');

    // There should be at least one row in the fractional result table
    const rows = await app.getFracRowsCount();
    expect(rows).toBeGreaterThan(0);
  });

  test('AnimateDPTable transition: animation runs and finishes, setting dp table and output (S5_DPAnimating)', async ({ page }) => {
    // Validate DP table animation runs and finishes, leaving dp table cells filled
    const app = new KnapsackPage(page);

    // Ensure items exist
    const itemsBefore = await app.getItemsCount();
    expect(itemsBefore).toBeGreaterThan(0);

    // Click animate DP table — the function animates with small delays; wait for completion message
    await app.clickAnimateDP();

    // The animation updates the outputArea when finished. Wait for that text.
    await expect(app.outputArea).toContainText('Animation finished', { timeout: 10000 });

    // After animation, dp table should contain numeric cells (dp values)
    const numericCells = await app.dpTableContainer.locator('td').filter({ hasText: /^\d+$/ }).count();
    expect(numericCells).toBeGreaterThan(0);

    // Also the output area instructs user to run DP next
    const out = await app.getOutputText();
    expect(out).toContain('You can now click "Run DP" to see which items are selected.');
  });

  test('Edge cases: invalid input handling and error dialogs are shown as expected', async ({ page }) => {
    // This test covers validation edge cases for AddItem and Run DP
    const app = new KnapsackPage(page);

    // 1) Invalid add: weight = 0 -> should alert "Weight must be a positive integer."
    const dialogPromise1 = page.waitForEvent('dialog');
    await app.itemName.fill('BadWeight');
    await app.itemWeight.fill('0');
    await app.itemValue.fill('5');
    await app.addItemBtn.click();
    const dialog1 = await dialogPromise1;
    expect(dialog1.message()).toContain('Weight must be a positive integer.');
    await dialog1.accept();

    // 2) Invalid add: empty value -> should alert "Value must be a number."
    const dialogPromise2 = page.waitForEvent('dialog');
    await app.itemName.fill('BadValue');
    await app.itemWeight.fill('2');
    // set itemValue to empty string to simulate missing number
    await app.itemValue.fill('');
    await app.addItemBtn.click();
    const dialog2 = await dialogPromise2;
    expect(dialog2.message()).toContain('Value must be a number.');
    await dialog2.accept();

    // 3) Invalid Run DP: set capacity to -1 and click run -> alert about non-negative integer
    const dialogPromise3 = page.waitForEvent('dialog');
    await app.capacityInput.fill('-1');
    await app.runDpBtn.click();
    const dialog3 = await dialogPromise3;
    expect(dialog3.message()).toContain('Capacity must be a non-negative integer.');
    await dialog3.accept();

    // Reset capacity to a valid value for subsequent tests
    await app.capacityInput.fill('7');
  });
});