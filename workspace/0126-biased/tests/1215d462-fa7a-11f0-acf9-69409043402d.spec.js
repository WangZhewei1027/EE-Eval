import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1215d462-fa7a-11f0-acf9-69409043402d.html';

test.describe('NoSQL Interactive Demo - FSM states and transitions', () => {
  // Collect console errors and page errors to assert no unexpected runtime exceptions
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages and page errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Go to the app page fresh for each test
    await page.goto(APP_URL);
    // Ensure initial UI loaded
    await expect(page.locator('h1')).toHaveText('NoSQL Interactive Demo');
  });

  test.afterEach(async () => {
    // Assert no unhandled console errors or page errors occurred during the test run
    expect(consoleErrors, 'No console error logs should be emitted').toEqual([]);
    expect(pageErrors, 'No page errors (uncaught exceptions) should occur').toEqual([]);
  });

  // Utility helpers for interacting with the page elements
  const selectors = {
    collectionName: '#collectionName',
    createCollectionBtn: '#createCollectionBtn',
    deleteCollectionBtn: '#deleteCollectionBtn',
    collectionsList: '#collectionsList',
    collectionSelect: '#collectionSelect',
    docInput: '#docInput',
    insertDocBtn: '#insertDocBtn',
    updateDocBtn: '#updateDocBtn',
    deleteDocBtn: '#deleteDocBtn',
    docIdInput: '#docIdInput',
    output: '#output',
    dbstate: '#dbstate',
    queryInput: '#queryInput',
    queryLimit: '#queryLimit',
    runQueryBtn: '#runQueryBtn',
    indexNameInput: '#indexNameInput',
    indexCollectionSelect: '#indexCollectionSelect',
    indexFieldsInput: '#indexFieldsInput',
    createIndexBtn: '#createIndexBtn',
    indexDeleteSelect: '#indexDeleteSelect',
    deleteIndexBtn: '#deleteIndexBtn',
    aggPipelineInput: '#aggPipelineInput',
    runAggBtn: '#runAggBtn'
  };

  // Small helper to create collection via UI
  async function uiCreateCollection(page, name) {
    await page.fill(selectors.collectionName, name);
    await page.click(selectors.createCollectionBtn);
  }

  // Small helper to select a collection in the collectionSelect dropdown
  async function uiSelectCollection(page, name) {
    const select = page.locator(selectors.collectionSelect);
    // Wait for option to be present
    await expect(select).toBeVisible();
    // If there is no option yet, setting value would fail; play safe by waiting for option or error
    await page.selectOption(selectors.collectionSelect, { label: name });
  }

  // Tests for collection lifecycle
  test.describe('Collections (S0_Idle -> S1_CollectionCreated / S2_CollectionDeleted)', () => {
    test('Initial UI shows no collections and empty DB state', async ({ page }) => {
      // Validate initial collections list text and dbstate snapshot
      await expect(page.locator(selectors.collectionsList)).toHaveText('No collections created yet.');
      await expect(page.locator(selectors.dbstate)).toHaveText('{}');
      // Output should be empty initially
      await expect(page.locator(selectors.output)).toHaveText('');
    });

    test('Create a new collection updates UI and dbstate (S1_CollectionCreated)', async ({ page }) => {
      // Create collection named 'people'
      await uiCreateCollection(page, 'people');

      // Verify output message for collection creation
      await expect(page.locator(selectors.output)).toHaveText('Collection "people" created.');

      // collectionsList should reflect the new collection with 0 docs and 0 indexes
      await expect(page.locator(selectors.collectionsList)).toHaveText('- people (0 docs, 0 indexes)');

      // Both collection selects should include 'people'
      const collectionOptions = await page.locator(selectors.collectionSelect + ' option').allTextContents();
      expect(collectionOptions).toContain('people');
      const indexCollectionOptions = await page.locator(selectors.indexCollectionSelect + ' option').allTextContents();
      expect(indexCollectionOptions).toContain('people');

      // dbstate should show the new collection in the JSON
      const dbstateText = await page.locator(selectors.dbstate).textContent();
      expect(dbstateText).toContain('"people"');
      expect(dbstateText).toContain('"documents": {}');
    });

    test('Delete collection with confirmation removes collection (S2_CollectionDeleted)', async ({ page }) => {
      // Setup: create collection to delete
      await uiCreateCollection(page, 'toDelete');

      // Verify present
      await expect(page.locator(selectors.collectionsList)).toContainText('toDelete');

      // Intercept the confirm dialog and accept it
      page.on('dialog', async dialog => {
        // Ensure confirm prompt message includes collection name
        expect(dialog.type()).toBe('confirm');
        expect(dialog.message()).toContain('toDelete');
        await dialog.accept();
      });

      // Trigger delete
      await page.fill(selectors.collectionName, 'toDelete');
      await page.click(selectors.deleteCollectionBtn);

      // Confirm output
      await expect(page.locator(selectors.output)).toHaveText('Collection "toDelete" deleted.');

      // collectionsList should no longer contain it
      await expect(page.locator(selectors.collectionsList)).not.toContainText('toDelete');

      // dbstate should not include the collection
      const dbstateText = await page.locator(selectors.dbstate).textContent();
      expect(dbstateText).not.toContain('"toDelete"');
    });

    test('Cancel delete collection (confirmation dismissed) leaves collection intact', async ({ page }) => {
      // Create collection that will remain
      await uiCreateCollection(page, 'keepMe');

      // Dismiss the confirm dialog
      page.on('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        await dialog.dismiss();
      });

      // Try to delete by name but dismiss confirm
      await page.fill(selectors.collectionName, 'keepMe');
      await page.click(selectors.deleteCollectionBtn);

      // Since dialog dismissed, collection should remain and output should still show the creation message or previous state
      // The implementation returns early from delete if confirm is false, and does not set output for cancel.
      // So output should not be the "deleted" message.
      const out = await page.locator(selectors.output).textContent();
      expect(out).not.toBe('Collection "keepMe" deleted.');

      // collectionsList should still include keepMe
      await expect(page.locator(selectors.collectionsList)).toContainText('keepMe');
      await expect(page.locator(selectors.dbstate)).toContainText('"keepMe"');
    });

    test('Attempt to create a collection with empty name displays validation', async ({ page }) => {
      // Clear input and click create
      await page.fill(selectors.collectionName, '');
      await page.click(selectors.createCollectionBtn);

      await expect(page.locator(selectors.output)).toHaveText('Collection name cannot be empty.');
    });

    test('Attempt to delete non-existent collection shows error', async ({ page }) => {
      // Ensure name doesn't exist
      await page.fill(selectors.collectionName, 'noSuchCollection');
      // Accept confirm shouldn't be shown because code checks existence first
      await page.click(selectors.deleteCollectionBtn);

      await expect(page.locator(selectors.output)).toHaveText('Collection "noSuchCollection" does not exist.');
    });
  });

  // Tests for document operations (insert, update, delete)
  test.describe('Document Operations (S3_DocumentInserted, S4_DocumentUpdated, S5_DocumentDeleted)', () => {
    test.beforeEach(async ({ page }) => {
      // Ensure a collection exists for CRUD tests
      await uiCreateCollection(page, 'people');
      // Select the collection in the select element
      await uiSelectCollection(page, 'people');
    });

    test('Insert a valid document updates dbstate and output (S3_DocumentInserted)', async ({ page }) => {
      const docJson = JSON.stringify({ _id: 'abc123', name: 'John', age: 32 });
      await page.fill(selectors.docInput, docJson);
      await page.click(selectors.insertDocBtn);

      // Output message expected
      await expect(page.locator(selectors.output)).toHaveText('Inserted document with _id = abc123 into "people".');

      // DB state should include the document under people.documents
      const dbstateText = await page.locator(selectors.dbstate).textContent();
      expect(dbstateText).toContain('"abc123"');
      expect(dbstateText).toContain('"name": "John"');
    });

    test('Insert document with invalid JSON shows parse error', async ({ page }) => {
      await page.fill(selectors.docInput, '{ invalidJson: }');
      await page.click(selectors.insertDocBtn);

      await expect(page.locator(selectors.output)).toContainText('JSON parse error:');
    });

    test('Insert document missing _id is rejected', async ({ page }) => {
      await page.fill(selectors.docInput, JSON.stringify({ name: 'NoId' }));
      await page.click(selectors.insertDocBtn);

      await expect(page.locator(selectors.output)).toHaveText('Document must contain an "_id" field.');
    });

    test('Insert duplicate _id is rejected', async ({ page }) => {
      const docJson = JSON.stringify({ _id: 'dup', name: 'A' });
      await page.fill(selectors.docInput, docJson);
      await page.click(selectors.insertDocBtn);
      await expect(page.locator(selectors.output)).toHaveText('Inserted document with _id = dup into "people".');

      // Try inserting same id again
      await page.fill(selectors.docInput, docJson);
      await page.click(selectors.insertDocBtn);
      await expect(page.locator(selectors.output)).toHaveText('Insert failed: Document with _id="dup" already exists.');
    });

    test('Update existing document succeeds and updates dbstate (S4_DocumentUpdated)', async ({ page }) {
      // Insert a document first
      const doc = { _id: 'u1', name: 'Alice', age: 28 };
      await page.fill(selectors.docInput, JSON.stringify(doc));
      await page.click(selectors.insertDocBtn);
      await expect(page.locator(selectors.output)).toHaveText('Inserted document with _id = u1 into "people".');

      // Update the document: change age
      doc.age = 29;
      await page.fill(selectors.docInput, JSON.stringify(doc));
      await page.fill(selectors.docIdInput, 'u1');
      await page.click(selectors.updateDocBtn);

      await expect(page.locator(selectors.output)).toHaveText('Updated document with _id = u1 in "people".');

      // Verify dbstate reflects updated age
      const dbstateText = await page.locator(selectors.dbstate).textContent();
      expect(dbstateText).toContain('"age": 29');
    });

    test('Update with missing _id in JSON or mismatch is rejected', async ({ page }) {
      // Insert baseline doc
      const doc = { _id: 'u2', name: 'Bob', age: 40 };
      await page.fill(selectors.docInput, JSON.stringify(doc));
      await page.click(selectors.insertDocBtn);

      // Attempt update with JSON missing _id
      await page.fill(selectors.docInput, JSON.stringify({ name: 'Bob2', age: 41 }));
      await page.fill(selectors.docIdInput, 'u2');
      await page.click(selectors.updateDocBtn);
      await expect(page.locator(selectors.output)).toHaveText('Document JSON must include the same _id as provided.');

      // Attempt update with mismatched _id
      await page.fill(selectors.docInput, JSON.stringify({ _id: 'different', name: 'X' }));
      await page.fill(selectors.docIdInput, 'u2');
      await page.click(selectors.updateDocBtn);
      await expect(page.locator(selectors.output)).toHaveText('Document JSON must include the same _id as provided.');
    });

    test('Delete document by _id removes it and updates dbstate (S5_DocumentDeleted)', async ({ page }) {
      // Insert doc to delete
      await page.fill(selectors.docInput, JSON.stringify({ _id: 'del1', name: 'ToDelete' }));
      await page.click(selectors.insertDocBtn);
      await expect(page.locator(selectors.output)).toHaveText('Inserted document with _id = del1 into "people".');

      // Delete it
      await page.fill(selectors.docIdInput, 'del1');
      await page.click(selectors.deleteDocBtn);
      await expect(page.locator(selectors.output)).toHaveText('Deleted document with _id = del1 from "people".');

      // dbstate should not include the id anymore
      const dbstateText = await page.locator(selectors.dbstate).textContent();
      expect(dbstateText).not.toContain('"del1"');
    });

    test('Delete non-existent document shows error', async ({ page }) {
      await page.fill(selectors.docIdInput, 'noIdHere');
      await page.click(selectors.deleteDocBtn);
      await expect(page.locator(selectors.output)).toHaveText('No document with _id="noIdHere" found in collection.');
    });

    test('Operations fail when no collection selected', async ({ page }) {
      // Ensure collectionSelect has no value by creating another page instance or clearing selection
      // For safety, set collectionSelect to empty via evaluate
      await page.evaluate(() => {
        const sel = document.getElementById('collectionSelect');
        sel.innerHTML = '';
      });

      // Try insert
      await page.fill(selectors.docInput, JSON.stringify({ _id: 'x', name: 'X' }));
      await page.click(selectors.insertDocBtn);
      await expect(page.locator(selectors.output)).toHaveText('Select a collection first to insert document.');

      // Try update
      await page.click(selectors.updateDocBtn);
      await expect(page.locator(selectors.output)).toHaveText('Select a collection first to update document.');

      // Try delete
      await page.click(selectors.deleteDocBtn);
      await expect(page.locator(selectors.output)).toHaveText('Select a collection first to delete document.');
    });
  });

  // Tests for querying (S6_QueryExecuted)
  test.describe('Querying (S6_QueryExecuted)', () => {
    test.beforeEach(async ({ page }) => {
      // Ensure collection and some docs exist
      await uiCreateCollection(page, 'people');
      await uiSelectCollection(page, 'people');

      const docs = [
        { _id: 'q1', name: 'Alice', age: 30 },
        { _id: 'q2', name: 'Bob', age: 25 },
        { _id: 'q3', name: 'Charlie', age: 35 },
      ];
      for (const d of docs) {
        await page.fill(selectors.docInput, JSON.stringify(d));
        await page.click(selectors.insertDocBtn);
      }
    });

    test('Run a simple query returns matching documents and shows count', async ({ page }) {
      // Query for age > 29
      await page.fill(selectors.queryInput, JSON.stringify({ age: { $gt: 29 } }));
      await page.fill(selectors.queryLimit, '0');
      await page.click(selectors.runQueryBtn);

      // Expect output to show 2 documents (Alice age 30 and Charlie 35)
      const out = await page.locator(selectors.output).textContent();
      expect(out).toContain('Query results (2 documents):');
      expect(out).toContain('"q1"');
      expect(out).toContain('"q3"');
      expect(out).not.toContain('"q2"');
    });

    test('Query with invalid JSON shows parse error', async ({ page }) {
      await page.fill(selectors.queryInput, '{ not: json }');
      await page.click(selectors.runQueryBtn);
      await expect(page.locator(selectors.output)).toContainText('Query JSON parse error:');
    });

    test('Query with limit reduces result count', async ({ page }) {
      // Query matches everyone
      await page.fill(selectors.queryInput, JSON.stringify({}));
      await page.fill(selectors.queryLimit, '1');
      await page.click(selectors.runQueryBtn);

      const out = await page.locator(selectors.output).textContent();
      expect(out).toContain('Query results (1 documents):');
    });

    test('Query error thrown by matchesQuery is reported', async ({ page }) {
      // Induce a malformed query that the code is likely to accept but could throw if misused.
      // For example, provide a non-object as the query (string) — safeJSONparse ensures parsed type checked and runQuery will reject
      await page.fill(selectors.queryInput, JSON.stringify([])); // not an object
      await page.click(selectors.runQueryBtn);
      await expect(page.locator(selectors.output)).toHaveText('Query must be a JSON object');
    });
  });

  // Tests for index management (S7_IndexCreated, S8_IndexDeleted)
  test.describe('Indexes (S7_IndexCreated, S8_IndexDeleted)', () => {
    test.beforeEach(async ({ page }) => {
      // Create collection to attach indexes to
      await uiCreateCollection(page, 'books');
      await uiSelectCollection(page, 'books');
    });

    test('Create an index populates indexDeleteSelect and updates dbstate (S7_IndexCreated)', async ({ page }) {
      // Fill index form
      await page.fill(selectors.indexNameInput, 'byAuthor');
      // indexCollectionSelect should already contain 'books'
      await page.selectOption(selectors.indexCollectionSelect, { label: 'books' });
      await page.fill(selectors.indexFieldsInput, 'author,title');
      await page.click(selectors.createIndexBtn);

      await expect(page.locator(selectors.output)).toHaveText('Created index "byAuthor" on collection "books" on fields: author, title');

      // indexDeleteSelect should include 'books.byAuthor'
      const opts = await page.locator(selectors.indexDeleteSelect + ' option').allTextContents();
      expect(opts).toContain('books.byAuthor');

      // dbstate should show indexes under books
      const dbstateText = await page.locator(selectors.dbstate).textContent();
      expect(dbstateText).toContain('"byAuthor"');
      expect(dbstateText).toContain('"fields": [
    "author",');
    });

    test('Create index with empty name or fields shows validation errors', async ({ page }) {
      // Empty name
      await page.fill(selectors.indexNameInput, '');
      await page.selectOption(selectors.indexCollectionSelect, { label: 'books' });
      await page.fill(selectors.indexFieldsInput, 'author');
      await page.click(selectors.createIndexBtn);
      await expect(page.locator(selectors.output)).toHaveText('Index name cannot be empty.');

      // Empty fields
      await page.fill(selectors.indexNameInput, 'idx2');
      await page.fill(selectors.indexFieldsInput, '');
      await page.click(selectors.createIndexBtn);
      await expect(page.locator(selectors.output)).toHaveText('Specify at least one field for the index.');
    });

    test('Delete index removes it and updates dbstate (S8_IndexDeleted)', async ({ page }) {
      // Create first
      await page.fill(selectors.indexNameInput, 'byField');
      await page.selectOption(selectors.indexCollectionSelect, { label: 'books' });
      await page.fill(selectors.indexFieldsInput, 'field1');
      await page.click(selectors.createIndexBtn);
      await expect(page.locator(selectors.output)).toHaveText('Created index "byField" on collection "books" on fields: field1');

      // Select index to delete
      await page.selectOption(selectors.indexDeleteSelect, { label: 'books.byField' });
      await page.click(selectors.deleteIndexBtn);

      await expect(page.locator(selectors.output)).toHaveText('Deleted index "byField" from collection "books".');

      // Ensure dbstate no longer contains the index
      const dbstateText = await page.locator(selectors.dbstate).textContent();
      expect(dbstateText).not.toContain('byField');
    });

    test('Delete index with nothing selected shows prompt error', async ({ page }) {
      // Ensure no index present
      // Clear any options
      await page.evaluate(() => {
        const s = document.getElementById('indexDeleteSelect');
        s.innerHTML = '';
      });

      await page.click(selectors.deleteIndexBtn);
      await expect(page.locator(selectors.output)).toHaveText('Select an index to delete.');
    });
  });

  // Aggregation tests (S9_AggregationExecuted)
  test.describe('Aggregation (S9_AggregationExecuted)', () => {
    test.beforeEach(async ({ page }) => {
      // Create collection and insert docs
      await uiCreateCollection(page, 'sales');
      await uiSelectCollection(page, 'sales');

      const docs = [
        { _id: 's1', name: 'A', amount: 10 },
        { _id: 's2', name: 'B', amount: 20 },
        { _id: 's3', name: 'A', amount: 30 },
        { _id: 's4', name: 'C', amount: 5 },
      ];
      for (const d of docs) {
        await page.fill(selectors.docInput, JSON.stringify(d));
        await page.click(selectors.insertDocBtn);
      }
    });

    test('Run a group aggregation pipeline returns grouped results (S9_AggregationExecuted)', async ({ page }) {
      // Pipeline: match amount >= 10, group by name with total sum, sort descending, limit 3
      const pipeline = [
        { $match: { amount: { $gte: 10 } } },
        { $group: { _id: '$name', total: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 3 }
      ];
      await page.fill(selectors.aggPipelineInput, JSON.stringify(pipeline));
      await page.click(selectors.runAggBtn);

      const out = await page.locator(selectors.output).textContent();
      expect(out).toContain('Aggregation result (3 documents):');
      // Expect grouped _id values like "A", "B", "C" (C filtered out by match maybe)
      expect(out).toContain('"A"');
      expect(out).toContain('"B"');
    });

    test('Aggregation with invalid JSON shows parse error', async ({ page }) {
      await page.fill(selectors.aggPipelineInput, '{bad: json}');
      await page.click(selectors.runAggBtn);
      await expect(page.locator(selectors.output)).toContainText('Pipeline JSON parse error:');
    });

    test('Aggregation pipeline type check rejects non-array pipelines', async ({ page }) {
      // Provide object instead of array
      await page.fill(selectors.aggPipelineInput, JSON.stringify({ a: 1 }));
      await page.click(selectors.runAggBtn);
      await expect(page.locator(selectors.output)).toHaveText('Aggregation pipeline must be an array.');
    });

    test('Aggregation unsupported stage triggers error message', async ({ page }) {
      // Use an unsupported stage
      const pipeline = [{ $unknownStage: {} }];
      await page.fill(selectors.aggPipelineInput, JSON.stringify(pipeline));
      await page.click(selectors.runAggBtn);
      await expect(page.locator(selectors.output)).toContainText('Aggregation error: Unsupported pipeline stage');
    });
  });

  // Confirm that the entry actions refreshCollectionsUI() and refreshDbState() produce visible effects:
  test('Entry actions refreshCollectionsUI and refreshDbState are executed on create/delete collection transitions', async ({ page }) => {
    // Initial collectionsList should be empty
    await expect(page.locator(selectors.collectionsList)).toHaveText('No collections created yet.');
    // Create collection triggers refreshCollectionsUI and refreshDbState entry actions per FSM
    await uiCreateCollection(page, 'refreshTest');
    await expect(page.locator(selectors.collectionsList)).toContainText('refreshTest');
    await expect(page.locator(selectors.dbstate)).toContainText('"refreshTest"');

    // Delete collection triggers same refresh actions
    page.on('dialog', async dialog => dialog.accept());
    await page.fill(selectors.collectionName, 'refreshTest');
    await page.click(selectors.deleteCollectionBtn);
    await expect(page.locator(selectors.collectionsList)).toHaveText('No collections created yet.');
    await expect(page.locator(selectors.dbstate)).toHaveText('{}');
    await expect(page.locator(selectors.output)).toHaveText('Collection "refreshTest" deleted.');
  });
});