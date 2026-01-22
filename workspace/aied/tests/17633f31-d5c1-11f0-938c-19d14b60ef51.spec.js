import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17633f31-d5c1-11f0-938c-19d14b60ef51.html';

// Page Object for the Adjacency List Visualization page
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.inputSelector = '#edgesInput';
    this.buttonSelector = "button[onclick='generateGraph()']";
    this.graphSelector = '#graph';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setEdgesInput(text) {
    await this.page.fill(this.inputSelector, text);
  }

  async clickGenerate() {
    await Promise.all([
      this.page.waitForTimeout(50), // small delay to simulate user pacing (not required)
      this.page.click(this.buttonSelector)
    ]);
  }

  async getGraphLines() {
    return this.page.$$eval(`${this.graphSelector} .node`, nodes => nodes.map(n => n.textContent.trim()));
  }

  async getGraphHtml() {
    return this.page.$eval(this.graphSelector, el => el.innerHTML);
  }

  async inputPlaceholder() {
    return this.page.$eval(this.inputSelector, el => el.getAttribute('placeholder'));
  }

  async elementExists(selector) {
    return this.page.$(selector).then(el => !!el);
  }
}

test.describe('Adjacency List Visualization (FSM checks)', () => {
  // Capture console.error and page errors for each test so we can assert the runtime is clean
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type "error"
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture uncaught page errors (unhandled exceptions)
    page.on('pageerror', error => {
      pageErrors.push({
        message: error.message,
        stack: error.stack
      });
    });
  });

  test('S0_Idle: initial render shows input, placeholder, and Generate Graph button', async ({ page }) => {
    // This test validates the initial FSM state S0_Idle (onEnter: renderPage())
    const gp = new GraphPage(page);
    await gp.goto();

    // Verify input exists
    expect(await gp.elementExists(gp.inputSelector)).toBe(true);

    // Verify placeholder text matches the FSM evidence
    const placeholder = await gp.inputPlaceholder();
    expect(placeholder).toBe('Enter edges (A,B; A,C; B,D)');

    // Verify button exists with the expected onclick attribute (evidence)
    const buttonExists = await gp.elementExists(gp.buttonSelector);
    expect(buttonExists).toBe(true);

    // Verify the graph container exists but is empty initially
    const graphHtml = await gp.getGraphHtml();
    expect(graphHtml.trim()).toBe('');

    // Assert there were no runtime console errors or uncaught page errors during initial render
    expect(consoleErrors, `console.error messages found: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(pageErrors, `uncaught page errors found: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });

  test('Transition GenerateGraphClick -> S1_GraphGenerated: valid edges produce expected adjacency list', async ({ page }) => {
    // This test validates the transition triggered by clicking the Generate Graph button (GenerateGraphClick)
    const gp = new GraphPage(page);
    await gp.goto();

    // Input edges as per FSM example
    await gp.setEdgesInput('A,B; A,C; B,D');
    await gp.clickGenerate();

    // After clicking, the FSM should be in S1_GraphGenerated and display the adjacency list
    const lines = await gp.getGraphLines();

    // The expected lines (order matters because insertion order constructs keys A,B,C,D)
    const expected = [
      'A: B, C',
      'B: A, D',
      'C: A',
      'D: B'
    ];

    expect(lines).toEqual(expected);

    // Clicking again with the same input should yield identical output (ensures displayGraph cleared previous content and re-rendered)
    await gp.clickGenerate();
    const linesAfterSecondClick = await gp.getGraphLines();
    expect(linesAfterSecondClick).toEqual(expected);

    // No runtime errors should have occurred during graph generation
    expect(consoleErrors, `console.error messages found: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(pageErrors, `uncaught page errors found: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });

  test('Edge case: empty input - verify how implementation handles it (checks for potential malformed nodes)', async ({ page }) => {
    // This test covers an error scenario / edge case from the FSM: user clicks Generate Graph with empty input
    // We DO NOT modify the application; we observe behavior as-is.
    const gp = new GraphPage(page);
    await gp.goto();

    // Set empty input and click generate
    await gp.setEdgesInput('');
    await gp.clickGenerate();

    // Capture what the DOM shows for empty input. The implementation will attempt to parse and may produce entries for '' and 'undefined'.
    const lines = await gp.getGraphLines();

    // We expect two lines reflecting the internal parsing behavior:
    // 1) Key '' with neighbor 'undefined' -> ": undefined"
    // 2) Key 'undefined' with neighbor '' -> "undefined: "
    // Because the implementation destructures [node1, node2] and node2 becomes undefined for empty edge string.
    expect(lines).toContain(': undefined');
    expect(lines).toContain('undefined:');

    // Ensure no uncaught runtime errors (TypeError / ReferenceError / SyntaxError)
    expect(consoleErrors, `console.error messages found: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(pageErrors, `uncaught page errors found: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });

  test('Malformed edge formats: inputs missing commas or separators still processed - check graceful degradation', async ({ page }) => {
    // This test provides malformed inputs like "A B" or "A-B" and confirms the DOM shows something (no crash)
    const gp = new GraphPage(page);
    await gp.goto();

    // Provide various malformed patterns separated by semicolons
    const malformed = 'A B;A-B;C, D';
    await gp.setEdgesInput(malformed);
    await gp.clickGenerate();

    // Collect output lines
    const lines = await gp.getGraphLines();

    // The code splits on ',' inside each edge. For edges without comma, node2 will be undefined.
    // Ensure we got at least one node rendered and that the valid "C, D" produced an expected line
    const hasCLine = lines.some(line => line.startsWith('C:'));
    expect(hasCLine).toBe(true);

    // Malformed edges should not crash the page; verify no page errors or console errors
    expect(consoleErrors, `console.error messages found: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(pageErrors, `uncaught page errors found: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });

  test('Multiple sequential generations: previous output cleared and replaced with new adjacency list', async ({ page }) => {
    // This test ensures displayGraph clears previous output (onEnter behavior for S1 if re-entered)
    const gp = new GraphPage(page);
    await gp.goto();

    // First generate with one dataset
    await gp.setEdgesInput('X,Y; Y,Z');
    await gp.clickGenerate();
    const firstLines = await gp.getGraphLines();
    expect(firstLines).toEqual(['X: Y', 'Y: X, Z', 'Z: Y']);

    // Then generate with a different dataset
    await gp.setEdgesInput('P,Q; P,R; Q,S');
    await gp.clickGenerate();
    const secondLines = await gp.getGraphLines();

    // Confirm the DOM now reflects the second dataset only (previous output was cleared)
    const expectedSecond = [
      'P: Q, R',
      'Q: P, S',
      'R: P',
      'S: Q'
    ];
    expect(secondLines).toEqual(expectedSecond);

    // No runtime errors should have occurred during sequential operations
    expect(consoleErrors, `console.error messages found: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(pageErrors, `uncaught page errors found: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });

  test('UI elements evidence: verify that the button has the expected onclick attribute (evidence from FSM)', async ({ page }) => {
    // This test inspects the button element to ensure the inline onclick attribute matches the FSM evidence.
    const gp = new GraphPage(page);
    await gp.goto();

    const onclickAttr = await page.$eval("button", el => el.getAttribute('onclick'));
    expect(onclickAttr).toBe('generateGraph()');

    // No runtime errors on simple attribute inspection
    expect(consoleErrors, `console.error messages found: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(pageErrors, `uncaught page errors found: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });
});