import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b41db0-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object encapsulating interactions and observability for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];

    // Listen to console events and collect error-level messages
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        // store the message text for assertions
        this.consoleErrors.push(msg.text());
      }
    });

    // Listen to uncaught exceptions on the page
    this.page.on('pageerror', err => {
      // store the Error.message for assertions
      this.pageErrors.push(err && err.message ? err.message : String(err));
    });
  }

  // Navigate to the application
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Helper to get the Run Simulation button element handle
  async getRunButton() {
    return await this.page.$('#demo-button');
  }

  // Click the Run Simulation button (exposed for tests)
  async clickRunSimulation() {
    const btn = await this.getRunButton();
    if (!btn) throw new Error('Run Simulation button not found');
    await btn.click();
  }

  // Check if demo-result is visible (based on computed style)
  async isResultVisible() {
    const el = await this.page.$('#demo-result');
    if (!el) return false;
    const display = await this.page.evaluate(e => {
      // read computed style
      return window.getComputedStyle(e).getPropertyValue('display');
    }, el);
    return display !== 'none';
  }

  // Get number of steps currently present in #demo-steps
  async getStepsCount() {
    return await this.page.evaluate(() => {
      const ol = document.getElementById('demo-steps');
      if (!ol) return 0;
      return ol.querySelectorAll('li').length;
    });
  }

  // Get text content of all steps
  async getStepsText() {
    return await this.page.evaluate(() => {
      const ol = document.getElementById('demo-steps');
      if (!ol) return [];
      return Array.from(ol.querySelectorAll('li')).map(li => li.textContent.trim());
    });
  }

  // Wait until steps count equals expected (with timeout)
  async waitForStepsCount(expected, options = { timeout: 2000 }) {
    await this.page.waitForFunction(
      (expected) => {
        const ol = document.getElementById('demo-steps');
        if (!ol) return false;
        return ol.querySelectorAll('li').length === expected;
      },
      expected,
      options
    );
  }

  // Expose collected console error messages
  getConsoleErrors() {
    return this.consoleErrors;
  }

  // Expose collected page error messages
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('DNS Lookup Simulation FSM tests (Application ID: f0b41db0-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Each test gets a fresh page and DemoPage wrapper
  test.beforeEach(async ({ page }) => {
    // no-op here; navigation occurs in each test for clarity and independence
  });

  test.afterEach(async ({ page }) => {
    // ensure page is closed / reset between tests by Playwright fixtures automatically
    // but we can also clear any lingering listeners if needed (they are tied to the page)
  });

  test('Initial state S0_Idle: page renders with Run DNS Lookup Simulation button and hidden result', async ({ page }) => {
    // This test validates the initial Idle state:
    // - button exists
    // - #demo-result is hidden (display: none)
    // - #demo-steps is present and initially empty
    const demo = new DemoPage(page);
    await demo.goto();

    // Verify button exists and has correct text
    const btn = await demo.getRunButton();
    expect(btn, 'Expected Run DNS Lookup Simulation button to be present').not.toBeNull();
    const btnText = await page.evaluate(el => el.textContent.trim(), btn);
    expect(btnText).toBe('Run DNS Lookup Simulation');

    // Verify demo-result is hidden (Idle state's evidence)
    const visible = await demo.isResultVisible();
    expect(visible).toBeFalsy();

    // Verify demo-steps initially empty
    const stepsCount = await demo.getStepsCount();
    expect(stepsCount).toBe(0);

    // Ensure no uncaught page errors or console errors occurred during initial render
    expect(demo.getPageErrors(), 'No uncaught page errors should occur on initial load').toEqual([]);
    expect(demo.getConsoleErrors(), 'No console.error messages should be logged on initial load').toEqual([]);
  });

  test('Transition RunSimulation: clicking button displays demo-result and populates steps (S0_Idle -> S1_SimulationRunning)', async ({ page }) => {
    // This test validates the event/transition:
    // - clicking #demo-button triggers the population of #demo-steps and reveals #demo-result
    // - the steps count and specific expected content are asserted
    const demo = new DemoPage(page);
    await demo.goto();

    // Click the Run Simulation button once
    await demo.clickRunSimulation();

    // Wait for steps to be populated (expected 11 steps per FSM/implementation)
    await demo.waitForStepsCount(11);

    // Assert demo-result is visible after clicking
    expect(await demo.isResultVisible(), 'demo-result should be visible after running the simulation').toBeTruthy();

    // Assert number of steps equals expected (11)
    const count = await demo.getStepsCount();
    expect(count).toBe(11);

    // Assert contents of first and last steps to ensure correct ordering and text
    const stepsText = await demo.getStepsText();
    expect(stepsText[0]).toContain('1. Browser checks local cache');
    expect(stepsText[stepsText.length - 1]).toContain('11. Browser connects to web server');

    // Ensure no uncaught runtime errors occurred during click/population
    expect(demo.getPageErrors(), 'No uncaught page errors should occur when running the simulation').toEqual([]);
    expect(demo.getConsoleErrors(), 'No console.error messages should be logged when running the simulation').toEqual([]);
  });

  test('Edge case: Re-running the simulation clears previous steps and remains stable (idempotent behavior)', async ({ page }) => {
    // This test validates that subsequent clicks clear previous list items and re-populate
    const demo = new DemoPage(page);
    await demo.goto();

    // First run
    await demo.clickRunSimulation();
    await demo.waitForStepsCount(11);
    const firstRunSteps = await demo.getStepsText();

    // Modify a step text via evaluate (simulate accidental DOM mutation) - NOTE: we do not modify application logic itself
    // We only simulate a user-induced DOM change to ensure the next run clears and repopulates.
    await page.evaluate(() => {
      const li = document.querySelector('#demo-steps li');
      if (li) li.textContent = 'MUTATED STEP';
    });

    // Ensure the mutation took effect
    const mutated = await demo.getStepsText();
    expect(mutated[0]).toBe('MUTATED STEP');

    // Second run should clear and repopulate to original content (script clears innerHTML then repopulates)
    await demo.clickRunSimulation();
    await demo.waitForStepsCount(11);

    const secondRunSteps = await demo.getStepsText();
    expect(secondRunSteps[0]).toContain('1. Browser checks local cache');
    expect(secondRunSteps).toEqual(firstRunSteps);

    // Ensure no page errors logged across repeated runs
    expect(demo.getPageErrors(), 'No uncaught page errors should appear on repeated runs').toEqual([]);
    expect(demo.getConsoleErrors(), 'No console.error messages should be logged on repeated runs').toEqual([]);
  });

  test('Edge case: Rapid multiple clicks do not create duplicate entries or throw runtime errors', async ({ page }) => {
    // This test rapidly triggers the click event multiple times and asserts stability:
    // - final steps count should be 11 (script clears before repopulating)
    // - no page errors or console errors should occur even under quick successive clicks
    const demo = new DemoPage(page);
    await demo.goto();

    // Fire multiple clicks in quick succession
    const btn = await demo.getRunButton();
    expect(btn).not.toBeNull();

    // Rapidly click 5 times without waiting
    for (let i = 0; i < 5; i++) {
      await btn.click();
    }

    // Wait for the expected final state (11 items)
    await demo.waitForStepsCount(11, { timeout: 3000 });

    const count = await demo.getStepsCount();
    expect(count).toBe(11);

    // Basic sanity on content
    const stepsText = await demo.getStepsText();
    expect(stepsText[0]).toContain('1. Browser checks local cache');
    expect(stepsText[stepsText.length - 1]).toContain('11. Browser connects to web server');

    // Check for runtime errors logged to the page or console
    expect(demo.getPageErrors(), 'No uncaught page errors should occur on rapid clicks').toEqual([]);
    expect(demo.getConsoleErrors(), 'No console.error messages should be logged on rapid clicks').toEqual([]);
  });

  test('Observability: collect console and page errors if any (assert none in this implementation)', async ({ page }) => {
    // This test demonstrates observability of errors and asserts that no ReferenceError/SyntaxError/TypeError occurred.
    // Per instructions we observe console and page errors and assert the collected lists.
    const demo = new DemoPage(page);
    await demo.goto();

    // Perform an interaction to ensure runtime code executes (click once)
    await demo.clickRunSimulation();
    await demo.waitForStepsCount(11);

    // Collect captured errors
    const consoleErrors = demo.getConsoleErrors();
    const pageErrors = demo.getPageErrors();

    // Assert that no critical errors (ReferenceError, SyntaxError, TypeError) have been thrown.
    // If the application had runtime errors they would be surfaced here as page errors or console.error messages.
    expect(Array.isArray(consoleErrors)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();

    // For this implementation, we expect zero recorded errors.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});