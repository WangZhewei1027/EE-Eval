import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e08220-d5c1-11f0-a327-5f281c6cb8e2.html';

test.describe('Linked List Visualizer (FSM-driven) - 98e08220-d5c1-11f0-a327-5f281c6cb8e2', () => {
  // Increase default timeout for animation-heavy tests
  test.slow();

  // Helper to read visible node values (visualized order, may include '…')
  async function getVisibleNodeValues(page) {
    return await page.$$eval('#nodesRow .box .val', els => els.map(e => e.innerText));
  }

  // Helper to read log text
  async function getLogText(page) {
    return await page.$eval('#log', el => el.innerText);
  }

  // Set up navigation and basic listeners before each test
  test.beforeEach(async ({ page }) => {
    // Collect page errors to assert no unexpected runtime exceptions
    page.context()._testPageErrors = [];
    page.on('pageerror', (err) => {
      // store for later assertions
      page.context()._testPageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Wait for initial render: log should contain initialization message
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && log.innerText.includes('Demo initialized with 10 -> 20 -> 30');
    }, { timeout: 3000 });
  });

  test.afterEach(async ({ page }) => {
    // Ensure no unexpected runtime errors were emitted during tests
    const pageErrors = page.context()._testPageErrors || [];
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  test.describe('Initial state and basic rendering (S0_Initialized -> S2_NonEmpty)', () => {
    test('should initialize with 3 nodes and show correct size/head/tail and initial log', async ({ page }) => {
      // Verify size, head, tail and visible nodes correspond to seeded values
      await expect(page.locator('#size')).toHaveText('3');
      await expect(page.locator('#headVal')).toHaveText('10');
      await expect(page.locator('#tailVal')).toHaveText('30');

      const visible = await getVisibleNodeValues(page);
      // initial sample was 10,20,30 - ensure rendered order is correct
      expect(visible).toEqual(expect.arrayContaining(['10', '20', '30']));

      // Confirm the operations log includes the initialization message (evidence from FSM entry_actions)
      const logText = await getLogText(page);
      expect(logText).toMatch(/Demo initialized with 10 -> 20 -> 30/);
    });
  });

  test.describe('Add/Insert/Remove transitions (S1 <-> S2 operations)', () => {
    test('Add Head and Add Tail update size and log correctly', async ({ page }) => {
      // Add Head
      await page.fill('#valueInput', 'HEAD_X');
      await page.click('#btnAddHead');
      await page.waitForFunction(() => document.getElementById('size').innerText === '4');
      await expect(page.locator('#headVal')).toHaveText('HEAD_X');

      // Confirm log contains insertHead entry
      let log = await getLogText(page);
      expect(log).toMatch(/insertHead\(HEAD_X\)/);

      // Add Tail
      await page.fill('#valueInput', 'TAIL_Y');
      await page.click('#btnAddTail');
      await page.waitForFunction(() => document.getElementById('size').innerText === '5');
      await expect(page.locator('#tailVal')).toHaveText('TAIL_Y');

      log = await getLogText(page);
      expect(log).toMatch(/insertTail\(TAIL_Y\)/);
    });

    test('Insert at index: shows alert when value is empty and inserts correctly when provided', async ({ page }) => {
      // Ensure index input present
      await page.fill('#indexInput', '1');

      const dialogs: string[] = [];
      page.on('dialog', dialog => {
        dialogs.push(dialog.message());
        dialog.accept();
      });

      // Click Insert with empty valueInput triggers alert('Enter a value to insert')
      await page.fill('#valueInput', ''); // explicit empty
      await page.click('#btnInsert');
      // Wait for dialog to be captured
      await page.waitForTimeout(200); // small pause for dialog
      expect(dialogs).toContain('Enter a value to insert');

      // Now insert a real value
      await page.fill('#valueInput', 'MID_Z');
      await page.fill('#indexInput', '1');
      await page.click('#btnInsert');

      // size should increase
      await page.waitForFunction(() => Number(document.getElementById('size').innerText) >= 5);
      const log = await getLogText(page);
      expect(log).toMatch(/insertAt\(1, MID_Z\)/);

      // Verify visible nodes include the new value
      const visible = await getVisibleNodeValues(page);
      expect(visible).toEqual(expect.arrayContaining(['MID_Z']));
    });

    test('RemoveHead, RemoveTail and Remove at index behave and log results', async ({ page }) => {
      // Record starting size
      const startSizeText = await page.locator('#size').innerText();
      const startSize = Number(startSizeText);

      // Remove head
      await page.click('#btnRemoveHead');
      await page.waitForFunction((s) => Number(document.getElementById('size').innerText) === s - 1, startSize, { timeout: 2000 });
      let log = await getLogText(page);
      expect(log).toMatch(/removeHead\(\) ->/);

      // Remove tail
      const afterHeadSize = Number(await page.locator('#size').innerText());
      await page.click('#btnRemoveTail');
      await page.waitForFunction((s) => Number(document.getElementById('size').innerText) === s - 1, afterHeadSize, { timeout: 2000 });
      log = await getLogText(page);
      expect(log).toMatch(/removeTail\(\) ->/);

      // Attempt Remove at index without entering index -> alert 'Enter an index'
      const dialogs: string[] = [];
      page.on('dialog', dialog => {
        dialogs.push(dialog.message());
        dialog.accept();
      });
      // Ensure removeIndex empty
      await page.fill('#removeIndex', '');
      await page.click('#btnRemove');
      await page.waitForTimeout(200);
      expect(dialogs).toContain('Enter an index');

      // Provide a valid index and remove
      // Set removeIndex to 0 (remove head)
      const prevSize = Number(await page.locator('#size').innerText());
      await page.fill('#removeIndex', '0');
      await page.click('#btnRemove');
      await page.waitForFunction((s) => Number(document.getElementById('size').innerText) === s - 1, prevSize, { timeout: 2000 });
      const newLog = await getLogText(page);
      expect(newLog).toMatch(/removeAt\(0\) ->/);
    });
  });

  test.describe('Traversal, Find and Reverse behaviors', () => {
    test('Traverse (step) and Traverse (fast) produce traversal logs and complete', async ({ page }) => {
      // Ensure list is non-empty
      await expect(page.locator('#size')).not.toHaveText('0');

      // Click Traverse (step)
      await page.click('#btnTraverse');
      // It should add 'Starting traversal (step)' to the log and eventually 'Traversal complete'
      await page.waitForFunction(() => document.getElementById('log').innerText.includes('Starting traversal (step)'), { timeout: 500 });
      await page.waitForFunction(() => document.getElementById('log').innerText.includes('Traversal complete'), { timeout: 8000 });

      // Click Traverse (fast)
      await page.click('#btnTraverseFast');
      await page.waitForFunction(() => document.getElementById('log').innerText.includes('Starting traversal (fast)'), { timeout: 500 });
      await page.waitForFunction(() => document.getElementById('log').innerText.includes('Traversal complete'), { timeout: 8000 });
    });

    test('Find (step) logs and Find (fast) highlights node when found', async ({ page }) => {
      // Load a known sample list to ensure deterministic content
      await page.click('#btnSample');
      await page.waitForFunction(() => document.getElementById('size').innerText === '7', { timeout: 2000 });

      // Use Find (step) to find 'C' (should exist at logical index 2)
      await page.fill('#findValue', 'C');
      await page.click('#btnFind');
      // It logs starting traversal and after completion logs found
      await page.waitForFunction(() => document.getElementById('log').innerText.includes('find(C) — starting traversal'), { timeout: 1000 });
      await page.waitForFunction(() => document.getElementById('log').innerText.match(/find: value found at index \d+/), { timeout: 8000 });

      // Now test Find Fast: should log and briefly apply .found class to a visual node
      await page.fill('#findValue', 'D'); // D exists
      await page.click('#btnFindFast');

      // FindFast logs quickly
      await page.waitForFunction(() => document.getElementById('log').innerText.includes('find(D) ->'), { timeout: 1000 });
      // Look for any node with .found class
      const foundLocator = page.locator('#nodesRow .node.found');
      await expect(foundLocator.first()).toBeVisible({ timeout: 2000 });
      // After 1500ms the class should be removed (app sets timeout 1200)
      await page.waitForTimeout(1500);
      await expect(foundLocator.first()).toHaveCount(0);
    });

    test('Reverse performs traversal animation then reverses list and logs completion', async ({ page }) => {
      // Load sample for deterministic order
      await page.click('#btnSample');
      await page.waitForFunction(() => document.getElementById('size').innerText === '7', { timeout: 2000 });

      const before = await getVisibleNodeValues(page);
      // Trigger reverse
      await page.click('#btnReverse');

      // reverse() logs 'reverse() complete' after animation
      await page.waitForFunction(() => document.getElementById('log').innerText.includes('reverse() complete'), { timeout: 8000 });

      // Get visible nodes after reverse - should be reversed relative to previous (unless ellipsis present)
      const after = await getVisibleNodeValues(page);
      // Basic sanity: first visible of before should equal last visible of after (for full visible list)
      if (before.length > 0 && after.length > 0 && before[0] !== '…' && after[after.length - 1] !== '…') {
        expect(before[0]).toEqual(after[after.length - 1]);
      }
    });
  });

  test.describe('Utility operations: Clear, Fill Random, Sample, Shuffle', () => {
    test('Clear transitions to Empty (S1_Empty) and logs clear()', async ({ page }) => {
      // Ensure list non-empty then clear
      await expect(page.locator('#size')).not.toHaveText('0');
      await page.click('#btnClear');

      // size should become 0 and head/tail = null
      await page.waitForFunction(() => document.getElementById('size').innerText === '0', { timeout: 2000 });
      await expect(page.locator('#headVal')).toHaveText('null');
      await expect(page.locator('#tailVal')).toHaveText('null');

      const log = await getLogText(page);
      expect(log).toMatch(/clear\(\)/);
    });

    test('Fill random increases size by 5 and logs fill random', async ({ page }) => {
      // Start from current size
      const prevSize = Number(await page.locator('#size').innerText());
      await page.click('#btnRandom');
      await page.waitForFunction((s) => Number(document.getElementById('size').innerText) === s + 5, prevSize, { timeout: 2000 });
      const newSize = Number(await page.locator('#size').innerText());
      expect(newSize).toBe(prevSize + 5);

      const log = await getLogText(page);
      expect(log).toMatch(/fill random\(5\)/);
    });

    test('Sample list loads a known set and Shuffle keeps size same and logs', async ({ page }) => {
      await page.click('#btnSample');
      await page.waitForFunction(() => document.getElementById('size').innerText === '7', { timeout: 2000 });
      const before = await getVisibleNodeValues(page);

      await page.click('#btnShuffle');
      // shuffle should log 'list shuffled'
      await page.waitForFunction(() => document.getElementById('log').innerText.includes('list shuffled'), { timeout: 1000 });

      // size should remain 7
      await expect(page.locator('#size')).toHaveText('7');

      const after = await getVisibleNodeValues(page);
      // After shuffle the visible values should still contain same elements (set equality), though order may change.
      // Filter out '…' if present when visual truncation occurs — here sample 7 < MAX_VISUAL so no '…'
      const beforeFiltered = before.filter(v => v !== '…');
      const afterFiltered = after.filter(v => v !== '…');
      expect(beforeFiltered.sort()).toEqual(afterFiltered.sort());
    });
  });

  test.describe('Edge cases and error scenarios (alerts and empty-list behavior)', () => {
    test('Alerts for missing input on Insert, Find and Remove are shown with correct messages', async ({ page }) => {
      const dialogs: string[] = [];
      page.on('dialog', dialog => {
        dialogs.push(dialog.message());
        dialog.accept();
      });

      // Ensure valueInput empty and try Insert -> alert
      await page.fill('#valueInput', '');
      await page.fill('#indexInput', '0');
      await page.click('#btnInsert');
      await page.waitForTimeout(200);
      expect(dialogs).toContain('Enter a value to insert');

      // Try Find with empty value -> alert
      await page.fill('#findValue', '');
      await page.click('#btnFind');
      await page.waitForTimeout(200);
      expect(dialogs).toContain('Enter a value to find');

      // Clear list to become empty and try Traverse -> logs "Traverse: list is empty"
      await page.click('#btnClear');
      await page.waitForFunction(() => document.getElementById('size').innerText === '0', { timeout: 2000 });
      await page.click('#btnTraverse');
      await page.waitForFunction(() => document.getElementById('log').innerText.includes('Traverse: list is empty'), { timeout: 1000 });

      // RemoveHead/RemoveTail on empty list should log -> 'removeHead() -> null' / 'removeTail() -> null'
      await page.click('#btnRemoveHead');
      await page.click('#btnRemoveTail');
      await page.waitForFunction(() => document.getElementById('log').innerText.includes('removeHead() -> null'), { timeout: 1000 });
      await page.waitForFunction(() => document.getElementById('log').innerText.includes('removeTail() -> null'), { timeout: 1000 });

      // Remove at index when empty but with missing number -> alert 'Enter an index' (test by clicking while removeIndex empty)
      await page.fill('#removeIndex', '');
      await page.click('#btnRemove');
      await page.waitForTimeout(200);
      expect(dialogs).toContain('Enter an index');
    });
  });

  test.describe('Interactive code area click and keyboard shortcuts', () => {
    test('Clicking code area briefly changes background (visual feedback) and triggers no errors', async ({ page }) => {
      // Click code area should cause a temporary background change; we assert the style changed and then reverted
      const codeText = page.locator('#codeText');
      // read initial background
      const beforeBg = await codeText.evaluate(el => el.style.background || '');
      await codeText.click();
      // After click background should be set to a non-empty string briefly
      await page.waitForFunction(() => {
        const el = document.getElementById('codeText');
        return el && el.style.background && el.style.background.length > 0;
      }, { timeout: 1000 });
      // Wait for revert time (700ms in app)
      await page.waitForTimeout(800);
      const afterBg = await codeText.evaluate(el => el.style.background || '');
      expect(afterBg).toBe('');
    });

    test('Keyboard shortcut Ctrl+R triggers reverse (logs reverse) and causes no runtime errors', async ({ page }) => {
      // Ensure list has items
      await page.click('#btnSample');
      await page.waitForFunction(() => document.getElementById('size').innerText === '7', { timeout: 2000 });

      // Press ctrl+r
      await page.keyboard.down('Control');
      await page.keyboard.press('r');
      await page.keyboard.up('Control');

      // Expect reverse animation and completion log
      await page.waitForFunction(() => document.getElementById('log').innerText.includes('reverse() complete'), { timeout: 8000 });
    });
  });
});