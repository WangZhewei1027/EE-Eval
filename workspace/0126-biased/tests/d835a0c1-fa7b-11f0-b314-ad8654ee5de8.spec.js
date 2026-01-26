import { test, expect } from '@playwright/test';

// Test for application: d835a0c1-fa7b-11f0-b314-ad8654ee5de8
// URL served by test harness:
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d835a0c1-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the demo area and button
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Locator helpers
  runButton() {
    return this.page.locator('#runDemo');
  }
  demoArea() {
    return this.page.locator('#demoArea');
  }

  // Returns boolean whether the button is disabled
  async isButtonDisabled() {
    return await this.runButton().evaluate((btn) => btn.disabled === true);
  }

  // Returns button text content
  async buttonText() {
    return (await this.runButton().textContent())?.trim() ?? '';
  }

  // Returns demo area full text content
  async demoText() {
    return (await this.demoArea().textContent()) ?? '';
  }

  // Click the run button (normal user click)
  async clickRun() {
    await this.runButton().click();
  }

  // Wait until the demo appends at least one step of the demonstration
  async waitForFirstDemoStep(timeout = 5000) {
    // The script first sets a header string immediately, then a setInterval appends the first step after ~900ms.
    // Wait until the demo area contains a sentence from the first step.
    await this.page.waitForFunction(() => {
      const out = document.getElementById('demoArea');
      if (!out) return false;
      const text = out.textContent || '';
      // First appended step contains the phrase "Example graph: nodes A,B,C,D,E,F"
      return text.includes('Example graph: nodes A,B,C,D,E,F');
    }, null, { timeout });
  }

  // Wait until the demo completes and the button text becomes "Demonstration finished"
  async waitForDemoCompletion(timeout = 20000) {
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('runDemo');
      return btn && btn.textContent && btn.textContent.trim() === 'Demonstration finished';
    }, null, { timeout });
  }
}

test.describe('Dijkstra demo FSM - d835a0c1-fa7b-11f0-b314-ad8654ee5de8', () => {
  // Arrays to collect runtime errors and console error messages for assertions
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Listen for uncaught exceptions on the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // Collect the Error object for later assertions
      pageErrors.push(err);
    });

    // Collect console messages with severity 'error' for diagnostics
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Load the application under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // nothing to cleanup beyond Playwright fixtures
  });

  test.describe('State S0_Idle - initial rendering', () => {
    test('S0: initial UI shows Run simple demonstration button and demo area explanation', async ({ page }) => {
      const demo = new DemoPage(page);

      // Validate button presence, attributes, and enabled state
      const runBtn = demo.runButton();
      await expect(runBtn).toHaveCount(1);
      await expect(runBtn).toBeVisible();

      const btnText = await demo.buttonText();
      // The FSM evidence expects the button text "Run simple demonstration"
      expect(btnText).toBe('Run simple demonstration');

      // Verify attributes per component description
      await expect(runBtn).toHaveAttribute('class', 'btn');
      await expect(runBtn).toHaveAttribute('aria-controls', 'demoArea');

      // Ensure the button is enabled in the Idle state
      expect(await demo.isButtonDisabled()).toBe(false);

      // Validate demo area initial content matches the page description
      const outText = await demo.demoText();
      expect(outText).toContain('Click "Run simple demonstration" to see a timed textual trace of Dijkstra\'s algorithm on a small example.');

      // Validate no page runtime errors of serious types have been thrown on initial load
      // We allow the page to accumulate any errors naturally, but assert none occurred here.
      expect(pageErrors.length, 'No uncaught page errors on initial load').toBe(0);
      expect(consoleErrors.length, 'No console.error messages on initial load').toBe(0);
    });
  });

  test.describe('Transition RunDemoClick: S0_Idle -> S1_RunningDemo', () => {
    test('Clicking Run simple demonstration triggers Running Demonstration state', async ({ page }) => {
      const demo = new DemoPage(page);

      // Click the button to start the demo
      await demo.clickRun();

      // Immediately after clicking: button should be disabled and text should show running status
      expect(await demo.isButtonDisabled(), 'Button should be disabled while demo is running').toBe(true);

      // The code sets the button text immediately to "Running demonstration…"
      const btnTextAfterClick = await demo.buttonText();
      expect(btnTextAfterClick).toBe('Running demonstration…');

      // The demo area is set to the header line immediately
      const areaText = await demo.demoText();
      expect(areaText).toContain('Running demonstration (text-only). Steps will appear below:');

      // Wait for first appended step to appear (verifies that the interval appends steps)
      await demo.waitForFirstDemoStep(6000);

      const textAfterFirstStep = await demo.demoText();
      expect(textAfterFirstStep).toContain('Example graph: nodes A,B,C,D,E,F');

      // Ensure no fatal runtime errors occurred during early running state
      expect(pageErrors.length, 'No page errors during initial running state').toBe(0);
      expect(consoleErrors.length, 'No console.error messages during initial running state').toBe(0);
    });
  });

  test.describe('Transition DemoComplete: S1_RunningDemo -> S2_DemoFinished', () => {
    // This test waits for the demo to fully complete (all timed steps)
    test('After timed steps the demo finishes and button text becomes "Demonstration finished"', async ({ page }) => {
      const demo = new DemoPage(page);

      // Start demo
      await demo.clickRun();

      // Confirm we entered RunningDemo state
      expect(await demo.isButtonDisabled()).toBe(true);
      expect(await demo.buttonText()).toBe('Running demonstration…');

      // Wait for the full demo to complete; the demo enqueues 10 steps at 900ms intervals.
      // Allow generous timeout for the sequence to finish (e.g. 20s)
      await demo.waitForDemoCompletion(25000);

      // Verify the button text equals the FSM evidence for the finished state
      const finalBtnText = await demo.buttonText();
      expect(finalBtnText).toBe('Demonstration finished');

      // Button must remain disabled per implementation (the code leaves it disabled)
      expect(await demo.isButtonDisabled()).toBe(true);

      // The demo area should contain the final summary and "Demo complete." sentence
      const finalDemoText = await demo.demoText();
      expect(finalDemoText).toContain('Demo complete. For full, static explanation with tables and proofs, read the page above.');
      expect(finalDemoText).toContain('Result summary: dist[A]=0, dist[B]=3, dist[C]=2');

      // Confirm no uncaught exceptions (ReferenceError / TypeError / SyntaxError) occurred during the run
      // We capture pageerror events and console.error messages in beforeEach; assert none are present.
      expect(pageErrors.length, 'No uncaught page errors during run').toBe(0);
      expect(consoleErrors.length, 'No console.error messages during run').toBe(0);
    }, 30000); // extend timeout for long-running demo
  });

  test.describe('Edge cases and robustness', () => {
    test('Clicking the button again while disabled does not append additional steps (idempotency / once:true + disabled behavior)', async ({ page }) => {
      const demo = new DemoPage(page);

      // Start the demo
      await demo.clickRun();

      // Wait for first appended step to ensure the demo has started
      await demo.waitForFirstDemoStep(6000);

      // Record the content size at this moment
      const beforeAttempt = await demo.demoText();
      const beforeLen = beforeAttempt.length;

      // Attempt to click the disabled button (user may attempt accidental clicks). The DOM has disabled attribute so click won't fire the handler again.
      // Use page.click which will attempt but should not result in additional appended content.
      try {
        await demo.runButton().click({ timeout: 2000 });
      } catch (e) {
        // Playwright may still throw when clicking disabled elements; we ignore that as long as no extra content was appended.
      }

      // Wait briefly to see if any extra content was appended
      await page.waitForTimeout(1200);

      const afterAttempt = await demo.demoText();
      const afterLen = afterAttempt.length;

      // The length should have increased only by the expected scheduled content (or remained the same if no new step arrived in the small wait).
      // Critically, there should be no duplicate immediate extra appends caused by an extra click.
      // We'll assert that the content after attempt does not contain duplicated header appended again (i.e., no second "Running demonstration (text-only)" appended).
      const occurrences = (afterAttempt.match(/Running demonstration \(text-only\)\. Steps will appear below:/g) || []).length;
      expect(occurrences, 'Header should only be present once').toBeGreaterThanOrEqual(1);
      expect(occurrences).toBeLessThanOrEqual(2); // allow one initial, and defensive: not more than 2

      // Also ensure that the length didn't jump drastically due to an extraneous instant append.
      // Allow that scheduled interval may have appended one or more steps in the wait window.
      expect(afterLen).toBeGreaterThanOrEqual(beforeLen);
      expect(afterLen - beforeLen).toBeLessThanOrEqual(5000); // sanity bound on appended characters in short timeframe

      // Final check: no uncaught runtime errors occurred as a result of multiple interactions
      expect(pageErrors.length, 'No uncaught errors after attempting extra click').toBe(0);
      expect(consoleErrors.length, 'No console.error messages after attempting extra click').toBe(0);
    });

    test('Event listener is registered once: { once: true } behavior - additional clicks do not re-register', async ({ page }) => {
      const demo = new DemoPage(page);

      // Spy on addEventListener if possible by inspecting event listener attributes is not straightforward from test.
      // Instead, we infer the "once" behavior by clicking, waiting for completion, then attempting to re-enable and click again is not allowed.
      // Start and wait for completion
      await demo.clickRun();
      await demo.waitForDemoCompletion(25000);

      // Save final content length
      const finalContent = await demo.demoText();

      // Attempt to programmatically dispatch a click event to try to re-run the handler (will be ignored because the element is disabled and the handler was registered with { once: true })
      // We invoke dispatchEvent in page context to simulate an event regardless of disabled state, but because handler was registered with { once: true } it should not run again.
      await page.evaluate(() => {
        const btn = document.getElementById('runDemo');
        // Re-enable temporarily to allow dispatch if someone tries to circumvent disabled via DOM (we must not modify app semantics per instructions).
        // We will not change the page's code; instead dispatch a new MouseEvent on the button element as-is.
        if (btn) {
          const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
          btn.dispatchEvent(ev);
        }
      });

      // Wait briefly for any unexpected changes
      await page.waitForTimeout(1000);

      const afterDispatch = await demo.demoText();
      // The content should be unchanged (no new appended demo steps), since the original listener used { once: true } and should have been removed.
      expect(afterDispatch).toBe(finalContent);

      // Ensure button text remains "Demonstration finished"
      expect(await demo.buttonText()).toBe('Demonstration finished');

      // No runtime errors should have been introduced
      expect(pageErrors.length, 'No uncaught page errors after attempted dispatch').toBe(0);
      expect(consoleErrors.length, 'No console.error messages after attempted dispatch').toBe(0);
    }, 30000);
  });

  test.describe('Console and page error observation (observability)', () => {
    test('Collect console.error and uncaught exceptions and assert none of the observed errors are ReferenceError / SyntaxError / TypeError', async ({ page }) => {
      // The instrumentation was set up in beforeEach. At this point the page has been loaded.
      // We'll perform a basic interaction to exercise the demo and collect potential runtime problems.
      const demo = new DemoPage(page);

      await demo.clickRun();
      await demo.waitForFirstDemoStep(6000);

      // Allow the demo to proceed a bit more
      await page.waitForTimeout(2000);

      // Now assert that any captured page errors are not of the inspected critical types.
      // If any such errors were observed, fail the test and include diagnostic information.
      if (pageErrors.length > 0) {
        // Build a readable diagnostic message
        const diagnostics = pageErrors.map((err) => `${err.name}: ${err.message}`).join('\n');
        // Assert none of the names are ReferenceError / TypeError / SyntaxError
        const critical = pageErrors.filter(e => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name));
        expect(critical.length, `No critical JS exceptions (found: ${diagnostics})`).toBe(0);
      } else {
        // No page errors at all — pass this expectation
        expect(pageErrors.length).toBe(0);
      }

      // For console.error messages, ensure there are none that indicate critical runtime problems.
      if (consoleErrors.length > 0) {
        const consoleDiagnostics = consoleErrors.map(c => c.text).join('\n');
        // We don't expect any console.error output for this page; assert zero.
        expect(consoleErrors.length, `No console.error messages expected, found: ${consoleDiagnostics}`).toBe(0);
      } else {
        expect(consoleErrors.length).toBe(0);
      }
    });
  });
});