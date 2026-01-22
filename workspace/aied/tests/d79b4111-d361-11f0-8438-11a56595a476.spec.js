import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79b4111-d361-11f0-8438-11a56595a476.html';

// Page Object encapsulating interactions and queries for the Stack app
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      stackContainer: '#stackContainer',
      pushInput: '#pushInput',
      pushBtn: '#pushBtn',
      popBtn: '#popBtn',
      peekBtn: '#peekBtn',
      clearBtn: '#clearBtn',
      message: '#message',
      stackElement: '.stack-element',
      emptyMsg: '#stackContainer > div' // The empty message is the lone div in container when empty
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait a tick for initial renderStack to run
    await this.page.waitForTimeout(50);
  }

  async pushValue(value) {
    const { page, selectors } = this;
    await page.fill(selectors.pushInput, value);
    await page.click(selectors.pushBtn);
    // Wait for DOM update
    await page.waitForTimeout(50);
  }

  async pushValueByEnter(value) {
    const { page, selectors } = this;
    await page.fill(selectors.pushInput, value);
    await page.focus(selectors.pushInput);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);
  }

  async clickPop() {
    await this.page.click(this.selectors.popBtn);
    await this.page.waitForTimeout(50);
  }

  async clickPeek() {
    await this.page.click(this.selectors.peekBtn);
    await this.page.waitForTimeout(50);
  }

  async clickClear() {
    await this.page.click(this.selectors.clearBtn);
    await this.page.waitForTimeout(50);
  }

  async getMessageText() {
    return (await this.page.locator(this.selectors.message).innerText()).trim();
  }

  async getStackElementsText() {
    const elems = this.page.locator(this.selectors.stackElement);
    const count = await elems.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await elems.nth(i).innerText()).trim());
    }
    return texts;
  }

  async getStackElementCount() {
    return await this.page.locator(this.selectors.stackElement).count();
  }

  async hasEmptyMessage() {
    // When stack is empty, renderStack inserts a single div with text "(Stack is empty)"
    const container = this.page.locator(this.selectors.stackContainer);
    const childCount = await container.locator('> *').count();
    if (childCount === 0) return false;
    const text = (await container.locator('> *').nth(0).innerText()).trim();
    return text === '(Stack is empty)';
  }

  async topElementHasLabelTop() {
    // The top element should have a child with class label-top and text 'Top'
    const elems = this.page.locator(this.selectors.stackElement);
    const count = await elems.count();
    if (count === 0) return false;
    const topElem = elems.nth(count - 1);
    const label = topElem.locator('.label-top');
    return (await label.count()) > 0 && (await label.innerText()).trim() === 'Top';
  }
}

test.describe('Stack Data Structure Visualization - FSM validation', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error and runtime page errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      // pageerror is for unhandled exceptions
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Assert that the page emitted no console errors or runtime page errors during the test.
    // This helps detect ReferenceError/SyntaxError/TypeError that may bubble to console or page.
    expect(consoleErrors, `Expected no console.error calls, but found: ${JSON.stringify(consoleErrors, null, 2)}`).toHaveLength(0);
    expect(pageErrors, `Expected no page errors, but found: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
  });

  test.describe('Initial State (S0_Empty)', () => {
    test('renders empty stack message and initial visual state', async ({ page }) => {
      // Verifies S0_Empty: stack.length === 0 and "(Stack is empty)" displayed
      const app = new StackPage(page);
      await app.goto();

      // The message area should be empty initially
      const initialMessage = await app.getMessageText();
      expect(initialMessage).toBe('');

      // The stack should show the empty message
      const hasEmpty = await app.hasEmptyMessage();
      expect(hasEmpty).toBeTruthy();

      // There should be zero stack elements with class stack-element
      const elemCount = await app.getStackElementCount();
      expect(elemCount).toBe(0);
    });
  });

  test.describe('Push operations (Push event and PushEnter)', () => {
    test('Push from empty transitions to Non-Empty and renders pushed element (S0 -> S1)', async ({ page }) => {
      // Verifies transition from S0_Empty to S1_NonEmpty via click on pushBtn
      const app = new StackPage(page);
      await app.goto();

      await app.pushValue('A');

      // Message should reflect push
      const msg = await app.getMessageText();
      expect(msg).toBe('Pushed "A" onto the stack.');

      // Now a stack-element should exist
      const texts = await app.getStackElementsText();
      expect(texts.length).toBe(1);
      // The top element's visible text should contain 'A' and include the 'Top' label as a child,
      // but the innerText of the element will include both value and the 'Top' label.
      expect(texts[0]).toContain('A');
      // Confirm top label presence (visual indicator)
      const hasTopLabel = await app.topElementHasLabelTop();
      expect(hasTopLabel).toBeTruthy();
    });

    test('Push on Non-Empty appends element to the stack', async ({ page }) => {
      // Verifies pushing again from S1_NonEmpty stays S1_NonEmpty with increased size
      const app = new StackPage(page);
      await app.goto();

      // Add two values sequentially
      await app.pushValue('first');
      await app.pushValue('second');

      const count = await app.getStackElementCount();
      expect(count).toBe(2);

      const texts = await app.getStackElementsText();
      // Order in DOM: bottom first (index 0) then top last (index count-1)
      expect(texts[0]).toContain('first');
      expect(texts[1]).toContain('second');

      // Message should reflect last push
      const msg = await app.getMessageText();
      expect(msg).toBe('Pushed "second" onto the stack.');
    });

    test('Push via Enter key works (PushEnter event)', async ({ page }) => {
      // Verifies pushInput keydown Enter triggers push()
      const app = new StackPage(page);
      await app.goto();

      await app.pushValueByEnter('enterValue');

      const count = await app.getStackElementCount();
      expect(count).toBe(1);

      const msg = await app.getMessageText();
      expect(msg).toBe('Pushed "enterValue" onto the stack.');
    });
  });

  test.describe('Pop operations (Pop event)', () => {
    test('Pop on Non-Empty removes top element and stays in Non-Empty until empty', async ({ page }) => {
      // Verifies pop removes top element and message shows popped value
      const app = new StackPage(page);
      await app.goto();

      await app.pushValue('one');
      await app.pushValue('two');
      // Now pop -> should remove 'two'
      await app.clickPop();

      let count = await app.getStackElementCount();
      expect(count).toBe(1);

      let msg = await app.getMessageText();
      expect(msg).toBe('Popped "two" from the stack.');

      // Pop again -> should remove 'one' and transition back to empty state
      await app.clickPop();

      count = await app.getStackElementCount();
      expect(count).toBe(0);

      // Check that empty message is displayed again
      const isEmpty = await app.hasEmptyMessage();
      expect(isEmpty).toBeTruthy();

      msg = await app.getMessageText();
      expect(msg).toBe('Popped "one" from the stack.');
    });

    test('Pop on Empty shows underflow message and stays Empty (S0_Empty -> S0_Empty)', async ({ page }) => {
      // Verifies pop() on empty shows 'Stack Underflow - nothing to pop!'
      const app = new StackPage(page);
      await app.goto();

      // Ensure empty initially
      const initialEmpty = await app.hasEmptyMessage();
      expect(initialEmpty).toBeTruthy();

      await app.clickPop();

      const msg = await app.getMessageText();
      expect(msg).toBe('Stack Underflow - nothing to pop!');

      // Still empty
      const count = await app.getStackElementCount();
      expect(count).toBe(0);
    });
  });

  test.describe('Peek operations (Peek event)', () => {
    test('Peek on Non-Empty shows top value without modifying stack', async ({ page }) => {
      // Verifies peek() reports top but does not remove it
      const app = new StackPage(page);
      await app.goto();

      await app.pushValue('alpha');
      await app.pushValue('beta');

      const beforeCount = await app.getStackElementCount();
      expect(beforeCount).toBe(2);

      await app.clickPeek();

      const msg = await app.getMessageText();
      expect(msg).toBe('Top of the stack: "beta"');

      const afterCount = await app.getStackElementCount();
      expect(afterCount).toBe(2); // unchanged
    });

    test('Peek on Empty shows appropriate message and does not crash (S0_Empty -> S0_Empty)', async ({ page }) => {
      // Verifies peek() on empty shows 'Stack is empty - nothing to peek.'
      const app = new StackPage(page);
      await app.goto();

      await app.clickPeek();

      const msg = await app.getMessageText();
      expect(msg).toBe('Stack is empty - nothing to peek.');

      const count = await app.getStackElementCount();
      expect(count).toBe(0);
    });
  });

  test.describe('Clear stack operation (ClearStack event)', () => {
    test('Clear removes all elements and shows cleared message (S1_NonEmpty -> S0_Empty)', async ({ page }) => {
      // Verifies clearStack() empties the stack and calls renderStack()
      const app = new StackPage(page);
      await app.goto();

      await app.pushValue('x');
      await app.pushValue('y');
      const before = await app.getStackElementCount();
      expect(before).toBe(2);

      await app.clickClear();

      const msg = await app.getMessageText();
      expect(msg).toBe('Stack cleared.');

      const isEmpty = await app.hasEmptyMessage();
      expect(isEmpty).toBeTruthy();

      const after = await app.getStackElementCount();
      expect(after).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Pushing empty or whitespace-only value is rejected with helpful message', async ({ page }) => {
      // Verifies push() prevents pushing empty values and shows instruction
      const app = new StackPage(page);
      await app.goto();

      // Attempt push with empty string
      await app.pushValue('');

      let msg = await app.getMessageText();
      expect(msg).toBe('Please enter a value to push.');

      // Attempt push with only spaces
      await app.pushValue('   ');

      msg = await app.getMessageText();
      expect(msg).toBe('Please enter a value to push.');

      // Still empty stack
      const count = await app.getStackElementCount();
      expect(count).toBe(0);
    });

    test('Visual indicators: top label exists only on top element', async ({ page }) => {
      // Verifies that only the top element has the label 'Top'
      const app = new StackPage(page);
      await app.goto();

      await app.pushValue('bottomVal');
      await app.pushValue('middleVal');
      await app.pushValue('topVal');

      const texts = await app.getStackElementsText();
      expect(texts.length).toBe(3);

      // Only the topmost element should have label-top. We check that top element has label.
      const topHasLabel = await app.topElementHasLabelTop();
      expect(topHasLabel).toBeTruthy();

      // Also ensure that lower elements don't have a '.label-top' inside
      const elems = page.locator('.stack-element');
      const lowerElemHasLabel = await elems.nth(0).locator('.label-top').count();
      expect(lowerElemHasLabel).toBe(0);
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('no ReferenceError/SyntaxError/TypeError in console or page during normal operations', async ({ page }) => {
      // This test performs a sequence of operations and relies on beforeEach/afterEach assertions
      // to ensure no console.error or page errors were emitted. It duplicates a typical user flow.
      const app = new StackPage(page);
      await app.goto();

      // Typical sequence
      await app.pushValue('1');
      await app.pushValue('2');
      await app.clickPeek();
      await app.clickPop();
      await app.clickClear();

      // Additional wait to give the page a chance to emit errors if any
      await page.waitForTimeout(100);

      // The afterEach will check consoleErrors and pageErrors arrays are empty.
      // To make this test more explicit, also directly assert message states after operations.
      const msg = await app.getMessageText();
      expect(msg).toBe('Stack cleared.');
      const isEmpty = await app.hasEmptyMessage();
      expect(isEmpty).toBeTruthy();
    });
  });
});