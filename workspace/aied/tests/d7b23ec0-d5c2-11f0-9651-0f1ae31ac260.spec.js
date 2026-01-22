import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b23ec0-d5c2-11f0-9651-0f1ae31ac260.html';

// Page object for interacting with the Stack demo
class StackPage {
  constructor(page) {
    this.page = page;
    this.stackInput = page.locator('#stackInput');
    this.pushBtn = page.locator('#pushBtn');
    this.popBtn = page.locator('#popBtn');
    this.peekBtn = page.locator('#peekBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.stackContainer = page.locator('#stackContainer');
    this.message = page.locator('#message');
  }

  // Push a value using the UI
  async push(value) {
    await this.stackInput.fill(value);
    await this.pushBtn.click();
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

  // Get rendered stack elements texts in DOM order (bottom to top as rendered)
  async getStackElementsTexts() {
    return await this.page.$$eval('.stack-element', els => els.map(e => e.textContent));
  }

  // Get count of stack elements
  async getStackCount() {
    return await this.page.locator('.stack-element').count();
  }

  // Get message text
  async getMessageText() {
    return (await this.message.textContent())?.trim() ?? '';
  }

  // Get computed color of message as returned by getComputedStyle (e.g. "rgb(25, 135, 84)")
  async getMessageColor() {
    return await this.page.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return cs.color;
    }, await this.message.elementHandle());
  }

  // Get whether given control is disabled
  async isDisabled(locator) {
    return await locator.isDisabled();
  }

  async activeElementId() {
    return await this.page.evaluate(() => document.activeElement?.id ?? null);
  }
}

// Top-level describe grouping all FSM tests
test.describe('Stack Data Structure Demo - FSM validation', () => {
  // We'll capture console errors and page errors to ensure no runtime exceptions occur.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught exceptions (pageerror)
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Assert no unexpected console errors or page errors occurred during the test run
    expect(consoleErrors, `Console errors encountered:\n${consoleErrors.join('\n')}`).toEqual([]);
    expect(pageErrors, `Page errors encountered:\n${pageErrors.join('\n')}`).toEqual([]);
  });

  test.describe('Initial State - S0_Empty', () => {
    test('renders empty stack UI and disables relevant buttons', async ({ page }) => {
      // This test validates initial state S0_Empty: stack.length === 0, shows "Stack is empty" text,
      // and Pop/Peek/Clear buttons are disabled while Push is enabled.
      const stack = new StackPage(page);

      // Stack container should show the empty message paragraph
      const emptyParagraph = page.locator('#stackContainer p');
      await expect(emptyParagraph).toHaveText('Stack is empty');

      // Confirm no stack elements
      await expect(page.locator('.stack-element')).toHaveCount(0);

      // Pop, Peek, Clear should be disabled
      expect(await stack.isDisabled(stack.popBtn)).toBe(true);
      expect(await stack.isDisabled(stack.peekBtn)).toBe(true);
      expect(await stack.isDisabled(stack.clearBtn)).toBe(true);

      // Push should be enabled
      expect(await stack.isDisabled(stack.pushBtn)).toBe(false);

      // Message area initially empty
      expect(await stack.getMessageText()).toBe('');
    });

    test('edge case: clear when already empty shows expected error message', async ({ page }) => {
      // Clicking Clear in empty state should show "Stack already empty." with error styling
      const stack = new StackPage(page);
      await stack.clear();

      await expect(page.locator('#message')).toHaveText('Stack already empty.');

      // Message color should match the error color used in implementation (#d6336c -> rgb(214, 51, 108))
      const color = await stack.getMessageColor();
      expect(color).toBe('rgb(214, 51, 108)');

      // focus should return to the input
      expect(await stack.activeElementId()).toBe('stackInput');
    });
  });

  test.describe('PushEvent and transition S0_Empty -> S1_NonEmpty', () => {
    test('push a value moves to non-empty state and updates DOM and message', async ({ page }) => {
      // Validate pushing a value:
      // - input cleared and focused afterwards
      // - stack renders an element with top styling and aria-label with "(top)"
      // - message shows success text in green (#198754 -> rgb(25, 135, 84))
      const stack = new StackPage(page);

      await stack.push('A');

      // Now there should be one stack element with text 'A'
      await expect(page.locator('.stack-element')).toHaveCount(1);
      const texts = await stack.getStackElementsTexts();
      expect(texts).toEqual(['A']);

      // The single element should have class 'top' and aria-label 'A (top)'
      const topElement = page.locator('.stack-element.top');
      await expect(topElement).toHaveCount(1);
      await expect(topElement).toHaveAttribute('aria-label', 'A (top)');

      // Message should indicate successful push
      await expect(page.locator('#message')).toHaveText('Pushed "A" onto the stack.');
      const color = await stack.getMessageColor();
      expect(color).toBe('rgb(25, 135, 84)');

      // Buttons Pop/Peek/Clear should now be enabled
      expect(await stack.isDisabled(stack.popBtn)).toBe(false);
      expect(await stack.isDisabled(stack.peekBtn)).toBe(false);
      expect(await stack.isDisabled(stack.clearBtn)).toBe(false);

      // Input should have been cleared and focused
      expect(await page.locator('#stackInput').inputValue()).toBe('');
      expect(await stack.activeElementId()).toBe('stackInput');
    });

    test('edge case: pushing empty or whitespace shows validation error and focuses input', async ({ page }) => {
      // If input is empty or whitespace, clicking push shows an error message and focuses input.
      const stack = new StackPage(page);

      // Ensure empty string push
      await stack.stackInput.fill('');
      await stack.pushBtn.click();
      await expect(page.locator('#message')).toHaveText('Please enter a value to push onto the stack.');
      expect(await stack.getMessageColor()).toBe('rgb(214, 51, 108)');
      expect(await stack.activeElementId()).toBe('stackInput');

      // Ensure whitespace-only input triggers same behavior
      await stack.stackInput.fill('   ');
      await stack.pushBtn.click();
      await expect(page.locator('#message')).toHaveText('Please enter a value to push onto the stack.');
      expect(await stack.getMessageColor()).toBe('rgb(214, 51, 108)');
      expect(await stack.activeElementId()).toBe('stackInput');
    });
  });

  test.describe('PopEvent behaviors', () => {
    test('pop removes the top element and updates message and DOM', async ({ page }) => {
      // Validate PopEvent when stack has multiple elements:
      // - pushes two values, pops once, top element removed, message shows popped value,
      // - stack still non-empty if more than one element remains.
      const stack = new StackPage(page);

      // Push two elements: A then B
      await stack.push('A');
      await stack.push('B');

      // Verify top is B
      let texts = await stack.getStackElementsTexts();
      expect(texts).toEqual(['A', 'B']);

      // Pop once
      await stack.pop();

      // Message should indicate popped "B"
      await expect(page.locator('#message')).toHaveText('Popped "B" from the stack.');
      expect(await stack.getMessageColor()).toBe('rgb(25, 135, 84)');

      // Remaining stack contains only A
      texts = await stack.getStackElementsTexts();
      expect(texts).toEqual(['A']);
      await expect(page.locator('.stack-element.top')).toHaveAttribute('aria-label', 'A (top)');

      // Buttons should still be enabled because stack is non-empty now
      expect(await stack.isDisabled(stack.popBtn)).toBe(false);
      expect(await stack.isDisabled(stack.peekBtn)).toBe(false);
      expect(await stack.isDisabled(stack.clearBtn)).toBe(false);
    });

    test('pop when single element leads to empty state and disables controls', async ({ page }) => {
      // Push a single element, pop it, and ensure the stack returns to empty state (S0_Empty)
      const stack = new StackPage(page);

      await stack.push('OnlyOne');

      // Pop it
      await stack.pop();

      // Expect empty state UI
      await expect(page.locator('#stackContainer p')).toHaveText('Stack is empty');
      await expect(page.locator('.stack-element')).toHaveCount(0);

      // Message indicates popped value
      await expect(page.locator('#message')).toHaveText('Popped "OnlyOne" from the stack.');
      expect(await stack.getMessageColor()).toBe('rgb(25, 135, 84)');

      // Buttons disabled except push
      expect(await stack.isDisabled(stack.popBtn)).toBe(true);
      expect(await stack.isDisabled(stack.peekBtn)).toBe(true);
      expect(await stack.isDisabled(stack.clearBtn)).toBe(true);
    });

    test('edge case: pop when empty shows error message', async ({ page }) => {
      // Popping in empty state should show a clear error message and not throw JS errors
      const stack = new StackPage(page);

      // Ensure stack empty; directly click pop
      await stack.pop();
      await expect(page.locator('#message')).toHaveText('Stack is empty. Cannot pop.');
      expect(await stack.getMessageColor()).toBe('rgb(214, 51, 108)');

      // Focus should move to input after the handler (implementation focuses input only on successful pop, but we won't assert focus here beyond no crash)
      // Confirm still no stack elements
      await expect(page.locator('.stack-element')).toHaveCount(0);
    });
  });

  test.describe('PeekEvent behaviors', () => {
    test('peek shows top element without removing it', async ({ page }) => {
      // Push element and peek should display top element message without modifying the stack
      const stack = new StackPage(page);

      await stack.push('PeekVal');

      // Peek
      await stack.peek();

      // Message shows top element
      await expect(page.locator('#message')).toHaveText('Top element is "PeekVal".');
      expect(await stack.getMessageColor()).toBe('rgb(25, 135, 84)');

      // Stack should remain unchanged
      await expect(page.locator('.stack-element')).toHaveCount(1);
      await expect(page.locator('.stack-element.top')).toHaveText('PeekVal');
    });

    test('peek when empty shows error message', async ({ page }) => {
      // If the stack is empty, peeking should indicate error gracefully
      const stack = new StackPage(page);

      // Ensure empty and then peek
      await stack.peek();
      await expect(page.locator('#message')).toHaveText('Stack is empty. Nothing to peek.');
      expect(await stack.getMessageColor()).toBe('rgb(214, 51, 108)');
      await expect(page.locator('.stack-element')).toHaveCount(0);
    });
  });

  test.describe('ClearEvent behaviors and transitions', () => {
    test('clear empties the non-empty stack and updates UI and message', async ({ page }) => {
      // Push a few elements, clear them, assert empty state reached and message shown
      const stack = new StackPage(page);

      await stack.push('1');
      await stack.push('2');
      await stack.push('3');

      await expect(page.locator('.stack-element')).toHaveCount(3);

      // Clear stack
      await stack.clear();

      // Now should show empty message
      await expect(page.locator('#stackContainer p')).toHaveText('Stack is empty');

      // Buttons disabled
      expect(await stack.isDisabled(stack.popBtn)).toBe(true);
      expect(await stack.isDisabled(stack.peekBtn)).toBe(true);
      expect(await stack.isDisabled(stack.clearBtn)).toBe(true);

      // Message indicates clearing
      await expect(page.locator('#message')).toHaveText('Stack cleared.');
      expect(await stack.getMessageColor()).toBe('rgb(25, 135, 84)');

      // Input focused after clearing (implementation calls focus)
      expect(await stack.activeElementId()).toBe('stackInput');
    });
  });

  test.describe('Accessibility and DOM attribute checks', () => {
    test('stack elements have role listitem and container has appropriate role and aria-label', async ({ page }) => {
      // Verify ARIA attributes mentioned in the FSM/components
      const stack = new StackPage(page);

      // container attributes
      await expect(page.locator('#stackContainer')).toHaveAttribute('role', 'list');
      await expect(page.locator('#stackContainer')).toHaveAttribute('aria-label', 'Stack visualization');

      // Push items and verify listitem roles and aria-labels for top element
      await stack.push('alpha');
      await stack.push('beta');

      // Each element should have role=listitem
      const items = page.locator('.stack-element');
      const count = await items.count();
      for (let i = 0; i < count; i++) {
        await expect(items.nth(i)).toHaveAttribute('role', 'listitem');
      }

      // Top element should have aria-label "beta (top)"
      await expect(page.locator('.stack-element.top')).toHaveAttribute('aria-label', 'beta (top)');
    });
  });

  test.describe('Runtime sanity: ensure no console or page errors on load and interactions', () => {
    test('no runtime console errors or uncaught exceptions during typical usage', async ({ page }) => {
      // This test exercises a sequence of typical interactions and relies on the afterEach hook to assert
      // that there were no console errors or page errors captured during execution.
      const stack = new StackPage(page);

      // Do a sequence: push, peek, pop, clear
      await stack.push('x');
      await stack.peek();
      await stack.pop();
      await stack.push('y');
      await stack.clear();

      // Also exercise edge interactions
      await stack.push('');
      await stack.pop();
      await stack.peek();
      await stack.clear();

      // Intentionally do not assert consoleErrors/pageErrors here; afterEach will verify they are empty.
      // But perform a few final DOM assertions to ensure UI responded
      await expect(page.locator('#stackContainer p')).toHaveText('Stack is empty');
    });
  });
});