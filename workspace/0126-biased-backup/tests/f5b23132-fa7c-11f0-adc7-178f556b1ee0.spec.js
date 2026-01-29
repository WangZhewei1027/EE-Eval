import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b23132-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the CPU Scheduling demo page
class CpuSchedulingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#cpu-scheduling-demo');
    // The application, as extracted from the FSM, would show some "Demo is running" indicator.
    // The implementation provided does not include that element; tests will check for its absence.
    this.demoRunningText = page.locator('text=Demo is running');
    this.demoStoppedText = page.locator('text=Demo has stopped');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async isButtonVisible() {
    return await this.button.isVisible();
  }

  async buttonText() {
    return await this.button.innerText();
  }

  async clickRunDemo() {
    await this.button.click();
  }

  async demoRunningExists() {
    return (await this.demoRunningText.count()) > 0;
  }

  async demoStoppedExists() {
    return (await this.demoStoppedText.count()) > 0;
  }

  // Query for global functions that the FSM claims should exist on state entry/exit.
  async hasGlobalFunction(fnName) {
    return await this.page.evaluate((name) => {
      // Intentionally only reading typeof from the page context.
      // Do NOT define or modify any globals — just observe.
      return typeof window[name] === 'function';
    }, fnName);
  }
}

test.describe('CPU Scheduling Demo - FSM validation (f5b23132-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Collect console error messages and page errors for assertions
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages emitted by the page
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // Swallow any listener-side issues, but do not modify page environment.
      }
    });

    // Capture unhandled exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.stack ? err.stack.toString() : String(err));
    });

    // Navigate to the application page exactly as-is.
    // We expect the page to attempt to load script.js (per HTML) which may cause errors.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({}, testInfo) => {
    // If a test fails, attach captured console/page errors to aid debugging.
    if (testInfo.status !== testInfo.expectedStatus) {
      // Print out captured messages to the test output logs.
      // This is intentionally observational only.
      for (const err of consoleErrors) {
        testInfo.attach('console-error', { body: err, contentType: 'text/plain' });
      }
      for (const perr of pageErrors) {
        testInfo.attach('page-error', { body: perr, contentType: 'text/plain' });
      }
    }
  });

  test('Initial Idle state renders the Run CPU Scheduling Demo button', async ({ page }) => {
    // Validate the Idle state evidence per FSM: button exists with expected id/text
    const app = new CpuSchedulingPage(page);

    // Button should be visible
    expect(await app.isButtonVisible()).toBeTruthy();

    // Button text should match the component description
    const text = await app.buttonText();
    expect(text).toBe('Run CPU Scheduling Demo');

    // There should be no explicit "Demo is running" or "Demo has stopped" indicators initially
    expect(await app.demoRunningExists()).toBeFalsy();
    expect(await app.demoStoppedExists()).toBeFalsy();
  });

  test('On-enter / global functions expected by FSM are not present in the page (observational)', async ({ page }) => {
    // The FSM lists renderPage(), startDemo(), stopDemo() on entries/exits.
    // We will observe whether these globals exist without injecting or defining them.
    const app = new CpuSchedulingPage(page);

    const hasRenderPage = await app.hasGlobalFunction('renderPage');
    const hasStartDemo = await app.hasGlobalFunction('startDemo');
    const hasStopDemo = await app.hasGlobalFunction('stopDemo');

    // The provided HTML does not define these functions inline.
    // Assert that they are NOT present (this test documents the discrepancy).
    expect(hasRenderPage).toBeFalsy();
    expect(hasStartDemo).toBeFalsy();
    expect(hasStopDemo).toBeFalsy();
  });

  test('Attempt to trigger RunDemo transition by clicking the button (observe behavior and errors)', async ({ page }) => {
    // This test clicks the button and observes the page for expected transition artifacts.
    // Per instructions we must NOT patch the environment; we observe console and page errors instead.
    const app = new CpuSchedulingPage(page);

    // Precondition: captured errors could already exist due to script loading; record initial counts.
    const initialConsoleErrorsCount = consoleErrors.length;
    const initialPageErrorsCount = pageErrors.length;

    // Click the button to attempt to start the demo. If the page had an onclick handler or startDemo function,
    // this would trigger it. We simply click and then observe.
    await app.clickRunDemo();

    // Allow a short time for any resulting scripts to run and for errors to surface.
    await page.waitForTimeout(250);

    // Verify that no explicit "Demo is running" observable text was added by the page implementation.
    // FSM expected: "Demo is running" when transitioning to S1_DemoRunning. The HTML does not provide this,
    // so we assert its absence.
    expect(await app.demoRunningExists()).toBeFalsy();

    // Also assert that the page did not create a "Demo has stopped" indicator unexpectedly.
    expect(await app.demoStoppedExists()).toBeFalsy();

    // Observational requirement: capture console errors and page errors.
    // The page references a script.js that is not provided in the HTML snippet; this often leads to a console error
    // for failed resource loading. We assert that at least one console error related to script loading or runtime
    // has occurred either during load or as a result of the click.
    // NOTE: This assertion assumes the environment yields at least one console error. This is an observational
    // check to ensure missing or faulty scripts are surfaced in logs.
    const newConsoleErrorsCount = consoleErrors.length - initialConsoleErrorsCount;
    const newPageErrorsCount = pageErrors.length - initialPageErrorsCount;

    // At least one error should be observable (either console error or page error).
    // This follows the task instruction to observe and assert errors that happen naturally.
    const observedError = newConsoleErrorsCount > 0 || newPageErrorsCount > 0;
    expect(observedError).toBeTruthy();

    // If there are pageErrors, at least one should contain an error type indicator (e.g., ReferenceError, TypeError, SyntaxError)
    if (pageErrors.length > 0) {
      const joined = pageErrors.join('\n').toLowerCase();
      const containsKnown = joined.includes('referenceerror') || joined.includes('typeerror') || joined.includes('syntaxerror');
      // At least one page error should indicate an actual runtime exception if present.
      expect(containsKnown).toBeTruthy();
    }

    // Additionally, assert that the start/stop functions are still not present after clicking.
    // This verifies onEnter/onExit were not executed (because the functions don't exist).
    const hasStartDemo = await app.hasGlobalFunction('startDemo');
    const hasStopDemo = await app.hasGlobalFunction('stopDemo');
    expect(hasStartDemo).toBeFalsy();
    expect(hasStopDemo).toBeFalsy();
  });

  test('Edge case: rapid double-click should not produce a visible demo state and should be safe (no unexpected DOM injection)', async ({ page }) => {
    // Validate that rapid user interaction does not cause unexpected DOM changes.
    const app = new CpuSchedulingPage(page);

    // Rapidly click the button twice
    await Promise.all([
      app.clickRunDemo(),
      app.clickRunDemo()
    ]);

    // Wait for possible async side-effects
    await page.waitForTimeout(200);

    // The page implementation does not define the demo lifecycle UI; assert that no demo indicators are present.
    expect(await app.demoRunningExists()).toBeFalsy();
    expect(await app.demoStoppedExists()).toBeFalsy();

    // Confirm that no new global functions were magically created as a result of clicks.
    expect(await app.hasGlobalFunction('startDemo')).toBeFalsy();
    expect(await app.hasGlobalFunction('stopDemo')).toBeFalsy();

    // Ensure that errors have been observed (network loading or runtime)
    // This repeats the observational assertion to ensure the environment surfaced errors naturally.
    expect(consoleErrors.length + pageErrors.length).toBeGreaterThan(0);
  });

  test('FSM transition back (S1 -> S0) observation: clicking again should not unexpectedly show "Demo has stopped"', async ({ page }) => {
    // This test models the transition from DemoRunning back to Idle by clicking again.
    // Since the implementation doesn't provide the demo lifecycle, we assert the absence of "Demo has stopped".
    const app = new CpuSchedulingPage(page);

    // Click once (attempt to start)
    await app.clickRunDemo();
    await page.waitForTimeout(150);

    // Click again (attempt to stop)
    await app.clickRunDemo();
    await page.waitForTimeout(150);

    // There is no DOM evidence for "Demo has stopped" in the provided HTML, so it should not exist.
    expect(await app.demoStoppedExists()).toBeFalsy();

    // And still no global stopDemo function defined
    expect(await app.hasGlobalFunction('stopDemo')).toBeFalsy();

    // Assert that the environment surfaced errors (as required to observe natural exceptions if any)
    expect(consoleErrors.length + pageErrors.length).toBeGreaterThan(0);
  });
});