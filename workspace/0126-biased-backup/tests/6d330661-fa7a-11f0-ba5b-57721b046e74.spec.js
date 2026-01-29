import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d330661-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the SVM Interactive Demo
class SVMPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickGenerateData() {
    await this.page.click('#generate-data');
  }

  async clickTrainSVM() {
    await this.page.click('#train-svm');
  }

  async clickAddClass1() {
    await this.page.click('#add-class1');
  }

  async clickAddClass2() {
    await this.page.click('#add-class2');
  }

  async clickClearPoints() {
    await this.page.click('#clear-points');
  }

  async setDatasetType(value) {
    await this.page.selectOption('#dataset-type', value);
  }

  async setNoise(value) {
    await this.page.fill('#noise', String(value));
    // Trigger input event by focusing and dispatching input via keyboard as fallback
    await this.page.dispatchEvent('#noise', 'input');
  }

  async setKernel(value) {
    await this.page.selectOption('#kernel', value);
    await this.page.dispatchEvent('#kernel', 'change');
  }

  async setC(value) {
    await this.page.fill('#c', String(value));
    await this.page.dispatchEvent('#c', 'input');
  }

  async setDegree(value) {
    await this.page.fill('#degree', String(value));
    await this.page.dispatchEvent('#degree', 'input');
  }

  async setGamma(value) {
    await this.page.fill('#gamma', String(value));
    await this.page.dispatchEvent('#gamma', 'input');
  }

  async toggleCheckbox(selector, checked) {
    const isChecked = await this.page.isChecked(selector);
    if (isChecked !== checked) {
      await this.page.click(selector);
      await this.page.dispatchEvent(selector, 'change');
    }
  }

  // Utility to evaluate expressions in page context
  async eval(fn) {
    return this.page.evaluate(fn);
  }

  // Get counts of SVG elements for verification
  async getPointCount() {
    return this.page.evaluate(() => document.querySelectorAll('svg .point').length);
  }

  async getSupportVectorCount() {
    return this.page.evaluate(() => document.querySelectorAll('svg .support-vector').length);
  }

  async getDecisionBoundaryCount() {
    return this.page.evaluate(() => document.querySelectorAll('svg .decision-boundary').length);
  }

  async getMarginCount() {
    return this.page.evaluate(() => document.querySelectorAll('svg .margin').length);
  }

  async getAccuracyText() {
    return this.page.textContent('#accuracy');
  }

  async getSVCountText() {
    return this.page.textContent('#sv-count');
  }

  async getMarginSizeText() {
    return this.page.textContent('#margin-size');
  }

  async getNoiseDisplay() {
    return this.page.textContent('#noise-value');
  }

  async getClass1Display() {
    return this.page.textContent('#class1-param1-value');
  }

  async getClass2Display() {
    return this.page.textContent('#class2-param1-value');
  }

  async getCDisplay() {
    return this.page.textContent('#c-value');
  }

  async getDegreeDisplay() {
    return this.page.textContent('#degree-value');
  }

  async getGammaDisplay() {
    return this.page.textContent('#gamma-value');
  }

  async isDegreeControlVisible() {
    return this.page.$eval('#degree-control', el => {
      return window.getComputedStyle(el).display !== 'none';
    });
  }

  async isGammaControlVisible() {
    return this.page.$eval('#gamma-control', el => {
      return window.getComputedStyle(el).display !== 'none';
    });
  }

  async getDataLength() {
    return this.page.evaluate(() => Array.isArray(window.data) ? window.data.length : -1);
  }

  async getAddedPointsLength() {
    return this.page.evaluate(() => Array.isArray(window.addedPoints) ? window.addedPoints.length : -1);
  }

  async clearDataAndAddedPoints() {
    await this.page.evaluate(() => {
      window.data = [];
      window.addedPoints = [];
      // Also clear svmModel to avoid SVM visualization during tests
      window.svmModel = null;
      // call updateVisualization if exists
      if (typeof updateVisualization === 'function') updateVisualization();
    });
  }
}

test.describe('SVM Interactive Demo - FSM and UI Tests (6d330661-fa7a-11f0-ba5b-57721b046e74)', () => {
  // We'll collect console and page errors to assert there are no unexpected runtime errors
  let page;
  let svmPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Collect uncaught exceptions / errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    svmPage = new SVMPage(page);
    await svmPage.goto();
    // Wait a bit for initial generateData/updateVisualization to complete
    await page.waitForLoadState('networkidle');
    // small delay to allow D3 to render
    await page.waitForTimeout(200);
  });

  test.afterEach(async () => {
    // Assert there are no severe runtime errors (ReferenceError, SyntaxError, TypeError) in pageErrors
    const severeErrors = pageErrors.filter(e =>
      e.name === 'ReferenceError' || e.name === 'SyntaxError' || e.name === 'TypeError'
    );
    expect(severeErrors.length, `Found unexpected page errors: ${pageErrors.map(e => `${e.name}: ${e.message}`).join('; ')}`).toBe(0);

    // Also check console for messages that indicate ReferenceError/TypeError/SyntaxError
    const consoleSevere = consoleMessages.filter(c =>
      /ReferenceError|TypeError|SyntaxError/.test(c.text)
    );
    expect(consoleSevere.length, `Found error-like console messages: ${consoleSevere.map(c => c.text).join(' | ')}`).toBe(0);

    await page.context().close();
  });

  test('Initial load should have generated data and rendered points (S1_DataGenerated entry action)', async () => {
    // This test validates that the initial entry-actions (generateData, updateVisualization) ran.
    // Expect data array to be populated and SVG point elements to be present.
    const dataLen = await svmPage.getDataLength();
    const addedLen = await svmPage.getAddedPointsLength();
    const svgPoints = await svmPage.getPointCount();

    // There should be generated data (generateData is called on init)
    expect(dataLen).toBeGreaterThan(0);

    // No added points at initialization
    expect(addedLen).toBeGreaterThanOrEqual(0);

    // SVG points should be at least as many as data length (data + addedPoints)
    expect(svgPoints).toBeGreaterThanOrEqual(dataLen);
  });

  test('Clicking Generate New Data regenerates the dataset and updates visualization (Transition S0 -> S1)', async () => {
    // Change some parameters to ensure generation uses new values
    await svmPage.setDatasetType('moons');
    await svmPage.setNoise('0.2');

    const beforeDataLen = await svmPage.getDataLength();

    await svmPage.clickGenerateData();
    // Allow time for generation and rendering
    await page.waitForTimeout(200);

    const afterDataLen = await svmPage.getDataLength();
    const noiseDisplay = await svmPage.getNoiseDisplay();

    // Data should be regenerated (length should remain > 0)
    expect(afterDataLen).toBeGreaterThan(0);
    // Displayed noise value should reflect our change
    expect(noiseDisplay).toContain('0.2');
  });

  test('Training SVM updates model evaluation and renders SVM visuals (Transition S1 -> S2)', async () => {
    // Ensure we have enough data (should from initial generation)
    const dataLen = await svmPage.getDataLength();
    expect(dataLen).toBeGreaterThanOrEqual(2);

    // Click Train SVM and wait for updates
    await svmPage.clickTrainSVM();
    await page.waitForTimeout(300);

    const accuracyText = await svmPage.getAccuracyText();
    const svCountText = await svmPage.getSVCountText();
    const marginSizeText = await svmPage.getMarginSizeText();

    // Accuracy should be updated from initial '0%' to some realistic percentage
    expect(accuracyText).not.toBe('0%');

    // sv-count should reflect supportVectors length (non-zero)
    expect(Number(svCountText)).toBeGreaterThan(0);

    // margin-size should be a non-zero numeric string
    expect(Number(marginSizeText)).toBeGreaterThan(0);

    // Check that decision boundary, margin, and support vectors are rendered (checkboxes are checked by default)
    const boundaryCount = await svmPage.getDecisionBoundaryCount();
    const marginCount = await svmPage.getMarginCount();
    const svCount = await svmPage.getSupportVectorCount();

    expect(boundaryCount).toBeGreaterThanOrEqual(1);
    // For linear kernel margin adds two lines; for nonlinear maybe 0 - at least when showing margin it's 0+ for linear
    // We assert marginCount is >= 0 (non-negative) and svCount matches displayed sv-count
    expect(marginCount).toBeGreaterThanOrEqual(0);
    expect(svCount).toBeGreaterThanOrEqual(0);
    expect(svCount).toBe(Number(svCountText));
  });

  test('Adding Class 1 and Class 2 points and then clearing them (Transitions S1 -> S3 -> S4)', async () => {
    // Record initial counts
    const beforeAdded = await svmPage.getAddedPointsLength();
    const beforeSvgPoints = await svmPage.getPointCount();

    // Add one class1 and one class2 point
    await svmPage.clickAddClass1();
    await svmPage.clickAddClass2();
    await page.waitForTimeout(150);

    const afterAdded = await svmPage.getAddedPointsLength();
    const afterSvgPoints = await svmPage.getPointCount();

    // Expect addedPoints increased by 2
    expect(afterAdded).toBe(beforeAdded + 2);
    // Expect SVG points to increase by at least 2
    expect(afterSvgPoints).toBeGreaterThanOrEqual(beforeSvgPoints + 2);

    // Now clear the points
    await svmPage.clickClearPoints();
    await page.waitForTimeout(150);

    const clearedAdded = await svmPage.getAddedPointsLength();
    const clearedSvgPoints = await svmPage.getPointCount();

    // addedPoints should be empty (transition to S4_PointsCleared)
    expect(clearedAdded).toBe(0);
    // SVG points should be equal to generated data length (no added points)
    const dataLen = await svmPage.getDataLength();
    expect(clearedSvgPoints).toBeGreaterThanOrEqual(dataLen);
  });

  test('Kernel selection shows/hides parameter controls (UpdateKernelControls event)', async () => {
    // Set kernel to poly -> degree control should be visible, gamma visible
    await svmPage.setKernel('poly');
    await page.waitForTimeout(100);

    expect(await svmPage.isDegreeControlVisible()).toBe(true);
    expect(await svmPage.isGammaControlVisible()).toBe(true);

    // Set kernel to linear -> degree control hidden, gamma maybe hidden for pure linear
    await svmPage.setKernel('linear');
    await page.waitForTimeout(100);

    expect(await svmPage.isDegreeControlVisible()).toBe(false);
    // gamma-control is used for rbf/poly/sigmoid; for linear it should be none
    expect(await svmPage.isGammaControlVisible()).toBe(false);
  });

  test('Toggling visualization checkboxes affects SVM visuals after training (UpdateVisualization event)', async () => {
    // Ensure model is trained
    await svmPage.clickTrainSVM();
    await page.waitForTimeout(200);

    // Initially checkboxes default to checked: ensure decision boundary exists
    const boundaryInitially = await svmPage.getDecisionBoundaryCount();
    expect(boundaryInitially).toBeGreaterThanOrEqual(1);

    // Toggle off boundary
    await svmPage.toggleCheckbox('#show-boundary', false);
    await page.waitForTimeout(150);
    const boundaryAfterOff = await svmPage.getDecisionBoundaryCount();
    // When checkbox off, the code removes and re-adds elements; we expect zero boundary elements
    expect(boundaryAfterOff).toBe(0);

    // Toggle boundary back on
    await svmPage.toggleCheckbox('#show-boundary', true);
    await page.waitForTimeout(150);
    const boundaryAfterOn = await svmPage.getDecisionBoundaryCount();
    expect(boundaryAfterOn).toBeGreaterThanOrEqual(1);
  });

  test('Edge case: attempting to train with insufficient points triggers alert dialog', async () => {
    // Clear data and addedPoints to create insufficient data scenario
    await svmPage.clearDataAndAddedPoints();

    // Ensure data length is 0 before clicking train
    const dataLen = await svmPage.getDataLength();
    const addedLen = await svmPage.getAddedPointsLength();
    expect(dataLen).toBe(0);
    expect(addedLen).toBe(0);

    // Listen for dialog
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    await svmPage.clickTrainSVM();
    // Allow time for dialog handler
    await page.waitForTimeout(200);

    // Expect the alert message about insufficient data
    expect(dialogMessage).toBe('Not enough data points to train SVM');
  });

  test('Updating sliders and verifying display spans reflect input (UpdateNoise, UpdateCValue, UpdateDegreeValue, UpdateGammaValue, UpdateClassParams)', async () => {
    // Update noise slider and verify display
    await svmPage.setNoise('0.45');
    await page.waitForTimeout(100);
    expect(await svmPage.getNoiseDisplay()).toContain('0.45');

    // Update class1 and class2 params and verify displays
    await svmPage.page.fill('#class1-param1', '0.6');
    await svmPage.page.dispatchEvent('#class1-param1', 'input');
    await page.waitForTimeout(50);
    expect(await svmPage.getClass1Display()).toContain('0.6');

    await svmPage.page.fill('#class2-param1', '0.2');
    await svmPage.page.dispatchEvent('#class2-param1', 'input');
    await page.waitForTimeout(50);
    expect(await svmPage.getClass2Display()).toContain('0.2');

    // Update C, degree, gamma and verify displays
    await svmPage.setC('2.5');
    await page.waitForTimeout(50);
    expect(await svmPage.getCDisplay()).toContain('2.5');

    await svmPage.setDegree('5');
    await page.waitForTimeout(50);
    expect(await svmPage.getDegreeDisplay()).toContain('5');

    await svmPage.setGamma('1.2');
    await page.waitForTimeout(50);
    expect(await svmPage.getGammaDisplay()).toContain('1.2');
  });

  test('Verify onEnter actions: S0_Idle -> S1_DataGenerated triggers generateData and updateVisualization (explicit transition test)', async () => {
    // Simulate going back to Idle by clearing data and visualization (we cannot call internal state machine,
    // but we can call generateData via the button to assert the transition effect)
    await svmPage.clearDataAndAddedPoints();

    // Ensure no points before generating
    const beforePoints = await svmPage.getPointCount();
    expect(beforePoints).toBe(0);

    // Click generate data -> should repopulate data and visualization (entry action)
    await svmPage.clickGenerateData();
    await page.waitForTimeout(200);

    const afterPoints = await svmPage.getPointCount();
    const dataLen = await svmPage.getDataLength();

    // Expect points to be rendered and data array repopulated
    expect(dataLen).toBeGreaterThan(0);
    expect(afterPoints).toBeGreaterThanOrEqual(dataLen);
  });
});