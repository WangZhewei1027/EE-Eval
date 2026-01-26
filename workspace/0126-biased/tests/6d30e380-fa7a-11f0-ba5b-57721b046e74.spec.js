import { test, expect } from '@playwright/test';

// Test file for Application ID: 6d30e380-fa7a-11f0-ba5b-57721b046e74
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/6d30e380-fa7a-11f0-ba5b-57721b046e74.html
// This suite validates all FSM states and transitions described in the specification.
// It also observes console errors and page errors without modifying the page runtime.
// The tests assume the page is served exactly as provided.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d30e380-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('NoSQL Interactive Explorer - FSM & UI validation', () => {
  // Capture console errors and page errors for each test and assert none are thrown.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages of type 'error'
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Collect uncaught exceptions (pageerror)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the app exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait a short moment for the page's initialization script to run (it clicks initDb automatically)
    await page.waitForTimeout(50);
  });

  test.afterEach(async () => {
    // After each test assert no unexpected console/page errors occurred.
    // These assertions ensure we observed runtime issues (if any) and fail the test if there are errors.
    expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console error messages: ${consoleErrors.map(e => e.text).join('; ')}`).toHaveLength(0);
  });

  test.describe('Initial page and initialization (S0_Idle -> S1_DatabaseInitialized)', () => {
    test('renders page and auto-initializes to document DB on load', async ({ page }) => {
      // Validate heading exists (S0_Idle evidence)
      const heading = page.locator('h1');
      await expect(heading).toHaveText('NoSQL Interactive Explorer');

      // The page script auto-initializes to document DB via initDbBtn.click() at the end of the HTML.
      // Check dbStatus shows the expected initialized text (S1_DatabaseInitialized evidence).
      const dbStatus = page.locator('#dbStatus');
      await expect(dbStatus).toHaveText(/Document Store \(MongoDB-like\) initialized/);

      // Document controls should be visible, graph controls hidden
      const docControls = page.locator('#documentControls');
      const graphControls = page.locator('#graphControls');
      await expect(docControls).toBeVisible();
      await expect(graphControls).toHaveClass(/hidden/);

      // Stats should reflect empty DB
      await expect(page.locator('#docCount')).toHaveText('0');
      await expect(page.locator('#relCount')).toHaveText('0');
    });

    test('user can change DB type and initialize graph DB (InitializeDatabase event)', async ({ page }) => {
      // Change database type to 'graph' and click Initialize Database
      const dbType = page.locator('#dbType');
      await dbType.selectOption('graph');
      await page.locator('#initDb').click();

      // dbStatus should reflect Graph initialization
      await expect(page.locator('#dbStatus')).toHaveText(/Graph \(Neo4j-like\) initialized/);

      // Graph controls should now be visible; document controls hidden
      await expect(page.locator('#graphControls')).toBeVisible();
      await expect(page.locator('#documentControls')).toHaveClass(/hidden/);

      // Stats should be updated (nodes/documents count)
      await expect(page.locator('#docCount')).toHaveText('0');
      await expect(page.locator('#relCount')).toHaveText('0');
    });
  });

  test.describe('Document operations (InsertDocument, QueryDocuments, GetAllDocuments)', () => {
    test('insert a document and validate UI feedback and stats (S2_DocumentCreated)', async ({ page }) => {
      // Ensure DB is a document store
      await page.locator('#dbType').selectOption('document');
      await page.locator('#initDb').click();

      // Insert a document
      const newDoc = { name: 'Alice', value: 10, tags: ['demo', 'user'] };
      await page.fill('#newDocument', JSON.stringify(newDoc));
      await page.locator('#createDocument').click();

      // The page should display an insertion message with generated ID
      const qResults = page.locator('#queryResults');
      await expect(qResults).toHaveText(/Document inserted with ID: [a-z0-9]+/i);

      // docCount should increment to 1 (updateStats was called)
      await expect(page.locator('#docCount')).toHaveText('1');

      // Insert invalid JSON to trigger error path and validate it surfaces in queryResults
      await page.fill('#newDocument', '{"invalidJson": true,,}');
      await page.locator('#createDocument').click();
      await expect(qResults).toHaveText(/Error:/);
    });

    test('query documents by field and get all documents (QueryDocuments & GetAllDocuments)', async ({ page }) => {
      // Initialize document DB and clear any existing documents via re-init
      await page.locator('#dbType').selectOption('document');
      await page.locator('#initDb').click();

      // Insert two documents with different values
      await page.fill('#newDocument', JSON.stringify({ name: 'Bob', value: 20, tags: ['alpha'] }));
      await page.locator('#createDocument').click();
      await page.waitForTimeout(10); // allow update
      await page.fill('#newDocument', JSON.stringify({ name: 'Carol', value: 30, tags: ['beta'] }));
      await page.locator('#createDocument').click();

      // Query for name=Bob
      await page.fill('#queryField', 'name');
      await page.fill('#queryValue', 'Bob');
      await page.locator('#queryDocuments').click();

      // Results should include Bob (displayResults renders an HTML table)
      await expect(page.locator('#queryResults')).toContainText('Bob');

      // Get all documents should render both Bob and Carol
      await page.fill('#queryField', '');
      await page.fill('#queryValue', '');
      await page.locator('#getAllDocuments').click();
      await expect(page.locator('#queryResults')).toContainText('Bob');
      await expect(page.locator('#queryResults')).toContainText('Carol');
    });

    test('create index edge cases (CreateIndex)', async ({ page }) => {
      // Ensure document DB initialized
      await page.locator('#dbType').selectOption('document');
      await page.locator('#initDb').click();

      // Create index with empty field -> error shown in queryResults
      await page.fill('#indexField', '');
      await page.locator('#createIndex').click();
      await expect(page.locator('#queryResults')).toHaveText('Error: Please specify a field to index');

      // Insert a doc and create index on 'name'
      await page.fill('#newDocument', JSON.stringify({ name: 'Indexed', value: 5 }));
      await page.locator('#createDocument').click();
      await page.fill('#indexField', 'name');
      await page.locator('#createIndex').click();
      await expect(page.locator('#queryResults')).toHaveText('Index created on field: name');

      // Creating same index again should yield "already exists"
      await page.locator('#createIndex').click();
      await expect(page.locator('#queryResults')).toHaveText('Index already exists on field: name');
    });

    test('aggregation operations and edge cases (RunAggregation -> S5_AggregationResult)', async ({ page }) => {
      // Initialize document DB and insert a few docs with numeric 'value'
      await page.locator('#dbType').selectOption('document');
      await page.locator('#initDb').click();

      await page.fill('#newDocument', JSON.stringify({ name: 'A', value: 1 }));
      await page.locator('#createDocument').click();
      await page.fill('#newDocument', JSON.stringify({ name: 'B', value: 2 }));
      await page.locator('#createDocument').click();
      await page.fill('#newDocument', JSON.stringify({ name: 'C' })); // no value
      await page.locator('#createDocument').click();

      // Run sum aggregation
      await page.selectOption('#aggOperation', 'sum');
      await page.fill('#aggField', 'value');
      await page.locator('#runAggregation').click();
      await expect(page.locator('#queryResults')).toHaveText(/Aggregation result \(sum of value\): 3/);

      // Run aggregation with missing field -> "Please specify" or "No documents have field:"
      await page.fill('#aggField', '');
      await page.locator('#runAggregation').click();
      await expect(page.locator('#queryResults')).toHaveText('Error: Please specify a field to aggregate');

      // Aggregation when no documents have field should indicate no documents
      await page.fill('#aggField', 'nonexistentField');
      await page.selectOption('#aggOperation', 'count');
      await page.locator('#runAggregation').click();
      await expect(page.locator('#queryResults')).toHaveText(/No documents have field: nonexistentField/);
    });
  });

  test.describe('Transaction operations (RunTransaction -> S6_TransactionResult)', () => {
    test('run valid transaction with insert and validate results and stats', async ({ page }) => {
      // Init document DB
      await page.locator('#dbType').selectOption('document');
      await page.locator('#initDb').click();

      // Prepare a transaction which inserts a new document
      const ops = [{ op: 'insert', data: { txName: 'TX1' } }];
      await page.fill('#transactionOps', JSON.stringify(ops));
      await page.locator('#runTransaction').click();

      // The queryResults should contain the insertion message
      await expect(page.locator('#queryResults')).toContainText('Inserted document with ID:');

      // docCount should reflect the inserted document (1)
      await expect(page.locator('#docCount')).toHaveText('1');
    });

    test('run invalid transaction JSON -> error path', async ({ page }) => {
      await page.locator('#dbType').selectOption('document');
      await page.locator('#initDb').click();

      // Invalid JSON should produce a "Transaction error" message
      await page.fill('#transactionOps', '{"op": "insert", "data": { invalid }');
      await page.locator('#runTransaction').click();
      await expect(page.locator('#queryResults')).toContainText('Transaction error:');
    });

    test('run transaction with update and delete operations', async ({ page }) => {
      // Initialize and add a couple of docs to update/delete
      await page.locator('#dbType').selectOption('document');
      await page.locator('#initDb').click();

      await page.fill('#newDocument', JSON.stringify({ name: 'T1', flag: true }));
      await page.locator('#createDocument').click();
      await page.fill('#newDocument', JSON.stringify({ name: 'T2', flag: false }));
      await page.locator('#createDocument').click();

      // Construct a transaction: update where name=T1, delete where flag=false
      const txOps = [
        { op: 'update', query: { name: 'T1' }, update: { updated: true } },
        { op: 'delete', query: { flag: false } }
      ];
      await page.fill('#transactionOps', JSON.stringify(txOps));
      await page.locator('#runTransaction').click();

      // Expect results mention updated documents and deleted count
      const qr = page.locator('#queryResults');
      await expect(qr).toContainText(/Updated \d+ documents/);
      await expect(qr).toContainText(/Deleted \d+ documents/);
    });
  });

  test.describe('Graph operations (CreateNode -> S3_NodeCreated, CreateRelationship -> S4_RelationshipCreated, TraverseGraph)', () => {
    test('create nodes, create relationship, traverse graph, plus error scenarios', async ({ page }) => {
      // Initialize graph DB
      await page.locator('#dbType').selectOption('graph');
      await page.locator('#initDb').click();

      // Create first node
      await page.fill('#nodeLabel', 'Person');
      await page.fill('#nodeProperties', JSON.stringify({ name: 'NodeOne' }));
      await page.locator('#createNode').click();
      const qResults = page.locator('#queryResults');
      await expect(qResults).toHaveText(/Node created with ID: [a-z0-9]+/i);
      const firstText = (await qResults.innerText()).trim();
      const firstIdMatch = firstText.match(/Node created with ID: ([a-z0-9]+)/i);
      expect(firstIdMatch).not.toBeNull();
      const firstId = firstIdMatch[1];

      // Create second node
      await page.fill('#nodeLabel', 'Person');
      await page.fill('#nodeProperties', JSON.stringify({ name: 'NodeTwo' }));
      await page.locator('#createNode').click();
      await expect(qResults).toHaveText(/Node created with ID: [a-z0-9]+/i);
      const secondText = (await qResults.innerText()).trim();
      const secondId = secondText.match(/Node created with ID: ([a-z0-9]+)/i)[1];

      // Create relationship between nodes
      await page.fill('#relType', 'FRIEND');
      await page.fill('#fromNode', firstId);
      await page.fill('#toNode', secondId);
      await page.locator('#createRelationship').click();
      await expect(qResults).toHaveText(/Relationship created with ID: [a-z0-9]+/i);

      // relCount should be 1
      await expect(page.locator('#relCount')).toHaveText('1');

      // Attempt to create relationship with invalid node IDs -> error message shown
      await page.fill('#fromNode', 'nonexistent');
      await page.fill('#toNode', 'alsoinvalid');
      await page.locator('#createRelationship').click();
      await expect(qResults).toHaveText('Error: One or both nodes not found');

      // Traverse from first node with depth=1 -> should render a table with path
      await page.fill('#startNode', firstId);
      await page.fill('#depth', '1');
      await page.locator('#traverseGraph').click();
      // For graph traversal it renders an HTML table
      const qrHtml = await qResults.innerHTML();
      expect(qrHtml).toContain('<table>');
      expect(qrHtml).toContain('→'); // path arrow used in path rendering
    });

    test('traverse with missing start node -> error case', async ({ page }) => {
      // Ensure graph DB is initialized
      await page.locator('#dbType').selectOption('graph');
      await page.locator('#initDb').click();

      // Try traversing from an ID that doesn't exist
      await page.fill('#startNode', 'does-not-exist');
      await page.locator('#traverseGraph').click();
      await expect(page.locator('#queryResults')).toHaveText('Error: Start node not found');
    });
  });

  test.describe('Misc UI and stats validations (updateStats on transitions)', () => {
    test('updateStats is called after operations and refreshStats button works', async ({ page }) => {
      // Initialize document DB and insert a doc
      await page.locator('#dbType').selectOption('document');
      await page.locator('#initDb').click();
      await page.fill('#newDocument', JSON.stringify({ name: 'StatsDoc' }));
      await page.locator('#createDocument').click();
      await expect(page.locator('#docCount')).toHaveText('1');

      // Click refreshStats (it simply calls updateStats indirectly by reading UI)
      await page.locator('#refreshStats').click();
      // Stats should remain consistent
      await expect(page.locator('#docCount')).toHaveText('1');
      await expect(page.locator('#storageSize')).not.toHaveText(''); // ensure storageSize renders a number (could be 0)
    });
  });
});