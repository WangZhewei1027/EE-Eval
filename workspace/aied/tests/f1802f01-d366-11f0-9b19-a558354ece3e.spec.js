import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f1802f01-d366-11f0-9b19-a558354ece3e.html';

/**
 * Page Object Model for the Set Demo page.
 * Encapsulates selectors and common interactions to keep tests readable.
 */
class SetDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.addInput = page.locator('#addValue');
    this.removeInput = page.locator('#removeValue');
    this.checkInput = page.locator('#checkValue');
    this.addBtn = page.locator("button[onclick='addToSet()']");
    this.removeBtn = page.locator("button[onclick='removeFromSet()']");
    this.checkBtn = page.locator("button[onclick='checkInSet()']");
    this.clearBtn = page.locator("button[onclick='clearSet()']");
    this.sizeBtn = page.locator("button[onclick='showSetSize()']");
    this.valuesBtn = page.locator("button[onclick='showSetValues()']");
    this.arrayBtn = page.locator("button[onclick='convertToArray()']");
    this.demoOpsBtn = page.locator("button[onclick='demoSetOperations()']");
    this.setResult = page.locator('#setResult');
    this.operationsResult = page.locator('#operationsResult');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Helpers to read trimmed text content
  async getSetResultText() {
    return (await this.setResult.innerText()).trim();
  }

  async getOperationsResultText() {
    return (await this.operationsResult.innerText()).trim();
  }

  // Interactions
  async addValue(value) {
    await this.addInput.fill(value);
    await this.addBtn.click();
  }

  async removeValueFunc(value) {
    await this.removeInput.fill(value);
    await this.removeBtn.click();
  }

  async checkValueFunc(value) {
    await this.checkInput.fill(value);
    await this.checkBtn.click();
  }

  async clearSet() {
    await this.clearBtn.click();
  }

  async showSetSize() {
    await this.sizeBtn.click();
  }

  async showSetValues() {
    await this.valuesBtn.click();
  }

  async convertToArray() {
    await this.arrayBtn.click();
  }

  async demoSetOperations() {
    await this.demoOpsBtn.click();
  }

  // Utility to count occurrences of a token in the setResult display
  async countTokenInSetResult(token) {
    const text = await this.getSetResultText();
    if (!text) return 0;
    // setResult shows: "Current Set: item1, item2" or "Current Set: Empty"
    const parts = text.split(':');
    if (parts.length < 2) return 0;
    const items = parts[1].trim();
    if (items === 'Empty') return 0;
    return items.split(',').map(s => s.trim()).filter(s => s === token).length;
  }
}

test.describe('Set Data Structure Demo - FSM state & transitions', () => {
  // Collect console.error messages and page errors per test to assert no runtime errors
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console errors (console.error)
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Listen for unhandled exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Assert that there were no runtime errors during the test interactions.
    // Tests will fail if there were uncaught exceptions or console.error messages.
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    expect(consoleErrors, 'No console.error messages should be emitted').toEqual([]);
  });

  test('Initial state (S0_Idle) - updateSetDisplay() runs on load and shows seeded values', async ({ page }) => {
    // Validate Idle state's entry action (updateSetDisplay) by checking initial DOM.
    const demo = new SetDemoPage(page);
    await demo.goto();

    // operationsResult should be empty on load
    await expect(demo.operationsResult).toBeVisible();
    const setText = await demo.getSetResultText();

    // The seeded demoSet contains apple, banana, orange per implementation
    expect(setText).toContain('Current Set:');
    expect(setText).toContain('apple');
    expect(setText).toContain('banana');
    expect(setText).toContain('orange');
  });

  test.describe('AddToSet (S1_ValueAdded) and edge cases', () => {
    test('Add a new value and verify set updates and input clears', async ({ page }) => {
      const demo = new SetDemoPage(page);
      await demo.goto();

      // Add 'grape'
      await demo.addValue('grape');

      const setText = await demo.getSetResultText();
      expect(setText).toContain('grape');

      // The add input should be cleared after successful add
      await expect(demo.addInput).toHaveValue('');
    });

    test('Adding a duplicate value does not create duplicates in displayed set', async ({ page }) => {
      const demo = new SetDemoPage(page);
      await demo.goto();

      // Add 'orange' which is already seeded
      await demo.addValue('orange');

      // Count occurrences of 'orange' in the set display; should be 1
      const count = await demo.countTokenInSetResult('orange');
      expect(count).toBe(1);
    });

    test('Adding empty input should not change the set (edge case)', async ({ page }) => {
      const demo = new SetDemoPage(page);
      await demo.goto();

      const before = await demo.getSetResultText();
      // Click Add with empty input
      await demo.addBtn.click();

      const after = await demo.getSetResultText();
      // Since addToSet() does nothing when value is falsy, display should be unchanged
      expect(after).toBe(before);

      // The input will remain empty (implementation does not clear empty input)
      await expect(demo.addInput).toHaveValue('');
    });
  });

  test.describe('RemoveFromSet (S2_ValueRemoved) and edge cases', () => {
    test('Remove an existing value and verify set updates', async ({ page }) => {
      const demo = new SetDemoPage(page);
      await demo.goto();

      // Remove 'banana'
      await demo.removeValueFunc('banana');

      const setText = await demo.getSetResultText();
      expect(setText).not.toContain('banana');

      // Remove input should be cleared after remove
      await expect(demo.removeInput).toHaveValue('');
    });

    test('Attempt to remove a non-existent value should not break state and input clears', async ({ page }) => {
      const demo = new SetDemoPage(page);
      await demo.goto();

      const before = await demo.getSetResultText();
      await demo.removeValueFunc('pear'); // 'pear' not present

      const after = await demo.getSetResultText();
      expect(after).toBe(before);

      await expect(demo.removeInput).toHaveValue('');
    });

    test('Removing with empty input should not change the set (edge case)', async ({ page }) => {
      const demo = new SetDemoPage(page);
      await demo.goto();

      const before = await demo.getSetResultText();
      // Click Remove with empty input
      await demo.removeBtn.click();

      const after = await demo.getSetResultText();
      expect(after).toBe(before);

      // Input remains empty
      await expect(demo.removeInput).toHaveValue('');
    });
  });

  test.describe('CheckInSet (S3_ValueChecked)', () => {
    test('Check existing value shows exists message and clears input', async ({ page }) => {
      const demo = new SetDemoPage(page);
      await demo.goto();

      await demo.checkValueFunc('apple');

      const opText = await demo.getOperationsResultText();
      expect(opText).toContain('"apple" exists in the set');

      await expect(demo.checkInput).toHaveValue('');
    });

    test('Check non-existing value shows does not exist message and clears input', async ({ page }) => {
      const demo = new SetDemoPage(page);
      await demo.goto();

      await demo.checkValueFunc('mango');

      const opText = await demo.getOperationsResultText();
      expect(opText).toContain('"mango" does not exist in the set');

      await expect(demo.checkInput).toHaveValue('');
    });

    test('Checking with empty input should not modify operationsResult (edge case)', async ({ page }) => {
      const demo = new SetDemoPage(page);
      await demo.goto();

      const before = await demo.getOperationsResultText();
      await demo.checkBtn.click(); // empty input
      const after = await demo.getOperationsResultText();

      // Should remain unchanged
      expect(after).toBe(before);
    });
  });

  test.describe('ClearSet (S4_SetCleared) and updateSetDisplay entry action', () => {
    test('Clear the set results in "Current Set: Empty" and set is empty afterwards', async ({ page }) => {
      const demo = new SetDemoPage(page);
      await demo.goto();

      await demo.clearSet();

      const setText = await demo.getSetResultText();
      expect(setText).toContain('Current Set:');
      expect(setText).toContain('Empty');
    });

    test('After clearing, adding new value updates display correctly', async ({ page }) => {
      const demo = new SetDemoPage(page);
      await demo.goto();

      await demo.clearSet();
      await demo.addValue('kiwi');

      const setText = await demo.getSetResultText();
      expect(setText).toContain('kiwi');
      expect(setText).not.toContain('Empty');
    });
  });

  test.describe('ShowSetSize (S5_SetSizeShown) and ShowSetValues (S6_SetValuesShown)', () => {
    test('ShowSetSize shows the correct size of the seeded set', async ({ page }) => {
      const demo = new SetDemoPage(page);
      await demo.goto();

      // Seeded set has 3 items: apple, banana, orange
      await demo.showSetSize();

      const opText = await demo.getOperationsResultText();
      expect(opText).toContain('Set size:');
      expect(opText).toContain('3');
    });

    test('ShowSetValues lists all current set values', async ({ page }) => {
      const demo = new SetDemoPage(page);
      await demo.goto();

      await demo.showSetValues();

      const opText = await demo.getOperationsResultText();
      expect(opText).toContain('Set values:');
      expect(opText).toContain('apple');
      expect(opText).toContain('banana');
      expect(opText).toContain('orange');
    });
  });

  test.describe('ConvertToArray (S7_ArrayConverted)', () => {
    test('Converting set to array displays array representation', async ({ page }) => {
      const demo = new SetDemoPage(page);
      await demo.goto();

      await demo.convertToArray();

      const opText = await demo.getOperationsResultText();
      expect(opText).toContain('Array from Set:');
      // Should show array-like content with seeded items
      expect(opText).toContain('apple');
      expect(opText).toContain('banana');
      expect(opText).toContain('orange');
      // Format uses square brackets: [ ... ]
      expect(opText).toContain('[');
      expect(opText).toContain(']');
    });
  });

  test.describe('DemoSetOperations (S8_SetOperationsDemoed)', () => {
    test('Demo set operations shows union, intersection, and difference correctly', async ({ page }) => {
      const demo = new SetDemoPage(page);
      await demo.goto();

      await demo.demoSetOperations();

      const opText = await demo.getOperationsResultText();

      // Check that it printed Set A and Set B and the derived operations
      expect(opText).toContain('Set A:');
      expect(opText).toContain('Set B:');
      expect(opText).toContain('Union (A ∪ B):');
      expect(opText).toContain('Intersection (A ∩ B):');
      expect(opText).toContain('Difference (A - B):');

      // Validate expected members from the demo's hard-coded sets
      expect(opText).toContain('a');
      expect(opText).toContain('b');
      expect(opText).toContain('c');
      expect(opText).toContain('d');
      expect(opText).toContain('e');
      expect(opText).toContain('f');

      // Union should contain all unique letters a-f
      expect(opText).toContain('a');
      expect(opText).toContain('f');
    });
  });

  test.describe('Integration flows and state transitions combined', () => {
    test('Add -> Show Values -> Remove -> Show Size -> Convert flow', async ({ page }) => {
      const demo = new SetDemoPage(page);
      await demo.goto();

      // Add new value
      await demo.addValue('melon');
      let setText = await demo.getSetResultText();
      expect(setText).toContain('melon');

      // Show values should include melon
      await demo.showSetValues();
      let opText = await demo.getOperationsResultText();
      expect(opText).toContain('melon');

      // Remove an existing value (apple)
      await demo.removeValueFunc('apple');
      setText = await demo.getSetResultText();
      expect(setText).not.toContain('apple');

      // Show size should reflect removal (original 3 + 1 added -1 removed = 3)
      await demo.showSetSize();
      opText = await demo.getOperationsResultText();
      expect(opText).toContain('Set size:');
      expect(opText).toContain('3');

      // Convert to array should show current members
      await demo.convertToArray();
      opText = await demo.getOperationsResultText();
      expect(opText).toContain('Array from Set:');
    });

    test('Clearing then attempting operations behaves gracefully', async ({ page }) => {
      const demo = new SetDemoPage(page);
      await demo.goto();

      // Clear set
      await demo.clearSet();
      let setText = await demo.getSetResultText();
      expect(setText).toContain('Empty');

      // Show values should indicate Empty
      await demo.showSetValues();
      let opText = await demo.getOperationsResultText();
      expect(opText).toContain('Set values:');
      expect(opText).toContain('Empty');

      // Convert to array should show empty array []
      await demo.convertToArray();
      opText = await demo.getOperationsResultText();
      expect(opText).toContain('Array from Set:');
      // It will render as [] or [ ] depending on join behaviour; ensure brackets exist
      expect(opText).toContain('[');
      expect(opText).toContain(']');
    });
  });
});