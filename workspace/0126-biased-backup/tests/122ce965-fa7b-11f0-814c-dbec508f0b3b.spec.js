import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122ce965-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('SQL Interactive Demo (Application ID: 122ce965-fa7b-11f0-814c-dbec508f0b3b)', () => {
  // Collect console messages and page errors for assertions in each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case msg.text() or msg.type() throw unexpectedly, record a placeholder
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
    // Ensure the page loaded and basic elements are present
    await expect(page.locator('#sql-input')).toBeVisible();
    await expect(page.locator('#sql-output')).toBeVisible();
    await expect(page.locator('#run-button')).toBeVisible();
  });

  test.afterEach(async () => {
    // Basic invariant: tests should not leave unexpected page errors
    // If any page errors occurred during the test, fail with the collected messages for easier debugging
    if (pageErrors.length > 0) {
      throw new Error(`Page errors were observed during the test run:\n- ${pageErrors.join('\n- ')}`);
    }
  });

  test('Idle State on load: textareas exist, readonly, and empty (S0_Idle)', async ({ page }) => {
    // Validate evidence for S0_Idle: both textareas are readonly and empty
    const sqlInput = page.locator('#sql-input');
    const sqlOutput = page.locator('#sql-output');

    await expect(sqlInput).toHaveAttribute('readonly', '');
    await expect(sqlOutput).toHaveAttribute('readonly', '');

    // Both should be empty on initial render
    await expect(sqlInput).toHaveValue('');
    await expect(sqlOutput).toHaveValue('');
  });

  test('Run with empty input shows an alert and stays in Idle (RunQuery from S0_Idle)', async ({ page }) => {
    // Clicking Run when sql-input is empty should trigger an alert with message 'Please enter a query'
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.click('#run-button');

    // Ensure the alert dialog appeared with the expected message
    expect(dialogMessage).toBe('Please enter a query');

    // State should still be idle: both textareas empty
    await expect(page.locator('#sql-input')).toHaveValue('');
    await expect(page.locator('#sql-output')).toHaveValue('');
  });

  test('Debug button logs "Debug output" to console (DebugOutput event)', async ({ page }) => {
    // Click debug and confirm console message captured
    await page.click('#debug-button');

    // Wait a tiny bit for console message to be processed
    await page.waitForTimeout(100);

    const debugMessages = consoleMessages.filter(m => m.text === 'Debug output');
    expect(debugMessages.length).toBeGreaterThanOrEqual(1);
    // Confirm the console message type is 'log' (standard for console.log)
    expect(debugMessages[0].type).toBe('log');
  });

  test('Entering a query and running it displays output (S1_QueryEntered -> S2_OutputDisplayed)', async ({ page }) => {
    // Simulate entering a query into the readonly textarea by setting its value via JS.
    // This simulates the presence of a query (S1_QueryEntered evidence).
    await page.evaluate(() => {
      const el = document.getElementById('sql-input');
      if (el) el.value = 'SELECT 1';
    });

    // Intercept the network call to /query to return a deterministic response.
    await page.route('**/query', route => {
      // ensure it's a POST as expected by the app
      const request = route.request();
      if (request.method().toUpperCase() === 'POST') {
        route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
          body: 'RESULT: 1'
        });
      } else {
        route.fallback();
      }
    });

    // Click run to trigger executeQuery
    await page.click('#run-button');

    // Expect the sql-output to eventually contain the returned text
    const sqlOutput = page.locator('#sql-output');
    await expect(sqlOutput).toHaveValue('RESULT: 1');
  });

  test('Edit button clears output and preserves input when a query exists (EditQuery event)', async ({ page }) => {
    // Put a query and a non-empty output, then click Edit
    await page.evaluate(() => {
      document.getElementById('sql-input').value = 'SELECT 2';
      document.getElementById('sql-output').value = 'previous output';
    });

    // Click Edit
    await page.click('#edit-button');

    // After Edit: sqlInput should still contain the query, sqlOutput should be cleared
    await expect(page.locator('#sql-input')).toHaveValue('SELECT 2');
    await expect(page.locator('#sql-output')).toHaveValue('');
  });

  test('History button copies the current input to output (ViewHistory event)', async ({ page }) => {
    // Set a query in input
    await page.evaluate(() => {
      document.getElementById('sql-input').value = 'SELECT history_col';
      document.getElementById('sql-output').value = '';
    });

    // Click History to copy input to output
    await page.click('#history-button');

    // Output should now equal the input
    await expect(page.locator('#sql-output')).toHaveValue('SELECT history_col');
  });

  test('Clear button resets both input and output to empty (ClearInputs event)', async ({ page }) => {
    // Pre-fill both fields
    await page.evaluate(() => {
      document.getElementById('sql-input').value = 'SELECT to_clear';
      document.getElementById('sql-output').value = 'TO_BE_CLEARED';
    });

    // Click Clear
    await page.click('#clear-button');

    // Both should be empty and state should be back to Idle-like
    await expect(page.locator('#sql-input')).toHaveValue('');
    await expect(page.locator('#sql-output')).toHaveValue('');
  });

  test('Whitespace-only input triggers "Please enter a query" alert (edge case)', async ({ page }) => {
    // Set input to whitespace only
    await page.evaluate(() => {
      document.getElementById('sql-input').value = '   \n\t  ';
    });

    // Clicking Run should trim and treat as empty -> alert
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.click('#run-button');
    expect(dialogMessage).toBe('Please enter a query');

    // Output should remain empty
    await expect(page.locator('#sql-output')).toHaveValue('');
  });

  test('Network failure during executeQuery sets sqlOutput to an Error message (error scenario)', async ({ page }) => {
    // Set a valid query
    await page.evaluate(() => {
      document.getElementById('sql-input').value = 'SELECT fail_network';
      document.getElementById('sql-output').value = '';
    });

    // Simulate a network failure by aborting the request
    await page.route('**/query', route => route.abort());

    // Click run to trigger executeQuery which will reject and be caught
    await page.click('#run-button');

    // The code in executeQuery catches the error and sets sqlOutput.value = `Error: ${error}`
    const sqlOutput = page.locator('#sql-output');

    // Wait for the output to show an Error: prefix
    await expect.poll(async () => {
      return await sqlOutput.inputValue();
    }).toContain('Error:');

    // Ensure some error text exists after the prefix
    const outputValue = await sqlOutput.inputValue();
    expect(outputValue.length).toBeGreaterThan('Error:'.length);
  });

  test('Successful run followed by Edit then Clear covers multi-step transitions', async ({ page }) => {
    // Prepare deterministic network response for successful run
    await page.route('**/query', route => {
      const request = route.request();
      if (request.method().toUpperCase() === 'POST') {
        route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
          body: 'OK MULTISTEP'
        });
      } else {
        route.fallback();
      }
    });

    // Set a query
    await page.evaluate(() => {
      document.getElementById('sql-input').value = 'SELECT multi';
      document.getElementById('sql-output').value = '';
    });

    // Run -> should set output to OK MULTISTEP
    await page.click('#run-button');
    await expect(page.locator('#sql-output')).toHaveValue('OK MULTISTEP');

    // Now edit -> should preserve input and clear output
    await page.click('#edit-button');
    await expect(page.locator('#sql-input')).toHaveValue('SELECT multi');
    await expect(page.locator('#sql-output')).toHaveValue('');

    // Now clear -> back to idle: both empty
    await page.click('#clear-button');
    await expect(page.locator('#sql-input')).toHaveValue('');
    await expect(page.locator('#sql-output')).toHaveValue('');
  });

  test('Observe console and page errors while interacting with the app (observability)', async ({ page }) => {
    // This test demonstrates listening to console and page errors across a sequence of actions

    // Clear any previous console messages recorded early in beforeEach
    consoleMessages = [];

    // Click debug to generate a console.log
    await page.click('#debug-button');

    // Set a query and provoke a network abort to create an "Error:" output
    await page.evaluate(() => {
      document.getElementById('sql-input').value = 'SELECT obs';
    });
    await page.route('**/query', route => route.abort());
    await page.click('#run-button');

    // Wait a little for handlers to execute
    await page.waitForTimeout(200);

    // Assert that debug console log was captured
    const debugLog = consoleMessages.find(m => m.text === 'Debug output');
    expect(debugLog).toBeTruthy();

    // Assert no unhandled page errors were captured; afterEach will also enforce this.
    expect(Array.isArray(pageErrors) && pageErrors.length).toBe(0);

    // Assert sqlOutput shows "Error:" indicating the code handled the network failure and set the output
    await expect(page.locator('#sql-output')).toHaveValue( value => value.startsWith('Error:') );
  });
});