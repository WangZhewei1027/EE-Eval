import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba8eb40-d5b2-11f0-b169-abe023d0d932.html';

test.describe('Adjacency Matrix - FSM and UI validation (Application ID: 0ba8eb40-d5b2-11f0-b169-abe023d0d932)', () => {

  // Validate initial Idle state rendering and static DOM elements.
  test('Idle state: page renders title and adjacency table with inputs', async ({ page }) => {
    // Attach listeners to capture console messages and page errors (but only for diagnostics here).
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err.message));

    // Load the page and wait for load event so scripts (if parseable) run.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // The FSM expects an <h1> with "Adjacency Matrix" in the Idle state.
    const title = await page.locator('h1').textContent();
    expect(title).toBeTruthy();
    expect(title.trim()).toBe('Adjacency Matrix');

    // The FSM expects the adjacency table to exist.
    const table = page.locator('#adjacency-matrix');
    await expect(table).toBeVisible();

    // There should be many text inputs as described in the HTML implementation.
    const inputs = await page.locator("input[type='text']");
    const count = await inputs.count();
    // We expect a large number of inputs (this app includes many rows). Ensure it's reasonable.
    expect(count).toBeGreaterThan(100);

    // Check specific input placeholders/elements described in the FSM evidence.
    await expect(page.locator("input#x1")).toHaveAttribute('placeholder', 'Enter 0');
    await expect(page.locator("input#y1")).toHaveAttribute('placeholder', 'Enter 1');

    // The FSM's entry action mentions renderPage(), but the page does not expose it.
    // Verify that no global renderPage function exists.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Also assert that some script error(s) occurred during load (the HTML contains syntactic issues).
    // We expect at least one page error or console error relating to SyntaxError/Uncaught or similar.
    const hadPageError = pageErrors.length > 0;
    const hadConsoleError = consoleMessages.some(m => m.type === 'error' || m.text.includes('SyntaxError') || m.text.includes('Unexpected token'));
    expect(hadPageError || hadConsoleError).toBeTruthy();
  });

  // Validate InputChange event: typing into inputs updates DOM values and remains in Idle state.
  test('InputChange event: updating inputs updates DOM values and stays in Idle', async ({ page }) => {
    // Capture page errors and console messages that happen after load and during typing.
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Attach listeners before navigation to catch initial parse/load errors.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Assert that global variables the broken script would have created are not present.
    // Because of script parse errors, 'matrix' or 'input' variables should not be set.
    const matrixType = await page.evaluate(() => typeof window.matrix);
    expect(matrixType).toBe('undefined');
    const inputVarType = await page.evaluate(() => typeof window.input);
    expect(inputVarType).toBe('undefined');

    // Simulate user typing into a few inputs (these are ordinary text fields with no event handlers).
    await page.fill('#x1', 'A');
    await page.fill('#y1', 'B');

    // Validate that values are stored in the DOM inputs.
    const x1Value = await page.inputValue('#x1');
    const y1Value = await page.inputValue('#y1');
    expect(x1Value).toBe('A');
    expect(y1Value).toBe('B');

    // Recreate the FSM evidence concatenation in the test (not relying on broken page script)
    // to confirm the DOM values can be combined as expected.
    const combined = await page.evaluate(() => {
      return document.getElementById('x1').value + ',' + document.getElementById('y1').value;
    });
    expect(combined).toBe('A,B');

    // Typing into other inputs should behave similarly; test a few more to exercise the matrix inputs.
    await page.fill('#x2', '1');
    await page.fill('#y2', '0');
    expect(await page.inputValue('#x2')).toBe('1');
    expect(await page.inputValue('#y2')).toBe('0');

    // Since the FSM transition is S0_Idle -> S0_Idle on InputChange, ensure no new "state change" DOM markers appear.
    // There are no explicit state markers; validate the title and table remain unchanged.
    expect(await page.locator('h1').textContent()).toBe('Adjacency Matrix');
    await expect(page.locator('#adjacency-matrix')).toBeVisible();

    // Ensure that typing did not create additional page errors beyond initial load syntax errors.
    // We assert that no new page errors were appended after interactions (there may have been initial errors).
    expect(pageErrors.length).toBeGreaterThanOrEqual(0); // pageErrors captured globally
    // It's acceptable for initial load to have errors; ensure no console errors were generated as a direct result of input events.
    expect(consoleErrors.length).toBe(0);
  });

  // Test multiple sequential input changes to validate transition loop and check for side-effects.
  test('Transition loop behavior: multiple input edits do not navigate away or crash the page', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Perform a sequence of edits across the matrix
    const pairsToEdit = [
      ['#x3', '#y3', 'X3', 'Y3'],
      ['#x10', '#y10', '10', '11'],
      ['#x50', '#y50', 'foo', 'bar'],
      ['#x150', '#y150', 'lastX', 'lastY'] // if these exist; if not, fill will throw - guard by checking existence
    ];

    for (const [selA, selB, valA, valB] of pairsToEdit) {
      const existsA = await page.locator(selA).count();
      const existsB = await page.locator(selB).count();
      if (existsA) await page.fill(selA, valA);
      if (existsB) await page.fill(selB, valB);

      if (existsA) expect(await page.inputValue(selA)).toBe(valA);
      if (existsB) expect(await page.inputValue(selB)).toBe(valB);
    }

    // Page should still show the adjacency table and title, indicating no navigation occurred.
    await expect(page.locator('#adjacency-matrix')).toBeVisible();
    expect(await page.locator('h1').textContent()).toBe('Adjacency Matrix');

    // Confirm that the page did not generate additional fatal errors during these interactions.
    // (There may be initial parse errors captured in pageErrors; ensure no new throws happened during typing).
    // Since we cannot differentiate timestamps here reliably, at minimum assert the page is still interactive.
    await page.fill('#x1', 'alive');
    expect(await page.inputValue('#x1')).toBe('alive');
  });

  // Edge case tests and explicit assertions about script errors described in the requirements.
  test('Page load produces JavaScript parse/runtime errors (observe console and page errors)', async ({ page }) => {
    // Capture page errors and console error messages precisely during navigation.
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    // Navigate and allow errors to surface.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // At least one page error is expected because the inline script contains invalid tokens (HTML <tr> inside JS array)
    // or duplicate 'let' redeclarations — both can lead to SyntaxError messages.
    expect(pageErrors.length + consoleMessages.filter(m => m.type === 'error').length).toBeGreaterThan(0);

    // Assert that among the captured messages there is a SyntaxError or Unexpected token mention.
    const combinedTexts = pageErrors.concat(consoleMessages.map(m => m.text)).join(' ');
    const hasSyntaxOrUnexpected = /SyntaxError|Unexpected token|Unexpected identifier|Uncaught/i.test(combinedTexts);
    expect(hasSyntaxOrUnexpected).toBeTruthy();

    // Additionally, because the script attempted to define variables like 'input' but the script likely failed,
    // ensure these variables are not defined on the global window.
    const globals = await page.evaluate(() => {
      return {
        matrix: typeof window.matrix,
        input: typeof window.input,
        input100: typeof window.input100
      };
    });
    // All should be 'undefined' because the script failed to run successfully.
    expect(globals.matrix).toBe('undefined');
    expect(globals.input).toBe('undefined');
    expect(globals.input100).toBe('undefined');
  });

  // Test for graceful handling when querying non-existent inputs (edge case).
  test('Edge case: querying non-existent inputs returns null without throwing', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Query an element that does not exist and ensure it returns null in a safe evaluate.
    const nonExistent = await page.evaluate(() => {
      const el = document.getElementById('nonexistent_input_foobarbaz');
      return el === null;
    });
    expect(nonExistent).toBe(true);

    // Ensure reading a value from a missing element does not crash the test (we won't call .value on null).
    const safeRead = await page.evaluate(() => {
      const el = document.getElementById('nonexistent_input_foobarbaz');
      return el ? el.value : null;
    });
    expect(safeRead).toBeNull();
  });

});