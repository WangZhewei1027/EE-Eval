import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b3a884-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page object to encapsulate interactions and selectors for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator("button[onclick='showDemo()']");
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickRunDemo() {
    await this.runButton.click();
  }

  async isOutputVisible() {
    return await this.output.evaluate((el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none' && el.innerHTML.trim().length > 0;
    });
  }

  async getOutputText() {
    return await this.output.innerText();
  }

  async removeOutputElement() {
    await this.page.evaluate(() => {
      const el = document.getElementById('demoOutput');
      if (el) el.remove();
    });
  }
}

test.describe('Comprehensive Guide to NoSQL Databases - FSM tests', () => {
  // We'll capture console messages and page errors for assertions in tests
  test.beforeEach(async ({ page }) => {
    // Nothing to do here; individual tests will set up listeners before navigation
  });

  test('Idle state (S0_Idle) - initial render should show button and hidden demo output', async ({ page }) => {
    // Capture console messages and page errors during load
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Validate that the "Run Demonstration" button exists and is visible
    await expect(demo.runButton).toBeVisible();
    await expect(demo.runButton).toHaveText('Run Demonstration');

    // Validate initial state of demo output: should be present in DOM but hidden (display: none)
    const outputHandle = await page.$('#demoOutput');
    expect(outputHandle).not.toBeNull(); // element exists
    const display = await page.evaluate(() => {
      const el = document.getElementById('demoOutput');
      // If element exists, return computed display style
      return el ? window.getComputedStyle(el).display : null;
    });
    expect(display).toBe('none');

    // Verify that the showDemo function is defined on the window (so transition can be triggered)
    const showDemoDefined = await page.evaluate(() => typeof window.showDemo === 'function');
    expect(showDemoDefined).toBe(true);

    // Assert that there were no uncaught page errors during initial load
    expect(pageErrors.length).toBe(0);

    // Assert that there are no console error messages
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition RunDemonstration (S0_Idle -> S1_DemoRunning) - clicking button displays demo output', async ({ page }) => {
    // Collect console messages and page errors during interactions
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Click the Run Demonstration button and wait for output to be visible
    await demo.clickRunDemo();
    await expect(demo.output).toBeVisible();

    // Validate that the output contains expected content from the demo
    const outputText = await demo.getOutputText();
    // It should contain the header and JSON snippet for user1
    expect(outputText).toContain('Document Database Simulation');
    expect(outputText).toContain('"id": "user1"');
    expect(outputText).toContain('Query result for user with id \'user1\'');

    // Confirm that no uncaught page errors happened during normal demo run
    expect(pageErrors.length).toBe(0);

    // Also assert no console.error messages were emitted
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Idempotency and repeated clicks - demo remains visible and content is stable', async ({ page }) => {
    // Track console and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // First click
    await demo.clickRunDemo();
    await expect(demo.output).toBeVisible();
    const firstOutput = await demo.getOutputText();

    // Click again to ensure idempotent behavior (should not throw, should keep content meaningful)
    await demo.clickRunDemo();
    await expect(demo.output).toBeVisible();
    const secondOutput = await demo.getOutputText();

    // Content should remain present and contain the expected JSON; exact duplication handling is implementation-specific,
    // but ensure that expected pieces still present and no errors occurred.
    expect(secondOutput).toContain('"id": "user1"');
    expect(secondOutput).toContain('Document Database Simulation');

    // Ensure content did not become empty after repeated interaction
    expect(secondOutput.trim().length).toBeGreaterThan(0);

    // Ensure no page errors or console errors during repeated clicks
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: missing #demoOutput element leads to TypeError when showDemo runs (observe page error)', async ({ page }) => {
    // Prepare to capture pageerror triggered by clicking the button after removing the output element
    const demo = new DemoPage(page);
    await demo.goto();

    // Remove the demo output element from the DOM to simulate a broken DOM scenario
    await demo.removeOutputElement();

    // Wait for the pageerror event that should be triggered by showDemo trying to access the missing element
    const [pageError] = await Promise.all([
      page.waitForEvent('pageerror'),
      // Trigger the action that will attempt to access the removed element
      demo.clickRunDemo()
    ]);

    // The pageError should be a TypeError because showDemo attempts to access .style on null
    expect(pageError).toBeTruthy();
    // Many engines produce "TypeError" name for such errors
    expect(pageError.name).toBe('TypeError');

    // The message should indicate inability to read/set properties of null/undefined
    // Be permissive to different engine messages but ensure it references 'null' or 'undefined' or 'style'
    const messageLower = String(pageError.message).toLowerCase();
    const likelyIndicators = ['null', 'undefined', 'style', 'cannot', 'reading', 'setting'];
    const indicatorFound = likelyIndicators.some((ind) => messageLower.includes(ind));
    expect(indicatorFound).toBe(true);
  });

  test('Verify missing onEnter action renderPage results in ReferenceError when invoked directly', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // The FSM described an entry action renderPage() for S0_Idle, but the implementation does not define it.
    // Invoke renderPage() in page context and assert that it throws a ReferenceError-like message.
    // We use Playwright's expect(...).rejects to assert the evaluation fails with a message indicating renderPage is not defined.
    await expect(page.evaluate(() => {
      // Attempt to call the missing function - let the environment naturally throw
      return renderPage();
    })).rejects.toThrow(/renderPage is not defined|ReferenceError/);
  });

  test('Observe console logs across interactions and ensure meaningful diagnostics are available', async ({ page }) => {
    // Gather console messages for analysis
    const consoleMessages = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Trigger the demo to generate any console logs that may occur during normal operation
    await demo.clickRunDemo();
    await expect(demo.output).toBeVisible();

    // Ensure we captured console messages (may be zero if page does not log anything)
    // We assert that any console messages are strings and that there's no unhandled error-level messages
    for (const m of consoleMessages) {
      expect(typeof m.text).toBe('string');
    }
    const errorLevel = consoleMessages.find((m) => m.type === 'error');
    // Prefer no console.error during normal operation; if present, fail the test to surface unexpected diagnostics
    expect(errorLevel).toBeUndefined();
  });
});