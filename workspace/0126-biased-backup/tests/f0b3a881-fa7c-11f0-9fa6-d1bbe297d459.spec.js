import { test, expect } from '@playwright/test';

// Test constants
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b3a881-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the application under test
class PagingAppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButtonSelector = "button[onclick='showDemo()']";
    this.demoOutputSelector = '#demoOutput';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getRunButton() {
    return this.page.locator(this.runButtonSelector);
  }

  async getDemoOutput() {
    return this.page.locator(this.demoOutputSelector);
  }

  async clickRunDemo() {
    await this.page.click(this.runButtonSelector);
  }

  async demoIsVisible() {
    const demo = await this.getDemoOutput();
    return demo.isVisible();
  }

  async demoInnerText() {
    const demo = await this.getDemoOutput();
    return demo.innerText();
  }
}

test.describe('FSM: Paging Demo (Application ID: f0b3a881-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Arrays to capture console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture page errors (unhandled exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test.afterEach(async ({ page }) => {
    // Detach listeners to avoid memory leaks (listeners are local so this is just defensive)
    // No explicit teardown required for the page fixture; Playwright handles closing pages.
  });

  test.describe('State: S0_Idle (Initial Render)', () => {
    test('Initial Idle state renders Run Paging Example button and hides demo output', async ({ page }) => {
      // Validate S0_Idle initial state: the page loads, the Run Paging Example button is present,
      // and the demo output (#demoOutput) is not visible (display: none).
      const app = new PagingAppPage(page);
      await app.goto();

      const runBtn = await app.getRunButton();
      await expect(runBtn).toBeVisible();
      await expect(runBtn).toHaveText('Run Paging Example');

      const demo = await app.getDemoOutput();
      // The style attribute in the HTML sets display: none initially. Verify that:
      await expect(demo).toHaveCSS('display', 'none');

      // Also verify demonstrative DOM evidence described in FSM: the button has onclick attribute
      await expect(runBtn).toHaveAttribute('onclick', 'showDemo()');

      // Ensure no unexpected page errors were thrown during initial render
      expect(pageErrors.length).toBe(0);
      // Ensure there are no console messages with type 'error' during initial render
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transition: RunDemo (S0_Idle -> S1_DemoVisible)', () => {
    test('Clicking Run Paging Example shows #demoOutput with expected content (S1_DemoVisible entry action)', async ({ page }) => {
      // This test triggers the RunDemo event and verifies the transition to S1_DemoVisible.
      // It asserts that the demo area becomes visible and that the inner HTML contains
      // the expected demonstration content produced by showDemo().
      const app = new PagingAppPage(page);
      await app.goto();

      // Pre-check: demo hidden
      const demo = await app.getDemoOutput();
      await expect(demo).toHaveCSS('display', 'none');

      // Trigger transition: user clicks the Run Paging Example button
      await app.clickRunDemo();

      // After click, demo should be displayed (style.display != 'none')
      await expect(demo).toBeVisible();
      // The JS populates demo.innerHTML with specific demo content; assert presence of key strings.
      const inner = await app.demoInnerText();
      expect(inner.length).toBeGreaterThan(0);
      expect(inner).toContain('Paging Demonstration');
      expect(inner).toContain('Virtual address: 0x2B4C');
      expect(inner).toContain('Final physical address');
      // Specific final translation assertion (evidence in implementation)
      expect(inner).toContain('0x2B4C → 0x5B4C');

      // Confirm the FSM expected observable: "#demoOutput is displayed"
      expect(await app.demoIsVisible()).toBe(true);

      // Verify showDemo function exists in the page global scope (it is used as the onclick handler)
      const showDemoExists = await page.evaluate(() => typeof window.showDemo === 'function');
      expect(showDemoExists).toBe(true);

      // Ensure clicking the button did not introduce page-level errors
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Repeated clicks remain idempotent and update demo content consistently', async ({ page }) => {
      // Edge/robustness test: clicking the Run Paging Example button multiple times should
      // not cause errors and should re-render or maintain the demo content in a consistent way.
      const app = new PagingAppPage(page);
      await app.goto();

      const demo = await app.getDemoOutput();

      // First click
      await app.clickRunDemo();
      await expect(demo).toBeVisible();
      const firstContent = await app.demoInnerText();
      expect(firstContent).toContain('Paging Demonstration');

      // Second click - should not throw and content should remain correct (either same or refreshed)
      await app.clickRunDemo();

      const secondContent = await app.demoInnerText();
      expect(secondContent).toContain('Paging Demonstration');

      // The content should be non-empty and include key translation text
      expect(secondContent.length).toBeGreaterThan(0);
      expect(secondContent).toContain('0x2B4C → 0x5B4C');

      // No page errors introduced by repeated interactions
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Entry/Exit actions and Error Scenarios', () => {
    test('Verify presence/absence of FSM-declared entry actions (renderPage vs showDemo)', async ({ page }) => {
      // The FSM lists renderPage() as an entry action for S0_Idle and showDemo() as entry action for S1_DemoVisible.
      // This test checks what is actually present in the page's runtime so we can detect mismatches between
      // the FSM and the implementation without attempting to call missing functions (we must not patch or create globals).
      const app = new PagingAppPage(page);
      await app.goto();

      // showDemo should be present and callable via the button; verify again at runtime:
      const showDemoType = await page.evaluate(() => typeof window.showDemo);
      expect(showDemoType).toBe('function');

      // renderPage is referenced by the FSM but is not present in the provided HTML/JS.
      // Assert that renderPage is not defined in the global scope. We do NOT call it (avoid causing ReferenceError by invoking).
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');

      // Document that renderPage's absence means trying to invoke it would result in a ReferenceError
      // (we assert its absence rather than triggering an error).
      expect(renderPageType).not.toBe('function');

      // Ensure no page errors currently
      expect(pageErrors.length).toBe(0);
    });

    test('Observe console and page errors across interactions (collect and assert)', async ({ page }) => {
      // This test performs interactions while collecting console messages and page errors.
      // It asserts that no unexpected runtime errors (ReferenceError/SyntaxError/TypeError) happened during normal use.
      const app = new PagingAppPage(page);
      await app.goto();

      // Perform the main transition
      await app.clickRunDemo();

      // Perform a few DOM queries to ensure script executed correctly
      const demoText = await app.demoInnerText();
      expect(demoText).toContain('Translation complete');

      // After interactions, validate that we did not observe unhandled exceptions
      // If errors did occur naturally in the page, pageErrors would contain them and this assertion would fail.
      expect(pageErrors.length).toBe(0);

      // Ensure console does not contain messages of type 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);

      // For transparency in test failures, if console errors exist, include them in assertion messages (Playwright will include details)
    });
  });

  test.describe('Accessibility & DOM integrity edge-cases', () => {
    test('Button has accessible name and demo region is present in DOM (even when hidden)', async ({ page }) => {
      // Validate that the button provides an accessible name and the demoOutput element remains in the DOM even while hidden.
      const app = new PagingAppPage(page);
      await app.goto();

      const runBtn = await app.getRunButton();
      // Accessible name should be the visible text "Run Paging Example"
      await expect(runBtn).toHaveText('Run Paging Example');

      // The demoOutput element should exist in the DOM regardless of visibility
      const demo = await app.getDemoOutput();
      expect(await demo.count()).toBe(1);

      // After revealing the demo, the demo region should receive content
      await app.clickRunDemo();
      await expect(demo).toBeVisible();
      const htmlContent = await page.$eval('#demoOutput', el => el.innerHTML.trim());
      expect(htmlContent.length).toBeGreaterThan(0);
    });
  });
});