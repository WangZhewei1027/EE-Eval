import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3afd31-d360-11f0-b42e-71f0e7238799.html';

/**
 * Page object encapsulating interactions with the Adjacency List demo page.
 */
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.edgesSelector = '#edgesInput';
    this.buttonSelector = "button[onclick='generateAdjacencyList()']";
    this.outputSelector = '#output';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillEdges(text) {
    await this.page.fill(this.edgesSelector, text);
  }

  async clickGenerate() {
    await Promise.all([
      this.page.waitForResponse(response => true).catch(() => {}), // best-effort to avoid waiting forever if no network calls
      this.page.click(this.buttonSelector)
    ]);
  }

  async getOutputText() {
    return (await this.page.locator(this.outputSelector).innerText()).trim();
  }

  async parseOutput() {
    const txt = await this.getOutputText();
    if (!txt) return null;
    return JSON.parse(txt);
  }
}

test.describe('Adjacency List Demonstration - FSM states and transitions', () => {
  // Collect any console messages and page errors during each test to assert on them.
  test.beforeEach(async ({ page }) => {
    // No-op here; listeners set per test to capture messages independently.
  });

  test('Initial render - Idle state (S0_Idle) shows UI elements and no runtime errors', async ({ page }) => {
    // This test validates the initial "Idle" state as described by the FSM:
    // - The page should render the textarea, button, and output container.
    // - There should be no uncaught page errors or console.error messages during load.
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const graph = new GraphPage(page);
    await graph.goto();

    // Verify textarea exists and has the expected placeholder text
    const edges = page.locator(graph.edgesSelector);
    await expect(edges).toBeVisible();
    await expect(edges).toHaveAttribute('placeholder', 'A B\nA C\nB D\nC D\nD E');

    // Verify generate button exists and has the expected label
    const button = page.locator(graph.buttonSelector);
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Generate Adjacency List');

    // Verify output container exists and is initially empty
    const output = page.locator(graph.outputSelector);
    await expect(output).toBeVisible();
    const outputText = await output.innerText();
    expect(outputText.trim()).toBe('');

    // Assert there were no uncaught page errors or console.error messages during load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Generate adjacency list - transition S0_Idle -> S1_ListGenerated with sample edges', async ({ page }) => {
    // This test validates the transition event "GenerateAdjacencyList":
    // - Given typical edge input, clicking the button should update the output pre
    //   with a pretty-printed JSON adjacency list representing an undirected graph.
    // - Also verify that no runtime errors were emitted during the operation.
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const graph = new GraphPage(page);
    await graph.goto();

    const sample = 'A B\nA C\nB D\nC D\nD E';
    await graph.fillEdges(sample);

    // Click generate and then read output
    await graph.clickGenerate();

    // The expected adjacency list (object) given the implementation's push order:
    // Processing order:
    // "A B" -> A:[B], B:[A]
    // "A C" -> A:[B,C], C:[A]
    // "B D" -> B:[A,D], D:[B]
    // "C D" -> C:[A,D], D:[B,C]
    // "D E" -> D:[B,C,E], E:[D]
    const expected = {
      A: ['B', 'C'],
      B: ['A', 'D'],
      C: ['A', 'D'],
      D: ['B', 'C', 'E'],
      E: ['D']
    };

    // Validate output is non-empty and is valid JSON matching expected structure
    const outputText = await graph.getOutputText();
    expect(outputText).not.toBe('');
    const parsed = JSON.parse(outputText);
    expect(parsed).toEqual(expected);

    // Also validate the pretty-printed formatting (2-space indentation)
    // Check that output contains newline indentation pattern
    expect(outputText).toContain('\n  "A": [\n    "B",\n    "C"\n  ]');

    // No runtime errors or console error messages expected
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Empty input edge case - observe current implementation behavior (may produce keys \"\" and \"undefined\")', async ({ page }) => {
    // This test captures the behavior when the textarea is empty (edge case).
    // The implementation uses trim().split('\n') and then splits each line by space.
    // For an empty string, the code will produce an array with a single empty string,
    // and the code will create keys for "" and "undefined". We assert that this
    // exact behavior occurs (we do NOT modify the application behavior).
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const graph = new GraphPage(page);
    await graph.goto();

    // Ensure textarea is empty
    await graph.fillEdges('');

    await graph.clickGenerate();

    const outputText = await graph.getOutputText();
    expect(outputText).not.toBe(''); // Implementation produces something
    // Validate that the observed output contains the "" and "undefined" keys and a null entry (for undefined)
    expect(outputText).toContain('"":');
    expect(outputText).toContain('"undefined":');
    expect(outputText).toContain('null');

    // Parse into object and assert representation matches the observed pattern
    const parsed = JSON.parse(outputText);
    // The parsed object should have properties "" and "undefined"
    expect(Object.prototype.hasOwnProperty.call(parsed, '')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(parsed, 'undefined')).toBe(true);

    // Validate the array values: the empty key maps to [null] (undefined becomes null in JSON),
    // and the 'undefined' key maps to an array containing an empty string.
    expect(parsed['']).toEqual([null]);
    expect(parsed['undefined']).toEqual(['']);

    // No uncaught runtime errors expected (we assert none occurred)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Duplicate edges and malformed lines produce duplicate adjacency entries (implementation detail)', async ({ page }) => {
    // This test verifies how the implementation handles duplicate edges and malformed lines.
    // The current implementation will push duplicates (no deduplication). It also accepts
    // lines with multiple spaces and blank lines; these will be tokenized producing possibly
    // empty or undefined nodes. We assert the actual behavior.
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const graph = new GraphPage(page);
    await graph.goto();

    // Input with duplicates and malformed lines:
    // - "A B" twice -> duplicates expected
    // - "  A   B  " with extra spaces -> first tokenization will yield node1='A', node2='B'
    // - blank line -> will produce behavior similar to empty input ("" and 'undefined')
    const input = 'A B\nA B\n  A   B  \n\nB A';
    await graph.fillEdges(input);
    await graph.clickGenerate();

    const parsed = JSON.parse(await graph.getOutputText());

    // Because of push-only behavior, adjacency lists for A and B should contain multiple entries.
    // We expect A's adjacency to contain B multiple times, and B's adjacency to contain A multiple times.
    expect(parsed.A.length).toBeGreaterThanOrEqual(3);
    expect(parsed.B.length).toBeGreaterThanOrEqual(3);

    // Verify that the counts are consistent: from the lines above:
    // 1: "A B" -> A:+1 B:+1
    // 2: "A B" -> A:+1 B:+1
    // 3: "  A   B  " -> A:+1 B:+1
    // 4: "" (blank) -> produces keys "" and "undefined" but also may alter counts for those
    // 5: "B A" -> B:+1 A:+1
    // So A and B should have at least 4 entries each (depending on blank-line side-effects),
    // but because blank produces extra nodes, we assert at least 3 as a conservative check above.
    expect(parsed.A.filter(x => x === 'B').length).toBeGreaterThanOrEqual(3);
    expect(parsed.B.filter(x => x === 'A').length).toBeGreaterThanOrEqual(3);

    // Confirm that malformed blank line introduced keys for "" and "undefined"
    expect(Object.prototype.hasOwnProperty.call(parsed, '') || Object.prototype.hasOwnProperty.call(parsed, 'undefined')).toBe(true);

    // No uncaught runtime errors expected
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Output is valid JSON and can be parsed programmatically', async ({ page }) => {
    // This test focuses on verifying that the output pre contains valid JSON which can be
    // parsed by an application using JSON.parse. It repeats a typical scenario from the FSM.
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const graph = new GraphPage(page);
    await graph.goto();

    const sample = 'X Y\nY Z\nX Z';
    await graph.fillEdges(sample);
    await graph.clickGenerate();

    const outputText = await graph.getOutputText();
    expect(outputText).not.toBe('');

    // Ensure JSON.parse does not throw
    let parsed;
    expect(() => {
      parsed = JSON.parse(outputText);
    }).not.toThrow();

    // Validate adjacency relationships for this triangle graph
    expect(parsed.X.sort()).toEqual(['Y', 'Z'].sort());
    expect(parsed.Y.sort()).toEqual(['X', 'Z'].sort());
    expect(parsed.Z.sort()).toEqual(['Y', 'X'].sort());

    // No uncaught runtime errors expected
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});