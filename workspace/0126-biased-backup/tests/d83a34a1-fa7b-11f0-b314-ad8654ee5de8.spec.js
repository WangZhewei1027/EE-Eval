import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83a34a1-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the demo area to keep tests organized
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = '#runDemo';
    this.output = '#demoText';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getButton() {
    return this.page.locator(this.runButton);
  }

  async getOutput() {
    return this.page.locator(this.output);
  }

  // Click the demo run button
  async clickRun() {
    await this.page.click(this.runButton);
  }

  // Returns the textContent of demo output
  async outputText() {
    return this.page.$eval(this.output, el => el.textContent);
  }

  // Wait until output includes a substring
  async waitForOutputIncludes(substr, options = { timeout: 5000 }) {
    await this.page.waitForFunction(
      (sel, s) => {
        const el = document.querySelector(sel);
        return !!el && el.textContent.includes(s);
      },
      this.output,
      substr,
      options
    );
  }

  // Wait until button disabled state matches expected
  async waitForButtonDisabledState(expectedDisabled, options = { timeout: 20000 }) {
    await this.page.waitForFunction(
      (sel, exp) => {
        const b = document.querySelector(sel);
        return !!b && b.disabled === exp;
      },
      this.runButton,
      expectedDisabled,
      options
    );
  }
}

test.describe('Garbage Collection Mark-and-Sweep Demo (FSM validation)', () => {
  // Store console and page errors observed during navigation and interaction
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', msg => {
      // Capture only error-level console messages for diagnostics
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions (pageerror)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('renders page and shows the Run simple mark-and-sweep demo button', async ({ page }) => {
      // Arrange: navigate to the page
      const demo = new DemoPage(page);
      await demo.goto();

      // Assert: no runtime page errors were thrown during load
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);

      // The main button should be visible and enabled (Idle state)
      const btn = await demo.getButton();
      await expect(btn).toBeVisible();
      await expect(btn).toHaveText('Run simple mark-and-sweep demo');
      await expect(btn).toBeEnabled();

      // The demo output area should contain the initial prompt text
      const out = await demo.getOutput();
      await expect(out).toBeVisible();
      const text = await out.textContent();
      expect(text).toContain('Press the button to see a 6-step mark-phase demonstration');
    });

    test('has the expected DOM structure and attributes as evidence of S0_Idle', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Validate attributes described in FSM evidence
      const button = page.locator('#runDemo');
      await expect(button).toHaveAttribute('class', /btn/);
      await expect(button).toHaveAttribute('aria-controls', 'demoOutput');

      // demoOutput container exists and contains demoText
      await expect(page.locator('#demoOutput')).toBeVisible();
      await expect(page.locator('#demoText')).toBeVisible();
    });
  });

  test.describe('Transition: RunDemoClick (S0_Idle -> S1_DemoRunning)', () => {
    test('clicking Run demo moves to Demo Running state: button disables and output begins', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Start listening to console and page errors during the interaction
      const localConsoleErrors = [];
      const localPageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') localConsoleErrors.push(msg.text());
      });
      page.on('pageerror', err => localPageErrors.push(err));

      // Sanity: button starts enabled (Idle)
      await expect(page.locator('#runDemo')).toBeEnabled();

      // Act: click the Run button to trigger the demo
      await demo.clickRun();

      // Immediately after click, FSM expects: btn.disabled = true and out.textContent = "Running demo..."
      // The script sets these synchronously before starting the interval. We assert the disabled state quickly.
      await demo.waitForButtonDisabledState(true, { timeout: 2000 });
      await expect(page.locator('#runDemo')).toBeDisabled();

      // The content "Running demo..." is set then cleared quickly; instead wait for the first demo line to appear.
      // The demo writes an introductory line that contains "Graph (edges)"
      await demo.waitForOutputIncludes('Graph (edges)', { timeout: 5000 });

      // At this point we are in DemoRunning state; assert that output contains expected run indication lines.
      const outText = await demo.outputText();
      expect(outText).toContain('Graph (edges): R -> A, A -> B, B -> C, C -> A (cycle). D is isolated.');
      expect(outText).toContain('Initial worklist: [A]');

      // No runtime errors should have occurred during this transition (nothing thrown by the page)
      expect(localConsoleErrors.length).toBe(0);
      expect(localPageErrors.length).toBe(0);
    });

    test('button remains disabled during demo run and re-enables after completion (S1_DemoRunning -> S0_Idle)', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Click to start demo
      await demo.clickRun();

      // Ensure it becomes disabled
      await demo.waitForButtonDisabledState(true, { timeout: 2000 });
      await expect(page.locator('#runDemo')).toBeDisabled();

      // While running, ensure output continues to be updated over time (observe multiple lines)
      // Wait for a known substring that appears near the end of the run: "Mark phase complete."
      // The demo appends "Mark phase complete." when finished.
      await demo.waitForOutputIncludes('Mark phase complete', { timeout: 20000 });

      // After completion, FSM expects the exit action to set btn.disabled = false
      await demo.waitForButtonDisabledState(false, { timeout: 20000 });
      await expect(page.locator('#runDemo')).toBeEnabled();

      // Final assertions about output
      const outText = await demo.outputText();
      expect(outText).toContain('Mark phase complete. Reachable (marked) objects will be preserved:');
      expect(outText).toContain('Unmarked objects are unreachable and can be reclaimed: D');

      // Confirm no uncaught page errors during full run
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('attempting to click while demo is running does not trigger a second concurrent run (edge case)', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Start demo
      await demo.clickRun();

      // Wait for disabled state to be true
      await demo.waitForButtonDisabledState(true, { timeout: 2000 });

      // Snapshot current output length (number of characters)
      const before = await demo.outputText();
      const beforeLen = before ? before.length : 0;

      // Attempt to click the button while disabled.
      // Playwright will perform the click action, but a disabled button should not fire the handler in the page.
      // We perform a direct click and then check that no duplicated demo run occurs by looking for
      // only a single "Mark phase complete" occurrence later.
      try {
        await page.click('#runDemo', { timeout: 1000 });
      } catch (e) {
        // Clicking a disabled element might fail; that's acceptable for this edge-case test.
        // We don't fail the test here; we'll rely on observable behavior instead.
      }

      // Wait for completion and re-enabled button
      await demo.waitForOutputIncludes('Mark phase complete', { timeout: 20000 });
      await demo.waitForButtonDisabledState(false, { timeout: 20000 });

      const after = await demo.outputText();

      // There should be exactly one "Mark phase complete" substring in the output (i.e., no double-run)
      const occurrences = (after.match(/Mark phase complete/g) || []).length;
      expect(occurrences).toBe(1);

      // The content should have grown from the earlier snapshot (since the demo ran)
      expect(after.length).toBeGreaterThanOrEqual(beforeLen);
    });
  });

  test.describe('FSM Evidence & Behavior Assertions', () => {
    test('verifies evidence strings referenced in FSM are present in page source and behavior', async ({ page }) => {
      // Validate that the page source contains evidence strings referenced in the FSM.
      await page.goto(APP_URL, { waitUntil: 'load' });
      const content = await page.content();

      // Evidence: existence of addEventListener('click', function(){
      expect(content).toContain("addEventListener('click', function(){");
      // Evidence: out.textContent = "Running demo...";
      expect(content).toContain('out.textContent = "Running demo...";');
      // Evidence: btn.disabled = true;
      expect(content).toContain('btn.disabled = true;');

      // Also verify behavior: clicking triggers the sequence that sets disabled true and later false
      const demo = new DemoPage(page);
      await demo.clickRun();
      await demo.waitForButtonDisabledState(true, { timeout: 2000 });
      await demo.waitForOutputIncludes('Mark phase complete', { timeout: 20000 });
      await demo.waitForButtonDisabledState(false, { timeout: 20000 });
    });

    test('no unexpected runtime exceptions or console.error messages during typical usage', async ({ page }) => {
      // Navigate fresh and perform one full run
      const demo = new DemoPage(page);
      await demo.goto();

      // Reset captured arrays for this test
      consoleErrors = [];
      pageErrors = [];

      await demo.clickRun();

      // Wait for run to complete
      await demo.waitForOutputIncludes('Mark phase complete', { timeout: 20000 });
      await demo.waitForButtonDisabledState(false, { timeout: 20000 });

      // Assert no console.error or uncaught page errors occurred
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  test.afterEach(async ({ page }) => {
    // Final safety check: ensure there were no uncaught errors recorded during test lifecycle
    // (This will cause a test failure if any pageerror or console.error were recorded and not asserted)
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    // Close page handled by Playwright test runner automatically
  });
});