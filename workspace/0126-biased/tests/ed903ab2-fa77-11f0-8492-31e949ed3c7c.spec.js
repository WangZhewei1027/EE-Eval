import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed903ab2-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the SVM Visualization page
class SVMPage {
  constructor(page) {
    this.page = page;
  }

  // Selectors
  get chart() {
    return this.page.locator('#chart');
  }
  get decisionBoundary() {
    return this.page.locator('#decisionBoundary');
  }
  get visualizeButton() {
    return this.page.locator('.button');
  }
  get info() {
    return this.page.locator('#info');
  }
  // Actions
  async clickVisualize() {
    await this.visualizeButton.click();
  }
  // Helpers
  async countDots() {
    return await this.page.locator('#chart .dot').count();
  }
  async getDotStyles() {
    const handles = await this.page.$$eval('#chart .dot', dots =>
      dots.map(d => d.getAttribute('style'))
    );
    return handles;
  }
  // Wait until at least `min` dots have transform (scale) applied, or timeout
  async waitForTransformedDots(min = 1, timeout = 4000) {
    const start = Date.now();
    while ((Date.now() - start) < timeout) {
      const styles = await this.getDotStyles();
      const transformed = styles.filter(s => s && /transform\s*:\s*scale\(1.5\)/.test(s));
      if (transformed.length >= min) return transformed.length;
      await this.page.waitForTimeout(150);
    }
    return 0;
  }
}

test.describe('SVM Visualization FSM and UI behavior', () => {
  // Arrays to collect console and page errors during each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages and page errors for assertions
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      // Capture uncaught exceptions that bubble to the page
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Useful debugging: if there were console errors, print them to test output
    if (consoleMessages.some(m => m.type === 'error')) {
      // This is intentionally not preventing the test from finishing
      // It helps to inspect console errors if they occurred
      for (const m of consoleMessages.filter(m => m.type === 'error')) {
        console.log('Console error:', m.text);
      }
    }
    if (pageErrors.length > 0) {
      for (const e of pageErrors) {
        console.log('Page error:', e);
      }
    }
  });

  test('Initial Idle state: page renders expected components', async ({ page }) => {
    // Validate initial Idle state elements are present (S0_Idle)
    // - Visualize SVM button exists with expected text and onclick attribute
    // - Chart and decision boundary are present
    const svm = new SVMPage(page);

    await expect(svm.visualizeButton).toBeVisible();
    await expect(svm.visualizeButton).toHaveText('Visualize SVM');

    await expect(svm.chart).toBeVisible();
    await expect(svm.decisionBoundary).toBeVisible();

    // No dots should exist initially in the chart (Idle state should be empty)
    const initialDots = await svm.countDots();
    expect(initialDots).toBe(0);

    // Verify the informational text is present
    await expect(svm.info).toContainText('Watch as the Support Vector Machine classifies data points!');

    // Ensure no uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);

    // No console error messages on initial render
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Animating: clicking Visualize SVM creates and animates points', async ({ page }) => {
    // This test validates the transition described in the FSM:
    // Event: VisualizeSVM (click .button)
    // Expected: Points are animated on the chart (S1_Animating)
    const svm = new SVMPage(page);

    // Click the visualize button to trigger animatePoints()
    await svm.clickVisualize();

    // After clicking, createPoints() should have appended 20 .dot elements synchronously
    // Assert that 20 dots are present
    // Note: createPoints() appends 20 dots immediately before animation interval starts
    const dotCount = await svm.countDots();
    expect(dotCount).toBe(20);

    // Wait for at least one dot to be transformed (scale applied by animatePoints)
    // animation interval is 500ms; waiting up to 4s should detect several transformed dots
    const transformed = await svm.waitForTransformedDots(1, 4000);
    expect(transformed).toBeGreaterThanOrEqual(1);

    // Verify at least one dot has style that includes transform: scale(1.5)
    const styles = await svm.getDotStyles();
    const anyTransformed = styles.some(s => s && /transform\s*:\s*scale\(1.5\)/.test(s));
    expect(anyTransformed).toBe(true);

    // Ensure the decision boundary remains present and unchanged in DOM
    await expect(svm.decisionBoundary).toBeVisible();

    // No uncaught page errors during animation
    expect(pageErrors.length).toBe(0);
    // No console error traces
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('Clicking Visualize SVM multiple times appends more points and stays stable', async ({ page }) => {
    // Edge case: user clicks the button multiple times; ensure points continue to be added,
    // animations proceed, and no uncaught exceptions are thrown.
    const svm = new SVMPage(page);

    // Click twice in quick succession
    await svm.clickVisualize();
    await svm.page.waitForTimeout(150); // small delay
    await svm.clickVisualize();

    // Expect 40 dots (20 per click)
    const countAfterTwoClicks = await svm.countDots();
    expect(countAfterTwoClicks).toBe(40);

    // Wait for some animations to occur (should see at least a few transformed)
    const transformedCount = await svm.waitForTransformedDots(2, 5000);
    expect(transformedCount).toBeGreaterThanOrEqual(2);

    // No uncaught page errors as result of multiple clicks
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('Entry action renderPage() is not defined and calling it raises a ReferenceError', async ({ page }) => {
    // The FSM lists an entry_action "renderPage()". The provided implementation does not
    // define renderPage(). This test intentionally attempts to invoke renderPage() in the page
    // context (without redefining it) and asserts a ReferenceError is thrown naturally.
    // This validates that missing entry action functions surface as ReferenceError in runtime.

    // Attempting to call an undefined global in the page context will cause evaluate to reject.
    // We assert that the promise rejects with a ReferenceError / "not defined" message.
    await expect(page.evaluate(() => {
      // Call the function that is not defined in page (do not define/patch it)
      // This will throw a ReferenceError in the page context
      // The thrown error is propagated back to the Node test runner as a rejection.
      return renderPage();
    })).rejects.toThrow(/renderPage is not defined|ReferenceError/);
    // Also, this may or may not produce a pageerror event depending on engine; we do not rely on it.
  });

  test('Robustness: repeated rapid clicks do not cause uncaught exceptions', async ({ page }) => {
    // Stress test: rapidly click the button multiple times and ensure no page errors occur.
    const svm = new SVMPage(page);

    // Rapidly click 5 times
    for (let i = 0; i < 5; i++) {
      await svm.clickVisualize();
    }

    // Expect 100 dots (20 * 5)
    const expected = 20 * 5;
    const actual = await svm.countDots();
    expect(actual).toBe(expected);

    // Wait a short while to allow any asynchronous errors to surface
    await page.waitForTimeout(1000);

    // Assert no uncaught exceptions happened
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('DOM integrity: decision boundary remains a single .line element and is positioned mid-chart', async ({ page }) => {
    // Validate that the decision boundary element exists as expected and is not duplicated after animation.
    const svm = new SVMPage(page);

    // Ensure decision boundary exists before interaction
    await expect(svm.decisionBoundary).toBeVisible();

    // Trigger animation
    await svm.clickVisualize();

    // Decision boundary should still exist and should be singular
    const boundaryCount = await page.locator('.line#decisionBoundary').count();
    expect(boundaryCount).toBe(1);

    // Check computed position of the boundary (it should be vertically centered)
    // We'll read its bounding box and chart bounding box and ensure the line's Y is roughly centered.
    const chartBox = await svm.chart.boundingBox();
    const lineBox = await svm.decisionBoundary.boundingBox();
    // Defensive checks in case bounding boxes are undefined
    expect(chartBox).toBeTruthy();
    expect(lineBox).toBeTruthy();

    if (chartBox && lineBox) {
      const lineCenterY = lineBox.y + lineBox.height / 2;
      const chartCenterY = chartBox.y + chartBox.height / 2;
      // Allow some tolerance ( +/- 5 pixels ) for centering due to CSS transforms
      expect(Math.abs(lineCenterY - chartCenterY)).toBeLessThanOrEqual(5);
    }

    // Ensure no errors appeared while checking layout
    expect(pageErrors.length).toBe(0);
  });
});