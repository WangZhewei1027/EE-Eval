import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d4ff60-fa73-11f0-83e0-8d7be1d51901.html';

/*
  d3d4ff60-fa73-11f0-83e0-8d7be1d51901.spec.js

  Comprehensive Playwright end-to-end tests for the Hash Map Interactive Demo.

  Tests cover:
  - Initialization and UI presence
  - Put (insert) and update flows
  - Get (found / not found)
  - Delete (via input and via node Delete button)
  - Contains Key?
  - Insert Random Keys
  - Clear Table
  - Resize Now and changing capacity
  - Toggle Auto-resize
  - Edge cases (empty key alerts, invalid capacity)
  - Observing in-page logs and verifying DOM updates (buckets, nodes, stats, last result)
  - Observing console messages and page errors (assert none of type 'error' or uncaught page errors)
*/

/* Helper: compute the same djb2-based bucket index used by the page's HashMap.
   We replicate the algorithm to reason about expected bucket indices if needed. */
function computeBucketIndex(key, capacity) {
  const s = typeof key === 'string' ? key : String(key);
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h = h | 0;
  }
  return Math.abs(h) % capacity;
}

test.describe('Hash Map Interactive Demo - End-to-end', () => {
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages (different types) and page errors for assertions.
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app
    await page.goto(APP_URL);
    // Ensure core UI rendered
    await page.waitForSelector('#inputKey');
    await page.waitForSelector('#hashTable .bucket');
  });

  test.afterEach(async () => {
    // Assert no console.error messages were emitted
    expect(consoleErrors).toEqual([]);
    // Assert there were no uncaught page errors
    expect(pageErrors.map(e => String(e))).toEqual([]);
  });

  test('Initialization - renders table and initial log', async ({ page }) => {
    // Validate initial stats and presence of buckets
    const size = await page.locator('#statSize').textContent();
    const capacity = await page.locator('#statCapacity').textContent();
    expect(Number(size)).toBeGreaterThanOrEqual(0);
    expect(Number(capacity)).toBeGreaterThanOrEqual(2);

    // There should be capacity number of .bucket elements
    const capNum = Number(capacity);
    const buckets = page.locator('#hashTable .bucket');
    await expect(buckets).toHaveCount(capNum);

    // Initial log contains 'Initialized table with some sample keys.'
    const firstLogLine = await page.locator('#log').locator('div').first().textContent();
    expect(firstLogLine).toContain('Initialized table with some sample keys.');
  });

  test.describe('Put / Update flows', () => {
    test('Put: inserting a new key shows "Inserted", highlights bucket and logs insertion', async ({ page }) => {
      // Enter a new key / value
      await page.fill('#inputKey', 'myTestKey');
      await page.fill('#inputValue', 'myValue');

      // Click Put
      await page.click('#btnPut');

      // lastResult should briefly contain 'Inserted' (rendered immediately)
      await expect(page.locator('#lastResult')).toHaveText(/Inserted/);

      // The top-most log entry should mention the inserted key
      const topLog = await page.locator('#log').locator('div').first().textContent();
      expect(topLog).toContain('Inserted key="myTestKey"');

      // One of the buckets should have the highlight class
      const highlighted = page.locator('#hashTable .bucket.highlight');
      await expect(highlighted).toHaveCount(1);

      // The highlighted bucket's chain should contain a node with key text 'myTestKey'
      const nodeKey = highlighted.locator('.node .key', { hasText: 'myTestKey' });
      await expect(nodeKey).toHaveCount(1);

      // Stats: size increased (should be >= 1)
      const sizeText = await page.locator('#statSize').textContent();
      expect(Number(sizeText)).toBeGreaterThanOrEqual(1);
    });

    test('Put: updating an existing key shows "Updated" and replaces value', async ({ page }) => {
      // Ensure key exists by inserting
      await page.fill('#inputKey', 'k-update');
      await page.fill('#inputValue', 'first');
      await page.click('#btnPut');
      await expect(page.locator('#lastResult')).toHaveText(/Inserted/);

      // Update the same key with new value
      await page.fill('#inputKey', 'k-update');
      await page.fill('#inputValue', 'second');
      await page.click('#btnPut');

      // Expect Updated message
      await expect(page.locator('#lastResult')).toHaveText(/Updated/);

      // Log should reflect update
      const topLog1 = await page.locator('#log').locator('div').first().textContent();
      expect(topLog).toContain('Updated key="k-update"');

      // Find the node and confirm its displayed value changed to 'second'
      const node = page.locator('#hashTable .node').filter({ has: page.locator('.key', { hasText: 'k-update' }) });
      await expect(node.locator('.val')).toHaveText('second');
    });
  });

  test.describe('Get and Contains flows', () => {
    test('Get: existing key returns Found and logs proper JSON value if object', async ({ page }) => {
      // There is an initial key '123' in pre-populated pairs (value is an object {nested:true})
      // Use that key to test get behavior.
      await page.fill('#inputKey', '123');
      await page.click('#btnGet');

      // lastResult should indicate Found
      await expect(page.locator('#lastResult')).toHaveText(/Found:/);

      // Top log should include JSON stringified representation of the value ({"nested":true})
      const topLog2 = await page.locator('#log').locator('div').first().textContent();
      expect(topLog).toContain('Get key="123" found at index');
      expect(topLog).toContain('{"nested":true}');

      // A bucket should be highlighted
      await expect(page.locator('#hashTable .bucket.highlight')).toHaveCount(1);
    });

    test('Get: non-existing key shows Not found and highlights would-be bucket', async ({ page }) => {
      await page.fill('#inputKey', 'thisKeyDoesNotExist_zzz');
      await page.click('#btnGet');

      await expect(page.locator('#lastResult')).toHaveText('Not found');

      const topLog3 = await page.locator('#log').locator('div').first().textContent();
      expect(topLog).toContain('NOT FOUND');

      // renderTable called with predicted index: at least one bucket highlighted
      await expect(page.locator('#hashTable .bucket.highlight')).toHaveCount(1);
    });

    test('Contains Key?: returns Yes/No and logs the boolean', async ({ page }) => {
      // Known existing key: 'apple' (from initial entries)
      await page.fill('#inputKey', 'apple');
      await page.click('#btnContains');
      await expect(page.locator('#lastResult')).toHaveText(/Yes/);

      let topLog4 = await page.locator('#log').locator('div').first().textContent();
      expect(topLog).toContain('Contains key="apple"? true');

      // Non-existing key
      await page.fill('#inputKey', 'nonexistent-contains-xyz');
      await page.click('#btnContains');
      await expect(page.locator('#lastResult')).toHaveText(/No/);

      topLog = await page.locator('#log').locator('div').first().textContent();
      expect(topLog).toContain('Contains key="nonexistent-contains-xyz"? false');
    });
  });

  test.describe('Delete operations', () => {
    test('Delete via input: deleting a missing key yields Not found', async ({ page }) => {
      // Ensure key not present
      await page.fill('#inputKey', 'some-random-missing-key');
      // Intercept the alert if page code asks for key (not in this case) and handle possible alert from empty key flows
      await page.click('#btnDelete');
      // Deleted missing key should show Not found in lastResult
      await expect(page.locator('#lastResult')).toHaveText('Not found');

      const topLog5 = await page.locator('#log').locator('div').first().textContent();
      expect(topLog).toContain('Failed to remove key=');
    });

    test('Delete via node Delete button removes specific entry, updates UI and logs', async ({ page }) => {
      // Ensure 'banana' exists in initial pairs; find its node and click its Delete button.
      const node1 = page.locator('#hashTable .node1').filter({ has: page.locator('.key', { hasText: 'banana' }) });
      await expect(node).toHaveCount(1);

      // Click the Delete button within that node
      await node.locator('button', { hasText: 'Delete' }).click();

      // After deletion, lastResult should say Removed "<key>"
      await expect(page.locator('#lastResult')).toHaveText(/Removed/);

      // top log should mention removal of banana
      const topLog6 = await page.locator('#log').locator('div').first().textContent();
      expect(topLog).toContain('Removed key="banana"');

      // The node with 'banana' should no longer exist
      const bananaNode = page.locator('#hashTable .node').filter({ has: page.locator('.key', { hasText: 'banana' }) });
      await expect(bananaNode).toHaveCount(0);
    });
  });

  test.describe('Random Inserts, Clear, Resize and Auto-resize toggle', () => {
    test('Insert Random Keys increases size and logs insertion summary', async ({ page }) => {
      const sizeBefore = Number(await page.locator('#statSize').textContent());
      await page.click('#btnRandom');

      // Log contains the seeded message
      const topLog7 = await page.locator('#log').locator('div').first().textContent();
      expect(topLog).toContain('Inserted some random keys');

      // Size should have increased
      const sizeAfter = Number(await page.locator('#statSize').textContent());
      expect(sizeAfter).toBeGreaterThanOrEqual(sizeBefore);
    });

    test('Clear Table resets stats and shows "Cleared" result', async ({ page }) => {
      // Perform clear
      await page.click('#btnClear');

      // lastResult should show 'Cleared'
      await expect(page.locator('#lastResult')).toHaveText('Cleared');

      // Size must be 0
      await expect(page.locator('#statSize')).toHaveText('0');

      // Log top line mentions 'Cleared table.'
      const topLog8 = await page.locator('#log').locator('div').first().textContent();
      expect(topLog).toContain('Cleared table.');
    });

    test('Resize Now: changes capacity and re-renders buckets', async ({ page }) => {
      // Set capacity to 16
      await page.fill('#inputCapacity', '16');
      await page.click('#btnResize');

      // Log should mention resizing
      const topLog9 = await page.locator('#log').locator('div').first().textContent();
      expect(topLog).toContain('Resized table to capacity 16.');

      // Capacity stat should update to 16
      await expect(page.locator('#statCapacity')).toHaveText('16');

      // Number of buckets should equal 16
      await expect(page.locator('#hashTable .bucket')).toHaveCount(16);
    });

    test('Toggle Auto-resize flips setting and logs the new state', async ({ page }) => {
      // Read current checked state
      const toggle = page.locator('#toggleAutoResize');
      const isChecked = await toggle.isChecked();

      // Click to toggle
      await toggle.click();

      // Log should reflect new state ON/OFF
      const topLog10 = await page.locator('#log').locator('div').first().textContent();
      if (isChecked) {
        expect(topLog).toContain('Auto-resize is now OFF');
      } else {
        expect(topLog).toContain('Auto-resize is now ON');
      }
    });
  });

  test.describe('Edge cases and input validation', () => {
    test('Putting with empty key triggers alert asking for a key', async ({ page }) => {
      // Ensure inputKey is empty
      await page.fill('#inputKey', '');
      await page.fill('#inputValue', 'some');

      // Prepare to assert dialog message
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('Please provide a key');
        await dialog.accept();
      });

      await page.click('#btnPut');
      // lastResult should not show Inserted (remains empty or previous), but we primarily assert the dialog occurred above
    });

    test('Get/Delete/Contains with empty key each trigger the same alert', async ({ page }) => {
      // Ensure empty
      await page.fill('#inputKey', '');

      // GET
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('Please provide a key');
        await dialog.accept();
      });
      await page.click('#btnGet');

      // DELETE
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('Please provide a key');
        await dialog.accept();
      });
      await page.click('#btnDelete');

      // CONTAINS
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('Please provide a key');
        await dialog.accept();
      });
      await page.click('#btnContains');
    });

    test('Resize Now with invalid capacity triggers alert', async ({ page }) => {
      // Enter an invalid capacity (<2)
      await page.fill('#inputCapacity', '1');

      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('Capacity must be a number >= 2');
        await dialog.accept();
      });

      await page.click('#btnResize');
    });

    test('Capacity input onchange reverts invalid values to current capacity', async ({ page }) => {
      // Set an invalid value then trigger change
      await page.fill('#inputCapacity', 'not-a-number');
      // trigger change event by focusing out
      await page.locator('body').click();

      // After onchange, the input should have numeric capacity equal to the statCapacity
      const capStat = await page.locator('#statCapacity').textContent();
      const capInput = await page.locator('#inputCapacity').inputValue();
      expect(Number(capInput)).toBe(Number(capStat));
    });
  });
});