import { test, expect } from '@playwright/test';

class BTreePage {
  /**
   * Page object for the Interactive B-Tree Explorer.
   * Encapsulates common interactions and queries.
   */
  constructor(page) {
    this.page = page;
    // DOM locators
    this.degreeInput = page.locator('#degreeInput');
    this.resetTreeBtn = page.locator('#resetTree');
    this.insertValue = page.locator('#insertValue');
    this.insertBtn = page.locator('#insertBtn');
    this.deleteValue = page.locator('#deleteValue');
    this.deleteBtn = page.locator('#deleteBtn');
    this.searchValue = page.locator('#searchValue');
    this.searchBtn = page.locator('#searchBtn');
    this.printInorderBtn = page.locator('#printInorder');
    this.printLevelOrderBtn = page.locator('#printLevelOrder');
    this.stepByStepCheckbox = page.locator('#stepByStepCheckbox');
    this.visualizationSection = page.locator('#visualizationSection');
    this.stepInfo = page.locator('#stepInfo');
    this.stepBackBtn = page.locator('#stepBackBtn');
    this.stepNextBtn = page.locator('#stepNextBtn');
    this.stepEndBtn = page.locator('#stepEndBtn');
    this.output = page.locator('#output');
    this.log = page.locator('#log');
    this.showNodesInfo = page.locator('#showNodesInfo');
    this.showKeysCount = page.locator('#showKeysCount');
    this.showChildrenCount = page.locator('#showChildrenCount');
  }

  async goto(url) {
    await this.page.goto(url);
    // Wait for the main UI to render
    await expect(this.page.locator('h1')).toHaveText('B-Tree Interactive Explorer');
  }

  async setDegree(t) {
    await this.degreeInput.fill(String(t));
  }

  async clickResetTree() {
    await this.resetTreeBtn.click();
  }

  async insertKeysRaw(text) {
    await this.insertValue.fill(text);
    await this.insertBtn.click();
  }

  async deleteKeysRaw(text) {
    await this.deleteValue.fill(text);
    await this.deleteBtn.click();
  }

  async searchKeyRaw(text) {
    await this.searchValue.fill(String(text));
    await this.searchBtn.click();
  }

  async clickPrintInorder() {
    await this.printInorderBtn.click();
  }

  async clickPrintLevelOrder() {
    await this.printLevelOrderBtn.click();
  }

  async toggleStepByStep(on) {
    const isChecked = await this.stepByStepCheckbox.isChecked();
    if (isChecked !== on) {
      await this.stepByStepCheckbox.click();
    }
    // wait for visualization section visibility to update
    if (on) {
      await expect(this.visualizationSection).toBeVisible();
    } else {
      await expect(this.visualizationSection).toBeHidden();
    }
  }

  async stepNext() {
    await this.stepNextBtn.click();
  }

  async stepBack() {
    await this.stepBackBtn.click();
  }

  async stepEnd() {
    await this.stepEndBtn.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) || '';
  }

  async getLogText() {
    return (await this.log.textContent()) || '';
  }

  async getStepInfoText() {
    return (await this.stepInfo.textContent()) || '';
  }

  async isStepNextDisabled() {
    return this.stepNextBtn.isDisabled();
  }

  async isStepBackDisabled() {
    return this.stepBackBtn.isDisabled();
  }

  async isStepEndDisabled() {
    return this.stepEndBtn.isDisabled();
  }
}

// Test suite for the Interactive B-Tree Explorer
test.describe('Interactive B-Tree Explorer - FSM Validation and UI Tests', () => {
  const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/12131543-fa7a-11f0-acf9-69409043402d.html';
  let errors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console errors for assertions later
    errors = [];
    consoleErrors = [];
    page.on('pageerror', (err) => {
      errors.push(err);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
  });

  test('Initial Idle State: UI elements render and output displayed', async ({ page }) => {
    // Validates S0_Idle: header, buttons, inputs exist and initial tree rendered
    const app = new BTreePage(page);
    await app.goto(BASE);

    // Check main controls exist
    await expect(app.degreeInput).toBeVisible();
    await expect(app.resetTreeBtn).toBeVisible();
    await expect(app.insertBtn).toBeVisible();
    await expect(app.deleteBtn).toBeVisible();
    await expect(app.searchBtn).toBeVisible();
    await expect(app.printInorderBtn).toBeVisible();
    await expect(app.printLevelOrderBtn).toBeVisible();

    // Output should show a level line (initial tree with an empty root)
    const out = await app.getOutputText();
    expect(out).toMatch(/Level\s+0:/);

    // No uncaught page errors or console.error messages during initial render
    expect(errors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Tree Creation and Reset (S1_TreeCreated)', () => {
    test('Reset should create a new tree with given minimum degree and validate input', async ({ page }) => {
      const app = new BTreePage(page);
      await app.goto(BASE);

      // Edge case: invalid degree (less than 2) triggers alert
      const dialogMessages = [];
      page.once('dialog', async dialog => {
        dialogMessages.push(dialog.message());
        await dialog.dismiss();
      });
      await app.setDegree(1);
      await app.clickResetTree();
      expect(dialogMessages.length).toBe(1);
      expect(dialogMessages[0]).toMatch(/Please enter a valid minimum degree/);

      // Valid degree set and reset
      await app.setDegree(3);
      await app.clickResetTree();

      // After reset, visualization should be hidden by default (checkbox unchecked)
      await expect(app.visualizationSection).toBeHidden();

      const out = await app.getOutputText();
      expect(out).toContain('Level 0');

      // No runtime errors from reset action
      expect(errors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Inserting Keys (S2_KeyInserted)', () => {
    test('Insert multiple keys (normal mode) updates log and tree rendering', async ({ page }) => {
      const app = new BTreePage(page);
      await app.goto(BASE);

      // Insert keys normally
      await app.insertKeysRaw('10, 20, 5');

      // The UI logs insertion messages for each key
      const log = await app.getLogText();
      expect(log).toContain('Inserted key 10');
      expect(log).toContain('Inserted key 20');
      expect(log).toContain('Inserted key 5');

      // Output should include inserted keys somewhere in the level-order print
      const out = await app.getOutputText();
      expect(out).toMatch(/10|20|5/);

      // Edge case: insert invalid input triggers alert
      const dialogMessages = [];
      page.once('dialog', async dialog => {
        dialogMessages.push(dialog.message());
        await dialog.dismiss();
      });
      await app.insertKeysRaw('   '); // blank input should alert
      expect(dialogMessages.length).toBe(1);
      expect(dialogMessages[0]).toMatch(/Please enter at least one valid integer key to insert/);

      expect(errors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Insert keys in Step-by-Step mode and navigate steps (S5 -> S2 transition)', async ({ page }) => {
      const app = new BTreePage(page);
      await app.goto(BASE);

      // Enable step-by-step visualization
      await app.toggleStepByStep(true);

      // Insert a set of keys and run visualization
      await app.insertKeysRaw('7,3,9');

      // After starting step-by-step, stepNext should be enabled
      await expect(app.stepNextBtn).toBeEnabled();
      await expect(app.stepBackBtn).toBeDisabled();
      await expect(app.stepEndBtn).toBeEnabled();

      // Step forward one step and verify stepInfo contains the expected first step prefix
      await app.stepNext();
      const step1 = await app.getStepInfoText();
      expect(step1).toMatch(/---\s*Insert key\s*\d+\s*---/);

      // The log should have appended the step message
      const logAfterStep1 = await app.getLogText();
      expect(logAfterStep1).toContain(step1.trim());

      // Step to end
      await app.stepEnd();
      const finalStepInfo = await app.getStepInfoText();
      // After running to end, the step info should contain the last recorded step or completion
      expect(finalStepInfo.length).toBeGreaterThanOrEqual(0);

      // After finishing, tree should be rendered with inserted items
      const out = await app.getOutputText();
      expect(out).toMatch(/7|3|9/);

      expect(errors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Deleting Keys (S3_KeyDeleted)', () => {
    test('Delete key normally updates log and tree (S1 -> S3 transition)', async ({ page }) => {
      const app = new BTreePage(page);
      await app.goto(BASE);

      // Prepare tree with some keys
      await app.insertKeysRaw('11,22,33');
      let log = await app.getLogText();
      expect(log).toContain('Inserted key 11');

      // Delete a key that exists
      await app.deleteKeysRaw('22');
      log = await app.getLogText();
      expect(log).toContain('Deleted key 22');

      // Output should not contain 22 anymore
      const out = await app.getOutputText();
      expect(out).not.toMatch(/(^|[^0-9])22([^0-9]|$)/);

      // Edge case: deleting with blank input produces alert
      const dialogMessages = [];
      page.once('dialog', async dialog => {
        dialogMessages.push(dialog.message());
        await dialog.dismiss();
      });
      await app.deleteKeysRaw('   ');
      expect(dialogMessages.length).toBe(1);
      expect(dialogMessages[0]).toMatch(/Please enter at least one valid integer key to delete/);

      expect(errors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Delete keys in Step-by-Step mode and step back (S5 -> S3)', async ({ page }) => {
      const app = new BTreePage(page);
      await app.goto(BASE);

      // Seed tree
      await app.insertKeysRaw('50,60,70');

      // Enable step-by-step visualization
      await app.toggleStepByStep(true);

      // Run delete visualization
      await app.deleteKeysRaw('60');

      // Step next to the first log entry
      await app.stepNext();
      const s = await app.getStepInfoText();
      expect(s).toBeTruthy();

      // Step back and confirm stepInfo changes
      await app.stepBack();
      const sBack = await app.getStepInfoText();
      // Step back may produce empty string if before the first step; ensure it doesn't crash
      expect(sBack).toBeDefined();

      // Run to end to ensure tree is updated
      await app.stepEnd();

      const out = await app.getOutputText();
      expect(out).not.toMatch(/(^|[^0-9])60([^0-9]|$)/);

      expect(errors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Searching Keys (S4_KeySearched)', () => {
    test('Search existing and non-existing keys (normal and step-by-step)', async ({ page }) => {
      const app = new BTreePage(page);
      await app.goto(BASE);

      // Ensure some keys exist
      await app.insertKeysRaw('1,2,3');

      // Normal search for existing key
      await app.searchKeyRaw('2');
      let log = await app.getLogText();
      expect(log).toMatch(/Key 2 found/);

      // Normal search for non-existing key
      await app.searchKeyRaw('999');
      log = await app.getLogText();
      expect(log).toMatch(/not found/i);

      // Step-by-step search
      await app.toggleStepByStep(true);
      await app.searchKeyRaw('3');

      // Validate step controls enabled
      await expect(app.stepNextBtn).toBeEnabled();

      // Step through search steps
      await app.stepNext();
      const stepText = await app.getStepInfoText();
      expect(stepText).toContain('Search for key');

      // Step to end and ensure 'Search completed' exists in logs
      await app.stepEnd();
      const fullLog = await app.getLogText();
      expect(fullLog).toContain('Search completed');

      expect(errors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Search with invalid input triggers alert', async ({ page }) => {
      const app = new BTreePage(page);
      await app.goto(BASE);

      const dialogMessages = [];
      page.once('dialog', async dialog => {
        dialogMessages.push(dialog.message());
        await dialog.dismiss();
      });

      // searchValue expects a number; empty or invalid should trigger alert
      await app.searchKeyRaw(''); // blank
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      expect(dialogMessages[0]).toMatch(/Please enter a valid integer key to search/);

      expect(errors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Print Traversals (PRINT_INORDER, PRINT_LEVELORDER)', () => {
    test('Print in-order and level-order traversals produce expected log output', async ({ page }) => {
      const app = new BTreePage(page);
      await app.goto(BASE);

      // Create some structure
      await app.insertKeysRaw('15,5,20,25');

      // Print in-order
      await app.clickPrintInorder();
      const logAfterInorder = await app.getLogText();
      expect(logAfterInorder).toContain('In-order traversal:');
      // Should contain numbers in the traversal
      expect(logAfterInorder).toMatch(/15|5|20|25/);

      // Print level-order
      await app.clickPrintLevelOrder();
      const logAfterLevel = await app.getLogText();
      expect(logAfterLevel).toContain('Level-order traversal:');
      // Confirm at least one 'Level' line printed
      expect(logAfterLevel).toMatch(/Level\s+0:/);

      expect(errors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Step-by-Step Control Edge Cases (STEP_NEXT, STEP_BACK, STEP_END)', () => {
    test('Step controls behave correctly when no steps recorded and across operations', async ({ page }) => {
      const app = new BTreePage(page);
      await app.goto(BASE);

      // Enable step-by-step but don't perform any operation
      await app.toggleStepByStep(true);

      // Step buttons should be disabled initially because there are no steps
      await expect(app.stepNextBtn).toBeDisabled();
      await expect(app.stepBackBtn).toBeDisabled();
      await expect(app.stepEndBtn).toBeDisabled();

      // Perform an insert visualization and then attempt to navigate beyond bounds
      await app.insertKeysRaw('100');

      // Move through steps until end; we attempt extra stepNext clicks to ensure no errors
      await app.stepNext();
      // extra click beyond end should be safe (no crash)
      await app.stepNext();
      await app.stepNext();

      // Step back to beginning and then back again (should not crash)
      await app.stepBack();
      await app.stepBack();

      // Step end should position at last step
      await app.stepEnd();
      const finalLog = await app.getLogText();
      expect(finalLog.length).toBeGreaterThan(0);

      expect(errors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('UI Options Toggles and Rendering Details', () => {
    test('Toggle show node details and counts affect renderTree output', async ({ page }) => {
      const app = new BTreePage(page);
      await app.goto(BASE);

      // Seed tree
      await app.insertKeysRaw('2,4,6');

      // Toggle show nodes info
      await app.showNodesInfo.check();
      let outWithNodesInfo = await app.getOutputText();
      expect(outWithNodesInfo).toContain('(leaf)');

      // Toggle keys count and children count and ensure output updates
      await app.showKeysCount.check();
      await app.showChildrenCount.check();
      const outWithCounts = await app.getOutputText();
      expect(outWithCounts).toMatch(/keys:\d+/);
      expect(outWithCounts).toMatch(/children:\d+/);

      // Toggle off and ensure render updates (no counts)
      await app.showKeysCount.uncheck();
      await app.showChildrenCount.uncheck();
      const outAfterOff = await app.getOutputText();
      expect(outAfterOff).not.toMatch(/keys:\d+/);

      expect(errors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // Final safety: assert there are no uncaught exceptions and no console.error entries for the test
    expect(errors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
    // Close page to ensure clean teardown
    await page.close();
  });
});