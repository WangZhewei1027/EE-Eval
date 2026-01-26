import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b11071-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the demo page to keep tests organized and expressive
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoButton');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async isButtonVisible() {
    return this.button.isVisible();
  }

  async isOutputVisible() {
    return this.output.isVisible();
  }

  async getOutputText() {
    return this.output.textContent();
  }

  async getOutputComputedDisplay() {
    return this.output.evaluate((el) => getComputedStyle(el).display);
  }

  async clickShow() {
    await this.button.click();
  }

  // Attempt to call a global function by name on the page and return the caught error info.
  // We intentionally do NOT define these functions; we allow ReferenceError to occur naturally
  // and catch it to assert on its type/message in tests (per requirements).
  async tryCallGlobalFunction(functionName) {
    return this.page.evaluate((fnName) => {
      try {
        // Intentionally call an identifier by name. If it does not exist, this will throw.
        // We do not define or patch anything - we let the runtime throw and catch it here.
        // Return a sentinel if no error occurs (unlikely for these names in this page).
        // eslint-disable-next-line no-eval
        const result = eval(`${fnName}()`); // use eval to attempt to call by identifier
        return { success: true, result };
      } catch (err) {
        return { success: false, name: err.name, message: err.message };
      }
    }, functionName);
  }

  // Count occurrences of a substring inside the output text
  async countInOutput(substring) {
    return this.output.evaluate((el, substr) => {
      const text = el.textContent || '';
      // simple count
      let count = 0;
      let idx = text.indexOf(substr);
      while (idx !== -1) {
        count++;
        idx = text.indexOf(substr, idx + substr.length);
      }
      return count;
    }, substring);
  }

  // Count matching lines that begin with "Node" in the output
  async countNodeLines() {
    return this.output.evaluate((el) => {
      const text = el.textContent || '';
      const matches = text.match(/^Node\s+\d+:/gm);
      return matches ? matches.length : 0;
    });
  }
}

// Grouping tests related to FSM states and transitions for the demo page
test.describe('Circular Linked List Demo - FSM states and transitions', () => {
  let demoPage;
  let consoleMessages;
  let pageErrors;

  // Setup before each test: create the page object, navigate, and start capturing console/page errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for observation and assertions
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture unhandled page errors
    page.on('pageerror', (error) => {
      pageErrors.push({
        name: error.name,
        message: error.message,
      });
    });

    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test.afterEach(async () => {
    // No explicit teardown required; keeping hooks for symmetry and future extension.
  });

  test('Initial Idle state: button present and demonstration output hidden', async () => {
    // Verify the initial FSM state S0_Idle: renderPage() entry action is mentioned in FSM,
    // but the page as delivered does not define renderPage. We do not call it here.
    // Instead we validate the DOM evidence for Idle: #demoButton exists and #demoOutput is hidden.
    expect(await demoPage.isButtonVisible()).toBeTruthy();
    // demoOutput should be hidden initially (display: none)
    expect(await demoPage.isOutputVisible()).toBeFalsy();

    // Validate the computed style is 'none' as provided in the inline HTML evidence
    const display = await demoPage.getOutputComputedDisplay();
    expect(display).toBe('none');

    // Ensure no unhandled page errors were emitted during initial load
    expect(pageErrors).toEqual([]);
  });

  test('Transition ShowDemonstration: clicking button shows demo output and content is correct', async () => {
    // This validates the transition S0_Idle -> S1_DemonstrationVisible triggered by clicking #demoButton
    // Click the button
    await demoPage.clickShow();

    // After click, the output should be visible (entry action in transition sets display = 'block')
    expect(await demoPage.isOutputVisible()).toBeTruthy();

    // The computed style should reflect the inline style change to 'block'
    const computedDisplay = await demoPage.getOutputComputedDisplay();
    expect(computedDisplay).toBe('block');

    // The demo's textContent should include demonstration text that was programmatically generated:
    const outputText = (await demoPage.getOutputText()) || '';

    // It should reference creating a list with the given values
    expect(outputText).toContain('Creating a circular linked list with values: 5 → 10 → 15');
    expect(outputText).toContain('Traversing the list:');

    // The demo code iterates maxIterations = 5, so expect five "Node X:" lines
    const nodeLineCount = await demoPage.countNodeLines();
    expect(nodeLineCount).toBe(5);

    // Check specific node outputs that should result from the values array and indexing logic
    expect(outputText).toContain('Node 1: 5');
    expect(outputText).toContain('Node 2: 10');
    expect(outputText).toContain('Node 3: 15');
    expect(outputText).toContain('(Note how the traversal continues indefinitely in a circle)');

    // Ensure no unhandled page errors occurred during the click and text generation
    expect(pageErrors).toEqual([]);
  });

  test('Clicking the Show Demonstration button multiple times does not append duplicate outputs', async () => {
    // Click multiple times in quick succession
    await demoPage.clickShow();
    await demoPage.clickShow();
    await demoPage.clickShow();

    // Output should remain visible
    expect(await demoPage.isOutputVisible()).toBeTruthy();

    // The content is overwritten each click (textContent used in implementation), so "Node 1:" should appear only once
    const node1Count = await demoPage.countInOutput('Node 1:');
    expect(node1Count).toBe(1);

    // Confirm there are exactly 5 Node lines (maxIterations = 5)
    const nodeLines = await demoPage.countNodeLines();
    expect(nodeLines).toBe(5);

    // Still no unhandled page errors after repeated interactions
    expect(pageErrors).toEqual([]);
  });

  test('Edge case verification: calling non-existent FSM entry/exit functions results in ReferenceError', async () => {
    // FSM listed entry action "renderPage()" for S0_Idle and "displayDemo()" for S1_DemonstrationVisible.
    // These functions are not defined in the provided HTML. We intentionally attempt to call them within
    // the page context and assert that a ReferenceError occurs naturally (but capture it safely).
    const renderCallResult = await demoPage.tryCallGlobalFunction('renderPage');
    const displayCallResult = await demoPage.tryCallGlobalFunction('displayDemo');

    // We expect the browser to throw ReferenceError for undefined identifiers; ensure that we observed that.
    expect(renderCallResult.success).toBeFalsy();
    expect(renderCallResult.name).toBe('ReferenceError');

    expect(displayCallResult.success).toBeFalsy();
    expect(displayCallResult.name).toBe('ReferenceError');

    // We intentionally did not let these be unhandled exceptions - they were caught in the page.evaluate wrapper.
    // Ensure that no unhandled page errors were emitted (our caught ReferenceErrors are not unhandled).
    expect(pageErrors).toEqual([]);
  });

  test('Observing console messages and ensuring no unexpected console errors', async ({ page }) => {
    // This test explicitly inspects collected console messages captured during navigation and interactions.
    // Perform a normal transition to generate any possible console output (the demo code does not console.log
    // in the executed handler, but we still validate).
    await demoPage.clickShow();

    // Inspect the captured console messages
    // We assert that none of the captured console messages are of type 'error'
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);

    // There may be zero or more non-error console messages; we at least assert that we captured an array
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // Confirm again that no unhandled page errors bubbled up
    expect(pageErrors).toEqual([]);
  });
});