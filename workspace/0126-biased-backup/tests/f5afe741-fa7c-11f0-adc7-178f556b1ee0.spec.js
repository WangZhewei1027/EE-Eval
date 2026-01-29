import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5afe741-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Page Object for the Multiset example page.
 * Encapsulates interactions and collects console and page errors for assertions.
 */
class MultisetPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages emitted by the page
    this.page.on('console', (msg) => {
      // record message type and text for richer assertions
      try {
        this.consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case of unusual console message, still capture its string form
        this.consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect uncaught exceptions on the page
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  // Navigate to the application
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the Run Example button
  async clickRunExample() {
    await this.page.click('#multiset-example-button');
  }

  // Get the visible text content of the output element
  async getOutputText() {
    const locator = this.page.locator('#multiset-example-output');
    // Use textContent to avoid HTML markup issues
    return (await locator.textContent()) ?? '';
  }

  // Get the innerHTML of the output element (useful for checking exact formatting)
  async getOutputInnerHTML() {
    const locator = this.page.locator('#multiset-example-output');
    return await locator.evaluate((el) => el.innerHTML);
  }

  // Check if the Run Example button is visible
  async isRunButtonVisible() {
    return this.page.isVisible('#multiset-example-button');
  }

  // Wait until output contains the expected substring (with timeout)
  async waitForOutputToContain(expected, options = { timeout: 2000 }) {
    await this.page.waitForFunction(
      (selector, expectedText) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        return el.innerHTML.includes(expectedText);
      },
      '#multiset-example-output',
      expected,
      options
    );
  }
}

test.describe('Multiset interactive application - FSM validation', () => {
  let multisetPage;

  // Setup: create page object and navigate to the app before each test
  test.beforeEach(async ({ page }) => {
    multisetPage = new MultisetPage(page);
    await multisetPage.goto();
  });

  // Teardown: after each test ensure there were no unexpected page errors unless the test expects them
  test.afterEach(async () => {
    // If any test left pageErrors to be asserted, they should handle it themselves.
    // Here we assert there are no uncaught runtime errors for normal flows.
    expect(multisetPage.pageErrors).toEqual([]);
  });

  test('S0_Idle: Initial state should show Run Example button and empty output', async () => {
    // Verify the Run Example button exists and is visible (evidence for S0_Idle)
    const isVisible = await multisetPage.isRunButtonVisible();
    expect(isVisible).toBe(true);

    // Verify the output element is present and initially empty
    const outputText = await multisetPage.getOutputText();
    expect(outputText.trim()).toBe('');

    // No console messages have been emitted on initial render for this app
    expect(multisetPage.consoleMessages.length).toBe(0);

    // No runtime page errors have occurred
    expect(multisetPage.pageErrors.length).toBe(0);
  });

  test('RunExample event transitions S0 -> S1 and updates DOM and console', async () => {
    // Listen for expected console output and DOM update
    const expectedOutput = 'Multiset: a: 2, b: 3, c: 2';

    // Click the Run Example button (triggers transition)
    await multisetPage.clickRunExample();

    // Wait for DOM update that indicates S1_Example_Ran (updateOutput was called)
    await multisetPage.waitForOutputToContain('Multiset:', { timeout: 2000 });

    // Verify the output innerHTML matches the expected multiset representation
    const innerHTML = await multisetPage.getOutputInnerHTML();
    expect(innerHTML).toContain('Multiset:');
    expect(innerHTML).toBe(expectedOutput);

    // Verify the rendered text content also matches exactly
    const textContent = (await multisetPage.getOutputText()).trim();
    expect(textContent).toBe(expectedOutput);

    // Verify that the console received the printMultiset log with the expected content
    const matchingConsole = multisetPage.consoleMessages.find(
      (m) => m.type === 'log' && m.text.includes('Multiset:')
    );
    expect(matchingConsole).toBeTruthy();
    expect(matchingConsole.text).toContain('a: 2');
    expect(matchingConsole.text).toContain('b: 3');
    expect(matchingConsole.text).toContain('c: 2');

    // Ensure no uncaught page errors occurred during the interaction
    expect(multisetPage.pageErrors.length).toBe(0);
  });

  test('Clicking Run Example multiple times logs and updates output idempotently', async () => {
    const expectedOutput = 'Multiset: a: 2, b: 3, c: 2';

    // Click twice
    await multisetPage.clickRunExample();
    await multisetPage.waitForOutputToContain('Multiset:', { timeout: 2000 });

    // After first click, we expect one console log
    expect(multisetPage.consoleMessages.filter(m => m.type === 'log').length).toBeGreaterThanOrEqual(1);

    // Click again
    await multisetPage.clickRunExample();

    // Wait a brief moment for second log to appear and ensure DOM still contains expected output
    await multisetPage.waitForOutputToContain('Multiset:', { timeout: 2000 });

    // There should now be at least two console log messages for the action (two clicks)
    const logMessages = multisetPage.consoleMessages.filter(m => m.type === 'log' && m.text.includes('Multiset:'));
    expect(logMessages.length).toBeGreaterThanOrEqual(2);

    // Output should remain the same and not accumulate extra text
    const outputText = (await multisetPage.getOutputText()).trim();
    expect(outputText).toBe(expectedOutput);

    // No page errors produced by repeated interactions
    expect(multisetPage.pageErrors.length).toBe(0);
  });

  test('FSM evidence check: output.innerHTML updated with multiset representation (S1 evidence)', async () => {
    // The FSM specifies evidence of S1_Example_Ran is updateOutput(exampleMultiset);
    const expectedSegment = 'a: 2';

    // Click to trigger transition
    await multisetPage.clickRunExample();

    // Wait for the evidence to appear in innerHTML
    await multisetPage.waitForOutputToContain(expectedSegment, { timeout: 2000 });

    // Assert that the output.innerHTML contains the expected formatted entries for the multiset
    const innerHTML = await multisetPage.getOutputInnerHTML();
    expect(innerHTML).toContain('Multiset:');
    expect(innerHTML).toContain('a: 2');
    expect(innerHTML).toContain('b: 3');
    expect(innerHTML).toContain('c: 2');

    // Additionally assert that the string formatting uses commas as in the implementation
    expect(innerHTML).toBe('Multiset: a: 2, b: 3, c: 2');

    // No page errors occurred
    expect(multisetPage.pageErrors.length).toBe(0);
  });

  test('Edge case: ensure graceful behavior if button is clicked rapidly (no crashes)', async () => {
    // Rapidly click the button several times to exercise event handling
    const clicks = 5;
    for (let i = 0; i < clicks; i++) {
      await multisetPage.clickRunExample();
    }

    // Wait for output to be present
    await multisetPage.waitForOutputToContain('Multiset:', { timeout: 2000 });

    // Expect at least one valid console log entry and final DOM state to be correct
    const logMessages = multisetPage.consoleMessages.filter(m => m.type === 'log' && m.text.includes('Multiset:'));
    expect(logMessages.length).toBeGreaterThanOrEqual(1);

    const finalOutput = (await multisetPage.getOutputText()).trim();
    expect(finalOutput).toBe('Multiset: a: 2, b: 3, c: 2');

    // No uncaught errors should have happened even under rapid clicks
    expect(multisetPage.pageErrors.length).toBe(0);
  });

  test('Error observation test: report any console.error or pageerror if they occur', async () => {
    // This test intentionally observes and asserts on error-level messages if present.
    // The application is not expected to produce errors, so we assert there are none.
    // Trigger normal action to exercise code paths
    await multisetPage.clickRunExample();

    // Wait shortly to capture any async errors that might bubble up
    await multisetPage.page.waitForTimeout(200);

    // Collect console.error messages if any
    const errorConsoleMessages = multisetPage.consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // Assert that there are no error-level console messages
    expect(errorConsoleMessages.length).toBe(0);

    // Assert that pageErrors list is empty (no uncaught exceptions)
    expect(multisetPage.pageErrors.length).toBe(0);
  });
});