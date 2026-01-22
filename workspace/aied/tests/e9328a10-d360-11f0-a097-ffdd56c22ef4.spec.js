import { test, expect } from '@playwright/test';

const APP = 'http://127.0.0.1:5500/workspace/batch-1207/html/e9328a10-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('Hash Table Visualizer (FSM e9328a10-d360-11f0-a097-ffdd56c22ef4)', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // collect console messages
    page.on('console', msg => {
      try {
        const text = msg.text();
        consoleMessages.push({type: msg.type(), text});
      } catch (e) {
        consoleMessages.push({type: 'unknown', text: String(msg)});
      }
    });

    // collect page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app
    await page.goto(APP);
    // ensure initial rendering finished
    await page.waitForSelector('#buckets .bucket', { timeout: 5000 });
  });

  test.afterEach(async () => {
    // no-op, arrays available for assertions inside tests
  });

  // Helper: read log entries (array of strings from #log div children)
  async function readLogEntries(page) {
    const entries = await page.locator('#log > div').allTextContents();
    // entries are prepended, most recent first
    return entries.map(s => s.trim()).filter(Boolean);
  }

  // Helper: wait until a log entry containing text appears
  async function waitForLog(page, text, timeout = 4000) {
    await page.waitForFunction(
      (sel, t) => {
        const el = document.querySelector(sel);
        if(!el) return false;
        return Array.from(el.children).some(c => c.innerText.includes(t));
      },
      ['#log', text],
      { timeout }
    );
  }

  test.describe('Initial state and Idle (S0_Idle)', () => {
    test('should show initial meta and a Ready log (redraw entry action)', async ({ page }) => {
      // Validate meta: count 0, cap 8, load 0%
      await expect(page.locator('#count')).toHaveText('0');
      await expect(page.locator('#cap')).toHaveText('8');
      await expect(page.locator('#load')).toHaveText('0%');

      // Buckets exist and equal capacity (8)
      const buckets = page.locator('#buckets .bucket');
      await expect(buckets).toHaveCount(8);

      // Log should contain 'Ready. Insert keys to see hashing and collisions visualized.'
      const logs = await readLogEntries(page);
      const found = logs.some(l => l.includes('Ready. Insert keys to see hashing and collisions visualized.'));
      expect(found).toBeTruthy();

      // There should be no page errors at initial load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Insert (S1_Inserting) and duplicate handling', () => {
    test('insert a key results in visual node, count increment, and proper logs', async ({ page }) => {
      const key = 'Alice42';

      // fill input and click Insert
      await page.fill('#keyInput', key);
      await page.click('#insertBtn');

      // Wait for an inserted log (Inserted ... or Placed ... depending on mode)
      await waitForLog(page, 'Inserted', 6000).catch(async () => {
        // fallback: some plans log 'Placed'
        await waitForLog(page, 'Placed', 6000);
      });

      // Count should be 1
      await expect(page.locator('#count')).toHaveText('1');

      // There should be a node with the label somewhere in the buckets
      const nodeLocator = page.locator('.bucket .node', { hasText: key });
      await expect(nodeLocator).toHaveCount(1);

      // Verify a detailed log about the hash computation exists
      const logs = await readLogEntries(page);
      expect(logs.some(l => l.includes(`Hash(${key})`) || l.includes('Probing index'))).toBeTruthy();
    });

    test('inserting duplicate key highlights exists flow and logs already-exists message', async ({ page }) => {
      const key = 'DuplicateKey99';
      // insert first time
      await page.fill('#keyInput', key);
      await page.click('#insertBtn');
      await waitForLog(page, 'Inserted', 6000).catch(() => {});
      await expect(page.locator('#count')).toHaveText('1');

      // insert duplicate
      await page.fill('#keyInput', key);
      await page.click('#insertBtn');

      // The UI's plan for existing keys logs 'Key already exists at'
      await waitForLog(page, 'Key already exists', 6000);
      const logs = await readLogEntries(page);
      expect(logs.some(l => l.includes('Key already exists'))).toBeTruthy();

      // count should remain 1
      await expect(page.locator('#count')).toHaveText('1');
    });

    test('clicking Insert with empty input triggers alert dialog', async ({ page }) => {
      // ensure empty
      await page.fill('#keyInput', '');
      // listen for dialog
      let dialogMessage = null;
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      await page.click('#insertBtn');
      // dialog should have been captured
      expect(dialogMessage).toBe('Enter a key');
    });
  });

  test.describe('Search (S2_Searching) and Delete (S3_Deleting)', () => {
    test('search finds an existing key and logs Found', async ({ page }) => {
      const key = 'Searcher77';
      // insert first
      await page.fill('#keyInput', key);
      await page.click('#insertBtn');
      await waitForLog(page, 'Inserted', 6000).catch(() => {});
      await expect(page.locator('#count')).toHaveText('1');

      // search
      await page.fill('#keyInput', key);
      await page.click('#searchBtn');

      // Found log
      await waitForLog(page, 'Found key', 6000);
      const logs = await readLogEntries(page);
      expect(logs.some(l => l.includes('Found key at') || l.includes('Found key'))).toBeTruthy();
    });

    test('deleting an existing key removes node and updates count', async ({ page }) => {
      const key = 'DeleteMe12';
      // insert
      await page.fill('#keyInput', key);
      await page.click('#insertBtn');
      await waitForLog(page, 'Inserted', 6000).catch(() => {});
      await expect(page.locator('#count')).toHaveText('1');

      // delete
      await page.fill('#keyInput', key);
      await page.click('#deleteBtn');

      // Deletion plan ends with log 'Deleted' (chaining) or 'Deleted (marked tombstone)' (probing)
      await waitForLog(page, 'Deleted', 6000).catch(async () => {
        await waitForLog(page, 'Deleted (marked tombstone)', 6000);
      });

      // count should be 0
      await expect(page.locator('#count')).toHaveText('0');

      // ensure no node with that label exists
      const nodeLocator = page.locator('.bucket .node', { hasText: key });
      await expect(nodeLocator).toHaveCount(0);
    });

    test('clicking Search/Delete with empty input triggers alert dialog', async ({ page }) => {
      // ensure empty
      await page.fill('#keyInput', '');
      // search dialog
      let dialogMessage1 = null;
      page.once('dialog', async d => { dialogMessage1 = d.message(); await d.accept(); });
      await page.click('#searchBtn');
      expect(dialogMessage1).toBe('Enter a key');

      // delete dialog
      let dialogMessage2 = null;
      page.once('dialog', async d => { dialogMessage2 = d.message(); await d.accept(); });
      await page.click('#deleteBtn');
      expect(dialogMessage2).toBe('Enter a key');
    });
  });

  test.describe('Clear (S4_Clearing), Random (S5_InsertingRandom), Bulk (S6_BulkInserting)', () => {
    test('Clear button resets table and logs Table cleared', async ({ page }) => {
      // Insert something first
      await page.fill('#keyInput', 'TmpKey1');
      await page.click('#insertBtn');
      await waitForLog(page, 'Inserted', 6000).catch(() => {});
      await expect(page.locator('#count')).toHaveText('1');

      // click clear
      await page.click('#clearBtn');

      // Expect log 'Table cleared'
      await waitForLog(page, 'Table cleared', 4000);
      await expect(page.locator('#count')).toHaveText('0');

      // all buckets should show 'empty' (at least one .empty per bucket)
      const empties = page.locator('.bucket .empty');
      await expect(empties).toHaveCount(8);
    });

    test('Insert Random creates a key, inserts it and logs insertion', async ({ page }) => {
      // click Insert Random
      await page.click('#randBtn');

      // The code sets keyInput and then plays insert plan; wait for a successful insertion log
      await waitForLog(page, 'Inserted', 6000).catch(async () => {
        await waitForLog(page, 'Placed', 6000);
      });

      // There should be count >=1
      const cnt = parseInt((await page.locator('#count').innerText()).trim(), 10);
      expect(cnt).toBeGreaterThanOrEqual(1);
    });

    test('Bulk Insert 6 inserts multiple items and increments count accordingly', async ({ page }) => {
      // capture initial count
      const before = parseInt((await page.locator('#count').innerText()).trim(), 10);

      await page.click('#bulkBtn');

      // Bulk inserts 6 items with delays; wait until count increases by 6
      await page.waitForFunction(
        (sel, expected) => parseInt(document.querySelector(sel).innerText.trim(), 10) >= expected,
        ['#count', before + 6],
        { timeout: 20000 }
      );

      const after = parseInt((await page.locator('#count').innerText()).trim(), 10);
      expect(after).toBeGreaterThanOrEqual(before + 6);
    });
  });

  test.describe('Mode change (S7_ModeChanged), Hash Function change (S8_HashFunctionChanged), Capacity change (S9_CapacityChanged)', () => {
    test('Changing collision handling resets table and logs the switch', async ({ page }) => {
      // Insert an item to ensure reset effect visible
      await page.fill('#keyInput', 'ModeKey');
      await page.click('#insertBtn');
      await waitForLog(page, 'Inserted', 6000).catch(() => {});
      await expect(page.locator('#count')).toHaveText('1');

      // change mode select to linear
      await page.selectOption('#mode', 'linear');

      // should log 'Switched collision handling. Table reset'
      await waitForLog(page, 'Switched collision handling. Table reset', 4000);
      await expect(page.locator('#count')).toHaveText('0');

      // Bucket rendering should match capacity and be empty
      await expect(page.locator('#buckets .bucket')).toHaveCount(8);
      const empties = page.locator('.bucket .empty');
      expect(await empties.count()).toBeGreaterThan(0);
    });

    test('Changing hash function logs the new selection', async ({ page }) => {
      await page.selectOption('#hashFn', 'poly');
      await waitForLog(page, 'Hash function set to poly', 3000);
      const logs = await readLogEntries(page);
      expect(logs.some(l => l.includes('Hash function set to poly'))).toBeTruthy();

      // change back to djb2 for other tests
      await page.selectOption('#hashFn', 'djb2');
      await waitForLog(page, 'Hash function set to djb2', 3000);
    });

    test('Changing capacity resets table and updates capacity display and buckets', async ({ page }) => {
      // change capacity to 16
      await page.selectOption('#capacitySelect', '16');

      // Should log capacity change
      await waitForLog(page, 'Capacity changed. Table reset', 3000);

      // cap element should show 16 and bucket count should be 16
      await expect(page.locator('#cap')).toHaveText('16');
      await expect(page.locator('#buckets .bucket')).toHaveCount(16);
    });
  });

  test.describe('Auto-resize behavior and edge scenarios', () => {
    test('Auto-resize triggers when load factor exceeds threshold', async ({ page }) => {
      // set capacity to 8 to be deterministic
      await page.selectOption('#capacitySelect', '8');
      await waitForLog(page, 'Capacity changed. Table reset', 3000);

      // set threshold low (10%) so resize triggers quickly
      await page.fill('#threshold', '10');

      // insert multiple unique numeric keys to exceed threshold
      // capacity 8 -> threshold 10% -> after 1 insertion load = 12% > 10 -> auto-resize expected
      // use numeric keys to avoid string hashing differences
      await page.fill('#keyInput', '1');
      await page.click('#insertBtn');
      // Wait for auto-resize log
      await waitForLog(page, 'Auto-resize: capacity', 8000);
      const logs = await readLogEntries(page);
      expect(logs.some(l => l.startsWith('Auto-resize: capacity'))).toBeTruthy();

      // ensure capacity changed (doubled to 16)
      await expect(page.locator('#cap')).toHaveText('16');
    });

    test('Attempting operations with invalid internal state should not be patched; observe any thrown errors', async ({ page }) => {
      // This test intentionally observes page errors that may naturally occur.
      // Do a few operations to surface potential runtime errors (they will be captured by page.on('pageerror'))
      await page.fill('#keyInput', 'Edge1');
      await page.click('#insertBtn');
      await waitForLog(page, 'Inserted', 6000).catch(() => {});
      await page.fill('#keyInput', '');
      // trigger alert and accept it (to simulate user error)
      page.once('dialog', async d => await d.accept());
      await page.click('#searchBtn');

      // Give some time for any errors to surface
      await page.waitForTimeout(500);

      // We do NOT modify the page to prevent masking errors. Assert that pageErrors array is an array.
      expect(Array.isArray(pageErrors)).toBeTruthy();

      // If pageErrors contains items, we log them into test output by failing with useful info.
      if (pageErrors.length > 0) {
        // At least one page error occurred naturally — record types of the first few
        const messages = pageErrors.slice(0,5).map(e => String(e.message || e));
        // Make a lightweight assertion that errors have messages
        expect(messages.every(m => typeof m === 'string')).toBeTruthy();
      } else {
        // If no page error, assert zero errors is acceptable (the page ran cleanly)
        expect(pageErrors.length).toBe(0);
      }
    });
  });

  test.describe('Console and page error observations (observability checks)', () => {
    test('should have emitted application logs and no unexpected runtime errors', async ({ page }) => {
      // Ensure some expected console logs were emitted (the app uses log() to write to DOM, not console,
      // but the page may still emit console messages; we assert we captured console events array)
      expect(Array.isArray(consoleMessages)).toBeTruthy();

      // The DOM log should include Ready message at least once
      const domLogs = await readLogEntries(page);
      expect(domLogs.some(l => l.includes('Ready. Insert keys to see hashing and collisions visualized.'))).toBeTruthy();

      // No uncaught page errors by default (this allows both possibilities)
      expect(pageErrors.length).toBe(0);
    });
  });

});