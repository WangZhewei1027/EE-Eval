import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520946f3-fa76-11f0-a09b-87751f540fd8.html';

/**
 * Page Object for the Floyd-Warshall demo page.
 * Encapsulates common interactions and queries used by the tests.
 */
class FloydWarshallPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '#run-floyd-warshall';
    this.graphSelector = '#graph';
    this.headingSelector = 'h1';
    // Containers for events captured during a test
    this.consoleMessages = [];
    this.pageErrors = [];
    this._consoleListener = (msg) => {
      // capture text for assertions
      try {
        this.consoleMessages.push({ type: msg.type(), text: msg.text(), args: msg.args() });
      } catch (e) {
        // Defensive: in case msg.args() triggers cross-context issues
        this.consoleMessages.push({ type: msg.type(), text: msg.text(), args: [] });
      }
    };
    this._pageErrorListener = (err) => {
      this.pageErrors.push(err);
    };
  }

  // Navigate to the application and attach listeners to collect console and error events
  async goto() {
    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
    // Ensure full load so script execution happens
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Small pause to allow any initial async logs/errors to surface
    await this.page.waitForTimeout(50);
  }

  // Remove listeners (cleanup)
  detachListeners() {
    this.page.removeListener('console', this._consoleListener);
    this.page.removeListener('pageerror', this._pageErrorListener);
  }

  // Click the run button
  async clickRun() {
    return this.page.click(this.buttonSelector);
  }

  // Return heading text
  async getHeadingText() {
    return this.page.textContent(this.headingSelector);
  }

  // Check if run button is visible
  async isRunButtonVisible() {
    return this.page.isVisible(this.buttonSelector);
  }

  // Get graph innerHTML
  async getGraphInnerHTML() {
    return this.page.$eval(this.graphSelector, el => el.innerHTML);
  }

  // Get collected console texts
  getConsoleTexts() {
    return this.consoleMessages.map(c => c.text);
  }

  // Get collected page errors
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Floyd-Warshall Algorithm - FSM and Implementation Tests', () => {
  // Each test gets a fresh Playwright page fixture.
  test.afterEach(async ({ page }) => {
    // Attempt to remove any listeners that may remain to avoid cross-test leakage.
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('S0_Idle: Page renders correctly and Run button is present (entry: renderPage)', async ({ page }) => {
    // Test validates the Idle state (initial render) as described in the FSM:
    // - Page loads
    // - The "Run Floyd-Warshall Algorithm" button exists
    // - Basic page structure (heading, graph container) is present
    // Note: The page's script auto-runs the algorithm on load. We still assert DOM presence.
    const fw = new FloydWarshallPage(page);
    await fw.goto();

    // Verify heading text is present
    const heading = await fw.getHeadingText();
    expect(heading).toBeTruthy();
    expect(heading.trim()).toContain('Floyd-Warshall');

    // Verify run button exists and is visible
    const visible = await fw.isRunButtonVisible();
    expect(visible).toBe(true);

    // Verify graph container exists and initially does not contain the matrix HTML
    // The implementation attempts to render later, but may fail. We assert it doesn't yet contain table rows.
    const graphHtml = await fw.getGraphInnerHTML();
    expect(graphHtml).not.toContain('<tr><td>');
    // Clean up listeners for this test
    fw.detachListeners();
  });

  test('S1_AlgorithmRunning: Running the algorithm logs "Shortest Distances:" to console (entry: runFloydWarshall)', async ({ page }) => {
    // This test validates that the algorithm's run function logs progress to the console.
    // The page auto-runs on load; we will also explicitly click the button to trigger it again.
    const fw1 = new FloydWarshallPage(page);
    await fw.goto();

    // There should be at least one console message from the auto-run.
    const initialConsole = fw.getConsoleTexts();
    // One expected message is "Shortest Distances:" from the algorithm
    const hasShortestLogInitial = initialConsole.some(text => text.includes('Shortest Distances:'));
    expect(hasShortestLogInitial).toBe(true);

    // Now explicitly click the button to simulate the user-driven RunAlgorithm event
    // Capture the next console message triggered by the click.
    const [consoleEvent] = await Promise.all([
      page.waitForEvent('console'),
      fw.clickRun()
    ]);

    // The console event triggered by click should contain the expected log text.
    const clickedConsoleText = consoleEvent.text();
    expect(clickedConsoleText).toEqual(expect.stringContaining('Shortest Distances:'));

    // After click, also ensure we collected at least one page error or log (the implementation may throw)
    // We don't assert failure here; just ensure we observed runtime activity.
    const postClickConsole = fw.getConsoleTexts();
    expect(postClickConsole.length).toBeGreaterThanOrEqual(initialConsole.length);

    fw.detachListeners();
  });

  test('S2_AlgorithmCompleted: The intended DOM update is attempted but implementation errors; capture TypeError and verify no matrix inserted', async ({ page }) => {
    // The FSM expects an AlgorithmCompleted transition that renders matrixHtml into #graph.
    // The implementation, however, contains a runtime issue when converting result to matrix that will throw a TypeError.
    // This test asserts that:
    // - The algorithm logs the result to the console before failing
    // - A TypeError occurs (observed as a pageerror)
    // - The graph container was NOT populated with the expected matrix HTML
    const fw2 = new FloydWarshallPage(page);
    await fw.goto();

    // Wait for the console log "Shortest Distances:" (should have occurred on load)
    // If it hasn't yet, wait up to a short timeout for it.
    let sawShortest = fw.getConsoleTexts().some(t => t.includes('Shortest Distances:'));
    if (!sawShortest) {
      // wait briefly for another console message to arrive from the page
      const c = await page.waitForEvent('console', { timeout: 1000 });
      sawShortest = c.text().includes('Shortest Distances:') || fw.getConsoleTexts().some(t => t.includes('Shortest Distances:'));
    }
    expect(sawShortest).toBe(true);

    // The implementation logs the result object to console before the failing line.
    const printedResult = fw.getConsoleTexts().some(t => t.includes('Shortest Distances:') || t.includes('Object') || t.includes('{'));
    expect(printedResult).toBe(true);

    // Wait for a pageerror to be emitted indicating the runtime TypeError.
    // The page may have already emitted the pageerror; check collected errors first.
    let errors = fw.getPageErrors();
    if (errors.length === 0) {
      // Wait for the next pageerror event if none recorded yet
      try {
        const err = await page.waitForEvent('pageerror', { timeout: 1000 });
        errors = [err];
      } catch (e) {
        // Timeout - proceed to assertions which will fail if no error was captured
      }
    }

    // There should be at least one page error and it should be a TypeError (per the broken code)
    expect(errors.length).toBeGreaterThan(0);
    const anyTypeError = errors.some(e => e && (e.name === 'TypeError' || (typeof e === 'object' && e.message && e.message.includes('is not a function'))));
    expect(anyTypeError).toBe(true);

    // Finally, assert that the graph container does NOT contain the expected matrix markup,
    // because the code's TypeError prevents the line that sets innerHTML from executing.
    const graphHtml1 = await fw.getGraphInnerHTML();
    expect(graphHtml).not.toContain('<tr><td>');
    expect(graphHtml.length).toBeLessThan(200); // should be small / empty

    fw.detachListeners();
  });

  test('Edge cases: Multiple runs (multiple clicks) reproduce runtime errors and produce multiple console logs', async ({ page }) => {
    // This test validates robustness and error-repeat behavior:
    // - Clicking the run button multiple times should re-trigger the function and produce logs/errors repeatedly.
    const fw3 = new FloydWarshallPage(page);
    await fw.goto();

    // Clear any initial console captures we don't want to mix into counts (recreate page object listeners)
    fw.consoleMessages = [];
    fw.pageErrors = [];

    // Perform multiple clicks and ensure we see both console output and a TypeError for at least one click.
    const clickCount = 3;
    const consoleEvents = [];
    const errorEvents = [];

    // Attach short-lived listeners that push events to local arrays for this sequence
    const pushConsole = (msg) => consoleEvents.push(msg.text());
    const pushError = (err) => errorEvents.push(err);

    page.on('console', pushConsole);
    page.on('pageerror', pushError);

    for (let i = 0; i < clickCount; i++) {
      await Promise.all([
        page.waitForEvent('console').catch(() => null),
        page.waitForEvent('pageerror').catch(() => null),
        fw.clickRun()
      ]);
      // small wait between clicks to allow processing
      await page.waitForTimeout(50);
    }

    // At least one console output should contain the "Shortest Distances:" message across the clicks
    const foundShortest = consoleEvents.some(t => t.includes && t.includes('Shortest Distances:'));
    expect(foundShortest).toBe(true);

    // At least one error should have occurred and be a TypeError
    const foundTypeError = errorEvents.some(e => e && (e.name === 'TypeError' || (e.message && e.message.includes('is not a function'))));
    expect(foundTypeError).toBe(true);

    // Clean up attached listeners for this test
    page.removeListener('console', pushConsole);
    page.removeListener('pageerror', pushError);
    fw.detachListeners();
  });
});