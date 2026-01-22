import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f17fb9d1-d366-11f0-9b19-a558354ece3e.html';

// Page Object for interacting with the Stack app
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#elementInput');
    this.pushBtn = page.locator('.push-btn');
    this.popBtn = page.locator('.pop-btn');
    this.clearBtn = page.locator('text=Clear Stack');
    this.peekBtn = page.locator('text=Peek Top');
    this.message = page.locator('#message');
    this.stack = page.locator('#stack');
    this.stackElements = page.locator('.stack-element');
    this.emptyStackMsg = page.locator('#emptyStackMsg');
    this.stackSize = page.locator('#stackSize');
    this.stackCapacity = page.locator('#stackCapacity');
    this.isEmpty = page.locator('#isEmpty');
    this.topElement = page.locator('#topElement');
  }

  // Navigate to the app
  async goto() {
    await this.page.goto(APP_URL);
    // Ensure initial render is ready
    await expect(this.stack).toBeVisible();
  }

  // Helper to push a value via UI (fills input then clicks push)
  async push(value) {
    await this.input.fill(value);
    await this.pushBtn.click();
    // Wait for message to be visible (showMessage sets display: 'block')
    await expect(this.message).toBeVisible();
  }

  // Push using Enter key (simulate Enter keypress)
  async pushWithEnter(value) {
    await this.input.fill(value);
    await this.input.press('Enter');
    await expect(this.message).toBeVisible();
  }

  // Click pop
  async pop() {
    await this.popBtn.click();
    await expect(this.message).toBeVisible();
  }

  // Click peek
  async peek() {
    await this.peekBtn.click();
    await expect(this.message).toBeVisible();
  }

  // Click clear
  async clear() {
    await this.clearBtn.click();
    await expect(this.message).toBeVisible();
  }

  // Read current message text and type (success/error)
  async getMessage() {
    const text = (await this.message.textContent())?.trim() ?? '';
    const classes = (await this.message.getAttribute('class')) || '';
    const type = classes.includes('success') ? 'success' : classes.includes('error') ? 'error' : 'unknown';
    return { text, type };
  }

  // Wait for message to hide (showMessage uses setTimeout to hide after 3s)
  async waitForMessageHidden(timeout = 4500) {
    await expect(this.message).toBeHidden({ timeout });
  }

  // Stack info helpers
  async getStackSize() {
    const txt = (await this.stackSize.textContent()) || '0';
    return Number(txt.trim());
  }

  async getStackCapacity() {
    const txt = (await this.stackCapacity.textContent()) || '0';
    return Number(txt.trim());
  }

  async getIsEmptyText() {
    return (await this.isEmpty.textContent())?.trim() ?? '';
  }

  async getTopElementText() {
    return (await this.topElement.textContent())?.trim() ?? '';
  }

  async getStackElementsTexts() {
    const count = await this.stackElements.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(((await this.stackElements.nth(i).textContent()) || '').trim());
    }
    return texts;
  }

  // Get inline style attribute of first stack element (top)
  async getFirstStackElementStyleAttr() {
    if ((await this.stackElements.count()) === 0) return '';
    return (await this.stackElements.first().getAttribute('style')) || '';
  }
}

test.describe('Stack Data Structure Visualization - FSM validation', () => {
  // Arrays to capture console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Enable capturing console errors and page errors for later assertions.
    page.context()._consoleErrors = [];
    page.context()._pageErrors = [];

    page.on('console', msg => {
      // capture console.error messages
      if (msg.type() === 'error') {
        page.context()._consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    page.on('pageerror', err => {
      page.context()._pageErrors.push(err);
    });
  });

  test.describe('Initialization and Idle state (S0_Idle)', () => {
    test('Initial UI shows empty stack and correct info', async ({ page }) => {
      // Validate initial idle state: size 0, capacity 10, empty label Yes, top element None, empty stack message visible
      const app = new StackPage(page);
      await app.goto();

      // Comments: verifying updateStackInfo() was run on entry of S0_Idle by checking displayed info
      await expect(app.stackSize).toHaveText('0');
      await expect(app.stackCapacity).toHaveText('10');
      await expect(app.isEmpty).toHaveText('Yes');
      await expect(app.topElement).toHaveText('None');

      // Visual: empty stack message should be visible and no .stack-element nodes present
      await expect(app.emptyStackMsg).toBeVisible();
      await expect(app.stack.locator('.stack-element')).toHaveCount(0);
    });
  });

  test.describe('Push (PushElement) transitions and edge cases', () => {
    test('Push a single element transitions to ElementPushed (S1_ElementPushed)', async ({ page }) => {
      // Validate pushing element updates visual stack, info panel, and shows success message
      const app = new StackPage(page);
      await app.goto();

      await app.push('A');

      const msg = await app.getMessage();
      expect(msg.type).toBe('success');
      expect(msg.text).toBe('Pushed "A" to the stack');

      // Info panel updates
      await expect(app.stackSize).toHaveText('1');
      await expect(app.isEmpty).toHaveText('No');
      await expect(app.topElement).toHaveText('A');

      // Visual stack shows the element
      const elems = await app.getStackElementsTexts();
      expect(elems.length).toBe(1);
      expect(elems[0]).toBe('A');

      // The top element should have inline style background = '#48bb78' set by updateStackDisplay()
      const styleAttr = await app.getFirstStackElementStyleAttr();
      expect(styleAttr).toContain('#48bb78');

      // Message hides after its timeout
      await app.waitForMessageHidden();
    });

    test('Push with empty input triggers Error state (S5_Error)', async ({ page }) => {
      // Validate pushing with empty input shows error message and does not change stack
      const app = new StackPage(page);
      await app.goto();

      // Ensure input is empty
      await app.input.fill('');
      await app.pushBtn.click();

      const msg = await app.getMessage();
      expect(msg.type).toBe('error');
      expect(msg.text).toBe('Please enter a value to push');

      // No change in size or top element
      await expect(app.stackSize).toHaveText('0');
      await expect(app.topElement).toHaveText('None');

      await app.waitForMessageHidden();
    });

    test('Push via Enter key works and follows same transition as PushElement', async ({ page }) => {
      // Validate Enter key press triggers push (EnterKeyPress event -> S1_ElementPushed)
      const app = new StackPage(page);
      await app.goto();

      await app.pushWithEnter('B');

      const msg = await app.getMessage();
      expect(msg.type).toBe('success');
      expect(msg.text).toBe('Pushed "B" to the stack');

      await expect(app.stackSize).toHaveText('1');
      await expect(app.topElement).toHaveText('B');

      await app.waitForMessageHidden();
    });

    test('Pushing beyond capacity triggers Stack overflow error', async ({ page }) => {
      // Validate guard for overflow: after capacity elements, next push leads to error S5_Error
      const app = new StackPage(page);
      await app.goto();

      // Push up to capacity (10)
      for (let i = 0; i < 10; i++) {
        await app.push(`v${i}`);
        // allow message to hide to keep DOM consistent
        await app.waitForMessageHidden();
      }

      // Verify capacity reached
      await expect(app.stackSize).toHaveText('10');

      // Attempt one more push -> error expected
      await app.push('overflow');
      const msg = await app.getMessage();
      expect(msg.type).toBe('error');
      expect(msg.text).toBe('Stack overflow! Cannot push more elements');

      // Ensure size is still 10
      await expect(app.stackSize).toHaveText('10');

      await app.waitForMessageHidden();
    }, 30000); // allow extra time for multiple pushes
  });

  test.describe('Pop (PopElement) transitions and guards', () => {
    test('Pop an element from non-empty stack transitions to ElementPopped (S2_ElementPopped)', async ({ page }) => {
      // Push, then pop and assert pop behavior and UI updates
      const app = new StackPage(page);
      await app.goto();

      await app.push('C');
      await app.waitForMessageHidden();

      // Now pop
      await app.pop();

      const msg = await app.getMessage();
      expect(msg.type).toBe('success');
      expect(msg.text).toBe('Popped "C" from the stack');

      // Stack should be empty again
      await expect(app.stackSize).toHaveText('0');
      await expect(app.topElement).toHaveText('None');
      await expect(app.emptyStackMsg).toBeVisible();

      await app.waitForMessageHidden();
    });

    test('Pop from empty stack triggers underflow error (S5_Error)', async ({ page }) => {
      // Validate guard when stack is empty
      const app = new StackPage(page);
      await app.goto();

      // Ensure empty
      await expect(app.stackSize).toHaveText('0');

      // Click pop
      await app.pop();

      const msg = await app.getMessage();
      expect(msg.type).toBe('error');
      expect(msg.text).toBe('Stack underflow! Cannot pop from empty stack');

      await app.waitForMessageHidden();
    });
  });

  test.describe('Peek (PeekElement) transitions and guards', () => {
    test('Peek top element when non-empty transitions to StackPeeked (S4_StackPeeked)', async ({ page }) => {
      // Push multiple items then peek and verify message tells top element
      const app = new StackPage(page);
      await app.goto();

      await app.push('X');
      await app.waitForMessageHidden();
      await app.push('Y');
      await app.waitForMessageHidden();

      // Current top is Y
      await app.peek();
      const msg = await app.getMessage();
      expect(msg.type).toBe('success');
      expect(msg.text).toBe('Top element is "Y"');

      // Ensure no stack size change after peek
      await expect(app.stackSize).toHaveText('2');

      await app.waitForMessageHidden();
    });

    test('Peek on empty stack triggers error (S5_Error)', async ({ page }) => {
      // Validate guard when stack is empty
      const app = new StackPage(page);
      await app.goto();

      // Ensure empty
      await expect(app.stackSize).toHaveText('0');

      // Click peek
      await app.peek();

      const msg = await app.getMessage();
      expect(msg.type).toBe('error');
      expect(msg.text).toBe('Stack is empty!');

      await app.waitForMessageHidden();
    });
  });

  test.describe('Clear (ClearStack) transitions and guards', () => {
    test('Clear non-empty stack transitions to StackCleared (S3_StackCleared)', async ({ page }) => {
      // Push several items, clear, and verify UI reset and success message
      const app = new StackPage(page);
      await app.goto();

      await app.push('1');
      await app.waitForMessageHidden();
      await app.push('2');
      await app.waitForMessageHidden();

      // Clear
      await app.clear();

      const msg = await app.getMessage();
      expect(msg.type).toBe('success');
      expect(msg.text).toBe('Stack cleared');

      // Info panel updated to empty
      await expect(app.stackSize).toHaveText('0');
      await expect(app.topElement).toHaveText('None');
      await expect(app.emptyStackMsg).toBeVisible();

      await app.waitForMessageHidden();
    });

    test('Clear when already empty triggers error (S5_Error)', async ({ page }) => {
      // Validate guard when clearing an already empty stack
      const app = new StackPage(page);
      await app.goto();

      // Ensure empty
      await expect(app.stackSize).toHaveText('0');

      // Click clear
      await app.clear();

      const msg = await app.getMessage();
      expect(msg.type).toBe('error');
      expect(msg.text).toBe('Stack is already empty');

      await app.waitForMessageHidden();
    });
  });

  test('No unexpected runtime console or page errors during interactions', async ({ page }) => {
    // This test loads the app and runs a set of interactions while capturing console/page errors.
    // It asserts that no uncaught runtime errors occurred (ReferenceError/SyntaxError/TypeError etc).
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const app = new StackPage(page);
    await app.goto();

    // Perform a sequence of typical interactions
    await app.push('alpha');
    await app.waitForMessageHidden();

    await app.push('beta');
    await app.waitForMessageHidden();

    await app.peek();
    await app.waitForMessageHidden();

    await app.pop();
    await app.waitForMessageHidden();

    await app.clear();
    await app.waitForMessageHidden();

    // Assert that no console.error or uncaught page errors were observed
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});