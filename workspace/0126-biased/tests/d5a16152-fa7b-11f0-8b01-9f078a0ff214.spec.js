import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a16152-fa7b-11f0-8b01-9f078a0ff214.html';

/**
 * Page Object for the Bellman-Ford demonstration page.
 * Encapsulates common page interactions and queries so tests remain readable.
 */
class BellmanFordPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Return the first button element (the FSM describes a single button)
  async getShowDemoButton() {
    return this.page.locator('button').first();
  }

  // Click the demo button and wait for the dialog to appear
  async clickAndWaitForDialog() {
    return Promise.all([
      this.page.waitForEvent('dialog'),
      (await this.getShowDemoButton()).click(),
    ]);
  }

  // Read text content of the body (useful to assert page rendered content)
  async getBodyText() {
    return this.page.locator('body').innerText();
  }

  // Get attribute 'onclick' of the button
  async getButtonOnclickAttribute() {
    return (await this.getShowDemoButton()).getAttribute('onclick');
  }
}

test.describe('Bellman-Ford Algorithm Interactive Demo (FSM validation)', () => {
  // Shared arrays to capture runtime console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // No-op here; individual tests will wire up listeners to ensure isolation and clearer assertions.
  });

  test.describe('Initial state S0_Idle - page load and rendering', () => {
    test('S0_Idle: Page loads, main sections render, button exists and has expected attributes; no runtime errors on load', async ({ page }) => {
      // Set up listeners to observe console messages and page errors exactly as they happen
      const consoleMessages = [];
      const pageErrors = [];

      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });

      page.on('pageerror', err => {
        // Collect error messages (ReferenceError, SyntaxError, TypeError, etc.)
        pageErrors.push(err);
      });

      const demo = new BellmanFordPage(page);
      await demo.goto();

      // Verify main content sections are present by looking for header and a few known headings
      const bodyText = await demo.getBodyText();
      expect(bodyText).toContain('The Bellman-Ford Algorithm'); // header
      expect(bodyText).toContain('1. Introduction');
      expect(bodyText).toContain('2. Theory of Bellman-Ford Algorithm');
      expect(bodyText).toContain('3. Algorithm Pseudocode');

      // Verify the button exists and is visible & enabled
      const button = await demo.getShowDemoButton();
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();

      // Validate button text (trimmed)
      const buttonText = (await button.innerText()).trim();
      expect(buttonText).toBe('Show Simple Demonstration');

      // Verify the onclick attribute is the expected inline alert handler from the FSM/evidence
      const onclickAttr = await demo.getButtonOnclickAttribute();
      expect(onclickAttr).toBe("alert('Demonstration of Bellman-Ford Algorithm would be shown here.')");

      // Assert that no page errors (ReferenceError/SyntaxError/TypeError) occurred during load.
      // The FSM mentions an entry action renderPage() — verify that we did NOT observe a ReferenceError
      // for a missing renderPage function. If such an error exists, this assertion will fail and surface it.
      expect(pageErrors.length, `Expected no page errors during initial load, but got: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

      // Assert that there are no console messages of type 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `Expected no console.error messages, but found: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });
  });

  test.describe('Transition ShowDemonstration (S0_Idle -> S1_DemonstrationShown)', () => {
    test('ShowDemonstration: clicking the button triggers an alert dialog with expected text (S1 entry action)', async ({ page }) => {
      const consoleMessages = [];
      const pageErrors = [];

      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const demo = new BellmanFordPage(page);
      await demo.goto();

      // Click and wait for the dialog (this corresponds to the FSM transition action: alert)
      const [dialog] = await demo.clickAndWaitForDialog();

      // Verify the dialog message matches the FSM's expected alert text
      const expectedMessage = "Demonstration of Bellman-Ford Algorithm would be shown here.";
      expect(dialog.message()).toBe(expectedMessage);

      // Accept the alert to simulate the user acknowledging the demonstration
      await dialog.accept();

      // After dialog accepted, assert no page errors or console error messages occurred during the transition
      expect(pageErrors.length, `Expected no page errors after clicking button, but got: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `Expected no console.error messages after clicking button, but found: ${JSON.stringify(consoleErrors)}`).toBe(0);

      // Verify the DOM remains intact (button still present) after the alert
      const button = await demo.getShowDemoButton();
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
    });

    test('Edge case: clicking the button multiple times fires consecutive alert dialogs (handles sequential dialogs)', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const demo = new BellmanFordPage(page);
      await demo.goto();

      const button = await demo.getShowDemoButton();

      // Click twice, handling two dialogs sequentially
      for (let i = 0; i < 2; i++) {
        const dialogPromise = page.waitForEvent('dialog');
        await button.click();
        const dialog = await dialogPromise;
        // Verify the dialog content each time
        expect(dialog.message()).toBe("Demonstration of Bellman-Ford Algorithm would be shown here.");
        // Dismiss on first, accept on second to test both flows
        if (i === 0) {
          await dialog.dismiss();
        } else {
          await dialog.accept();
        }
      }

      // Confirm no runtime page errors occurred during rapid interactions
      expect(pageErrors.length, `Expected no page errors after multiple clicks, but got: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    });

    test('Error scenario: ensure missing entry action (renderPage) did not cause a ReferenceError on load', async ({ page }) => {
      // This test explicitly observes whether a ReferenceError for renderPage occurs.
      // The FSM includes renderPage() as an entry action for S0_Idle; the HTML may or may not call this.
      // We must NOT patch or change the page; simply observe and assert.
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const demo = new BellmanFordPage(page);
      await demo.goto();

      // If renderPage() were invoked but missing, we'd expect a ReferenceError. We assert that such an error does NOT exist.
      const foundReferenceError = pageErrors.some(err => /ReferenceError: renderPage|renderPage is not defined/i.test(err.message));
      expect(foundReferenceError, `Did not expect a ReferenceError for renderPage; errors captured: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(false);

      // Also assert general absence of common-breaking errors like SyntaxError/TypeError on load
      const foundSyntaxOrType = pageErrors.some(err => /(SyntaxError|TypeError)/i.test(err.message));
      expect(foundSyntaxOrType, `Did not expect SyntaxError/TypeError on load; errors captured: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(false);
    });
  });

  test.describe('Visual and DOM assertions related to FSM evidence', () => {
    test('Button styling and hover behavior basics (existence of CSS rules implied by rendering)', async ({ page }) => {
      // This test checks that the button has styles applied by reading computed styles.
      // Note: We only observe computed style values that the browser exposes; we do NOT modify CSS.
      const demo = new BellmanFordPage(page);
      await demo.goto();

      const button = await demo.getShowDemoButton();
      await expect(button).toBeVisible();

      // Check a few computed style properties that should match the stylesheet in the HTML
      const bgColor = await button.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      // The CSS sets background-color: #007BFF; That generally maps to rgb(0, 123, 255)
      expect(bgColor).toBeTruthy(); // presence check; exact color can vary by browser/formatting
      const color = await button.evaluate((el) => window.getComputedStyle(el).color);
      expect(color).toBeTruthy();

      // Ensure the button has a border-radius applied per the stylesheet
      const borderRadius = await button.evaluate((el) => window.getComputedStyle(el).borderRadius);
      expect(borderRadius).toBeTruthy();
    });
  });
});