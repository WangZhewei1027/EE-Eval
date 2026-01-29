import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d99342-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('B-Tree Index Interactive Demo - FSM and UI integration', () => {
  let consoleErrors = [];
  let pageErrors = [];

  // Attach listeners for console and page errors per test.
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture console error messages for assertions
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      // capture uncaught exceptions from the page
      pageErrors.push(err.message || String(err));
    });

    await page.goto(BASE);
  });

  test.afterEach(async () => {
    // Assert that there were no unexpected console errors or uncaught page errors.
    // The page is expected to run as-is; if there are runtime errors they will be reported.
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test('Idle state: initial render shows controls and initial log', async ({ page }) => {
    // Validate presence of core controls and the initial "ready" log message.
    const degreeVal = page.locator('#degreeVal');
    await expect(degreeVal).toHaveText('t = 2');

    const insertBtn = page.locator('#insertBtn');
    const searchBtn = page.locator('#searchBtn');
    const clearBtn = page.locator('#clearBtn');
    const autoplayBtn = page.locator('#autoplayBtn');
    const randomBtn = page.locator('#randomBtn');

    await expect(insertBtn).toBeVisible();
    await expect(searchBtn).toBeVisible();
    await expect(clearBtn).toBeVisible();
    await expect(autoplayBtn).toBeVisible();
    await expect(randomBtn).toBeVisible();

    // The demo logs a ready message on initial render
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && log.textContent && log.textContent.includes('B-Tree demo ready. Set t and insert keys.');
    });
  });

  test('InsertKeys event: inserting keys triggers animated insert and tree updates', async ({ page }) => {
    // Insert multiple keys and wait for completion (input cleared indicates handler finished)
    // This validates transition: Idle -> Inserting, log entries, and DOM node creation.
    const keyInput = page.locator('#keyInput');
    const insertBtn = page.locator('#insertBtn');

    await keyInput.fill('10,5,20');
    await insertBtn.click();

    // Wait until input cleared (insertion handler clears it at the end)
    await page.waitForFunction(() => document.getElementById('keyInput').value === '');

    // Ensure logs contain per-key insert messages
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && log.textContent && log.textContent.includes('Insert 20');
    });

    // The canvas should contain node elements and keys should be present
    const keyLocator = page.locator('.key');
    await expect(keyLocator).toHaveCountGreaterThan(0);

    // Check that keys 10,5,20 are present somewhere in the node key elements
    const has10 = await page.locator('.key', { hasText: '10' }).count();
    const has5 = await page.locator('.key', { hasText: '5' }).count();
    const has20 = await page.locator('.key', { hasText: '20' }).count();
    expect(has10, 'Key 10 should be present in the rendered tree').toBeGreaterThan(0);
    expect(has5, 'Key 5 should be present in the rendered tree').toBeGreaterThan(0);
    expect(has20, 'Key 20 should be present in the rendered tree').toBeGreaterThan(0);
  });

  test('SearchKey event: searching highlights path and logs result', async ({ page }) => {
    // Prepare tree with known keys
    const keyInput = page.locator('#keyInput');
    const insertBtn = page.locator('#insertBtn');
    await keyInput.fill('3,8,12');
    await insertBtn.click();
    await page.waitForFunction(() => document.getElementById('keyInput').value === '');

    // Search for an existing key
    const searchInput = page.locator('#searchInput');
    const searchBtn = page.locator('#searchBtn');

    await searchInput.fill('8');
    await searchBtn.click();

    // Expect the log to contain FOUND message
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && log.textContent && log.textContent.includes('Search 8 -> FOUND');
    });

    // Expect at least one highlighted key element for the searched key
    // highlightSearchPath adds .split class to nodes and .highlight to keys
    await page.waitForFunction(() => {
      const highlights = Array.from(document.querySelectorAll('.key.highlight'));
      return highlights.some(k => k.textContent === '8');
    });
  });

  test('ResetTree event: resetting tree clears previous state and logs reset', async ({ page }) => {
    // Insert a key to ensure tree has content, then reset
    const keyInput = page.locator('#keyInput');
    const insertBtn = page.locator('#insertBtn');
    await keyInput.fill('42');
    await insertBtn.click();
    await page.waitForFunction(() => document.getElementById('keyInput').value === '');

    // Now reset
    const clearBtn = page.locator('#clearBtn');
    await clearBtn.click();

    // The demo logs a reset message after clearing logs
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && log.textContent && log.textContent.includes('Tree reset (t=');
    });

    // After reset, root node exists but should have no key elements (empty tree)
    const keyCount = await page.locator('.key').count();
    expect(keyCount, 'After reset, there should be no rendered keys').toBe(0);
  });

  test('AutoplayDemo event: autoplay inserts 1..15 and populates tree (may take time)', async ({ page }) => {
    // Autoplay inserts 1..15 with animation. Allow extended timeout for test execution.
    test.setTimeout(120000); // 2 minutes

    const autoplayBtn = page.locator('#autoplayBtn');
    await autoplayBtn.click();

    // Wait for autoplay log line
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && log.textContent && log.textContent.includes('Autoplay demo: inserting 1..15');
    }, { timeout: 30000 });

    // Wait for the last insert log "Insert 15" to appear (indicates end of autoplay)
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && log.textContent && log.textContent.includes('Insert 15');
    }, { timeout: 90000 });

    // Verify that at least 15 key elements are present across the rendered nodes
    // (the tree should have 15 keys in total)
    await page.waitForFunction(() => {
      const keys = document.querySelectorAll('.key');
      return keys.length >= 15;
    }, { timeout: 30000 });

    const keyCount = await page.locator('.key').count();
    expect(keyCount).toBeGreaterThanOrEqual(15);
  });

  test('InsertRandom event: random insertion logs and updates tree', async ({ page }) => {
    // Click random button and assert logs and node updates
    const randomBtn = page.locator('#randomBtn');
    await randomBtn.click();

    // Wait for 'Inserting random:' log line
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && /Inserting random:/.test(log.textContent);
    }, { timeout: 10000 });

    // Ensure some keys were rendered
    await page.waitForFunction(() => document.querySelectorAll('.key').length > 0, { timeout: 15000 });
    const keyCount = await page.locator('.key').count();
    expect(keyCount).toBeGreaterThan(0);
  });

  test('ChangeDegree followed by Insert triggers tree reinitialization with new t', async ({ page }) => {
    // Change the degree slider value and dispatch input so degreeVal updates
    // Then perform an insert which should detect t change and reinitialize tree (log 'Reinitialized tree with t=X').
    await page.evaluate(() => {
      const deg = document.getElementById('degree');
      deg.value = '3';
      deg.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Confirm UI updated
    await expect(page.locator('#degreeVal')).toHaveText('t = 3');

    // Now trigger insert; insert handler checks and reinitializes tree if t changed.
    await page.locator('#keyInput').fill('99');
    await page.locator('#insertBtn').click();

    // Wait for reinitialized log
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && log.textContent && log.textContent.includes('Reinitialized tree with t=3');
    });

    // And final insertion should be logged
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && log.textContent && log.textContent.includes('Insert 99');
    }, { timeout: 15000 });
  });

  test('Search with invalid input does not produce a search log entry', async ({ page }) => {
    // Determine current log entries count
    const initialCount = await page.evaluate(() => document.getElementById('log').children.length);

    // Fill non-number into the search input and click search
    await page.locator('#searchInput').fill('not-a-number');
    await page.locator('#searchBtn').click();

    // Wait a short time to allow any (unexpected) logging to happen
    await page.waitForTimeout(500);

    const afterCount = await page.evaluate(() => document.getElementById('log').children.length);
    // If input is invalid Number(...) becomes NaN and handler returns early -> no new log entries
    expect(afterCount, 'Invalid search input should not create new log entries').toBe(initialCount);
  });

  test('Clicking on a rendered node logs its keys', async ({ page }) => {
    // Insert a key so there will be a node to click
    await page.locator('#keyInput').fill('7');
    await page.locator('#insertBtn').click();
    await page.waitForFunction(() => document.getElementById('keyInput').value === '');

    // Click a node and expect a Node log entry with keys info
    const node = page.locator('.node').first();
    await node.click();

    // Wait for log entry that starts with "Node " and contains "keys=["
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && /Node .* keys=\[.*\]/.test(log.textContent);
    }, { timeout: 5000 });
  });

});