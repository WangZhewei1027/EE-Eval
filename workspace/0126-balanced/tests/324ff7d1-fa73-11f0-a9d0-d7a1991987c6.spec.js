import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324ff7d1-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Logistic Regression Demo (Application ID: 324ff7d1-fa73-11f0-a9d0-d7a1991987c6)', () => {
  // Collector containers for console messages and page errors per test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Observe console messages and uncaught page errors
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the exact page as provided (do not modify page content)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Attach any collected debug info to the test output when running in CI or locally
    // This is helpful when a test fails to understand console/page errors.
    if (pageErrors.length > 0) {
      // Log the errors to stdout (Playwright will capture these)
      // Note: No modifications to the page or its runtime are made.
      // We only surface observed errors.
      // eslint-disable-next-line no-console
      console.error('Captured page errors:', pageErrors.map(e => e.message || String(e)));
    }
    if (consoleMessages.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', consoleMessages);
    }
  });

  test.describe('State S0_Idle (Initial Load)', () => {
    test('should call plotData() on load and render points in the scatter plot', async ({ page }) => {
      // Verify that the scatter plot container exists
      const scatter = page.locator('#scatterPlot');
      await expect(scatter).toHaveCount(1);

      // The sample data in the HTML has 6 points; ensure 6 .point elements were rendered
      const points = scatter.locator('.point');
      await expect(points).toHaveCount(6);

      // Check that each point has inline styles for left/top (positioned inside the 400x400 plot)
      const count = await points.count();
      for (let i = 0; i < count; i++) {
        const p = points.nth(i);
        const left = await p.evaluate(el => el.style.left);
        const top = await p.evaluate(el => el.style.top);
        const width = await p.evaluate(el => el.style.width);
        const height = await p.evaluate(el => el.style.height);
        // left/top should be set and include 'px'
        expect(left).toMatch(/px$/);
        expect(top).toMatch(/px$/);
        // width/height should be 10px as per implementation
        expect(width).toBe('10px');
        expect(height).toBe('10px');
      }

      // Ensure no uncaught page errors occurred just from loading and plotting initial data
      expect(pageErrors.length, 'No uncaught JS errors should occur on initial load').toBe(0);

      // Ensure there are no console errors captured (console messages may be empty or informational)
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages on initial load').toBe(0);
    });

    test('should have an empty message area before training', async ({ page }) => {
      const message = page.locator('#message');
      await expect(message).toHaveCount(1);
      await expect(message).toHaveText('');
    });
  });

  test.describe('Transition: TrainModel (S0_Idle -> S1_ModelTrained)', () => {
    test('clicking "Train Model" displays "Model trained." and draws decision boundary', async ({ page }) => {
      // Validate button exists as specified by the FSM
      const trainButton = page.locator('button[onclick="trainModel()"]');
      await expect(trainButton).toHaveCount(1);
      await expect(trainButton).toHaveText('Train Model');

      // Click the train button (this triggers trainModel() which will update message and draw boundary)
      await trainButton.click();

      // After training, message should be updated to 'Model trained.'
      const message = page.locator('#message');
      await expect(message).toHaveText('Model trained.');

      // A decision boundary (element with class 'line') should be appended to the scatter plot
      const scatter = page.locator('#scatterPlot');
      const lines = scatter.locator('.line');
      await expect(lines).toHaveCount(1);

      // Validate that the line has transform rotate(...) and left/top styles within expected bounds
      const line = lines.first();
      const transform = await line.evaluate(el => el.style.transform);
      const left = await line.evaluate(el => el.style.left);
      const top = await line.evaluate(el => el.style.top);
      const height = await line.evaluate(el => el.style.height);

      expect(transform).toMatch(/rotate\(.+deg\)/);
      // left/top should be set and include 'px'
      expect(left).toMatch(/px$/);
      expect(top).toMatch(/px$/);
      // height should be set (may be positive/negative string with px)
      expect(height).toMatch(/px$/);

      // Validate numeric bounds for top and left: they should be within or near 0..400 px
      const leftVal = parseFloat(left.replace('px', '')) || 0;
      const topVal = parseFloat(top.replace('px', '')) || 0;
      expect(leftVal).toBeGreaterThanOrEqual(0);
      expect(leftVal).toBeLessThanOrEqual(400);
      expect(topVal).toBeGreaterThanOrEqual(-400); // allow some rotation resulting in negative offsets
      expect(topVal).toBeLessThanOrEqual(800);

      // Ensure no uncaught JS errors happened during training/drawing
      expect(pageErrors.length, 'No uncaught JS errors should occur during training').toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages during training').toBe(0);
    });

    test('multiple clicks append multiple decision boundaries and do not crash', async ({ page }) => {
      const trainButton = page.locator('button[onclick="trainModel()"]');
      await expect(trainButton).toHaveCount(1);

      // Click twice sequentially (simulate user clicking again after training completes)
      await trainButton.click();
      await trainButton.click();

      const scatter = page.locator('#scatterPlot');
      const lines = scatter.locator('.line');

      // trainModel appends a new .line each time it's executed; assert at least 2 lines now
      await expect(lines).toHaveCount(2);

      // The message should still reflect the trained state
      const message = page.locator('#message');
      await expect(message).toHaveText('Model trained.');

      // Ensure no uncaught JS errors occurred during repeated training
      expect(pageErrors.length, 'No uncaught JS errors after repeated training').toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages after repeated training').toBe(0);
    });

    test('fast double-click (edge case) does not produce uncaught errors', async ({ page }) => {
      const trainButton = page.locator('button[onclick="trainModel()"]');
      await expect(trainButton).toHaveCount(1);

      // Simulate fast double click
      await Promise.all([
        trainButton.click(),
        trainButton.click()
      ]);

      // Wait for DOM updates
      const scatter = page.locator('#scatterPlot');
      const lines = scatter.locator('.line');

      // At least one line should exist
      await expect(lines).toHaveCountGreaterThan(0);

      // Ensure no uncaught JS errors occurred during the rapid interactions
      expect(pageErrors.length, 'No uncaught JS errors on fast double click').toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages on fast double click').toBe(0);
    });
  });

  test.describe('FSM Evidence and Observables Verification', () => {
    test('verify FSM evidence: plotData() resulted in points and trainModel() updates message element', async ({ page }) => {
      // Evidence for S0_Idle: plotData() created .point elements
      const scatter = page.locator('#scatterPlot');
      await expect(scatter.locator('.point')).toHaveCount(6);

      // Event trigger exists in DOM
      const trainButton = page.locator('button[onclick="trainModel()"]');
      await expect(trainButton).toHaveCount(1);

      // Trigger the TrainModel event and verify evidence: message text updated
      await trainButton.click();
      const message = page.locator('#message');
      await expect(message).toHaveText('Model trained.');

      // Evidence: drawDecisionBoundary() should create an element with class 'line'
      await expect(scatter.locator('.line')).toHaveCountGreaterThan(0);

      // Final sanity: no uncaught JS errors in the evidence verification step
      expect(pageErrors.length).toBe(0);
    });

    test('check for unexpected runtime exceptions (if any) and surface them', async ({ page }) => {
      // This test intentionally collects runtime errors (pageErrors) and fails if any exist.
      // It follows the requirement to observe console logs and page errors, letting errors occur naturally.
      // If errors occurred, fail the test and display them so they can be investigated.
      expect(Array.isArray(pageErrors)).toBeTruthy();
      if (pageErrors.length > 0) {
        // If there are page errors, surface the first one in the assertion message to aid debugging.
        const messages = pageErrors.map(e => e.message || String(e)).join('\n---\n');
        // Fail explicitly with the collected error messages.
        throw new Error(`Uncaught page errors were observed during test:\n${messages}`);
      }

      // Also ensure no console.error messages were emitted
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      if (consoleErrors.length > 0) {
        const msgs = consoleErrors.map(e => e.text).join('\n---\n');
        throw new Error(`console.error messages were observed during test:\n${msgs}`);
      }
    });
  });
});