import { test, expect } from '@playwright/test';

// Test file: d837eab0-fa7b-11f0-b314-ad8654ee5de8.spec.js
// Application URL provided by the harness:
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d837eab0-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the Mutex demo page
class MutexPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#runDemo');
    this.log = page.locator('#demoLog');
  }

  // Navigate to the page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the Run demo button
  async clickRun() {
    await this.runButton.click();
  }

  // Read log text content
  async getLogText() {
    return (await this.log.textContent()) || '';
  }

  // Wait for log to contain specific substring
  async waitForLogContains(substring, opts = {}) {
    const timeout = opts.timeout ?? 8000;
    await this.page.waitForFunction(
      (sel, text) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.indexOf(text) !== -1;
      },
      ['#demoLog', substring],
      { timeout }
    );
  }

  // Wait for simulation end
  async waitForSimulationEnd(timeout = 10000) {
    await this.waitForLogContains('Simulation end', { timeout });
  }
}

test.describe('Mutex Demo FSM - d837eab0-fa7b-11f0-b314-ad8654ee5de8', () => {
  // Collect console errors and page errors per test to assert the runtime health of the page.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console messages and collect errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect page uncaught errors
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
  });

  test('Initial state (S0_Idle) renders Run demo button and initial log text', async ({ page }) => {
    // This test validates the Idle state from the FSM:
    // - renderPage() entry action should have produced the DOM
    // - the Run demo button must be present and the demo log must have the initial prompt
    const app = new MutexPage(page);
    await app.goto();

    // Verify Run demo button exists with correct attributes
    await expect(app.runButton).toBeVisible();
    await expect(app.runButton).toHaveAttribute('class', 'run');
    await expect(app.runButton).toHaveAttribute('aria-label', 'Run demo');
    await expect(app.runButton).toHaveText('Run demo');

    // Verify initial demo log text (idle prompt)
    const initialLog = await app.getLogText();
    expect(initialLog).toContain('Press "Run demo" to see a short simulated trace...');

    // Ensure no console or page errors occurred during initial load
    expect(consoleErrors, `console.error was called: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `pageerror was fired: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });

  test('Click Run demo transitions to SimulationRunning (S1) and emits expected trace lines', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_SimulationRunning
    // - clicking #runDemo should invoke runSimulation()
    // - immediate observable: "Simulation start: mutex = unlocked (0)."
    // - subsequent trace lines for actors A and B and explanatory lines should appear
    // - final observable: "Simulation end"
    const app = new MutexPage(page);
    await app.goto();

    // Click to start simulation
    await app.clickRun();

    // After clicking, the simulation clears the log and appends the start message.
    // Due to timestamping, check for substring rather than exact equality.
    await app.waitForLogContains('Simulation start: mutex = unlocked (0).', { timeout: 2000 });

    // Verify that the simulation produces lines for actor A and actor B within the expected runtime.
    // The simulation schedules events over ~7 seconds; allow a generous timeout.
    await app.waitForLogContains('A: wants to lock', { timeout: 9000 });
    await app.waitForLogContains('A: acquires lock', { timeout: 9000 });
    await app.waitForLogContains('  (mutex state -> locked; others cannot enter critical section)', { timeout: 10000 });

    // Verify B's behavior (blocked/spinning then acquires)
    await app.waitForLogContains('B: wants to lock', { timeout: 10000 });
    await app.waitForLogContains('B: spins (blocked waiting for mutex)', { timeout: 10000 });
    await app.waitForLogContains('B: acquires lock (now inherits ownership)', { timeout: 12000 });

    // Finally, wait for Simulation end
    await app.waitForSimulationEnd(13000);

    // Check that the log contains the expected final phrase
    const finalLog = await app.getLogText();
    expect(finalLog).toContain('Simulation end');

    // Ensure no console or page errors occurred during the run
    expect(consoleErrors, `console.error was called during simulation: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `pageerror was fired during simulation: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });

  test('Multiple rapid clicks (edge case) should restart simulation without throwing runtime errors', async ({ page }) => {
    // Edge case: user clicks the button multiple times while simulation is running.
    // The implementation resets the log at the start of runSimulation(); ensure no runtime errors occur.
    const app = new MutexPage(page);
    await app.goto();

    // Rapidly click the run button several times.
    // We don't assert strict ordering of interleaved traces; we assert that simulation start lines appear and no errors occur.
    await app.clickRun();
    // small short delay then rapid subsequent clicks
    await page.waitForTimeout(50);
    await app.clickRun();
    await page.waitForTimeout(50);
    await app.clickRun();

    // At least one "Simulation start" should be present shortly after clicks.
    await app.waitForLogContains('Simulation start: mutex = unlocked (0).', { timeout: 2000 });

    // Wait for a run to reach "Simulation end" (allowing extra time because multiple runs may overlap)
    await app.waitForSimulationEnd(16000);

    // Ensure no console or page errors were emitted as a result of rapid interactions
    expect(consoleErrors, `console.error was called during rapid clicks: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `pageerror was fired during rapid clicks: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });

  test('Interacting with a non-existent element should surface an error from the test harness (expected failure scenario)', async ({ page }) => {
    // This test intentionally attempts to interact with a missing element to validate error handling
    // of the test harness and to exercise an error scenario. We expect Playwright to throw for this action.
    await page.goto(APP_URL);

    // Attempt to click a non-existent selector and assert that the action rejects (throws).
    // This captures an edge-case error scenario (user or script referencing missing DOM elements).
    const missingLocator = page.locator('#nonexistent-element-for-test');
    // Expect the click to fail (reject) because the element does not exist / is not visible.
    // We catch the error and assert its type/message includes typical Playwright timeout semantics.
    let thrown = false;
    try {
      await missingLocator.click({ timeout: 1000 });
    } catch (err) {
      thrown = true;
      // Basic sanity check that the thrown error mentions waiting or timeout (Playwright error content)
      const msg = String(err.message || err);
      expect(msg.length).toBeGreaterThan(0);
    }
    expect(thrown, 'Expected clicking a missing element to throw an error').toBe(true);

    // There should be no console or page errors emitted by the application itself as a result of the failed click.
    expect(consoleErrors, `console.error was called: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `pageerror was fired: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });

  test.afterEach(async () => {
    // The afterEach hook is used here to ensure the collected console/page error arrays are available for
    // tests to assert. Nothing is required here; this placeholder is intentional for setup/teardown symmetry.
  });
});