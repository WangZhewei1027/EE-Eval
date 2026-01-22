import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f18007f0-d366-11f0-9b19-a558354ece3e.html';

// Page Object for the Deque application
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputValue');
    this.addFrontBtn = page.locator('#addFront');
    this.addRearBtn = page.locator('#addRear');
    this.removeFrontBtn = page.locator('#removeFront');
    this.removeRearBtn = page.locator('#removeRear');
    this.clearBtn = page.locator('#clear');
    this.dequeItems = page.locator('#dequeItems');
    this.status = page.locator('#status');
    this.emptyMessage = this.dequeItems.locator('.empty-message');
    this.itemLocator = this.dequeItems.locator('.deque-item');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Add value to front by filling input then clicking button
  async addFront(value) {
    await this.input.fill(value);
    await this.addFrontBtn.click();
  }

  // Add value to rear by filling input then clicking button
  async addRear(value) {
    await this.input.fill(value);
    await this.addRearBtn.click();
  }

  // Click remove front
  async removeFront() {
    await this.removeFrontBtn.click();
  }

  // Click remove rear
  async removeRear() {
    await this.removeRearBtn.click();
  }

  // Click clear
  async clear() {
    await this.clearBtn.click();
  }

  // Number of deque item elements
  async itemCount() {
    return await this.itemLocator.count();
  }

  // Get texts of all deque items in order
  async getItemsText() {
    const count = await this.itemLocator.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.itemLocator.nth(i).textContent());
    }
    return texts;
  }

  // Whether empty message is visible
  async hasEmptyMessage() {
    return (await this.emptyMessage.count()) > 0;
  }

  // status text
  async getStatusText() {
    return (await this.status.textContent()) || '';
  }
}

test.describe('Deque Visualization FSM and UI tests', () => {
  // collectors for console messages and page errors
  let consoleErrors = [];
  let pageErrors = [];

  // Attach listeners and navigate before each test
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console.error messages (and general errors)
    page.on('console', msg => {
      // Capture error-level console messages for later assertions
      if (msg.type() === 'error') {
        consoleErrors.push(String(msg.text()));
      }
    });

    // Collect uncaught page errors (exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  // Basic sanity: no unexpected console errors or page exceptions during initial load
  test('Initial load should not produce console errors or uncaught exceptions', async ({ page }) => {
    const deque = new DequePage(page);

    // Validate initial visualization (S0_Empty)
    await expect(deque.emptyMessage).toHaveText('Deque is empty');
    await expect(deque.status).toHaveText('Status: Deque is empty. Try adding elements!');

    // Assert no console errors or page exceptions happened during load
    expect(consoleErrors.length, `Expected no console.error messages, found: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Expected no uncaught page errors, found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });

  test('S0_Empty -> AddToFront transitions to S1_NonEmpty and updates visualization', async ({ page }) => {
    const deque = new DequePage(page);

    // Add a value to the front
    await deque.addFront('A');

    // Expect the empty message to disappear and one deque item to appear
    expect(await deque.hasEmptyMessage()).toBe(false);
    expect(await deque.itemCount()).toBe(1);

    // The single item should display the value and have both front and rear classes
    const item = deque.itemLocator.nth(0);
    await expect(item).toHaveText('A');
    await expect(item).toHaveClass(/front/); // contains 'front'
    await expect(item).toHaveClass(/rear/);  // contains 'rear'

    // Status should reflect Non-Empty state and show front/rear
    await expect(deque.status).toHaveText('Status: Deque has 1 elements. Front: A, Rear: A');

    // Input should be cleared after successful add
    await expect(deque.input).toHaveValue('');

    // Ensure no console errors or page errors occurred during the interaction
    expect(consoleErrors.length, `console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });

  test('S0_Empty -> AddToRear transitions to S1_NonEmpty and maintains order on multiple adds', async ({ page }) => {
    const deque = new DequePage(page);

    // Add elements to rear and front to build multiple items
    await deque.addRear('B'); // deque: [B]
    await deque.addFront('A'); // deque: [A, B]
    await deque.addRear('C'); // deque: [A, B, C]

    // Expect three items in order A, B, C
    expect(await deque.itemCount()).toBe(3);
    const items = await deque.getItemsText();
    expect(items).toEqual(['A', 'B', 'C']);

    // First item should have front class; last item should have rear class
    await expect(deque.itemLocator.nth(0)).toHaveClass(/front/);
    await expect(deque.itemLocator.nth(2)).toHaveClass(/rear/);

    // Status should correctly report size and front/rear values
    await expect(deque.status).toHaveText('Status: Deque has 3 elements. Front: A, Rear: C');

    // No console errors or uncaught exceptions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('RemoveFromFront and RemoveFromRear update the deque and status correctly', async ({ page }) => {
    const deque = new DequePage(page);

    // Prepare deque with three elements A, B, C
    await deque.addRear('A');
    await deque.addRear('B');
    await deque.addRear('C');

    // Remove from front -> should remove 'A'
    await deque.removeFront();
    // After removal items should be B, C
    expect(await deque.itemCount()).toBe(2);
    expect(await deque.getItemsText()).toEqual(['B', 'C']);
    // Status should show that last removal message and Non-Empty status afterward
    // The implementation sets status to "Removed from front: A" then updateVisualization() will overwrite with "Status: ..."
    // So expect final status to be the summary line for 2 elements
    await expect(deque.status).toHaveText('Status: Deque has 2 elements. Front: B, Rear: C');

    // Remove from rear -> should remove 'C'
    await deque.removeRear();
    expect(await deque.itemCount()).toBe(1);
    expect(await deque.getItemsText()).toEqual(['B']);
    await expect(deque.status).toHaveText('Status: Deque has 1 elements. Front: B, Rear: B');

    // Remove remaining element from front -> deque becomes empty
    await deque.removeFront();
    // After removal, status should say deque is empty and empty message visible
    await expect(deque.emptyMessage).toHaveText('Deque is empty');
    await expect(deque.status).toHaveText('Status: Deque is empty. Try adding elements!');
    expect(await deque.itemCount()).toBe(0);

    // No console errors or uncaught exceptions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Removing when empty yields "Deque is empty" message and status indicates removal of empty', async ({ page }) => {
    const deque = new DequePage(page);

    // Ensure empty at start
    await expect(deque.emptyMessage).toHaveText('Deque is empty');
    // Click removeFront on empty
    await deque.removeFront();
    // Implementation sets status to `Removed from front: Deque is empty` then updateVisualization() will restore empty status;
    // In this app the code sets statusElement.textContent = `Removed from front: ${removed}` and then updateVisualization() sets a different status.
    // Therefore, final status will be 'Status: Deque is empty. Try adding elements!'
    await expect(deque.status).toHaveText('Status: Deque is empty. Try adding elements!');
    // Click removeRear on empty
    await deque.removeRear();
    await expect(deque.status).toHaveText('Status: Deque is empty. Try adding elements!');

    // Ensure still empty message
    await expect(deque.emptyMessage).toHaveText('Deque is empty');

    // No console errors or uncaught exceptions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('ClearDeque transitions S1_NonEmpty -> S0_Empty and resets visualization', async ({ page }) => {
    const deque = new DequePage(page);

    // Add elements
    await deque.addFront('X');
    await deque.addRear('Y');
    await deque.addRear('Z');

    // Verify non-empty
    expect(await deque.itemCount()).toBe(3);
    await expect(deque.status).toHaveText('Status: Deque has 3 elements. Front: X, Rear: Z');

    // Clear the deque
    await deque.clear();

    // Expect empty state and empty message
    await expect(deque.emptyMessage).toHaveText('Deque is empty');
    await expect(deque.status).toHaveText('Status: Deque is empty. Try adding elements!');
    expect(await deque.itemCount()).toBe(0);

    // No console errors or uncaught exceptions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: attempting to add empty or whitespace-only input shows a helpful status message', async ({ page }) => {
    const deque = new DequePage(page);

    // Ensure empty input and click addFront
    await deque.input.fill('   '); // whitespace-only
    await deque.addFront(''); // clicking addFront with programmatic blank value: the application reads trimmed value; simulate clicking button when input is whitespace
    // Because our addFront helper filled with empty string and clicked, but the actual UI trimming means whitespace-only should be treated as empty.
    // The app sets statusElement.textContent = 'Please enter a value first!' in that case.
    // To trigger that behavior reliably, fill whitespace then click addFront
    await deque.input.fill('   ');
    await deque.addFront(''); // helper will fill with '' then click; to ensure we clicked while whitespace is present we do manual steps:
    // To be precise, perform the manual flow: fill whitespace then click the button (bypass helper)
    await deque.input.fill('   ');
    await page.locator('#addFront').click();
    await expect(deque.status).toHaveText('Please enter a value first!');

    // Clicking addRear with empty input also shows same message
    await deque.input.fill('');
    await page.locator('#addRear').click();
    await expect(deque.status).toHaveText('Please enter a value first!');

    // Ensure still empty visualization
    await expect(deque.emptyMessage).toHaveText('Deque is empty');

    // No console errors or uncaught exceptions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Final test: comprehensive scenario exercising many transitions in a row and ensuring no runtime errors
  test('Comprehensive scenario: multiple ops and final state verification with no runtime errors', async ({ page }) => {
    const deque = new DequePage(page);

    // Sequence of operations
    await deque.addRear('1'); // [1]
    await deque.addFront('0'); // [0,1]
    await deque.addRear('2'); // [0,1,2]
    await deque.removeFront(); // removes 0 -> [1,2]
    await deque.addFront('-1'); // [-1,1,2]
    await deque.removeRear(); // removes 2 -> [-1,1]
    await deque.clear(); // -> []

    // Final state should be empty
    await expect(deque.emptyMessage).toHaveText('Deque is empty');
    await expect(deque.status).toHaveText('Status: Deque is empty. Try adding elements!');
    expect(await deque.itemCount()).toBe(0);

    // Assert that no ReferenceError, SyntaxError, or TypeError were thrown during all interactions
    // Convert pageErrors to string messages for inspection
    const pageErrorMessages = pageErrors.map(e => (e && e.message) ? e.message : String(e));
    const hasCriticalErrors = pageErrors.some(err => {
      const name = err && err.name ? err.name : '';
      return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
    }) || consoleErrors.some(msg => /ReferenceError|SyntaxError|TypeError/.test(msg));

    expect(hasCriticalErrors, `Expected no ReferenceError/SyntaxError/TypeError. Page errors: ${JSON.stringify(pageErrorMessages)}, Console errors: ${JSON.stringify(consoleErrors)}`).toBe(false);

    // Also ensure there are no console.error messages at all
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});