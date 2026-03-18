import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3708aa0-ffc4-11f0-821c-7d25bc609266.html';

// Page Object for the demonstration page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demo-btn');
    this.output = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async isButtonVisible() {
    return await this.button.isVisible();
  }

  async getButtonText() {
    return await this.button.textContent();
  }

  async getButtonAriaLabel() {
    return await this.button.getAttribute('aria-label');
  }

  async isButtonDisabled() {
    return await this.button.evaluate((b) => b.disabled);
  }

  async clickRun() {
    await this.button.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async waitForOutputNonEmpty(timeout = 5000) {
    await this.page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.trim().length > 0;
      },
      '#demo-output',
      { timeout }
    );
    return this.getOutputText();
  }

  async waitForOutputContains(substr, timeout = 30000) {
    await this.page.waitForFunction(
      (args) => {
        const el = document.querySelector(args.selector);
        return el && el.textContent && el.textContent.includes(args.substr);
      },
      { selector: '#demo-output', substr },
      { timeout }
    );
    return this.getOutputText();
  }

  async getOutputOccurrences(substr) {
    const text = await this.getOutputText();
    if (!text) return 0;
    return (text.match(new RegExp(substr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  }

  async hasOutputAttribute(attr, expectedValue = null) {
    const val = await this.output.getAttribute(attr);
    if (expectedValue === null) return val !== null;
    return val === expectedValue;
  }
}

test.describe('Red-Black Tree Demo - FSM states and transitions', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors for assertions later
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // S0_Idle: initial render - verify button and output exist as per FSM evidence
  test('S0_Idle: initial render shows Run Insertion Demonstration button and empty output', async ({ page }) => {
    const demo = new DemoPage(page);
    // Navigate to page
    await demo.goto();

    // Verify button exists and is visible (FSM Idle state evidence)
    expect(await demo.isButtonVisible()).toBe(true);
    expect((await demo.getButtonText()).trim()).toBe('Run Insertion Demonstration');

    // Verify aria-label matches FSM evidence
    expect(await demo.getButtonAriaLabel()).toBe('Run red-black tree insertion demonstration');

    // Verify output pre element exists and is initially empty (entry renderPage() evidence)
    expect(await demo.getOutputText()).toBe('');

    // Verify aria-live and aria-atomic attributes are present per FSM component evidence
    expect(await demo.hasOutputAttribute('aria-live')).toBe(true);
    expect(await demo.hasOutputAttribute('aria-atomic')).toBe(true);
    expect(await demo.output.getAttribute('aria-live')).toBe('polite');
    expect(await demo.output.getAttribute('aria-atomic')).toBe('true');

    // Assert there were no page errors or console errors during initial load
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // S1_DemoRunning: clicking the button transitions from Idle to DemoRunning and output updates
  // This test waits for the demo to complete (the demo logs a final line). Because the demo uses a 1300ms interval
  // between steps and multiple steps, increase the timeout for this test to allow the full run to complete.
  test(
    'RunInsertionDemo transition: clicking the demo button starts the demo, output updates and button is disabled during run',
    async ({ page }) => {
      test.setTimeout(45000); // allow up to 45s for the demo to finish
      const demo = new DemoPage(page);
      await demo.goto();

      // Click to start the demo (this triggers runDemo)
      await demo.clickRun();

      // Immediately after click, the button should be disabled (runDemo sets disabled = true)
      // Use a short wait to allow DOM update if necessary
      await page.waitForTimeout(50);
      expect(await demo.isButtonDisabled()).toBe(true);

      // Wait for the first meaningful output line to appear (evidence of "Output text updates with insertion steps.")
      await demo.waitForOutputContains('Inserting 10:', 10000);

      // Ensure that output contains later steps: wait for final confirmation string
      await demo.waitForOutputContains('Tree satisfies all Red-Black properties.', 35000);

      // After the demo finishes, the button should be re-enabled
      // Wait for the demo to re-enable the button (runDemo re-enables it when interval finishes)
      await page.waitForFunction(() => {
        const btn = document.getElementById('demo-btn');
        return btn && !btn.disabled;
      }, { timeout: 5000 });

      expect(await demo.isButtonDisabled()).toBe(false);

      // Verify the output contains key lines from the demo (sanity checks)
      const out = await demo.getOutputText();
      expect(out).toContain('Inserting 10:');
      expect(out).toContain('Inserting 20:');
      expect(out).toContain('Inserting 30:');
      expect(out).toContain('Apply Left Rotation on 10.').or(expect(out).toContain('Apply Left Rotation on 10')); // tolerate slight variations

      // Ensure no runtime page errors or console.error occurred during the demo run
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    }
  );

  // Edge case: rapid double-clicks. Ensure the button becomes disabled and output starts populating.
  // We don't assert on duplicate runs (the demo implementation may or may not allow overlapping runs depending on timing),
  // but we assert that clicking triggers the demo and disables the button.
  test('Edge case: rapid double-click should start the demo and disable the button (no unhandled errors)', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Rapidly attempt two clicks
    // The button should quickly become disabled; the second click may be ignored by the browser once disabled.
    await Promise.all([
      demo.clickRun(),
      // small slight delay so the second click happens very shortly after the first
      page.waitForTimeout(10).then(() => demo.clickRun().catch(() => {}))
    ]).catch(() => {
      // click may throw if element becomes detached/disabled mid-action; swallow so we can assert state below
    });

    // Button should end up disabled
    await page.waitForTimeout(50);
    expect(await demo.isButtonDisabled()).toBe(true);

    // Wait for some output to confirm the demo started
    await demo.waitForOutputContains('Inserting 10:', 10000);

    // Count occurrences of the first insertion marker to detect obvious duplication
    const occurrences = await demo.getOutputOccurrences('Inserting 10:');
    expect(occurrences).toBeGreaterThanOrEqual(1);

    // Ensure no console errors or page errors occurred
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Error scenario: interacting with a non-existent element should raise an error from Playwright.
  // This verifies the environment surfaces DOM interaction errors for missing selectors.
  test('Error scenario: clicking a non-existent selector should throw an error', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Attempt to click a non-existent selector and assert Playwright rejects with an error
    let thrown = null;
    try {
      await page.click('#this-selector-does-not-exist', { timeout: 2000 });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).not.toBeNull();
    expect(thrown.message).toContain('No node found for selector');

    // Ensure that attempting the invalid interaction did not cause page runtime errors
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});