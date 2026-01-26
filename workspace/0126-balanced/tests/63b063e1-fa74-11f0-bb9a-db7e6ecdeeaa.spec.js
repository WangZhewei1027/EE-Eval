import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b063e1-fa74-11f0-bb9a-db7e6ecdeeaa.html';

/**
 * Page Object for interacting with the Binary Tree demo controls and SVG.
 */
class TreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputValue');
    this.insertBtn = page.locator('#insertBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.svg = page.locator('#tree-svg');
    this.nodeSelector = '#tree-svg .node';
    this.edgeSelector = '#tree-svg .edge, #tree-svg line';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillInput(value) {
    await this.input.fill(String(value));
  }

  async clickInsert() {
    await this.insertBtn.click();
  }

  async pressEnterToInsert() {
    await this.input.press('Enter');
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async getNodeCount() {
    return await this.page.locator(this.nodeSelector).count();
  }

  async getEdgeCount() {
    // edges are lines with class 'edge'
    return await this.page.locator(this.edgeSelector).count();
  }

  async getAllNodeTexts() {
    return await this.page.locator('#tree-svg .node text').allTextContents();
  }

  async svgChildCount() {
    return await this.page.locator('#tree-svg > *').count();
  }

  async svgWidth() {
    return await this.svg.getAttribute('width');
  }

  async svgHeight() {
    return await this.svg.getAttribute('height');
  }

  async inputValue() {
    return await this.input.inputValue();
  }
}

test.describe('Binary Tree Visualization - FSM tests', () => {
  // Collect console errors and page errors for assertions in tests
  test.beforeEach(async ({ page }) => {
    // no-op here; individual tests will set listeners and navigate
  });

  /**
   * Group: Initial State (S0_Idle)
   * Validate that initial drawTree(tree) ran and left an empty SVG (since tree.root === null)
   */
  test('S0_Idle: Initial empty tree draw results in empty SVG', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    const dialogs = [];

    // Capture console.error and page errors
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    // Capture dialogs so we can assert if any unexpected alerts fire
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    const tree = new TreePage(page);
    await tree.goto();

    // The script calls drawTree(tree) on load; because tree.root is null,
    // we expect no child elements in the SVG.
    expect(await tree.svgChildCount()).toBe(0);

    // Initial attributes should still be the HTML defaults ("100%" and "600")
    const w = await tree.svgWidth();
    const h = await tree.svgHeight();
    expect(w).toBe('100%');
    expect(h).toBe('600');

    // No alerts should have been shown during normal initialization
    expect(dialogs.length).toBe(0);

    // Ensure there are no runtime console errors / page errors on load
    expect(consoleErrors, 'There should be no console.error messages on load').toEqual([]);
    expect(pageErrors, 'There should be no page errors on load').toEqual([]);
  });

  /**
   * Group: InsertNode event/error scenarios and transitions to S1_NodeInserted
   * - Clicking insert with empty input -> alert
   * - Inserting non-numeric -> alert
   * - Valid insertion via click -> node rendered (transition to S1_NodeInserted)
   * - Insertion via Enter key -> also renders node
   * - Duplicate insertion -> alert and no additional node rendered
   */
  test.describe('InsertNode interactions and S1_NodeInserted state', () => {
    // We'll reuse console/page/dialog collectors for each test to assert no unexpected errors
    test('Clicking Insert with empty input shows alert and keeps tree empty', async ({ page }) => {
      const dialogs = [];
      const pageErrors = [];
      const consoleErrors = [];

      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });
      page.on('pageerror', e => pageErrors.push(String(e)));
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const tree = new TreePage(page);
      await tree.goto();

      // Ensure input is empty
      expect(await tree.inputValue()).toBe('');

      // Click insert -> should trigger an alert and not change SVG
      await tree.clickInsert();

      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      // The application alerts when empty with this exact message
      expect(dialogs).toContain('Please enter a value to insert.');

      expect(await tree.svgChildCount()).toBe(0);

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Inserting non-numeric value shows numeric alert and no nodes are created', async ({ page }) => {
      const dialogs = [];
      const pageErrors = [];
      const consoleErrors = [];

      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });
      page.on('pageerror', e => pageErrors.push(String(e)));
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const tree = new TreePage(page);
      await tree.goto();

      await tree.fillInput('abc');
      await tree.clickInsert();

      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs).toContain('Please enter a numeric value.');

      // Still no nodes
      expect(await tree.svgChildCount()).toBe(0);

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Valid insertion via click creates a node and transitions to S1_NodeInserted', async ({ page }) => {
      const dialogs = [];
      const pageErrors = [];
      const consoleErrors = [];

      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });
      page.on('pageerror', e => pageErrors.push(String(e)));
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const tree = new TreePage(page);
      await tree.goto();

      // Insert a numeric node (10)
      await tree.fillInput('10');
      await tree.clickInsert();

      // Should not have fired any alert for valid input
      expect(dialogs).not.toContain('Please enter a value to insert.');
      expect(dialogs).not.toContain('Please enter a numeric value.');

      // One node should now be rendered
      await expect(page.locator(tree.nodeSelector)).toHaveCount(1);
      const texts = await tree.getAllNodeTexts();
      expect(texts.map(t => t.trim())).toContain('10');

      // Edges should be zero for single node
      expect(await tree.getEdgeCount()).toBe(0);

      // Input should be cleared after successful insert
      expect(await tree.inputValue()).toBe('');

      // Width/height should now be adjusted (since drawTree sets width/height when nodes exist)
      const w = await tree.svgWidth();
      const h = await tree.svgHeight();
      // width should no longer be the literal "100%" because drawTree sets numeric width; check for not-100%
      expect(w).not.toBe('100%');
      expect(Number(h)).toBeGreaterThanOrEqual(0);

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Insertion via Enter key triggers same behavior as button click (adds node)', async ({ page }) => {
      const dialogs = [];
      const pageErrors = [];
      const consoleErrors = [];

      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });
      page.on('pageerror', e => pageErrors.push(String(e)));
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const tree = new TreePage(page);
      await tree.goto();

      // Ensure we start fresh and insert first a base node for consistent count
      await tree.fillInput('20');
      await tree.clickInsert();
      await expect(page.locator(tree.nodeSelector)).toHaveCount(1);

      // Now insert a second node using Enter key (e.g., left child 10)
      await tree.fillInput('10');
      await tree.pressEnterToInsert();

      // Two nodes should be present now
      await expect(page.locator(tree.nodeSelector)).toHaveCount(2);

      const texts = (await tree.getAllNodeTexts()).map(t => t.trim());
      expect(texts).toEqual(expect.arrayContaining(['20', '10']));

      // There should be one edge connecting parent and child
      expect(await tree.getEdgeCount()).toBe(1);

      expect(dialogs).toEqual([]); // no alerts for valid input
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Duplicate insertion triggers alert and does not increase node count', async ({ page }) => {
      const dialogs = [];
      const pageErrors = [];
      const consoleErrors = [];

      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });
      page.on('pageerror', e => pageErrors.push(String(e)));
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const tree = new TreePage(page);
      await tree.goto();

      // Insert a node
      await tree.fillInput('42');
      await tree.clickInsert();
      await expect(page.locator(tree.nodeSelector)).toHaveCount(1);

      // Attempt to insert duplicate
      await tree.fillInput('42');
      await tree.clickInsert();

      // The app alerts on duplicate
      expect(dialogs).toContain('Value already exists in the tree.');

      // Node count remains unchanged
      expect(await tree.getNodeCount()).toBe(1);

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  /**
   * Group: ClearTree interactions and S2_TreeCleared state
   * - Clearing after nodes exist should remove SVG children (clearSVG)
   * - Clearing when already cleared should keep it cleared
   * - Inserting after clear should behave correctly (S2 -> S0 -> S1)
   */
  test.describe('ClearTree interactions and S2_TreeCleared state', () => {
    test('Clicking Clear on a populated tree clears the SVG (transition to S2_TreeCleared)', async ({ page }) => {
      const dialogs = [];
      const pageErrors = [];
      const consoleErrors = [];

      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });
      page.on('pageerror', e => pageErrors.push(String(e)));
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const tree = new TreePage(page);
      await tree.goto();

      // Populate the tree with a couple nodes
      await tree.fillInput('30');
      await tree.clickInsert();
      await tree.fillInput('25');
      await tree.clickInsert();

      // Sanity: ensure there are nodes and at least one edge
      expect(await tree.getNodeCount()).toBeGreaterThanOrEqual(2);
      expect(await tree.getEdgeCount()).toBeGreaterThanOrEqual(1);

      // Clear the tree
      await tree.clickClear();

      // After clear, SVG should have zero children
      expect(await tree.svgChildCount()).toBe(0);

      // No alerts should be present for clear
      expect(dialogs).not.toContain('Please enter a value to insert.');

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Clicking Clear on an already cleared tree keeps it cleared (idempotent ClearTree)', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];

      page.on('pageerror', e => pageErrors.push(String(e)));
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const tree = new TreePage(page);
      await tree.goto();

      // Ensure tree is empty first
      expect(await tree.svgChildCount()).toBe(0);

      // Click clear twice
      await tree.clickClear();
      await tree.clickClear();

      // Remains empty
      expect(await tree.svgChildCount()).toBe(0);

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('After clearing, inserting a node transitions back to S1_NodeInserted and draws node', async ({ page }) => {
      const dialogs = [];
      const pageErrors = [];
      const consoleErrors = [];

      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });
      page.on('pageerror', e => pageErrors.push(String(e)));
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const tree = new TreePage(page);
      await tree.goto();

      // Insert a node, clear, then insert again to ensure transition S2 -> S0 -> S1
      await tree.fillInput('7');
      await tree.clickInsert();
      expect(await tree.getNodeCount()).toBeGreaterThanOrEqual(1);

      await tree.clickClear();
      expect(await tree.svgChildCount()).toBe(0);

      // Now insert after clear
      await tree.fillInput('15');
      await tree.clickInsert();

      // Should render the new node
      await expect(page.locator(tree.nodeSelector)).toHaveCount(1);
      const texts = await tree.getAllNodeTexts();
      expect(texts.map(t => t.trim())).toContain('15');

      expect(dialogs).toEqual(expect.not.arrayContaining(['Please enter a value to insert.', 'Please enter a numeric value.']));
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  /**
   * Final test to explicitly assert that no unexpected runtime errors (ReferenceError, TypeError, SyntaxError)
   * occurred during the interactions in this test file. This verifies that the page executed without uncaught exceptions.
   */
  test('No unexpected runtime errors occurred during interactions', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', e => pageErrors.push(String(e)));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const tree = new TreePage(page);
    await tree.goto();

    // Perform a sequence of safe interactions: insert, clear, insert via Enter
    await tree.fillInput('100');
    await tree.clickInsert();
    await tree.clickClear();
    await tree.fillInput('50');
    await tree.pressEnterToInsert();

    // We expect no uncaught page errors and no console.error messages.
    // If any ReferenceError/TypeError/SyntaxError occurred, they'd appear here.
    expect(pageErrors, 'No uncaught page errors should have occurred').toEqual([]);
    expect(consoleErrors, 'No console.error messages should be emitted').toEqual([]);
  });
});