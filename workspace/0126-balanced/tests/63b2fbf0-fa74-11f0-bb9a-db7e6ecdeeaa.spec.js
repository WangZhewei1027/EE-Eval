import { test, expect } from '@playwright/test';

// Test file for Application ID: 63b2fbf0-fa74-11f0-bb9a-db7e6ecdeeaa
// URL served at:
// http://127.0.0.1:5500/workspace/0126-balanced/html/63b2fbf0-fa74-11f0-bb9a-db7e6ecdeeaa.html
//
// This suite validates all FSM states/transitions for the NoSQL Concept Demo app.
// It loads the page as-is, observes console logs and page errors, and asserts expected UI and DOM changes.
// It intentionally does not modify or patch the page environment (per instructions).

const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-balanced/html/63b2fbf0-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page object encapsulating interactions with the demo app
class NoSQLDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.insertBtn = page.locator("button[onclick='insertDocument()']");
    this.findBtn = page.locator("button[onclick='findDocument()']");
    this.updateBtn = page.locator("button[onclick='updateDocument()']");
    this.deleteBtn = page.locator("button[onclick='deleteDocument()']");
    this.showAllBtn = page.locator("button[onclick='showAll()']");
    this.dbDisplay = page.locator('#db-display');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async getDBDisplayText() {
    return (await this.dbDisplay.textContent()) ?? '';
  }

  // Attempts to parse the db-display into an object. Returns null if empty display.
  async getDBObject() {
    const text = (await this.getDBDisplayText()).trim();
    if (!text || text.includes('(empty)')) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      // If display isn't valid JSON, return null so tests can still assert gracefully
      return null;
    }
  }

  // Click helpers
  async clickInsert() {
    await this.insertBtn.click();
  }
  async clickFind() {
    await this.findBtn.click();
  }
  async clickUpdate() {
    await this.updateBtn.click();
  }
  async clickDelete() {
    await this.deleteBtn.click();
  }
  async clickShowAll() {
    await this.showAllBtn.click();
  }
}

test.describe('NoSQL Concept Demo - FSM states and transitions', () => {
  // We'll capture console errors and page errors for each test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location()
          });
        }
      } catch {
        // ignore any unexpected console inspection errors
      }
    });

    // Capture uncaught page errors (e.g., ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test assert that no unexpected runtime exceptions were emitted.
    // The application is expected to run without uncaught page errors or console errors.
    expect(pageErrors.length, `No uncaught page errors (pageerror): ${JSON.stringify(pageErrors)}`).toBe(0);
    expect(consoleErrors.length, `No console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Initial State (S0_Initial): displayDB() called and UI shows empty DB', async ({ page }) => {
    // Validate initial state on page load
    const app = new NoSQLDemoPage(page);
    await app.goto();

    // The db-display should show empty marker per displayDB()
    const dbText = await app.getDBDisplayText();
    expect(dbText).toContain('{} (empty)');

    // The output area should contain the initial informational text
    const outputText = await app.getOutputText();
    expect(outputText).toContain('Click buttons above to interact with the NoSQL database.');

    // No documents at initial state
    const dbObj = await app.getDBObject();
    expect(dbObj).toBeNull();
  });

  test.describe('Insert -> DocumentInserted (S1_DocumentInserted)', () => {
    test('Insert Document button adds a document and displayDB() updates the UI', async ({ page }) => {
      const app = new NoSQLDemoPage(page);
      await app.goto();

      // Click insert
      await app.clickInsert();

      // Output should contain the inserted message and show the document
      await expect(app.output).toContainText('Inserted document with id:');

      const outputText = await app.getOutputText();
      // Extract the printed id from the output
      const match = outputText.match(/Inserted document with id:\s*([0-9a-fA-F]+)/);
      // The id is generated via toString(16)+Date.toString(16), so some hex digits expected
      expect(match).not.toBeNull();

      // The DB display should now reflect a non-empty object with the inserted doc
      const dbObj = await app.getDBObject();
      expect(dbObj).not.toBeNull();

      // There should be exactly one top-level key (the generated id)
      const keys = Object.keys(dbObj);
      expect(keys.length).toBeGreaterThanOrEqual(1);
      const doc = dbObj[keys[0]];
      expect(doc).toBeTruthy();
      expect(doc.name).toBe('Alice');
      expect(doc.age).toBe(28);
      expect(Array.isArray(doc.interests)).toBe(true);
    });
  });

  test.describe('Find -> DocumentFound (S2_DocumentFound)', () => {
    test('Find returns expected documents when present', async ({ page }) => {
      const app = new NoSQLDemoPage(page);
      await app.goto();

      // Ensure DB is empty first, then insert a document to make deterministic result
      // Clicking insert to create a document
      await app.clickInsert();

      // Click find
      await app.clickFind();

      // Output should indicate found documents for 'Alice'
      await expect(app.output).toContainText("Found");
      const outputText = await app.getOutputText();
      expect(outputText).toContain("name = 'Alice'");

      // JSON in output should include "Alice"
      expect(outputText).toContain('"name":"Alice"'.replace(/"/g, '"'));

      // Ensure found count is >= 1
      const countMatch = outputText.match(/Found\s+(\d+)\s+document\(s\)/);
      expect(countMatch).not.toBeNull();
      const foundCount = Number(countMatch[1]);
      expect(foundCount).toBeGreaterThanOrEqual(1);
    });

    test('Find returns "No documents found" when DB is empty (edge case)', async ({ page }) => {
      const app = new NoSQLDemoPage(page);
      await app.goto();

      // When DB empty, showAll returns 'Database is empty.' and find should report none
      // First ensure DB is empty by reading dbDisplay
      const initialDB = await app.getDBObject();
      if (initialDB !== null) {
        // If not empty, delete existing docs using deleteDocument loop by clicking delete (to adhere to "do not patch" rule)
        // Since deleteDocument deletes all 'Alice' docs, click delete to clear
        await app.clickDelete();
      }

      // Now click find on empty DB
      await app.clickFind();

      const outputText = await app.getOutputText();
      expect(outputText).toContain("No documents found with name = 'Alice'.");
    });
  });

  test.describe('Update -> DocumentUpdated (S3_DocumentUpdated)', () => {
    test('Update increments age for matching documents and displayDB() refreshes', async ({ page }) => {
      const app = new NoSQLDemoPage(page);
      await app.goto();

      // Insert a document to update
      await app.clickInsert();

      // Capture DB before update
      const dbBefore = await app.getDBObject();
      expect(dbBefore).not.toBeNull();
      const ids = Object.keys(dbBefore);
      expect(ids.length).toBeGreaterThanOrEqual(1);
      const targetId = ids[0];
      const ageBefore = dbBefore[targetId].age;

      // Click update
      await app.clickUpdate();

      // Output should state it updated age
      await expect(app.output).toContainText('Updated age for');

      const outputText = await app.getOutputText();
      expect(outputText).toMatch(/Updated age for \d+ document\(s\) with name = 'Alice'\./);

      // DB should reflect incremented age for that id
      const dbAfter = await app.getDBObject();
      expect(dbAfter).not.toBeNull();
      expect(dbAfter[targetId].age).toBe(ageBefore + 1);
    });

    test('Update reports no documents to update when DB empty (edge case)', async ({ page }) => {
      const app = new NoSQLDemoPage(page);
      await app.goto();

      // Ensure DB is empty; use delete to clear if necessary
      const dbInitial = await app.getDBObject();
      if (dbInitial !== null) {
        // Clear by deleting
        await app.clickDelete();
      }

      // Click update on empty DB
      await app.clickUpdate();

      const outputText = await app.getOutputText();
      expect(outputText).toBe("No documents found to update with name = 'Alice'.");
    });
  });

  test.describe('Delete -> DocumentDeleted (S4_DocumentDeleted)', () => {
    test('Delete removes matching documents and displayDB() updates (document present)', async ({ page }) => {
      const app = new NoSQLDemoPage(page);
      await app.goto();

      // Insert a document
      await app.clickInsert();

      // Confirm DB is non-empty
      const dbBefore = await app.getDBObject();
      expect(dbBefore).not.toBeNull();

      // Click delete
      await app.clickDelete();

      // Output should indicate deletion
      await expect(app.output).toContainText('Deleted');
      const outputText = await app.getOutputText();
      expect(outputText).toMatch(/Deleted \d+ document\(s\) with name = 'Alice'\./);

      // DB should now be empty (display shows empty message)
      const dbAfterText = await app.getDBDisplayText();
      expect(dbAfterText).toContain('{} (empty)');
      const dbAfter = await app.getDBObject();
      expect(dbAfter).toBeNull();
    });

    test('Delete reports none found if DB empty (edge case)', async ({ page }) => {
      const app = new NoSQLDemoPage(page);
      await app.goto();

      // Ensure DB empty
      const dbInitial = await app.getDBObject();
      if (dbInitial !== null) {
        await app.clickDelete();
      }

      // Click delete on empty DB
      await app.clickDelete();

      const outputText = await app.getOutputText();
      expect(outputText).toBe("No documents found to delete with name = 'Alice'.");
    });
  });

  test.describe('Show All -> AllDocumentsShown (S5_AllDocumentsShown)', () => {
    test('Show All when DB empty returns "Database is empty."', async ({ page }) => {
      const app = new NoSQLDemoPage(page);
      await app.goto();

      // Ensure DB empty, clear if necessary
      const dbInitial = await app.getDBObject();
      if (dbInitial !== null) {
        await app.clickDelete();
      }

      // Click showAll
      await app.clickShowAll();

      const outputText = await app.getOutputText();
      expect(outputText).toBe('Database is empty.');
    });

    test('Show All when documents exist prints "All documents:" and JSON', async ({ page }) => {
      const app = new NoSQLDemoPage(page);
      await app.goto();

      // Insert a document
      await app.clickInsert();

      // Click showAll
      await app.clickShowAll();

      const outputText = await app.getOutputText();
      expect(outputText).toContain('All documents:');
      expect(outputText).toContain('"Alice"');
      expect(outputText).toContain('"age"');
    });
  });

  test.describe('Integration: full workflow (Insert -> Find -> Update -> Delete -> ShowAll)', () => {
    test('Performs full sequence and validates each state's observables', async ({ page }) => {
      const app = new NoSQLDemoPage(page);
      await app.goto();

      // 1) Insert
      await app.clickInsert();
      const out1 = await app.getOutputText();
      expect(out1).toContain('Inserted document with id:');

      // 2) Find
      await app.clickFind();
      const out2 = await app.getOutputText();
      expect(out2).toContain("Found");
      expect(out2).toContain("name = 'Alice'");

      // 3) Update
      // Capture DB and ages before update
      const dbBefore = await app.getDBObject();
      const ids = dbBefore ? Object.keys(dbBefore) : [];
      const agesBefore = {};
      ids.forEach((id) => (agesBefore[id] = dbBefore[id].age));

      await app.clickUpdate();
      const out3 = await app.getOutputText();
      expect(out3).toMatch(/Updated age for \d+ document\(s\) with name = 'Alice'\./);

      // Validate ages incremented
      const dbAfterUpdate = await app.getDBObject();
      ids.forEach((id) => {
        expect(dbAfterUpdate[id].age).toBe(agesBefore[id] + 1);
      });

      // 4) Delete
      await app.clickDelete();
      const out4 = await app.getOutputText();
      expect(out4).toMatch(/Deleted \d+ document\(s\) with name = 'Alice'\./);

      // 5) ShowAll -> should be empty
      await app.clickShowAll();
      const out5 = await app.getOutputText();
      expect(out5).toBe('Database is empty.');
    });
  });
});