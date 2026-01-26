import { test, expect } from '@playwright/test';

// Test file: 99cf4590-fa79-11f0-8075-e54a10595dde.spec.js
// Application URL:
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf4590-fa79-11f0-8075-e54a10595dde.html';

// Page object model for the Topological Sort demo
class TopoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.submitButton = page.locator('#submit-graph');
    this.performButton = page.locator('#perform-sort');
    this.input = page.locator('#graph-input');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setGraph(text) {
    await this.input.fill(text);
    await this.submitButton.click();
  }

  async clickPerformSort() {
    await this.performButton.click();
  }

  async getOutputText() {
    return (await this.output.textContent())?.trim() ?? '';
  }

  async isPerformSortHidden() {
    // Check class attribute contains 'hidden'
    const cls = await this.performButton.getAttribute('class');
    return cls && cls.split(/\s+/).includes('hidden');
  }
}

// Helper to attach listeners for console and page errors and return arrays
async function attachObservers(page) {
  const consoleMessages = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err);
  });
  return { consoleMessages, pageErrors };
}

test.describe('Topological Sort Interactive Demo - FSM States & Transitions', () => {
  // Group-level timeout can be adjusted if needed; using default per test
  test.beforeEach(async ({ page }) => {
    // Nothing global to set up beyond navigation per test
  });

  // Validate initial Idle state (S0_Idle)
  test('S0_Idle: initial render shows Set Graph button, hides Perform Sort, output empty', async ({ page }) => {
    // Attach observers to record console logs and page errors
    const { consoleMessages, pageErrors } = await attachObservers(page);

    const topo = new TopoPage(page);
    await topo.goto();

    // Verify expected buttons exist and visibility/state
    await expect(topo.submitButton).toBeVisible();
    // The perform-sort button should initially be hidden via the 'hidden' class
    const isHidden = await topo.isPerformSortHidden();
    expect(isHidden).toBe(true);

    // Output should be empty at initial render (evidence for entry_actions: renderPage())
    const outText = await topo.getOutputText();
    expect(outText).toBe('');

    // Verify no runtime page errors or console errors occurred during initial render
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console error messages should be emitted on initial load').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors should occur on initial load').toBe(0);
  });

  // Transition: SubmitGraphClick -> S1_GraphSet
  test('S1_GraphSet: clicking Set Graph displays readiness message and reveals Perform Sort button', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachObservers(page);

    const topo = new TopoPage(page);
    await topo.goto();

    // Provide a simple acyclic graph input and submit
    const graphInput = 'A B\nB C\nC D';
    await topo.setGraph(graphInput);

    // After submitting graph, perform-sort should no longer have the 'hidden' class
    const isHiddenAfter = await topo.isPerformSortHidden();
    expect(isHiddenAfter).toBe(false);

    // Output should state readiness to perform topological sort (transition evidence)
    const outText = await topo.getOutputText();
    expect(outText).toBe('Graph set. Ready to perform topological sort.');

    // No page errors or console errors expected
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console error messages should be emitted when setting graph').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors should occur when setting graph').toBe(0);
  });

  // Transition: PerformSortClick -> S2_Sorted for an acyclic graph
  test('S2_Sorted: performing topological sort on acyclic graph yields expected order', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachObservers(page);

    const topo = new TopoPage(page);
    await topo.goto();

    // A deterministic acyclic graph:
    // A -> B
    // B -> C
    // C -> D
    // Expect topological order: A, B, C, D
    const graphInput = 'A B\nB C\nC D';
    await topo.setGraph(graphInput);

    // Now perform the sort
    await topo.clickPerformSort();

    const outText = await topo.getOutputText();
    // Should start with the expected prefix
    expect(outText.startsWith('Topological Sort Order:'), 'Expected output to start with "Topological Sort Order:"').toBe(true);

    // Extract the list after the colon and compare with expected ordering
    const parts = outText.split(':');
    expect(parts.length).toBeGreaterThan(1);
    const ordering = parts[1].trim();
    // Normalize spacing and compare
    expect(ordering).toBe('A, B, C, D');

    // No page errors or console errors expected
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console error messages should be emitted during topological sort').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors should occur during topological sort').toBe(0);
  });

  // Transition: PerformSortClick -> S2_Sorted for a cyclic graph (edge case)
  test('S2_Sorted (cyclic): performing topological sort on cyclic graph displays invalid/cycle message', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachObservers(page);

    const topo = new TopoPage(page);
    await topo.goto();

    // Cyclic graph:
    // A -> B
    // B -> A
    const graphInput = 'A B\nB A';
    await topo.setGraph(graphInput);

    // Perform the sort which should detect the cycle and produce the invalid message
    await topo.clickPerformSort();

    const outText = await topo.getOutputText();
    expect(outText).toBe('Graph has cycles or is invalid.');

    // Validate no unexpected runtime errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console error messages should be emitted for cyclic graph handling').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors should occur for cyclic graph handling').toBe(0);
  });

  // Edge case tests: malformed/empty input and behavior expectations
  test('Edge cases: empty or malformed input still follows FSM transitions and yields one of the expected outcomes', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachObservers(page);

    const topo = new TopoPage(page);
    await topo.goto();

    // 1) Empty input
    await topo.setGraph('');
    let outText = await topo.getOutputText();
    expect(outText).toBe('Graph set. Ready to perform topological sort.');

    await topo.clickPerformSort();
    outText = await topo.getOutputText();
    // Per FSM, performing sort can result in either a valid ordering or the cycle/invalid message.
    // For empty input the implementation may treat it as invalid; accept either message but ensure it is one of them.
    const validResponses = [
      (t) => t.startsWith('Topological Sort Order:'),
      (t) => t === 'Graph has cycles or is invalid.'
    ];
    const matched = validResponses.some(fn => fn(outText));
    expect(matched, `Expected output to be a sort order or cycle/invalid message, got: "${outText}"`).toBe(true);

    // 2) Malformed line (e.g., single token or extra spaces) - ensure app doesn't crash and still transitions
    await topo.setGraph('SingleTokenLine\nA B');
    outText = await topo.getOutputText();
    expect(outText).toBe('Graph set. Ready to perform topological sort.');

    await topo.clickPerformSort();
    outText = await topo.getOutputText();
    // Again accept either a result or the invalid message
    const matched2 = validResponses.some(fn => fn(outText));
    expect(matched2, `Expected a result or invalid message for malformed input, got: "${outText}"`).toBe(true);

    // Ensure no uncaught JS errors occurred during these edge interactions
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console error messages should be emitted during edge case handling').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors should occur during edge case handling').toBe(0);
  });

  // Verify expected entry/exit evidence for states when possible (documented side-effects)
  test('Verify state evidence: check DOM changes that represent onEnter/onExit evidence', async ({ page }) => {
    // This test inspects the DOM for the evidence strings described in the FSM.
    // Note: FSM mentions entry_actions like renderPage() but the implementation does not expose such a function.
    // We therefore validate the evidence that is observable in the DOM instead.

    const { consoleMessages, pageErrors } = await attachObservers(page);

    const topo = new TopoPage(page);
    await topo.goto();

    // Evidence for S0_Idle: presence of Set Graph button and hidden Perform Sort button
    await expect(topo.submitButton).toBeVisible();
    expect(await topo.isPerformSortHidden()).toBe(true);
    expect(await topo.getOutputText()).toBe('');

    // Evidence for S1_GraphSet: clicking Set Graph results in output message
    await topo.setGraph('X Y');
    expect(await topo.getOutputText()).toBe('Graph set. Ready to perform topological sort.');
    expect(await topo.isPerformSortHidden()).toBe(false);

    // Evidence for S2_Sorted: performing sort results in either the ordering or cycle message (as stated in FSM)
    await topo.clickPerformSort();
    const finalText = await topo.getOutputText();
    const matchesS2 = finalText.startsWith('Topological Sort Order:') || finalText === 'Graph has cycles or is invalid.';
    expect(matchesS2).toBe(true);

    // Ensure no unexpected runtime errors while validating evidence
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console error messages should be emitted while validating state evidence').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors should occur while validating state evidence').toBe(0);
  });
});