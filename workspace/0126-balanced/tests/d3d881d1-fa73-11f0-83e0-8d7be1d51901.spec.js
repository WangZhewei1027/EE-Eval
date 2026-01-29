import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d881d1-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Space Complexity Explorer - FSM states and transitions', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors for each test
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // best-effort capture
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    page.on('pageerror', err => {
      // Capture unhandled exceptions (ReferenceError / TypeError / SyntaxError, etc.)
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Wait briefly to allow any initial scripts to run (updateUI is called on init)
    await page.waitForTimeout(50); // small pause to ensure init UI update finished
  });

  test.afterEach(async ({}, testInfo) => {
    // If a test failed, include the captured console and page errors in the output
    if (testInfo.status !== testInfo.expectedStatus) {
      // Attach console and errors to the test report if available
      // (Playwright Reporter will include test output; we add to stderr)
      console.error('Captured console messages:', consoleMessages);
      console.error('Captured page errors:', pageErrors.map(e => ({ name: e.name, message: e.message })));
    }
  });

  test('Initial idle state (S0_Idle) - UI initialized and updateUI applied on load', async ({ page }) => {
    // This test validates that the app starts in the Idle state and runs its initialization
    // (the implementation calls updateUI() immediately on init). We assert DOM reflects
    // the default example ("const") with n=10 and includeInput checked.

    // Verify slider initial value and displayed numeric value
    const nRange = page.locator('#nRange');
    const nVal = page.locator('#nVal');
    await expect(nRange).toHaveValue('10');
    await expect(nVal).toHaveText('10');

    // Verify title and formula reflect the default example (constant space)
    const titleExample = page.locator('#titleExample');
    const formulaEl = page.locator('#formula');
    await expect(titleExample).toHaveText(/Constant space/);
    await expect(formulaEl).toHaveText('Auxiliary: O(1)');

    // Verify counts: inputUnits = 10, auxUnits = 1, total = 11 (includeInput checked by default)
    const inputCount = page.locator('#inputCount');
    const auxCount = page.locator('#auxCount');
    const totalCount = page.locator('#totalCount');
    await expect(inputCount).toHaveText('10 units');
    await expect(auxCount).toHaveText('1 units');
    await expect(totalCount).toHaveText('11 units');

    // Verify bar segment widths correspond to the computed percentages (10/(10+1) => 91% input, 9% aux)
    const inputSeg = page.locator('#inputSeg');
    const auxSeg = page.locator('#auxSeg');
    await expect(inputSeg).toHaveAttribute('style', /width:91%/);
    await expect(auxSeg).toHaveAttribute('style', /width:9%/);

    // Verify smallGrid shows 11 boxes (<= 300), so child count = 11
    const smallGrid = page.locator('#smallGrid');
    const childCount = await smallGrid.locator(':scope > div:not([style*="margin-top"])').count();
    // There are 11 units (10 input + 1 aux). We locate the unit boxes specifically by class.
    const unitBoxes = await smallGrid.locator('.unit, .unit.aux').count();
    expect(unitBoxes).toBe(11);

    // Verify accessibility attributes (aria-valuenow) are set
    await expect(inputSeg).toHaveAttribute('aria-valuenow', '10');
    await expect(auxSeg).toHaveAttribute('aria-valuenow', '1');

    // Assert that no page-level exceptions (ReferenceError / TypeError / SyntaxError) occurred during init
    expect(pageErrors.length).toBe(0);

    // Ensure no console 'error' messages were emitted during initialization
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('InputChange event updates displayed n value but does NOT automatically update visualization (as implemented)', async ({ page }) => {
    // FSM expected updateUI on input change, but the implementation only updates nVal.
    // This test verifies that discrepancy: nVal updates on input event, but counts remain until Update is clicked.

    // Change slider to 20 by setting value and dispatching input event
    await page.evaluate(() => {
      const r = document.getElementById('nRange');
      r.value = '20';
      // dispatch input event as the real control would
      r.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // nVal should reflect new slider value immediately
    const nVal1 = page.locator('#nVal1');
    await expect(nVal).toHaveText('20');

    // But the inputCount (and visualization) should still reflect previous updateUI state (10 units)
    const inputCount1 = page.locator('#inputCount1');
    await expect(inputCount).toHaveText('10 units');

    // Now click Update to apply the change (triggers updateUI)
    const runBtn = page.locator('#runBtn');
    await runBtn.click();

    // After clicking Update, inputCount should update to 20
    await expect(inputCount).toHaveText('20 units');

    // Confirm auxCount remains 1 (constant example)
    const auxCount1 = page.locator('#auxCount1');
    await expect(auxCount).toHaveText('1 units');

    // And total updates to 21
    const totalCount1 = page.locator('#totalCount1');
    await expect(totalCount).toHaveText('21 units');
  });

  test('UpdateClick event triggers updateUI and updates visualization for selected example', async ({ page }) => {
    // This test ensures that clicking the Update button runs updateUI (registered in code)
    // and updates the DOM to reflect the current slider and selected example.

    // Set example back to constant to be certain, set slider to 15 and click update
    await page.selectOption('#example', 'const');
    await page.evaluate(() => {
      const r1 = document.getElementById('nRange');
      r.value = '15';
    });

    // Click update
    await page.locator('#runBtn').click();

    // Assert numbers updated correctly: input 15, aux 1, total 16
    await expect(page.locator('#inputCount')).toHaveText('15 units');
    await expect(page.locator('#auxCount')).toHaveText('1 units');
    await expect(page.locator('#totalCount')).toHaveText('16 units');

    // Check smallGrid contains 16 unit boxes
    const unitBoxes1 = await page.locator('#smallGrid').locator('.unit, .unit.aux').count();
    expect(unitBoxes).toBe(16);
  });

  test('ExampleChange transition: selecting a quadratic example updates formula, counts, and triggers scaled visualization', async ({ page }) => {
    // Switch to "matrix" example which has quadratic auxiliary space: aux = n * n
    // Use n = 50 to exceed the smallGrid threshold (total units > 300) and verify scaled representation

    // Set slider to 50
    await page.evaluate(() => {
      const r2 = document.getElementById('nRange');
      r.value = '50';
      r.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Change example to 'matrix' (this change handler calls updateUI automatically per implementation)
    // The implementation wires exampleEl.addEventListener('change', updateUI);
    await page.selectOption('#example', 'matrix');

    // Small pause to allow change handler to run
    await page.waitForTimeout(30);

    // Verify UI text updated (title and formula)
    await expect(page.locator('#titleExample')).toHaveText(/Quadratic/);
    await expect(page.locator('#formula')).toHaveText('Auxiliary: O(n²)');

    // Compute expected counts: input=50, aux=2500, total=2550 (includeInput is true by default)
    await expect(page.locator('#inputCount')).toHaveText('50 units');
    await expect(page.locator('#auxCount')).toHaveText('2500 units');
    await expect(page.locator('#totalCount')).toHaveText('2550 units');

    // Because total > 300, the smallGrid should show a scaled sample and include a note describing the sample
    const smallGrid1 = page.locator('#smallGrid1');
    // There should be at least one note element (a div with text starting 'Visualization shows a scaled sample')
    const noteLocator = smallGrid.locator('div').filter({ hasText: 'Visualization shows a scaled sample' });
    await expect(noteLocator.first()).toBeVisible();

    // Ensure number of visual unit boxes is less than actual units (scaled)
    const unitBoxes2 = await smallGrid.locator('.unit, .unit.aux').count();
    expect(unitBoxes).toBeGreaterThan(0);
    expect(unitBoxes).toBeLessThan(300 + 5); // some overhead; should be well below 2550

    // Confirm aria attributes updated for segments reflect new numbers
    await expect(page.locator('#inputSeg')).toHaveAttribute('aria-valuenow', '50');
    await expect(page.locator('#auxSeg')).toHaveAttribute('aria-valuenow', '2500');
  });

  test('IncludeInputChange transition: toggling includeInput changes total and total bar segments', async ({ page }) => {
    // Ensure we are on matrix example at n=50 (from previous test scenario)
    await page.selectOption('#example', 'matrix');
    await page.evaluate(() => {
      const r3 = document.getElementById('nRange');
      r.value = '50';
      r.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // Make sure updateUI runs
    await page.locator('#runBtn').click();

    // Verify current totals assume includeInput=true
    await expect(page.locator('#totalCount')).toHaveText('2550 units');

    // Toggle includeInput off (this triggers updateUI per implementation)
    await page.locator('#includeInput').click();

    // Wait briefly for update
    await page.waitForTimeout(30);

    // Now total should equal auxUnits only: 2500 units
    await expect(page.locator('#totalCount')).toHaveText('2500 units');

    // And totalInputSeg should have width 0% because input is not counted in total
    await expect(page.locator('#totalInputSeg')).toHaveAttribute('style', /width:0%/);

    // Toggle includeInput back on
    await page.locator('#includeInput').click();
    await page.waitForTimeout(30);

    // Total should be back to 2550
    await expect(page.locator('#totalCount')).toHaveText('2550 units');
  });

  test('Edge cases & small n checks: recursive binary search (rec_bin) with n=1 avoids divide by zero and shows minimal stack', async ({ page }) => {
    // Select recursive binary search example and set n=1 (edge for log computation)
    await page.selectOption('#example', 'rec_bin');

    await page.evaluate(() => {
      const r4 = document.getElementById('nRange');
      r.value = '1';
      r.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Click update to run updateUI
    await page.locator('#runBtn').click();
    await page.waitForTimeout(20);

    // For n=1, auxFn should compute at least 1 (Math.max(1, floor(log2(1))+1) = 1)
    await expect(page.locator('#auxCount')).toHaveText('1 units');

    // Input units = 1 for rec_bin's inputFn
    await expect(page.locator('#inputCount')).toHaveText('1 units');

    // Total (includeInput default true) should be 2 units
    await expect(page.locator('#totalCount')).toHaveText('2 units');

    // SmallGrid should show 2 boxes
    const unitBoxes3 = await page.locator('#smallGrid').locator('.unit, .unit.aux').count();
    expect(unitBoxes).toBe(2);
  });

  test('Sanity: No runtime ReferenceError / SyntaxError / TypeError occurred during interactions', async ({ page }) => {
    // This test asserts that throughout the interactions in this test suite, there were no unhandled
    // page errors. We capture and assert that none of the errors are runtime exceptions like
    // ReferenceError, TypeError, or SyntaxError.

    // Inspect captured pageErrors
    if (pageErrors.length > 0) {
      // If there are errors, fail with details
      const errSummaries = pageErrors.map(e => `${e.name}: ${e.message}`).join('\n');
      // Fail the test with collected error messages
      throw new Error('Page errors were captured during test run:\n' + errSummaries);
    }

    // Also ensure no console messages of type 'error'
    const consoleErrors1 = consoleMessages.filter(m => m.type === 'error');
    if (consoleErrors.length > 0) {
      const texts = consoleErrors.map(c => c.text).join('\n');
      throw new Error('Console error messages were emitted:\n' + texts);
    }

    // If we get here, no page exceptions or console errors were observed
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Pseudocode and explanation DOM update verification for multiple examples', async ({ page }) => {
    // Validate that selecting different examples updates the pseudocode and explanation text content.
    const examplesToTest = [
      { key: 'copy', expectedSnippet: 'slice' },
      { key: 'map', expectedSnippet: 'double(arr)' },
      { key: 'rec_fact', expectedSnippet: 'function fact' },
      { key: 'fib_naive', expectedSnippet: 'function fib' }
    ];

    for (const ex of examplesToTest) {
      await page.selectOption('#example', ex.key);
      // change event triggers updateUI; give a bit of time
      await page.waitForTimeout(30);

      const pseudocode = await page.locator('#pseudocode').textContent();
      const explainText = await page.locator('#explainText').textContent();

      expect(pseudocode).toContain(ex.expectedSnippet);
      expect(explainText.length).toBeGreaterThan(10); // should have explanatory text
    }
  });
});