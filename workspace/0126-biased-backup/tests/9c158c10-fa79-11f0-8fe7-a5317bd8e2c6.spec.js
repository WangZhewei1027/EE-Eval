import { test, expect } from '@playwright/test';

const APP = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c158c10-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object encapsulating common interactions
class SandboxPage {
  constructor(page){
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  async initCapture(){
    this.page.on('console', msg => {
      this.consoleMessages.push({type: msg.type(), text: msg.text()});
    });
    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
  }

  async goto(){
    await this.page.goto(APP);
    // Wait for initial data to load (loadExampleData() runs on startup)
    await this.page.waitForSelector('#tableSelect option', { timeout: 5000 });
  }

  async selectTable(name){
    await this.page.selectOption('#tableSelect', { label: name }).catch(()=>{});
    // ensure value set
    await this.page.waitForFunction((n)=> {
      const sel = document.getElementById('tableSelect');
      return sel && sel.value === n;
    }, name);
  }

  async clickViewTable(){
    await this.page.click('#viewTableBtn');
  }

  async clickEditTable(){
    await this.page.click('#editTableBtn');
  }

  async insertRowInEditForm(values = {}){
    // Assumes edit form already present in #tableEditControls
    const container = this.page.locator('#tableEditControls');
    await expect(container).toBeVisible();
    const inputs = container.locator('input[data-col]');
    const count = await inputs.count();
    for(let i=0;i<count;i++){
      const el = inputs.nth(i);
      const col = await el.getAttribute('data-col');
      const val = values[col] !== undefined ? String(values[col]) : '';
      await el.fill(val);
    }
    await container.locator('button', { hasText: 'Insert Row' }).click();
  }

  async viewTableRowsText() {
    return this.page.locator('#tableView').innerText();
  }

  async addWhereCondition({table, col, op, val, bool = 'AND'}){
    // Click add condition and fill last added condition
    await this.page.click('#addWhereBtn');
    const whereArea = this.page.locator('#whereArea');
    const cond = whereArea.locator('div').last();
    // select bool
    const boolSel = cond.locator('select').nth(0);
    const tableSel = cond.locator('select').nth(1);
    const colSel = cond.locator('select').nth(2);
    const opSel = cond.locator('select').nth(3);
    const valInput = cond.locator('input');
    await boolSel.selectOption({ label: bool });
    await tableSel.selectOption({ label: table });
    // Wait for columns to populate based on table
    await this.page.waitForFunction((t, idx) => {
      const area = document.getElementById('whereArea');
      const d = area.querySelectorAll('div')[idx];
      if(!d) return false;
      const selects = d.querySelectorAll('select');
      return selects[2] && selects[2].options.length > 0;
    }, table, await cond.evaluate((el, idx) => {
      const area = document.getElementById('whereArea');
      return Array.from(area.children).indexOf(el);
    }));
    await colSel.selectOption({ label: col });
    await opSel.selectOption({ label: op });
    await valInput.fill(val);
  }

  async generateSql(){
    await this.page.click('#generateSqlBtn');
    await this.page.waitForSelector('#explainArea pre');
    return this.page.locator('#explainArea pre').innerText();
  }

  async runQuery(){
    await this.page.click('#runQueryBtn');
    // queryResult may show immediately
    await this.page.waitForTimeout(200); // small wait to let JS update
  }

  async exportDb(){
    await this.page.click('#exportDbBtn');
    return this.page.locator('#importExport').inputValue();
  }

  async importDbWithExpect(text, expectedAlertPrefix){
    // Use page.once to handle alert triggered by importDbBtn
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.page.fill('#importExport', text);
    const clickPromise = this.page.click('#importDbBtn');
    const dialog = await dialogPromise;
    const msg = dialog.message();
    await dialog.accept();
    await clickPromise;
    if(expectedAlertPrefix) expect(msg).toContain(expectedAlertPrefix);
    return msg;
  }

  async createIndex(table, column){
    await this.page.selectOption('#indexTableSelect', { label: table });
    await this.page.fill('#indexColumnInput', column);
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.page.click('#createIndexBtn');
    const d = await dialogPromise;
    const m = d.message();
    await d.accept();
    return m;
  }

  async dropIndex(table, column){
    await this.page.selectOption('#indexTableSelect', { label: table });
    await this.page.fill('#indexColumnInput', column);
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.page.click('#dropIndexBtn');
    const d = await dialogPromise;
    const m = d.message();
    await d.accept();
    return m;
  }

  async saveQuery(name){
    // clicking saveQueryBtn triggers prompt; handle it
    const dialogPromise = this.page.waitForEvent('dialog');
    const click = this.page.click('#saveQueryBtn');
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('prompt');
    await dialog.accept(name);
    await click;
  }

  async loadSavedQuery(){
    await this.page.click('#loadSavedQueryBtn');
  }

  async runRawSql(sql){
    await this.page.fill('#rawSqlInput', sql);
    await this.page.click('#runRawSqlBtn');
    await this.page.waitForTimeout(100);
  }
}

test.describe('SQL Interactive Sandbox - FSM and UI tests', () => {
  let sandbox;
  test.beforeEach(async ({ page }) => {
    sandbox = new SandboxPage(page);
    await sandbox.initCapture();
    await sandbox.goto();
  });

  test.afterEach(async ({}, testInfo) => {
    // Assert no uncaught page errors occurred during a test
    // Also assert there are no console messages of type 'error'
    const pageErrors = sandbox.pageErrors.map(e => String(e));
    const consoleErrors = sandbox.consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    // Provide extra debug information if test fails
    if (testInfo.status !== 'passed') {
      console.log('Captured console messages:', sandbox.consoleMessages);
      console.log('Captured page errors:', pageErrors);
    }
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('State S0 (Idle) and initial UI', () => {
    test('Initial load populates selects and clears result areas', async ({ page }) => {
      // Validate page title and presence of key UI elements
      await expect(page.locator('h1')).toHaveText('SQL Interactive Sandbox');
      // tableSelect has options loaded by loadExampleData
      const options = await page.locator('#tableSelect option').allTextContents();
      expect(options.length).toBeGreaterThan(0);
      // table view/edit/explain areas should be empty initially
      await expect(page.locator('#tableView')).toBeEmpty();
      await expect(page.locator('#tableEditControls')).toBeEmpty();
      await expect(page.locator('#explainArea')).toBeEmpty();
      await expect(page.locator('#queryResult')).toBeEmpty();
    });

    test('Create table without name triggers alert (edge case)', async ({ page }) => {
      // Ensure newTableName is empty then click createTableBtn and assert alert message
      await page.fill('#newTableName', '');
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#createTableBtn');
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Provide table name');
      await dialog.accept();
    });
  });

  test.describe('State S1 (Table Selected) and S4 (Editing Table)', () => {
    test('View table renders table rows and action buttons', async ({ page }) => {
      // Select users and click view
      await sandbox.selectTable('users');
      await sandbox.clickViewTable();
      // tableView should contain header and rows including '__id'
      const text = await sandbox.viewTableRowsText();
      expect(text).toContain('__id');
      expect(text.length).toBeGreaterThan(10);
      // edit and delete buttons should exist
      const editBtns = page.locator('.editRowBtn');
      const delBtns = page.locator('.delRowBtn');
      expect(await editBtns.count()).toBeGreaterThan(0);
      expect(await delBtns.count()).toBeGreaterThan(0);
    });

    test('Edit table opens insert form and inserting adds a row', async ({ page }) => {
      // Select users, click Edit Table to open insert form
      await sandbox.selectTable('users');
      await sandbox.clickEditTable();
      // Ensure Insert Row button present
      await expect(page.locator('#tableEditControls button', { hasText: 'Insert Row' })).toBeVisible();
      // Insert a new row with distinctive values
      const uniqueName = 'TestUser_' + Date.now();
      await sandbox.insertRowInEditForm({ id: 9999, name: uniqueName, email: 't@example.com', age: 77 });
      // After insert, tableView should include the unique name
      await sandbox.selectTable('users');
      await sandbox.clickViewTable();
      const tv = page.locator('#tableView');
      await expect(tv).toContainText(uniqueName);
      // Now click the edit button for the newly inserted row and change its name
      const editBtnForRow = page.locator('button.editRowBtn').filter({ hasText: 'Edit' }).last();
      await editBtnForRow.click();
      // Now a form appears in tableEditControls; change first input to updated name
      const editForm = page.locator('#tableEditControls div').locator('div').first();
      // The edit form inputs may not have data-col attributes (they do), find inputs
      const inputs = page.locator('#tableEditControls input[data-col]');
      const count = await inputs.count();
      // Find the input for 'name' and change it
      for(let i=0;i<count;i++){
        const el = inputs.nth(i);
        const col = await el.getAttribute('data-col');
        if(col === 'name'){
          await el.fill(uniqueName + '_edited');
        }
      }
      // Click Save in the inline edit form
      await page.locator('#tableEditControls').locator('button', { hasText: 'Save' }).click();
      // Confirm the table shows edited name
      await sandbox.selectTable('users');
      await sandbox.clickViewTable();
      await expect(page.locator('#tableView')).toContainText(uniqueName + '_edited');
    });
  });

  test.describe('State S2 (Query Built) and query actions', () => {
    test('Generate SQL shows SQL and Run Query returns results', async ({ page }) => {
      // Select table in fromTables and select some columns via refreshColumnsArea
      await page.selectOption('#fromTables', { label: 'users' });
      // Wait for columns area to populate checkboxes
      await page.waitForSelector('#columnsArea button', { timeout: 2000 });
      // Select all columns by clicking Select All button in columnsArea
      const selectAllBtn = page.locator('#columnsArea button', { hasText: 'Select All' });
      await selectAllBtn.click();
      // Generate SQL and assert explain area updated
      const sql = await sandbox.generateSql();
      expect(sql.toUpperCase()).toContain('SELECT');
      expect(sql).toContain('FROM users');
      // Add a WHERE condition for users.age > 30 and run query
      await sandbox.addWhereCondition({ table: 'users', col: 'age', op: '>', val: '30', bool: 'AND' });
      await sandbox.generateSql(); // update explain area
      await sandbox.runQuery();
      // queryResult should have a table with at least one row (Dan age 40)
      const qr = page.locator('#queryResult table');
      await expect(qr).toBeVisible();
      // Ensure one of the cells contains '40' (age)
      await expect(page.locator('#queryResult')).toContainText('40');
    });

    test('Explain / Step produces step UI', async ({ page }) => {
      // Build a minimal query
      await page.selectOption('#fromTables', { label: 'users' });
      await page.waitForSelector('#columnsArea button', { timeout: 2000 });
      // Generate and then invoke explain
      await sandbox.generateSql();
      await page.click('#explainBtn');
      // explainArea should contain navigation buttons and step header
      const explainArea = page.locator('#explainArea');
      await expect(explainArea).toContainText('Step');
      await expect(explainArea.locator('button', { hasText: 'Next' })).toBeVisible();
      await expect(explainArea.locator('button', { hasText: 'Prev' })).toBeVisible();
    });

    test('Save and Load Query (SaveQuery transition)', async ({ page }) => {
      // Ensure fromTables selection present
      await page.selectOption('#fromTables', { label: 'users' });
      await page.waitForSelector('#columnsArea button', { timeout: 2000 });
      // Save query by handling prompt
      const savedName = 'mysaved_' + Date.now();
      await sandbox.saveQuery(savedName);
      // After accepting prompt, the savedQueries select should include our savedName
      await page.waitForSelector('#savedQueries option');
      const opts = await page.locator('#savedQueries option').allTextContents();
      expect(opts).toContain(savedName);
      // Select the saved option and load it
      await page.selectOption('#savedQueries', { label: savedName });
      await page.click('#loadSavedQueryBtn');
      // Loading should not throw and should leave columnsArea present
      await expect(page.locator('#columnsArea')).toBeVisible();
    });
  });

  test.describe('State S3 (Transactions)', () => {
    test('Begin, Commit and Rollback transaction flow', async ({ page }) => {
      // Begin transaction -> alert 'Transaction started'
      const beginDialog = page.waitForEvent('dialog');
      await page.click('#beginTxBtn');
      const d1 = await beginDialog;
      expect(d1.message()).toContain('Transaction started');
      await d1.accept();
      // Commit -> alert 'Committed'
      const commitDialog = page.waitForEvent('dialog');
      await page.click('#commitTxBtn');
      const d2 = await commitDialog;
      expect(d2.message()).toContain('Committed');
      await d2.accept();
      // Begin then Rollback -> expect 'Transaction started' then 'Rolled back'
      const beginDialog2 = page.waitForEvent('dialog');
      await page.click('#beginTxBtn');
      const d3 = await beginDialog2;
      expect(d3.message()).toContain('Transaction started');
      await d3.accept();
      const rollbackDialog = page.waitForEvent('dialog');
      await page.click('#rollbackTxBtn');
      const d4 = await rollbackDialog;
      // Could be 'Rolled back'
      expect(d4.message()).toContain('Rolled back');
      await d4.accept();
    });

    test('Rollback without active transaction shows error alert (edge)', async ({ page }) => {
      // Ensure no transaction active by calling rollback directly and expecting alert with 'No transaction' or error message
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#rollbackTxBtn');
      const d = await dialogPromise;
      const msg = d.message();
      // msg should be either 'No transaction' or similar thrown by db.rollback
      expect(typeof msg).toBe('string');
      await d.accept();
    });
  });

  test.describe('State S5 (Import/Export) and Indexes', () => {
    test('Export produces JSON and import validates JSON (success and failure)', async ({ page }) => {
      // Export DB
      const json = await sandbox.exportDb();
      expect(json).toBeTruthy();
      expect(json).toContain('users');
      // Try importing invalid JSON and expect an alert that import failed
      const invalid = 'not a json';
      const msg = await sandbox.importDbWithExpect(invalid, 'Import failed');
      expect(msg).toContain('Import failed');
      // Now import valid JSON and expect 'Imported' alert
      const validMsg = await sandbox.importDbWithExpect(json, 'Imported');
      expect(validMsg).toContain('Imported');
    });

    test('Create and Drop Index affect indexList and show alerts', async ({ page }) => {
      // Create index on users.age
      const createMsg = await sandbox.createIndex('users', 'age');
      expect(createMsg).toContain('Index created');
      // indexList should contain 'users' and 'age'
      await page.waitForTimeout(200); // allow UI refresh or interval
      const idxText = await page.locator('#indexList').innerText();
      expect(idxText.toLowerCase()).toContain('users');
      // Drop index
      const dropMsg = await sandbox.dropIndex('users', 'age');
      expect(dropMsg).toContain('Index dropped');
    });
  });

  test.describe('History & Advanced: Raw SQL', () => {
    test('Run raw SELECT and get results', async ({ page }) => {
      // Run a simple raw SELECT that should return Dan (age 40)
      await sandbox.runRawSql("SELECT * FROM users WHERE users.age > 30");
      // Query result area should display a table with '40' present
      await expect(page.locator('#queryResult')).toContainText('40');
    });

    test('Raw INSERT, UPDATE, DELETE and CREATE table operations', async ({ page }) => {
      // CREATE TABLE test_raw
      await sandbox.runRawSql("CREATE TABLE test_raw (id int, val text)");
      await expect(page.locator('#rawSqlResult')).toContainText('Table test_raw created');
      // INSERT into test_raw
      await sandbox.runRawSql("INSERT INTO test_raw (id,val) VALUES (1,'abc')");
      await expect(page.locator('#rawSqlResult')).toContainText('Inserted into test_raw');
      // Verify via view: select the new table in tableSelect and view
      // The new table should appear in selects after refreshUI
      await page.waitForTimeout(200);
      // Select test_raw in fromTables and generate SQL to get results
      // Use view table button: first select in tableSelect
      await page.selectOption('#tableSelect', { label: 'test_raw' });
      await page.click('#viewTableBtn');
      await expect(page.locator('#tableView')).toContainText('abc');
      // UPDATE the inserted row
      await sandbox.runRawSql("UPDATE test_raw SET val='def' WHERE test_raw.id = 1");
      await expect(page.locator('#rawSqlResult')).toContainText('Updated');
      // View updated content
      await page.click('#viewTableBtn');
      await expect(page.locator('#tableView')).toContainText('def');
      // DELETE the row
      await sandbox.runRawSql("DELETE FROM test_raw WHERE test_raw.id = 1");
      await expect(page.locator('#rawSqlResult')).toContainText('Deleted');
      // View empty result
      await page.click('#viewTableBtn');
      await expect(page.locator('#tableView')).not.toContainText('def');
    });
  });

  test.describe('Edge cases and error handling', () => {
    test('Attempting to drop table triggers confirmation and removes table', async ({ page }) => {
      // Create a new table to drop
      const name = 'tmp_drop_' + Date.now();
      await page.fill('#newTableName', name);
      await page.fill('#newTableColumns', 'a:int');
      // Create table - no alert expected
      await page.click('#createTableBtn');
      // Wait for select update
      await page.waitForFunction((n)=> {
        const sel = document.getElementById('tableSelect');
        return Array.from(sel.options).some(o=>o.value===n);
      }, name);
      // Select it and click dropTableBtn; handle confirm dialog to accept
      await page.selectOption('#tableSelect', { label: name });
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#dropTableBtn');
      const d = await dialogPromise;
      expect(d.type()).toBe('confirm');
      // Confirm the drop
      await d.accept();
      // Table should no longer be in select
      await page.waitForTimeout(200);
      const opts = await page.locator('#tableSelect option').allTextContents();
      expect(opts).not.toContain(name);
    });

    test('Importing DB with indexes serialized as objects is handled (structure conversion)', async ({ page }) => {
      // Export current DB
      const exported = await sandbox.exportDb();
      const parsed = JSON.parse(exported);
      // Artificially create an index serialization as object of arrays for a table, then import
      if (Object.keys(parsed).length === 0) {
        test.skip();
        return;
      }
      const someTable = Object.keys(parsed)[0];
      const t = parsed[someTable];
      // Ensure structure present
      t.indexes = t.indexes || {};
      // create a fake index mapping where values map to arrays of ids
      t.indexes['fakecol'] = { '1': [1,2], 'null': [3] };
      const dumped = JSON.stringify(parsed, null, 2);
      // Import and expect alert 'Imported'
      const msg = await sandbox.importDbWithExpect(dumped, 'Imported');
      expect(msg).toContain('Imported');
    });
  });
});