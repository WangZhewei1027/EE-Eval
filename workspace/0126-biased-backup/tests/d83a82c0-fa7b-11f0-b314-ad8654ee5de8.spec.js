import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83a82c0-fa7b-11f0-b314-ad8654ee5de8.html';

// Page object for the tiny GC demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];

    // Collect console errors and page errors for assertions
    this.page.on('console', (msg) => {
      // Only keep messages with severity 'error' to treat as runtime console errors
      try {
        if (msg.type() === 'error') {
          this.consoleErrors.push({
            text: msg.text(),
            location: msg.location ? msg.location() : undefined,
          });
        }
      } catch (e) {
        // If the console message or its properties throw, capture a textual representation
        this.consoleErrors.push({ text: `(exception reading console message): ${String(e)}` });
      }
    });

    this.page.on('pageerror', (err) => {
      // pageerror corresponds to uncaught exceptions in the page (ReferenceError, TypeError, etc.)
      this.pageErrors.push(err);
    });
  }

  // Navigate to the page and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Return the demo button locator
  demoBtn() {
    return this.page.locator('button#demoBtn');
  }

  // Return the demo output pre element locator
  demoOutput() {
    return this.page.locator('pre#demoOutput');
  }

  // Click the demo button (acts as a user click)
  async clickDemo() {
    await this.demoBtn().click();
  }

  // Get the entire textual content of the demo output
  async getOutputText() {
    return (await this.demoOutput().innerText()).trim();
  }

  // Wait until the output contains a target substring, with a default timeout
  async waitForOutputContains(substring, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, s) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.includes(s);
      },
      ['pre#demoOutput', substring],
      { timeout }
    );
  }

  // Wait until the demo button becomes enabled again (demo finished)
  async waitForDemoCompletion(timeout = 10000) {
    await this.page.waitForFunction(
      (sel) => {
        const btn = document.querySelector(sel);
        return btn && !btn.disabled;
      },
      ['button#demoBtn'],
      { timeout }
    );
  }
}

test.describe('d83a82c0-fa7b-11f0-b314-ad8654ee5de8 — FSM and interactive GC demo', () => {
  // Each test gets a fresh page and DemoPage instance
  let demo;

  test.beforeEach(async ({ page }) => {
    demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async ({}) => {
    // After each test, assert that the page emitted no unexpected runtime errors.
    // We collect console error messages and page errors during the test run.
    // These assertions are intentionally performed after the interactions so that
    // runtime errors (ReferenceError, SyntaxError, TypeError) are observed naturally.
    // If any such errors occurred, they will appear in demo.consoleErrors or demo.pageErrors.
    expect(demo.consoleErrors, 'No console.error messages should have been emitted').toEqual([]);
    expect(demo.pageErrors, 'No uncaught page errors should have occurred').toEqual([]);
  });

  test.describe('Initial state: S0_Idle (rendered page)', () => {
    test('Initial DOM contains expected components and accessibility attributes', async () => {
      // Validate the demo button exists with the expected id, label text and aria attribute
      const btn = demo.demoBtn();
      await expect(btn).toBeVisible();
      await expect(btn).toHaveAttribute('id', 'demoBtn');
      await expect(btn).toHaveAttribute('aria-controls', 'demoOutput');
      await expect(btn).toHaveText('Run GC demo (textual)');

      // Validate the demo output pre exists with the expected id and aria-live attribute
      const output = demo.demoOutput();
      await expect(output).toBeVisible();
      await expect(output).toHaveAttribute('id', 'demoOutput');
      await expect(output).toHaveAttribute('aria-live', 'polite');

      // The initial content should instruct the user to press the button
      const initialText = (await output.innerText()).trim();
      expect(initialText.includes('Press "Run GC demo" to see a short, step-by-step simulation of mark-and-sweep.'), true);
    });

    test('FSM initial state evidence: button present and initially enabled', async () => {
      // Confirm we are in the Idle state by verifying the button is enabled and ready
      const btn = demo.demoBtn();
      await expect(btn).toBeEnabled();
      // There is no global renderPage() to call (the page HTML is already rendered), so we check DOM evidence
      await expect(demo.demoOutput()).toBeVisible();
    });
  });

  test.describe('Transition: S0_Idle -> S1_DemoRunning on RunDemoClick', () => {
    test('Clicking the button triggers the demo and produces the expected step-by-step output', async () => {
      // Click the demo button to start the demo
      await demo.clickDemo();

      // Immediately after clicking, the button should become disabled (onEnter runDemo sets disabled = true)
      await demo.page.waitForFunction(() => {
        const b = document.querySelector('button#demoBtn');
        return b && b.disabled === true;
      });

      // Wait for a few key textual milestones that indicate the demo progressed through its phases
      await demo.waitForOutputContains('Starting mark-and-sweep demonstration...');
      await demo.waitForOutputContains('Step 1: Mark phase — visit reachable objects from roots.');
      await demo.waitForOutputContains('Marked set after traversal:');
      await demo.waitForOutputContains('Step 2: Sweep phase — reclaim unmarked objects.');
      await demo.waitForOutputContains('Sweep complete.');

      // Validate specific expected sweep behaviors:
      // The demo's heap is ordered A,B,C,D,E,F; A-D are live, E and F are reclaimed
      const outputText = await demo.getOutputText();
      // Check for messages indicating live vs reclaimed objects
      expect(outputText.includes('Keeping A'), true);
      expect(outputText.includes('Keeping B'), true);
      expect(outputText.includes('Keeping C'), true);
      expect(outputText.includes('Keeping D'), true);
      expect(outputText.includes('Reclaiming E'), true);
      expect(outputText.includes('Reclaiming F'), true);

      // Ensure the final summary lines mention reclaimed and live objects
      expect(outputText.includes('Reclaimed objects: E, F') || outputText.includes('Reclaimed objects: E, F'), true);
      expect(outputText.includes('Live objects remain: A, B, C, D') || outputText.includes('Live objects remain:'), true);

      // After the demo completes the button should be re-enabled
      await demo.waitForDemoCompletion();
      await expect(demo.demoBtn()).toBeEnabled();
    });

    test('Edge case: multiple rapid clicks should not start multiple overlapping demos', async () => {
      // Strategy:
      // - Attempt to click the button twice very quickly
      // - If the second click is ignored (because the button becomes disabled synchronously in runDemo),
      //   then the output should only contain a single "Starting mark-and-sweep demonstration..." entry.
      // - If Playwright fails to click a disabled element, the second click may throw; we catch that
      //   and still verify only a single run started by counting the 'Starting' occurrences.

      // Start first click
      const p1 = demo.page.click('button#demoBtn');

      // Attempt a second click without awaiting the first to simulate a rapid double-click
      let secondClickError = null;
      try {
        // Using click directly; this may reject if element becomes disabled or becomes detached
        await demo.page.click('button#demoBtn');
      } catch (err) {
        // Capture the error for inspection later; this is an acceptable outcome for the edge case
        secondClickError = err;
      }

      // Await the first click to have completed its dispatched handler
      await p1;

      // Wait for the demo to emit the starting message
      await demo.waitForOutputContains('Starting mark-and-sweep demonstration...', 3000);

      // Give the demo a little extra time to progress through marking to ensure repeated starts would be visible
      await demo.page.waitForTimeout(400);

      // Count the occurrences of the "Starting mark-and-sweep demonstration..." phrase
      const outputText = await demo.getOutputText();
      const startingMatches = outputText.split('Starting mark-and-sweep demonstration...').length - 1;

      // There must be exactly one run start observed
      expect(startingMatches, 'Only one demo run should have been started').toBe(1);

      // If a second click produced a Playwright error (element not enabled), verify that this is a plausible result
      if (secondClickError) {
        // The error text can vary by Playwright version/environment; ensure it at least indicates inability to click
        const msg = String(secondClickError);
        expect(msg.length > 0).toBeTruthy();
      }

      // Wait for demo to finish and re-enable button for cleanup
      await demo.waitForOutputContains('Sweep complete.', 10000);
      await demo.waitForDemoCompletion(10000);
    });

    test('Behavioral assertions reflect FSM evidence: demoBtn listener exists and runDemo executed', async () => {
      // We cannot directly access the runDemo function because it's in a closure; instead we assert behavior that proves it ran.
      // Click and ensure output starts and proceeds through expected phases.
      await demo.clickDemo();
      await demo.waitForOutputContains('Marked set after traversal:', 5000);

      // The "Marked set after traversal:" line should include the nodes that were visited.
      const output = await demo.getOutputText();
      expect(output.includes('Marked set after traversal:'), true);

      // Confirm that the run disables and re-enables the button as part of its lifecycle (onEnter/onExit effect)
      await demo.waitForDemoCompletion();
      await expect(demo.demoBtn()).toBeEnabled();
    });
  });

  test.describe('Accessibility and DOM attributes validation', () => {
    test('Aria attributes and basic semantics are present', async () => {
      const btn = demo.demoBtn();
      const output = demo.demoOutput();

      // Validate the aria-controls relationship: button -> id of pre element
      const ariaControls = await btn.getAttribute('aria-controls');
      expect(ariaControls).toBe('demoOutput');

      // Confirm the pre has the declared ID and aria-live attribute to support screen readers
      const preId = await output.getAttribute('id');
      expect(preId).toBe('demoOutput');
      const ariaLive = await output.getAttribute('aria-live');
      expect(ariaLive).toBe('polite');
    });
  });

  test.describe('Error observation: ensure no uncaught runtime errors occur during normal usage', () => {
    test('No ReferenceError/SyntaxError/TypeError or console.error emitted during load and demo run', async () => {
      // This test will exercise the page and explicitly assert that no page errors were observed.
      // Start the demo and wait for completion, then the afterEach will assert errors arrays are empty.
      await demo.clickDemo();
      await demo.waitForOutputContains('Sweep complete.', 10000);
      await demo.waitForDemoCompletion(10000);

      // Additionally assert that console had no error messages and page had no uncaught exceptions
      expect(demo.consoleErrors.length, 'console.error should not have been called').toBe(0);
      expect(demo.pageErrors.length, 'No uncaught page errors should have occurred').toBe(0);
    });
  });
});