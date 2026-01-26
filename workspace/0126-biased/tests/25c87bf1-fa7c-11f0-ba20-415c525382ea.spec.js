import { test, expect } from '@playwright/test';

// Test file for Application ID: 25c87bf1-fa7c-11f0-ba20-415c525382ea
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/25c87bf1-fa7c-11f0-ba20-415c525382ea.html
//
// These tests validate the FSM states and transitions described in the prompt:
// - S0_Idle (initial) : button present and demoOutput empty
// - S1_OutputDisplayed: clicking the button shows forward and backward traversal output
//
// The suite also observes console messages and page errors and asserts no unexpected runtime errors occur.
// Per instructions, the page is loaded exactly as-is and runtime behavior is observed without modification.

// Page object representing the demo section
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/25c87bf1-fa7c-11f0-ba20-415c525382ea.html';
    this.selectors = {
      demoBtn: '#demoBtn',
      demoOutput: '#demoOutput',
      demoSection: '.demo-section',
    };
  }

  // Load the page and ensure the demo section is present
  async load() {
    await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });
    await this.page.waitForSelector(this.selectors.demoSection, { state: 'visible' });
  }

  // Returns the button element handle
  async getButton() {
    return await this.page.waitForSelector(this.selectors.demoBtn, { state: 'attached' });
  }

  // Click the demo button
  async clickDemo() {
    const btn = await this.getButton();
    await btn.click();
  }

  // Focus the demo button and press a key (Enter or Space)
  async pressKeyOnButton(key) {
    const btn = await this.getButton();
    await btn.focus();
    await this.page.keyboard.press(key);
  }

  // Get the demoOutput text content (trimmed)
  async getOutputText() {
    const el = await this.page.waitForSelector(this.selectors.demoOutput, { state: 'attached' });
    return (await this.page.evaluate(e => e.textContent, el))?.trim() ?? '';
  }

  // Wait until output contains a substring (timeout optional)
  async waitForOutputContains(substring, opts = {}) {
    const timeout = opts.timeout ?? 2000;
    await this.page.waitForFunction(
      (selector, substr) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        return el.textContent && el.textContent.indexOf(substr) !== -1;
      },
      this.selectors.demoOutput,
      substring,
      { timeout }
    );
  }

  // Check the accessibility attributes of the button and output region
  async getAttributes() {
    const btn = await this.getButton();
    const demoOutput = await this.page.waitForSelector(this.selectors.demoOutput);
    return {
      button: {
        ariaHaspopup: await btn.getAttribute('aria-haspopup'),
        ariaControls: await btn.getAttribute('aria-controls'),
      },
      output: {
        ariaLive: await demoOutput.getAttribute('aria-live'),
        role: await demoOutput.getAttribute('role'),
        ariaAtomic: await demoOutput.getAttribute('aria-atomic'),
      },
    };
  }
}

test.describe('Doubly Linked List Demo - FSM states and transitions', () => {
  // Arrays to collect console messages and page errors per test
  let consoleErrors;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleMessages = [];
    pageErrors = [];

    // Observe console messages; collect error-level messages separately
    page.on('console', msg => {
      consoleMessages.push(msg);
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location(),
            type: msg.type(),
          });
        }
      } catch (e) {
        // ignore inspection errors
      }
    });

    // Observe uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // nothing to teardown here; event listeners are removed with page lifecycle
  });

  // Test initial S0_Idle state: button present and demoOutput empty.
  test('S0_Idle: initial render - button exists with correct attributes and output is empty', async ({ page }) => {
    const demo = new DemoPage(page);
    // Load the page exactly as-is
    await demo.load();

    // Validate button exists and has expected accessible attributes (evidence for S0_Idle)
    const btn = await demo.getButton();
    expect(btn).toBeTruthy();

    const attrs = await demo.getAttributes();
    // The FSM expected attributes on the button
    expect(attrs.button.ariaHaspopup).toBe('true');
    expect(attrs.button.ariaControls).toBe('demoOutput');

    // Validate demoOutput region exists and is initially empty (S0_Idle evidence)
    const outputText = await demo.getOutputText();
    expect(outputText).toBe(''); // initial state should have empty output text

    // Verify demoOutput aria attributes
    expect(attrs.output.ariaLive).toBe('polite');
    expect(attrs.output.role).toBe('region');
    expect(attrs.output.ariaAtomic).toBe('true');

    // Verify that the page did not emit any uncaught runtime errors on load
    expect(pageErrors.length).toBe(0, `Expected no page errors on initial load, but found: ${pageErrors.map(e => e.message).join('; ')}`);
    expect(consoleErrors.length).toBe(0, `Expected no console.error messages on initial load, but found: ${consoleErrors.map(e => e.text).join('; ')}`);

    // Verify whether the FSM-declared onEnter action renderPage exists in the runtime
    // We must not invoke it; just assert whether it's defined or not.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    // The HTML doesn't define renderPage; assert it's undefined (documented mismatch between FSM and implementation)
    expect(renderPageType).toBe('undefined');
  });

  // Test transition: clicking the button should display forward and backward traversal output (S1_OutputDisplayed)
  test('ShowTraversalOutput event: clicking the demo button transitions to S1_OutputDisplayed and displays traversals', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.load();

    // Click the demo button to trigger ShowTraversalOutput event
    await demo.clickDemo();

    // Wait for the expected forward traversal text to appear in the output region
    await demo.waitForOutputContains('Forward traversal (head → tail):');

    // Retrieve the text and assert expected content
    const output = await demo.getOutputText();

    // Validate that forward and backward labels exist
    expect(output).toContain('Forward traversal (head → tail):');
    expect(output).toContain('Backward traversal (tail → head):');

    // Expect the sequence used by the page implementation: [5, 15, 25, 35]
    expect(output).toContain('5 → 15 → 25 → 35');
    expect(output).toContain('35 → 25 → 15 → 5');

    // Check that the output is placed in the demoOutput element (evidence: outputDiv.textContent = outputText)
    const demoOutputHandle = await page.waitForSelector('#demoOutput');
    const demoOutputText = (await demoOutputHandle.textContent())?.trim();
    expect(demoOutputText).toBe(output);

    // Ensure no uncaught page errors or console.error messages occurred while clicking and rendering output
    expect(pageErrors.length).toBe(0, `Expected no page errors after clicking demo button, but found: ${pageErrors.map(e => e.message).join('; ')}`);
    expect(consoleErrors.length).toBe(0, `Expected no console.error messages after clicking demo button, but found: ${consoleErrors.map(e => e.text).join('; ')}`);
  });

  // Edge cases and additional interactions: multiple rapid clicks and keyboard activation
  test('Edge cases: multiple rapid clicks and keyboard activation do not cause errors and produce stable output', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.load();

    // Rapid multiple clicks
    const btn = await demo.getButton();
    // dispatch several clicks quickly
    await Promise.all([
      btn.click(),
      btn.click(),
      btn.click(),
    ]);

    // Wait for output to show
    await demo.waitForOutputContains('Forward traversal (head → tail):');

    // Capture output after rapid clicks
    const outputAfterRapidClicks = await demo.getOutputText();

    // Validate content correctness
    expect(outputAfterRapidClicks).toContain('5 → 15 → 25 → 35');
    expect(outputAfterRapidClicks).toContain('35 → 25 → 15 → 5');

    // Now test keyboard activation with Enter
    await demo.pressKeyOnButton('Enter');
    await demo.waitForOutputContains('Forward traversal (head → tail):');

    const outputAfterEnter = await demo.getOutputText();
    expect(outputAfterEnter).toBe(outputAfterRapidClicks); // pressing Enter should produce same stable output

    // Test keyboard activation with Space
    await demo.pressKeyOnButton('Space');
    await demo.waitForOutputContains('Forward traversal (head → tail):');

    const outputAfterSpace = await demo.getOutputText();
    expect(outputAfterSpace).toBe(outputAfterRapidClicks); // pressing Space also produces same result

    // Ensure no errors observed during these interactions
    expect(pageErrors.length).toBe(0, `Expected no page errors during rapid interactions, but found: ${pageErrors.map(e => e.message).join('; ')}`);
    expect(consoleErrors.length).toBe(0, `Expected no console.error during rapid interactions, but found: ${consoleErrors.map(e => e.text).join('; ')}`);
  });

  // Accessibility and role-based checks for the transition state
  test('S1_OutputDisplayed: aria-live region updates and remains accessible after transition', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.load();

    // Assert aria-live region empty before action
    const beforeText = await demo.getOutputText();
    expect(beforeText).toBe('');

    // Click to trigger output
    await demo.clickDemo();
    await demo.waitForOutputContains('Forward traversal (head → tail):');

    // After click, the aria-live region has updated content; check that update is present
    const html = await page.evaluate(() => {
      const el = document.getElementById('demoOutput');
      return {
        text: el ? el.textContent : null,
        ariaLive: el ? el.getAttribute('aria-live') : null,
        role: el ? el.getAttribute('role') : null,
        ariaAtomic: el ? el.getAttribute('aria-atomic') : null,
      };
    });

    expect(html.text).toBeTruthy();
    expect(html.text).toContain('Forward traversal (head → tail):');
    // Verify aria attributes persisted through update
    expect(html.ariaLive).toBe('polite');
    expect(html.role).toBe('region');
    expect(html.ariaAtomic).toBe('true');

    // No runtime errors observed
    expect(pageErrors.length).toBe(0, `Expected no page errors during aria-live update, but found: ${pageErrors.map(e => e.message).join('; ')}`);
    expect(consoleErrors.length).toBe(0, `Expected no console.error messages during aria-live update, but found: ${consoleErrors.map(e => e.text).join('; ')}`);
  });

  // Negative check: ensure that there are no unexpected ReferenceError/SyntaxError/TypeError messages logged to console
  // The test captures console messages and asserts none are of error severity.
  test('No unexpected runtime ReferenceError, SyntaxError, or TypeError messages were emitted to console during normal use', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.load();

    // Perform normal interaction
    await demo.clickDemo();
    await demo.waitForOutputContains('Forward traversal (head → tail):');

    // Evaluate collected console messages types
    const errorKinds = consoleMessages
      .filter(m => m.type() === 'error')
      .map(m => m.text());

    // Assert there are zero console.error messages recorded
    expect(errorKinds.length).toBe(0, `Unexpected console.error messages found: ${JSON.stringify(errorKinds, null, 2)}`);

    // Also assert there were no uncaught page errors
    expect(pageErrors.length).toBe(0, `Unexpected page errors found: ${pageErrors.map(e => e.message).join('; ')}`);
  });
});