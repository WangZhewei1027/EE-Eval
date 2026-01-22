import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0baa4ad1-d5b2-11f0-b169-abe023d0d932.html';

test.describe('Recursion Example - FSM and Page Behavior (Application ID: 0baa4ad1-d5b2-11f0-b169-abe023d0d932)', () => {
  // Collect console messages and page errors for each test run.
  test.beforeEach(async ({ page }) => {
    // No-op: listeners are attached in each test where precise timing is required.
  });

  test('Initial state S0_Idle: page loads and #example is populated by recursiveDiv(10)', async ({ page }) => {
    // Attach listeners before navigation to capture any runtime errors or console logs during load.
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    // Navigate to the page (this triggers the inline script which sets innerHTML).
    await page.goto(APP_URL);

    // Verify no uncaught page errors were emitted during page load.
    expect(pageErrors.length, 'No uncaught page errors should have occurred on load').toBe(0);

    // Verify there are no console.error messages on load.
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length, 'No console.error messages should be emitted on page load').toBe(0);

    // The DOM element should exist.
    const example = page.locator('#example');
    await expect(example).toBeVisible();

    // Build expected innerHTML string produced by recursiveDiv(10).
    let expected = 'NO SOLUTION';
    for (let i = 1; i <= 10; i++) {
      expected += ' <div>' + i + '</div>';
    }

    // Verify innerHTML matches exactly the expected string.
    const innerHTML = await example.innerHTML();
    expect(innerHTML, 'innerHTML should match the exact output of recursiveDiv(10)').toBe(expected);

    // Verify there are exactly 10 child <div> elements and their text content is 1..10 in order.
    const childDivs = page.locator('#example > div');
    const count = await childDivs.count();
    expect(count, 'There should be exactly 10 child <div> elements inside #example').toBe(10);

    // Check each div's text content is the expected number in order.
    for (let i = 0; i < 10; i++) {
      const text = await childDivs.nth(i).textContent();
      // textContent may include whitespace; trim to be robust.
      expect(text?.trim(), `div #${i + 1} should contain the number ${(i + 1).toString()}`).toBe(String(i + 1));
    }

    // Also assert the text node before the divs begins with "NO SOLUTION"
    const textContent = await example.textContent();
    expect(textContent?.trim().startsWith('NO SOLUTION'), 'Text content should start with "NO SOLUTION"').toBeTruthy();
  });

  test('recursiveDiv() function: validate base case and small n values via page.evaluate', async ({ page }) => {
    // Navigate to the page so recursiveDiv is defined on window.
    await page.goto(APP_URL);

    // Validate base case: n <= 0 returns "NO SOLUTION"
    const base0 = await page.evaluate(() => recursiveDiv(0));
    expect(base0, 'recursiveDiv(0) should return "NO SOLUTION"').toBe('NO SOLUTION');

    const baseNegative = await page.evaluate(() => recursiveDiv(-5));
    expect(baseNegative, 'recursiveDiv(-5) should return "NO SOLUTION"').toBe('NO SOLUTION');

    // Validate small positive values to ensure recursion concatenates expected fragments.
    const r1 = await page.evaluate(() => recursiveDiv(1));
    // recursiveDiv(1) = recursiveDiv(0) + " <div>1</div>" = "NO SOLUTION <div>1</div>"
    expect(r1).toBe('NO SOLUTION <div>1</div>');

    const r3 = await page.evaluate(() => recursiveDiv(3));
    // build expected for n=3
    let expected3 = 'NO SOLUTION';
    for (let i = 1; i <= 3; i++) expected3 += ' <div>' + i + '</div>';
    expect(r3).toBe(expected3);

    // Validate the declared recursiveDiv(10) directly returns the same as the #example innerHTML
    const r10 = await page.evaluate(() => recursiveDiv(10));
    const exampleInnerHTML = await page.locator('#example').innerHTML();
    expect(r10, 'recursiveDiv(10) when called directly should match the rendered innerHTML').toBe(exampleInnerHTML);
  });

  test('FSM entry action renderPage: expected absence leads to ReferenceError when invoked', async ({ page }) => {
    // Navigate to the page to ensure the original script runs.
    await page.goto(APP_URL);

    // Confirm that renderPage is not defined on window (this checks the implementation mismatch with FSM entry action).
    const typeofRenderPage = await page.evaluate(() => typeof window.renderPage);
    expect(typeofRenderPage, 'renderPage should not be defined by the page script').toBe('undefined');

    // Attempting to call the missing function should cause a ReferenceError in the page context.
    // We intentionally invoke it to ensure that the environment behaves naturally (throws).
    await expect(page.evaluate(() => {
      // Intentionally call undefined function to observe natural ReferenceError
      // This will cause the evaluation promise to reject.
      return renderPage();
    })).rejects.toThrow(/renderPage is not defined|ReferenceError/);
  });

  test('Global function presence: recursiveDiv exists, renderPage does not', async ({ page }) => {
    // Navigate to ensure functions are present on global scope as implemented.
    await page.goto(APP_URL);

    const globals = await page.evaluate(() => {
      return {
        recursiveDivType: typeof window.recursiveDiv,
        renderPageType: typeof window.renderPage
      };
    });

    // The page defines recursiveDiv as a function
    expect(globals.recursiveDivType, 'recursiveDiv should be defined as a function on the window').toBe('function');

    // The FSM mentioned renderPage, but the actual HTML does not define it; expect undefined.
    expect(globals.renderPageType, 'renderPage is not defined in the implementation and should be "undefined"').toBe('undefined');
  });

  test('Edge cases: calling recursiveDiv with larger values (non-negative) and ensuring performance/shape', async ({ page }) => {
    // Navigate to page
    await page.goto(APP_URL);

    // Call with a somewhat larger n (but not huge) to ensure behavior remains consistent.
    // Keep n small enough to avoid blowing up the test environment.
    const n = 20;
    const result = await page.evaluate((value) => {
      // Call the function directly in page context with an argument
      return recursiveDiv(value);
    }, n);

    // The result should start with "NO SOLUTION" and include n div fragments.
    expect(result.startsWith('NO SOLUTION'), 'Result should start with "NO SOLUTION"').toBeTruthy();

    // Count number of "<div>" occurrences - should equal n
    const divCount = (result.match(/<div>/g) || []).length;
    expect(divCount, `recursiveDiv(${n}) should produce ${n} <div> fragments`).toBe(n);
  });

  test('No unexpected console errors or uncaught exceptions throughout interactions', async ({ page }) => {
    // Capture console and page errors from navigation and subsequent evaluations.
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto(APP_URL);

    // Perform a few safe evaluations that should not emit errors.
    await page.evaluate(() => recursiveDiv(2));
    await page.evaluate(() => recursiveDiv(0));

    // There should be no page errors captured.
    expect(pageErrors.length, 'No uncaught page errors should occur during interactions').toBe(0);

    // There should be no console errors captured either.
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length, 'The page should not emit console.error during normal interactions').toBe(0);
  });
});