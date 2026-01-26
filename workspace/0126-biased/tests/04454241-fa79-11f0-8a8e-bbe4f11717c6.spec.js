import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04454241-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object for the application under test
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Collect runtime errors and console messages for assertions
    this.pageErrors = [];
    this.consoleMessages = [];

    // Listen for uncaught exceptions on the page
    this.page.on('pageerror', (err) => {
      // err is an Error object
      this.pageErrors.push(err);
    });

    // Collect console messages for further assertions
    this.page.on('console', (msg) => {
      this.consoleMessages.push(msg);
    });
  }

  // Navigation helper
  async goto() {
    // Ensure listeners are attached before navigation to capture load-time errors
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // DOM helpers
  headerLocator() {
    return this.page.locator('.header');
  }

  footerLocator() {
    return this.page.locator('.footer');
  }

  encryptionButtonLocator() {
    return this.page.locator('#encryption-button');
  }

  decryptionButtonLocator() {
    return this.page.locator('#decryption-button');
  }

  visualizationButtonLocator() {
    return this.page.locator('#visualization-button');
  }

  async headerText() {
    return this.page.textContent('.header');
  }

  async footerText() {
    return this.page.textContent('.footer');
  }

  async hasEncryptionButton() {
    return (await this.encryptionButtonLocator().count()) > 0;
  }

  async hasDecryptionButton() {
    return (await this.decryptionButtonLocator().count()) > 0;
  }

  async hasVisualizationButton() {
    return (await this.visualizationButtonLocator().count()) > 0;
  }

  // Attempt to click the encryption button; do not swallow the error so tests can assert it
  async clickEncryption(options = {}) {
    return this.encryptionButtonLocator().click(options);
  }

  async clickDecryption(options = {}) {
    return this.decryptionButtonLocator().click(options);
  }

  async clickVisualization(options = {}) {
    return this.visualizationButtonLocator().click(options);
  }
}

test.describe('04454241-fa79-11f0-8a8e-bbe4f11717c6 - Asymmetric Cryptography FSM Tests', () => {
  // Validate the Idle state (S0_Idle) and presence of basic page structure
  test('S0_Idle: page structure contains header and footer; script errors are captured on load', async ({ page }) => {
    const app = new AppPage(page);

    // Navigate to the application page
    await app.goto();

    // The FSM's Idle evidence includes .header and .footer — verify they are present and visible
    await expect(app.headerLocator()).toBeVisible();
    await expect(app.footerLocator()).toBeVisible();

    // Check that the textual content expected for header/footer exists (basic sanity)
    const headerText = await app.headerText();
    const footerText = await app.footerText();
    expect(headerText).toContain('Asymmetric Cryptography');
    expect(footerText).toContain('© 2023 Asymmetric Cryptography Example');

    // According to the provided HTML the three interactive buttons (#encryption-button, #decryption-button, #visualization-button)
    // are referenced in the script but are not actually present in the DOM.
    // Confirm they are absent (edge case)
    expect(await app.hasEncryptionButton()).toBe(false);
    expect(await app.hasDecryptionButton()).toBe(false);
    expect(await app.hasVisualizationButton()).toBe(false);

    // The application's inline script attempts to attach event listeners to elements that do not exist.
    // This should produce runtime page errors during load. Assert that at least one pageerror was captured.
    expect(app.pageErrors.length).toBeGreaterThan(0);

    // The error message should indicate problems with addEventListener on null / cannot read property.
    // We allow for variations in browser error messaging by using a flexible regex.
    const combinedMessages = app.pageErrors.map((e) => e.message).join(' | ');
    expect(combinedMessages).toMatch(/addEventListener|Cannot read properties|cannot read property|null/i);
  });

  // Tests for transition: EncryptionClick -> S1_Encrypting
  test('Transition EncryptionClick: clicking encryption should not succeed (button missing) and errors should be present', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // Validate precondition: encryption button is not present
    expect(await app.hasEncryptionButton()).toBe(false);

    // Attempt to click the encryption button; this should fail because the element does not exist.
    // We assert that the click attempt throws and that the error message indicates a timeout / waiting / no element.
    let clickError = null;
    try {
      // Set a small timeout so the failure happens quickly in the test
      await app.clickEncryption({ timeout: 1000 });
    } catch (err) {
      clickError = err;
    }
    expect(clickError).not.toBeNull();
    expect(clickError.message).toMatch(/(waiting for|timeout|element|No node|was not found)/i);

    // The inline script also creates blobs and references undefined blob URL variables (e.g., encryptedDataBlobURL).
    // Because addEventListener attachment already failed, the ensuing ReferenceError may or may not be present.
    // Assert that at least one pageerror was captured that is related to script execution (evidence of broken handlers).
    expect(app.pageErrors.length).toBeGreaterThan(0);

    // If available, confirm that some error message references elements of the encryption handler logic,
    // such as "encryption" or "encrypted" or "encrypted-data.txt" or variable names — be permissive in matching.
    const foundRelevant = app.pageErrors.some((e) =>
      /encryption|encrypted|encrypted-data|encryptedDataBlobURL|addEventListener/i.test(e.message)
    );
    // It's acceptable if this is false depending on the exact failure ordering; but at minimum we must have a script error.
    expect(app.pageErrors.length).toBeGreaterThan(0);
  });

  // Tests for transition: DecryptionClick -> S2_Decrypting
  test('Transition DecryptionClick: clicking decryption should not succeed (button missing) and errors should be present', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // Validate precondition: decryption button is not present
    expect(await app.hasDecryptionButton()).toBe(false);

    // Attempt to click; expect failure due to missing element
    let clickError = null;
    try {
      await app.clickDecryption({ timeout: 1000 });
    } catch (err) {
      clickError = err;
    }
    expect(clickError).not.toBeNull();
    expect(clickError.message).toMatch(/(waiting for|timeout|element|No node|was not found)/i);

    // Verify that script errors were captured (script attempted to reference DOM elements / variables)
    expect(app.pageErrors.length).toBeGreaterThan(0);

    // Check for any console error messages indicating reference to decryption logic or blobs
    const consoleErrorMsgs = app.consoleMessages.filter((m) => m.type() === 'error').map((m) => m.text());
    // We allow zero or more console errors; at least the pageErrors should exist
    expect(app.pageErrors.length).toBeGreaterThan(0);
  });

  // Tests for transition: VisualizationClick -> S3_Visualizing
  test('Transition VisualizationClick: clicking visualize should not succeed (button missing) and errors should be present', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // Validate precondition: visualization button is not present
    expect(await app.hasVisualizationButton()).toBe(false);

    // Attempt to click; expect failure
    let clickError = null;
    try {
      await app.clickVisualization({ timeout: 1000 });
    } catch (err) {
      clickError = err;
    }
    expect(clickError).not.toBeNull();
    expect(clickError.message).toMatch(/(waiting for|timeout|element|No node|was not found)/i);

    // Ensure at least one runtime error was captured during load
    expect(app.pageErrors.length).toBeGreaterThan(0);

    // If the visualization handler had run, it would download visualization-data.txt via a created link.
    // Because the DOM/button isn't present and script errors occurred, no download should have happened.
    // We check that no navigation or download was triggered by ensuring there are no console messages indicating such.
    const downloadConsole = app.consoleMessages.map((m) => m.text()).join(' ');
    expect(downloadConsole.toLowerCase()).not.toContain('visualization-data.txt');
  });

  // Edge case tests and validation of expected onEnter actions evidence
  test('Edge cases: verify that critical runtime errors reference addEventListener or undefined blob URL variables', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // Aggregate page error messages for easier assertions
    const messages = app.pageErrors.map((e) => e.message).join(' || ');

    // The FSM evidence suggests the code attempts to attach event handlers:
    // "encryptionButton.addEventListener('click', () => {" should be present in the script source.
    // Because the elements are missing, a TypeError about addEventListener is expected.
    expect(messages).toMatch(/addEventListener/i);

    // The implementation also references undefined variables like encryptedDataBlobURL, decryptedDataBlobURL, visualizationBlobURL.
    // Depending on execution order we may or may not see ReferenceError messages for those.
    // Assert that either an addEventListener-related TypeError OR a ReferenceError for those blob URL variables exists.
    const hasBlobUrlRefError = /encryptedDataBlobURL|decryptedDataBlobURL|visualizationBlobURL/i.test(messages);
    const hasAddEventListenerError = /addEventListener|Cannot read properties|cannot read property|null/i.test(messages);

    expect(hasAddEventListenerError || hasBlobUrlRefError).toBeTruthy();
  });

  // Sanity check: ensure we observed at least one console or page error (overall test guard)
  test('Sanity: page emits errors or console error messages due to broken script', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // At least one page error expected
    expect(app.pageErrors.length).toBeGreaterThan(0);

    // Optionally, console messages may also reveal errors — assert that combined observables are non-empty
    const totalObservables = app.pageErrors.length + app.consoleMessages.length;
    expect(totalObservables).toBeGreaterThan(0);
  });
});