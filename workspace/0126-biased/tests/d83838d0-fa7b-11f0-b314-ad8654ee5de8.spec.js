import { test, expect } from '@playwright/test';

// Test file: d83838d0-fa7b-11f0-b314-ad8654ee5de8.spec.js
// Application URL (served by the environment hosting the HTML file)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83838d0-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object Model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoBtn = page.locator('#demoBtn');
    this.demoPanel = page.locator('#demoPanel');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Returns the button's textContent
  async getButtonText() {
    return (await this.demoBtn.textContent())?.trim();
  }

  // Returns the button's aria-expanded attribute as string
  async getButtonAriaExpanded() {
    return await this.demoBtn.getAttribute('aria-expanded');
  }

  // Returns the panel's inline style.display value
  async getPanelDisplayStyle() {
    // Use evaluate to get the computed inline style value (style.display)
    return await this.page.evaluate(() => {
      const el = document.getElementById('demoPanel');
      return el ? el.style.display : null;
    });
  }

  // Returns the panel's aria-hidden attribute
  async getPanelAriaHidden() {
    return await this.demoPanel.getAttribute('aria-hidden');
  }

  // Clicks the demo button
  async clickToggle() {
    await this.demoBtn.click();
  }

  // Returns whether the panel is visible based on inline style.display === 'block'
  async isPanelVisible() {
    const display = await this.getPanelDisplayStyle();
    return display === 'block';
  }

  // Returns whether the panel contains the expected header text
  async panelContainsHeader(text) {
    return await this.page.locator('#demoPanel h3').textContent().then(t => (t || '').includes(text));
  }
}

test.describe('Normalization Demo — FSM and UI validation', () => {
  // Arrays to capture console messages and page errors per test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // err is an Error object; capture its name and message
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    });
  });

  test('Initial state (S0_Idle): button present and panel is hidden', async ({ page }) => {
    // This test validates the idle state entry as per FSM S0_Idle
    const demo = new DemoPage(page);
    await demo.goto();

    // The button must exist, have correct default text and aria-expanded="false"
    await expect(demo.demoBtn).toBeVisible();
    const btnText = await demo.getButtonText();
    expect(btnText).toBe('Show Normalization Demo');

    const ariaExpanded = await demo.getButtonAriaExpanded();
    expect(ariaExpanded).toBe('false');

    // The panel should be present in the DOM but hidden: style.display === 'none' and aria-hidden="true"
    await expect(demo.demoPanel).toBeVisible(); // element exists and occupies layout (visibility determined by style)
    const panelDisplay = await demo.getPanelDisplayStyle();
    expect(panelDisplay).toBe('none');

    const panelAriaHidden = await demo.getPanelAriaHidden();
    expect(panelAriaHidden).toBe('true');

    // Panel should contain the expected demo header (sanity check for content)
    const containsHeader = await demo.panelContainsHeader('Normalization Demo (static)');
    expect(containsHeader).toBeTruthy();

    // Assert no uncaught page errors occurred during initial render (observes console/page errors)
    // We expect the page's minimal script to run without throwing ReferenceError/SyntaxError/TypeError.
    expect(pageErrors.length, `Expected no page errors, got: ${JSON.stringify(pageErrors)}`).toBe(0);

    // Check console for any error-level messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages, got: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Toggle to Demo Visible (S0 -> S1) and verify DOM & accessibility attributes', async ({ page }) => {
    // This test validates the transition triggered by clicking #demoBtn (ToggleDemo)
    const demo = new DemoPage(page);
    await demo.goto();

    // Click to open demo panel (transition S0_Idle -> S1_DemoVisible)
    await demo.clickToggle();

    // After click, panel.style.display should be 'block'
    const panelDisplay = await demo.getPanelDisplayStyle();
    expect(panelDisplay).toBe('block');

    // aria-hidden should be 'false' and button aria-expanded should be 'true'
    const panelAriaHidden = await demo.getPanelAriaHidden();
    expect(panelAriaHidden).toBe('false');

    const ariaExpanded = await demo.getButtonAriaExpanded();
    expect(ariaExpanded).toBe('true');

    // Button text should have changed to 'Hide Normalization Demo'
    const btnText = await demo.getButtonText();
    expect(btnText).toBe('Hide Normalization Demo');

    // Validate content still present
    await expect(demo.demoPanel.locator('h3')).toHaveText('Normalization Demo (static)');

    // Ensure no uncaught page errors after toggling
    expect(pageErrors.length, `No page errors expected after toggle, found: ${JSON.stringify(pageErrors)}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `No console.error expected after toggle, found: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Toggle back to Idle (S1 -> S0) and ensure attributes revert', async ({ page }) => {
    // This test validates toggling twice returns to idle state
    const demo = new DemoPage(page);
    await demo.goto();

    // Open
    await demo.clickToggle();
    await expect(demo.demoPanel).toBeVisible();
    expect(await demo.isPanelVisible()).toBe(true);

    // Close (trigger S1_DemoVisible -> S0_Idle)
    await demo.clickToggle();

    // Panel should be hidden again
    const panelDisplay = await demo.getPanelDisplayStyle();
    expect(panelDisplay).toBe('none');

    const panelAriaHidden = await demo.getPanelAriaHidden();
    expect(panelAriaHidden).toBe('true');

    const ariaExpanded = await demo.getButtonAriaExpanded();
    expect(ariaExpanded).toBe('false');

    const btnText = await demo.getButtonText();
    expect(btnText).toBe('Show Normalization Demo');

    // No page errors during toggling
    expect(pageErrors.length, `No page errors expected after toggling back, found: ${JSON.stringify(pageErrors)}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `No console.error expected after toggling back, found: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Rapid toggling and repeated clicks behave deterministically (edge case)', async ({ page }) => {
    // Edge case: user rapidly clicks the toggle button multiple times.
    // Validate that each click flips the visible state and no errors are thrown.
    const demo = new DemoPage(page);
    await demo.goto();

    // Perform a burst of clicks
    const clicks = 6;
    for (let i = 0; i < clicks; i++) {
      await demo.clickToggle();
      // small delay to let the DOM update after each click
      await page.waitForTimeout(20);
    }

    // After an even number of clicks (6), the panel should be back to initial hidden state
    expect(await demo.isPanelVisible()).toBe(false);
    expect(await demo.getPanelAriaHidden()).toBe('true');
    expect(await demo.getButtonAriaExpanded()).toBe('false');
    expect(await demo.getButtonText()).toBe('Show Normalization Demo');

    // No page errors from rapid interactions
    expect(pageErrors.length, `No page errors expected after rapid clicks, found: ${JSON.stringify(pageErrors)}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `No console.error expected after rapid clicks, found: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Clicking inside the panel does not hide it (behavior sanity check)', async ({ page }) => {
    // Ensure interactions inside the demo panel do not automatically hide the panel
    const demo = new DemoPage(page);
    await demo.goto();

    // Open the panel
    await demo.clickToggle();
    expect(await demo.isPanelVisible()).toBe(true);

    // Click within the panel content area (a pre element)
    const innerPre = page.locator('#demoPanel .tablelike pre').first();
    await expect(innerPre).toBeVisible();
    await innerPre.click();

    // Panel should remain visible after clicking inside it
    expect(await demo.isPanelVisible()).toBe(true);
    expect(await demo.getPanelAriaHidden()).toBe('false');

    // Close to clean up
    await demo.clickToggle();
    expect(await demo.isPanelVisible()).toBe(false);

    // No page errors from interacting inside the panel
    expect(pageErrors.length, `No page errors expected after interacting inside panel, found: ${JSON.stringify(pageErrors)}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `No console.error expected after interacting inside panel, found: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Observes console logs and page errors (observability test)', async ({ page }) => {
    // This test explicitly demonstrates observing console and page errors.
    // It asserts that the page does not emit uncaught exceptions (no ReferenceError/SyntaxError/TypeError).
    const demo = new DemoPage(page);
    await demo.goto();

    // Intentionally do nothing that would introduce errors; we only assert the observed arrays.
    // The goal is to "observe console logs and page errors" as required.
    // Assert we captured console messages (there may be none) and that none are error-level.
    const errorLevelConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorLevelConsole.length, `Expected zero console.error messages; found: ${JSON.stringify(errorLevelConsole)}`).toBe(0);

    // Assert no page errors
    const typesOfInterest = ['ReferenceError', 'SyntaxError', 'TypeError'];
    const pageErrorsOfInterest = pageErrors.filter(e => typesOfInterest.includes(e.name));
    // In this application the minimal inline script is correct; assert there are no critical JS errors.
    expect(pageErrorsOfInterest.length, `Expected no critical JS errors (Reference/Syntax/TypeError), found: ${JSON.stringify(pageErrorsOfInterest)}`).toBe(0);

    // We also assert the full pageErrors array is empty (no uncaught exceptions)
    expect(pageErrors.length, `Expected no uncaught page errors, found: ${JSON.stringify(pageErrors)}`).toBe(0);
  });
});