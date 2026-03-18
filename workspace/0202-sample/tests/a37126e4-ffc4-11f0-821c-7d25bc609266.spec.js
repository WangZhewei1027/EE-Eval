import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a37126e4-ffc4-11f0-821c-7d25bc609266.html';

// Page Object for the Prim's Algorithm demo page
class PrimDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runDemoBtn');
    this.demoArea = page.locator('#demoArea');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRun() {
    await this.runBtn.click();
  }

  async getDemoText() {
    return (await this.demoArea.textContent()) ?? '';
  }

  async isButtonDisabled() {
    return await this.runBtn.isDisabled();
  }
}

test.describe('Prim’s Algorithm demo FSM - a37126e4-ffc4-11f0-821c-7d25bc609266', () => {
  // Increase timeout for tests that wait for the full demonstration to complete.
  test.setTimeout(90_000);

  // Utility to attach listeners to collect console errors and page errors.
  async function collectErrors(page) {
    const consoleErrors = [];
    const pageErrors = [];

    const consoleListener = (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // ignore
      }
    };
    const pageErrorListener = (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    };

    page.on('console', consoleListener);
    page.on('pageerror', pageErrorListener);

    return {
      stop: () => {
        page.off('console', consoleListener);
        page.off('pageerror', pageErrorListener);
      },
      getConsoleErrors: () => consoleErrors,
      getPageErrors: () => pageErrors,
    };
  }

  test('S0 Idle state: initial render shows Run button and demo area (Idle)', async ({ page }) => {
    // This test validates the initial Idle state (S0_Idle)
    // - Button is present and enabled
    // - Demo area has the initial instructional text and ARIA attributes
    // - No console or page errors on initial load

    const errors = await collectErrors(page);
    const demo = new PrimDemoPage(page);
    await demo.goto();

    // Verify button exists and initial label
    await expect(demo.runBtn).toBeVisible();
    await expect(demo.runBtn).toHaveText("Run Prim's Algorithm Demonstration");
    const disabled = await demo.isButtonDisabled();
    expect(disabled).toBeFalsy();

    // Verify demo area initial content and accessibility attributes
    await expect(demo.demoArea).toBeVisible();
    const text = await demo.getDemoText();
    expect(text).toContain('Click the button above to start the demonstration');
    // Check ARIA attributes present
    const ariaLive = await page.getAttribute('#demoArea', 'aria-live');
    const ariaAtomic = await page.getAttribute('#demoArea', 'aria-atomic');
    expect(ariaLive).toBe('polite');
    expect(ariaAtomic).toBe('true');

    // Ensure no console errors or page errors happened on load
    // (collectErrors listens synchronously from navigation)
    const consoleErrors = errors.getConsoleErrors();
    const pageErrors = errors.getPageErrors();
    errors.stop();
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S0 -> S1 transition: clicking Run starts demo, disables button and clears demo area (Demo Running)', async ({ page }) => {
    // This test validates the transition from Idle (S0) to Demo Running (S1)
    // - Clicking the button disables it (onEnter action: btn.disabled = true)
    // - Demo area is cleared (onEnter action: demoArea.textContent = "")
    // - The first step of the demo appears after the interval starts

    const errors = await collectErrors(page);
    const demo = new PrimDemoPage(page);
    await demo.goto();

    // Click to start demo
    await demo.clickRun();

    // Immediately after clicking, button should be disabled and demo area cleared
    expect(await demo.isButtonDisabled()).toBeTruthy();
    const interimText = await demo.getDemoText();
    // The code clears demoArea.textContent = "" synchronously at start of runDemo()
    // So immediately it should be empty string or whitespace only; normalize to ensure empty
    expect(interimText.trim()).toBe('');

    // Wait for the first step to appear. The implementation emits the first step after 2500ms.
    // Allow a generous timeout for the first step to appear.
    await page.waitForFunction(() => {
      const el = document.getElementById('demoArea');
      return el && el.textContent && el.textContent.includes('Step 1');
    }, {}, { timeout: 6000 });

    const demoTextAfterStep1 = await demo.getDemoText();
    expect(demoTextAfterStep1).toContain('Step 1:');
    expect(demoTextAfterStep1).toContain('MST_Set = {A}'); // content of first step

    // Ensure no console or page errors occurred during start
    const consoleErrors = errors.getConsoleErrors();
    const pageErrors = errors.getPageErrors();
    errors.stop();
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S1 -> S2 transition: full demonstration completes and button is re-enabled (Demo Completed)', async ({ page }) => {
    // This test validates the Demo Running -> Demo Completed transition.
    // - After all steps, "Demonstration completed." is appended to demoArea
    // - The button is re-enabled after completion (exit action: btn.disabled = false)
    // - The demo produced all expected step lines (there are 9 steps in the implementation)
    //
    // NOTE: The demo runs with a 2500ms interval between steps for 9 steps => ~22.5s total.
    // We set an overall generous timeout at the top of the describe block.

    const errors = await collectErrors(page);
    const demo = new PrimDemoPage(page);
    await demo.goto();

    // Start the demo
    await demo.clickRun();

    // Wait for the final completion message to appear.
    await page.waitForFunction(() => {
      const el = document.getElementById('demoArea');
      return el && el.textContent && el.textContent.includes('Demonstration completed.');
    }, {}, { timeout: 60_000 }); // allow up to 60s for the whole demo run

    // After completion, check the final text includes completion message
    const finalText = await demo.getDemoText();
    expect(finalText).toContain('Demonstration completed.');

    // Ensure button is re-enabled
    expect(await demo.isButtonDisabled()).toBeFalsy();

    // Count how many "Step " occurrences are present; expect 9 steps
    const stepOccurrences = (finalText.match(/Step\s+\d+/g) || []).length;
    expect(stepOccurrences).toBe(9);

    // Ensure no console or page errors occurred during the demo run
    const consoleErrors = errors.getConsoleErrors();
    const pageErrors = errors.getPageErrors();
    errors.stop();
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: rapid double clicks - second invocation ignored due to demoRunning guard', async ({ page }) => {
    // This test validates the guard inside runDemo():
    // if (demoRunning) return;
    // We exercise this by dispatching two click events in immediate succession.
    // The expected behavior: only one sequence of steps is produced (no duplicated Step 1 entries).
    // Also the button should be disabled while running.

    const errors = await collectErrors(page);
    const demo = new PrimDemoPage(page);
    await demo.goto();

    // Dispatch two click events synchronously inside the page context.
    // The first call to runDemo will set demoRunning = true; the second should return early.
    await page.evaluate(() => {
      const btn = document.getElementById('runDemoBtn');
      const ev1 = new MouseEvent('click', { bubbles: true, cancelable: true });
      const ev2 = new MouseEvent('click', { bubbles: true, cancelable: true });
      // Dispatch them back-to-back
      btn.dispatchEvent(ev1);
      btn.dispatchEvent(ev2);
    });

    // Ensure button quickly becomes disabled
    await expect(demo.runBtn).toBeDisabled();

    // Wait for the first step to appear
    await page.waitForFunction(() => {
      const el = document.getElementById('demoArea');
      return el && el.textContent && el.textContent.includes('Step 1');
    }, {}, { timeout: 6000 });

    // Now check that "Step 1" appears exactly once (no duplicate start)
    const currentText = await demo.getDemoText();
    const step1Count = (currentText.match(/Step\s+1:/g) || []).length;
    expect(step1Count).toBe(1);

    // For additional assurance, wait a bit longer and ensure no duplicated Step 1 appears later
    await page.waitForTimeout(1000);
    const laterText = await demo.getDemoText();
    const laterStep1Count = (laterText.match(/Step\s+1:/g) || []).length;
    expect(laterStep1Count).toBe(1);

    // Clean up: wait for completion to avoid leaving background intervals running during other tests
    await page.waitForFunction(() => {
      const el = document.getElementById('demoArea');
      return el && el.textContent && el.textContent.includes('Demonstration completed.');
    }, {}, { timeout: 60_000 });

    // Ensure no console or page errors occurred during this scenario
    const consoleErrors = errors.getConsoleErrors();
    const pageErrors = errors.getPageErrors();
    errors.stop();
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});