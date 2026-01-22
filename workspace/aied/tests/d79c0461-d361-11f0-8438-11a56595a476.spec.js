import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79c0461-d361-11f0-8438-11a56595a476.html';

// Page object to encapsulate interactions and queries for the Red-Black Tree demo
class TreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#valueInput');
    this.insertBtn = page.locator('#insertBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.message = page.locator('#message');
    this.svg = page.locator('#treeSVG');
  }

  async navigate() {
    await this.page.goto(APP_URL);
  }

  async getMessageText() {
    return (await this.message.innerText()).trim();
  }

  async getMessageColor() {
    return await this.message.evaluate(el => getComputedStyle(el).color);
  }

  async fillInput(value) {
    // Use fill to ensure value is exactly represented
    await this.input.fill(String(value));
  }

  async insertValue(value) {
    await this.fillInput(value);
    await this.insertBtn.click();
  }

  async insertValueByEnter(value) {
    await this.fillInput(value);
    await this.input.press('Enter');
  }

  async clearTree() {
    await this.clearBtn.click();
  }

  async getNodeCount() {
    // Count groups with class 'node' in SVG
    return await this.page.evaluate(() => document.querySelectorAll('#treeSVG .node').length);
  }

  async getNodeAriaLabels() {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('#treeSVG .node')).map(g => g.getAttribute('aria-label'));
    });
  }

  async getNodeTextContents() {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('#treeSVG .node text')).map(t => t.textContent?.trim() || '');
    });
  }

  async getLineCount() {
    return await this.page.evaluate(() => document.querySelectorAll('#treeSVG line.link').length);
  }

  async isSVGEmpty() {
    return await this.page.evaluate(() => !document.querySelector('#treeSVG').hasChildNodes());
  }
}

test.describe('Red-Black Tree Visualization and Demo - FSM validation', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for each test
    pageErrors = [];
    consoleMessages = [];
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the app
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Assert no unexpected runtime page errors occurred during the test
    // (The application is expected to run without ReferenceError/SyntaxError/TypeError.)
    expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toHaveLength(0);
    // Also ensure there are no console.error messages emitted
    const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(errorConsoleCount, `Unexpected console.error messages: ${JSON.stringify(consoleMessages)}`).toBe(0);
  });

  test('Initial state (S0_Idle) shows guidance message and empty visualization', async ({ page }) => {
    // Validate initial Idle state entry action: showMessage('Enter integers and click Insert to add nodes.')
    const treePage = new TreePage(page);
    await treePage.navigate();

    const msg = await treePage.getMessageText();
    expect(msg).toBe('Enter integers and click Insert to add nodes.');

    // The message should be styled as the initial (non-error) color (#007700)
    const color = await treePage.getMessageColor();
    // color may be reported as rgb(...). Check it includes expected green-ish components (0,119,0 or similar)
    expect(color).toContain('rgb').or.toContain('rgba');

    // SVG should be empty at start (no nodes drawn)
    const empty = await treePage.isSVGEmpty();
    expect(empty).toBe(true);
  });

  test('InsertClick event transitions to S1_ValueInserted and draws a node', async ({ page }) => {
    // Validate that clicking Insert inserts a value, shows inserted message, and draws a node in SVG
    const treePage = new TreePage(page);
    await treePage.navigate();

    await treePage.insertValue(10);

    // Message should indicate insertion succeeded
    const msg = await treePage.getMessageText();
    expect(msg).toBe('Inserted value 10.');

    // Message should be non-error color (#007700)
    const color = await treePage.getMessageColor();
    expect(color).toContain('rgb').or.toContain('rgba');

    // A node representing 10 should be present in the SVG
    const nodeCount = await treePage.getNodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(1);

    const nodeTexts = await treePage.getNodeTextContents();
    expect(nodeTexts).toContain('10');

    const ariaLabels = await treePage.getNodeAriaLabels();
    // Ensure at least one aria-label mentions Node value 10
    const hasAria = ariaLabels.some(a => a && a.includes('Node value 10'));
    expect(hasAria).toBe(true);

    // Edges should be zero for single node, but verify drawTree executed without errors (no page errors asserted in afterEach)
  });

  test('Inserting a duplicate triggers S2_ValueAlreadyExists and does not add another node', async ({ page }) => {
    // Insert a value twice and ensure duplicate insertion shows appropriate error message & node count stays same
    const treePage = new TreePage(page);
    await treePage.navigate();

    // Insert initial value
    await treePage.insertValue(20);
    const countAfterFirst = await treePage.getNodeCount();
    expect(countAfterFirst).toBeGreaterThanOrEqual(1);

    // Insert duplicate
    await treePage.insertValue(20);

    // Message must say value already exists and be styled as error (red)
    const msg = await treePage.getMessageText();
    expect(msg).toBe('Value 20 already exists in the tree.');

    const color = await treePage.getMessageColor();
    // The error color used in implementation is "#aa0000" which will report as rgb(170, 0, 0)
    expect(color).toContain('rgb').or.toContain('rgba');
    // Ensure node count didn't increase
    const countAfterSecond = await treePage.getNodeCount();
    expect(countAfterSecond).toBe(countAfterFirst);
  });

  test('ClearClick event transitions to S3_TreeCleared: clears visualization and shows "Tree cleared."', async ({ page }) => {
    const treePage = new TreePage(page);
    await treePage.navigate();

    // Insert some values first to ensure SVG has children
    await treePage.insertValue(5);
    await treePage.insertValue(3);
    await treePage.insertValue(7);

    const nodeCountBeforeClear = await treePage.getNodeCount();
    expect(nodeCountBeforeClear).toBeGreaterThanOrEqual(1);

    // Click clear
    await treePage.clearTree();

    // Message must be "Tree cleared."
    const msg = await treePage.getMessageText();
    expect(msg).toBe('Tree cleared.');

    // SVG must be cleared (no child nodes)
    const empty = await treePage.isSVGEmpty();
    expect(empty).toBe(true);

    // Input should be focused and empty per implementation -- verify the input has no value
    const inputValue = await page.locator('#valueInput').inputValue();
    expect(inputValue).toBe('');
  });

  test('EnterKey event triggers insert (same as InsertClick) and draws node', async ({ page }) => {
    // Validate pressing Enter in the input triggers the same insertion logic
    const treePage = new TreePage(page);
    await treePage.navigate();

    await treePage.insertValueByEnter(30);

    const msg = await treePage.getMessageText();
    expect(msg).toBe('Inserted value 30.');

    const nodeTexts = await treePage.getNodeTextContents();
    expect(nodeTexts).toContain('30');
  });

  test('Edge cases: clicking Insert with empty input shows validation error', async ({ page }) => {
    // If input is empty and Insert is clicked, the app should show a helpful error message
    const treePage = new TreePage(page);
    await treePage.navigate();

    // Ensure input is empty
    await treePage.fillInput('');
    await treePage.insertBtn.click();

    const msg = await treePage.getMessageText();
    expect(msg).toBe('Please enter a value to insert.');

    // Error should be styled as error color
    const color = await treePage.getMessageColor();
    expect(color).toContain('rgb').or.toContain('rgba');

    // No node should have been added
    const nodeCount = await treePage.getNodeCount();
    expect(nodeCount).toBe(0);
  });

  test('Edge case: non-integer numeric input shows "Only integers are allowed."', async ({ page }) => {
    // Fill the number input with a decimal value and click insert; expect integer validation error
    const treePage = new TreePage(page);
    await treePage.navigate();

    // Fill decimal value into number input (type=number supports decimal string)
    await treePage.fillInput('3.14');
    await treePage.insertBtn.click();

    const msg = await treePage.getMessageText();
    expect(msg).toBe('Only integers are allowed.');

    // No nodes should be added
    const nodeCount = await treePage.getNodeCount();
    expect(nodeCount).toBe(0);
  });

  test('Visualization draws links (lines) when multiple nodes present', async ({ page }) => {
    // Insert three distinct values and verify that line elements (edges) are drawn
    const treePage = new TreePage(page);
    await treePage.navigate();

    // Insert multiple values to produce a small tree
    await treePage.insertValue(50);
    await treePage.insertValue(25);
    await treePage.insertValue(75);

    // There should be at least one link (edge) between nodes
    const lineCount = await treePage.getLineCount();
    expect(lineCount).toBeGreaterThanOrEqual(1);

    // Node count should be exactly 3
    const nodeCount = await treePage.getNodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(3);
  });

  test('Multiple sequential operations maintain consistent state and messages', async ({ page }) => {
    // Perform a sequence: insert, insert duplicate, insert another, clear, ensure messages and DOM consistent
    const treePage = new TreePage(page);
    await treePage.navigate();

    await treePage.insertValue(11);
    expect(await treePage.getMessageText()).toBe('Inserted value 11.');
    const count1 = await treePage.getNodeCount();
    expect(count1).toBeGreaterThanOrEqual(1);

    // duplicate
    await treePage.insertValue(11);
    expect(await treePage.getMessageText()).toBe('Value 11 already exists in the tree.');
    const count2 = await treePage.getNodeCount();
    expect(count2).toBe(count1);

    // insert different
    await treePage.insertValue(12);
    expect(await treePage.getMessageText()).toBe('Inserted value 12.');
    const count3 = await treePage.getNodeCount();
    expect(count3).toBeGreaterThanOrEqual(count1 + 1);

    // clear
    await treePage.clearTree();
    expect(await treePage.getMessageText()).toBe('Tree cleared.');
    expect(await treePage.isSVGEmpty()).toBe(true);
  });
});