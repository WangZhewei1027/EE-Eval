import { test, expect } from '@playwright/test';

test.describe('Decision Trees Interactive Application (520b90e1-fa76-11f0-a09b-87751f540fd8)', () => {
  // URL of the served HTML page
  const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520b90e1-fa76-11f0-a09b-87751f540fd8.html';

  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  // Attach listeners before each test to gather runtime diagnostics
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // Capture console messages (log, warn, error, etc.)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // Capture uncaught exceptions thrown in the page
      pageErrors.push(err);
    });

    // Navigate to the application and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Test the initial FSM state S0_Idle: buildTree should run on page load and render the tree
  test('S0_Idle: buildTree called on load and renders tree content', async ({ page }) => {
    // The entry action in S0_Idle is buildTree(...). Verify DOM reflects that invocation.

    // The #tree container should exist and contain the generated tree HTML
    const treeLocator = page.locator('#tree');
    await expect(treeLocator).toBeVisible();

    // The feature used by createTree is the first key: "age"
    // buildTree inserts an h2 with the feature name and a paragraph with the value (array string)
    const treeText = await treeLocator.textContent();
    expect(treeText).toBeTruthy();

    // Validate key expected strings are present
    expect(treeText).toContain('age'); // node.feature
    // node.value is an array [25,30,35,40,45] printed as CSV in the HTML
    expect(treeText).toContain('25,30,35,40,45');
    // The buildTree HTML includes the labels "Left:" and "Right:" in the template
    expect(treeText).toContain('Left:');
    expect(treeText).toContain('Right:');

    // Ensure the generated container has the expected class
    const treeDiv = page.locator('#tree .tree');
    await expect(treeDiv).toHaveCount(1);
  });

  // Test the underlying createTree function returns a structure consistent with expectations
  test('createTree returns object with expected keys and branch lengths', async ({ page }) => {
    // Evaluate createTree in-page to inspect the returned structure
    const result = await page.evaluate(() => {
      // Use the page's data object and call createTree directly
      const node = createTree(data.features, data.target, data.target_values);
      return {
        hasFeature: !!node.feature,
        hasValue: !!node.value,
        leftLength: Array.isArray(node.left) ? node.left.length : null,
        rightLength: Array.isArray(node.right) ? node.right.length : null,
        // Include a shallow sample so the test can reason about values
        rightZeroLeftLength: node.right && node.right[0] && node.right[0].left ? node.right[0].left.length : null
      };
    });

    // Validate the structure
    expect(result.hasFeature).toBe(true);
    expect(result.hasValue).toBe(true);

    // According to the script's logic, for target length 2 we expect right to have two pushed items
    expect(result.rightLength).toBe(2);
    // Left should be empty in the observed dataset
    expect(result.leftLength).toBe(0);

    // The implementation pushes into right[0].left during each iteration,
    // so right[0].left should have been populated (non-null and numeric)
    expect(typeof result.rightZeroLeftLength).toBe('number');
    expect(result.rightZeroLeftLength).toBeGreaterThanOrEqual(1);
  });

  // Test that there are no interactive elements detected (buttons, inputs, links) per FSM notes
  test('No interactive elements (buttons, inputs, links) are present in the DOM', async ({ page }) => {
    // Query for typical interactive element selectors
    const interactiveCount = await page.evaluate(() => {
      return document.querySelectorAll('button, input, textarea, select, a').length;
    });

    // The FSM extraction notes state there are no interactive elements; assert zero found
    expect(interactiveCount).toBe(0);
  });

  // Test stability: clicking the tree should not trigger transitions or change the DOM
  test('Clicking the rendered tree does not change DOM (no transitions)', async ({ page }) => {
    const treeLocator1 = page.locator('#tree');
    await expect(treeLocator).toBeVisible();

    // Record initial HTML snapshot
    const initialHTML = await treeLocator.innerHTML();

    // Perform a click on the tree container
    await treeLocator.click();

    // Give a small delay to allow any handlers (if erroneously present) to run
    await page.waitForTimeout(200);

    // Ensure the inner HTML hasn't changed (no transitions were triggered)
    const afterClickHTML = await treeLocator.innerHTML();
    expect(afterClickHTML).toBe(initialHTML);

    // Ensure no new page errors occurred from clicking
    expect(pageErrors.length).toBe(0);
  });

  // Edge case test: calling createTree with invalid arguments should naturally throw an error
  test('Edge case: invoking createTree with undefined args produces a runtime error (observed naturally)', async ({ page }) => {
    // Intentionally call createTree with invalid arguments to observe a natural error (TypeError)
    const evalResult = await page.evaluate(() => {
      try {
        // This call is expected to fail because createTree expects structured objects
        createTree(undefined, undefined, undefined);
        return { threw: false };
      } catch (e) {
        // Return the error message so the test can assert an error occurred naturally
        return { threw: true, message: e && e.message ? e.message : String(e) };
      }
    });

    // The page function should throw when given undefined inputs — assert that happened
    expect(evalResult.threw).toBe(true);
    expect(typeof evalResult.message).toBe('string');
    expect(evalResult.message.length).toBeGreaterThan(0);
  });

  // Diagnostic test: collect console messages and page errors from initial page load and assert expectations
  test('Diagnostics: no unexpected console errors on load, and buildTree exists as a global function', async ({ page }) => {
    // Verify buildTree exists on the window scope
    const buildTreeType = await page.evaluate(() => typeof buildTree);
    expect(buildTreeType).toBe('function');

    // Assert there were no uncaught exceptions during page load
    expect(pageErrors.length).toBe(0);

    // There are no explicit console.log calls in the page script; assert no console errors were emitted
    // We allow other console messages if they exist, but specifically check there were no console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});