import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/176450a0-d5c1-11f0-938c-19d14b60ef51.html';

// Page Object Model for the Topological Sort page
class TopoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure main elements are present
    await Promise.all([
      this.page.waitForSelector('h1'),
      this.page.waitForSelector('.vertex'),
      this.page.waitForSelector('button'),
      this.page.waitForSelector('#result')
    ]);
  }

  async getHeaderText() {
    return (await this.page.locator('h1').innerText()).trim();
  }

  async getVertexByLabel(label) {
    return this.page.locator(`.vertex`, { hasText: label });
  }

  async clickVertex(label) {
    const v = await this.getVertexByLabel(label);
    await v.click();
  }

  async isVertexSelected(label) {
    const v = await this.getVertexByLabel(label);
    return await v.evaluate(el => el.classList.contains('selected'));
  }

  async getSelectedLabels() {
    const elements = await this.page.locator('.vertex.selected').allInnerTexts();
    return elements.map(s => s.trim());
  }

  async clickPerformSort() {
    await this.page.locator('button', { hasText: 'Perform Topological Sort' }).click();
  }

  async getResultText() {
    return (await this.page.locator('#result').innerText()).trim();
  }

  // Helper to clear selections by clicking selected vertices (used for tests)
  async clearAllSelections() {
    const selected = this.page.locator('.vertex.selected');
    const count = await selected.count();
    for (let i = 0; i < count; i++) {
      // Always click the first selected (the list updates as we click)
      await this.page.locator('.vertex.selected').first().click();
    }
  }
}

test.describe('Topological Sort Visualization - FSM tests', () => {
  // Arrays to capture page errors and console messages for each test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture page errors (unhandled exceptions in page)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages for debugging and assertions
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the app
    const topo = new TopoPage(page);
    await topo.goto();
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright's automatic cleanup.
    // We keep the captured pageErrors/consoleMessages available to each test via closure.
  });

  test('S0_Idle: Page renders initial Idle state correctly', async ({ page }) => {
    // Validate initial render (entry action renderPage() implied)
    const topo = new TopoPage(page);

    // Comment: Validate header presence and content (evidence for Idle state)
    const header = await topo.getHeaderText();
    expect(header).toBe('Topological Sort Visualization');

    // Comment: No vertices should be selected initially
    const selected = await topo.getSelectedLabels();
    expect(selected).toEqual([]);

    // Comment: Result should be empty at idle
    const result = await topo.getResultText();
    expect(result).toBe('');

    // Comment: Ensure no runtime page errors were emitted on initial load
    expect(Array.isArray(pageErrors)).toBeTruthy();
    expect(pageErrors.length).toBe(0);

    // Console may have benign messages; ensure captured structure is as expected
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  test('S1_VertexSelected: Clicking vertices toggles selected class (select/deselect)', async ({ page }) => {
    const topo = new TopoPage(page);

    // Comment: Click vertex A to select it (transition S0 -> S1)
    await topo.clickVertex('A');
    let isSelected = await topo.isVertexSelected('A');
    expect(isSelected).toBe(true);

    // Comment: Clicking again should deselect A (toggle)
    await topo.clickVertex('A');
    isSelected = await topo.isVertexSelected('A');
    expect(isSelected).toBe(false);

    // Comment: Select multiple vertices and verify class added
    await topo.clickVertex('B');
    await topo.clickVertex('C');
    const selectedLabels = await topo.getSelectedLabels();
    // Order of selectedLabels corresponds to DOM order; ensure both B and C are present
    expect(selectedLabels.sort()).toEqual(['B', 'C'].sort());

    // Clean up selections for subsequent tests
    await topo.clearAllSelections();

    // Ensure no page errors occurred as a result of interactions
    expect(pageErrors.length).toBe(0);
  });

  test('S2_Sorting: Performing topological sort displays result for selected vertices', async ({ page }) => {
    const topo = new TopoPage(page);

    // Comment: Select vertex A and perform topological sort (transition S1 -> S2)
    await topo.clickVertex('A');

    // Keep selection verified pre-sort
    expect(await topo.isVertexSelected('A')).toBe(true);

    // Perform the sort
    await topo.clickPerformSort();

    // Comment: Verify result text updated (evidence: innerText assignment)
    await page.waitForSelector('#result'); // should already exist, but wait for change
    const resultText = await topo.getResultText();
    expect(resultText.startsWith('Topological Sort:')).toBeTruthy();

    // Comment: The result should include the selected vertex 'A' (since we started from A)
    expect(resultText.includes('A')).toBeTruthy();

    // Comment: Verify that selections remain (implementation does not clear them)
    expect(await topo.isVertexSelected('A')).toBe(true);

    // Ensure no runtime page errors emitted during sorting
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Performing sort with no selection yields empty result', async ({ page }) => {
    const topo = new TopoPage(page);

    // Ensure no vertices are selected
    await topo.clearAllSelections();
    const beforeSelected = await topo.getSelectedLabels();
    expect(beforeSelected).toEqual([]);

    // Perform sort
    await topo.clickPerformSort();

    // Result should be exactly "Topological Sort: " (no vertices)
    const result = await topo.getResultText();
    expect(result).toBe('Topological Sort:');

    // No page errors should occur
    expect(pageErrors.length).toBe(0);
  });

  test('S2 -> S0 transition: Click after sorting toggles selection and returns to interactive idle-like behavior', async ({ page }) => {
    const topo = new TopoPage(page);

    // Select A then perform sort
    await topo.clickVertex('A');
    expect(await topo.isVertexSelected('A')).toBe(true);
    await topo.clickPerformSort();

    // Now clicking another vertex should toggle its selection (FSM suggests a return to idle)
    await topo.clickVertex('B');
    expect(await topo.isVertexSelected('B')).toBe(true);

    // Click B again to deselect it to prove toggling works post-sort
    await topo.clickVertex('B');
    expect(await topo.isVertexSelected('B')).toBe(false);

    // The result should remain present (there is no renderPage implementation to clear it)
    const resultText = await topo.getResultText();
    expect(resultText.startsWith('Topological Sort:')).toBeTruthy();

    // No unexpected page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Error scenario: Trigger a ReferenceError in page context and assert it is observed', async ({ page }) => {
    // Note: This test intentionally invokes a non-existent function in the page context.
    // It is used to validate the test harness captures runtime page errors (edge case).
    let caught = null;

    // Attempt to call a function that does not exist in the page (should produce a ReferenceError)
    try {
      // The evaluate will reject; we catch it so the test can continue to assert the pageerror event captured it.
      await page.evaluate(() => {
        // Intentionally call an undefined symbol to create a ReferenceError
        // This is executed inside the page environment and will generate a pageerror event.
        // eslint-disable-next-line no-undef
        nonExistentFunctionTriggeringRefError();
      });
    } catch (err) {
      // Playwright surfaces the exception in the test context; store it for assertions
      caught = err;
    }

    // Allow a brief tick for pageerror handler to populate
    await page.waitForTimeout(100);

    // The evaluate call should have thrown an error in the test context
    expect(caught).not.toBeNull();

    // The pageerror listener should have captured at least one error (ReferenceError)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Inspect captured page errors to ensure one is a ReferenceError
    const hasReferenceError = pageErrors.some(err => err && err.message && /ReferenceError|not is defined|not defined|is not defined/i.test(err.message));
    expect(hasReferenceError).toBeTruthy();

    // The console messages may include the error depending on the browser; ensure we captured console events as well
    const consoleContainsError = consoleMessages.some(m => /ReferenceError|nonExistentFunctionTriggeringRefError|is not defined/i.test(m.text));
    // We accept either presence or absence of console echo, but record the observation via assertion that our arrays exist
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });
});