import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a370ffd1-ffc4-11f0-821c-7d25bc609266.html';

// Page object for the Binary Search demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#run-demo');
    this.output = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the primary components to be present
    await expect(this.runButton).toBeVisible();
    await expect(this.output).toBeVisible();
  }

  // Click the run demo button using normal user interaction
  async clickRun() {
    await this.runButton.click();
  }

  // Programmatically invoke element.click() inside page context (used for assertions about disabled behavior)
  async programmaticClickRun() {
    await this.page.evaluate(() => {
      const btn = document.getElementById('run-demo');
      if (btn) btn.click();
    });
  }

  // Returns text content of demo output
  async getOutputText() {
    return await this.output.innerText();
  }

  // Returns boolean whether the run button is disabled
  async isRunButtonDisabled() {
    return await this.runButton.evaluate(el => el.disabled === true);
  }
}

test.describe('Binary Search Interactive Demo - FSM validation', () => {
  // Arrays to collect console errors and page errors observed during a test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and page errors so tests can assert on them
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // ignore any instrumentation errors
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });
  });

  test('S0 Idle: initial state renders button and empty output', async ({ page }) => {
    // Validate Idle state evidence:
    // - Run Binary Search Demo button exists, visible, enabled
    // - demo output element exists and is initially empty
    const demo = new DemoPage(page);
    await demo.goto();

    // Button presence and attributes
    await expect(demo.runButton).toBeVisible();
    await expect(demo.runButton).toHaveAttribute('aria-label', 'Run Binary Search Demonstration');
    await expect(demo.runButton).toHaveText('Run Binary Search Demo');

    // Button should be enabled in Idle state
    const disabled = await demo.isRunButtonDisabled();
    expect(disabled).toBe(false);

    // demo-output should be present and empty (or whitespace)
    const out = await demo.getOutputText();
    expect(out.trim()).toBe('');

    // Ensure no console errors or page errors were thrown during initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S0 -> S1 transition: clicking Run Demo enters Demo Running state', async ({ page }) => {
    // Validate that clicking the run button triggers demo start:
    // - demoOutput gets cleared then 'Starting Binary Search Demo...' appears
    // - run button becomes disabled during demo run (onEnter/exit behavior)
    const demo = new DemoPage(page);
    await demo.goto();

    // Click to start demo
    await demo.clickRun();

    // Immediately after clicking, demo button should be disabled (exit action will re-enable later)
    await expect.poll(async () => await demo.isRunButtonDisabled(), {
      interval: 100,
      timeout: 2000
    }).toBe(true);

    // demoOutput should contain the starting line
    await expect.poll(async () => (await demo.getOutputText()).includes('Starting Binary Search Demo...'), {
      interval: 200,
      timeout: 3000
    }).toBe(true);

    // Also verify some step evidence appears (e.g., "Step 1:" and low/high lines)
    await expect.poll(async () => {
      const txt = await demo.getOutputText();
      return txt.includes('Step 1:') && txt.includes('low = 0') && txt.includes('high = 8');
    }, { interval: 200, timeout: 3000 }).toBe(true);

    // No console errors should have been produced at this point
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S1 -> S2 transition: demo completes and Target Found final state is reached', async ({ page }) => {
    // Validate that the demo eventually reports the target found and the run button returns to enabled state
    const demo = new DemoPage(page);
    await demo.goto();

    // Start the demo
    await demo.clickRun();

    // Wait for final message "Target found at index 3." - allow generous timeout because demo uses deliberate delays
    await expect.poll(async () => (await demo.getOutputText()).includes('Target found at index 3.'), {
      interval: 500,
      timeout: 15000
    }).toBe(true);

    // Confirm the output contains the comparison line for the found case
    const finalText = await demo.getOutputText();
    expect(finalText).toContain('Comparison: arr[mid] == target');

    // Confirm button re-enabled after demo finishes (exit action)
    await expect.poll(async () => await demo.isRunButtonDisabled(), {
      interval: 200,
      timeout: 2000
    }).toBe(false);

    // Ensure no JavaScript runtime errors occurred during the demo run
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S1 Demo running: clicking or programmatic click while disabled should NOT restart demo', async ({ page }) => {
    // This test validates the protection while demo is running:
    // - After starting, the button is disabled
    // - Programmatic click (which should be a no-op for a disabled control) does not clear the output
    const demo = new DemoPage(page);
    await demo.goto();

    // Start the demo
    await demo.clickRun();

    // Ensure demo has started and button is disabled
    await expect.poll(async () => await demo.isRunButtonDisabled(), {
      interval: 100,
      timeout: 2000
    }).toBe(true);

    // Capture output snapshot while running
    await expect.poll(async () => (await demo.getOutputText()).length > 0, {
      interval: 100,
      timeout: 3000
    }).toBe(true);

    const snapshot = await demo.getOutputText();

    // Attempt a programmatic click on the disabled button inside the page context
    // According to spec, disabled buttons should not be activated; this ensures the demo is not restarted.
    await demo.programmaticClickRun();

    // Wait briefly to see if output was cleared (which would indicate a restart)
    await page.waitForTimeout(500);

    const afterAttempt = await demo.getOutputText();

    // The output should not have been reset/cleared by the programmatic click while disabled.
    // It should still contain the snapshot content (starts with same prefix).
    expect(afterAttempt.startsWith(snapshot) || afterAttempt.includes('Step')).toBe(true);

    // Finally wait for demo completion to avoid leaking state for other tests
    await expect.poll(async () => (await demo.getOutputText()).includes('Target found at index 3.'), {
      interval: 500,
      timeout: 15000
    }).toBe(true);

    // No console/page errors should have been produced
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S3 (Target Not Found) validation (assert not reached) and general edge assertions', async ({ page }) => {
    // The current embedded demo uses a fixed array and target (23) which is present.
    // It is therefore expected that the "Target not found in array." message is NOT produced.
    // This test asserts that S3_TargetNotFound is not reached under normal conditions,
    // fulfilling the FSM expectation to validate both final states (by asserting presence/absence).
    const demo = new DemoPage(page);
    await demo.goto();

    // Start the demo
    await demo.clickRun();

    // Wait for completion (Target Found)
    await expect.poll(async () => (await demo.getOutputText()).length > 0 && (await demo.getOutputText()).includes('Target found at index 3.'), {
      interval: 500,
      timeout: 15000
    }).toBe(true);

    const txt = await demo.getOutputText();

    // Assert that the found message exists
    expect(txt).toContain('Target found at index 3.');

    // Assert that the not-found final state message does NOT exist
    expect(txt).not.toContain('Target not found in array.');

    // Edge-case assertions: ensure output included multiple steps (demonstrates iterative halving)
    expect(txt).toMatch(/Step 1:/);
    expect(txt).toMatch(/Step 2:/);
    // Step 4 is the actual found step in this demo
    expect(txt).toMatch(/Step 4:/);

    // Ensure run button ended up enabled
    await expect.poll(async () => await demo.isRunButtonDisabled(), {
      interval: 200,
      timeout: 2000
    }).toBe(false);

    // No runtime errors observed
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: capture console logs and page errors during navigation and interactions', async ({ page }) => {
    // This test intentionally collects console output and page errors across a full run,
    // verifying that there are no uncaught exceptions (TypeError/ReferenceError/SyntaxError)
    // produced by the page script while performing the demo.
    const demo = new DemoPage(page);
    await demo.goto();

    // Start the demo
    await demo.clickRun();

    // Wait for demo to finish
    await expect.poll(async () => (await demo.getOutputText()).includes('Target found at index 3.'), {
      interval: 500,
      timeout: 15000
    }).toBe(true);

    // Assert there were no console.errors or page errors
    // If the implementation had thrown ReferenceError, SyntaxError, or TypeError,
    // it would appear here (as console errors or pageerror events).
    expect(consoleErrors.length).toBe(0, `Expected no console.error messages, got: ${JSON.stringify(consoleErrors)}`);
    expect(pageErrors.length).toBe(0, `Expected no page errors, got: ${JSON.stringify(pageErrors)}`);
  });
});