import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b29710-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator("button[onclick='runDemo()']");
    this.output = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async isRunButtonVisible() {
    return await this.runButton.isVisible();
  }

  async getRunButtonText() {
    return await this.runButton.innerText();
  }

  async isOutputVisible() {
    return await this.output.isVisible();
  }

  async getOutputDisplayStyle() {
    // get computed style display value
    return await this.page.evaluate(() => {
      const el = document.getElementById('demo-output');
      if (!el) return null;
      return window.getComputedStyle(el).display;
    });
  }

  async clickRun() {
    await this.runButton.click();
  }

  async getEdgesListItems() {
    // returns array of textContent for each edge list item in the demo output
    return await this.output.locator('ul').first().locator('li').allInnerTexts();
  }

  async getResultsTableRows() {
    // returns array of row texts excluding header
    return await this.output.$$eval('table tr', (rows) =>
      rows.slice(1).map((r) => Array.from(r.querySelectorAll('td')).map((td) => td.textContent.trim()))
    );
  }

  async hasWarning() {
    return await this.output.locator('.warning').count() > 0;
  }

  async hasNote() {
    return await this.output.locator('.note').count() > 0;
  }

  async getNoteText() {
    const note = this.output.locator('.note');
    if (await note.count() === 0) return null;
    return await note.innerText();
  }
}

test.describe('Bellman-Ford Algorithm Explained - Interactive Demo (f0b29710...)', () => {
  // Arrays to hold console messages and uncaught page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      // store type and text for inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions (page errors)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('Initial Idle state: Run Demonstration button present and demo output hidden; no runtime errors on load', async ({ page }) => {
    // This test validates the S0_Idle state described in the FSM:
    // - The Run Demonstration button should be present
    // - The demo output should be hidden (display: none)
    // - There should be no uncaught exceptions on page load
    const demo = new DemoPage(page);
    await demo.goto();

    // Verify runDemo function is defined on the window (implementation provides it)
    const runDemoType = await page.evaluate(() => typeof window.runDemo);
    expect(runDemoType).toBe('function');

    // Button presence and text
    expect(await demo.isRunButtonVisible()).toBeTruthy();
    expect(await demo.getRunButtonText()).toBe('Run Demonstration');

    // Demo output should start hidden per HTML (display: none)
    const display = await demo.getOutputDisplayStyle();
    expect(display).toBe('none');

    // Ensure no uncaught page errors happened during load
    expect(pageErrors.length).toBe(0);

    // Ensure no console error-level messages were emitted during load
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition RunDemo: clicking the button shows demo output and populates edges, table and note (S1_DemoRunning)', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_DemoRunning when the Run Demonstration button is clicked.
    // It checks the entry action evidence (runDemo displays output), checks that the output contains:
    // - Graph edges list with the expected number of edges
    // - Results table with expected distances and reconstructed paths
    // - A "No negative weight cycles detected." note (no warning)
    const demo = new DemoPage(page);
    await demo.goto();

    // Precondition: no errors before interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.filter((m) => m.type === 'error').length).toBe(0);

    // Click to run the demo
    await demo.clickRun();

    // After clicking, output should be visible (entry action in FSM sets display = 'block')
    await expect(demo.output).toBeVisible();
    const displayAfter = await demo.getOutputDisplayStyle();
    expect(displayAfter).toBe('block');

    // Validate edges: the demo defines 5 edges in the script; ensure list contains 5 items
    const edges = await demo.getEdgesListItems();
    expect(edges.length).toBe(5);
    // Basic content check: first edge should mention "A → B (weight: 4)" or similar
    expect(edges[0]).toContain('A');
    expect(edges[0]).toContain('B');

    // Validate results table rows (vertices A, B, C, D) and their distances/paths
    const rows = await demo.getResultsTableRows();
    // Expect 4 data rows for A, B, C, D
    expect(rows.length).toBe(4);

    // Map rows into an object keyed by vertex for easier assertions
    const results = {};
    for (const row of rows) {
      // row is [Vertex, Distance, Path]
      const [vertex, distanceText, pathText] = row;
      // distanceText should be parseable to number or 'Infinity'
      const distance = distanceText === 'Infinity' ? Infinity : Number(distanceText);
      results[vertex] = { distance, path: pathText };
    }

    // Expected distances for the given demo graph from source A:
    // A:0, B:4, C:2, D:4
    expect(results['A']).toBeDefined();
    expect(results['B']).toBeDefined();
    expect(results['C']).toBeDefined();
    expect(results['D']).toBeDefined();

    expect(results['A'].distance).toBe(0);
    expect(results['B'].distance).toBe(4);
    expect(results['C'].distance).toBe(2);
    expect(results['D'].distance).toBe(4);

    // Expected reconstructed paths:
    // A -> "A"
    // B -> "A → B"
    // C -> "A → B → C"
    // D -> "A → B → C → D"
    expect(results['A'].path).toBe('A');
    expect(results['B'].path).toBe('A → B');
    expect(results['C'].path).toBe('A → B → C');
    expect(results['D'].path).toBe('A → B → C → D');

    // Confirm that the demo reports "No negative weight cycles detected." via the .note element
    expect(await demo.hasNote()).toBeTruthy();
    expect(await demo.hasWarning()).toBeFalsy();
    const noteText = await demo.getNoteText();
    expect(noteText).toMatch(/No negative weight cycles detected/i);

    // Ensure no uncaught exceptions or console errors occurred as a result of running the demo
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Idempotence and robustness: multiple rapid clicks do not duplicate content or throw errors', async ({ page }) => {
    // This test checks an edge case where the user clicks the Run Demonstration button multiple times quickly.
    // The implementation appends to innerHTML each time, but it replaces the innerHTML fully, so content should remain stable.
    // We ensure no uncaught errors occur and the output remains consistent after repeated interactions.
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure runDemo exists
    const runType = await page.evaluate(() => typeof window.runDemo);
    expect(runType).toBe('function');

    // Rapidly click the button 3 times
    await Promise.all([
      demo.clickRun(),
      demo.clickRun(),
      demo.clickRun()
    ]);

    // Wait for the output to be visible
    await expect(demo.output).toBeVisible();

    // Validate edges list and results remain the expected counts
    const edges = await demo.getEdgesListItems();
    expect(edges.length).toBe(5);

    const rows = await demo.getResultsTableRows();
    expect(rows.length).toBe(4);

    // No warnings should have appeared; note should still be present
    expect(await demo.hasWarning()).toBeFalsy();
    expect(await demo.hasNote()).toBeTruthy();

    // Ensure no errors captured
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Implementation introspection: verify presence/absence of optional FSM actions (renderPage) without invoking them', async ({ page }) => {
    // The FSM mentions an entry action renderPage() for the Idle state.
    // The HTML/JS implementation does not define renderPage. We should not call or patch it.
    // This test asserts that renderPage is undefined and that the page does not throw an error for its absence.
    const demo = new DemoPage(page);
    await demo.goto();

    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    // We expect the function to be undefined in this implementation.
    expect(renderPageType).toBe('undefined');

    // Confirm that the lack of renderPage did not cause any page errors on load
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Observe console and page errors across interactions and assert none occurred', async ({ page }) => {
    // This test explicitly gathers all console messages and page errors during navigation and interactions,
    // then asserts that there were no uncaught exceptions and no console errors at any point.
    const demo = new DemoPage(page);
    await demo.goto();

    // Interact with the page
    await demo.clickRun();
    await demo.clickRun();

    // Wait for a short time to allow any asynchronous errors to surface
    await page.waitForTimeout(200);

    // Assert no uncaught page errors
    expect(pageErrors.length).toBe(0, `Expected no uncaught page errors but found: ${pageErrors.map(e => String(e)).join('; ')}`);

    // Assert no console error messages
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    expect(consoleErrorMsgs.length).toBe(0, `Expected no console.error messages but found: ${consoleErrorMsgs.join(' || ')}`);
  });
});