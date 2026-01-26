import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122d1070-fa7b-11f0-814c-dbec508f0b3b.html';

/**
 * Page object for the NoSQL interactive application.
 * Encapsulates common interactions so tests are readable and maintainable.
 */
class NoSQLPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages and page errors for assertions
    this.page.on('console', msg => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', err => {
      // store the Error object for richer assertions
      this.pageErrors.push(err);
    });
  }

  // Navigation helper
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Helpers for interacting with form controls
  async selectDatabase(value) {
    await this.page.locator('#database').selectOption(value);
  }

  async selectCollection(value) {
    await this.page.locator('#collection').selectOption(value);
  }

  async enterDocument(text) {
    await this.page.locator('#document').fill(text);
  }

  async selectOperation(value) {
    await this.page.locator('#operation').selectOption(value);
  }

  // Click submit with safe handling for possible navigation
  async clickSubmit() {
    // Clicking submit may trigger a form submission and cause navigation.
    // We handle both possibilities by racing click with optional navigation.
    const clickPromise = this.page.locator('#submit').click();
    try {
      await Promise.race([
        clickPromise,
        this.page.waitForNavigation({ waitUntil: 'load', timeout: 1500 }).catch(() => null)
      ]);
    } catch (e) {
      // If navigation or click throws, let tests inspect pageErrors/consoleMessages later.
    }
  }

  // Query helpers
  async formIsVisible() {
    return this.page.locator('#form').isVisible();
  }

  async databaseValue() {
    return this.page.locator('#database').inputValue();
  }

  async collectionValue() {
    return this.page.locator('#collection').inputValue();
  }

  async documentValue() {
    return this.page.locator('#document').inputValue();
  }

  async operationValue() {
    return this.page.locator('#operation').inputValue();
  }

  // These labels are referenced in the implementation but are not present in the HTML.
  // Tests will assert their absence to validate the buggy implementation behavior.
  async databaseLabelCount() {
    return this.page.locator('#database-label').count();
  }

  async collectionLabelCount() {
    return this.page.locator('#collection-label').count();
  }

  async documentLabelCount() {
    return this.page.locator('#document-label').count();
  }

  async operationLabelCount() {
    return this.page.locator('#operation-label').count();
  }

  // Return captured console messages
  getConsoleMessages() {
    return this.consoleMessages;
  }

  // Return captured page errors
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('NoSQL Interactive Application - FSM and Implementation Tests', () => {
  // Provide a fresh page object and NoSQLPage wrapper for each test
  let nsPage;

  test.beforeEach(async ({ page }) => {
    nsPage = new NoSQLPage(page);
    // Navigate to the app. Handlers for console and pageerror were attached in the constructor.
    await nsPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // Ensure the page is closed between tests (Playwright does this automatically),
    // but explicitly clear listeners/refs by navigating away to about:blank to avoid cross-test bleed.
    try {
      await page.goto('about:blank');
    } catch (e) {
      // ignore navigation errors during teardown
    }
  });

  test('Initial state (S0_Idle) - form and controls exist', async () => {
    // This validates the Idle state: the form is present and controls exist with default values.
    expect(await nsPage.formIsVisible()).toBe(true);

    // Default values as per the HTML
    await expect(nsPage.page.locator('#database')).toHaveValue('default');
    await expect(nsPage.page.locator('#collection')).toHaveValue('default');
    await expect(nsPage.page.locator('#document')).toHaveValue('');
    await expect(nsPage.page.locator('#operation')).toHaveValue('insert');

    // The implementation expected to update labels like #database-label, but the HTML does not contain them.
    // Expect that these labels are not present (count === 0).
    expect(await nsPage.databaseLabelCount()).toBe(0);
    expect(await nsPage.collectionLabelCount()).toBe(0);
    expect(await nsPage.documentLabelCount()).toBe(0);
    expect(await nsPage.operationLabelCount()).toBe(0);
  });

  test('Script runtime error is emitted on load (expected bug) and captured as pageerror', async () => {
    // The included script defines a local variable named `document` which shadows the DOM document,
    // leading to runtime TypeError when trying to call document.getElementById(...).
    // We assert that at least one pageerror was captured and that it indicates a problem with getElementById or not a function.
    // Wait/poll until an error is observed or timeout.
    await expect.poll(() => nsPage.getPageErrors().length, {
      timeout: 2000,
      message: 'Expected a pageerror to be emitted due to broken script, but none were observed'
    }).toBeGreaterThan(0);

    const errors = nsPage.getPageErrors();
    // At least one error should mention "getElementById" or "is not a function" (browser-specific phrasing).
    const joined = errors.map(e => String(e)).join(' | ');
    expect(joined.toLowerCase()).toContain('getelementbyid');
  });

  test('Database change event (DatabaseChange) does not trigger expected handler due to script error', async () => {
    // This test attempts to perform the transition S0 -> S1 by changing the database select.
    // Because the event listeners failed to attach (script runtime error), changing the select only updates the form control value,
    // but does not update any application state labels or log expected messages.
    await nsPage.selectDatabase('MongoDB');

    // The select should reflect the UI change.
    expect(await nsPage.databaseValue()).toBe('MongoDB');

    // However, the expected label update (database-label) is not present because the event handler did not attach.
    expect(await nsPage.databaseLabelCount()).toBe(0);

    // Confirm no console message was logged that would indicate the handler ran.
    const found = nsPage.getConsoleMessages().some(m => m.text.includes('Database:'));
    expect(found).toBe(false);
  });

  test('Collection change event (CollectionChange) does not trigger expected handler due to script error', async () => {
    // Attempt transition S1 -> S2 by changing collection.
    await nsPage.selectCollection('User');

    // The select's value should change in the DOM.
    expect(await nsPage.collectionValue()).toBe('User');

    // But the code expected to update #collection-label which is not present / not updated.
    expect(await nsPage.collectionLabelCount()).toBe(0);

    // No console indication of the handler running should exist.
    const found = nsPage.getConsoleMessages().some(m => m.text.includes('Collection:'));
    expect(found).toBe(false);
  });

  test('Document input event (DocumentInput) does not update expected label or internal state due to script error', async () => {
    // Attempt transition S2 -> S3 by typing into the document input.
    const sampleDoc = '{"name":"Alice"}';
    await nsPage.enterDocument(sampleDoc);

    // The input value updates in the DOM normally.
    expect(await nsPage.documentValue()).toBe(sampleDoc);

    // But the expected label update (document-label) should not exist.
    expect(await nsPage.documentLabelCount()).toBe(0);

    // No console output indicating internal stored `document` value was logged exists.
    const found = nsPage.getConsoleMessages().some(m => m.text.includes('Document:'));
    expect(found).toBe(false);
  });

  test('Operation change event (OperationChange) does not update expected label due to script error', async () => {
    // Attempt transition S3 -> S4 by changing the operation select.
    await nsPage.selectOperation('update');

    // The select reflects the change.
    expect(await nsPage.operationValue()).toBe('update');

    // But the label that the script would have updated does not exist.
    expect(await nsPage.operationLabelCount()).toBe(0);

    // No console output indicating the handler executed should be present.
    const found = nsPage.getConsoleMessages().some(m => m.text.includes('Operation:'));
    expect(found).toBe(false);
  });

  test('Form submit (FormSubmit) - clicking submit should not log expected submit messages because handler failed to attach', async () => {
    // Before clicking, ensure we haven't observed the submit log.
    const beforeHasSubmitLog = nsPage.getConsoleMessages().some(m => m.text.includes('Submit button clicked!'));
    expect(beforeHasSubmitLog).toBe(false);

    // Click the submit button. This may trigger a navigation (form submit) or do nothing special.
    // We handle both and continue.
    await nsPage.clickSubmit();

    // After the click, assert that the expected submit console log is still absent (handler wasn't attached).
    const afterHasSubmitLog = nsPage.getConsoleMessages().some(m => m.text.includes('Submit button clicked!'));
    expect(afterHasSubmitLog).toBe(false);
  });

  test('Edge case: Multiple interactions after runtime error still do not execute handlers; errors persist', async () => {
    // Perform a sequence of interactions in the expected FSM order.
    await nsPage.selectDatabase('MongoDB');
    await nsPage.selectCollection('Product');
    await nsPage.enterDocument('{"id":123}');
    await nsPage.selectOperation('delete');

    // Click submit; handle potential navigation
    await nsPage.clickSubmit();

    // The inputs reflect DOM updates.
    expect(await nsPage.databaseValue()).toBe('MongoDB');
    expect(await nsPage.collectionValue()).toBe('Product');
    expect(await nsPage.documentValue()).toBe('{"id":123}');
    expect(await nsPage.operationValue()).toBe('delete');

    // But none of the script-side label updates occurred: labels are absent.
    expect(await nsPage.databaseLabelCount()).toBe(0);
    expect(await nsPage.collectionLabelCount()).toBe(0);
    expect(await nsPage.documentLabelCount()).toBe(0);
    expect(await nsPage.operationLabelCount()).toBe(0);

    // Confirm that the initial runtime error(s) still exist in captured pageErrors.
    expect(nsPage.getPageErrors().length).toBeGreaterThan(0);
    const joined = nsPage.getPageErrors().map(e => String(e)).join(' ');
    expect(joined.toLowerCase()).toContain('getelementbyid');
  });
});