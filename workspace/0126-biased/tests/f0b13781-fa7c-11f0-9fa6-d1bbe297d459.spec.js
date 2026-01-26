import { test, expect } from '@playwright/test';

// Test file: f0b13781-fa7c-11f0-9fa6-d1bbe297d459.spec.js
// Application under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/f0b13781-fa7c-11f0-9fa6-d1bbe297d459.html

// Page object for the Deque demo page
class DequeDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b13781-fa7c-11f0-9fa6-d1bbe297d459.html';
    this.selectors = {
      demoButton: '#demo-button',
      demoOutput: '#demo-output',
    };
  }

  async goto() {
    await this.page.goto(this.url);
    // Wait for main elements to be available
    await this.page.waitForSelector(this.selectors.demoButton);
    await this.page.waitForSelector(this.selectors.demoOutput);
  }

  async clickRunDemo() {
    await this.page.click(this.selectors.demoButton);
  }

  async getOutputHTML() {
    return await this.page.locator(this.selectors.demoOutput).innerHTML();
  }

  async getOutputText() {
    return await this.page.locator(this.selectors.demoOutput).textContent();
  }

  async demoButtonText() {
    return await this.page.locator(this.selectors.demoButton).textContent();
  }

  async isOutputEmpty() {
    const html = await this.getOutputHTML();
    // Trim whitespace; demo initializes output.innerHTML = '' on click,
    // but before any click it might be empty.
    return (!html || html.trim().length === 0);
  }
}

test.describe('Deque Demonstration - FSM and UI validation (Application ID: f0b13781-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Arrays to capture console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we assert there were no uncaught runtime errors logged to the page
    // This validates that the application runs without throwing ReferenceError/SyntaxError/TypeError unexpectedly.
    expect(consoleErrors.length).toBe(0, `Unexpected console.error messages: ${JSON.stringify(consoleErrors, null, 2)}`);
    expect(pageErrors.length).toBe(0, `Unexpected page errors: ${JSON.stringify(pageErrors, null, 2)}`);
  });

  test('Idle state: initial render shows demo button and empty output', async ({ page }) => {
    // This test validates FSM state S0_Idle evidence and UI presence
    //  - "Run Deque Demonstration" button must be present
    //  - demo-output should be empty before clicking
    const demo = new DequeDemoPage(page);
    await demo.goto();

    // Assert button existence and label (evidence from FSM S0_Idle)
    const btnText = await demo.demoButtonText();
    expect(btnText).toBe('Run Deque Demonstration');

    // demo-output should be empty at idle state
    const isEmpty = await demo.isOutputEmpty();
    expect(isEmpty).toBeTruthy();
  });

  test('Transition RunDequeDemonstration: clicking button initializes deque and shows expected output', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_DemonstrationRunning
    // and checks the expected observables:
    //  - "Initial Deque: 5 ↔ 10 ↔ 20 ↔ 30"
    //  - "Front element: 5"
    //  - "Rear element: 30"
    //  - "Size: 4"
    // Also checks post-operation states after deleteFront/deleteRear are reported.

    const demo = new DequeDemoPage(page);
    await demo.goto();

    // Click to run the demonstration (this should create a new DemoDeque and perform operations)
    await demo.clickRunDemo();

    // Wait for demo output to be populated
    await page.waitForSelector('#demo-output:has-text("Initial Deque:")');

    const outputText = await demo.getOutputText();

    // Validate expected observables from the FSM transition
    expect(outputText).toContain('Initial Deque: 5 ↔ 10 ↔ 20 ↔ 30');
    expect(outputText).toContain('Front element: 5');
    expect(outputText).toContain('Rear element: 30');
    expect(outputText).toContain('Size: 4');

    // Validate subsequent operations reflected in the output (after deleteFront and deleteRear)
    expect(outputText).toContain('After deleteFront(): 10 ↔ 20 ↔ 30');
    expect(outputText).toContain('After deleteRear(): 10 ↔ 20');
  });

  test('Idempotent run: multiple clicks clear and re-run the demo producing consistent output', async ({ page }) => {
    // This test validates that clicking the demo button again clears previous output
    // and re-runs the demonstration producing the same expected initial state.

    const demo = new DequeDemoPage(page);
    await demo.goto();

    // First run
    await demo.clickRunDemo();
    await page.waitForSelector('#demo-output:has-text("Initial Deque:")');
    const firstRunText = await demo.getOutputText();
    expect(firstRunText).toContain('Initial Deque: 5 ↔ 10 ↔ 20 ↔ 30');

    // Click again to re-run
    await demo.clickRunDemo();
    await page.waitForSelector('#demo-output:has-text("Initial Deque:")');

    // After second run, output should contain the same expected initial deque and not accumulate results
    const secondRunText = await demo.getOutputText();
    expect(secondRunText).toContain('Initial Deque: 5 ↔ 10 ↔ 20 ↔ 30');

    // Ensure output length is reasonable (i.e., not accumulating previous runs' outputs repeatedly)
    // We check that initial deque appears at most twice (once per run); this is a soft guard.
    const occurrences = (secondRunText.match(/Initial Deque:/g) || []).length;
    expect(occurrences).toBeLessThanOrEqual(2);
  });

  test('Edge cases and error scenarios: using DemoDeque API directly from page context', async ({ page }) => {
    // This test validates behavior of DemoDeque when used directly and ensures edge cases return expected sentinel values
    // We will:
    //  - instantiate DemoDeque in page context
    //  - call deleteFront/deleteRear on an empty deque (expect "Underflow")
    //  - call getFront/getRear on an empty deque (expect "Deque is empty")
    //  - check isEmpty() returns true and size() returns 0
    // We do not modify or patch page globals; we merely call methods exposed by the page's script.

    await page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/f0b13781-fa7c-11f0-9fa6-d1bbe297d459.html');

    const results = await page.evaluate(() => {
      // Create a new DemoDeque from the page's script and exercise edge cases
      // If DemoDeque is not defined, this will throw a ReferenceError in the page context,
      // which would be captured by the pageerror listener in the test harness.
      try {
        const d = new DemoDeque();

        const deleteFrontEmpty = d.deleteFront(); // expected "Underflow"
        const deleteRearEmpty = d.deleteRear();   // expected "Underflow"

        const frontEmpty = d.getFront(); // expected "Deque is empty"
        const rearEmpty = d.getRear();  // expected "Deque is empty"

        const isEmpty = d.isEmpty(); // expected true
        const size = d.size(); // expected 0

        // Also perform a few normal operations to ensure normal behavior in-context
        d.insertRear('a');
        d.insertFront('b'); // deque should be ['b','a']
        const afterOpsToString = d.toString();
        const afterOpsFront = d.getFront();
        const afterOpsRear = d.getRear();
        const afterOpsSize = d.size();

        return {
          deleteFrontEmpty,
          deleteRearEmpty,
          frontEmpty,
          rearEmpty,
          isEmpty,
          size,
          afterOpsToString,
          afterOpsFront,
          afterOpsRear,
          afterOpsSize
        };
      } catch (err) {
        // Re-throw to let pageerror handler capture; returning nothing to avoid swallowing errors
        throw err;
      }
    });

    // Validate expected sentinel values and normal behavior
    expect(results.deleteFrontEmpty).toBe('Underflow');
    expect(results.deleteRearEmpty).toBe('Underflow');
    expect(results.frontEmpty).toBe('Deque is empty');
    expect(results.rearEmpty).toBe('Deque is empty');
    expect(results.isEmpty).toBeTruthy();
    expect(results.size).toBe(0);

    // Validate after performing insertions
    expect(results.afterOpsToString).toBe('b ↔ a');
    expect(results.afterOpsFront).toBe('b');
    expect(results.afterOpsRear).toBe('a');
    expect(results.afterOpsSize).toBe(2);
  });
});