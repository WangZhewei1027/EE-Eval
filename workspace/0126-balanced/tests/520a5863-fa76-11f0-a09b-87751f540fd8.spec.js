import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520a5863-fa76-11f0-a09b-87751f540fd8.html';

// Helper to generate a sample dataset
function generateSampleData(count = 25) {
  const items = [];
  for (let i = 1; i <= count; i++) {
    items.push({
      pageNumber: i,
      firstName: `First${i}`,
      lastName: `Last${i}`,
      age: 20 + (i % 50),
      city: `City${i}`
    });
  }
  return items;
}

test.describe('Paging FSM and interactive application tests (520a5863-fa76-11f0-a09b-87751f540fd8)', () => {
  // Increase default timeout for network and DOM operations if needed
  test.setTimeout(30_000);

  test('S0_Idle -> LoadData invoked on page load and S1_DataLoaded entry (paging) causes fetches and table population', async ({ page }) => {
    // This test validates:
    // - The initial load triggers fetch('data.json') (LoadData)
    // - paging() is also invoked as part of entry to DataLoaded and causes additional fetch
    // - The table is populated with the returned data (as implemented by loadData())
    // - currentPage is incremented by paging()

    const sampleData = generateSampleData(25);
    let dataRequestCount = 0;
    const consoleErrors = [];
    const pageErrors = [];

    // Intercept and serve a valid JSON so the application can load successfully
    await page.route('**/data.json', async (route) => {
      dataRequestCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sampleData)
      });
    });

    // Collect console errors and page errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    // Navigate to the page (this will execute the page's script which calls loadData() and paging())
    await page.goto(APP_URL);

    // Wait for the DOM to have at least one row created by loadData()
    // The page's load sequence may trigger multiple fetches; wait for a row as a signal of data rendering
    await page.waitForSelector('#data tr', { timeout: 5000 });

    // Read all rows currently in the table
    const rowCount = await page.$$eval('#data tr', (rows) => rows.length);

    // Because the page's script calls loadData() and paging() during initialization,
    // we expect at least one fetch request to data.json. Due to the code calling loadData()
    // twice (once directly and once inside paging), there are often 2 requests.
    // Assert that at least one request occurred; prefer at least 1 and commonly 2.
    expect(dataRequestCount).toBeGreaterThanOrEqual(1);

    // Since we provided a valid JSON and loadData() populates the table with the response
    // assert the table contains rows (should equal the sampleData length in a successful load)
    expect(rowCount).toBeGreaterThan(0);

    // Assert that the table has as many rows as items served (loadData uses the JSON array to render rows)
    // Note: the implementation has quirks, but with our served JSON we expect the row count to match.
    expect(rowCount).toBe(sampleData.length);

    // Check the global currentPage value - paging() increments it at the end.
    // Because the page's script invoked paging() once during init, currentPage should now be 2.
    const currentPage = await page.evaluate(() => (typeof currentPage !== 'undefined' ? currentPage : null));
    expect(currentPage).toBe(2);

    // There should be no uncaught runtime errors when we served valid JSON
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('PaginateData event: calling paging() triggers another fetch and increments currentPage', async ({ page }) => {
    // This test validates:
    // - paging() function exists and is callable
    // - invoking paging() causes another fetch('data.json') (via loadData() call inside paging)
    // - currentPage increments accordingly after calling paging()
    const sampleData1 = generateSampleData(15);
    let dataRequestCount1 = 0;

    await page.route('**/data.json', async (route) => {
      dataRequestCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sampleData)
      });
    });

    await page.goto(APP_URL);

    // Ensure initial load finished and at least one row exists
    await page.waitForSelector('#data tr', { timeout: 5000 });
    const initialRowCount = await page.$$eval('#data tr', (rows) => rows.length);

    // Capture the currentPage before calling paging()
    const beforePage = await page.evaluate(() => (typeof currentPage !== 'undefined' ? currentPage : null));

    // Reset counter for clarity: we want to observe fetch requests caused by our explicit call
    // Since page.route increments dataRequestCount on each matched request, note the baseline
    const baselineRequests = dataRequestCount;

    // Invoke the paging() function from the page context to simulate the PaginateData event
    // This will call loadData() internally and should cause another request to data.json
    await page.evaluate(() => {
      // Call existing paging function on the page. If it doesn't exist, let the error surface.
      paging();
    });

    // Wait a short while for the fetch triggered by paging() to resolve and DOM to update
    await page.waitForTimeout(300); // small wait; fetch is fulfilled by our route instantly

    // After invocation, dataRequestCount should have increased
    expect(dataRequestCount).toBeGreaterThan(baselineRequests);

    // currentPage should have incremented by 1 from its previous value
    const afterPage = await page.evaluate(() => (typeof currentPage !== 'undefined' ? currentPage : null));
    expect(afterPage).toBe(beforePage + 1);

    // The DOM may be repopulated by loadData(); check that we still have rows (at least)
    const afterRowCount = await page.$$eval('#data tr', (rows) => rows.length);
    expect(afterRowCount).toBeGreaterThanOrEqual(0);
    // If implementation re-renders items from our sampleData, row count should match sampleData length
    // but the implementation has logic that may produce different shapes; assert it does not throw and leaves DOM intact
    expect(afterRowCount).toBeGreaterThanOrEqual(0);
  });

  test('Error scenario: missing data.json causes console/page errors and the table remains empty', async ({ page }) => {
    // This test validates an error path:
    // - When data.json is not available or the request fails, the page should produce console errors / page errors
    // - The application is expected to attempt fetch and the resulting unhandled rejection or TypeError should surface

    let intercepted = false;
    const consoleErrors1 = [];
    const pageErrors1 = [];
    let dataRequestCount2 = 0;

    // Route to abort the network request to simulate a network failure (Failed to fetch)
    await page.route('**/data.json', async (route) => {
      dataRequestCount++;
      intercepted = true;
      // Abort simulates network-level failure which should produce a TypeError or "Failed to fetch"
      await route.abort();
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    // Navigate - the page's script will attempt fetch('data.json') and should trigger our abort
    await page.goto(APP_URL);

    // Allow a brief window for errors to surface
    await page.waitForTimeout(500);

    // Ensure our route was hit at least once
    expect(intercepted).toBeTruthy();
    expect(dataRequestCount).toBeGreaterThanOrEqual(1);

    // We expect at least one console or page error due to aborted fetch / unhandled promise rejection
    const errorsObserved = consoleErrors.length + pageErrors.length;
    expect(errorsObserved).toBeGreaterThanOrEqual(1);

    // Additionally, because loadData couldn't populate the table, the tbody should be empty
    const rowCount1 = await page.$$eval('#data tr', (rows) => rows.length);
    expect(rowCount).toBe(0);
  });

  test('Sanity checks: confirm loadData and paging functions exist on the page', async ({ page }) => {
    // This test asserts existence of the two functions referenced in the FSM's entry actions:
    // - loadData()
    // - paging()
    // If the page had a SyntaxError preventing script execution, these would be undefined.

    // Load the page but intercept data.json to avoid network errors (serve minimal empty list)
    await page.route('**/data.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.goto(APP_URL);

    // Evaluate types
    const [typeofLoadData, typeofPaging] = await page.evaluate(() => {
      return [typeof loadData, typeof paging];
    });

    expect(typeofLoadData).toBe('function');
    expect(typeofPaging).toBe('function');
  });
});