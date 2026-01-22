import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b016d40-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object for the Knapsack visualizer page
class KnapsackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.itemsContainer = page.locator('#items-container');
    this.itemLocator = page.locator('#items-container .item');
    this.capacityInput = page.locator('#capacity');
    this.itemCountInput = page.locator('#item-count');
    this.generateBtn = page.locator('#generate-items');
    this.itemNameInput = page.locator('#item-name');
    this.itemWeightInput = page.locator('#item-weight');
    this.itemValueInput = page.locator('#item-value');
    this.addItemBtn = page.locator('#add-item');
    this.solveDPBtn = page.locator('#solve-dp');
    this.solveGreedyBtn = page.locator('#solve-greedy');
    this.complexityInfo = page.locator('#complexity-info');
    this.solutionInfo = page.locator('#solution-info');
    this.knapsackVisual = page.locator('#knapsack-visual');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getItemsCount() {
    return await this.itemLocator.count();
  }

  async getItemsText() {
    const count = await this.getItemsCount();
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(await this.itemLocator.nth(i).innerText());
    }
    return arr;
  }

  async setItemCount(n) {
    await this.itemCountInput.fill(String(n));
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async addCustomItem(name, weight, value) {
    if (name !== null) await this.itemNameInput.fill(name);
    if (weight !== null) await this.itemWeightInput.fill(String(weight));
    if (value !== null) await this.itemValueInput.fill(String(value));
    await this.addItemBtn.click();
  }

  async removeFirstItem() {
    // find first remove button inside the first item and click it
    const removeBtn = this.itemLocator.locator('button').first();
    await removeBtn.click();
  }

  async removeAllItems() {
    // Keep removing first remove button until no .item elements remain
    while ((await this.getItemsCount()) > 0) {
      await this.removeFirstItem();
      // allow DOM to update
      await this.page.waitForTimeout(100);
    }
  }

  async clickSolveDP() {
    await this.solveDPBtn.click();
  }

  async clickSolveGreedy() {
    await this.solveGreedyBtn.click();
  }

  async getKnapsackSelectedItemsCount() {
    return await this.knapsackVisual.locator('.selected-item').count();
  }
}

test.describe('Knapsack Problem Visualizer - FSM coverage and E2E behaviors', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // At the end of each test ensure there were no unexpected runtime exceptions.
    // If there are page errors they will be included in the assertion message to aid debugging.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.toString()).join('; ')}`).toBe(0);
  });

  test('Initial state S0_Idle: initSampleItems() should populate and render initial items', async ({ page }) => {
    // Validate that on page load the initial sample items are created and rendered (initSampleItems entry action)
    const kp = new KnapsackPage(page);
    await kp.goto();

    // Wait for initial render - initSampleItems creates 5 items
    await expect(kp.itemLocator).toHaveCount(5);

    // Verify items container doesn't show the "No items" placeholder
    await expect(kp.itemsContainer).not.toContainText('No items added yet');

    // Check that console did not emit any severe errors
    const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errors.length, `Console errors/warnings detected: ${JSON.stringify(errors)}`).toBe(0);
  });

  test('GenerateItems event: clicking Generate Random Items produces requested number of items (S0_Idle -> S1_ItemsGenerated)', async ({ page }) => {
    // Validate generating random items transition
    const kp = new KnapsackPage(page);
    await kp.goto();

    // Set number of items to generate to 3 and click generate
    await kp.setItemCount(3);
    await kp.clickGenerate();

    // After generation expect exactly 3 .item elements
    await expect(kp.itemLocator).toHaveCount(3);

    // Ensure each generated item name includes a " 1/2/3" suffix from implementation `${name} ${i+1}`
    const texts = await kp.getItemsText();
    const nameSuffixesPresent = texts.every(t => /\s[1-9][0-9]*\b/.test(t));
    expect(nameSuffixesPresent, `Generated item names did not include numeric suffixes: ${JSON.stringify(texts)}`).toBe(true);
  });

  test('AddItem event: adding custom item updates list and clears inputs (S1_ItemsGenerated -> S2_ItemAdded)', async ({ page }) => {
    // Validate adding a custom item results in re-render and input clearing
    const kp = new KnapsackPage(page);
    await kp.goto();

    // Ensure we start with at least one item (initial sample)
    const before = await kp.getItemsCount();
    expect(before).toBeGreaterThanOrEqual(1);

    // Add a custom item
    const name = 'TestItem';
    const weight = 2;
    const value = 99;
    await kp.addCustomItem(name, weight, value);

    // Expect the item count to increase by 1
    await expect(kp.itemLocator).toHaveCount(before + 1);

    // The newly added item text should appear in the list
    const itemsText = await kp.getItemsText();
    const added = itemsText.some(t => t.includes('TestItem'));
    expect(added, `Custom item '${name}' was not found in items list: ${JSON.stringify(itemsText)}`).toBe(true);

    // Inputs should be cleared after successful add
    await expect(kp.itemNameInput).toHaveValue('');
    await expect(kp.itemWeightInput).toHaveValue('');
    await expect(kp.itemValueInput).toHaveValue('');
  });

  test('Remove item updates the items list (S2_ItemAdded -> S1_ItemsGenerated)', async ({ page }) => {
    // Validate that removing an item re-renders the items list without that item
    const kp = new KnapsackPage(page);
    await kp.goto();

    // Ensure there is at least one item to remove
    const initialCount = await kp.getItemsCount();
    expect(initialCount).toBeGreaterThan(0);

    // Capture text of first item for later verification it is removed
    const firstItemText = await kp.itemLocator.nth(0).innerText();

    // Remove the first item
    await kp.removeFirstItem();

    // Expect the count to have decreased by 1
    await expect(kp.itemLocator).toHaveCount(initialCount - 1);

    // Confirm the previously-first item text does not appear in the list (or index changed)
    const remainingTexts = await kp.getItemsText();
    const stillPresent = remainingTexts.some(t => t.includes(firstItemText.split('\n')[0]));
    expect(stillPresent, 'Removed item is still present in the DOM').toBe(false);
  });

  test('SolveDP event: solving with Dynamic Programming displays solution and highlights DP button (S1_ItemsGenerated -> S3_SolvingDP)', async ({ page }) => {
    // Validate solving with DP displays solution info, knapsack visualization, and marks DP button as active
    const kp = new KnapsackPage(page);
    await kp.goto();

    // Ensure items exist (if none, fail fast)
    const count = await kp.getItemsCount();
    expect(count).toBeGreaterThan(0);

    // Click solve DP and validate results displayed
    await kp.clickSolveDP();

    // The solution-info should mention 'Dynamic Programming' method
    await expect(kp.solutionInfo).toContainText('Dynamic Programming');

    // Complexity info should mention O(n×W) as the implementation sets
    await expect(kp.complexityInfo).toContainText('O(n×W)');

    // The DP button should have the 'active' class
    await expect(kp.solveDPBtn).toHaveClass(/active/);

    // The knapsack visualization should reflect selected items (may be zero if solver picks none)
    // At minimum the solutionInfo contains Maximum Value
    await expect(kp.solutionInfo).toMatchText(/.*Maximum Value:.*/s);
  });

  test('SolveGreedy event: solving with Greedy Approach displays solution and highlights Greedy button (S1_ItemsGenerated -> S4_SolvingGreedy)', async ({ page }) => {
    // Validate solving with Greedy displays solution info and marks greedy button as active
    const kp = new KnapsackPage(page);
    await kp.goto();

    // Ensure items exist
    const count = await kp.getItemsCount();
    expect(count).toBeGreaterThan(0);

    // Click greedy solver
    await kp.clickSolveGreedy();

    // Solution info should mention 'Greedy Approach'
    await expect(kp.solutionInfo).toContainText('Greedy Approach');

    // Complexity info should mention sorting time complexity O(n log n)
    await expect(kp.complexityInfo).toContainText('O(n log n)');

    // The greedy button should have the 'active' class
    await expect(kp.solveGreedyBtn).toHaveClass(/active/);
  });

  test('Edge case: adding invalid custom item shows validation alert', async ({ page }) => {
    // When attempting to add a custom item with invalid or missing fields the page uses alert()
    const kp = new KnapsackPage(page);
    await kp.goto();

    // Ensure name/weight/value are empty
    await kp.itemNameInput.fill('');
    await kp.itemWeightInput.fill('');
    await kp.itemValueInput.fill('');

    // Wait for dialog event and click add
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      kp.addItemBtn.click()
    ]);

    // The alert message should instruct to enter valid details
    expect(dialog.message()).toContain('Please enter valid item details');

    // Dismiss the dialog
    await dialog.accept();
  });

  test('Edge case: solving with no items triggers alert "Please add items first"', async ({ page }) => {
    // Validate that when no items exist and a solve action is invoked an alert is shown
    const kp = new KnapsackPage(page);
    await kp.goto();

    // Remove all items by clicking remove repeatedly
    // Note: remove buttons exist only when items exist. This uses the UI to reach the empty state.
    await kp.removeAllItems();

    // Confirm empty placeholder is shown
    await expect(kp.itemsContainer).toContainText('No items added yet');

    // Try solving with DP and expect an alert dialog
    const dialogPromise = page.waitForEvent('dialog');
    await kp.clickSolveDP();
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('Please add items first');
    await dialog.accept();

    // Also try solving with Greedy to ensure consistent behavior
    const dialogPromise2 = page.waitForEvent('dialog');
    await kp.clickSolveGreedy();
    const dialog2 = await dialogPromise2;
    expect(dialog2.message()).toContain('Please add items first');
    await dialog2.accept();
  });

});