import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b3a882-fa7c-11f0-9fa6-d1bbe297d459.html';

/**
 * Page object model for the Relational Database Explained demo page.
 * Encapsulates frequently used selectors and interactions.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleButton = page.locator("button[onclick='showDemo()']");
    this.demoResult = page.locator('#demoResult');
  }

  // Navigate to the page and wait for load event
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the toggle button
  async clickToggle() {
    await this.toggleButton.click();
  }

  // Invoke the showDemo function directly in page context
  async invokeShowDemoDirectly() {
    await this.page.evaluate(() => {
      // Calling the page's function directly
      // This will naturally throw if showDemo is not defined (which we will observe)
      // We do not catch or patch it here per instructions.
      return showDemo();
    });
  }

  // Get the computed display style of the demo result element
  async getComputedDisplay() {
    return await this.demoResult.evaluate((el) => window.getComputedStyle(el).display);
  }

  // Check whether demo is visible (computed style not 'none')
  async isDemoVisible() {
    const display = await this.getComputedDisplay();
    return display !== 'none';
  }

  // Get inline style attribute value
  async getInlineStyle() {
    return await this.demoResult.getAttribute('style');
  }

  // Get inner text snippet for quick content assertions
  async getDemoText() {
    return await this.demoResult.innerText();
  }
}

test.describe('Relational Database Explained - FSM and UI integration tests', () => {
  // Collect console messages and page errors for each test run.
  // We assert at the end of each test suite run whether there were unexpected errors.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events and store them for assertions.
    page.on('console', (msg) => {
      // Record the whole console message and its type for inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen to uncaught exceptions from the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // Store the Error object for later assertions (stack, message available)
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test, assert that there were no uncaught page errors.
    // The FSM/implementation is expected to work; we assert there are no pageerrors.
    // This verifies that no ReferenceError / TypeError / SyntaxError occurred during interactions.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

    // Also ensure no console messages of type 'error' were produced.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors found: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test.describe('Initial state (S0_Idle) validations', () => {
    test('renders page with toggle button present and demo hidden (entry action renderPage)', async ({ page }) => {
      // This test validates:
      // - The page loads.
      // - The "Show SQL Join Example" button exists.
      // - The demo result element exists and is hidden by default (style display: none).
      const demo = new DemoPage(page);
      await demo.goto();

      // Verify the toggle button is visible and has expected text
      await expect(demo.toggleButton).toBeVisible();
      await expect(demo.toggleButton).toHaveText('Show SQL Join Example');

      // The demoResult element should exist
      await expect(demo.demoResult).toBeAttached();

      // Inline style attribute should indicate 'display: none;' per HTML initial attribute
      const inlineStyle = await demo.getInlineStyle();
      // It may be exactly "display: none;" or null if CSS handled it; ensure computed style is none
      const computed = await demo.getComputedDisplay();
      expect(computed).toBe('none');

      // Confirm inline style is either explicitly 'display: none;' or absent (null)
      expect(['display: none;', null, 'display:none;']).toContain(inlineStyle);
    });
  });

  test.describe('Transitions triggered by ShowDemo event (button click)', () => {
    test('S0_Idle -> S1_DemoVisible: clicking button displays #demoResult', async ({ page }) => {
      // Validates the first transition: clicking the button when demo is hidden shows it
      const demo = new DemoPage(page);
      await demo.goto();

      // Precondition: demo is hidden
      expect(await demo.isDemoVisible()).toBe(false);

      // Click to show
      await demo.clickToggle();

      // After clicking, demo should be visible (entry action showDemo effect)
      expect(await demo.isDemoVisible()).toBe(true);

      // Check that the demo contains the SQL query snippet and the result table (basic content checks)
      const demoText = await demo.getDemoText();
      expect(demoText).toContain('SELECT Customers.Name, Orders.OrderID, Orders.OrderDate');
      expect(demoText).toContain('John Smith');
      expect(demoText).toContain('Jane Doe');
    });

    test('S1_DemoVisible -> S2_DemoHidden: clicking again hides #demoResult', async ({ page }) => {
      // Validates that clicking while visible hides the demo (toggle behavior)
      const demo = new DemoPage(page);
      await demo.goto();

      // Ensure visible by clicking once
      await demo.clickToggle();
      expect(await demo.isDemoVisible()).toBe(true);

      // Click again to hide
      await demo.clickToggle();
      expect(await demo.isDemoVisible()).toBe(false);

      // Confirm the computed display is 'none'
      const computed = await demo.getComputedDisplay();
      expect(computed).toBe('none');
    });

    test('S2_DemoHidden -> S1_DemoVisible: multiple toggles alternate visibility predictably', async ({ page }) => {
      // Validates repeated toggling cycles: odd clicks => visible, even clicks => hidden
      const demo = new DemoPage(page);
      await demo.goto();

      // Ensure starting hidden
      expect(await demo.isDemoVisible()).toBe(false);

      // Perform 5 rapid toggles and assert state after each
      for (let i = 1; i <= 5; i++) {
        await demo.clickToggle();
        const visible = await demo.isDemoVisible();
        const expected = (i % 2) === 1; // odd -> visible
        expect(visible).toBe(expected);
      }
    });

    test('Direct invocation of showDemo() in page context toggles demo visibility (eventless invocation)', async ({ page }) => {
      // Some FSM entry actions mention showDemo(). This test invokes the function directly
      // to ensure it's exposed on the window and behaves identically to clicking the button.
      const demo = new DemoPage(page);
      await demo.goto();

      // Ensure hidden initially
      expect(await demo.isDemoVisible()).toBe(false);

      // Call showDemo directly
      await demo.invokeShowDemoDirectly();
      expect(await demo.isDemoVisible()).toBe(true);

      // Call again
      await demo.invokeShowDemoDirectly();
      expect(await demo.isDemoVisible()).toBe(false);
    });
  });

  test.describe('Edge cases and robustness checks', () => {
    test('Clicking the toggle button many times does not produce runtime errors', async ({ page }) => {
      // Rapidly click the toggle many times and ensure no page errors are emitted.
      const demo = new DemoPage(page);
      await demo.goto();

      // Rapid clicks
      for (let i = 0; i < 30; i++) {
        // Use Promise.all to avoid waiting long; still sequential clicks are fine for this simple UI.
        await demo.clickToggle();
      }

      // Final state should be predictable: 30 clicks -> even -> should match initial (hidden)
      expect(await demo.isDemoVisible()).toBe(false);

      // Verify through afterEach that no page errors / console errors were produced
    });

    test('The showDemo function is defined on the window and is a function', async ({ page }) => {
      // Validate that showDemo is present in the page global scope.
      await page.goto(APP_URL, { waitUntil: 'load' });
      const typeOfShowDemo = await page.evaluate(() => typeof window.showDemo);
      expect(typeOfShowDemo).toBe('function');
    });

    test('Content integrity: demoResult contains expected table headers and rows when visible', async ({ page }) => {
      // Ensure that when visible, the demo result contains the expected table structure
      const demo = new DemoPage(page);
      await demo.goto();

      // Show it
      await demo.clickToggle();
      expect(await demo.isDemoVisible()).toBe(true);

      // Query inside the demoResult for table header text
      const headers = await page.locator('#demoResult table th').allTextContents();
      expect(headers).toContain('Name');
      expect(headers).toContain('OrderID');
      expect(headers).toContain('OrderDate');

      // Check there are at least 2 result rows (the example has 2)
      const rows = await page.locator('#demoResult table tr').count();
      // There is 1 header row + 2 data rows in the example -> count should be >= 3
      expect(rows).toBeGreaterThanOrEqual(3);
    });

    test('Clicking other parts of the page does not change demo visibility (no accidental triggers)', async ({ page }) => {
      // Validate that clicks outside the button do not toggle the demo accidentally.
      const demo = new DemoPage(page);
      await demo.goto();

      // Ensure hidden initially
      expect(await demo.isDemoVisible()).toBe(false);

      // Click some text element on the page (like the main heading)
      await page.locator('h1').click();
      expect(await demo.isDemoVisible()).toBe(false);

      // Click a paragraph
      await page.locator('p').first().click();
      expect(await demo.isDemoVisible()).toBe(false);

      // Now click the toggle once to show; then click elsewhere should not hide it automatically
      await demo.clickToggle();
      expect(await demo.isDemoVisible()).toBe(true);

      await page.locator('h2').nth(1).click(); // click another heading
      expect(await demo.isDemoVisible()).toBe(true);
    });
  });

  test.describe('Diagnostic checks: console and pageerror observations', () => {
    test('No unexpected console errors or uncaught exceptions during initial load', async ({ page }) => {
      // This test specifically validates that page load does not emit errors.
      // It relies on the page event hooks set up in beforeEach/afterEach which will assert zero errors.
      const demo = new DemoPage(page);
      await demo.goto();

      // Simple interaction to ensure scripts run
      await demo.toggleButton.click();

      // The afterEach hook will assert that no pageErrors or console 'error' messages were recorded.
    });

    test('If a ReferenceError / TypeError / SyntaxError happens it will be captured by pageerror', async ({ page }) => {
      // This test demonstrates observation: we do not inject errors or patch the page.
      // If a runtime error is present in the served HTML/JS it will be captured and cause a test failure
      // via assertions in afterEach, satisfying the requirement to let errors happen naturally and detect them.
      const demo = new DemoPage(page);
      await demo.goto();

      // Perform interactions that could reveal latent errors (click, direct invocation)
      await demo.clickToggle();
      await demo.invokeShowDemoDirectly();

      // No explicit assertion here about errors; afterEach collects and asserts that there were none.
      // If there were errors (ReferenceError / TypeError / SyntaxError) they would have been recorded
      // and cause the test to fail with diagnostic messages.
    });
  });
});