import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25ca9ed3-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the demo page
class PrimDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runDemoBtn');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async isButtonVisible() {
    return this.runBtn.isVisible();
  }

  async getButtonAriaLabel() {
    return this.runBtn.getAttribute('aria-label');
  }

  async clickRun(times = 1) {
    for (let i = 0; i < times; i++) {
      await this.runBtn.click();
    }
  }

  async getOutputText() {
    return this.output.textContent();
  }

  async waitForOutputNonEmpty(timeout = 2000) {
    await this.page.waitForFunction(
      selector => {
        const el = document.querySelector(selector);
        return el && el.textContent && el.textContent.trim().length > 0;
      },
      '#demoOutput',
      { timeout }
    );
  }

  async getOutputAriaLive() {
    return this.output.getAttribute('aria-live');
  }

  async getOutputAriaAtomic() {
    return this.output.getAttribute('aria-atomic');
  }
}

// Tests grouped for clarity and mapping to FSM states/transitions
test.describe("Prim's Algorithm Demo - FSM states and transitions", () => {
  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {PrimDemoPage} */
  let demo;
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Collect console error messages and page errors.
    consoleErrors = [];
    pageErrors = [];
    page.on('console', msg => {
      // Only record console errors (these reflect runtime issues)
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    demo = new PrimDemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // Assert there were no runtime console errors or page errors during the test.
    // Tests will fail if there were any uncaught exceptions or console.error calls on the page.
    expect(consoleErrors, `Console errors were logged on page: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    expect(pageErrors, `Unhandled page errors occurred: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
    await page.close();
  });

  test('Initial state S0_Idle: page renders Run button and empty demo output', async () => {
    // This validates the FSM initial state S0_Idle: renderPage() conceptual entry results
    // - Button exists with expected text/aria attributes
    // - Output pre exists and is initially empty
    expect(await demo.isButtonVisible()).toBe(true);

    const ariaLabel = await demo.getButtonAriaLabel();
    expect(ariaLabel).toBe('Run Prim\'s Algorithm demonstration');

    const initialOutput = await demo.getOutputText();
    // Should be empty at initial render
    expect(initialOutput).toBe('');

    // Verify that any conceptual entry action names like renderPage are not globally exposed
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // The implementation encapsulates primAlgorithmDemo in an IIFE, so it should not be globally accessible
    const primFnType = await page.evaluate(() => typeof window.primAlgorithmDemo);
    expect(primFnType).toBe('undefined');
  });

  test('Transition RunDemo -> S1_DemoRunning: clicking button runs demo and updates output', async () => {
    // This test triggers the RunDemo event (click) and validates the transition to S1_DemoRunning
    // - Output is updated with MST steps
    // - The final MST weight matches the example (13)
    // - Expected step lines are present

    // Click the demo run button to start the algorithm demonstration
    await demo.clickRun();

    // Wait for output to be populated
    await demo.waitForOutputNonEmpty(3000);

    const outputText = await demo.getOutputText();
    expect(outputText).toBeTruthy();

    // Verify key expected lines from the FSM "expected_observables"
    // The demonstration builds step lines, ensure a few expected lines are present
    expect(outputText).toContain('Step 1: Start at vertex A');
    expect(outputText).toContain('Step 2: Pick edge A — B with weight 2');
    expect(outputText).toContain('Step 3: Pick edge B — C with weight 1');
    expect(outputText).toContain('Step 4: Pick edge B — D with weight 4');
    expect(outputText).toContain('Step 5: Pick edge C — E with weight 6');

    // Verify final total MST weight line matches the example
    expect(outputText).toContain('All vertices included. Final MST weight = 13.');

    // Verify the output container contains the expected formatted MST edges listing
    expect(outputText).toContain('Edges in MST: A-B, B-C, B-D, C-E')
      .or.toContain('Edges in MST: A-B, B-C, B-D, C-E'); // tolerant assertion (keeps clarity)

    // Ensure the demo-output element has accessibility attributes as declared in the FSM/components
    const ariaLive = await demo.getOutputAriaLive();
    const ariaAtomic = await demo.getOutputAriaAtomic();
    expect(ariaLive).toBe('polite');
    expect(ariaAtomic).toBe('true');
  });

  test('Idempotent / repeated clicks: multiple clicks consistently replace output (edge case)', async () => {
    // Clicking multiple times should run the demo each time; the implementation sets textContent,
    // so repeated clicks should replace the content rather than append. This test clicks quickly
    // multiple times and verifies the output contains exactly one final summary (not appended multiples).

    // Rapidly click 3 times
    await demo.clickRun(3);

    // Wait for the output to be populated
    await demo.waitForOutputNonEmpty(3000);

    const outputText = await demo.getOutputText();
    expect(outputText).toBeTruthy();

    // Check final summary exists
    const finalLine = 'All vertices included. Final MST weight = 13.';
    expect(outputText).toContain(finalLine);

    // Count occurrences of the final line - should be exactly 1 because textContent is replaced each run
    const occurrences = outputText.split(finalLine).length - 1;
    expect(occurrences).toBe(1);
  });

  test('Accessibility and DOM contract checks - button and demo output attributes present', async () => {
    // Validate elements described in FSM components exist with expected properties

    // Button attributes
    const ariaLabel = await demo.getButtonAriaLabel();
    expect(ariaLabel).toBe('Run Prim\'s Algorithm demonstration');

    // Output attributes
    const ariaLive = await demo.getOutputAriaLive();
    const ariaAtomic = await demo.getOutputAriaAtomic();
    expect(ariaLive).toBe('polite');
    expect(ariaAtomic).toBe('true');

    // Ensure the output element is a PRE (semantic check)
    const tagName = await page.evaluate(() => document.querySelector('#demoOutput')?.tagName);
    expect(tagName).toBe('PRE');
  });

  test('Sanity check: no global exposure of internal functions (encapsulation edge case)', async () => {
    // The page wraps algorithm code in an IIFE; this test ensures functions like primAlgorithmDemo are not global.
    const primType = await page.evaluate(() => typeof window.primAlgorithmDemo);
    expect(primType).toBe('undefined');

    // Also check that graph object isn't leaked to window
    const graphType = await page.evaluate(() => typeof window.graph);
    expect(graphType).toBe('undefined');
  });
});