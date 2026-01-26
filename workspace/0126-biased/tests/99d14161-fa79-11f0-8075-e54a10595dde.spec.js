import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d14161-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the K-NN demo page
class KNNPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.dataPointsInput = page.locator('#data-points');
    this.generateButton = page.locator('#generate-points');
    this.pointsDiv = page.locator('#points');
    this.kValueInput = page.locator('#k-value');
    this.newPointInput = page.locator('#new-point');
    this.addPointButton = page.locator('#add-point');
    this.runKNNButton = page.locator('#run-knn');
    this.resultsDiv = page.locator('#results');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeaderText() {
    return this.header.innerText();
  }

  async setDataPointsCount(n) {
    await this.dataPointsInput.fill(String(n));
  }

  async clickGenerate() {
    await this.generateButton.click();
  }

  async getPointsInnerText() {
    return this.pointsDiv.innerText();
  }

  async countRenderedPoints() {
    const text = await this.getPointsInnerText();
    // Count occurrences of '(' which precede each point like "(x, y)"
    const matches = text.match(/\(/g);
    return matches ? matches.length : 0;
  }

  async setKValue(k) {
    await this.kValueInput.fill(String(k));
  }

  async setNewPointInput(value) {
    await this.newPointInput.fill(value);
  }

  async clickAddPoint() {
    await this.addPointButton.click();
  }

  async clickRunKNN() {
    await this.runKNNButton.click();
  }

  async getResultsInnerText() {
    return this.resultsDiv.innerText();
  }
}

test.describe('K-Nearest Neighbors Interactive Demo - FSM validation', () => {
  // Arrays to capture console error messages and page errors
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture unhandled page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test.afterEach(async () => {
    // After each test, assert that no unexpected console errors or page errors occurred.
    // The HTML/JS might produce errors in some scenarios; if there are errors, fail the test with details.
    expect(consoleErrors, 'No console.error messages should have been emitted').toEqual([]);
    expect(pageErrors, 'No uncaught page errors (ReferenceError/SyntaxError/TypeError) should have occurred').toEqual([]);
  });

  test('Initial state S0_Idle: page renders and header is present', async ({ page }) => {
    // Validate the Idle state: the page should render the main header and no points/results initially.
    const knn = new KNNPage(page);
    await knn.goto();

    // Check header text is correct (evidence in FSM)
    const headerText = await knn.getHeaderText();
    expect(headerText).toContain('K-Nearest Neighbors Interactive Demo');

    // Points and results should be empty (no data rendered yet)
    const pointsText = await knn.getPointsInnerText();
    expect(pointsText).toBe(''); // #points div should be empty before generating

    const resultsText = await knn.getResultsInnerText();
    expect(resultsText).toBe('');
  });

  test('Transition S0 -> S1 GeneratePoints: generates specified number of data points and displays them', async ({ page }) => {
    // Validate generating points transitions the app to Points Generated state and shows points
    const knn = new KNNPage(page);
    await knn.goto();

    // Set a deterministic number of points to generate
    await knn.setDataPointsCount(4);
    await knn.clickGenerate();

    // The points div should contain the header "Data Points" and 4 rendered points
    const pointsText = await knn.getPointsInnerText();
    expect(pointsText).toContain('Data Points');

    const renderedCount = await knn.countRenderedPoints();
    expect(renderedCount).toBe(4);
  });

  test('Transition S1 -> S2 AddPoint: add a new point via input and it is appended to the list', async ({ page }) => {
    // Validate adding a new point after generation appends the new point and re-renders points
    const knn = new KNNPage(page);
    await knn.goto();

    // Generate an initial set (3)
    await knn.setDataPointsCount(3);
    await knn.clickGenerate();
    const initialCount = await knn.countRenderedPoints();
    expect(initialCount).toBe(3);

    // Add a new point "4,5"
    await knn.setNewPointInput('4,5');
    await knn.clickAddPoint();

    // After adding, count should increase by 1 and the new point should be visible
    const afterAddCount = await knn.countRenderedPoints();
    expect(afterAddCount).toBe(initialCount + 1);

    const pointsText = await knn.getPointsInnerText();
    expect(pointsText).toContain('(4, 5)'); // new point should be present in the rendered list
  });

  test('Transition S2 -> S3 RunKNN: running K-NN shows nearest neighbors; with k=1 the last added point should be the nearest to itself', async ({ page }) => {
    // Validate running K-NN computes neighbors and displays results
    const knn = new KNNPage(page);
    await knn.goto();

    // Ensure there is at least one point by adding a known point
    await knn.setDataPointsCount(2);
    await knn.clickGenerate();

    // Add a known new point which will be treated as the "last point"
    await knn.setNewPointInput('7,8');
    await knn.clickAddPoint();

    // Set k=1 to get the single nearest neighbor (should be the last point itself)
    await knn.setKValue(1);
    await knn.clickRunKNN();

    const resultsText = await knn.getResultsInnerText();
    expect(resultsText).toContain('Nearest Neighbors');
    // Since distance to self is zero, the last point (7, 8) should be part of the nearest neighbors list
    expect(resultsText).toContain('(7, 8)');
  });

  test('Edge case: adding invalid new point input does not modify points list', async ({ page }) => {
    // Validate that malformed input for adding a point is ignored (no push to dataPoints)
    const knn = new KNNPage(page);
    await knn.goto();

    // Generate some points
    await knn.setDataPointsCount(2);
    await knn.clickGenerate();
    const beforeCount = await knn.countRenderedPoints();
    expect(beforeCount).toBe(2);

    // Provide invalid input and click add
    await knn.setNewPointInput('invalid-input-without-comma');
    await knn.clickAddPoint();

    // Ensure count hasn't changed
    const afterCount = await knn.countRenderedPoints();
    expect(afterCount).toBe(beforeCount);

    // Ensure the invalid input value does not appear in the list
    const pointsText = await knn.getPointsInnerText();
    expect(pointsText).not.toContain('invalid-input-without-comma');
  });

  test('Edge case: running K-NN when number of data points is less than K triggers alert', async ({ page }) => {
    // Validate the error scenario where dataPoints.length < k showing an alert
    const knn = new KNNPage(page);
    await knn.goto();

    // Ensure there are fewer points than k
    // Generate only 2 points
    await knn.setDataPointsCount(2);
    await knn.clickGenerate();

    // Set k to 3 which is greater than number of points (2)
    await knn.setKValue(3);

    // Listen for the dialog and assert its message
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      knn.clickRunKNN()
    ]);
    expect(dialog.message()).toBe('Number of data points is less than K.');
    await dialog.dismiss();
  });

  test('Sanity check: No runtime ReferenceError/SyntaxError/TypeError occurred during interactions', async ({ page }) => {
    // This test exercises multiple interactions and then asserts that no uncaught exceptions were thrown.
    const knn = new KNNPage(page);
    await knn.goto();

    // Perform several actions in sequence
    await knn.setDataPointsCount(5);
    await knn.clickGenerate();

    await knn.setNewPointInput('1,2');
    await knn.clickAddPoint();

    await knn.setKValue(2);
    await knn.clickRunKNN();

    // Validate that results contain expected 'Nearest Neighbors' text
    const resultsText = await knn.getResultsInnerText();
    expect(resultsText).toContain('Nearest Neighbors');

    // The afterEach hook will assert that no console or page errors were captured.
  });

});