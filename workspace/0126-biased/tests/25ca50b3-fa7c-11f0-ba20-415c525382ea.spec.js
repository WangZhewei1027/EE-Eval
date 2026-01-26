import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25ca50b3-fa7c-11f0-ba20-415c525382ea.html';

/**
 * Page object for interacting with the BFS Demo page.
 * Encapsulates selectors and common interactions.
 */
class BFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#runDemoBtn');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickRun() {
    await this.runButton.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async isRunButtonVisible() {
    return this.runButton.isVisible();
  }

  async outputHasAriaAttributes() {
    const el = this.page.locator('#demoOutput');
    const ariaLive = await el.getAttribute('aria-live');
    const ariaAtomic = await el.getAttribute('aria-atomic');
    const cls = await el.getAttribute('class');
    return { ariaLive, ariaAtomic, cls };
  }
}

test.describe('BFS Demo FSM - Interactive Tests (Application ID: 25ca50b3-fa7c-11f0-ba20-415c525382ea)', () => {
  // Arrays to collect console messages and page errors per test.
  let consoleMessages;
  let pageErrors;

  // Before each test, initialize collectors and load page.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages with their type and text.
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors (runtime exceptions).
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('Initial Idle State: page renders with Run BFS Demo button and empty output', async ({ page }) => {
    // Validate initial UI and FSM Idle state evidence:
    // - Button #runDemoBtn exists and is visible
    // - Output #demoOutput exists, has expected attributes and is empty initially
    const bfs = new BFSPage(page);
    await bfs.goto();

    // Assert button is present and visible
    await expect(bfs.runButton).toBeVisible();
    await expect(bfs.runButton).toHaveText('Run BFS Demo');

    // Assert output element exists
    await expect(bfs.output).toBeVisible();

    // Output should be empty on initial render (Idle state's evidence)
    const initialOutput = await bfs.getOutputText();
    expect(initialOutput).toBe('', 'Expected demo output to be empty on initial Idle state.');

    // Verify output element attributes (as described in FSM components)
    const attrs = await bfs.outputHasAriaAttributes();
    expect(attrs.ariaLive).toBe('polite');
    expect(attrs.ariaAtomic).toBe('true');
    expect(attrs.cls).toContain('demo-output');

    // Ensure no console errors or uncaught exceptions occurred during initial load
    const errorConsoleEntries = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: clicking Run BFS Demo enters RunningDemo state and displays traversal', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_RunningDemo when user clicks the button.
    // It asserts on-enter action output.textContent set, and final traversal order appended.
    const bfs = new BFSPage(page);
    await bfs.goto();

    // Click the button to trigger the BFS demo
    await bfs.clickRun();

    // The implementation sets:
    // output.textContent = 'Running BFS starting from node 1...\n\n';
    // then appends 'Traversal Order: ' + order.join(' → ')
    const expectedPrefix = 'Running BFS starting from node 1...\n\n';
    const expectedTraversal = 'Traversal Order: 1 → 2 → 3 → 4 → 5';
    // Wait for the output to contain the traversal text
    await expect(bfs.output).toContainText('Running BFS starting from node 1...');
    await expect(bfs.output).toContainText('Traversal Order:');

    const outputText = await bfs.getOutputText();
    // Exact expected content
    expect(outputText).toBe(`${expectedPrefix}${expectedTraversal}`);

    // Ensure that the output's visible text includes both parts separated by blank line
    expect(outputText.startsWith('Running BFS starting from node 1...')).toBeTruthy();
    expect(outputText.includes('Traversal Order: 1 → 2 → 3 → 4 → 5')).toBeTruthy();

    // No runtime errors or console errors expected during proper operation
    const errorConsoleEntries = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0, `Unexpected console errors: ${JSON.stringify(errorConsoleEntries)}`);
    expect(pageErrors.length).toBe(0);
  });

  test('Idempotency & Edge Case: clicking Run BFS Demo multiple times resets and produces same traversal', async ({ page }) => {
    // This test covers clicking the button multiple times quickly (edge case)
    // and ensures the on-enter action resets the output and the traversal is consistent.
    const bfs = new BFSPage(page);
    await bfs.goto();

    // Click twice quickly
    await Promise.all([
      bfs.clickRun(),
      bfs.clickRun()
    ]);

    // After multiple clicks, output should reflect the latest run's content exactly
    const expectedContent = 'Running BFS starting from node 1...\n\nTraversal Order: 1 → 2 → 3 → 4 → 5';
    // Wait for output to stabilize and then assert
    await expect(bfs.output).toHaveText(expectedContent);

    // Also assert that repeated runs do not accumulate (i.e., output replaced, not appended)
    const outputText = await bfs.getOutputText();
    // Ensure exactly one occurrence of 'Running BFS starting from node 1...' and one 'Traversal Order'
    const countRunning = (outputText.match(/Running BFS starting from node 1.../g) || []).length;
    const countTraversal = (outputText.match(/Traversal Order:/g) || []).length;
    expect(countRunning).toBe(1);
    expect(countTraversal).toBe(1);

    // Ensure no console/page errors from repeated interactions
    const errorConsoleEntries = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Accessibility & DOM invariants: verify demo output formatting and accessibility attributes remain intact after run', async ({ page }) => {
    // This test checks that the demo output preserves whitespace formatting (pre-wrap),
    // keeps aria attributes, and that the visual styling class is present after interactions.
    const bfs = new BFSPage(page);
    await bfs.goto();

    // Ensure attributes present before clicking
    const beforeAttrs = await bfs.outputHasAriaAttributes();
    expect(beforeAttrs.ariaLive).toBe('polite');
    expect(beforeAttrs.ariaAtomic).toBe('true');
    expect(beforeAttrs.cls).toContain('demo-output');

    // Trigger demo
    await bfs.clickRun();

    // Ensure attributes still present after clicking
    const afterAttrs = await bfs.outputHasAriaAttributes();
    expect(afterAttrs.ariaLive).toBe('polite', 'aria-live should remain polite after run');
    expect(afterAttrs.ariaAtomic).toBe('true', 'aria-atomic should remain true after run');
    expect(afterAttrs.cls).toContain('demo-output', 'class should remain demo-output after run');

    // Check that output contains newline sequences (textContent preserves \n)
    const outputText = await bfs.getOutputText();
    expect(outputText.includes('\n\n')).toBeTruthy();

    // No console errors or uncaught exceptions
    const errorConsoleEntries = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('No unexpected runtime errors are thrown on load or interactions (observes console and page errors)', async ({ page }) => {
    // This test explicitly collects console and page errors for the whole navigation + interaction lifecycle.
    const bfs = new BFSPage(page);
    await bfs.goto();

    // Click the run button to exercise JS handlers
    await bfs.clickRun();

    // Wait a tick to allow any async runtime errors to surface
    await page.waitForTimeout(100);

    // Report collected console messages so failures include diagnostic info
    const errorConsoleEntries = consoleMessages.filter((m) => m.type === 'error');
    // If there are console errors or page errors, include details in assertion messages.
    expect(errorConsoleEntries.length, `Console errors were logged: ${JSON.stringify(errorConsoleEntries)}`).toBe(0);
    expect(pageErrors.length, `Page errors were thrown: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });
});