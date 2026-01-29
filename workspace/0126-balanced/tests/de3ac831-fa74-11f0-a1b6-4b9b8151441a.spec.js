import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3ac831-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Circular Linked List Visualization - FSM tests (de3ac831-fa74-11f0-a1b6-4b9b8151441a)', () => {
  // Arrays to capture console error messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  // A small page object to encapsulate interactions with the demo UI
  class CLLPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
      this.page = page;
      this.input = '#nodeValue';
      this.visualization = '#visualization';
      this.output = '#output';
      this.btnInsertEnd = "button[onclick='insertAtEnd()']";
      this.btnInsertStart = "button[onclick='insertAtStart()']";
      this.btnDelete = "button[onclick='deleteNode()']";
      this.btnTraverse = "button[onclick='traverse()']";
      this.btnClear = "button[onclick='clearList()']";
    }

    async fillValue(value) {
      await this.page.fill(this.input, String(value));
    }

    async clearInput() {
      await this.page.fill(this.input, '');
    }

    async clickInsertEnd() {
      await this.page.click(this.btnInsertEnd);
    }

    async clickInsertStart() {
      await this.page.click(this.btnInsertStart);
    }

    async clickDelete() {
      await this.page.click(this.btnDelete);
    }

    async clickTraverse() {
      await this.page.click(this.btnTraverse);
    }

    async clickClear() {
      await this.page.click(this.btnClear);
    }

    async getVisualizationText() {
      return this.page.locator(this.visualization).innerText();
    }

    async getOutputText() {
      return this.page.locator(this.output).innerText();
    }

    // returns array of node texts in DOM order
    async getNodeValues() {
      const nodes = this.page.locator(`${this.visualization} .node`);
      const count = await nodes.count();
      const values = [];
      for (let i = 0; i < count; i++) {
        values.push(await nodes.nth(i).innerText());
      }
      return values;
    }

    // wait for any .node.highlight to appear (used to validate traversal animation)
    async waitForAnyHighlight(timeout = 6000) {
      return this.page.waitForSelector(`${this.visualization} .node.highlight`, { timeout });
    }

    // wait until no nodes have highlight class
    async waitForHighlightsCleared(timeout = 8000) {
      await this.page.waitForFunction(() => {
        const vis = document.getElementById('visualization');
        if (!vis) return true;
        return vis.querySelectorAll('.node.highlight').length === 0;
      }, null, { timeout });
    }

    // helper to get the tail->head info element text appended by visualize()
    async getInfoText() {
      // The info element created by visualize() is the last child of visualization
      return this.page.locator(`${this.visualization} > div:last-child`).innerText();
    }

    // helper to read the global cll object on the page (not modifying it)
    async getCllSize() {
      return this.page.evaluate(() => {
        // If cll is not defined, return null
        // This is only a read, not a modification.
        // We allow potential ReferenceError to surface naturally if cll is undefined.
        // The test harness will observe page errors and console messages.
        // eslint-disable-next-line no-undef
        return typeof cll !== 'undefined' ? cll.size : null;
      });
    }
  }

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture all console messages for examination
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', (err) => {
      // capture any uncaught exceptions on the page
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test ensure there were no unexpected page errors or console 'error' messages.
    // We assert zero page errors and zero console messages of type 'error'.
    // This validates that runtime ReferenceError/SyntaxError/TypeError did not occur unexpectedly.
    expect(pageErrors.length, `Expected no page errors, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages, got: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
  });

  test('Initial state S0_Idle: visualize() called on load and shows empty list', async ({ page }) => {
    // Validate that the initial state visualizes an empty list (entry action visualize())
    const po = new CLLPage(page);

    const visText = await po.getVisualizationText();
    // The visualization should indicate the list is empty
    expect(visText).toContain('List is empty');

    // The global cll should exist and have size 0 (evidence from FSM)
    const size = await po.getCllSize();
    expect(size).toBe(0);
  });

  test('Insert at End (InsertAtEnd) from Idle transitions to List Not Empty (S1_ListNotEmpty) and visualizes node', async ({ page }) => {
    // Validate inserting at end creates a node and updates visualization and internal size
    const po1 = new CLLPage(page);

    // Insert value 10 at end
    await po.fillValue(10);
    await po.clickInsertEnd();

    // Expect a node with text '10' to appear
    const nodeValues = await po.getNodeValues();
    expect(nodeValues.length).toBeGreaterThanOrEqual(1);
    expect(nodeValues).toContain('10');

    // Expect the info text to show tail/head pointing to the same value for single node
    const info = await po.getInfoText();
    expect(info).toContain('Tail (10) points back to Head (10)');

    // Check cll.size incremented to 1
    const size1 = await po.getCllSize();
    expect(size).toBe(1);
  });

  test('Insert at Start (InsertAtStart) from Idle transitions to List Not Empty and places node at head', async ({ page }) => {
    // Validate insert at start works when list is empty and when non-empty
    const po2 = new CLLPage(page);

    // Insert 5 at start (from empty)
    await po.fillValue(5);
    await po.clickInsertStart();

    // There should be a node with value 5 and size 1
    let nodeValues1 = await po.getNodeValues();
    expect(nodeValues.length).toBe(1);
    expect(nodeValues[0]).toBe('5');

    let size2 = await po.getCllSize();
    expect(size).toBe(1);

    // Insert at end 7, then insert at start 3 to verify head changes
    await po.fillValue(7);
    await po.clickInsertEnd();

    await po.fillValue(3);
    await po.clickInsertStart();

    nodeValues = await po.getNodeValues();
    // After inserting start 3, head should be 3 followed by the previous nodes
    expect(nodeValues[0]).toBe('3');
    expect(nodeValues).toContain('5');
    expect(nodeValues).toContain('7');

    size = await po.getCllSize();
    expect(size).toBe(3);
  });

  test('Traverse event highlights nodes and outputs traversal text (Traverse) for non-empty list', async ({ page }) => {
    // Validate traversal prints output and triggers highlightTraversal animation
    const po3 = new CLLPage(page);

    // Build a small list: 1 -> 2 -> 3
    await po.fillValue(1);
    await po.clickInsertEnd();
    await po.fillValue(2);
    await po.clickInsertEnd();
    await po.fillValue(3);
    await po.clickInsertEnd();

    const size3 = await po.getCllSize();
    expect(size).toBe(3);

    // Start traversal
    await po.clickTraverse();

    // The output should contain the traversal text
    const out = await po.getOutputText();
    expect(out).toContain('Traversing the list:');
    expect(out).toContain('(back to head)');

    // The highlight animation uses an 800ms interval. Wait for at least one highlighted node.
    await po.waitForAnyHighlight(6000);

    // After the full animation, highlights should be cleared. Wait accordingly:
    // highlightTraversal stops after (size + 1) * 800 ms plus cleanup; give a generous timeout.
    await po.waitForHighlightsCleared(8000);

    // Assert no nodes remain highlighted
    const highlighted = await page.locator('#visualization .node.highlight').count();
    expect(highlighted).toBe(0);
  });

  test('Delete existing node (DeleteNode) updates visualization and outputs deletion message', async ({ page }) => {
    // Validate deleting a node when present works and reduces list size
    const po4 = new CLLPage(page);

    // Build a list: 10 -> 20 -> 30
    await po.fillValue(10);
    await po.clickInsertEnd();
    await po.fillValue(20);
    await po.clickInsertEnd();
    await po.fillValue(30);
    await po.clickInsertEnd();

    let nodeValues2 = await po.getNodeValues();
    expect(nodeValues).toEqual(['10', '20', '30']);

    // Delete middle node 20
    await po.fillValue(20);
    await po.clickDelete();

    // Output should report the deletion
    const out1 = await po.getOutputText();
    expect(out).toContain('Deleted node with value 20');

    // Visualization should no longer contain '20'
    nodeValues = await po.getNodeValues();
    expect(nodeValues).toEqual(['10', '30']);

    // Size should have decreased (from 3 to 2)
    const size4 = await po.getCllSize();
    expect(size).toBe(2);
  });

  test('Delete non-existent node and delete with no input (edge cases)', async ({ page }) => {
    // Validate proper messages when deleting a non-existent value and when input is invalid
    const po5 = new CLLPage(page);

    // Ensure list is empty first by clicking clear
    await po.clickClear();
    // Visualization should indicate empty
    const visText1 = await po.getVisualizationText();
    expect(visText).toContain('List is empty');

    // 1) Delete with no input should prompt user to enter a valid number
    await po.clearInput();
    await po.clickDelete();

    let out2 = await po.getOutputText();
    expect(out).toContain('Please enter a valid number');

    // 2) Insert a value and attempt to delete a non-existent value
    await po.fillValue(42);
    await po.clickInsertEnd();

    // Attempt to delete a different value that does not exist
    await po.fillValue(999);
    await po.clickDelete();

    out = await po.getOutputText();
    expect(out).toContain('Value 999 not found in the list');
  });

  test('ClearList event clears the list (transition S1_ListNotEmpty -> S2_ListEmpty) and visualizes empty state', async ({ page }) => {
    // Validate clearList sets head/tail to null and size to 0 and updates visualization and output
    const po6 = new CLLPage(page);

    // Build a small list
    await po.fillValue(11);
    await po.clickInsertEnd();
    await po.fillValue(22);
    await po.clickInsertEnd();

    let size5 = await po.getCllSize();
    expect(size).toBe(2);

    // Click clear list
    await po.clickClear();

    // Visualization should now show 'List is empty'
    const visText2 = await po.getVisualizationText();
    expect(visText).toContain('List is empty');

    // Output should indicate list cleared
    const out3 = await po.getOutputText();
    expect(out).toContain('List cleared');

    // Internal size should be zero
    size = await po.getCllSize();
    expect(size).toBe(0);
  });

  test('Traverse on empty list outputs "List is empty" (edge case)', async ({ page }) => {
    // Validate traverse behavior on an empty list
    const po7 = new CLLPage(page);

    // Ensure empty
    await po.clickClear();

    // Click traverse when empty
    await po.clickTraverse();

    const out4 = await po.getOutputText();
    expect(out).toContain('List is empty');
  });

  test('Comprehensive scenario: build, traverse, delete head/tail, clear to cover multiple transitions', async ({ page }) => {
    // A combined test to exercise several FSM transitions in sequence
    const po8 = new CLLPage(page);

    // Start fresh
    await po.clickClear();

    // Insert at end: 1, 2, 3
    await po.fillValue(1);
    await po.clickInsertEnd();
    await po.fillValue(2);
    await po.clickInsertEnd();
    await po.fillValue(3);
    await po.clickInsertEnd();

    let nodeValues3 = await po.getNodeValues();
    expect(nodeValues).toEqual(['1', '2', '3']);

    // Delete head (value 1)
    await po.fillValue(1);
    await po.clickDelete();
    expect((await po.getOutputText())).toContain('Deleted node with value 1');
    nodeValues = await po.getNodeValues();
    expect(nodeValues).toEqual(['2', '3']);

    // Delete tail (value 3)
    await po.fillValue(3);
    await po.clickDelete();
    expect((await po.getOutputText())).toContain('Deleted node with value 3');
    nodeValues = await po.getNodeValues();
    expect(nodeValues).toEqual(['2']);

    // Traverse single-node list and ensure traversal output and highlight appear
    await po.clickTraverse();
    expect((await po.getOutputText())).toContain('Traversing the list:');
    await po.waitForAnyHighlight(5000);
    await po.waitForHighlightsCleared(6000);

    // Finally, clear list and ensure empty state
    await po.clickClear();
    expect((await po.getVisualizationText())).toContain('List is empty');
    expect((await po.getOutputText())).toContain('List cleared');
    expect(await po.getCllSize()).toBe(0);
  });
});