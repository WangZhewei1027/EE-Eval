import { test, expect } from '@playwright/test';

const PAGE_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/718a9a50-d362-11f0-85a0-d3271c47ca09.html';

test.describe('Breadth-First Search Example (FSM: S0_Idle)', () => {
  // Hold console messages and page errors observed during each test run
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors so tests can make assertions about them
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      // pageerror events represent uncaught exceptions in the page context
      pageErrors.push({ message: err.message, stack: err.stack });
    });

    // Navigate to the provided HTML page exactly as-is
    await page.goto(PAGE_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // nothing to teardown beyond Playwright's default fixtures
  });

  test('Initial render: Idle state should display the main heading', async ({ page }) => {
    // This validates the FSM initial state S0_Idle entry evidence: the H1 heading is present
    const h1 = await page.locator('h1').first();
    await expect(h1).toBeVisible();
    // The source HTML includes a leading space inside the <h1>, so do a trimmed containment check
    const h1Text = (await h1.textContent()) || '';
    expect(h1Text.trim()).toBe('Breadth-First Search Example');

    // Verify the descriptive paragraph is present
    const paragraphs = await page.locator('body > p').allTextContents();
    expect(paragraphs.length).toBeGreaterThanOrEqual(1);
    expect(paragraphs.join(' ')).toContain('This is an example of BFS to search for a given element in a tree.');

    // Ensure there were no unexpected uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Entry action renderPage() is not defined on window (verify onEnter behavior)', async ({ page }) => {
    // FSM entry action listed "renderPage()". The page HTML contains no script defining renderPage.
    // We check how the environment represents this function: it should be undefined.
    const renderPageType = await page.evaluate(() => {
      // Return the typeof the property to avoid throwing in the test runner
      return typeof window.renderPage;
    });
    expect(renderPageType).toBe('undefined');

    // This confirms that there is no implementation available for the declared entry action.
  });

  test('Calling missing renderPage() results in a natural TypeError in the page context', async ({ page }) => {
    // Intentionally attempt to call the entry action function in the page context.
    // We catch the error inside the page context and return its details so the test can assert on it.
    const callResult = await page.evaluate(() => {
      try {
        // Attempting to call an undefined value as a function will throw a TypeError in browsers.
        // We purposely don't patch or define anything; we let the natural error occur.
        // The call is wrapped in try/catch so the error does not become an uncaught pageerror.
        // This matches the instruction to let TypeError happen naturally and assert it.
        // eslint-disable-next-line no-undef
        const res = window.renderPage();
        return { success: true, result: res };
      } catch (e) {
        return { success: false, errorName: e && e.name, errorMessage: e && e.message };
      }
    });

    // Depending on the engine, calling undefined as a function yields a TypeError.
    expect(callResult.success).toBe(false);
    expect(callResult.errorName).toBe('TypeError');

    // The message usually contains 'is not a function' — assert at least that it exists.
    expect(typeof callResult.errorMessage).toBe('string');
    expect(callResult.errorMessage.length).toBeGreaterThan(0);
  });

  test('Page contains only static content: no interactive elements present', async ({ page }) => {
    // The FSM/extraction summary indicated no interactive elements.
    // Verify there are no common interactive controls on the page.
    const buttonCount = await page.locator('button').count();
    const inputCount = await page.locator('input, textarea, select').count();
    const anchorCount = await page.locator('a').count();
    const formCount = await page.locator('form').count();

    expect(buttonCount).toBe(0);
    expect(inputCount).toBe(0);
    // There may be anchors in general websites; this specific page claims no links, so expect 0
    expect(anchorCount).toBe(0);
    expect(formCount).toBe(0);
  });

  test('Example code is present as textual content (not executed)', async ({ page }) => {
    // The HTML shows several <p> tags containing code enclosed in backticks.
    // Verify those code snippets are present as text and not executed (no console logs expected).
    const bodyText = await page.locator('body').innerText();

    // Check for several code fragments visibly present in the page
    expect(bodyText).toContain("const tree = [");
    expect(bodyText).toContain("const node = tree.find(node => node.value === 'A');");
    expect(bodyText).toContain("console.log(node.value);");

    // Because these are presented as plain text (in <p>), they should not produce runtime console logs.
    // We assert there are no console messages of type 'log' that originate from executing those snippets.
    const logs = consoleMessages.filter(m => m.type === 'log');
    expect(logs.length).toBe(0);
  });

  test('FSM transitions and events: none expected and none present in the UI', async ({ page }) => {
    // The FSM defines no events or transitions. We validate that there's no UI to trigger transitions.
    // Check for presence of any elements that might represent transitions (e.g., buttons, links, controls)
    const interactiveElements = await page.locator('button, input, select, textarea, a[href], [role="button"]').count();
    expect(interactiveElements).toBe(0);

    // Also validate that there's only the single documented state (Idle) visible via the heading
    const headingText = (await page.locator('h1').textContent()) || '';
    expect(headingText).toContain('Breadth-First Search Example');

    // If transitions or events were implemented, we would likely see UI to trigger them; none exist.
  });

  test('Edge case: reloading the page should not introduce JS runtime errors', async ({ page }) => {
    // Reload the page and observe for uncaught exceptions (pageerror) on reload
    await page.reload({ waitUntil: 'load' });

    // Collect any page errors that might have occurred during reload
    // We set up listeners in beforeEach; ensure no uncaught page errors occurred on reload.
    expect(pageErrors.length).toBe(0);

    // Also ensure the main heading still exists after reload
    const h1After = await page.locator('h1').first();
    await expect(h1After).toBeVisible();
    expect((await h1After.textContent()).trim()).toBe('Breadth-First Search Example');
  });

  test('Sanity: observe console and page error streams (reporting)', async ({ page }) => {
    // This test simply exposes what was captured during the page lifecycle.
    // It asserts that no uncaught page errors bubbled up and that console messages, if any, are of expected types.
    // We expect the static page to produce zero or minimal console activity.
    const errorMessages = pageErrors.map(e => e.message);
    expect(errorMessages.length).toBe(0);

    // Ensure console messages, if any, do not include uncaught exceptions (they would have type 'error')
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // It's acceptable for some browsers to emit warnings; assert none are errors.
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });
});