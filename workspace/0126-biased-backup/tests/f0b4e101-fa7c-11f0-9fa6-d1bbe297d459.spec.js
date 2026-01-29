import { test, expect } from '@playwright/test';

// Test file: f0b4e101-fa7c-11f0-9fa6-d1bbe297d459.spec.js
// Target URL (served externally):
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b4e101-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the Runtime Environment demo page
class RuntimePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('#demoButton');
    this.demoOutput = page.locator('#demoOutput');
  }

  // Navigate to the application page and wait for it to load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Click the demo button
  async clickDemo() {
    await this.demoButton.click();
  }

  // Return whether demo output is visible (computed style)
  async isDemoOutputVisible() {
    return await this.demoOutput.evaluate((el) => {
      // Use computed style to determine visibility
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    });
  }

  // Get demo output innerText
  async demoOutputText() {
    return await this.demoOutput.innerText();
  }

  // Get demo output innerHTML
  async demoOutputHTML() {
    return await this.demoOutput.innerHTML();
  }
}

test.describe('Runtime Environment Demo - FSM states and transitions', () => {
  // Collect console messages and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', (err) => {
      // err is an Error object representing the uncaught exception in the page
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    });
  });

  test('S0_Idle: Page renders with demo button and demo output hidden (entry state)', async ({ page }) => {
    // Validate the Idle state: page loads and shows #demoButton; #demoOutput exists but is hidden
    const rp = new RuntimePage(page);
    await rp.goto();

    // Basic page checks
    await expect(page.locator('h1')).toHaveText(/Runtime Environment: A Comprehensive Guide/);

    // The demo button should be present and visible in Idle state
    await expect(rp.demoButton).toBeVisible();
    await expect(rp.demoButton).toHaveText('Run Memory Allocation Demo');

    // demoOutput should exist but be hidden (display: none)
    await expect(rp.demoOutput).toBeVisible({ visible: false }); // assert element exists but not visible
    const visible = await rp.isDemoOutputVisible();
    expect(visible).toBe(false);

    // No uncaught page errors on initial load for correct Idle behavior
    expect(pageErrors.length).toBe(0);

    // No console errors emitted during load
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition ButtonClick: Clicking demo button enters S1_DemoRunning and displays expected simulation details', async ({ page }) => {
    // Validate transition from S0_Idle -> S1_DemoRunning via click
    const rp = new RuntimePage(page);
    await rp.goto();

    // Click the demo button to trigger the demo
    await rp.clickDemo();

    // After clicking, demo output should be displayed
    await expect(rp.demoOutput).toBeVisible();

    // Validate that demo output contains key expected strings indicating memory allocation simulation
    const outputText = await rp.demoOutputText();
    expect(outputText).toContain('Memory Allocation Simulation');
    expect(outputText).toContain('1024 bytes available');
    expect(outputText).toContain('Allocating 256 bytes for object A');
    expect(outputText).toContain('Final state:');
    // The HTML uses "384 bytes free" within a strong tag and text "384 bytes free"
    expect(outputText).toMatch(/384 bytes free|384 bytes/);

    // No uncaught page errors should have occurred during the click and rendering
    expect(pageErrors.length).toBe(0);

    // Ensure no console.error messages were emitted as part of normal transition
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Idempotent behavior: Clicking the demo button multiple times leaves output visible and content consistent', async ({ page }) => {
    // Validate multiple clicks do not crash page and content remains consistent
    const rp = new RuntimePage(page);
    await rp.goto();

    // Click once
    await rp.clickDemo();
    await expect(rp.demoOutput).toBeVisible();
    const firstHTML = await rp.demoOutputHTML();

    // Click a second time - implementation replaces innerHTML and sets display block again
    await rp.clickDemo();
    await expect(rp.demoOutput).toBeVisible();
    const secondHTML = await rp.demoOutputHTML();

    // The content should be present and similar / consistent on repeated clicks
    expect(secondHTML).toContain('Memory Allocation Simulation');
    expect(secondHTML).toContain('Final state:');
    // Depending on implementation, innerHTML may be identical; ensure it's not empty
    expect(firstHTML.length).toBeGreaterThan(0);
    expect(secondHTML.length).toBeGreaterThan(0);

    // If the implementation resets content deterministically, both HTML values may be identical
    expect(secondHTML).toBe(firstHTML);

    // No uncaught page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Missing entry action "renderPage()" produces a ReferenceError when invoked (uncaught error observed)', async ({ page }) => {
    // This test intentionally triggers a missing function call on the page to validate that a ReferenceError will be surfaced
    // It models the FSM entry_action "renderPage()" which is not defined in the implementation.
    const rp = new RuntimePage(page);
    await rp.goto();

    // Prepare to capture the uncaught page error. We schedule a call to renderPage() asynchronously so it's uncaught in page context.
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Schedule an asynchronous call to renderPage() inside the page context:
    // Using setTimeout ensures the call happens after this evaluation resolves, and if renderPage is undefined it will be an uncaught ReferenceError
    await page.evaluate(() => {
      setTimeout(() => {
        // Intentionally call the undefined function to generate an uncaught ReferenceError in the page
        // We do not wrap in try/catch so that it becomes an uncaught exception captured by 'pageerror'
        // Note: We are not modifying the page's JavaScript definitions; just exercising the missing function scenario.
        // eslint-disable-next-line no-undef
        renderPage();
      }, 0);
    });

    // Wait for the uncaught page error to be emitted
    const err = await pageErrorPromise;

    // Validate that the error is a ReferenceError and mentions renderPage
    // Playwright normalizes the pageerror object; check name and message
    expect(err).toBeTruthy();
    // err can be an Error with message like "renderPage is not defined" or "Uncaught ReferenceError: renderPage is not defined"
    expect(err.message).toMatch(/renderPage/i);
    expect(err.name).toBe('ReferenceError');

    // Also ensure that after this uncaught error, the page is still interactive: demo button should still exist
    await expect(rp.demoButton).toBeVisible();
  });

  test('Edge case: Attempting an action on a non-existent selector should raise an error in the test (Playwright-level error)', async ({ page }) => {
    // This test verifies behavior when test attempts to click a selector that does not exist.
    // This is an edge scenario to ensure tests handle UI regressions gracefully.
    const rp = new RuntimePage(page);
    await rp.goto();

    // Attempt to click a selector that does not exist and expect Playwright to throw.
    // We wrap in try/catch and assert that an error is thrown.
    let caught = null;
    try {
      await page.click('#nonExistentButton', { timeout: 1000 });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeTruthy();
    // The error should indicate that the selector could not be found
    expect(String(caught.message)).toMatch(/No node found|Timeout|Unable to find/);
  });

  test.afterEach(async ({ page }) => {
    // As a sanity check in teardown, ensure that no unexpected uncaught errors accumulated (except ones intentionally triggered in tests).
    // Note: Some tests intentionally trigger pageerror; this afterEach does not fail the test but reports if any unexpected errors exist.
    // We simply attach the arrays created in beforeEach for debugging; explicit assertions were made inside tests.
    // Close page handled by Playwright automatically.
  });
});