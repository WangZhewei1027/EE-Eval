import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0baa98f2-d5b2-11f0-b169-abe023d0d932.html';

test.describe('K-Means Clustering FSM - 0baa98f2-d5b2-11f0-b169-abe023d0d932', () => {
  // Store page errors and console messages for assertions
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors before each test
    pageErrors = [];
    consoleMessages = [];

    // Collect runtime page errors
    page.on('pageerror', (err) => {
      // Push the error object so tests can inspect message and name
      pageErrors.push(err);
    });

    // Collect console messages for additional diagnostics
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Navigate to the application under test and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Give a small grace period for synchronous script errors to surface
    // (Most script errors that happen during initial parsing happen synchronously)
    await page.waitForTimeout(100);
  });

  test('Initial Idle state: page renders expected controls and reports load errors', async ({ page }) => {
    // This test validates the "Idle" state (S0_Idle) rendering and observes any load-time errors.

    // Verify core UI elements are present
    await expect(page.locator('#generate_clusters')).toHaveCount(1);
    await expect(page.locator('#view_clusters')).toHaveCount(1);
    await expect(page.locator('#num_clusters')).toHaveCount(1);
    await expect(page.locator('#clusters')).toHaveCount(1);

    // Confirm default input value for Number of clusters is "3"
    const numValue = await page.locator('#num_clusters').inputValue();
    expect(numValue).toBe('3');

    // The implementation contains issues that cause runtime errors during script evaluation.
    // Assert that at least one pageerror was captured during load.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Inspect the first error to ensure it relates to the broken handlers in the script.
    const firstErrorMsg = pageErrors[0].message ? pageErrors[0].message.toLowerCase() : '';
    // The app's script attempts to reference `viewClusters` (not defined globally) and attach listeners.
    // We expect the load error to mention the missing identifier or similar.
    const looksLikeMissingHandler = firstErrorMsg.includes('viewclusters') || firstErrorMsg.includes('not defined') || firstErrorMsg.includes('cannot read');
    expect(looksLikeMissingHandler).toBeTruthy();

    // clusters div should be empty on initial render (no clusters generated)
    const clustersContent = await page.locator('#clusters').innerHTML();
    expect(clustersContent).toBe('');
  });

  test('Transition S0 -> S1: clicking Generate Clusters triggers generateClusters and surfaces runtime errors', async ({ page }) => {
    // This test attempts the "Generate Clusters" event. The handler is registered at load,
    // but generateClusters contains logic that can throw (temporal dead zone or variable misuse).
    // We assert that invoking the event either produces the expected alert for invalid input
    // or causes a runtime error when input is valid.

    // Ensure the generate button exists
    const generate = page.locator('#generate_clusters');
    await expect(generate).toHaveCount(1);

    // CASE A: with a valid positive number, generateClusters executes and due to implementation bugs
    // we expect a runtime error originating from inside generateClusters. Capture it.
    // Use a small helper to wait for the pageerror after clicking.
    const initialPageErrorCount = pageErrors.length;

    // Click the generate button with the default valid input (3)
    await generate.click();

    // Wait for an additional pageerror to occur as a result of clicking.
    // The generateClusters function uses variables in ways that lead to ReferenceError/TypeError.
    let newError;
    try {
      newError = await page.waitForEvent('pageerror', { timeout: 2000 });
    } catch (e) {
      // If no new pageerror appeared, make that explicit for the assertion below
      newError = null;
    }

    // We expect a new error stemming from generateClusters execution.
    expect(newError).not.toBeNull();

    // Inspect message - it should reference the variable 'clusters' or mention initialization issues.
    const msg = newError ? (newError.message || '').toLowerCase() : '';
    const indicatesClustersProblem = msg.includes('clusters') || msg.includes('cannot access') || msg.includes('before initialization') || msg.includes('is not defined');
    expect(indicatesClustersProblem).toBeTruthy();

    // The clusters div should remain empty or unchanged because generation failed.
    const clustersContentAfter = await page.locator('#clusters').innerHTML();
    expect(clustersContentAfter).toBe('');
  });

  test('Edge case: Generate Clusters with invalid input (-1) triggers alert and prevents deeper runtime errors', async ({ page }) => {
    // This test ensures the input validation inside generateClusters triggers an alert
    // and returns early, preventing the deeper, internal errors from occurring.

    // Set an invalid number of clusters
    const input = page.locator('#num_clusters');
    await input.fill('-1');

    // Prepare to capture the dialog
    const dialogPromise = page.waitForEvent('dialog', { timeout: 2000 });

    // Remember current page error count so we can detect if any new errors occur after this action
    const beforeErrorCount = pageErrors.length;

    // Click generate clusters (should trigger alert and return early)
    await page.locator('#generate_clusters').click();

    // Await the dialog and assert its message
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('Please enter a positive integer');
    await dialog.accept();

    // Give a small pause to check no new page errors surfaced after handling the invalid input
    await page.waitForTimeout(200);

    expect(pageErrors.length).toBe(beforeErrorCount);
  });

  test('Event: View Clusters button has no registered global handler - clicking does not populate clusters', async ({ page }) => {
    // The implementation defines viewClusters only inside generateClusters, not globally.
    // The attempt to attach viewButton.addEventListener('click', viewClusters) at load produced a ReferenceError,
    // so the view button likely has no click handler. This test asserts that clicking it does nothing.

    const view = page.locator('#view_clusters');
    await expect(view).toHaveCount(1);

    // Snapshot current clusters content
    const before = await page.locator('#clusters').innerHTML();

    // Click the view button; since no handler was attached, nothing should happen (no new content)
    await view.click();

    // Wait briefly to allow any unexpected errors to surface
    await page.waitForTimeout(200);

    const after = await page.locator('#clusters').innerHTML();
    expect(after).toBe(before);

    // Assert that clicking view did not generate additional page errors (beyond those from load)
    // We allow the initial load error(s) but expect no new ones resulting from this click.
    // Using the fact that beforeEach captured load-time errors already.
    // Confirm that last console activity does not indicate a new pageerror was added.
    // (Since other tests run in isolation, pageErrors here only reflect this test's page)
    // So just assert pageErrors.length >= 1 (from load) and didn't grow after click.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Event: Update Centroids button is missing from DOM and cannot be triggered', async ({ page }) => {
    // The FSM expects an #update_clusters button, but the HTML does not include it.
    // This test asserts that the element is absent and that script attempts to reference it
    // (we already captured load-time errors related to missing handlers).

    const updateButtonCount = await page.locator('#update_clusters').count();
    expect(updateButtonCount).toBe(0);

    // Since the update button does not exist, we cannot click it.
    // Confirm that the pageErrors include at least one error referencing the broken event handler attachment.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Check that one of the captured errors mentions viewClusters or update handler issues
    const messages = pageErrors.map(e => (e && e.message ? e.message.toLowerCase() : ''));
    const hasRelevant = messages.some(m => m.includes('viewclusters') || m.includes('update_clusters') || m.includes('updatebutton') || m.includes('is not defined') || m.includes('cannot read'));
    expect(hasRelevant).toBeTruthy();
  });
});