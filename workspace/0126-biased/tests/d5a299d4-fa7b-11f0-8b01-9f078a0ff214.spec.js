import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a299d4-fa7b-11f0-8b01-9f078a0ff214.html';
const ALERT_TEXT = "Simulating TCP Slow Start: Starting with a window size of 1 packet. The window doubles with each round trip until a loss is detected...";

class CongestionControlPage {
  /**
   * Page object for the Congestion Control demo page.
   * Encapsulates commonly used selectors and actions.
   */
  constructor(page) {
    this.page = page;
    this.header = page.locator('header h1');
    this.simButton = page.locator('button[onclick]');
    this.articles = page.locator('article');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtonText() {
    return (await this.simButton.textContent())?.trim();
  }

  async getOnclickAttribute() {
    return this.simButton.getAttribute('onclick');
  }

  async clickButtonAndAcceptAlert() {
    // Use the dialog handler to capture and accept the alert with its message.
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.simButton.click()
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  async clickButtonWithoutHandlingDialog() {
    // Intentionally click without waiting for dialog to test behavior that would produce an unhandled dialog
    // (This is an edge case; Playwright will throw if a dialog is not handled when it appears before navigation).
    await this.simButton.click();
  }
}

test.describe('d5a299d4-fa7b-11f0-8b01-9f078a0ff214 - Understanding Congestion Control App', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and categorize them
    page.on('console', msg => {
      const type = msg.type(); // 'log', 'error', 'warning', etc.
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    // Capture unhandled page errors (runtime exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the app (load exactly as-is)
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // no-op; page context is cleaned up by Playwright automatically
  });

  test('S0_Idle: Page renders correctly and initial Idle state is present', async ({ page }) => {
    // Validate initial render and Idle state's expected evidence (button exists)
    const app = new CongestionControlPage(page);

    // Verify header text (sanity check that the page loaded)
    await expect(app.header).toBeVisible();
    await expect(app.header).toHaveText('Understanding Congestion Control in Networking');

    // Verify there is at least one article and the content is visible
    await expect(app.articles.first()).toBeVisible();

    // Verify the Show Simulation button exists and has the expected label
    await expect(app.simButton).toBeVisible();
    const btnText = await app.getButtonText();
    expect(btnText).toBe('Show Simulation');

    // Verify the inline onclick attribute exists and contains the expected alert text
    const onclickAttr = await app.getOnclickAttribute();
    expect(onclickAttr).toContain("alert(");
    expect(onclickAttr).toContain('Simulating TCP Slow Start');

    // According to FSM, entering S0 triggers renderPage() (not implemented).
    // We assert that the page content is rendered (practical observable).
    const articleCount = await app.articles.count();
    expect(articleCount).toBeGreaterThanOrEqual(1);

    // Ensure no runtime page errors occurred during initial load
    // (We assert there are none; this documents whether runtime errors happen naturally.)
    expect(pageErrors.length).toBe(0);
    // Ensure no console 'error' messages were emitted during load
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition ShowSimulation: clicking the button triggers the alert (S0 -> S1)', async ({ page }) => {
    // This test validates the FSM transition from Idle to SimulationShown by clicking the button
    const app = new CongestionControlPage(page);

    // Click the button and capture the alert dialog
    const message = await app.clickButtonAndAcceptAlert();

    // The alert message should exactly match the inline alert message
    expect(message).toBe(ALERT_TEXT);

    // After the alert, there are no DOM changes expected in this simple implementation,
    // but we assert the button is still present (idempotence of UI)
    await expect(app.simButton).toBeVisible();

    // No unexpected page errors should have been raised by the click/alert action
    expect(pageErrors.length).toBe(0);
  });

  test('S1_SimulationShown entry action: alert is produced when the simulation is shown (explicit check)', async ({ page }) => {
    // This test re-validates that showing the simulation causes an alert (entry action)
    const app = new CongestionControlPage(page);

    // Use keyboard activation as an alternative trigger (Edge case)
    await app.simButton.focus();
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.keyboard.press('Enter')
    ]);
    expect(dialog.message()).toBe(ALERT_TEXT);
    await dialog.accept();

    // Confirm the onclick attribute is still present and unchanged
    const onclickAttr = await app.getOnclickAttribute();
    expect(onclickAttr).toContain('Simulating TCP Slow Start');

    // Ensure no runtime errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Multiple rapid clicks produce multiple alerts in sequence', async ({ page }) => {
    // Validate behavior when clicking the button multiple times in quick succession.
    // Each click should produce an alert with the same message.
    const app = new CongestionControlPage(page);

    // We'll click 3 times and handle each dialog sequentially.
    const alertMessages = [];
    for (let i = 0; i < 3; i++) {
      const msg = await app.clickButtonAndAcceptAlert();
      alertMessages.push(msg);
    }

    // All alert messages should match the expected alert text
    expect(alertMessages.length).toBe(3);
    for (const m of alertMessages) {
      expect(m).toBe(ALERT_TEXT);
    }

    // Ensure no runtime page errors were produced by repeated interaction
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Attempting to click a non-existent selector should throw an error (error scenario)', async ({ page }) => {
    // This test intentionally attempts to interact with a selector that does not exist
    // to validate the application's test harness handles user-errors properly.
    // We do not modify the page; we simply attempt the action and assert Playwright throws.
    const missingSelector = page.locator('button[onclick="nonExistentHandler()"]');
    let caught = null;
    try {
      // This will time out or throw because the locator resolves to 0 elements when click is attempted with strictness
      await missingSelector.click({ timeout: 1000 });
    } catch (err) {
      caught = err;
    }
    expect(caught).not.toBeNull();
    // The thrown error should be an instance of Error and should contain some indication of missing element
    expect(caught.message).toBeTruthy();
  });

  test('Observability: capture console messages and page errors across interactions', async ({ page }) => {
    // This test demonstrates collection and assertion of console messages and page errors while interacting.
    const app = new CongestionControlPage(page);

    // Interact: trigger the alert once
    const msg = await app.clickButtonAndAcceptAlert();
    expect(msg).toBe(ALERT_TEXT);

    // After interactions, assert that console messages captured are of expected shapes (we don't require any specific logs)
    // We at least assert that the consoleMessages array is an array and contains objects with type/text
    expect(Array.isArray(consoleMessages)).toBe(true);
    for (const item of consoleMessages) {
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('text');
    }

    // Finally assert that no runtime exceptions were produced
    expect(pageErrors.length).toBe(0);

    // Document that no console 'error' level messages were observed during these interactions
    expect(consoleErrors.length).toBe(0);
  });
});