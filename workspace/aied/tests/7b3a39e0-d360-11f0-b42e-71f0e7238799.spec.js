import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3a39e0-d360-11f0-b42e-71f0e7238799.html';

// Page Object for the Deque app
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputValue');
    this.addFrontBtn = page.locator('button[onclick="addFront()"]');
    this.addBackBtn = page.locator('button[onclick="addBack()"]');
    this.removeFrontBtn = page.locator('button[onclick="removeFront()"]');
    this.removeBackBtn = page.locator('button[onclick="removeBack()"]');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async addFront(value) {
    if (value !== undefined) {
      await this.input.fill(value);
    }
    await this.addFrontBtn.click();
  }

  async addBack(value) {
    if (value !== undefined) {
      await this.input.fill(value);
    }
    await this.addBackBtn.click();
  }

  async removeFront() {
    await this.removeFrontBtn.click();
  }

  async removeBack() {
    await this.removeBackBtn.click();
  }

  async getOutputText() {
    return (await this.output.textContent())?.trim();
  }

  async getInputValue() {
    return (await this.input.inputValue()).trim();
  }

  async inputPlaceholder() {
    return await this.input.getAttribute('placeholder');
  }
}

test.describe('Deque FSM - Application ID 7b3a39e0-d360-11f0-b42e-71f0e7238799', () => {
  // We'll capture console messages and page errors for each test to ensure no unexpected runtime errors occur.
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test assert that no uncaught page errors happened.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    // And no console errors were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console error messages: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test.describe('Initial State - S0_Idle', () => {
    test('renders initial UI elements and shows Idle state evidence', async ({ page }) => {
      // Validate initial render and presence of input and output as per S0_Idle evidence.
      const app = new DequePage(page);
      await app.goto();

      // Input exists and has expected placeholder
      await expect(app.input).toBeVisible();
      expect(await app.inputPlaceholder()).toBe('Enter a value');

      // Output initial text should indicate empty deque (Idle -> Deque: [])
      await expect(app.output).toBeVisible();
      expect(await app.getOutputText()).toBe('Deque: []');

      // Buttons are present
      await expect(app.addFrontBtn).toBeVisible();
      await expect(app.addBackBtn).toBeVisible();
      await expect(app.removeFrontBtn).toBeVisible();
      await expect(app.removeBackBtn).toBeVisible();
    });
  });

  test.describe('Transitions and Updated State - S1_Updated', () => {
    test('AddFront transition moves to Updated state and updates output', async ({ page }) => {
      // This test validates the transition from S0_Idle -> S1_Updated via AddFront
      const app = new DequePage(page);
      await app.goto();

      // Add 'A' to the front
      await app.addFront('A');

      // Expect output updated (S1_Updated evidence: outputElement.textContent)
      expect(await app.getOutputText()).toBe('Deque: [A]');

      // Input should have been cleared after adding
      expect(await app.getInputValue()).toBe('');
    });

    test('AddBack transition moves to Updated state and updates output', async ({ page }) => {
      // Validates S0_Idle -> S1_Updated via AddBack
      const app = new DequePage(page);
      await app.goto();

      // Add 'B' to the back
      await app.addBack('B');

      // Expect output updated correctly
      expect(await app.getOutputText()).toBe('Deque: [B]');

      // Input cleared
      expect(await app.getInputValue()).toBe('');
    });

    test('RemoveFront and RemoveBack in Updated state update output correctly', async ({ page }) => {
      // This test validates S1_Updated -> S1_Updated via removes.
      const app = new DequePage(page);
      await app.goto();

      // Build deque with sequence: addBack 1, addBack 2, addFront 0 -> [0, 1, 2]
      await app.addBack('1');
      expect(await app.getOutputText()).toBe('Deque: [1]');
      await app.addBack('2');
      expect(await app.getOutputText()).toBe('Deque: [1, 2]');
      await app.addFront('0');
      expect(await app.getOutputText()).toBe('Deque: [0, 1, 2]');

      // removeFront -> should remove '0' => [1, 2]
      await app.removeFront();
      expect(await app.getOutputText()).toBe('Deque: [1, 2]');

      // removeBack -> should remove '2' => [1]
      await app.removeBack();
      expect(await app.getOutputText()).toBe('Deque: [1]');

      // removeFront -> should remove '1' => []
      await app.removeFront();
      expect(await app.getOutputText()).toBe('Deque: []');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Adding empty value should not change deque or throw errors', async ({ page }) => {
      // Validate that clicking AddFront/AddBack without entering a value does nothing and causes no errors.
      const app = new DequePage(page);
      await app.goto();

      // Ensure initial empty state
      expect(await app.getOutputText()).toBe('Deque: []');

      // Attempt to add with empty input
      await app.addFront(''); // filling empty string then clicking
      expect(await app.getOutputText()).toBe('Deque: []');

      await app.addBack(''); // again empty
      expect(await app.getOutputText()).toBe('Deque: []');

      // Also clicking without filling (input already empty)
      await app.addFront(undefined);
      expect(await app.getOutputText()).toBe('Deque: []');

      await app.addBack(undefined);
      expect(await app.getOutputText()).toBe('Deque: []');

      // No runtime page errors expected (checked in afterEach)
    });

    test('Removing from an empty deque should be a no-op and not throw', async ({ page }) => {
      // Validate S1_Updated self-transitions when deque is empty: removeFront/removeBack do nothing.
      const app = new DequePage(page);
      await app.goto();

      // Ensure empty
      expect(await app.getOutputText()).toBe('Deque: []');

      // Click removeFront and removeBack on empty deque
      await app.removeFront();
      expect(await app.getOutputText()).toBe('Deque: []');

      await app.removeBack();
      expect(await app.getOutputText()).toBe('Deque: []');

      // No runtime page errors expected (checked in afterEach)
    });

    test('Sequence of operations preserves order and DOM updates each step', async ({ page }) => {
      // Validate multiple transitions and that each update reflects correct visual output.
      const app = new DequePage(page);
      await app.goto();

      // Start empty
      expect(await app.getOutputText()).toBe('Deque: []');

      // Add front X -> [X]
      await app.addFront('X');
      expect(await app.getOutputText()).toBe('Deque: [X]');

      // Add back Y -> [X, Y]
      await app.addBack('Y');
      expect(await app.getOutputText()).toBe('Deque: [X, Y]');

      // Add front Z -> [Z, X, Y]
      await app.addFront('Z');
      expect(await app.getOutputText()).toBe('Deque: [Z, X, Y]');

      // Remove back -> removes Y -> [Z, X]
      await app.removeBack();
      expect(await app.getOutputText()).toBe('Deque: [Z, X]');

      // Remove front -> removes Z -> [X]
      await app.removeFront();
      expect(await app.getOutputText()).toBe('Deque: [X]');

      // Final remove -> []
      await app.removeBack();
      expect(await app.getOutputText()).toBe('Deque: []');
    });
  });
});