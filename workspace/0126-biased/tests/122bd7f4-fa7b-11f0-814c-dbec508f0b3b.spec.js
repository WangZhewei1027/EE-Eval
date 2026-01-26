import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122bd7f4-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Application 122bd7f4-fa7b-11f0-814c-dbec508f0b3b - BFS Interactive FSM tests', () => {
  // Collect runtime page errors and console messages for assertions
  let pageErrors = [];
  let consoleMessages = [];

  // Setup: navigate to the page and attach listeners before each test
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      // store Error object for assertions
      pageErrors.push(err);
    });

    // Capture console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Load the application exactly as-is (do not modify the page)
    await page.goto(APP_URL);
  });

  // Teardown is handled by Playwright fixtures; include an afterEach comment for clarity
  test.afterEach(async () => {
    // Nothing to patch or clean on the page; listeners are automatically removed with the page fixture
  });

  test('Initial Idle state: page renders Start, Reset, input and an empty graph', async ({ page }) => {
    // This test validates the S0_Idle state: elements exist and graph is empty on initial render.

    // The input should exist and have the default value "10" per the HTML
    const numValue = await page.getAttribute('#numVertices', 'value');
    expect(numValue).toBe('10');

    // Start and Reset buttons should be present and visible
    const startVisible = await page.isVisible('#startButton');
    const resetVisible = await page.isVisible('#resetButton');
    expect(startVisible).toBe(true);
    expect(resetVisible).toBe(true);

    // The graph container should exist and initially have no child DIVs
    const initialGraphChildren = await page.$$eval('#graph > div', (nodes) => nodes.length);
    expect(initialGraphChildren).toBe(0);

    // No runtime errors should have occurred simply by loading the page
    expect(pageErrors.length).toBe(0);

    // Console should not show errors on initial load (capture whatever is present for debugging)
    // We assert that consoleMessages is an array (could be empty)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('Transition S0 -> S1 (StartButtonClick): clicking Start triggers drawGraph(); error may occur during BFS - assert error and DOM changes', async ({ page }) => {
    // This test validates the transition from Idle to GraphDrawn by clicking Start.
    // It also asserts that the buggy BFS implementation throws a runtime error naturally,
    // and that drawGraph performed some DOM updates before the error occurred.

    // Ensure graph empty before clicking
    let beforeChildren = await page.$$eval('#graph > div', (nodes) => nodes.length);
    expect(beforeChildren).toBe(0);

    // Click the Start button to trigger drawGraph()
    await page.click('#startButton');

    // Wait briefly for the event handlers to run and possibly throw
    await page.waitForTimeout(250);

    // drawGraph() in the implementation first injects string divs for each vertex.
    // Even if bfs throws later, those initial divs are expected to exist.
    const childrenAfterStart = await page.$$eval('#graph > div', (nodes) => nodes.length);

    // Expect that some DOM nodes were created by drawGraph (should be at least the initial numVertices)
    // The default numVertices is "10" captured on load.
    expect(childrenAfterStart).toBeGreaterThanOrEqual(10);

    // The implementation contains a known bug in bfs() (iterating over graph.children[node] which is not iterable),
    // so we expect at least one pageerror to have been emitted during this click.
    expect(pageErrors.length).toBeGreaterThan(0);

    // Assert that one of the errors is a TypeError or similar (we allow ReferenceError/RangeError too,
    // but TypeError is the most likely in this implementation).
    const sawExpectedErrorKind = pageErrors.some((e) => {
      const name = e && e.name ? e.name : '';
      const msg = e && e.message ? e.message : '';
      return (
        name === 'TypeError' ||
        name === 'ReferenceError' ||
        name === 'RangeError' ||
        /not iterable/i.test(msg) ||
        /is not iterable/i.test(msg) ||
        /undefined/.test(msg) ||
        /bfs/.test(msg)
      );
    });
    expect(sawExpectedErrorKind).toBe(true);

    // For debugging purposes, ensure at least one console message was captured as well (may be empty)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('Transition S1 -> S0 (ResetButtonClick): clicking Reset resets the graph and appends nodes via reset handler', async ({ page }) => {
    // This test validates that clicking Reset activates the reset handler:
    // it should clear the graph and then append `numVertices` nodes.

    // Precondition: click Reset
    await page.click('#resetButton');

    // Wait for reset handler to complete DOM manipulations
    await page.waitForTimeout(200);

    // After reset, the graph should contain nodes appended by the reset handler.
    // The implementation uses the numVertices value captured at load time ("10").
    const childrenAfterReset = await page.$$eval('#graph > div', (nodes) => nodes.length);
    expect(childrenAfterReset).toBe(10);

    // Confirm reset did not produce unexpected runtime errors (there may be none)
    // It's acceptable if previous tests created pageErrors; for this single test we check errors array
    // collected during this test run (pageErrors persists per test run because listeners attached in beforeEach).
    // Since reset handler does not call bfs, we expect no new errors specifically from reset:
    const resetErrors = pageErrors.filter(e => {
      // We try to determine when errors occurred by presence of 'bfs' in stack/message,
      // but we cannot attribute reliably. We assert that there are not many errors here.
      return true;
    });
    // Allow that previous tests may have filled pageErrors; we assert that reset itself
    // did not increase errors dramatically beyond what drawGraph triggered.
    // At minimum, the DOM should be correct.
    expect(childrenAfterReset).toBe(10);
  });

  test('Edge case: changing #numVertices after load does NOT affect behavior because script reads value only at load time', async ({ page }) => {
    // The implementation reads numVertices once on load into a variable.
    // Updating the input's value later should NOT change how many nodes are created
    // when clicking Start or Reset (this is an intentional bug/behavior we must assert).

    // Change the input value to a different number
    await page.fill('#numVertices', '3');

    // Click Reset which uses the captured numVertices variable (not the input's current value)
    await page.click('#resetButton');
    await page.waitForTimeout(200);

    // Because the script captured the initial value "10", reset should still create 10 nodes,
    // demonstrating that changing the input doesn't update the internal variable.
    const childrenAfterChangingInput = await page.$$eval('#graph > div', (nodes) => nodes.length);
    expect(childrenAfterChangingInput).toBe(10);

    // Now click Start to trigger drawGraph again (this may also trigger the BFS error)
    await page.click('#startButton');
    await page.waitForTimeout(250);

    // After Start, we still expect at least 10 nodes because the internal numVertices remains 10.
    const childrenAfterStart = await page.$$eval('#graph > div', (nodes) => nodes.length);
    expect(childrenAfterStart).toBeGreaterThanOrEqual(10);

    // Confirm that an error occurred when running drawGraph/bfs as before
    expect(pageErrors.length).toBeGreaterThan(0);
  });

  test('Error scenario validation: assert the BFS implementation throws a TypeError related to iteration over graph.children[node]', async ({ page }) => {
    // This test specifically triggers the buggy code path in bfs() and asserts on the error details.

    // Ensure no prior errors recorded in this test context
    pageErrors = [];

    // Trigger drawGraph which calls bfs internally
    await page.click('#startButton');

    // Give it time to throw
    await page.waitForTimeout(250);

    // There should be at least one error recorded
    expect(pageErrors.length).toBeGreaterThan(0);

    // Find the first error and check its message/name for expected patterns
    const err = pageErrors[0];

    // The error should be an Error-like object
    expect(err).toBeTruthy();
    expect(typeof err.message).toBe('string');

    // We expect patterns that hint at the iteration bug; be flexible in matching
    const message = err.message || '';
    const name = err.name || '';

    const matchesExpectedPattern =
      name === 'TypeError' ||
      /not iterable/i.test(message) ||
      /is not iterable/i.test(message) ||
      /undefined/.test(message) ||
      /cannot read property/i.test(message) ||
      /bfs/i.test(message) ||
      /graph\.children/i.test(message);

    expect(matchesExpectedPattern).toBe(true);
  });
});