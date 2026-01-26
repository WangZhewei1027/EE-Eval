import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324c9c70-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Deque demo page
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputValue');
    this.dequeContainer = page.locator('#deque');
    this.addFrontButton = page.locator('button[onclick="addFront()"]');
    this.addBackButton = page.locator('button[onclick="addBack()"]');
    this.removeFrontButton = page.locator('button[onclick="removeFront()"]');
    this.removeBackButton = page.locator('button[onclick="removeBack()"]');
    this.itemLocator = this.dequeContainer.locator('.item');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setInput(value) {
    await this.input.fill(String(value));
  }

  async clearInput() {
    await this.input.fill('');
  }

  async clickAddFront() {
    await this.addFrontButton.click();
  }

  async clickAddBack() {
    await this.addBackButton.click();
  }

  async clickRemoveFront() {
    await this.removeFrontButton.click();
  }

  async clickRemoveBack() {
    await this.removeBackButton.click();
  }

  async getItemsText() {
    const count = await this.itemLocator.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.itemLocator.nth(i).innerText());
    }
    return texts;
  }

  async getItemCount() {
    return this.itemLocator.count();
  }
}

test.describe('Deque Demonstration - FSM validation', () => {
  // Collect console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen for console messages
    page.on('console', msg => {
      // Collect console messages for diagnostic/assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen for page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test we assert there were no unexpected uncaught exceptions
    // If there were, surface them as test failure with details.
    if (pageErrors.length > 0) {
      const errorTexts = pageErrors.map(e => e.message || String(e)).join('\n---\n');
      // Fail the test if there were uncaught exceptions in the page
      throw new Error(`Uncaught page errors detected:\n${errorTexts}`);
    }
    // Optionally record console messages in test trace for debugging
    // But do not fail on console messages (they may be informative).
  });

  test.describe('Initial state (S0_Empty) and entry actions', () => {
    test('S0_Empty: page loads and deque is rendered empty (render() called on entry)', async ({ page }) => {
      // This test verifies the initial state of the application (Empty Deque).
      const dp = new DequePage(page);
      await dp.goto();

      // The deque should be empty: no .item elements
      expect(await dp.getItemCount()).toBe(0);

      // input should be present and empty
      expect(await page.locator('#inputValue').inputValue()).toBe('');

      // No uncaught page errors were emitted during load (asserted in afterEach)
      // Also capture that console didn't emit fatal errors (we still allow non-fatal logs)
      // If any console cleared messages exist, they are available in consoleMessages
    });
  });

  test.describe('Add operations and transitions to S1_NonEmpty', () => {
    test('AddToFront: adding with a value moves from S0_Empty to S1_NonEmpty and renders item', async ({ page }) => {
      // Test adding to front from empty deque
      const dp = new DequePage(page);
      await dp.goto();

      // Populate input and click Add to Front
      await dp.setInput(42);
      await dp.clickAddFront();

      // After add, input should be cleared
      expect(await page.locator('#inputValue').inputValue()).toBe('');

      // The deque should have exactly one item with the inserted value
      const items = await dp.getItemsText();
      expect(items).toEqual(['42']);
    });

    test('AddToBack: adding with a value moves from S0_Empty to S1_NonEmpty and renders item', async ({ page }) => {
      // Test adding to back from empty deque
      const dp = new DequePage(page);
      await dp.goto();

      await dp.setInput(99);
      await dp.clickAddBack();

      expect(await page.locator('#inputValue').inputValue()).toBe('');

      const items = await dp.getItemsText();
      expect(items).toEqual(['99']);
    });

    test('AddFront then AddBack: ordering in deque respects front/back semantics', async ({ page }) => {
      // Start fresh, add back then add front and assert order matches expected [frontAddedAtFront, previousBack]
      const dp = new DequePage(page);
      await dp.goto();

      // addBack 2 -> [2]
      await dp.setInput(2);
      await dp.clickAddBack();

      // addFront 1 -> [1, 2]
      await dp.setInput(1);
      await dp.clickAddFront();

      const items = await dp.getItemsText();
      expect(items).toEqual(['1', '2']);
    });
  });

  test.describe('Remove operations and transitions (S1_NonEmpty -> S1_NonEmpty or S0_Empty)', () => {
    test('RemoveFromFront: removes front item and remains non-empty when items remain', async ({ page }) => {
      // Setup deque with two items then remove front and verify remaining
      const dp = new DequePage(page);
      await dp.goto();

      // addBack 10 -> [10]
      await dp.setInput(10);
      await dp.clickAddBack();

      // addBack 20 -> [10,20]
      await dp.setInput(20);
      await dp.clickAddBack();

      // removeFront -> should remove 10 leaving [20]
      await dp.clickRemoveFront();

      const items = await dp.getItemsText();
      expect(items).toEqual(['20']);
    });

    test('RemoveFromBack: removes back item and remains non-empty when items remain', async ({ page }) => {
      // Setup deque with two items then remove back and verify remaining
      const dp = new DequePage(page);
      await dp.goto();

      // addFront 5 -> [5]
      await dp.setInput(5);
      await dp.clickAddFront();

      // addFront 6 -> [6,5]
      await dp.setInput(6);
      await dp.clickAddFront();

      // removeBack -> should remove 5 leaving [6]
      await dp.clickRemoveBack();

      const items = await dp.getItemsText();
      expect(items).toEqual(['6']);
    });

    test('Removing until empty then additional remove triggers "Deque is empty!" alert (RemoveFromFront)', async ({ page }) => {
      // Ensure that when removing from an empty deque the expected alert is shown.
      const dp = new DequePage(page);
      await dp.goto();

      // Start with single item and remove twice to trigger alert on second remove
      await dp.setInput(7);
      await dp.clickAddBack();

      // First removeFront removes the sole element -> deque becomes empty
      await dp.clickRemoveFront();
      expect(await dp.getItemCount()).toBe(0);

      // Second removeFront should fire an alert 'Deque is empty!'
      const dialog = await page.waitForEvent('dialog');
      // Trigger removal which will cause the dialog to appear
      await dp.clickRemoveFront();

      // Validate the dialog message and close it
      expect(dialog.message()).toBe('Deque is empty!');
      await dialog.accept();

      // After alert, deque should still be empty
      expect(await dp.getItemCount()).toBe(0);
    });

    test('Removing until empty then additional remove triggers "Deque is empty!" alert (RemoveFromBack)', async ({ page }) => {
      // Ensure removeBack from empty shows alert
      const dp = new DequePage(page);
      await dp.goto();

      // Add one item and remove it
      await dp.setInput(8);
      await dp.clickAddFront();
      await dp.clickRemoveBack();
      expect(await dp.getItemCount()).toBe(0);

      // Now removing back again triggers alert
      const dialogPromise = page.waitForEvent('dialog');
      // Trigger removal
      await dp.clickRemoveBack();
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Deque is empty!');
      await dialog.accept();

      expect(await dp.getItemCount()).toBe(0);
    });
  });

  test.describe('Edge cases and validation errors', () => {
    test('Clicking Add to Front with empty input shows "Please enter a value" alert', async ({ page }) => {
      // Validate that adding without a value triggers the validation alert
      const dp = new DequePage(page);
      await dp.goto();

      // Ensure input is empty
      await dp.clearInput();
      const dialogPromise = page.waitForEvent('dialog');
      await dp.clickAddFront();
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Please enter a value');
      await dialog.accept();

      // Deque should remain empty
      expect(await dp.getItemCount()).toBe(0);
    });

    test('Clicking Add to Back with empty input shows "Please enter a value" alert', async ({ page }) => {
      // Validate that adding without a value triggers the validation alert for AddBack as well
      const dp = new DequePage(page);
      await dp.goto();

      await dp.clearInput();
      const dialogPromise = page.waitForEvent('dialog');
      await dp.clickAddBack();
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Please enter a value');
      await dialog.accept();

      expect(await dp.getItemCount()).toBe(0);
    });
  });

  test.describe('Observability: console messages and runtime errors', () => {
    test('No unexpected runtime errors (ReferenceError, SyntaxError, TypeError) occur during typical interactions', async ({ page }) => {
      // This test performs a set of typical interactions and asserts there were no uncaught runtime errors.
      const dp = new DequePage(page);
      await dp.goto();

      // Perform several interactions that exercise the code paths
      await dp.setInput(1);
      await dp.clickAddFront();

      await dp.setInput(2);
      await dp.clickAddBack();

      await dp.clickRemoveFront();
      await dp.clickRemoveBack();

      // Try to remove from empty to produce an alert; accept it
      const dialogPromise = page.waitForEvent('dialog');
      await dp.clickRemoveFront();
      const dialog = await dialogPromise;
      // If an alert is shown, it should be the expected empty message
      expect(dialog.message()).toBe('Deque is empty!');
      await dialog.accept();

      // At this point after exercising all operations, assert that no uncaught errors were collected.
      // The afterEach hook will fail the test if there are any page errors.
      // For additional assurance, we check the collected console messages for fatal-seeming messages.
      const errorLike = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
      // It's acceptable to have logs, but there should not be stack traces or uncaught exceptions printed as console.error.
      // Assert no obvious uncaught exception messages were printed to the console.
      expect(errorLike.length).toBe(0);
    });
  });
});