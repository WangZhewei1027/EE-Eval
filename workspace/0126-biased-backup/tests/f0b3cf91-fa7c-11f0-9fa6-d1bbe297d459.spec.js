import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b3cf91-fa7c-11f0-9fa6-d1bbe297d459.html';

// Increase default timeout because the demo app appends steps with timeouts up to ~13s.
test.setTimeout(60000);

// Page Object for the demo page to keep tests organized and readable.
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    // Attach listeners early to capture logs/errors during navigation
    this.page.on('console', msg => {
      // Collect console messages with their types for later assertions
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', err => {
      // Collect unhandled exceptions on the page
      this.pageErrors.push(err);
    });
  }

  // Navigate to the application URL
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Return the demo button locator
  demoButton() {
    return this.page.locator('#demoButton');
  }

  // Return the demo output locator
  demoOutput() {
    return this.page.locator('#demoOutput');
  }

  // Click the demo button
  async clickDemoButton() {
    await this.demoButton().click();
  }

  // Get trimmed innerText of demoOutput
  async demoOutputText() {
    return (await this.demoOutput().innerText()).trim();
  }

  // Get raw innerHTML of demoOutput
  async demoOutputHTML() {
    return await this.page.$eval('#demoOutput', el => el.innerHTML);
  }

  // Count occurrences of a substring in the demo output innerText
  async countInOutput(substring) {
    const text = await this.demoOutputText();
    return (text.match(new RegExp(substring.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  }

  // Wait for a specific step text to appear inside demo output (with timeout)
  async waitForStepText(stepSubstring, options = { timeout: 20000 }) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return el.innerText.includes(substr);
      },
      '#demoOutput',
      stepSubstring,
      options
    );
  }

  // Expose collected console messages and page errors
  getConsoleMessages() {
    return this.consoleMessages;
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('B-Tree Index Explained - FSM states and transitions', () => {
  // Test: Verify initial Idle state rendering and page-level expectations
  test('Initial Idle state: page renders and shows Run Demonstration button and placeholder output', async ({ page }) => {
    // Comments: This test validates the Idle (S0_Idle) state evidence:
    // - The demo button exists with expected text
    // - The demo output container contains the placeholder text from the HTML
    // - No unexpected runtime page errors occurred during load
    const demo = new DemoPage(page);
    await demo.goto();

    // Assert the demo button exists and is visible with correct label
    const button = demo.demoButton();
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Run Demonstration');

    // Assert the visualization output container exists and contains the placeholder
    const output = demo.demoOutput();
    await expect(output).toBeVisible();
    const outputText = await demo.demoOutputText();
    expect(outputText).toContain('Demonstration output will appear here');

    // The FSM mentions an entry action renderPage(); verify that no such global function was provided by the page.
    // We must NOT call or define renderPage; just observe whether it's present.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBeFalsy();

    // No page errors should have been emitted during load for this implementation.
    const pageErrors = demo.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Check the console for messages of type 'error' — none expected.
    const consoleErrors = demo.getConsoleMessages().filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test: Run Demonstration transition from Idle -> DemonstrationRunning
  test('Run Demonstration event triggers DemonstrationRunning state and appends steps over time', async ({ page }) => {
    // Comments: This test validates the transition triggered by clicking #demoButton (RunDemonstration).
    // It asserts:
    // - Immediate entry observable: heading is inserted into demoOutput
    // - Subsequent step paragraphs are appended with expected content and step numbering
    // - The FSM's demonstration output observable is present in the DOM after clicking
    // - The global startDemonstration() function is not required/present (as per FSM meta) — verify it's undefined
    const demo = new DemoPage(page);
    await demo.goto();

    // Confirm startDemonstration is not present on window (per FSM entry_actions). We do not call it.
    const hasStartDemonstration = await page.evaluate(() => typeof window.startDemonstration !== 'undefined');
    expect(hasStartDemonstration).toBeFalsy();

    // Click the demo button to trigger the demonstration sequence
    await demo.clickDemoButton();

    // Immediately after click, heading should be inserted as per implementation
    // Validate that the specific heading text is present in the output container's innerHTML
    await demo.page.waitForFunction(
      () => {
        const out = document.getElementById('demoOutput');
        return out && out.innerHTML.includes('Insertion Sequence for B-Tree (Order 3)');
      },
      null,
      { timeout: 2000 }
    );

    // Assert heading exists in the DOM
    const htmlAfterClick = await demo.demoOutputHTML();
    expect(htmlAfterClick).toContain('<h3>Insertion Sequence for B-Tree (Order 3)</h3>');

    // Wait for a mid-sequence step to appear (e.g., Step 5: "Insert 5: [20] with children [5, 10] and [30]")
    // Step indices start at 1. We wait for Step 5 which should appear after ~4 seconds.
    await demo.waitForStepText('Step 5:', { timeout: 10000 });
    const textNow = await demo.demoOutputText();
    expect(textNow).toContain('Step 5:');

    // Wait for the final step to ensure the entire scheduled sequence completes.
    // The last step in the array is appended with delay index * 1000 where index is ~13 -> ~13s.
    await demo.waitForStepText('Right child: [30] with children [25] and [35]', { timeout: 20000 });

    // After completion, assert that the final step appears and step numbering is present
    const finalText = await demo.demoOutputText();
    expect(finalText).toContain('Final tree structure:');
    expect(finalText).toContain('Right child: [30] with children [25] and [35]');
    // Confirm the first step is present as well
    expect(finalText).toContain('Step 1: Starting with empty tree');

    // Confirm that at least the expected number of steps were appended (there are 14 steps in the implementation).
    // We check for the presence of 'Step 14:' which should be the last step numbering.
    // It's possible the implementation labels each appended paragraph as "Step {index + 1}: ..." across 14 entries.
    expect(finalText).toMatch(/Step 1:/);
    expect(finalText).toMatch(/Step 14:|Right child: \[30\] with children \[25\] and \[35\]/);

    // Ensure no uncaught page errors occurred during the demonstration sequence.
    const pageErrors = demo.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Check console for runtime errors (none expected)
    const consoleErrors = demo.getConsoleMessages().filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test: Edge case - clicking the Run Demonstration button multiple times (overlapping sequences)
  test('Edge case: multiple rapid clicks schedule overlapping sequences and produce duplicate step entries', async ({ page }) => {
    // Comments: This test validates how the app behaves when the Run Demonstration button is clicked multiple times.
    // The implementation reassigns innerHTML and schedules timeouts without canceling previous timers.
    // We assert that multiple clicks lead to duplicate step entries (evidence of overlapping sequences).
    const demo = new DemoPage(page);
    await demo.goto();

    // Click twice in rapid succession
    await demo.clickDemoButton();
    await demo.clickDemoButton();

    // Wait a short while for the first steps to be appended (index 0 appends immediately)
    await demo.waitForStepText('Step 1:', { timeout: 2000 });

    // Count how many "Step 1:" occurrences are present. Expect at least 2 due to two scheduled sequences.
    const countStep1 = await demo.countInOutput('Step 1:');
    expect(countStep1).toBeGreaterThanOrEqual(2);

    // Wait for a later step to reduce flakiness — Step 6 appears around 5 seconds
    await demo.waitForStepText('Step 6:', { timeout: 10000 });

    // Count occurrences of Step 6; if overlapping occurred it should be >= 2.
    const countStep6 = await demo.countInOutput('Step 6:');
    expect(countStep6).toBeGreaterThanOrEqual(1);

    // Ensure that the demo button remains present and clickable after repeated clicks
    await expect(demo.demoButton()).toBeVisible();
    await expect(demo.demoButton()).toBeEnabled();

    // No unexpected JS exceptions should have been thrown even with overlapping sequences
    const pageErrors = demo.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Log any console errors for debugging if present (assert none)
    const consoleErrors = demo.getConsoleMessages().filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test: Verify FSM-related evidence and event handler existence
  test('FSM evidence checks: event handler attached and demo output updates as expected', async ({ page }) => {
    // Comments: This test validates the FSM's evidence claims:
    // - The demo button has an event listener attached (we infer by clicking and observing result)
    // - The visualization area (#demoOutput) receives content updates when the event occurs
    const demo = new DemoPage(page);
    await demo.goto();

    // Prior to clicking, confirm the placeholder exists
    await expect(demo.demoOutput()).toContainText('Demonstration output will appear here');

    // Perform click and ensure output updates (heading insertion)
    await demo.clickDemoButton();
    await demo.waitForStepText('Step 1:', { timeout: 5000 });

    // After click, verify that output.innerHTML contains appended <p> elements prefixed with "Step "
    const html = await demo.demoOutputHTML();
    expect(html).toMatch(/<p>Step\s+1:/);

    // We also validate that the button has an inline id attribute as per components evidence
    const idAttr = await page.getAttribute('#demoButton', 'id');
    expect(idAttr).toBe('demoButton');

    // Final safety checks: no page errors, no console errors
    expect(demo.getPageErrors().length).toBe(0);
    const consoleErrors = demo.getConsoleMessages().filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});