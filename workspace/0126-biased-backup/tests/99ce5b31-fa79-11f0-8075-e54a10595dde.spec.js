import { test, expect } from '@playwright/test';

// Test file: 99ce5b31-fa79-11f0-8075-e54a10595dde.spec.js
// URL under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/99ce5b31-fa79-11f0-8075-e54a10595dde.html

// Page Object Model for the AVL Tree Visualizer page
class AVLPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.valueInput = page.locator('#value');
    this.insertButton = page.locator("button[onclick='insertNode()']");
    this.removeButton = page.locator("button[onclick='removeNode()']");
    this.resetButton = page.locator("button[onclick='resetTree()']");
    this.tree = page.locator('#tree');
  }

  async goto(url) {
    await this.page.goto(url, { waitUntil: 'load' });
  }

  async fillValue(val) {
    await this.valueInput.fill(String(val));
  }

  async clickInsert() {
    await this.insertButton.click();
  }

  async clickRemove() {
    await this.removeButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async treeInnerHTML() {
    return this.page.evaluate(() => document.getElementById('tree').innerHTML);
  }
}

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ce5b31-fa79-11f0-8075-e54a10595dde.html';

test.describe('AVL Tree Visualizer - FSM states and transitions', () => {

  // Each test will collect console messages and page errors so we can assert expected runtime problems.
  test('Initial page load should present controls but page scripts may error (detect SyntaxError)', async ({ page }) => {
    // Collect console messages and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    const avl = new AVLPage(page);
    // Navigate to the page
    await avl.goto(APP_URL);

    // Validate presence of UI controls (Idle state evidence)
    await expect(avl.valueInput).toBeVisible();
    await expect(avl.insertButton).toBeVisible();
    await expect(avl.removeButton).toBeVisible();
    await expect(avl.resetButton).toBeVisible();
    await expect(avl.tree).toBeVisible();

    // Allow a short time for any synchronous script errors to be emitted to console/pageerror.
    await page.waitForTimeout(200);

    // Assert that a SyntaxError during script parsing is present in console or page errors.
    // The implementation contains an extra parenthesis which should produce a SyntaxError.
    const hasSyntaxErrorInConsole = consoleMessages.some(m => /syntaxerror/i.test(m.text()));
    const hasSyntaxErrorInPageError = pageErrors.some(m => /syntaxerror/i.test(m));

    // At least one of the sources should contain a SyntaxError. We assert that the page exhibits such an error.
    expect(hasSyntaxErrorInConsole || hasSyntaxErrorInPageError).toBe(true);

    // Additionally assert that the global helper functions/classes expected by the FSM are not defined.
    // Because of the SyntaxError the script likely did not successfully initialize avlTree or functions.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    const avlTreeType = await page.evaluate(() => typeof window.avlTree);
    // We expect these to NOT be properly defined as functions/objects.
    expect(renderPageType === 'undefined' || renderPageType === 'function' ? (renderPageType === 'undefined') : true).toBe(true);
    expect(avlTreeType === 'undefined').toBe(true);
  });

  test('Attempting Insert transition should result in runtime ReferenceError/No-ops and tree remains empty', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const avl = new AVLPage(page);
    await avl.goto(APP_URL);

    // Ensure Idle state UI present
    await expect(avl.insertButton).toBeVisible();
    await expect(avl.valueInput).toBeVisible();

    // Fill a value and click Insert (transition: S0_Idle -> S1_ValueInserted expected)
    await avl.fillValue(42);
    await avl.clickInsert();

    // Wait briefly for any console/page errors triggered by the onclick handler to surface.
    await page.waitForTimeout(200);

    // Collect evidence: because script has syntax/runtime issues, clicking should have produced an error.
    const hasReferenceError = consoleMessages.some(m => /referenceerror/i.test(m.text()) || /is not defined/i.test(m.text()))
      || pageErrors.some(m => /referenceerror/i.test(m) || /is not defined/i.test(m));
    expect(hasReferenceError).toBe(true);

    // The tree visual (#tree) should remain empty string because render was not executed.
    const treeHtml = await avl.treeInnerHTML();
    expect(treeHtml).toBe('');
  });

  test('Attempting Remove transition should result in runtime ReferenceError/No-ops and tree remains empty', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const avl = new AVLPage(page);
    await avl.goto(APP_URL);

    // Fill a value and click Remove (transition: S0_Idle -> S2_ValueRemoved expected)
    await avl.fillValue(42);
    await avl.clickRemove();

    await page.waitForTimeout(200);

    // Expect ReferenceError related to removeNode or avlTree
    const hasReferenceError = consoleMessages.some(m => /referenceerror/i.test(m.text()) || /is not defined/i.test(m.text()))
      || pageErrors.some(m => /referenceerror/i.test(m) || /is not defined/i.test(m));
    expect(hasReferenceError).toBe(true);

    // Tree should still be empty
    const treeHtml = await avl.treeInnerHTML();
    expect(treeHtml).toBe('');
  });

  test('Attempting Reset transition should result in runtime ReferenceError/No-ops and tree remains empty', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const avl = new AVLPage(page);
    await avl.goto(APP_URL);

    // Click Reset (transition: S0_Idle -> S3_TreeReset expected)
    await avl.clickReset();

    await page.waitForTimeout(200);

    // Expect runtime error due to missing resetTree/avlTree
    const hasReferenceError = consoleMessages.some(m => /referenceerror/i.test(m.text()) || /is not defined/i.test(m.text()))
      || pageErrors.some(m => /referenceerror/i.test(m) || /is not defined/i.test(m));
    expect(hasReferenceError).toBe(true);

    // Tree should remain empty
    const treeHtml = await avl.treeInnerHTML();
    expect(treeHtml).toBe('');
  });

  test('Edge cases: empty input and invalid input should not create tree nodes; errors still surfaced due to broken script', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const avl = new AVLPage(page);
    await avl.goto(APP_URL);

    // Case 1: empty input + Insert click
    await avl.valueInput.fill('');
    await avl.clickInsert();
    await page.waitForTimeout(100);

    // Case 2: set a non-numeric string via JS evaluation (simulating an edge attempt)
    // Note: input[type=number] usually sanitizes, but we attempt to set via JS to probe behavior.
    await page.evaluate(() => {
      const input = document.getElementById('value');
      if (input) input.value = 'not-a-number';
    });
    await avl.clickInsert();
    await page.waitForTimeout(100);

    // Because the page scripts failed, we expect errors to be present for the onclick handler (ReferenceError)
    const hasError = consoleMessages.some(m => /referenceerror|typeerror|syntaxerror/i.test(m.text()))
      || pageErrors.some(m => /referenceerror|typeerror|syntaxerror/i.test(m));
    expect(hasError).toBe(true);

    // And tree remains unchanged/empty
    const treeHtml = await avl.treeInnerHTML();
    expect(treeHtml).toBe('');
  });

  test('Verify FSM-related functions or names referenced in FSM are absent when script fails (renderPage, avlTree, insertNode)', async ({ page }) => {
    const avl = new AVLPage(page);
    await avl.goto(APP_URL);

    // Validate that renderPage was not defined (the FSM expected renderPage() as an entry action in S0)
    const renderPageExists = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(renderPageExists).toBe(false);

    // Validate that avlTree object is not properly constructed
    const avlTreeExists = await page.evaluate(() => typeof window.avlTree !== 'object' && typeof window.avlTree !== 'function');
    expect(avlTreeExists).toBe(true);

    // Validate that insertNode/removeNode/resetTree functions are not available
    const insertNodeType = await page.evaluate(() => typeof window.insertNode);
    const removeNodeType = await page.evaluate(() => typeof window.removeNode);
    const resetTreeType = await page.evaluate(() => typeof window.resetTree);

    // Expect them to be 'undefined' (script didn't define them due to SyntaxError)
    expect(insertNodeType).toBe('undefined');
    expect(removeNodeType).toBe('undefined');
    expect(resetTreeType).toBe('undefined');
  });

});