import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122c2611-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('A* Search (FSM) - Interactive Application', () => {
  // Collect page errors and console messages for each test run
  test.beforeEach(async ({ page }) => {
    // Attach listeners before navigation so we capture errors during load
    page.context()._errors = [];
    page.context()._console = [];

    page.on('pageerror', (err) => {
      // store the error message for assertions
      page.context()._errors.push(err && err.message ? err.message : String(err));
    });

    page.on('console', (msg) => {
      // store console messages (text) for inspection
      try {
        page.context()._console.push(msg.text());
      } catch (e) {
        page.context()._console.push(String(msg));
      }
    });
  });

  // Helper to navigate and ensure the page is loaded and listeners are active
  async function openApp(page) {
    await page.goto(APP_URL, { waitUntil: 'load' });
    // give a small delay to allow synchronous scripts to run and emit errors
    await page.waitForTimeout(50);
  }

  test('Initial Idle state: buttons and inputs present and correct visibility', async ({ page }) => {
    // Validate the Idle state UI elements exist and initial visibility matches FSM evidence.
    // Also capture any JS errors produced during page load (duplicate script declarations or other issues).
    await openApp(page);

    const start = page.locator('#start');
    const reset = page.locator('#reset');
    const debug = page.locator('#debug');
    const inputX = page.locator('#x');
    const inputY = page.locator('#y');

    // Check DOM element presence and initial visibility per FSM S0_Idle evidence
    await expect(start).toBeVisible({ timeout: 2000 });
    await expect(reset).toBeVisible({ timeout: 2000 });
    // debug button should be hidden initially
    await expect(debug).toBeHidden();

    // Inputs should have value "0" and be readonly
    await expect(inputX).toHaveValue('0');
    await expect(inputY).toHaveValue('0');
    // readonly attribute expectation: read it from the DOM
    const xReadOnly = await inputX.getAttribute('readonly');
    const yReadOnly = await inputY.getAttribute('readonly');
    expect(xReadOnly === '' || xReadOnly === 'true' || xReadOnly === 'readonly').toBeTruthy();
    expect(yReadOnly === '' || yReadOnly === 'true' || yReadOnly === 'readonly').toBeTruthy();

    // At least one page error is expected due to the HTML/JS implementation issues (duplicate let declarations)
    // We assert that we observed at least one pageerror; the exact message can vary (SyntaxError / Identifier / RangeError)
    const errors = page.context()._errors;
    expect(errors.length).toBeGreaterThanOrEqual(1);
    // Assert that one of the errors resembles a common parsing/runtime fault from the provided implementation
    const errorAggregate = errors.join(' | ');
    const expectedPatterns = [
      /has already been declared/i, // duplicate let declaration SyntaxError
      /identifier .* has already been declared/i,
      /syntaxerror/i,
      /rangeerror/i,
      /maximum call stack/i,
      /uncaught/i
    ];
    expect(expectedPatterns.some((rx) => rx.test(errorAggregate))).toBeTruthy();
  });

  test('StartSearch event transitions Idle -> Searching: click #start hides Start and shows Debug, and JS errors observed', async ({ page }) => {
    // Validate transition triggered by StartSearch event. We will click the start button and check:
    // - start button becomes hidden
    // - debug button becomes visible
    // - a JS error is observed (could be SyntaxError from load or RangeError from runtime recursion)
    await openApp(page);

    const start = page.locator('#start');
    const debug = page.locator('#debug');

    // Ensure initial preconditions
    await expect(start).toBeVisible();
    await expect(debug).toBeHidden();

    // Click start; the page's JS will run and (per implementation) set start hidden and debug visible,
    // but may also raise errors (we allow them and assert they occurred).
    await start.click();

    // Give some time for synchronous handlers to complete and any errors to surface
    await page.waitForTimeout(100);

    // Verify the expected visual changes after the Start event (transition S0_Idle -> S1_Searching)
    // The code sets display = 'none'/'block' before doing other work, so these assertions should hold even if errors occur later.
    await expect(start).toBeHidden();
    await expect(debug).toBeVisible();

    // Verify that at least one page error exists (either from load or triggered by runtime recursion/update)
    const errors = page.context()._errors;
    expect(errors.length).toBeGreaterThanOrEqual(1);

    // Look for common runtime failure signatures indicating the broken implementation exercised itself
    const errorAggregate = errors.join(' | ');
    const found = [/rangeerror/i, /maximum call stack/i, /has already been declared/i, /syntaxerror/i, /uncaught/i].some(rx => rx.test(errorAggregate));
    expect(found).toBeTruthy();

    // Also confirm that console messages (if any) were captured; while none are expected, we assert the feature works
    const consoles = page.context()._console;
    expect(Array.isArray(consoles)).toBeTruthy();
  });

  test('ResetSearch event transitions Searching -> Reset and Reset -> Idle behavior', async ({ page }) => {
    // Validate Reset behavior in two scenarios:
    // 1) Clicking reset after start (Searching -> Reset) should show Start and hide Debug.
    // 2) Clicking reset from Idle should be a no-op visually (Start visible, Debug hidden) but still execute handler and may produce errors.
    await openApp(page);

    const start = page.locator('#start');
    const reset = page.locator('#reset');
    const debug = page.locator('#debug');

    // Scenario A: Start then Reset
    // Ensure initial Idle
    await expect(start).toBeVisible();
    await expect(debug).toBeHidden();

    // Click start to transition to Searching. This may raise errors, but the visibility change occurs synchronously.
    await start.click();
    await page.waitForTimeout(50);

    // Ensure Searching visual state taken
    await expect(start).toBeHidden();
    await expect(debug).toBeVisible();

    // Now click reset to transition Searching -> Reset (per FSM S1 -> S2)
    await reset.click();
    await page.waitForTimeout(50);

    // After reset, Start should be visible and Debug hidden per FSM transition evidence
    await expect(start).toBeVisible();
    await expect(debug).toBeHidden();

    // Scenario B: Reset while Idle (no prior Start)
    // Reload page to ensure clean Idle state (and to isolate handlers/errors)
    await openApp(page);
    await expect(start).toBeVisible();
    await expect(debug).toBeHidden();

    // Click reset directly from Idle
    await reset.click();
    await page.waitForTimeout(50);

    // Visuals should remain or be restored to Idle
    await expect(start).toBeVisible();
    await expect(debug).toBeHidden();

    // Ensure page errors were observed at some point (load or interactions)
    const errors = page.context()._errors;
    expect(errors.length).toBeGreaterThanOrEqual(1);

    // Validate error messages reflect the broken implementation (duplicate declarations or recursion)
    const errorAggregate = errors.join(' | ');
    const found = [/has already been declared/i, /syntaxerror/i, /rangeerror/i, /maximum call stack/i].some(rx => rx.test(errorAggregate));
    expect(found).toBeTruthy();
  });

  test('Edge cases & error scenarios: repeated clicks and input manipulation', async ({ page }) => {
    // This test explores edge interactions:
    // - clicking start multiple times (start may be hidden after first click)
    // - changing input values via DOM (note: inputs are readonly in the UI) and then clicking start
    // We do not alter the application's JS code; we only interact with DOM and trigger events as a user might.
    await openApp(page);

    const start = page.locator('#start');
    const reset = page.locator('#reset');
    const debug = page.locator('#debug');
    const inputX = page.locator('#x');
    const inputY = page.locator('#y');

    // Click start once
    await start.click();
    await page.waitForTimeout(50);

    // Subsequent click should be a no-op visually because the start button should be hidden.
    // Use try/catch around the click in case the element is detached or hidden.
    try {
      await start.click({ timeout: 200 }).catch(() => { /* ignore click failure */ });
    } catch (e) {
      // ignore errors due to clicking hidden/detached element
    }

    // Ensure the UI remains in Searching visual state (start hidden, debug visible)
    await expect(start).toBeHidden();
    await expect(debug).toBeVisible();

    // Now attempt to manipulate the input values via DOM (simulating a user or a script editing the inputs).
    // We avoid patching app logic; we simply set input values which the app will read on start click.
    await page.evaluate(() => {
      const x = document.getElementById('x');
      const y = document.getElementById('y');
      if (x) x.value = '3';
      if (y) y.value = '3';
    });

    // Click reset to get back to Idle so we can click start with new values
    await reset.click();
    await page.waitForTimeout(50);

    // Confirm inputs were changed
    await expect(inputX).toHaveValue('3');
    await expect(inputY).toHaveValue('3');

    // Click start again to start with new dimensions; this triggers the same application logic which may produce runtime errors
    await start.click();
    await page.waitForTimeout(100);

    // Expect visual change even if runtime errors occur
    await expect(start).toBeHidden();
    await expect(debug).toBeVisible();

    // Assert that we observed errors (load + interactions); this application is known to produce SyntaxError or runtime errors
    const errors = page.context()._errors;
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });
});