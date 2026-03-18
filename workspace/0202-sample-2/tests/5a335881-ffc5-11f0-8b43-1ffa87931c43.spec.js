import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a335881-ffc5-11f0-8b43-1ffa87931c43.html';

// Page Object for the Topological Sort Demo page
class TopoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      graphInput: '#graphInput',
      runBtn: '#runBtn',
      errorDiv: '#error',
      resultDiv: '#result',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setInput(text) {
    await this.page.fill(this.selectors.graphInput, text);
  }

  async getInput() {
    return await this.page.$eval(this.selectors.graphInput, el => el.value);
  }

  async clickRun() {
    await this.page.click(this.selectors.runBtn);
  }

  async getErrorText() {
    return await this.page.$eval(this.selectors.errorDiv, el => el.textContent.trim());
  }

  async getResultText() {
    return await this.page.$eval(this.selectors.resultDiv, el => el.textContent.trim());
  }

  async runWithInput(text) {
    await this.setInput(text);
    await this.clickRun();
  }

  async isRunButtonVisible() {
    const el = await this.page.$(this.selectors.runBtn);
    if (!el) return false;
    return await el.isVisible();
  }
}

test.describe('Topological Sort Demo - FSM states and transitions', () => {
  let topo;
  let consoleMessages;
  let pageErrors;
  // Setup listeners and navigate before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    topo = new TopoPage(page);
    await topo.goto();
    // Ensure page loaded without producing uncaught errors during navigation
    expect(pageErrors.length).toBe(0);
  });

  test.afterEach(async () => {
    // Ensure each test run did not produce unexpected uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Idle state: initial render shows controls, textarea pre-filled, and empty feedback areas', async ({ page }) => {
    // Validate S0_Idle: page rendered and ready
    // The FSM entry action renderPage() is inferred by the presence of controls below.

    // Use TopoPage for queries
    expect(await topo.isRunButtonVisible()).toBeTruthy();

    // The textarea should contain the example adjacency list as given in the HTML
    const inputVal = await topo.getInput();
    expect(inputVal).toContain('A: C, D');
    expect(inputVal).toContain('E:');

    // Error and result areas should be empty at idle
    const errorText = await topo.getErrorText();
    const resultText = await topo.getResultText();
    expect(errorText).toBe('');
    expect(resultText).toBe('');

    // No uncaught JS errors and no console errors during idle
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Sorted state: clicking Run on the default graph produces a deterministic topological order', async ({ page }) => {
    // Validate transition S0_Idle -> S2_Sorting -> S3_Sorted for the provided default graph

    // Click run and assert final result text matches the deterministic ordering produced by the implementation
    await topo.clickRun();

    // After run, error should be empty and result should show the topological order
    const errorText = await topo.getErrorText();
    const resultText = await topo.getResultText();

    expect(errorText).toBe('', 'No error should be shown for the valid default graph');

    // The implementation's deterministic output (based on DFS order) is:
    // 'B → A → D → C → E' for the given adjacency list present in the HTML.
    expect(resultText).toBe('B → A → D → C → E');

    // No uncaught page errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Error state: undefined referenced node shows a descriptive error message', async ({ page }) => {
    // Validate transition S0_Idle -> S2_Sorting -> S1_Error when a child node is referenced but not defined

    // Provide a graph where a node references an undefined node (A -> B but B is not defined)
    const badInput = 'A: B';
    await topo.runWithInput(badInput);

    // The app catches the thrown Error and displays it in #error
    const errorText = await topo.getErrorText();
    expect(errorText).toContain('Node "B" referenced by "A" is not defined.');

    // Result should remain empty
    const resultText = await topo.getResultText();
    expect(resultText).toBe('');

    // Confirm there were no uncaught page errors during this handled error case
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Error state: cycle detection triggers cycle error message', async ({ page }) => {
    // Validate transition S0_Idle -> S2_Sorting -> S1_Error when the graph contains a cycle

    const cycInput = 'A: B\nB: A';
    await topo.runWithInput(cycInput);

    const errorText = await topo.getErrorText();
    expect(errorText).toContain('The graph contains a cycle. Topological sorting is not possible.');

    const resultText = await topo.getResultText();
    expect(resultText).toBe('');

    // No uncaught page errors should occur even though an error is reported to the user
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Error state: invalid format (missing colon) displays parse error', async ({ page }) => {
    // Validate parse error handling: missing ':' separator should be surfaced in #error

    const invalidFormat = 'InvalidLineWithoutColon';
    await topo.runWithInput(invalidFormat);

    const errorText = await topo.getErrorText();
    expect(errorText).toContain("Invalid format: missing ':' separator");

    const resultText = await topo.getResultText();
    expect(resultText).toBe('');

    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition behavior: running twice clears previous output before processing', async ({ page }) => {
    // This test ensures that when the user runs the algorithm again, previous error/result are cleared
    // (S3_Sorted -> S2_Sorting -> S1_Error or S3_Sorted). The code clears #error and #result at the start
    // of the click handler, which we validate by observing final states following a second run.

    // First run with default (valid) graph to produce a result
    await topo.clickRun();
    let initialResult = await topo.getResultText();
    expect(initialResult).toBe('B → A → D → C → E');

    // Now change input to an invalid graph and run again; the start of the handler clears previous result,
    // and the final state should show an error and an empty result.
    const badInput = 'X: Y'; // Y undefined
    await topo.setInput(badInput);
    await topo.clickRun();

    const errorText = await topo.getErrorText();
    const resultText = await topo.getResultText();

    // Error about undefined node expected
    expect(errorText).toContain('Node "Y" referenced by "X" is not defined.');
    // Ensure the previous result was cleared and not left visible after the second run
    expect(resultText).toBe('');

    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});