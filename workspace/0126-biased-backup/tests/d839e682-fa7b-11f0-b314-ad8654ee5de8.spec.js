import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d839e682-fa7b-11f0-b314-ad8654ee5de8.html';

/**
 * Page Object for the demo toggle and panel
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async navigate() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Element handles
  async toggleButton() {
    return this.page.locator('#toggleDemo');
  }
  async demoPanel() {
    return this.page.locator('#demoPanel');
  }
  async buttonRow() {
    return this.page.locator('.button-row[role="toolbar"][aria-label="demo controls"]');
  }

  // Actions
  async clickToggle() {
    await (await this.toggleButton()).click();
  }

  async pressToggleWithKeyboard() {
    const btn = await this.toggleButton();
    await btn.focus();
    await this.page.keyboard.press('Enter');
  }

  // Assertions helpers
  async expectPanelVisible() {
    const panel = await this.demoPanel();
    // style.display property should be 'block' when visible
    await expect(await panel.evaluate((el) => el.style.display)).toBe('block');
    await expect(await panel.getAttribute('aria-hidden')).toBe('false');
  }

  async expectPanelHidden() {
    const panel = await this.demoPanel();
    await expect(await panel.evaluate((el) => el.style.display)).toBe('none');
    await expect(await panel.getAttribute('aria-hidden')).toBe('true');
  }

  async expectButtonPressedTrue() {
    const btn = await this.toggleButton();
    await expect(await btn.getAttribute('aria-pressed')).toBe('true');
  }

  async expectButtonPressedFalse() {
    const btn = await this.toggleButton();
    await expect(await btn.getAttribute('aria-pressed')).toBe('false');
  }
}

test.describe('FSM tests for Refactoring — Toggle demonstration panel', () => {
  let demo;
  let consoleEvents = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Capture console events and page errors for assertions later
    consoleEvents = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleEvents.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    demo = new DemoPage(page);
    await demo.navigate();
  });

  test.afterEach(async () => {
    // nothing to teardown beyond the Playwright fixtures;
    // arrays reset in beforeEach
  });

  test('Initial Idle state: page renders and demo controls exist (S0_Idle evidence)', async ({ page }) => {
    // Verify the toolbar evidence exists (button-row with role toolbar)
    const toolbar = await page.locator('.button-row[role="toolbar"][aria-label="demo controls"]');
    await expect(toolbar).toHaveCount(1);

    // The toggle button should be present and initially aria-pressed="false"
    const toggle = await page.locator('#toggleDemo');
    await expect(toggle).toHaveCount(1);
    await expect(await toggle.getAttribute('aria-pressed')).toBe('false');

    // The demo panel should be present and initially hidden per FSM S2_DemoHidden evidence
    const panel = await page.locator('#demoPanel');
    await expect(panel).toHaveCount(1);
    // Inline style and attribute:
    await demo.expectPanelHidden();

    // Check that the page did not throw any page-level errors on load
    expect(pageErrors.length, `Expected no page errors on load, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // Check that console did not emit error-level messages on load
    const errorConsole = consoleEvents.filter(e => e.type === 'error');
    expect(errorConsole.length, `Expected no console.error messages on load, got: ${JSON.stringify(errorConsole)}`).toBe(0);
  });

  test('Toggle from Idle -> Demo Visible (S0_Idle -> S1_DemoVisible)', async ({ page }) => {
    // Click the toggle to show the demo (transition to S1_DemoVisible)
    await demo.clickToggle();

    // After click, panel should be visible and aria-hidden="false"
    await demo.expectPanelVisible();

    // Button aria-pressed should be true and label should change to "Hide rename demonstration"
    await demo.expectButtonPressedTrue();
    const btnText = await (await demo.toggleButton()).textContent();
    await expect(btnText.trim()).toBe('Hide rename demonstration');

    // Validate no page errors or console error messages were produced by the interaction
    expect(pageErrors.length, `Expected no page errors after showing demo, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    const errorConsole = consoleEvents.filter(e => e.type === 'error');
    expect(errorConsole.length, `Expected no console.error messages after showing demo, got: ${JSON.stringify(errorConsole)}`).toBe(0);
  });

  test('Toggle from Demo Visible -> Demo Hidden (S1_DemoVisible -> S2_DemoHidden)', async ({ page }) => {
    // Start by showing the demo
    await demo.clickToggle();
    await demo.expectPanelVisible();

    // Click again to hide (transition to S2_DemoHidden)
    await demo.clickToggle();

    // Panel should be hidden again and aria-hidden="true"
    await demo.expectPanelHidden();

    // Button aria-pressed should be false and text should be "Show rename demonstration"
    await demo.expectButtonPressedFalse();
    const btnText = await (await demo.toggleButton()).textContent();
    await expect(btnText.trim()).toBe('Show rename demonstration');

    // Ensure no runtime errors occurred during the hide transition
    expect(pageErrors.length, `Expected no page errors after hiding demo, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    const errorConsole = consoleEvents.filter(e => e.type === 'error');
    expect(errorConsole.length, `Expected no console.error messages after hiding demo, got: ${JSON.stringify(errorConsole)}`).toBe(0);
  });

  test('Cycle: Hidden -> Visible -> Hidden multiple times (S2 <-> S1 transitions)', async ({ page }) => {
    // Cycle toggle three times to test idempotent behavior and state toggling
    await demo.expectPanelHidden();

    // 1st click -> visible
    await demo.clickToggle();
    await demo.expectPanelVisible();

    // 2nd click -> hidden
    await demo.clickToggle();
    await demo.expectPanelHidden();

    // 3rd click -> visible again
    await demo.clickToggle();
    await demo.expectPanelVisible();

    // Final sanity: button pressed true
    await demo.expectButtonPressedTrue();

    // Confirm no page errors or console errors during rapid sequence
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleEvents.filter(e => e.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Keyboard activation: Enter on focused button toggles panel', async ({ page }) => {
    // Ensure starting hidden
    await demo.expectPanelHidden();

    // Press Enter to activate toggle (keyboard activation should simulate click)
    await demo.pressToggleWithKeyboard();
    await demo.expectPanelVisible();
    await demo.expectButtonPressedTrue();

    // Press Enter again to hide
    await demo.pressToggleWithKeyboard();
    await demo.expectPanelHidden();
    await demo.expectButtonPressedFalse();

    // Ensure no errors
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleEvents.filter(e => e.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Clicking non-toggle elements does not affect the demo panel (edge case)', async ({ page }) => {
    // Click the descriptive small span next to the button - should NOT toggle
    const infoSpan = page.locator('.button-row .small');
    await expect(infoSpan).toHaveCount(1);

    // Ensure panel is hidden initially
    await demo.expectPanelHidden();

    // Click the span
    await infoSpan.click();

    // Panel should remain hidden
    await demo.expectPanelHidden();
    await demo.expectButtonPressedFalse();

    // Now click the panel content area (which is hidden) - focus on safety: ensure no exceptions
    // We will click the demo container (which is hidden) - clicking hidden element with Playwright will throw,
    // so we check that it is not visible and avoid clicking it to follow safe behavior.
    const panel = page.locator('#demoPanel');
    await expect(panel).not.toBeVisible();

    // Ensure no runtime errors from interacting with non-toggle elements
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleEvents.filter(e => e.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Verify FSM entry/exit helpers (presence/absence of functions referenced in FSM)', async ({ page }) => {
    // The FSM lists entry/exit actions like renderPage(), showDemoPanel(), hideDemoPanel()
    // The implementation does not define these as global functions. We assert their absence
    // rather than trying to call them (per instructions: do not patch or inject globals).

    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    const showDemoPanelType = await page.evaluate(() => typeof window.showDemoPanel);
    const hideDemoPanelType = await page.evaluate(() => typeof window.hideDemoPanel);

    // Expect that these helpers are not defined on the global window object in this implementation.
    // This validates that the FSM's documented entry/exit actions are not implemented as named globals here.
    expect(renderPageType).toBe('undefined');
    expect(showDemoPanelType).toBe('undefined');
    expect(hideDemoPanelType).toBe('undefined');

    // Confirm that instead the functionality is provided by an inline event listener on the toggle button:
    // We validate behavior by toggling and observing DOM changes (already tested elsewhere).
    await demo.clickToggle();
    await demo.expectPanelVisible();

    // Ensure no page errors were raised while verifying presence/absence of functions
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleEvents.filter(e => e.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Edge case: rapid double-clicks should still produce a deterministic final state', async ({ page }) => {
    // Start hidden
    await demo.expectPanelHidden();

    const btn = await demo.toggleButton();

    // Rapidly click twice; because the handler toggles, two clicks should return to original hidden state
    await btn.dblclick();

    // After double-click, behavior could be show->hide; assert panel is hidden (deterministic)
    // Note: Because dblclick may fire two click events, final state should be same as initial.
    await demo.expectPanelHidden();

    // Now triple click (three clicks) should end up visible
    await btn.click();
    await btn.click();
    await btn.click();

    // After three clicks starting from hidden -> visible
    await demo.expectPanelVisible();

    // No runtime errors from rapid interactions
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleEvents.filter(e => e.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Observability: capture console messages and page errors throughout interactions', async ({ page }) => {
    // This test demonstrates collection of console events and page errors during multiple interactions.
    // We'll perform interactions and then assert that no console.error or uncaught exceptions occurred.

    // Interactions:
    await demo.expectPanelHidden();
    await demo.clickToggle();
    await demo.clickToggle();
    await demo.clickToggle();
    await demo.clickToggle();

    // After interactions, we expect no page errors or console.error messages
    expect(pageErrors.length, `Page errors were observed: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    const errors = consoleEvents.filter(e => e.type === 'error');
    // If there are any console.error messages, fail and include them for debugging.
    expect(errors.length, `console.error messages were observed: ${JSON.stringify(errors)}`).toBe(0);

    // Also assert that console messages (if any) are not of type 'error'
    for (const evt of consoleEvents) {
      expect(evt.type).not.toBe('error');
    }
  });
});