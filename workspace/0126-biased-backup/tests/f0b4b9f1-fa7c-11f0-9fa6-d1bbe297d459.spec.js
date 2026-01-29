import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b4b9f1-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the demo page to keep tests organized and readable
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '#demoButton';
    this.outputSelector = '#demoOutput';
  }

  // Navigate to the demo page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the Run Garbage Collection Demo button
  async clickRun() {
    await this.page.click(this.buttonSelector);
  }

  // Get the visible text of the demo output element
  async getOutputText() {
    return this.page.locator(this.outputSelector).innerText();
  }

  // Get the HTML of the demo output element
  async getOutputHTML() {
    return this.page.locator(this.outputSelector).innerHTML();
  }

  // Wait until the output contains the given substring (with configurable timeout)
  async waitForOutputContains(substring, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return !!el && el.innerText.includes(substr);
      },
      this.outputSelector,
      substring,
      { timeout }
    );
  }

  // Wait until the count of occurrences of a substring in the output equals expectedCount
  async waitForOutputOccurrenceCount(substrRegexSource, expectedCount, timeout = 7000) {
    await this.page.waitForFunction(
      (sel, src, count) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const re = new RegExp(src, 'g');
        const matches = el.innerText.match(re);
        return (matches ? matches.length : 0) === count;
      },
      this.outputSelector,
      substrRegexSource,
      expectedCount,
      { timeout }
    );
  }
}

test.describe('Garbage Collection Demo FSM (f0b4b9f1-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Collect console error messages and page errors for assertions
  let consoleErrors;
  let pageErrors;
  let demo;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console messages and page errors without altering page behavior.
    page.on('console', (msg) => {
      // Record only error-level console messages since those indicate runtime problems.
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      // Record uncaught exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(err.message);
    });

    demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // Assert that there were no uncaught page errors or console.error messages.
    // This validates that loading and interacting with the page did not produce runtime exceptions.
    expect(pageErrors, `Uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([]);
    expect(consoleErrors, `Console error messages: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Initial state S0_Idle: button and default output are rendered', async ({ page }) => {
    // Validate initial UI corresponds to S0_Idle
    // - The Run Garbage Collection Demo button exists and has the expected text
    // - The demo output contains the initial prompt text
    const button = page.locator('#demoButton');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Run Garbage Collection Demo');

    const output = page.locator('#demoOutput');
    await expect(output).toBeVisible();
    await expect(output).toHaveText(/Click the button to see the demo.../);

    // No runtime errors should have happened during initial render (checked in afterEach)
  });

  test('Transition S0 -> S1: clicking the button shows "Creating objects..." and "Objects created..."', async ({ page }) => {
    // This test validates the S0_Idle -> S1_DemoRunning transition.
    // Entry action for S1_DemoRunning is createObjects(), which the page implements by updating the DOM.
    await demo.clickRun();

    // Immediately after click, the script clears output and writes "Creating objects..." and "Objects created. Now making them unreachable..."
    await demo.waitForOutputContains('Creating objects...');
    await demo.waitForOutputContains('Objects created. Now making them unreachable...');

    // Verify both messages are present in the output HTML
    const outText = await demo.getOutputText();
    expect(outText).toContain('Creating objects...');
    expect(outText).toContain('Objects created. Now making them unreachable...');
  });

  test('Transition S1 -> S2: after delay, objects become unreachable and message appears', async ({ page }) => {
    // This test validates the S1_DemoRunning -> S2_ObjectsUnreachable transition.
    // The implementation uses setTimeout to null references and append the unreachable message after ~1000ms.
    await demo.clickRun();

    // Wait for the unreachable message to appear (up to 5 seconds to account for environment scheduling).
    await demo.waitForOutputContains('Objects are now unreachable and eligible for garbage collection.', 5000);

    // The page also appends a "Note: Actual collection timing..." line - ensure it exists too
    await demo.waitForOutputContains("Note: Actual collection timing depends on the browser's GC implementation.", 5000);

    // Final assertions on the output
    const outText = await demo.getOutputText();
    expect(outText).toContain('Objects are now unreachable and eligible for garbage collection.');
    expect(outText).toContain("Actual collection timing depends on the browser's GC implementation.");
  });

  test('Edge case: multiple quick clicks schedule multiple unreachable messages (race behavior)', async ({ page }) => {
    // This test explores an edge case: clicking the demo button multiple times in quick succession.
    // The page implementation clears output on each click but previous timeouts still append to the same output element.
    // We assert that two quick clicks will result in two appended "Objects are now unreachable..." messages.
    await demo.clickRun();

    // Click again quickly (200ms later) to create two scheduled timeouts that will append later.
    await page.waitForTimeout(200);
    await demo.clickRun();

    // After the second click, the output should reflect the second run's immediate messages.
    await demo.waitForOutputContains('Creating objects...');
    await demo.waitForOutputContains('Objects created. Now making them unreachable...');

    // Wait until both scheduled timeouts have fired and appended their messages.
    // We look for two occurrences of the key sentence.
    await demo.waitForOutputOccurrenceCount('Objects are now unreachable', 2, 8000);

    // Validate that the output contains the expected number of unreachable messages
    const out = await demo.getOutputText();
    const occurrences = (out.match(/Objects are now unreachable/g) || []).length;
    expect(occurrences).toBe(2);
  });

  test('No unexpected runtime errors when repeatedly interacting with the demo', async ({ page }) => {
    // This test performs repeated interactions to surface intermittent runtime errors (if any).
    // It clicks the demo button several times with short delays and ensures no uncaught errors occur.
    for (let i = 0; i < 3; i++) {
      await demo.clickRun();
      // Give a short pause to avoid overwhelming the environment
      await page.waitForTimeout(150);
    }

    // Wait for at least one unreachable message to ensure scheduled timeouts executed.
    await demo.waitForOutputContains('Objects are now unreachable and eligible for garbage collection.', 8000);

    // Final output sanity check
    const out = await demo.getOutputText();
    expect(out.length).toBeGreaterThan(0);

    // Any runtime errors will be asserted in afterEach by checking pageErrors/consoleErrors arrays.
  });

  test('Verify DOM updates correspond to FSM states and entry/exit actions', async ({ page }) => {
    // This test ties the DOM updates to the FSM description:
    // - S0_Idle entry action: renderPage() -> initial output present
    // - S1_DemoRunning entry action: createObjects() -> "Creating objects..." appears
    // - S1_DemoRunning exit action: makeObjectsUnreachable() (via setTimeout) -> unreachable message appears
    // Check for initial state
    const initial = await demo.getOutputText();
    expect(initial).toMatch(/Click the button to see the demo.../);

    // Trigger S1 entry
    await demo.clickRun();
    await demo.waitForOutputContains('Creating objects...');
    // Validate S1 evidence content
    const s1Text = await demo.getOutputText();
    expect(s1Text).toContain('Creating objects...');
    expect(s1Text).toContain('Objects created. Now making them unreachable...');

    // Validate S1 exit -> S2 after timeout
    await demo.waitForOutputContains('Objects are now unreachable and eligible for garbage collection.', 5000);
    const s2Text = await demo.getOutputText();
    expect(s2Text).toContain('Objects are now unreachable and eligible for garbage collection.');
  });
});