import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-balanced/html/63afeeb1-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Helper: expected computed color strings for validations
const COLORS = {
  success: 'rgb(39, 174, 96)', // #27ae60
  error: 'rgb(192, 57, 43)', // #c0392b
};

// Page Object for the Stack Demo
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputValue');
    this.pushBtn = page.locator('#pushBtn');
    this.popBtn = page.locator('#popBtn');
    this.peekBtn = page.locator('#peekBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.stackContainer = page.locator('#stack-container');
    this.message = page.locator('#message');
    this.stackElements = () => page.locator('.stack-element');
    this.topElement = () => page.locator('.stack-element.top');
  }

  // Navigate to the app URL
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Push a value using the push button (normal user flow)
  async push(value) {
    await this.input.fill(value);
    await this.pushBtn.click();
  }

  // Simulate pressing Enter in the input field
  async pushByEnter(value) {
    await this.input.fill(value);
    await this.input.press('Enter');
  }

  // Click pop
  async pop() {
    await this.popBtn.click();
  }

  // Click peek
  async peek() {
    await this.peekBtn.click();
  }

  // Click clear
  async clear() {
    await this.clearBtn.click();
  }

  // Returns number of stack elements visible
  async countElements() {
    return await this.stackElements().count();
  }

  // Returns array of element texts from top to bottom (top first)
  async getElementsTextTopToBottom() {
    // Elements in DOM are appended from top to bottom visually in this implementation
    const count = await this.countElements();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.stackElements().nth(i).textContent());
    }
    return texts;
  }

  // Get message text
  async getMessageText() {
    return (await this.message.textContent()) || '';
  }

  // Get message computed color
  async getMessageColor() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return window.getComputedStyle(el).color;
    }, '#message');
  }

  // Checks whether specific buttons are disabled
  async isPopDisabled() {
    return await this.popBtn.isDisabled();
  }
  async isPeekDisabled() {
    return await this.peekBtn.isDisabled();
  }
  async isClearDisabled() {
    return await this.clearBtn.isDisabled();
  }

  // Gets id of active element
  async getActiveElementId() {
    return await this.page.evaluate(() => document.activeElement?.id || null);
  }
}

test.describe('Stack Data Structure Demo - FSM validation (63afeeb1-fa74-11f0-bb9a-db7e6ecdeeaa)', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    pageErrors = [];
    consoleErrors = [];

    // Listen for uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Listen for console messages, flag any with type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });
  });

  test.afterEach(async () => {
    // Assert that there were no uncaught page errors or console error messages
    // These assertions ensure the app script executed without runtime exceptions.
    expect(pageErrors.length, 'No uncaught page errors').toBe(0);
    expect(
      consoleErrors.length,
      'No console error messages should be emitted'
    ).toBe(0);
  });

  test.describe('State: S0_Empty (Initial)', () => {
    test('Initial render shows empty state message and disables pop/peek/clear', async ({
      page,
    }) => {
      // Setup page object and go to app
      const stack = new StackPage(page);
      await stack.goto();

      // Verify there are no stack elements
      expect(await stack.countElements()).toBe(0);

      // Verify message text matches the S0 entry action
      const msg = await stack.getMessageText();
      expect(msg).toContain('Stack is empty. Add elements by pushing values.');

      // Message color should be success (green) per showMessage's default
      expect(await stack.getMessageColor()).toBe(COLORS.success);

      // Pop/Peek/Clear buttons should be disabled in the empty state
      expect(await stack.isPopDisabled()).toBe(true);
      expect(await stack.isPeekDisabled()).toBe(true);
      expect(await stack.isClearDisabled()).toBe(true);
    });

    test('Attempting to pop or peek in empty state shows error messages', async ({
      page,
    }) => {
      const stack1 = new StackPage(page);
      await stack.goto();

      // Click Pop when empty -> error message
      await stack.pop();
      expect(await stack.getMessageText()).toContain(
        'Stack is empty. Cannot pop.'
      );
      expect(await stack.getMessageColor()).toBe(COLORS.error);

      // Click Peek when empty -> error message
      await stack.peek();
      expect(await stack.getMessageText()).toContain(
        'Stack is empty. Nothing to peek.'
      );
      expect(await stack.getMessageColor()).toBe(COLORS.error);
    });

    test('Push with empty input shows validation error (edge case)', async ({
      page,
    }) => {
      const stack2 = new StackPage(page);
      await stack.goto();

      // Ensure input is empty and click push
      await stack.input.fill('');
      await stack.pushBtn.click();

      // Validation error shown
      expect(await stack.getMessageText()).toContain(
        'Please enter a value to push.'
      );
      expect(await stack.getMessageColor()).toBe(COLORS.error);

      // Still no elements
      expect(await stack.countElements()).toBe(0);
    });

    test('EnterKeyEvent pushes value from input (S0_Empty -> S1_NonEmpty)', async ({
      page,
    }) => {
      const stack3 = new StackPage(page);
      await stack.goto();

      // Use Enter to push value
      await stack.pushByEnter('enterValue');

      // Now stack should contain the new element
      expect(await stack.countElements()).toBe(1);
      expect(await stack.topElement().textContent()).toBe('enterValue');

      // Message should indicate the push
      expect(await stack.getMessageText()).toContain(
        'Pushed "enterValue" onto the stack.'
      );

      // Buttons should now be enabled
      expect(await stack.isPopDisabled()).toBe(false);
      expect(await stack.isPeekDisabled()).toBe(false);
      expect(await stack.isClearDisabled()).toBe(false);

      // Input should be cleared and focused per script behavior
      expect(await stack.input.inputValue()).toBe('');
      expect(await stack.getActiveElementId()).toBe('inputValue');
    });
  });

  test.describe('State: S1_NonEmpty (Non-empty stack behaviors & transitions)', () => {
    test('Push multiple values then verify visual stack and top marker', async ({
      page,
    }) => {
      const stack4 = new StackPage(page);
      await stack.goto();

      // Push three values
      await stack.push('one');
      await stack.push('two');
      await stack.push('three');

      // There should be 3 elements; top element should be "three"
      expect(await stack.countElements()).toBe(3);

      // The top element has class "top" per implementation
      const top = stack.topElement();
      await expect(top).toHaveCount(1);
      expect(await top.textContent()).toBe('three');

      // Visual order: top first in DOM (implementation appends top at top)
      const texts1 = await stack.getElementsTextTopToBottom(); // top to bottom
      expect(texts[0]).toBe('three');
      expect(texts[1]).toBe('two');
      expect(texts[2]).toBe('one');

      // Message should reflect the last push
      expect(await stack.getMessageText()).toContain('Pushed "three" onto the stack.');
      expect(await stack.getMessageColor()).toBe(COLORS.success);
    });

    test('PopEvent reduces stack size and shows popped value message', async ({
      page,
    }) => {
      const stack5 = new StackPage(page);
      await stack.goto();

      // Start with three elements
      await stack.push('a');
      await stack.push('b');
      await stack.push('c');

      // Pop once -> should remove 'c'
      await stack.pop();

      // Count decreased
      expect(await stack.countElements()).toBe(2);

      // New top should be 'b' and message reflects popped value
      expect(await stack.topElement().textContent()).toBe('b');
      expect(await stack.getMessageText()).toContain('Popped "c" from the stack.');
      expect(await stack.getMessageColor()).toBe(COLORS.success);
    });

    test('PeekEvent shows top value without removing it', async ({ page }) => {
      const stack6 = new StackPage(page);
      await stack.goto();

      // Push values
      await stack.push('first');
      await stack.push('second');

      // Count before peek
      const beforeCount = await stack.countElements();

      // Peek
      await stack.peek();

      // Count unchanged
      expect(await stack.countElements()).toBe(beforeCount);

      // Message indicates top element and is success color
      expect(await stack.getMessageText()).toContain('Top element is "second".');
      expect(await stack.getMessageColor()).toBe(COLORS.success);
    });

    test('ClearEvent clears the stack and returns to empty state S0_Empty', async ({
      page,
    }) => {
      const stack7 = new StackPage(page);
      await stack.goto();

      // Push some items
      await stack.push('x');
      await stack.push('y');

      // Ensure non-empty
      expect(await stack.countElements()).toBe(2);

      // Clear the stack
      await stack.clear();

      // Stack should be empty and message indicates cleared
      expect(await stack.countElements()).toBe(0);
      expect(await stack.getMessageText()).toContain('Stack cleared.');
      expect(await stack.getMessageColor()).toBe(COLORS.success);

      // Buttons disabled again
      expect(await stack.isPopDisabled()).toBe(true);
      expect(await stack.isPeekDisabled()).toBe(true);
      expect(await stack.isClearDisabled()).toBe(true);
    });
  });

  test.describe('Edge cases & robustness', () => {
    test('Pushing duplicate values and popping respects LIFO', async ({ page }) => {
      const stack8 = new StackPage(page);
      await stack.goto();

      // Push duplicates
      await stack.push('dup');
      await stack.push('dup');
      await stack.push('dup');

      // Pop should remove last pushed 'dup'
      await stack.pop();
      expect(await stack.countElements()).toBe(2);
      expect(await stack.topElement().textContent()).toBe('dup');

      // Pop twice more empties the stack
      await stack.pop();
      await stack.pop();
      expect(await stack.countElements()).toBe(0);
      expect(await stack.getMessageText()).toContain('Popped "dup" from the stack.');
    });

    test('Rapid push/pop sequences maintain correct state (stress path)', async ({
      page,
    }) => {
      const stack9 = new StackPage(page);
      await stack.goto();

      // Rapid sequence
      await stack.push('1');
      await stack.push('2');
      await stack.pop(); // removes 2
      await stack.push('3');
      await stack.peek(); // top should be 3
      await stack.pop(); // removes 3
      await stack.pop(); // removes 1

      // Now empty
      expect(await stack.countElements()).toBe(0);
      expect(await stack.getMessageText()).toMatch(/Popped "1" from the stack.|Stack is empty. Cannot pop./);
    });
  });
});