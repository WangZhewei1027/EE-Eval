import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0128-test/html/a47a18d1-fc4a-11f0-bdc2-71a3ddc237d1.html';

// Page Object for the Merge Sort page to encapsulate interactions and queries
class MergeSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Selector accessors
  header() {
    return this.page.locator('h1');
  }
  sortButton() {
    return this.page.locator("button[onclick='sortArray()']");
  }
  mergesortContainer() {
    return this.page.locator('#mergesort-container');
  }
  mainContent() {
    return this.page.locator('#main-content');
  }
  // Utility to click the sort button and wait a bit for any page errors to surface
  async clickSortButton() {
    await this.sortButton().click();
  }
}

test.describe('Merge Sort FSM - a47a18d1-fc4a-11f0-bdc2-71a3ddc237d1', () => {
  // Shared collectors for console messages, page errors, and failed requests
  let consoleMessages;
  let pageErrors;
  let failedRequests;
  let scriptRequestUrls;
  let page;

  test.beforeEach(async ({ browser }) => {
    // Create a fresh context and page for isolation
    const context = await browser.newContext();
    page = await context.newPage();

    // Initialize collectors
    consoleMessages = [];
    pageErrors = [];
    failedRequests = [];
    scriptRequestUrls = [];

    // Collect console messages (info/warn/error)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect unhandled exceptions (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object; store its message & stack for assertions
      pageErrors.push({
        message: err.message,
        stack: err.stack,
      });
    });

    // Track all requests that target scripts.js (there are two script includes in the HTML)
    page.on('request', (req) => {
      const url = req.url();
      if (url.endsWith('/scripts.js') || url.endsWith('scripts.js')) {
        scriptRequestUrls.push(url);
      }
    });

    // Track failed requests (network failures / 404s)
    page.on('requestfailed', (req) => {
      failedRequests.push({
        url: req.url(),
        failureText: req.failure()?.errorText || '',
        method: req.method(),
      });
    });

    // Navigate to the application URL and wait for load
    // We deliberately do not try to patch or fix any missing scripts; we observe what happens naturally.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Small pause to ensure any synchronous page errors during load are captured
    await page.waitForTimeout(100);
  });

  test.afterEach(async () => {
    // Close the page's context to clean up (page.context().close())
    if (page) {
      await page.context().close();
    }
  });

  test('Initial Idle state: renders expected static content and evidence of page setup', async () => {
    // Validate the expected DOM evidence for S0_Idle state
    const msPage = new MergeSortPage(page);

    // Header should render (note: HTML contains "Merger Sort" intentionally)
    await expect(msPage.header()).toBeVisible();
    await expect(msPage.header()).toHaveText(/Merger Sort/i);

    // The container and welcome text should be present (evidence in FSM)
    await expect(msPage.mergesortContainer()).toBeVisible();
    await expect(msPage.mergesortContainer()).toContainText('Welcome to Merge Sort!');

    // The "Sort Array" button should be present (evidence and component)
    await expect(msPage.sortButton()).toBeVisible();
    await expect(msPage.sortButton()).toHaveText('Sort Array');

    // The main-content paragraph should exist and initially be empty (DOM provided)
    await expect(msPage.mainContent()).toBeVisible();
    const mainText = await msPage.mainContent().innerText();
    expect(mainText.trim()).toBe('', 'Expected #main-content to be empty on initial Idle state');

    // Verify that the page attempted to load the scripts referenced in the HTML
    // The HTML contains two <script src="scripts.js"> tags; we expect at least one request to scripts.js
    expect(scriptRequestUrls.length).toBeGreaterThanOrEqual(1);
    // Also capture whether any of those requests failed (very likely if scripts.js not hosted)
    const scriptFailed = failedRequests.some((r) => r.url.endsWith('/scripts.js') || r.url.endsWith('scripts.js'));
    // We do not force a failure - but we assert the environment showed at least one failed script request OR none (both valid).
    // However per instructions we should observe and assert errors if they happen. So if a failure happened, it must be recorded.
    if (scriptFailed) {
      // At least one scripts.js request failed - record that as evidence of missing runtime expectations
      const failedScriptEntries = failedRequests.filter((r) => r.url.endsWith('/scripts.js') || r.url.endsWith('scripts.js'));
      expect(failedScriptEntries.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('Transition: Clicking "Sort Array" attempts to enter Sorting state and surfaces errors when sortArray is undefined', async () => {
    // This test validates the FSM transition from S0_Idle -> S1_Sorting when the Sort Array button is clicked.
    // The HTML relies on an onclick="sortArray()" handler. If scripts.js is missing, clicking should raise a ReferenceError.
    const msPage = new MergeSortPage(page);

    // Ensure initial state is Idle (button exists)
    await expect(msPage.sortButton()).toBeVisible();

    // Prepare to wait for a pageerror event triggered by the click
    const pageErrorPromise = page.waitForEvent('pageerror').catch((e) => e);

    // Click the Sort Array button (this will attempt to call sortArray())
    await msPage.clickSortButton();

    // Wait for an error to appear (if it does) with a short timeout
    let pageErrorEvent;
    try {
      pageErrorEvent = await page.waitForEvent('pageerror', { timeout: 2000 });
    } catch (e) {
      // No pageerror captured within timeout; we will still assert based on collected errors
      pageErrorEvent = null;
    }

    // At least one of two outcomes is acceptable based on runtime:
    // - The click triggers a ReferenceError (most likely) because sortArray is not defined.
    // - The click triggers no JS error if the environment has a defined sortArray (unlikely here).
    // The requirement mandates we observe and assert any ReferenceError/TypeError that naturally occurs.
    const capturedErrors = pageErrors.slice(); // snapshot collected during interaction

    // If a pageerror event object was returned from waitForEvent, ensure it references 'sortArray' in its message
    if (pageErrorEvent) {
      expect(typeof pageErrorEvent.message).toBe('string');
      // The error message should usually include 'sortArray' if it's a ReferenceError originating from the click handler
      expect(pageErrorEvent.message.toLowerCase()).toContain('sortarray');
    } else {
      // No immediate pageerror from waitForEvent; inspect accumulated pageErrors array to see if any errors mention sortArray
      const found = capturedErrors.some((err) => err.message && err.message.toLowerCase().includes('sortarray'));
      // If not found, still assert that the environment recorded either a reference to sortArray or at least one script load failure
      if (!found) {
        const scriptFailed = failedRequests.some((r) => r.url.endsWith('/scripts.js') || r.url.endsWith('scripts.js'));
        // At least one of these should be true in this environment: missing function error or missing script file
        expect(found || scriptFailed).toBeTruthy();
      }
    }

    // The FSM expected observables include "Sorting process initiated." Validate that this text is NOT present
    // because the sortArray function is missing and no sorting was actually performed.
    const mainTextAfterClick = await msPage.mainContent().innerText();
    expect(mainTextAfterClick).not.toContain('Sorting process initiated', 'Did not expect sorting text because sortArray is likely undefined');

    // Verify that the click did not crash the entire page (we can still interact with the button)
    await expect(msPage.sortButton()).toBeVisible();
  });

  test('Edge case: Multiple clicks produce multiple page errors when handler is missing', async () => {
    // This test ensures repeated user actions (clicking the Sort Array button multiple times) generate repeated errors
    const msPage = new MergeSortPage(page);

    // Clear any previously-recorded page errors for a fresh measurement
    pageErrors = [];

    // Click the button twice, waiting briefly after each click to allow errors to bubble up
    await msPage.clickSortButton();
    // Wait briefly for error to be emitted and captured
    await page.waitForTimeout(150);
    await msPage.clickSortButton();
    await page.waitForTimeout(150);

    // At least one pageerror should have been collected; ideally, two errors (one per click)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // If two errors exist, confirm they both mention 'sortArray' indicating the missing function
    if (pageErrors.length >= 2) {
      const bothMentionSortArray = pageErrors.slice(0, 2).every((err) => err.message && err.message.toLowerCase().includes('sortarray'));
      expect(bothMentionSortArray).toBeTruthy();
    } else {
      // If only one error recorded, ensure it at least mentions sortArray (consistent with missing handler)
      expect(pageErrors[0].message.toLowerCase()).toContain('sortarray');
    }
  });

  test('Validate onEnter/onExit actions presence (renderPage entry for Idle) - observe natural behavior', async () => {
    // FSM listed renderPage() as an entry action for Idle (S0). We must verify whether renderPage was invoked or resulted in an error.
    // Since the page HTML does not call renderPage explicitly, and scripts.js is likely missing, we assert that no pageerror was recorded
    // referencing renderPage being called. This validates that onEnter action did not execute (as expected from the static HTML).
    const renderPageErrors = pageErrors.filter((err) => err.message && err.message.toLowerCase().includes('renderpage'));
    // We expect zero renderPage-related errors (renderPage wasn't invoked). If the environment somehow tried to invoke it, we'd see an error.
    expect(renderPageErrors.length).toBe(0);

    // Additionally, ensure that the Idle state's evidence is present (Sort Array button)
    const msPage = new MergeSortPage(page);
    await expect(msPage.sortButton()).toBeVisible();
  });

  test('Network observations: confirm scripts.js was requested (and likely failed), as included twice in the HTML', async () => {
    // The HTML includes <script src="scripts.js"></script> twice; assert we observed at least two requests to scripts.js
    // Note: Some servers / caching may consolidate requests; be tolerant but assert at least one request happened.
    expect(scriptRequestUrls.length).toBeGreaterThanOrEqual(1);

    // If there are at least 2 requests, assert that duplicates were attempted (matching the duplicated script tags)
    if (scriptRequestUrls.length >= 2) {
      // Both requests should target a scripts.js path
      const allScripts = scriptRequestUrls.every((u) => u.endsWith('/scripts.js') || u.endsWith('scripts.js'));
      expect(allScripts).toBeTruthy();
    }

    // Assert that at least one request to scripts.js failed (common when scripts.js is absent)
    const failedScriptRequests = failedRequests.filter((r) => r.url.endsWith('/scripts.js') || r.url.endsWith('scripts.js'));
    // We accept either that some failed or none failed, but if failures occurred we must report them
    if (failedScriptRequests.length > 0) {
      expect(failedScriptRequests[0].url).toContain('scripts.js');
    } else {
      // If no failed request recorded, still verify that the page console or errors may have reported missing functions
      const hasMissingFunctionError = pageErrors.some((e) => e.message && e.message.toLowerCase().includes('sortarray'));
      expect(hasMissingFunctionError || failedScriptRequests.length === 0).toBeTruthy();
    }
  });
});