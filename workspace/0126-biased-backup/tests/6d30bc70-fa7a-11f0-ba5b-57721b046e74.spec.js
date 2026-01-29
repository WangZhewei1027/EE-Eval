import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d30bc70-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Relational Database Explorer (FSM validation)', () => {
  // Capture page errors and console error messages for each test run
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(5000);
    // Collect runtime page errors
    page.context()._pageErrors = [];
    page.on('pageerror', (err) => {
      // store for assertions
      page.context()._pageErrors.push(err);
    });
    // Collect console errors
    page.context()._consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        page.context()._consoleErrors.push(msg.text());
      }
    });

    // Navigate to the app
    await page.goto(BASE_URL);
  });

  test.afterEach(async ({ page }) => {
    // No teardown interaction needed; tests reload page in next beforeEach
  });

  test('Initial Idle state: page renders title and schema selector', async ({ page }) => {
    // Validate initial Idle state evidence: h1 text exists
    const title = await page.locator('h1').textContent();
    expect(title).toContain('Relational Database Explorer');

    // Schema selector exists and has expected default option
    const schemaSelector = page.locator('#schema-selector');
    await expect(schemaSelector).toBeVisible();
    await expect(schemaSelector).toHaveValue(''); // default empty value

    // Initially schema-details is empty
    const schemaDetails = await page.locator('#schema-details');
    await expect(schemaDetails).toBeVisible();
    const detailsHtml = await schemaDetails.innerHTML();
    expect(detailsHtml.trim()).toBe(''); // nothing rendered initially
  });

  test.describe('Querying state and transitions', () => {
    test('TableSelected: selecting a table loads schema and updates query column selectors', async ({ page }) => {
      // Select "customers" in schema-selector which should call loadTableSchema()
      await page.selectOption('#schema-selector', 'customers');

      // schema-details should contain header and a table
      const details = page.locator('#schema-details');
      await expect(details.locator('h3')).toHaveText('customers');
      await expect(details.locator('table')).toBeVisible();

      // Ensure select-columns got populated (first option "*" plus customers columns)
      const selectColumns = page.locator('#select-columns');
      // Allow some time for updateColumnSelectors to run
      await expect(selectColumns).toBeVisible();
      const optionCount = await selectColumns.evaluate((el) => el.options.length);
      expect(optionCount).toBeGreaterThan(1);

      // where-column should also be populated
      const whereColumnCount = await page.locator('#where-column').evaluate((el) => el.options.length);
      expect(whereColumnCount).toBeGreaterThan(0);
    });

    test('ExecuteQuery event: clicking Execute Query without selecting FROM shows alert (edge case)', async ({ page }) => {
      // Ensure FROM table is empty
      await page.selectOption('#from-table', '');
      // Expect an alert when clicking Execute Query
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('button[onclick="executeQuery()"]')
      ]);
      expect(dialog.message()).toBe('Please select a table to query');
      await dialog.accept();
    });

    test('ExecuteQuery event: basic query returns expected rows and columns', async ({ page }) => {
      // Populate column selectors by selecting a schema first
      await page.selectOption('#schema-selector', 'customers');

      // Select FROM table = customers
      await page.selectOption('#from-table', 'customers');

      // Execute query (default select '*' is fine)
      await page.click('button[onclick="executeQuery()"]');

      // Query results should contain a table with rows for each customer (3 initial rows)
      const resultsTable = page.locator('#query-results table');
      await expect(resultsTable).toBeVisible();

      // Header should have columns like "id", "name", "email", "phone"
      const headers = await resultsTable.locator('th').allTextContents();
      expect(headers).toEqual(expect.arrayContaining(['id', 'name', 'email', 'phone']));

      // Body rows count should match number of customers (3)
      const rowCount = await resultsTable.locator('tbody tr, tr').count();
      // displayResults generates a table but not inside tbody; count rows by tr excluding header -> headers length + rows
      // We'll count data rows as total tr minus 1 header row
      const totalTr = await resultsTable.locator('tr').count();
      expect(totalTr - 1).toBeGreaterThanOrEqual(3); // at least 3 data rows expected
    });

    test('ResetQuery event: clicking Reset clears selections and results', async ({ page }) => {
      // Select schema and from table then run a query to populate results
      await page.selectOption('#schema-selector', 'customers');
      await page.selectOption('#from-table', 'customers');
      await page.click('button[onclick="executeQuery()"]');

      // Ensure results exist
      await expect(page.locator('#query-results table')).toBeVisible();

      // Click Reset button
      await page.click('button[onclick="resetQuery()"]');

      // join-section should be hidden and query-results empty
      const joinSectionHidden = await page.locator('#join-section').evaluate(el => el.classList.contains('hidden'));
      expect(joinSectionHidden).toBe(true);

      const queryResultsHtml = await page.locator('#query-results').innerHTML();
      expect(queryResultsHtml.trim()).toBe('');
    });

    test('Join query: FROM orders JOIN customers on orders.customer_id = customers.id returns combined rows', async ({ page }) => {
      // Select FROM table orders
      await page.selectOption('#from-table', 'orders');

      // join-section should appear
      const joinSection = page.locator('#join-section');
      await expect(joinSection).toBeVisible();

      // Choose join-table = customers (should populate join-table options)
      await page.selectOption('#join-table', 'customers');

      // Wait for join condition to be shown and populated
      const joinCondition = page.locator('#join-condition');
      await expect(joinCondition).toBeVisible();

      // Set left/right join columns to produce matches: orders.customer_id = customers.id
      await page.selectOption('#left-join-column', 'customer_id');
      await page.selectOption('#right-join-column', 'id');

      // Execute query
      await page.click('button[onclick="executeQuery()"]');

      // Results should be a table and have combined column names containing 'orders.' or 'customers.'
      const resultsTable = page.locator('#query-results table');
      await expect(resultsTable).toBeVisible();

      const headers = await resultsTable.locator('th').allTextContents();
      expect(headers.some(h => h.startsWith('orders.'))).toBeTruthy();
      expect(headers.some(h => h.startsWith('customers.'))).toBeTruthy();

      // There should be rows equal to number of orders that have matching customers (orders length is 3)
      const totalTr = await resultsTable.locator('tr').count();
      expect(totalTr - 1).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('Data Manipulation: Insert, Update, Delete', () => {
    test('InsertRecord event: show insert form and perform insert adds a record', async ({ page }) => {
      // Show insert form
      await page.click('button[onclick="showInsertForm()"]');
      const insertForm = page.locator('#insert-form');
      await expect(insertForm).toBeVisible();

      // Attempt to perform insert without selecting a table (edge case)
      // Click Insert with no table selected -> should alert "Please select a table"
      const [noTableDialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#insert-form button[onclick="performInsert()"]')
      ]);
      expect(noTableDialog.message()).toBe('Please select a table');
      await noTableDialog.accept();

      // Now select table 'customers' to insert into
      await page.selectOption('#insert-table', 'customers');

      // loadInsertFields populates inputs
      // Wait for inputs to exist (name, email, phone)
      await page.waitForSelector('#insert-name');

      // Fill inputs
      await page.fill('#insert-name', 'Alice Example');
      await page.fill('#insert-email', 'alice@example.com');
      await page.fill('#insert-phone', '555-0000');

      // Intercept the alert that confirms insertion
      const dialogPromise = page.waitForEvent('dialog');

      // Click Insert button to perform the insert
      await page.click('#insert-form button[onclick="performInsert()"]');

      const insertDialog = await dialogPromise;
      expect(insertDialog.message()).toBe('Record inserted successfully');
      await insertDialog.accept();

      // Verify that the page's in-memory database was updated: customers length increased and last record matches
      const lastCustomer = await page.evaluate(() => {
        const arr = database.customers;
        return arr[arr.length - 1];
      });
      expect(lastCustomer.name).toBe('Alice Example');
      expect(lastCustomer.email).toBe('alice@example.com');
    });

    test('UpdateRecord event: show update form and perform update modifies a record', async ({ page }) => {
      // First, ensure there's a known record to update by inserting one
      await page.click('button[onclick="showInsertForm()"]');
      await page.selectOption('#insert-table', 'customers');
      await page.fill('#insert-name', 'To Be Updated');
      await page.fill('#insert-email', 'tbu@example.com');
      await page.fill('#insert-phone', '555-1111');
      const d1 = page.waitForEvent('dialog');
      await page.click('#insert-form button[onclick="performInsert()"]');
      (await d1).accept();

      // Show update form
      await page.click('button[onclick="showUpdateForm()"]');
      await expect(page.locator('#update-form')).toBeVisible();

      // Select update table 'customers' which populates update-fields (including update-id select)
      await page.selectOption('#update-table', 'customers');

      // Wait for the id select to be populated
      await page.waitForSelector('#update-id');

      // Choose the last inserted record's ID by evaluating the last id in the database
      const lastId = await page.evaluate(() => database.customers[database.customers.length - 1].id + '');
      await page.selectOption('#update-id', lastId);

      // Fill a field to update
      await page.fill('#update-name', 'Updated Name');

      // Intercept alert and perform update
      const updateDialogPromise = page.waitForEvent('dialog');
      await page.click('#update-form button[onclick="performUpdate()"]');
      const updateDialog = await updateDialogPromise;
      expect(updateDialog.message()).toBe('Record updated successfully');
      await updateDialog.accept();

      // Verify database updated
      const updatedRecord = await page.evaluate((id) => {
        return database.customers.find(r => r.id == id);
      }, parseInt(lastId));
      expect(updatedRecord.name).toBe('Updated Name');
    });

    test('DeleteRecord event: show delete form and perform delete removes a record after confirmation', async ({ page }) => {
      // Insert a record to delete
      await page.click('button[onclick="showInsertForm()"]');
      await page.selectOption('#insert-table', 'customers');
      await page.fill('#insert-name', 'To Be Deleted');
      await page.fill('#insert-email', 'tbd@example.com');
      await page.fill('#insert-phone', '555-2222');
      const insDialogP = page.waitForEvent('dialog');
      await page.click('#insert-form button[onclick="performInsert()"]');
      (await insDialogP).accept();

      // Show delete form
      await page.click('button[onclick="showDeleteForm()"]');
      await expect(page.locator('#delete-form')).toBeVisible();

      // Select delete table and wait for options
      await page.selectOption('#delete-table', 'customers');
      await page.waitForSelector('#delete-id');

      // Choose the last inserted record id
      const idToDelete = await page.evaluate(() => {
        return database.customers[database.customers.length - 1].id + '';
      });
      await page.selectOption('#delete-id', idToDelete);

      // Prepare for confirm dialog (first) and alert (second)
      const confirmPromise = page.waitForEvent('dialog');
      // Click Delete which will trigger confirm
      await page.click('#delete-form button[onclick="performDelete()"]');

      const confirmDialog = await confirmPromise;
      expect(confirmDialog.type()).toBe('confirm');
      expect(confirmDialog.message()).toBe('Are you sure you want to delete this record?');
      // Accept the confirmation to proceed with deletion
      await confirmDialog.accept();

      // Now wait for the success alert triggered after confirm
      const alertAfterDelete = await page.waitForEvent('dialog');
      expect(alertAfterDelete.message()).toBe('Record deleted successfully');
      await alertAfterDelete.accept();

      // Verify deletion from in-memory database
      const exists = await page.evaluate((id) => {
        return database.customers.some(r => r.id == id);
      }, parseInt(idToDelete));
      expect(exists).toBe(false);
    });

    test('Update edge case: clicking Update without selecting table or id shows an alert', async ({ page }) => {
      // Show update form but do not select a table
      await page.click('button[onclick="showUpdateForm()"]');
      await expect(page.locator('#update-form')).toBeVisible();

      // Clicking Update should alert "Please select a table and record"
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#update-form button[onclick="performUpdate()"]')
      ]);
      // The alert is thrown because table is not selected and/or id missing
      expect(dialog.message()).toBe('Please select a table and record');
      await dialog.accept();
    });
  });

  test('Edge case: Attempting to performDelete with no selection alerts user', async ({ page }) => {
    // Show delete form but do not choose table or id
    await page.click('button[onclick="showDeleteForm()"]');
    await expect(page.locator('#delete-form')).toBeVisible();

    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('#delete-form button[onclick="performDelete()"]')
    ]);
    expect(dialog.message()).toBe('Please select a table and record');
    await dialog.accept();
  });

  test('No unexpected runtime errors or console errors occurred during interactions', async ({ page }) => {
    // This test navigates a few interactions and asserts that there are no uncaught page errors or console errors.
    // Do some typical interactions
    await page.selectOption('#schema-selector', 'products');
    await page.selectOption('#from-table', 'products');
    await page.click('button[onclick="executeQuery()"]');
    await page.click('button[onclick="resetQuery()"]');
    await page.click('button[onclick="showInsertForm()"]');
    await page.click('button[onclick="showUpdateForm()"]');
    await page.click('button[onclick="showDeleteForm()"]');

    // Give the page a short moment to potentially surface errors
    await page.waitForTimeout(200);

    // Fetch captured errors
    const pageErrors = page.context()._pageErrors || [];
    const consoleErrors = page.context()._consoleErrors || [];

    // Assert no uncaught page errors (ReferenceError/SyntaxError/TypeError)
    expect(pageErrors.length).toBe(0);

    // Assert no console.error calls
    expect(consoleErrors.length).toBe(0);
  });
});