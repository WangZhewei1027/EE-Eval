import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3ac832-fa74-11f0-a1b6-4b9b8151441a.html';

// Page object for the stack demo
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      input: '#itemInput',
      pushBtn: 'button[onclick="pushItem()"]',
      popBtn: 'button[onclick="popItem()"]',
      peekBtn: 'button[onclick="peekItem()"]',
      checkEmptyBtn: 'button[onclick="checkEmpty()"]',
      clearBtn: 'button[onclick="clearStack()"]',
      stackVisualization: '#stackVisualization',
      stackItem: '#stackVisualization .stack-item',
      stackEmpty: '#stackVisualization .stack-empty',
      output: '#output'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async fillInput(value) {
    await this.page.fill(this.selectors.input, value);
  }

  async clickPush() {
    await this.page.click(this.selectors.pushBtn);
  }

  async clickPop() {
    await this.page.click(this.selectors.popBtn);
  }

  async clickPeek() {
    await this.page.click(this.selectors.peekBtn);
  }

  async clickCheckEmpty() {
    await this.page.click(this.selectors.checkEmptyBtn);
  }

  async clickClear() {
    await this.page.click(this.selectors.clearBtn);
  }

  async getOutputText() {
    return (await this.page.textContent(this.selectors.output)).trim();
  }

  async getStackItemsText() {
    const items = await this.page.$$eval(this.selectors.stackItem, nodes => nodes.map(n => n.textContent.trim()));
    return items;
  }

  async hasEmptyVisual() {
    return await this.page.$(this.selectors.stackEmpty) !== null;
  }

  async getInputValue() {
    return await this.page.$eval(this.selectors.input, el => el.value);
  }

  async waitForVisualizationUpdate() {
    // The app uses a small transition. Wait a tiny bit for DOM updates.
    await this.page.waitForTimeout(50);
  }
}

test.describe('Stack Data Structure Demo - de3ac832-fa74-11f0-a1b6-4b9b8151441a', () => {
  let pageErrors;
  let consoleErrors;

  // Set up listeners before each test to capture runtime errors and console error messages
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions on the page (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // Capture console.error messages emitted by the page
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  // After each test ensure no unexpected page errors or console errors happened
  test.afterEach(async () => {
    // We assert that there are no uncaught runtime/page errors or console.error outputs.
    // If these arrays are non-empty, the test will fail and show the captured errors.
    expect(pageErrors, 'No uncaught page errors should be thrown').toEqual([]);
    expect(consoleErrors, 'No console.error messages should be emitted').toEqual([]);
  });

  test.describe('Visual States (FSM states S0_Empty and S1_NonEmpty)', () => {
    test('Initial state: S0_Empty - visualization shows "(stack is empty)" and default output', async ({ page }) => {
      const stack = new StackPage(page);
      await stack.goto();

      // Validate the visualization shows empty state (entry action: updateVisualization())
      const hasEmpty = await stack.hasEmptyVisual();
      expect(hasEmpty).toBe(true);

      // Validate output area initial content
      const output = await stack.getOutputText();
      expect(output).toMatch(/Operation results will appear here/i);

      // Ensure there are no stack items
      const items1 = await stack.getStackItemsText();
      expect(items.length).toBe(0);
    });

    test('After pushing an item: S1_NonEmpty - visualization contains stack-item element', async ({ page }) => {
      const stack1 = new StackPage(page);
      await stack.goto();

      // Push a single item to move from S0_Empty -> S1_NonEmpty
      await stack.fillInput('alpha');
      await stack.clickPush();
      await stack.waitForVisualizationUpdate();

      // Output should reflect the push action
      const output1 = await stack.getOutputText();
      expect(output).toBe('Pushed: alpha');

      // Visualization should now contain one stack-item (entry action updateVisualization)
      const items2 = await stack.getStackItemsText();
      expect(items).toEqual(['alpha']);

      // The empty visual should be gone
      const hasEmpty1 = await stack.hasEmptyVisual();
      expect(hasEmpty).toBe(false);

      // Input should be cleared after push
      const inputVal = await stack.getInputValue();
      expect(inputVal).toBe('');
    });
  });

  test.describe('Operations & Transitions (Push, Pop, Peek, CheckEmpty, ClearStack)', () => {
    test('Push multiple items, Peek shows top without modifying stack, Pop removes top (S1_NonEmpty transitions)', async ({ page }) => {
      const stack2 = new StackPage(page);
      await stack.goto();

      // Push first item
      await stack.fillInput('first');
      await stack.clickPush();
      await stack.waitForVisualizationUpdate();
      expect(await stack.getOutputText()).toBe('Pushed: first');

      // Push second item -> becomes the top
      await stack.fillInput('second');
      await stack.clickPush();
      await stack.waitForVisualizationUpdate();
      expect(await stack.getOutputText()).toBe('Pushed: second');

      // Visualization should show top-first (reverse order)
      const itemsAfterPush = await stack.getStackItemsText();
      // Because the visualization uses reverse order, top item should be 'second'
      expect(itemsAfterPush[0]).toBe('second');
      expect(itemsAfterPush[1]).toBe('first');

      // Peek - should not remove the top item
      await stack.clickPeek();
      await stack.waitForVisualizationUpdate();
      const peekOutput = await stack.getOutputText();
      expect(peekOutput).toBe('Top item: second');

      // Ensure visualization is unchanged after peek
      const itemsAfterPeek = await stack.getStackItemsText();
      expect(itemsAfterPeek).toEqual(itemsAfterPush);

      // Pop - should remove the top (second)
      await stack.clickPop();
      await stack.waitForVisualizationUpdate();
      const popOutput = await stack.getOutputText();
      expect(popOutput).toBe('Popped: second');

      // Now only 'first' should remain
      const itemsAfterPop = await stack.getStackItemsText();
      expect(itemsAfterPop).toEqual(['first']);

      // Pop again - remove 'first' -> should transition back to S0_Empty
      await stack.clickPop();
      await stack.waitForVisualizationUpdate();
      expect(await stack.getOutputText()).toBe('Popped: first');

      // Visualization should show empty state again
      const hasEmpty2 = await stack.hasEmptyVisual();
      expect(hasEmpty).toBe(true);
      const itemsFinally = await stack.getStackItemsText();
      expect(itemsFinally.length).toBe(0);
    });

    test('CheckEmpty behaves correctly for empty and non-empty stacks', async ({ page }) => {
      const stack3 = new StackPage(page);
      await stack.goto();

      // Ensure empty -> CheckEmpty should indicate empty
      await stack.clickCheckEmpty();
      expect(await stack.getOutputText()).toBe('Stack is empty');

      // Push two items
      await stack.fillInput('one');
      await stack.clickPush();
      await stack.waitForVisualizationUpdate();
      await stack.fillInput('two');
      await stack.clickPush();
      await stack.waitForVisualizationUpdate();

      // CheckEmpty should indicate non-empty with count
      await stack.clickCheckEmpty();
      const out = await stack.getOutputText();
      expect(out).toMatch(/Stack is not empty \(\d+ items\)/);
      // Verify the count matches actual items (should be 2)
      expect(out).toContain('(2 items)');
    });

    test('ClearStack empties the stack and updates visualization/output (S1_NonEmpty -> S0_Empty)', async ({ page }) => {
      const stack4 = new StackPage(page);
      await stack.goto();

      // Push items to ensure non-empty
      await stack.fillInput('a');
      await stack.clickPush();
      await stack.waitForVisualizationUpdate();
      await stack.fillInput('b');
      await stack.clickPush();
      await stack.waitForVisualizationUpdate();

      // Clear the stack
      await stack.clickClear();
      await stack.waitForVisualizationUpdate();

      // Output indicates cleared
      expect(await stack.getOutputText()).toBe('Stack cleared');

      // Visualization shows empty state
      expect(await stack.hasEmptyVisual()).toBe(true);
      expect(await stack.getStackItemsText()).toEqual([]);
    });
  });

  test.describe('Edge Cases & Error Scenarios', () => {
    test('Trying to push with empty input yields an informative message and does not change visualization', async ({ page }) => {
      const stack5 = new StackPage(page);
      await stack.goto();

      // Ensure empty initial state
      expect(await stack.hasEmptyVisual()).toBe(true);

      // Click Push with empty input
      await stack.fillInput('   '); // whitespace only should be trimmed to empty
      await stack.clickPush();
      await stack.waitForVisualizationUpdate();

      // Expect an instructional message
      expect(await stack.getOutputText()).toBe('Please enter a value to push');

      // Visualization remains empty
      expect(await stack.hasEmptyVisual()).toBe(true);
      expect(await stack.getStackItemsText()).toEqual([]);
    });

    test('Popping from an empty stack yields proper error message and remains empty', async ({ page }) => {
      const stack6 = new StackPage(page);
      await stack.goto();

      // Ensure stack is empty
      expect(await stack.hasEmptyVisual()).toBe(true);

      // Click Pop on empty stack
      await stack.clickPop();
      await stack.waitForVisualizationUpdate();

      expect(await stack.getOutputText()).toBe('Stack is empty - cannot pop');
      expect(await stack.hasEmptyVisual()).toBe(true);
    });

    test('Peeking into an empty stack yields proper message and does not modify visualization', async ({ page }) => {
      const stack7 = new StackPage(page);
      await stack.goto();

      // Ensure stack is empty
      expect(await stack.hasEmptyVisual()).toBe(true);

      // Click Peek on empty stack
      await stack.clickPeek();
      await stack.waitForVisualizationUpdate();

      expect(await stack.getOutputText()).toBe('Stack is empty - nothing to peek');
      expect(await stack.hasEmptyVisual()).toBe(true);
    });
  });

  test.describe('Console and Runtime Error Observability', () => {
    test('No uncaught runtime exceptions or console.error logs should occur during normal use', async ({ page }) => {
      const stack8 = new StackPage(page);
      await stack.goto();

      // Perform a sequence of normal operations
      await stack.fillInput('x');
      await stack.clickPush();
      await stack.waitForVisualizationUpdate();

      await stack.fillInput('y');
      await stack.clickPush();
      await stack.waitForVisualizationUpdate();

      await stack.clickPeek();
      await stack.clickPop();
      await stack.waitForVisualizationUpdate();

      await stack.clickCheckEmpty();
      await stack.clickClear();
      await stack.waitForVisualizationUpdate();

      // This test relies on afterEach to assert that pageErrors and consoleErrors are empty.
      // We still do a local verification here to provide clearer failure messages inside the test.
      // NOTE: The arrays pageErrors and consoleErrors are asserted to be empty in afterEach.
      expect(Array.isArray(pageErrors)).toBe(true);
      expect(Array.isArray(consoleErrors)).toBe(true);
    });
  });
});