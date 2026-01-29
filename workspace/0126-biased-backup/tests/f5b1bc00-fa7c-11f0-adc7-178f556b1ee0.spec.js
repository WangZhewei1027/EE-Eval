import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b1bc00-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Backtracking Interactive Application (f5b1bc00-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Containers to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Attach listeners and navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages with their types and texts
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case msg.text() throws for some exotic console entry, record a fallback
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught page errors (exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Load the application page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Give a moment for any immediate script-driven console logs to appear
    // (the page calls backtrack on load)
    await page.waitForTimeout(150);
  });

  // Tear down: nothing special required — Playwright fixtures handle page lifecycle

  test('Initial load: page contains Backtrack button and script call evidence', async ({ page }) => {
    // This test validates:
    // - The Backtrack button exists in the DOM (S0_Idle evidence)
    // - The script contains an explicit call to backtrack(cities[0], path);
    // - The initial script execution produced console logs consistent with backtracking starting on load

    // Verify Backtrack button exists and is visible
    const backtrackButton = await page.locator('#backtracking-button');
    await expect(backtrackButton).toBeVisible();
    await expect(backtrackButton).toHaveText('Backtrack');

    // Check the script source/content includes the explicit call evidence
    const pageHtml = await page.content();
    expect(pageHtml).toContain('backtrack(cities[0], path);');

    // Check console logs include expected evidence of backtracking execution on load.
    // We expect at least one "Current city:" log and at least one "Found solution!"
    const texts = consoleMessages.map((m) => m.text);
    const hasCurrentCity = texts.some((t) => t.includes('Current city:'));
    const hasFoundSolution = texts.some((t) => t.includes('Found solution!'));

    expect(hasCurrentCity).toBeTruthy();
    expect(hasFoundSolution).toBeTruthy();

    // Validate the global 'path' variable was mutated by the initial backtrack call.
    // The page defines `let path = [];` at top-level, so it's accessible as window.path.
    const path = await page.evaluate(() => {
      // Return a shallow copy to avoid transferring proxies
      try {
        return Array.isArray(window.path) ? [...window.path] : null;
      } catch (e) {
        return { __error: String(e) };
      }
    });

    // The script's base case unshifts 'New York' into path when found -> expect path[0] === 'New York'
    expect(Array.isArray(path)).toBeTruthy();
    expect(path.length).toBeGreaterThanOrEqual(1);
    expect(path[0]).toBe('New York');

    // Ensure there were no uncaught page errors during initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Backtrack button has no onclick handler; clicking does not retrigger known transition', async ({ page }) => {
    // This test validates:
    // - The button exists but has no inline onclick attribute (evidence mismatch vs FSM)
    // - Clicking the button does not produce additional "Found solution!" logs (since no handler is attached)
    // - No page errors occur as a result of clicking

    // Snapshot of how many "Found solution!" messages exist prior to clicking
    const initialFoundSolutionCount = consoleMessages.filter((m) => m.text.includes('Found solution!')).length;

    // Verify the button has no inline onclick attribute
    const onclickAttr = await page.getAttribute('#backtracking-button', 'onclick');
    expect(onclickAttr).toBeNull();

    // Click the button (FSM expects this to trigger backtracking, but implementation does not attach a handler)
    await page.click('#backtracking-button');

    // Allow a short delay for any potential logs to appear
    await page.waitForTimeout(150);

    // Count "Found solution!" messages after click
    const afterClickFoundSolutionCount = consoleMessages.filter((m) => m.text.includes('Found solution!')).length;

    // Since there is no attached click handler in the implementation, expect no new "Found solution!" logs
    expect(afterClickFoundSolutionCount).toBe(initialFoundSolutionCount);

    // Ensure clicking did not cause page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Multiple clicks do not crash the page and no runtime exceptions are raised', async ({ page }) => {
    // This test validates robustness when the user repeatedly clicks the Backtrack button.
    // Because the implementation does not attach an event handler, clicks should be harmless.
    // We ensure no page errors accumulate and no console messages of type "error" are emitted.

    // Clear any console messages recorded so far for a clean baseline
    // (We cannot remove existing listeners; just record current length and focus on new entries.)
    const baselineConsoleCount = consoleMessages.length;

    // Click the button multiple times in quick succession
    await page.click('#backtracking-button');
    await page.click('#backtracking-button');
    await page.click('#backtracking-button');

    // Wait for potential effects
    await page.waitForTimeout(200);

    // Ensure no uncaught exceptions were emitted as page errors
    expect(pageErrors.length).toBe(0);

    // Ensure no console messages of severity 'error' were produced during these clicks
    const newConsoleEntries = consoleMessages.slice(baselineConsoleCount);
    const errorEntries = newConsoleEntries.filter((m) => m.type === 'error');
    expect(errorEntries.length).toBe(0);
  });

  test('FSM evidence: explicit console logging for solution is present and reproducible via programmatic invocation', async ({ page }) => {
    // This test validates:
    // - The console log "Found solution!" is present from initial run (S2 evidence)
    // - The backtrack function exists and can be invoked from page context to reproduce the solution path
    // Note: we do NOT redefine or patch functions; we simply invoke existing functions in the page context.

    // Ensure backtrack function is present
    const hasBacktrack = await page.evaluate(() => typeof window.backtrack === 'function');
    expect(hasBacktrack).toBeTruthy();

    // Programmatically reset the global path and invoke backtrack starting from a non-New York city,
    // then return the mutated path. This simulates starting the algorithm from another city
    // and verifies the "Found solution!" behavior arises naturally from the function itself.
    const returnedPath = await page.evaluate(() => {
      try {
        // Reset path to ensure deterministic result for this invocation
        window.path = [];
        // Start backtracking from 'Chicago' (this will eventually reach 'New York' per algorithm)
        window.backtrack('Chicago', window.path);
        return Array.isArray(window.path) ? [...window.path] : null;
      } catch (e) {
        return { __error: String(e) };
      }
    });

    // Validate the returned path is an array and contains 'New York' as the starting element added by base case
    expect(Array.isArray(returnedPath)).toBeTruthy();
    expect(returnedPath.length).toBeGreaterThanOrEqual(1);
    expect(returnedPath[0]).toBe('New York');

    // Confirm that during the programmatic invocation, console logs included "Current city:" and "Found solution!"
    const texts = consoleMessages.map((m) => m.text);
    const hasCurrentCity = texts.some((t) => t.includes('Current city:'));
    const hasFoundSolution = texts.some((t) => t.includes('Found solution!'));
    expect(hasCurrentCity).toBeTruthy();
    expect(hasFoundSolution).toBeTruthy();

    // Ensure no page errors were produced during programmatic invocation
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: verify comparison bug in implementation leads to expected traversal behavior (no thrown exceptions)', async ({ page }) => {
    // This test documents an implementation detail: the backtrack function compares numeric indices to city names,
    // which is a type-mismatch but not a runtime exception. We assert that traversal proceeds and the app does not crash.

    // Reinitialize path and call backtrack from index-like value to exercise that path
    // We will not mutate or redefine functions; just call with a string representing a city name that exists.
    await page.evaluate(() => {
      // Reset path
      window.path = [];
      // Call backtrack with a city that is not the first element to exercise loops
      window.backtrack('Los Angeles', window.path);
    });

    // Wait briefly for any console logs
    await page.waitForTimeout(150);

    // Collect relevant console texts and ensure function executed (found solution logged)
    const texts = consoleMessages.map((m) => m.text);
    expect(texts.some((t) => t.includes('Current city:'))).toBeTruthy();
    expect(texts.some((t) => t.includes('Found solution!'))).toBeTruthy();

    // No runtime exceptions should have been thrown
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity: ensure page source contains the cities array and path variable evidence (FSM component evidence)', async ({ page }) => {
    // This test verifies that the JavaScript on the page includes the expected global variables 'cities' and 'path'
    // as evidence items referenced by the FSM and extraction summary.

    // Check that the JS created a global `cities` array we can inspect
    const cities = await page.evaluate(() => {
      try {
        return Array.isArray(window.cities) ? [...window.cities] : null;
      } catch (e) {
        return { __error: String(e) };
      }
    });

    expect(Array.isArray(cities)).toBeTruthy();
    expect(cities).toContain('New York');
    expect(cities).toContain('Los Angeles');
    expect(cities).toContain('Chicago');
    expect(cities).toContain('Miami');

    // Confirm the initial call to backtrack(cities[0], path) is present in page HTML as evidence
    const content = await page.content();
    expect(content).toContain('backtrack(cities[0], path);');
  });
});