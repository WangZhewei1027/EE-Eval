import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8c6a21-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for interacting with the Doubly Linked List visualization page
class DoublyLinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.listSelector = '#doublyLinkedList';
    this.nodeSelector = '.node';
    this.arrowSelector = '.arrow';
    this.addButtonSelector = '.button[onclick="addNode()"], .button';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getNodeCount() {
    return await this.page.locator(this.nodeSelector).count();
  }

  async getArrowCount() {
    return await this.page.locator(this.arrowSelector).count();
  }

  async getNodeTexts() {
    return await this.page.locator(this.nodeSelector).allTextContents();
  }

  async clickAddButton() {
    await this.page.click(this.addButtonSelector);
  }

  async callAddNodeDirectly() {
    // call the global addNode() if present
    return await this.page.evaluate(() => {
      // call addNode if defined; allow it to throw naturally if missing
      // we don't patch or define addNode here
      // Return boolean whether function existed and was called
      if (typeof window.addNode === 'function') {
        window.addNode();
        return true;
      }
      return false;
    });
  }

  async getListChildrenTagNames() {
    return await this.page.evaluate((selector) => {
      const list = document.querySelector(selector);
      if (!list) return [];
      return Array.from(list.children).map((el) => el.tagName.toLowerCase() + (el.className ? `.${el.className}` : ''));
    }, this.listSelector);
  }

  async appendTextNodeToList(text = 'TEXT_NODE') {
    return await this.page.evaluate((selector, text) => {
      const list = document.querySelector(selector);
      if (!list) return false;
      const tn = document.createTextNode(text);
      list.appendChild(tn);
      return true;
    }, this.listSelector, text);
  }

  async getGlobalNodeCountVariable() {
    return await this.page.evaluate(() => {
      // Read the global nodeCount variable if present
      // We do not define it here; just read it if it exists
      return typeof window.nodeCount !== 'undefined' ? window.nodeCount : null;
    });
  }
}

test.describe('Doubly Linked List Visualization - FSM validation', () => {
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors for console and page errors for each test
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions from the page
      pageErrors.push(err);
    });
  });

  test.describe('State S0_Idle - initial checks', () => {
    test('Initial idle state shows Add Node button and three nodes', async ({ page }) => {
      const app = new DoublyLinkedListPage(page);
      await app.goto();

      // Validate Add Node button exists and is visible
      const addBtn = page.locator(app.addButtonSelector);
      await expect(addBtn).toBeVisible();

      // Validate initial nodes count is 3 as per HTML implementation
      const nodeCount = await app.getNodeCount();
      expect(nodeCount).toBe(3);

      // Validate the initial node texts are Node 1, Node 2, Node 3
      const texts = await app.getNodeTexts();
      expect(texts).toEqual(['Node 1', 'Node 2', 'Node 3']);

      // Validate that arrow elements exist (there are two arrows in the initial markup)
      const arrowCount = await app.getArrowCount();
      expect(arrowCount).toBeGreaterThanOrEqual(2);

      // Ensure no page errors (uncaught exceptions) happened during load
      expect(pageErrors.length).toBe(0);

      // Ensure no console.error messages were emitted during load
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transition AddNode: S0_Idle -> S1_NodeAdded', () => {
    test('Clicking Add Node appends a new node with proper arrow before it', async ({ page }) => {
      const app = new DoublyLinkedListPage(page);
      await app.goto();

      // Pre-checks
      const beforeNodes = await app.getNodeCount();
      expect(beforeNodes).toBe(3);
      const beforeArrows = await app.getArrowCount();

      // Click the Add Node button (this is the FSM event)
      await app.clickAddButton();

      // After clicking, we expect a new node to be present
      await expect(page.locator(app.nodeSelector)).toHaveCount(beforeNodes + 1);

      const afterNodeCount = await app.getNodeCount();
      expect(afterNodeCount).toBe(4);

      // The last node should have text "Node 4"
      const texts = await app.getNodeTexts();
      expect(texts[texts.length - 1]).toBe('Node 4');

      // An arrow should have been appended before the new node only if the previous lastChild was a node
      const afterArrows = await app.getArrowCount();
      // The implementation appends an arrow when lastChild.className === "node".
      // Given the initial markup, that condition is true, so expect arrow count to have increased by 1.
      expect(afterArrows).toBeGreaterThanOrEqual(beforeArrows + 1);

      // Validate structure: the last child of the list should be a node element
      const children = await app.getListChildrenTagNames();
      expect(children[children.length - 1].startsWith('div')).toBeTruthy();
      expect(children[children.length - 1].includes('node')).toBeTruthy();

      // Ensure no uncaught page errors from this interaction
      expect(pageErrors.length).toBe(0);

      // Ensure no console.error messages were emitted during the add
      expect(consoleErrors.length).toBe(0);
    });

    test('Calling addNode() directly (onEnter simulation) adds a node', async ({ page }) => {
      const app = new DoublyLinkedListPage(page);
      await app.goto();

      const before = await app.getNodeCount();
      // Directly call the global addNode() function if it exists (simulates onEnter addNode())
      const called = await app.callAddNodeDirectly();
      expect(called).toBe(true); // function should exist as per implementation

      await expect(page.locator(app.nodeSelector)).toHaveCount(before + 1);
      const lastText = (await app.getNodeTexts()).pop();
      expect(lastText).toContain('Node');

      // Verify the global nodeCount variable incremented (if present)
      const globalNodeCount = await app.getGlobalNodeCountVariable();
      expect(typeof globalNodeCount).toBe('number');
      expect(globalNodeCount).toBeGreaterThanOrEqual(before + 1);

      // No page errors should be present
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Adding when lastChild is a text node does not throw and appends node (edge case)', async ({ page }) => {
      const app = new DoublyLinkedListPage(page);
      await app.goto();

      // Append a text node to the list to simulate whitespace/text node as lastChild
      const appended = await app.appendTextNodeToList('FORCE_TEXT_NODE');
      expect(appended).toBe(true);

      // Ensure last child is now a text node by inspecting children
      const childrenBefore = await page.evaluate((sel) => {
        const list = document.querySelector(sel);
        return Array.from(list.childNodes).map((n) => n.nodeType);
      }, app.listSelector);
      // NodeType 3 => Text Node
      expect(childrenBefore[childrenBefore.length - 1]).toBe(3);

      const nodeCountBefore = await app.getNodeCount();
      const arrowCountBefore = await app.getArrowCount();

      // Click Add Node - implementation will attempt to access lastChild.className
      // Accessing className on a text node yields undefined (no exception) in browsers.
      await app.clickAddButton();

      // Node count must have increased by 1
      await expect(page.locator(app.nodeSelector)).toHaveCount(nodeCountBefore + 1);

      // Arrow count should remain the same because lastChild.className === "node" was false
      const arrowCountAfter = await app.getArrowCount();
      expect(arrowCountAfter).toBe(arrowCountBefore);

      // Ensure no uncaught exceptions occurred
      expect(pageErrors.length).toBe(0);

      // Ensure no console.error messages were emitted
      expect(consoleErrors.length).toBe(0);
    });

    test('Multiple consecutive Add Node clicks produce a consistent list and correct node numbering', async ({ page }) => {
      const app = new DoublyLinkedListPage(page);
      await app.goto();

      // Start state
      const startNodes = await app.getNodeCount();
      expect(startNodes).toBe(3);

      // Perform multiple clicks
      const clicks = 3;
      for (let i = 0; i < clicks; i++) {
        await app.clickAddButton();
      }

      // Expect node count increased by number of clicks
      await expect(page.locator(app.nodeSelector)).toHaveCount(startNodes + clicks);

      const texts = await app.getNodeTexts();
      // Check that the numbering is sequential at the end (last element should be Node (3+clicks))
      const expectedLast = `Node ${3 + clicks}`;
      expect(texts[texts.length - 1]).toBe(expectedLast);

      // Validate that arrows are interleaved properly: arrows should be at least nodes - 1
      const nodesAfter = await app.getNodeCount();
      const arrowsAfter = await app.getArrowCount();
      expect(arrowsAfter).toBeGreaterThanOrEqual(nodesAfter - 1);

      // Confirm no uncaught exceptions
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Console and runtime error monitoring', () => {
    test('No ReferenceError, SyntaxError, or TypeError should be emitted during normal usage', async ({ page }) => {
      const app = new DoublyLinkedListPage(page);
      await app.goto();

      // Perform a typical interaction
      await app.clickAddButton();
      await app.clickAddButton();

      // Collect all console messages recorded in this test
      // Ensure none of them indicate a ReferenceError, SyntaxError, or TypeError
      const problemPatterns = [/ReferenceError/, /SyntaxError/, /TypeError/];

      const foundProblematicConsole = consoleMessages.find((m) =>
        problemPatterns.some((re) => re.test(m.text))
      );

      // If any page errors were thrown, ensure they are not ReferenceError/SyntaxError/TypeError
      const problematicPageError = pageErrors.find((err) =>
        problemPatterns.some((re) => re.test(String(err && err.message ? err.message : err)))
      );

      // Assertions: we expect NO problematic console messages and NO problematic page errors
      expect(foundProblematicConsole).toBeUndefined();
      expect(problematicPageError).toBeUndefined();

      // Also assert there are no uncaught page errors at all
      expect(pageErrors.length).toBe(0);
    });
  });
});