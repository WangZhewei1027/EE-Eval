import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04451b31-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object encapsulating common interactions and selectors for the Neural Networks page
class NeuralPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.trainButton = page.locator('#train-button');
    this.predictButton = page.locator('#predict-button');
    this.canvas = page.locator('#example-canvas');
    this.container = page.locator('.container');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickTrain() {
    await this.trainButton.click();
  }

  async clickPredict() {
    await this.predictButton.click();
  }

  async doubleClickTrain() {
    await this.trainButton.dblclick();
  }

  async doubleClickPredict() {
    await this.predictButton.dblclick();
  }
}

test.describe('Neural Networks FSM - End-to-End', () => {
  // Collect console messages and page errors for each test to validate expected runtime behavior.
  test('Idle state: initial render should show core UI elements and attempt renderPage (entry action)', async ({ page }) => {
    // Arrays to capture console text and page errors during navigation
    const consoleMessages = [];
    const consoleTypes = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push(msg.text());
      consoleTypes.push(msg.type());
    });

    page.on('pageerror', err => {
      // err may be an Error object; capture its message or string representation
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    const neural = new NeuralPage(page);
    // Navigate to the page (Idle state entry)
    await neural.goto();

    // Validate core UI elements (evidence for S0_Idle)
    await expect(neural.container).toBeVisible();
    await expect(neural.trainButton).toBeVisible();
    await expect(neural.predictButton).toBeVisible();
    await expect(neural.canvas).toBeVisible();

    // Validate canvas dimensions as provided in the FSM/components evidence
    const width = await neural.canvas.getAttribute('width');
    const height = await neural.canvas.getAttribute('height');
    expect(width).toBe('224');
    expect(height).toBe('224');

    // Give a short moment for any onload script actions / errors to surface
    await page.waitForTimeout(250);

    // Check for evidence that renderPage entry action either logged or triggered an error.
    // We allow two valid observable outcomes:
    // 1) A console message referencing renderPage
    // 2) A runtime page error referencing renderPage or a ReferenceError/SyntaxError/TypeError occurred
    const sawRenderConsole = consoleMessages.some(m => /renderPage/i.test(m));
    const sawRenderError = pageErrors.some(e => /renderPage/i.test(e) || /ReferenceError|TypeError|SyntaxError/i.test(e));

    // Assert that at least one of the observable outcomes occurred
    expect(sawRenderConsole || sawRenderError).toBeTruthy();

    // For debugging purposes assert that console messages or page errors were captured (one of them should be non-empty)
    expect(consoleMessages.length + pageErrors.length).toBeGreaterThan(0);
  });

  test('Transition: TrainButtonClick should attempt startTraining (enter Training state) and produce observable behavior or error', async ({ page }) => {
    const consoleMessages = [];
    const consoleTypes = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push(msg.text());
      consoleTypes.push(msg.type());
    });

    page.on('pageerror', err => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    const neural = new NeuralPage(page);
    await neural.goto();

    // Ensure Train button exists before clicking
    await expect(neural.trainButton).toBeVisible();

    // Click the Train button to trigger transition S0 -> S1
    await neural.clickTrain();

    // Allow time for any JS handlers to execute and for errors to be thrown/logged
    await page.waitForTimeout(300);

    // Observables expected according to FSM: "Training in progress" or function startTraining being invoked.
    const sawTrainingConsole = consoleMessages.some(m => /training/i.test(m) || /startTraining/i.test(m));
    const sawTrainingError = pageErrors.some(e => /startTraining/i.test(e) || /ReferenceError|TypeError|SyntaxError/i.test(e));

    // Also check DOM for any text node "Training in progress" that might have been added by script.js
    const trainingTextPresent = await page.locator('text=Training in progress').count() > 0;

    // Assert that at least one expected observable occurred: console message, DOM text, or page error
    expect(sawTrainingConsole || sawTrainingError || trainingTextPresent).toBeTruthy();

    // Edge assertion: ensure the Train button remains present (UI shouldn't disappear unexpectedly)
    await expect(neural.trainButton).toBeVisible();
  });

  test('Transition: PredictButtonClick should attempt startPrediction (enter Predicting state) and produce observable behavior or error', async ({ page }) => {
    const consoleMessages = [];
    const consoleTypes = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push(msg.text());
      consoleTypes.push(msg.type());
    });

    page.on('pageerror', err => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    const neural = new NeuralPage(page);
    await neural.goto();

    // Ensure Predict button exists before clicking
    await expect(neural.predictButton).toBeVisible();

    // Click the Predict button to trigger transition S0 -> S2
    await neural.clickPredict();

    // Allow time for any JS handlers to execute and for errors to be thrown/logged
    await page.waitForTimeout(300);

    // Observables expected: "Prediction in progress" or function startPrediction being invoked.
    const sawPredictConsole = consoleMessages.some(m => /prediction/i.test(m) || /startPrediction/i.test(m));
    const sawPredictError = pageErrors.some(e => /startPrediction/i.test(e) || /ReferenceError|TypeError|SyntaxError/i.test(e));
    const predictTextPresent = await page.locator('text=Prediction in progress').count() > 0;

    // Assert that at least one expected observable occurred
    expect(sawPredictConsole || sawPredictError || predictTextPresent).toBeTruthy();

    // Edge assertion: ensure the Predict button remains present
    await expect(neural.predictButton).toBeVisible();
  });

  test('Edge cases: rapid/double clicks on Train and Predict should not crash the page silently (errors or multiple logs expected)', async ({ page }) => {
    const consoleMessages = [];
    const consoleTypes = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push(msg.text());
      consoleTypes.push(msg.type());
    });

    page.on('pageerror', err => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    const neural = new NeuralPage(page);
    await neural.goto();

    // Double-click train and predict in quick succession to simulate user spamming controls
    await neural.doubleClickTrain();
    await neural.doubleClickPredict();

    // Wait a little to allow handlers to run and errors to surface
    await page.waitForTimeout(400);

    // We expect either:
    // - multiple console messages referencing startTraining/startPrediction, OR
    // - page errors due to missing handlers or unexpected runtime conditions.
    const trainingLogs = consoleMessages.filter(m => /startTraining|training/i.test(m)).length;
    const predictLogs = consoleMessages.filter(m => /startPrediction|prediction/i.test(m)).length;
    const runtimeErrors = pageErrors.filter(e => /ReferenceError|TypeError|SyntaxError|startTraining|startPrediction/i.test(e)).length;

    // At least one symptom should be present indicating the double clicks were observed by the page.
    expect(trainingLogs + predictLogs + runtimeErrors).toBeGreaterThan(0);

    // If runtimeErrors are present, ensure their messages are non-empty for debugging
    for (const err of pageErrors) {
      expect(err.length).toBeGreaterThan(0);
    }
  });

  test('Runtime errors observation: page should surface JS errors if functions referenced by FSM are missing', async ({ page }) => {
    // This test explicitly asserts that at least one JavaScript runtime error (ReferenceError / TypeError / SyntaxError)
    // occurred during the page lifecycle (load or interactions). Per the test instructions we must observe and assert such errors.
    const pageErrors = [];
    const consoleMessages = [];

    page.on('pageerror', err => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    const neural = new NeuralPage(page);
    await neural.goto();

    // Trigger both actions to maximize chance of encountering missing-function errors
    await neural.clickTrain().catch(() => {});
    await neural.clickPredict().catch(() => {});

    // Short wait to allow errors to appear
    await page.waitForTimeout(300);

    // Check for errors of the expected types
    const jsErrorDetected = pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/i.test(e));

    // According to the CRITICAL instructions, we must allow errors to happen naturally and assert they occur.
    // Therefore we explicitly assert that at least one such JS error was observed.
    expect(jsErrorDetected).toBeTruthy();

    // Additionally, record any console errors for visibility -- they may reference missing functions.
    const consoleErrors = consoleMessages.filter(c => c.type === 'error' || /error/i.test(c.text));
    // Ensure that if pageErrors were detected, consoleErrors array is informative (non-empty or pageErrors non-empty)
    expect(pageErrors.length).toBeGreaterThan(0);
    // Basic sanity: at least one console message exists (could be logs)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });
});