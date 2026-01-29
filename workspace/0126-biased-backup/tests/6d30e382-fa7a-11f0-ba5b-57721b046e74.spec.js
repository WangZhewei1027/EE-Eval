import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d30e382-fa7a-11f0-ba5b-57721b046e74.html';

/**
 * 6d30e382-fa7a-11f0-ba5b-57721b046e74.spec.js
 *
 * Tests for the "B-Tree Index Interactive Demo" interactive application.
 *
 * Note: The page as-provided throws a runtime error during initialization
 * because the script attaches an event listener to a non-existent element
 * with id "clickableTree". Per instructions, we do NOT modify the page.
 * These tests therefore:
 *  - Observe and assert that the runtime/page error occurs naturally
 *  - Verify that the UI object is not installed on window
 *  - Verify that no tree rendering happened (since initialization failed)
 *  - Attempt to interact with all controls (per FSM) and assert no hidden side-effects
 *  - Cover edge cases and error scenarios (e.g., clicking buttons without initialization)
 *
 * Tests are grouped and use modern async/await.
 */

test.describe('B-Tree Interactive Demo - FSM & UI validation', () => {
  // Collect page errors and console messages for each test
  test.beforeEach(async ({ page }) => {
    // Ensure a clean slate for messages
    await page.addInitScript(() => {
      // no-op, but ensures we attach page listeners in the test context
    });
  });

  test('Initialization: pageload should attempt to create BTreeUI and produce a runtime error (missing clickableTree)', async ({ page }) => {
    const pageErrors = [];
    const consoleMessages = [];

    page.on('pageerror', (err) => {
      // Collect pageerror events (uncaught exceptions)
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    page.on('console', (msg) => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });

    // Load the page and wait for 'load' event which triggers window.onload
    await page.goto(APP_URL, { waitUntil: 'load' });

    // We expect at least one page error due to the missing #clickableTree element
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one of the errors should reference 'clickableTree' or indicate null.addEventListener / Cannot read properties
    const combinedErrors = pageErrors.join(' | ').toLowerCase();
    expect(
      /clickabletree|addEventlistener|cannot read properties of null|cannot read property 'addEventListener'/.test(
        combinedErrors
      )
    ).toBeTruthy();

    // Because initialization failed, window.btreeUI should NOT be available
    const hasUI = await page.evaluate(() => typeof window.btreeUI !== 'undefined' && window.btreeUI !== null);
    expect(hasUI).toBe(false);

    // Since renderTree did not run, the container should NOT show 'Tree is empty' text produced by renderTree
    const treeContainerText = await page.locator('#treeContainer').innerText();
    // The initial HTML leaves the container empty; ensure it was not rendered by the app
    expect(treeContainerText.trim()).toBe('');

    // Stats should remain at their initial values (0) because renderTree was not invoked
    const height = await page.locator('#treeHeight').innerText();
    const nodeCount = await page.locator('#nodeCount').innerText();
    const keyCount = await page.locator('#keyCount').innerText();
    expect(height.trim()).toBe('0');
    expect(nodeCount.trim()).toBe('0');
    expect(keyCount.trim()).toBe('0');

    // Operation log should be empty as no operations were successfully logged
    const opLog = await page.locator('#operationLog').innerText();
    expect(opLog.trim()).toBe('');
  });

  test.describe('FSM events: verify buttons exist and produce no unintended effects when initialization failed', () => {
    // Helper to perform a click and assert no operation log change or stats change
    async function clickAndAssertNoEffect(page, selector, note) {
      // Capture pre-click state
      const preOpLog = await page.locator('#operationLog').innerText();
      const preTreeText = await page.locator('#treeContainer').innerText();
      const preHeight = await page.locator('#treeHeight').innerText();
      const preNodeCount = await page.locator('#nodeCount').innerText();
      const preKeyCount = await page.locator('#keyCount').innerText();

      // Perform the click if the element exists
      const btn = page.locator(selector);
      const exists = await btn.count();
      expect(exists).toBeGreaterThanOrEqual(1); // Button should be present in DOM

      await btn.click();

      // Small wait to allow any handlers to run if they exist
      await page.waitForTimeout(250);

      // Post state should be unchanged (since initialization failed, handlers were not attached)
      const postOpLog = await page.locator('#operationLog').innerText();
      const postTreeText = await page.locator('#treeContainer').innerText();
      const postHeight = await page.locator('#treeHeight').innerText();
      const postNodeCount = await page.locator('#nodeCount').innerText();
      const postKeyCount = await page.locator('#keyCount').innerText();

      expect(postOpLog).toBe(preOpLog);
      expect(postTreeText).toBe(preTreeText);
      expect(postHeight).toBe(preHeight);
      expect(postNodeCount).toBe(preNodeCount);
      expect(postKeyCount).toBe(preKeyCount);
    }

    test('Rebuild Tree button exists and does not rebuild (no BTreeUI) - RebuildTree event', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      // The rebuild button should be present; clicking it should not create a tree since initialization failed
      await clickAndAssertNoEffect(page, '#rebuildTree', 'RebuildTree');
    });

    test('Insert button exists and does not insert (no BTreeUI) - InsertValue event', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      // Fill the input (even though there is no handler attached)
      await page.fill('#insertValue', '42');
      await clickAndAssertNoEffect(page, '#insertBtn', 'InsertValue');
      // Input value should remain as-is or be cleared only if handler ran; because initialization failed, it should remain
      const insertValueAfter = await page.locator('#insertValue').inputValue();
      // The app's original handler would clear the input; since it didn't run, the value should still be '42'
      expect(insertValueAfter).toBe('42');
    });

    test('Delete button exists and does not delete (no BTreeUI) - DeleteValue event', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.fill('#deleteValue', '10');
      await clickAndAssertNoEffect(page, '#deleteBtn', 'DeleteValue');
      const deleteValueAfter = await page.locator('#deleteValue').inputValue();
      expect(deleteValueAfter).toBe('10');
    });

    test('Search button exists and does not highlight - SearchValue event', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.fill('#searchValue', '15');
      await clickAndAssertNoEffect(page, '#searchBtn', 'SearchValue');
      const searchValueAfter = await page.locator('#searchValue').inputValue();
      expect(searchValueAfter).toBe('15');
    });

    test('Show All and Collapse All buttons exist and do not change node visibility - ShowAll / CollapseAll events', async ({ page }) {
      await page.goto(APP_URL, { waitUntil: 'load' });
      await clickAndAssertNoEffect(page, '#showAll', 'ShowAllNodes');
      await clickAndAssertNoEffect(page, '#collapseAll', 'CollapseAllNodes');
    });

    test('Bulk Insert button exists and does not insert multiple values - BulkInsert event', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.fill('#bulkValues', '1,2,3,4,5');
      await clickAndAssertNoEffect(page, '#bulkInsert', 'BulkInsert');
      const bulkValuesAfter = await page.locator('#bulkValues').inputValue();
      // Handler would clear the input if it ran; since it didn't, it should remain populated
      expect(bulkValuesAfter).toBe('1,2,3,4,5');
    });

    test('Generate Random Tree button exists and does not generate - GenerateRandomTree event', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      // Ensure random count input exists and has default value
      const randomCountVal = await page.locator('#randomCount').inputValue();
      expect(Number(randomCountVal)).toBeGreaterThanOrEqual(1);
      await clickAndAssertNoEffect(page, '#randomTree', 'GenerateRandomTree');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Attempt to interact with controls after initialization error: ensure no unhandled promise rejections or additional errors', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (err) => {
        pageErrors.push(String(err && err.message ? err.message : err));
      });

      await page.goto(APP_URL, { waitUntil: 'load' });

      // initial error is expected; capture its count
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Try many interactions in sequence to ensure they don't cause further unhandled exceptions
      const selectors = [
        '#insertBtn',
        '#deleteBtn',
        '#searchBtn',
        '#rebuildTree',
        '#showAll',
        '#collapseAll',
        '#bulkInsert',
        '#randomTree'
      ];

      // Click each control if present
      for (const sel of selectors) {
        const loc = page.locator(sel);
        if (await loc.count()) {
          await loc.click();
        }
      }

      // Wait a moment to collect any additional errors
      await page.waitForTimeout(500);

      // Ensure no additional distinct new pageerrors beyond initial (i.e., the failure mode is stable)
      // We allow >=1 (initial), but disallow a large number of cascading errors
      expect(pageErrors.length).toBeLessThanOrEqual(10);
    });

    test('Confirm that missing clickableTree reference is the root cause by searching error messages', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (err) => errors.push(String(err && err.message ? err.message : err)));
      await page.goto(APP_URL, { waitUntil: 'load' });

      // Compose a joined string of errors
      const joined = errors.join(' | ').toLowerCase();

      // It is acceptable that message formats vary, but key substrings should appear
      expect(joined).toMatch(/clickabletree|addeventlistener|cannot read properties|null/);
    });
  });
});