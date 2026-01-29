import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63afeeb0-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Circular Linked List demo
class CLLPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputValue');
    this.appendBtn = page.locator('#appendBtn');
    this.prependBtn = page.locator('#prependBtn');
    this.removeBtn = page.locator('#removeBtn');
    this.traverseBtn = page.locator('#traverseBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.listVisual = page.locator('#list-visual');
    this.output = page.locator('#output');
    this.nodeItems = page.locator('#list-visual .node');
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async getVisualText() {
    return (await this.listVisual.textContent())?.trim() ?? '';
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async getNodeValues() {
    const count = await this.nodeItems.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push((await this.nodeItems.nth(i).textContent())?.trim() ?? '');
    }
    return values;
  }

  async fillValue(val) {
    await this.input.fill(String(val));
  }

  async append(val) {
    await this.fillValue(val);
    await this.appendBtn.click();
  }

  async prepend(val) {
    await this.fillValue(val);
    await this.prependBtn.click();
  }

  async remove(val) {
    await this.fillValue(val);
    await this.removeBtn.click();
  }

  async traverse() {
    await this.traverseBtn.click();
  }

  async clear() {
    await this.clearBtn.click();
  }
}

test.describe('Circular Linked List Demo - FSM states & transitions', () => {
  let pageErrors = [];
  let consoleMessages = [];

  // Attach listeners in a fixture-like beforeEach so we capture logs for each test
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];
    page.on('pageerror', (err) => {
      // collect runtime errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      // collect console messages for inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.describe('Initial State (S0_Idle)', () => {
    test('renders initial empty list and calls renderList on enter', async ({ page }) => {
      // Initial render should display "List is empty." per renderList()
      const cll = new CLLPage(page);
      await cll.goto();

      // Verify visual shows empty state
      await expect(cll.listVisual).toBeVisible();
      const visualText = await cll.getVisualText();
      expect(visualText).toMatch(/List is empty\./);

      // There should be no node elements initially
      const nodeCount = await cll.nodeItems.count();
      expect(nodeCount).toBe(0);

      // Output should be initially empty
      const outputText = await cll.getOutputText();
      expect(outputText).toBe('');

      // Ensure no uncaught page errors during initial render
      expect(pageErrors.length, `pageErrors: ${JSON.stringify(pageErrors)}`).toBe(0);
      // Ensure no console.error messages
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length, `consoleErrors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });
  });

  test.describe('AppendNode (S1_NodeAppended) and TraverseList (S5_ListTraversed)', () => {
    test('append a node updates visual and output then traverse shows correct sequence', async ({ page }) => {
      const cll = new CLLPage(page);
      await cll.goto();

      // Append node value "1"
      await cll.append('1');

      // Output should indicate appended node
      await expect(cll.output).toHaveText('Appended node with value: 1');

      // Visual should now contain one node with text "1"
      const nodeValues = await cll.getNodeValues();
      expect(nodeValues).toEqual(['1']);

      // Traverse should display the circular traversal format
      await cll.traverse();
      const traverseOutput = await cll.getOutputText();
      expect(traverseOutput).toContain('Circular Linked List traversal:');
      expect(traverseOutput).toContain('1 → (back to head)');

      // Clean assertions for JS errors
      expect(pageErrors.length, 'No runtime page errors expected after append/traverse').toBe(0);
    });

    test('traverse on empty list shows empty message', async ({ page }) => {
      const cll = new CLLPage(page);
      await cll.goto();

      // Ensure list is empty initially
      await cll.traverse();
      await expect(cll.output).toHaveText('The list is empty.');
    });
  });

  test.describe('PrependNode (S2_NodePrepended)', () => {
    test('prepend works and updates visual order', async ({ page }) => {
      const cll = new CLLPage(page);
      await cll.goto();

      // Append a node then prepend to observe order change
      await cll.append('10');
      await expect(cll.output).toHaveText('Appended node with value: 10');

      // Prepend '5' so order should become 5,10
      await cll.prepend('5');
      await expect(cll.output).toHaveText('Prepended node with value: 5');

      // Visual should show two nodes in order with first being '5'
      const nodeValues = await cll.getNodeValues();
      expect(nodeValues).toEqual(['5', '10']);

      // Traverse confirms ordering in output format
      await cll.traverse();
      const trav = await cll.getOutputText();
      expect(trav).toContain('5 → 10');
      expect(trav).toContain('→ (back to head)');
    });
  });

  test.describe('RemoveNode (S3_NodeRemoved and S4_NodeNotFound)', () => {
    test('remove existing node updates visual and outputs removal', async ({ page }) => {
      const cll = new CLLPage(page);
      await cll.goto();

      // Setup: append two nodes
      await cll.append('a');
      await cll.append('b');
      await expect(cll.getNodeValues()).toEqual(['a', 'b']);

      // Remove node 'a' (head). Expect success message and visual updated to only 'b'
      await cll.remove('a');
      await expect(cll.output).toHaveText('Removed node with value: a');

      const nodeValuesAfter = await cll.getNodeValues();
      expect(nodeValuesAfter).toEqual(['b']);

      // Remove remaining node 'b' (only node). Expect list becomes empty
      await cll.remove('b');
      await expect(cll.output).toHaveText('Removed node with value: b');

      // Visual should show empty message
      const visualText = await cll.getVisualText();
      expect(visualText).toMatch(/List is empty\./);
      expect(await cll.getNodeValues()).toEqual([]);
    });

    test('remove non-existent node prints not found and leaves list unchanged', async ({ page }) => {
      const cll = new CLLPage(page);
      await cll.goto();

      // Append '100' to have some content
      await cll.append('100');
      await expect(cll.getNodeValues()).toEqual(['100']);

      // Attempt to remove '999' which does not exist
      await cll.remove('999');
      await expect(cll.output).toHaveText('Node with value 999 not found.');

      // Visual should remain unchanged (still contains '100')
      const nodeValuesAfter = await cll.getNodeValues();
      expect(nodeValuesAfter).toEqual(['100']);
    });
  });

  test.describe('ClearList (S6_ListCleared)', () => {
    test('clear empties the list and prints cleared message', async ({ page }) => {
      const cll = new CLLPage(page);
      await cll.goto();

      // Add a few nodes
      await cll.append('x');
      await cll.append('y');
      await expect(cll.getNodeValues()).toEqual(['x', 'y']);

      // Clear the list
      await cll.clear();
      await expect(cll.output).toHaveText('List cleared.');

      // Visual should indicate empty list
      const visualText = await cll.getVisualText();
      expect(visualText).toMatch(/List is empty\./);
      expect(await cll.getNodeValues()).toEqual([]);
    });
  });

  test.describe('Edge cases and UI dialogs', () => {
    test('attempting append with empty input triggers alert dialog', async ({ page }) => {
      const cll = new CLLPage(page);
      await cll.goto();

      // Capture dialog message
      let dialogMessage = null;
      page.once('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      // Ensure input is empty and click append
      await cll.input.fill('');
      await cll.appendBtn.click();

      // Dialog must have occurred with expected message
      expect(dialogMessage).toBe('Please enter a node value.');
    });

    test('attempting prepend with empty input triggers alert dialog', async ({ page }) => {
      const cll = new CLLPage(page);
      await cll.goto();

      let dialogMessage = null;
      page.once('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      await cll.input.fill('');
      await cll.prependBtn.click();

      expect(dialogMessage).toBe('Please enter a node value.');
    });

    test('attempting remove with empty input triggers alert dialog', async ({ page }) => {
      const cll = new CLLPage(page);
      await cll.goto();

      let dialogMessage = null;
      page.once('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      await cll.input.fill('');
      await cll.removeBtn.click();

      expect(dialogMessage).toBe('Please enter a node value to remove.');
    });
  });

  test.describe('Runtime and console hygiene checks', () => {
    test('no unhandled runtime page errors or console.error messages during typical usage', async ({ page }) => {
      const cll = new CLLPage(page);
      await cll.goto();

      // Perform a sequence of typical operations
      await cll.append('1');
      await cll.prepend('0');
      await cll.traverse();
      await cll.remove('1');
      await cll.clear();

      // Wait a moment to ensure any async console/page errors propagate
      await page.waitForTimeout(200);

      // Assert that there were no uncaught runtime page errors
      expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

      // Assert that there are no console.error messages
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });
  });
});