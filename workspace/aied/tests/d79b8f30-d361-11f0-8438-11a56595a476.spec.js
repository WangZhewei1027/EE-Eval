import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79b8f30-d361-11f0-8438-11a56595a476.html';

// Page Object for interacting with the Deque demo page
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
    this.peekFrontBtn = page.locator('#peekFrontBtn');
    this.peekBackBtn = page.locator('#peekBackBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.dequeEl = page.locator('#deque');
    this.items = page.locator('#deque .item');
    this.logEl = page.locator('#log');
  }

  async navigate() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for initial render
    await this.page.waitForSelector('#deque');
  }

  async getDequeText() {
    return (await this.dequeEl.textContent()) || '';
  }

  async getItemsText() {
    return await this.items.allTextContents();
  }

  async getLogText() {
    return (await this.logEl.textContent()) || '';
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

  async peekFront() {
    await this.peekFrontBtn.click();
  }

  async peekBack() {
    await this.peekBackBtn.click();
  }

  async clear() {
    await this.clearBtn.click();
  }

  async isButtonDisabled(locator) {
    return await locator.isDisabled();
  }
}

test.describe('Deque (Double-Ended Queue) Demo - FSM Validation', () => {
  // Arrays to collect console messages and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test ensure there were no unexpected runtime errors
    // The application is expected to run without ReferenceError/SyntaxError/TypeError.
    expect(pageErrors, 'No uncaught page errors should occur').toHaveLength(0);
    // Also assert there are no console.error messages
    const consoleErrors = consoleMessages.filter((c) => c.type === 'error');
    expect(consoleErrors, 'No console.error messages expected').toHaveLength(0);
  });

  test.describe('State: S0_Empty (Initial Empty Deque)', () => {
    test('Initial render shows empty deque and disables appropriate controls', async ({ page }) => {
      const app = new DequePage(page);
      // Navigate to app
      await app.navigate();

      // Validate deque shows "(empty)"
      const dequeText = await app.getDequeText();
      expect(dequeText.trim()).toBe('(empty)');

      // Validate that remove/peek/clear buttons are disabled in empty state
      expect(await app.isButtonDisabled(app.removeFrontBtn)).toBe(true);
      expect(await app.isButtonDisabled(app.removeBackBtn)).toBe(true);
      expect(await app.isButtonDisabled(app.peekFrontBtn)).toBe(true);
      expect(await app.isButtonDisabled(app.peekBackBtn)).toBe(true);
      expect(await app.isButtonDisabled(app.clearBtn)).toBe(true);

      // Add buttons should be enabled (user can attempt to add)
      expect(await app.isButtonDisabled(app.addFrontBtn)).toBe(false);
      expect(await app.isButtonDisabled(app.addBackBtn)).toBe(false);

      // Log should be initially empty
      const logText = await app.getLogText();
      expect(logText.trim()).toBe('');
    });
  });

  test.describe('Transitions: Add, Remove, Peek, Clear', () => {
    test('AddFront from S0_Empty -> S1_NonEmpty: item appears, input cleared, log updated', async ({ page }) => {
      const app = new DequePage(page);
      await app.navigate();

      // Add to front
      await app.setInput('A');
      await app.addFront(); // triggers using current input

      // After adding, deque should show one item "A"
      const items = await app.getItemsText();
      expect(items).toEqual(['A']);

      // Input should be cleared after add
      const inputValue = await page.locator('#inputValue').inputValue();
      expect(inputValue).toBe('');

      // Log should contain the add entry
      const log = await app.getLogText();
      expect(log).toContain('Added "A" to front');

      // Buttons that were disabled should now be enabled
      expect(await app.isButtonDisabled(app.removeFrontBtn)).toBe(false);
      expect(await app.isButtonDisabled(app.removeBackBtn)).toBe(false);
      expect(await app.isButtonDisabled(app.peekFrontBtn)).toBe(false);
      expect(await app.isButtonDisabled(app.peekBackBtn)).toBe(false);
      expect(await app.isButtonDisabled(app.clearBtn)).toBe(false);
    });

    test('AddBack from S0_Empty -> S1_NonEmpty: item appears at back and log updated', async ({ page }) => {
      const app = new DequePage(page);
      await app.navigate();

      // Add to back
      await app.setInput('B');
      await app.addBack();

      const items = await app.getItemsText();
      expect(items).toEqual(['B']);

      const log = await app.getLogText();
      expect(log).toContain('Added "B" to back');

      // Clean up by clearing to leave other tests independent
      await app.clear();
      expect((await app.getDequeText()).trim()).toBe('(empty)');
    });

    test('RemoveFront from S1_NonEmpty -> S0_Empty: removing last item empties the deque and logs removal', async ({ page }) => {
      const app = new DequePage(page);
      await app.navigate();

      // Add an item then remove front
      await app.setInput('C');
      await app.addFront();
      // Ensure item present
      expect(await app.getItemsText()).toEqual(['C']);

      await app.removeFront();

      // Deque should be empty again
      expect((await app.getDequeText()).trim()).toBe('(empty)');

      // Log should mention removal
      const log = await app.getLogText();
      expect(log).toContain('Removed "C" from front');
    });

    test('RemoveBack from S1_NonEmpty -> S0_Empty: removing last item empties the deque and logs removal', async ({ page }) => {
      const app = new DequePage(page);
      await app.navigate();

      // Add an item to back then remove back
      await app.setInput('D');
      await app.addBack();
      expect(await app.getItemsText()).toEqual(['D']);

      await app.removeBack();

      expect((await app.getDequeText()).trim()).toBe('(empty)');

      const log = await app.getLogText();
      expect(log).toContain('Removed "D" from back');
    });

    test('PeekFront & PeekBack on non-empty deque show alerts and log peek operations', async ({ page }) => {
      const app = new DequePage(page);
      await app.navigate();

      // Add two elements so front/back are distinct
      await app.setInput('first');
      await app.addBack();
      await app.setInput('last');
      await app.addBack();

      const items = await app.getItemsText();
      expect(items).toEqual(['first', 'last']);

      // Peek front: expect dialog with front element and corresponding log entry
      const [dialogFront] = await Promise.all([
        page.waitForEvent('dialog'),
        app.peekFront()
      ]);
      expect(dialogFront.message()).toBe('Front element: "first"');
      await dialogFront.accept();

      const logAfterPeekFront = await app.getLogText();
      expect(logAfterPeekFront).toContain('Peek front: "first"');

      // Peek back: expect dialog with back element and corresponding log entry
      const [dialogBack] = await Promise.all([
        page.waitForEvent('dialog'),
        app.peekBack()
      ]);
      expect(dialogBack.message()).toBe('Back element: "last"');
      await dialogBack.accept();

      const logAfterPeekBack = await app.getLogText();
      expect(logAfterPeekBack).toContain('Peek back: "last"');

      // Clean up: clear
      await app.clear();
      expect((await app.getDequeText()).trim()).toBe('(empty)');
    });

    test('ClearDeque from S1_NonEmpty -> S0_Empty clears all items and logs the action', async ({ page }) => {
      const app = new DequePage(page);
      await app.navigate();

      // Add multiple items
      await app.setInput('X');
      await app.addBack();
      await app.setInput('Y');
      await app.addBack();
      expect(await app.getItemsText()).toEqual(['X', 'Y']);

      // Clear deque
      await app.clear();

      expect((await app.getDequeText()).trim()).toBe('(empty)');
      const log = await app.getLogText();
      expect(log).toContain('Cleared deque');

      // Buttons should be disabled again
      expect(await app.isButtonDisabled(app.removeFrontBtn)).toBe(true);
      expect(await app.isButtonDisabled(app.removeBackBtn)).toBe(true);
      expect(await app.isButtonDisabled(app.peekFrontBtn)).toBe(true);
      expect(await app.isButtonDisabled(app.peekBackBtn)).toBe(true);
      expect(await app.isButtonDisabled(app.clearBtn)).toBe(true);
    });
  });

  test.describe('Edge cases & Error scenarios', () => {
    test('Attempting to add with empty input shows alert and focuses input', async ({ page }) => {
      const app = new DequePage(page);
      await app.navigate();

      // Ensure input is empty
      await app.setInput('');
      // Capture dialog
      const dialogPromise = page.waitForEvent('dialog');
      await app.addFrontBtn.click();
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Please enter a value to add.');
      await dialog.accept();

      // After dismissing alert input should be focused
      // Playwright has no direct isFocused for locator, but we can evaluate document.activeElement.id
      const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
      expect(activeId).toBe('inputValue');
    });

    test('Removing from empty deque shows alert and logs inability to remove', async ({ page }) => {
      const app = new DequePage(page);
      await app.navigate();

      // Ensure deque is empty and attempt remove front
      expect((await app.getDequeText()).trim()).toBe('(empty)');

      const dialogPromise = page.waitForEvent('dialog');
      await app.removeFront();
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Deque is empty.');
      await dialog.accept();

      // Log should include inability message
      const log = await app.getLogText();
      expect(log).toContain('Cannot remove front: Deque is empty');

      // Attempt remove back similarly
      const dialogPromise2 = page.waitForEvent('dialog');
      await app.removeBack();
      const dialog2 = await dialogPromise2;
      expect(dialog2.message()).toBe('Deque is empty.');
      await dialog2.accept();

      const log2 = await app.getLogText();
      expect(log2).toContain('Cannot remove back: Deque is empty');
    });

    test('Peeking on empty deque shows alert and logs emptiness', async ({ page }) => {
      const app = new DequePage(page);
      await app.navigate();

      // Ensure empty
      expect((await app.getDequeText()).trim()).toBe('(empty)');

      const dialogPromise = page.waitForEvent('dialog');
      await app.peekFront();
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Deque is empty.');
      await dialog.accept();

      const log = await app.getLogText();
      expect(log).toContain('Peek front: Deque is empty');

      const dialogPromise2 = page.waitForEvent('dialog');
      await app.peekBack();
      const dialog2 = await dialogPromise2;
      expect(dialog2.message()).toBe('Deque is empty.');
      await dialog2.accept();

      const log2 = await app.getLogText();
      expect(log2).toContain('Peek back: Deque is empty');
    });
  });
});