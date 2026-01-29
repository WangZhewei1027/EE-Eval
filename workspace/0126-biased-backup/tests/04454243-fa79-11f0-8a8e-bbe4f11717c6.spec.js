import { test, expect } from '@playwright/test';

// Test suite for Application ID: 04454243-fa79-11f0-8a8e-bbe4f11717c6
// The HTML is served at:
// http://127.0.0.1:5500/workspace/0126-biased/html/04454243-fa79-11f0-8a8e-bbe4f11717c6.html
//
// These tests validate the FSM states and transitions described in the FSM:
// - S0_Idle (initial page render)
// - S1_Signed (alert triggered by sign())
// - S2_Sig (alert triggered by sig())
//
// Tests also observe console messages and page errors, and assert expected behavior.
// The tests intentionally do NOT modify the page environment and let any runtime errors
// occur naturally; we only observe and assert their presence or absence.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04454243-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object encapsulating operations on the Digital Signature page
class DigitalSignaturePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.signButton = page.locator('.button[onclick="sign()"]');
    this.sigButton = page.locator('.button[onclick="sig()"]');
    this.signatureText = page.locator('.signature');
    this.container = page.locator('.container');
    this.footer = page.locator('.footer');
  }

  // Navigate to the application
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Click the Sign button and wait for the alert dialog, returning the dialog
  async clickSignAndWaitForDialog() {
    return Promise.all([
      this.page.waitForEvent('dialog'),
      this.signButton.click()
    ]).then(([dialog]) => dialog);
  }

  // Click the Sig button and wait for the alert dialog, returning the dialog
  async clickSigAndWaitForDialog() {
    return Promise.all([
      this.page.waitForEvent('dialog'),
      this.sigButton.click()
    ]).then(([dialog]) => dialog);
  }

  // Utility: click a locator and return the dialog promise (not used if no dialog expected)
  async clickAndWaitForDialog(locator) {
    return Promise.all([
      this.page.waitForEvent('dialog'),
      locator.click()
    ]).then(([dialog]) => dialog);
  }
}

test.describe('Digital Signatures - FSM states and transitions', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Register listeners before each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages with their type and text
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // If reading console message throws for some reason, capture minimal info
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // err is an Error object; store its message for assertions
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Load the application page as-is
    const app = new DigitalSignaturePage(page);
    await app.goto();
  });

  test.afterEach(async ({ }, testInfo) => {
    // Basic sanity assertions after each test to surface console/page errors if any.
    // We do not mutate the page or inject behavior; we simply assert the observed state.
    // It's acceptable for these to be empty in a healthy run.
    // Attach console and pageerror summary for easier debugging when a test fails.
    if (pageErrors.length > 0) {
      // If there are page errors, fail the test with details
      throw new Error(`Page errors detected during test "${testInfo.title}":\n- ${pageErrors.join('\n- ')}`);
    }
    // No explicit fail on console messages of other types (info/debug), but surface errors
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    if (errorConsoleMessages.length > 0) {
      throw new Error(`Console errors detected during test "${testInfo.title}":\n- ${errorConsoleMessages.map(m => m.text).join('\n- ')}`);
    }
  });

  test('Initial Idle state renders correctly and expected DOM elements exist (S0_Idle)', async ({ page }) => {
    // This test validates the Idle state:
    // - page title and main container are present,
    // - signature text and both buttons exist,
    // - FSM-claimed entry action renderPage() is NOT present in the runtime (we observe actual page)
    const app = new DigitalSignaturePage(page);

    // Title should match the HTML title element
    await expect(page).toHaveTitle(/Digital Signatures/);

    // Main structure visible
    await expect(app.container).toBeVisible();
    await expect(app.signatureText).toBeVisible();
    await expect(app.signatureText).toHaveText('Digital Signature');

    // Both buttons must exist and be visible with expected text
    await expect(app.signButton).toBeVisible();
    await expect(app.sigButton).toBeVisible();
    await expect(app.signButton).toHaveText('Sign');
    await expect(app.sigButton).toHaveText('Sig');

    // Verify that the functions sign and sig exist on the window as expected.
    // These functions are responsible for the alert entry actions for S1_Signed and S2_Sig.
    const signType = await page.evaluate(() => typeof window.sign);
    const sigType = await page.evaluate(() => typeof window.sig);
    expect(signType).toBe('function');
    expect(sigType).toBe('function');

    // FSM S0 entry action mentions renderPage(); verify whether renderPage exists in the runtime.
    // We do not call or create anything; we only observe. If renderPage is missing, that indicates
    // the FSM's declared entry_action is not implemented in the page's JS.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    // We expect it to be undefined because the HTML does not define renderPage()
    expect(renderPageType).toBe('undefined');
  });

  test('Sign button click triggers "Signed with digital signature" alert (Transition: S0 -> S1)', async ({ page }) => {
    // This test validates the transition triggered by clicking the Sign button
    // and the associated onEnter action (alert with the expected message).
    const app = new DigitalSignaturePage(page);

    // Click the sign button and capture the dialog
    const dialog = await app.clickSignAndWaitForDialog();

    // Validate the dialog message
    expect(dialog.message()).toBe('Signed with digital signature');

    // Accept the alert to close it, as real users would
    await dialog.accept();

    // Verify there were no uncaught page errors or console errors during the interaction.
    // Note: these assertions will be checked again in afterEach which throws if any error occurred.
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Sig button click triggers "Signed with signature" alert (Transition: S0 -> S2)', async ({ page }) => {
    // This test validates the transition triggered by clicking the Sig button
    // and the alert shown as an onEnter action for S2_Sig.
    const app = new DigitalSignaturePage(page);

    const dialog = await app.clickSigAndWaitForDialog();
    expect(dialog.message()).toBe('Signed with signature');
    await dialog.accept();

    // Additional assertions: ensure sign and sig functions remain available after dialog interactions
    const signTypeAfter = await page.evaluate(() => typeof window.sign);
    const sigTypeAfter = await page.evaluate(() => typeof window.sig);
    expect(signTypeAfter).toBe('function');
    expect(sigTypeAfter).toBe('function');
  });

  test('Edge case: multiple rapid clicks produce corresponding alerts each time', async ({ page }) => {
    // This test ensures repeated interactions produce repeated transitions/alerts.
    // We'll click the Sign button twice in sequence and assert two dialogs show up with expected messages.
    const app = new DigitalSignaturePage(page);

    // First click -> dialog1
    const dialog1Promise = page.waitForEvent('dialog');
    await app.signButton.click();
    const dialog1 = await dialog1Promise;
    expect(dialog1.message()).toBe('Signed with digital signature');
    await dialog1.accept();

    // Second click -> dialog2
    const dialog2Promise = page.waitForEvent('dialog');
    await app.signButton.click();
    const dialog2 = await dialog2Promise;
    expect(dialog2.message()).toBe('Signed with digital signature');
    await dialog2.accept();

    // Now repeat for Sig button twice in sequence
    const dialog3Promise = page.waitForEvent('dialog');
    await app.sigButton.click();
    const dialog3 = await dialog3Promise;
    expect(dialog3.message()).toBe('Signed with signature');
    await dialog3.accept();

    const dialog4Promise = page.waitForEvent('dialog');
    await app.sigButton.click();
    const dialog4 = await dialog4Promise;
    expect(dialog4.message()).toBe('Signed with signature');
    await dialog4.accept();
  });

  test('Edge case: alternating clicks between Sign and Sig produce appropriate alerts', async ({ page }) => {
    // Validate that switching between transitions produces the expected alerts each time.
    const app = new DigitalSignaturePage(page);

    // Sign -> Sig -> Sign -> Sig
    const sequence = [
      { locator: app.signButton, expected: 'Signed with digital signature' },
      { locator: app.sigButton, expected: 'Signed with signature' },
      { locator: app.signButton, expected: 'Signed with digital signature' },
      { locator: app.sigButton, expected: 'Signed with signature' }
    ];

    for (const step of sequence) {
      const dialogPromise = page.waitForEvent('dialog');
      await step.locator.click();
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe(step.expected);
      await dialog.accept();
    }
  });

  test('Observe console messages and page errors during normal usage (no unexpected errors)', async ({ page }) => {
    // This test intentionally observes console and page errors while performing actions,
    // then asserts that there are no unexpected runtime errors.
    const app = new DigitalSignaturePage(page);

    // Perform a couple of interactions
    const d1 = await app.clickSignAndWaitForDialog();
    expect(d1.message()).toBe('Signed with digital signature');
    await d1.accept();

    const d2 = await app.clickSigAndWaitForDialog();
    expect(d2.message()).toBe('Signed with signature');
    await d2.accept();

    // At this point, we expect no uncaught page errors and no console errors.
    // The afterEach hook will also throw if there are any; we assert here for clarity.
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Verify presence and attributes of UI components as described in FSM components section', async ({ page }) => {
    // This test checks that the components enumerated in the FSM (two buttons) are present
    // with the expected selectors and text content.
    const app = new DigitalSignaturePage(page);

    // Check that the sign button selector from FSM resolves to an element and contains expected text
    await expect(page.locator(".button[onclick='sign()']")).toHaveCount(1);
    await expect(page.locator(".button[onclick='sign()']")).toHaveText('Sign');

    // Check that the sig button selector from FSM resolves to an element and contains expected text
    await expect(page.locator(".button[onclick='sig()']")).toHaveCount(1);
    await expect(page.locator(".button[onclick='sig()']")).toHaveText('Sig');
  });

  test('Error scenario exploration: assert renderPage is missing (FSM claims an entry action not implemented)', async ({ page }) => {
    // The FSM specified an entry action renderPage() for S0_Idle.
    // The HTML implementation does not define renderPage; we validate that this mismatch exists.
    // We do not attempt to call or define renderPage (per instruction), we only observe.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Because renderPage is absent, there should be no ReferenceError raised by the page
    // at load time (the HTML does not call renderPage). Confirm no page errors were recorded.
    expect(pageErrors.length).toBe(0);
  });
});