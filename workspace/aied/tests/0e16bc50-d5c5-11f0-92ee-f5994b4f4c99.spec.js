import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e16bc50-d5c5-11f0-92ee-f5994b4f4c99.html';

test.describe('Adjacency List - FSM and page error handling', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console messages so tests can assert on them
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // store the Error or message for assertions
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Load the page as-is (do not modify or patch the page)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // detach listeners (Playwright will usually clean up, but keep it explicit)
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
  });

  test('Initial (S0_Idle) state: page renders heading and adjacencyList paragraph', async ({ page }) => {
    // Validate the static evidence for the Idle state:
    // - The <h2> heading with text "Adjacency List" should be present
    // - The <p id="adjacencyList"></p> element should exist and be empty
    const heading = page.locator('h2');
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveText('Adjacency List');

    const adjList = page.locator('#adjacencyList');
    await expect(adjList).toHaveCount(1);
    // The implementation adds list items via innerHTML; initially it should be empty string
    const inner = await adjList.evaluate((el) => el.innerHTML);
    expect(inner).toBe('');
  });

  test('Script parsing/definition errors are observable (SyntaxError expected)', async () => {
    // The provided HTML/JS contains an invalid function name "display adjacencyList"
    // which should cause a syntax error when the script is parsed. Assert that
    // a pageerror has been emitted and that its message reflects a syntax/parse issue.
    // We do not patch or fix the page; we let the error happen naturally.

    // Ensure at least one page error occurred
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Combine messages for easier matching
    const joined = pageErrors.map((e) => String(e)).join(' | ');
    // Expect the error message to indicate a syntax/parse problem (be permissive)
    expect(joined).toMatch(/(SyntaxError|Unexpected|identifier|display adjacencyList)/i);
  });

  test('Display event handler / transition cannot be triggered because displayButton is missing', async ({ page }) => {
    // The FSM defines a click event on #displayButton triggering the DisplayList transition.
    // In the provided HTML there is no #displayButton element; assert this and that attempts
    // to click fail (Playwright will throw when clicking a missing element).
    const buttonHandle = await page.$('#displayButton');
    expect(buttonHandle).toBeNull();

    // Attempt to click the missing button and assert that Playwright throws an error.
    // We expect an error message indicating the element could not be found.
    let clickError = null;
    try {
      await page.click('#displayButton', { timeout: 2000 });
    } catch (err) {
      clickError = err;
    }
    expect(clickError).not.toBeNull();
    expect(String(clickError.message)).toMatch(/(No node found|No element|failed to find|waiting for selector)/i);
  });

  test('addNode function is not available due to script parse failure; calling it throws ReferenceError', async ({ page }) => {
    // The addNode function is defined before the invalid function, but because the script block
    // contains a syntax error later the whole script may not execute, resulting in addNode being undefined.
    // Assert that typeof window.addNode is "undefined" and that attempting to call it results in a thrown error.

    const typeofAddNode = await page.evaluate(() => {
      try {
        return typeof window.addNode;
      } catch (e) {
        return `error:${String(e)}`;
      }
    });

    // We expect the function not to be available (likely "undefined")
    expect(typeofAddNode).toBe('undefined');

    // Attempt to call addNode via evaluate and assert that a ReferenceError/exception occurs
    let evalError = null;
    try {
      await page.evaluate(() => {
        // Intentionally call the function; this should fail in the page context naturally
        // and propagate back to Playwright as an exception.
        // We do not define or patch addNode here.
        // eslint-disable-next-line no-undef
        return addNode({ data: 'node data' });
      });
    } catch (e) {
      evalError = e;
    }

    expect(evalError).not.toBeNull();
    // The message should indicate that addNode is not defined / ReferenceError
    expect(String(evalError.message)).toMatch(/(addNode|not defined|ReferenceError)/i);
  });

  test('After failed script: adjacency list remains empty and no <li> items are present (S1 transition not executed)', async ({ page }) => {
    // Since the transition that appends "<li>node data</li>" cannot be executed,
    // ensure there are no <li> elements within the adjacencyList container.
    const liCount = await page.locator('#adjacencyList li').count();
    expect(liCount).toBe(0);

    // Ensure innerHTML still empty as a safety check
    const inner = await page.locator('#adjacencyList').evaluate((el) => el.innerHTML);
    expect(inner).toBe('');
  });

  test('Console messages captured (if any) and include helpful diagnostics', async () => {
    // We captured console messages during page load. At minimum, we should have an array (possibly empty).
    // This test doesn't assert a strict presence but validates that the capture mechanism works
    // and that any captured messages are strings.
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    for (const msg of consoleMessages) {
      expect(typeof msg.text).toBe('string');
      expect(msg.text.length).toBeGreaterThanOrEqual(0);
    }
  });

  test('Edge case: attempting to dispatch click event on non-existent element should not create new behavior', async ({ page }) => {
    // Instead of creating missing elements or patching the page, attempt to dispatch a click via JavaScript
    // on a selector that does not exist; this should either be a no-op or throw when accessed. We assert no new <li> were created.
    let dispatchError = null;
    try {
      await page.evaluate(() => {
        const el = document.querySelector('#displayButton');
        if (el) {
          el.click();
          return true;
        }
        // deliberately return null to indicate missing element; do not modify the DOM
        return null;
      });
    } catch (e) {
      dispatchError = e;
    }

    // No exception is strictly required here; if an exception occurred it must be reported.
    if (dispatchError) {
      expect(String(dispatchError.message)).toMatch(/(cannot read|is null|not a function|ReferenceError)/i);
    }

    // Confirm still no list items
    const liCount = await page.locator('#adjacencyList li').count();
    expect(liCount).toBe(0);
  });
});