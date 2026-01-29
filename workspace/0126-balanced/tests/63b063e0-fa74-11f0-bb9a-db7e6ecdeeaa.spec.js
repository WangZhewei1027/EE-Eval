import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b063e0-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Multiset demo page
class MultisetPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.elementInput = page.locator('#elementInput');
    this.countInput = page.locator('#countInput');
    this.addBtn = page.locator('#addBtn');
    this.removeBtn = page.locator('#removeBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.elementsList = page.locator('#elements-list');
    this.totalSize = page.locator('#totalSize');
    this.distinctSize = page.locator('#distinctSize');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async add(element, count = '') {
    await this.elementInput.fill(element);
    if (count !== '') {
      await this.countInput.fill(String(count));
    } else {
      // clear count input to allow default behavior
      await this.countInput.fill('');
    }
    await this.addBtn.click();
  }

  async remove(element, count = '') {
    await this.elementInput.fill(element);
    if (count !== '') {
      await this.countInput.fill(String(count));
    } else {
      await this.countInput.fill('');
    }
    await this.removeBtn.click();
  }

  async clear(accept = true) {
    // Clicking clear will produce a confirm dialog - handle externally if needed
    await this.clearBtn.click();
    // dialog handling is expected from tests via page.once('dialog', ...)
  }

  async getDisplayText() {
    return (await this.elementsList.textContent()).trim();
  }

  async getTotalSize() {
    const t = (await this.totalSize.textContent()).trim();
    return t;
  }

  async getDistinctSize() {
    const t1 = (await this.distinctSize.textContent()).trim();
    return t;
  }
}

test.describe('Multiset Demonstration - FSM and UI interactions', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors for assertions later
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Ensure there are no uncaught page errors during the test
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console.error messages emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test initial idle state (S0_Idle) - verify entry action updateDisplay()
  test('Initial Idle state shows empty multiset and zero stats', async ({ page }) => {
    const app = new MultisetPage(page);

    // Validate visual representation is "(empty)" and stats are "0"
    await expect(app.elementsList).toHaveText('(empty)');
    await expect(app.totalSize).toHaveText('0');
    await expect(app.distinctSize).toHaveText('0');
  });

  // Test AddElement event and transition (S0_Idle -> S0_Idle)
  test('Add element with default count updates display and stats', async ({ page }) => {
    const app1 = new MultisetPage(page);

    // Add "apple" with default count (empty count input -> defaults to 1)
    await app.add('apple', '');

    // Verify the list and stats updated
    await expect(app.elementsList).toHaveText('apple: 1');
    await expect(app.totalSize).toHaveText('1');
    await expect(app.distinctSize).toHaveText('1');
  });

  test('Add element with explicit count increments multiplicity correctly', async ({ page }) => {
    const app2 = new MultisetPage(page);

    // Start with an add to ensure we have existing state
    await app.add('apple', '');
    // Add 2 more apples
    await app.add('apple', '2');

    // Expect apple: 3 and totals reflect duplicates
    await expect(app.elementsList).toHaveText('apple: 3');
    await expect(app.totalSize).toHaveText('3');
    await expect(app.distinctSize).toHaveText('1');
  });

  // Test RemoveElement event and transition (S0_Idle -> S0_Idle)
  test('Remove element partially and then fully clears that element', async ({ page }) => {
    const app3 = new MultisetPage(page);

    // Prepare state: add apple count 3
    await app.add('apple', '3');
    await expect(app.elementsList).toHaveText('apple: 3');

    // Remove 1 apple -> should leave 2
    await app.remove('apple', '1');
    await expect(app.elementsList).toHaveText('apple: 2');
    await expect(app.totalSize).toHaveText('2');

    // Remove 2 apples -> should remove apple entirely and show (empty)
    await app.remove('apple', '2');
    await expect(app.elementsList).toHaveText('(empty)');
    await expect(app.totalSize).toHaveText('0');
    await expect(app.distinctSize).toHaveText('0');
  });

  // Test ClearMultiset event (S0_Idle -> S0_Idle) including both dismiss and accept of confirm dialog
  test('Clear multiset: dismissing confirm keeps state, accepting clears', async ({ page }) => {
    const app4 = new MultisetPage(page);

    // Add two different elements
    await app.add('banana', '2');
    await app.add('cherry', '');
    await expect(app.elementsList).toContainText('banana: 2');
    await expect(app.elementsList).toContainText('cherry: 1');
    await expect(app.totalSize).toHaveText('3');
    await expect(app.distinctSize).toHaveText('2');

    // First, click clear and dismiss the confirm dialog -> should preserve state
    const dialogPromise1 = page.waitForEvent('dialog');
    await app.clear();
    const dialog1 = await dialogPromise1;
    expect(dialog1.type()).toBe('confirm');
    expect(dialog1.message()).toBe('Are you sure you want to clear the multiset?');
    // Dismiss (cancel)
    await dialog1.dismiss();

    // Ensure state preserved
    await expect(app.elementsList).toContainText('banana: 2');
    await expect(app.totalSize).toHaveText('3');
    await expect(app.distinctSize).toHaveText('2');

    // Now click clear and accept -> should clear the multiset
    const dialogPromise2 = page.waitForEvent('dialog');
    await app.clear();
    const dialog2 = await dialogPromise2;
    expect(dialog2.type()).toBe('confirm');
    await dialog2.accept();

    // After accept, display should show empty and stats zero
    await expect(app.elementsList).toHaveText('(empty)');
    await expect(app.totalSize).toHaveText('0');
    await expect(app.distinctSize).toHaveText('0');
  });

  // Edge case: clicking Add without entering element -> alert should appear and nothing changes
  test('Adding without element shows alert and does not change multiset', async ({ page }) => {
    const app5 = new MultisetPage(page);

    // Ensure starting empty
    await expect(app.elementsList).toHaveText('(empty)');

    // Click add with empty element input
    const dialogPromise = page.waitForEvent('dialog');
    await app.add('', ''); // element empty
    const dialog = await dialogPromise;
    // Expect an alert with the specified message
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe('Please enter an element to add.');
    await dialog.accept();

    // Ensure still empty
    await expect(app.elementsList).toHaveText('(empty)');
    await expect(app.totalSize).toHaveText('0');
  });

  // Edge case: clicking Remove without entering element -> alert should appear and nothing changes
  test('Removing without element shows alert and does not change multiset', async ({ page }) => {
    const app6 = new MultisetPage(page);

    // Prepare some state
    await app.add('pear', '2');
    await expect(app.elementsList).toHaveText('pear: 2');
    await expect(app.totalSize).toHaveText('2');

    // Click remove with empty element input
    const dialogPromise1 = page.waitForEvent('dialog');
    await app.remove('', '');
    const dialog1 = await dialogPromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe('Please enter an element to remove.');
    await dialog.accept();

    // Ensure state unchanged
    await expect(app.elementsList).toHaveText('pear: 2');
    await expect(app.totalSize).toHaveText('2');
  });

  // Edge cases for count parsing: negative, zero, and non-number should default to 1
  test('Invalid count inputs default to 1 when adding and removing', async ({ page }) => {
    const app7 = new MultisetPage(page);

    // Negative count -> should be treated as default 1
    await app.add('fig', '-5');
    await expect(app.elementsList).toHaveText('fig: 1');
    await expect(app.totalSize).toHaveText('1');

    // Non-numeric count -> default 1
    await app.add('grape', 'abc');
    // Order of items can be fig then grape depending on internals; check both exist
    const display = await app.getDisplayText();
    expect(display.includes('fig: 1')).toBeTruthy();
    expect(display.includes('grape: 1')).toBeTruthy();
    await expect(app.totalSize).toHaveText('2');

    // Removing with invalid count should remove only 1 occurrence
    await app.remove('grape', '0'); // 0 is treated as default 1
    await expect(app.elementsList).not.toContainText('grape: 1'); // grape removed
    // fig should remain
    await expect(app.elementsList).toContainText('fig: 1');
  });

  // Combined interactions to ensure entries() and toString() reflect correct multiset state
  test('Multiple adds and removes produce expected toString ordering and stats', async ({ page }) => {
    const app8 = new MultisetPage(page);

    // Clear any previous state by accepting confirm
    const dlg1 = page.waitForEvent('dialog');
    await app.clear();
    const d1 = await dlg1;
    await d1.accept();

    // Add multiple distinct elements with varying counts
    await app.add('a', '3');
    await app.add('b', '1');
    await app.add('c', '5');

    // toString should contain each element with its count
    const display1 = await app.getDisplayText();
    expect(display.includes('a: 3')).toBeTruthy();
    expect(display.includes('b: 1')).toBeTruthy();
    expect(display.includes('c: 5')).toBeTruthy();

    // Stats: total = 9, distinct = 3
    await expect(app.totalSize).toHaveText('9');
    await expect(app.distinctSize).toHaveText('3');

    // Remove some c's and verify counts update
    await app.remove('c', '2'); // c should become 3
    await expect(app.elementsList).toContainText('c: 3');
    await expect(app.totalSize).toHaveText('7');
  });
});