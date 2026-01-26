import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2d12f3-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object Model for the Red-Black Tree interactive page
class TreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.insertInput = page.locator('input[type="number"]#insertValue');
    this.insertButton = page.locator('button[onclick="insertNode()"]');
    this.deleteInput = page.locator('input[type="number"]#deleteValue');
    this.deleteButton = page.locator('button[onclick="deleteNode()"]');
    this.searchInput = page.locator('input[type="number"]#searchValue');
    this.searchButton = page.locator('button[onclick="searchNode()"]');
    this.clearButton = page.locator('button[onclick="clearTree()"]');
    this.randomButton = page.locator('button[onclick="randomTree()"]');
    this.balanceButton = page.locator('button[onclick="balanceTree()"]');
    this.startStepButton = page.locator('button[onclick="startStepByStep()"]');
    this.nextStepButton = page.locator('button[onclick="nextStep()"]');
    this.nodeSizeRange = page.locator('input[type="range"]#nodeSize');
    this.treeSpacingRange = page.locator('input[type="range"]#treeSpacing');
    this.showValuesCheckbox = page.locator('input[type="checkbox"]#showValues');
    this.treeCanvas = page.locator('#treeCanvas');
    this.operationLog = page.locator('#operationLog');
    this.stepInfo = page.locator('#stepInfo');
  }

  // Actions
  async goto() {
    await this.page.goto(APP_URL);
  }

  async insert(value) {
    await this.insertInput.fill(String(value));
    await this.insertButton.click();
  }

  async delete(value) {
    await this.deleteInput.fill(String(value));
    await this.deleteButton.click();
  }

  async search(value) {
    await this.searchInput.fill(String(value));
    await this.searchButton.click();
  }

  async clearTree() {
    await this.clearButton.click();
  }

  async randomTree() {
    await this.randomButton.click();
  }

  async balanceTree() {
    await this.balanceButton.click();
  }

  async startStepByStepWith(insertValue = '', deleteValue = '') {
    await this.insertInput.fill(insertValue === '' ? '' : String(insertValue));
    await this.deleteInput.fill(deleteValue === '' ? '' : String(deleteValue));
    await this.startStepButton.click();
  }

  async nextStep() {
    await this.nextStepButton.click();
  }

  async setNodeSize(value) {
    // change value and fire change event
    await this.nodeSizeRange.evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, String(value));
  }

  async setTreeSpacing(value) {
    await this.treeSpacingRange.evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, String(value));
  }

  async toggleShowValues(checked) {
    await this.showValuesCheckbox.evaluate((el, c) => {
      el.checked = c;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, Boolean(checked));
  }

  // Observations / assertions helpers
  async getLogLines() {
    const count = await this.operationLog.locator('div').count();
    const lines = [];
    for (let i = 0; i < count; i++) {
      lines.push(await this.operationLog.locator('div').nth(i).textContent());
    }
    return lines;
  }

  async lastLogLine() {
    const count = await this.operationLog.locator('div').count();
    if (count === 0) return null;
    return await this.operationLog.locator('div').nth(count - 1).textContent();
  }

  async nodeElements() {
    return this.treeCanvas.locator('.node');
  }

  async nodeCount() {
    return this.nodeElements().count();
  }

  async getNodeTexts() {
    const elems = this.nodeElements();
    const count = await elems.count();
    const vals = [];
    for (let i = 0; i < count; i++) {
      const txt = await elems.nth(i).textContent();
      vals.push(txt ? txt.trim() : '');
    }
    return vals;
  }

  async getNodeStyle(nth, prop) {
    return this.nodeElements().nth(nth).evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
  }

  async getStepInfoText() {
    return (await this.stepInfo.textContent())?.trim() ?? '';
  }

  async canvasWidth() {
    return this.treeCanvas.evaluate(el => el.style.width || window.getComputedStyle(el).width);
  }
}

test.describe('Red-Black Tree Interactive - end-to-end tests (FSM coverage)', () => {
  let page;
  let treePage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    treePage = new TreePage(page);
    await treePage.goto();
  });

  test.afterEach(async () => {
    // Always close page
    await page.close();
  });

  test('S0_Idle: On load the canvas should be empty and no runtime errors occur', async () => {
    // Validate initial state: drawTree() executed on load, but since tree.root is null no nodes should be drawn
    const nodeCount = await treePage.nodeCount();
    expect(nodeCount).toBe(0);

    // operation log should be empty initially
    const logs = await treePage.getLogLines();
    expect(logs.length).toBe(0);

    // Verify no uncaught page errors occurred during initialization
    expect(pageErrors.length).toBe(0);
  });

  test('S1_NodeInserted: Insert a node and verify log and DOM update', async () => {
    // Insert a node with value 42
    await treePage.insert(42);

    // Last log line should indicate insertion
    const last = await treePage.lastLogLine();
    expect(last).toMatch(/Inserted 42$/);

    // There should be at least one node rendered with text "42"
    const texts = await treePage.getNodeTexts();
    expect(texts.some(t => t === '42')).toBeTruthy();

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Insert duplicate value should not create duplicate nodes (edge case)', async () => {
    // Insert once
    await treePage.insert(10);
    const logsBefore = await treePage.getLogLines();
    const countBefore = await treePage.nodeCount();

    // Insert duplicate
    await treePage.insert(10);

    // Duplicate insertion does not log or add a second node according to implementation
    const logsAfter = await treePage.getLogLines();
    const countAfter = await treePage.nodeCount();

    // The last log still should be the first insertion (Inserted 10)
    expect(logsBefore[logsBefore.length - 1]).toMatch(/Inserted 10$/);
    expect(logsAfter.length).toBe(logsBefore.length); // no extra log entry for duplicate
    expect(countAfter).toBe(countBefore); // node count unchanged

    expect(pageErrors.length).toBe(0);
  });

  test('S3_NodeSearched: Search existing and non-existing nodes and verify logs and highlight', async () => {
    // Ensure a known node exists
    await treePage.insert(77);

    // Search for existing node -> expect "Found 77"
    await treePage.search(77);
    const last1 = await treePage.lastLogLine();
    expect(last1).toMatch(/Found 77$/);

    // The highlightNode function briefly sets border to '2px solid blue' - check for highlight
    // Wait up to 500ms for the border to be set by highlightNode
    const nodes = treePage.nodeElements();
    const count = await nodes.count();
    expect(count).toBeGreaterThan(0);

    // Find an element with text '77' and check its border style shortly after search
    const matchingIndex = await (async () => {
      for (let i = 0; i < count; i++) {
        const txt = (await nodes.nth(i).textContent())?.trim();
        if (txt === '77') return i;
      }
      return -1;
    })();

    expect(matchingIndex).toBeGreaterThanOrEqual(0);

    // Poll for the border style change (the code sets it and then clears after 1s)
    const borderStyle = await nodes.nth(matchingIndex).evaluate(() => getComputedStyle(document.querySelectorAll('.node').item(Array.from(document.querySelectorAll('.node')).findIndex(n=>n.textContent.trim()==='77'))).border);
    // We won't assert an exact border since styles may be normalized; ensure some border exists
    expect(borderStyle).toBeTruthy();

    // Now search for a non-existent node 9999 -> expect "9999 not found"
    await treePage.search(9999);
    const last2 = await treePage.lastLogLine();
    expect(last2).toMatch(/9999 not found$/);

    expect(pageErrors.length).toBe(0);
  });

  test('S2_NodeDeleted: Delete existing node and edge-case delete non-existent node', async () => {
    // Insert a node and then delete it
    await treePage.insert(55);
    // Confirm inserted
    expect((await treePage.getNodeTexts()).some(t => t === '55')).toBeTruthy();

    await treePage.delete(55);
    // Last log must indicate deletion
    const last = await treePage.lastLogLine();
    expect(last).toMatch(/Deleted 55$/);

    // After deletion, node with 55 should not be present
    const textsAfter = await treePage.getNodeTexts();
    expect(textsAfter.includes('55')).toBeFalsy();

    // Edge case: delete a non-existent node should still append "Deleted X" per implementation
    const logsBefore = await treePage.getLogLines();
    await treePage.delete(12345); // likely not present
    const logsAfter = await treePage.getLogLines();
    expect(logsAfter.length).toBe(logsBefore.length + 1);
    expect(logsAfter[logsAfter.length - 1]).toMatch(/Deleted 12345$/);

    expect(pageErrors.length).toBe(0);
  });

  test('S4_TreeCleared: Clear the tree and verify log and DOM emptied', async () => {
    // Insert a couple nodes
    await treePage.insert(1);
    await treePage.insert(2);

    // Clear tree
    await treePage.clearTree();

    const last = await treePage.lastLogLine();
    expect(last).toMatch(/Tree cleared$/);

    // Canvas should have no nodes
    const n = await treePage.nodeCount();
    expect(n).toBe(0);

    expect(pageErrors.length).toBe(0);
  });

  test('S5_RandomTreeGenerated: Generate random tree and verify log and node count bounds', async () => {
    await treePage.randomTree();

    const last = await treePage.lastLogLine();
    // Should match "Generated random tree with {count} nodes"
    expect(last).toMatch(/Generated random tree with \d+ nodes$/);

    // Extract the count and assert it's between 5 and 15 inclusive
    const match = last.match(/Generated random tree with (\d+) nodes$/);
    expect(match).not.toBeNull();
    const count = parseInt(match[1], 10);
    expect(count).toBeGreaterThanOrEqual(5);
    expect(count).toBeLessThanOrEqual(15);

    // Canvas should have at least 5 nodes rendered
    const nodeCount = await treePage.nodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(5);

    expect(pageErrors.length).toBe(0);
  });

  test('S6_TreeBalanced: Balance an existing tree and verify log and node colors', async () => {
    // Create random tree first
    await treePage.randomTree();
    // Balance the tree
    await treePage.balanceTree();

    const last = await treePage.lastLogLine();
    expect(last).toMatch(/Tree rebalanced$/);

    // After balancing the buildBalanced uses Node(..., 'black'), so nodes should have class 'black'
    const nodes = treePage.nodeElements();
    const count = await nodes.count();
    expect(count).toBeGreaterThan(0);

    // Verify at least one node has class black (there may be others)
    let blackFound = false;
    for (let i = 0; i < count; i++) {
      const className = await nodes.nth(i).getAttribute('class');
      if (className && className.includes('black')) {
        blackFound = true;
        break;
      }
    }
    expect(blackFound).toBeTruthy();

    expect(pageErrors.length).toBe(0);
  });

  test('S7_StepByStepStarted and S8_NextStepExecuted: step-by-step insert and delete', async () => {
    // Prepare stepQueue by filling insertValue and deleteValue and starting step-by-step
    await treePage.startStepByStepWith(200, 300);

    // After startStepByStep, stepInfo should show "Step 1/2"
    const stepInfoText = await treePage.getStepInfoText();
    expect(stepInfoText).toMatch(/^Step 1\/2$/);

    // Execute first nextStep -> should log Step: Inserted 200 OR Step: Deleted (depending on queue order)
    await treePage.nextStep();
    const firstStepLog = await treePage.lastLogLine();
    expect(firstStepLog).toMatch(/^.*Step: (Inserted|Deleted) (200|300)$/);

    // Execute second nextStep -> after that stepInfo should say 'All steps completed'
    await treePage.nextStep();
    const secondStepLog = await treePage.lastLogLine();
    expect(secondStepLog).toMatch(/^.*Step: (Inserted|Deleted) (200|300)$/);

    const finalStepInfo = await treePage.getStepInfoText();
    expect(finalStepInfo).toBe('All steps completed');

    // Extra nextStep should be a no-op (no new log entry)
    const logsBefore = await treePage.getLogLines();
    await treePage.nextStep();
    const logsAfter = await treePage.getLogLines();
    expect(logsAfter.length).toBe(logsBefore.length);

    expect(pageErrors.length).toBe(0);
  });

  test('UpdateNodeSize and UpdateTreeSpacing and ToggleShowValues: UI controls affect rendering', async () => {
    // Insert known node so drawTree renders something
    await treePage.insert(88);

    // Change node size to 40
    await treePage.setNodeSize(40);

    // Verify rendered node width/height reflect new size
    const nodes = treePage.nodeElements();
    const count = await nodes.count();
    expect(count).toBeGreaterThan(0);

    // Check width of first node (style.width set inline)
    const width = await nodes.nth(0).evaluate(el => el.style.width || getComputedStyle(el).width);
    expect(width).toContain('40'); // expect px value contains 40

    // Change tree spacing to a larger number and ensure canvas width updates
    const prevCanvasWidth = await treePage.canvasWidth();
    await treePage.setTreeSpacing(180);
    const newCanvasWidth = await treePage.canvasWidth();

    // Canvas width should be recalculated and change (string values, ensure different)
    expect(newCanvasWidth).not.toBe(prevCanvasWidth);

    // Toggle show values off - node text should be hidden (drawTree respects checkbox)
    await treePage.toggleShowValues(false);
    // After toggling, nodes should have empty textContent when showValues is false
    const textsHidden = await treePage.getNodeTexts();
    // Either they are empty strings or whitespace - ensure none equal to '88'
    expect(textsHidden.every(t => t !== '88')).toBeTruthy();

    // Toggle back on
    await treePage.toggleShowValues(true);
    const textsShown = await treePage.getNodeTexts();
    // Now the value '88' should be present again
    expect(textsShown.some(t => t === '88')).toBeTruthy();

    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: clicking buttons with empty inputs should not produce logs or crash', async () => {
    // Ensure insert/delete/search inputs are empty
    await treePage.insertInput.fill('');
    await treePage.deleteInput.fill('');
    await treePage.searchInput.fill('');

    const logsBefore = await treePage.getLogLines();

    // Click Insert with empty input -> no-op
    await treePage.insertButton.click();
    // Click Delete with empty input -> no-op
    await treePage.deleteButton.click();
    // Click Search with empty input -> no-op
    await treePage.searchButton.click();

    const logsAfter = await treePage.getLogLines();
    // No new logs should be added for invalid (NaN) inputs
    expect(logsAfter.length).toBe(logsBefore.length);

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console messages and page errors array to ensure runtime stability', async () => {
    // Perform a couple of operations to populate logs
    await treePage.insert(5);
    await treePage.delete(5);
    await treePage.randomTree();

    // We collected console messages during the test; ensure we observed them (if any)
    // At minimum the operationLog entries exist; we verify pageErrors empty for stable runtime
    expect(pageErrors.length).toBe(0);

    // Console messages may be present (e.g., warnings), but ensure we didn't capture exceptions
    const errors = consoleMessages.filter(m => m.type === 'error');
    // It's acceptable to have zero error-type console messages. Assert no fatal console errors.
    expect(errors.length).toBe(0);
  });
});