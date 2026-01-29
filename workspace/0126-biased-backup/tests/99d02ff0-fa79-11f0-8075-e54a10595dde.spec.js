import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d02ff0-fa79-11f0-8075-e54a10595dde.html';

/**
 * Page Object for the NoSQL Interactive Demo
 * Encapsulates common selectors and actions.
 */
class NoSQLPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Inputs
    this.recordKey = page.locator('#recordKey');
    this.recordValue = page.locator('#recordValue');
    this.searchKey = page.locator('#searchKey');
    this.updateKey = page.locator('#updateKey');
    this.updateValue = page.locator('#updateValue');
    this.deleteKey = page.locator('#deleteKey');

    // Buttons (using explicit onclick attributes per implementation)
    this.addButton = page.locator("button[onclick='addRecord()']");
    this.searchButton = page.locator("button[onclick='searchRecord()']");
    this.updateButton = page.locator("button[onclick='updateRecord()']");
    this.deleteButton = page.locator("button[onclick='deleteRecord()']");

    // Results / lists
    this.recordList = page.locator('#recordList');
    this.searchResult = page.locator('#searchResult');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async addRecord(key, value) {
    await this.recordKey.fill(key);
    await this.recordValue.fill(value);
    await this.addButton.click();
  }

  async searchRecord(key) {
    await this.searchKey.fill(key);
    await this.searchButton.click();
  }

  async updateRecord(key, newValue) {
    await this.updateKey.fill(key);
    await this.updateValue.fill(newValue);
    await this.updateButton.click();
  }

  async deleteRecord(key) {
    await this.deleteKey.fill(key);
    await this.deleteButton.click();
  }

  async getRecordListItems() {
    return this.recordList.locator('li').allTextContents();
  }

  async assertInputFieldsCleared() {
    await expect(this.recordKey).toHaveValue('');
    await expect(this.recordValue).toHaveValue('');
    await expect(this.searchKey).toHaveValue('');
    await expect(this.updateKey).toHaveValue('');
    await expect(this.updateValue).toHaveValue('');
    await expect(this.deleteKey).toHaveValue('');
    await expect(this.searchResult).toHaveText('');
  }
}

test.describe('NoSQL Interactive Demo - FSM based tests', () => {
  // Collect console errors and page errors to assert on them explicitly
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console events and page errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the application for each test to ensure fresh state
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test ensure the page did not produce runtime errors.
    // The implementation is expected to work; tests will fail if errors are present.
    expect(consoleErrors, 'No console.error messages should have been emitted').toHaveLength(0);
    expect(pageErrors, 'No uncaught page errors should have occurred').toHaveLength(0);
  });

  test.describe('Initial state (S0_Idle) validations', () => {
    test('renders main controls and buttons on initial load', async ({ page }) => {
      // Validate initial UI elements are present as per Idle state evidence
      const app = new NoSQLPage(page);

      await expect(app.recordKey).toBeVisible();
      await expect(app.recordValue).toBeVisible();
      await expect(app.searchKey).toBeVisible();
      await expect(app.updateKey).toBeVisible();
      await expect(app.updateValue).toBeVisible();
      await expect(app.deleteKey).toBeVisible();

      await expect(app.addButton).toBeVisible();
      await expect(app.searchButton).toBeVisible();
      await expect(app.updateButton).toBeVisible();
      await expect(app.deleteButton).toBeVisible();

      // Record list should be present and empty initially
      await expect(app.recordList).toBeVisible();
      const items = await app.getRecordListItems();
      expect(items.length).toBe(0);
    });
  });

  test.describe('Add Record transitions (S0_Idle -> S1_RecordAdded)', () => {
    test('successful add record updates list and clears fields (positive case)', async ({ page }) => {
      // This validates the transition: AddRecord -> Record Added
      const app = new NoSQLPage(page);

      // Add a record and verify list updates
      await app.addRecord('alice', 'engineer');

      // After adding, the recordList should include the newly added record
      const items = await app.getRecordListItems();
      expect(items).toContain('alice: engineer');

      // Verify entry actions: refreshRecordList() should have run (list updated)
      // Verify clearFields() cleared the inputs
      await app.assertInputFieldsCleared();
    });

    test('add record with missing fields shows alert and does not modify list (edge case)', async ({ page }) => {
      const app = new NoSQLPage(page);
      const dialogs = [];

      // Capture alert dialog message
      page.once('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });

      // Try adding with missing value
      await app.recordKey.fill('bob');
      await app.recordValue.fill(''); // empty value
      await app.addButton.click();

      // Expect an alert was shown
      expect(dialogs.length).toBe(1);
      expect(dialogs[0]).toBe('Please input both key and value.');

      // Ensure no record was added
      const items = await app.getRecordListItems();
      expect(items).not.toContain('bob:');
    });
  });

  test.describe('Search Record transitions (S0_Idle -> S2_RecordSearched)', () => {
    test('search existing record displays value', async ({ page }) => {
      const app = new NoSQLPage(page);

      // Prepare state by adding a record first
      await app.addRecord('charlie', 'designer');

      // Now search for it
      await app.searchRecord('charlie');

      // Verify search result text
      await expect(app.searchResult).toHaveText('Value: designer');

      // Inputs should have been cleared by clearFields() per design after operations
      await app.assertInputFieldsCleared();
    });

    test('search non-existing record shows "Record not found."', async ({ page }) => {
      const app = new NoSQLPage(page);

      // Search for a key that doesn't exist
      await app.searchRecord('nonexistent');

      // Verify result indicates not found
      await expect(app.searchResult).toHaveText('Record not found.');
    });
  });

  test.describe('Update Record transitions (S0_Idle -> S3_RecordUpdated)', () => {
    test('update existing record updates list and clears inputs (positive case)', async ({ page }) => {
      const app = new NoSQLPage(page);

      // Add a record to update
      await app.addRecord('dave', 'intern');

      // Update its value
      await app.updateRecord('dave', 'senior');

      // After update, list should reflect new value
      const items = await app.getRecordListItems();
      expect(items).toContain('dave: senior');
      expect(items).not.toContain('dave: intern');

      // clearFields() should have cleared inputs and search result
      await app.assertInputFieldsCleared();
    });

    test('update with missing key or new value shows alert (edge cases)', async ({ page }) => {
      const app = new NoSQLPage(page);
      const dialogMessages = [];

      page.on('dialog', async dialog => {
        dialogMessages.push(dialog.message());
        await dialog.accept();
      });

      // Attempt update with missing fields
      await app.updateRecord('', '');
      // Because there is no key and no new value, an alert should appear.
      // Wait briefly to ensure dialog was handled
      await page.waitForTimeout(100);

      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      expect(dialogMessages[0]).toBe('Please input both key and new value.');

      // Attempt update of non-existing key
      // Clear dialogMessages for next expectation
      dialogMessages.splice(0);

      // Provide a non-existent key but valid new value
      await app.updateRecord('ghost', 'phantom');
      await page.waitForTimeout(100);

      // Expect an alert saying record not found
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      expect(dialogMessages[0]).toBe('Record not found for the given key.');
    });
  });

  test.describe('Delete Record transitions (S0_Idle -> S4_RecordDeleted)', () => {
    test('delete existing record removes from list and clears inputs (positive case)', async ({ page }) => {
      const app = new NoSQLPage(page);

      // Add a record to delete
      await app.addRecord('eve', 'analyst');

      // Confirm it's present
      let items = await app.getRecordListItems();
      expect(items).toContain('eve: analyst');

      // Delete it
      await app.deleteRecord('eve');

      // After deletion, the item should be gone
      items = await app.getRecordListItems();
      expect(items).not.toContain('eve: analyst');

      // clearFields() should have cleared inputs and search result
      await app.assertInputFieldsCleared();
    });

    test('delete with empty key and delete non-existing key show alerts (edge cases)', async ({ page }) => {
      const app = new NoSQLPage(page);
      const dialogMessages = [];

      page.on('dialog', async dialog => {
        dialogMessages.push(dialog.message());
        await dialog.accept();
      });

      // Attempt delete with empty key
      await app.deleteRecord('');
      await page.waitForTimeout(100);
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      expect(dialogMessages[0]).toBe('Please input a key to delete.');

      dialogMessages.splice(0);

      // Attempt delete of non-existing key
      await app.deleteRecord('notthere');
      await page.waitForTimeout(100);
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      expect(dialogMessages[0]).toBe('Record not found for the given key.');
    });
  });

  test.describe('Cross-validation of FSM behaviors', () => {
    test('add -> search -> update -> delete full lifecycle', async ({ page }) => {
      // Full CRUD flow to validate transitions and entry actions invoked properly
      const app = new NoSQLPage(page);

      // Add
      await app.addRecord('frank', 'lead');
      let items = await app.getRecordListItems();
      expect(items).toContain('frank: lead');

      // Search
      await app.searchRecord('frank');
      await expect(app.searchResult).toHaveText('Value: lead');

      // Update
      await app.updateRecord('frank', 'cto');
      items = await app.getRecordListItems();
      expect(items).toContain('frank: cto');

      // Delete
      await app.deleteRecord('frank');
      items = await app.getRecordListItems();
      expect(items).not.toContain('frank: cto');

      // Final cleanup: fields cleared
      await app.assertInputFieldsCleared();
    });
  });
});