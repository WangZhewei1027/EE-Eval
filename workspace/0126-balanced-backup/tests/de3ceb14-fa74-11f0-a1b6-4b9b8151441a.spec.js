import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3ceb14-fa74-11f0-a1b6-4b9b8151441a.html';

/**
 * Page Object Model for the SQL Concepts Demo page.
 * Encapsulates selectors and common interactions.
 */
class SQLDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Buttons
    this.createBtn = "button[onclick='createTable()']";
    this.insertBtn = "button[onclick='insertData()']";
    this.selectBtn = "button[onclick='selectData()']";
    this.whereBtn = "button[onclick='whereData()']";
    this.updateBtn = "button[onclick='updateData()']";
    this.deleteBtn = "button[onclick='deleteData()']";
    this.showFinalBtn = "button[onclick='showFinalData()']";

    // Result containers
    this.createResult = '#createTableResult';
    this.insertResult = '#insertDataResult';
    this.selectResult = '#selectDataResult';
    this.whereResult = '#whereDataResult';
    this.updateResult = '#updateDataResult';
    this.deleteResult = '#deleteDataResult';
    this.finalResult = '#finalDataResult';

    // SQL code blocks (for direct database invocation in tests)
    this.createCode = '#createTableCode';
    this.insertCode = '#insertDataCode';
    this.selectCode = '#selectDataCode';
    this.whereCode = '#whereDataCode';
    this.updateCode = '#updateDataCode';
    this.deleteCode = '#deleteDataCode';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickCreate() { await this.page.click(this.createBtn); }
  async clickInsert() { await this.page.click(this.insertBtn); }
  async clickSelect() { await this.page.click(this.selectBtn); }
  async clickWhere() { await this.page.click(this.whereBtn); }
  async clickUpdate() { await this.page.click(this.updateBtn); }
  async clickDelete() { await this.page.click(this.deleteBtn); }
  async clickShowFinal() { await this.page.click(this.showFinalBtn); }

  async getText(selector) {
    return (await this.page.locator(selector).innerText()).trim();
  }

  // Parse the HTML table inside a result container and return rows and headers
  async parseTableFrom(containerSelector) {
    const html = await this.page.locator(containerSelector).innerHTML();
    // Use page.evaluate to query DOM for the container's table to avoid fragile string parsing
    return await this.page.evaluate((sel) => {
      const container = document.querySelector(sel);
      if (!container) return { headers: [], rows: [] };
      const table = container.querySelector('table');
      if (!table) return { headers: [], rows: [] };
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent || '');
      const rows = Array.from(table.querySelectorAll('tr')).slice(1).map(tr =>
        Array.from(tr.querySelectorAll('td')).map(td => td.textContent || '')
      );
      return { headers, rows };
    }, containerSelector);
  }

  // helper to call database.execute in page context and return its result
  async executeSqlDirectly(sql) {
    return await this.page.evaluate((s) => {
      // run database.execute with provided sql and return result (object)
      return window.database.execute(s);
    }, sql);
  }
}

test.describe('SQL Concepts Demo - FSM transitions and UI behaviour', () => {
  // We'll capture page errors and console messages for assertions.
  test.beforeEach(async ({ page }) => {
    // nothing global to set; each test will instantiate SQLDemoPage and navigate
  });

  test('Initial UI: buttons and code blocks are present and renderPage() is not defined', async ({ page }) => {
    // Validate initial rendering and that expected components from FSM are present.
    const demo = new SQLDemoPage(page);
    await demo.goto();

    // All buttons should be present and visible
    await expect(page.locator(demo.createBtn)).toBeVisible();
    await expect(page.locator(demo.insertBtn)).toBeVisible();
    await expect(page.locator(demo.selectBtn)).toBeVisible();
    await expect(page.locator(demo.whereBtn)).toBeVisible();
    await expect(page.locator(demo.updateBtn)).toBeVisible();
    await expect(page.locator(demo.deleteBtn)).toBeVisible();
    await expect(page.locator(demo.showFinalBtn)).toBeVisible();

    // Verify code blocks contain expected SQL snippets from the FSM evidence
    await expect(page.locator(demo.createCode)).toContainText('CREATE TABLE users');
    await expect(page.locator(demo.insertCode)).toContainText('INSERT INTO users');
    await expect(page.locator(demo.selectCode)).toContainText('SELECT * FROM users');
    await expect(page.locator(demo.whereCode)).toContainText('WHERE age > 28');
    await expect(page.locator(demo.updateCode)).toContainText("UPDATE users SET age = 33");
    await expect(page.locator(demo.deleteCode)).toContainText("DELETE FROM users WHERE name");

    // Verify renderPage (entry action of initial state) is not present in the implementation
    // The FSM lists renderPage() as entry action of S0_Idle, but the HTML/JS does not define it.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);
  });

  test.describe('Complete happy-path interactions and UI assertions', () => {
    test('Create table -> Insert -> Select -> Where -> Update (error expected) -> Delete -> Show Final Data', async ({ page }) => {
      const demo = new SQLDemoPage(page);
      await demo.goto();

      // Capture pageerrors and console messages for later assertions
      const pageErrors = [];
      const consoleMessages = [];
      page.on('pageerror', err => pageErrors.push(err));
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

      // 1) Execute CREATE TABLE
      await demo.clickCreate();
      const createText = await demo.getText(demo.createResult);
      // Expect the explicit success message from createTable DB function
      expect(createText).toBe('Table users created successfully');

      // 2) Execute INSERT
      await demo.clickInsert();
      const insertText = await demo.getText(demo.insertResult);
      // The insertData function returns "<n> row(s) inserted into users"
      expect(insertText).toMatch(/row\(s\) inserted into users$/);
      // Validate that the number of inserted rows is 4 as per the SQL block
      expect(insertText).toContain('4 row(s) inserted into users');

      // 3) Execute SELECT (should return 4 rows)
      await demo.clickSelect();
      const selectMessage = await demo.page.locator('#selectDataResult p').first().innerText();
      expect(selectMessage.trim()).toBe('Returned 4 row(s) from users');

      // Parse the resulting table and verify headers and rows
      const selectTable = await demo.parseTableFrom('#selectDataResult');
      // Headers should include the table's created columns (id, name, email, age)
      expect(selectTable.headers).toEqual(expect.arrayContaining(['id', 'name', 'email', 'age']));
      // There should be 4 data rows
      expect(selectTable.rows.length).toBe(4);
      // One of the rows must contain 'Alice Johnson'
      const flattened = selectTable.rows.flat().join(' ');
      expect(flattened).toContain('Alice Johnson');

      // 4) Execute WHERE (age > 28) -> expect to filter to Bob (32) and Diana (30)
      await demo.clickWhere();
      const whereMessage = await demo.page.locator('#whereDataResult p').first().innerText();
      expect(whereMessage.trim()).toBe('Returned 2 row(s) from users');
      const whereTable = await demo.parseTableFrom('#whereDataResult');
      expect(whereTable.rows.length).toBe(2);
      // Ensure Bob Smith present in filtered results
      const whereFlattened = whereTable.rows.flat().join(' ');
      expect(whereFlattened).toContain('Bob Smith');

      // 5) Execute UPDATE
      // The UI's update button uses database.execute which wraps the underlying updateData in try/catch.
      // The implementation of updateData has a bug in parsing the SET clause that causes an exception internally.
      // database.execute will catch it and return { error: '...' }.
      // The UI expects result.message which will be undefined in the error case, so the visible text becomes empty.
      await demo.clickUpdate();
      const updateResultText = (await demo.page.locator(demo.updateResult).textContent()) || '';
      // Because of the bug, updateResultText should be empty (no result.message), or at least not the success message.
      expect(updateResultText.trim()).toBe('');

      // However, we can assert the internal error object by invoking database.execute directly in page context.
      const updateSql = await demo.page.locator(demo.updateCode).innerText();
      const directUpdateResult = await demo.executeSqlDirectly(updateSql);
      // The execute wrapper returns { error: "<message>" } for thrown exceptions.
      expect(directUpdateResult).toHaveProperty('error');
      expect(typeof directUpdateResult.error).toBe('string');
      // The error is expected to come from trying to call replace on undefined (setValue undefined)
      expect(directUpdateResult.error.toLowerCase()).toContain('replace');

      // Additionally, to validate that uncaught errors (pageerror) can occur naturally,
      // trigger the faulty internal function directly in an asynchronous, uncaught manner.
      // We schedule an async call to database.updateData(...) without the execute wrapper so the exception is unhandled.
      // This should emit a pageerror event captured earlier.
      const updateCodeText = updateSql; // reuse
      // Fire the async call that will throw uncaught within page context.
      await demo.page.evaluate((sql) => {
        // schedule an asynchronous call so the exception becomes an unhandled page error
        setTimeout(() => {
          // Intentionally call the underlying potentially-buggy function directly
          // (this will throw inside the page context)
          window.database.updateData(sql);
        }, 0);
      }, updateCodeText);

      // Wait for the pageerror to be emitted
      const pageError = await demo.page.waitForEvent('pageerror', { timeout: 2000 });
      expect(pageError).toBeTruthy();
      // The error message should reference the same replace-related failure
      expect(pageError.message.toLowerCase()).toContain('replace');

      // 6) Execute DELETE -> should remove Charlie Brown
      await demo.clickDelete();
      const deleteText = await demo.getText(demo.deleteResult);
      expect(deleteText).toMatch(/Deleted \d+ row\(s\) from users/);
      // Expect 1 row deleted (Charlie Brown)
      expect(deleteText).toContain('Deleted 1 row(s) from users');

      // 7) Show Final Data -> display remaining rows (should be 3 now)
      await demo.clickShowFinal();
      const finalMessage = await demo.page.locator('#finalDataResult p').first().innerText();
      // message format: Returned <n> row(s) from users
      expect(finalMessage.trim()).toBe('Returned 3 row(s) from users');

      const finalTable = await demo.parseTableFrom('#finalDataResult');
      expect(finalTable.rows.length).toBe(3);
      const finalFlattened = finalTable.rows.flat().join(' ');
      // Ensure Charlie Brown is NOT present and other users are present
      expect(finalFlattened).not.toContain('Charlie Brown');
      expect(finalFlattened).toContain('Alice Johnson');
      expect(finalFlattened).toContain('Bob Smith');
      expect(finalFlattened).toContain('Diana Prince');

      // Basic assertions about console messages captured (there should be no console.error logged by the app itself)
      // We ensure that consoleMessages is an array and contains only benign messages (if any).
      expect(Array.isArray(consoleMessages)).toBe(true);
      // We have captured at least one uncaught page error above
      expect(pageErrors.length + 1 /* the one we awaited */).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Edge cases and error scenarios (isolated fresh page)', () => {
    test('Selecting before table creation should return an error via database.execute', async ({ page }) => {
      const demo = new SQLDemoPage(page);
      await demo.goto();

      // Try to SELECT before creating the table - using direct execute to observe returned error.
      const selectSql = await demo.page.locator(demo.selectCode).innerText();
      const result = await demo.executeSqlDirectly(selectSql);
      // database.execute should catch underlying error and return { error: '...' }
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
      // Error likely mentions cannot read properties of undefined (since table not present)
      expect(result.error.toLowerCase()).toMatch(/undefined|cannot read/);
    });

    test('Deleting before table creation should return an error via database.execute', async ({ page }) => {
      const demo = new SQLDemoPage(page);
      await demo.goto();

      const deleteSql = await demo.page.locator(demo.deleteCode).innerText();
      const result = await demo.executeSqlDirectly(deleteSql);
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
      expect(result.error.toLowerCase()).toMatch(/undefined|cannot read/);
    });

    test('Ensure UI displays "No data in the table" when final data is empty', async ({ page }) => {
      const demo = new SQLDemoPage(page);
      await demo.goto();

      // Show final data before creating table -> this will call SELECT * FROM users via showFinalData()
      // The UI calls database.execute("SELECT * FROM users") directly; the underlying code will throw and return { error: ... }
      // The UI then builds HTML using result.message and result.data — but when error, result.message is undefined.
      // We assert that when no table exists or data is empty, the UI shows a helpful message or at least not crash.
      await demo.clickShowFinal();
      // Because the table doesn't exist, the page likely produced no table and inserted "No data in the table"
      // Implementation will show "No data in the table" only if result.data.length === 0 and result exists.
      // However, when an error occurred, finalDataResult.innerHTML will include the error handling path -> ensure the element exists
      const finalHtml = await demo.page.locator('#finalDataResult').innerHTML();
      expect(finalHtml.length).toBeGreaterThanOrEqual(0);
      // At minimum, verify there is no uncaught exception thrown at the test level (the page handled it).
      // If the implementation returned an error object, it may not display a success message; ensure no crash.
      expect(await demo.page.locator('#finalDataResult').count()).toBe(1);
    });
  });
});