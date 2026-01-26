import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b3cf94-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page object encapsulating interactions and observers for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pageErrors = [];
    this.consoleMessages = [];

    // Collect uncaught page errors (e.g., ReferenceError, TypeError, SyntaxError)
    this.page.on('pageerror', (err) => {
      // store the actual Error object for inspection in tests
      this.pageErrors.push(err);
    });

    // Collect console messages for later assertions
    this.page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });
  }

  // Navigate to the application URL
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Returns the button element handle (if present)
  async getRunButton() {
    return this.page.$("button[onclick='runDemo()']");
  }

  // Returns the demo output element handle
  async getDemoOutput() {
    return this.page.$('#demoOutput');
  }

  // Helper to determine whether demo output is visible via inline style
  async isDemoOutputVisible() {
    const demo = await this.getDemoOutput();
    if (!demo) return false;
    // Check inline style first
    const inline = await demo.evaluate((el) => el.style.display);
    if (inline) return inline !== 'none';
    // Fallback to computed style
    const computed = await demo.evaluate((el) => window.getComputedStyle(el).display);
    return computed !== 'none';
  }

  // Click the Run Optimization Demo button (throws if button not present)
  async clickRunDemo() {
    await this.page.click("button[onclick='runDemo()']");
  }

  // Returns the innerHTML of demoOutput
  async getDemoOutputHTML() {
    const demo = await this.getDemoOutput();
    if (!demo) return null;
    return demo.evaluate((el) => el.innerHTML);
  }

  // Expose captured page errors
  getCapturedPageErrors() {
    return this.pageErrors;
  }

  // Expose captured console messages
  getCapturedConsoleMessages() {
    return this.consoleMessages;
  }
}

test.describe('Comprehensive Guide to Query Optimization — FSM and UI tests', () => {
  // Setup per test: create page object and navigate
  test.beforeEach(async ({ page }) => {
    // no-op here; each test will instantiate DemoPage and call goto()
  });

  test('Initial Idle state: page renders and Run Optimization Demo button is present', async ({ page }) => {
    // This test validates the S0_Idle state per the FSM:
    // - renderPage() is expected to have run (page loaded)
    // - The Run Optimization Demo button exists and has the expected onclick attribute
    // - The demo output (#demoOutput) exists and is hidden (display: none)
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure page main heading exists (indicates page rendered)
    const heading = await page.$('h1');
    expect(heading).not.toBeNull();
    const headingText = await heading!.innerText();
    expect(headingText).toContain('Comprehensive Guide to Query Optimization');

    // Button should exist and have the expected onclick attribute
    const button = await demo.getRunButton();
    expect(button).not.toBeNull();
    const onclickAttr = await button!.getAttribute('onclick');
    expect(onclickAttr).toBe('runDemo()');

    // #demoOutput should exist and be hidden initially (matching FSM evidence: style display none)
    const demoOutput = await demo.getDemoOutput();
    expect(demoOutput).not.toBeNull();
    // Check inline style attribute or computed style
    const inlineStyle = await demoOutput!.getAttribute('style'); // may be null if style not set inline
    if (inlineStyle !== null) {
      // If style attribute exists on element, it should include display: none
      expect(inlineStyle.replace(/\s/g, '')).toContain('display:none');
    } else {
      // fallback to computed style
      const computedDisplay = await demoOutput!.evaluate((el) => window.getComputedStyle(el).display);
      expect(computedDisplay).toBe('none');
    }

    // Verify no uncaught page errors occurred during initial load
    const errors = demo.getCapturedPageErrors();
    expect(errors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoRunning: clicking the Run Optimization Demo button shows output and updates content', async ({ page }) => {
    // This test validates the RunDemo event and the transition to Demo Running state:
    // - Click the button (event)
    // - #demoOutput visually displayed (output.style.display === 'block' as per FSM evidence)
    // - #demoOutput content updated with demo HTML
    const demo = new DemoPage(page);
    await demo.goto();

    // Precondition: demoOutput hidden
    expect(await demo.isDemoOutputVisible()).toBe(false);

    // Trigger event: click the demo button
    await demo.clickRunDemo();

    // After clicking, demoOutput should be visible
    // The implementation sets inline style to 'block', so we check inline style if present
    const demoOutputEl = await demo.getDemoOutput();
    expect(demoOutputEl).not.toBeNull();

    const inlineDisplay = await demoOutputEl!.evaluate((el) => el.style.display);
    // inlineDisplay should be 'block' as per the implementation
    expect(inlineDisplay).toBe('block');

    // The demo output innerHTML should contain expected subsections/title from the template
    const html = await demo.getDemoOutputHTML();
    expect(html).toBeTruthy();
    expect(html!.toLowerCase()).toContain('query optimization demo results');
    expect(html!).toContain('Unoptimized Plan');
    expect(html!).toContain('Optimized Plan');
    expect(html!).toContain('Total estimated cost');

    // Validate that the DemoRunning state's entry action (runDemo) produced the visible output as evidence
    expect(await demo.isDemoOutputVisible()).toBe(true);

    // Check there are no uncaught ReferenceError/TypeError/SyntaxError captured
    const pageErrors = demo.getCapturedPageErrors();
    const jsExceptionTypes = pageErrors.map((e) => e.name);
    // Expect there were no exceptions during the interaction
    expect(jsExceptionTypes).not.toContain('ReferenceError');
    expect(jsExceptionTypes).not.toContain('TypeError');
    expect(jsExceptionTypes).not.toContain('SyntaxError');

    // Also ensure console did not log error-level messages during the click and rendering
    const consoleMsgs = demo.getCapturedConsoleMessages();
    const errorConsoleMsgs = consoleMsgs.filter((m) => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Idempotent behavior / repeated clicks: clicking Run Demo multiple times does not duplicate content', async ({ page }) => {
    // Edge case test: ensures clicking the demo button when output is already visible
    // behaves deterministically and does not append duplicate content (implementation overwrites innerHTML).
    const demo = new DemoPage(page);
    await demo.goto();

    // First click - show content
    await demo.clickRunDemo();
    expect(await demo.isDemoOutputVisible()).toBe(true);
    const firstHTML = await demo.getDemoOutputHTML();
    expect(firstHTML).toBeTruthy();

    // Rapid second click
    await demo.clickRunDemo();
    const secondHTML = await demo.getDemoOutputHTML();
    expect(secondHTML).toBeTruthy();

    // Since implementation sets innerHTML (overwrite), the content should be identical between clicks
    expect(secondHTML).toBe(firstHTML);

    // Rapid multiple clicks in quick succession
    await Promise.all([
      demo.page.click("button[onclick='runDemo()']"),
      demo.page.click("button[onclick='runDemo()']"),
      demo.page.click("button[onclick='runDemo()']"),
    ]);
    const afterMultiHTML = await demo.getDemoOutputHTML();
    expect(afterMultiHTML).toBe(firstHTML);

    // No unexpected page errors resulted from repeated interaction
    const pageErrors = demo.getCapturedPageErrors();
    expect(pageErrors.length).toBe(0);
  });

  test('FSM evidence validation: DOM changes correspond to described entry/exit actions', async ({ page }) => {
    // This test ties FSM's evidence strings to actual DOM changes:
    // - S0_Idle evidence: button[onclick='runDemo()'] exists
    // - S1_DemoRunning evidence: '#demoOutput is displayed' and '#demoOutput innerHTML updated'
    const demo = new DemoPage(page);
    await demo.goto();

    // Evidence for S0_Idle: the button HTML exists on page
    const buttonHandles = await page.$$("button[onclick='runDemo()']");
    expect(buttonHandles.length).toBeGreaterThanOrEqual(1);
    const buttonText = await buttonHandles[0].innerText();
    expect(buttonText).toContain('Run Optimization Demo');

    // Trigger transition
    await demo.clickRunDemo();

    // Evidence for S1_DemoRunning: style display is block
    const demoOutputEl = await demo.getDemoOutput();
    expect(demoOutputEl).not.toBeNull();
    const styleDisplay = await demoOutputEl!.evaluate((el) => el.style.display);
    expect(styleDisplay).toBe('block');

    // Evidence for S1_DemoRunning: innerHTML contains expected demo strings
    const content = await demo.getDemoOutputHTML();
    expect(content).toContain('Query Optimization Demo Results');

    // Confirm that the observed DOM changes match FSM expected observables
    // (If additional entry/exit actions were present, they would be asserted here.)
  });

  test('Edge case: clicking a non-existent selector should raise an error (error scenario)', async ({ page }) => {
    // This test intentionally attempts to click a missing element to assert Playwright throws,
    // demonstrating handling of an interaction error scenario.
    const demo = new DemoPage(page);
    await demo.goto();

    // Attempt to click a selector that does not exist. Playwright should reject the promise.
    // We expect an error to be thrown; do not attempt to patch page to create the element.
    await expect(page.click('button#this-element-does-not-exist', { timeout: 1000 })).rejects.toThrow();
  });

  test('Observe console and page errors over the full session lifecycle', async ({ page }) => {
    // This test attaches listeners from the start of navigation and makes several interactions,
    // then asserts the captured console and page errors conform to expectations.
    const demo = new DemoPage(page);
    await demo.goto();

    // Perform interactions: click the demo button then navigate around anchors that exist on the page
    await demo.clickRunDemo();

    // Click a couple of internal anchors if available (sanity interactions)
    // These should not produce errors; if anchor missing, skip gracefully
    const anchors = await page.$$('a');
    if (anchors.length > 0) {
      // click first anchor without waiting for navigation to ensure no errors thrown
      try {
        await anchors[0].click().catch(() => { /* ignore click failures on anchors */ });
      } catch (e) {
        // swallow - we do not modify page; only interested in captured errors
      }
    }

    // Collect captured diagnostics
    const pageErrors = demo.getCapturedPageErrors();
    const consoleMessages = demo.getCapturedConsoleMessages();

    // Assert no uncaught JS exceptions were recorded during normal usage
    // If any of the following types occurred, they would be concerning
    const problematic = pageErrors.filter((err) =>
      ['ReferenceError', 'TypeError', 'SyntaxError'].includes(err.name)
    );
    expect(problematic.length).toBe(0);

    // Assert console does not contain error messages
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // But assert that the page did emit at least some console or DOM activity during the session
    // (Either console logs or DOM updates like demo output). We expect the demo output has content.
    const demoContent = await demo.getDemoOutputHTML();
    expect(demoContent).toBeTruthy();
  });
});