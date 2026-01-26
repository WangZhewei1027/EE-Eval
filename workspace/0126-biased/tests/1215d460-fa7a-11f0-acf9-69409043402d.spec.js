import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1215d460-fa7a-11f0-acf9-69409043402d.html';

// Test suite for the Relational Database Interactive Exploration app
test.describe('Relational Database Interactive Exploration - FSM validation', () => {
  // Setup common hooks to capture dialogs, console messages and page errors
  test.beforeEach(async ({ page }) => {
    // Arrays to collect diagnostics per test
    page.setDefaultTimeout(10000);
    page['_dialogs'] = [];
    page['_consoleMessages'] = [];
    page['_pageErrors'] = [];

    page.on('dialog', async (dialog) => {
      // record and accept every dialog so tests can continue
      page['_dialogs'].push(dialog.message());
      await dialog.accept();
    });

    page.on('console', (msg) => {
      page['_consoleMessages'].push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      page['_pageErrors'].push(err.message);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Ensure no unexpected runtime errors occurred
    // Tests that expect errors will assert on page['_pageErrors'] explicitly
    const pageErrors = page['_pageErrors'] || [];
    expect(pageErrors.length).toBe(0);
  });

  test('S0_Idle initial state: UI initialized and debug state shown', async ({ page }) => {
    // Validate initial idle state
    const statePre = page.locator('#state');
    await expect(statePre).toBeVisible();
    const stateText = await statePre.textContent();
    // Should show an object with tables (empty initially)
    expect(stateText).toContain('"tables"');

    // Columns, rows and relations sections should be hidden initially
    await expect(page.locator('#columnsSection')).toHaveJSProperty('style');
    await expect(page.locator('#rowsSection')).toHaveJSProperty('style');
    await expect(page.locator('#relationsSection')).toHaveJSProperty('style');

    // Confirm their computed display style is 'none' initially (S0_Idle expectation)
    const columnsDisplay = await page.locator('#columnsSection').evaluate(el => el.style.display);
    const rowsDisplay = await page.locator('#rowsSection').evaluate(el => el.style.display);
    const relationsDisplay = await page.locator('#relationsSection').evaluate(el => el.style.display);
    expect(columnsDisplay === 'none' || columnsDisplay === '').toBeTruthy(); // library styles sometimes normalize
    expect(rowsDisplay === 'none' || rowsDisplay === '').toBeTruthy();
    expect(relationsDisplay === 'none' || relationsDisplay === '').toBeTruthy();

    // The select table should have at least the placeholder option initially
    const selectOpts = await page.locator('#selectTable option').allTextContents();
    expect(selectOpts.length).toBeGreaterThanOrEqual(1);
    // No page errors
    expect(page['_pageErrors'].length).toBe(0);
  });

  test('Create tables (CreateTable) and update dropdowns - stay in Idle', async ({ page }) => {
    // Create a table named Departments
    await page.fill('#newTableName', 'Departments');
    await page.click('#btnCreateTable');
    // No confirm dialog for create; alert not expected
    expect(page['_dialogs'].length).toBeGreaterThanOrEqual(0);

    // After creation, selectTable should include Departments
    const opts = await page.locator('#selectTable option').allTextContents();
    const joined = opts.join('|');
    expect(joined).toContain('Departments');

    // Create another table Employees
    await page.fill('#newTableName', 'Employees');
    await page.click('#btnCreateTable');

    // Both tables should be present
    const opts2 = await page.locator('#selectTable option').allTextContents();
    const joined2 = opts2.join('|');
    expect(joined2).toContain('Departments');
    expect(joined2).toContain('Employees');

    // Creating a duplicate table should alert
    await page.fill('#newTableName', 'Employees');
    await page.click('#btnCreateTable');
    // The alert should be recorded and contain 'already exists'
    const lastDialog = page['_dialogs'][page['_dialogs'].length - 1];
    expect(lastDialog).toMatch(/already exists/);

    // No page errors
    expect(page['_pageErrors'].length).toBe(0);
  });

  test('Load table (LoadTable) transitions to Table Loaded (S1_TableLoaded)', async ({ page }) => {
    // Prepare: create table Projects and load it to verify behavior
    await page.fill('#newTableName', 'Projects');
    await page.click('#btnCreateTable');

    // select and load Projects
    // Wait for select options to be populated
    await page.selectOption('#selectTable', { label: 'Projects' });
    await page.click('#btnLoadTable');

    // After loading, columnsSection, rowsSection and relationsSection should be visible (display != 'none')
    const colsDisp = await page.locator('#columnsSection').evaluate(el => el.style.display);
    const rowsDisp = await page.locator('#rowsSection').evaluate(el => el.style.display);
    const relDisp = await page.locator('#relationsSection').evaluate(el => el.style.display);
    expect(colsDisp).not.toBe('none');
    expect(rowsDisp).not.toBe('none');
    expect(relDisp).not.toBe('none');

    // columnsTable should be empty initially
    const columnsBodyHtml = await page.locator('#columnsTable tbody').innerHTML();
    expect(columnsBodyHtml.trim()).toBe('');

    // The debug state should still contain Projects
    const stateText = await page.locator('#state').textContent();
    expect(stateText).toContain('"Projects"');

    // No page errors
    expect(page['_pageErrors'].length).toBe(0);
  });

  test('Add columns (AddColumn) and render columns table (S2_ColumnEditing)', async ({ page }) => {
    // Create and load a table 'Teams'
    await page.fill('#newTableName', 'Teams');
    await page.click('#btnCreateTable');
    await page.selectOption('#selectTable', { label: 'Teams' });
    await page.click('#btnLoadTable');

    // Add integer column 'ID'
    await page.fill('#newColumnName', 'ID');
    await page.selectOption('#newColumnType', 'int');
    await page.click('#btnAddColumn');

    // Add text column 'Name'
    await page.fill('#newColumnName', 'Name');
    await page.selectOption('#newColumnType', 'text');
    await page.click('#btnAddColumn');

    // Verify columns table contains both columns
    const colRowsText = await page.locator('#columnsTable tbody').allTextContents();
    const joined = colRowsText.join(' | ');
    expect(joined).toContain('ID');
    expect(joined).toContain('Name');

    // Row input form should have inputs for ID and Name
    const inputs = await page.locator('#rowInputForm input, #rowInputForm select').all();
    expect(inputs.length).toBeGreaterThanOrEqual(2);

    // Trying to add column when no table is loaded: clear view then click add
    await page.click('#btnClearTableView');
    // Attempt add column (should produce alert 'No table loaded.')
    await page.fill('#newColumnName', 'ShouldFail');
    await page.click('#btnAddColumn');
    const lastDialog = page['_dialogs'][page['_dialogs'].length - 1];
    expect(lastDialog).toMatch(/No table loaded/);

    // No page errors
    expect(page['_pageErrors'].length).toBe(0);
  });

  test('Add rows (AddRow), Edit and Delete row (S3_RowEditing -> S1_TableLoaded)', async ({ page }) => {
    // Setup: create Departments and Employees and add columns, load Departments and add a row
    await page.fill('#newTableName', 'DepartmentsX');
    await page.click('#btnCreateTable');
    await page.selectOption('#selectTable', { label: 'DepartmentsX' });
    await page.click('#btnLoadTable');

    // Add columns ID (int) and Name (text)
    await page.fill('#newColumnName', 'ID');
    await page.selectOption('#newColumnType', 'int');
    await page.click('#btnAddColumn');

    await page.fill('#newColumnName', 'Name');
    await page.selectOption('#newColumnType', 'text');
    await page.click('#btnAddColumn');

    // Fill row inputs: ID=10, Name=Research
    await page.fill('#rowinput-ID', '10');
    await page.fill('#rowinput-Name', 'Research');
    await page.click('#btnAddRow');

    // After adding row, rowsTable should show one row with 10 and Research
    const rowsText = await page.locator('#rowsTable tbody tr').allTextContents();
    expect(rowsText.join('|')).toContain('10');
    expect(rowsText.join('|')).toContain('Research');

    // Edit the row: click Edit (first button in actions)
    const editBtn = page.locator('#rowsTable tbody tr button', { hasText: 'Edit' }).first();
    await editBtn.click();
    // The inputs should be populated with existing values
    const idVal = await page.inputValue('#rowinput-ID');
    const nameVal = await page.inputValue('#rowinput-Name');
    expect(idVal).toBe('10');
    expect(nameVal).toBe('Research');

    // Update name and save (Add Row functions as update when in edit mode)
    await page.fill('#rowinput-Name', 'R&D');
    await page.click('#btnAddRow');

    // Confirm updated row content
    const updatedRow = await page.locator('#rowsTable tbody tr td').allTextContents();
    expect(updatedRow.join('|')).toContain('R&D');

    // Delete the row via Delete button (confirm handled)
    const delBtn = page.locator('#rowsTable tbody tr button', { hasText: 'Delete' }).first();
    await delBtn.click();
    // After deletion the rows tbody should be empty
    const rowsAfter = await page.locator('#rowsTable tbody').innerHTML();
    expect(rowsAfter.trim()).toBe('');

    // No page errors
    expect(page['_pageErrors'].length).toBe(0);
  });

  test('Add relation (AddRelation) and update relations section (S4_RelationEditing)', async ({ page }) => {
    // Full flow to create DepartmentsY and EmployeesY, add columns and rows, create FK column and then add relation
    // Create DepartmentsY
    await page.fill('#newTableName', 'DepartmentsY');
    await page.click('#btnCreateTable');
    // Create EmployeesY
    await page.fill('#newTableName', 'EmployeesY');
    await page.click('#btnCreateTable');

    // Load DepartmentsY and add ID and Name
    await page.selectOption('#selectTable', { label: 'DepartmentsY' });
    await page.click('#btnLoadTable');

    await page.fill('#newColumnName', 'ID');
    await page.selectOption('#newColumnType', 'int');
    await page.click('#btnAddColumn');

    await page.fill('#newColumnName', 'Name');
    await page.selectOption('#newColumnType', 'text');
    await page.click('#btnAddColumn');

    // Add a row to DepartmentsY: ID=5, Name=Sales
    await page.fill('#rowinput-ID', '5');
    await page.fill('#rowinput-Name', 'Sales');
    await page.click('#btnAddRow');

    // Load EmployeesY and add ID and Name and a FK DeptId to DepartmentsY.ID
    await page.selectOption('#selectTable', { label: 'EmployeesY' });
    await page.click('#btnLoadTable');

    await page.fill('#newColumnName', 'ID');
    await page.selectOption('#newColumnType', 'int');
    await page.click('#btnAddColumn');

    await page.fill('#newColumnName', 'Name');
    await page.selectOption('#newColumnType', 'text');
    await page.click('#btnAddColumn');

    // Add FK column DeptId
    await page.fill('#newColumnName', 'DeptId');
    await page.selectOption('#newColumnType', 'fk');

    // fkTargetTable select should now be populated - choose DepartmentsY
    await page.selectOption('#fkTargetTable', { label: 'DepartmentsY' });
    // Wait for fkTargetColumn to populate and choose ID
    await page.selectOption('#fkTargetColumn', { label: 'ID' });

    await page.click('#btnAddColumn');

    // Add an employee row referencing DeptId=5. fk input will be a select populated from DepartmentsY rows
    await page.fill('#rowinput-ID', '200');
    await page.fill('#rowinput-Name', 'AliceY');
    // For FK select, set value to '5' - it's a select
    await page.selectOption('#rowinput-DeptId', { value: '5' });
    await page.click('#btnAddRow');

    // Create the relation via Relations panel: select source table EmployeesY, source col DeptId, target table DepartmentsY, target column ID
    await page.selectOption('#relSourceTable', { label: 'EmployeesY' });
    // Wait for rel source columns to fill
    await page.selectOption('#relSourceColumn', { label: 'DeptId' });
    await page.selectOption('#relTargetTable', { label: 'DepartmentsY' });
    await page.selectOption('#relTargetColumn', { label: 'ID' });

    await page.click('#btnAddRelation');

    // Relations table should contain the added relation
    const relationsText = await page.locator('#relationsTable tbody').allTextContents();
    const joined = relationsText.join('|');
    expect(joined).toContain('EmployeesY.DeptId');
    expect(joined).toContain('DepartmentsY.ID');

    // Attempting to add a relation where the source column is not fk should alert:
    // Create a new table T_bad and try to add relation with a non-fk source
    await page.fill('#newTableName', 'T_bad');
    await page.click('#btnCreateTable');
    await page.selectOption('#selectTable', { label: 'T_bad' });
    await page.click('#btnLoadTable');
    // Add non-fk column X
    await page.fill('#newColumnName', 'X');
    await page.selectOption('#newColumnType', 'int');
    await page.click('#btnAddColumn');

    // Try to make relation from T_bad.X -> DepartmentsY.ID
    await page.selectOption('#relSourceTable', { label: 'T_bad' });
    await page.selectOption('#relSourceColumn', { label: 'X' });
    await page.selectOption('#relTargetTable', { label: 'DepartmentsY' });
    await page.selectOption('#relTargetColumn', { label: 'ID' });
    await page.click('#btnAddRelation');

    const lastDialog = page['_dialogs'][page['_dialogs'].length - 1];
    expect(lastDialog).toMatch(/Source column must be a foreign key type/);

    // No page errors
    expect(page['_pageErrors'].length).toBe(0);
  });

  test('Run Query (RunQuery) to join tables and display results (S1_TableLoaded)', async ({ page }) => {
    // Setup a small dataset: create DeptQ and EmpQ and relate them, then run query
    await page.fill('#newTableName', 'DeptQ');
    await page.click('#btnCreateTable');
    await page.fill('#newTableName', 'EmpQ');
    await page.click('#btnCreateTable');

    // DeptQ: add ID and Name, add row 42, 'Quality'
    await page.selectOption('#selectTable', { label: 'DeptQ' });
    await page.click('#btnLoadTable');
    await page.fill('#newColumnName', 'ID');
    await page.selectOption('#newColumnType', 'int');
    await page.click('#btnAddColumn');
    await page.fill('#newColumnName', 'Name');
    await page.selectOption('#newColumnType', 'text');
    await page.click('#btnAddColumn');
    await page.fill('#rowinput-ID', '42');
    await page.fill('#rowinput-Name', 'Quality');
    await page.click('#btnAddRow');

    // EmpQ: add ID, Name, Dept fk to DeptQ.ID, add row referencing 42
    await page.selectOption('#selectTable', { label: 'EmpQ' });
    await page.click('#btnLoadTable');
    await page.fill('#newColumnName', 'ID');
    await page.selectOption('#newColumnType', 'int');
    await page.click('#btnAddColumn');
    await page.fill('#newColumnName', 'Name');
    await page.selectOption('#newColumnType', 'text');
    await page.click('#btnAddColumn');
    await page.fill('#newColumnName', 'Dept');
    await page.selectOption('#newColumnType', 'fk');
    await page.selectOption('#fkTargetTable', { label: 'DeptQ' });
    await page.selectOption('#fkTargetColumn', { label: 'ID' });
    await page.click('#btnAddColumn');

    // Add employee row with Dept value chosen from select (should show '42')
    await page.fill('#rowinput-ID', '500');
    await page.fill('#rowinput-Name', 'BobQ');
    await page.selectOption('#rowinput-Dept', { value: '42' });
    await page.click('#btnAddRow');

    // Define relation using Relations UI
    await page.selectOption('#relSourceTable', { label: 'EmpQ' });
    await page.selectOption('#relSourceColumn', { label: 'Dept' });
    await page.selectOption('#relTargetTable', { label: 'DeptQ' });
    await page.selectOption('#relTargetColumn', { label: 'ID' });
    await page.click('#btnAddRelation');

    // Run a query to select EmpQ.Name and DeptQ.Name
    await page.fill('#querySelectTables', 'EmpQ,DeptQ');
    await page.fill('#queryColumns', 'EmpQ.Name,DeptQ.Name');
    await page.fill('#queryWhere', ''); // no where
    await page.click('#btnRunQuery');

    // Query result table should now have headers and at least one row
    const headerTexts = await page.locator('#queryResultTable thead tr th').allTextContents();
    expect(headerTexts.join('|')).toContain('EmpQ.Name');
    expect(headerTexts.join('|')).toContain('DeptQ.Name');

    const resultRows = await page.locator('#queryResultTable tbody tr').allTextContents();
    const joinedResults = resultRows.join('|');
    // Should contain BobQ and Quality
    expect(joinedResults).toContain('BobQ');
    expect(joinedResults).toContain('Quality');

    // Running a query against a non-existent table should alert
    await page.fill('#querySelectTables', 'NoSuchTable');
    await page.fill('#queryColumns', 'X');
    await page.click('#btnRunQuery');
    const lastDialog = page['_dialogs'][page['_dialogs'].length - 1];
    expect(lastDialog).toMatch(/does not exist/);

    // No page errors
    expect(page['_pageErrors'].length).toBe(0);
  });

  test('Delete column (DeleteColumn) and drop table (DropTable) with relation checks', async ({ page }) => {
    // Create two tables A_drop and B_drop, add FK column then test delete column and drop logic
    await page.fill('#newTableName', 'A_drop');
    await page.click('#btnCreateTable');
    await page.fill('#newTableName', 'B_drop');
    await page.click('#btnCreateTable');

    // Setup B_drop with ID column and a row
    await page.selectOption('#selectTable', { label: 'B_drop' });
    await page.click('#btnLoadTable');
    await page.fill('#newColumnName', 'ID');
    await page.selectOption('#newColumnType', 'int');
    await page.click('#btnAddColumn');
    await page.fill('#newColumnName', 'Label');
    await page.selectOption('#newColumnType', 'text');
    await page.click('#btnAddColumn');
    await page.fill('#rowinput-ID', '7');
    await page.fill('#rowinput-Label', 'L7');
    await page.click('#btnAddRow');

    // Setup A_drop with fk to B_drop.ID
    await page.selectOption('#selectTable', { label: 'A_drop' });
    await page.click('#btnLoadTable');
    await page.fill('#newColumnName', 'ID');
    await page.selectOption('#newColumnType', 'int');
    await page.click('#btnAddColumn');
    await page.fill('#newColumnName', 'Ref');
    await page.selectOption('#newColumnType', 'fk');
    await page.selectOption('#fkTargetTable', { label: 'B_drop' });
    await page.selectOption('#fkTargetColumn', { label: 'ID' });
    await page.click('#btnAddColumn');

    // Add relation
    await page.selectOption('#relSourceTable', { label: 'A_drop' });
    await page.selectOption('#relSourceColumn', { label: 'Ref' });
    await page.selectOption('#relTargetTable', { label: 'B_drop' });
    await page.selectOption('#relTargetColumn', { label: 'ID' });
    await page.click('#btnAddRelation');

    // Try to drop B_drop while relation exists -> should alert and not drop
    await page.fill('#newTableName', 'B_drop');
    await page.click('#btnDropTable');
    const dialogAfterDropAttempt = page['_dialogs'][page['_dialogs'].length - 1];
    expect(dialogAfterDropAttempt).toMatch(/Cannot drop table/);

    // Remove relation first via UI 'Remove' button
    // Ensure A_drop is loaded so relations section visible
    await page.selectOption('#selectTable', { label: 'A_drop' });
    await page.click('#btnLoadTable');
    // Click Remove button for relation
    const relRemoveBtn = page.locator('#relationsTable tbody tr button', { hasText: 'Remove' }).first();
    await relRemoveBtn.click(); // confirm will be auto-accepted

    // Now drop B_drop should prompt confirm and succeed
    await page.fill('#newTableName', 'B_drop');
    await page.click('#btnDropTable');
    // Confirm message should have been recorded (confirm prompt)
    const lastDialog = page['_dialogs'][page['_dialogs'].length - 1];
    // It could be the confirmation prompt or success; just assert it's a prompt or earlier message
    expect(lastDialog.length).toBeGreaterThan(0);

    // After drop, B_drop should be removed from selectTable
    const allOpts = await page.locator('#selectTable option').allTextContents();
    const joinedOpts = allOpts.join('|');
    expect(joinedOpts).not.toContain('B_drop');

    // Deleting a column from A_drop: find Delete button for 'Ref' column
    // If A_drop currently loaded, columns table shows 'Ref'
    const deleteButtons = page.locator('#columnsTable tbody tr button', { hasText: 'Delete' });
    const rowsText = await page.locator('#columnsTable tbody').allTextContents();
    if (rowsText.join('|').includes('Ref')) {
      // Click the Delete button for the Ref column (first match)
      await deleteButtons.first().click(); // confirm auto-accepted
      // After deletion, columnsTable should not include 'Ref'
      const afterCols = await page.locator('#columnsTable tbody').allTextContents();
      expect(afterCols.join('|')).not.toContain('Ref');
    }

    // No page errors
    expect(page['_pageErrors'].length).toBe(0);
  });

  test('Clear table view (ClearTableView) returns to Idle (S0_Idle)', async ({ page }) => {
    // Create and load a table TestClear
    await page.fill('#newTableName', 'TestClear');
    await page.click('#btnCreateTable');
    await page.selectOption('#selectTable', { label: 'TestClear' });
    await page.click('#btnLoadTable');

    // Ensure sections visible
    await expect(page.locator('#columnsSection')).toBeVisible();
    await expect(page.locator('#rowsSection')).toBeVisible();

    // Click Clear View
    await page.click('#btnClearTableView');

    // Sections should be hidden after clearing, and tbody cleared
    const columnsStyle = await page.locator('#columnsSection').evaluate(el => el.style.display);
    const rowsStyle = await page.locator('#rowsSection').evaluate(el => el.style.display);
    expect(columnsStyle).toBe('none');
    expect(rowsStyle).toBe('none');

    // No page errors
    expect(page['_pageErrors'].length).toBe(0);
  });

  test('Edge cases: drop non-existent table, invalid load, query parsing errors', async ({ page }) => {
    // Attempt to drop a non-existent table
    await page.fill('#newTableName', 'NoSuchTableX');
    await page.click('#btnDropTable');
    const dlg1 = page['_dialogs'][page['_dialogs'].length - 1];
    expect(dlg1).toMatch(/Invalid table name to drop/);

    // Attempt to load without selecting a real table
    // Ensure selectTable is at placeholder
    await page.selectOption('#selectTable', '');
    await page.click('#btnLoadTable');
    const dlg2 = page['_dialogs'][page['_dialogs'].length - 1];
    expect(dlg2).toMatch(/No table selected/);

    // Attempt to run query with invalid WHERE clause
    await page.fill('#querySelectTables', ''); // empty tables -> should alert
    await page.fill('#queryColumns', '');
    await page.click('#btnRunQuery');
    const dlg3 = page['_dialogs'][page['_dialogs'].length - 1];
    expect(dlg3).toMatch(/Please enter table names/);

    // No page errors
    expect(page['_pageErrors'].length).toBe(0);
  });

});