import { test, expect } from '@playwright/test';

// Test file for Application ID: 324d11a3-fa73-11f0-a9d0-d7a1991987c6
// URL: http://127.0.0.1:5500/workspace/0126-balanced/html/324d11a3-fa73-11f0-a9d0-d7a1991987c6.html
//
// These tests exercise the FSM states and transitions described in the prompt:
// - S0_Idle (initial): page rendered with input#inputString (value "ban"), button to build
// - S1_TreeBuilt (final): clicking the button constructs SuffixTree and calls visualize()
// The tests load the page exactly as-is, observe console logs and page errors (without modification),
// and assert expected DOM changes and absence of runtime errors during normal operation.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324d11a3-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Suffix Tree page
class SuffixTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputString');
    this.buildButton = page.locator('button[onclick="buildSuffixTree()"]');
    this.treeContainer = page.locator('#tree');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getInputValue() {
    return await this.input.inputValue();
  }

  async setInputValue(value) {
    // Clear and type new value
    await this.input.fill('');
    await this.input.type(value);
  }

  async clickBuild() {
    await Promise.all([
      // Wait for potential DOM updates after clicking
      this.page.waitForTimeout(20), // small buffer; visualization is synchronous but we keep a small delay for stability
      this.buildButton.click()
    ]);
  }

  // Returns array of texts of nodes in the order they are appended
  async getTreeNodeTexts() {
    return await this.page.$$eval('#tree .node', nodes => nodes.map(n => n.textContent));
  }

  async getTreeNodeCount() {
    return await this.page.$$eval('#tree .node', nodes => nodes.length);
  }

  async getBuildButtonOnClickAttribute() {
    return await this.buildButton.getAttribute('onclick');
  }

  async clearTreeContainer() {
    // For observation only; do not modify runtime behavior; not used to patch the app.
    await this.page.evaluate(() => {
      const c = document.getElementById('tree');
      if (c) c.innerHTML = '';
    });
  }
}

test.describe('Suffix Tree Visualization - FSM-driven end-to-end tests', () => {
  // Collect console messages and page errors per test so we can assert them later.
  test.beforeEach(async ({ page }) => {
    page._consoleMessages = [];
    page._pageErrors = [];

    page.on('console', msg => {
      // store type and text for assertions
      page._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      page._pageErrors.push(error);
    });
  });

  // After each test assert that no unexpected page errors occurred.
  test.afterEach(async ({ page }) => {
    // Assert there were no uncaught page errors during the test.
    // If errors do occur naturally in the runtime, the test will fail here and surface them.
    expect(page._pageErrors.length).toBe(0);
    // Also assert there are no console messages of type 'error'
    const consoleErrors = page._consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Initial State (S0_Idle) validations', () => {
    test('Initial render shows input with default value and build button', async ({ page }) => {
      // Validate that the page renders the expected elements on load (Idle state)
      const app = new SuffixTreePage(page);
      await app.goto();

      // Verify input exists and has default value 'ban' per the HTML implementation
      const inputValue = await app.getInputValue();
      expect(inputValue).toBe('ban');

      // Verify build button exists and has the expected onclick handler attribute
      const onclickAttr = await app.getBuildButtonOnClickAttribute();
      expect(onclickAttr).toBe('buildSuffixTree()');

      // Verify tree container exists and is initially empty
      const initialCount = await app.getTreeNodeCount();
      expect(initialCount).toBe(0);
    });
  });

  test.describe('Transition: BuildSuffixTree (S0_Idle -> S1_TreeBuilt)', () => {
    test('Clicking Build Suffix Tree builds and visualizes the tree for "ban"', async ({ page }) => {
      // This test validates the transition actions:
      // - reads input value
      // - constructs SuffixTree(input)
      // - calls visualize() and updates DOM with nodes
      const app1 = new SuffixTreePage(page);
      await app.goto();

      // Ensure initial state
      expect(await app.getInputValue()).toBe('ban');

      // Click build and validate nodes created represent the expected traversal output
      await app.clickBuild();

      // For input "ban", the visualization algorithm appends nodes with texts:
      // ['b', 'ba', 'ban', 'a', 'an', 'n']
      const nodes = await app.getTreeNodeTexts();
      expect(nodes).toEqual(['b', 'ba', 'ban', 'a', 'an', 'n']);

      // Ensure number of nodes is exactly 6
      expect(await app.getTreeNodeCount()).toBe(6);
    });

    test('Subsequent clicks re-render (container cleared then populated) and no duplicate accumulation', async ({ page }) => {
      // Validate that calling buildSuffixTree multiple times replaces visualization (it calls container.innerHTML = '')
      const app2 = new SuffixTreePage(page);
      await app.goto();

      // First build
      await app.clickBuild();
      const firstNodes = await app.getTreeNodeTexts();
      expect(firstNodes.length).toBeGreaterThan(0);

      // Modify input to same value and build again; should result in same set, not appended duplicates
      await app.setInputValue('ban');
      await app.clickBuild();
      const secondNodes = await app.getTreeNodeTexts();

      // The visualization replaces tree.innerHTML, so counts should be equal, not doubled
      expect(secondNodes).toEqual(firstNodes);
      expect(await app.getTreeNodeCount()).toBe(firstNodes.length);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Empty input results in empty visualization and no runtime errors', async ({ page }) => {
      // This test ensures edge case handling: empty string should produce no nodes
      const app3 = new SuffixTreePage(page);
      await app.goto();

      // Set input to empty string and build
      await app.setInputValue('');
      await app.clickBuild();

      // No nodes should be created
      expect(await app.getTreeNodeCount()).toBe(0);

      // Also ensure no console errors were emitted (checked in afterEach)
    });

    test('Different input "aa" visualization correctness', async ({ page }) => {
      // Validate visualization correctness for input with repeating characters
      const app4 = new SuffixTreePage(page);
      await app.goto();

      await app.setInputValue('aa');
      await app.clickBuild();

      // For 'aa' expected nodes:
      // first suffix (i=0) adds 'a', 'aa'
      // second suffix (i=1) references existing root child 'a' and won't create duplicates
      const nodes1 = await app.getTreeNodeTexts();
      expect(nodes).toEqual(['a', 'aa']);
      expect(await app.getTreeNodeCount()).toBe(2);
    });
  });

  test.describe('Observability: Console and page error monitoring', () => {
    test('No console errors or uncaught exceptions during normal operations', async ({ page }) => {
      // This test purposefully performs sequences of operations while capturing console/page errors.
      // The beforeEach/afterEach handlers collect console messages and page errors; afterEach asserts none exist.
      const app5 = new SuffixTreePage(page);
      await app.goto();

      // Perform several interactions
      await app.clickBuild();
      await app.setInputValue('banana');
      await app.clickBuild();
      await app.setInputValue('');
      await app.clickBuild();
      await app.setInputValue('xyz');
      await app.clickBuild();

      // Also inspect console messages captured and assert no error-type messages exist.
      const errorConsoleMsgs = page._consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);

      // And ensure there were no page error events
      expect(page._pageErrors.length).toBe(0);

      // As a sanity check, ensure last visualization produced some (or zero) nodes consistently without errors
      const lastCount = await app.getTreeNodeCount();
      expect(typeof lastCount).toBe('number');
    });
  });
});