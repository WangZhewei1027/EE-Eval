import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ce8241-fa79-11f0-8075-e54a10595dde.html';

/**
 * Page Object for the Max Heap demo page.
 * Encapsulates common interactions and queries to keep tests readable.
 */
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.valueInput = page.locator('#value-input');
    this.insertButton = page.locator('#insert-button');
    this.removeButton = page.locator('#remove-button');
    this.peekButton = page.locator('#peek-button');
    this.heapDisplay = page.locator('#heap-display');
    this.maxValue = page.locator('#max-value');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async insertValue(value) {
    // Fill and click insert; value is a number or string representation of a number.
    await this.valueInput.fill(String(value));
    await this.insertButton.click();
  }

  async clickRemoveAndHandleDialog(assertionCallback) {
    // Click remove and wait for alert dialog. Accept it after validating message.
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.removeButton.click(),
    ]);
    try {
      assertionCallback(dialog.message());
    } finally {
      await dialog.accept();
    }
  }

  async clickPeekAndHandleDialog(assertionCallback) {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.peekButton.click(),
    ]);
    try {
      assertionCallback(dialog.message());
    } finally {
      await dialog.accept();
    }
  }

  async getHeapNodesText() {
    // Returns array of Node ... strings
    const nodes = await this.heapDisplay.locator('.heap-node').allTextContents();
    // trim whitespace
    return nodes.map(n => n.trim()).filter(n => n.length > 0);
  }

  async getMaxValueText() {
    return (await this.maxValue.innerText()).trim();
  }

  async getInputValue() {
    return (await this.valueInput.inputValue()).trim();
  }
}

test.describe('Max Heap Demonstration (FSM tests) - 99ce8241-fa79-11f0-8075-e54a10595dde', () => {
  // Collect console errors and page errors to assert that no runtime exceptions happened.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture unhandled page errors (e.g., ReferenceError, TypeError)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app page.
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Ensure we don't leak dialogs or other state; close page to be safe.
    try {
      await page.close();
    } catch (e) {
      // ignore
    }
  });

  test('Initial state S0_Idle: renders controls and initial displays (renderPage entry action)', async ({ page }) => {
    // This test validates initial rendering (S0_Idle). Checks that input, buttons,
    // heap display, and max-value placeholders are present and have expected initial content.
    const heap = new HeapPage(page);

    // Elements should be present
    await expect(heap.valueInput).toBeVisible();
    await expect(heap.insertButton).toBeVisible();
    await expect(heap.removeButton).toBeVisible();
    await expect(heap.peekButton).toBeVisible();
    await expect(heap.heapDisplay).toBeVisible();
    await expect(heap.maxValue).toBeVisible();

    // Initial heap display should be empty
    const nodes = await heap.getHeapNodesText();
    expect(nodes.length).toBe(0);

    // Initial max-value display should indicate empty heap
    const maxText = await heap.getMaxValueText();
    expect(maxText).toBe('Heap is empty');

    // No runtime console errors or page errors should have occurred on initial render
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test.describe('InsertValue event and S1_ValueInserted state', () => {
    test('Inserting a single value updates display and clears input (S0 -> S1)', async ({ page }) => {
      // Validates that insert triggers updateDisplay (entry action of S1) and input is cleared.
      const heap = new HeapPage(page);

      await heap.insertValue(42);

      // Heap display should show Node 0: 42
      const nodes = await heap.getHeapNodesText();
      expect(nodes).toContain('Node 0: 42');

      // Max value should show 42
      const maxText = await heap.getMaxValueText();
      expect(maxText).toBe('42');

      // Input should be cleared after successful insert (transition back to Idle clears input)
      const inputVal = await heap.getInputValue();
      expect(inputVal).toBe('');

      // No console or page errors introduced by inserting
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Multiple inserts maintain max-heap property: highest element at root', async ({ page }) => {
      // Insert values [5, 3, 8, 1] and assert the root (Node 0) is the max (8).
      const heap = new HeapPage(page);

      await heap.insertValue(5);
      await heap.insertValue(3);
      await heap.insertValue(8);
      await heap.insertValue(1);

      const nodes = await heap.getHeapNodesText();
      // Root must be 8
      expect(nodes.length).toBeGreaterThanOrEqual(1);
      expect(nodes[0]).toMatch(/Node 0:\s*8/);

      // Max value display should reflect 8
      const maxText = await heap.getMaxValueText();
      expect(maxText).toBe('8');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Inserting a non-number or empty input does not change the heap (edge case)', async ({ page }) => {
      // Attempt to insert when input is empty or invalid; the implementation parses Int and checks isNaN.
      const heap = new HeapPage(page);

      // Ensure heap empty
      const initialNodes = await heap.getHeapNodesText();
      expect(initialNodes.length).toBe(0);

      // Fill with empty string and click insert
      await heap.valueInput.fill('');
      await heap.insertButton.click();

      // No nodes should have been added
      const nodesAfter = await heap.getHeapNodesText();
      expect(nodesAfter.length).toBe(0);

      // Now try to fill with text via JS (type=number prevents some invalid input), but we'll still call click with no valid numeric value
      await heap.valueInput.fill('   ');
      await heap.insertButton.click();

      // Still no change
      const nodesAfter2 = await heap.getHeapNodesText();
      expect(nodesAfter2.length).toBe(0);

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Insert negative and zero values are accepted and considered in max selection', async ({ page }) => {
      const heap = new HeapPage(page);

      await heap.insertValue(-10);
      await heap.insertValue(0);
      await heap.insertValue(-5);

      const nodes = await heap.getHeapNodesText();
      // Root should be the max among [-10, 0, -5] -> 0
      expect(nodes[0]).toMatch(/Node 0:\s*0/);

      const maxText = await heap.getMaxValueText();
      expect(maxText).toBe('0');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('RemoveMax event and S2_MaxRemoved state', () => {
    test('Removing from non-empty heap shows alert with removed value and updates display', async ({ page }) => {
      // Insert some values, remove max, and ensure alert shows the removed max and display updates.
      const heap = new HeapPage(page);

      // Prepare heap: values 7, 20, 5 -> max 20
      await heap.insertValue(7);
      await heap.insertValue(20);
      await heap.insertValue(5);

      // Confirm current max is 20
      expect(await heap.getMaxValueText()).toBe('20');

      // Click remove and inspect alert
      await heap.clickRemoveAndHandleDialog((message) => {
        expect(message).toBe('Removed Max: 20');
      });

      // After removal, max should be the next highest (7)
      const newMax = await heap.getMaxValueText();
      // It could be 7 or 5 depending on heap reordering, but must not be 20
      expect(newMax).not.toBe('20');
      // New heap should not include 20 in any node text
      const nodes = await heap.getHeapNodesText();
      const any20 = nodes.some(n => /20/.test(n));
      expect(any20).toBe(false);

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Removing from empty heap shows "Heap is empty" alert (edge case)', async ({ page }) => {
      const heap = new HeapPage(page);

      // Ensure heap is empty
      const nodes = await heap.getHeapNodesText();
      if (nodes.length !== 0) {
        // If previous tests left state (shouldn't in proper isolation), clear by removing until empty
        // But do not patch runtime; just attempt removals until empty.
        while ((await heap.getHeapNodesText()).length > 0) {
          await heap.clickRemoveAndHandleDialog(() => {});
        }
      }

      // Now click remove on empty heap
      await heap.clickRemoveAndHandleDialog((message) => {
        expect(message).toBe('Heap is empty');
      });

      // Heap remains empty
      const nodesAfter = await heap.getHeapNodesText();
      expect(nodesAfter.length).toBe(0);

      // Max value display remains 'Heap is empty'
      expect(await heap.getMaxValueText()).toBe('Heap is empty');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('PeekMax event and S3_PeekedMax state', () => {
    test('Peeking shows an alert with the current max without modifying the heap', async ({ page }) => {
      const heap = new HeapPage(page);

      // Build heap
      await heap.insertValue(2);
      await heap.insertValue(15);
      await heap.insertValue(9);

      // Current max should be 15
      expect(await heap.getMaxValueText()).toBe('15');

      const beforeNodes = await heap.getHeapNodesText();

      // Click peek and assert alert shows max and heap remains unchanged
      await heap.clickPeekAndHandleDialog((message) => {
        expect(message).toBe('Max Value: 15');
      });

      const afterNodes = await heap.getHeapNodesText();
      expect(afterNodes).toEqual(beforeNodes); // heap nodes should not have changed

      // Max value display still 15
      expect(await heap.getMaxValueText()).toBe('15');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Peek on empty heap shows "Heap is empty" alert (edge case)', async ({ page }) => {
      const heap = new HeapPage(page);

      // Ensure empty: remove until empty
      let nodes = await heap.getHeapNodesText();
      while (nodes.length > 0) {
        await heap.clickRemoveAndHandleDialog(() => {});
        nodes = await heap.getHeapNodesText();
      }

      // Peek now
      await heap.clickPeekAndHandleDialog((message) => {
        expect(message).toBe('Heap is empty');
      });

      // No changes
      expect(await heap.getHeapNodesText()).toEqual([]);
      expect(await heap.getMaxValueText()).toBe('Heap is empty');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test('Runtime monitoring: ensure no ReferenceError, SyntaxError or TypeError occurred during interactions', async ({ page }) => {
    // This test explicitly inspects collected pageErrors and console errors for typical runtime exceptions.
    // Note: We let errors happen naturally; here we assert none of those exceptions were thrown.
    // Collect a few interactions to surface potential errors
    const heap = new HeapPage(page);

    // Do variety of interactions
    await heap.insertValue(11);
    await heap.insertValue(22);
    await heap.clickPeekAndHandleDialog((message) => {
      expect(/Max Value:/.test(message)).toBeTruthy();
    });
    await heap.clickRemoveAndHandleDialog((message) => {
      expect(/Removed Max:/.test(message) || message === 'Heap is empty').toBeTruthy();
    });

    // Now assert on captured errors
    // No uncaught page errors
    expect(pageErrors.length).toBe(0);

    // No console errors and none of them contain ReferenceError/TypeError/SyntaxError substrings
    expect(consoleErrors.length).toBe(0);
    for (const err of consoleErrors) {
      const text = err.text || '';
      expect(text).not.toContain('ReferenceError');
      expect(text).not.toContain('TypeError');
      expect(text).not.toContain('SyntaxError');
    }
  });
});