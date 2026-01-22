import { test, expect } from '@playwright/test';

// Page Object for the Linear Regression demo page
class LinearRegressionPage {
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b488b2-d5c2-11f0-9651-0f1ae31ac260.html';
    // Selectors used across tests
    this.canvas = '#plot';
    this.clearBtn = '#clearBtn';
    this.predictInput = '#predictX';
    this.predictBtn = '#predictBtn';
    this.predictionResult = '#predictionResult';
    this.slope = '#slope';
    this.intercept = '#intercept';
    this.r2 = '#r2';
  }

  // Navigate to the demo page
  async goto() {
    await this.page.goto(this.url);
  }

  // Click on the canvas at canvas-relative coordinates (x,y)
  // Coordinates correspond to pixels inside the canvas element (canvas width:800, height:400)
  async clickCanvasAt(x, y) {
    // Ensure the canvas is visible and stable
    await this.page.waitForSelector(this.canvas, { state: 'visible' });
    await this.page.click(this.canvas, { position: { x, y } });
  }

  // Click the clear button
  async clickClear() {
    await this.page.click(this.clearBtn);
  }

  // Set the predict input value
  async setPredictX(value) {
    await this.page.fill(this.predictInput, String(value));
  }

  // Click the predict button
  async clickPredict() {
    await this.page.click(this.predictBtn);
  }

  // Utility getters for DOM text values
  async getSlopeText() {
    return (await this.page.textContent(this.slope)).trim();
  }
  async getInterceptText() {
    return (await this.page.textContent(this.intercept)).trim();
  }
  async getR2Text() {
    return (await this.page.textContent(this.r2)).trim();
  }
  async getPredictionResultText() {
    const txt = await this.page.textContent(this.predictionResult);
    return txt === null ? '' : txt.trim();
  }
}

test.describe('Linear Regression Demo - FSM Validation', () => {
  // Capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;
  let lrPage;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore listener errors
      }
    });

    // Collect uncaught page errors (e.g., ReferenceError, TypeError)
    page.on('pageerror', (err) => {
      try {
        pageErrors.push(err.message || String(err));
      } catch (e) {
        // ignore listener errors
      }
    });

    lrPage = new LinearRegressionPage(page);
    await lrPage.goto();
  });

  test.afterEach(async () => {
    // Assert there were no uncaught page errors during the test.
    // The application should run without throwing uncaught exceptions.
    expect(pageErrors, `Uncaught page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    // Also assert there were no console errors emitted.
    expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test.describe('S0_Idle - Initial rendering', () => {
    test('Initial state shows canvas and default regression info', async () => {
      // Validate initial DOM elements and default values described in S0_Idle
      // The canvas should be present
      await lrPage.page.waitForSelector(lrPage.canvas, { state: 'visible' });

      // Prediction result should be empty
      const predText = await lrPage.getPredictionResultText();
      expect(predText).toBe('', 'Prediction result should be empty on initial render');

      // Slope, intercept, r2 should be the default '-' (no regression yet)
      expect(await lrPage.getSlopeText()).toBe('-', 'Initial slope should be "-"');
      expect(await lrPage.getInterceptText()).toBe('-', 'Initial intercept should be "-"');
      expect(await lrPage.getR2Text()).toBe('-', 'Initial r2 should be "-"');
    });
  });

  test.describe('S1_PointsAdded - Adding points and updating regression info', () => {
    test('Adding a single point leaves regression info as "-" (insufficient data)', async () => {
      // Click once near the center of the canvas
      await lrPage.clickCanvasAt(400, 200);

      // After one point, regression cannot be computed; slope/intercept/r2 remain '-'
      expect(await lrPage.getSlopeText()).toBe('-', 'Slope should remain "-" after one point');
      expect(await lrPage.getInterceptText()).toBe('-', 'Intercept should remain "-" after one point');
      expect(await lrPage.getR2Text()).toBe('-', 'R² should remain "-" after one point');

      // Prediction result should remain empty after adding a point
      expect(await lrPage.getPredictionResultText()).toBe('', 'Prediction result should be cleared after adding a point');
    });

    test('Adding two distinct points computes regression values (slope/intercept/r2 become numeric)', async () => {
      // Add two points with different x positions to ensure regression can be computed.
      // First point: left-bottom quadrant
      await lrPage.clickCanvasAt(200, 320);
      // Second point: right-top quadrant
      await lrPage.clickCanvasAt(600, 80);

      // After two distinct points, slope/intercept/r2 should be numeric strings, not the default '-'.
      const slopeText = await lrPage.getSlopeText();
      const interceptText = await lrPage.getInterceptText();
      const r2Text = await lrPage.getR2Text();

      const numberRegex = /^-?\d+\.\d{5}$/; // application formats with 5 decimal places

      expect(slopeText).toMatch(numberRegex, `Slope should be a number with 5 decimals, got "${slopeText}"`);
      expect(interceptText).toMatch(numberRegex, `Intercept should be a number with 5 decimals, got "${interceptText}"`);
      expect(r2Text).toMatch(numberRegex, `R² should be a number with 5 decimals, got "${r2Text}"`);
    });
  });

  test.describe('S2_PredictionMade - Predictions and prediction-related transitions', () => {
    test('Predicting with zero points shows informative message', async () => {
      // Ensure no points added (fresh page)
      // Set a prediction x value and click Predict
      await lrPage.setPredictX(1.23);
      await lrPage.clickPredict();

      // When there are fewer than two valid points, the app will instruct the user to add points
      const predText = await lrPage.getPredictionResultText();
      expect(predText).toBe('Add at least two points with varying x to perform prediction.', 'Predict with no points should request more points');
    });

    test('Predicting after valid regression returns formatted predicted value', async () => {
      // Add two distinct points to enable regression
      await lrPage.clickCanvasAt(150, 300);
      await lrPage.clickCanvasAt(650, 100);

      // Ensure regression values exist
      const slopeText = await lrPage.getSlopeText();
      expect(slopeText).not.toBe('-', 'Slope should not be "-" after adding two distinct points');

      // Use a specific x for prediction and click predict
      await lrPage.setPredictX(2.5);
      await lrPage.clickPredict();

      const predText = await lrPage.getPredictionResultText();
      // It should start with 'Predicted y = ' and then a number with 5 decimals
      expect(predText).toMatch(/^Predicted y = -?\d+\.\d{5}$/, `Prediction text should be in the expected format, got "${predText}"`);
    });

    test('Predicting when all x are the same (denominator=0) yields informative message', async () => {
      // Clear any previous points to isolate this test
      await lrPage.clickClear();

      // Add two points with the same canvas x coordinate but different y coordinates.
      // This should create identical x data leading to a denominator of 0 and regression = null.
      const sameX = 300;
      await lrPage.clickCanvasAt(sameX, 120);
      await lrPage.clickCanvasAt(sameX, 300);

      // Regression should be null; slope/intercept/r2 stay '-'
      expect(await lrPage.getSlopeText()).toBe('-', 'Slope should be "-" when regression cannot be computed due to identical x values');
      expect(await lrPage.getInterceptText()).toBe('-', 'Intercept should be "-" when regression cannot be computed due to identical x values');
      expect(await lrPage.getR2Text()).toBe('-', 'R² should be "-" when regression cannot be computed due to identical x values');

      // Attempt a prediction; should get the informative message about needing varying x
      await lrPage.setPredictX(0);
      await lrPage.clickPredict();
      const predText = await lrPage.getPredictionResultText();
      expect(predText).toBe('Add at least two points with varying x to perform prediction.', 'Prediction should instruct to add varying x when regression is invalid');
    });
  });

  test.describe('Transitions and state resets', () => {
    test('ClearPoints transition resets application to Idle (S0_Idle)', async () => {
      // Add two distinct points to change state
      await lrPage.clickCanvasAt(180, 300);
      await lrPage.clickCanvasAt(620, 120);

      // Verify regression computed
      expect(await lrPage.getSlopeText()).not.toBe('-', 'Slope should be computed before clearing');

      // Click Clear Points to return to Idle
      await lrPage.clickClear();

      // After clearing, slope/intercept/r2 should return to '-' indicating Idle state
      expect(await lrPage.getSlopeText()).toBe('-', 'Slope should reset to "-" after clearing points');
      expect(await lrPage.getInterceptText()).toBe('-', 'Intercept should reset to "-" after clearing points');
      expect(await lrPage.getR2Text()).toBe('-', 'R² should reset to "-" after clearing points');

      // Prediction result area should also be cleared
      expect(await lrPage.getPredictionResultText()).toBe('', 'Prediction result should be cleared after clearing points');
    });
  });

  test.describe('Robustness and edge-case checks', () => {
    test('Predict with invalid input (non-number) triggers browser alert (handled by page) or does not crash', async ({ page }) => {
      // The application shows alert when predict input is not a number.
      // Set an invalid value, e.g., empty string or non-numeric characters.
      await lrPage.setPredictX('not-a-number');

      // Listen for dialog alerts
      let dialogSeen = false;
      page.once('dialog', async (dialog) => {
        dialogSeen = true;
        // Accept and close the alert to prevent blocking
        await dialog.accept();
      });

      // Click predict; either an alert will appear or the app will handle it gracefully.
      await lrPage.clickPredict();

      // At least ensure the app did not throw uncaught errors (pageErrors asserted in afterEach)
      // Check if a dialog was shown for invalid input; if so, dialogSeen will be true.
      // We assert that either the dialog appeared OR the application set a message in the predictionResult.
      const predText = await lrPage.getPredictionResultText();
      const handledViaMessage = predText.length > 0;

      expect(dialogSeen || handledViaMessage).toBeTruthy();
    });
  });
});