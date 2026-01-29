import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83552a1-fa7b-11f0-b314-ad8654ee5de8.html';

/**
 * Page object encapsulating interactions and queries for the demo page.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#runDemo');
    this.demo = page.locator('#demo');
  }

  // Navigate to the page and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the toggle button once
  async toggleDemo() {
    await this.button.click();
  }

  // Get button text content (trimmed)
  async getButtonText() {
    return (await this.button.textContent())?.trim() ?? '';
  }

  // Get aria-expanded attribute value as a boolean
  async getAriaExpanded() {
    const val = await this.button.getAttribute('aria-expanded');
    return val === 'true';
  }

  // Get aria-controls attribute value
  async getAriaControls() {
    return await this.button.getAttribute('aria-controls');
  }

  // Return true if the demo element's hidden property is true
  async isDemoHiddenProperty() {
    return await this.page.evaluate(() => {
      const demo = document.getElementById('demo');
      // ensure to return the boolean property
      return demo ? demo.hidden === true : null;
    });
  }

  // Return whether demo locator is visible according to Playwright
  async isDemoVisible() {
    try {
      return await this.demo.isVisible();
    } catch (e) {
      // If element not found or other error, treat as not visible
      return false;
    }
  }

  // Return whether the demo element has the 'hidden' attribute present in the DOM
  async hasHiddenAttribute() {
    return (await this.demo.getAttribute('hidden')) !== null;
  }

  // Return inner text of the demo element trimmed
  async getDemoText() {
    const txt = await this.demo.textContent();
    return txt ? txt.trim() : '';
  }
}

test.describe('FSM: Interpolation Search interactive demonstration (Idle <-> DemoVisible)', () => {
  // Collect console messages and page errors for each test run
  test.beforeEach(async ({ page }) => {
    // Attach listeners to capture console messages and page errors.
    // Stored on the page object for access inside tests via page.context()._debug or similar.
    page['_consoleMessages'] = [];
    page['_pageErrors'] = [];

    page.on('console', (msg) => {
      // store type and text for later assertions
      page['_consoleMessages'].push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      page['_pageErrors'].push({ name: err.name, message: err.message, stack: err.stack });
    });
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity: ensure no uncaught page errors were emitted during the test.
    // If there are any unexpected pageerrors, fail the test with diagnostic info.
    const errs = page['_pageErrors'] || [];
    if (errs.length > 0) {
      // Provide descriptive failure with the first captured error
      const first = errs[0];
      // Use expect to fail inside Playwright test reporting
      expect(first, `Unexpected pageerror: ${first && first.message}`).toBeUndefined();
    }

    // Also assert there were no console messages of type 'error' (uncaught runtime errors typically surface here)
    const consoleErrors = (page['_consoleMessages'] || []).filter(m => m.type === 'error');
    if (consoleErrors.length > 0) {
      expect(consoleErrors, `Console error messages were emitted: ${JSON.stringify(consoleErrors, null, 2)}`).toHaveLength(0);
    }
  });

  test.describe('Initial state: S0_Idle (renderPage entry action)', () => {
    test('renders the page with expected button and hidden demo (Idle state)', async ({ page }) => {
      // Arrange
      const demoPage = new DemoPage(page);
      // Act
      await demoPage.goto();

      // Assert: the button exists with expected attributes and text
      await expect(demoPage.button).toBeVisible();
      expect(await demoPage.getButtonText()).toBe('Show demonstration (sample)');
      expect(await demoPage.getAriaControls()).toBe('demo');
      expect(await demoPage.getAriaExpanded()).toBe(false);

      // Assert: the demo element exists and is hidden initially per FSM evidence
      await expect(demoPage.demo).toHaveCount(1);
      // Playwright's toBeHidden checks computed visibility; hidden attribute should make it hidden.
      await expect(demoPage.demo).toBeHidden();
      expect(await demoPage.isDemoHiddenProperty()).toBe(true);
      expect(await demoPage.hasHiddenAttribute()).toBe(true);

      // Verify demo content includes the expected demonstration header (sanity of renderPage)
      const demoText = await demoPage.getDemoText();
      expect(demoText).toContain('Demonstration — search x = 29');

      // Ensure no uncaught errors were produced during initial render
      const pageErrors = page['_pageErrors'] || [];
      expect(pageErrors.length, 'No page errors should be present on initial load').toBe(0);
      const consoleErrors = (page['_consoleMessages'] || []).filter(m => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages on initial load').toBe(0);
    });
  });

  test.describe('Transitions and events', () => {
    test('ShowDemo: clicking button reveals demonstration and updates ARIA/text (S0 -> S1)', async ({ page }) => {
      const demoPage = new DemoPage(page);
      await demoPage.goto();

      // Precondition checks
      expect(await demoPage.isDemoHiddenProperty()).toBe(true);
      expect(await demoPage.getButtonText()).toBe('Show demonstration (sample)');
      expect(await demoPage.getAriaExpanded()).toBe(false);

      // Event: click button to show demonstration
      await demoPage.toggleDemo();

      // Observables after transition: demo should be visible, aria-expanded true, button text updated
      await expect(demoPage.demo).toBeVisible();
      expect(await demoPage.isDemoHiddenProperty()).toBe(false);
      expect(await demoPage.getAriaExpanded()).toBe(true);
      expect(await demoPage.getButtonText()).toBe('Hide demonstration');

      // The 'hidden' attribute should have been removed from the DOM when hidden=false
      expect(await demoPage.hasHiddenAttribute()).toBe(false);

      // Confirm content still present and unchanged
      const inner = await demoPage.getDemoText();
      expect(inner).toContain('Probe A[7] = 24'); // a sentence that appears in the demo description

      // Ensure no runtime errors surfaced during the transition
      const pageErrors = page['_pageErrors'] || [];
      expect(pageErrors.length, 'No page errors should occur when showing the demo').toBe(0);
      const consoleErrors = (page['_consoleMessages'] || []).filter(m => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages when showing the demo').toBe(0);
    });

    test('HideDemo: clicking button again hides demonstration and restores ARIA/text (S1 -> S0)', async ({ page }) => {
      const demoPage = new DemoPage(page);
      await demoPage.goto();

      // Bring demo into visible state first
      await demoPage.toggleDemo();
      await expect(demoPage.demo).toBeVisible();

      // Now click to hide
      await demoPage.toggleDemo();

      // Observables: demo hidden, aria-expanded false, button text restored
      await expect(demoPage.demo).toBeHidden();
      expect(await demoPage.isDemoHiddenProperty()).toBe(true);
      expect(await demoPage.getAriaExpanded()).toBe(false);
      expect(await demoPage.getButtonText()).toBe('Show demonstration (sample)');

      // 'hidden' attribute should be present again
      expect(await demoPage.hasHiddenAttribute()).toBe(true);

      // Ensure no runtime errors during hide transition
      const pageErrors = page['_pageErrors'] || [];
      expect(pageErrors.length, 'No page errors should occur when hiding the demo').toBe(0);
      const consoleErrors = (page['_consoleMessages'] || []).filter(m => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages when hiding the demo').toBe(0);
    });

    test('Rapid toggling: multiple clicks alternate state without throwing errors (edge case)', async ({ page }) => {
      const demoPage = new DemoPage(page);
      await demoPage.goto();

      // Rapidly click the toggle button multiple times to surface potential race conditions
      // We'll click 5 times and assert final state is "visible" (odd number of toggles)
      for (let i = 0; i < 5; i++) {
        await demoPage.toggleDemo();
        // tiny pause to allow DOM updates (not necessary but safer for flaky environments)
        await page.waitForTimeout(50);
      }

      // After 5 toggles, expect visible
      expect(await demoPage.isDemoHiddenProperty()).toBe(false);
      await expect(demoPage.demo).toBeVisible();
      expect(await demoPage.getAriaExpanded()).toBe(true);
      expect(await demoPage.getButtonText()).toBe('Hide demonstration');

      // Now toggle one more time to return to idle
      await demoPage.toggleDemo();
      await page.waitForTimeout(20);
      expect(await demoPage.isDemoHiddenProperty()).toBe(true);
      await expect(demoPage.demo).toBeHidden();
      expect(await demoPage.getAriaExpanded()).toBe(false);

      // Ensure no page errors or console.error messages were emitted during rapid toggling
      const pageErrors = page['_pageErrors'] || [];
      expect(pageErrors.length, 'No page errors during rapid toggling').toBe(0);
      const consoleErrors = (page['_consoleMessages'] || []).filter(m => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages during rapid toggling').toBe(0);
    });
  });

  test.describe('Accessibility and DOM contract checks', () => {
    test('ARIA attributes remain consistent with demo visibility', async ({ page }) => {
      const demoPage = new DemoPage(page);
      await demoPage.goto();

      // Initial: hidden -> aria-expanded false
      expect(await demoPage.isDemoHiddenProperty()).toBe(true);
      expect(await demoPage.getAriaExpanded()).toBe(false);

      // Show demo and ensure aria-expanded updated to true and aria-controls points to #demo
      await demoPage.toggleDemo();
      expect(await demoPage.isDemoHiddenProperty()).toBe(false);
      expect(await demoPage.getAriaExpanded()).toBe(true);
      expect(await demoPage.getAriaControls()).toBe('demo');

      // Hide again and re-check ARIA
      await demoPage.toggleDemo();
      expect(await demoPage.isDemoHiddenProperty()).toBe(true);
      expect(await demoPage.getAriaExpanded()).toBe(false);
      expect(await demoPage.getAriaControls()).toBe('demo');

      // Verify no runtime errors occurred
      const pageErrors = page['_pageErrors'] || [];
      expect(pageErrors.length, 'No page errors during ARIA checks').toBe(0);
      const consoleErrors = (page['_consoleMessages'] || []).filter(m => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages during ARIA checks').toBe(0);
    });

    test('Demo content remains correct after toggling (DOM stability)', async ({ page }) => {
      const demoPage = new DemoPage(page);
      await demoPage.goto();

      // Show demo
      await demoPage.toggleDemo();
      await expect(demoPage.demo).toBeVisible();

      // Capture demo content
      const contentWhenVisible = await demoPage.getDemoText();
      expect(contentWhenVisible.length).toBeGreaterThan(0);
      expect(contentWhenVisible).toContain('Initial: low=0 (A[0]=3), high=10 (A[10]=37).');

      // Hide and show again
      await demoPage.toggleDemo();
      await expect(demoPage.demo).toBeHidden();
      await demoPage.toggleDemo();
      await expect(demoPage.demo).toBeVisible();

      // Content should remain the same (not replaced with unexpected text)
      const contentAfterCycle = await demoPage.getDemoText();
      expect(contentAfterCycle).toContain('Initial: low=0 (A[0]=3), high=10 (A[10]=37).');
      expect(contentAfterCycle).toBe(contentWhenVisible);

      // Final sanity: no errors
      const pageErrors = page['_pageErrors'] || [];
      expect(pageErrors.length, 'No page errors during content stability checks').toBe(0);
      const consoleErrors = (page['_consoleMessages'] || []).filter(m => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages during content stability checks').toBe(0);
    });
  });
});