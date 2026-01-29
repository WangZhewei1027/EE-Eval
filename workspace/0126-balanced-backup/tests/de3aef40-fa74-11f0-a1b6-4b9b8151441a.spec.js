import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3aef40-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the Deque application
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#itemInput');
    this.addFrontBtn = page.locator('button[onclick="addFront()"]');
    this.addRearBtn = page.locator('button[onclick="addRear()"]');
    this.removeFrontBtn = page.locator('button[onclick="removeFront()"]');
    this.removeRearBtn = page.locator('button[onclick="removeRear()"]');
    this.peekFrontBtn = page.locator('button[onclick="peekFront()"]');
    this.peekRearBtn = page.locator('button[onclick="peekRear()"]');
    this.checkSizeBtn = page.locator('button[onclick="checkSize()"]');
    this.checkEmptyBtn = page.locator('button[onclick="checkEmpty()"]');
    this.dequeDisplay = page.locator('#dequeDisplay');
    this.output = page.locator('#output');
    this.emptyMessage = this.dequeDisplay.locator('.empty-message');
    this.items = this.dequeDisplay.locator('.deque-item');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the main elements to be present
    await expect(this.input).toBeVisible();
    await expect(this.dequeDisplay).toBeVisible();
  }

  async setInput(value) {
    await this.input.fill(value);
  }

  async addFront() {
    await this.addFrontBtn.click();
  }

  async addRear() {
    await this.addRearBtn.click();
  }

  async removeFront() {
    await this.removeFrontBtn.click();
  }

  async removeRear() {
    await this.removeRearBtn.click();
  }

  async peekFront() {
    await this.peekFrontBtn.click();
  }

  async peekRear() {
    await this.peekRearBtn.click();
  }

  async checkSize() {
    await this.checkSizeBtn.click();
  }

  async checkEmpty() {
    await this.checkEmptyBtn.click();
  }

  async getOutputText() {
    return (await this.output.textContent())?.trim() ?? '';
  }

  async isEmptyMessageVisible() {
    return await this.emptyMessage.isVisible();
  }

  async getItemsText() {
    const count = await this.items.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.items.nth(i).textContent())?.trim() ?? '');
    }
    return texts;
  }

  async getItemsCount() {
    return await this.items.count();
  }
}

// Group related tests
test.describe('Deque (Double-ended Queue) Demonstration - E2E', () => {
  // Each test will create its own listeners to capture console errors and page errors.
  // This ensures we observe runtime errors naturally and assert on them.

  test('Initial state should be empty (S0_Empty) and UI reflects this', async ({ page }) => {
    // Listen for page errors and console errors
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg);
    });

    const app = new DequePage(page);
    // Load the page as-is
    await app.goto();

    // Validate initial visual state corresponds to S0_Empty
    await expect(app.emptyMessage).toBeVisible();
    await expect(app.emptyMessage).toHaveText('Deque is empty');

    // Output div should be empty initially
    await expect(app.output).toHaveText('');

    // Check "Check Empty" when empty
    await app.checkEmpty();
    await expect(app.output).toHaveText('Deque is empty.');

    // Ensure no runtime page errors or console error messages occurred during load/interactions
    expect(pageErrors.length, `pageerrors: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `console errors: ${consoleErrors.map(m => m.text()).join(' | ')}`).toBe(0);
  });

  test('AddFront and AddRear transition to Non-empty (S1_NonEmpty) and display items in correct order', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg);
    });

    const app = new DequePage(page);
    await app.goto();

    // Ensure starting empty
    await expect(app.emptyMessage).toBeVisible();

    // Add front: default input value is "A" per HTML; ensure it adds to front
    await app.setInput('A');
    await app.addFront();
    await expect(app.output).toHaveText('Added "A" to front.');
    await expect(app.items).toHaveCount(1);
    await expect(app.items.nth(0)).toHaveText('A');

    // Add rear with B
    await app.setInput('B');
    await app.addRear();
    await expect(app.output).toHaveText('Added "B" to rear.');
    await expect(app.items).toHaveCount(2);
    // Order should be A (front), B (rear)
    expect(await app.getItemsText()).toEqual(['A', 'B']);

    // Add front with C -> should appear at index 0
    await app.setInput('C');
    await app.addFront();
    await expect(app.output).toHaveText('Added "C" to front.');
    await expect(app.items).toHaveCount(3);
    // Final expected order: C, A, B
    expect(await app.getItemsText()).toEqual(['C', 'A', 'B']);

    // checkEmpty should report not empty
    await app.checkEmpty();
    await expect(app.output).toHaveText('Deque is not empty.');

    // No runtime errors should have occurred
    expect(pageErrors.length, `pageerrors: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `console errors: ${consoleErrors.map(m => m.text()).join(' | ')}`).toBe(0);
  });

  test('RemoveFront, RemoveRear behaviors and transitions back to empty (S1_NonEmpty -> S0_Empty)', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg);
    });

    const app = new DequePage(page);
    await app.goto();

    // Prepare deque with C, A, B (as in previous test)
    await app.setInput('A');
    await app.addFront(); // A
    await app.setInput('B');
    await app.addRear();  // A, B
    await app.setInput('C');
    await app.addFront(); // C, A, B
    expect(await app.getItemsText()).toEqual(['C', 'A', 'B']);

    // removeFront should remove C
    await app.removeFront();
    await expect(app.output).toHaveText('Removed "C" from front.');
    expect(await app.getItemsText()).toEqual(['A', 'B']);

    // removeRear should remove B
    await app.removeRear();
    await expect(app.output).toHaveText('Removed "B" from rear.');
    expect(await app.getItemsText()).toEqual(['A']);

    // removeFront should remove A and cause transition to empty
    await app.removeFront();
    await expect(app.output).toHaveText('Removed "A" from front.');
    // Now display should show empty-message
    await expect(app.emptyMessage).toBeVisible();
    await expect(app.emptyMessage).toHaveText('Deque is empty');

    // Additional removeFront when empty should produce friendly message
    await app.removeFront();
    await expect(app.output).toHaveText("Deque is empty - can't remove from front.");

    // Additional removeRear when empty should produce friendly message
    await app.removeRear();
    await expect(app.output).toHaveText("Deque is empty - can't remove from rear.");

    // No runtime errors during these transitions
    expect(pageErrors.length, `pageerrors: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `console errors: ${consoleErrors.map(m => m.text()).join(' | ')}`).toBe(0);
  });

  test('PeekFront and PeekRear show correct items and handle empty deque', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg);
    });

    const app = new DequePage(page);
    await app.goto();

    // Peeking when empty should inform the user
    await app.peekFront();
    await expect(app.output).toHaveText('Deque is empty - nothing at front.');

    await app.peekRear();
    await expect(app.output).toHaveText('Deque is empty - nothing at rear.');

    // Populate deque with values for peek tests
    await app.setInput('X');
    await app.addRear(); // X
    await app.setInput('Y');
    await app.addRear(); // X, Y
    await app.setInput('Z');
    await app.addFront(); // Z, X, Y

    // Peek front should show Z
    await app.peekFront();
    await expect(app.output).toHaveText('Front item: "Z".');

    // Peek rear should show Y
    await app.peekRear();
    await expect(app.output).toHaveText('Rear item: "Y".');

    // No runtime errors during peeks
    expect(pageErrors.length, `pageerrors: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `console errors: ${consoleErrors.map(m => m.text()).join(' | ')}`).toBe(0);
  });

  test('CheckSize returns accurate sizes throughout operations', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg);
    });

    const app = new DequePage(page);
    await app.goto();

    // Initially size should be 0
    await app.checkSize();
    await expect(app.output).toHaveText('Deque size: 0 items.');

    // Add 2 items
    await app.setInput('1');
    await app.addRear(); // 1
    await app.setInput('2');
    await app.addRear(); // 1,2
    await app.checkSize();
    await expect(app.output).toHaveText('Deque size: 2 items.');

    // Remove one and check
    await app.removeFront(); // removes 1
    await app.checkSize();
    await expect(app.output).toHaveText('Deque size: 1 items.');

    // Remove last and check transitions to empty
    await app.removeRear();
    await app.checkSize();
    await expect(app.output).toHaveText('Deque size: 0 items.');
    await expect(app.emptyMessage).toBeVisible();

    // No runtime errors during size checks
    expect(pageErrors.length, `pageerrors: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `console errors: ${consoleErrors.map(m => m.text()).join(' | ')}`).toBe(0);
  });

  test('Edge case: adding empty input should be ignored', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg);
    });

    const app = new DequePage(page);
    await app.goto();

    // Ensure empty initially
    await expect(app.emptyMessage).toBeVisible();

    // Attempt to add empty (spaces) to front - should be ignored
    await app.setInput('   ');
    await app.addFront();
    // Nothing should have been added; still empty message visible and output remains unchanged (no "Added" text)
    await expect(app.emptyMessage).toBeVisible();
    // Output should still be empty string (no update written)
    await expect(app.output).toHaveText('');

    // Now set a valid value to ensure add still works afterwards
    await app.setInput('Valid');
    await app.addRear();
    await expect(app.output).toHaveText('Added "Valid" to rear.');
    await expect(app.items).toHaveCount(1);
    await expect(app.items.nth(0)).toHaveText('Valid');

    // No runtime errors during edge case
    expect(pageErrors.length, `pageerrors: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `console errors: ${consoleErrors.map(m => m.text()).join(' | ')}`).toBe(0);
  });
});