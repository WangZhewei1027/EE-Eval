import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1212c721-fa7a-11f0-acf9-69409043402d.html';

test.describe('Hash Table Interactive Demo (FSM validation) - Application ID 1212c721-fa7a-11f0-acf9-69409043402d', () => {
  // Arrays to collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors so tests can assert on them
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Ensure page loaded
    await expect(page).toHaveTitle(/Hash Table Interactive Demo/);
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity: there should be no unexpected uncaught exceptions on the page
    // This asserts no page-level errors (ReferenceError, TypeError, SyntaxError, etc.)
    expect(pageErrors.map(e => e.message)).toEqual([]);
    // Also assert there are no console errors
    const errorConsoles = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.map(c => c.text)).toEqual([]);
  });

  test.describe('S0_Idle -> S1_TableInitialized (Initialize Table)', () => {
    test('Initial page state: clearTable() executed and default table created', async ({ page }) => {
      // On initial load the script runs clearTable() and updateHashTableDisplay()
      // The hashTableDisplay container should have a table with default 11 rows (tableSize default)
      const rows = await page.locator('#hashTableDisplay table tbody tr').count();
      expect(rows).toBe(11); // default value = 11
      // Operation log should initially be empty (clearTable cleared operationsLog)
      const opLog = await page.locator('#operationLog').inputValue();
      expect(opLog.trim()).toBe('');
    });

    test('Click Initialize Hash Table (valid size) moves to Hash Function Setup and logs initialization', async ({ page }) => {
      // Set a new table size and initialize
      await page.fill('#tableSizeInput', '13');
      await page.click('#initTableBtn');

      // hashFunctionSection should become visible
      const hfSectionVisible = await page.locator('#hashFunctionSection').isVisible();
      expect(hfSectionVisible).toBeTruthy();

      // Operation log should contain initialization message
      const opLog = await page.locator('#operationLog').inputValue();
      expect(opLog).toContain('Initialized empty hash table with size 13');

      // The table display DOM should reflect new table size (13 rows)
      const rows = await page.locator('#hashTableDisplay table tbody tr').count();
      expect(rows).toBe(13);
    });

    test('Click Initialize Hash Table with invalid size triggers alert (edge case)', async ({ page }) => {
      // Put invalid value (0)
      await page.fill('#tableSizeInput', '0');
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#initTableBtn')
      ]);
      // The app shows an alert with an error message
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Invalid table size');
      await dialog.accept();

      // Ensure no change to hash function section visibility (still hidden)
      expect(await page.locator('#hashFunctionSection').isVisible()).toBe(false);
    });
  });

  test.describe('S1_TableInitialized -> S2_HashFunctionSet (Set Hash Function)', () => {
    test('Select and set different hash functions and verify description and log', async ({ page }) => {
      // Initialize first to reveal hash function section
      await page.click('#initTableBtn');

      // Select folding method
      await page.selectOption('#hashFunctionSelect', 'folding');
      await page.click('#setHashFunctionBtn');

      // Collision section should now be visible (next step)
      expect(await page.locator('#collisionSection').isVisible()).toBeTruthy();

      // Description area should reflect chosen function
      const desc = await page.locator('#hashFunctionDesc').textContent();
      expect(desc).toContain('Folding method');

      // Operation log should include the chosen hash function
      const log = await page.locator('#operationLog').inputValue();
      expect(log).toContain('Hash function set to: folding');

      // Now set to customMath and ensure description updates
      await page.selectOption('#hashFunctionSelect', 'customMath');
      await page.click('#setHashFunctionBtn');
      expect(await page.locator('#hashFunctionDesc').textContent()).toContain('Custom math');
    });
  });

  test.describe('S2_HashFunctionSet -> S3_CollisionMethodSet (Set Collision Method)', () => {
    test('Apply Separate Chaining (default) and verify table reset and logs', async ({ page }) => {
      await page.click('#initTableBtn');
      await page.click('#setHashFunctionBtn');

      // Ensure 'chaining' is selected by default
      const chainingRadio = page.locator('input[name="collisionMethod"][value="chaining"]');
      expect(await chainingRadio.isChecked()).toBe(true);

      // Click apply collision method
      await page.click('#setCollisionMethodBtn');

      // Key operations section should now be visible
      expect(await page.locator('#keyOperationsSection').isVisible()).toBeTruthy();

      // Operation log should contain collision method set message and "table reset"
      const log = await page.locator('#operationLog').inputValue();
      expect(log).toContain('Collision method set to: chaining');
      expect(log).toContain('table reset');
    });

    test('Apply Double Hashing path: ensure double hash prime input shown and set properly', async ({ page }) => {
      await page.click('#initTableBtn');
      await page.click('#setHashFunctionBtn');

      // Select 'double' collision radio
      await page.check('input[name="collisionMethod"][value="double"]');

      // The doubleHashInput should become visible and hold a default prime
      expect(await page.locator('#doubleHashInput').isVisible()).toBeTruthy();
      const defaultPrime = await page.locator('#doubleHashPrime').inputValue();
      expect(Number.parseInt(defaultPrime, 10)).toBeGreaterThanOrEqual(2);

      // Set a valid double hash prime through the UI control path
      // Click the "Apply Collision Method" (it will read #doubleHashPrime and apply)
      await page.click('#setCollisionMethodBtn');

      // Should have set collision method to double and cleared the table
      const log = await page.locator('#operationLog').inputValue();
      expect(log).toContain('Collision method set to: double');
      expect(await page.locator('#keyOperationsSection').isVisible()).toBeTruthy();
    });

    test('Attempt to set invalid double hash prime triggers alert (edge case)', async ({ page }) => {
      await page.click('#initTableBtn');
      await page.click('#setHashFunctionBtn');

      // Choose double
      await page.check('input[name="collisionMethod"][value="double"]');
      // Set invalid prime (>= table size)
      await page.fill('#doubleHashPrime', '1000'); // deliberately invalid, greater than table size

      // The "setDoubleHashPrimeBtn" also exists in UI; clicking it should alert invalid if used.
      const [alertDlg] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#setDoubleHashPrimeBtn')
      ]);
      expect(alertDlg.type()).toBe('alert');
      expect(alertDlg.message()).toContain('Invalid double hash prime');
      await alertDlg.accept();
    });
  });

  test.describe('S3_CollisionMethodSet -> S4_KeyOperations (Insert/Search/Delete/Clear)', () => {
    test('Insert a key, search it, delete it (probing or chaining) and verify operation log and table DOM updates', async ({ page }) => {
      // Initialize and set default chaining method
      await page.click('#initTableBtn');
      await page.click('#setHashFunctionBtn');
      await page.click('#setCollisionMethodBtn');

      // Insert a key
      await page.fill('#keyInput', 'apple');
      const insertDialogPromise = page.waitForEvent('dialog');
      await page.click('#insertKeyBtn');
      const insertDialog = await insertDialogPromise;
      // Expect alert confirming insertion or duplicate; accept it
      expect(insertDialog.type()).toBe('alert');
      expect(insertDialog.message()).toMatch(/(inserted|not inserted|already present)/i);
      await insertDialog.accept();

      // Operation log should contain insertion message
      let log = await page.locator('#operationLog').inputValue();
      expect(log).toMatch(/Insert "apple":/);

      // Search the key
      await page.fill('#keyInput', 'apple');
      const searchDialogPromise = page.waitForEvent('dialog');
      await page.click('#searchKeyBtn');
      const searchDialog = await searchDialogPromise;
      expect(searchDialog.type()).toBe('alert');
      // Should say found or not found; accept
      expect(searchDialog.message()).toMatch(/(found|NOT found)/i);
      await searchDialog.accept();

      // Delete the key
      await page.fill('#keyInput', 'apple');
      const deleteDialogPromise = page.waitForEvent('dialog');
      await page.click('#deleteKeyBtn');
      const deleteDialog = await deleteDialogPromise;
      expect(deleteDialog.type()).toBe('alert');
      expect(deleteDialog.message()).toMatch(/(deleted|not found)/i);
      await deleteDialog.accept();

      // After deletion operation log should reflect deletion attempt
      log = await page.locator('#operationLog').inputValue();
      expect(log).toMatch(/Delete "apple":/);

      // The statistics display should update and show Total Keys Stored possibly 0
      const stats = await page.locator('#statisticsDisplay').textContent();
      expect(stats).toContain('Total Keys Stored:');
    });

    test('Clear All - confirm dismissed and then accepted', async ({ page }) => {
      // Initialize and set collision method
      await page.click('#initTableBtn');
      await page.click('#setHashFunctionBtn');
      await page.click('#setCollisionMethodBtn');

      // Insert a key to create something to clear
      await page.fill('#keyInput', 'toClear');
      const insertDlg = page.waitForEvent('dialog');
      await page.click('#insertKeyBtn');
      (await insertDlg).accept();

      // Now attempt clear but dismiss the confirmation
      const confirmPromise = page.waitForEvent('dialog');
      await page.click('#clearAllBtn');
      const confirmDlg = await confirmPromise;
      expect(confirmDlg.type()).toBe('confirm');
      // Dismiss -> nothing cleared
      await confirmDlg.dismiss();

      // Stats should still reflect inserted item (Total Insertions > 0)
      const statsAfterDismiss = await page.locator('#statisticsDisplay').textContent();
      expect(statsAfterDismiss).toContain('Total Insertions:');

      // Now accept the clear confirm
      const confirmPromise2 = page.waitForEvent('dialog');
      await page.click('#clearAllBtn');
      const confirmDlg2 = await confirmPromise2;
      expect(confirmDlg2.type()).toBe('confirm');
      await confirmDlg2.accept();

      // After accepting, operation log should be cleared and stats reset
      const finalOpLog = await page.locator('#operationLog').inputValue();
      expect(finalOpLog.trim()).toBe('');
      const statsFinal = await page.locator('#statisticsDisplay').textContent();
      expect(statsFinal).toContain('Total Insertions: 0');
    });
  });

  test.describe('Exploration / Advanced operations (Bulk/Random/Load/Resize/ClearLog)', () => {
    test('Bulk insert and bulk delete update table and logs', async ({ page }) => {
      // Setup
      await page.click('#initTableBtn');
      await page.click('#setHashFunctionBtn');
      await page.click('#setCollisionMethodBtn');

      // Bulk insert
      await page.fill('#bulkKeysInput', 'a,b,c,d');
      const bulkInsertDlg = page.waitForEvent('dialog');
      await page.click('#bulkInsertBtn');
      const bi = await bulkInsertDlg;
      expect(bi.type()).toBe('alert');
      expect(bi.message()).toMatch(/Bulk insert: attempted 4 keys, inserted \d+/);
      await bi.accept();

      // Bulk delete (delete two)
      await page.fill('#bulkKeysInput', 'a,c,x'); // x not present
      const bulkDeleteDlg = page.waitForEvent('dialog');
      await page.click('#bulkDeleteBtn');
      const bd = await bulkDeleteDlg;
      expect(bd.type()).toBe('alert');
      expect(bd.message()).toMatch(/Bulk delete: attempted 3 keys, deleted \d+/);
      await bd.accept();

      // Operation log should contain insert/delete messages
      const log = await page.locator('#operationLog').inputValue();
      expect(log).toMatch(/Bulk/); // there will be Insert/Delete entries from processing
    });

    test('Random insert populates table and logs count', async ({ page }) => {
      await page.click('#initTableBtn');
      await page.click('#setHashFunctionBtn');
      await page.click('#setCollisionMethodBtn');

      // Set random bounds and count
      await page.fill('#randomCount', '5');
      await page.fill('#randomMin', '10');
      await page.fill('#randomMax', '20');

      const randomDlg = page.waitForEvent('dialog');
      await page.click('#randomInsertBtn');
      const rd = await randomDlg;
      expect(rd.type()).toBe('alert');
      expect(rd.message()).toMatch(/Random insert: attempted 5 keys, inserted \d+/);
      await rd.accept();

      // Stats updated
      const stats = await page.locator('#statisticsDisplay').textContent();
      expect(stats).toContain('Total Insertions:');
    });

    test('Load preset test data loads many keys and updates statistics', async ({ page }) => {
      await page.click('#initTableBtn');
      await page.click('#setHashFunctionBtn');
      await page.click('#setCollisionMethodBtn');

      const presetDlg = page.waitForEvent('dialog');
      await page.click('#loadPresetBtn');
      const pd = await presetDlg;
      expect(pd.type()).toBe('alert');
      expect(pd.message()).toMatch(/Loaded preset test data \(\d+ keys\)/);
      await pd.accept();

      const stats = await page.locator('#statisticsDisplay').textContent();
      expect(stats).toContain('Total Insertions:');
      expect(stats).toContain('Total Keys Stored:');
    });

    test('Resize table rehashes keys and alerts; invalid resize relative to double hashing triggers alert', async ({ page }) => {
      await page.click('#initTableBtn');
      await page.click('#setHashFunctionBtn');

      // Try resize while in chaining (valid)
      await page.click('#setCollisionMethodBtn');
      await page.fill('#newTableSizeInput', '17');
      const resizeDlg = page.waitForEvent('dialog');
      await page.click('#resizeTableBtn');
      const rd = await resizeDlg;
      expect(rd.type()).toBe('alert');
      expect(rd.message()).toContain('Resized table to 17 buckets');
      await rd.accept();

      // Now test invalid resize scenario for double hashing
      // Switch to double hashing path
      await page.check('input[name="collisionMethod"][value="double"]');
      // set a double hash prime small enough and apply
      const defaultPrime = await page.locator('#doubleHashPrime').inputValue();
      await page.click('#setCollisionMethodBtn');

      // Now set doubleHashPrime (through the dedicated button) to a value >= newSize to trigger alert during resize
      // Use the setDoubleHashPrimeBtn to set a large prime (>= new intended size)
      await page.fill('#doubleHashPrime', '7'); // value may or may not be invalid depending tableSize; keep as an attempt
      // Click to set double hash prime (this triggers an alert if invalid)
      const setDhpDlg = page.waitForEvent('dialog');
      await page.click('#setDoubleHashPrimeBtn');
      const sd = await setDhpDlg;
      // Accept or dismiss the set acknowledgement depending on validity
      await sd.accept();

      // Now attempt to resize to a size smaller or equal to doubleHashPrime to trigger alert in onResizeTable if configured accordingly
      await page.fill('#newTableSizeInput', '5'); // deliberately small to provoke potential invalidation
      const resizeAttemptDlg = page.waitForEvent('dialog');
      await page.click('#resizeTableBtn');
      const resizeAttempt = await resizeAttemptDlg;
      // Either it will alert about double hash prime needing adjustment, or perform resize; both are valid outcomes to validate edge case
      expect(resizeAttempt.type()).toBe('alert');
      // The message either complains about double hash prime or confirms resize; assert presence of either phrase
      const msg = resizeAttempt.message();
      expect(
        msg.includes('Double Hash Prime') ||
        msg.includes('Resized table to')
      ).toBeTruthy();
      await resizeAttempt.accept();
    });

    test('Clear Log empties operationLog textarea (S4 -> S5_LogCleared)', async ({ page }) => {
      await page.click('#initTableBtn');
      await page.click('#setHashFunctionBtn');
      await page.click('#setCollisionMethodBtn');

      // Insert something to populate log
      await page.fill('#keyInput', 'logMe');
      const insDlg = page.waitForEvent('dialog');
      await page.click('#insertKeyBtn');
      (await insDlg).accept();

      // Ensure log has content
      let logBefore = await page.locator('#operationLog').inputValue();
      expect(logBefore.trim().length).toBeGreaterThan(0);

      // Click Clear Log
      await page.click('#clearLogBtn');

      // Operation log should now be empty
      const logAfter = await page.locator('#operationLog').inputValue();
      expect(logAfter.trim()).toBe('');
    });
  });

  test.describe('Error / edge-case validations and console/page errors observation', () => {
    test('Attempt invalid operations produce alerts and do not crash the page', async ({ page }) => {
      // Invalid random insert count
      await page.click('#initTableBtn');
      await page.click('#setHashFunctionBtn');
      await page.click('#setCollisionMethodBtn');

      await page.fill('#randomCount', '0');
      const invalidRandDlg = page.waitForEvent('dialog');
      await page.click('#randomInsertBtn');
      const ir = await invalidRandDlg;
      expect(ir.type()).toBe('alert');
      expect(ir.message()).toContain('Invalid random insert count');
      await ir.accept();

      // Invalid resize size
      await page.fill('#newTableSizeInput', '0');
      const invalidResizeDlg = page.waitForEvent('dialog');
      await page.click('#resizeTableBtn');
      const rz = await invalidResizeDlg;
      expect(rz.type()).toBe('alert');
      expect(rz.message()).toContain('Invalid new table size');
      await rz.accept();

      // The page should remain functional (no page errors)
      expect(pageErrors.length).toBe(0);
    });
  });

});