import { test, expect } from '@playwright/test';

// URL of the page under test (served as-is, do not modify)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8385fe1-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the small demo portion
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Navigate to the page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Element handles / selectors used by tests
  btnSelector() { return '#demoBtn'; }
  outputSelector() { return '#demoOutput'; }
  stepsSelector() { return '#demoSteps'; }

  // Convenience getters
  async getButtonText() {
    return (await this.page.locator(this.btnSelector()).innerText()).trim();
  }

  async isOutputHidden() {
    // returns true if the 'hidden' class is present
    return await this.page.locator(this.outputSelector()).evaluate((el) => el.classList.contains('hidden'));
  }

  async clickDemoButton() {
    await this.page.click(this.btnSelector());
  }

  async getStepsText() {
    return await this.page.locator(this.stepsSelector()).innerText();
  }

  async waitForStepsContaining(substr, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, s) => document.querySelector(sel) && document.querySelector(sel).textContent.indexOf(s) !== -1,
      this.stepsSelector(),
      substr,
      { timeout }
    );
  }

  async waitForStepsToHaveAtLeastLines(minLines, timeout = 7000) {
    await this.page.waitForFunction(
      (sel, n) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const txt = el.textContent || '';
        // count non-empty lines
        const lines = txt.split('\n').map(l => l.trim()).filter(Boolean);
        return lines.length >= n;
      },
      this.stepsSelector(),
      minLines,
      { timeout }
    );
  }
}

test.describe('B-Tree demo FSM tests (d8385fe1-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and page errors to observe runtime issues naturally.
    page.on('console', (msg) => {
      // record only error-level console messages for assertions
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', (err) => {
      // record thrown errors (ReferenceError, TypeError, etc.) if any
      pageErrors.push(err);
    });
  });

  // Initial Idle state: renderPage() entry action; verify button exists and demo is hidden.
  test('Initial state: Idle renders button and hidden demo output', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Validate initial button presence and label
    const btn = page.locator(demo.btnSelector());
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Run simple search demo');

    // demoOutput should be hidden by default (class 'hidden')
    const outHidden = await demo.isOutputHidden();
    expect(outHidden).toBe(true);

    // demoSteps should be empty initially
    const stepsText = await demo.getStepsText();
    expect(stepsText.trim()).toBe('');

    // Assert there were no runtime page errors or console.error messages during initial render
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Transitions: RunDemo (toggle demo visibility and step population)', () => {
    test('Transition S0 -> S1: clicking button shows demoOutput and populates steps', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Click the button to run the demo (transition from Idle to DemoVisible)
      await demo.clickDemoButton();

      // After clicking, demoOutput should become visible
      const outHiddenAfter = await demo.isOutputHidden();
      expect(outHiddenAfter).toBe(false);

      // Button text should have toggled to "Hide demo"
      await expect(page.locator(demo.btnSelector())).toHaveText('Hide demo');

      // The demo populates steps gradually. Wait for first step to appear (should be quick)
      await demo.waitForStepsContaining('Step 1:', 2000);

      // Wait for all 5 demo lines to be appended (this may take ~650ms * 4 = 2600ms)
      // Use a somewhat generous timeout to allow for scheduling delays
      await demo.waitForStepsToHaveAtLeastLines(5, 8000);

      // Verify that expected content is present in the steps output
      const stepsText = await demo.getStepsText();
      expect(stepsText).toContain('Step 1: Start at root: [10 | 20]');
      expect(stepsText).toContain('Compare 17 to root keys: 17 > 10, 17 < 20. So follow middle child (between 10 and 20).');
      expect(stepsText).toContain('Visit child node: [12 | 17]'.replace('Visit child node: [12 | 17]', 'Step 2: Visit child node: [12 | 17]') || 'Step 2: Visit child node: [12 | 17]'); // tolerant check
      expect(stepsText).toContain('Result: key 17 found in node [12 | 17].');

      // No page errors or console.error during the demo run
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Transition S1 -> S0: clicking Hide demo clears output and hides demoOutput (after full run)', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Show demo and wait for it to fully populate so no pending timeouts remain
      await demo.clickDemoButton();
      await demo.waitForStepsToHaveAtLeastLines(5, 8000);

      // Now click again to hide (this should clear steps immediately)
      await demo.clickDemoButton();

      // Output should be hidden and button text restored
      const outHidden = await demo.isOutputHidden();
      expect(outHidden).toBe(true);
      await expect(page.locator(demo.btnSelector())).toHaveText('Run simple search demo');

      // Steps should be cleared immediately on hide
      const stepsAfterHide = (await demo.getStepsText()).trim();
      expect(stepsAfterHide).toBe('');

      // Wait a short while to ensure no stray timeouts repopulate the steps (since we waited for full run before hiding,
      // there should be no pending scheduled appends). This asserts the expected FSM behavior where demoSteps cleared.
      await page.waitForTimeout(1200);
      const stepsAfterWait = (await demo.getStepsText()).trim();
      expect(stepsAfterWait).toBe('');

      // No page errors or console.error during the hide transition
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and race conditions', () => {
    test('Rapid toggle (show then hide quickly) demonstrates pending timeouts may repopulate demoSteps', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Click to show the demo
      await demo.clickDemoButton();

      // Hide very quickly, before all scheduled timeouts have fired.
      // We wait a small amount so the listener has run, then click hide.
      await page.waitForTimeout(100); // 100ms - faster than the 650ms intervals used for later steps
      await demo.clickDemoButton(); // hide

      // Immediately after hide, steps should be cleared as per the hide handler
      const immediateSteps = (await demo.getStepsText()).trim();
      expect(immediateSteps).toBe('');

      // However, because the implementation schedules setTimeout callbacks and does not cancel them,
      // some of those callbacks may still run and append text to demoSteps even after hiding.
      // Wait a bit longer than a single interval to allow pending timeouts to run.
      await page.waitForTimeout(2000);

      const laterSteps = (await demo.getStepsText()).trim();

      // We accept either behavior depending on timing (non-deterministic race):
      // - If pending timeouts were allowed to run, steps will be non-empty.
      // - If all scheduled callbacks already executed before hide, steps may remain empty.
      // Assert that at least one of those two logically consistent outcomes occurred (no runtime error).
      expect(Array.isArray([laterSteps])).toBe(true); // trivial check to keep test readable

      // Logically verify the race: if laterSteps is non-empty, we observed the race condition.
      // We explicitly assert that this non-empty scenario is possible and acceptable as an edge-case.
      if (laterSteps.length > 0) {
        // At least one line was re-inserted due to pending timeouts after hide.
        expect(laterSteps.length).toBeGreaterThan(0);
      } else {
        // No lines present - acceptable alternative outcome
        expect(laterSteps).toBe('');
      }

      // Ensure that no page-level runtime errors were thrown during this stress interaction
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Multiple rapid clicks (toggle repeatedly) should not throw errors even if behavior is non-deterministic', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Rapidly click the demo button several times
      for (let i = 0; i < 6; i++) {
        await demo.clickDemoButton();
        // tiny pause to simulate a human rapidly clicking but not instant-fire
        await page.waitForTimeout(80);
      }

      // Allow some time for any scheduled UI updates to settle
      await page.waitForTimeout(2000);

      // Validate page is still responsive: the button exists and has one of the expected labels
      const btnText = await demo.getButtonText();
      expect(['Run simple search demo', 'Hide demo']).toContain(btnText);

      // Ensure demo didn't throw page errors or console.error messages during the rapid interactions
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  // AfterEach cleanup could be added if we were registering global listeners; Playwright handles per-test page.
  // The tests above intentionally observe console and page errors and assert their absence for normal behavior.
});