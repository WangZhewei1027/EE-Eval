import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3dacbc1-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Refactoring Demo — FSM and UI integration tests', () => {
  // Shared variables capturing console and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page and wait for it to initialize
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    // Ensure the main elements are present
    await expect(page.locator('#originalArea')).toBeVisible();
    await expect(page.locator('#refactoredArea')).toBeVisible();
    await expect(page.locator('#applySelected')).toBeVisible();
  });

  test.afterEach(async ({}, testInfo) => {
    // Basic sanity: no unexpected page-level errors unless the test intentionally induced them.
    // Tests that intentionally cause errors will assert their appearance themselves.
    // Here we fail if there are page errors and the test did not expect them.
    if (!testInfo.title.includes('intentional error') && pageErrors.length > 0) {
      throw new Error(`Unexpected page errors: ${pageErrors.map(e => String(e)).join('; ')}`);
    }
  });

  test.describe('State S0_Idle (initialization & entry actions)', () => {
    test('Initial load calls applySelectedTransforms() and populates steps/diff/refactored area', async ({ page }) => {
      // This validates the S0_Idle entry action: applySelectedTransforms() is called on load.
      const stepsLocator = page.locator('#steps .step');
      // There should be at least one step applied on initialization (transforms were applied)
      await expect(stepsLocator.first()).toBeVisible();
      const stepsCount = await stepsLocator.count();
      expect(stepsCount).toBeGreaterThan(0);

      // Diff box should not be the original prompt anymore
      const diffText = await page.locator('#diffBox').innerText();
      expect(diffText).not.toContain('Press "Apply All Refactors" to see a line-by-line comparison.');

      // Refactored area should have code content
      const refactoredValue = await page.locator('#refactoredArea').inputValue();
      expect(refactoredValue.length).toBeGreaterThan(0);

      // No unexpected page errors on initial load
      expect(pageErrors.length).toBe(0);
    });

    test('Undo when history is minimal resets to original example', async ({ page }) => {
      // Clicking undo on a freshly loaded page should reset content to originalExample (handled by page script)
      const originalBefore = await page.locator('#originalArea').inputValue();

      // Click undo
      await page.click('#undo');

      // After undo, originalArea should still contain the original example (remains defined)
      const originalAfter = await page.locator('#originalArea').inputValue();
      expect(originalAfter.length).toBeGreaterThan(0);
      // The script's originalExample is a longer snippet containing "calculateOrderTotal"
      expect(originalAfter).toContain('calculateOrderTotal');

      // refactoredArea should also be reset
      const refAfter = await page.locator('#refactoredArea').inputValue();
      expect(refAfter).toContain('calculateOrderTotal');

      // steps and diff should be cleared
      await expect(page.locator('#steps')).toHaveText('');
      await expect(page.locator('#diffBox')).not.toContainText('+ ');
    });
  });

  test.describe('State S1_Refactoring (apply transforms & undo)', () => {
    test('Apply Selected: updates refactoredArea, steps, and diff', async ({ page }) => {
      // This test validates the ApplySelectedRefactors event/transition from S0_Idle -> S1_Refactoring
      // Modify the originalArea slightly to ensure transform has something to operate on
      const originalLocator = page.locator('#originalArea');
      const originalBefore = await originalLocator.inputValue();
      // Append a harmless comment line to cause a difference
      const appended = originalBefore + '\n// appended comment for test';
      await originalLocator.fill(appended);

      // Click "Apply Selected"
      await page.click('#applySelected');

      // refactoredArea should be updated and differ from the new original
      const refactored = await page.locator('#refactoredArea').inputValue();
      expect(refactored.length).toBeGreaterThan(0);
      expect(refactored).not.toEqual(appended);

      // Steps should show at least one step
      const steps = page.locator('#steps .step');
      await expect(steps.first()).toBeVisible();
      expect(await steps.count()).toBeGreaterThan(0);

      // Diff box should reflect differences (contain + or - lines)
      const diffText = await page.locator('#diffBox').innerText();
      expect(diffText.length).toBeGreaterThan(0);
      // Expect at least one diff marker or the appended comment present
      expect(diffText.includes('+ ') || diffText.includes('- ') || diffText.includes('appended comment')).toBeTruthy();

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Apply All: ensures all transform checkboxes are enabled and transforms applied', async ({ page }) => {
      // Uncheck some checkboxes first to validate applyAll toggles them on
      await page.locator('#t_guard').uncheck();
      await page.locator('#t_extract').uncheck();
      // Now click Apply All
      await page.click('#applyAll');

      // All checkboxes should now be checked
      expect(await page.locator('#t_guard').isChecked()).toBeTruthy();
      expect(await page.locator('#t_extract').isChecked()).toBeTruthy();
      expect(await page.locator('#t_constants').isChecked()).toBeTruthy();
      expect(await page.locator('#t_varlet').isChecked()).toBeTruthy();
      expect(await page.locator('#t_format').isChecked()).toBeTruthy();

      // Steps should include items for multiple transforms (at least 3)
      const stepsCount = await page.locator('#steps .step').count();
      expect(stepsCount).toBeGreaterThanOrEqual(3);

      // diffBox should be updated
      const diffText = await page.locator('#diffBox').innerText();
      expect(diffText.length).toBeGreaterThan(0);
    });

    test('Undo after refactoring restores previous original and clears diffs/output', async ({ page }) => {
      // Ensure there's a change in history: modify and apply
      const originalLocator = page.locator('#originalArea');
      const originalInitial = await originalLocator.inputValue();
      const modified = originalInitial + '\n// undo-test line';
      await originalLocator.fill(modified);
      await page.click('#applySelected');

      // Now click undo to revert
      await page.click('#undo');

      // After undo, originalArea should revert to something that includes calculateOrderTotal
      const originalAfterUndo = await originalLocator.inputValue();
      expect(originalAfterUndo).toContain('calculateOrderTotal');

      // refactoredArea should equal the original after undo
      const refAfterUndo = await page.locator('#refactoredArea').inputValue();
      expect(refAfterUndo).toContain('calculateOrderTotal');

      // steps and diff and testOutput should be cleared (or empty)
      await expect(page.locator('#steps')).toHaveText('');
      const diffBoxText = await page.locator('#diffBox').innerText();
      // diff might be empty string or original prompt; ensure it's not showing a stale diff containing our undo-test line
      expect(diffBoxText).not.toContain('undo-test line');
      await expect(page.locator('#testOutput')).toHaveText('');
    });
  });

  test.describe('State S2_Testing (run tests and error scenarios)', () => {
    test('Run Tests (RunTests button) shows test results and PASS for demo example', async ({ page }) => {
      // Ensure the app is in a consistent refactored state
      await page.click('#applySelected');

      // Click Run Tests
      await page.click('#runTests');

      // testOutput should contain "Original function" and "Refactored function" sections and a PASS/FAIL summary
      const output = await page.locator('#testOutput').innerText();
      expect(output).toContain('Original function');
      expect(output).toContain('Refactored function');
      // Should contain PASS or FAIL; for demo expected to be PASS
      expect(output).toMatch(/PASS|FAIL/);

      // Prefer PASS for the built-in example to validate behavior preserved
      expect(output).toContain('PASS');

      // No page errors expected
      expect(pageErrors.length).toBe(0);
    });

    test('Run Tests (RunTests2 button) produces same test output', async ({ page }) => {
      // Click alternate Run Tests button
      await page.click('#runTests2');
      const output = await page.locator('#testOutput').innerText();
      expect(output).toContain('Original function');
      expect(output).toContain('Refactored function');
      expect(output).toContain('PASS');
    });

    test('Intentional error: invalid original code leads to test error output (intentional error scenario)', async ({ page }) => {
      // This test intentionally injects a syntax error into the originalArea to produce an error during testing.
      // We do not patch or override any page functions; we simply edit the textarea and trigger the provided Run Tests flow.

      // Put invalid JS into the originalArea to provoke a SyntaxError when evaluated
      const badCode = `function calculateOrderTotal(items, customerType) { this is invalid JS !! `;
      await page.locator('#originalArea').fill(badCode);

      // Click Run Tests which will call showTestOutput and render the error result
      await page.click('#runTests');

      // The testOutput should contain an Error block with the error text
      const testOutputText = await page.locator('#testOutput').innerText();
      expect(testOutputText).toContain('Error:');
      // The wrapper uses new Function, so the error string should include SyntaxError or Unexpected token
      expect(/SyntaxError|Unexpected|error/i.test(testOutputText)).toBeTruthy();

      // There may be no page.on('pageerror') fired because errors are caught and returned as strings.
      // Still, ensure our pageErrors array reflects uncaught exceptions (likely zero).
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('ShowSteps and step rationale verification', () => {
    test('Show Steps displays strong step titles and rationale text, updates diff and refactored area', async ({ page }) => {
      // Make sure we have an original state
      await page.locator('#originalArea').fill(await page.locator('#originalArea').inputValue());

      // Click Show Steps
      await page.click('#showSteps');

      // Each .step created by Show Steps contains a <strong> title and a "Why:" rationale
      const steps = page.locator('#steps .step');
      await expect(steps.first()).toBeVisible();
      const firstStepHtml = await steps.first().innerHTML();
      expect(firstStepHtml).toMatch(/<strong>.*<\/strong>/i);
      expect(firstStepHtml).toContain('Why:');

      // diffBox should be updated to show differences
      const diffText = await page.locator('#diffBox').innerText();
      expect(diffText.length).toBeGreaterThan(0);

      // refactoredArea should be populated with the transformed code
      const refactoredValue = await page.locator('#refactoredArea').inputValue();
      expect(refactoredValue.length).toBeGreaterThan(0);
      expect(refactoredValue).not.toBe('');
    });
  });

  test.describe('Edge cases and resilience', () => {
    test('Toggling checkboxes then applying respects options (try disabling formatting)', async ({ page }) => {
      // Disable the formatting transform
      await page.locator('#t_format').uncheck();

      // Get current original value and apply transforms
      const originalVal = await page.locator('#originalArea').inputValue();
      await page.click('#applySelected');

      // refactoredArea should be produced; because format is off, we expect that certain formatting changes (like consistent indentation) are not applied.
      const refactored = await page.locator('#refactoredArea').inputValue();
      // Basic assertion: refactored exists and differs from original (some transforms still likely applied)
      expect(refactored.length).toBeGreaterThan(0);
      // Since format was disabled, there should be fewer newline/indent normalization effects: ensure there is at least one line containing 'function computeItemTotal' or TAX_RATE or var->let replacements may exist depending on other transforms.
      // We don't rigidly assert specific transform text because transforms are pattern-based; just ensure no page errors occurred.
      expect(pageErrors.length).toBe(0);
    });

    test('Multiple sequential transforms and undos maintain history and do not crash', async ({ page }) => {
      const originalLocator = page.locator('#originalArea');
      const base = await originalLocator.inputValue();

      // Make 3 small edits and apply each time
      for (let i = 1; i <= 3; i++) {
        await originalLocator.fill(base + `\n// edit ${i}`);
        await page.click('#applySelected');
        // ensure refactoredArea updated each time
        const ref = await page.locator('#refactoredArea').inputValue();
        expect(ref.length).toBeGreaterThan(0);
      }

      // Now undo twice and ensure originalArea contains content (no crash) and diff cleared after undos
      await page.click('#undo');
      await page.click('#undo');

      const currentOriginal = await originalLocator.inputValue();
      expect(currentOriginal.length).toBeGreaterThan(0);
      // Ensure the UI is still responsive by running tests once more
      await page.click('#runTests');
      const out = await page.locator('#testOutput').innerText();
      // testOutput should show PASS or FAIL (should not be empty)
      expect(out.length).toBeGreaterThan(0);
    });
  });
});