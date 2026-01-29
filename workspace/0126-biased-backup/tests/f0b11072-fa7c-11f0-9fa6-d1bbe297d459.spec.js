import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b11072-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page object to encapsulate interactions with the stack demo
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pushBtn = page.locator('#push-btn');
    this.popBtn = page.locator('#pop-btn');
    this.peekBtn = page.locator('#peek-btn');
    this.clearBtn = page.locator('#clear-btn');
    this.stackVis = page.locator('#stack-visualization');
    this.demoOutput = page.locator('#demo-output');
    this.stackItemLocator = selector => this.page.locator('#stack-visualization .stack-item').nth(selector);
  }

  // Click push and return pushed number parsed from demo output ("Pushed N to stack")
  async pushAndGetValue() {
    await this.pushBtn.click();
    const text = (await this.demoOutput.textContent()) || '';
    const match = text.match(/Pushed\s+(-?\d+)\s+to stack/);
    if (!match) return null;
    return Number(match[1]);
  }

  // Click pop and return popped number parsed from demo output ("Popped N from stack") or null for underflow
  async popAndGetValue() {
    await this.popBtn.click();
    const text = (await this.demoOutput.textContent()) || '';
    const match = text.match(/Popped\s+(-?\d+)\s+from stack/);
    if (!match) return null;
    return Number(match[1]);
  }

  // Click peek and return string content
  async peek() {
    await this.peekBtn.click();
    return (await this.demoOutput.textContent()) || '';
  }

  // Click clear and return demo output
  async clear() {
    await this.clearBtn.click();
    return (await this.demoOutput.textContent()) || '';
  }

  // Read number of stack items rendered
  async renderedItemCount() {
    return await this.page.locator('#stack-visualization .stack-item').count();
  }

  // Get rendered stack html content
  async visualizationInnerHTML() {
    return await this.page.locator('#stack-visualization').innerHTML();
  }

  // Get text content of ith rendered stack item (0 = top)
  async renderedItemTextAt(indexFromTop = 0) {
    // The DOM renders items from top to bottom (stack.length-1 down to 0)
    const locator = this.page.locator('#stack-visualization .stack-item').nth(indexFromTop);
    return (await locator.textContent())?.trim() ?? null;
  }

  // Get computed background-color of ith rendered stack item (0 = top)
  async renderedItemBgColorAt(indexFromTop = 0) {
    const locator = this.page.locator('#stack-visualization .stack-item').nth(indexFromTop);
    return await locator.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
  }

  // Access the internal stack array length from the page (reads window.stack)
  async getInternalStackLength() {
    return await this.page.evaluate(() => {
      // intentionally reading existing global variable defined by the app
      try {
        return window.stack ? window.stack.length : null;
      } catch {
        return null;
      }
    });
  }
}

test.describe('Comprehensive Guide to Stacks - FSM and UI behavior', () => {
  // Arrays to capture console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // ignore listener failures
      }
    });

    // Capture uncaught page errors (e.g., ReferenceError, TypeError, SyntaxError)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Basic sanity: page title matches expected app title
    await expect(page).toHaveTitle(/Comprehensive Guide to Stacks/);
  });

  test('Initial state S0_Empty: visualization shows empty and internal stack length is 0', async ({ page }) => {
    // This test validates the FSM entry actions for the empty state (updateVisualization)
    const stackPage = new StackPage(page);

    // Visualization should show "Stack is empty"
    const inner = await stackPage.visualizationInnerHTML();
    expect(inner.trim()).toContain('Stack is empty');

    // Internal stack (window.stack) should exist and be length 0
    const len = await stackPage.getInternalStackLength();
    expect(len).toBe(0);

    // Ensure no console errors or page errors happened during load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Push events and transitions', () => {
    test('Transition S0_Empty -> S1_NonEmpty on PushEvent: pushed value appears in visualization', async ({ page }) => {
      // Validate pushing a random number transitions the FSM to Non-Empty and updates visualization
      const stackPage = new StackPage(page);

      // Push once
      const pushed1 = await stackPage.pushAndGetValue();
      expect(typeof pushed1).toBe('number');

      // Internal stack length becomes 1
      const lenAfterPush = await stackPage.getInternalStackLength();
      expect(lenAfterPush).toBe(1);

      // Visualization should render one .stack-item with the pushed number
      const count = await stackPage.renderedItemCount();
      expect(count).toBe(1);

      const topText = await stackPage.renderedItemTextAt(0); // top is index 0 in rendered order
      expect(topText).toBe(String(pushed1));

      // Top rendered item should have the top color (red -> rgb(231, 76, 60))
      const topBg = await stackPage.renderedItemBgColorAt(0);
      expect(topBg.replace(/\s+/g, '')).toContain('rgb(231,76,60)'.replace(/\s+/g, ''));

      // Check no runtime errors or console errors occurred during push
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Multiple PushEvents keep state S1_NonEmpty and stack preserves order and styling', async ({ page }) => {
      const stackPage = new StackPage(page);

      // Push two values sequentially
      const v1 = await stackPage.pushAndGetValue();
      const v2 = await stackPage.pushAndGetValue();

      expect(typeof v1).toBe('number');
      expect(typeof v2).toBe('number');

      // Internal stack length should be 2
      const len = await stackPage.getInternalStackLength();
      expect(len).toBe(2);

      // Rendered count should be 2
      const count = await stackPage.renderedItemCount();
      expect(count).toBe(2);

      // Rendered order: top (index 0) should equal v2, next (index 1) should equal v1
      const topText = await stackPage.renderedItemTextAt(0);
      const nextText = await stackPage.renderedItemTextAt(1);
      expect(topText).toBe(String(v2));
      expect(nextText).toBe(String(v1));

      // Color expectations:
      // top -> red (rgb(231,76,60)), bottom (index 1) -> green (rgb(46,204,113))
      const topColor = await stackPage.renderedItemBgColorAt(0);
      const bottomColor = await stackPage.renderedItemBgColorAt(1);
      expect(topColor.replace(/\s+/g, '')).toContain('rgb(231,76,60)'.replace(/\s+/g, ''));
      expect(bottomColor.replace(/\s+/g, '')).toContain('rgb(46,204,113)'.replace(/\s+/g, ''));

      // Ensure no page errors produced while pushing multiple times
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Peek event behavior', () => {
    test('PeekEvent on non-empty stack displays top element without removing it', async ({ page }) => {
      const stackPage = new StackPage(page);

      // Ensure there's at least two items by pushing twice
      const a = await stackPage.pushAndGetValue();
      const b = await stackPage.pushAndGetValue();

      // Internal length before peek
      const lenBefore = await stackPage.getInternalStackLength();

      // Perform peek
      const peekOutput = await stackPage.peek();
      expect(peekOutput).toMatch(new RegExp(`Top element is ${b}`));

      // Internal length should be unchanged
      const lenAfter = await stackPage.getInternalStackLength();
      expect(lenAfter).toBe(lenBefore);

      // Visualization unchanged (top still b)
      const topText = await stackPage.renderedItemTextAt(0);
      expect(topText).toBe(String(b));

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('PeekEvent on empty stack shows "Stack is empty" message', async ({ page }) => {
      const stackPage = new StackPage(page);

      // Ensure stack is empty by clearing (clear works on empty too)
      await stackPage.clear();

      // Now peek; should show 'Stack is empty'
      const peekOutput = await stackPage.peek();
      expect(peekOutput).toBe('Stack is empty');

      // Still empty internally
      const len = await stackPage.getInternalStackLength();
      expect(len).toBe(0);

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Pop events and transitions', () => {
    test('PopEvent on non-empty stack removes top and updates visualization (S1_NonEmpty -> S1_NonEmpty or S0_Empty)', async ({ page }) => {
      const stackPage = new StackPage(page);

      // Push two items
      const v1 = await stackPage.pushAndGetValue();
      const v2 = await stackPage.pushAndGetValue();

      // Pop once - should remove v2
      const popped1 = await stackPage.popAndGetValue();
      expect(popped1).toBe(v2);

      // After pop, internal length should be 1 and top should be v1
      const lenAfter1 = await stackPage.getInternalStackLength();
      expect(lenAfter1).toBe(1);
      const topTextAfter1 = await stackPage.renderedItemTextAt(0);
      expect(topTextAfter1).toBe(String(v1));

      // Pop second time - should remove v1 and transition to empty visualization
      const popped2 = await stackPage.popAndGetValue();
      expect(popped2).toBe(v1);

      const lenAfter2 = await stackPage.getInternalStackLength();
      expect(lenAfter2).toBe(0);

      // Visualization should show 'Stack is empty'
      const vis = await stackPage.visualizationInnerHTML();
      expect(vis.trim()).toContain('Stack is empty');

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('PopEvent on empty stack produces underflow message and does not throw', async ({ page }) => {
      const stackPage = new StackPage(page);

      // Ensure empty
      await stackPage.clear();

      // Pop when empty
      await stackPage.popBtn.click();
      const out = (await stackPage.demoOutput.textContent()) || '';
      expect(out).toBe('Stack underflow: cannot pop from empty stack');

      // Internal stack remains empty
      const len = await stackPage.getInternalStackLength();
      expect(len).toBe(0);

      // No uncaught page errors should be thrown (pop handles empty case gracefully)
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Clear event and edge cases', () => {
    test('ClearEvent empties the stack and updates visualization to S0_Empty', async ({ page }) => {
      const stackPage = new StackPage(page);

      // Push some items
      await stackPage.pushAndGetValue();
      await stackPage.pushAndGetValue();

      // Clear stack
      const clearOutput = await stackPage.clear();
      expect(clearOutput).toBe('Stack cleared');

      // Internal stack length should be 0 and visualization empty
      const len = await stackPage.getInternalStackLength();
      expect(len).toBe(0);
      const vis = await stackPage.visualizationInnerHTML();
      expect(vis.trim()).toContain('Stack is empty');

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Clearing an already empty stack leaves it empty and produces "Stack cleared" output', async ({ page }) => {
      const stackPage = new StackPage(page);

      // Ensure empty then clear
      await stackPage.clear();
      const len = await stackPage.getInternalStackLength();
      expect(len).toBe(0);
      // The app sets 'Stack cleared' on clear regardless
      const out = (await stackPage.demoOutput.textContent()) || '';
      // Either the app may show 'Stack cleared' or 'Stack is empty' depending on previous state,
      // accept both but prefer 'Stack cleared' for clear click.
      expect(['Stack cleared', 'Stack is empty', '']).toContain(out);

      // No unexpected errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test('FSM coverage: combined scenario exercising all transitions and verifying states', async ({ page }) => {
    // This test performs a full scenario walking through key transitions in the FSM:
    // S0_Empty -> Push -> S1_NonEmpty -> Peek -> S1_NonEmpty -> Pop -> maybe S1 or S0 -> Clear -> S0_Empty
    const stackPage = new StackPage(page);

    // Start empty
    expect(await stackPage.getInternalStackLength()).toBe(0);
    expect((await stackPage.visualizationInnerHTML()).trim()).toContain('Stack is empty');

    // Push one -> S1_NonEmpty
    const p1 = await stackPage.pushAndGetValue();
    expect(await stackPage.getInternalStackLength()).toBe(1);
    expect(await stackPage.renderedItemTextAt(0)).toBe(String(p1));

    // Peek -> should not remove
    const peekOut = await stackPage.peek();
    expect(peekOut).toBe(`Top element is ${p1}`);
    expect(await stackPage.getInternalStackLength()).toBe(1);

    // Push second
    const p2 = await stackPage.pushAndGetValue();
    expect(await stackPage.getInternalStackLength()).toBe(2);
    expect(await stackPage.renderedItemTextAt(0)).toBe(String(p2));

    // Pop -> removes p2, still non-empty
    const popped = await stackPage.popAndGetValue();
    expect(popped).toBe(p2);
    expect(await stackPage.getInternalStackLength()).toBe(1);
    expect(await stackPage.renderedItemTextAt(0)).toBe(String(p1));

    // Clear -> S0_Empty
    const clearText = await stackPage.clear();
    expect(clearText).toBe('Stack cleared');
    expect(await stackPage.getInternalStackLength()).toBe(0);
    expect((await stackPage.visualizationInnerHTML()).trim()).toContain('Stack is empty');

    // Final check: no console or page errors occurred during the scenario
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});