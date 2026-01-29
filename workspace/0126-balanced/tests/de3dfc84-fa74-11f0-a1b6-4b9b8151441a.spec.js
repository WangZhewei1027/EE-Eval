import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3dfc84-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('SVM Visualization FSM - de3dfc84-fa74-11f0-a1b6-4b9b8151441a', () => {
  // Arrays to collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (info, warn, error, log, etc.)
    page.on('console', msg => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect unhandled exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application
    await page.goto(APP_URL);

    // Wait for the SVG group element that event handlers attach to
    await page.waitForSelector('#svm-container svg g', { timeout: 5000 });
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright defaults; page listeners are tied to the page lifecycle
  });

  // Helper function to assert no runtime ReferenceError / SyntaxError / TypeError occurred
  async function assertNoCriticalPageErrors() {
    // Filter pageErrors to the critical JS error types
    const critical = pageErrors.filter(err =>
      err instanceof ReferenceError ||
      err instanceof SyntaxError ||
      err instanceof TypeError ||
      // Some environments may wrap errors; also inspect message strings
      (err && typeof err.message === 'string' && (
        err.message.includes('ReferenceError') ||
        err.message.includes('SyntaxError') ||
        err.message.includes('TypeError')
      ))
    );

    expect(critical, `Expected no ReferenceError/SyntaxError/TypeError in page errors, found: ${critical.map(e => String(e.message || e)).join('; ')}`).toHaveLength(0);
  }

  // Group tests for initial state (S0_Idle)
  test.describe('State S0_Idle (Initial Render)', () => {
    test('should render title and controls and have no points initially', async ({ page }) => {
      // Validate the page header is present as evidence for S0_Idle entry action
      const header = await page.locator('h1').innerText();
      expect(header).toContain('Support Vector Machine (SVM) Visualization');

       // Controls exist
      await expect(page.locator('#reset-btn')).toBeVisible();
      await expect(page.locator('#random-btn')).toBeVisible();
      await expect(page.locator('#kernel-select')).toBeVisible();

      // Initially there should be no point elements
      const initialPoints = await page.locator('circle.point').count();
      expect(initialPoints).toBe(0);

      // Verify that internal arrays are present and empty
      const { pointsLen, trainingDataLen, currentColor } = await page.evaluate(() => {
        return {
          pointsLen: typeof points !== 'undefined' ? points.length : null,
          trainingDataLen: typeof trainingData !== 'undefined' ? trainingData.length : null,
          currentColor: typeof currentColor !== 'undefined' ? currentColor : null
        };
      });

      expect(pointsLen).toBe(0);
      expect(trainingDataLen).toBe(0);
      // currentColor expected initial value 0 per implementation
      expect(currentColor).toBe(0);

      // Ensure there were no critical JS errors on load
      await assertNoCriticalPageErrors();
    });
  });

  // Tests for adding points (S1_PointsAdded)
  test.describe('State S1_PointsAdded (Adding Points)', () => {
    test('ClickToAddPoint: clicking on the SVG should add a new point and update training data', async ({ page }) => {
      // Click at a specific coordinate inside the svg to add a point
      const svgLocator = page.locator('#svm-container svg');
      await svgLocator.click({ position: { x: 100, y: 80 } });

      // After click, there should be one point element
      const pointCount = await page.locator('circle.point').count();
      expect(pointCount).toBeGreaterThanOrEqual(1);

      // Inspect the first point's geometry and color
      const firstPoint = page.locator('circle.point').first();
      const fill = await firstPoint.getAttribute('fill');
      const cx = parseFloat((await firstPoint.getAttribute('cx')) || '0');
      const cy = parseFloat((await firstPoint.getAttribute('cy')) || '0');

      expect(fill).toBeTruthy();
      // Coordinates should be approximately where we clicked (within a small tolerance)
      expect(Math.abs(cx - 100)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(cy - 80)).toBeLessThanOrEqual(1.5);

      // Verify the internal points and trainingData were updated (entry action updateVisualization implied)
      const { pointsLen, trainingDataLen } = await page.evaluate(() => {
        return {
          pointsLen: typeof points !== 'undefined' ? points.length : null,
          trainingDataLen: typeof trainingData !== 'undefined' ? trainingData.length : null
        };
      });

      expect(pointsLen).toBeGreaterThanOrEqual(1);
      expect(trainingDataLen).toBeGreaterThanOrEqual(1);

      // No critical JS errors happened
      await assertNoCriticalPageErrors();
    });

    test('ClickToAddPoint again: additional points are added and alternate colors are used', async ({ page }) => {
      const svgLocator1 = page.locator('#svm-container svg');

      // Add first point
      await svgLocator.click({ position: { x: 120, y: 90 } });
      // Add second point, expected to alternate color
      await svgLocator.click({ position: { x: 140, y: 110 } });

      const pts = page.locator('circle.point');
      const count = await pts.count();
      expect(count).toBeGreaterThanOrEqual(2);

      // Check colors of the last two appended points (note support-vector circles may also exist later)
      const last = pts.nth(count - 1);
      const secondLast = pts.nth(count - 2);
      const lastFill = await last.getAttribute('fill');
      const secondLastFill = await secondLast.getAttribute('fill');

      // Colors should be different since implementation alternates
      expect(lastFill).not.toBe(secondLastFill);

      // trainingData should reflect the number of points added
      const trainingDataLen = await page.evaluate(() => (typeof trainingData !== 'undefined' ? trainingData.length : null));
      expect(trainingDataLen).toBeGreaterThanOrEqual(2);

      await assertNoCriticalPageErrors();
    });
  });

  // Tests for Reset Visualization (S2_VisualizationReset)
  test.describe('State S2_VisualizationReset (Resetting Visualization)', () => {
    test('ResetVisualization: clicking reset clears points, training data, and resets currentColor and SVM params', async ({ page }) => {
      const svgLocator2 = page.locator('#svm-container svg');

      // Add a few points first to ensure reset has something to clear
      await svgLocator.click({ position: { x: 60, y: 60 } });
      await svgLocator.click({ position: { x: 80, y: 120 } });

      // Ensure points exist before reset
      expect(await page.locator('circle.point').count()).toBeGreaterThanOrEqual(2);

      // Click reset button
      await page.locator('#reset-btn').click();

      // After reset, there should be no point elements
      await expect(page.locator('circle.point')).toHaveCount(0);

      // Internal arrays and svm fields should be reset as per implementation
      const { pointsLen, trainingDataLen, currentColor, svmState } = await page.evaluate(() => {
        return {
          pointsLen: typeof points !== 'undefined' ? points.length : null,
          trainingDataLen: typeof trainingData !== 'undefined' ? trainingData.length : null,
          currentColor: typeof currentColor !== 'undefined' ? currentColor : null,
          svmState: typeof svm !== 'undefined' ? { weights: svm.weights, bias: svm.bias } : null
        };
      });

      expect(pointsLen).toBe(0);
      expect(trainingDataLen).toBe(0);
      expect(currentColor).toBe(0);
      expect(Array.isArray(svmState.weights)).toBeTruthy();
      expect(svmState.weights[0]).toBe(0);
      expect(svmState.weights[1]).toBe(0);
      expect(svmState.bias).toBe(0);

      await assertNoCriticalPageErrors();
    });
  });

  // Tests for Random Points (S3_RandomPointsAdded)
  test.describe('State S3_RandomPointsAdded (Adding Random Points)', () => {
    test('AddRandomPoints: clicking the random button adds multiple points', async ({ page }) => {
      // Ensure starting from a clean state
      await page.locator('#reset-btn').click();
      await expect(page.locator('circle.point')).toHaveCount(0);

      // Click the random button and expect ~10 new points to appear
      await page.locator('#random-btn').click();

      // Wait briefly for additions to be processed
      await page.waitForTimeout(300);

      const count1 = await page.locator('circle.point').count1();
      // Implementation adds 10 points; sometimes support-vector duplicates may appear later,
      // but at least 10 point elements should be present
      expect(count).toBeGreaterThanOrEqual(10);

      // trainingData should also have entries corresponding to added points
      const trainingDataLen1 = await page.evaluate(() => (typeof trainingData !== 'undefined' ? trainingData.length : null));
      expect(trainingDataLen).toBeGreaterThanOrEqual(10);

      await assertNoCriticalPageErrors();
    });
  });

  // Tests for Kernel Change (S4_KernelChanged)
  test.describe('State S4_KernelChanged (Changing Kernel)', () => {
    test('ChangeKernel: switching to RBF should update svm.kernel and margin and update visualization accordingly', async ({ page }) => {
      // Start with a clean state, then add several points to enable training
      await page.locator('#reset-btn').click();
      const svgLocator3 = page.locator('#svm-container svg');

      // Add multiple points to ensure trainingData.length >= 2 and support computations run
      await svgLocator.click({ position: { x: 50, y: 50 } });
      await svgLocator.click({ position: { x: 150, y: 100 } });
      await svgLocator.click({ position: { x: 200, y: 200 } });
      await svgLocator.click({ position: { x: 300, y: 150 } });

      // Confirm trainingData has several entries
      const trainingDataLen2 = await page.evaluate(() => (typeof trainingData !== 'undefined' ? trainingData.length : null));
      expect(trainingDataLen).toBeGreaterThanOrEqual(4);

      // Initially kernel should be 'linear'
      const initialKernel = await page.evaluate(() => (typeof svm !== 'undefined' ? svm.kernel : null));
      expect(initialKernel).toBe('linear');

      // Change kernel select to 'rbf'
      await page.locator('#kernel-select').selectOption('rbf');

      // After change, svm.kernel should be updated
      const newKernel = await page.evaluate(() => (typeof svm !== 'undefined' ? svm.kernel : null));
      expect(newKernel).toBe('rbf');

      // For RBF, implementation sets margin to 0.2
      const margin = await page.evaluate(() => (typeof svm !== 'undefined' ? svm.margin : null));
      expect(margin).toBeCloseTo(0.2);

      // For RBF visualization, decision boundary is drawn as a path (class 'decision-boundary')
      const decisionBoundary = page.locator('.decision-boundary');
      await expect(decisionBoundary).toBeVisible();

      await assertNoCriticalPageErrors();
    });

    test('ChangeKernel back to linear should adjust svm.kernel and draw a line decision boundary', async ({ page }) => {
      // Ensure kernel currently rbf by setting it
      await page.locator('#kernel-select').selectOption('rbf');

      // Now switch back to linear
      await page.locator('#kernel-select').selectOption('linear');

      // svm.kernel should reflect the change
      const kernel = await page.evaluate(() => (typeof svm !== 'undefined' ? svm.kernel : null));
      expect(kernel).toBe('linear');

      // For linear kernel, the visualization draws a <line> element with class 'decision-boundary'
      // Wait briefly for updateVisualization to render
      await page.waitForTimeout(200);
      const lineCount = await page.locator('line.decision-boundary').count();
      expect(lineCount).toBeGreaterThanOrEqual(1);

      await assertNoCriticalPageErrors();
    });
  });

  // Edge case and error scenario tests
  test.describe('Edge cases and error scenarios', () => {
    test('Adding single point should not draw decision boundary (trainSVM early return) and should not throw errors', async ({ page }) => {
      // Reset and add exactly one point
      await page.locator('#reset-btn').click();
      await page.locator('#svm-container svg').click({ position: { x: 80, y: 80 } });

      // Ensure trainingData length is 1
      const trainingDataLen3 = await page.evaluate(() => (typeof trainingData !== 'undefined' ? trainingData.length : null));
      expect(trainingDataLen).toBe(1);

      // Decision boundary should not be present when trainingData.length < 2
      const decisionBoundaryCount = await page.locator('.decision-boundary').count();
      expect(decisionBoundaryCount).toBe(0);

      // No critical JS errors occurred
      await assertNoCriticalPageErrors();
    });

    test('Large number of random points should not throw TypeError/ReferenceError/SyntaxError', async ({ page }) => {
      // Reset
      await page.locator('#reset-btn').click();

      // Invoke random point addition multiple times to stress the visualization
      for (let i = 0; i < 3; i++) {
        await page.locator('#random-btn').click();
        await page.waitForTimeout(150);
      }

      // Expect a fairly large number of points (3 * 10 = 30)
      const count2 = await page.locator('circle.point').count2();
      expect(count).toBeGreaterThanOrEqual(30);

      // Confirm no critical errors in pageErrors
      await assertNoCriticalPageErrors();
    });

    test('Observe console for any warnings or errors and surface them (non-critical allowed)', async ({ page }) => {
      // This test simply ensures we captured console output and that none of the console messages indicate
      // ReferenceError/SyntaxError/TypeError in their text (as an extra precaution)
      const criticalConsoleMsgs = consoleMessages.filter(m =>
        typeof m.text === 'string' && (
          m.text.includes('ReferenceError') ||
          m.text.includes('SyntaxError') ||
          m.text.includes('TypeError')
        )
      );

      expect(criticalConsoleMsgs, `Found critical error-like console messages: ${criticalConsoleMsgs.map(m => m.text).join('; ')}`).toHaveLength(0);

      // Also ensure that we did capture some console messages (not required, but helpful for diagnostics)
      // We won't assert that consoleMessages.length > 0 because many environments may be quiet; just ensure array exists
      expect(Array.isArray(consoleMessages)).toBeTruthy();

      // No page errors of critical types
      await assertNoCriticalPageErrors();
    });
  });
});