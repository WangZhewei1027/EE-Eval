import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b248f0-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object Model for the Binary Search Demo page
class BinarySearchDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '#demo-button';
    this.outputSelector = '#demo-output';
  }

  async goto() {
    // Navigate to the application and wait for DOM to be ready.
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getButton() {
    return this.page.locator(this.buttonSelector);
  }

  async getOutput() {
    return this.page.locator(this.outputSelector);
  }

  async clickRunDemo() {
    await this.page.click(this.buttonSelector);
  }

  async outputIsVisible() {
    return await this.getOutput().isVisible();
  }

  async outputTextContent() {
    return await this.page.locator(this.outputSelector).innerText();
  }
}

test.describe('Comprehensive Guide to Binary Search - FSM and UI validation', () => {
  // Arrays to capture console messages and page errors emitted during tests
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', error => {
      // Collect the Error object for later assertions
      pageErrors.push(error);
    });
  });

  test.afterEach(async () => {
    // No teardown required beyond Playwright's fixtures,
    // but we keep this hook for symmetry and potential future cleanup.
  });

  test.describe('State S0_Idle (Initial Render)', () => {
    test('Idle state: page renders with Run Binary Search Demo button and hidden output', async ({ page }) => {
      // This test validates the Idle state as defined in the FSM:
      // - The "Run Binary Search Demo" button is present
      // - The demo output element exists and is initially hidden (display: none)
      const demo = new BinarySearchDemoPage(page);
      await demo.goto();

      // Assert the button exists and has expected text
      const button = await demo.getButton();
      await expect(button).toBeVisible();
      await expect(button).toHaveText('Run Binary Search Demo');

      // Assert the output DIV exists but is hidden initially
      const output = await demo.getOutput();
      // Use isVisible to check that display:none results in not visible
      await expect(output).not.toBeVisible();

      // Validate that there were no console.error messages emitted during initial load
      // (This checks for obvious runtime problems during initial render)
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      // Validate pageErrors are either absent or of allowed error types (vacuously true if none)
      const allowedNames = ['ReferenceError', 'TypeError', 'SyntaxError'];
      expect(pageErrors.every(e => allowedNames.includes(e.name))).toBe(true);
    });
  });

  test.describe('Transition RunDemo -> State S1_DemoRunning', () => {
    test('Clicking Run Demo transitions to Demo Running state and shows initial output', async ({ page }) => {
      // This test validates the transition: clicking the button causes the demo output
      // to become visible and contain the initial "Running binary search" message immediately.
      const demo = new BinarySearchDemoPage(page);
      await demo.goto();

      // Ensure initial hidden state
      await expect(demo.getOutput()).not.toBeVisible();

      // Click the demo button to trigger the RunDemo event
      await demo.clickRunDemo();

      // After clicking, output should be visible immediately
      await expect(demo.getOutput()).toBeVisible();

      // Check the initial message is present immediately after click
      const initialText = await demo.outputTextContent();
      expect(initialText).toContain('Running binary search on array: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91] searching for 23');

      // Ensure no console.error messages occurred as a direct result of the click
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);

      // Assert pageErrors (if any) are allowed JS error types
      const allowedNames = ['ReferenceError', 'TypeError', 'SyntaxError'];
      expect(pageErrors.every(e => allowedNames.includes(e.name))).toBe(true);
    });

    test('Demo Running: asynchronous steps appear and completion message is appended', async ({ page }) => {
      // This test verifies that the simulated delayed steps are appended over time
      // and that the final completion message is added.
      const demo = new BinarySearchDemoPage(page);
      await demo.goto();

      // Click to start the demo
      await demo.clickRunDemo();

      // The page schedules three step messages at ~1s, ~2s, ~3s after start.
      // Wait for the final completion message to appear with a reasonable timeout.
      await page.waitForSelector('#demo-output :text("Binary search completed successfully!")', { timeout: 6000 });

      // Verify the content includes all expected step snippets
      const content = await demo.outputTextContent();
      expect(content).toContain('Step 1: Left=0 (2), Right=9 (91), Middle=4 (16) → 23 > 16, search right half');
      expect(content).toContain('Step 2: Left=5 (23), Right=9 (91), Middle=7 (56) → 23 < 56, search left half');
      expect(content).toContain('Step 3: Left=5 (23), Right=6 (38), Middle=5 (23) → Found at index 5!');
      expect(content).toContain('Binary search completed successfully!');

      // Ensure that the output remains visible after completion
      await expect(demo.getOutput()).toBeVisible();

      // Verify that no unexpected console errors surfaced during the asynchronous steps
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);

      // Verify pageErrors, if any, are of permitted JS error types
      const allowedNames = ['ReferenceError', 'TypeError', 'SyntaxError'];
      expect(pageErrors.every(e => allowedNames.includes(e.name))).toBe(true);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Clicking the demo button multiple times does not produce uncaught errors and results in completion message', async ({ page }) => {
      // This test checks for potential race conditions or repeated-timer issues:
      // - Clicking multiple times in quick succession should still lead to at least one successful completion message
      // - No uncaught console errors should be emitted
      const demo = new BinarySearchDemoPage(page);
      await demo.goto();

      // Click the button twice quickly to simulate a user racing the demo
      await demo.clickRunDemo();
      // Small pause but intentionally short to press again quickly
      await page.waitForTimeout(100);
      await demo.clickRunDemo();

      // Wait for any of the completion messages appended by the scheduled timeouts
      await page.waitForSelector('#demo-output :text("Binary search completed successfully!")', { timeout: 7000 });

      // Check the number of occurrences of the completion phrase (should be >= 1)
      const content = await demo.outputTextContent();
      const occurrences = content.split('Binary search completed successfully!').length - 1;
      expect(occurrences).toBeGreaterThanOrEqual(1);

      // Confirm no console.error messages occurred
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);

      // Confirm pageErrors (if any) are restricted to known JS error classes
      const allowedNames = ['ReferenceError', 'TypeError', 'SyntaxError'];
      expect(pageErrors.every(e => allowedNames.includes(e.name))).toBe(true);
    });

    test('State entry/exit expectations: initial render implies renderPage behavior; starting demo implies startDemo behavior', async ({ page }) => {
      // This test verifies the implied entry-actions described in the FSM:
      // - renderPage() is represented by the initial presence of UI components (button and output container)
      // - startDemo() is represented by showing the output and starting asynchronous step logs
      const demo = new BinarySearchDemoPage(page);
      await demo.goto();

      // Implied renderPage() check: UI components exist
      await expect(demo.getButton()).toBeVisible();
      await expect(demo.getOutput()).not.toBeVisible();

      // Implied startDemo() check: clicking triggers the visible output and step scheduling
      await demo.clickRunDemo();
      await expect(demo.getOutput()).toBeVisible();
      // initial message present
      const initialText = await demo.outputTextContent();
      expect(initialText).toContain('Running binary search on array');

      // Wait for demo completion message to validate that scheduled steps ran
      await page.waitForSelector('#demo-output :text("Binary search completed successfully!")', { timeout: 6000 });

      // There is no explicit stopDemo() implemented in the provided code; ensure that absence does not cause errors
      // Confirm no console.error messages and allowed pageErrors only
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      const allowedNames = ['ReferenceError', 'TypeError', 'SyntaxError'];
      expect(pageErrors.every(e => allowedNames.includes(e.name))).toBe(true);
    });

    test('No unexpected console errors or uncaught exceptions on initial load and interaction', async ({ page }) => {
      // This test aggregates console and page error checks across a fresh load and a full demo run
      const demo = new BinarySearchDemoPage(page);
      await demo.goto();

      // Interact with the page
      await demo.clickRunDemo();
      // Wait for completion
      await page.waitForSelector('#demo-output :text("Binary search completed successfully!")', { timeout: 6000 });

      // Assert no console.error messages were emitted at any time
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);

      // If any page errors were emitted, they must be known JS error types (ReferenceError/TypeError/SyntaxError).
      // This assertion allows such errors to surface naturally (per instruction) but restricts unexpected error classes.
      const allowedNames = ['ReferenceError', 'TypeError', 'SyntaxError'];
      expect(pageErrors.every(e => allowedNames.includes(e.name))).toBe(true);
    });
  });
});