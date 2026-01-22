import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17633f30-d5c1-11f0-938c-19d14b60ef51.html';

test.describe('Adjacency Matrix Demonstration - FSM tests (Application ID: 17633f30-d5c1-11f0-938c-19d14b60ef51)', () => {
  // Containers to collect runtime diagnostics for each test
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    pageErrors = [];
    consoleMessages = [];

    // Collect pageerror events (uncaught exceptions)
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });

    // Collect console messages (including console.error)
    page.on('console', (msg) => {
      consoleMessages.push(msg);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No teardown needed beyond Playwright fixtures; collectors will be reset in beforeEach
  });

  // Helper to compute expected iteration count used by the page's for-loops:
  // The page uses: for (let i = 0; i < numNodes; i++) { ... }
  // where numNodes comes from an input.value (string). When converted to a Number N,
  // the loop will run for i = 0..floor(N) if N is integer, but for fractional
  // values the loop runs while i < N, thus number of iterations == Math.ceil(N) for N>0.
  const expectedIterations = (rawValue) => {
    const n = Number(rawValue);
    if (Number.isNaN(n) || n <= 0) return Math.max(0, Math.ceil(n)); // for negative/NaN treat via ceil
    return Math.ceil(n);
  };

  test('S0_Idle: Initial render shows input, default value, button and empty matrix', async ({ page }) => {
    // Validate initial controls presence and default value (FSM S0_Idle entry_actions: renderPage())
    const input = page.locator('#numNodes');
    const button = page.locator('button[onclick="generateMatrix()"]');
    const thead = page.locator('#adjMatrix thead');
    const tbody = page.locator('#adjMatrix tbody');

    // Ensure input and button are visible
    await expect(input).toBeVisible();
    await expect(button).toBeVisible();

    // Default value should be "3" as per HTML
    const value = await input.inputValue();
    expect(value).toBe('3');

    // The table should be empty initially (no header or body content)
    await expect(thead).toHaveJSProperty('innerHTML', '');
    await expect(tbody).toHaveJSProperty('innerHTML', '');

    // Assert there were no uncaught page errors or console.error messages during initial render
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition GenerateMatrix: Clicking Generate populates header and body for default value (S0 -> S1)', async ({ page }) => {
    // This test validates the FSM transition GenerateMatrix from S0_Idle to S1_MatrixGenerated.
    const input = page.locator('#numNodes');
    const button = page.locator('button[onclick="generateMatrix()"]');
    const theadTh = page.locator('#adjMatrix thead tr th');
    const tbodyRows = page.locator('#adjMatrix tbody tr');

    // Read current value and compute expectations
    const rawValue = await input.inputValue();
    const iterations = expectedIterations(rawValue);
    const expectedHeaderThCount = iterations + 1; // extra leading empty header cell

    // Perform the event (user clicks the button)
    await button.click();

    // Verify header cells count: one empty leading <th> plus one <th> per node index
    await expect(theadTh).toHaveCount(expectedHeaderThCount);

    // Verify tbody rows count equals iterations
    await expect(tbodyRows).toHaveCount(iterations);

    // For each row, ensure the number of <td> equals iterations and values are 0 or 1
    const rowCount = await tbodyRows.count();
    for (let r = 0; r < rowCount; r++) {
      const rowTds = page.locator(`#adjMatrix tbody tr:nth-child(${r + 1}) td`);
      await expect(rowTds).toHaveCount(iterations);
      const tdCount = await rowTds.count();
      for (let c = 0; c < tdCount; c++) {
        const text = await rowTds.nth(c).innerText();
        // Each cell should be either '0' or '1' as per implementation
        expect(['0', '1']).toContain(text.trim());
      }
    }

    // Confirm no runtime errors happened during matrix generation
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('GenerateMatrix with increased node count (5) produces 5x5 matrix', async ({ page }) => {
    // Test changing the input to a valid larger number and generating the matrix
    const input = page.locator('#numNodes');
    const button = page.locator('button[onclick="generateMatrix()"]');
    const theadTh = page.locator('#adjMatrix thead tr th');
    const tbodyRows = page.locator('#adjMatrix tbody tr');

    await input.fill('5');
    const iterations = expectedIterations('5'); // should be 5
    const expectedHeaderThCount = iterations + 1;

    await button.click();

    await expect(theadTh).toHaveCount(expectedHeaderThCount);
    await expect(tbodyRows).toHaveCount(iterations);

    // Verify cells contain only 0 or 1
    const allCells = page.locator('#adjMatrix tbody td');
    const totalCells = await allCells.count();
    expect(totalCells).toBe(iterations * iterations);
    for (let i = 0; i < totalCells; i++) {
      const text = await allCells.nth(i).innerText();
      expect(['0', '1']).toContain(text.trim());
    }

    // Confirm no runtime errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: numNodes set to 1 generates a 1x1 matrix', async ({ page }) => {
    // Validate minimal allowed node count behavior
    const input = page.locator('#numNodes');
    const button = page.locator('button[onclick="generateMatrix()"]');
    await input.fill('1');

    const iterations = expectedIterations('1'); // 1
    const expectedHeaderThCount = iterations + 1; // 2

    await button.click();

    await expect(page.locator('#adjMatrix thead tr th')).toHaveCount(expectedHeaderThCount);
    await expect(page.locator('#adjMatrix tbody tr')).toHaveCount(iterations);
    await expect(page.locator('#adjMatrix tbody tr td')).toHaveCount(iterations);

    // Confirm no runtime errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: numNodes set to 0 (below min) - implementation-specific behavior', async ({ page }) => {
    // The HTML input has min=1, but programmatically setting to 0 and clicking should be allowed.
    // The implementation will create a header with only the leading empty <th> and no body rows.
    const input = page.locator('#numNodes');
    const button = page.locator('button[onclick="generateMatrix()"]');

    await input.fill('0');
    const iterations = expectedIterations('0'); // 0
    const expectedHeaderThCount = iterations + 1; // 1

    await button.click();

    // Header should contain the single leading <th>
    await expect(page.locator('#adjMatrix thead tr th')).toHaveCount(expectedHeaderThCount);

    // No body rows expected
    await expect(page.locator('#adjMatrix tbody tr')).toHaveCount(0);

    // Confirm no runtime errors occurred as a result
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: fractional numNodes (e.g., 2.7) - loop behavior results in Math.ceil iterations', async ({ page }) => {
    // Validate how the implementation handles fractional values from the input.
    // The for-loop uses i < numNodes where numNodes is a string -> coerced to Number.
    // A fractional value e.g., 2.7 will result in iterations where i = 0,1,2 -> 3 iterations (Math.ceil).
    const input = page.locator('#numNodes');
    const button = page.locator('button[onclick="generateMatrix()"]');

    await input.fill('2.7');
    const iterations = expectedIterations('2.7'); // expected 3

    await button.click();

    await expect(page.locator('#adjMatrix tbody tr')).toHaveCount(iterations);
    await expect(page.locator('#adjMatrix thead tr th')).toHaveCount(iterations + 1);

    // Validate each cell is 0 or 1
    const allCells = page.locator('#adjMatrix tbody td');
    const totalCells = await allCells.count();
    expect(totalCells).toBe(iterations * iterations);
    for (let i = 0; i < totalCells; i++) {
      const text = await allCells.nth(i).innerText();
      expect(['0', '1']).toContain(text.trim());
    }

    // Confirm no runtime errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Diagnostic test: capture console messages and page errors during multiple GenerateMatrix clicks', async ({ page }) => {
    // This test intentionally triggers multiple matrix generations to observe any runtime errors over repeated transitions.
    const input = page.locator('#numNodes');
    const button = page.locator('button[onclick="generateMatrix()"]');

    // Try a few different values in sequence (simulate repeated user interactions)
    const testValues = ['3', '4', '2', '5'];
    for (const v of testValues) {
      await input.fill(v);
      await button.click();

      // quick sanity checks after each generation
      const iterations = expectedIterations(v);
      await expect(page.locator('#adjMatrix tbody tr')).toHaveCount(iterations);
      await expect(page.locator('#adjMatrix thead tr th')).toHaveCount(iterations + 1);
    }

    // After repeated actions, ensure no uncaught errors accumulated
    expect(pageErrors.length).toBe(0);

    // Also ensure there were no console.error messages
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);

    // Optionally, provide some assertions about presence of console messages (if any non-error messages exist)
    // We don't assert there are logs; we only assert there are no errors.
  });
});