import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b015c0-fa74-11f0-bb9a-db7e6ecdeeaa.html';

/**
 * Page object for the Deque demo application.
 * Encapsulates common interactions and queries used across tests.
 */
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputValue');
    this.addFrontBtn = page.locator('#addFrontBtn');
    this.addBackBtn = page.locator('#addBackBtn');
    this.removeFrontBtn = page.locator('#removeFrontBtn');
    this.removeBackBtn = page.locator('#removeBackBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.dequeDiv = page.locator('#deque');
    this.logDiv = page.locator('#log');
    this.itemLocator = page.locator('#deque .item');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initial render
    await expect(this.dequeDiv).toBeVisible();
    await expect(this.logDiv).toBeVisible();
  }

  async setInput(value) {
    await this.input.fill(value);
  }

  async addFront(value) {
    if (value !== undefined) await this.setInput(value);
    await this.addFrontBtn.click();
  }

  async addBack(value) {
    if (value !== undefined) await this.setInput(value);
    await this.addBackBtn.click();
  }

  async removeFront() {
    await this.removeFrontBtn.click();
  }

  async removeBack() {
    await this.removeBackBtn.click();
  }

  async clearDeque() {
    await this.clearBtn.click();
  }

  // Returns array of item texts in order from left (front) to right (back).
  async getDequeItems() {
    // If empty message present, return [] to represent empty deque
    const hasItems = await this.itemLocator.count();
    if (hasItems === 0) {
      // There might be an <em> "Deque is empty" element; return [] to indicate emptiness
      const inner = (await this.dequeDiv.innerText()).trim();
      if (inner.includes('Deque is empty')) return [];
      // otherwise return empty array
      return [];
    }
    const count = await this.itemLocator.count();
    const items = [];
    for (let i = 0; i < count; i++) {
      items.push((await this.itemLocator.nth(i).innerText()).trim());
    }
    return items;
  }

  async getLogText() {
    return (await this.logDiv.innerText()).trim();
  }
}

test.describe('Deque Demo - FSM states and transitions', () => {
  // Capture console messages and page errors for each test run
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen for console messages (for observation) and page errors
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app
    const dp = new DequePage(page);
    await dp.goto();
  });

  test('Initial state (S0_Idle): deque renders empty and no errors', async ({ page }) => {
    // This test validates the Idle state's entry action renderDeque() and initial UI
    const dp1 = new DequePage(page);

    // Deque should indicate it is empty (the app renders an <em> with text 'Deque is empty')
    const items1 = await dp.getDequeItems();
    expect(items).toEqual([]); // empty representation

    // Log should be empty initially
    const log = await dp.getLogText();
    expect(log).toBe('');

    // No runtime page errors occurred during initial load
    // If errors are present they will be surfaced by the test runner
    // We assert that no page errors occurred for a clean baseline.
    expect(pageErrors.length).toBe(0);
  });

  test('AddFront transition (S0_Idle -> S1_ValueAdded): adds value to front and logs it', async ({ page }) => {
    // Validate AddFront event and the resulting state and DOM/log changes
    const dp2 = new DequePage(page);
    const value = 'Alpha';

    await dp.setInput(value);
    await dp.addFrontBtn.click();

    // After adding to front, deque should contain the value as the first item
    const items2 = await dp.getDequeItems();
    expect(items).toEqual([value]);

    // The operations log should contain the corresponding message
    const log1 = await dp.getLogText();
    expect(log).toContain(`Added '${value}' to front`);

    // Input should be cleared and focused again by the app (value becomes empty)
    expect(await dp.input.inputValue()).toBe('');

    // No unexpected page errors
    expect(pageErrors.length).toBe(0);
  });

  test('AddBack transition (S0_Idle -> S1_ValueAdded): adds value to back and logs it', async ({ page }) => {
    // Validate AddBack event
    const dp3 = new DequePage(page);
    const value1 = 'Beta';

    await dp.setInput(value);
    await dp.addBackBtn.click();

    const items3 = await dp.getDequeItems();
    expect(items).toEqual([value]);

    const log2 = await dp.getLogText();
    expect(log).toContain(`Added '${value}' to back`);

    expect(await dp.input.inputValue()).toBe('');
    expect(pageErrors.length).toBe(0);
  });

  test('RemoveFront transition (S1_ValueAdded -> S2_ValueRemoved): removes front item and logs it', async ({ page }) => {
    // Add two values then remove from front; check that the first inserted (front-most) is removed.
    const dp4 = new DequePage(page);

    await dp.addBack('one');
    await dp.addBack('two');

    // Validate initial order
    expect(await dp.getDequeItems()).toEqual(['one', 'two']);

    // Remove from front should remove 'one'
    await dp.removeFrontBtn.click();

    // After removal, deque should have only 'two'
    expect(await dp.getDequeItems()).toEqual(['two']);

    const log3 = await dp.getLogText();
    expect(log).toContain(`Removed 'one' from front`);

    expect(pageErrors.length).toBe(0);
  });

  test('RemoveBack transition (S1_ValueAdded -> S2_ValueRemoved): removes back item and logs it', async ({ page }) => {
    // Add two values then remove from back; check that the last inserted (back-most) is removed.
    const dp5 = new DequePage(page);

    await dp.addFront('first'); // deque: first
    await dp.addBack('last');  // deque: first, last

    expect(await dp.getDequeItems()).toEqual(['first', 'last']);

    // Remove from back should remove 'last'
    await dp.removeBackBtn.click();

    expect(await dp.getDequeItems()).toEqual(['first']);
    const log4 = await dp.getLogText();
    expect(log).toContain(`Removed 'last' from back`);

    expect(pageErrors.length).toBe(0);
  });

  test('ClearDeque transition (S1_ValueAdded -> S3_DequeCleared): clears deque and logs it', async ({ page }) => {
    // Add some items then clear and validate that deque is empty and log contains "Deque cleared"
    const dp6 = new DequePage(page);

    await dp.addBack('x');
    await dp.addBack('y');
    expect(await dp.getDequeItems()).toEqual(['x', 'y']);

    await dp.clearBtn.click();

    // Deque should render empty state
    expect(await dp.getDequeItems()).toEqual([]);

    const log5 = await dp.getLogText();
    expect(log).toContain('Deque cleared');

    expect(pageErrors.length).toBe(0);
  });

  test('S2_ValueRemoved -> S1_ValueAdded transitions: after removal, adding again works (both front/back)', async ({ page }) => {
    // Add, remove, then add again to verify transitions back to ValueAdded
    const dp7 = new DequePage(page);

    // Start with adding and removing to reach S2
    await dp.addBack('a');
    await dp.removeFrontBtn.click();
    expect(await dp.getDequeItems()).toEqual([]); // now empty (S2)

    // Add to back from S2
    await dp.addBack('b');
    expect(await dp.getDequeItems()).toEqual(['b']);
    expect((await dp.getLogText())).toContain(`Added 'b' to back`);

    // Remove again, then add to front
    await dp.removeBackBtn.click();
    expect(await dp.getDequeItems()).toEqual([]);
    await dp.addFront('c');
    expect(await dp.getDequeItems()).toEqual(['c']);
    expect((await dp.getLogText())).toContain(`Added 'c' to front`);

    expect(pageErrors.length).toBe(0);
  });

  test('S3_DequeCleared -> S0_Idle via AddFront/AddBack: after clearing, adding items works', async ({ page }) => {
    // Ensure that after clearing (S3), adding returns to Idle/Add states as expected
    const dp8 = new DequePage(page);

    // Populate and clear
    await dp.addBack('m');
    await dp.addBack('n');
    await dp.clearBtn.click();
    expect(await dp.getDequeItems()).toEqual([]);
    expect((await dp.getLogText())).toContain('Deque cleared');

    // Now addFront should work from cleared state
    await dp.addFront('z');
    expect(await dp.getDequeItems()).toEqual(['z']);
    expect((await dp.getLogText())).toContain(`Added 'z' to front`);

    // Clear again
    await dp.clearBtn.click();
    expect(await dp.getDequeItems()).toEqual([]);
    // AddBack should work from cleared state
    await dp.addBack('y');
    expect(await dp.getDequeItems()).toEqual(['y']);
    expect((await dp.getLogText())).toContain(`Added 'y' to back`);

    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: adding empty value shows alert and does not change deque or log (AddFront)', async ({ page }) => {
    // Validate the application properly handles empty input for AddFront with an alert.
    const dp9 = new DequePage(page);

    // Ensure input is empty
    await dp.setInput('');

    // Listen for the dialog and assert its message
    const dialogPromise = page.waitForEvent('dialog');
    await dp.addFrontBtn.click();
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('Please enter a value to add to the front.');
    await dialog.accept();

    // Ensure nothing was added
    expect(await dp.getDequeItems()).toEqual([]);
    expect(await dp.getLogText()).toBe('');
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: adding empty value shows alert and does not change deque or log (AddBack)', async ({ page }) => {
    // Validate empty input handling for AddBack
    const dp10 = new DequePage(page);

    await dp.setInput('');
    const dialogPromise1 = page.waitForEvent('dialog');
    await dp.addBackBtn.click();
    const dialog1 = await dialogPromise;
    expect(dialog.message()).toBe('Please enter a value to add to the back.');
    await dialog.accept();

    expect(await dp.getDequeItems()).toEqual([]);
    expect(await dp.getLogText()).toBe('');
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: removing from empty deque shows alert (RemoveFront and RemoveBack)', async ({ page }) => {
    // Validate alerts when trying to remove from an empty deque
    const dp11 = new DequePage(page);

    // Remove front when empty
    const dialogFrontPromise = page.waitForEvent('dialog');
    await dp.removeFrontBtn.click();
    const dialogFront = await dialogFrontPromise;
    expect(dialogFront.message()).toBe('Deque is empty, cannot remove from front.');
    await dialogFront.accept();

    // Remove back when empty
    const dialogBackPromise = page.waitForEvent('dialog');
    await dp.removeBackBtn.click();
    const dialogBack = await dialogBackPromise;
    expect(dialogBack.message()).toBe('Deque is empty, cannot remove from back.');
    await dialogBack.accept();

    // Still empty and no logs
    expect(await dp.getDequeItems()).toEqual([]);
    expect(await dp.getLogText()).toBe('');
    expect(pageErrors.length).toBe(0);
  });

  test('Verify operations log accumulates entries in chronological order and renderDeque() updates DOM on each action', async ({ page }) => {
    // This test validates that renderDeque() is effectively called (entry action evidence)
    // by checking DOM updates after several actions and that the log aggregates messages.
    const dp12 = new DequePage(page);

    await dp.addFront('1'); // log: Added '1' to front
    await dp.addBack('2');  // log: Added '2' to back
    await dp.removeFront(); // log: Removed '1' from front
    await dp.addBack('3');  // log: Added '3' to back
    await dp.clearDeque();  // log: Deque cleared

    // After clear, deque is empty
    expect(await dp.getDequeItems()).toEqual([]);

    // The log should contain all the messages in the order they were produced
    const logText = await dp.getLogText();
    // We won't assert exact timestamps, but assert the sequence of messages exists in order
    const expectedSequence = [
      "Added '1' to front",
      "Added '2' to back",
      "Removed '1' from front",
      "Added '3' to back",
      "Deque cleared"
    ];
    let lastIndex = -1;
    for (const msg of expectedSequence) {
      const idx = logText.indexOf(msg);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }

    expect(pageErrors.length).toBe(0);
  });
});