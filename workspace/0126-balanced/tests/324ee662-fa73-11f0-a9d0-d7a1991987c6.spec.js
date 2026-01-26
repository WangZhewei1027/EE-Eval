import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324ee662-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page Object Model for the NoSQL demo page.
 * Encapsulates common interactions and queries.
 */
class NoSqlPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async nameInput() {
    return this.page.locator('#name');
  }

  async emailInput() {
    return this.page.locator('#email');
  }

  async addButton() {
    return this.page.locator('#addDataBtn');
  }

  async showButton() {
    return this.page.locator('#showDataBtn');
  }

  async output() {
    return this.page.locator('#output');
  }

  // Fill the name and email inputs
  async fillForm(name, email) {
    await (await this.nameInput()).fill(name);
    await (await this.emailInput()).fill(email);
  }

  // Click Add Data and capture dialog message (if any)
  async clickAddAndCaptureDialog() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      (await this.addButton()).click()
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  // Click Add Data without expecting dialog (useful when expecting no dialog)
  async clickAdd() {
    await (await this.addButton()).click();
  }

  // Click Show Data
  async clickShow() {
    await (await this.showButton()).click();
  }

  // Get the visible text content of output
  async getOutputText() {
    return (await this.output()).innerText();
  }

  // Read internal noSqlDatabase from page context
  async getInternalDatabase() {
    return this.page.evaluate(() => {
      // Return a deep copy to avoid serialization surprises
      return window.noSqlDatabase ? JSON.parse(JSON.stringify(window.noSqlDatabase)) : null;
    });
  }

  // Reset the internal database on the page (used for test isolation)
  async resetInternalDatabase() {
    return this.page.evaluate(() => {
      if (window.noSqlDatabase) {
        window.noSqlDatabase.users = [];
      } else {
        window.noSqlDatabase = { users: [] };
      }
    });
  }
}

test.describe('NoSQL Concept Demonstration - FSM states and transitions', () => {
  // Will hold console errors and page errors observed during each test
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset trackers
    consoleErrors = [];
    pageErrors = [];

    // Listen to console messages and page errors for diagnostics and assertions
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // After each test ensure we didn't encounter unexpected runtime errors
    // If there are errors, include them in the assertion message for easier debugging
    const consoleErrCount = consoleErrors.length;
    const pageErrCount = pageErrors.length;

    // Assert no console.error messages were emitted
    expect(consoleErrCount, `Expected no console.error messages, found ${consoleErrCount}. ${consoleErrors.length ? JSON.stringify(consoleErrors, null, 2) : ''}`).toBe(0);

    // Assert no page errors (uncaught exceptions)
    expect(pageErrCount, `Expected no page errors, found ${pageErrCount}. ${pageErrors.length ? JSON.stringify(pageErrors, null, 2) : ''}`).toBe(0);
  });

  test.describe('S0_Idle state - initial render and UI elements', () => {
    test('renders inputs, buttons and empty output (Idle state)', async ({ page }) => {
      // Validate that the initial page shows the expected elements (evidence of S0_Idle)
      const app = new NoSqlPage(page);

      // Inputs and buttons should be present and visible
      await expect(await app.nameInput()).toBeVisible();
      await expect(await app.emailInput()).toBeVisible();
      await expect(await app.addButton()).toBeVisible();
      await expect(await app.showButton()).toBeVisible();
      await expect(await app.output()).toBeVisible();

      // Output should initially be empty string
      const outputText = await app.getOutputText();
      expect(outputText.trim(), 'Expected empty output on initial render').toBe('');

      // Internal database should be present with empty users array
      const db = await app.getInternalDatabase();
      expect(db).not.toBeNull();
      expect(Array.isArray(db.users)).toBe(true);
      expect(db.users.length).toBe(0);
    });
  });

  test.describe('S1_UserAdded state - AddDataClick transition and validations', () => {
    test('adds a user when both fields are filled and shows "User added." alert', async ({ page }) => {
      const app = new NoSqlPage(page);

      // Ensure database is cleared for clean assertion
      await app.resetInternalDatabase();

      // Fill the form and click Add Data; capture alert
      await app.fillForm('Alice', 'alice@example.test');

      // Wait for dialog and click add; the helper captures and accepts the dialog
      const alertMessage = await app.clickAddAndCaptureDialog();
      expect(alertMessage).toBe('User added.');

      // After adding, inputs should be cleared (evidence lines in transition)
      expect(await (await app.nameInput()).inputValue()).toBe('');
      expect(await (await app.emailInput()).inputValue()).toBe('');

      // Internal database should now contain the new user
      const db = await app.getInternalDatabase();
      expect(db.users.length).toBe(1);
      expect(db.users[0]).toEqual({ name: 'Alice', email: 'alice@example.test' });
    });

    test('shows validation alert when attempting to add with missing fields', async ({ page }) => {
      const app = new NoSqlPage(page);

      await app.resetInternalDatabase();

      // Case 1: missing email
      await app.fillForm('Bob', '');
      let dialogPromise = page.waitForEvent('dialog');
      await (await app.addButton()).click();
      let dialog = await dialogPromise;
      expect(dialog.message()).toBe('Please fill in both fields.');
      await dialog.accept();

      // Case 2: missing name
      await app.fillForm('', 'bob@example.test');
      dialogPromise = page.waitForEvent('dialog');
      await (await app.addButton()).click();
      dialog = await dialogPromise;
      expect(dialog.message()).toBe('Please fill in both fields.');
      await dialog.accept();

      // Database should still be empty
      const db = await app.getInternalDatabase();
      expect(db.users.length).toBe(0);
    });

    test('adds multiple users sequentially and preserves order', async ({ page }) => {
      const app = new NoSqlPage(page);

      await app.resetInternalDatabase();

      // Add first user
      await app.fillForm('Carol', 'carol@example.test');
      let alert = await app.clickAddAndCaptureDialog();
      expect(alert).toBe('User added.');

      // Add second user
      await app.fillForm('Dave', 'dave@example.test');
      alert = await app.clickAddAndCaptureDialog();
      expect(alert).toBe('User added.');

      // Verify both users exist in order
      const db = await app.getInternalDatabase();
      expect(db.users.length).toBe(2);
      expect(db.users[0]).toEqual({ name: 'Carol', email: 'carol@example.test' });
      expect(db.users[1]).toEqual({ name: 'Dave', email: 'dave@example.test' });
    });
  });

  test.describe('S2_DataShown state - ShowDataClick transition and output rendering', () => {
    test('displays the stored data in #output when Show Data is clicked', async ({ page }) => {
      const app = new NoSqlPage(page);

      // Prepare database with known users using UI to ensure realistic transition
      await app.resetInternalDatabase();

      // Add two users using the UI to ensure alerts and push to array
      await app.fillForm('Eve', 'eve@example.test');
      let alert = await app.clickAddAndCaptureDialog();
      expect(alert).toBe('User added.');

      await app.fillForm('Frank', 'frank@example.test');
      alert = await app.clickAddAndCaptureDialog();
      expect(alert).toBe('User added.');

      // Now click Show Data and assert the output's innerHTML matches JSON.stringify of the internal state
      await app.clickShow();

      // Fetch the internal database and output text
      const db = await app.getInternalDatabase();
      const expectedString = JSON.stringify(db, null, 2);

      const outputText = await app.getOutputText();
      // The page uses output.innerHTML = JSON.stringify(...); which will present the JSON string.
      expect(outputText.trim()).toBe(expectedString);

      // Also verify that expected names/emails appear in the output
      expect(outputText).toContain('Eve');
      expect(outputText).toContain('eve@example.test');
      expect(outputText).toContain('Frank');
      expect(outputText).toContain('frank@example.test');
    });

    test('show data when database is empty displays empty users array', async ({ page }) => {
      const app = new NoSqlPage(page);

      // Ensure empty DB
      await app.resetInternalDatabase();

      // Click show and assert the output reflects empty users
      await app.clickShow();
      const db = await app.getInternalDatabase();
      const expectedString = JSON.stringify(db, null, 2);
      const outputText = await app.getOutputText();
      expect(outputText.trim()).toBe(expectedString);
      expect(outputText).toContain('"users": []');
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('internal database is accessible from page context and can be modified (for edge-case testing)', async ({ page }) => {
      const app = new NoSqlPage(page);

      // Directly mutate internal database from test context (simulating possible external changes)
      await app.resetInternalDatabase();
      await page.evaluate(() => {
        // Intentionally add a malformed user object to test resilience
        window.noSqlDatabase.users.push({ username: 'Malformed' }); // missing email/name fields expected by UI
      });

      // Show data to see how the page renders unexpected shape
      await app.clickShow();
      const output = await app.getOutputText();
      // Output should contain the malformed object representation
      expect(output).toContain('Malformed');
    });

    test('adding user with extremely long input values', async ({ page }) => {
      const app = new NoSqlPage(page);

      await app.resetInternalDatabase();

      const longName = 'N'.repeat(5000);
      const longEmail = 'E'.repeat(5000) + '@example.test';

      await app.fillForm(longName, longEmail);
      const alertMessage = await app.clickAddAndCaptureDialog();
      expect(alertMessage).toBe('User added.');

      // Ensure stored and show works
      await app.clickShow();
      const outputText = await app.getOutputText();
      expect(outputText).toContain(longName);
      expect(outputText).toContain(longEmail);
    });
  });
});