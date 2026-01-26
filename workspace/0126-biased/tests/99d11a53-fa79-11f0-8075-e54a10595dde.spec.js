import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d11a53-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Random Forest demo page
class RandomForestPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      heading: 'h1',
      numTrees: '#numTrees',
      maxDepth: '#maxDepth',
      minSamplesSplit: '#minSamplesSplit',
      minSamplesLeaf: '#minSamplesLeaf',
      trainButton: '#trainButton',
      output: '#output',
      testInputs: '#testInputs',
      predictButton: '#predictButton',
      predictionResult: '#predictionResult'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getHeadingText() {
    return this.page.locator(this.selectors.heading).innerText();
  }

  async getInputValue(selector) {
    return this.page.locator(selector).inputValue();
  }

  async setInputValue(selector, value) {
    await this.page.fill(selector, String(value));
  }

  async clickTrain() {
    await this.page.click(this.selectors.trainButton);
  }

  async clickPredict() {
    await this.page.click(this.selectors.predictButton);
  }

  locator(sel) {
    return this.page.locator(sel);
  }
}

test.describe('Random Forest Interactive Demonstration (FSM validation)', () => {
  let rf;
  let consoleErrors;
  let pageErrors;

  // Setup: navigate to the page and attach listeners to capture console errors and page errors
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture console error messages only
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // defensive: do nothing if msg.type() throws
      }
    });

    page.on('pageerror', (err) => {
      // Uncaught exceptions (ReferenceError, TypeError, etc.) will be captured here
      pageErrors.push(err.message);
    });

    rf = new RandomForestPage(page);
    await rf.goto();
  });

  // Teardown: ensure there were no console or page errors during the test interactions
  test.afterEach(async () => {
    // Assert there are no runtime page errors (uncaught exceptions)
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toEqual([]);
    // Assert there are no console.error messages emitted
    expect(consoleErrors, `Unexpected console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Initial Idle state: page renders with expected elements and default values', async ({ page }) => {
    // Validate the initial Idle state: the page is rendered and the main heading is present
    await expect(page.locator('h1')).toHaveText('Random Forest Interactive Demonstration');

    // Validate inputs have expected default values
    await expect(page.locator('#numTrees')).toHaveValue('10');
    await expect(page.locator('#maxDepth')).toHaveValue('10');
    await expect(page.locator('#minSamplesSplit')).toHaveValue('2');
    await expect(page.locator('#minSamplesLeaf')).toHaveValue('1');

    // Train button should be visible in Idle state
    await expect(page.locator('#trainButton')).toBeVisible();

    // Output, predict button and prediction result should be hidden initially (Idle state evidence)
    await expect(page.locator('#output')).toBeHidden();
    await expect(page.locator('#predictButton')).toBeHidden();
    await expect(page.locator('#predictionResult')).toBeHidden();
  });

  test('Training transition: clicking Train Random Forest reveals output and Predict button', async ({ page }) => {
    // Change input parameters to non-default values to validate the training message reflects them
    await rf.setInputValue(rf.selectors.numTrees, '50');
    await rf.setInputValue(rf.selectors.maxDepth, '7');
    await rf.setInputValue(rf.selectors.minSamplesSplit, '3');
    await rf.setInputValue(rf.selectors.minSamplesLeaf, '2');

    // Click Train button -> transition S0_Idle -> S1_Training
    await rf.clickTrain();

    // Verify the output paragraph is visible and contains the expected training message
    const output = page.locator('#output');
    await expect(output).toBeVisible();
    const outputText = await output.innerText();
    expect(outputText).toContain('Training Random Forest with 50 trees');
    expect(outputText).toContain('max depth of 7');
    expect(outputText).toContain('min samples split of 3');
    expect(outputText).toContain('min samples leaf of 2');

    // Predict button should become visible after training (per FSM transition actions)
    await expect(page.locator('#predictButton')).toBeVisible();
  });

  test('Predicting transition: clicking Predict after training shows a predicted class', async ({ page }) => {
    // Train first so Predict button is revealed
    await rf.clickTrain();
    await expect(page.locator('#predictButton')).toBeVisible();

    // Provide a valid test input and click Predict -> transition S1_Training -> S2_Predicting
    await rf.setInputValue(rf.selectors.testInputs, '1,2,3,4');
    await rf.clickPredict();

    // predictionResult should be visible and follow the pattern "Predicted Class: X" where X is 0 or 1
    const predictionLocator = page.locator('#predictionResult');
    await expect(predictionLocator).toBeVisible();
    // Use regex to accept either 0 or 1
    await expect(predictionLocator).toHaveText(/Predicted Class: [01]/);
  });

  test('Edge case: empty test input still leads to a Predicted Class due to input parsing behavior', async ({ page }) => {
    // Train first so Predict button is revealed
    await rf.clickTrain();
    await expect(page.locator('#predictButton')).toBeVisible();

    // Set test input to empty string (user leaves the field blank)
    await rf.setInputValue(rf.selectors.testInputs, '');

    // Click predict - note: due to implementation, splitting '' results in [''] -> length 1
    // so the branch that shows "Please provide valid input." is effectively unreachable.
    await rf.clickPredict();

    const predictionLocator = page.locator('#predictionResult');
    await expect(predictionLocator).toBeVisible();

    // Ensure the result does not show the "Please provide valid input." message
    const predictionText = await predictionLocator.innerText();
    expect(predictionText).not.toContain('Please provide valid input.');

    // Instead, it should display a predicted class (0 or 1)
    expect(/Predicted Class: [01]/.test(predictionText)).toBeTruthy();
  });

  test('Attempting to click Predict before training is disallowed (Predict remains hidden)', async ({ page }) => {
    // Ensure predict button is hidden in Idle state
    await expect(page.locator('#predictButton')).toBeHidden();

    // Attempting to click a hidden button should throw an error from Playwright.
    // We capture and assert that such an interaction is not possible.
    const predictBtn = page.locator('#predictButton');
    let clickError = null;
    try {
      await predictBtn.click({ timeout: 1000 });
    } catch (err) {
      clickError = err;
    }

    expect(clickError, 'Expected clicking a hidden Predict button to throw an error').not.toBeNull();
    // Error message content can vary by Playwright version; assert it's an interaction/visibility error
    expect(String(clickError)).toMatch(/Element is not visible|element is not visible|not visible/i);
  });

  test('Training message updates according to input parameter changes (parameter boundary checks)', async ({ page }) => {
    // Test boundary-like values to ensure they propagate to the training message
    await rf.setInputValue(rf.selectors.numTrees, '1'); // min
    await rf.setInputValue(rf.selectors.maxDepth, '20'); // max
    await rf.setInputValue(rf.selectors.minSamplesSplit, '10'); // max
    await rf.setInputValue(rf.selectors.minSamplesLeaf, '1'); // min

    await rf.clickTrain();

    const output = page.locator('#output');
    await expect(output).toBeVisible();
    const text = await output.innerText();

    expect(text).toContain('1 trees');
    expect(text).toContain('max depth of 20');
    expect(text).toContain('min samples split of 10');
    expect(text).toContain('min samples leaf of 1');
  });

  test('Observe and assert there are no unexpected runtime errors during multiple interactions', async ({ page }) => {
    // Do a sequence of interactions: train, predict with inputs, change inputs, retrain, predict again
    await rf.clickTrain();
    await expect(page.locator('#predictButton')).toBeVisible();

    await rf.setInputValue(rf.selectors.testInputs, '2,4,6');
    await rf.clickPredict();
    await expect(page.locator('#predictionResult')).toBeVisible();
    await expect(page.locator('#predictionResult')).toHaveText(/Predicted Class: [01]/);

    // Change parameters and retrain
    await rf.setInputValue(rf.selectors.numTrees, '25');
    await rf.setInputValue(rf.selectors.maxDepth, '5');
    await rf.clickTrain();

    // Output should reflect new training config
    await expect(page.locator('#output')).toHaveText(/25 trees/);
    await expect(page.locator('#output')).toHaveText(/max depth of 5/);

    // Predict again with another input
    await rf.setInputValue(rf.selectors.testInputs, '9,8,7');
    await rf.clickPredict();
    await expect(page.locator('#predictionResult')).toBeVisible();
    await expect(page.locator('#predictionResult')).toHaveText(/Predicted Class: [01]/);
  });
});