import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25c8a300-fa7c-11f0-ba20-415c525382ea.html';

// Page object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('#demo-button');
    this.demoArea = page.locator('#demo-area');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickDemoButton() {
    await this.demoButton.click();
  }

  async getDemoText() {
    return (await this.demoArea.textContent()) || '';
  }

  async countStepsInDemo() {
    const text = await this.getDemoText();
    const matches = text.match(/Step \d+/g);
    return matches ? matches.length : 0;
  }

  async waitForTraversalStart(timeout = 2000) {
    // Wait for the demo-area to show the first step line
    await this.page.waitForFunction(() => {
      const el = document.getElementById('demo-area');
      return el && /Step 1/.test(el.textContent || '');
    }, {}, { timeout });
  }
}

test.describe('Circular Linked List Demo - FSM tests', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let consoleMessages = [];

  // Create a fresh page for each test and capture console/page errors
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions from the page (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });
  });

  test.afterEach(async ({ page }) => {
    // Ensure the page is closed after each test to avoid cross-test leakage
    await page.close();
  });

  test.describe('State S0_Idle (Initial)', () => {
    test('renders initial Idle state with demo button and empty demo area', async ({ page }) => {
      // This test validates the initial/Idle state: the button exists and demo area is empty.
      const demo = new DemoPage(page);
      await demo.goto();

      // The demo button should be visible and have the expected label
      await expect(demo.demoButton).toBeVisible();
      await expect(demo.demoButton).toHaveText('Show Traversal Demo');

      // The demo area should exist, have expected ARIA attributes, and be empty initially
      await expect(demo.demoArea).toBeVisible();
      await expect(demo.demoArea).toHaveAttribute('aria-live', 'polite');
      await expect(demo.demoArea).toHaveAttribute('aria-atomic', 'true');
      await expect(demo.demoArea).toHaveAttribute('role', 'region');

      const initialText = await demo.getDemoText();
      expect(initialText.trim()).toBe('', 'Expected demo area to be empty in Idle state');

      // Assert no uncaught page exceptions (ReferenceError/SyntaxError/TypeError) occurred on load
      // This asserts that the page loaded cleanly. If there are JS runtime errors they will be captured.
      expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
      // Also assert no console.error messages were emitted
      expect(consoleErrors.length, `Console error messages: ${consoleErrors.join(' | ')}`).toBe(0);
    });
  });

  test.describe('State S1_Traversing (After ShowTraversalDemo)', () => {
    test('clicking demo button transitions to Traversing and prints 10 steps', async ({ page }) => {
      // This test validates the transition from Idle -> Traversing on clicking the demo button.
      const demo = new DemoPage(page);
      await demo.goto();

      // Click the button to trigger traversal
      await demo.clickDemoButton();

      // Wait for the traversal to start and verify content updates
      await demo.waitForTraversalStart();

      const text = await demo.getDemoText();

      // Verify entry action's visible change: beginning of traversal message present
      expect(text).toContain('Traversing circular linked list...', 'Expected traversal header text to be present');

      // Verify expected observable: the demo area contains 'Step' lines and exactly 10 steps
      const stepMatches = text.match(/Step \d+: Node ID \d+ with data = \d+/g) || [];
      expect(stepMatches.length, 'Expected exactly 10 Step lines in traversal output').toBe(10);

      // Verify first and last step content correctness (Step 1 and Step 10)
      expect(text).toContain('Step 1: Node ID 1 with data = 10');
      expect(text).toContain('Step 10: Node ID 5 with data = 50');

      // Verify the button remains present and usable after transition
      await expect(demo.demoButton).toBeVisible();
      await expect(demo.demoButton).toBeEnabled();

      // Ensure no runtime errors were thrown during traversal
      expect(pageErrors.length, `Page errors occurred during traversal: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `Console errors during traversal: ${consoleErrors.join(' | ')}`).toBe(0);
    });

    test('clicking the demo button multiple times resets demo area each time (no cumulative duplication)', async ({ page }) => {
      // This test validates repeated transitions: clicking the button again resets the demo textContent as per implementation.
      const demo = new DemoPage(page);
      await demo.goto();

      // First click
      await demo.clickDemoButton();
      await demo.waitForTraversalStart();
      const firstText = await demo.getDemoText();
      const firstCount = (firstText.match(/Step \d+/g) || []).length;
      expect(firstCount).toBe(10);

      // Second click should reset the demo area content and produce a fresh traversal (not append)
      await demo.clickDemoButton();
      await demo.waitForTraversalStart();
      const secondText = await demo.getDemoText();
      const secondCount = (secondText.match(/Step \d+/g) || []).length;
      expect(secondCount).toBe(10);

      // The new content should be structurally identical to the first traversal (same header present)
      expect(secondText).toContain('Traversing circular linked list...');
      expect(secondText).toContain('Step 1: Node ID 1 with data = 10');

      // They may be identical strings; at minimum ensure second click did not cause duplication beyond 10 steps
      // If the implementation appended instead of resetting, we'd see >10 steps which this asserts against.
      expect(secondCount).toBeLessThanOrEqual(10);

      // Ensure no page errors or console errors occurred across repeated interactions
      expect(pageErrors.length, `Page errors occurred during repeated clicks: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `Console errors during repeated clicks: ${consoleErrors.join(' | ')}`).toBe(0);
    });

    test('rapid multiple clicks do not crash the page and final output is consistent', async ({ page }) => {
      // This test simulates a burst of clicks to validate robustness (edge case)
      const demo = new DemoPage(page);
      await demo.goto();

      // Rapidly click the button 5 times
      // Using Promise.all to issue clicks without waiting for each traversal to finish
      const clickCount = 5;
      for (let i = 0; i < clickCount; i++) {
        // click and short delay to simulate rapid but not simultaneous user clicks
        await demo.clickDemoButton();
      }

      // Wait up to 2s for traversal to appear (final result should be present)
      await demo.waitForTraversalStart(3000);

      const finalText = await demo.getDemoText();
      const finalSteps = (finalText.match(/Step \d+/g) || []).length;

      // Implementation resets textContent at start of each click; final output should contain 10 steps (the result of the last click)
      expect(finalSteps).toBe(10);

      // Check header is present
      expect(finalText.startsWith('Traversing circular linked list...')).toBeTruthy();

      // Confirm no runtime page errors or console.error messages captured
      expect(pageErrors.length, `Page errors after rapid clicks: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `Console errors after rapid clicks: ${consoleErrors.join(' | ')}`).toBe(0);
    });
  });

  test.describe('Accessibility and component contract checks', () => {
    test('button is focusable and has accessible name; demo region has role and is live', async ({ page }) => {
      // Verifies component attributes and accessibility-related expectations
      const demo = new DemoPage(page);
      await demo.goto();

      // Button should be in tab order and have accessible name
      await demo.demoButton.focus();
      const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
      expect(focused).toBe('demo-button');

      // ARIA attributes on demo-area are already validated elsewhere; we re-assert presence here
      await expect(demo.demoArea).toHaveAttribute('role', 'region');
      await expect(demo.demoArea).toHaveAttribute('aria-live', 'polite');

      // No console errors on accessibility checks
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Runtime error observation (observability tests)', () => {
    test('no uncaught ReferenceError, SyntaxError, or TypeError occurred while interacting with the demo', async ({ page }) => {
      // This test explicitly observes console and page errors and asserts none of the critical error types occurred.
      const demo = new DemoPage(page);
      await demo.goto();

      // Attach fresh collectors (already attached in beforeEach). Interact with page to exercise code paths.
      await demo.clickDemoButton();
      await demo.waitForTraversalStart();

      // Aggregate text of console errors for diagnostics if needed
      const allConsoleErrorText = consoleErrors.join(' | ');

      // Assert no uncaught page errors at runtime
      // If any ReferenceError/TypeError/SyntaxError occurred, they'd be captured in pageErrors
      const hasCriticalPageErrors = pageErrors.some(err => {
        const msg = String(err && err.message || '');
        return /ReferenceError|TypeError|SyntaxError/.test(msg);
      });
      expect(hasCriticalPageErrors, `Expected no ReferenceError/TypeError/SyntaxError but found: ${pageErrors.map(e => e.message).join('; ')}`).toBe(false);

      // Also ensure console.error messages don't include these critical JS error names
      const consoleHasCritical = consoleErrors.some(text => /ReferenceError|TypeError|SyntaxError/.test(text));
      expect(consoleHasCritical, `Console errors include critical errors: ${allConsoleErrorText}`).toBe(false);

      // Final sanity: ensure pageErrors and consoleErrors arrays are empty
      expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `Unexpected console.error messages: ${allConsoleErrorText}`).toBe(0);
    });
  });
});