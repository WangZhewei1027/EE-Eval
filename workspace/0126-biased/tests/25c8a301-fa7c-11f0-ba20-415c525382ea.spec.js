import { test, expect } from '@playwright/test';

class DemoPage {
  /**
   * Page object encapsulating interactions and queries for the Stack Demo page.
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoButton');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/25c8a301-fa7c-11f0-ba20-415c525382ea.html');
  }

  async clickRunDemo() {
    await this.button.click();
  }

  async getOutputText() {
    const text = await this.output.textContent();
    // Normalize line endings
    return (text ?? '').trim();
  }

  async waitForOutputContains(substring, timeout = 2000) {
    await expect(this.output).toContainText(substring, { timeout });
  }
}

test.describe('Stack Demo - FSM states and transitions', () => {
  // We'll collect any page-level errors and console errors per test to assert no runtime exceptions.
  test('Initial Idle state renders the page with Run Stack Demo button and empty output', async ({ page }) => {
    // Comments: This test validates the S0_Idle state per FSM: the button is present and demo output area exists and is empty.
    const demoPage = new DemoPage(page);

    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (err) => {
      // Collect uncaught errors (ReferenceError, TypeError, etc.) that happen during page load.
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await demoPage.goto();

    // Verify button is visible and has expected text (evidence for Idle state)
    await expect(demoPage.button).toBeVisible();
    await expect(demoPage.button).toHaveText('Run Stack Demo');

    // Verify demo output div exists and initially empty (or whitespace)
    await expect(demoPage.output).toBeVisible();
    const initialOutput = await demoPage.getOutputText();
    expect(initialOutput === '' || initialOutput === undefined).toBeTruthy();

    // Verify accessibility attributes on demo output match the FSM evidence
    await expect(demoPage.output).toHaveAttribute('aria-live', 'polite');
    await expect(demoPage.output).toHaveAttribute('aria-atomic', 'true');

    // Assert that no runtime page errors or console errors occurred during initial render.
    // This ensures the page loaded into S0_Idle without JS exceptions.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition to DemoRunning: clicking Run Stack Demo displays expected demo output (entry action runDemo)', async ({ page }) => {
    // Comments: This test validates the transition from S0_Idle -> S1_DemoRunning when the demo button is clicked.
    // It confirms runDemo() executed by examining the textual output sequence.
    const demoPage = new DemoPage(page);

    const pageErrors = [];
    const consoleErrors = [];
    const consoleLogs = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      // Collect any console logs or errors produced by the page during the demo
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      else consoleLogs.push({ type: msg.type(), text: msg.text() });
    });

    await demoPage.goto();

    // Click the demo button to trigger runDemo (the FSM RunDemo event)
    await demoPage.clickRunDemo();

    // Wait for the demo to produce output with the starting message, which indicates runDemo executed.
    await demoPage.waitForOutputContains('Starting Stack Demo (LIFO principle):');

    // Retrieve full output and validate expected lines and their order.
    const outputText = await demoPage.getOutputText();

    // Basic presence checks for important milestones in the demo output.
    const expectedSequence = [
      'Starting Stack Demo (LIFO principle):',
      'Operation: push(10)',
      'Stack now: [10]',
      'Operation: push(20)',
      'Stack now: [10, 20]',
      'Operation: push(30)',
      'Stack now: [10, 20, 30]',
      'Operation: pop()',
      'Popped element: 30',
      'Stack now: [10, 20]',
      'Operation: peek()',
      'Top element: 20',
      'Stack unchanged: [10, 20]',
      'Operation: pop()',
      'Popped element: 20',
      'Stack now: [10]',
      'Operation: pop()',
      'Popped element: 10',
      'Stack now: []',
      'Operation: pop() on empty stack will produce an error.',
      'Stack is empty. Cannot pop further.'
    ];

    // Ensure each expected piece appears and that order is preserved.
    let lastIndex = -1;
    for (const piece of expectedSequence) {
      const idx = outputText.indexOf(piece);
      expect(idx).toBeGreaterThanOrEqual(0); // piece must appear
      expect(idx).toBeGreaterThan(lastIndex); // ensure order
      lastIndex = idx;
    }

    // Ensure there were no uncaught runtime errors during clicking and demo run
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Optionally, assert that console logs do not contain warnings or unexpected messages.
    // (The demo writes to DOM rather than console, so console logs are expected to be minimal.)
    const unexpectedConsoleWarnings = consoleLogs.filter((c) => c.type === 'warning' || c.type === 'error');
    expect(unexpectedConsoleWarnings.length).toBe(0);
  });

  test('Repeated runs clear previous output and produce deterministic demo output', async ({ page }) => {
    // Comments: This test validates idempotence / repeatability: running the demo multiple times should
    // clear previous output at start of runDemo() and produce the same deterministic sequence.
    const demoPage = new DemoPage(page);

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await demoPage.goto();

    // First run
    await demoPage.clickRunDemo();
    await demoPage.waitForOutputContains('Starting Stack Demo (LIFO principle):');
    const firstOutput = await demoPage.getOutputText();

    // Second run
    await demoPage.clickRunDemo();
    await demoPage.waitForOutputContains('Starting Stack Demo (LIFO principle):');
    const secondOutput = await demoPage.getOutputText();

    // Outputs should be identical between runs (deterministic demo)
    expect(secondOutput).toBe(firstOutput);

    // Also ensure runDemo cleared old content rather than appending: there should only be one "Starting Stack Demo" occurrence
    const occurrences = (secondOutput.match(/Starting Stack Demo \(LIFO principle\):/g) || []).length;
    expect(occurrences).toBe(1);

    // Ensure no runtime page errors across interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case validation: final message for popping on empty stack is present', async ({ page }) => {
    // Comments: This test specifically asserts the error-handling path described in the demo:
    // attempting to pop on an empty stack should result in a human-readable message in the demo output.
    const demoPage = new DemoPage(page);

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await demoPage.goto();

    await demoPage.clickRunDemo();

    // Wait for the final expected message to appear which indicates edge case was handled
    await demoPage.waitForOutputContains('Stack is empty. Cannot pop further.');

    const output = await demoPage.getOutputText();
    expect(output.endsWith('Stack is empty. Cannot pop further.')).toBeTruthy();

    // No uncaught errors should have been thrown while handling the empty-pop edge case
    expect(pageErrors.length).toBe(0);
  });
});