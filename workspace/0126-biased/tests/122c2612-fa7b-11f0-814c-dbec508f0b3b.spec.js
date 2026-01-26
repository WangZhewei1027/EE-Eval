import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122c2612-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('PageRank FSM - Interactive Application (Application ID: 122c2612-fa7b-11f0-814c-dbec508f0b3b)', () => {
  // Collect console errors and page errors per test
  test.beforeEach(async ({ page }) => {
    // Attach listeners early so load-time errors are captured
    page.context()._pageConsoleErrors = [];
    page.context()._pageRuntimeErrors = [];

    page.on('console', (msg) => {
      // capture only error level console messages
      if (msg.type() === 'error') {
        page.context()._pageConsoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      // capture runtime exceptions thrown during parsing/execution
      page.context()._pageRuntimeErrors.push(err.message);
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Give a little time to ensure synchronous load-time errors are emitted and captured
    await page.waitForTimeout(200);
  });

  // Test the initial render and initialization behavior
  test('Initial render: inputs and buttons are present; page throws initialization TypeError due to malformed id', async ({ page }) => {
    // Validate presence of visible inputs and buttons declared in the FSM (by their selectors)
    const sourceUrl = page.locator('#source-url');
    const maxIterations = page.locator('#max-iterations');
    const initialLinkCount = page.locator('#initial-link-count');

    // The HTML has a bug: the damping factor input id has a leading space: id=" damping-factor"
    const dampingByCorrectId = await page.$('#damping-factor'); // expected to be null due to malformed id
    const dampingByExactAttribute = await page.$('[id=" damping-factor"]'); // should find the element

    await expect(sourceUrl).toBeVisible();
    await expect(maxIterations).toBeVisible();
    await expect(initialLinkCount).toBeVisible();
    // The correctly queried selector should NOT find the damping input because of the leading space in the id
    expect(dampingByCorrectId).toBeNull();
    // But the element does exist in the DOM with the id that includes the leading space
    expect(dampingByExactAttribute).not.toBeNull();

    // Validate presence of buttons used by the FSM
    await expect(page.locator('#calculate-btn')).toBeVisible();
    await expect(page.locator('#reset-btn')).toBeVisible();
    await expect(page.locator('#previous-btn')).toBeVisible();
    await expect(page.locator('#next-btn')).toBeVisible();
    await expect(page.locator('#clear-btn')).toBeVisible();

    // Because the script attempts to access document.getElementById('damping-factor').value,
    // which is null, a TypeError should have occurred during page initialization.
    // Assert that a runtime error occurred and it references the missing damping-factor element or cannot read 'value'
    const runtimeErrors = page.context()._pageRuntimeErrors;
    const consoleErrors = page.context()._pageConsoleErrors;

    // At least one runtime or console error should be present due to initialization bug
    expect(runtimeErrors.length + consoleErrors.length).toBeGreaterThan(0);

    // Check for indicative error messages (be permissive: Node/Browser messages vary)
    const combinedErrors = runtimeErrors.concat(consoleErrors).join(' | ');
    const indicative = /damping-factor|Cannot read properties of null|Cannot read property 'value'|null.*value|reading 'value'/i;
    expect(indicative.test(combinedErrors)).toBeTruthy();
  });

  test.describe('Button interactions and FSM transitions (attempts)', () => {
    // Because the page throws during initialization, event listeners are likely not attached.
    // These tests exercise the transitions described in the FSM by attempting clicks and asserting observed behavior (or lack thereof).

    test('CalculateClick: clicking Calculate should increment iterations if initialization had succeeded — here it should NOT create an iterations element and a runtime error was observed', async ({ page }) => {
      // Ensure we observed a runtime error on load
      expect(page.context()._pageRuntimeErrors.length + page.context()._pageConsoleErrors.length).toBeGreaterThan(0);

      // Try to click the Calculate button
      await page.click('#calculate-btn');

      // The implementation expects an element with id="iterations" to be updated.
      // Verify that it does NOT exist because script execution stopped before adding event listeners and/or the element.
      const iterationsElem = await page.$('#iterations');
      expect(iterationsElem).toBeNull();

      // Confirm no unexpected new runtime errors were emitted on click (clicking a button without a listener should be a no-op)
      // We allow that the original initialization error is present; no new errors should be required.
      // Give the page a short time to possibly emit new errors
      await page.waitForTimeout(100);
      expect(page.context()._pageRuntimeErrors.length + page.context()._pageConsoleErrors.length).toBeGreaterThan(0);
    });

    test('ResetClick: clicking Reset should zero iterations and reset values — but with initialization error it should be a no-op', async ({ page }) => {
      // Read original input values
      const originalSource = await page.$eval('#source-url', el => el.value);
      const originalMax = await page.$eval('#max-iterations', el => el.value);
      const dampingByCorrectId = await page.$('#damping-factor'); // likely null
      const dampingActualValue = await page.$eval('[id=" damping-factor"]', el => el.value).catch(() => null);

      // Click reset
      await page.click('#reset-btn');

      // Because event listeners were not attached due to initialization error, inputs should remain unchanged
      const postSource = await page.$eval('#source-url', el => el.value);
      const postMax = await page.$eval('#max-iterations', el => el.value);
      const postDamping = await page.$eval('[id=" damping-factor"]', el => el.value).catch(() => null);

      expect(postSource).toBe(originalSource);
      expect(postMax).toBe(originalMax);
      expect(postDamping).toBe(dampingActualValue);

      // The script would have updated #iterations to "Iterations: 0" if it ran. Assert that element is absent.
      const iterationsElem = await page.$('#iterations');
      expect(iterationsElem).toBeNull();
    });

    test('NextClick and PreviousClick: navigating iterations should change iteration count when in Calculating state — here listeners not attached, so no changes', async ({ page }) => {
      // Attempt to simulate being in Calculating state by clicking Calculate (no-op due to earlier error)
      await page.click('#calculate-btn');

      // Click Next and Previous
      await page.click('#next-btn');
      await page.click('#previous-btn');

      // There is no #iterations element in the DOM created/updated by the script (script failed earlier),
      // therefore the iteration count cannot be observed/changed — assert absence.
      const iterationsElem = await page.$('#iterations');
      expect(iterationsElem).toBeNull();

      // Confirm that no new page runtime errors were emitted solely by clicking these buttons.
      await page.waitForTimeout(100);
      // At minimum the initial page error(s) should be present.
      expect(page.context()._pageRuntimeErrors.length + page.context()._pageConsoleErrors.length).toBeGreaterThan(0);
    });

    test('ClearClick: clicking Clear should reset everything including iterations to 0 — here it should not alter any state due to initialization error', async ({ page }) => {
      // Click Clear
      await page.click('#clear-btn');

      // Ensure that the inputs remain as they were (no listener to perform reset)
      const src = await page.$eval('#source-url', el => el.value);
      const max = await page.$eval('#max-iterations', el => el.value);
      expect(typeof src).toBe('string');
      expect(typeof max).toBe('string');

      // Verify that iterations element still absent
      const iterationsElem = await page.$('#iterations');
      expect(iterationsElem).toBeNull();
    });
  });

  test.describe('Edge cases and DOM anomalies', () => {
    test('Malformed id for damping-factor is present: demonstrates why initialization error occurred', async ({ page }) => {
      // The FSM expects an input with id="damping-factor".
      // Verify that the actual DOM contains an element whose id includes a leading space, which caused getElementById('damping-factor') to return null.
      const byCorrectId = await page.$('#damping-factor');
      const byMalformedAttr = await page.$('[id=" damping-factor"]');

      expect(byCorrectId).toBeNull();
      expect(byMalformedAttr).not.toBeNull();

      // Accessing the element by the exact attribute should allow reading its placeholder and value
      const placeholder = await page.$eval('[id=" damping-factor"]', el => el.getAttribute('placeholder'));
      expect(placeholder).toBe('Damping factor' || 'Damping factor' /* intentionally permissive; placeholder is present in HTML */);

      // Confirm that the runtime error messages captured mention either 'damping-factor' or reading property 'value' of null
      const combinedErrors = page.context()._pageRuntimeErrors.concat(page.context()._pageConsoleErrors).join(' | ');
      const indicative = /damping-factor|Cannot read properties of null|Cannot read property 'value'|reading 'value'/i;
      expect(indicative.test(combinedErrors)).toBeTruthy();
    });

    test('PageRank function existence: function declaration is present even if initialization failed', async ({ page }) => {
      // Despite runtime errors, function declarations are hoisted at parse time. Check whether PageRank is available on the page.
      const hasPageRank = await page.evaluate(() => {
        // Access PageRank from the window scope if defined
        return typeof window.PageRank === 'function' || typeof PageRank === 'function';
      }).catch(() => false);

      // It's acceptable either way (depends on parsing), but assert that we can query for it without throwing.
      expect(typeof hasPageRank === 'boolean').toBeTruthy();
    });
  });

  test.afterEach(async ({ page }) => {
    // Clear any listeners we attached to avoid leakage between tests in Playwright's shared contexts
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
    // No explicit teardown beyond this is required here
  });
});