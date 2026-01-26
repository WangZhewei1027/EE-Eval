import { test, expect } from '@playwright/test';

test.setTimeout(90000); // Demo runs with intervals; allow enough time for full runs

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d833a4f1-fa7b-11f0-b314-ad8654ee5de8.html';

// Page object for the minimal demo interactions and assertions
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Attach collectors for console and page errors so tests can assert on them
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      // err is an Error object thrown in page context
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for the demo area to be present
    await this.page.waitForSelector('#demo');
  }

  // Returns the textual content of the demo area
  async demoText() {
    return this.page.$eval('#demo', (el) => el.innerText);
  }

  // Returns array of tag texts (span.tag inside .step)
  async stepTags() {
    return this.page.$$eval('.step .tag', (els) => els.map((e) => e.textContent.trim()));
  }

  // Returns number of .step elements currently in demo
  async stepCount() {
    return this.page.$$eval('.step', (els) => els.length);
  }

  // Click the run demo button
  async clickRun() {
    await this.page.click('#runDemo');
  }

  // Checks whether the run demo button is currently disabled
  async isButtonDisabled() {
    return this.page.$eval('#runDemo', (btn) => Boolean(btn.disabled));
  }

  // Wait for the demo to complete by observing the presence of the final "Note" tag
  // and ensuring the button is re-enabled. Uses a loop to be robust.
  async waitForCompletion({ timeout = 45000 } = {}) {
    const start = Date.now();
    // Wait until we see a .step .tag with text "Note"
    await this.page.waitForFunction(() => {
      const tags = Array.from(document.querySelectorAll('.step .tag'));
      return tags.some((t) => t.textContent && t.textContent.indexOf('Note') !== -1);
    }, { timeout });

    // Also wait for button to be enabled (run completed sets btn.disabled = false)
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('runDemo');
      return !!btn && !btn.disabled;
    }, { timeout: Math.max(1000, timeout - (Date.now() - start)) });
  }

  // Helper to assert that no page errors of certain fundamental types occurred
  assertNoCriticalPageErrors() {
    // Look for ReferenceError, SyntaxError, TypeError among pageErrors
    const bad = this.pageErrors.filter((e) => {
      if (!e || !e.name) return false;
      return e.name === 'ReferenceError' || e.name === 'SyntaxError' || e.name === 'TypeError';
    });
    expect(bad, `Expected no ReferenceError/SyntaxError/TypeError in page, but found: ${bad.map(b => b.toString()).join('; ')}`).toHaveLength(0);
  }

  // Helper to assert no console errors were emitted
  assertNoConsoleErrors() {
    const errors = this.consoleMessages.filter((m) => m.type === 'error');
    expect(errors, `Expected no console.error messages, but found: ${errors.map(e => e.text).join('; ')}`).toHaveLength(0);
  }
}

test.describe('Red-Black Tree demo — FSM states and transitions', () => {

  test('Initial state S0_Ready: demo shows Ready tag and clearDemo entry action executed', async ({ page }) => {
    // Validate initial state after page load
    const demo = new DemoPage(page);
    await demo.goto();

    // The initial entry action clearDemo should set the demo area to the Ready message.
    const text = await demo.demoText();
    expect(text).toContain('Ready', 'Demo area initial content should contain "Ready" tag/text');

    // The button should be enabled and visible
    const isDisabled = await demo.isButtonDisabled();
    expect(isDisabled).toBeFalsy();

    // Ensure no uncaught page errors of critical types happened and no console.error messages
    demo.assertNoCriticalPageErrors();
    demo.assertNoConsoleErrors();
  });

  test('Transition S0_Ready -> S1_RunningDemo -> S2_Completed: run demo and observe steps and completion', async ({ page }) => {
    // This test validates:
    // - Clicking the button triggers runDemo (entry action for RunningDemo)
    // - Steps appear in sequence
    // - Button is disabled during run and re-enabled after completion
    // - Final "Note" step is appended, indicating completion (S2_Completed)
    const demo = new DemoPage(page);
    await demo.goto();

    // Start the demo
    await demo.clickRun();

    // Immediately after clicking, the button should be disabled (runDemo sets btn.disabled = true synchronously)
    const disabledAfterClick = await demo.isButtonDisabled();
    expect(disabledAfterClick).toBeTruthy();

    // The first step is shown synchronously by runDemo (showStep(0))
    // Validate that the first tag is the Insert 10 tag
    // Wait a short time to allow immediate mutations
    await page.waitForTimeout(100);
    const tagsAfterStart = await demo.stepTags();
    expect(tagsAfterStart.length).toBeGreaterThanOrEqual(1);
    expect(tagsAfterStart[0]).toContain('Insert 10');

    // Wait for complete (this waits for the final 'Note' tag and button re-enabled)
    await demo.waitForCompletion({ timeout: 45000 });

    // After completion, button should be enabled again
    const disabledAfterComplete = await demo.isButtonDisabled();
    expect(disabledAfterComplete).toBeFalsy();

    // Ensure the final Note step is present in steps
    const finalTags = await demo.stepTags();
    expect(finalTags.some((t) => t.includes('Note'))).toBeTruthy();

    // The demonstration contains the expected final message about re-running
    const finalText = await demo.demoText();
    expect(finalText).toContain('You may re-run the demonstration by pressing the button again.');

    // Confirm no critical page errors or console errors occurred during run
    demo.assertNoCriticalPageErrors();
    demo.assertNoConsoleErrors();
  });

  test('Edge case: clicking the run button while demo is running should be ignored (no duplicate runs)', async ({ page }) => {
    // Validate that a rapid double-click does not cause duplication of the run (running guard works)
    const demo = new DemoPage(page);
    await demo.goto();

    // Perform two rapid clicks
    await Promise.all([
      page.click('#runDemo'),
      page.click('#runDemo').catch(() => {}) // second click may be ignored or throw depending on timing; catch to avoid test crash
    ]);

    // Wait for completion
    await demo.waitForCompletion({ timeout: 45000 });

    // Expect the number of .step entries to equal expected total steps:
    // The implementation adds 8 demo steps and then one final Note, total 9 steps.
    // Assert the count equals 9 to ensure we did not get duplicated runs appended.
    const count = await demo.stepCount();
    const EXPECTED_FINAL_STEP_COUNT = 9;
    expect(count).toBe(EXPECTED_FINAL_STEP_COUNT);

    // Confirm the first step appears exactly once and is the expected content
    const tags = await demo.stepTags();
    const firstStepTags = tags.filter((t) => t.includes('Insert 10'));
    expect(firstStepTags).toHaveLength(1);

    // Confirm no critical page errors or console errors occurred
    demo.assertNoCriticalPageErrors();
    demo.assertNoConsoleErrors();
  });

  test('Edge case: demo can be re-run after completion (S2_Completed -> S1_RunningDemo again)', async ({ page }) => {
    // Validate that after completion user can re-run demo and behavior is correct (demo area cleared and steps replay)
    const demo = new DemoPage(page);
    await demo.goto();

    // First run
    await demo.clickRun();
    await demo.waitForCompletion({ timeout: 45000 });

    // Capture the final text after first run
    const finalAfterFirstRun = await demo.demoText();
    expect(finalAfterFirstRun).toContain('Demonstration complete');

    // Click again to re-run
    await demo.clickRun();

    // Immediately after clicking again, button should be disabled again
    expect(await demo.isButtonDisabled()).toBeTruthy();

    // Wait for second completion
    await demo.waitForCompletion({ timeout: 45000 });

    // After re-run completion, ensure the demo area contains the expected Note once (i.e., it was cleared then replayed)
    const tagsAfterSecondRun = await demo.stepTags();
    const noteTags = tagsAfterSecondRun.filter((t) => t.includes('Note'));
    expect(noteTags.length).toBeGreaterThanOrEqual(1);

    // The final demo text should still indicate completion
    const finalAfterSecondRun = await demo.demoText();
    expect(finalAfterSecondRun).toContain('Demonstration complete');

    // Confirm no critical page errors or console errors occurred throughout
    demo.assertNoCriticalPageErrors();
    demo.assertNoConsoleErrors();
  });

  test('Instrumentation: observe console logs and page errors (assert none of ReferenceError/SyntaxError/TypeError occurred)', async ({ page }) => {
    // This test is explicitly about collecting console and page errors and asserting that none of the
    // fundamental error types (ReferenceError, SyntaxError, TypeError) happened during typical usage.
    const demo = new DemoPage(page);
    await demo.goto();

    // Run the demo once to exercise the code paths
    await demo.clickRun();
    await demo.waitForCompletion({ timeout: 45000 });

    // Check collected console messages and page errors
    // We allow other console.log/info/debug, but we assert that there are no console.error messages
    demo.assertNoConsoleErrors();

    // Also assert that no critical page errors of the requested types occurred
    demo.assertNoCriticalPageErrors();

    // Additionally, include an assertion that we observed at least one console message (informational)
    // This ensures we are actively recording console output (not required to pass, but useful instrumentation).
    const hadInfo = demo.consoleMessages.some((m) => m.type === 'log' || m.type === 'info' || m.type === 'debug' || m.type === 'warning');
    // It's acceptable if there's no info logs; do not fail the test on this. Just assert the array exists.
    expect(Array.isArray(demo.consoleMessages)).toBeTruthy();
    expect(Array.isArray(demo.pageErrors)).toBeTruthy();
  });

});