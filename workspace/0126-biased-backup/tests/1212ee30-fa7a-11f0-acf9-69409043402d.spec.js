import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1212ee30-fa7a-11f0-acf9-69409043402d.html';

// Test suite for Interactive Hash Map Demonstration (Application ID: 1212ee30-fa7a-11f0-acf9-69409043402d)
// This file validates the FSM states, transitions, DOM updates, dialogs, logs, and edge cases described in the FSM.
// Notes:
// - We observe console messages and page errors and assert there are no unexpected uncaught exceptions.
// - Dialogs (alert/confirm) are handled via a configurable handler (accept vs dismiss) so tests can assert both flows.

test.describe('Interactive Hash Map Demonstration - FSM and UI tests', () => {
  // Shared variables for each test
  let consoleMessages;
  let pageErrors;
  let dialogMessages;
  // Controls whether to accept or dismiss the next dialogs (global)
  let dialogResponse; // 'accept' or 'dismiss'

  // Helper to initialize listeners for a page instance
  async function attachObservers(page) {
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];
    dialogResponse = 'accept';

    page.on('console', msg => {
      // capture console messages text for assertions
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    page.on('pageerror', err => {
      // capture uncaught exceptions / page errors
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Centralized dialog handler that uses dialogResponse to choose accept/dismiss.
    page.on('dialog', async dlg => {
      dialogMessages.push(dlg.message());
      if (dialogResponse === 'accept') {
        try { await dlg.accept(); } catch (e) { /* ignore if already handled */ }
      } else {
        try { await dlg.dismiss(); } catch (e) { /* ignore if already handled */ }
      }
    });
  }

  test.beforeEach(async ({ page }) => {
    // attach observers and load page
    await attachObservers(page);
    await page.goto(APP_URL);
    // ensure page loaded
    await expect(page.locator('#createMapBtn')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Basic check: no uncaught page errors
    expect(pageErrors, `Page errors detected: ${pageErrors.join(' | ')}`).toEqual([]);
    // Optionally log captured console messages length for debugging in test output
  });

  test('S0 Idle: initial page shows Create button and hides operations and state sections', async ({ page }) => {
    // Validate initial Idle state per FSM S0_Idle
    // - Create / Reset Hash Map button present
    // - operations-section and state-section are hidden (display:none)
    const createBtn = page.locator('#createMapBtn');
    await expect(createBtn).toBeVisible();

    const operationsSection = page.locator('#operations-section');
    const stateSection = page.locator('#state-section');

    await expect(operationsSection).toHaveCSS('display', 'none');
    await expect(stateSection).toHaveCSS('display', 'none');

    // No logs yet
    const logBox = page.locator('#log');
    await expect(logBox).toHaveText('');

    // No dialogs should have been shown
    expect(dialogMessages.length).toBe(0);
  });

  test('S0 -> S1 CreateMap: clicking Create creates map and shows operations & state (Configured)', async ({ page }) => {
    // Clicking create should call createNewHashMap and reveal operations and state (S1_Configured)
    dialogResponse = 'accept'; // default accept
    await page.click('#createMapBtn');

    // operations and state should be visible now
    const operationsSection = page.locator('#operations-section');
    const stateSection = page.locator('#state-section');
    await expect(operationsSection).toHaveCSS('display', 'block');
    await expect(stateSection).toHaveCSS('display', 'block');

    // Log should include creation message
    const logBox = page.locator('#log');
    await expect(logBox).toContainText('Hash map created');

    // internal map display and bucket list should be initialized
    const bucketSelect = page.locator('#bucketSelect');
    // initial default table size is 8 -> options count should be 8
    await expect(bucketSelect).toHaveCount(1); // the <select> element itself exists
    // Check that the number of <option> children equals 8
    const options = page.locator('#bucketSelect > option');
    await expect(options).toHaveCount(8);

    // No page errors
    expect(pageErrors).toEqual([]);
  });

  test('S1 -> S2 Insert/Update: insert new key, update it, and check displays and logs', async ({ page }) => {
    // Create map
    dialogResponse = 'accept';
    await page.click('#createMapBtn');

    // Insert "apple":"fruit"
    await page.fill('#opKey', 'apple');
    await page.fill('#opValue', 'fruit');
    await page.click('#insertBtn');

    // mapDisplay should contain the entry and Entries count:1
    const mapDisplay = page.locator('#mapDisplay');
    await expect(mapDisplay).toContainText('key: "apple"');
    await expect(mapDisplay).toContainText('Entries count: 1');

    // Log should mention insert
    const logBox = page.locator('#log');
    await expect(logBox).toContainText('Inserted key "apple"');

    // Update the same key with a new value and ensure count doesn't increase, value updates
    await page.fill('#opValue', 'pomme');
    await page.click('#insertBtn');

    await expect(mapDisplay).toContainText('value: "pomme"');
    // Count should still be 1
    await expect(mapDisplay).toContainText('Entries count: 1');

    // Log should mention Updated
    await expect(logBox).toContainText('Updated existing key "apple"');

    expect(pageErrors).toEqual([]);
  });

  test('S2 Search: search existing and non-existing keys triggers alerts with correct messages', async ({ page }) => {
    // Create and insert
    dialogResponse = 'accept';
    await page.click('#createMapBtn');
    await page.fill('#opKey', 'name');
    await page.fill('#opValue', 'chat');
    await page.click('#insertBtn');

    // Search existing key -> should show alert "found with value"
    dialogMessages = [];
    await page.fill('#opKey', 'name');
    await page.click('#searchBtn');
    // allow the dialog to be processed
    await page.waitForTimeout(50);
    expect(dialogMessages.some(m => m.includes('found with value') || m.includes('Found key'))).toBeTruthy();

    // Search non-existing key -> alert "not found"
    dialogMessages = [];
    await page.fill('#opKey', 'nonexistent');
    await page.click('#searchBtn');
    await page.waitForTimeout(50);
    expect(dialogMessages.some(m => m.toLowerCase().includes('not found'))).toBeTruthy();

    expect(pageErrors).toEqual([]);
  });

  test('S2 Delete: delete existing key and confirm removal from map and logs', async ({ page }) => {
    // Create and insert then delete
    dialogResponse = 'accept';
    await page.click('#createMapBtn');
    await page.fill('#opKey', 'car');
    await page.fill('#opValue', 'vehicle');
    await page.click('#insertBtn');

    // delete existing
    dialogMessages = [];
    await page.fill('#opKey', 'car');
    await page.click('#deleteBtn');

    // mapDisplay should no longer contain key 'car'
    const mapDisplay = page.locator('#mapDisplay');
    await expect(mapDisplay).not.toContainText('key: "car"');
    // Entries count should be 0
    await expect(mapDisplay).toContainText('Entries count: 0');

    // log should include deletion messages
    const logBox = page.locator('#log');
    await expect(logBox).toContainText('Deleted key "car"');

    expect(pageErrors).toEqual([]);
  });

  test('S2 Clear All: confirm dialog accepted clears the map; dismiss keeps entries', async ({ page }) => {
    // Create and insert two entries
    dialogResponse = 'accept';
    await page.click('#createMapBtn');
    await page.fill('#opKey', 'a');
    await page.fill('#opValue', '1');
    await page.click('#insertBtn');

    await page.fill('#opKey', 'b');
    await page.fill('#opValue', '2');
    await page.click('#insertBtn');

    const mapDisplay = page.locator('#mapDisplay');
    await expect(mapDisplay).toContainText('Entries count: 2');

    // Dismiss confirm -> map should remain unchanged
    dialogResponse = 'dismiss';
    await page.click('#clearBtn');
    await page.waitForTimeout(50);
    await expect(mapDisplay).toContainText('Entries count: 2');

    // Now accept confirm -> map should clear
    dialogResponse = 'accept';
    await page.click('#clearBtn');
    await page.waitForTimeout(50);
    await expect(mapDisplay).toContainText('Entries count: 0');

    expect(pageErrors).toEqual([]);
  });

  test('S2 -> S4 Bulk Insert: valid and invalid JSON handling + log update', async ({ page }) => {
    dialogResponse = 'accept';
    await page.click('#createMapBtn');

    // valid bulk insert (default textarea has 3 entries)
    const mapDisplay = page.locator('#mapDisplay');
    await page.click('#bulkInsertBtn');
    await page.waitForTimeout(50);
    // After successful bulk insert, log mentions "Bulk inserted 3 entries."
    const logBox = page.locator('#log');
    await expect(logBox).toContainText('Bulk inserted 3 entries');

    // Entries count should be >=3
    const text = await mapDisplay.textContent();
    expect(text).toMatch(/Entries count:\s*\d+/);
    const entriesMatch = text.match(/Entries count:\s*(\d+)/);
    expect(entriesMatch).not.toBeNull();
    expect(Number(entriesMatch[1])).toBeGreaterThanOrEqual(3);

    // Invalid JSON scenario (should show an alert)
    await page.fill('#bulkInsertText', 'not a json');
    dialogMessages = [];
    await page.click('#bulkInsertBtn');
    await page.waitForTimeout(50);
    expect(dialogMessages.some(m => m.toLowerCase().includes('invalid json'))).toBeTruthy();

    expect(pageErrors).toEqual([]);
  });

  test('S1 -> S3 Resize Table: manual resize updates table size, triggers rehash and UI updates', async ({ page }) => {
    dialogResponse = 'accept';
    await page.click('#createMapBtn');

    // Insert a few keys to ensure rehash moves entries
    await page.fill('#opKey', 'k1'); await page.fill('#opValue', 'v1'); await page.click('#insertBtn');
    await page.fill('#opKey', 'k2'); await page.fill('#opValue', 'v2'); await page.click('#insertBtn');

    // Set target resize size and click resize
    await page.fill('#resizeTableSize', '16');
    await page.click('#resizeBtn');

    // mapDisplay should reflect new table size 16
    const mapDisplay = page.locator('#mapDisplay');
    await expect(mapDisplay).toContainText('Table size: 16');

    // Bucket list should have 16 options now
    const options = page.locator('#bucketSelect > option');
    await expect(options).toHaveCount(16);

    // Load factor display should be updated (value text)
    const loadFactorDisplay = page.locator('#loadFactorDisplay');
    await expect(loadFactorDisplay).toHaveText(/\d+\.\d{2}/);

    // Logs mention "Resizing from" or "Rehash complete"
    const logBox = page.locator('#log');
    await expect(logBox).toContainText('Resizing from');

    expect(pageErrors).toEqual([]);
  });

  test('Toggle Auto-Resize and Step Rehash: toggle button text updates and step rehash increases table size', async ({ page }) => {
    dialogResponse = 'accept';
    await page.click('#createMapBtn');

    const toggleBtn = page.locator('#toggleAutoResizeBtn');
    // default text contains "ON"
    await expect(toggleBtn).toContainText('ON');

    // Toggle to OFF
    await toggleBtn.click();
    await expect(toggleBtn).toContainText('OFF');

    // Toggle back to ON
    await toggleBtn.click();
    await expect(toggleBtn).toContainText('ON');

    // Record current table size
    const mapDisplay = page.locator('#mapDisplay');
    const beforeText = await mapDisplay.textContent();
    const beforeMatch = beforeText.match(/Table size:\s*(\d+)/);
    const beforeSize = beforeMatch ? Number(beforeMatch[1]) : null;
    expect(beforeSize).not.toBeNull();

    // Step rehash demo should increase table size by +2 (per implementation)
    await page.click('#stepRehashBtn');
    await page.waitForTimeout(50);
    const afterText = await mapDisplay.textContent();
    const afterMatch = afterText.match(/Table size:\s*(\d+)/);
    const afterSize = afterMatch ? Number(afterMatch[1]) : null;
    expect(afterSize).toBe(beforeSize + 2);

    // Log contains demo message
    const logBox = page.locator('#log');
    await expect(logBox).toContainText('Demo incremental resize');

    expect(pageErrors).toEqual([]);
  });

  test('S2 -> S5 Clear Log: clearLog button empties the log (Log Cleared state)', async ({ page }) => {
    dialogResponse = 'accept';
    await page.click('#createMapBtn');

    // Generate some log entries
    await page.fill('#opKey', 'x'); await page.fill('#opValue', 'y'); await page.click('#insertBtn');

    const logBox = page.locator('#log');
    await expect(logBox).toContainText('Inserted key');

    // Click clear log
    await page.click('#clearLogBtn');

    // log should be empty
    await expect(logBox).toHaveText('');

    // Assert that we have evidence that clear log button exists (S5_LogCleared) - button visible
    await expect(page.locator('#clearLogBtn')).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test('Edge cases: invalid table size on create and invalid custom hash function produce alerts and prevent creation', async ({ page }) => {
    // Set invalid table size (0) and click create -> triggers alert about invalid table size
    dialogResponse = 'accept';
    await page.fill('#tableSize', '0');
    await page.click('#createMapBtn');
    await page.waitForTimeout(50);
    // We expect an alert with "Invalid table size" message
    expect(dialogMessages.some(m => m.toLowerCase().includes('invalid table size'))).toBeTruthy();

    // operations-section should still be hidden (map not created)
    await expect(page.locator('#operations-section')).toHaveCSS('display', 'none');

    // Now test custom hash function error path: select custom and provide invalid code
    await page.selectOption('#hashFunctionChoice', 'custom');
    // show custom area is visible
    await expect(page.locator('#customHashFunction')).toBeVisible();

    // Put invalid function code (missing hashFunc or wrong return)
    await page.fill('#customHashFunction', 'function notHash(){ return "x"; }');
    dialogMessages = [];
    await page.fill('#tableSize', '8'); // valid size to proceed to creation attempt
    await page.click('#createMapBtn');
    await page.waitForTimeout(50);
    // getHashFunction throws alert "Error in custom hash function" or similar -- assert dialog present
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    expect(dialogMessages.some(m => /custom hash function/i.test(m) || /hashFunc/i)).toBeTruthy();

    expect(pageErrors).toEqual([]);
  });

  test('Load factor slider and numeric input keep values in sync and update hashMap when set', async ({ page }) => {
    dialogResponse = 'accept';
    await page.click('#createMapBtn');

    // Move slider to 50 -> loadFactorThreshold becomes 0.50
    await page.fill('#loadFactorSlider', '50'); // form control direct fill
    // Trigger input event by using evaluate (to ensure page listeners run)
    await page.evaluate(() => {
      document.getElementById('loadFactorSlider').dispatchEvent(new Event('input'));
    });

    // loadFactorDisplay should reflect 0.50
    await expect(page.locator('#loadFactorDisplay')).toHaveText('0.50');

    // Numeric input change should also update map's threshold when changed
    await page.fill('#loadFactorThreshold', '0.60');
    await page.evaluate(() => {
      document.getElementById('loadFactorThreshold').dispatchEvent(new Event('change'));
    });
    await expect(page.locator('#loadFactorDisplay')).toHaveText('0.60');

    expect(pageErrors).toEqual([]);
  });
});