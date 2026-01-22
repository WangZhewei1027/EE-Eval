import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b011f21-d5c3-11f0-b41f-b131cbd11f51.html';

test.describe.serial('Floyd-Warshall Visualization - FSM end-to-end tests', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    // Load the application and wait for full load (onload handlers)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No teardown required beyond Playwright fixtures;
    // we keep listeners attached per test via beforeEach context.
  });

  test('S0_Idle -> S1_MatrixCreated: on load the matrix is created and Run button enabled', async ({ page }) => {
    // This test verifies the initial state (S0_Idle entry action createMatrix())
    // and transition to Matrix Created (S1_MatrixCreated) where runBtn becomes enabled.

    // Wait a little to allow the window.onload setTimeout sample values to populate
    await page.waitForTimeout(250);

    // Matrix container should contain a table
    const matrixTable = page.locator('#matrixContainer table');
    await expect(matrixTable).toHaveCount(1);

    // The Run button should be enabled by createMatrix()
    const runBtn = page.locator('#runBtn');
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toBeEnabled();

    // Check a few of the default sample values populated by the onload setTimeout
    // These values should match the ones set in the HTML script
    await expect(page.locator('#cell-0-1')).toHaveValue('3');
    await expect(page.locator('#cell-0-2')).toHaveValue('6');
    await expect(page.locator('#cell-1-2')).toHaveValue('2');
    await expect(page.locator('#cell-1-3')).toHaveValue('1');
    await expect(page.locator('#cell-2-3')).toHaveValue('4');
    await expect(page.locator('#cell-3-0')).toHaveValue('1');

    // Ensure no unexpected page errors were thrown during load
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Create Matrix event: changing node count and creating a new matrix updates DOM', async ({ page }) => {
    // This test validates the CreateMatrix event triggers a rebuilt matrix
    // Change nodeCount to 3 and click Create Matrix, then assert correct number of inputs

    const nodeCountInput = page.locator('#nodeCount');
    await nodeCountInput.fill('3');

    // Click the Create Matrix button
    const createBtn = page.locator('button', { hasText: 'Create Matrix' });
    await createBtn.click();

    // After creating, expect a 3x3 matrix (3*3 inputs plus disabled diagonal)
    // Count input elements inside matrixContainer
    const inputs = page.locator('#matrixContainer input');
    await expect(inputs).toHaveCount(9);

    // Diagonal cells should be disabled and equal '0'
    await expect(page.locator('#cell-0-0')).toBeDisabled();
    await expect(page.locator('#cell-0-0')).toHaveValue('0');
    await expect(page.locator('#cell-1-1')).toBeDisabled();
    await expect(page.locator('#cell-2-2')).toBeDisabled();

    // Run button should be enabled after creating matrix
    await expect(page.locator('#runBtn')).toBeEnabled();

    // No page errors expected here
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('RunAlgorithm: running the algorithm displays steps and final result (S1 -> S2 -> S3)', async ({ page }) => {
    // This test exercises RunAlgorithm and validates:
    // - Steps are displayed
    // - Final result section is visible
    // - Navigation buttons are present and correctly enabled/disabled

    // Ensure we have a matrix (use existing from load or create anew)
    // Wait for any pending setTimeout population
    await page.waitForTimeout(250);

    // Click Run Floyd-Warshall
    await page.click('#runBtn');

    // resultSection should be visible after runAlgorithm completes
    const resultSection = page.locator('#resultSection');
    await expect(resultSection).toBeVisible();

    // Steps container should contain at least one step (initial + final)
    const stepDivs = page.locator('#stepsContainer .step');
    await expect(stepDivs).toHaveCountGreaterThan(0);

    // Final result container should contain a table
    const finalResultTable = page.locator('#finalResult table');
    await expect(finalResultTable).toHaveCount(1);

    // Navigation buttons should exist within stepsContainer
    const prevBtn = page.locator('#stepsContainer button', { hasText: 'Previous Step' });
    const nextBtn = page.locator('#stepsContainer button', { hasText: 'Next Step' });
    await expect(prevBtn).toHaveCount(1);
    await expect(nextBtn).toHaveCount(1);

    // Initially, previous button should be disabled (at first step), next may or may not be disabled
    await expect(prevBtn).toBeDisabled();
    // Next button is disabled only if there's exactly one step; ensure behavior accordingly
    const stepsCount = await stepDivs.count();
    if (stepsCount > 1) {
      await expect(nextBtn).toBeEnabled();
    } else {
      await expect(nextBtn).toBeDisabled();
    }

    // Verify that one of the step elements has class 'current' (the displayed step)
    const currentStepDiv = page.locator('#stepsContainer .step.current');
    await expect(currentStepDiv).toHaveCount(1);

    // No page errors expected from running algorithm
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('NavigateNextStep and NavigatePreviousStep: navigation updates current class and button states', async ({ page }) => {
    // This test validates navigation within S3_ResultDisplayed
    await page.waitForTimeout(250);
    await page.click('#runBtn');

    // Ensure steps loaded
    const stepDivs = page.locator('#stepsContainer .step');
    const stepsCount = await stepDivs.count();
    expect(stepsCount).toBeGreaterThan(0);

    const prevBtn = page.locator('#stepsContainer button', { hasText: 'Previous Step' });
    const nextBtn = page.locator('#stepsContainer button', { hasText: 'Next Step' });

    // If only one step, navigation is disabled; otherwise test next/prev functionality
    if (stepsCount > 1) {
      // Click Next Step and verify 'current' moves forward
      await nextBtn.click();
      // After clicking next, previous should be enabled
      await expect(prevBtn).toBeEnabled();

      // Find index of current .step
      const currentIdAfterNext = await page.locator('#stepsContainer .step.current').getAttribute('id');
      expect(currentIdAfterNext).toMatch(/^step-\d+$/);

      // Click Previous Step to go back
      await prevBtn.click();
      // Now previous should again be disabled (back at 0)
      await expect(prevBtn).toBeDisabled();

      const currentIdAfterPrev = await page.locator('#stepsContainer .step.current').getAttribute('id');
      expect(currentIdAfterPrev).toBe('step-0');
    } else {
      // If only one step, both buttons should be disabled
      await expect(prevBtn).toBeDisabled();
      await expect(nextBtn).toBeDisabled();
    }

    // Ensure no unexpected page errors during navigation
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('ResetMatrix: clicking Reset clears non-diagonal inputs and hides results', async ({ page }) => {
    // This test validates the ResetMatrix event clears matrix inputs (non-disabled) and hides results section

    await page.waitForTimeout(250);
    // Ensure sample values are present and run algorithm to produce results
    await page.click('#runBtn');

    // Verify results visible
    await expect(page.locator('#resultSection')).toBeVisible();

    // Click Reset
    await page.click('button', { hasText: 'Reset' });

    // resultSection should be hidden after reset
    await expect(page.locator('#resultSection')).toHaveCSS('display', 'none');

    // Non-disabled inputs should be cleared
    const inputs = page.locator('#matrixContainer input:not([disabled])');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const val = await inputs.nth(i).inputValue();
      // Reset sets value to '' for non-disabled cells
      expect(val).toBe('');
    }

    // No page errors expected
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Edge case: CreateMatrix with invalid node count triggers alert and does not change matrix', async ({ page }) => {
    // This test validates the edge-case path where nodeCount is out of bounds (less than 2)
    // The application should alert and not recreate the matrix.

    // Intercept dialog
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Set nodeCount to invalid value '1' and click Create Matrix
    await page.fill('#nodeCount', '1');
    await page.click('button', { hasText: 'Create Matrix' });

    // Dialog should have been shown with the expected text
    expect(dialogMessage).toContain('Please enter a number between 2 and 6.');

    // After cancelling, the existing matrix from onload should still be present
    await expect(page.locator('#matrixContainer table')).toHaveCount(1);

    // No page errors expected
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Error scenario: invoking navigateSteps before steps exist results in a page error (TypeError)', async ({ page }) => {
    // This test intentionally calls navigateSteps before displaySteps runs to allow natural errors
    // We do not modify the page - we simply call the function as-is and assert that an error occurs.

    // Ensure we're in a state before running the algorithm: reset page to initial load state
    // Reload to be clean
    await page.reload({ waitUntil: 'load' });

    // Wait briefly for onload createMatrix to finish
    await page.waitForTimeout(250);

    // Calling navigateSteps(1) when steps are not created should cause a TypeError due to null DOM access.
    // We expect the evaluate to reject; capture the rejection.
    let evalError = null;
    try {
      // This will propagate the in-page exception to Playwright and reject the promise.
      await page.evaluate(() => {
        // Intentionally invoke navigation before steps exist; let any error happen naturally.
        // Do not catch here to allow natural error propagation.
        navigateSteps(1);
      });
      // If no error thrown in page context, record that unexpected situation
      evalError = null;
    } catch (e) {
      evalError = String(e);
    }

    // We expect an error to have been thrown
    expect(evalError, 'Expected navigateSteps to throw an error when steps are missing').not.toBeNull();

    // Ensure that a TypeError was reported in the pageerror events (or the thrown error string includes TypeError)
    const pageErrorMatches = pageErrors.some(pe => /TypeError|cannot read property|Cannot read properties of null/i.test(pe));
    const evalErrorMatches = /TypeError|cannot read property|Cannot read properties of null/i.test(evalError || '');

    expect(pageErrorMatches || evalErrorMatches, `Expected a TypeError-like message. pageErrors: ${JSON.stringify(pageErrors)}, evalError: ${evalError}`).toBeTruthy();
  });
});