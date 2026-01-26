import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122cc251-fa7b-11f0-814c-dbec508f0b3b.html';

// Page object for the Thread page
class ThreadPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.createBtn = page.locator('#create-thread-btn');
    this.editBtn = page.locator('#edit-thread-btn');
    this.addBtn = page.locator('#add-thread-btn');
    this.deleteBtn = page.locator('#delete-thread-btn');
    this.titleInput = page.locator('#thread-title-input');
    this.descInput = page.locator('#thread-description-input');
    this.controls = page.locator('#controls');
    this.threadContainer = page.locator('#thread');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickCreate() {
    await this.createBtn.click();
  }

  async clickEdit() {
    await this.editBtn.click();
  }

  async clickAdd() {
    await this.addBtn.click();
  }

  async clickDelete() {
    await this.deleteBtn.click();
  }

  async fillTitle(title) {
    await this.titleInput.fill(title);
  }

  async fillDescription(desc) {
    await this.descInput.fill(desc);
  }

  async getTitleValue() {
    return await this.titleInput.inputValue();
  }

  async getDescriptionValue() {
    return await this.descInput.inputValue();
  }

  async countReplyButtons() {
    // Any additional button children in controls that are not the primary action buttons
    return await this.controls.locator('button').count();
  }
}

test.describe('Thread FSM - Interactive Application (122cc251-fa7b-11f0-814c-dbec508f0b3b)', () => {
  // Provide fresh handlers for each test to capture runtime errors and console output.
  test.beforeEach(async ({ page }) => {
    // Increase default timeout if necessary inside individual tests by using test.setTimeout
    // nothing global here
  });

  test('Idle state: initial render shows controls and no runtime errors on initial load', async ({ page }) => {
    // This test validates the Idle (S0_Idle) state: renderPage() should have run (inlined HTML)
    const threadPage = new ThreadPage(page);

    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await threadPage.goto();

    // Ensure main UI elements are present
    await expect(threadPage.createBtn).toBeVisible();
    await expect(threadPage.editBtn).toBeVisible();
    await expect(threadPage.addBtn).toBeVisible();
    await expect(threadPage.deleteBtn).toBeVisible();
    await expect(threadPage.titleInput).toBeVisible();
    await expect(threadPage.descInput).toBeVisible();

    // Inputs should be empty initially
    const titleVal = await threadPage.getTitleValue();
    const descVal = await threadPage.getDescriptionValue();
    expect(titleVal).toBe('');
    expect(descVal).toBe('');

    // Give a short moment for any asynchronous errors to surface (there should be none)
    await page.waitForTimeout(100);

    // Initial load should not produce pageerrors in this implementation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Create Thread (S0_Idle -> S1_ThreadCreated) tests', () => {
    test('Clicking "Create Thread" button triggers UI update for created thread and results in a runtime error due to broken update of currentThread', async ({ page }) => {
      // This validates the CreateThread event binding and the createThread(title, description) behavior.
      const threadPage = new ThreadPage(page);
      const pageErrors = [];
      const consoleErrors = [];

      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await threadPage.goto();

      // Click the create button. The page's event handler is createThread (no args),
      // so the handler receives the MouseEvent as the "title" parameter.
      await threadPage.clickCreate();

      // Wait briefly for DOM updates and errors to propagate
      await page.waitForTimeout(150);

      // Expect that the first updateThreadUI(thread) call ran and set input values.
      // Because createThread is invoked as an event handler, the title may become
      // a stringified event like "[object MouseEvent]" or similar. Check it's non-empty.
      const titleVal = await threadPage.getTitleValue();
      const descVal = await threadPage.getDescriptionValue();

      // We assert that the UI changed (title input is non-empty) indicating updateThreadUI(thread) executed.
      expect(titleVal).not.toBe('');
      // Description was the second argument (likely undefined) but update may coerce to a string or empty.
      expect(descVal.length).toBeGreaterThanOrEqual(0);

      // Because createThread calls updateThreadUI(currentThread) where currentThread is null,
      // an exception is expected. Assert at least one page error occurred.
      expect(pageErrors.length).toBeGreaterThan(0);
      // The error should be a TypeError related to reading properties of null/undefined.
      const messages = pageErrors.map(e => e.message || String(e));
      const matchesTypeError = messages.some(m => /Cannot read|Cannot set|reading|of null|of undefined|TypeError/i.test(m));
      expect(matchesTypeError).toBe(true);

      // Also ensure console.error was invoked at least once for deeper visibility (if any)
      // (some runtimes log to pageerror only; this is an additional check)
      await page.waitForTimeout(10);
      // Either consoleErrors or pageErrors should indicate an issue
      expect(pageErrors.length + consoleErrors.length).toBeGreaterThan(0);
    });

    test('Using "Add Thread" with populated inputs should populate the UI with provided values then produce a runtime error', async ({ page }) => {
      // This validates the AddThread event which reads inputs and calls createThread(title, desc)
      const threadPage = new ThreadPage(page);
      const pageErrors = [];
      const consoleErrors = [];

      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await threadPage.goto();

      // Provide explicit title and description values
      await threadPage.fillTitle('My Title');
      await threadPage.fillDescription('My Description');

      // Click the Add Thread button which triggers addThread() -> createThread(title,desc)
      await threadPage.clickAdd();

      // Wait for DOM updates and errors
      await page.waitForTimeout(150);

      // The first updateThreadUI(thread) should set the inputs back to the passed values
      const titleVal = await threadPage.getTitleValue();
      const descVal = await threadPage.getDescriptionValue();

      // Validate the UI reflects the created thread title/description
      expect(titleVal).toBe('My Title');
      expect(descVal).toBe('My Description');

      // Because of updateThreadUI(currentThread) call with currentThread being null,
      // an exception should have happened. Assert page errors exist.
      expect(pageErrors.length).toBeGreaterThan(0);
      const messages = pageErrors.map(e => e.message || String(e));
      const matchesTypeError = messages.some(m => /Cannot read|Cannot set|reading|of null|of undefined|TypeError/i.test(m));
      expect(matchesTypeError).toBe(true);
    });

    test('Edge case: "Add Thread" with empty inputs still triggers create flow and produces runtime error', async ({ page }) => {
      // Validate edge case when inputs are empty strings
      const threadPage = new ThreadPage(page);
      const pageErrors = [];

      page.on('pageerror', (err) => pageErrors.push(err));
      await threadPage.goto();

      // Ensure inputs are empty
      await expect(threadPage.titleInput).toHaveValue('');
      await expect(threadPage.descInput).toHaveValue('');

      // Click add without filling
      await threadPage.clickAdd();

      await page.waitForTimeout(150);

      // Inputs should still be present (likely empty) but function calls should have triggered an error
      expect(pageErrors.length).toBeGreaterThan(0);
    });
  });

  test.describe('Edit and Delete transitions (from S1_ThreadCreated)', () => {
    test('Clicking "Edit Thread" after creating a thread produces a runtime error and does not silently succeed', async ({ page }) => {
      // To simulate S1 -> S2, first create a thread via the add-button path (with values),
      // then click the edit button (which is bound to editThread without arguments in this HTML).
      const threadPage = new ThreadPage(page);
      const pageErrors = [];

      page.on('pageerror', (err) => pageErrors.push(err));
      await threadPage.goto();

      // Create a thread via add-path (fills inputs then clicks add)
      await threadPage.fillTitle('Editable Title');
      await threadPage.fillDescription('Editable Desc');
      await threadPage.clickAdd();

      await page.waitForTimeout(120);

      // Clear errors collected so far and then attempt edit to ensure the edit action itself is captured
      pageErrors.length = 0;

      // Click edit button - the implementation expects editThread(id, title, description)
      // but the binding passes the event object, which should cause a runtime error in the function.
      await threadPage.clickEdit();

      await page.waitForTimeout(120);

      // Edit is expected to throw because thread lookup by an incorrect id will return undefined
      expect(pageErrors.length).toBeGreaterThan(0);
      const messages = pageErrors.map(e => e.message || String(e));
      const matchesTypeError = messages.some(m => /Cannot read|Cannot set|reading|of null|of undefined|TypeError/i.test(m));
      expect(matchesTypeError).toBe(true);

      // Additionally, the UI should still show the last known title and description (no silent clearing)
      const titleVal = await threadPage.getTitleValue();
      const descVal = await threadPage.getDescriptionValue();
      expect(titleVal).toBe('Editable Title');
      expect(descVal).toBe('Editable Desc');
    });

    test('Clicking "Delete Thread" after creating a thread results in a runtime error due to updateThreadUI(currentThread)', async ({ page }) => {
      // Validate deletion path (S1 -> S3) results in expected exception in this implementation
      const threadPage = new ThreadPage(page);
      const pageErrors = [];

      page.on('pageerror', (err) => pageErrors.push(err));
      await threadPage.goto();

      // Create a thread first to be in S1
      await threadPage.fillTitle('ToBeDeleted');
      await threadPage.fillDescription('SomeDesc');
      await threadPage.clickAdd();

      await page.waitForTimeout(120);

      // Reset errors and click delete
      pageErrors.length = 0;
      await threadPage.clickDelete();

      await page.waitForTimeout(120);

      // The implementation calls deleteThread(id) but the event binding passes no id -> updateThreadUI(currentThread) likely throws
      expect(pageErrors.length).toBeGreaterThan(0);
      const messages = pageErrors.map(e => e.message || String(e));
      const matchesTypeError = messages.some(m => /Cannot read|Cannot set|reading|of null|of undefined|TypeError/i.test(m));
      expect(matchesTypeError).toBe(true);

      // The UI's title input should remain accessible (no page-level crash)
      const titleVal = await threadPage.getTitleValue();
      expect(titleVal).toBeDefined();
    });
  });

  test.describe('Observability: console and page errors propagate as expected', () => {
    test('Console error entries and page errors are captured when invoking broken flows', async ({ page }) => {
      const threadPage = new ThreadPage(page);
      const pageErrors = [];
      const consoleErrors = [];

      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await threadPage.goto();

      // Trigger a few actions to cause multiple errors
      await threadPage.clickCreate();
      await page.waitForTimeout(60);
      await threadPage.fillTitle('X');
      await threadPage.fillDescription('Y');
      await threadPage.clickAdd();
      await page.waitForTimeout(60);
      await threadPage.clickEdit();
      await page.waitForTimeout(60);
      await threadPage.clickDelete();
      await page.waitForTimeout(150);

      // There should be multiple page errors and/or console error logs
      expect(pageErrors.length + consoleErrors.length).toBeGreaterThan(0);

      // At least one message should indicate a TypeError / null dereference symptom
      const combinedMessages = pageErrors.map(e => e.message || String(e)).concat(consoleErrors);
      const found = combinedMessages.some(m => /Cannot read|Cannot set|reading|of null|of undefined|TypeError/i.test(m));
      expect(found).toBe(true);
    });
  });
});