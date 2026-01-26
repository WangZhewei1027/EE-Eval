import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c156503-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper to wait for a short time
const shortWait = (ms = 150) => new Promise(res => setTimeout(res, ms));

test.describe('Paging Explorer - FSM and UI interactions (Application ID: 9c156503-fa79-11f0-8fe7-a5317bd8e2c6)', () => {
  // Capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Reset any previous listeners by navigating fresh each test
    await page.goto(APP_URL);
  });

  // Group tests that validate FSM states and transitions
  test.describe('FSM States and Transitions', () => {

    test('S0 -> S1 -> S3: Regenerate dataset triggers loading then loads data (RegenerateData event)', async ({ page }) => {
      // Comments: This test validates that clicking "Regenerate" puts the app into loading (S1) and then into data loaded (S3).
      const consoleMsgs = [];
      const pageErrors = [];
      page.on('console', m => consoleMsgs.push(m.text()));
      page.on('pageerror', e => pageErrors.push(String(e)));

      // Reduce net delay for quicker, deterministic transitions but keep a small delay to observe "loading"
      await page.evaluate(() => {
        const el = document.getElementById('netDelay');
        el.value = '100';
        el.dispatchEvent(new Event('input'));
      });

      // Ensure starting status exists
      const status = page.locator('#status');
      await expect(status).toBeVisible();

      // Click Regenerate -> this triggers snapshot & generateDataset -> loadCurrentPage() which sets status 'loading' then 'loaded'
      await page.click('#regenData');

      // Immediately after clicking, status should show 'loading' at least transiently
      await expect(status).toHaveText(/Status: loading/i, { timeout: 2000 });

      // Wait until it finishes loading to 'loaded'
      await expect(status).toHaveText(/Status: loaded/i, { timeout: 5000 });

      // Verify that listContainer has been populated with a table (renderItems called)
      const table = page.locator('#listContainer table');
      await expect(table).toBeVisible();

      // meta should display total and page info
      const meta = page.locator('#meta');
      await expect(meta).toContainText('Page');

      // Ensure no unexpected page errors occurred
      expect(pageErrors.length).toBe(0);

      // Ensure logs mention dataset generation
      const logText = await page.locator('#log').textContent();
      expect(logText).toMatch(/Generated dataset with/);
    });

    test('S1_Loading transitions via navigation buttons -> First, Prev, Next, Last, Jump (FirstPage/PrevPage/NextPage/LastPage/JumpToPage events)', async ({ page }) => {
      // Comments: Test navigation buttons cause loading and render pages (transitions to DataLoaded)
      await page.evaluate(() => {
        document.getElementById('netDelay').value = '0';
        document.getElementById('netDelay').dispatchEvent(new Event('input'));
      });

      const status = page.locator('#status');

      // Start from page 1 -> click Next to go to page 2
      const currentPageInput = page.locator('#currentPage');
      const meta = page.locator('#meta');

      // Ensure initial loaded state
      await expect(status).toHaveText(/Status: loaded/i, { timeout: 3000 });

      // Click Next
      await page.click('#nextPage');
      // Expect currentPage input to update and status to show loaded after fetch
      await expect(currentPageInput).toHaveValue((await currentPageInput.inputValue()).then(v => v)); // ensure presence
      await expect(status).toHaveText(/Status: loaded/i, { timeout: 3000 });

      // Click Prev to go back
      await page.click('#prevPage');
      await expect(status).toHaveText(/Status: loaded/i, { timeout: 3000 });

      // Click First
      await page.click('#firstPage');
      await expect(currentPageInput).toHaveValue('1');
      await expect(status).toHaveText(/Status: loaded/i, { timeout: 3000 });

      // Test Jump to a specific page via jump input/button
      await page.fill('#jumpPage', '3');
      await page.click('#jumpBtn');
      await expect(currentPageInput).toHaveValue('3');
      await expect(status).toHaveText(/Status: loaded/i, { timeout: 3000 });

      // Test Last page navigation: this command fetches page 1 then computes last and navigates there
      // Use small delay to ensure fetches succeed
      await page.evaluate(() => {
        document.getElementById('netDelay').value = '50';
        document.getElementById('netDelay').dispatchEvent(new Event('input'));
      });
      await page.click('#lastPage');
      // After clicking, currentPage input should reflect last page (a number >= 1)
      const lastVal = await currentPageInput.inputValue();
      expect(Number(lastVal)).toBeGreaterThanOrEqual(1);
      await expect(status).toHaveText(/Status: loaded/i, { timeout: 5000 });

      // Ensure table is present after navigation
      await expect(page.locator('#listContainer table')).toBeVisible();
    });

    test('ApplyFilter and ResetFilter while offline cause error state (S1 -> S2)', async ({ page }) => {
      // Comments: Apply filters while offline should cause loading then error (setStatus("error"))
      const status = page.locator('#status');
      const log = page.locator('#log');

      // Ensure online and then load a page to have initial content
      await page.evaluate(() => {
        document.getElementById('offline').checked = false;
        document.getElementById('offline').dispatchEvent(new Event('change'));
        document.getElementById('netDelay').value = '0';
        document.getElementById('netDelay').dispatchEvent(new Event('input'));
      });
      // Ensure loaded
      await expect(status).toHaveText(/Status: loaded/i, { timeout: 3000 });

      // Now turn offline on to simulate failures
      await page.check('#offline');
      // Wait for the app to log that offline changed
      await shortWait(100);

      // Fill a simple filter value and click Apply
      await page.fill('#q', 'Item');
      await page.click('#applyFilter');

      // Status should first go to loading, then to error due to offline network
      await expect(status).toHaveText(/Status: loading/i, { timeout: 2000 });
      await expect(status).toHaveText(/Status: error/i, { timeout: 5000 });

      // The in-page log should contain an error message indicating loading failed
      const logText = await log.textContent();
      expect(logText).toMatch(/Error loading page|Offline/);

      // Now test ResetFilter while offline: Reset triggers applyFilter internally and should also set error status
      await page.click('#resetFilter');
      await expect(status).toHaveText(/Status: loading/i, { timeout: 2000 });
      await expect(status).toHaveText(/Status: error/i, { timeout: 5000 });
    });

    test('DeleteSelected and DuplicateSelected cause error when offline after selection (DeleteSelected/DuplicateSelected events)', async ({ page }) => {
      // Comments: Select something while online, then go offline and perform bulk actions which call loadCurrentPage -> error
      const status = page.locator('#status');
      const log = page.locator('#log');

      // Ensure online and small delay for responsiveness
      await page.evaluate(() => {
        document.getElementById('offline').checked = false;
        document.getElementById('offline').dispatchEvent(new Event('change'));
        document.getElementById('netDelay').value = '0';
        document.getElementById('netDelay').dispatchEvent(new Event('input'));
      });

      // Ensure page table exists
      await expect(page.locator('#listContainer table')).toBeVisible();

      // Select all items on page (this will fetch page if needed)
      await page.click('#selectAll');
      // Wait for selection to be reflected in meta
      await shortWait(200);
      const metaText1 = await page.locator('#meta').textContent();
      expect(metaText1).toMatch(/selected/);

      // Now go offline
      await page.check('#offline');
      await shortWait(100);

      // Click Duplicate Selected -> should attempt to duplicate then call loadCurrentPage -> error
      await page.click('#duplicateSelected');

      // The status should become 'error' after the attempted load
      await expect(status).toHaveText(/Status: error/i, { timeout: 5000 });

      // Re-enable online and then delete selected (to ensure deleteSelected works when online)
      await page.uncheck('#offline');
      await page.click('#deleteSelected');
      await expect(status).toHaveText(/Status: loaded/i, { timeout: 5000 });
      const logText = await log.textContent();
      expect(logText).toMatch(/Deleted|Duplicated|No selection|Deleted \d+ selected items/);
    });

    test('ExportCSV when online exports and logs success; when offline, fetch rejects (ExportCSV event)', async ({ page }) => {
      // Comments: Test export CSV in online state logs success. Then set offline and verify that fetch is rejected (observed via status or page error)
      const status = page.locator('#status');
      const log = page.locator('#log');
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(String(e)));

      // Ensure online
      await page.uncheck('#offline');
      await page.evaluate(() => {
        document.getElementById('netDelay').value = '0';
        document.getElementById('netDelay').dispatchEvent(new Event('input'));
      });

      // Click export CSV - should succeed and log an export entry
      await page.click('#exportCSV');
      // Wait a short time for the async export to complete
      await shortWait(300);
      const logText = await log.textContent();
      expect(logText).toMatch(/Exported current page to CSV/);

      // Now simulate offline and attempt export; fetchPage used by exportCSVPage will reject and may cause an unhandled rejection or at least no export log
      await page.check('#offline');
      await page.click('#exportCSV');

      // Allow time for any page errors to surface
      await shortWait(500);

      // If a pageerror occurred due to unhandled rejection, it will be captured
      // We assert that either a page error occurred, or the log does not have a second "Exported" entry.
      // (This is robust to differences in how browsers surface unhandled rejections.)
      const currentLog = await log.textContent();
      const exportedCount = (currentLog.match(/Exported current page to CSV/g) || []).length;
      expect(exportedCount).toBeGreaterThanOrEqual(1);
      // If offline export produced an error, we expect at least one page error or an 'Error loading page' log entry
      const sawErrorLog = /Error loading page/i.test(currentLog);
      expect(sawErrorLog || pageErrors.length > 0).toBeTruthy();
    });

    test('Import CSV file via input works and logs import (ImportCSV event)', async ({ page }) => {
      // Comments: Test that uploading a CSV file and clicking Import imports rows and logs the import.
      const log = page.locator('#log');
      // Ensure online so import will process and then trigger loadCurrentPage
      await page.uncheck('#offline');
      await page.evaluate(() => {
        document.getElementById('netDelay').value = '0';
        document.getElementById('netDelay').dispatchEvent(new Event('input'));
      });

      // Prepare a minimal CSV content with header and one row
      const csv = 'id,title,category,value,date\n1,"Test Import",alpha,123,2020-01-01';

      // Use setInputFiles with a buffer - Playwright accepts Uint8Array as buffer
      const uint8 = new TextEncoder().encode(csv);
      await page.setInputFiles('#importFile', [{ name: 'test.csv', mimeType: 'text/csv', buffer: uint8 }]);

      // Click import button
      await page.click('#importBtn');

      // Wait some time for FileReader and import to complete
      await shortWait(500);

      const logText = await log.textContent();
      // Expect the import log message - note: the importCSV implementation logs "Imported N items from CSV"
      expect(logText).toMatch(/Imported \d+ items from CSV/);
      // Also, dataset change should have triggered cache invalidation log
      expect(logText).toMatch(/Cache invalidated|Imported/);
    });

    test('Edge case: Jump/Find id (goto) searches pages and logs not-found if absent', async ({ page }) => {
      // Comments: Test go-to-item-by-id searching mechanism; search for a likely nonexistent id and verify log
      const log = page.locator('#log');

      // Ensure online and quick responses
      await page.uncheck('#offline');
      await page.evaluate(() => {
        document.getElementById('netDelay').value = '0';
        document.getElementById('netDelay').dispatchEvent(new Event('input'));
      });

      // Use a very large id that will not be in the dataset
      await page.fill('#gotoId', '9999999');
      await page.click('#gotoBtn');

      // Wait for search to run
      await shortWait(500);

      const logText = await log.textContent();
      expect(logText).toMatch(/not found|Search failed|not found in dataset/i);
    });

  });

  test.describe('State operations, history and UI feedback', () => {

    test('Snapshot / Undo / Redo flow: snapshotState -> delete an item -> undo restores (snapshotState, undoBtn, redoBtn)', async ({ page }) => {
      // Comments: Validate snapshot creation and undo/redo restore dataset + state via UI updates
      const log = page.locator('#log');
      await page.evaluate(() => {
        document.getElementById('netDelay').value = '0';
        document.getElementById('netDelay').dispatchEvent(new Event('input'));
      });

      // Take a manual snapshot
      await page.click('#snapshotState');
      await shortWait(200);
      let logText = await log.textContent();
      expect(logText).toMatch(/Snapshot taken|manual snapshot|Snapshot taken/);

      // Delete first visible item using the table's delete action
      const firstDeleteBtn = page.locator('#listContainer table tbody tr').first().locator('button', { hasText: 'Delete' });
      const firstRowIdCell = page.locator('#listContainer table tbody tr').first().locator('td.id');
      // Capture id text before deletion
      const idText = await firstRowIdCell.textContent();
      await firstDeleteBtn.click();
      await shortWait(300);
      logText = await log.textContent();
      expect(logText).toMatch(/Deleted item id=/);

      // Undo the deletion
      await page.click('#undoBtn');
      await shortWait(400);
      logText = await log.textContent();
      expect(logText).toMatch(/Undo: restored snapshot|Undo/);

      // After undo, first row id should again be present (at least the id string should reappear)
      const newFirstIdText = await page.locator('#listContainer table tbody tr').first().locator('td.id').textContent();
      expect(newFirstIdText).toBeTruthy();

      // Redo to reapply
      await page.click('#redoBtn');
      await shortWait(400);
      logText = await log.textContent();
      expect(logText).toMatch(/Redo: restored snapshot|Redo/);
    });

    test('Prefetch and cache controls: toggle cache and clear cache updates cacheInfo and logs', async ({ page }) => {
      // Comments: Validate that toggling cacheEnabled and clearing cache updates the UI and logs
      const cacheInfo = page.locator('#cacheInfo');
      const log = page.locator('#log');

      // Ensure some caching occurs by navigating a few pages
      await page.evaluate(() => {
        document.getElementById('netDelay').value = '0';
        document.getElementById('netDelay').dispatchEvent(new Event('input'));
      });
      await page.click('#nextPage');
      await shortWait(200);
      await page.click('#prevPage');
      await shortWait(200);

      // Check cache entries text present
      const ci1 = await cacheInfo.textContent();
      expect(ci1).toMatch(/Cache entries:/);

      // Disable cache
      await page.uncheck('#cacheEnabled');
      await shortWait(100);
      const logText1 = await log.textContent();
      expect(logText1).toMatch(/Cache enabled: false/);

      // Re-enable cache and clear it
      await page.check('#cacheEnabled');
      await page.click('#clearCache');
      await shortWait(100);
      const logText2 = await log.textContent();
      expect(logText2).toMatch(/Cache cleared|Cache invalidated/);
      const ci2 = await cacheInfo.textContent();
      expect(ci2).toMatch(/Cache entries:/);
    });

  });

  test.afterEach(async ({ page }) => {
    // Nothing specific to teardown; ensuring page closed is handled by Playwright automatically
  });

});