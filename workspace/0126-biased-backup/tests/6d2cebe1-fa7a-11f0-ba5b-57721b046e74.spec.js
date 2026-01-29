import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2cebe1-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the Multiset app
class MultisetPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Common selectors
    this.elementInput = page.locator('#elementInput');
    this.countInput = page.locator('#countInput');
    this.multisetDisplay = page.locator('#multisetDisplay');
    this.propertiesDisplay = page.locator('#propertiesDisplay');
    this.randomSize = page.locator('#randomSize');
    this.importInput = page.locator('#importInput');
    this.findInput = page.locator('#findInput');
    this.filterInput = page.locator('#filterInput');
    this.secondMultisetInput = page.locator('#secondMultisetInput');
    this.historyDisplay = page.locator('#historyDisplay');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setElement(value) {
    await this.elementInput.fill(value);
  }

  async setCount(value) {
    await this.countInput.fill(String(value));
  }

  async clickAdd() {
    await this.page.click("button[onclick='addElement()']");
  }

  async clickRemove() {
    await this.page.click("button[onclick='removeElement()']");
  }

  async clickSetCount() {
    await this.page.click("button[onclick='setElementCount()']");
  }

  async clickRemoveAllOf() {
    await this.page.click("button[onclick='removeAllOfElement()']");
  }

  async clickClearMultiset() {
    await this.page.click("button[onclick='clearMultiset()']");
  }

  async clickRandomize() {
    await this.page.click("button[onclick='randomizeMultiset()']");
  }

  async setRandomSize(n) {
    await this.randomSize.fill(String(n));
  }

  async setImportInput(s) {
    await this.importInput.fill(s);
  }

  async clickImport() {
    await this.page.click("button[onclick='importMultiset()']");
  }

  async clickCalculateProperties() {
    await this.page.click("button[onclick='calculateProperties()']");
  }

  async setFindInput(s) {
    await this.findInput.fill(s);
  }

  async clickFindElement() {
    await this.page.click("button[onclick='findElement()']");
  }

  async clickSortByElement() {
    await this.page.click("button[onclick='sortByElement()']");
  }

  async clickSortByCount() {
    await this.page.click("button[onclick='sortByCount()']");
  }

  async setFilterInput(s) {
    await this.filterInput.fill(s);
  }

  async clickFilterElements() {
    await this.page.click("button[onclick='filterElements()']");
  }

  async setSecondMultisetInput(s) {
    await this.secondMultisetInput.fill(s);
  }

  async clickUnion() {
    await this.page.click("button[onclick='unionOperation()']");
  }

  async clickIntersection() {
    await this.page.click("button[onclick='intersectionOperation()']");
  }

  async clickSum() {
    await this.page.click("button[onclick='sumOperation()']");
  }

  async clickDifference() {
    await this.page.click("button[onclick='differenceOperation()']");
  }

  async clickUndo() {
    await this.page.click("button[onclick='undo()']");
  }

  async clickRedo() {
    await this.page.click("button[onclick='redo()']");
  }

  async clickClearHistory() {
    await this.page.click("button[onclick='clearHistory()']");
  }

  async getDisplayText() {
    return (await this.multisetDisplay.innerText()).trim();
  }

  async getPropertiesText() {
    return (await this.propertiesDisplay.innerText()).trim();
  }

  async getHistoryText() {
    return (await this.historyDisplay.innerText()).trim();
  }
}

// Helper to capture console errors and page errors for each test
async function attachErrorCollectors(page) {
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err);
  });

  return {
    getConsoleErrors: () => consoleErrors,
    getPageErrors: () => pageErrors
  };
}

test.describe('Interactive Multiset Explorer - FSM coverage', () => {

  test('Initialization: on DOMContentLoaded updateDisplay called and no runtime errors', async ({ page }) => {
    // Collect runtime errors and console errors
    const collectors = await attachErrorCollectors(page);
    const app = new MultisetPage(page);
    await app.goto();

    // After load, updateDisplay() is attached to DOMContentLoaded: expect multiset to be initialized
    const display = await app.getDisplayText();
    // The initial display should show Multiset {} (empty)
    expect(display).toContain('Multiset');

    // CalculateProperties is also called on DOMContentLoaded, so properties area should exist and contain "Size"
    const props = await app.getPropertiesText();
    expect(props).toMatch(/Size/i);

    // Assert there are no uncaught page errors or console error messages
    expect(collectors.getPageErrors()).toHaveLength(0);
    expect(collectors.getConsoleErrors()).toHaveLength(0);
  });

  test.describe('Element operations', () => {

    test('AddElement, RemoveElement, SetCount, RemoveAllOf produce correct display updates and history entries', async ({ page }) => {
      const collectors = await attachErrorCollectors(page);
      const app = new MultisetPage(page);
      await app.goto();

      // Ensure starting clean
      await app.clickClearMultiset();
      await app.clickClearHistory();

      // Add element 'x' count 2
      await app.setElement('x');
      await app.setCount(2);
      await app.clickAdd();
      let disp = await app.getDisplayText();
      expect(disp).toContain('x:2');

      // Remove 1 instance -> should become x:1
      await app.setCount(1);
      await app.clickRemove();
      disp = await app.getDisplayText();
      expect(disp).toContain('x:1');

      // Set count explicitly to 5
      await app.setCount(5);
      await app.clickSetCount();
      disp = await app.getDisplayText();
      expect(disp).toContain('x:5');

      // Remove all of x
      await app.clickRemoveAllOf();
      disp = await app.getDisplayText();
      // Multiset should be empty now
      expect(disp).toMatch(/Multiset\s*\{\}/);

      // Verify history contains entries (we used saveState internally)
      await app.clickClearHistory(); // reinitialize history to current state
      const historyText = await app.getHistoryText();
      expect(historyText).toContain('Step 1');

      // No runtime errors
      expect(collectors.getPageErrors()).toHaveLength(0);
      expect(collectors.getConsoleErrors()).toHaveLength(0);
    });

    test('Edge cases: adding empty element or removing non-existent element are no-ops', async ({ page }) => {
      const collectors = await attachErrorCollectors(page);
      const app = new MultisetPage(page);
      await app.goto();

      // Start fresh
      await app.clickClearMultiset();
      await app.clickClearHistory();

      // Attempt to add with empty element input
      await app.setElement('');
      await app.setCount(5);
      await app.clickAdd();
      let disp = await app.getDisplayText();
      expect(disp).toMatch(/Multiset\s*\{\}/);

      // Attempt to remove a non-existing element
      await app.setElement('nonexistent');
      await app.setCount(2);
      await app.clickRemove(); // should be a no-op and not throw
      disp = await app.getDisplayText();
      expect(disp).toMatch(/Multiset\s*\{\}/);

      // No runtime errors
      expect(collectors.getPageErrors()).toHaveLength(0);
      expect(collectors.getConsoleErrors()).toHaveLength(0);
    });

  });

  test.describe('Bulk operations and import/randomize', () => {

    test('ClearMultiset, Randomize, Import update the multiset display appropriately', async ({ page }) => {
      const collectors = await attachErrorCollectors(page);
      const app = new MultisetPage(page);
      await app.goto();

      // Clear any existing data
      await app.clickClearMultiset();

      // Import a known multiset
      await app.setImportInput('a:2,b:3');
      await app.clickImport();
      let disp = await app.getDisplayText();
      expect(disp).toContain('a:2');
      expect(disp).toContain('b:3');

      // Clear multiset
      await app.clickClearMultiset();
      disp = await app.getDisplayText();
      expect(disp).toMatch(/Multiset\s*\{\}/);

      // Randomize with known small size -> should produce non-empty multiset
      await app.setRandomSize(3);
      await app.clickRandomize();
      disp = await app.getDisplayText();
      // Randomize should create at least one element
      expect(disp).toMatch(/Multiset\s*\{.*\}/);

      // Import with invalid entry should ignore bad pairs (no exception thrown)
      await app.clickClearMultiset();
      await app.setImportInput('a:2,b:two,c:0,d:3');
      await app.clickImport();
      disp = await app.getDisplayText();
      // 'a:2' and 'd:3' should be present; 'b:two' ignored; 'c:0' ignored
      expect(disp).toContain('a:2');
      expect(disp).toContain('d:3');
      expect(disp).not.toContain('b:');
      expect(disp).not.toContain('c:0');

      // No runtime errors
      expect(collectors.getPageErrors()).toHaveLength(0);
      expect(collectors.getConsoleErrors()).toHaveLength(0);
    });

  });

  test.describe('Properties and find operation', () => {

    test('CalculateProperties computes size, cardinality and support; findElement shows alert with count', async ({ page }) => {
      const collectors = await attachErrorCollectors(page);
      const app = new MultisetPage(page);
      await app.goto();

      // Ensure a known state via import
      await app.setImportInput('a:2,b:3,c:1');
      await app.clickImport();

      // Calculate properties (also automatically called on updateDisplay)
      await app.clickCalculateProperties();
      const props = await app.getPropertiesText();
      expect(props).toMatch(/Size \(total count\):\s*6/); // 2+3+1
      expect(props).toMatch(/Cardinality \(distinct elements\):\s*3/);
      expect(props).toMatch(/Support:/);

      // Find element 'b' -> should trigger an alert dialog with count 3
      let dialogMessage = '';
      page.on('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });

      await app.setFindInput('b');
      await app.clickFindElement();

      // Wait a tick for dialog handler
      await page.waitForTimeout(50);
      expect(dialogMessage).toContain('b');
      expect(dialogMessage).toContain('3');

      // No runtime errors
      expect(collectors.getPageErrors()).toHaveLength(0);
      expect(collectors.getConsoleErrors()).toHaveLength(0);
    });
  });

  test.describe('Sorting and filtering operations', () => {

    test('Sort by element (lexicographic) and by count (descending) reflect in display; filter removes low-count items', async ({ page }) => {
      const collectors = await attachErrorCollectors(page);
      const app = new MultisetPage(page);
      await app.goto();

      // Import a dataset
      await app.setImportInput('b:1,a:3,c:2');
      await app.clickImport();

      // Sort by element -> expects lexicographic a,b,c
      await app.clickSortByElement();
      let disp = await app.getDisplayText();
      // Expect the sequence "a:3, b:1, c:2" or without spaces; check order by index
      const dispText = disp.replace(/\s/g, '');
      const idxA = dispText.indexOf('a:3');
      const idxB = dispText.indexOf('b:1');
      const idxC = dispText.indexOf('c:2');
      expect(idxA).toBeGreaterThan(-1);
      expect(idxB).toBeGreaterThan(-1);
      expect(idxC).toBeGreaterThan(-1);
      expect(idxA).toBeLessThan(idxB);
      expect(idxB).toBeLessThan(idxC);

      // Sort by count -> expects descending by count: a:3, c:2, b:1
      await app.clickSortByCount();
      disp = await app.getDisplayText();
      const dispText2 = disp.replace(/\s/g, '');
      const ia = dispText2.indexOf('a:3');
      const ic = dispText2.indexOf('c:2');
      const ib = dispText2.indexOf('b:1');
      expect(ia).toBeLessThan(ic);
      expect(ic).toBeLessThan(ib);

      // Filter elements with min count 2 -> keep a:3 and c:2
      await app.setFilterInput('2');
      await app.clickFilterElements();
      disp = await app.getDisplayText();
      expect(disp).toContain('a:3');
      expect(disp).toContain('c:2');
      expect(disp).not.toContain('b:1');

      // Filter with invalid input should be a no-op (function returns early)
      const before = disp;
      await app.setFilterInput('notanumber');
      await app.clickFilterElements();
      const after = await app.getDisplayText();
      expect(after).toBe(before);

      // No runtime errors
      expect(collectors.getPageErrors()).toHaveLength(0);
      expect(collectors.getConsoleErrors()).toHaveLength(0);
    });

  });

  test.describe('Two-multiset operations: union, intersection, sum, difference', () => {

    test('Union merges with max counts; intersection uses min counts; sum adds counts; difference subtracts', async ({ page }) => {
      const collectors = await attachErrorCollectors(page);
      const app = new MultisetPage(page);
      await app.goto();

      // Base multiset
      await app.setImportInput('a:2,b:1,c:1');
      await app.clickImport();

      // Prepare second multiset
      await app.setSecondMultisetInput('a:3,b:2,d:4');

      // Union -> max counts: a:3,b:2,c:1,d:4
      await app.clickUnion();
      let disp = await app.getDisplayText();
      expect(disp).toContain('a:3');
      expect(disp).toContain('b:2');
      expect(disp).toContain('c:1');
      expect(disp).toContain('d:4');

      // Re-import base and compute intersection -> only a,b with min counts 2 and 1
      await app.setImportInput('a:2,b:1,c:1');
      await app.clickImport();
      await app.setSecondMultisetInput('a:3,b:2,d:4');
      await app.clickIntersection();
      disp = await app.getDisplayText();
      expect(disp).toContain('a:2');
      expect(disp).toContain('b:1');
      expect(disp).not.toContain('c:');
      expect(disp).not.toContain('d:');

      // Re-import and sum -> counts should be added: a:5,b:3,c:1,d:4
      await app.setImportInput('a:2,b:1,c:1');
      await app.clickImport();
      await app.setSecondMultisetInput('a:3,b:2,d:4');
      await app.clickSum();
      disp = await app.getDisplayText();
      expect(disp).toContain('a:5');
      expect(disp).toContain('b:3');
      expect(disp).toContain('c:1');
      expect(disp).toContain('d:4');

      // Re-import and difference -> only c:1 should remain (2-3 -> removed, 1-2 -> removed, c:1 stays)
      await app.setImportInput('a:2,b:1,c:1');
      await app.clickImport();
      await app.setSecondMultisetInput('a:3,b:2,d:4');
      await app.clickDifference();
      disp = await app.getDisplayText();
      expect(disp).toContain('c:1');
      expect(disp).not.toContain('a:');
      expect(disp).not.toContain('b:');

      // Edge: two-multiset ops with empty second input should do nothing and not throw
      await app.setImportInput('x:1');
      await app.clickImport();
      await app.setSecondMultisetInput('');
      await app.clickUnion(); // should be a no-op
      disp = await app.getDisplayText();
      expect(disp).toContain('x:1');

      // No runtime errors
      expect(collectors.getPageErrors()).toHaveLength(0);
      expect(collectors.getConsoleErrors()).toHaveLength(0);
    });

  });

  test.describe('History operations: undo, redo, clearHistory', () => {

    test('Undo and redo navigate history and clearHistory resets it', async ({ page }) => {
      const collectors = await attachErrorCollectors(page);
      const app = new MultisetPage(page);
      await app.goto();

      // Ensure clean start
      await app.clickClearMultiset();
      await app.clickClearHistory();

      // Add 'p' then 'q' so there are multiple history steps
      await app.setElement('p');
      await app.setCount(1);
      await app.clickAdd();

      await app.setElement('q');
      await app.setCount(2);
      await app.clickAdd();

      // History should show multiple steps and the current one should reflect both p and q
      let historyText = await app.getHistoryText();
      expect(historyText).toMatch(/Step 1/);
      expect(historyText).toMatch(/Step 2/);
      expect(historyText).toMatch(/Step 3/);

      // Undo once -> should remove 'q' from display
      await app.clickUndo();
      let disp = await app.getDisplayText();
      expect(disp).toContain('p:1');
      expect(disp).not.toContain('q:2');

      // Redo -> 'q' returns
      await app.clickRedo();
      disp = await app.getDisplayText();
      expect(disp).toContain('p:1');
      expect(disp).toContain('q:2');

      // Clear history -> history should be reset to a single current state
      await app.clickClearHistory();
      historyText = await app.getHistoryText();
      // Only one step should be present (Step 1 (current))
      expect(historyText).toMatch(/Step 1/);
      // No "Step 2" should remain after clearHistory
      expect(historyText).not.toMatch(/Step 2/);

      // No runtime errors
      expect(collectors.getPageErrors()).toHaveLength(0);
      expect(collectors.getConsoleErrors()).toHaveLength(0);
    });

  });

  test.describe('Edge cases and robustness checks', () => {

    test('Setting count to zero removes element; parse functions ignore invalid pairs', async ({ page }) => {
      const collectors = await attachErrorCollectors(page);
      const app = new MultisetPage(page);
      await app.goto();

      // Import some elements
      await app.setImportInput('z:3');
      await app.clickImport();

      // Set count to zero using setElementCount -> should remove the element
      await app.setElement('z');
      await app.setCount(0);
      await app.clickSetCount();
      let disp = await app.getDisplayText();
      expect(disp).toMatch(/Multiset\s*\{\}/);

      // Try importing completely invalid string -> no change, no crash
      await app.setImportInput('notvalidstring');
      await app.clickImport();
      disp = await app.getDisplayText();
      // still empty
      expect(disp).toMatch(/Multiset\s*\{\}/);

      // No runtime errors
      expect(collectors.getPageErrors()).toHaveLength(0);
      expect(collectors.getConsoleErrors()).toHaveLength(0);
    });

  });

  // Final test to ensure no unexpected runtime errors were emitted during a typical scenario
  test('Run through a typical scenario and ensure no ReferenceError/SyntaxError/TypeError were thrown', async ({ page }) => {
    const collectors = await attachErrorCollectors(page);
    const app = new MultisetPage(page);
    await app.goto();

    // Perform a sequence of operations exercising many code paths
    await app.clickClearMultiset();
    await app.clickClearHistory();
    await app.setElement('alpha');
    await app.setCount(2);
    await app.clickAdd();

    await app.setSecondMultisetInput('alpha:1,beta:4');
    await app.clickSum();

    await app.setFilterInput('2');
    await app.clickFilterElements();

    await app.clickSortByElement();
    await app.clickSortByCount();

    await app.clickRandomize();
    await app.setRandomSize(2);
    await app.clickRandomize();

    // Attempt to find an element that may or may not exist -> dialog handled if present
    page.on('dialog', async dialog => { await dialog.dismiss(); });

    await app.setFindInput('alpha');
    await app.clickFindElement();

    // Undo/redo a few times to exercise history boundaries
    await app.clickUndo();
    await app.clickRedo();

    // Final assertions: no uncaught page errors and no console errors observed
    const pageErrors = collectors.getPageErrors();
    const consoleErrors = collectors.getConsoleErrors();

    // We expect no uncaught exceptions (ReferenceError, TypeError, SyntaxError) during normal usage.
    // If any such errors exist they will be included in pageErrors; assert none are present.
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

});