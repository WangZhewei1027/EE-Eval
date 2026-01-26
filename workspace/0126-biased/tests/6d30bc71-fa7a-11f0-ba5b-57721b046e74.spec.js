import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d30bc71-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Interactive SQL Explorer - FSM behavior and UI integration', () => {
  // Capture console and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for later assertions
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect unhandled page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the application
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait a little for initialization code to run (init() on window.onload)
    await page.waitForTimeout(100);
  });

  test.afterEach(async () => {
    // Teardown is automatic; arrays are reset in next beforeEach
  });

  test.describe('Initialization (S0_Idle) and default state', () => {
    test('should initialize and show Query Builder as the active tab', async ({ page }) => {
      // Validate that the Query Builder tab is active on load
      const activeTab = page.locator('.tabs .tab.active');
      await expect(activeTab).toHaveText('Query Builder');

      // Validate that the query tab content is active
      const queryContent = page.locator('#query');
      await expect(queryContent).toHaveClass(/active/);

      // The init() function should populate select columns and schema/tutor content without errors
      const selectColumns = page.locator('#selectColumns input[type="checkbox"]');
      await expect(selectColumns).toHaveCountGreaterThan(0);

      // No uncaught page errors should have occurred during init
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Tab switching transitions (SwitchTab)', () => {
    test('should switch from Query Builder -> Database Schema (S1 -> S2)', async ({ page }) => {
      // Click the "Database Schema" tab and assert state changes
      const schemaTab = page.locator('.tab', { hasText: 'Database Schema' });
      await schemaTab.click();
      await expect(schemaTab).toHaveClass(/active/);

      // Schema content should be active and query content inactive
      await expect(page.locator('#schema')).toHaveClass(/active/);
      await expect(page.locator('#query')).not.toHaveClass(/active/);

      // Ensure table schema displayed for default selection
      await expect(page.locator('#tableSchema table')).toBeVisible();

      expect(pageErrors.length).toBe(0);
    });

    test('should switch Database Schema -> Tutorial -> Query Builder (S2 -> S3 -> S1)', async ({ page }) => {
      // Database Schema
      await page.locator('.tab', { hasText: 'Database Schema' }).click();
      await expect(page.locator('#schema')).toHaveClass(/active/);

      // Tutorial
      await page.locator('.tab', { hasText: 'Tutorial' }).click();
      await expect(page.locator('.tab', { hasText: 'Tutorial' })).toHaveClass(/active/);
      await expect(page.locator('#tutorial')).toHaveClass(/active/);

      // Back to Query Builder
      await page.locator('.tab', { hasText: 'Query Builder' }).click();
      await expect(page.locator('.tab', { hasText: 'Query Builder' })).toHaveClass(/active/);
      await expect(page.locator('#query')).toHaveClass(/active/);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Query Builder actions and transitions (S1_QueryBuilder)', () => {
    test('Execute SELECT query should display results and stats', async ({ page }) => {
      // Ensure default SQL is a SELECT
      const sqlArea = page.locator('#sqlQuery');
      await expect(sqlArea).toHaveValue(/SELECT \* FROM employees;/i);

      // Click Execute
      await page.locator('button', { hasText: 'Execute' }).click();

      // Expect a results table with header columns matching the database employees object keys
      const resultsTable = page.locator('#queryResults table');
      await expect(resultsTable).toBeVisible();

      // Header cells should include columns like 'id' and 'first_name'
      await expect(resultsTable.locator('th')).toContainText(['id', 'first_name', 'last_name']);

      // Stats should indicate 4 rows returned
      await expect(page.locator('#queryStats')).toContainText('Returned 4 rows from table employees');

      expect(pageErrors.length).toBe(0);
    });

    test('Explain query should show a Query Explanation block', async ({ page }) => {
      // Ensure some query is present
      await expect(page.locator('#sqlQuery')).toHaveValue(/SELECT/i);

      // Click Explain
      await page.locator('button', { hasText: 'Explain' }).click();

      // Expect explanation content in queryResults
      await expect(page.locator('#queryResults')).toContainText('Query Explanation');
      await expect(page.locator('#queryResults')).toContainText('Query type: SELECT');

      expect(pageErrors.length).toBe(0);
    });

    test('Save and Load Query should use localStorage and dialogs appear', async ({ page }) => {
      // Ensure a known query
      await page.locator('#sqlQuery').fill('SELECT first_name FROM employees;');

      // Intercept the alert dialog triggered by saveQuery()
      const [saveDialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.locator('button', { hasText: 'Save Query' }).click()
      ]);
      expect(saveDialog.message()).toBe('Query saved to browser storage');
      await saveDialog.accept();

      // Change the textarea to something else
      await page.locator('#sqlQuery').fill('SELECT * FROM departments;');

      // Click Load Query and it should replace with saved query (no dialog expected because savedQuery exists)
      await page.locator('button', { hasText: 'Load Query' }).click();
      await expect(page.locator('#sqlQuery')).toHaveValue('SELECT first_name FROM employees;');

      // Clean up saved query for other tests
      await page.evaluate(() => localStorage.removeItem('savedQuery'));

      expect(pageErrors.length).toBe(0);
    });

    test('Load Query when none saved should prompt alert', async ({ page }) => {
      // Ensure localStorage has no savedQuery
      await page.evaluate(() => localStorage.removeItem('savedQuery'));

      // Click Load Query and expect an alert stating no saved query
      const [noSavedDialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.locator('button', { hasText: 'Load Query' }).click()
      ]);
      expect(noSavedDialog.message()).toBe('No saved query found');
      await noSavedDialog.accept();

      expect(pageErrors.length).toBe(0);
    });

    test('Clear Query should empty the SQL textarea', async ({ page }) => {
      await page.locator('#sqlQuery').fill('SELECT * FROM projects;');
      await page.locator('button', { hasText: 'Clear' }).click();
      await expect(page.locator('#sqlQuery')).toHaveValue('');

      expect(pageErrors.length).toBe(0);
    });

    test('Update query template via queryType select (UpdateQueryTemplate)', async ({ page }) => {
      // Select 'INSERT' and expect SQL and options updated
      await page.selectOption('#queryType', 'insert');
      await expect(page.locator('#sqlQuery')).toContainText('INSERT INTO employees');
      // queryOptions should no longer be hidden
      await expect(page.locator('#queryOptions')).not.toHaveClass(/hidden/);

      // Select 'select' and expect SELECT template and selectOptions visible
      await page.selectOption('#queryType', 'select');
      await expect(page.locator('#sqlQuery')).toHaveValue('SELECT * FROM employees;');
      await expect(page.locator('#selectOptions')).toBeVisible();

      expect(pageErrors.length).toBe(0);
    });

    test('Update select columns when table changes (UpdateSelectColumns)', async ({ page }) => {
      // Ensure the queryOptions are visible by selecting 'select'
      await page.selectOption('#queryType', 'select');

      // Select the 'departments' table
      await page.selectOption('#selectTable', 'departments');

      // Count of checkboxes should match number of keys in the departments sample (4)
      const checkboxes = page.locator('#selectColumns input[type="checkbox"]');
      await expect(checkboxes).toHaveCount(4);

      // Labels should include 'id' and 'name' at least
      await expect(page.locator('#selectColumns')).toContainText('id');
      await expect(page.locator('#selectColumns')).toContainText('name');

      expect(pageErrors.length).toBe(0);
    });

    test('Executing invalid SELECT should show error message but not throw uncaught exception', async ({ page }) => {
      // Put an invalid SELECT that refers to a missing column
      await page.locator('#sqlQuery').fill('SELECT nonexist FROM employees;');
      await page.locator('button', { hasText: 'Execute' }).click();

      // The UI should show a red error message with the expected text
      await expect(page.locator('#queryResults')).toContainText('Error: Column nonexist not found');

      // This is a handled error; there should be no uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Executing unsupported query type should display error (edge case)', async ({ page }) => {
      await page.locator('#sqlQuery').fill('DESCRIBE employees;');
      await page.locator('button', { hasText: 'Execute' }).click();

      await expect(page.locator('#queryResults')).toContainText('Error: Unsupported query type');

      expect(pageErrors.length).toBe(0);
    });

    test('INSERT, UPDATE, DELETE flows should report affected rows and update UI', async ({ page }) => {
      // INSERT flow
      await page.selectOption('#queryType', 'insert');
      // The template insert statement is set by updateQueryTemplate()
      const insertSql = await page.locator('#sqlQuery').inputValue();
      await page.locator('button', { hasText: 'Execute' }).click();
      await expect(page.locator('#queryResults')).toContainText('INSERT operation completed successfully');
      await expect(page.locator('#queryStats')).toContainText('Affected 1 rows in table employees');

      // Reload page (fresh DB state) for update test
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(100);

      // UPDATE flow
      await page.selectOption('#queryType', 'update');
      await page.locator('button', { hasText: 'Execute' }).click();
      await expect(page.locator('#queryResults')).toContainText('UPDATE operation completed successfully');
      // Affected rows should equal number of employees (4)
      await expect(page.locator('#queryStats')).toContainText('Affected 4 rows in table employees');

      // DELETE flow
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(100);
      await page.selectOption('#queryType', 'delete');
      await page.locator('button', { hasText: 'Execute' }).click();
      await expect(page.locator('#queryResults')).toContainText('DELETE operation completed successfully');
      // Affected rows should be 1 (demo removes last item)
      await expect(page.locator('#queryStats')).toContainText('Affected 1 rows in table employees');

      expect(pageErrors.length).toBe(0);
    });

    test('Empty SQL input should not execute and should not throw', async ({ page }) => {
      // Clear query area
      await page.locator('#sqlQuery').fill('');
      // Click Execute
      await page.locator('button', { hasText: 'Execute' }).click();

      // Nothing should be shown in queryResults (remains empty string)
      await expect(page.locator('#queryResults')).toHaveJSProperty('innerHTML', '');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Database Schema (S2_DatabaseSchema) and Tutorial (S3_Tutorial)', () => {
    test('ShowTableSchema should render schema table for selected table', async ({ page }) => {
      // Switch to Schema tab
      await page.locator('.tab', { hasText: 'Database Schema' }).click();

      // Select 'projects' and expect the schema table to show 5 rows (as per schema.projects)
      await page.selectOption('#schemaTable', 'projects');

      // Wait briefly for DOM updates
      await page.waitForTimeout(50);

      // Table body rows should equal number of fields in projects schema (5)
      const rows = page.locator('#tableSchema table tbody tr');
      await expect(rows).toHaveCount(5);

      // Header columns should be Column, Type, Description
      await expect(page.locator('#tableSchema table thead th')).toContainText(['Column', 'Type', 'Description']);

      expect(pageErrors.length).toBe(0);
    });

    test('ShowTutorial should display selected tutorial content', async ({ page }) => {
      // Switch to Tutorial tab
      await page.locator('.tab', { hasText: 'Tutorial' }).click();

      // Choose 'joins' topic
      await page.selectOption('#tutorialTopic', 'joins');

      // The tutorial content div should contain "JOIN Operations" heading as in tutorials.joins
      await expect(page.locator('#tutorialContent')).toContainText('JOIN Operations');

      // Change to 'functions' topic
      await page.selectOption('#tutorialTopic', 'functions');
      await expect(page.locator('#tutorialContent')).toContainText('SQL Functions');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console and runtime observations', () => {
    test('should have no uncaught runtime errors during typical interactions', async ({ page }) => {
      // Perform a set of interactions across the app to ensure no pageerror occurs
      await page.locator('.tab', { hasText: 'Query Builder' }).click();
      await page.locator('button', { hasText: 'Execute' }).click();
      await page.locator('.tab', { hasText: 'Database Schema' }).click();
      await page.locator('#schemaTable').selectOption('departments');
      await page.locator('.tab', { hasText: 'Tutorial' }).click();
      await page.locator('#tutorialTopic').selectOption('basics');

      // Allow event handlers to run
      await page.waitForTimeout(100);

      // There should be no uncaught page errors collected
      expect(pageErrors.length).toBe(0);

      // Optionally inspect console errors (none expected), but assert array exists
      expect(Array.isArray(consoleMessages)).toBe(true);
    });
  });
});