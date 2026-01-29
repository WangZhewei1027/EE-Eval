import { test, expect } from '@playwright/test';

// Test file for Application ID: 324ee661-fa73-11f0-a9d0-d7a1991987c6
// URL: http://127.0.0.1:5500/workspace/0126-balanced/html/324ee661-fa73-11f0-a9d0-d7a1991987c6.html
//
// This suite validates the FSM states and transitions for the SQL Simulation app.
// It also observes console messages and page errors without modifying the page runtime.
//
// Tests cover:
// - Initial render (S0_Idle)
// - Successful INSERT, SELECT, DELETE transitions (S1_CommandExecuted)
// - Error scenarios: invalid INSERT, DELETE missing ID, unsupported command (S2_Error)
// - Edge cases and DOM verification (table rows, output, input clearing)

const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-balanced/html/324ee661-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object to encapsulate interactions with the SQL Simulation page
class SqlPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#commandInput');
    this.executeButton = page.locator("button[onclick='executeCommand()']");
    this.output = page.locator('#output');
    this.tableBody = page.locator('#dataTable tbody');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure initial rendering completed
    await expect(this.page.locator('h1')).toHaveText('SQL Simulation');
  }

  async enterCommand(command) {
    await this.input.fill(command);
  }

  async clickExecute() {
    await this.executeButton.click();
  }

  async execute(command) {
    await this.enterCommand(command);
    await this.clickExecute();
  }

  async getOutputText() {
    return (await this.output.textContent()) || '';
  }

  async getRowCount() {
    return await this.tableBody.locator('tr').count();
  }

  async getRowsData() {
    const rows = this.tableBody.locator('tr');
    const count = await rows.count();
    const data = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const cells = row.locator('td');
      const id = (await cells.nth(0).textContent())?.trim() || '';
      const name = (await cells.nth(1).textContent())?.trim() || '';
      const age = (await cells.nth(2).textContent())?.trim() || '';
      data.push({ id, name, age });
    }
    return data;
  }

  async expectOutputToBe(expected) {
    await expect(this.output).toHaveText(expected);
  }

  async expectInputCleared() {
    await expect(this.input).toHaveValue('');
  }
}

test.describe('SQL Simulation FSM - states and transitions', () => {
  // capture console errors and page errors per test
  test.beforeEach(async ({ page }) => {
    // no-op here; individual tests attach listeners after navigating, to capture from page load too if needed
  });

  test('Initial state S0_Idle: table rendered and empty, Execute button present', async ({ page }) => {
    // Validate onEnter action renderTable() resulted in an empty tbody and Execute button exists
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg);
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const sql = new SqlPage(page);
    await sql.goto();

    // Table header exists and tbody should be empty initially
    await expect(page.locator('#dataTable thead th')).toHaveCount(3);
    await expect(sql.getRowCount()).resolves.toBe(0);

    // Execute button is visible
    await expect(sql.executeButton).toBeVisible();

    // No runtime errors occurred during load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Successful command executions (S1_CommandExecuted)', () => {
    test.beforeEach(async ({ page }) => {
      // nothing special
    });

    test('INSERT success adds a row, outputs confirmation, and clears input', async ({ page }) => {
      // This validates the INSERT transition to S1_CommandExecuted:
      // - output "Inserted successfully"
      // - table updated with new row
      // - input cleared after execution
      const consoleErrors1 = [];
      const pageErrors1 = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg);
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err);
      });

      const sql1 = new SqlPage(page);
      await sql.goto();

      // Use INSERT format compatible with the page's parser:
      // command.split(' ').slice(2) assumes two tokens before values, e.g., "INSERT INTO 1 'Alice' 30"
      await sql.execute("INSERT INTO 1 'Alice' 30");

      // Output should indicate success
      await sql.expectOutputToBe('Inserted successfully');

      // Table should now have one row containing the inserted data (note: values are uppercased by the script)
      expect(await sql.getRowCount()).toBe(1);
      const rows1 = await sql.getRowsData();
      expect(rows[0].id).toBe('1');
      // Name is uppercased because executeCommand uppercases the entire command
      expect(rows[0].name.toUpperCase()).toBe(rows[0].name);
      expect(rows[0].age).toBe('30');

      // Input cleared after execution
      await sql.expectInputCleared();

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('SELECT displays JSON representation of the database', async ({ page }) => {
      // Validate SELECT returns JSON of database (S1_CommandExecuted)
      const consoleErrors2 = [];
      const pageErrors2 = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg);
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err);
      });

      const sql2 = new SqlPage(page);
      await sql.goto();

      // Insert two rows first to have data to select
      await sql.execute("INSERT INTO 2 'Bob' 25");
      await sql.execute("INSERT INTO 3 'Carol' 40");

      // Now SELECT should output JSON with the two inserted rows (plus any prior)
      await sql.execute('SELECT');

      const output = await sql.getOutputText();
      // Parse JSON - since the script uppercases names, they will be uppercase in JSON
      let parsed;
      try {
        parsed = JSON.parse(output);
      } catch (e) {
        parsed = null;
      }
      expect(parsed).not.toBeNull();
      expect(Array.isArray(parsed)).toBe(true);
      // Expect at least two entries with ids 2 and 3 present
      const ids = parsed.map((e) => e.id);
      expect(ids).toEqual(expect.arrayContaining([2, 3]));

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('DELETE success removes a row and outputs confirmation', async ({ page }) => {
      // Validate DELETE transition to S1_CommandExecuted:
      // - output "Deleted successfully"
      // - table row removed
      const consoleErrors3 = [];
      const pageErrors3 = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg);
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err);
      });

      const sql3 = new SqlPage(page);
      await sql.goto();

      // Insert then delete
      await sql.execute("INSERT INTO 4 'Dave' 28");
      // Ensure inserted
      expect(await sql.getRowCount()).toBeGreaterThanOrEqual(1);

      // Delete the inserted row (DELETE expects format "DELETE FROM 4")
      await sql.execute('DELETE FROM 4');

      await sql.expectOutputToBe('Deleted successfully');

      // Confirm that id 4 is no longer present in the table rows
      const rowsData = await sql.getRowsData();
      const ids1 = rowsData.map((r) => r.id);
      expect(ids).not.toContain('4');

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error scenarios (S2_Error)', () => {
    test('Invalid INSERT produces Error: Invalid INSERT command', async ({ page }) => {
      // Edge case: malformed or non-numeric id/age should trigger invalid INSERT error
      const consoleErrors4 = [];
      const pageErrors4 = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg);
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err);
      });

      const sql4 = new SqlPage(page);
      await sql.goto();

      // Non-numeric id and invalid age should cause error
      await sql.execute("INSERT INTO abc 'Eve' twenty");

      await sql.expectOutputToBe('Error: Invalid INSERT command');

      // Table should remain with zero rows (no invalid insertion)
      expect(await sql.getRowCount()).toBe(0);

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('DELETE for non-existent ID produces Error: ID not found', async ({ page }) => {
      // Attempt to delete an ID that isn't in database
      const consoleErrors5 = [];
      const pageErrors5 = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg);
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err);
      });

      const sql5 = new SqlPage(page);
      await sql.goto();

      // Ensure database is empty
      expect(await sql.getRowCount()).toBe(0);

      // Attempt delete of ID 999 which doesn't exist
      await sql.execute('DELETE FROM 999');

      await sql.expectOutputToBe('Error: ID not found');

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Unsupported command produces Error: Unsupported command', async ({ page }) => {
      // Commands other than INSERT/SELECT/DELETE should trigger unsupported command error
      const consoleErrors6 = [];
      const pageErrors6 = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg);
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err);
      });

      const sql6 = new SqlPage(page);
      await sql.goto();

      await sql.execute('UPDATE table SET name = \'X\' WHERE id = 1');

      await sql.expectOutputToBe('Error: Unsupported command');

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Additional edge cases and invariants', () => {
    test('Input is cleared after every execution (success and error cases)', async ({ page }) => {
      const sql7 = new SqlPage(page);
      await sql.goto();

      // Attach listeners to capture runtime errors if any
      const consoleErrors7 = [];
      const pageErrors7 = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg);
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err);
      });

      // Successful execution clears input
      await sql.enterCommand("INSERT INTO 10 'Frank' 33");
      await sql.clickExecute();
      await sql.expectInputCleared();
      await sql.expectOutputToBe('Inserted successfully');

      // Error execution clears input
      await sql.enterCommand('SOME_BAD_COMMAND');
      await sql.clickExecute();
      await sql.expectInputCleared();
      await sql.expectOutputToBe('Error: Unsupported command');

      // No runtime errors during these operations
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Multiple operations maintain consistent database state', async ({ page }) => {
      const sql8 = new SqlPage(page);
      await sql.goto();

      // Clear any stray listeners
      const consoleErrors8 = [];
      const pageErrors8 = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg);
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err);
      });

      // Insert multiple entries
      await sql.execute("INSERT INTO 20 'Gina' 22");
      await sql.execute("INSERT INTO 21 'Hank' 45");
      await sql.execute('SELECT');
      const out1 = await sql.getOutputText();
      let parsed1;
      try {
        parsed1 = JSON.parse(out1);
      } catch (e) {
        parsed1 = [];
      }
      const ids1 = parsed1.map((e) => e.id);
      expect(ids1).toEqual(expect.arrayContaining([20, 21]));

      // Delete one entry and verify remaining
      await sql.execute('DELETE FROM 20');
      await sql.expectOutputToBe('Deleted successfully');

      // SELECT to confirm only 21 remains
      await sql.execute('SELECT');
      const out2 = await sql.getOutputText();
      let parsed2;
      try {
        parsed2 = JSON.parse(out2);
      } catch (e) {
        parsed2 = [];
      }
      const ids2 = parsed2.map((e) => e.id);
      expect(ids2).toEqual(expect.arrayContaining([21]));
      expect(ids2).not.toContain(20);

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});