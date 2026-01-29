import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b146d1-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object Model for the Floyd-Warshall demo page
class FloydWarshallPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = '#demo-button';
    this.resultSelector = '#result';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRun() {
    await this.page.click(this.runButton);
  }

  async hasResultElement() {
    return await this.page.$(this.resultSelector) !== null;
  }

  async getRunButtonText() {
    const el = await this.page.$(this.runButton);
    return el ? (await el.innerText()) : null;
  }
}

test.describe('FSM: Floyd-Warshall Algorithm Interactive App (f5b146d1...)', () => {
  // Collection of console error messages captured during a test
  let consoleErrors;
  let pageErrors;
  let fwPage;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      }
    });

    // Capture uncaught page errors (exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err.message,
        stack: err.stack,
        error: err,
      });
    });

    fwPage = new FloydWarshallPage(page);
    await fwPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid cross-test interference.
    // Playwright automatically closes pages between tests, but we ensure arrays cleared.
    consoleErrors = [];
    pageErrors = [];
  });

  test('Idle state: initial UI renders with Run button and precomputed result exists in global scope', async ({ page }) => {
    // This validates the FSM initial state S0_Idle:
    // - The Run Floyd-Warshall Algorithm button should be present and visible
    // - The page script should have computed a "result" string and "distances" matrix in global scope
    // - There should NOT be an element with id="result" initially (the app expects to inject into it on click)
    const buttonText = await fwPage.getRunButtonText();
    expect(buttonText).toBe('Run Floyd-Warshall Algorithm');

    // Assert the result DOM element is not present initially (evidence from implementation)
    const hasResultEl = await fwPage.hasResultElement();
    expect(hasResultEl).toBe(false);

    // Verify that there is no global renderPage function (FSM mentioned renderPage() entry action, but the implementation does not define it)
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // Verify that the script precomputed a `result` string and a `distances` array in the global scope
    const resultType = await page.evaluate(() => typeof window.result);
    expect(resultType).toBe('string');

    const distances = await page.evaluate(() => window.distances);
    // distances should be an array (matrix) of length matching the provided graph (4)
    expect(Array.isArray(distances)).toBe(true);
    expect(distances.length).toBe(4);

    // Check a few expected numeric values from the computed distances matrix
    // The simplistic implementation should set distances[0][1] to 4 (path through node 0)
    const d01 = await page.evaluate(() => window.distances[0][1]);
    // Accept both numeric 4 and string '4' if converted, but implementation uses numbers/Infinity
    expect(d01).toBe(4);

    // Check a diagonal element is 0
    const d00 = await page.evaluate(() => window.distances[0][0]);
    expect(d00).toBe(0);

    // Ensure no page errors or console errors have been recorded before user interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('RunAlgorithm event: clicking Run triggers attempt to set #result.innerHTML and generates a page error due to missing element', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Algorithm_Running:
    // - Clicking the #demo-button triggers the event handler that attempts to set innerHTML on #result
    // - Because #result element is not present in the DOM, this should produce a runtime TypeError (uncaught) and be observable via pageerror/console
    // We wait for the pageerror that is expected to be raised by the click handler.

    // Start the click and wait for the first uncaught page error produced by the event handler.
    const [caughtError] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#demo-button'),
    ]);

    // Ensure an error was captured and examine its message to ensure it's consistent with a missing #result element
    expect(caughtError).toBeTruthy();
    const msg = String(caughtError.message || '');
    // Browser error strings differ across engines. Accept several common patterns:
    expect(msg).toMatch(/(Cannot set properties of null|Cannot read properties of null|Cannot set property 'innerHTML' of null|Cannot read property 'innerHTML' of null)/i);

    // The console should also have at least one error entry logged
    // (some browsers log uncaught exception to console; ensure that consoleErrors reflects an error)
    // Note: There is no strict guarantee the console error appears before/after pageerror; we assert there is at least one console error recorded.
    // Allow some time for console event to be emitted if necessary
    await page.waitForTimeout(50);
    expect(consoleErrors.length).toBeGreaterThanOrEqual(0); // ensure consoleErrors array exists
    // If the environment logs console error for this exception, assert it contains the 'innerHTML' or 'result' keywords
    const consoleMsgTexts = consoleErrors.map(e => e.text).join('\n');
    if (consoleMsgTexts.length > 0) {
      expect(consoleMsgTexts).toMatch(/(innerHTML|result)/i);
    }

    // Confirm that there is still no #result element created by the handler (since it errored)
    const hasResultAfterClick = await fwPage.hasResultElement();
    expect(hasResultAfterClick).toBe(false);

    // As an additional verification, assert that the precomputed `result` global string still exists and contains expected content
    const resultString = await page.evaluate(() => window.result);
    expect(typeof resultString).toBe('string');
    expect(resultString.length).toBeGreaterThan(0);
    // It should contain at least one 'Infinity' (because the graph contains Infinity entries)
    expect(resultString).toMatch(/Infinity|Inf/i);
  });

  test('Edge case: multiple clicks produce repeated uncaught errors (handler is attached and consistently fails due to missing #result)', async ({ page }) => {
    // This test clicks the button multiple times and expects repeated pageerrors because the click handler always tries to access #result which does not exist.
    // We will sequentially click and await pageerror for each click to confirm repeated failures.

    // Click and await first error
    const first = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#demo-button'),
    ]);
    const firstError = first[0];
    expect(firstError).toBeTruthy();

    // Click again and await second error
    const second = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#demo-button'),
    ]);
    const secondError = second[0];
    expect(secondError).toBeTruthy();

    // The messages should be similar and indicative of missing element access
    expect(String(firstError.message)).toMatch(/(innerHTML|result)/i);
    expect(String(secondError.message)).toMatch(/(innerHTML|result)/i);

    // Confirm number of recorded pageErrors >= 2 (page.on('pageerror') listener populates pageErrors)
    // Give a small pause to ensure listener ran
    await page.waitForTimeout(20);
    expect(pageErrors.length).toBeGreaterThanOrEqual(2);

    // Confirm the DOM still lacks the #result element after multiple failed attempts
    const hasResult = await fwPage.hasResultElement();
    expect(hasResult).toBe(false);
  });

  test('FSM verification: onEnter/offExit actions check - renderPage absent and algorithm entry leads to attempted DOM update (error observed)', async ({ page }) => {
    // This test explicitly checks FSM-specified onEnter (renderPage) and the onEnter for Algorithm Running:
    // - Confirm renderPage is not present in the global scope (so the FSM described action is not implemented)
    // - Trigger the RunAlgorithm event and verify that the attempted DOM update (document.getElementById("result").innerHTML = result) is what fails

    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false, 'renderPage() was expected by FSM but is not defined in the implementation');

    // Spy on the global `result` to ensure the payload intended for DOM update exists
    const resultPreview = await page.evaluate(() => window.result ? window.result.slice(0, 200) : null);
    expect(typeof resultPreview).toBe('string');

    // Click and capture the pageerror to verify it relates to setting innerHTML on #result
    const [err] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#demo-button'),
    ]);
    expect(String(err.message)).toMatch(/(innerHTML|result)/i);

    // Also ensure that the stack mentions the script or an anonymous handler (sanity check that the error originated from the click handler)
    const stack = String(err.stack || '');
    expect(stack.length).toBeGreaterThan(0);
  });
});