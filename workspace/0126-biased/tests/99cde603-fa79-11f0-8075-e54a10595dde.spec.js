import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cde603-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Stack Demo
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputValue');
    this.pushButton = page.locator('#pushButton');
    this.popButton = page.locator('#popButton');
    this.peekButton = page.locator('#peekButton');
    this.isEmptyButton = page.locator('#isEmptyButton');
    this.clearButton = page.locator('#clearButton');
    this.stackDisplay = page.locator('#stackDisplay');
  }

  // Navigate to app and ensure it's loaded
  async goto() {
    await this.page.goto(APP_URL);
    // Ensure basic elements are present
    await expect(this.input).toBeVisible();
    await expect(this.pushButton).toBeVisible();
    await expect(this.popButton).toBeVisible();
    await expect(this.peekButton).toBeVisible();
    await expect(this.isEmptyButton).toBeVisible();
    await expect(this.clearButton).toBeVisible();
    await expect(this.stackDisplay).toBeVisible();
  }

  // Utility to get current displayed stack text
  async getStackText() {
    return (await this.stackDisplay.innerText()).trim();
  }

  // Push a value using UI
  async push(value) {
    await this.input.fill(value);
    await this.pushButton.click();
  }

  // Pop using UI
  async pop() {
    await this.popButton.click();
  }

  // Peek using UI
  async peek() {
    await this.peekButton.click();
  }

  // Is Empty using UI
  async isEmpty() {
    await this.isEmptyButton.click();
  }

  // Clear using UI
  async clear() {
    await this.clearButton.click();
  }
}

test.describe('Stack Interaction Demo (FSM tests)', () => {
  // Collect console messages and page errors for each test to assert on them.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      // store only the important parts to examine later
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test, we assert there are no unexpected runtime exceptions like ReferenceError/SyntaxError/TypeError.
    // The application is expected to run without uncaught page errors for normal behavior.
    // If such errors exist they will be included in pageErrors for debugging.
    // We assert there are no page errors here so any unexpected runtime errors fail the test.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });

  test('Initial state should be Empty Stack and renderStack() should run on load', async ({ page }) => {
    // Validate the onEnter action for S0_Empty (renderStack) by checking the initial DOM text.
    const stack = new StackPage(page);
    await stack.goto();

    // The initial display should show "Stack is empty"
    await expect(stack.stackDisplay).toHaveText('Stack is empty');

    // No console errors should have been emitted during load
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length, `Console errors on load: ${JSON.stringify(errorConsoleEntries)}`).toBe(0);
  });

  test.describe('Push operations (S0_Empty -> S1_NonEmpty and S1_NonEmpty -> S1_NonEmpty)', () => {
    test('Pushing a value transitions from empty to non-empty and updates display', async ({ page }) => {
      const stack = new StackPage(page);
      await stack.goto();

      // Precondition: empty
      expect(await stack.getStackText()).toBe('Stack is empty');

      // Push a value
      await stack.push('A');

      // After pushing, the stack display should show 'A'
      await expect(stack.stackDisplay).toHaveText('A');

      // Push another value => stack should show "A, B" (push pushes to the end)
      await stack.push('B');
      await expect(stack.stackDisplay).toHaveText('A, B');
    });

    test('Pushing empty value should trigger an alert and not change stack', async ({ page }) => {
      const stack = new StackPage(page);
      await stack.goto();

      // Capture alert dialog text
      const dialogs = [];
      page.on('dialog', dialog => {
        dialogs.push(dialog.message());
        dialog.dismiss();
      });

      // Ensure empty initially
      expect(await stack.getStackText()).toBe('Stack is empty');

      // Try to push empty string
      await stack.push(''); // click push with empty input

      // An alert should have been shown asking to enter a value
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length - 1]).toContain('Please enter a value to push.');

      // Stack should remain empty
      expect(await stack.getStackText()).toBe('Stack is empty');
    });
  });

  test.describe('Pop operations (S1_NonEmpty -> S1_NonEmpty and S1_NonEmpty -> S0_Empty and edge cases)', () => {
    test('Pop when non-empty removes top and updates display', async ({ page }) => {
      const stack = new StackPage(page);
      await stack.goto();

      // Prepare stack with two values
      await stack.push('1');
      await stack.push('2');
      await expect(stack.stackDisplay).toHaveText('1, 2');

      // Pop once => removes '2'
      await stack.pop();
      await expect(stack.stackDisplay).toHaveText('1');

      // Pop again => removes '1' and should show empty
      await stack.pop();
      await expect(stack.stackDisplay).toHaveText('Stack is empty');
    });

    test('Pop when empty should alert that stack is already empty and not throw runtime errors', async ({ page }) => {
      const stack = new StackPage(page);
      await stack.goto();

      // Ensure empty
      expect(await stack.getStackText()).toBe('Stack is empty');

      // Capture dialogs
      const dialogs = [];
      page.on('dialog', dialog => {
        dialogs.push(dialog.message());
        dialog.dismiss();
      });

      // Click pop on empty stack
      await stack.pop();

      // Should show alert that stack is already empty
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length - 1]).toContain('Stack is already empty.');

      // No pageerrors should have been raised (checked in afterEach)
    });
  });

  test.describe('Peek and IsEmpty operations (observables without modifying stack)', () => {
    test('Peek on non-empty shows top element and does not mutate stack', async ({ page }) => {
      const stack = new StackPage(page);
      await stack.goto();

      // Prepare stack
      await stack.push('X');
      await stack.push('Y');
      await expect(stack.stackDisplay).toHaveText('X, Y');

      // Capture dialog message
      let lastDialogMessage = null;
      page.once('dialog', dialog => {
        lastDialogMessage = dialog.message();
        dialog.dismiss();
      });

      // Peek should display top element 'Y'
      await stack.peek();
      expect(lastDialogMessage).toBe('Top element: Y');

      // Stack content must remain unchanged after peek
      await expect(stack.stackDisplay).toHaveText('X, Y');
    });

    test('Peek on empty alerts that there is no top element', async ({ page }) => {
      const stack = new StackPage(page);
      await stack.goto();

      // Ensure empty
      expect(await stack.getStackText()).toBe('Stack is empty');

      // Capture dialog
      let message = null;
      page.once('dialog', dialog => {
        message = dialog.message();
        dialog.dismiss();
      });

      // Peek on empty
      await stack.peek();
      expect(message).toContain('Stack is empty. No top element.');
    });

    test('Is Empty? button shows correct message for both states', async ({ page }) => {
      const stack = new StackPage(page);
      await stack.goto();

      // Case: empty
      let msg = null;
      page.once('dialog', dialog => {
        msg = dialog.message();
        dialog.dismiss();
      });
      await stack.isEmpty();
      expect(msg).toBe('Stack is empty.');

      // Case: non-empty
      await stack.push('alpha');
      page.once('dialog', dialog => {
        msg = dialog.message();
        dialog.dismiss();
      });
      await stack.isEmpty();
      expect(msg).toBe('Stack is not empty.');
    });
  });

  test.describe('Clear operation (S1_NonEmpty -> S0_Empty) and related behaviors', () => {
    test('Clear empties the stack and renderStack() updates display', async ({ page }) => {
      const stack = new StackPage(page);
      await stack.goto();

      // Fill stack
      await stack.push('a');
      await stack.push('b');
      await expect(stack.stackDisplay).toHaveText('a, b');

      // Clear
      await stack.clear();

      // After clear, should be empty
      await expect(stack.stackDisplay).toHaveText('Stack is empty');
    });

    test('Clear on empty keeps stack empty and does not trigger alerts', async ({ page }) => {
      const stack = new StackPage(page);
      await stack.goto();

      // Ensure empty
      expect(await stack.getStackText()).toBe('Stack is empty');

      // Monitor dialogs
      const dialogs = [];
      page.on('dialog', dialog => {
        dialogs.push(dialog.message());
        dialog.dismiss();
      });

      // Clear when empty should simply renderStack() and not alert
      await stack.clear();

      // No dialogs should have been shown by clear
      expect(dialogs.length).toBe(0);
      await expect(stack.stackDisplay).toHaveText('Stack is empty');
    });
  });

  test('Comprehensive scenario: push multiple, peek, pop to empty, clear, and edge checks', async ({ page }) => {
    const stack = new StackPage(page);
    await stack.goto();

    // Sequence:
    // push 1,2,3 -> display "1, 2, 3"
    await stack.push('1');
    await stack.push('2');
    await stack.push('3');
    await expect(stack.stackDisplay).toHaveText('1, 2, 3');

    // peek -> "Top element: 3"
    let peekMsg = null;
    page.once('dialog', dialog => { peekMsg = dialog.message(); dialog.dismiss(); });
    await stack.peek();
    expect(peekMsg).toBe('Top element: 3');

    // pop -> removes 3 => "1, 2"
    await stack.pop();
    await expect(stack.stackDisplay).toHaveText('1, 2');

    // pop twice -> remove 2 then 1 => empty
    await stack.pop();
    await stack.pop();
    await expect(stack.stackDisplay).toHaveText('Stack is empty');

    // pop on empty -> alert and still empty
    let popEmptyMsg = null;
    page.once('dialog', dialog => { popEmptyMsg = dialog.message(); dialog.dismiss(); });
    await stack.pop();
    expect(popEmptyMsg).toContain('Stack is already empty.');
    await expect(stack.stackDisplay).toHaveText('Stack is empty');

    // push after empty -> should work
    await stack.push('z');
    await expect(stack.stackDisplay).toHaveText('z');

    // clear -> empty
    await stack.clear();
    await expect(stack.stackDisplay).toHaveText('Stack is empty');
  });
});