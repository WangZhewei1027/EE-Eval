import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17622dc1-d5c1-11f0-938c-19d14b60ef51.html';

// Page Object Model for the Stack page
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#stackInput');
    this.pushBtn = page.locator("button[onclick='push()']");
    this.popBtn = page.locator("button[onclick='pop()']");
    this.peekBtn = page.locator("button[onclick='peek()']");
    this.clearBtn = page.locator("button[onclick='clearStack()']");
    this.container = page.locator('#stack-container');
    this.elementSelector = '#stack-container .stack-element';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setInput(value) {
    await this.input.fill(value);
  }

  async getInputValue() {
    return await this.input.inputValue();
  }

  // Click push and wait for potential alert; returns dialog message if alert appears, otherwise null
  async clickPushExpectDialogIfAny() {
    // The application alerts only when input is empty. Use waitForEvent for dialog race.
    const click = this.pushBtn.click();
    const promise = this.page.waitForEvent('dialog', { timeout: 500 }).catch(() => null);
    await click;
    const dialog = await promise;
    if (dialog) {
      const message = dialog.message();
      await dialog.accept();
      return message;
    }
    return null;
  }

  // Generic helper to click a button and capture dialog text
  async clickAndCaptureDialog(clickPromise) {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      clickPromise
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  async push(value) {
    await this.setInput(value);
    await this.pushBtn.click();
  }

  async popAndGetAlert() {
    return await this.clickAndCaptureDialog(this.popBtn.click());
  }

  async peekAndGetAlert() {
    return await this.clickAndCaptureDialog(this.peekBtn.click());
  }

  async clear() {
    await this.clearBtn.click();
  }

  async getStackElements() {
    return this.page.locator(this.elementSelector);
  }

  async getStackTexts() {
    const elems = this.page.locator(this.elementSelector);
    const count = await elems.count();
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(await elems.nth(i).textContent());
    }
    return arr;
  }
}

test.describe('Stack FSM - states and transitions', () => {
  // arrays to collect console errors and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages with their types
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test('Initial render (S0_Idle) - page elements present and stack container empty', async ({ page }) => {
    // Validate that initial state (Idle) renders input, buttons, and empty container
    const stack = new StackPage(page);
    await stack.goto();

    // Basic present checks
    await expect(stack.input).toBeVisible();
    await expect(stack.pushBtn).toBeVisible();
    await expect(stack.popBtn).toBeVisible();
    await expect(stack.peekBtn).toBeVisible();
    await expect(stack.clearBtn).toBeVisible();
    await expect(stack.container).toBeVisible();

    // Stack should be empty initially
    await expect(stack.getStackElements()).toHaveCount(0);

    // No unexpected page errors or console 'error' messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Push transition (S0 -> S1_ItemPushed) - push single item and verify display and input cleared', async ({ page }) => {
    // Validate push action: item displayed in stack container and input cleared
    const stack = new StackPage(page);
    await stack.goto();

    // Push a value
    await stack.setInput('first');
    await stack.pushBtn.click();

    // After push, stack should display one element with text 'first'
    await expect(stack.getStackElements()).toHaveCount(1);
    const texts = await stack.getStackTexts();
    expect(texts).toEqual(['first']);

    // Input should be cleared after successful push
    expect(await stack.getInputValue()).toBe('');

    // No alerts should have been shown during successful push
    // (if an alert was expected, it would have been captured via dialog handlers)
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Pop transition (S0 -> S2_ItemPopped) - pop returns top value via alert and updates display', async ({ page }) => {
    // Validate pop action: alert shows popped value and display updates
    const stack = new StackPage(page);
    await stack.goto();

    // Setup: push two values 'a', 'b' (b is top)
    await stack.push('a');
    await stack.push('b');

    // Ensure two items present
    await expect(stack.getStackElements()).toHaveCount(2);

    // Pop should alert 'b' (LIFO)
    const popDialogPromise = page.waitForEvent('dialog');
    await stack.popBtn.click();
    const dialog = await popDialogPromise;
    expect(dialog.message()).toBe('b');
    await dialog.accept();

    // After pop, only 'a' should remain
    await expect(stack.getStackElements()).toHaveCount(1);
    const textsAfterPop = await stack.getStackTexts();
    expect(textsAfterPop).toEqual(['a']);

    // No JS runtime errors expected
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Peek transition (S0 -> S3_ItemPeeked) - peek shows top value via alert without removing it', async ({ page }) => {
    // Validate peek action: alert shows top value and stack unchanged
    const stack = new StackPage(page);
    await stack.goto();

    // Push two values: x then y (y is top)
    await stack.push('x');
    await stack.push('y');

    // Peek should alert 'y' but not remove it
    const peekDialogPromise = page.waitForEvent('dialog');
    await stack.peekBtn.click();
    const dialog = await peekDialogPromise;
    expect(dialog.message()).toBe('y');
    await dialog.accept();

    // Stack should remain unchanged (two elements)
    await expect(stack.getStackElements()).toHaveCount(2);
    const texts = await stack.getStackTexts();
    expect(texts).toEqual(['x', 'y']);

    // No JS runtime errors expected
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Clear transition (S0 -> S4_StackCleared) - clear stack empties display', async ({ page }) => {
    // Validate clearStack action: clears stack and updates display
    const stack = new StackPage(page);
    await stack.goto();

    // Push several values
    await stack.push('one');
    await stack.push('two');
    await stack.push('three');

    await expect(stack.getStackElements()).toHaveCount(3);

    // Clear the stack
    await stack.clearBtn.click();

    // Container should be empty
    await expect(stack.getStackElements()).toHaveCount(0);

    // No JS runtime errors expected
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('LIFO behavior across multiple pushes and pops - ensure pop order is reverse of pushes', async ({ page }) => {
    // Validate stack LIFO invariant: pushes then pops produce reverse order alerts
    const stack = new StackPage(page);
    await stack.goto();

    // Push sequence: 1,2,3,4
    const values = ['1', '2', '3', '4'];
    for (const v of values) {
      await stack.push(v);
    }

    // Pop four times, capturing alerts in order
    const popped = [];
    for (let i = 0; i < values.length; i++) {
      const dialogPromise = page.waitForEvent('dialog');
      await stack.popBtn.click();
      const dialog = await dialogPromise;
      popped.push(dialog.message());
      await dialog.accept();
    }

    // Popped sequence must be reverse of pushed sequence
    expect(popped).toEqual(values.slice().reverse());

    // Container should be empty after pops
    await expect(stack.getStackElements()).toHaveCount(0);
  });
});

test.describe('Edge cases and error scenarios', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test('Push with empty input shows alert (edge case)', async ({ page }) => {
    // When input is empty and Push clicked, an alert should prompt the user
    const stack = new StackPage(page);
    await stack.goto();

    // Ensure input is empty
    await stack.setInput('');

    // Click Push and capture the alert message
    const dialogPromise = page.waitForEvent('dialog');
    await stack.pushBtn.click();
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('Please enter a value to push onto the stack.');
    await dialog.accept();

    // Stack remains empty
    await expect(stack.getStackElements()).toHaveCount(0);

    // No runtime errors expected beyond the alert
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Pop when stack is empty alerts "Stack is empty"', async ({ page }) => {
    // When popping from an empty stack, alert should show "Stack is empty"
    const stack = new StackPage(page);
    await stack.goto();

    // Ensure stack is empty
    await expect(stack.getStackElements()).toHaveCount(0);

    // Click pop and capture alert
    const dialogPromise = page.waitForEvent('dialog');
    await stack.popBtn.click();
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('Stack is empty');
    await dialog.accept();

    // Still empty after pop
    await expect(stack.getStackElements()).toHaveCount(0);

    // No runtime errors expected
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Peek when stack is empty alerts "Stack is empty"', async ({ page }) => {
    // When peeking into an empty stack, alert should show "Stack is empty"
    const stack = new StackPage(page);
    await stack.goto();

    // Ensure stack is empty
    await expect(stack.getStackElements()).toHaveCount(0);

    // Click peek and capture alert
    const dialogPromise = page.waitForEvent('dialog');
    await stack.peekBtn.click();
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('Stack is empty');
    await dialog.accept();

    // No runtime errors expected
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Clear on already empty stack leaves it unchanged (idempotence)', async ({ page }) => {
    // Calling clearStack on an already empty stack should keep it empty
    const stack = new StackPage(page);
    await stack.goto();

    // Ensure empty
    await expect(stack.getStackElements()).toHaveCount(0);

    // Clear it
    await stack.clearBtn.click();

    // Still empty
    await expect(stack.getStackElements()).toHaveCount(0);

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});