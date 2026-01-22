import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/batch-1207/html/d79bdd51-d361-11f0-8438-11a56595a476.html';

/**
 * Page Object for the Binary Tree demo page.
 * Encapsulates selectors and common interactions.
 */
class BinaryTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nodeValueInput = page.locator('#nodeValue');
    this.insertBtn = page.locator('#insertBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.inorderBtn = page.locator('#inorderBtn');
    this.preorderBtn = page.locator('#preorderBtn');
    this.postorderBtn = page.locator('#postorderBtn');
    this.levelorderBtn = page.locator('#levelorderBtn');
    this.svgNodes = page.locator('#treeSVG .node');
    this.svgNodeTexts = page.locator('#treeSVG .node text');
    this.log = page.locator('#log');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getNodeCount() {
    return await this.svgNodes.count();
  }

  async getNodeValues() {
    // Returns array of textContent of <text> elements inside nodes
    return await this.svgNodeTexts.allTextContents();
  }

  async getLogLines() {
    const text = (await this.log.textContent()) || '';
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  async insertValue(value) {
    await this.nodeValueInput.fill(String(value));
    await this.insertBtn.click();
  }

  async clickClear(accept = true) {
    // clicking clear will trigger a confirm dialog; the global dialog handler will accept/dismiss
    await this.clearBtn.click();
  }

  async clickInorder() {
    await this.inorderBtn.click();
  }

  async clickPreorder() {
    await this.preorderBtn.click();
  }

  async clickPostorder() {
    await this.postorderBtn.click();
  }

  async clickLevelorder() {
    await this.levelorderBtn.click();
  }
}

// Collect console messages, console errors, page errors and dialogs for each test.
// We set these up in test.beforeEach and assert them later as needed.
test.describe('Binary Tree Visualization & Demo - FSM States and Transitions', () => {
  test.describe.configure({ mode: 'serial' });

  // Shared monitoring arrays, reinitialized per test
  let consoleMessages;
  let consoleErrorMessages;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrorMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Capture console messages
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrorMessages.push(text);
      }
    });

    // Capture runtime errors thrown on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Handle dialogs: accept them by default and record the messages
    page.on('dialog', async (dialog) => {
      try {
        dialogMessages.push({ type: dialog.type(), message: dialog.message() });
        // Always accept alerts/confirms so the UI flow continues for tests
        await dialog.accept();
      } catch (e) {
        // If accepting fails, still record error in pageErrors for assertions
        pageErrors.push('Dialog handling failed: ' + String(e));
      }
    });
  });

  test.afterEach(async () => {
    // Basic sanity check: no unexpected page errors or console errors occurred
    // Tests that expect errors/dialogs will assert the presence of such messages themselves.
    expect(pageErrors).toEqual([]);
    expect(consoleErrorMessages).toEqual([]);
    // We do not assert anything about dialogMessages globally here because individual tests
    // may produce dialogs and should assert on them explicitly.
  });

  test('Initial load (S0_Idle -> S1_TreePopulated): sample nodes are rendered on window.onload', async ({
    page,
  }) => {
    // Validate initial rendering and transition from Idle to TreePopulated
    // The window.onload inserts 7 sample values and draws the tree.
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // Wait until nodes are rendered
    await expect(treePage.svgNodes).toHaveCount(7, { timeout: 3000 });

    // Ensure the nodes' text content matches the sample values (inorder positions may vary)
    const nodeValues = await treePage.getNodeValues();
    // The set of values inserted on load should be these:
    const expectedSet = ['50', '30', '70', '20', '40', '60', '80'];
    for (const val of expectedSet) {
      expect(nodeValues).toContain(val);
    }

    // Log area should be empty after initial draw
    const lines = await treePage.getLogLines();
    expect(lines.length).toBe(0);
  });

  test('InsertNode transition: inserting a new node updates SVG and traversals', async ({ page }) => {
    // This validates transition S0_Idle->S1_TreePopulated (initial) and then InsertNode to stay/populate.
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // initial count should be 7
    await expect(treePage.svgNodes).toHaveCount(7);

    // Insert a new unique node 25
    await treePage.insertValue(25);

    // After insertion, there should be 8 nodes
    await expect(treePage.svgNodes).toHaveCount(8, { timeout: 3000 });

    // Verify the visual nodes contain the new value '25'
    const valuesAfterInsert = await treePage.getNodeValues();
    expect(valuesAfterInsert).toContain('25');

    // Perform inorder traversal and ensure '25' appears in the ordered output
    await treePage.clickInorder();
    const inorderLines = await treePage.getLogLines();
    expect(inorderLines[0]).toBe('Inorder Traversal:');
    // The inorder output line should include 25
    expect(inorderLines[1]).toContain('25');
    // Verify values are separated by arrow symbol for readability
    expect(inorderLines[1]).toMatch(/→/);

    // Also verify level-order contains the root 50 as first element
    await treePage.clickLevelorder();
    const levelLines = await treePage.getLogLines();
    expect(levelLines[0]).toBe('Level-order Traversal:');
    expect(levelLines[1].split('→').map(s => s.trim())[0]).toBe('50');
  });

  test('Duplicate insertion shows alert and does not change tree', async ({ page }) => {
    // Attempt to insert a duplicate value (50) and assert that an alert dialog is shown
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // Start with 7 nodes
    await expect(treePage.svgNodes).toHaveCount(7);

    // Insert duplicate value 50
    await treePage.insertValue(50);

    // The dialog handler in beforeEach accepts alerts and records them.
    // Ensure a dialog message matching the duplicate message appeared.
    // Allow some time for dialog to be processed
    await page.waitForTimeout(200);

    const foundDuplicateAlert = dialogMessages.find((d) =>
      /Duplicate nodes not allowed/i.test(d.message)
    );
    expect(foundDuplicateAlert).toBeTruthy();

    // Node count should remain 7
    await expect(treePage.svgNodes).toHaveCount(7);
  });

  test('ClearTree transition: confirm dialog then tree and log are cleared (S1 -> S2)', async ({
    page,
  }) => {
    // Validate clear action clears the tree visualization and the log
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // Ensure nodes present
    await expect(treePage.svgNodes).toHaveCount(7);

    // First produce some log content by triggering a traversal
    await treePage.clickPreorder();
    let preLines = await treePage.getLogLines();
    expect(preLines[0]).toBe('Preorder Traversal:');
    expect(preLines.length).toBeGreaterThan(1);

    // Click clear: confirm dialog will be shown and accepted via handler
    await treePage.clickClear();

    // Allow a moment for the clear to take effect
    await page.waitForTimeout(200);

    // The confirm message should have been captured
    const confirmDialog = dialogMessages.find((d) =>
      /Are you sure you want to clear the entire tree\?/i.test(d.message)
    );
    expect(confirmDialog).toBeTruthy();

    // After clear, there should be no nodes
    await expect(treePage.svgNodes).toHaveCount(0);

    // Log should be cleared
    const linesAfterClear = await treePage.getLogLines();
    expect(linesAfterClear.length).toBe(0);
  });

  test('Traversal outputs (S1 -> S3): inorder, preorder, postorder, level-order produce expected sequences', async ({
    page,
  }) => {
    // Start fresh for predictable traversal outputs (the page onload sets sample tree)
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // Inorder should be: 20,30,40,50,60,70,80
    await treePage.clickInorder();
    let lines = await treePage.getLogLines();
    expect(lines[0]).toBe('Inorder Traversal:');
    expect(lines[1]).toBe('20 → 30 → 40 → 50 → 60 → 70 → 80');

    // Preorder should be: 50,30,20,40,70,60,80
    await treePage.clickPreorder();
    lines = await treePage.getLogLines();
    expect(lines[0]).toBe('Preorder Traversal:');
    expect(lines[1]).toBe('50 → 30 → 20 → 40 → 70 → 60 → 80');

    // Postorder should be: 20,40,30,60,80,70,50
    await treePage.clickPostorder();
    lines = await treePage.getLogLines();
    expect(lines[0]).toBe('Postorder Traversal:');
    expect(lines[1]).toBe('20 → 40 → 30 → 60 → 80 → 70 → 50');

    // Level-order should be: 50,30,70,20,40,60,80
    await treePage.clickLevelorder();
    lines = await treePage.getLogLines();
    expect(lines[0]).toBe('Level-order Traversal:');
    expect(lines[1]).toBe('50 → 30 → 70 → 20 → 40 → 60 → 80');
  });

  test('Edge case: invalid input triggers alert and no node is inserted', async ({ page }) => {
    // Attempt to insert with empty input -> "Please enter a valid integer value."
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // Ensure starting nodes count is 7
    await expect(treePage.svgNodes).toHaveCount(7);

    // Ensure input is empty
    await treePage.nodeValueInput.fill('');

    // Click insert
    await treePage.insertBtn.click();

    // Wait a bit for dialog
    await page.waitForTimeout(200);

    // Check that an alert was presented with expected message
    const invalidAlert = dialogMessages.find((d) =>
      /Please enter a valid integer value\./i.test(d.message)
    );
    expect(invalidAlert).toBeTruthy();

    // Node count remains unchanged
    await expect(treePage.svgNodes).toHaveCount(7);
  });

  test('Monitor console and page errors: no unexpected runtime errors or console errors are emitted', async ({ page }) => {
    // This test explicitly checks for runtime errors and console error messages.
    // It relies on the listeners set in beforeEach to capture any issues during page load and interactions.
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // Interact with the page mildly to ensure any latent errors surface
    await treePage.clickInorder();
    await treePage.clickPreorder();
    await treePage.clickPostorder();
    await treePage.clickLevelorder();

    // Small wait to ensure all async handlers complete
    await page.waitForTimeout(200);

    // Expect no runtime page errors or console errors were captured (these arrays are asserted in afterEach)
    // But assert here explicitly as well for clarity in test reporting.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrorMessages.length).toBe(0);
  });
});