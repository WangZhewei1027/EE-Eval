import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83811c0-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object Model for the demo page to keep tests organized and readable
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtnSelector = '#runDemoBtn';
    this.demoAreaSelector = '#demoArea';
    this.outputSelector = '#demoOutput';
  }

  // Navigate to the application and wait for main container to be available
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await this.page.waitForSelector('.container');
  }

  // Returns the element handle for the Run Demo button
  async getRunButton() {
    return this.page.$(this.runBtnSelector);
  }

  // Returns the element handle for the demo area
  async getDemoArea() {
    return this.page.$(this.demoAreaSelector);
  }

  // Get the TextContent of the demo output <pre> element
  async getOutputText() {
    const handle = await this.page.$(this.outputSelector);
    if (!handle) return '';
    return (await this.page.evaluate(el => el.textContent, handle)) || '';
  }

  // Click the Run Demo button (use normal click)
  async clickRunDemo() {
    await this.page.click(this.runBtnSelector);
  }

  // Helper to check whether demo area is visible via computed style
  async isDemoAreaVisible() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      return getComputedStyle(el).display !== 'none' && !!el.offsetParent;
    }, this.demoAreaSelector);
  }

  // Helper to get disabled state of run button
  async isRunButtonDisabled() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return !!(el && el.disabled);
    }, this.runBtnSelector);
  }
}

test.describe('Virtual Memory — Simple Page Replacement Demo (FSM validation)', () => {
  // Collect console messages and page errors for assertions and diagnostics.
  // Each test will set up its own arrays to avoid cross-test pollution.
  test.beforeEach(async ({ page }) => {
    // Intentionally nothing global is modified; tests will attach listeners per-test.
    // Navigation is handled in each test via DemoPage.goto to keep listeners attached before navigation when needed.
  });

  // Test initial idle state: ensure UI elements rendered per FSM state S0_Idle
  test('S0_Idle: initial render shows Run Demo button enabled and demo area hidden', async ({ page }) => {
    // Collect console messages and page errors for this test
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new DemoPage(page);
    await demo.goto();

    // Validate presence of the run button (evidence of S0_Idle)
    const runBtn = await demo.getRunButton();
    expect(runBtn).not.toBeNull();
    // Button should be enabled initially
    const disabled = await demo.isRunButtonDisabled();
    expect(disabled).toBe(false);

    // Demo area should be present but hidden (style display:none)
    const demoArea = await demo.getDemoArea();
    expect(demoArea).not.toBeNull();
    const visible = await demo.isDemoAreaVisible();
    expect(visible).toBe(false);

    // Ensure demoOutput exists and starts empty
    const outputText = await demo.getOutputText();
    expect(outputText.trim()).toBe('');

    // Assert: no page errors occurred during initial load
    expect(pageErrors.length).toBe(0);

    // Assert: no console.error messages emitted during initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test transition: clicking Run Demo should transition to S1_DemoRunning
  test('RunDemo event: clicking the Run simple page replacement demo button displays demo area and disables the button', async ({ page }) => {
    // Attach listeners to observe console and runtime errors during interaction
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new DemoPage(page);
    await demo.goto();

    // Click the run button -> this should execute runDemo() from page script
    // We do not inject or modify any global functions; we let the page behave as-is.
    await demo.clickRunDemo();

    // After click, demo area should become visible (transition evidence)
    // The app updates style synchronously; wait for the computed style to reflect visibility.
    await page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return !!el && getComputedStyle(el).display !== 'none';
    }, {}, demo.demoAreaSelector);

    const isVisible = await demo.isDemoAreaVisible();
    expect(isVisible).toBe(true);

    // Button should now be disabled according to transition evidence
    const disabled = await demo.isRunButtonDisabled();
    expect(disabled).toBe(true);

    // Button style was changed to slightly opaque; check the inline style attribute for opacity set by the script
    const btnOpacity = await page.evaluate(sel => {
      const b = document.querySelector(sel);
      return b && b.style ? b.style.opacity : null;
    }, demo.runBtnSelector);
    expect(btnOpacity === '' || btnOpacity === null || typeof btnOpacity === 'string').toBe(true);
    // script set opacity to "0.7"; if present, assert it's exactly that
    if (btnOpacity) {
      expect(btnOpacity).toBe('0.7');
    }

    // The demo output should be populated with textual trace and counts
    const output = await demo.getOutputText();
    expect(output.length).toBeGreaterThan(20); // ensure it's not trivially small
    expect(output).toContain('Total page faults');
    expect(output).toContain('FIFO Trace');
    expect(output).toContain('LRU Trace');
    expect(output).toContain('CLOCK Trace');

    // Parse the quick comparison counts from the textual output to assert deterministic results
    // Example lines:
    // - FIFO faults:  9
    // - LRU faults:   9
    // - CLOCK faults: 9
    const lines = output.split('\n').map(l => l.trim());
    const fifoLine = lines.find(l => l.startsWith('- FIFO faults:'));
    const lruLine = lines.find(l => l.startsWith('- LRU faults:'));
    const clockLine = lines.find(l => l.startsWith('- CLOCK faults:'));
    expect(fifoLine).toBeDefined();
    expect(lruLine).toBeDefined();
    expect(clockLine).toBeDefined();

    const parseCount = (line) => {
      const m = line.match(/:\s*(\d+)/);
      return m ? Number(m[1]) : NaN;
    };
    const fifoCount = parseCount(fifoLine);
    const lruCount = parseCount(lruLine);
    const clockCount = parseCount(clockLine);

    // Expected results computed from the same logic as the demo (deterministic for the given trace and 3 frames)
    const expectedFaults = 9;
    expect(fifoCount).toBe(expectedFaults);
    expect(lruCount).toBe(expectedFaults);
    expect(clockCount).toBe(expectedFaults);

    // Assert: no uncaught page errors happened during click/runDemo
    expect(pageErrors.length).toBe(0);

    // Assert: there were no console.error messages (diagnostic)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case tests: clicking the disabled Run Demo button again should have no effect and should not throw errors
  test('Edge case: subsequent clicks after demo has run do not change output and do not cause runtime errors', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new DemoPage(page);
    await demo.goto();

    // First click to start demo
    await demo.clickRunDemo();
    await page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return !!el && getComputedStyle(el).display !== 'none';
    }, {}, demo.demoAreaSelector);

    // Capture current output snapshot
    const beforeOutput = await demo.getOutputText();

    // Try clicking the disabled button; since it is disabled, the click should not call runDemo again.
    // For robustness, we attempt to click and then wait briefly to ensure no changes occur.
    const runBtnHandle = await demo.getRunButton();
    expect(runBtnHandle).not.toBeNull();

    // Attempt to click regardless of disabled state. Playwright's click will still attempt to click, but the element being disabled means the browser won't trigger the onclick handler.
    // Surround with try/catch only to avoid test crash if browser refuses to click a disabled control; it's acceptable for the click to be a no-op.
    try {
      await runBtnHandle.click({ timeout: 500 }); // short timeout
    } catch (e) {
      // Some browsers might throw if clicking an element that is not actionable; that's okay for our test;
      // we only need to ensure no page errors were produced by the page script as a result.
    }

    // Wait briefly to allow any synchronous handlers to run (the page's demo is synchronous, so this is mostly safety)
    await page.waitForTimeout(200);

    const afterOutput = await demo.getOutputText();

    // The output should be unchanged after the disabled click attempt
    expect(afterOutput).toBe(beforeOutput);

    // Ensure the button remains disabled and demo area visible
    expect(await demo.isRunButtonDisabled()).toBe(true);
    expect(await demo.isDemoAreaVisible()).toBe(true);

    // Assert: no uncaught page errors happened during the disabled-click attempt
    expect(pageErrors.length).toBe(0);

    // Also assert that there were no console.error messages emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Robustness test: load page and verify no unexpected runtime errors are emitted during the entire lifecycle
  test('No unexpected runtime errors during full lifecycle (load + run demo)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new DemoPage(page);
    await demo.goto();

    // Click to run demo
    await demo.clickRunDemo();

    // Wait for demo area visible
    await page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return !!el && getComputedStyle(el).display !== 'none';
    }, {}, demo.demoAreaSelector);

    // Wait a tick for any additional console messages/errors
    await page.waitForTimeout(100);

    // Assert that no uncaught page errors occurred
    expect(pageErrors.length).toBe(0, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`);

    // Ensure there are no console.error messages
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0, `Unexpected console.error messages: ${errors.map(e => e.text).join('; ')}`);

    // Additionally, we can assert that at least some console messages were observed (optional)
    // Many pages emit none; this is not required. We only assert absence of error-level messages above.
  });
});