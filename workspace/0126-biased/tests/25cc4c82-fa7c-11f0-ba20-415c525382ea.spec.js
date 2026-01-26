import { test, expect } from '@playwright/test';

/**
 * Test suite for Application ID: 25cc4c82-fa7c-11f0-ba20-415c525382ea
 * URL: http://127.0.0.1:5500/workspace/0126-biased/html/25cc4c82-fa7c-11f0-ba20-415c525382ea.html
 *
 * This suite validates the FSM described in the prompt:
 * - S0_Idle state: initial page render (renderPage() entry action is observed via DOM)
 * - S1_DemoRunning state: triggered by clicking #demoBtn, runs binarySearchDemo and updates #demoOutput
 *
 * The tests:
 * - Observe console messages and page errors and assert expectations about them (none expected).
 * - Validate visual DOM feedback and focus behavior.
 * - Cover edge-cases like repeated clicks.
 *
 * Notes:
 * - ES module syntax is used per requirements.
 * - The tests do NOT modify or patch the page under test; they only interact with it like a real user would.
 */

/**
 * Page object for interacting with the demo page.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cc4c82-fa7c-11f0-ba20-415c525382ea.html';
  }

  async goto() {
    await this.page.goto(this.url);
  }

  demoButton() {
    return this.page.locator('#demoBtn');
  }

  demoOutput() {
    return this.page.locator('#demoOutput');
  }

  async clickDemoButton() {
    await this.demoButton().click();
  }

  async outputText() {
    return (await this.demoOutput().innerText()).trim();
  }

  async waitForOutputToContain(substring, options = {}) {
    await this.page.waitForFunction(
      (selector, substr) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        return el.textContent.includes(substr);
      },
      '#demoOutput',
      substring,
      options
    );
  }

  async isDemoOutputFocused() {
    return await this.page.evaluate(() => {
      const out = document.getElementById('demoOutput');
      return document.activeElement === out;
    });
  }
}

test.describe('Indexing demo FSM tests (Application 25cc4c82-... )', () => {
  let consoleMessages;
  let pageErrors;

  // Setup and teardown for each test: navigate to the page and collect console/page errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages with type and text
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Nothing special to teardown beyond Playwright defaults.
    // Placeholders in case future cleanup is needed.
    await page.close();
  });

  test('S0_Idle: initial render shows button and demo output with correct attributes', async ({ page }) => {
    // This test validates the initial Idle state described in the FSM:
    // - renderPage() entry action is expected to have produced the DOM
    // - The button (#demoBtn) and demo output (#demoOutput) should be present
    // - The demo output should show the initial instructional text and have expected ARIA attributes
    const demo = new DemoPage(page);
    await demo.goto();

    // Basic existence checks
    const btn = demo.demoButton();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('aria-label', 'Run binary search demonstration');
    await expect(btn).toHaveText('Run Binary Search Demo');

    const out = demo.demoOutput();
    await expect(out).toBeVisible();

    // Verify demoOutput initial text content matches the HTML implementation's static text
    const initialText = await out.innerText();
    expect(initialText.trim()).toBe('Click the button above to run the demonstration.');

    // Verify ARIA attributes and class are present as described in the FSM/components
    await expect(out).toHaveAttribute('class', 'demo-box');
    await expect(out).toHaveAttribute('aria-live', 'polite');
    await expect(out).toHaveAttribute('aria-atomic', 'true');
    await expect(out).toHaveAttribute('tabindex', '0');

    // Ensure no runtime JavaScript errors occurred during load
    // The application is expected to run without uncaught exceptions; if any pageErrors are captured, fail.
    expect(pageErrors.length).toBe(0);

    // No console messages of type 'error' are expected during initial render
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoRunning: clicking demo button runs binary search demo and focuses output', async ({ page }) => {
    // This test validates the event and transition described in the FSM:
    // Event: RunBinarySearchDemo (click #demoBtn)
    // Action: binarySearchDemo(array, target) -> demoOutput.textContent = steps.join("\n"); demoOutput.focus();
    const demo = new DemoPage(page);
    await demo.goto();

    // Click the demo button, which should trigger the demo and update the output div
    await demo.clickDemoButton();

    // Wait for important substrings to appear in the demo output
    await demo.waitForOutputToContain('Initial array: [3, 10, 15, 23, 31, 40, 55, 62, 70, 89]');
    await demo.waitForOutputToContain('Target to find: 31');
    await demo.waitForOutputToContain('Element found at index');

    // Read the entire output and perform assertions about the content structure
    const text = await demo.outputText();

    // The output should contain a sequence of steps including the 'Step:' markers, the check for mid element,
    // and the final "Element found at index" line for target 31.
    expect(text).toContain('Initial array: [3, 10, 15, 23, 31, 40, 55, 62, 70, 89]');
    expect(text).toContain('Target to find: 31');
    expect(text).toMatch(/Step: left=\d+, right=\d+, mid=\d+/); // at least one step line
    expect(text).toMatch(/Checking middle element arr\[\d+\] = \d+/);
    expect(text).toContain('Element found at index 4.');

    // Verify the demo output was focused as per expected_observables: demoOutput.focus();
    const isFocused = await demo.isDemoOutputFocused();
    expect(isFocused).toBe(true);

    // Ensure no uncaught page errors happened during the demo run
    expect(pageErrors.length).toBe(0);

    // Ensure console did not emit error-level logs during the demo run
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: clicking demo button multiple times updates content and focuses output each time', async ({ page }) => {
    // This test ensures idempotence and robustness: repeated activations should update the output,
    // not crash the page, and the output should regain focus each time.
    const demo = new DemoPage(page);
    await demo.goto();

    // Click once and capture the content length
    await demo.clickDemoButton();
    await demo.waitForOutputToContain('Element found at index 4.');
    const firstOutput = await demo.outputText();
    expect(firstOutput.length).toBeGreaterThan(10);

    // Click again quickly and ensure content is updated (replaced) and focus is returned to the output
    await demo.clickDemoButton();
    await demo.waitForOutputToContain('Element found at index 4.');
    const secondOutput = await demo.outputText();
    expect(secondOutput.length).toBeGreaterThan(10);

    // The content after second click should be equivalent in semantic content; ensure it contains the expected lines
    expect(secondOutput).toContain('Initial array: [3, 10, 15, 23, 31, 40, 55, 62, 70, 89]');
    expect(secondOutput).toContain('Target to find: 31');
    expect(secondOutput).toContain('Element found at index 4.');

    // Check focus again
    const isFocused = await demo.isDemoOutputFocused();
    expect(isFocused).toBe(true);

    // No uncaught exceptions or console errors after repeated activation
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Accessibility and observable attributes remain correct after demo run', async ({ page }) => {
    // Validate that after transition the demoOutput still retains expected accessibility attributes
    // This ensures that UI updates did not remove ARIA attributes critical for screen readers.
    const demo = new DemoPage(page);
    await demo.goto();

    // Pre-check attributes
    const out = demo.demoOutput();
    await expect(out).toHaveAttribute('aria-live', 'polite');
    await expect(out).toHaveAttribute('aria-atomic', 'true');

    // Trigger demo
    await demo.clickDemoButton();
    await demo.waitForOutputToContain('Element found at index 4.');

    // Re-check attributes after content update
    await expect(out).toHaveAttribute('aria-live', 'polite');
    await expect(out).toHaveAttribute('aria-atomic', 'true');
    await expect(out).toHaveAttribute('tabindex', '0');

    // Confirm that the textual update includes multiple lines (pre-wrap is enabled in CSS)
    const text = await demo.outputText();
    // Expect at least 3 newline-separated sections: initial array, target, at least one step
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(3);

    // No runtime errors observed
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Negative check: ensure clicking a non-existent selector throws a Playwright error (edge error scenario)', async ({ page }) => {
    // This test purposefully attempts to click a selector that does not exist to validate the test harness handles errors.
    // It's an edge-case test (not modifying the application).
    const demo = new DemoPage(page);
    await demo.goto();

    // Attempting to click a non-existent element should result in Playwright throwing an error.
    // We assert that an error is thrown by the Playwright action (not a page runtime exception).
    let thrown = false;
    try {
      await page.click('#thisSelectorDoesNotExist', { timeout: 1000 });
    } catch (err) {
      thrown = true;
      // Basic sanity assertions about the thrown error message coming from Playwright
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toMatch(/No node found for selector|Timeout/);
    }
    expect(thrown).toBe(true);

    // No uncaught page errors should have occurred as a result of this (the error is on the client side / Playwright side)
    expect(pageErrors.length).toBe(0);
  });
});