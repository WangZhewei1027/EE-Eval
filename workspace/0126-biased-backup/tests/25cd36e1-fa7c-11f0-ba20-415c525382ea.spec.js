import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cd36e1-fa7c-11f0-ba20-415c525382ea.html';

// Page object for the minimal demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#runDemoBtn');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async isRunButtonVisible() {
    return await this.runButton.isVisible();
  }

  async getRunButtonAriaLabel() {
    return await this.runButton.getAttribute('aria-label');
  }

  async clickRunButton() {
    await this.runButton.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async getOutputRole() {
    return await this.output.getAttribute('role');
  }

  async getOutputAriaLive() {
    return await this.output.getAttribute('aria-live');
  }

  async getOutputAriaAtomic() {
    return await this.output.getAttribute('aria-atomic');
  }
}

test.describe('Integration Test Demo - FSM and UI validation', () => {
  // Capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Prevent Playwright from failing the test on uncaught exceptions automatically;
    // we will observe them and assert expectations ourselves.
    page.on('console', (msg) => {
      // Attach console messages to the page for debugging if needed.
      // We don't fail here; tests will assert on these arrays later.
      // No-op handler just ensures messages are observed.
    });
    page.on('pageerror', (err) => {
      // No-op; observed below via stored arrays in tests where required.
    });
  });

  test('S0_Idle: initial render shows Run Integration Test Demo button and empty output', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) evidence:
    // - The Run Integration Test Demo button must be present with expected aria-label.
    // - The demoOutput region exists and is initially empty.
    // - Verify the FSM entry action "renderPage()" is not present on the window (as the HTML does not define renderPage).
    const demo = new DemoPage(page);
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (m) => consoleMessages.push(m));
    page.on('pageerror', (e) => pageErrors.push(e));

    await demo.goto();

    // Assert button is visible
    expect(await demo.isRunButtonVisible()).toBeTruthy();

    // Assert aria-label attribute matches the FSM/component evidence
    expect(await demo.getRunButtonAriaLabel()).toBe('Run integration test demo');

    // The demo output region should exist and be empty at initial render (S0_Idle)
    const initialText = await demo.getOutputText();
    expect(initialText.trim()).toBe('');

    // Check accessibility attributes for the output region match FSM evidence
    expect(await demo.getOutputRole()).toBe('region');
    expect(await demo.getOutputAriaLive()).toBe('polite');
    expect(await demo.getOutputAriaAtomic()).toBe('true');

    // Verify the mentioned entry action renderPage() — the HTML does not define it.
    // We assert its absence rather than injecting it (per requirements).
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    // If not defined, typeof will be "undefined" — we assert that explicitly.
    expect(renderPageType).toBe('undefined');

    // Assert there were no page errors or console.error messages during initial render
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type() === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('Transition S0_Idle -> S1_Testing: clicking the Run button updates demoOutput with expected test results', async ({ page }) => {
    // This test validates the single transition defined in the FSM:
    // - Event: click #runDemoBtn
    // - Effect: integrationTest() executed and demoOutput textContent updated with test results
    const demo = new DemoPage(page);
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (m) => consoleMessages.push(m));
    page.on('pageerror', (e) => pageErrors.push(e));

    await demo.goto();

    // Click the run demo button to trigger the integration test
    await demo.clickRunButton();

    // Wait for the demoOutput to be populated. The script sets textContent synchronously in the click handler,
    // but we still wait for non-empty textContent to avoid flakiness.
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.textContent && el.textContent.trim().length > 0;
    });

    const outputText = await demo.getOutputText();

    // Build the expected output exactly as the page's integrationTest() produces it.
    const expectedLines = [
      'Test case #1: Input = "hello" ➔ Status = ok ✅ PASS',
      'Test case #2: Input = "" ➔ Status = error ✅ PASS',
      'Test case #3: Input = 123 ➔ Status = error ✅ PASS'
    ];
    const expectedOutput = expectedLines.join('\n');

    // Assert that the output matches expected content from integrationTest()
    expect(outputText.trim()).toBe(expectedOutput);

    // Confirm that clicking the button triggered integrationTest semantics by checking
    // that the output contains status strings and PASS markers.
    expect(outputText).toContain('Status = ok');
    expect(outputText).toContain('Status = error');
    expect(outputText).toContain('✅ PASS');

    // Ensure no JS runtime errors were thrown during the click/processing.
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type() === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('Idempotency and repeated runs: clicking the Run button multiple times resets output consistently', async ({ page }) => {
    // This test validates that S1_Testing behavior is stable across repeated activations:
    // - Clicking multiple times should set the same textContent (not append).
    const demo = new DemoPage(page);
    await demo.goto();

    // Click once and capture the output
    await demo.clickRunButton();
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.textContent && el.textContent.trim().length > 0;
    });
    const firstOutput = await demo.getOutputText();

    // Click again
    await demo.clickRunButton();
    // Wait a short moment to ensure the handler executed
    await page.waitForTimeout(50);
    const secondOutput = await demo.getOutputText();

    // The handler sets textContent each time, so outputs should be identical (idempotent reset)
    expect(secondOutput).toBe(firstOutput);

    // Ensure there are three test case lines each time (sanity check)
    const lines = firstOutput.split('\n').map(l => l.trim()).filter(Boolean);
    expect(lines.length).toBe(3);
    expect(lines[0]).toMatch(/^Test case #1:/);
    expect(lines[1]).toMatch(/^Test case #2:/);
    expect(lines[2]).toMatch(/^Test case #3:/);
  });

  test('Edge cases: verify DOM and JS stability (no unexpected exceptions) even under rapid clicking', async ({ page }) => {
    // This test sends a burst of clicks to check for race conditions or uncaught exceptions.
    // It observes console and page errors and asserts none occurred.
    const demo = new DemoPage(page);
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (m) => consoleMessages.push(m));
    page.on('pageerror', (e) => pageErrors.push(e));

    await demo.goto();

    // Rapidly trigger the button multiple times
    for (let i = 0; i < 5; i++) {
      await demo.clickRunButton();
    }

    // Wait briefly to allow handlers to settle
    await page.waitForTimeout(100);

    // Output should still be well-formed text with 3 lines
    const outputText = await demo.getOutputText();
    const lines = outputText.split('\n').map(l => l.trim()).filter(Boolean);
    expect(lines.length).toBe(3);

    // No page errors were recorded
    expect(pageErrors.length).toBe(0);

    // No console.error messages were recorded
    const consoleErrorCount = consoleMessages.filter(m => m.type() === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('FSM evidence assertions: components and event handler existence', async ({ page }) => {
    // This test asserts additional concrete evidence from the FSM:
    // - The button selector "#runDemoBtn" exists
    // - The demoOutput element exists with the expected attributes
    // - The event handler for the button is wired (verified by clicking and observing changes)
    const demo = new DemoPage(page);
    await demo.goto();

    // DOM existence checks
    const hasButton = await page.$('#runDemoBtn') !== null;
    expect(hasButton).toBe(true);

    const hasOutput = await page.$('#demoOutput') !== null;
    expect(hasOutput).toBe(true);

    // Check attributes directly via evaluate to match FSM component evidence
    const attrs = await page.evaluate(() => {
      const btn = document.getElementById('runDemoBtn');
      const out = document.getElementById('demoOutput');
      return {
        buttonText: btn ? btn.textContent : null,
        buttonAria: btn ? btn.getAttribute('aria-label') : null,
        outputClass: out ? out.className : null,
        outputRole: out ? out.getAttribute('role') : null,
        outputAriaLive: out ? out.getAttribute('aria-live') : null,
      };
    });

    expect(attrs.buttonText).toContain('Run Integration Test Demo');
    expect(attrs.buttonAria).toBe('Run integration test demo');
    expect(attrs.outputClass).toContain('demo-output');
    expect(attrs.outputRole).toBe('region');
    expect(attrs.outputAriaLive).toBe('polite');

    // Verify event handler by clicking and confirming the output changed from empty to non-empty
    const before = await demo.getOutputText();
    expect(before.trim()).toBe('');
    await demo.clickRunButton();

    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.textContent && el.textContent.trim().length > 0;
    });

    const after = await demo.getOutputText();
    expect(after.trim().length).toBeGreaterThan(0);
  });
});