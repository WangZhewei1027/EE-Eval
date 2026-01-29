import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324dfc02-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Topological Sort page
class TopologicalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.edgesInput = page.locator('#edgesInput');
    this.sortButton = page.locator('#sortButton');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillEdges(text) {
    await this.edgesInput.fill(text);
  }

  async clickSort() {
    await this.sortButton.click();
  }

  async getResultText() {
    return (await this.result.innerText()).trim();
  }

  async isSortButtonVisible() {
    return await this.sortButton.isVisible();
  }

  async isEdgesInputVisible() {
    return await this.edgesInput.isVisible();
  }

  async isResultVisible() {
    return await this.result.isVisible();
  }
}

test.describe('Topological Sort Demonstration - FSM Tests', () => {
  // Capture console messages and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Listen for console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for unhandled page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // pageerror emits an Error object
      pageErrors.push(err);
    });
  });

  // Test initial idle state (S0_Idle)
  test('S0_Idle: Initial UI renders correctly (renderPage entry evidence)', async ({ page }) => {
    const topo = new TopologicalPage(page);
    await topo.goto();

    // Verify presence of components as evidence for Idle state
    // - sort button should exist (evidence from FSM)
    expect(await topo.isSortButtonVisible()).toBeTruthy();
    // - edges textarea should exist
    expect(await topo.isEdgesInputVisible()).toBeTruthy();
    // - result div should exist
    expect(await topo.isResultVisible()).toBeTruthy();

    // Result should be empty upon initial render
    const resultText = await topo.getResultText();
    expect(resultText).toBe(''); // No result shown initially

    // Ensure loading the page did not produce runtime errors
    // We assert that there are no uncaught page errors and no console 'error' messages.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Also store console messages for debugging if needed
    // Assert no suspicious console error-level messages
    const errorLevelMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorLevelMessages.length).toBe(0);
  });

  // Test performing a topological sort for a simple linear graph
  test('Transition S0_Idle -> S1_Sorting -> S2_Sorted: Performs topological sort for A-B, B-C', async ({ page }) => {
    const topo1 = new TopologicalPage(page);
    await topo.goto();

    // Fill edges: A-B and B-C
    // This exercises the "Sorting" state's parsing logic and the final display action
    await topo.fillEdges('A-B\nB-C');
    await topo.clickSort();

    // After clicking, the result should show a topological order
    // For the given edges, expected order is "A -> B -> C"
    await expect(topo.result).toHaveText(/^Topological Sort Order:/);

    const resultText1 = await topo.getResultText();
    expect(resultText).toBe('Topological Sort Order: A -> B -> C');

    // Verify again that no page errors occurred during sort processing
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: input contains blank lines and the word "done" which should be ignored
  test('Edge cases: Blank lines and "done" are ignored in parsing', async ({ page }) => {
    const topo2 = new TopologicalPage(page);
    await topo.goto();

    // Include blank lines and the literal "done" which should be filtered out
    const input = [
      'A-B',
      '',
      'B-C',
      'done',
      '   ', // whitespace-only line
    ].join('\n');

    await topo.fillEdges(input);
    await topo.clickSort();

    const resultText2 = await topo.getResultText();
    // "done" and blank lines should be ignored and result should match A->B->C
    expect(resultText).toBe('Topological Sort Order: A -> B -> C');

    // No runtime errors should have occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: empty input should produce an empty order string (but still a valid DOM update)
  test('Edge case: Empty input yields empty Topological Sort Order text', async ({ page }) => {
    const topo3 = new TopologicalPage(page);
    await topo.goto();

    // Ensure textarea is empty
    await topo.fillEdges('');
    await topo.clickSort();

    // Expect the result text to be the prefix with empty content
    const resultText3 = await topo.getResultText();
    expect(resultText).toBe('Topological Sort Order: ');

    // Ensure there were no runtime exceptions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test a more complex graph with two disconnected components to ensure algorithm handles multiple roots
  test('Sorting a graph with disconnected components produces a valid topological order', async ({ page }) => {
    const topo4 = new TopologicalPage(page);
    await topo.goto();

    // Graph: A->B, C->D
    // Insertion order in adjacencyList should lead to A,B,C,D ordering after topological sort
    await topo.fillEdges('A-B\nC-D');
    await topo.clickSort();

    const resultText4 = await topo.getResultText();
    expect(resultText.startsWith('Topological Sort Order:')).toBeTruthy();

    // The expected order given the implementation and insertion order is "A -> B -> C -> D"
    // Validate that the result contains the expected nodes in an allowed order
    // Accept either "A -> B -> C -> D" or "C -> D -> A -> B" depending on iteration order,
    // but given the insertion order, the implementation should produce A,B,C,D.
    const expected1 = 'Topological Sort Order: A -> B -> C -> D';
    const expected2 = 'Topological Sort Order: C -> D -> A -> B';
    expect([expected1, expected2]).toContain(resultText);

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test "idempotent" behavior: clicking the sort button multiple times does not throw errors and updates result deterministically
  test('Clicking the sort button multiple times is safe and deterministic', async ({ page }) => {
    const topo5 = new TopologicalPage(page);
    await topo.goto();

    await topo.fillEdges('A-B\nB-C');
    // Click multiple times
    await topo.clickSort();
    const first = await topo.getResultText();

    await topo.clickSort();
    const second = await topo.getResultText();

    // Results should be stable across multiple runs
    expect(first).toBe(second);
    expect(first).toBe('Topological Sort Order: A -> B -> C');

    // Ensure no runtime issues after repeated interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Validate that the application wires the click handler (transition evidence)
  test('Event wiring: sortButton has a click handler and triggers sorting', async ({ page }) => {
    const topo6 = new TopologicalPage(page);
    await topo.goto();

    // We can't directly inspect event listeners without modifying the page; instead,
    // verify that clicking the button causes a change in the DOM (result text) as evidence the handler runs.
    await topo.fillEdges('X-Y');
    const before = await topo.getResultText();
    expect(before).toBe(''); // initially empty

    await topo.clickSort();

    const after = await topo.getResultText();
    expect(after).toBe('Topological Sort Order: X -> Y');

    // Ensure no page errors triggered by the handler
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Final test: collect and assert console/page error observations (observability test)
  test('Observability: collect console and page errors during a typical session', async ({ page }) => {
    const topo7 = new TopologicalPage(page);

    // Start fresh listeners (ensured in beforeEach)
    await topo.goto();

    // Perform a typical sequence of actions
    await topo.fillEdges('A-B\nB-C\nC-D');
    await topo.clickSort();
    await topo.fillEdges(''); // clear
    await topo.clickSort();

    // At the end of the scenario, assert that there were no uncaught exceptions
    // and no console error-level messages emitted by the page.
    // This validates that the runtime executed normally.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // For debugging and traceability, we also assert that we observed non-error-level console messages
    // (There may be zero as the page does not log intentionally).
    // We simply ensure our console capture mechanism saw at least an array (not necessary to assert length).
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });
});