import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3aa120-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the Dynamic Array application
class DynamicArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Selectors used by the tests
    this.arrayDisplay = page.locator('#array-display');
    this.lengthDisplay = page.locator('#length-display');
    this.capacityDisplay = page.locator('#capacity-display');
    this.customValueInput = page.locator('#custom-value');
    this.positionIndexInput = page.locator('#position-index');
    this.opLog = page.locator('#operation-log');
    this.btnAddRandom = page.locator("button[onclick='addRandomElement()']");
    this.btnRemoveLast = page.locator("button[onclick='removeLastElement()']");
    this.btnClear = page.locator("button[onclick='clearArray()']");
    this.btnAddCustom = page.locator("button[onclick='addCustomElement()']");
    this.btnInsertAt = page.locator("button[onclick='insertAtPosition()']");
    this.btnRemoveAtIndex = page.locator("button[onclick='removeAtIndex()']");
  }

  // Convenience getters
  async getArrayText() {
    return (await this.arrayDisplay.textContent()).trim();
  }

  async getLength() {
    const text = (await this.lengthDisplay.textContent()).trim();
    return parseInt(text, 10);
  }

  async getCapacity() {
    const text = (await this.capacityDisplay.textContent()).trim();
    return parseInt(text, 10);
  }

  // Read operation log entries as array of strings (most recent first)
  async getLogEntries() {
    // Each entry is a child div
    const entries = this.opLog.locator('div');
    const count = await entries.count();
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push((await entries.nth(i).textContent()).trim());
    }
    return results;
  }

  // Actions
  async clickAddRandom() {
    await this.btnAddRandom.click();
  }

  async clickRemoveLast() {
    await this.btnRemoveLast.click();
  }

  async clickClear() {
    await this.btnClear.click();
  }

  async addCustomValue(value) {
    await this.customValueInput.fill(value);
    await this.btnAddCustom.click();
  }

  async insertAtPosition(value, index) {
    await this.customValueInput.fill(value);
    await this.positionIndexInput.fill(String(index));
    await this.btnInsertAt.click();
  }

  async removeAtIndex(index) {
    await this.positionIndexInput.fill(String(index));
    await this.btnRemoveAtIndex.click();
  }

  // Utility to wait until array length equals expected (with timeout)
  async waitForLength(expected, options = {}) {
    await this.page.waitForFunction(
      (sel, exp) => {
        const el = document.querySelector(sel);
        return el && parseInt(el.textContent, 10) === exp;
      },
      '#length-display',
      expected,
      options
    );
  }
}

test.describe('Dynamic Array Demonstration - FSM interactions and UI', () => {
  // Collect console errors and page errors to assert no unexpected exceptions
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console messages to capture error-level console logs
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app (load the page exactly as-is)
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Nothing to tear down beyond the automatic Playwright teardown
  });

  test('Initial state: Idle (S0_Idle) shows empty array, length 0, capacity 0 and no runtime errors', async ({ page }) => {
    // Validate initial UI and FSM onEnter action (updateDisplay was called in script initialization)
    const app = new DynamicArrayPage(page);

    // The display should show an empty array representation
    expect(await app.getArrayText()).toBe('[]');

    // Length and capacity should both be 0
    expect(await app.getLength()).toBe(0);
    expect(await app.getCapacity()).toBe(0);

    // Operation log should be empty initially
    const logs = await app.getLogEntries();
    expect(logs.length).toBe(0);

    // Assert there were no console.error messages or page errors during load
    // (We observe console logs and page errors and assert none occurred)
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Add and capacity behavior', () => {
    test('Add random element increases length to 1 and capacity becomes at least 4; log contains "Added random element"', async ({ page }) => {
      const app = new DynamicArrayPage(page);

      // Click add random element
      await app.clickAddRandom();

      // New length should be 1
      await app.waitForLength(1, { timeout: 2000 });
      expect(await app.getLength()).toBe(1);

      // Capacity should be at least 4 (initial ensureCapacity sets to 4)
      const cap = await app.getCapacity();
      expect(cap).toBeGreaterThanOrEqual(4);

      // Array display should contain one element - check it's not empty and matches pattern for either number or string
      const arrText = await app.getArrayText(); // e.g. "[42]"
      expect(arrText).toMatch(/^\[\s*(?:[^\s\]]+)\s*\]$/);

      // Operation log should contain an entry about adding random element
      const logs = await app.getLogEntries();
      // The top log entry should include "Added random element:"
      expect(logs[0]).toContain('Added random element:');

      // Ensure no console errors or page errors occurred during this interaction
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Capacity grows to 8 after adding 5 elements and shrinks when enough elements removed', async ({ page }) => {
      const app = new DynamicArrayPage(page);

      // Ensure starting from empty state
      await app.clickClear();
      await app.waitForLength(0);

      // Add 5 random elements (to force capacity growth from 4 to 8)
      for (let i = 0; i < 5; i++) {
        await app.clickAddRandom();
      }

      // Length should be 5
      await app.waitForLength(5);
      expect(await app.getLength()).toBe(5);

      // Check capacity is at least 8 (growth from 4 -> 8 happened)
      const capAfter5 = await app.getCapacity();
      expect(capAfter5).toBeGreaterThanOrEqual(8);

      // Now remove elements until we cause shrink behavior: when length <= capacity/4 and capacity > 4
      // From 5 elements and capacity 8, capacity/4 = 2 => remove 3 elements to reach length 2
      for (let i = 0; i < 3; i++) {
        await app.clickRemoveLast();
      }

      // Wait for length 2
      await app.waitForLength(2);
      expect(await app.getLength()).toBe(2);

      // Capacity should have shrunk from 8 to 4 and log contain 'Reducing capacity'
      const capAfterShrink = await app.getCapacity();
      expect(capAfterShrink).toBeLessThanOrEqual(capAfter5);
      expect(capAfterShrink).toBeGreaterThanOrEqual(4);

      // Find a log entry that indicates reduction of capacity (if capacity > 4 earlier)
      const logs = await app.getLogEntries();
      const shrinkEntry = logs.find((l) => l.includes('Reducing capacity') || l.includes('Reducing capacity from'));
      // It is expected that a "Reducing capacity" log exists when shrink condition met
      expect(shrinkEntry).toBeTruthy();

      // Ensure no console errors or page errors occurred during these interactions
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Custom value, insertion, removal and clear transitions', () => {
    test('Add custom element and then clear: display updates, log contains added and cleared actions', async ({ page }) => {
      const app = new DynamicArrayPage(page);

      // Add a custom value "alpha"
      await app.customValueInput.fill('alpha');
      await app.btnAddCustom.click();

      // Length should be 1 and array display should contain "alpha"
      await app.waitForLength(1);
      expect(await app.getArrayText()).toContain('alpha');

      // Operation log should contain the add custom element message
      const logsAfterAdd = await app.getLogEntries();
      expect(logsAfterAdd[0]).toContain('Added custom element: "alpha"');

      // Now clear the array
      await app.clickClear();

      // After clearing, array should be empty and capacity 0
      await app.waitForLength(0);
      expect(await app.getArrayText()).toBe('[]');
      expect(await app.getCapacity()).toBe(0);

      // Log should contain cleared message
      const logsAfterClear = await app.getLogEntries();
      expect(logsAfterClear[0]).toContain('Cleared array completely');

      // Ensure no console errors or page errors occurred during these interactions
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Insert at specific position and remove at index maintain correct order and logs', async ({ page }) => {
      const app = new DynamicArrayPage(page);

      // Start fresh
      await app.clickClear();
      await app.waitForLength(0);

      // Add three custom values: "A", "C", "D" to then insert "B" at index 1
      await app.addCustomValue('A');
      await app.addCustomValue('C');
      await app.addCustomValue('D');
      await app.waitForLength(3);

      // Insert "B" at index 1
      await app.insertAtPosition('B', 1);

      // Now expected array order: A, B, C, D
      const display = await app.getArrayText(); // e.g. "[A, B, C, D]"
      // Remove brackets and whitespace, split by comma
      const inner = display.replace(/^\[|\]$/g, '').trim();
      const elements = inner ? inner.split(/\s*,\s*/) : [];
      expect(elements).toEqual(['A', 'B', 'C', 'D']);

      // Operation log top should contain insert message
      const logs = await app.getLogEntries();
      expect(logs[0]).toContain('Inserted "B" at index 1');

      // Now remove element at index 2 (which should be "C")
      await app.removeAtIndex(2);

      // After removal, expected order: A, B, D
      const afterRemoveText = await app.getArrayText();
      const afterInner = afterRemoveText.replace(/^\[|\]$/g, '').trim();
      const afterElements = afterInner ? afterInner.split(/\s*,\s*/) : [];
      expect(afterElements).toEqual(['A', 'B', 'D']);

      // Log should contain removed element at index message
      const logsAfter = await app.getLogEntries();
      const removedEntry = logsAfter.find((l) => l.includes('Removed element at index 2:'));
      expect(removedEntry).toBeTruthy();

      // Ensure no console errors or page errors occurred
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios (alerts)', () => {
    test('Adding custom without value triggers alert "Please enter a value"', async ({ page }) => {
      const app = new DynamicArrayPage(page);

      // Ensure input is empty
      await app.customValueInput.fill('');

      // Listen for dialog and assert its message
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        app.btnAddCustom.click(), // triggers alert if empty
      ]);

      expect(dialog.message()).toBe('Please enter a value');
      await dialog.accept();

      // No changes to array
      expect(await app.getLength()).toBe(0);

      // Ensure no console errors or page errors occurred
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Insert at invalid position triggers "Index out of bounds" alert', async ({ page }) => {
      const app = new DynamicArrayPage(page);

      // Start fresh and add one element
      await app.clickClear();
      await app.waitForLength(0);
      await app.addCustomValue('x');
      await app.waitForLength(1);

      // Attempt to insert with index larger than length (e.g., 5)
      await app.customValueInput.fill('y');
      await app.positionIndexInput.fill('5');

      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        app.btnInsertAt.click(),
      ]);

      expect(dialog.message()).toBe('Index out of bounds');
      await dialog.accept();

      // Ensure array unchanged
      expect(await app.getLength()).toBe(1);
      expect((await app.getArrayText())).toContain('x');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Removing last element when empty triggers alert "Array is already empty"', async ({ page }) => {
      const app = new DynamicArrayPage(page);

      // Ensure array is empty
      await app.clickClear();
      await app.waitForLength(0);

      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        app.btnRemoveLast.click(),
      ]);

      expect(dialog.message()).toBe('Array is already empty');
      await dialog.accept();

      // Still empty
      expect(await app.getLength()).toBe(0);

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Remove at invalid index triggers "Index out of bounds" alert', async ({ page }) => {
      const app = new DynamicArrayPage(page);

      await app.clickClear();
      await app.waitForLength(0);
      // Add one element so index 1 is invalid (only index 0 allowed)
      await app.addCustomValue('only');
      await app.waitForLength(1);

      await app.positionIndexInput.fill('2'); // out of bounds

      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        app.btnRemoveAtIndex.click(),
      ]);

      expect(dialog.message()).toBe('Index out of bounds');
      await dialog.accept();

      // Array still unchanged
      expect(await app.getLength()).toBe(1);
      expect((await app.getArrayText())).toContain('only');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test('Logs include timestamps and expected action content for actions', async ({ page }) => {
    const app = new DynamicArrayPage(page);

    // Clear and perform an action that logs
    await app.clickClear();
    await app.waitForLength(0);

    await app.addCustomValue('logtest');

    // Retrieve top log entry
    const logs = await app.getLogEntries();
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const top = logs[0];

    // Log entry format: "<time>: Added custom element: "logtest""
    // Ensure it contains colon separator (time format) and the action text
    expect(top).toContain(':');
    expect(top).toContain('Added custom element: "logtest"');

    // Ensure no console errors or page errors occurred
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});