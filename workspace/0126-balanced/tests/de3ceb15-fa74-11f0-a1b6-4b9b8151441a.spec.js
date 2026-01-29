import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3ceb15-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('NoSQL Demo (IndexedDB) - FSM states and transitions', () => {
  // Arrays to capture console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture browser console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure the page has rendered initial output placeholder
    await expect(page.locator('#output')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // For debugging during test runs, ensure we have no unexpected page errors.
    // We assert this explicitly in tests, but also guard here so test logs remain useful.
    // (No teardown actions necessary beyond Playwright defaults.)
  });

  test('Initial UI renders correctly (S0_Idle) and buttons exist', async ({ page }) => {
    // This test validates the Idle state: all buttons are present and the output placeholder is rendered.
    // Check presence of each expected button from the FSM evidence.
    const selectors = [
      '#initDb',
      '#addData',
      '#getAll',
      '#queryData',
      '#updateData',
      '#deleteData',
      '#clearDb'
    ];

    for (const sel of selectors) {
      await expect(page.locator(sel)).toBeVisible();
      await expect(page.locator(sel)).toHaveAttribute('id', sel.replace('#', ''));
    }

    // Verify initial output content (renderPage entry action equivalent)
    const output = page.locator('#output');
    await expect(output).toContainText('Database operations will be shown here');

    // Ensure no uncaught page errors just after load
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: invoking actions before initializing DB should log "Database not initialized!"', async ({ page }) => {
    // Clicking each actionable button before the DB is initialized should produce "Database not initialized!" messages.
    // We will click several buttons and assert the message appears in the output.
    const preInitButtons = ['#addData', '#getAll', '#queryData', '#updateData', '#deleteData', '#clearDb'];

    for (const btn of preInitButtons) {
      await page.click(btn);
    }

    // Wait for the app to append messages
    await page.waitForFunction(() => {
      const out = document.getElementById('output');
      return out && out.innerText.includes('Database not initialized!');
    });

    // Assert the output contains at least one "Database not initialized!" message
    const outputText = await page.locator('#output').innerText();
    expect(outputText).toContain('Database not initialized!');

    // Confirm that no uncaught page errors were raised by these actions
    expect(pageErrors.length).toBe(0);

    // Also capture that console did not log error-level messages (application uses DOM logs, console should be minimal)
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Full FSM flow: Initialize DB -> Add Data -> Get All -> Query -> Update -> Delete -> Clear', async ({ page }) => {
    // This test performs the full sequence of transitions described in the FSM in order,
    // asserting expected textual evidence appears in the DOM (#output) for each state.

    const outputLocator = page.locator('#output');

    // 1) Initialize Database (S0_Idle -> S1_DatabaseInitialized)
    // Clicking initDb should create the DB (onupgradeneeded) and then open it (onsuccess).
    await page.click('#initDb');

    // Wait for "Database created with object store and indexes" OR "Database opened successfully!" to appear.
    // The upgrade log may appear first; wait for opened message which is the key evidence for S1.
    await page.waitForFunction(() => {
      const out1 = document.getElementById('output');
      return out && out.innerText.includes('Database opened successfully!');
    }, { timeout: 5000 });

    // Verify the output contains the expected evidence strings for initialization
    let outputText1 = await outputLocator.innerText();
    expect(outputText).toContain('Database opened successfully!');
    // upgrade message is optional depending on whether DB existed; if present assert it too (non-blocking)
    if (outputText.includes('Database created with object store and indexes')) {
      expect(outputText).toContain('Database created with object store and indexes');
    }

    expect(pageErrors.length).toBe(0); // no uncaught errors at this point

    // 2) Add Sample Data (S1 -> S2_DataAdded)
    await page.click('#addData');

    // After adding, the transaction.oncomplete should log "All users added successfully!"
    await page.waitForFunction(() => {
      const out2 = document.getElementById('output');
      return out && out.innerText.includes('All users added successfully!');
    }, { timeout: 5000 });

    outputText = await outputLocator.innerText();
    // Check for evidence that at least Alice was added
    expect(outputText).toContain('All users added successfully!');
    expect(outputText).toMatch(/Added user: Alice/);

    // 3) Get All Users (S1 -> S3_UsersFetched)
    await page.click('#getAll');

    // getAllUsers clears the log and then logs "<h3>All Users:</h3>" and then records with class "record"
    await page.waitForFunction(() => {
      const out3 = document.getElementById('output');
      return out && out.innerHTML.includes('All Users:') && document.querySelectorAll('.record').length > 0;
    }, { timeout: 5000 });

    // Validate DOM includes record elements and user names
    outputText = await outputLocator.innerText();
    expect(outputText).toContain('All Users:');
    // Expect at least Alice, Bob, Charlie or Diana to be present in the rendered records
    expect(outputText).toMatch(/Alice|Bob|Charlie|Diana/);

    // 4) Query Users older than 25 (S1 -> S4_UsersQueried)
    await page.click('#queryData');

    // queryUsers clears and then logs "Users Older Than 25:"
    await page.waitForFunction(() => {
      const out4 = document.getElementById('output');
      return out && out.innerText.includes('Users Older Than 25:');
    }, { timeout: 5000 });

    outputText = await outputLocator.innerText();
    expect(outputText).toContain('Users Older Than 25:');
    // Alice (28), Bob (32), Diana (35) should appear; Charlie (24) should NOT appear
    expect(outputText).toMatch(/Alice/);
    expect(outputText).toMatch(/Bob/);
    expect(outputText).toMatch(/Diana/);
    expect(outputText).not.toMatch(/Charlie/);

    // 5) Update a User (Bob) (S1 -> S5_UserUpdated)
    await page.click('#updateData');

    // updateUser clears log and then logs updating message followed by "User updated successfully!"
    await page.waitForFunction(() => {
      const out5 = document.getElementById('output');
      return out && out.innerText.includes('User updated successfully!');
    }, { timeout: 5000 });

    outputText = await outputLocator.innerText();
    expect(outputText).toContain("User updated successfully!");
    // The update function logs a line "Updating Bob's age from X to 33..." - we assert that phrase exists
    expect(outputText).toMatch(/Updating Bob's age from/);

    // Validate that Bob's age was updated by fetching all users again and checking his age is 33
    await page.click('#getAll');
    await page.waitForFunction(() => {
      const out6 = document.getElementById('output');
      return out && out.innerText.includes('All Users:') && out.innerText.includes('Bob');
    }, { timeout: 5000 });

    outputText = await outputLocator.innerText();
    // Expect Bob and the updated age 33 to appear in the record text
    expect(outputText).toMatch(/Bob/);
    expect(outputText).toMatch(/33/);

    // 6) Delete a User (Alice) (S1 -> S6_UserDeleted)
    await page.click('#deleteData');

    // deleteUser clears log and then logs "User Alice deleted successfully!" upon success
    await page.waitForFunction(() => {
      const out7 = document.getElementById('output');
      return out && out.innerText.includes('User Alice deleted successfully!');
    }, { timeout: 5000 });

    outputText = await outputLocator.innerText();
    expect(outputText).toContain('User Alice deleted successfully!');

    // Confirm Alice is no longer present by fetching all users
    await page.click('#getAll');
    await page.waitForFunction(() => {
      const out8 = document.getElementById('output');
      return out && out.innerText.includes('All Users:');
    }, { timeout: 5000 });

    outputText = await outputLocator.innerText();
    expect(outputText).not.toMatch(/Alice/);

    // 7) Clear Database (S1 -> S7_DatabaseCleared)
    await page.click('#clearDb');

    // clearDB clears and then logs "Database cleared successfully!"
    await page.waitForFunction(() => {
      const out9 = document.getElementById('output');
      return out && out.innerText.includes('Database cleared successfully!');
    }, { timeout: 5000 });

    outputText = await outputLocator.innerText();
    expect(outputText).toContain('Database cleared successfully!');

    // After clearing, getAllUsers should report "No users found in the database."
    await page.click('#getAll');
    await page.waitForFunction(() => {
      const out10 = document.getElementById('output');
      return out && out.innerText.includes('No users found in the database.');
    }, { timeout: 5000 });

    outputText = await outputLocator.innerText();
    expect(outputText).toContain('No users found in the database.');

    // Final sanity checks: no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Also check console did not record unexpected error-level logs during the full run
    const errorConsole1 = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // Warnings are acceptable but flag excessive errors; assert there are zero error types
    const onlyErrors = consoleMessages.filter(m => m.type === 'error');
    expect(onlyErrors.length).toBe(0);
  });

  test('Observes console output and page errors across interactions (assert captured messages)', async ({ page }) => {
    // This test intentionally observes console and pageerror events while performing a few actions
    // and asserts that our event listeners captured messages. It does not force errors to occur.
    // Initialize DB then add data (minimal checks) and assert that our console message capture arrays are in sync.

    await page.click('#initDb');
    await page.waitForFunction(() => {
      const out11 = document.getElementById('output');
      return out && out.innerText.includes('Database opened successfully!');
    }, { timeout: 5000 });

    await page.click('#addData');
    await page.waitForFunction(() => {
      const out12 = document.getElementById('output');
      return out && out.innerText.includes('All users added successfully!');
    }, { timeout: 5000 });

    // We expect our consoleMessages array to have captured at least the default console messages (could be zero)
    // and pageErrors to still be empty (no uncaught exceptions).
    // Assert we have captured something (even if zero) and that no pageErrors occurred
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(pageErrors.length).toBe(0);

    // Ensure that the DOM output includes expected evidence messages captured earlier
    const outputText2 = await page.locator('#output').innerText();
    expect(outputText).toContain('Database opened successfully!');
    expect(outputText).toContain('All users added successfully!');
  });
});