import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d96c31-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object to encapsulate common selectors and actions
class SQLDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      sqlInput: '#sqlInput',
      runBtn: '#runBtn',
      resetBtn: '#resetBtn',
      loadSamplesBtn: '#loadSamplesBtn',
      insertExampleBtn: '#insertExampleBtn',
      clearBtn: '#clearBtn',
      showTablesBtn: '#showTablesBtn',
      exportBtn: '#exportBtn',
      examplesSelect: '#examplesSelect',
      output: '#output',
      status: '#status',
      tablesMeta: '#tablesMeta',
      examplesList: '#examplesList'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  async getStatusText() {
    return (await this.page.locator(this.selectors.status).innerText()).trim();
  }

  async getOutputHtml() {
    return await this.page.locator(this.selectors.output).innerHTML();
  }

  async getOutputText() {
    return (await this.page.locator(this.selectors.output).innerText()).trim();
  }

  async getSqlValue() {
    return await this.page.locator(this.selectors.sqlInput).inputValue();
  }

  async setSqlValue(s) {
    await this.page.fill(this.selectors.sqlInput, s);
  }

  async clickRun() {
    await this.page.click(this.selectors.runBtn);
  }

  async clickReset() {
    await this.page.click(this.selectors.resetBtn);
  }

  async clickLoadSamples() {
    await this.page.click(this.selectors.loadSamplesBtn);
  }

  async clickInsertExample() {
    await this.page.click(this.selectors.insertExampleBtn);
  }

  async clickClear() {
    await this.page.click(this.selectors.clearBtn);
  }

  async clickShowTables() {
    await this.page.click(this.selectors.showTablesBtn);
  }

  async clickExport() {
    await this.page.click(this.selectors.exportBtn);
  }

  async selectExampleByValue(val) {
    await this.page.selectOption(this.selectors.examplesSelect, val);
  }

  async getExamplesOptions() {
    return this.page.locator(`${this.selectors.examplesSelect} option`);
  }

  async getTablesMetaText() {
    return (await this.page.locator(this.selectors.tablesMeta).innerText()).trim();
  }

  async findOutputButtonByText(text) {
    return this.page.locator(`${this.selectors.output} button`, { hasText: text });
  }
}

test.describe('SQL Concepts — Interactive Demo (FSM validation)', () => {
  // Collect console error messages and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture page error events (unhandled exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages of type error
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
  });

  test('Initial Idle state renders page and shows Ready status', async ({ page }) => {
    // Validate entry action renderPage() via initial DOM content and status text.
    const app = new SQLDemoPage(page);
    await app.goto();

    // The page should set a helpful ready status message on load.
    const statusText = await app.getStatusText();
    expect(statusText).toContain('Ready — select an example and press "Run SQL" (or Ctrl+Enter).');

    // The output should include the preloaded message hint.
    const outputHtml = await app.getOutputHtml();
    expect(outputHtml).toContain('Try the preloaded example or choose one from the list.');

    // The editor is seeded with the JOIN example (EXAMPLES[3] in the HTML). Assert portion of that SQL.
    const sqlVal = await app.getSqlValue();
    expect(sqlVal).toContain('FROM orders o');
    expect(sqlVal.length).toBeGreaterThan(10);

    // Examples dropdown and list should be populated with items (beyond the default option)
    const options = await app.getExamplesOptions();
    const count = await options.count();
    // There should be at least the empty option + examples (we know 10 examples).
    expect(count).toBeGreaterThanOrEqual(11);

    // No uncaught page errors or console errors on initial load.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Run SQL executes editor SQL and updates output and status (S0 -> S1)', async ({ page }) => {
    // This validates the RunSQL_Click event and runSQL() behavior.
    const app = new SQLDemoPage(page);
    await app.goto();

    // Click Run SQL to execute the preloaded JOIN example.
    await app.clickRun();

    // After running, output should include the result table headers (aliases used in example).
    const outHTML = await app.getOutputHtml();
    expect(outHTML).toContain('order_id');
    expect(outHTML).toContain('customer');
    expect(outHTML).toContain('product');

    // Status should indicate executed statements.
    const status = await app.getStatusText();
    expect(status).toMatch(/Executed \d+ statement/);

    // No uncaught errors occurred during execution (errors are handled in-app and surfaced to output, not as page errors).
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Reset DB button resets database and updates output & status (S0 -> S2)', async ({ page }) => {
    // This validates ResetDB_Click transition and resetDatabase() entry action.
    const app = new SQLDemoPage(page);
    await app.goto();

    // Change editor to make sure reset does not depend on editor content.
    await app.setSqlValue('SELECT 1;');

    // Click Reset DB, which also updates output and status per implementation.
    await app.clickReset();

    // Output should show the explicit message from the handler.
    const outputText = await app.getOutputText();
    expect(outputText).toContain('Database reset to initial sample state.');

    // Status should be updated to 'Database reset.'
    const status = await app.getStatusText();
    expect(status).toBe('Database reset.');

    // Tables meta should include the known sample tables.
    const tablesMeta = await app.getTablesMetaText();
    // The resetDatabase populates users, products, orders; assert presence.
    expect(tablesMeta).toMatch(/users/);
    expect(tablesMeta).toMatch(/products/);
    expect(tablesMeta).toMatch(/orders/);

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Load Sample Data displays message and retains DB (S0 -> S3)', async ({ page }) => {
    // This validates LoadSamples_Click and that output shows sample data loaded.
    const app = new SQLDemoPage(page);
    await app.goto();

    await app.clickLoadSamples();

    // Output should contain sample data loaded message.
    const outputText = await app.getOutputText();
    expect(outputText).toContain('Sample data loaded.');

    // The status should indicate the sample DB was loaded (resetDatabase sets this).
    const status = await app.getStatusText();
    expect(status).toContain('Sample database loaded.');

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Insert Example inserts selected example SQL into editor (S0 -> S5)', async ({ page }) => {
    // Validate InsertExample_Click event and insertExample() behavior.
    const app = new SQLDemoPage(page);
    await app.goto();

    // Choose the first real example (value '0' was assigned to EXAMPLES[0] in page script).
    await app.selectExampleByValue('0');

    // Click insert button to push example SQL into editor.
    await app.clickInsertExample();

    // Editor should now contain the SQL from the first example which is known in the HTML.
    const sqlVal = await app.getSqlValue();
    // The first example in the HTML is: "SELECT id, name, city FROM users;"
    expect(sqlVal.trim()).toBe("SELECT id, name, city FROM users;");

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Clear Editor clears text and updates output/status (S0 -> S4)', async ({ page }) => {
    // Validate Clear_Click and clearEditor() entry action
    const app = new SQLDemoPage(page);
    await app.goto();

    // Ensure editor has content
    await app.setSqlValue('SELECT * FROM users;');

    // Click Clear
    await app.clickClear();

    // Editor should be empty
    const sqlVal = await app.getSqlValue();
    expect(sqlVal).toBe('');

    // Output should show editor cleared message
    const outputText = await app.getOutputText();
    expect(outputText).toContain('Editor cleared.');

    // Status should be cleared (empty string)
    const status = await app.getStatusText();
    expect(status).toBe('');

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Show Tables lists tables and showTable displays table rows (S0 -> S6)', async ({ page }) => {
    // Validate ShowTables_Click and showTable() usage
    const app = new SQLDemoPage(page);
    await app.goto();

    // Click Show Tables which should render buttons for each table
    await app.clickShowTables();

    // Output should now include buttons for users, products, orders
    const outputHtml = await app.getOutputHtml();
    expect(outputHtml).toContain('Tables');
    expect(outputHtml).toContain('users');
    expect(outputHtml).toContain('products');
    expect(outputHtml).toContain('orders');

    // Click the users button rendered inside output. Use locator by text.
    const usersBtn = await app.findOutputButtonByText('users');
    await expect(usersBtn).toHaveCount(1);
    await usersBtn.click();

    // After clicking, output should show the users table header (users (N rows))
    const outText = await app.getOutputText();
    expect(outText).toMatch(/users \(\d+ rows\)/i);

    // The displayed table should include known user names like Alice and Bob
    expect(outText).toContain('Alice');
    expect(outText).toContain('Bob');

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Export DB triggers JSON export and updates status (S0 -> S7)', async ({ page }) => {
    // Validate ExportDB_Click action. The implementation creates a blob and programmatically clicks an anchor,
    // and sets status text to 'Exported DB as JSON.' We assert the status update.
    const app = new SQLDemoPage(page);
    await app.goto();

    // Click export button. This should not throw but should set status.
    await app.clickExport();

    // Status should indicate export succeeded.
    const status = await app.getStatusText();
    expect(status).toBe('Exported DB as JSON.');

    // No uncaught page errors as download is simulated via programmatic click.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Running with empty editor shows "No SQL to run." (edge case)', async ({ page }) => {
    // Edge case: run with empty SQL should show friendly message rather than throwing.
    const app = new SQLDemoPage(page);
    await app.goto();

    // Ensure editor is empty
    await app.clickClear();

    // Click Run
    await app.clickRun();

    // Output should show the specific message for no SQL
    const outputHtml = await app.getOutputHtml();
    expect(outputHtml).toContain('No SQL to run.');

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Running invalid SQL surfaces an error message in output (error scenario)', async ({ page }) => {
    // This tests the application's error handling when SQL execution fails (invalid table).
    const app = new SQLDemoPage(page);
    await app.goto();

    // Put an invalid SQL that references a nonexistent table
    await app.setSqlValue("SELECT * FROM definitely_not_a_table;");

    // Run the SQL
    await app.clickRun();

    // The UI should render an error block inside output and set status to 'Execution failed.'
    const outHtml = await app.getOutputHtml();
    expect(outHtml).toContain('<strong>Error:</strong>');
    const status = await app.getStatusText();
    expect(status).toBe('Execution failed.');

    // This error is handled by the app; there should be no uncaught page errors.
    expect(pageErrors.length).toBe(0);

    // Console errors might not be produced since the error is caught and displayed; assert none.
    expect(consoleErrors.length).toBe(0);
  });

  test.afterEach(async ({}, testInfo) => {
    // If any uncaught page errors were recorded during the test, provide a helpful assertion failure message.
    if (pageErrors && pageErrors.length > 0) {
      // Fail the test explicitly showing the first page error
      const first = pageErrors[0];
      // Using testInfo to attach info is not strictly necessary; we assert to fail clearly.
      throw new Error(`Uncaught page error detected during test "${testInfo.title}": ${first.message || String(first)}`);
    }
    if (consoleErrors && consoleErrors.length > 0) {
      // Fail if console errors were logged (unexpected)
      const sample = consoleErrors[0];
      throw new Error(`Console.error output detected during test "${testInfo.title}": ${sample.text}`);
    }
  });
});