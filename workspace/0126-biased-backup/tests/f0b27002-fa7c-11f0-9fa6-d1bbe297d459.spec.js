import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b27002-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('BFS Visualization FSM - f0b27002-fa7c-11f0-9fa6-d1bbe297d459', () => {
  // Arrays to capture runtime console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the exact page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright's built-in cleanup.
    // Tests will assert on consoleErrors/pageErrors where relevant.
  });

  test('Initial Idle state: renders Start BFS button and empty steps div', async ({ page }) => {
    // This test validates the S0_Idle state per FSM:
    // - The Start BFS button is present and labeled correctly
    // - The steps container is initially empty (no visualization yet)
    const visualizeBtn = page.locator('#visualizeBtn');
    const stepsDiv = page.locator('#steps');

    // Button should be visible and contain the expected text
    await expect(visualizeBtn).toBeVisible();
    await expect(visualizeBtn).toHaveText('Start BFS from A');

    // Steps div should initially be empty
    await expect(stepsDiv).toBeVisible();
    const initialStepsText = await stepsDiv.innerText();
    expect(initialStepsText.trim()).toBe('', 'Expected #steps to be empty on initial render');

    // Ensure there were no JS runtime errors on initial load
    expect(consoleErrors, 'No console.error should be emitted on initial load').toEqual([]);
    expect(pageErrors, 'No page errors should be emitted on initial load').toEqual([]);
  });

  test('Click Start BFS transitions to Visualizing: processes A and enqueues B and C', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Visualizing triggered by clicking #visualizeBtn.
    // It asserts that the visualization begins and the expected observables appear:
    // "Step 1", "Processing node A", "Enqueuing neighbor: B", "Enqueuing neighbor: C", and queue state

    const visualizeBtn = page.locator('#visualizeBtn');
    const stepsDiv = page.locator('#steps');

    // Click to start BFS visualization
    await visualizeBtn.click();

    // Wait for the first processing step and enqueues to appear.
    // The implementation uses setInterval with 1500ms per step, so give a generous timeout.
    await page.waitForFunction(() => {
      const el = document.getElementById('steps');
      return el && el.innerText.includes('Step 1') && el.innerText.includes('Enqueuing neighbor: B') && el.innerText.includes('Enqueuing neighbor: C');
    }, null, { timeout: 15000 });

    const stepsTextAfterA = await stepsDiv.innerText();

    // Validate that the output contains evidence of processing A and enqueuing B and C
    expect(stepsTextAfterA).toContain('Step 1', 'Expected a Step 1 entry after starting visualization');
    expect(stepsTextAfterA).toContain('Processing node A', 'Expected Processing node A to be shown');
    expect(stepsTextAfterA).toContain('Enqueuing neighbor: B', 'Expected enqueuing B to be shown');
    expect(stepsTextAfterA).toContain('Enqueuing neighbor: C', 'Expected enqueuing C to be shown');

    // Also assert that the queue representation after processing A is shown
    expect(stepsTextAfterA).toMatch(/Queue:\s*\[B,\s*C\]/, 'Expected queue to show [B, C] after processing A');

    // No unexpected JS runtime errors occurred during this interaction
    expect(consoleErrors, 'No console.error should be emitted during initial BFS steps').toEqual([]);
    expect(pageErrors, 'No page errors should be emitted during initial BFS steps').toEqual([]);
  });

  test('Full BFS visualization completes and emits "BFS complete!" (S1_Visualizing exit action)', async ({ page }) => {
    // This test validates that repeating BFS steps eventually reach the completion state where
    // "BFS complete!" is appended, which corresponds to the S1_Visualizing exit action completeBFSVisualization()
    const visualizeBtn = page.locator('#visualizeBtn');
    const stepsDiv = page.locator('#steps');

    // Start the visualization
    await visualizeBtn.click();

    // Wait for the "BFS complete!" message to appear. The visualization processes 6 nodes,
    // with ~1.5s between each, so allow ample timeout.
    await page.waitForFunction(() => {
      const el = document.getElementById('steps');
      return el && el.innerText.includes('BFS complete!');
    }, null, { timeout: 30000 });

    const finalStepsText = await stepsDiv.innerText();

    // Assert completion text
    expect(finalStepsText).toContain('BFS complete!', 'Expected BFS complete! appended when the queue empties');

    // Validate that intermediate processing lines for nodes B and C also appeared at some point
    expect(finalStepsText).toContain('Processing node B', 'Expected Processing node B during BFS');
    expect(finalStepsText).toContain('Processing node C', 'Expected Processing node C during BFS');

    // No unexpected runtime errors occurred during the full visualization
    expect(consoleErrors, 'No console.error should be emitted during full BFS run').toEqual([]);
    expect(pageErrors, 'No page errors should be emitted during full BFS run').toEqual([]);
  }, /* increase timeout for long-running visualization */ 45000);

  test('Edge case: clicking Start BFS multiple times cleans and restarts the visualization', async ({ page }) => {
    // The implementation clears stepsDiv.innerHTML at the start of the click handler.
    // This test verifies that a second click clears previous output and starts a fresh run.
    const visualizeBtn = page.locator('#visualizeBtn');
    const stepsDiv = page.locator('#steps');

    // First click - start visualization
    await visualizeBtn.click();

    // Wait until at least the first step appears
    await page.waitForFunction(() => {
      const el = document.getElementById('steps');
      return el && el.innerText.includes('Step 1');
    }, null, { timeout: 15000 });

    // Now click again to restart. The handler calls stepsDiv.innerHTML = '' synchronously,
    // so the div should be cleared immediately on the second click.
    await visualizeBtn.click();

    // Immediately after the second click the stepsDiv should be cleared (or empty string)
    // Use a short wait to allow the synchronous clear to take effect.
    await page.waitForFunction(() => {
      const el = document.getElementById('steps');
      return el && el.innerText.trim() === '';
    }, null, { timeout: 2000 });

    // After some time the restarted visualization should again produce a Step 1 entry
    await page.waitForFunction(() => {
      const el = document.getElementById('steps');
      return el && el.innerText.includes('Step 1');
    }, null, { timeout: 15000 });

    // Validate that we see a Step 1 after restart (evidence of a fresh run)
    const stepsAfterRestart = await stepsDiv.innerText();
    expect(stepsAfterRestart).toContain('Step 1', 'Expected a new Step 1 after restarting visualization');

    // No unexpected runtime errors during multiple clicks
    expect(consoleErrors, 'No console.error should be emitted when clicking multiple times').toEqual([]);
    expect(pageErrors, 'No page errors should be emitted when clicking multiple times').toEqual([]);
  });

  test('Observes console and page errors (if any) during interactions - reports presence or absence', async ({ page }) => {
    // This test's goal is to explicitly observe and assert on any console errors / page errors.
    // Per instructions, we load the page as-is and let any ReferenceError/SyntaxError/TypeError happen naturally.
    // Here we simply perform a typical interaction and then assert that the test captures whatever occurred.
    const visualizeBtn = page.locator('#visualizeBtn');

    // Perform interaction
    await visualizeBtn.click();

    // Wait briefly for potential immediate errors to surface
    await page.waitForTimeout(1000);

    // We do not force errors to occur nor patch anything.
    // Assert that our arrays are present and are arrays (they will be empty if no errors occurred).
    expect(Array.isArray(consoleErrors)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();

    // For test reporting clarity, make an assertion that no unexpected runtime errors occurred.
    // If runtime errors do exist in the environment, these expectations will fail, surfacing them as required.
    expect(consoleErrors, 'Expect no console.error messages during simple interaction').toEqual([]);
    expect(pageErrors, 'Expect no uncaught page errors during simple interaction').toEqual([]);
  });

});