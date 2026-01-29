import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b32302-fa74-11f0-bb9a-db7e6ecdeeaa.html';

test.describe('FSM: Query Optimization Demonstration - states and transitions', () => {
  // Arrays to collect console messages and uncaught page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages from the page
    page.on('console', msg => {
      // Store simple representation of the message
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled exceptions (pageerror event)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Post-test: ensure we observed console and page errors as part of validations in tests.
    // Nothing to tear down beyond Playwright fixtures.
  });

  test('Initial Idle state: page renders with expected components', async ({ page }) => {
    // This test validates the S0_Idle state: the page should render the textarea with default SQL,
    // the Run button, and an empty output area.

    // Verify textarea exists and has the FSM-specified initial SQL text
    const textarea = await page.waitForSelector('#queryInput');
    const value = await textarea.inputValue();
    expect(value).toContain("SELECT * FROM employees WHERE department = 'Sales' AND salary > 60000;");

    // Verify Run and Compare button exists
    const runBtn = await page.waitForSelector('#runBtn');
    expect(await runBtn.innerText()).toBe('Run and Compare');

    // Verify output container exists and is initially empty
    const output = await page.waitForSelector('#output');
    const outputHtml = await output.innerHTML();
    // Output should be empty string or whitespace initially
    expect(outputHtml.trim()).toBe('');

    // No uncaught page errors or console.error messages should have occurred during initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Transition S0 -> S1 -> S3: valid query executes and shows comparison results', async ({ page }) => {
    // This test validates:
    // - Clicking Run triggers RunQuery event (S0 -> S1)
    // - With valid query, parseQuery returns filters and transition to S3_QueryExecuted occurs
    // - Output contains highlighted SQL, explanation and performance table
    // - The unoptimized steps should equal total employees (1000)
    // - The optimized steps should be <= unoptimized steps

    // Ensure the default query is present (this is the valid scenario)
    const textarea1 = await page.waitForSelector('#queryInput');
    const initialQuery = await textarea.inputValue();
    expect(initialQuery).toContain('SELECT * FROM employees');

    // Click Run and wait for output to render header 'Query:'
    await Promise.all([
      page.waitForSelector('#output h2'),
      page.click('#runBtn')
    ]);

    // Verify the highlighted SQL is present in a <pre> element under output
    const preHandle = await page.waitForSelector('#output pre');
    const preHtml = await preHandle.innerHTML();
    // Highlighted SQL must contain <mark> tags for SELECT/FROM/WHERE etc.
    expect(preHtml).toMatch(/<mark>SELECT<\/mark>|<mark>FROM<\/mark>|<mark>WHERE<\/mark>/i);

    // Verify explanation paragraph mentions Unoptimized and Optimized descriptions
    const explanation = await page.locator('#output .explanation').innerText();
    expect(explanation).toContain('Unoptimized query');
    expect(explanation).toContain('Optimized query');

    // Extract performance numbers from the table
    const rows = await page.$$('#output table tbody tr');
    expect(rows.length).toBeGreaterThanOrEqual(2); // unoptimized + optimized rows

    // Helper to get cell text by row index (0-based) and cell index (0-based)
    const cellText = async (rowIndex, cellIndex) => {
      const selector = `#output table tbody tr:nth-child(${rowIndex + 1}) td:nth-child(${cellIndex + 1})`;
      const el = await page.waitForSelector(selector);
      return (await el.innerText()).trim();
    };

    // Unoptimized row is first row
    const unoptStepsText = await cellText(0, 1); // Rows Scanned (Steps) column
    const unoptTimeText = await cellText(0, 2);
    const unoptReturnedText = await cellText(0, 3);

    // Optimized row is second row
    const optStepsText = await cellText(1, 1);
    const optTimeText = await cellText(1, 2);
    const optReturnedText = await cellText(1, 3);

    // Parse numbers (remove commas)
    const parseNumber = s => Number(s.replace(/,/g, ''));

    const unoptSteps = parseNumber(unoptStepsText);
    const optSteps = parseNumber(optStepsText);
    const unoptReturned = parseNumber(unoptReturnedText);
    const optReturned = parseNumber(optReturnedText);

    // The demo populates 1000 employees; unoptimized steps should be 1000
    // We read the actual employees length from the page context to avoid making assumptions
    const employeeCount = await page.evaluate(() => employees.length);
    expect(unoptSteps).toBe(employeeCount);

    // Optimized steps must be <= unoptimized steps
    expect(optSteps).toBeLessThanOrEqual(unoptSteps);

    // Returned rows counts should be numbers and equal or less than employeeCount
    expect(unoptReturned).toBeGreaterThanOrEqual(0);
    expect(unoptReturned).toBeLessThanOrEqual(employeeCount);
    expect(optReturned).toBeGreaterThanOrEqual(0);
    expect(optReturned).toBeLessThanOrEqual(employeeCount);

    // Verify timings are numeric strings (ms)
    expect(Number(unoptTimeText)).not.toBeNaN();
    expect(Number(optTimeText)).not.toBeNaN();

    // Cross-check that optimized results length equals filteredSet results computed in page context
    const queryValue = await page.$eval('#queryInput', el => el.value);
    const filters = await page.evaluate((q) => {
      return parseQuery(q);
    }, queryValue);
    // If parse succeeded, compute expected optimized results count using same function
    if (filters !== null) {
      const optExec = await page.evaluate((filts) => {
        return executeQueryOptimized(filts).results.length;
      }, filters);
      expect(optReturned).toBe(optExec);
    }

    // Ensure no console errors or uncaught page errors appeared during execution
    const consoleErrors1 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Transition S1 -> S2: invalid queries produce error message (no WHERE, malformed conditions)', async ({ page }) => {
    // This test covers InvalidQuery transitions and edge cases:
    // - Missing WHERE clause -> treated as invalid by parseQuery -> shows unsupported message
    // - Malformed condition -> shows unsupported message
    const outputLocator = page.locator('#output');

    // Case A: Missing WHERE clause (SELECT * FROM employees;)
    await page.fill('#queryInput', 'SELECT * FROM employees;');
    await Promise.all([
      page.waitForFunction(() => document.getElementById('output').innerText.length > 0 || true),
      page.click('#runBtn')
    ]);
    // Wait for the error paragraph to appear
    const errorHtml1 = await outputLocator.innerHTML();
    expect(errorHtml1).toContain('Unsupported or invalid query');

    // Case B: Malformed condition
    await page.fill('#queryInput', "SELECT * FROM employees WHERE salary >> 50000;");
    await page.click('#runBtn');
    // Wait for output update
    await page.waitForTimeout(50); // tiny wait to allow DOM update
    const errorHtml2 = await outputLocator.innerHTML();
    expect(errorHtml2).toContain('Unsupported or invalid query');

    // Case C: Empty query should prompt a different error message
    await page.fill('#queryInput', '');
    await page.click('#runBtn');
    await page.waitForSelector('#output p');
    const emptyMsg = await page.locator('#output p').innerText();
    expect(emptyMsg).toContain('Please enter a SQL query.');

    // Confirm that invalid query path does not throw uncaught exceptions
    const consoleErrors2 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Detailed state verification: QueryEntered state exists and parseQuery behavior', async ({ page }) => {
    // This test inspects parseQuery behavior in the page context to validate the FSM's parse step.
    // We do not modify functions; we call them as available.

    // Valid condition combination
    const validSql = "SELECT * FROM employees WHERE department = 'HR' AND salary > 50000;";
    const parseResult = await page.evaluate((sql) => {
      return parseQuery(sql);
    }, validSql);
    expect(Array.isArray(parseResult)).toBeTruthy();
    expect(parseResult.length).toBeGreaterThanOrEqual(1);
    expect(parseResult[0]).toHaveProperty('col');

    // Unsupported condition type should return null (e.g., LIKE or OR)
    const invalidSql = "SELECT * FROM employees WHERE department LIKE '%Sales%';";
    const parseResultInvalid = await page.evaluate((sql) => {
      return parseQuery(sql);
    }, invalidSql);
    expect(parseResultInvalid).toBeNull();

    // No WHERE clause returns null per implementation (FSM indicates this as invalid)
    const noWhereSql = "SELECT * FROM employees;";
    const parseNoWhere = await page.evaluate((sql) => {
      return parseQuery(sql);
    }, noWhereSql);
    expect(parseNoWhere).toBeNull();

    // Ensure no runtime page errors occurred during calling parseQuery
    const consoleErrors3 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Edge case: large random query variations do not cause uncaught runtime errors', async ({ page }) => {
    // This test programmatically injects various query strings into the textarea and clicks Run,
    // observing that the page handles them either by executing or reporting invalid query without throwing.

    const queries = [
      "SELECT * FROM employees WHERE department = 'Marketing' AND salary > 70000;",
      "  SELECT   *   FROM   employees   WHERE department = 'Engineering' AND salary > 90000;   ",
      "SELECT * FROM employees WHERE id = '10';", // valid equality on id (string mismatch expected -> may return 0 rows)
      "SELECT * FROM employees WHERE unknowncol = 'X';", // unsupported column -> parse returns {col:'unknowncol'} but runtime comparisons may produce 0 rows
      "Malformed SQL WITHOUT semicolon WHERE 1=1", // clearly malformed -> parseQuery should return null
    ];

    for (const q of queries) {
      await page.fill('#queryInput', q);
      await page.click('#runBtn');
      // Small wait for DOM update
      await page.waitForTimeout(30);
      // We accept either an error message or a results table, but there must be no uncaught exceptions
      const consoleErrors4 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    }
  });
});