import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d0cc35-fa79-11f0-8075-e54a10595dde.html';

/**
 * Page Object for the AST demo page.
 * Encapsulates selectors and common actions to keep tests readable and maintainable.
 */
class ASTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      nodeType: '#nodeType',
      nodeValue: '#nodeValue',
      nodeIndex: '#nodeIndex',
      newNodeType: '#newNodeType',
      newNodeValue: '#newNodeValue',
      addButton: "button[onclick='addNode()']",
      changeButton: "button[onclick='changeNode()']",
      deleteButton: "button[onclick='deleteNode()']",
      navigateToChildButton: "button[onclick='navigateToChild()']",
      navigateToParentButton: "button[onclick='navigateToParent()']",
      astViewer: '#astViewer'
    };
  }

  async navigate() {
    await this.page.goto(BASE_URL);
    // wait until the AST viewer contains at least something (renderAST called on load)
    await this.page.waitForSelector(this.selectors.astViewer);
  }

  async getASTText() {
    return await this.page.locator(this.selectors.astViewer).innerText();
  }

  async getAST() {
    const text = await this.getASTText();
    // The page always uses JSON.stringify on rootNode, so JSON.parse should succeed.
    return JSON.parse(text);
  }

  async addNode(type, value) {
    await this.page.fill(this.selectors.nodeType, type);
    await this.page.fill(this.selectors.nodeValue, value);
    await this.page.click(this.selectors.addButton);
    // renderAST runs synchronously in the click handler; ensure viewer updated
    await this.page.waitForTimeout(50);
    return this.getAST();
  }

  async changeNode(index, newType, newValue) {
    await this.page.fill(this.selectors.nodeIndex, String(index));
    await this.page.fill(this.selectors.newNodeType, newType);
    await this.page.fill(this.selectors.newNodeValue, newValue);
    // changeNode may trigger an alert on invalid index; caller should handle dialog if expected
    await this.page.click(this.selectors.changeButton);
    await this.page.waitForTimeout(50);
    return this.getAST();
  }

  async deleteNode(index) {
    await this.page.fill(this.selectors.nodeIndex, String(index));
    await this.page.click(this.selectors.deleteButton);
    await this.page.waitForTimeout(50);
    return this.getAST();
  }

  async navigateToChild(index) {
    await this.page.fill(this.selectors.nodeIndex, String(index));
    await this.page.click(this.selectors.navigateToChildButton);
    await this.page.waitForTimeout(50);
    return this.getAST();
  }

  async navigateToParent() {
    await this.page.click(this.selectors.navigateToParentButton);
    await this.page.waitForTimeout(50);
    return this.getAST();
  }
}

test.describe('AST Interactive Demo - FSM states and transitions', () => {
  // Collect console messages and page errors for diagnostics and assertions.
  /** @type {Array<import('@playwright/test').ConsoleMessage>} */
  let consoleMessages;
  /** @type {Array<Error>} */
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions from the page (ReferenceError, SyntaxError, TypeError, etc.)
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Ensure no unexpected uncaught exceptions happened in the page during the test flows
    expect(pageErrors.length, `Expected no page errors (pageErrors: ${JSON.stringify(pageErrors)})`).toBe(0);
  });

  test('Initial state (S0_Idle) - renderAST() should display the root Program node', async ({ page }) => {
    // This test validates the Idle state entry action renderAST() and initial AST structure.
    const astPage = new ASTPage(page);
    await astPage.navigate();

    const ast = await astPage.getAST();
    // The HTML defines rootNode = new ASTNode('Program', 'Root');
    expect(ast.type).toBe('Program');
    expect(ast.value).toBe('Root');
    expect(Array.isArray(ast.children)).toBe(true);
    expect(ast.children.length).toBe(0);

    // Verify no JavaScript runtime errors occurred during initial render
    expect(pageErrors.length).toBe(0);
  });

  test('Add Node transition (S1_NodeAdded) - clicking Add Node updates the AST viewer', async ({ page }) => {
    // This test validates AddNode event and transition to S1_NodeAdded
    const astPage = new ASTPage(page);
    await astPage.navigate();

    // Add a node and verify it's appended to rootNode.children
    const added = await astPage.addNode('Expression', '42');

    expect(Array.isArray(added.children)).toBe(true);
    expect(added.children.length).toBe(1);
    expect(added.children[0].type).toBe('Expression');
    expect(added.children[0].value).toBe('42');

    // Also ensure renderAST updated the DOM text
    const viewerText = await astPage.getASTText();
    expect(viewerText).toContain('"type": "Expression"');
    expect(viewerText).toContain('"value": "42"');

    expect(pageErrors.length).toBe(0);
  });

  test('Change Node transition (S2_NodeChanged) - valid change updates node; invalid index shows alert', async ({ page }) => {
    // This test validates ChangeNode event with both success and error scenarios.
    const astPage = new ASTPage(page);
    await astPage.navigate();

    // Setup: add a node to change
    await astPage.addNode('Identifier', 'x');

    // Change the existing node at index 0
    await astPage.changeNode(0, 'Literal', '100');
    const afterChange = await astPage.getAST();
    expect(afterChange.children[0].type).toBe('Literal');
    expect(afterChange.children[0].value).toBe('100');

    // Now attempt to change with an out-of-range index and assert an alert is shown
    // Prepare to capture the dialog triggered by the invalid change
    const invalidChangePromise = page.waitForEvent('dialog');
    // Trigger change with invalid index (e.g., 5)
    await page.fill('#nodeIndex', '5');
    await page.fill('#newNodeType', 'Nope');
    await page.fill('#newNodeValue', 'Nothing');
    await page.click("button[onclick='changeNode()']");

    const dialog = await invalidChangePromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('Node index out of range');
    await dialog.accept();

    // Ensure AST remained unchanged after invalid attempt
    const finalAST = await astPage.getAST();
    expect(finalAST.children.length).toBe(1);
    expect(finalAST.children[0].type).toBe('Literal');
    expect(pageErrors.length).toBe(0);
  });

  test('Delete Node transition (S3_NodeDeleted) - valid deletion removes node; invalid index alerts', async ({ page }) => {
    // This test validates DeleteNode event and both success and error paths.
    const astPage = new ASTPage(page);
    await astPage.navigate();

    // Add two nodes
    await astPage.addNode('A', '1');
    await astPage.addNode('B', '2');

    let ast = await astPage.getAST();
    expect(ast.children.length).toBe(2);

    // Delete the first node (index 0)
    await astPage.deleteNode(0);
    ast = await astPage.getAST();
    expect(ast.children.length).toBe(1);
    // Remaining child should be what was originally at index 1
    expect(ast.children[0].type).toBe('B');
    expect(ast.children[0].value).toBe('2');

    // Attempt to delete with invalid index and assert alert
    const dialogPromise = page.waitForEvent('dialog');
    await page.fill('#nodeIndex', '10');
    await page.click("button[onclick='deleteNode()']");
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('Node index out of range');
    await dialog.accept();

    // Ensure AST unchanged after invalid deletion
    const finalAST = await astPage.getAST();
    expect(finalAST.children.length).toBe(1);
    expect(pageErrors.length).toBe(0);
  });

  test('Navigate to Child (S4_NavigatedToChild) and then Navigate to Parent (S5_NavigatedToParent) - child navigation updates currentNode and parent navigation alerts', async ({ page }) => {
    // This test validates navigating to a child sets currentNode to that child (S4),
    // and then attempting to navigate to parent triggers the not-implemented alert (S5).
    const astPage = new ASTPage(page);
    await astPage.navigate();

    // Add a parent-child: root -> child
    await astPage.addNode('Block', 'block1');

    // Confirm root has the child
    let ast = await astPage.getAST();
    expect(ast.children.length).toBe(1);
    expect(ast.children[0].type).toBe('Block');

    // Navigate into child at index 0
    await astPage.navigateToChild(0);

    // After navigating, renderAST prints currentNode (which is the child)
    const afterNav = await astPage.getAST();
    // Now the AST viewer should show the child as the "root" view: its type should be 'Block'
    expect(afterNav.type).toBe('Block');
    expect(afterNav.value).toBe('block1');

    // Now attempt to navigate to parent: this should trigger an alert stating it's not implemented
    const dialogPromise = page.waitForEvent('dialog');
    await page.click("button[onclick='navigateToParent()']");
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('Navigating to parent is not implemented in this structure.');
    await dialog.accept();

    // After accepting the alert, the currentNode remains the child (no parent navigation performed)
    const afterParentAttempt = await astPage.getAST();
    expect(afterParentAttempt.type).toBe('Block');
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: adding node with empty type/value and behavior observations', async ({ page }) => {
    // This test validates edge case handling for adding nodes with empty fields.
    const astPage = new ASTPage(page);
    await astPage.navigate();

    // Add a node with empty type and value
    await astPage.addNode('', '');

    const ast = await astPage.getAST();
    expect(ast.children.length).toBe(1);
    // Empty strings are valid values in the current implementation
    expect(ast.children[0].type).toBe('');
    expect(ast.children[0].value).toBe('');

    // The viewer should contain the empty string values in JSON form ("type": "")
    const viewerText = await astPage.getASTText();
    expect(viewerText).toContain('"type": ""');
    expect(viewerText).toContain('"value": ""');

    expect(pageErrors.length).toBe(0);
  });
});