import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d7e591-fa73-11f0-83e0-8d7be1d51901.html';

// Page object encapsulating interactions and queries for the DP demo app
class DPApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      algorithm: '#algorithm',
      controlsArea: '#controls-area',
      explainArea: '#explain-area',
      algoTitle: '#algo-title',
      algoSub: '#algo-sub',
      visualArea: '#visual-area',
      result: '#result',
      time: '#time',
      calls: '#calls',
      hits: '#hits',
      runBtn: '#run-btn',
      stepBtn: '#step-btn',
      resetBtn: '#reset-btn',
      status: '#status',
      outputArea: '#output-area'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getStatus() {
    return (await this.page.locator(this.selectors.status).textContent()).trim();
  }

  async selectAlgorithm(value) {
    await this.page.selectOption(this.selectors.algorithm, value);
    // ensure setupControls() has run and DOM updated
    await this.page.waitForTimeout(30);
  }

  async clickRun() {
    await Promise.all([
      this.page.waitForTimeout(10), // allow status change sequence to be visible
      this.page.click(this.selectors.runBtn)
    ]);
  }

  async clickStep() {
    await Promise.all([
      this.page.waitForTimeout(10),
      this.page.click(this.selectors.stepBtn)
    ]);
  }

  async clickReset() {
    await this.page.click(this.selectors.resetBtn);
  }

  async pressKey(key) {
    await this.page.keyboard.press(key);
  }

  async getResultText() {
    return (await this.page.locator(this.selectors.result).textContent()).trim();
  }

  async setNumberInput(id, value) {
    const loc = this.page.locator(`#${id}`);
    await loc.fill(String(value));
  }

  async setRangeInput(id, value) {
    const loc1 = this.page.locator(`#${id}`);
    // range input may not accept direct fill; use evaluate to set value and dispatch input event
    await this.page.evaluate(
      ({ id, value }) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
      { id, value }
    );
  }

  async getVisualInnerText() {
    return (await this.page.locator(this.selectors.visualArea).textContent()) || '';
  }

  async waitForStatusChange(expected, timeout = 3000) {
    await expect.poll(async () => this.getStatus(), {
      timeout
    }).toEqual(expected);
  }

  async locateInVisual(textOrSelector) {
    return this.page.locator(this.selectors.visualArea).locator(textOrSelector);
  }
}

test.describe('DP Interactive Demonstration - FSM and UI behavior', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages; store severity/type
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app
    const app = new DPApp(page);
    await app.goto();
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity: there should be no unhandled page errors during normal interactions.
    // If errors occur in the app code naturally, these will be reported and this assertion will fail,
    // making test output show the runtime exceptions for debugging.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);

    // Ensure no console.error messages were emitted.
    const errorConsole = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
    expect(errorConsole.length, `Unexpected console error messages: ${JSON.stringify(errorConsole, null, 2)}`).toBe(0);
  });

  test.describe('Initial state (S0_Idle) and Algorithm selection (S1_AlgorithmSelected)', () => {
    test('Initial load should set up controls and show Ready status (S0_Idle entry action setupControls())', async ({ page }) => {
      const app1 = new DPApp(page);
      // Verify status text shows Ready, indicating setupControls() ran on load
      await expect(page.locator(app.selectors.status)).toHaveText('Ready');

      // Controls area should contain inputs for the default algorithm (fib), e.g., number input id='n'
      await expect(page.locator('#n')).toBeVisible();
      // Explanation area updated
      await expect(page.locator(app.selectors.explainArea)).toContainText('Fibonacci');

      // Validate outputs are in their initial "empty" state
      await expect(page.locator(app.selectors.result)).toHaveText('—');
      await expect(page.locator(app.selectors.time)).toHaveText('—');
    });

    test('Selecting another algorithm triggers setupControls() and updates UI (AlgorithmChange -> S1_AlgorithmSelected)', async ({ page }) => {
      const app2 = new DPApp(page);
      // Change to LCS
      await app.selectAlgorithm('lcs');

      // Verify title and explanation update for LCS
      await expect(page.locator(app.selectors.algoTitle)).toHaveText('Longest Common Subsequence (LCS)');
      await expect(page.locator(app.selectors.explainArea)).toContainText('Longest Common Subsequence');

      // Controls for LCS should include text inputs s1 and s2
      await expect(page.locator('#s1')).toBeVisible();
      await expect(page.locator('#s2')).toBeVisible();

      // Ensure status remained Ready after changing algorithm (setupControls resets status)
      await expect(page.locator(app.selectors.status)).toHaveText('Ready');
    });
  });

  test.describe('Run interactions (S2_Running) and Step mode (S3_StepMode)', () => {
    test('Clicking Run triggers run(false): status goes to Running then Done (transition S1 -> S2)', async ({ page }) => {
      const app3 = new DPApp(page);
      // Ensure algorithm is Fibonacci
      await app.selectAlgorithm('fib');
      // minimize animation delays to speed test
      await app.setRangeInput('delay', 0);
      // set small n so any inner processing is trivial
      await app.setNumberInput('n', 5);

      // Click Run - run() should set status to 'Running' and then 'Done' after runFibonacci returns
      await page.click('#run-btn');

      // Verify status briefly shows Running (it might change very fast). Poll and accept either Running or Done.
      // Ensure that eventually it becomes 'Done' (run() sets Done if not stopped).
      await expect.poll(async () => (await page.locator('#status').textContent()).trim(), { timeout: 1000 }).toMatch(/(Running|Done)/);

      await app.waitForStatusChange('Done', 2000);

      // After run completes, the visual area should have been created (buttons for variants)
      await expect(page.locator('#visual-area')).toBeVisible();
      await expect(page.locator('#visual-area')).toContainText('Naive Recursion');
    });

    test('Clicking Step triggers step mode (run(true)): status shows Step mode — running then Done (S1 -> S3)', async ({ page }) => {
      const app4 = new DPApp(page);
      await app.selectAlgorithm('fib');
      await app.setRangeInput('delay', 0);
      await app.setNumberInput('n', 6);

      // Click Step
      await page.click('#step-btn');

      // Expect status to indicate step mode running then to be Done after run() completes
      await expect.poll(async () => (await page.locator('#status').textContent()).trim(), { timeout: 1000 }).toMatch(/(Step mode — running|Done)/);

      await app.waitForStatusChange('Done', 2000);

      // Visual area should contain the controls for choosing naive/memo/bottom-up
      await expect(page.locator('#visual-area')).toContainText('Naive Recursion');
      await expect(page.locator('#visual-area')).toContainText('Top-down Memo');
    });

    test('Within step mode, clicking Naive Recursion produces step visualization and updates result and call count', async ({ page }) => {
      const app5 = new DPApp(page);
      await app.selectAlgorithm('fib');
      // Use very small delay to speed up step expansion
      await app.setRangeInput('delay', 10);
      await app.setNumberInput('n', 6);

      // Enter step mode via keyboard 'S' to exercise KeyStep event
      await app.pressKey('S');

      // Wait until visual buttons appear
      const visual = page.locator('#visual-area');
      await expect(visual).toContainText('Naive Recursion');

      // Click the Naive Recursion button inside visual area
      // Use locator that finds a button with exact text
      const naiveBtn = visual.locator('button', { hasText: 'Naive Recursion' }).first();
      await naiveBtn.click();

      // The step-by-step visualization increments a global __fib_call_count; wait until it's set and result updated
      await expect.poll(async () => (await app.getResultText()), { timeout: 5000 }).not.toBe('computing…');

      // Result should be the fibonacci value for n=6 (which is 8)
      await expect(page.locator('#result')).toHaveText('8');

      // The visual tree should include entries like fib(6) or fib(5)
      await expect(visual).toContainText('fib(6)');
      // The app exposes call count in window.__fib_call_count; verify it's present and greater than zero via evaluating
      const calls = await page.evaluate(() => window.__fib_call_count || 0);
      expect(calls).toBeGreaterThan(0);
    }, 20000);
  });

  test.describe('Reset/Stopped state (S4_Stopped) and Reset transitions', () => {
    test('Clicking Reset during a running LCS run stops the animation and returns to Ready (S2 -> S4 via ResetClick)', async ({ page }) => {
      const app6 = new DPApp(page);
      // Choose LCS which has an animated table fill in runLCS
      await app.selectAlgorithm('lcs');
      // Reduce delay so table animation is faster but still allows interrupt
      await app.setRangeInput('delay', 50);

      // Start run via Run (this will call runLCS and fill table iteratively)
      await page.click('#run-btn');

      // Wait a little to ensure runLCS has started and status is Running
      await expect.poll(async () => (await app.getStatus()), { timeout: 1000 }).toMatch(/(Running|Running LCS DP|Done)/);

      // Immediately click Reset to simulate stopping
      await page.click('#reset-btn');

      // After reset, status should be 'Ready' and output/result reset
      await expect.poll(async () => (await app.getStatus()), { timeout: 1000 }).toEqual('Ready');
      await expect(page.locator('#result')).toHaveText('—');
      // Visual area should be cleared (setupControls resets visual area)
      const visText = await app.getVisualInnerText();
      expect(visText.trim().length).toBeLessThan(2000); // visual area emptied or reset
    });

    test('Pressing X key triggers KeyReset and returns UI to initial Ready state (S2/S3 -> S4 via KeyReset)', async ({ page }) => {
      const app7 = new DPApp(page);
      // Start any run (use LCS again to create an active run)
      await app.selectAlgorithm('lcs');
      await app.setRangeInput('delay', 60);
      await page.click('#run-btn');

      // Give it a moment to start
      await expect.poll(async () => (await app.getStatus()), { timeout: 1000 }).toMatch(/(Running|Running LCS DP|Done)/);

      // Press X to reset via keyboard shortcut
      await app.pressKey('X');

      // After pressing, app should reset to Ready
      await expect.poll(async () => (await app.getStatus()), { timeout: 1000 }).toEqual('Ready');
      // Controls area should contain inputs for LCS again (s1/s2)
      await expect(page.locator('#s1')).toBeVisible();
      await expect(page.locator('#s2')).toBeVisible();
    });
  });

  test.describe('Keyboard shortcuts (KeyRun and KeyStep) and edge scenarios', () => {
    test('Pressing R starts a run (KeyRun event)', async ({ page }) => {
      const app8 = new DPApp(page);
      await app.selectAlgorithm('fib');
      await app.setNumberInput('n', 5);
      await app.setRangeInput('delay', 0);

      // Press R to run via keyboard
      await app.pressKey('R');

      // run() should set status Running then Done
      await app.waitForStatusChange('Done', 2000);
      // Visual area created
      await expect(page.locator('#visual-area')).toContainText('Naive Recursion');
    });

    test('Edge case: extremely large LCS strings prompt confirm and do not crash (error scenario handling)', async ({ page }) => {
      const app9 = new DPApp(page);
      await app.selectAlgorithm('lcs');

      // Set very large strings to trigger the confirm branch (the code calls confirm)
      const big = 'A'.repeat(100); // length 100 will trigger the check (m > 30)
      await page.fill('#s1', big);
      await page.fill('#s2', big);

      // Intercept window.confirm to automatically return false to avoid proceeding
      await page.evaluate(() => {
        window.__orig_confirm = window.confirm;
        window.confirm = () => false;
      });

      // Click Run which will call runLCS and hit confirm; since confirm returns false, it should simply return without errors
      await page.click('#run-btn');

      // Restore original confirm
      await page.evaluate(() => {
        if (window.__orig_confirm) {
          window.confirm = window.__orig_confirm;
          delete window.__orig_confirm;
        }
      });

      // After attempted run and aborted by confirm, status should be 'Done' or stay 'Ready' depending on code path.
      // The important assertion is that no runtime exception occurs.
      await expect.poll(async () => (await app.getStatus()), { timeout: 2000 }).toMatch(/(Ready|Done|Running)/);
    });
  });

  test.describe('OnEnter/OnExit behavior validations and extra assertions', () => {
    test('setupControls() (entry action for S0_Idle and S4_Stopped) is called and results in default Ready state after reset', async ({ page }) => {
      const app10 = new DPApp(page);
      // Ensure initial Ready state from setupControls
      await expect(page.locator('#status')).toHaveText('Ready');

      // Change algorithm, then reset and ensure setupControls reinitializes the UI
      await app.selectAlgorithm('climb');
      await expect(page.locator('#algo-title')).toHaveText('Climb Stairs (DP demo)');

      // Click Reset -> should run setupControls (S4 entry action) and reset status to Ready and controls to default values
      await page.click('#reset-btn');

      await expect(page.locator('#status')).toHaveText('Ready');
      // For climb algorithm reset, controls area should now contain the number input 'n' again when algorithm is 'climb'
      await expect(page.locator('#n')).toBeVisible();
    });

    test('run(false) and run(true) (onEnter for S2 and S3) set status appropriately and eventually update to Done (onExit updateStatus("Done"))', async ({ page }) => {
      const app11 = new DPApp(page);
      await app.selectAlgorithm('fib');
      await app.setNumberInput('n', 5);
      await app.setRangeInput('delay', 0);

      // Run (non-step)
      await page.click('#run-btn');
      // After run returns, status should be Done (exit action)
      await app.waitForStatusChange('Done', 2000);

      // Step
      await page.click('#step-btn');
      await app.waitForStatusChange('Done', 2000);
    });
  });
});