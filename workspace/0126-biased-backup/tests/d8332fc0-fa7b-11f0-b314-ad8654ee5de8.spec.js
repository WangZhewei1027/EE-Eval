import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8332fc0-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the simple demo area to encapsulate interactions and queries.
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '#runDemo';
    this.outputSelector = '#output';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async waitForLoad() {
    // Ensure the main container is present
    await this.page.waitForSelector('.container');
  }

  async getButton() {
    return this.page.locator(this.buttonSelector);
  }

  async getOutput() {
    return this.page.locator(this.outputSelector);
  }

  async clickRunDemo() {
    await this.page.click(this.buttonSelector);
  }

  async getOutputText() {
    return this.page.locator(this.outputSelector).innerText();
  }

  async focusOutput() {
    await this.page.focus(this.outputSelector);
  }

  // Returns array of lines split by newlines (normalizes CRLF)
  async getOutputLines() {
    const text = await this.getOutputText();
    return text.replace(/\r/g, '').split('\n').map(l => l.trim());
  }
}

// Helper to capture console errors and page errors for assertions.
// Returns an object with arrays and a dispose function to remove listeners.
function capturePageErrors(page) {
  const consoleErrors = [];
  const consoleWarnings = [];
  const consoleLogs = [];
  const pageErrors = [];

  const onConsole = msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') consoleErrors.push(text);
    else if (type === 'warning') consoleWarnings.push(text);
    else consoleLogs.push({ type, text });
  };

  const onPageError = err => {
    // err is Error object
    pageErrors.push(String(err));
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  return {
    consoleErrors,
    consoleWarnings,
    consoleLogs,
    pageErrors,
    dispose: () => {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
    }
  };
}

test.describe('Hash Map demo FSM tests (application id: d8332fc0-fa7b-11f0-b314-ad8654ee5de8)', () => {

  // Validate the Idle state (S0_Idle) existence and initial rendering.
  test('S0_Idle: page renders with Run button and initial output text', async ({ page }) => {
    // Capture runtime console and page errors for this test
    const errors = capturePageErrors(page);

    const demo = new DemoPage(page);
    await demo.goto();
    await demo.waitForLoad();

    // The button must be present and visible with correct label.
    const btn = await demo.getButton();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Run simple insertion demo');

    // The output element must exist, be focusable (tabindex=0), and contain the initial prompt.
    const out = await demo.getOutput();
    await expect(out).toBeVisible();
    const outputHandle = await page.$('#output');
    const ariaAtomic = await outputHandle.getAttribute('aria-atomic');
    const tabindex = await outputHandle.getAttribute('tabindex');
    expect(ariaAtomic).toBe('true');
    expect(tabindex).toBe('0');

    const initialText = await out.innerText();
    // The initial instructional text is present (the page instructs to click the button).
    expect(initialText).toContain('Click "Run simple insertion demo" to show a trace.');

    // No runtime errors should have happened during load for the Idle state.
    // We assert that there are no console errors or uncaught page errors.
    expect(errors.consoleErrors.length, `console.error calls: ${errors.consoleErrors.join(' | ')}`).toBe(0);
    expect(errors.pageErrors.length, `page errors: ${errors.pageErrors.join(' | ')}`).toBe(0);

    errors.dispose();
  });

  // Validate the transition from Idle -> DemoRunning via clicking the RunDemo button.
  test('RunDemoClick event triggers demo logic and updates the output (S0_Idle -> S1_DemoRunning)', async ({ page }) => {
    // Capture runtime console and page errors for this test
    const errors = capturePageErrors(page);

    const demo = new DemoPage(page);
    await demo.goto();
    await demo.waitForLoad();

    // Pre-click sanity assertions
    const btn = await demo.getButton();
    await expect(btn).toBeEnabled();

    // Click to run the demonstration as described by the FSM event RunDemoClick
    await demo.clickRunDemo();

    // After click, output should be updated to include the demonstration header.
    const out = await demo.getOutput();
    await expect(out).toHaveText(/Demonstration: inserting keys into a table with m = 7 buckets\./, { timeout: 2000 });

    // The output should include "Final bucket contents (index: keys):" and the lookup example.
    const outputText = await out.innerText();
    expect(outputText).toContain('Final bucket contents (index: keys):');
    expect(outputText).toContain('Lookup example steps for key "bird":');

    // Verify that the demo appended seven "Insert" lines (one per key listed in the script).
    const lines = (await demo.getOutputLines()).filter(Boolean);
    const insertLines = lines.filter(l => l.startsWith('Insert "'));
    // The demo inserts keys: ["cat","dog","bird","cow","ant","car","duck"] => 7 inserts
    expect(insertLines.length).toBe(7);

    // Verify that the bucket listing includes exactly m = 7 indices (0..6)
    const bucketHeaderIndex = lines.findIndex(l => l === 'Final bucket contents (index: keys):');
    expect(bucketHeaderIndex).toBeGreaterThanOrEqual(0);
    // Expect next 7 non-empty lines (or <empty>) enumerating indices 0..6
    const bucketLines = [];
    for (let i = bucketHeaderIndex + 1; i < lines.length && bucketLines.length < 7; i++) {
      if (/^\d+:/.test(lines[i])) bucketLines.push(lines[i]);
    }
    expect(bucketLines.length).toBe(7);
    // Each bucket line should start with an index followed by ":"
    bucketLines.forEach((bl, idx) => {
      expect(bl.startsWith(idx + ':'), `bucket line for index ${idx} malformed: "${bl}"`).toBe(true);
    });

    // The demo code calls out.focus() after updating textContent; verify the output is focused.
    // The page's activeElement should be the #output element.
    const activeElementId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    expect(activeElementId).toBe('output');

    // Confirm there were no console errors or uncaught page errors during the click/demo execution.
    expect(errors.consoleErrors.length, `console.error calls during demo: ${errors.consoleErrors.join(' | ')}`).toBe(0);
    expect(errors.pageErrors.length, `page errors during demo: ${errors.pageErrors.join(' | ')}`).toBe(0);

    errors.dispose();
  });

  // Robustness: ensure repeated clicks re-run the demo and reset the output (no accumulation).
  test('Repeated RunDemoClick calls re-run the demo and replace output (idempotency check)', async ({ page }) => {
    const errors = capturePageErrors(page);

    const demo = new DemoPage(page);
    await demo.goto();
    await demo.waitForLoad();

    // Run demo first time and capture output
    await demo.clickRunDemo();
    await demo.getOutput().waitFor({ state: 'visible' });
    const firstOutput = await demo.getOutputText();

    // Run demo second time
    await demo.clickRunDemo();
    // Wait briefly to allow script to complete and rewrite output
    await page.waitForTimeout(250);
    const secondOutput = await demo.getOutputText();

    // The outputs should be non-empty and equal (deterministic demo logic).
    expect(firstOutput.length).toBeGreaterThan(0);
    expect(secondOutput.length).toBeGreaterThan(0);
    expect(secondOutput).toBe(firstOutput);

    // Ensure that the number of "Insert" lines remains exactly 7 after repeated runs.
    const insertLinesFirst = firstOutput.split('\n').filter(l => l.trim().startsWith('Insert "'));
    const insertLinesSecond = secondOutput.split('\n').filter(l => l.trim().startsWith('Insert "'));
    expect(insertLinesFirst.length).toBe(7);
    expect(insertLinesSecond.length).toBe(7);

    // No runtime errors expected during repeated executions
    expect(errors.consoleErrors.length, `console.error calls during repeated demo: ${errors.consoleErrors.join(' | ')}`).toBe(0);
    expect(errors.pageErrors.length, `page errors during repeated demo: ${errors.pageErrors.join(' | ')}`).toBe(0);

    errors.dispose();
  });

  // Edge-case & error observation: ensure no unexpected runtime exceptions are thrown
  // when interacting with the demo and that console/warn channels behave reasonably.
  test('Runtime console and page errors observation (edge cases & error scenarios)', async ({ page }) => {
    const errors = capturePageErrors(page);

    const demo = new DemoPage(page);
    await demo.goto();
    await demo.waitForLoad();

    // Simulate user interactions: click button multiple times and focus/unfocus output quickly
    for (let i = 0; i < 3; i++) {
      await demo.clickRunDemo();
      // Toggle focus: focus button then output
      await demo.getButton().focus();
      await demo.focusOutput();
      // small delay to allow potential async errors to be emitted
      await page.waitForTimeout(100);
    }

    // No console errors or page errors should have been emitted during these edge interactions.
    // We explicitly assert that console.error was not called and no uncaught exceptions occurred.
    expect(errors.consoleErrors.length, `console.error calls during edge interactions: ${errors.consoleErrors.join(' | ')}`).toBe(0);
    expect(errors.pageErrors.length, `page errors during edge interactions: ${errors.pageErrors.join(' | ')}`).toBe(0);

    // Warnings are allowed but should be minimal; assert not an unexpectedly large amount
    expect(errors.consoleWarnings.length).toBeLessThanOrEqual(5);

    errors.dispose();
  });

  // Validate expected DOM component attributes and semantics per FSM components description.
  test('DOM components exist and match FSM component descriptions (#runDemo button and #output div)', async ({ page }) => {
    const errors = capturePageErrors(page);

    const demo = new DemoPage(page);
    await demo.goto();
    await demo.waitForLoad();

    const btn = await demo.getButton();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('id', 'runDemo');

    const out = await demo.getOutput();
    await expect(out).toBeVisible();
    await expect(out).toHaveAttribute('id', 'output');
    await expect(out).toHaveClass(/demo-output/);

    // The accessible attributes described in the FSM: aria-atomic="true" and tabindex="0"
    await expect(out).toHaveAttribute('aria-atomic', 'true');
    await expect(out).toHaveAttribute('tabindex', '0');

    // Verify that the initial innerText matches the informative placeholder
    const txt = await out.innerText();
    expect(txt).toContain('Click "Run simple insertion demo" to show a trace.');

    // Confirm no console or page errors surfaced on attribute checks
    expect(errors.consoleErrors.length, `console.error calls while validating DOM components: ${errors.consoleErrors.join(' | ')}`).toBe(0);
    expect(errors.pageErrors.length, `page errors while validating DOM components: ${errors.pageErrors.join(' | ')}`).toBe(0);

    errors.dispose();
  });

});