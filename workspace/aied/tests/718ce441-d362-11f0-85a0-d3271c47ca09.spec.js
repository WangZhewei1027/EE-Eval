import { test, expect } from '@playwright/test';

// URL of the served HTML page under test
const APP_URL =
  'http://127.0.0.1:5500/workspace/batch-1207/html/718ce441-d362-11f0-85a0-d3271c47ca09.html';

// Page Object representing the app UI
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Navigate to the application page and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // give any synchronous script errors a moment to surface
    await this.page.waitForTimeout(200);
  }

  // Return the text of the main H1 title
  async getTitleText() {
    return (await this.page.textContent('h1'))?.trim() ?? null;
  }

  // Check whether the chart container exists in the DOM
  async hasChartContainer() {
    const el = await this.page.$('.chart');
    return el !== null;
  }

  // Return bounding box dimensions of the chart container (or null if missing)
  async getChartBoundingBox() {
    const el = await this.page.$('.chart');
    if (!el) return null;
    return await el.boundingBox();
  }

  // Count common interactive elements that would indicate transitions/events
  async countInteractiveElements() {
    // buttons, inputs, selects, textareas, elements with role=button or anchors
    return await this.page.$$eval(
      'button, input, select, textarea, a[role="button"], [role="button"]',
      (els) => els.length
    );
  }

  // Count inline event handler attributes on the page (onclick, oninput, onchange, onsubmit, onmouseover)
  async countInlineEventAttributes() {
    return await this.page.$$eval(
      '[onclick], [oninput], [onchange], [onsubmit], [onmouseover], [onmouseout], [onkeydown]',
      (els) => els.length
    );
  }

  // Evaluate whether window.renderPage is defined (do NOT call it)
  async isRenderPageDefined() {
    return await this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }
}

test.describe('K-Means Clustering interactive application (FSM: Idle)', () => {
  // Collections to capture console events and uncaught page errors
  let pageErrors = [];
  let consoleEvents = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleEvents = [];

    // Capture uncaught exceptions reported by the page
    page.on('pageerror', (err) => {
      // err is an Error object; store its message for assertions
      try {
        pageErrors.push(String(err && err.message ? err.message : err));
      } catch (e) {
        pageErrors.push(String(err));
      }
    });

    // Capture console messages (log, error, warning, info, debug)
    page.on('console', (msg) => {
      // store type and text for later inspection
      consoleEvents.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.afterEach(async ({ page }) => {
    // ensure page is closed/reset between tests
    await page.close();
  });

  test('Initial render: Idle state content is present (title and chart)', async ({ page }) => {
    // Validate that the page renders the evidence for the Idle state:
    // "<h1>Customer Clustering</h1>" and "<div class=\"chart\"></div>"
    const app = new AppPage(page);
    await app.goto();

    // The main heading should be present and exactly match the expected text
    const title = await app.getTitleText();
    expect(title).toBe('Customer Clustering');

    // The chart container should be present in the DOM
    const hasChart = await app.hasChartContainer();
    expect(hasChart).toBe(true);

    // The chart container should have non-zero bounding box (CSS applied)
    const bbox = await app.getChartBoundingBox();
    expect(bbox).not.toBeNull();
    // width and height should both be positive numbers (CSS inlined in HTML sets dimensions)
    expect(bbox.width).toBeGreaterThan(0);
    expect(bbox.height).toBeGreaterThan(0);
  });

  test('No interactive elements or transitions exist (FSM has no transitions)', async ({ page }) => {
    // The FSM describes no transitions/events. Assert that there are no common interactive controls
    const app = new AppPage(page);
    await app.goto();

    // Count interactive elements like buttons, inputs, selects, and role=button occurrences
    const interactiveCount = await app.countInteractiveElements();
    expect(interactiveCount).toBe(0);

    // Count inline event attributes, which would indicate event handlers attached in HTML
    const inlineEventAttrs = await app.countInlineEventAttributes();
    expect(inlineEventAttrs).toBe(0);
  });

  test('Entry action "renderPage" is not defined on the window (do not call it)', async ({ page }) => {
    // FSM entry_actions listed renderPage() but the page implementation does not define it.
    // Verify the function is not present on window (without calling it)
    const app = new AppPage(page);
    await app.goto();

    const defined = await app.isRenderPageDefined();
    // We expect renderPage to be undefined (not present)
    expect(defined).toBe(false);
  });

  test('Script errors from external script and missing functions are reported (observe page errors and console)', async ({ page }) => {
    // The page's inline script uses marked.readCSV and KMeans which are unlikely to exist as used.
    // We must observe and assert that runtime errors are reported to the page (pageerror) or console.
    const app = new AppPage(page);

    await app.goto();

    // Wait briefly to allow any asynchronous console/pageerror handlers to fire
    await page.waitForTimeout(200);

    // There should be at least one page error due to the broken script (TypeError/ReferenceError)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one error message should mention either readCSV or KMeans or indicate a TypeError/ReferenceError
    const errorMessages = pageErrors.join(' | ');
    const matches = /readCSV|KMeans|not a function|ReferenceError|TypeError/i.test(errorMessages);
    expect(matches).toBe(true);

    // Also inspect captured console messages: console.error or console messages may contain clues
    const errorConsoleEntries = consoleEvents.filter((c) => c.type === 'error' || /error/i.test(c.text));
    // It's acceptable if there are no console.error entries as long as pageerror captured errors,
    // but prefer at least one console entry referencing the same issues if available.
    const combinedText = consoleEvents.map((c) => c.text).join(' | ');
    expect(/readCSV|KMeans|not a function|ReferenceError|TypeError/i.test(combinedText) || pageErrors.length > 0).toBe(true);
  });

  test('No cluster assignment logs should be present due to script error', async ({ page }) => {
    // The script would normally log "Cluster assignments:" then individual labels.
    // Because earlier code likely throws before clustering, assert that such logs are absent.
    const app = new AppPage(page);
    await app.goto();

    // Wait a moment for any console logs to appear
    await page.waitForTimeout(200);

    // Extract all console.log entries from previously captured consoleEvents
    const logMessages = consoleEvents.filter((c) => c.type === 'log').map((c) => c.text);

    // Ensure that "Cluster assignments:" is not present in console logs.
    // If it is present (unexpectedly), the test will fail to reflect that the script executed successfully.
    const foundClusterHeader = logMessages.some((t) => typeof t === 'string' && t.includes('Cluster assignments:'));
    expect(foundClusterHeader).toBe(false);
  });

  test('UI remains visible and usable (graceful degradation) despite runtime script errors', async ({ page }) => {
    // Even with script errors, the static UI (title and chart container) should remain accessible.
    const app = new AppPage(page);
    await app.goto();

    // Ensure the title remains visible
    const titleVisible = await page.isVisible('h1');
    expect(titleVisible).toBe(true);

    // Ensure the chart container is attached and visible
    const chartVisible = await page.isVisible('.chart');
    expect(chartVisible).toBe(true);
  });

  test('Edge case: verify that no unexpected inline cluster data is present in the DOM', async ({ page }) => {
    // The implementation expects cluster labels to be logged to the console and not necessarily injected in DOM.
    // Assert that there are no elements with classes or text that look like cluster labels.
    const app = new AppPage(page);
    await app.goto();

    // Search for any elements containing the phrase "Cluster" (case-insensitive)
    const containsClusterText = await page.$$eval('*', (els) =>
      els.some((el) => {
        try {
          return typeof el.textContent === 'string' && /cluster/i.test(el.textContent);
        } catch {
          return false;
        }
      })
    );

    // We expect only the H1 to contain "Customer Clustering" and no other cluster-specific DOM entries
    // Because the H1 contains 'Clustering', containsClusterText will be true, so we specifically ensure
    // that no additional non-heading elements contain "Cluster" outside the H1.
    const nonHeadingClusterCount = await page.$$eval('*:not(h1)', (els) =>
      els.filter((el) => {
        try {
          return typeof el.textContent === 'string' && /cluster/i.test(el.textContent);
        } catch {
          return false;
        }
      }).length
    );

    // There should be zero non-heading elements containing "cluster"
    expect(nonHeadingClusterCount).toBe(0);
  });
});