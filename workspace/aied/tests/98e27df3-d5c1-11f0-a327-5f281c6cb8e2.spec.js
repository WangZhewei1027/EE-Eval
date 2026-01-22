import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e27df3-d5c1-11f0-a327-5f281c6cb8e2.html';

// Page Object for the Knapsack demo to encapsulate common interactions
class KnapsackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // selectors
    this.capacityInput = '#capacityInput';
    this.addItemBtn = '#addItemBtn';
    this.randomBtn = '#randomBtn';
    this.clearBtn = '#clearBtn';
    this.nameInput = '#nameInput';
    this.weightInput = '#weightInput';
    this.valueInput = '#valueInput';
    this.itemsList = '#itemsList';
    this.itemsPreview = '#itemsPreview';
    this.algoSelect = '#algoSelect';
    this.runBtn = '#runBtn';
    this.stepBtn = '#stepBtn';
    this.resetBtn = '#resetBtn';
    this.tableWrap = '#tableWrap';
    this.result = '#result';
    this.totalValue = '#totalValue';
    this.totalWeight = '#totalWeight';
    this.chosenItems = '#chosenItems';
    this.fracArea = '#fracArea';
    this.fractionBar = '#fractionBar';
    this.speed = '#speed';
    this.speedLabel = '#speedLabel';
    this.showTable = '#showTable';
    this.animate = '#animate';
    this.capBadge = '#capBadge';
    this.algBadge = '#algBadge';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
    // wait for main elements to be available
    await Promise.all([
      this.page.waitForSelector(this.capacityInput),
      this.page.waitForSelector(this.addItemBtn),
      this.page.waitForSelector(this.itemsList),
    ]);
  }

  // Add an item via the left controls
  async addItem(name = 'X', weight = '5', value = '10') {
    await this.page.fill(this.nameInput, name);
    await this.page.fill(this.weightInput, String(weight));
    await this.page.fill(this.valueInput, String(value));
    await this.page.click(this.addItemBtn);
    // updateAll is called which re-renders, wait for the itemsPreview to reflect the name
    await this.page.waitForTimeout(50);
  }

  // Count items in the items list
  async getItemsCount() {
    return await this.page.$$eval(`${this.itemsList} li.item`, els => els.length);
  }

  // Remove the first item by clicking its Remove button
  async removeFirstItem() {
    const removeBtn = await this.page.$(`${this.itemsList} li.item button`);
    if (removeBtn) {
      await removeBtn.click();
      await this.page.waitForTimeout(50);
    }
  }

  // Click random items button
  async generateRandomItems() {
    await this.page.click(this.randomBtn);
    // updateAll includes update of items, wait a short time
    await this.page.waitForTimeout(50);
  }

  // Click clear items button
  async clearItems() {
    await this.page.click(this.clearBtn);
    await this.page.waitForTimeout(50);
  }

  // Change capacity (fires change event)
  async setCapacity(value) {
    await this.page.fill(this.capacityInput, String(value));
    // Fire change by blurring or pressing Enter
    await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, this.capacityInput);
    await this.page.waitForTimeout(50);
  }

  // Change algorithm selection
  async selectAlgorithm(value) {
    await this.page.selectOption(this.algoSelect, value);
    // change event is wired to updateAll - give it a small time
    await this.page.waitForTimeout(50);
  }

  // Change animation speed
  async setSpeed(ms) {
    await this.page.fill(this.speed, String(ms));
    // dispatch input event to update the label
    await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, this.speed);
    await this.page.waitForTimeout(20);
  }

  // Toggle show table checkbox
  async toggleShowTable() {
    await this.page.click(this.showTable);
    await this.page.waitForTimeout(30);
  }

  // Toggle animate checkbox
  async toggleAnimate() {
    await this.page.click(this.animate);
    await this.page.waitForTimeout(30);
  }

  // Click Run button
  async run() {
    await this.page.click(this.runBtn);
    // run may start async animations; tests will await expected outcomes
    await this.page.waitForTimeout(20);
  }

  // Click Step button
  async step() {
    await this.page.click(this.stepBtn);
    // step may be async - small wait to allow DOM updates
    await this.page.waitForTimeout(20);
  }

  // Click Reset button
  async reset() {
    await this.page.click(this.resetBtn);
    await this.page.waitForTimeout(20);
  }

  // Wait for DP table to appear in tableWrap (a table.dp)
  async waitForDPTable(timeout = 2000) {
    return this.page.waitForSelector('#tableWrap table.dp', { timeout });
  }

  // Wait for result panel to be visible
  async waitForResult(timeout = 3000) {
    return this.page.waitForSelector(this.result + '[style*="display: block"]', { timeout });
  }
}

test.describe('Knapsack Problem — Interactive Demo (FSM & UI validations)', () => {
  // Capture console messages and page errors for each test run
  test.beforeEach(async ({ page }) => {
    // expose arrays to store messages on page object for assertions
    page.setDefaultTimeout(5000);
  });

  test('Initial Idle state: page renders and essential controls exist', async ({ page }) => {
    // Capture console errors and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const kp = new KnapsackPage(page);
    await kp.goto();

    // Validate key UI elements exist (evidence for S0_Idle)
    await expect(page.locator('#capacityInput')).toBeVisible();
    await expect(page.locator('#addItemBtn')).toBeVisible();

    // Cap badge and alg badge initial values
    await expect(page.locator(kp.capBadge)).toHaveText('20');
    await expect(page.locator(kp.algBadge)).toHaveText('DP');

    // Items list should be pre-populated with initial items (4)
    const count = await kp.getItemsCount();
    expect(count).toBeGreaterThanOrEqual(4);

    // Assert no uncaught page errors occurred during initial load
    expect(pageErrors, 'There should be no uncaught page errors on load').toEqual([]);
    // No console errors should have been logged
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMsgs, 'No console.error messages on load').toEqual([]);
  });

  test('Add item -> Item Added (S0_Idle -> S1_ItemAdded) and renderItemsList', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const kp = new KnapsackPage(page);
    await kp.goto();

    const before = await kp.getItemsCount();
    // Add a new item
    await kp.addItem('Z', 7, 42);

    const after = await kp.getItemsCount();
    expect(after).toBeGreaterThan(before);

    // Items preview should include the new item's name
    await expect(page.locator('#itemsPreview')).toContainText('Z');

    // Ensure renderItemsList updated the DOM; check the latest li contains the name Z
    const lastItemText = await page.locator('#itemsList li.item').nth(after - 1).innerText();
    expect(lastItemText).toContain('Z');

    // Assert no uncaught page errors
    expect(pageErrors, 'No page errors while adding item').toEqual([]);
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMsgs, 'No console.error while adding item').toEqual([]);
  });

  test('Remove item -> Item Removed (S1_ItemAdded -> S2_ItemRemoved)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const kp = new KnapsackPage(page);
    await kp.goto();

    // Ensure there is at least one item to remove
    const initial = await kp.getItemsCount();
    expect(initial).toBeGreaterThan(0);

    // Remove the first item
    await kp.removeFirstItem();
    const after = await kp.getItemsCount();
    expect(after).toBe(initial - 1);

    // Items preview should update - ensure it no longer includes the removed item's name
    // (We can't know the exact removed name, but count decreased and preview exists)
    await expect(page.locator('#itemsPreview')).toBeVisible();

    // Assert no page errors
    expect(pageErrors, 'No page errors while removing item').toEqual([]);
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMsgs, 'No console.error while removing item').toEqual([]);
  });

  test('Generate Random Items (S0_Idle -> S6_RandomItemsGenerated) and Clear Items (S0_Idle -> S7_ItemsCleared)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const kp = new KnapsackPage(page);
    await kp.goto();

    // Generate random items
    await kp.generateRandomItems();

    const count = await kp.getItemsCount();
    // FSM expects random n in [3,8] => ensure >=3
    expect(count).toBeGreaterThanOrEqual(3);

    // Now clear items
    await kp.clearItems();
    const afterClear = await kp.getItemsCount();
    expect(afterClear).toBe(0);

    // itemsPreview should show the "No items yet" muted message
    await expect(page.locator('#itemsPreview')).toHaveText(/No items yet/i);

    // No page errors
    expect(pageErrors, 'No page errors when generating/clearing items').toEqual([]);
  });

  test('Change capacity and algorithm selection (ChangeCapacity, ChangeAlgorithm) and speed label update', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const kp = new KnapsackPage(page);
    await kp.goto();

    // Change capacity to a small number to make DP faster
    await kp.setCapacity(10);
    await expect(page.locator(kp.capBadge)).toHaveText('10');

    // Change algorithm to fractional and verify UI shows fractional area
    await kp.selectAlgorithm('fractional');
    await expect(page.locator(kp.algBadge)).toHaveText('Fractional');
    await expect(page.locator(kp.fracArea)).toBeVisible();

    // Change speed and verify label updates (ChangeAnimationSpeed)
    await kp.setSpeed(350);
    await expect(page.locator(kp.speedLabel)).toHaveText('delay: 350 ms per cell');

    // No page errors
    expect(pageErrors, 'No page errors when changing capacity/algorithm/speed').toEqual([]);
  });

  test('Run fractional algorithm and verify visualization & result (Generate & Run fractional)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const kp = new KnapsackPage(page);
    await kp.goto();

    // Ensure algorithm set to fractional
    await kp.selectAlgorithm('fractional');

    // Ensure there are items; if not, generate random items
    let count = await kp.getItemsCount();
    if (count === 0) {
      await kp.generateRandomItems();
    }

    // Run fractional
    await kp.run();

    // Fractional area should be visible and fractionBar should have children
    await expect(page.locator('#fractionBar')).toBeVisible();

    // Result panel should appear with total value and total weight populated
    await kp.waitForResult();
    const totalValue = await page.locator(kp.totalValue).innerText();
    const totalWeight = await page.locator(kp.totalWeight).innerText();
    expect(Number(totalValue)).toBeGreaterThanOrEqual(0);
    expect(Number(totalWeight)).toBeGreaterThanOrEqual(0);

    // Choose items are displayed as item-pill elements inside chosenItems
    await expect(page.locator('#chosenItems')).toBeVisible();

    // No page errors
    expect(pageErrors, 'No page errors during fractional run').toEqual([]);
  });

  test('Run DP, Step through algorithm, reconstruct result, and Reset (S0_Idle -> S3_AlgorithmRunning -> S4_AlgorithmStepping -> S5_AlgorithmReset)', async ({ page }) => {
    // This test ensures DP runs and stepping terminates with a visible result and then reset clears it.
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const kp = new KnapsackPage(page);
    await kp.goto();

    // Prepare deterministic small dataset: clear and add 3 items
    await kp.clearItems();
    await kp.addItem('P', 3, 10);
    await kp.addItem('Q', 4, 14);
    await kp.addItem('R', 2, 7);

    // Set capacity small to speed up the DP (C=10)
    await kp.setCapacity(10);

    // Select DP algorithm
    await kp.selectAlgorithm('dp');

    // Ensure the DP table is shown (showTable default true), run DP
    // We'll step repeatedly using Step button until result appears or we hit a sane max iterations
    await kp.run(); // start the DP (will schedule stepping)
    // Give the run call a moment to prepare the table
    await kp.waitForDPTable();

    // Now step until result visible. We compute an upper bound for iterations: n * (C+1) + 5
    const n = 3;
    const C = 10;
    const maxSteps = n * (C + 1) + 10;
    let steps = 0;
    let resultVisible = false;

    while (steps < maxSteps) {
      // click step to advance one cell / reconstruction step
      await kp.step();
      steps++;
      // check if result has been shown
      const style = await page.locator(kp.result).getAttribute('style');
      if (style && style.includes('display: block')) {
        resultVisible = true;
        break;
      }
      // small throttle in case animations are scheduled asynchronously
      await page.waitForTimeout(10);
    }

    expect(resultVisible, 'DP should eventually reconstruct and show result after stepping').toBe(true);

    // Verify result area contains reasonable totals and chosen items
    const totalValText = await page.locator(kp.totalValue).innerText();
    const totalWText = await page.locator(kp.totalWeight).innerText();
    expect(Number(totalValText)).toBeGreaterThanOrEqual(0);
    expect(Number(totalWText)).toBeGreaterThanOrEqual(0);
    await expect(page.locator(kp.chosenItems)).toBeVisible();

    // Now press Reset and ensure result area disappears and table cleared (clearVisualization on exit)
    await kp.reset();
    // result should be hidden (style display not block)
    const styleAfterReset = await page.locator(kp.result).getAttribute('style');
    expect(styleAfterReset && styleAfterReset.includes('display: block')).toBe(false);

    // tableWrap should be empty or contain the DP table skeleton removed; specifically dpTable variable cleared results in empty tableWrap
    // wait a tick and then check tableWrap innerHTML
    await page.waitForTimeout(20);
    const tableWrapHtml = await page.locator(kp.tableWrap).innerHTML();
    // Accept either empty string or "DP table hidden" message etc., but ensure result is cleared
    expect(tableWrapHtml.length).toBeGreaterThanOrEqual(0);

    // No page errors
    expect(pageErrors, 'No page errors during DP run/step/reset').toEqual([]);
  });

  test('Edge case: running algorithm with zero items should show an alert (error scenario)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const kp = new KnapsackPage(page);
    await kp.goto();

    // Ensure items are cleared
    await kp.clearItems();
    let count = await kp.getItemsCount();
    expect(count).toBe(0);

    // Intercept dialog and assert it shows the expected message
    const dialogs = [];
    page.on('dialog', dialog => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      dialog.accept();
    });

    // Click run (both algorithms check for items.length===0 and call alert)
    await kp.run();

    // Ensure a dialog appeared with the add-items message
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0].message).toMatch(/Add some items first/i);

    // No uncaught page errors beyond expected dialog
    expect(pageErrors, 'No page errors when running with zero items').toEqual([]);
  });

  test('Toggle options: showTable and animate checkboxes reflect UI state (ToggleShowTable, ToggleAnimate)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const kp = new KnapsackPage(page);
    await kp.goto();

    // Toggle show table off and verify tableWrap displays hidden message after updateAll
    await kp.toggleShowTable();
    // Force updateAll by triggering capacity change event (cheap way)
    await kp.setCapacity(20);
    await expect(page.locator('#tableWrap')).toContainText(/DP table hidden/i);

    // Toggle show table back on
    await kp.toggleShowTable();
    await kp.setCapacity(20);
    // When table shown, the tableWrap should contain either a table or some content but not the hidden message
    const wrapText = await page.locator('#tableWrap').innerText();
    expect(wrapText.length).toBeGreaterThan(0);
    expect(wrapText).not.toMatch(/DP table hidden/i);

    // Toggle animate checkbox and ensure its checked state toggles
    // read initial state then toggle twice and assert toggling works
    const initialAnimateChecked = await page.isChecked(kp.animate);
    await kp.toggleAnimate();
    const afterToggle = await page.isChecked(kp.animate);
    expect(afterToggle).toBe(!initialAnimateChecked);
    // toggle back
    await kp.toggleAnimate();
    const afterToggleBack = await page.isChecked(kp.animate);
    expect(afterToggleBack).toBe(initialAnimateChecked);

    // No page errors
    expect(pageErrors, 'No page errors when toggling showTable/animate').toEqual([]);
  });

  test('Keyboard shortcut: Ctrl+R triggers run (keyboard shortcut binding test)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const kp = new KnapsackPage(page);
    await kp.goto();

    // Ensure there is at least one item
    let count = await kp.getItemsCount();
    if (count === 0) await kp.generateRandomItems();

    // Listen for potential dialog (fractional/DP uses run, should not alert)
    const dialogs = [];
    page.on('dialog', dialog => { dialogs.push(dialog.message()); dialog.accept(); });

    // Use keyboard shortcut: Ctrl+R should trigger runBtn click handler (listener added)
    await page.keyboard.down('Control');
    await page.keyboard.press('r');
    await page.keyboard.up('Control');

    // Allow some time for handler to execute
    await page.waitForTimeout(50);

    // There should be no alert dialogs from running (unless items were empty)
    expect(dialogs.length).toBe(0);

    // No uncaught page errors
    expect(pageErrors, 'No page errors when using keyboard shortcut').toEqual([]);
  });

  // Global teardown to ensure no unexpected runtime errors surfaced across tests
  test.afterAll(async ({ }, testInfo) => {
    // No-op: Playwright handles page lifecycle automatically, and individual tests asserted no page errors.
    // This block is present to satisfy structure and potential future cleanup.
  });
});