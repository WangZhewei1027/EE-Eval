import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/71887770-d362-11f0-85a0-d3271c47ca09.html';

// Simple page object to encapsulate interactions with the Adjacency List page
class AdjacencyListPage {
  constructor(page) {
    this.page = page;
  }

  // Returns the Add Adjacency button handle
  async getAddButton() {
    return this.page.locator("button[onclick='addAdjacency()']");
  }

  // Clicks the Add Adjacency button
  async clickAddButton() {
    const btn = await this.getAddButton();
    await btn.click();
  }

  // Returns the page H1 text
  async getHeading() {
    return this.page.textContent('h1');
  }

  // Safely retrieve window.adjList (may be undefined if script failed)
  async getAdjList() {
    return this.page.evaluate(() => {
      // Accessing window.adjList inside evaluate; if undefined, returns undefined
      return window.adjList;
    });
  }
}

test.describe('Adjacency List FSM - End-to-end validation', () => {
  // We'll collect runtime pageerrors and console messages per test
  test.beforeEach(async ({ page }) => {
    // Attach listeners early to capture errors that happen during initial load
    page['_capturedPageErrors'] = [];
    page['_capturedConsoleMessages'] = [];

    page.on('pageerror', (err) => {
      // Capture the Error object/message for assertions
      page['_capturedPageErrors'].push(err);
    });

    page.on('console', (msg) => {
      // Capture console messages to help debug runtime behavior
      page['_capturedConsoleMessages'].push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Basic teardown: clear listeners (Playwright will remove them on new pages automatically,
    // but we explicitly remove references to avoid stale state in the test)
    page.removeAllListeners?.('pageerror');
    page.removeAllListeners?.('console');
  });

  test('S0_Idle: Page renders initial UI elements but initial script throws a runtime error', async ({ page }) => {
    // This test validates the initial state (S0_Idle) per FSM:
    // - The page should render the static UI elements (heading, button).
    // - The script in the page has issues (accessing element with id "n") and should produce a runtime error during load.
    const app = new AdjacencyListPage(page);

    // Verify heading is present and correct
    const heading = await app.getHeading();
    expect(heading).toBeTruthy();
    expect(heading.trim()).toBe('Adjacency List');

    // Verify Add Adjacency button exists
    const addBtn = await app.getAddButton();
    await expect(addBtn).toBeVisible();
    await expect(addBtn).toHaveText('Add Adjacency');

    // The implementation attempts to read document.getElementById("n").value immediately on load.
    // That should yield a runtime error (TypeError) captured by pageerror.
    // Ensure at least one page error was captured during navigation.
    const pageErrors = page['_capturedPageErrors'] || [];
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Look for an error message that indicates accessing `.value` on a null element.
    const messages = pageErrors.map(e => (e && e.message) || String(e));
    const hasNullReadError = messages.some(msg =>
      // Be permissive across browsers: look for keywords that indicate the root cause
      msg.includes('reading \'value\'') || msg.includes('Cannot read properties of null') || msg.includes('document.getElementById("n")')
    );
    expect(hasNullReadError).toBeTruthy();

    // Also confirm that because the script failed early, window.adjList was never defined
    const adjList = await app.getAdjList();
    expect(adjList).toBeUndefined();

    // Save a snapshot of the console for debugging if needed
    const consoleMessages = page['_capturedConsoleMessages'];
    // There may be no console messages; assert that our collector exists
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  test('Transition AddAdjacency: Clicking the Add Adjacency button triggers the AddAdjacency event and results in a ReferenceError because addAdjacency() is not defined', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_AdjacencyAdded when the user clicks the Add Adjacency button.
    // The page's script throws before the function is defined, so the click should cause a ReferenceError.

    const app = new AdjacencyListPage(page);

    // Clear previously captured page errors so we can focus on errors resulting from the click
    page['_capturedPageErrors'] = [];

    // Prepare to await the next pageerror triggered by the button click
    const [error] = await Promise.all([
      // Wait for the next pageerror event (the ReferenceError expected)
      page.waitForEvent('pageerror'),
      // Perform the user action: click the Add Adjacency button
      app.clickAddButton()
    ]);

    // Ensure we received an Error object
    expect(error).toBeTruthy();
    const errMsg = error.message || String(error);

    // We expect a ReferenceError because addAdjacency is not defined (script initialization failed)
    const isReferenceError = errMsg.includes('addAdjacency') || errMsg.includes('is not defined') || errMsg.toLowerCase().includes('referenceerror');
    expect(isReferenceError).toBeTruthy();

    // After the failed click, there should still be no adjList defined (since script didn't complete)
    const adjList = await app.getAdjList();
    expect(adjList).toBeUndefined();

    // Ensure the page did not navigate away or crash: button should still be visible and clickable (page remains interactive)
    const addBtn = await app.getAddButton();
    await expect(addBtn).toBeVisible();

    // Additional assertion: clicking again produces additional pageerror events (idempotent failure)
    const errorEventsBefore = (page['_capturedPageErrors'] || []).length;
    const nextErrorPromise = page.waitForEvent('pageerror');
    await app.clickAddButton();
    const secondError = await nextErrorPromise;
    expect(secondError).toBeTruthy();
    const secondMsg = secondError.message || String(secondError);
    expect(secondMsg).toContain('addAdjacency');
  });

  test('FSM coverage: verify expected states and transitions with runtime error evidence', async ({ page }) => {
    // This test ties the FSM expectations to observed runtime evidence:
    // - S0_Idle entry action in FSM was "renderPage()" but the HTML does not define or call it; we assert it wasn't invoked.
    // - Transition action addAdjacency() is referenced in the HTML by the button onclick attr; clicking it generated a ReferenceError.
    // - We assert the observed page errors map to the FSM evidence (script failure, missing addAdjacency).
    const app = new AdjacencyListPage(page);

    // Collect existing errors (from load)
    const initialErrors = page['_capturedPageErrors'] || [];
    const initialMessages = initialErrors.map(e => (e && e.message) || String(e));

    // Confirm initial load produced an error consistent with missing "n" element access
    const initialHasNError = initialMessages.some(m =>
      m.includes('reading \'value\'') || m.includes('Cannot read properties of null') || m.includes('getElementById')
    );
    expect(initialHasNError).toBeTruthy();

    // Confirm renderPage() was not invoked: there should not be any ReferenceError mentioning 'renderPage'
    const calledRenderPageError = initialMessages.some(m => m.includes('renderPage'));
    expect(calledRenderPageError).toBeFalsy();

    // Now trigger the AddAdjacency event via click and capture the resulting error
    const clickError = await page.waitForEvent('pageerror', { timeout: 2000, predicate: (e) => {
      const msg = (e && e.message) || String(e);
      return msg.includes('addAdjacency') || msg.toLowerCase().includes('referenceerror');
    } ,});
    expect(clickError).toBeTruthy();
    const clickMsg = clickError.message || String(clickError);

    // The FSM evidence mentions "adjList.push(pair);" as part of addAdjacency implementation.
    // Because addAdjacency did not execute, we assert that we do not find successful evidence of adjList being pushed.
    // In particular, ensure window.adjList is not an array with a newly appended element.
    const adjList = await app.getAdjList();
    expect(adjList).toBeUndefined();

    // Validate that the click error message references the missing function by name
    expect(clickMsg).toMatch(/addAdjacency/i);
  });

  test('Edge cases: multiple sequential clicks and error stability', async ({ page }) => {
    // Ensure that repeated user interactions produce consistent error behavior and do not mutate global state.
    const app = new AdjacencyListPage(page);

    // Reset captured errors to focus on this test
    page['_capturedPageErrors'] = [];

    // Perform multiple clicks and capture the resulting pageerrors
    const errorPromises = [];
    // We'll attempt 3 clicks; each click should generate a pageerror (ReferenceError)
    for (let i = 0; i < 3; i++) {
      errorPromises.push(page.waitForEvent('pageerror'));
      await app.clickAddButton();
    }

    // Await all errors
    const errors = await Promise.all(errorPromises);
    expect(errors.length).toBe(3);
    for (const err of errors) {
      const msg = err.message || String(err);
      // Each error should be related to addAdjacency not being defined
      expect(msg.toLowerCase()).toContain('addadjacency');
    }

    // After repeated failures, global state should remain unchanged (no adjacencies added)
    const adjList = await app.getAdjList();
    expect(adjList).toBeUndefined();
  });

  test('Sanity: page remains interactive after runtime errors (button still enabled)', async ({ page }) => {
    // Verify the UI remains interactive despite runtime errors (common robustness property)
    const app = new AdjacencyListPage(page);

    const addBtn = await app.getAddButton();
    await expect(addBtn).toBeEnabled();

    // Focus and blur to ensure basic interactions work
    await addBtn.focus();
    await addBtn.blur();

    // Confirm the page URL did not change
    expect(page.url()).toBe(APP_URL);
  });
});