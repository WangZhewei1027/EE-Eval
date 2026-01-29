import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8372761-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object Model for the demo section
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleBtn = page.locator('#toggleDemo');
    this.demoArea = page.locator('#demo');
    this.demoPre = page.locator('#demoPre');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtonText() {
    return (await this.toggleBtn.textContent())?.trim() ?? '';
  }

  async isDemoVisible() {
    // Use computed style to determine visibility to match runtime behavior
    return await this.page.evaluate((el) => {
      return window.getComputedStyle(el).display !== 'none';
    }, await this.demoArea.elementHandle());
  }

  async clickToggle() {
    await this.toggleBtn.click();
  }

  async getPreText() {
    return (await this.demoPre.textContent()) ?? '';
  }

  async showCountedLines() {
    const text = await this.getPreText();
    return text.split('\n').length;
  }
}

test.describe('Time Complexity — Demo FSM (d8372761-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Collect console messages and page errors for assertions and diagnostics
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages with type and text
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.describe('FSM States and Transitions', () => {
    test('S0_Idle: initial render shows button and demo hidden (entry action renderPage())', async ({ page }) => {
      // Arrange
      const demo = new DemoPage(page);

      // Act
      await demo.goto();

      // Assert: page loaded successfully (title present)
      await expect(page).toHaveTitle(/Time Complexity — Comprehensive Guide/);

      // Assert: Button exists and has initial text
      await expect(demo.toggleBtn).toBeVisible();
      const initialText = await demo.getButtonText();
      // The FSM and HTML evidence expect this exact label on entry
      expect(initialText).toBe('Show complexity comparison');

      // Assert: demo area exists and is hidden (style display:none)
      const visible = await demo.isDemoVisible();
      expect(visible).toBe(false);

      // Assert: pre is present but empty at initial render
      const preText = await demo.getPreText();
      // Implementation sets pre empty initially
      expect(preText.trim()).toBe('');

      // Assert: No page errors occurred during initial render
      expect(pageErrors.length).toBe(0);

      // Assert: No console errors were emitted during initial render
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Transition S0_Idle -> S1_DemoVisible: clicking toggle builds table and shows demo (buildTable(), showDemo())', async ({ page }) => {
      // Arrange
      const demo = new DemoPage(page);
      await demo.goto();

      // Ensure initial state as precondition
      expect(await demo.getButtonText()).toBe('Show complexity comparison');
      expect(await demo.isDemoVisible()).toBe(false);

      // Act: click the toggle button to show demo
      await demo.clickToggle();

      // Assert: demo area is visible (entry action showDemo)
      expect(await demo.isDemoVisible()).toBe(true);

      // Assert: button text changed to "Hide complexity comparison"
      expect(await demo.getButtonText()).toBe('Hide complexity comparison');

      // Assert: pre got populated by buildTable()
      const preText = await demo.getPreText();
      expect(preText.trim().length).toBeGreaterThan(0);

      // Check expected table header and columns exist in pre content
      expect(preText).toContain('n | 1 | log2(n)');
      expect(preText).toContain('n·log2(n)');
      expect(preText).toContain('2^n');

      // The table should contain the sample n values declared in the implementation
      expect(preText).toContain(' 1 |'); // n = 1 line
      expect(preText).toContain('64'); // n = 64 is one of the sample ns

      // Assert: No runtime page errors occurred during the click / table build
      expect(pageErrors.length).toBe(0);

      // Assert: No console error-level messages emitted during click
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Transition S1_DemoVisible -> S0_Idle: clicking toggle again hides demo (hideDemo()) and preserves pre content', async ({ page }) => {
      // Arrange
      const demo = new DemoPage(page);
      await demo.goto();

      // Show the demo first
      await demo.clickToggle();
      expect(await demo.isDemoVisible()).toBe(true);
      const preBeforeHide = await demo.getPreText();
      expect(preBeforeHide.trim().length).toBeGreaterThan(0);

      // Act: click again to hide
      await demo.clickToggle();

      // Assert: demo area hidden
      expect(await demo.isDemoVisible()).toBe(false);

      // Assert: button text reverted to "Show complexity comparison"
      expect(await demo.getButtonText()).toBe('Show complexity comparison');

      // Assert: pre content remains (implementation does not clear pre on hide)
      const preAfterHide = await demo.getPreText();
      expect(preAfterHide.trim()).toBe(preBeforeHide.trim());

      // Assert: No page errors or console errors during hide transition
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Edge Case: Rapid toggling multiple times results in consistent visible/hidden states (parity check)', async ({ page }) => {
      // Arrange
      const demo = new DemoPage(page);
      await demo.goto();

      // Act: click toggle 5 times rapidly
      for (let i = 0; i < 5; i++) {
        await demo.clickToggle();
      }

      // After 5 clicks (odd), demo should be visible
      const visibleAfter5 = await demo.isDemoVisible();
      expect(visibleAfter5).toBe(true);
      expect(await demo.getButtonText()).toBe('Hide complexity comparison');

      // Act: click one more time -> total 6 (even)
      await demo.clickToggle();

      // After 6 clicks (even), demo should be hidden
      const visibleAfter6 = await demo.isDemoVisible();
      expect(visibleAfter6).toBe(false);
      expect(await demo.getButtonText()).toBe('Show complexity comparison');

      // Ensure pre still contains table (built at least once)
      const preText = await demo.getPreText();
      expect(preText.trim().length).toBeGreaterThan(0);

      // No page errors nor console errors should have occurred
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Implementation Observability and Robustness', () => {
    test('buildTable content sanity: numeric formatting and notes present when shown', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Show demo
      await demo.clickToggle();
      expect(await demo.isDemoVisible()).toBe(true);

      const preText = await demo.getPreText();

      // Validate presence of approximate formatting strings and notes
      expect(preText).toMatch(/Values shown approximately/i);
      expect(preText).toContain('Notes: log2 uses base-2. Values are illustrative for comparing growth rates.');

      // Validate some formatted numeric examples exist and look reasonable (e.g., log2(8)=3)
      // We check that the row for n=8 includes a '3' (log2 8) or '3.0000' depending on formatting
      expect(preText).toMatch(/8 .*3/);

      // No runtime exceptions occurred building the formatted output
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Observes console messages and exposes none marked as errors during normal usage', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Perform interactions
      await demo.clickToggle();
      await demo.clickToggle();
      await demo.clickToggle();

      // We explicitly assert that no console messages of type "error" were emitted
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);

      // Provide helpful diagnostic output on failure by making sure consoleMessages is iterable
      expect(Array.isArray(consoleMessages)).toBe(true);
    });

    test('No unexpected page errors (ReferenceError, TypeError, SyntaxError) occurred during entire test run', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Interact a bit to surface runtime faults if any
      await demo.clickToggle();
      await demo.clickToggle();

      // Assert: pageErrors collected is empty (if any error types occurred they would be present)
      // This aligns with the requirement to observe page errors and assert their presence/absence.
      expect(pageErrors.length).toBe(0);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // On failure, attach captured console messages and page errors to test output to aid debugging.
    // Note: This does not modify page behavior; it's purely reporting.
    if (testInfo.status !== testInfo.expectedStatus) {
      // eslint-disable-next-line no-console
      console.log('--- Attaching console messages captured during test ---');
      for (const msg of consoleMessages) {
        // eslint-disable-next-line no-console
        console.log(`[console.${msg.type}] ${msg.text}`);
      }
      // eslint-disable-next-line no-console
      console.log('--- Attaching page errors captured during test ---');
      for (const err of pageErrors) {
        // eslint-disable-next-line no-console
        console.log(err);
      }
    }
  });
});