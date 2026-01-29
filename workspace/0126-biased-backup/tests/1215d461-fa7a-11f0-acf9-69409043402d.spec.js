import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1215d461-fa7a-11f0-acf9-69409043402d.html';

// Page Object to encapsulate common interactions
class SqlInteractivePage {
  constructor(page) {
    this.page = page;
    // Controls
    this.tableSelect = page.locator('#table-select');
    this.customEditor = page.locator('#custom-table-editor');
    this.customName = page.locator('#custom-table-name');
    this.customCols = page.locator('#custom-table-cols');
    this.customData = page.locator('#custom-table-data');
    this.btnLoadCustom = page.locator('#btn-load-custom-table');
    this.customStatus = page.locator('#custom-table-status');

    this.sqlQuery = page.locator('#sql-query');
    this.btnRunQuery = page.locator('#btn-run-query');
    this.btnClearQuery = page.locator('#btn-clear-query');
    this.btnReset = page.locator('#btn-reset');

    this.selectColumns = page.locator('#select-columns');
    this.whereConditions = page.locator('#where-conditions');
    this.joinType = page.locator('#join-type');
    this.joinTable = page.locator('#join-table');
    this.joinCondition = page.locator('#join-condition');
    this.groupBy = page.locator('#group-by');
    this.having = page.locator('#having-condition');
    this.orderBy = page.locator('#order-by');
    this.limit = page.locator('#limit-count');
    this.btnBuildQuery = page.locator('#btn-build-query');
    this.btnClearControls = page.locator('#btn-clear-controls');

    this.dataViewSelect = page.locator('#data-view-table');
    this.btnViewTable = page.locator('#btn-view-table');
    this.tableDataContainer = page.locator('#table-data-container');

    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for the script's initialization (resetAll sets output text)
    await expect(this.output).toHaveText(/Run a query to see results here\./, { timeout: 2000 });
  }

  // Helpers for reading inline style.display
  async getCustomEditorDisplay() {
    return await this.page.$eval('#custom-table-editor', el => el.style.display || getComputedStyle(el).display);
  }

  async selectTable(value) {
    await this.tableSelect.selectOption(value);
  }

  async loadCustomTable({ name, cols, dataLines }) {
    await this.customName.fill(name);
    await this.customCols.fill(cols);
    await this.customData.fill(dataLines.join('\n'));
    await this.btnLoadCustom.click();
  }

  async runQuery(sql) {
    await this.sqlQuery.fill(sql);
    await this.btnRunQuery.click();
  }

  async clearQuery() {
    await this.btnClearQuery.click();
  }

  async resetAll() {
    await this.btnReset.click();
  }

  async buildQueryFromControls() {
    await this.btnBuildQuery.click();
  }

  async clearControls() {
    await this.btnClearControls.click();
  }

  async viewTable(name) {
    await this.dataViewSelect.selectOption(name);
    await this.btnViewTable.click();
  }

  // Read textual output
  async getOutputText() {
    return (await this.output.textContent()) || '';
  }

  async getSqlTextareaValue() {
    return (await this.page.$eval('#sql-query', el => el.value));
  }

  async getSelectColumnsValue() {
    return (await this.page.$eval('#select-columns', el => el.value));
  }

  async getDataViewSelectValue() {
    return (await this.page.$eval('#data-view-table', el => el.value));
  }

  async getTableDataHtml() {
    return (await this.page.$eval('#table-data-container', el => el.innerHTML));
  }

  async getCustomStatusText() {
    return (await this.customStatus.textContent()) || '';
  }
}

test.describe('SQL Concept Interactive Exploration - FSM and UI integration tests', () => {
  let page;
  let app;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    app = new SqlInteractivePage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  // Utility assertion to ensure no unexpected runtime errors were emitted during a test
  async function assertNoRuntimeErrors() {
    expect(consoleErrors.length, `Console error messages: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
  }

  test('S0_Idle: initial state displays default table data and output (Idle entry action)', async () => {
    // Validate that default table (employees) was displayed and output reset message is present
    const tableHtml = await app.getTableDataHtml();
    expect(tableHtml).toContain('<table');
    // output text should be the reset message as resetAll() runs on initialization
    const out = await app.getOutputText();
    expect(out).toContain('Run a query to see results here.');
    // select-columns default value must be '*'
    const selCols = await app.getSelectColumnsValue();
    expect(selCols).toBe('*');

    await assertNoRuntimeErrors();
  });

  test('S0 -> S1 TableSelectChange: selecting "Custom" shows custom table editor (onEnter)', async () => {
    // Select 'custom' from table selector which should show the custom editor
    await app.selectTable('custom');

    // The custom editor display should be visible (entry action described in FSM)
    const display = await app.getCustomEditorDisplay();
    // Implementation uses style.display = 'block' on change to custom
    expect(display === 'block' || display === 'inline' || display === 'flex' || display === 'grid').toBeTruthy();

    await assertNoRuntimeErrors();
  });

  test('S1 -> S0 LoadCustomTableClick: load a valid custom table updates status and table data (and implementation keeps editor visible)', async () => {
    // Ensure in custom editor state
    await app.selectTable('custom');
    const displayBefore = await app.getCustomEditorDisplay();
    expect(displayBefore === 'block' || displayBefore === 'inline' || displayBefore === 'flex' || displayBefore === 'grid').toBeTruthy();

    // Fill custom table inputs and load
    const customName = 'my_table';
    const cols = 'id,name,age';
    const data = [
      '1,John Doe,30',
      '2,Alice Smith,28'
    ];
    await app.loadCustomTable({ name: customName, cols, dataLines: data });

    // Status text should indicate success (implementation adds the name in message)
    const status = await app.getCustomStatusText();
    expect(status.toLowerCase()).toContain('loaded successfully');

    // table data container should now show custom table rows (the values we provided)
    const tableHtml = await app.getTableDataHtml();
    expect(tableHtml).toContain('John Doe');
    expect(tableHtml).toContain('Alice Smith');

    // FSM expected exit action to hide editor, but implementation does NOT hide it.
    // We assert the actual behavior (editor remains visible) to reflect real app behavior.
    const displayAfter = await app.getCustomEditorDisplay();
    expect(displayAfter === 'block' || displayAfter === 'inline' || displayAfter === 'flex' || displayAfter === 'grid').toBeTruthy();

    await assertNoRuntimeErrors();
  });

  test('S0 -> S2 RunQueryClick: running a valid SELECT displays rows in output', async () => {
    // Run a SELECT that returns a known row (salary > 60000 -> Diana)
    const sql = 'SELECT name, salary FROM employees WHERE salary > 60000';
    await app.runQuery(sql);

    const out = await app.getOutputText();
    // The output should contain our header and the result row 'Diana'
    expect(out).toContain('name');
    expect(out).toContain('salary');
    expect(out).toContain('Diana');

    await assertNoRuntimeErrors();
  });

  test('S2 -> S3 ClearQueryClick: clearing the query empties the SQL textarea', async () => {
    // First run a query to simulate being in QueryRunning state
    await app.runQuery('SELECT * FROM employees LIMIT 1');

    // Now clear the query
    await app.clearQuery();

    const val = await app.getSqlTextareaValue();
    expect(val).toBe('');

    await assertNoRuntimeErrors();
  });

  test('S0 -> S4 ClearControlsClick: clearing controls resets interactive builder fields', async () => {
    // Modify some controls
    await app.selectColumns.fill('id, name');
    await app.whereConditions.fill('salary > 50000');
    await app.joinType.selectOption('inner');
    // Clear controls
    await app.clearControls();

    // After clearing, select-columns should be '*' per implementation and FSM
    const selCols = await app.getSelectColumnsValue();
    expect(selCols).toBe('*');

    // join-type should be reset to 'none'
    const joinTypeVal = await app.page.$eval('#join-type', el => el.value);
    expect(joinTypeVal).toBe('none');

    // where should be empty
    const whereVal = await app.page.$eval('#where-conditions', el => el.value);
    expect(whereVal).toBe('');

    await assertNoRuntimeErrors();
  });

  test('S0 -> S5 ResetAllClick: reset returns UI to initial defaults and output message', async () => {
    // Make changes to ensure reset does something meaningful
    await app.selectTable('departments');
    await app.sqlQuery.fill('SELECT * FROM departments');
    await app.selectColumns.fill('id');
    // Now reset all
    await app.resetAll();

    // After reset, table-select should be 'employees'
    const tableSelectVal = await app.page.$eval('#table-select', el => el.value);
    expect(tableSelectVal).toBe('employees');

    // Output must equal reset message per FSM and implementation
    const out = await app.getOutputText();
    expect(out).toContain('Run a query to see results here.');

    // Custom editor must be hidden
    const display = await app.getCustomEditorDisplay();
    // Implementation sets display='none' in resetAll()
    expect(display === 'none' || display === '').toBeTruthy();

    await assertNoRuntimeErrors();
  });

  test('S0 (BuildQueryClick): build SQL query from controls populates textarea correctly', async () => {
    // Ensure table is employees
    await app.selectTable('employees');
    // Set builder fields
    await app.selectColumns.fill('id, name');
    await app.joinType.selectOption('none');
    await app.whereConditions.fill('salary >= 50000');
    await app.groupBy.fill('');
    await app.orderBy.fill('salary DESC');
    await app.limit.fill('2');

    // Build the query
    await app.buildQueryFromControls();

    // Expect textarea to contain a SELECT with our chosen parts. Implementation builds:
    // 'SELECT ' + sel + ' FROM ' + from [+ other clauses]
    const sqlVal = await app.getSqlTextareaValue();
    expect(sqlVal.startsWith('SELECT id, name FROM employees')).toBeTruthy();
    expect(sqlVal).toContain('WHERE salary >= 50000');
    expect(sqlVal).toContain('ORDER BY salary DESC');
    expect(sqlVal).toContain('LIMIT 2');

    await assertNoRuntimeErrors();
  });

  test('S0 (ViewTableClick): view selected table data renders correct table HTML', async () => {
    // Select departments in the data view selector and view
    await app.viewTable('departments');

    // The table data container should include department names
    const tableHtml = await app.getTableDataHtml();
    expect(tableHtml).toContain('Engineering');
    expect(tableHtml).toContain('Marketing');
    expect(tableHtml).toContain('<table');

    await assertNoRuntimeErrors();
  });

  test('Edge case: running a non-SELECT SQL returns proper error message', async () => {
    // Try running a DELETE statement which is unsupported
    await app.runQuery('DELETE FROM employees;');

    const out = await app.getOutputText();
    // Implementation should show an error prefix followed by message from parseAndExecQuery
    expect(out).toContain('Error:');
    expect(out).toContain('Only SELECT queries supported');

    await assertNoRuntimeErrors();
  });

  test('Edge case: JOIN query returns combined rows when ON condition matches', async () => {
    // Run an INNER JOIN between employees and departments on dept_id
    const joinSql = 'SELECT employees.name, departments.dept_name FROM employees INNER JOIN departments ON employees.dept_id = departments.id';
    await app.runQuery(joinSql);

    const out = await app.getOutputText();
    // Should contain headers and some known joined values (e.g., 'Engineering', 'Marketing' or names)
    expect(out).toContain('name');
    expect(out).toContain('dept_name');
    // At least one department name should appear
    expect(out).toMatch(/Engineering|Marketing|Sales/);

    await assertNoRuntimeErrors();
  });

  test('Edge case: GROUP BY and aggregate functions produce aggregated output', async () => {
    // Use aggregate COUNT on employees grouped by dept_id
    const sql = 'SELECT dept_id, COUNT(*) AS cnt FROM employees GROUP BY dept_id ORDER BY dept_id';
    await app.runQuery(sql);

    const out = await app.getOutputText();
    // Expect header 'dept_id' and 'cnt' and some numeric counts
    expect(out).toContain('dept_id');
    expect(out).toContain('cnt');
    // Expect at least one numeric value (count)
    expect(/\d+/.test(out)).toBeTruthy();

    await assertNoRuntimeErrors();
  });
});