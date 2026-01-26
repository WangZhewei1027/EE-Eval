import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a0ec23-fa7b-11f0-8b01-9f078a0ff214.html';
const DEMO_BUTTON_SELECTOR = 'button[onclick]';
const EXPECTED_ALERT_MESSAGE = "This is a simple demonstration of Radix Sort. For now, please focus on the textual explanations provided above!";

/**
 * Page Object Model for the Radix Sort demo page.
 * Encapsulates common interactions and selectors.
 */
class RadixPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = '.container';
    this.header = 'h1';
    this.demoButton = DEMO_BUTTON_SELECTOR;
    this.pageErrors = [];
    this.consoleMessages = [];
    this.dialogMessages = [];
  }

  async goto() {
    // Navigate to the provided URL and wait for full load
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Wire up listeners for console messages, page errors and dialogs.
  async attachObservers() {
    this.page.on('pageerror', (err) => {
      // capture runtime errors (ReferenceError, TypeError, etc.)
      this.pageErrors.push(err);
    });
    this.page.on('console', (msg) => {
      // capture console messages for inspection
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('dialog', async (dialog) => {
      // capture dialog messages; automatically accept alerts so tests proceed
      this.dialogMessages.push({ type: dialog.type(), message: dialog.message() });
      try {
        await dialog.accept();
      } catch (err) {
        // If accepting fails, capture as a page error for assertions
        this.pageErrors.push(err);
      }
    });
  }

  async getDemoButton() {
    return this.page.locator(this.demoButton);
  }

  async clickDemoButton() {
    // Wait for visibility before clicking to make tests more stable
    await this.page.waitForSelector(this.demoButton, { state: 'visible' });
    await this.page.click(this.demoButton);
  }

  async getOnclickAttribute() {
    const el = await this.getDemoButton();
    return el.getAttribute('onclick');
  }

  async getHeaderText() {
    return this.page.textContent(this.header);
  }

  async countPageErrors() {
    return this.pageErrors.length;
  }

  async countConsoleMessages() {
    return this.consoleMessages.length;
  }

  async countDialogMessages() {
    return this.dialogMessages.length;
  }
}

test.describe('Understanding Radix Sort - Interactive Application (S0_Idle)', () => {
  // Use a fresh page for each test; attach observers per test
  test.beforeEach(async ({ page }) => {
    // No-op here; individual tests will construct RadixPage and call attachObservers/goto
  });

  test.afterEach(async ({ page }) => {
    // Ensure the page is closed after each test for cleanliness (Playwright fixture will handle it)
    try {
      await page.close();
    } catch {
      // ignore any close errors
    }
  });

  test('Page loads and Idle state is rendered (entry content present)', async ({ page }) => {
    // This test validates the Idle state visual rendering and that entry content is present.
    const rp = new RadixPage(page);
    await rp.attachObservers();
    await rp.goto();

    // Assert main container and header exist and contain expected content
    const headerText = await rp.getHeaderText();
    expect(headerText).toBeTruthy();
    expect(headerText).toContain('Understanding Radix Sort');

    // The page content (explanations) should be present showing that the page rendered even if no renderPage() function exists.
    const containerVisible = await page.isVisible(rp.container);
    expect(containerVisible).toBe(true);

    // There should be no runtime page errors on initial load
    expect(await rp.countPageErrors()).toBe(0);
  });

  test('Demonstration button exists with expected text and onclick attribute', async ({ page }) => {
    // This test validates the button component described in the FSM components section.
    const rp = new RadixPage(page);
    await rp.attachObservers();
    await rp.goto();

    const demoButton = await rp.getDemoButton();
    await expect(demoButton).toBeVisible();

    // Check button text
    const buttonText = await demoButton.textContent();
    expect(buttonText.trim()).toBe('Demonstration');

    // Verify the onclick attribute contains the expected alert invocation
    const onclickAttr = await rp.getOnclickAttribute();
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain("alert(");
    expect(onclickAttr).toContain(EXPECTED_ALERT_MESSAGE);

    // No unexpected page errors from merely reading attributes
    expect(await rp.countPageErrors()).toBe(0);
  });

  test('Clicking Demonstration triggers an alert dialog with the correct message (transition verification)', async ({ page }) => {
    // This test exercises the FSM event DemonstrationClick and verifies the transition's observable (alert dialog).
    const rp = new RadixPage(page);
    await rp.attachObservers();
    await rp.goto();

    // Use waitForEvent to reliably capture the alert dialog that results from the click
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      rp.clickDemoButton()
    ]);

    // Validate dialog type and message exactly match the expected string from FSM/evidence
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe(EXPECTED_ALERT_MESSAGE);

    // Accepting the dialog should have been handled by the page.on('dialog') observer as well.
    // Confirm that our dialog observer captured the dialog message.
    // Give a microtick so the observer's push has processed
    await page.waitForTimeout(10);
    expect(await rp.countDialogMessages()).toBeGreaterThanOrEqual(1);
    const lastDialog = rp.dialogMessages[rp.dialogMessages.length - 1];
    expect(lastDialog.message).toBe(EXPECTED_ALERT_MESSAGE);

    // No runtime page errors should have been produced by showing/accepting the alert
    expect(await rp.countPageErrors()).toBe(0);
  });

  test('Repeated Demonstration clicks produce multiple alerts without JS errors (robustness / edge-case)', async ({ page }) => {
    // This test clicks the demonstration button multiple times in succession and ensures multiple alerts appear and are handled.
    const rp = new RadixPage(page);
    await rp.attachObservers();
    await rp.goto();

    const times = 3;
    const capturedMessages = [];

    for (let i = 0; i < times; i++) {
      // Use waitForEvent to ensure we capture each dialog and accept it immediately
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click(DEMO_BUTTON_SELECTOR)
      ]);
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe(EXPECTED_ALERT_MESSAGE);
      // Accepting here so the next iteration can proceed
      await dialog.accept();
      capturedMessages.push(dialog.message());
    }

    // Ensure we captured the expected number of alerts and messages match the expected string
    expect(capturedMessages.length).toBe(times);
    for (const msg of capturedMessages) {
      expect(msg).toBe(EXPECTED_ALERT_MESSAGE);
    }

    // Confirm our observer also saw the dialogs
    expect(await rp.countDialogMessages()).toBeGreaterThanOrEqual(times);

    // Confirm no page errors occurred during rapid interactions
    expect(await rp.countPageErrors()).toBe(0);
  });

  test('FSM onEnter entry action "renderPage" verification (check for presence or absence)', async ({ page }) => {
    // The FSM describes an entry action renderPage(). Verify whether such a function exists on the page
    // and assert no ReferenceError was emitted about it (i.e., it was not implicitly invoked causing errors).
    const rp = new RadixPage(page);
    await rp.attachObservers();
    await rp.goto();

    // Check whether a global function named renderPage exists
    const renderPageType = await page.evaluate(() => {
      // Do not call renderPage(); just inspect its existence and type.
      return typeof window.renderPage;
    });

    // In this particular implementation, renderPage is not defined, so we expect 'undefined'.
    // We assert this explicitly to validate the onEnter action is not present/was not run.
    expect(renderPageType).toBe('undefined');

    // Ensure no ReferenceError related to renderPage was thrown during page load.
    const pageErrors = rp.pageErrors.map(e => String(e));
    const hasRenderPageRefError = pageErrors.some(e => e.includes('renderPage') && /ReferenceError/i.test(e));
    expect(hasRenderPageRefError).toBe(false);

    // General assertion: still no runtime errors overall
    expect(await rp.countPageErrors()).toBe(0);
  });

  test('Edge case: attempting to interact with a non-existent selector yields an expected Playwright error', async ({ page }) => {
    // This edge case ensures invalid interactions are surfaced as errors and handled by the test harness.
    const rp = new RadixPage(page);
    await rp.attachObservers();
    await rp.goto();

    // Attempting to click a missing selector should reject; assert that Playwright throws.
    // We expect this action to reject with an error (no node found).
    await expect(page.click('#nonexistent-element-hopefully-not-present')).rejects.toThrow();
  });

  test('Observe console messages and page errors during normal interactions', async ({ page }) => {
    // This test collects console logs and page errors and asserts reasonable expectations about them.
    const rp = new RadixPage(page);
    await rp.attachObservers();
    await rp.goto();

    // Trigger a demonstration alert to generate dialog-related activity
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      rp.clickDemoButton()
    ]);
    await dialog.accept();

    // Give small time for console/pageerror events to flush
    await page.waitForTimeout(20);

    // The application is mostly static and should not produce runtime exceptions; assert none occurred
    expect(await rp.countPageErrors()).toBe(0);

    // Console messages may or may not exist; at minimum ensure captured console messages array exists and is an array
    const consoleCount = await rp.countConsoleMessages();
    expect(Array.isArray(rp.consoleMessages)).toBe(true);
    expect(consoleCount).toBeGreaterThanOrEqual(0); // non-strict: page may not produce any console logs

    // If there are any console.error-level messages, surface them as a diagnostic failure (optional strictness)
    const consoleErrors = rp.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});