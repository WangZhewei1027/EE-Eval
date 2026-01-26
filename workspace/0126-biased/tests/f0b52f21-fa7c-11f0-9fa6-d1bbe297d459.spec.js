import { test, expect } from '@playwright/test';

// Test file for Application ID: f0b52f21-fa7c-11f0-9fa6-d1bbe297d459
// URL served at:
// http://127.0.0.1:5500/workspace/0126-biased/html/f0b52f21-fa7c-11f0-9fa6-d1bbe297d459.html

// Page object model for the demo section
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('#demoButton');
    this.demoOutput = page.locator('#demoOutput');
  }

  async goto(url) {
    await this.page.goto(url, { waitUntil: 'load' });
  }

  async clickRun() {
    await this.demoButton.click();
  }

  async getOutputText() {
    return (await this.demoOutput.innerText()).trim();
  }

  async getOutputHTML() {
    return (await this.demoOutput.innerHTML()).trim();
  }

  // Count occurrences of "Tree X predicts"
  async countTreePredictLines() {
    const html = await this.getOutputHTML();
    const matches = html.match(/Tree\s+\d+\s+predicts:/g);
    return matches ? matches.length : 0;
  }

  // Wait until final prediction line appears or timeout
  async waitForFinalPrediction(timeout = 2000) {
    await this.page.waitForFunction(() => {
      const out = document.getElementById('demoOutput');
      return out && out.innerText.includes('Final Random Forest prediction (majority vote):');
    }, null, { timeout });
  }
}

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b52f21-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('Random Forest Demo FSM (f0b52f21-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Shared state to capture console messages and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', (msg) => {
      // Collect text and type
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture any unhandled page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(err);
    });

    // Navigate to the page and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({}, testInfo) => {
    // After each test we will keep collected logs available with the test output if assertions fail.
    // This hook intentionally does not alter page state.
    if (pageErrors.length > 0) {
      // Attach errors to test output for debugging purposes
      for (const err of pageErrors) {
        testInfo.attachments = testInfo.attachments || [];
        testInfo.attachments.push({
          name: 'page-error',
          body: `${err.name}: ${err.message}\n${err.stack}`,
          contentType: 'text/plain',
        });
      }
    }
    if (consoleMessages.length > 0) {
      testInfo.attachments = testInfo.attachments || [];
      testInfo.attachments.push({
        name: 'console-messages',
        body: consoleMessages.map(m => `[${m.type}] ${m.text}`).join('\n'),
        contentType: 'text/plain',
      });
    }
  });

  // Idle state tests
  test.describe('State S0_Idle (Idle)', () => {
    test('Initial render shows Run Random Forest Demo button and empty demo output', async ({ page }) => {
      // Purpose: Validate S0_Idle evidence and DOM structure before any interactions.
      const demo = new DemoPage(page);

      // Assert the demo button exists and is visible
      await expect(demo.demoButton).toBeVisible();
      await expect(demo.demoButton).toHaveText('Run Random Forest Demo');

      // Assert the demo output exists and is initially empty (or only whitespace)
      const outputText = await demo.getOutputText();
      expect(outputText).toBe('', 'Expected demoOutput to be empty at idle state');

      // Verify there are no unexpected page errors at idle state
      // We collect pageErrors via page.on('pageerror') - it should be empty if runtime is healthy
      expect(pageErrors.length).toBe(0);
    });
  });

  // Transition S0 -> S1 via RunDemo (button click)
  test.describe('Transition RunDemo: S0_Idle -> S1_DemoRunning', () => {
    test('Clicking Run Random Forest Demo enters Demo Running state and shows running message', async ({ page }) => {
      // Purpose: Validate the RunDemo event and S1 evidence: immediate "Running simplified Random Forest simulation..." text.
      const demo = new DemoPage(page);

      // Click the Run Demo button
      await demo.clickRun();

      // Immediately check that the running message is present (this is set synchronously before setTimeout)
      const html = await demo.getOutputHTML();
      expect(html).toContain('Running simplified Random Forest simulation...', 'Expected running simulation message to appear immediately on click');

      // Ensure tree prediction lines have not yet been appended (they are added after a timeout)
      const treeCountImmediate = await demo.countTreePredictLines();
      expect(treeCountImmediate).toBe(0);

      // Confirm no page errors were thrown during the transition
      expect(pageErrors.length).toBe(0);
    });
  });

  // Transition S1 -> S2 via TimerComplete (after 500ms)
  test.describe('TimerComplete: S1_DemoRunning -> S2_DemoCompleted', () => {
    test('After the timer completes the demo shows 5 tree predictions and a final majority vote', async ({ page }) => {
      // Purpose: Validate that after the asynchronous simulation completes, the DOM contains 5 tree predictions and a Final Random Forest prediction line.
      const demo = new DemoPage(page);

      // Trigger the demo run
      await demo.clickRun();

      // Wait for the final prediction to appear (the app uses setTimeout with 500ms)
      await demo.waitForFinalPrediction(3000); // allow some margin

      // After final prediction appears, validate the content
      const outputHTML = await demo.getOutputHTML();
      // Evidence check: final prediction line exists
      expect(outputHTML).toMatch(/Final Random Forest prediction \(majority vote\): \d+ \((Positive|Negative)\)/, 'Expected final prediction line with Positive/Negative');

      // Evidence check: there are exactly 5 "Tree X predicts" lines appended
      const treeCount = await demo.countTreePredictLines();
      expect(treeCount).toBe(5, 'Expected exactly 5 tree predictions in the simplified demo');

      // The note paragraph should be appended as well
      expect(outputHTML).toContain('Note: This is an extremely simplified demonstration.', 'Expected explanatory note after final prediction');

      // Ensure no page errors of runtime type occurred during the asynchronous flow
      const catastrophicErrors = pageErrors.filter(e =>
        e.name === 'ReferenceError' || e.name === 'TypeError' || e.name === 'SyntaxError'
      );
      expect(catastrophicErrors.length).toBe(0);
    });
  });

  // Edge cases and error scenarios
  test.describe('Edge cases and robustness', () => {
    test('Rapid multiple clicks: ensure that the UI remains stable and one final prediction completes', async ({ page }) => {
      // Purpose: Validate behavior when user clicks the demo button multiple times quickly.
      const demo = new DemoPage(page);

      // Click button rapidly a few times
      await Promise.all([
        demo.clickRun(),
        demo.clickRun(),
        demo.clickRun()
      ]);

      // The implementation resets output.innerHTML to the running message on each click,
      // and then schedules a setTimeout. The last click's timer should win.
      // Wait for final prediction of a run to appear
      await demo.waitForFinalPrediction(3000);

      // Validate that there is a single final prediction line (even if previous timers had been scheduled, last one overwrote innerHTML)
      const html = await demo.getOutputHTML();
      const finalMatches = html.match(/Final Random Forest prediction \(majority vote\):/g) || [];
      expect(finalMatches.length).toBe(1, 'Expected exactly one final prediction after multiple rapid clicks (last run should complete)');

      // Validate that there are 5 tree lines for the last run
      const treeCount = await demo.countTreePredictLines();
      expect(treeCount).toBe(5, 'Expected 5 tree predictions for the completed run even after rapid clicks');

      // Confirm stability: no page errors occurred
      expect(pageErrors.length).toBe(0);
    });

    test('Verify that event handler is attached to #demoButton (evidence check)', async ({ page }) => {
      // Purpose: Confirm that a click event handler is attached to the button by dispatching a click via DOM and observing expected DOM side-effects.
      // This test is an alternative verification: instead of relying on Playwright's click, simulate an event dispatch.
      const demo = new DemoPage(page);

      // Dispatch a click event from the page context
      await page.evaluate(() => {
        const btn = document.getElementById('demoButton');
        if (btn) {
          const ev = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
          btn.dispatchEvent(ev);
        }
      });

      // Check that the running message appears as a result of the dispatched event
      await page.waitForFunction(() => {
        const out = document.getElementById('demoOutput');
        return out && out.innerText.includes('Running simplified Random Forest simulation...');
      }, null, { timeout: 1000 });

      // No runtime errors should have been produced by the dispatched event
      expect(pageErrors.length).toBe(0);
    });

    test('Inspect for missing named onEnter/onExit functions referenced in FSM (non-invasive check)', async ({ page }) => {
      // Purpose: The FSM mentions functions like renderPage() and simulateRandomForest() in metadata.
      // We MUST NOT modify the page. We will non-invasively check whether those function names exist on the window.
      // If they do not exist, that's fine — we will record that they are absent. We do NOT execute or patch them.
      const functionsToCheck = ['renderPage', 'simulateRandomForest', 'displayResults'];

      const presence = await page.evaluate((names) => {
        return names.map(n => ({ name: n, exists: typeof window[n] === 'function' }));
      }, functionsToCheck);

      // Assert: it's acceptable whether they exist or not; however, record expectations:
      // - If they exist, they should be functions
      // - If they don't, no error should have been thrown as a result of checking
      for (const p of presence) {
        expect(typeof p.exists === 'boolean').toBe(true);
      }

      // Ensure we haven't triggered runtime page errors by inspecting window
      expect(pageErrors.length).toBe(0);
    });
  });

  // Final test focusing on console/page error observation behavior explicitly
  test.describe('Console and runtime error observation', () => {
    test('No unexpected ReferenceError/TypeError/SyntaxError occurred during interactions', async ({ page }) => {
      // Purpose: Collect and assert that there are no catastrophic runtime errors arising from the page JS.
      const demo = new DemoPage(page);
      // Trigger a demo run to exercise code paths
      await demo.clickRun();
      await demo.waitForFinalPrediction(3000);

      // Examine collected pageErrors
      const names = pageErrors.map(e => e.name);
      // If any of the targeted error types occurred, fail with detailed message
      const targeted = pageErrors.filter(e =>
        e.name === 'ReferenceError' || e.name === 'TypeError' || e.name === 'SyntaxError'
      );

      // Attach any found errors into the test failure message if present
      if (targeted.length > 0) {
        const detailed = targeted.map(e => `${e.name}: ${e.message}`).join('\n');
        // Fail the test with details
        expect(targeted.length, `Unexpected runtime errors occurred:\n${detailed}`).toBe(0);
      }

      // Otherwise assert there are no page errors at all
      expect(pageErrors.length).toBe(0);
    });
  });
});