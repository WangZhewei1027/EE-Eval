import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a324710-ffc5-11f0-8b43-1ffa87931c43.html';

// Page Object for the Stack Demo page
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pushInput = page.locator('#pushInput');
    this.pushBtn = page.locator('#pushBtn');
    this.popBtn = page.locator('#popBtn');
    this.peekBtn = page.locator('#peekBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.stackDiv = page.locator('#stack');
    this.messageDiv = page.locator('#message');
    this.stackItem = page.locator('.stack-element');
    this.emptyPlaceholder = page.locator('#stack').locator('text=Stack is empty');
  }

  // Push using the button
  async push(value) {
    await this.pushInput.fill(value);
    await this.pushBtn.click();
  }

  // Push using Enter key in input
  async pushWithEnter(value) {
    await this.pushInput.fill(value);
    await this.pushInput.press('Enter');
  }

  async pop() {
    await this.popBtn.click();
  }

  async peek() {
    await this.peekBtn.click();
  }

  async clear() {
    await this.clearBtn.click();
  }

  // Returns array of visible stack element texts (in DOM order)
  async getStackElements() {
    const count = await this.stackItem.count();
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.stackItem.nth(i).innerText());
    }
    return results;
  }

  // Returns the message text and whether contains 'error' or 'success' in class
  async getMessage() {
    const text = await this.messageDiv.innerText();
    const classAttr = await this.messageDiv.getAttribute('class') || '';
    return {
      text: text.trim(),
      isError: classAttr.split(/\s+/).includes('error'),
      isSuccess: classAttr.split(/\s+/).includes('success'),
    };
  }

  async isStackEmptyPlaceholderVisible() {
    return await this.emptyPlaceholder.count() > 0;
  }
}

test.describe('Stack Data Structure Demo - FSM validation', () => {
  // Capture console errors and page errors per test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages of type 'error' for later assertions
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location(),
          });
        }
      } catch (e) {
        // allow any unexpected inspection errors to surface naturally
      }
    });

    // Collect uncaught page errors (runtime exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the exact URL provided in requirements
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // After each test we assert there were no uncaught runtime errors or console error messages
  test.afterEach(async () => {
    // These assertions ensure we observed the page and console errors (if any).
    // The application is expected to handle its own exceptions and show messages.
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Initial Idle state renders "Stack is empty" (S0_Idle, S3_StackEmpty evidence)', async ({ page }) => {
    // Validate initial render and idle evidence from entry action renderStack()
    const stackPage = new StackPage(page);

    // The placeholder text should be present indicating Idle / Stack Empty state
    expect(await stackPage.isStackEmptyPlaceholderVisible()).toBe(true);

    // No message should be shown at initial load
    const msg = await stackPage.getMessage();
    expect(msg.text).toBe('');
    expect(msg.isError).toBe(false);
    expect(msg.isSuccess).toBe(false);
  });

  test('Push event updates stack and shows success (S0 -> S4 StackUpdated)', async ({ page }) => {
    // Validate pushing a single element via Push button produces an updated stack and success message
    const stackPage = new StackPage(page);

    // Push 'Alpha'
    await stackPage.push('Alpha');

    // Message should indicate success with the pushed value
    const msg = await stackPage.getMessage();
    expect(msg.text).toBe('Pushed "Alpha" onto the stack.');
    expect(msg.isSuccess).toBe(true);

    // The stack should now contain one element with text 'Alpha'
    const elems = await stackPage.getStackElements();
    expect(elems).toEqual(['Alpha']);

    // The empty placeholder should be gone
    expect(await stackPage.isStackEmptyPlaceholderVisible()).toBe(false);
  });

  test('EnterPushEvent pushes element when Enter key is pressed (S0 -> S4)', async ({ page }) => {
    // Validate pressing Enter in the input triggers the push button click
    const stackPage = new StackPage(page);

    await stackPage.pushWithEnter('EnterOne');

    const msg = await stackPage.getMessage();
    expect(msg.text).toBe('Pushed "EnterOne" onto the stack.');
    expect(msg.isSuccess).toBe(true);

    const elems = await stackPage.getStackElements();
    expect(elems).toEqual(['EnterOne']);
  });

  test('Pop on empty stack shows underflow error (S0 -> S2 StackUnderflow)', async ({ page }) => {
    // Validate popping from an empty stack shows a handled error message (no uncaught exception)
    const stackPage = new StackPage(page);

    // Ensure stack is empty initially
    expect(await stackPage.isStackEmptyPlaceholderVisible()).toBe(true);

    // Click Pop
    await stackPage.pop();

    // The UI should display the underflow message (handled by showMessage)
    const msg = await stackPage.getMessage();
    expect(msg.text).toBe('Stack Underflow: No elements to pop.');
    expect(msg.isError).toBe(true);

    // Stack should remain empty and no uncaught errors should have been emitted (checked in afterEach)
    expect(await stackPage.isStackEmptyPlaceholderVisible()).toBe(true);
  });

  test('Peek on empty stack shows peek error (S0 -> S3 StackEmpty evidence)', async ({ page }) => {
    // Validate peeking when stack is empty displays the proper error message
    const stackPage = new StackPage(page);

    // Ensure empty
    expect(await stackPage.isStackEmptyPlaceholderVisible()).toBe(true);

    // Click Peek
    await stackPage.peek();

    // The message should reflect the peek error from peek()
    const msg = await stackPage.getMessage();
    // Implementation message is: 'Stack is empty: Nothing to peek at.'
    expect(msg.text).toBe('Stack is empty: Nothing to peek at.');
    expect(msg.isError).toBe(true);
  });

  test('Push multiple elements, then pop back to idle (S4 -> S0 via PopEvent)', async ({ page }) => {
    // Validate pushing multiple then popping updates stack and transitions back to Idle when empty
    const stackPage = new StackPage(page);

    // Push three elements in sequence: 1, 2, 3
    await stackPage.push('1');
    await stackPage.push('2');
    await stackPage.push('3');

    // Confirm stack shows three elements in DOM order (insertion order)
    let elems = await stackPage.getStackElements();
    expect(elems).toEqual(['1', '2', '3']);

    // Pop once -> should remove '3'
    await stackPage.pop();
    let msg = await stackPage.getMessage();
    expect(msg.text).toBe('Popped "3" from the stack.');
    expect(msg.isSuccess).toBe(true);

    elems = await stackPage.getStackElements();
    expect(elems).toEqual(['1', '2']);

    // Pop twice more
    await stackPage.pop();
    expect((await stackPage.getMessage()).text).toBe('Popped "2" from the stack.');
    await stackPage.pop();
    expect((await stackPage.getMessage()).text).toBe('Popped "1" from the stack.');

    // After all pops, the stack should be empty (Idle)
    expect(await stackPage.isStackEmptyPlaceholderVisible()).toBe(true);
    // And the visible message should correspond to the last pop success (checked above)
  });

  test('Clear event empties stack and shows success (S4 -> S4 via ClearEvent then S3 placeholder)', async ({ page }) => {
    // Validate clearing a non-empty stack empties it and shows a success message
    const stackPage = new StackPage(page);

    // Push two items
    await stackPage.push('X');
    await stackPage.push('Y');

    // Confirm presence
    expect(await stackPage.getStackElements()).toEqual(['X', 'Y']);

    // Click clear
    await stackPage.clear();

    // Message should indicate clear success
    const msg = await stackPage.getMessage();
    expect(msg.text).toBe('Stack has been cleared.');
    expect(msg.isSuccess).toBe(true);

    // Stack should now show 'Stack is empty'
    expect(await stackPage.isStackEmptyPlaceholderVisible()).toBe(true);
  });

  test('Stack Overflow occurs when trying to push beyond max size (S1_StackOverflow)', async ({ page }) => {
    // Validate pushing beyond max size produces the overflow error message and does not throw uncaught exceptions
    const stackPage = new StackPage(page);

    // Max size per implementation: 10
    const max = 10;
    for (let i = 1; i <= max; i++) {
      await stackPage.push(`item-${i}`);
      const msg = await stackPage.getMessage();
      expect(msg.isSuccess).toBe(true);
      expect(msg.text).toBe(`Pushed "item-${i}" onto the stack.`);
    }

    // Stack should contain exactly 10 elements
    const elems = await stackPage.getStackElements();
    expect(elems.length).toBe(10);
    // Now attempt one more push to trigger overflow
    await stackPage.push('overflow-item');

    const overflowMsg = await stackPage.getMessage();
    expect(overflowMsg.isError).toBe(true);
    expect(overflowMsg.text).toBe('Stack Overflow: Max size reached.');

    // Ensure stack still has exactly max items and didn't accept the overflow push
    const elemsAfter = await stackPage.getStackElements();
    expect(elemsAfter.length).toBe(10);
    // Confirm the last element remains the 10th pushed item
    expect(elemsAfter[elemsAfter.length - 1]).toBe('item-10');
  });

  test('Edge case: attempting to push empty string shows validation error', async ({ page }) => {
    // Validate that clicking push with empty input shows a user-friendly error and focuses input
    const stackPage = new StackPage(page);

    // Ensure input is empty and click push
    await stackPage.pushInput.fill('');
    await stackPage.pushBtn.click();

    const msg = await stackPage.getMessage();
    expect(msg.isError).toBe(true);
    expect(msg.text).toBe('Please enter a value to push.');

    // Stack should remain empty
    expect(await stackPage.isStackEmptyPlaceholderVisible()).toBe(true);
  });

  test('DOM and visual cues: stack elements have expected classes and roles (S4 evidence: renderStack and list items)', async ({ page }) => {
    // Validate that rendered stack elements include class and role attributes used as evidence in FSM
    const stackPage = new StackPage(page);

    // Push values
    await stackPage.push('apple');
    await stackPage.push('banana');

    // Each stack element should have class 'stack-element' and role 'listitem'
    const count = await stackPage.stackItem.count();
    expect(count).toBe(2);

    for (let i = 0; i < count; i++) {
      const el = stackPage.stackItem.nth(i);
      const classAttr = await el.getAttribute('class');
      const role = await el.getAttribute('role');
      expect(classAttr).toContain('stack-element');
      expect(role).toBe('listitem');
    }

    // The container has role=list and appropriate aria-label
    const roleAttr = await stackPage.stackDiv.getAttribute('role');
    const ariaLabel = await stackPage.stackDiv.getAttribute('aria-label');
    expect(roleAttr).toBe('list');
    expect(ariaLabel).toBe('Stack elements');
  });
});