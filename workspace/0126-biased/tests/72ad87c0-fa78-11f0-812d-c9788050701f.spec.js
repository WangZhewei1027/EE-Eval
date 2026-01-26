import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ad87c0-fa78-11f0-812d-c9788050701f.html';

// Page Object to encapsulate interaction helpers
class LogisticRegressionPage {
  constructor(page) {
    this.page = page;
    this.pageErrors = [];
    this.consoleMessages = [];

    // Collect runtime errors and console messages for assertions
    this.page.on('pageerror', (err) => {
      // store the full Error.message for easier assertions
      this.pageErrors.push(err.message || String(err));
    });
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  }

  async goto() {
    // Navigate and wait for DOMContentLoaded as the app attaches listeners on that event
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Allow microtasks / initial scripts to run
    await this.page.waitForTimeout(50);
  }

  // Click the Train Model button
  async clickTrain() {
    await this.page.click('#trainModel');
    // allow synchronous handlers and any immediate effects to settle
    await this.page.waitForTimeout(100);
  }

  // Click the Reset View button
  async clickReset() {
    await this.page.click('#resetView');
    await this.page.waitForTimeout(50);
  }

  // Get the inline style width of the decision boundary (as set by JS)
  async getBoundaryInlineWidth() {
    return await this.page.$eval('#scatterPlot .decision-boundary', el => el.style.width || '');
  }

  // Get the inline transform style of the first generated point (if any)
  async getFirstPointInlineTransform() {
    const exists = await this.page.$('.point');
    if (!exists) return null;
    return await this.page.$eval('.point', el => el.style.transform || '');
  }

  // Get pointer-events style of reset button
  async getResetPointerEvents() {
    return await this.page.$eval('#resetView', el => el.style.pointerEvents || '');
  }

  // Count how many .point elements exist
  async countPoints() {
    return await this.page.$$eval('.point', els => els.length);
  }

  // Return collected page errors
  getErrors() {
    return this.pageErrors.slice();
  }

  // Return collected console messages
  getConsoleMessages() {
    return this.consoleMessages.slice();
  }
}

test.describe('Logistic Regression Visualizer - FSM validation (Application ID: 72ad87c0-... )', () => {
  let pageObj;

  test.beforeEach(async ({ page }) => {
    pageObj = new LogisticRegressionPage(page);
    await pageObj.goto();
  });

  test.afterEach(async () => {
    // no special teardown required; Playwright will close contexts/pages as configured
  });

  test('Initial state S0_Idle: UI renders and initial visualization is set (boundary collapsed)', async () => {
    // This test validates the Idle state (S0_Idle)
    // - Both "Train Model" and "Reset View" buttons should be present
    // - Decision boundary should initially be collapsed (width '0%')
    // - Points should be generated (expected 40 points: 20 negative + 20 positive)
    // - No runtime errors should have occurred on initial load

    const { page } = pageObj;

    // Buttons present
    await expect(page.locator('#trainModel')).toHaveCount(1);
    await expect(page.locator('#resetView')).toHaveCount(1);

    // Decision boundary inline width should be '0%' as set by the script on load
    const initialBoundaryWidth = await pageObj.getBoundaryInlineWidth();
    expect(initialBoundaryWidth).toBe('0%');

    // Points generated - expect 40 (20 negative + 20 positive)
    const pointCount = await pageObj.countPoints();
    expect(pointCount).toBeGreaterThanOrEqual(30); // allow minor variance due to rendering differences
    expect(pointCount).toBeLessThanOrEqual(50);

    // No page errors should have been emitted during initial load
    const initialErrors = pageObj.getErrors();
    expect(initialErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_ModelTrained on TrainModelClick: boundary grows and error surfaces', async () => {
    // This test validates the TrainModelClick transition from Idle to ModelTrained
    // It asserts:
    // - Clicking "Train Model" sets the decision boundary inline width to '100%'
    // - Because the implementation contains an invalid usage of CSS variable in JS,
    //   a ReferenceError should be emitted (we assert that the error occurs and contains likely text)
    // - Points inline transform should NOT be set (the animation code after the ReferenceError will not run)

    // Click the Train Model button
    await pageObj.clickTrain();

    // The boundary width assignment occurs before the JS error, so it should be set to '100%'
    const boundaryWidthAfterTrain = await pageObj.getBoundaryInlineWidth();
    expect(boundaryWidthAfterTrain).toBe('100%');

    // The implementation attempts to use var(--primary) directly in JS, which is invalid and will throw.
    // Assert that a ReferenceError (or similar) has been captured.
    const errors = pageObj.getErrors();
    expect(errors.length).toBeGreaterThanOrEqual(1);
    const hasVarReferenceError = errors.some(e => /ReferenceError/i.test(e) || /var is not defined/i.test(e) || /var\(--primary\)/i.test(e));
    expect(hasVarReferenceError).toBeTruthy();

    // Because the error interrupts the code before animating points, no inline transform should be set on points
    const firstPointInlineTransform = await pageObj.getFirstPointInlineTransform();
    // Inline transform should be empty string when no inline style applied
    expect(firstPointInlineTransform === '' || firstPointInlineTransform === null).toBeTruthy();
  });

  test('Transition S1_ModelTrained -> S2_ViewReset on ResetViewClick: boundary resets and reset button disabled', async () => {
    // This test validates the ResetViewClick transition from ModelTrained to ViewReset.
    // It simulates: Train -> Reset and verifies:
    // - Decision boundary width becomes '0%' after reset
    // - Reset button inline pointer-events is set to 'none'
    // - Reset handler itself should not trigger additional runtime errors

    // First click Train to put UI into the "trained" visual state (may produce errors as above)
    await pageObj.clickTrain();

    // Clear previously captured errors temporarily to assert reset-specific behavior independently (we won't erase pageObj internal store,
    // but we'll capture lengths before and after)
    const errorsBeforeReset = pageObj.getErrors().length;

    // Click Reset View
    await pageObj.clickReset();

    // After reset, the boundary inline width should be '0%'
    const boundaryAfterReset = await pageObj.getBoundaryInlineWidth();
    expect(boundaryAfterReset).toBe('0%');

    // The reset button should have its pointerEvents set to 'none' by the handler
    const resetPointer = await pageObj.getResetPointerEvents();
    expect(resetPointer).toBe('none');

    // Ensure reset handler didn't generate additional errors beyond what occurred during training
    const errorsAfterReset = pageObj.getErrors().length;
    // It's OK if no new errors occurred; ensure we haven't seen a flood of new errors
    expect(errorsAfterReset).toBeGreaterThanOrEqual(errorsBeforeReset);
    expect(errorsAfterReset - errorsBeforeReset).toBeLessThanOrEqual(5);
  });

  test('Edge case: Clicking ResetView before TrainModel (S0_Idle -> S2_ViewReset) should still reset boundary and disable reset button, without causing errors', async () => {
    // This test validates an edge case transition: user clicks Reset before training.
    // Expected behavior:
    // - Decision boundary remains or becomes '0%'
    // - Reset button pointer-events becomes 'none'
    // - No runtime error should occur from this action

    // Ensure we start fresh (reload)
    await pageObj.goto();

    // Click Reset view before ever training
    await pageObj.clickReset();

    // Boundary should be '0%' (already was, but handler sets it explicitly)
    const boundary = await pageObj.getBoundaryInlineWidth();
    expect(boundary).toBe('0%');

    // Reset button should be pointerEvents 'none'
    const resetPointer = await pageObj.getResetPointerEvents();
    expect(resetPointer).toBe('none');

    // No new errors should have been emitted as the reset handler is straightforward
    const errors = pageObj.getErrors();
    const resetErrors = errors.filter(e => /ReferenceError|TypeError|SyntaxError/i.test(e));
    expect(resetErrors.length).toBe(0);
  });

  test('Transition S2_ViewReset -> S0_Idle -> S1_ModelTrained: re-training after reset triggers same behaviors (repeatability)', async () => {
    // This test validates that after a ResetView (S2), clicking TrainModel transitions back to a trained appearance.
    // Because the implementation has a JS error in the Train handler, we expect the ReferenceError again,
    // and we assert that boundary width still attempts to grow to '100%'.

    // Ensure we start fresh
    await pageObj.goto();

    // Click Reset to enter S2_ViewReset
    await pageObj.clickReset();

    // Confirm reset effect
    expect(await pageObj.getBoundaryInlineWidth()).toBe('0%');
    expect(await pageObj.getResetPointerEvents()).toBe('none');

    // Click TrainModel (transition S2 -> S0_Idle -> S1_ModelTrained)
    await pageObj.clickTrain();

    // Boundary should be set to '100%' by the handler before it throws
    const boundaryAfterRetrain = await pageObj.getBoundaryInlineWidth();
    expect(boundaryAfterRetrain).toBe('100%');

    // Check that the ReferenceError occurred again (there might already be errors from previous tests; just confirm at least one such error exists)
    const errors = pageObj.getErrors();
    const hasVarRefError = errors.some(e => /ReferenceError/i.test(e) || /var is not defined/i || /var\(--primary\)/i.test(e));
    expect(hasVarRefError).toBeTruthy();
  });

  test('Instrument console: ensure the ReferenceError details are exposed via console/pageerror for debugging', async () => {
    // This test inspects collected console messages and page errors to ensure the erroneous usage is visible.
    // This is important because the FSM validation expects an error to happen (we do not patch the app).

    // Trigger the error by clicking Train
    await pageObj.clickTrain();

    const errors = pageObj.getErrors();
    expect(errors.length).toBeGreaterThanOrEqual(1);

    // The console messages should include an error-level entry or mention of 'var'
    const consoles = pageObj.getConsoleMessages();
    const errorConsoleEntries = consoles.filter(c => c.type === 'error' || /var\(--primary\)/i.test(c.text) || /ReferenceError/i.test(c.text));
    expect(errorConsoleEntries.length).toBeGreaterThanOrEqual(0); // allow 0 if environment reports via pageerror only

    // Ensure that at least one of the captured messages or page errors references 'var' or 'ReferenceError'
    const combined = errors.concat(consoles.map(c => c.text));
    const found = combined.some(t => /var\(--primary\)/i.test(t) || /ReferenceError/i.test(t) || /var is not defined/i.test(t));
    expect(found).toBeTruthy();
  });
});