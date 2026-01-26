import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04451b32-fa79-11f0-8a8e-bbe4f11717c6.html';

class BackpropPage {
  /**
   * Page object wrapper for the Backpropagation example
   * Encapsulates navigation and common interactions.
   */
  constructor(page) {
    this.page = page;
    this.trainButton = '#train-button';
    this.predictButton = '#predict-button';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickTrain() {
    await this.page.click(this.trainButton);
  }

  async clickPredict() {
    await this.page.click(this.predictButton);
  }

  async getTrainButtonText() {
    return this.page.textContent(this.trainButton);
  }

  async getPredictButtonText() {
    return this.page.textContent(this.predictButton);
  }
}

test.describe('Backpropagation FSM tests (Application ID: 04451b32-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  // Reusable variables for each test
  let page;
  let bpPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    bpPage = new BackpropPage(page);

    // Collect console messages for assertions
    consoleMessages = [];
    page.on('console', (msg) => {
      // Capture text and type for richer assertions
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // Defensive: ignore any console parsing errors
      }
    });

    // Collect page errors (uncaught exceptions) for assertions
    pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await bpPage.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Idle state: initial DOM contains Train Network and Predict buttons', async () => {
    // Validate S0_Idle: both buttons exist and show expected labels
    const trainText = await bpPage.getTrainButtonText();
    const predictText = await bpPage.getPredictButtonText();

    expect(trainText).toBeTruthy();
    expect(predictText).toBeTruthy();

    expect(trainText.trim()).toBe('Train Network');
    expect(predictText.trim()).toBe('Predict');

    // No page errors should have happened just from loading the page
    expect(pageErrors.length).toBe(0);

    // Sanity check: no immediate "Training complete." console logs on load
    const foundTrainingComplete = consoleMessages.some(m => m.text.includes('Training complete.'));
    expect(foundTrainingComplete).toBeFalsy();
  });

  test('TrainNetwork_Click transition: clicking Train triggers trainNetwork and results in a ReferenceError', async () => {
    // This validates transition from S0_Idle -> S1_Training
    // We expect the onEnter action trainNetwork() to run and a ReferenceError to be thrown
    // because of a bug in the implementation (use of "prediction" out of scope).
    const errorPromise = page.waitForEvent('pageerror');

    // Perform the transition (user clicks Train Network)
    await bpPage.clickTrain();

    // Wait for the pageerror to surface
    const err = await errorPromise;
    expect(err).toBeTruthy();

    // The implementation uses an undefined variable `prediction` which should raise ReferenceError
    // Assert that the error message references 'prediction' and is a ReferenceError
    const message = String(err.message || err.toString() || '');
    expect(message.toLowerCase()).toContain('prediction');

    // Also assert the error is a ReferenceError if available in the error name
    // err.name might be 'ReferenceError' or included in message
    const name = String(err.name || '').toLowerCase();
    expect(name.includes('referenceerror') || message.toLowerCase().includes('referenceerror')).toBeTruthy();

    // Confirm that the console did NOT log the successful training message (expected_observables)
    const trainingLog = consoleMessages.find(m => m.text.includes('Training complete.'));
    expect(trainingLog).toBeUndefined();
  });

  test('Predict_Click transition: clicking Predict triggers updateWeightsAndBiasesButton and results in a ReferenceError', async () => {
    // This validates transition from S0_Idle -> S2_Predicting
    // We expect clicking Predict to call updateWeightsAndBiasesButton -> updateWeightsAndBiases
    // which contains the same undefined `prediction` variable usage and thus should throw
    const errorPromise = page.waitForEvent('pageerror');

    await bpPage.clickPredict();

    const err = await errorPromise;
    expect(err).toBeTruthy();

    const message = String(err.message || err.toString() || '');
    expect(message.toLowerCase()).toContain('prediction');