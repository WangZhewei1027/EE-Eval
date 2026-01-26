import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25c96652-fa7c-11f0-ba20-415c525382ea.html';

// Page object for the Max-Heapify demo page
class HeapDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtnSelector = '#runDemoBtn';
    this.outputSelector = '#demoOutput';
  }

  // Navigate to the demo page and wait for main elements
  async goto() {
    await this.page.goto(APP_URL);
    await expect(this.page.locator(this.runBtnSelector)).toBeVisible();
    await expect(this.page.locator(this.outputSelector)).toBeVisible();
  }

  // Click the Run Demo button
  async clickRun() {
    await this.page.click(this.runBtnSelector);
  }

  // Get the text content of the demo output
  async getOutputText() {
    return (await this.page.locator(this.outputSelector).textContent()) || '';
  }

  // Helper to get the button text
  async getButtonText() {
    return (await this.page.locator(this.runBtnSelector).textContent()) || '';
  }

  // Check presence of attributes on demo output
  async getOutputAttributes() {
    return await this.page.locator(this.outputSelector).evaluate((el) => {
      return {
        class: el.className,
        ariaLive: el.getAttribute('aria-live'),
        ariaAtomic: el.getAttribute('aria-atomic'),
      };
    });
  }
}

test.describe('25c96652-fa7c-11f0-ba20-415c525382ea - Max Heapify Interactive Demo', () => {
  // Will hold console messages and page errors observed during each test
  let consoleMessages;
  let pageErrors;

  // Attach listeners before each test to capture console and page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (log, info, warn, error)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Test initial Idle state (S0_Idle)
  test('Idle state: initial render shows Run button and empty output (S0_Idle)', async ({ page }) => {
    const demo = new HeapDemoPage(page);
    // Load the page
    await demo.goto();

    // Validate presence of Run button and its label
    const btnText = await demo.getButtonText();
    expect(btnText.trim()).toBe('Run Max-Heapify Demo');

    // Validate demo output element is present and initially empty
    const outputText = await demo.getOutputText();
    expect(outputText).toBe('').or.toBeNull();

    // Validate demo output has required accessibility attributes
    const attrs = await demo.getOutputAttributes();
    expect(attrs.class).toContain('demo-output');
    expect(attrs.ariaLive).toBe('polite');
    expect(attrs.ariaAtomic).toBe('true');

    // Verify there are no uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);

    // Ensure console did not emit critical JS errors (ReferenceError/SyntaxError/TypeError)
    const criticalErrors = consoleMessages.filter((m) =>
      m.type === 'error' &&
      /ReferenceError|SyntaxError|TypeError/.test(m.text)
    );
    expect(criticalErrors.length).toBe(0);
  });

  // Test transition: clicking Run Demo moves from Idle to DemoRunning (S0 -> S1)
  test('Transition RunDemo: clicking button shows initial and post-heapify arrays (S1_DemoRunning)', async ({ page }) => {
    const demo = new HeapDemoPage(page);
    await demo.goto();

    // Click the Run button and wait for output to update
    await demo.clickRun();

    // Read output and validate expected content from FSM evidence
    const output = await demo.getOutputText();

    // Expected pieces in the output as defined in the implementation
    const expectedInitial = 'Initial array:';
    const expectedInitialArray = '[27, 17, 33, 14, 7, 10, 12]';
    const expectedOperationHeader = 'Max-heapify operation on index 0:';
    const expectedAfterHeader = 'After max-heapify:';
    const expectedAfterArray = '[33, 17, 27, 14, 7, 10, 12]';

    // Validate the output contains all sections
    expect(output).toContain(expectedInitial);
    expect(output).toContain(expectedInitialArray);
    expect(output).toContain(expectedOperationHeader);
    expect(output).toContain(expectedAfterHeader);
    expect(output).toContain(expectedAfterArray);

    // Validate ordering: initial array appears before operation and after array appears after
    const idxInitial = output.indexOf(expectedInitialArray);
    const idxOperation = output.indexOf(expectedOperationHeader);
    const idxAfter = output.indexOf(expectedAfterArray);
    expect(idxInitial).toBeGreaterThanOrEqual(0);
    expect(idxOperation).toBeGreaterThanOrEqual(0);
    expect(idxAfter).toBeGreaterThanOrEqual(0);
    expect(idxInitial).toBeLessThan(idxOperation);
    expect(idxOperation).toBeLessThan(idxAfter);

    // Validate that textContent is used (not innerHTML), so content should not contain HTML tags
    expect(output).not.toMatch(/<\/?[a-z][\s\S]*>/i);

    // No uncaught page errors should have occurred during the click
    expect(pageErrors.length).toBe(0);

    // Also ensure there are no console error messages that indicate runtime exceptions
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    const criticalConsoleErrors = consoleErrors.filter((m) =>
      /ReferenceError|SyntaxError|TypeError/.test(m.text)
    );
    expect(criticalConsoleErrors.length).toBe(0);
  });

  // Edge case: clicking Run multiple times should be idempotent (S1 stays consistent)
  test('Edge case: multiple clicks produce consistent, non-duplicated output', async ({ page }) => {
    const demo = new HeapDemoPage(page);
    await demo.goto();

    // Click once and capture output
    await demo.clickRun();
    const firstOutput = await demo.getOutputText();
    expect(firstOutput).toContain('[27, 17, 33, 14, 7, 10, 12]');
    expect(firstOutput).toContain('[33, 17, 27, 14, 7, 10, 12]');

    // Click again rapidly and ensure the output is replaced (not appended)
    await Promise.all([
      demo.clickRun(),
      demo.clickRun(), // click twice quickly to simulate fast user input
    ]);
    const secondOutput = await demo.getOutputText();

    // The output should be identical to the first run (since the demo copies the array)
    expect(secondOutput).toBe(firstOutput);

    // Ensure there are no accumulating repeated sections
    // A naive check: the header should appear exactly once
    const occurrences = (secondOutput.match(/Max-heapify operation on index 0:/g) || []).length;
    expect(occurrences).toBe(1);

    // No page errors during rapid clicks
    expect(pageErrors.length).toBe(0);
  });

  // Validate that the demo does not mutate a stored original array between runs (behavioral contract)
  test('Behavioral: demo uses a copy of demoArray so repeated runs are independent', async ({ page }) => {
    const demo = new HeapDemoPage(page);
    await demo.goto();

    // Run the demo twice
    await demo.clickRun();
    const output1 = await demo.getOutputText();

    await demo.clickRun();
    const output2 = await demo.getOutputText();

    // Both outputs should be identical (the demo copies demoArray before heapify)
    expect(output1).toBe(output2);

    // The initial array shown in both runs should match the canonical input
    expect(output1).toContain('[27, 17, 33, 14, 7, 10, 12]');
    expect(output1).toContain('[33, 17, 27, 14, 7, 10, 12]');

    // Ensure no ReferenceError about missing demoArray or maxHeapify appeared in console
    const refErrors = consoleMessages.filter((m) =>
      /ReferenceError/.test(m.text)
    );
    expect(refErrors.length).toBe(0);
  });

  // Validate FSM-related expectations: evidence strings exist in output and event handler is attached
  test('FSM validation: evidence of event handler and state output match FSM definition', async ({ page }) => {
    const demo = new HeapDemoPage(page);
    await demo.goto();

    // Check that the event handler is effectively attached by verifying click produces text
    await demo.clickRun();
    const output = await demo.getOutputText();

    // Evidence lines expected by FSM
    expect(output).toContain('Initial array:');
    expect(output).toContain('Max-heapify operation on index 0:');
    expect(output).toContain('After max-heapify:');

    // Verify that the button actually had an attached click listener by invoking click via evaluate
    // We invoke the click and confirm output updates (simulate programmatic click)
    await page.evaluate(() => {
      document.getElementById('runDemoBtn').click();
    });
    const outputAfterProgrammaticClick = await demo.getOutputText();
    expect(outputAfterProgrammaticClick).toContain('Initial array:');

    // Ensure no syntax/type errors surfaced
    const badConsole = consoleMessages.filter((m) =>
      /SyntaxError|TypeError/.test(m.text)
    );
    expect(badConsole.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Negative test: assert that no unexpected JS errors (ReferenceError/SyntaxError/TypeError) occurred during the whole test run
  test('No unexpected JavaScript runtime errors occurred during interaction', async ({ page }) => {
    const demo = new HeapDemoPage(page);
    await demo.goto();

    // Interact to potentially trigger any latent runtime errors
    await demo.clickRun();
    await demo.clickRun();

    // Wait briefly to allow any async errors to surface
    await page.waitForTimeout(200);

    // Assert there were no pageerror events
    expect(pageErrors.length).toBe(0);

    // Assert console did not include critical JS errors
    const criticalConsoleMessages = consoleMessages.filter((m) =>
      m.type === 'error' && /ReferenceError|SyntaxError|TypeError/.test(m.text)
    );
    expect(criticalConsoleMessages.length).toBe(0);
  });
});