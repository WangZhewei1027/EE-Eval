import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b1d3c1-fa7c-11f0-9fa6-d1bbe297d459.html';

/**
 * Simple Page Object for the demo page.
 * Encapsulates common interactions and queries so tests read clearly.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('.demo-btn');
    this.output = page.locator('#demo-output');
    this.demoText = page.locator('#demo-text');
    this.demoPattern = page.locator('#demo-pattern');
    this.demoResult = page.locator('#demo-result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRun() {
    await this.runButton.click();
  }

  async isOutputVisible() {
    return await this.output.isVisible();
  }

  async getOutputDisplayStyle() {
    return await this.output.evaluate((el) => getComputedStyle(el).display);
  }

  async getTextContent() {
    return {
      text: (await this.demoText.textContent())?.trim() ?? '',
      pattern: (await this.demoPattern.textContent())?.trim() ?? '',
      result: (await this.demoResult.textContent())?.trim() ?? ''
    };
  }
}

test.describe('FSM: Comprehensive Guide to Suffix Trees - Demo (f0b1d3c1...)', () => {
  // Arrays to capture console messages and unhandled page errors per test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Attach listeners to observe console logs and page errors (do not modify environment)
    page.on('console', (msg) => {
      try {
        // store minimal info to assert later
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // noop - do not interfere with the page
      }
    });

    page.on('pageerror', (err) => {
      // Collect unhandled exceptions from the page
      pageErrors.push(err);
    });
  });

  test('Initial Idle state: Run Demo button is visible and demo output is hidden', async ({ page }) => {
    // This test validates the S0_Idle state from the FSM:
    // - the .demo-btn exists (evidence for Idle)
    // - #demo-output is hidden (display: none)
    const demo = new DemoPage(page);
    await demo.goto();

    // Verify the Run Demo button is visible and enabled
    await expect(demo.runButton).toBeVisible();
    await expect(demo.runButton).toBeEnabled();
    await expect(demo.runButton).toHaveText('Run Demo');

    // Verify the demo output is initially hidden (Idle state's evidence)
    const isVisible = await demo.isOutputVisible();
    expect(isVisible).toBe(false);

    const displayStyle = await demo.getOutputDisplayStyle();
    expect(displayStyle).toBe('none');

    // Ensure the demo result placeholders are initially empty
    const { text, pattern, result } = await demo.getTextContent();
    expect(text).toBe('');
    expect(pattern).toBe('');
    expect(result).toBe('');

    // Ensure no uncaught page errors occurred while loading the Idle state
    expect(pageErrors.length).toBe(0);
    // Ensure no console.error messages were emitted during initial load
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('Transition RunDemo: clicking Run Demo displays output and shows correct results', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_DemoRunning:
    // - clicking the .demo-btn triggers runDemo()
    // - #demo-output becomes visible
    // - demo-text, demo-pattern and demo-result contain expected values (evidence)
    const demo = new DemoPage(page);
    await demo.goto();

    // Click the button to trigger runDemo()
    await demo.clickRun();

    // Wait for the demo output to become visible (expected observable)
    await expect(demo.output).toBeVisible();

    // Verify the style is updated to 'block' as per implementation
    const displayStyle = await demo.getOutputDisplayStyle();
    expect(displayStyle).toBe('block');

    // Verify the textual results match the demo implementation:
    // - Text: "banana"
    // - Pattern: "ana"
    // - Result: "Pattern found at position(s): 2, 4 (1-based indexing)"
    const contents = await demo.getTextContent();
    expect(contents.text).toBe('Text: "banana"');
    expect(contents.pattern).toBe('Pattern: "ana"');
    expect(contents.result).toBe('Pattern found at position(s): 2, 4 (1-based indexing)');

    // Check DOM evidence that indicates the demo ran (presence and visibility of output)
    expect(await demo.output.count()).toBe(1);

    // Ensure no unhandled page errors were emitted as a result of running the demo
    expect(pageErrors.length).toBe(0);
    // Ensure no console.error messages were emitted during demo run
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('Idempotency: clicking Run Demo multiple times preserves expected output and causes no errors', async ({ page }) => {
    // This test checks edge behavior when the Run Demo button is clicked repeatedly.
    const demo = new DemoPage(page);
    await demo.goto();

    // Click multiple times
    await demo.clickRun();
    await demo.clickRun();
    await demo.clickRun();

    // Output should remain visible with the same expected content
    await expect(demo.output).toBeVisible();
    const contents = await demo.getTextContent();
    expect(contents.text).toBe('Text: "banana"');
    expect(contents.pattern).toBe('Pattern: "ana"');
    expect(contents.result).toBe('Pattern found at position(s): 2, 4 (1-based indexing)');

    // No unexpected page errors or console.error messages after multiple clicks
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('Reloading resets to Idle: demo output hidden again after page reload', async ({ page }) => {
    // This test verifies that the Idle state is the initial render and is restored after reload.
    const demo = new DemoPage(page);
    await demo.goto();

    // Trigger demo then reload and verify reset
    await demo.clickRun();
    await expect(demo.output).toBeVisible();

    await page.reload();
    // After reload, the demo should be back to Idle: output hidden and button visible
    await expect(demo.runButton).toBeVisible();
    await expect(demo.output).not.toBeVisible();

    const displayStyle = await demo.getOutputDisplayStyle();
    expect(displayStyle).toBe('none');

    // Again ensure no page errors during reload sequence
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('Scope isolation: occurrences is not globally accessible (ReferenceError when accessed directly)', async ({ page }) => {
    // The implementation declares `const occurrences = [1, 3];` inside runDemo().
    // This test tries to access occurrences directly from the page global scope to validate scoping.
    // Attempting to reference an undeclared block-scoped identifier should raise a ReferenceError in the page context.
    const demo = new DemoPage(page);
    await demo.goto();

    // Click to ensure runDemo() executed (but occurrences is block-scoped inside the function)
    await demo.clickRun();
    await expect(demo.output).toBeVisible();

    // Try to directly access the identifier `occurrences` from the page context.
    // This should result in a ReferenceError (JS runtime) which Playwright will surface as a rejection.
    let caught = null;
    try {
      // This evaluation attempts to directly read `occurrences` (not using typeof),
      // which should throw a ReferenceError because it is not a global variable.
      await page.evaluate(() => occurrences);
    } catch (err) {
      caught = err;
    }

    // Assert that an error was thrown and it indicates a ReferenceError or "is not defined".
    expect(caught).not.toBeNull();
    // Different browsers/environments may phrase the error differently; check for common substrings.
    const msg = (caught && caught.message) ? caught.message : '';
    expect(
      msg.includes('is not defined') ||
      msg.toLowerCase().includes('referenceerror') ||
      msg.toLowerCase().includes('occurrences')
    ).toBeTruthy();

    // Also ensure no pageerror events were added beyond the expected caught ReferenceError:
    // Note: page.evaluate rejections are surfaced to the test, not necessarily as pageerror events.
    expect(pageErrors.length).toBe(0);
  });

  test('Console & pageerror observation: capture console messages and page errors while interacting', async ({ page }) => {
    // This test demonstrates observation of console messages and page errors.
    // It does not attempt to alter page runtime; it asserts that no uncaught errors were emitted for normal usage.
    const demo = new DemoPage(page);
    await demo.goto();

    // Perform actions that exercise the page
    await demo.clickRun();

    // Wait a short while to allow any asynchronous console messages or errors to surface
    await page.waitForTimeout(200);

    // Assert we captured console messages (there may be informational logs) but no console.error
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);

    // Assert there are no unhandled page errors
    expect(pageErrors.length).toBe(0);

    // For completeness, verify that we have at least a few console messages or DOM interactions (non-strict)
    expect(await demo.output.isVisible()).toBe(true);
  });
});