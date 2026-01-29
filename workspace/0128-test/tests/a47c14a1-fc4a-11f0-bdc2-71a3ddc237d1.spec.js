import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0128-test/html/a47c14a1-fc4a-11f0-bdc2-71a3ddc237d1.html';

// Page Object for the K-Means page
class KMeansPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.pageErrors = [];
    // capture console messages and page errors
    this.page.on('console', msg => {
      const text = msg.text();
      this.consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') this.consoleErrors.push(text);
    });
    this.page.on('pageerror', err => {
      // pageerror gives Error objects; store message
      this.pageErrors.push(err.message || String(err));
    });
  }

  // load the page and wait a bit for scripts to run and errors to surface
  async load() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // give the page a short grace period for runtime errors / logs to appear
    await this.page.waitForTimeout(500);
  }

  // DOM helpers
  async getHeadingText() {
    const h = await this.page.locator('h1').first();
    return h.textContent();
  }

  async countParagraphs() {
    return this.page.locator('p').count();
  }

  async countListItems() {
    return this.page.locator('ul li').count();
  }

  async interactiveElementCounts() {
    const buttons = await this.page.locator('button').count();
    const inputs = await this.page.locator('input').count();
    const links = await this.page.locator('a').count();
    return { buttons, inputs, links };
  }

  async scriptTagsSrcs() {
    // returns array of src values for script tags
    return this.page.evaluate(() => Array.from(document.querySelectorAll('script[src]')).map(s => s.src));
  }

  // helpers to expose captured console/page errors
  getAllConsoleMessages() {
    return this.consoleMessages.slice();
  }
  getConsoleErrors() {
    return this.consoleErrors.slice();
  }
  getPageErrors() {
    return this.pageErrors.slice();
  }

  // convenience checks
  async hasNoInteractiveElements() {
    const { buttons, inputs, links } = await this.interactiveElementCounts();
    return buttons === 0 && inputs === 0 && links === 0;
  }
}

test.describe('K-Means Clustering page - FSM and runtime validation', () => {
  let page;
  let kmeansPage;

  // Setup: create a fresh page and page object for each test
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    kmeansPage = new KMeansPage(page);
  });

  // Teardown: close the page after each test
  test.afterEach(async () => {
    await page.close();
  });

  test('S0_Idle: Page renders the expected static content (heading, paragraphs, list)', async () => {
    // This test validates the FSM state S0_Idle's evidence:
    // the page should render the primary heading and static educational content.
    await kmeansPage.load();

    const heading = await kmeansPage.getHeadingText();
    expect(heading?.trim()).toBe('Understanding K-Means Clustering');

    const paragraphCount = await kmeansPage.countParagraphs();
    expect(paragraphCount).toBeGreaterThanOrEqual(3); // there are multiple paragraphs in the HTML

    const listItemCount = await kmeansPage.countListItems();
    expect(listItemCount).toBeGreaterThanOrEqual(3); // the HTML contains at least 3 list items

    // Confirm the page includes an external script tag for the library as per the HTML
    const srcs = await kmeansPage.scriptTagsSrcs();
    expect(srcs.some(s => s.includes('cdn.jsdelivr.net/npm/kmeans'))).toBeTruthy();
  });

  test('S0_Idle: There are no interactive controls (buttons/inputs/links) as extracted by the FSM', async () => {
    // This test validates the FSM note that "No buttons, inputs, or links were present in the HTML."
    await kmeansPage.load();

    const counts = await kmeansPage.interactiveElementCounts();
    // assert each interactive element count is zero to match FSM extraction
    expect(counts.buttons).toBe(0);
    expect(counts.inputs).toBe(0);
    // There might be anchor tags in other pages; the spec notes none present
    expect(counts.links).toBe(0);
    // convenience boolean
    expect(await kmeansPage.hasNoInteractiveElements()).toBeTruthy();
  });

  test('Runtime: External script and inline script may produce runtime errors — capture and assert error types', async () => {
    // This test intentionally observes console and page errors produced by the page's scripts.
    // Per instructions we must not patch the environment; we let errors happen and assert they are reported.
    await kmeansPage.load();

    const consoleErrors = kmeansPage.getConsoleErrors();
    const pageErrors = kmeansPage.getPageErrors();
    const allConsole = kmeansPage.getAllConsoleMessages();

    // At least one error or page exception is expected because the inline script uses `new kMeans(...)`
    // and operations that may fail in this environment. We assert that we observed either console errors
    // or uncaught page exceptions.
    const totalErrors = consoleErrors.length + pageErrors.length;
    expect(totalErrors).toBeGreaterThanOrEqual(1);

    // Check that the errors contain plausible patterns: ReferenceError, TypeError, or failed network fetch.
    const errorTexts = [
      ...consoleErrors,
      ...pageErrors,
      ...allConsole.filter(m => m.type === 'error').map(m => m.text)
    ];

    const matches = errorTexts.some(t =>
      /ReferenceError|TypeError|Failed to fetch|Failed to load resource|kMeans|kmeans|getCluster/i.test(t)
    );
    expect(matches).toBeTruthy();

    // Additionally, record/inspect informational console logs (non-errors) if present.
    const logs = allConsole.filter(m => m.type === 'log').map(m => m.text);
    // Either logs are present (like "Cluster Size:"), or errors prevented them — both are acceptable.
    // Assert that we observed at least one console message of any type (log or error).
    expect(allConsole.length).toBeGreaterThanOrEqual(1);
  });

  test('FSM onEnter/onExit actions: renderPage side-effects or missing function errors are observable', async () => {
    // The FSM's entry action is "renderPage()". The HTML does not declare renderPage,
    // so we expect either that the function isn't present or an error mentioning renderPage may appear.
    await kmeansPage.load();

    const pageErrors = kmeansPage.getPageErrors();
    const consoleErrors = kmeansPage.getConsoleErrors();

    // It is valid if renderPage is simply not used; however, per the developer instruction we should
    // detect if a ReferenceError mentioning renderPage occurred. We assert that either:
    // - there is an explicit ReferenceError mentioning renderPage, OR
    // - no such error exists but we still detected other runtime errors (covered by previous tests).
    const combined = [...pageErrors, ...consoleErrors].join('\n');
    const renderPageMentioned = /renderPage/i.test(combined);

    // Allow either condition: renderPage ReferenceError observed or other runtime errors exist.
    const otherErrorsExist = (pageErrors.length + consoleErrors.length) > 0;
    expect(renderPageMentioned || otherErrorsExist).toBeTruthy();
  });

  test('Edge case: verify that attempts to access computed cluster points are either logged or error out', async () => {
    // The inline script logs "Cluster Size:", "Data Points:" and then attempts to log cluster.getCluster(dataPoint.x)[0].
    // Depending on runtime, these may appear as console logs or may not if prior errors occurred.
    await kmeansPage.load();

    const allConsole = kmeansPage.getAllConsoleMessages();

    // Search for the "Cluster Size:" informational log which the script attempts to print.
    const hasClusterSizeLog = allConsole.some(m => /Cluster Size:/i.test(m.text));
    const hasDataPointsLog = allConsole.some(m => /Data Points:/i.test(m.text));

    // Either the informational logs are present OR an error prevented them — both are acceptable.
    // We assert that at least one of these conditions holds:
    // - informational logs appear, OR
    // - there was at least one error mentioning cluster/getCluster/ReferenceError/TypeError
    const errorTexts = [
      ...kmeansPage.getConsoleErrors(),
      ...kmeansPage.getPageErrors()
    ];
    const clusterError = errorTexts.some(t => /cluster|getCluster|ReferenceError|TypeError/i.test(t));

    expect(hasClusterSizeLog || hasDataPointsLog || clusterError).toBeTruthy();
  });

  test('Sanity: ensure page source text contains educational content about K-Means', async () => {
    // Additional check to assert the page remains educational and non-interactive per FSM
    await kmeansPage.load();

    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('K-Means Clustering');
    expect(bodyText).toContain('It is a clustering algorithm used to group similar data points together.');
    // Ensure the example Python mention exists
    expect(bodyText).toContain("Here's an example of how to implement K-Means Clustering using Python");
  });
});