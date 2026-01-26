import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8344132-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the minimal interactive demo area
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // returns ElementHandle for run button
  async runButton() {
    return this.page.locator('#runDemo');
  }

  // returns ElementHandle for output area
  async outputArea() {
    return this.page.locator('#demoOutput');
  }

  // Clicks the run demo button and waits for the output to change from initial placeholder.
  async runDemoAndWaitForOutputChange() {
    const out = this.outputArea();
    const initial = (await out.textContent()) || '';
    await Promise.all([
      this.runButton().click(),
      // Wait for textContent to become something different (the script replaces content synchronously,
      // but still we wait for a change to ensure tests are deterministic)
      this.page.waitForFunction(
        (selector, prev) => {
          const el = document.querySelector(selector);
          return el && el.textContent !== prev;
        },
        '#demoOutput',
        initial
      )
    ]);
  }

  // Gets the full text content of the demo output
  async getOutputText() {
    return (await this.outputArea().textContent()) || '';
  }
}

test.describe('d8344132-fa7b-11f0-b314-ad8654ee5de8 — Graph BFS demo (FSM validation)', () => {
  // Arrays to collect console messages and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for examination
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we will assert about console and page errors inside individual tests,
    // but keep afterEach available for future cleanup if needed.
  });

  test('S0_Idle state: page renders and Idle evidence is present', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) entry actions: renderPage()
    // and confirms the button and demo output placeholder exist as described in the FSM.
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure page title matches expectation (sanity check for correct load)
    await expect(page).toHaveTitle(/Graph \(Undirected\) — Comprehensive Guide/i);

    const runBtn = demo.runButton();
    const out = demo.outputArea();

    // Button should be visible and have expected text
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toHaveAttribute('id', 'runDemo');
    await expect(runBtn).toHaveAttribute('class', /btn/);
    await expect(runBtn).toHaveAttribute('aria-controls', 'demoOutput');
    await expect(runBtn).toHaveText('Run BFS demo (from A)');

    // Output area should be present and contain the placeholder hint
    await expect(out).toBeVisible();
    const initialText = await out.textContent();
    expect(initialText).toBeTruthy();
    // The placeholder contains the phrase inviting user to click the Run BFS demo button
    expect(initialText).toContain('Click "Run BFS demo" to see the step-by-step textual trace');

    // ARIA attributes for demo area
    await expect(out).toHaveAttribute('role', 'region');
    await expect(out).toHaveAttribute('aria-live', 'polite');

    // Console and page error assertions:
    // The page script is small and synchronous; we expect no console.error messages and no uncaught page errors.
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition RunDemoClick: clicking button enters BFS Running (S1_BFS_Running) and updates output', async ({ page }) => {
    // This test validates the transition from S0_Idle to S1_BFS_Running when #runDemo is clicked.
    // It asserts that bfsTrace('A') runs and the output area is replaced with the expected trace.
    const demo = new DemoPage(page);
    await demo.goto();

    // Capture activeElement before click
    const beforeActive = await page.evaluate(() => document.activeElement && document.activeElement.id);

    // Perform action: click run demo and wait for content change
    await demo.runDemoAndWaitForOutputChange();

    // After click, the demo output should contain the BFS trace lines produced by bfsTrace('A')
    const outputText = await demo.getOutputText();

    // Basic checks for presence of expected BFS trace markers
    expect(outputText).toContain('Start BFS from A');
    expect(outputText).toContain('Initial queue: [A]');
    expect(outputText).toContain('Dequeue -> A');
    expect(outputText).toContain('Visit neighbor B');
    expect(outputText).toContain('Visit neighbor C');
    expect(outputText).toContain('BFS complete.');
    // Final distances should match the example graph described in the page
    expect(outputText).toContain('Final distances: A:0, B:1, C:1, D:2, E:2, F:3');

    // Parent pointers should be present and include mappings for vertices
    expect(outputText).toContain('Parent pointers:');

    // Accessibility: script attempts to focus output after writing; verify focus moved to demoOutput
    const activeElementId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    expect(activeElementId).toBe('demoOutput');

    // Verify that the output area textContent was set (evidence: out.textContent = bfsTrace('A'))
    // and that clicking triggered event listener (we can also inspect presence of event listener code by checking no exceptions)
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking the Run BFS demo button multiple times yields consistent output (idempotent behavior)', async ({ page }) => {
    // This test checks edge-case behavior: clicking multiple times should replace the demo output
    // with the same BFS trace each time and not introduce errors.
    const demo = new DemoPage(page);
    await demo.goto();

    // First click
    await demo.runDemoAndWaitForOutputChange();
    const firstOutput = await demo.getOutputText();
    expect(firstOutput).toContain('Start BFS from A');
    expect(firstOutput).toContain('BFS complete.');

    // Second click — should update/replace output. We click again and verify content is still the BFS trace.
    await demo.runButton().click();
    // Wait a tick for synchronous replacement; use a short waitForFunction to ensure new content equals expected
    await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        return el && el.textContent && el.textContent.includes('BFS complete.');
      },
      '#demoOutput'
    );
    const secondOutput = await demo.getOutputText();
    expect(secondOutput).toContain('Start BFS from A');
    expect(secondOutput).toContain('BFS complete.');

    // The outputs should be identical (the algorithm is deterministic due to neighbor sorting in the page script)
    expect(secondOutput.trim()).toBe(firstOutput.trim());

    // No console errors introduced by repeated clicks
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Component attributes and DOM evidence as described in FSM and components list', async ({ page }) => {
    // This test inspects the DOM to ensure the components listed in the FSM exist with expected attributes.
    const demo = new DemoPage(page);
    await demo.goto();

    const runBtn = demo.runButton();
    const out = demo.outputArea();

    // Validate component selectors and attributes as extracted by FSM
    await expect(runBtn).toHaveAttribute('id', 'runDemo');
    await expect(runBtn).toHaveAttribute('class', 'btn');
    await expect(runBtn).toHaveAttribute('aria-controls', 'demoOutput');

    await expect(out).toHaveAttribute('id', 'demoOutput');
    await expect(out).toHaveAttribute('role', 'region');
    await expect(out).toHaveAttribute('aria-live', 'polite');

    // Evidence checks: the button text and that demo area contains at least one newline and placeholder content initially
    await expect(runBtn).toHaveText('Run BFS demo (from A)');
    const initialText = (await out.textContent()) || '';
    expect(initialText.length).toBeGreaterThan(0);
    expect(initialText).toMatch(/Click\s+"Run BFS demo"\s+to see the step-by-step textual trace/i);

    // No page errors or console errors on render
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observes console messages and page errors (asserting absence of runtime exceptions)', async ({ page }) => {
    // This test explicitly validates console and runtime error handling: we attach listeners in beforeEach,
    // load the page, perform an interaction, and then assert whether any console.error or page errors occurred.
    // According to constraints, we do NOT patch the page or inject globals; we only observe.

    const demo = new DemoPage(page);
    await demo.goto();

    // Interact to exercise the interactive code path
    await demo.runDemoAndWaitForOutputChange();

    // Collate any console.error messages and uncaught page errors
    const errorsFromConsole = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    const uncaughtPageErrors = pageErrors.map(e => (e && e.message) || String(e));

    // Assert that there are no uncaught runtime errors (ReferenceError/SyntaxError/TypeError) in this page.
    // If there are, the test will fail and the collected messages will be visible in the test output.
    expect(errorsFromConsole.length, `console.error messages: ${JSON.stringify(errorsFromConsole)}`).toBe(0);
    expect(uncaughtPageErrors.length, `uncaught page errors: ${JSON.stringify(uncaughtPageErrors)}`).toBe(0);
  });
});