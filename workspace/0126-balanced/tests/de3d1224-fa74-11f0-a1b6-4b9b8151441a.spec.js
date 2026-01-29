import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d1224-fa74-11f0-a1b6-4b9b8151441a.html';

/**
 * Page Object for the OSI Model Demonstration page.
 * Encapsulates common interactions and queries to keep tests readable.
 */
class OSIPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Click the layer container (1..7)
  async clickLayer(n) {
    await this.page.click(`.layer.layer-${n}`);
  }

  // Returns a locator for the info element for a layer
  infoLocator(n) {
    return this.page.locator(`#info-${n}`);
  }

  // Returns true if the info element is visible (computed)
  async isInfoVisible(n) {
    return await this.infoLocator(n).isVisible();
  }

  // Click the "Show Data Flow" button
  async clickShowDataFlow() {
    await this.page.click('button:has-text("Show Data Flow")');
  }

  // Get the innerText of #data-flow
  async getDataFlowText() {
    return await this.page.locator('#data-flow').innerText();
  }

  // Count list items under #data-flow
  async dataFlowItemCount() {
    return await this.page.locator('#data-flow li').count();
  }
}

test.describe('OSI Model Demonstration - FSM state & transitions', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events and record them
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Listen to uncaught page errors and record them
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // no-op: listeners are tied to the page instance and will be cleaned up
  });

  test('Page loads correctly and initial Idle state is rendered', async ({ page }) => {
    const osi = new OSIPage(page);

    // Validate page title and basic content presence
    await expect(page).toHaveTitle(/OSI Model Demonstration/);
    await expect(page.locator('h1')).toHaveText('OSI Model Demonstration');

    // Verify all seven layer elements are present and visible (S0_Idle evidence)
    for (let n = 1; n <= 7; n++) {
      const layer = page.locator(`.layer.layer-${n}`);
      await expect(layer).toBeVisible();
      // Each layer should contain the textual label as per components
      await expect(layer).toContainText(`${n}.`);
    }

    // The data-flow container should exist and initially be empty
    const dataFlow = page.locator('#data-flow');
    await expect(dataFlow).toBeVisible();
    const dfText = await dataFlow.innerText();
    expect(dfText.trim()).toBe('');

    // Assert there were no uncaught runtime errors during initial load
    expect(pageErrors.length, `Expected no page errors on load, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // Assert no console messages of type 'error' (like ReferenceError/TypeError)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors were found: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test.describe('Layer toggle interactions (ToggleLayerInfo event -> states S1..S7)', () => {
    test('Clicking each layer reveals its info (enter info state) and toggles back', async ({ page }) => {
      const osi1 = new OSIPage(page);

      // For each layer 7 down to 1 (matching the FSM listing), click and verify visibility
      for (let n = 7; n >= 1; n--) {
        // Ensure info is initially hidden
        expect(await osi.isInfoVisible(n)).toBe(false);

        // Click the layer to enter state Sx_Layer_N_Info
        await osi.clickLayer(n);

        // The expected observable is that the layer-info becomes visible (display)
        await expect(osi.infoLocator(n)).toBeVisible();

        // Additional check: the inner text should contain meaningful explanatory text from the HTML
        const text = await osi.infoLocator(n).innerText();
        expect(text.length).toBeGreaterThan(10);

        // Click again to toggle it closed (exit action is implemented by toggleInfo)
        await osi.clickLayer(n);
        await expect(osi.infoLocator(n)).not.toBeVisible();

        // After each interaction, assert no runtime page errors occurred
        expect(pageErrors.length, `Page errors after toggling layer ${n}: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

        // Also assert there are no console 'error' messages produced by this interaction
        const consoleErrors1 = consoleMessages.filter(m => m.type === 'error');
        expect(consoleErrors.length, `Console errors after toggling layer ${n}: ${JSON.stringify(consoleErrors)}`).toBe(0);
      }
    });

    test('Toggling one layer does not inadvertently hide another (independent toggles)', async ({ page }) => {
      const osi2 = new OSIPage(page);

      // Open two different layers: 7 and 4
      await osi.clickLayer(7);
      await expect(osi.infoLocator(7)).toBeVisible();

      await osi.clickLayer(4);
      await expect(osi.infoLocator(4)).toBeVisible();

      // Verify both remain visible (implementation supports multiple open infos)
      expect(await osi.isInfoVisible(7)).toBe(true);
      expect(await osi.isInfoVisible(4)).toBe(true);

      // Clean up by closing them
      await osi.clickLayer(7);
      await osi.clickLayer(4);
      await expect(osi.infoLocator(7)).not.toBeVisible();
      await expect(osi.infoLocator(4)).not.toBeVisible();

      // Verify no runtime errors
      expect(pageErrors.length).toBe(0);
      const consoleErrors2 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking on inner elements of a layer still toggles the layer (event bubbling)', async ({ page }) => {
      const osi3 = new OSIPage(page);

      // Click the paragraph inside layer-3 (when hidden it is present but not visible)
      // The inner element will be matched even if not visible; click forces action on the container
      await page.click('.layer.layer-3'); // main click to open
      await expect(osi.infoLocator(3)).toBeVisible();

      // Click the paragraph inside the visible info - bubbling should cause the parent onclick to run and toggle
      await page.click('#info-3 p:first-child');
      // After clicking inner p, the toggleInfo should have closed the info
      await expect(osi.infoLocator(3)).not.toBeVisible();

      // Verify no runtime errors
      expect(pageErrors.length).toBe(0);
      const consoleErrors3 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Data flow demonstration (ShowDataFlow event -> state S8_Data_Flow_Shown)', () => {
    test('Clicking Show Data Flow populates the data flow container with expected steps', async ({ page }) => {
      const osi4 = new OSIPage(page);

      // Ensure data-flow is initially empty
      let initialText = await osi.getDataFlowText();
      expect(initialText.trim()).toBe('');

      // Click the button to show data flow
      await osi.clickShowDataFlow();

      // The content is inserted synchronously in the implementation, so we can immediately assert
      await expect(page.locator('#data-flow')).toContainText('Data flow when requesting a webpage');

      // The FSM expects an ordered list of steps; assert there are 7 list items
      const itemCount = await osi.dataFlowItemCount();
      expect(itemCount).toBe(7);

      // Ensure specific expected content appears (one of the steps)
      await expect(page.locator('#data-flow')).toContainText('7: Application - HTTP request created (GET /index.html)');
      await expect(page.locator('#data-flow')).toContainText('1: Physical - Bits transmitted over cable/wireless');

      // Click the button again to ensure idempotency (content is replaced / remains valid)
      await osi.clickShowDataFlow();
      const itemCountAfter = await osi.dataFlowItemCount();
      expect(itemCountAfter).toBe(7);

      // Verify no runtime errors occurred during data flow rendering
      expect(pageErrors.length, `Page errors after showing data flow: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
      const consoleErrors4 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `Console errors after showing data flow: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });

    test('Edge case: rapid repeated clicks on Show Data Flow do not crash the page', async ({ page }) => {
      const osi5 = new OSIPage(page);

      // Perform rapid clicks
      await Promise.all([
        osi.clickShowDataFlow(),
        osi.clickShowDataFlow(),
        osi.clickShowDataFlow()
      ]);

      // Ensure the data-flow still contains expected header
      await expect(page.locator('#data-flow')).toContainText('Data flow when requesting a webpage');

      // Ensure list item count remains reasonable (7 steps)
      const itemCount1 = await osi.dataFlowItemCount();
      expect(itemCount).toBe(7);

      // Confirm no uncaught errors
      expect(pageErrors.length).toBe(0);
      const consoleErrors5 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Runtime and console observations', () => {
    test('No unexpected ReferenceError, SyntaxError, or TypeError occurred during interactions', async ({ page }) => {
      // This test ensures we observed the runtime for errors after the normal interactions above.
      // The page lifecycle listeners were set up in beforeEach and recorded events in arrays.
      // If there were errors they would be captured in pageErrors or console messages of type 'error'.

      // We assert there are no recorded page 'pageerror' events
      expect(pageErrors.length, `Expected zero page errors but found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

      // Assert that console does not contain messages flagged as 'error' (which could be uncaught Reference/Type/Syntax errors)
      const consoleErrors6 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `Expected zero console errors but found: ${JSON.stringify(consoleErrors)}`).toBe(0);

      // Additionally, assert that no console message text contains common error keywords as a safety net
      const errorKeywords = ['ReferenceError', 'TypeError', 'SyntaxError', 'Uncaught'];
      const problematic = consoleMessages.filter(m =>
        errorKeywords.some(k => m.text.includes(k))
      );
      expect(problematic.length, `Console contains error-like messages: ${JSON.stringify(problematic)}`).toBe(0);
    });
  });
});