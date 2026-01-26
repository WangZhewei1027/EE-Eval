import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d11a54-fa79-11f0-8075-e54a10595dde.html';

// Page Object encapsulating interactions with the SVM demo page
class SVMPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages
    this.page.on('console', msg => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions in the page
    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async addPoint(x, y) {
    await this.page.fill('#pointX', String(x));
    await this.page.fill('#pointY', String(y));
    await this.page.click('#addPoint');
  }

  async trainSVM() {
    await this.page.click('#trainSVM');
  }

  async clearPoints() {
    await this.page.click('#clearPoints');
  }

  async getPointsListItems() {
    return this.page.$$eval('#pointsList li', els => els.map(e => e.innerText.trim()));
  }

  async getPointsListCount() {
    return this.page.$$eval('#pointsList li', els => els.length);
  }

  async getModelOutputText() {
    return this.page.$eval('#modelOutput', el => el.innerText.trim());
  }

  // Helpers to inspect captured console / page errors
  getConsoleErrors() {
    return this.consoleMessages.filter(m => m.type === 'error');
  }

  getConsoleWarnings() {
    return this.consoleMessages.filter(m => m.type === 'warning');
  }

  getAllConsole() {
    return this.consoleMessages;
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Support Vector Machine Interactive Demo - FSM tests', () => {
  let svm;

  test.beforeEach(async ({ page }) => {
    svm = new SVMPage(page);
    await svm.goto();
  });

  test.afterEach(async () => {
    // After each test ensure there were no unhandled page errors (SyntaxError/ReferenceError/TypeError)
    const pageErrors = svm.getPageErrors();
    // If there are page errors, fail the test and print them
    if (pageErrors.length > 0) {
      // Re-throwing will show the underlying errors in Playwright's output
      throw new Error('Page had uncaught errors: ' + pageErrors.map(e => String(e)).join('\n'));
    }
    // Also assert there were no console.error messages emitted by the page
    const consoleErrors = svm.getConsoleErrors();
    if (consoleErrors.length > 0) {
      throw new Error('Console had error messages: ' + consoleErrors.map(c => c.text).join('\n'));
    }
  });

  test('Initial state S0_Idle: page renders with no model trained and empty points list', async () => {
    // Validate initial state (onEnter renderPage())
    // Expect: modelOutput reads "No model trained yet." and points list is empty
    const modelText = await svm.getModelOutputText();
    expect(modelText).toBe('No model trained yet.');

    const listCount = await svm.getPointsListCount();
    expect(listCount).toBe(0);

    // Ensure no console errors/warnings on initial render
    const consoleAll = svm.getAllConsole();
    const errorMsgs = consoleAll.filter(m => m.type === 'error');
    expect(errorMsgs.length).toBe(0);
  });

  test('AddPointClick transition: adding a point updates points list (S0_Idle -> S0_Idle)', async () => {
    // Add a single point and verify the points list updates and model output remains unchanged
    await svm.addPoint(1.2, 3.4);

    const items = await svm.getPointsListItems();
    expect(items.length).toBe(1);
    // The list item should display the exact x,y added
    expect(items[0]).toBe('(1.2, 3.4)');

    // Model should still be in Idle state (no model trained)
    const modelText = await svm.getModelOutputText();
    expect(modelText).toBe('No model trained yet.');

    // No page errors produced during adding a point
    expect(svm.getPageErrors().length).toBe(0);
    expect(svm.getConsoleErrors().length).toBe(0);
  });

  test('TrainSVMClick with insufficient points shows instructional error message', async () => {
    // Ensure clear start
    await svm.clearPoints();

    // Add only one point
    await svm.addPoint(5, -2);

    // Attempt to train with a single point
    await svm.trainSVM();

    // Expect modelOutput to instruct that at least 2 points are required
    const modelText = await svm.getModelOutputText();
    expect(modelText).toBe('At least 2 points are required to train the SVM.');

    // Points list should still contain the one point
    const items = await svm.getPointsListItems();
    expect(items.length).toBe(1);
    expect(items[0]).toBe('(5, -2)');

    // No page errors during this scenario
    expect(svm.getPageErrors().length).toBe(0);
    expect(svm.getConsoleErrors().length).toBe(0);
  });

  test('TrainSVMClick with two points trains model and transitions to S1_Training', async () => {
    // Clear and add two points
    await svm.clearPoints();
    await svm.addPoint(0, 0);
    await svm.addPoint(2, 4);

    // Sanity check: two points present
    const items = await svm.getPointsListItems();
    expect(items.length).toBe(2);
    expect(items).toEqual(['(0, 0)', '(2, 4)']);

    // Train the SVM
    await svm.trainSVM();

    // Expect modelOutput indicates the boundary. It should match the calculateBoundary algorithm in the page.
    const modelText = await svm.getModelOutputText();
    expect(modelText.startsWith('Model trained. Boundary: y = ')).toBeTruthy();

    // Extract m and b from the returned string "Model trained. Boundary: y = <m>x + <b>"
    const match = modelText.match(/Model trained\. Boundary: y = ([^x]+)x \+ (.+)$/);
    expect(match).not.toBeNull();
    const mStr = match[1].trim();
    const bStr = match[2].trim();

    // Parse as floats
    const m = parseFloat(mStr);
    const b = parseFloat(bStr);

    // Compute expected boundary using the same algorithm as the page:
    // xAvg = (0 + 2)/2 = 1
    // yAvg = (0 + 4)/2 = 2
    // slope = (yAvg - xAvg) / (points.length - 1) => (2 - 1) / 1 = 1
    // intercept = yAvg - slope*xAvg => 2 - 1*1 = 1
    const expectedM = 1;
    const expectedB = 1;

    // Allow tiny floating point differences
    const approxEqual = (a, bVal, tol = 1e-9) => Math.abs(a - bVal) <= tol;

    expect(approxEqual(m, expectedM)).toBeTruthy();
    expect(approxEqual(b, expectedB)).toBeTruthy();

    // Points list should remain intact after training
    const itemsAfter = await svm.getPointsListItems();
    expect(itemsAfter.length).toBe(2);

    // No page errors or console errors occurred
    expect(svm.getPageErrors().length).toBe(0);
    expect(svm.getConsoleErrors().length).toBe(0);
  });

  test('ClearPointsClick clears points and resets model output to Idle state', async () => {
    // Add multiple points and train to ensure non-trivial state
    await svm.clearPoints();
    await svm.addPoint(-1, 2.5);
    await svm.addPoint(3.3, -0.7);
    await svm.trainSVM();

    // Confirm the modelOutput is in trained state (starts with expected prefix)
    const trainedText = await svm.getModelOutputText();
    expect(trainedText.startsWith('Model trained. Boundary: y =')).toBeTruthy();

    // Now clear points
    await svm.clearPoints();

    // Expect points list to be empty
    const listCount = await svm.getPointsListCount();
    expect(listCount).toBe(0);

    // Expect model output reset to Idle message
    const modelText = await svm.getModelOutputText();
    expect(modelText).toBe('No model trained yet.');

    // No page errors or console errors produced by clearing
    expect(svm.getPageErrors().length).toBe(0);
    expect(svm.getConsoleErrors().length).toBe(0);
  });

  test('Edge cases: adding repeated points and negative/decimal values', async () => {
    await svm.clearPoints();

    // Add a variety of points including decimals and negatives
    await svm.addPoint(-0.5, -0.25);
    await svm.addPoint(-0.5, -0.25); // repeated point
    await svm.addPoint(1.234, 5.678);

    const items = await svm.getPointsListItems();
    expect(items.length).toBe(3);
    expect(items[0]).toBe('(-0.5, -0.25)');
    expect(items[1]).toBe('(-0.5, -0.25)');
    expect(items[2]).toBe('(1.234, 5.678)');

    // Train with these points to ensure calculation handles decimals/negatives
    await svm.trainSVM();
    const modelText = await svm.getModelOutputText();
    expect(modelText.startsWith('Model trained. Boundary: y = ')).toBeTruthy();

    // Ensure numeric extraction works (m and b parseable)
    const match = modelText.match(/Model trained\. Boundary: y = ([^x]+)x \+ (.+)$/);
    expect(match).not.toBeNull();
    const m = parseFloat(match[1].trim());
    const b = parseFloat(match[2].trim());
    expect(Number.isFinite(m)).toBeTruthy();
    expect(Number.isFinite(b)).toBeTruthy();

    // No page errors or console errors
    expect(svm.getPageErrors().length).toBe(0);
    expect(svm.getConsoleErrors().length).toBe(0);
  });

  test('Observe console and page errors during user interactions (should be none)', async () => {
    // Perform a sequence of interactions
    await svm.clearPoints();
    await svm.addPoint(10, 10);
    await svm.addPoint(20, 5);
    await svm.trainSVM();
    await svm.clearPoints();

    // Inspect captured console messages and page errors
    const pageErrors = svm.getPageErrors();
    const consoleErrors = svm.getConsoleErrors();
    const consoleWarnings = svm.getConsoleWarnings();

    // Expect no unhandled exceptions (ReferenceError, TypeError, SyntaxError, etc.)
    expect(pageErrors.length).toBe(0);

    // Expect no console error logs. Warnings are allowed but we assert none to be strict.
    expect(consoleErrors.length).toBe(0);
    expect(consoleWarnings.length).toBe(0);
  });
});