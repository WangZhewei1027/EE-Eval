import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cdac11-fa7c-11f0-ba20-415c525382ea.html';

// Increase default timeout for tests that wait for the full simulation
test.setTimeout(40_000);

// Page Object for the Runtime Simulation page
class RuntimePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runDemoBtn');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the main button to be visible as a sign the page rendered
    await this.runBtn.waitFor({ state: 'visible' });
  }

  async clickRun() {
    await this.runBtn.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async waitForOutputIncludes(substring, options = {}) {
    const timeout = options.timeout ?? 15_000;
    await this.page.waitForFunction(
      (sel, str) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.includes(str);
      },
      '#demoOutput',
      substring,
      { timeout }
    );
  }

  async waitForStep(stepNumber, options = {}) {
    const substring = `Step ${stepNumber}:`;
    return this.waitForOutputIncludes(substring, options);
  }

  async waitForCompletion(options = {}) {
    const substring = '[Simulation complete';
    return this.waitForOutputIncludes(substring, options);
  }
}

test.describe('FSM: Runtime Simulation - States and Transitions', () => {
  // Capture console errors and page errors per test
  test.beforeEach(async ({ page }) => {
    // no-op placeholder; individual tests set up listeners as needed
  });

  // Validate the Idle state (S0_Idle) - page initially renders with button and empty output
  test('Idle state on load: button and output rendered (S0_Idle)', async ({ page }) => {
    // Arrange: set up page object
    const runtime = new RuntimePage(page);

    // Observe console messages and page errors
    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    // Act: navigate to the app
    await runtime.goto();

    // Assert: button exists and has expected label (evidence for S0_Idle)
    await expect(runtime.runBtn).toBeVisible();
    await expect(runtime.runBtn).toHaveText('Run Runtime Simulation');

    // Assert: demo output exists, has aria-live attribute and is initially empty
    await expect(runtime.output).toBeVisible();
    const ariaLive = await page.locator('#demoOutput').getAttribute('aria-live');
    expect(ariaLive).toBe('polite');

    const initialText = await runtime.getOutputText();
    expect(initialText.trim()).toBe('', 'Expected demoOutput to be empty on initial render (Idle state)');

    // Assert: no uncaught page errors or console.error messages happened during load
    expect(pageErrors).toEqual([], `Unexpected page errors during load: ${pageErrors.map(e => e.message).join('; ')}`);
    expect(consoleErrors).toEqual([], `Unexpected console.error messages during load: ${consoleErrors.join('; ')}`);
  });

  // Transition: clicking button should start simulation (S0_Idle -> S1_SimulationRunning)
  test('Transition to Simulation Running on click: first steps appear and state active (S1_SimulationRunning)', async ({ page }) => {
    const runtime = new RuntimePage(page);

    // Collect console and page errors
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err));

    await runtime.goto();

    // Precondition: ensure idle state
    expect(await runtime.getOutputText()).toBe('');

    // Act: click the Run button to trigger runRuntimeSimulation() (transition event: RunDemo)
    await runtime.clickRun();

    // Immediately after click, the code appends Step 1 synchronously before the first await
    await runtime.waitForStep(1, { timeout: 2000 });
    const textAfterFirstStep = await runtime.getOutputText();
    expect(textAfterFirstStep).toContain('Step 1: Load program instructions into memory.');

    // After one sleep interval (approx 900ms), Step 2 should be appended
    await runtime.waitForStep(2, { timeout: 3000 });
    const textAfterSecondStep = await runtime.getOutputText();
    expect(textAfterSecondStep).toContain('Step 2: Initialize registers and runtime variables.');

    // Verify that we are in the "Simulation Running" state by confirming multiple steps are appended over time
    // Wait for Step 4 (ensures the loop is progressing and the async function is running)
    await runtime.waitForStep(4, { timeout: 6000 });
    const textProgress = await runtime.getOutputText();
    expect(textProgress).toContain('Step 4: Start execution of instruction 1: PRINT "Hello, World!"');

    // Assert: During normal operation no uncaught errors were emitted
    expect(pageErrors).toEqual([], `Page errors occurred during simulation: ${pageErrors.map(e => e.message).join('; ')}`);
    expect(consoleErrors).toEqual([], `Console errors occurred during simulation: ${consoleErrors.join('; ')}`);
  });

  // Full run completion: final message appended (expected observable)
  test('Simulation completes and final message appears (transition completes)', async ({ page }) => {
    const runtime = new RuntimePage(page);

    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err));

    await runtime.goto();

    // Start simulation and wait for completion message (this will take ~ (instructions.length * 900ms) )
    await runtime.clickRun();

    // Wait for the complete marker; allow generous timeout for the full run
    await runtime.waitForCompletion({ timeout: 25_000 });

    const finalText = await runtime.getOutputText();
    expect(finalText).toContain('[Simulation complete: This illustrates how a runtime environment manages program execution tasks.]');

    // Verify the last lines contain the summary message and earlier steps are present
    expect(finalText).toContain('Step 12: End of program execution.');
    expect(finalText).toContain('Step 1: Load program instructions into memory.');

    // Ensure no page or console errors during a full run
    expect(pageErrors).toEqual([], `Unexpected page errors during full simulation: ${pageErrors.map(e => e.message).join('; ')}`);
    expect(consoleErrors).toEqual([], `Unexpected console.error messages during full simulation: ${consoleErrors.join('; ')}`);
  });

  // Edge case: clicking the Run button multiple times rapidly
  test('Edge case: rapid repeated clicks - simulation restarts or interleaves without throwing errors', async ({ page }) => {
    const runtime = new RuntimePage(page);

    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err));

    await runtime.goto();

    // Rapidly click run 3 times
    await runtime.clickRun();
    await runtime.clickRun();
    await runtime.clickRun();

    // The implementation resets demoOutput at the start of each run, so after the rapid clicks we should at least see Step 1 present
    await runtime.waitForStep(1, { timeout: 2000 });
    const midText = await runtime.getOutputText();
    expect(midText).toMatch(/Step 1:/);

    // Wait for completion to ensure no unhandled exceptions were thrown during overlapping runs
    await runtime.waitForCompletion({ timeout: 25_000 });

    const finalText = await runtime.getOutputText();
    // Because runs may interleave, we assert that the completion marker exists
    expect(finalText).toContain('[Simulation complete: This illustrates how a runtime environment manages program execution tasks.]');

    // Assert there were no exceptions emitted to the page or console.error
    expect(pageErrors).toEqual([], `Page errors occurred during rapid clicks: ${pageErrors.map(e => e.message).join('; ')}`);
    expect(consoleErrors).toEqual([], `Console errors occurred during rapid clicks: ${consoleErrors.join('; ')}`);
  });
});

test.describe('Diagnostics: Console and Page Error Observation', () => {
  // This set of tests focuses on observing console output and page errors while interacting with the app.
  test('Observe console messages and ensure no runtime exceptions on load and run', async ({ page }) => {
    const runtime = new RuntimePage(page);

    // Capture all console messages for inspection
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await runtime.goto();

    // Start simulation and let it produce a few steps
    await runtime.clickRun();
    await runtime.waitForStep(3, { timeout: 6000 });

    // Basic expectations: there should be no page errors
    expect(pageErrors.length).toBe(0);

    // We don't expect console.error messages from this page, assert none exist in captured console messages
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    expect(consoleErrorMessages.length).toBe(0);

    // Optionally record that informational console logs (if any) are harmless - we only assert absence of errors
    // (No further console content assertions because the page does not intentionally log debug info)
  });

  test('Edge diagnostic: ensure attempting to access non-existent elements does not throw page errors', async ({ page }) => {
    // This test intentionally does not modify the page; it checks that simply querying a missing selector in the test does not cause page-side exceptions.
    const runtime = new RuntimePage(page);
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await runtime.goto();

    // Query a selector that does not exist on the page (on the test side).
    // This should not result in any page-side exceptions.
    const missing = await page.$('#this-element-does-not-exist');
    expect(missing).toBeNull();

    // Confirm no page errors occurred as a result
    expect(pageErrors).toEqual([], `Unexpected page errors when querying missing element: ${pageErrors.map(e => e.message).join('; ')}`);
  });
});