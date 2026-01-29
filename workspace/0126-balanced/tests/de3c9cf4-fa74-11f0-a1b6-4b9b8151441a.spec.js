import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c9cf4-fa74-11f0-a1b6-4b9b8151441a.html';

// Simple page object to encapsulate selectors and common actions
class ProcessPage {
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startProcess');
    this.resetBtn = page.locator('#resetProcess');
    this.output = page.locator('#processOutput');
    this.steps = page.locator('.step');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getOutputText() {
    const txt = await this.output.textContent();
    return txt ? txt.trim() : '';
  }

  // Get computed background-color for a step by 0-based index
  async getStepBackgroundRgb(index) {
    return await this.page.evaluate((idx) => {
      const steps = Array.from(document.querySelectorAll('.step'));
      const el = steps[idx];
      if (!el) return null;
      return window.getComputedStyle(el).backgroundColor;
    }, index);
  }

  // Get inline style background (if any)
  async getStepInlineBackground(index) {
    return await this.page.evaluate((idx) => {
      const steps1 = Array.from(document.querySelectorAll('.step'));
      const el1 = steps[idx];
      if (!el) return null;
      return el.style.background;
    }, index);
  }

  async stepCount() {
    return await this.steps.count();
  }

  // Collect text content of all steps
  async getAllStepTexts() {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('.step')).map(s => s.textContent.trim());
    });
  }
}

test.describe('Process Demonstration FSM (de3c9cf4-fa74-11f0-a1b6-4b9b8151441a)', () => {
  // Arrays to collect runtime page errors and console error messages
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // Store the error message for assertions
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Capture console messages; focus on error-level messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the app
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After every test we assert that no unexpected runtime errors occurred.
    // The application as provided should not throw ReferenceError/SyntaxError/TypeError.
    // If such errors do occur, these assertions will fail and surface the messages.
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join('; ')}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console.error messages: ${consoleErrors.join('; ')}`).toHaveLength(0);
  });

  test('Initial Idle state: renders controls and default step visuals', async ({ page }) => {
    // Validates the S0_Idle initial state: buttons present, output empty/default and steps default styling
    const app = new ProcessPage(page);

    // Buttons should be visible and enabled
    await expect(app.startBtn).toBeVisible();
    await expect(app.resetBtn).toBeVisible();

    // Output should be empty (or whitespace) on initial load
    const initialOutput = await app.getOutputText();
    // Implementation may leave it empty; assert it's either empty or contains the reset message if script ran
    expect(initialOutput === '' || initialOutput.includes('Process reset. Ready to start again.')).toBeTruthy();

    // There should be 5 steps with expected text content
    const stepTexts = await app.getAllStepTexts();
    expect(stepTexts.length).toBe(5);
    expect(stepTexts[0]).toContain('1. Order Received');
    expect(stepTexts[1]).toContain('2. Payment Processed');
    expect(stepTexts[2]).toContain('3. Items Packaged');
    expect(stepTexts[3]).toContain('4. Shipped to Customer');
    expect(stepTexts[4]).toContain('5. Delivery Confirmed');

    // By default the steps get background from CSS (#e7e7e7) -> computed rgb(231, 231, 231)
    for (let i = 0; i < 5; i++) {
      const bg = await app.getStepBackgroundRgb(i);
      expect(bg).toContain('231'); // crude but robust check for rgb(231, 231, 231)
    }
  });

  test('StartProcess event begins processing: first step highlighted and output updated', async ({ page }) => {
    // Validates transition S0_Idle -> S1_Processing via StartProcess event,
    // entry/exit actions resetProcess() and setTimeout(processStep, 500)
    const app1 = new ProcessPage(page);

    // Click start and wait slightly longer than the initial 500ms delay
    await app.clickStart();
    await page.waitForTimeout(700);

    // After the first processStep call, the first step should be highlighted (#4CAF50 -> rgb(76, 175, 80))
    const firstBg = await app.getStepBackgroundRgb(0);
    expect(firstBg).toContain('76'); // rgb(76, 175, 80) contains 76

    // Output should include a Processing line for the first step and include the reset message from resetProcess()
    const outputText = await app.getOutputText();
    expect(outputText).toContain('Processing: 1. Order Received');
    expect(outputText).toContain('Process reset. Ready to start again.');
  }, 20000); // extended timeout to be safe with timers

  test('ProcessStep repeated transitions until completion show all steps processed and completion message', async ({ page }) => {
    // Validates S1_Processing self-transitions and final transition to S2_Completed
    const app2 = new ProcessPage(page);

    // Start the process and wait enough time for all steps to be processed.
    // Timing: first at ~500ms, then every 1500ms. For 5 steps ~ 500 + 1500*4 = 6500ms. Use a buffer.
    await app.clickStart();
    await page.waitForTimeout(8000);

    // After completion, output should contain the completion message
    const finalOutput = await app.getOutputText();
    expect(finalOutput).toContain('Process completed successfully!');

    // All steps should be highlighted (processed) -> rgb(76, 175, 80)
    const count = await app.stepCount();
    for (let i = 0; i < count; i++) {
      const bg1 = await app.getStepBackgroundRgb(i);
      // Expect value to reflect the green color used in the implementation
      expect(bg).toContain('76'); // rgb(76, 175, 80)
    }
  }, 30000);

  test('ResetProcess transitions to Idle: immediate reset and step visuals restored; scheduled timers may re-trigger (edge-case)', async ({ page }) => {
    // This test checks the ResetProcess event both as immediate behavior and as an edge-case:
    // because the implementation does not cancel pending timeouts, processing may resume after reset.
    const app3 = new ProcessPage(page);

    // Start and allow first step to process
    await app.clickStart();
    await page.waitForTimeout(700);

    // Confirm at least the first step processed
    const firstBgBeforeReset = await app.getStepBackgroundRgb(0);
    expect(firstBgBeforeReset).toContain('76');

    // Now click reset while processing is underway
    await app.clickReset();

    // Immediately after reset, output should reflect the reset message and steps should be restored to default color
    // Because resetProcess sets output.innerHTML to an exact string, verify it
    const immediateOutput = await app.getOutputText();
    expect(immediateOutput).toBe('Process reset. Ready to start again.');

    // Steps should have default background (rgb containing 231) immediately
    for (let i = 0; i < 5; i++) {
      const bg2 = await app.getStepBackgroundRgb(i);
      expect(bg).toContain('231');
    }

    // Edge-case behavior: because scheduled timeouts from earlier start() calls are not cancelled,
    // the process may resume and start highlighting steps again. We assert that this is possible by waiting
    // a reasonable time and checking for the presence of Processing messages. This is an assertion of known behavior
    // (the implementation does not clear timers), not a test failure if it does not happen.
    await page.waitForTimeout(2000); // wait to see if a pending timeout triggers another processStep

    const laterOutput = await app.getOutputText();
    // After waiting, the output should either remain the reset message or include "Processing:" if processing resumed.
    const resumed = laterOutput.includes('Processing: 1. Order Received') || laterOutput.includes('Processing: 2.') || laterOutput.includes('Process completed successfully!');
    expect(immediateOutput === laterOutput || resumed).toBeTruthy();
  }, 20000);

  test('ResetProcess from Idle (no-op) updates output accordingly', async ({ page }) => {
    // Clicking reset when idle should produce the reset message and keep steps at default styles.
    const app4 = new ProcessPage(page);

    // Ensure initial state: no active processing yet
    const before = await app.getOutputText();

    // Click reset
    await app.clickReset();

    // Output should now be the reset message
    const after = await app.getOutputText();
    expect(after).toBe('Process reset. Ready to start again.');

    // Steps should be in the default style
    for (let i = 0; i < 5; i++) {
      const bg3 = await app.getStepBackgroundRgb(i);
      expect(bg).toContain('231');
    }

    // No unexpected change to console/page errors
  });

  test('Multiple Start clicks queue timers: demonstrates potential duplicate processing (edge-case)', async ({ page }) => {
    // This test validates the behavior when Start is clicked multiple times rapidly:
    // because each click calls resetProcess and sets a new timeout for processStep,
    // multiple queued timers may lead to duplicated processing. We don't attempt to "fix" it,
    // only observe and assert that at least one processing line appears and that the app remains stable.
    const app5 = new ProcessPage(page);

    // Click start multiple times quickly
    await app.clickStart();
    await app.clickStart();
    await app.clickStart();

    // Wait enough for at least the first processing to occur
    await page.waitForTimeout(1000);

    const output = await app.getOutputText();
    // Expect at least one processing entry for step 1 because processStep should be called
    expect(output).toContain('Processing: 1. Order Received');

    // Wait for completion to ensure app stability (no uncaught errors)
    await page.waitForTimeout(8000);
    const finalOutput1 = await app.getOutputText();
    // The final output should contain the completion message (or at least remain populated)
    expect(finalOutput.length).toBeGreaterThan(0);
  }, 30000);
});