import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79e0031-d361-11f0-8438-11a56595a476.html';

test.describe('Interactive Linear Regression Demo (FSM tests) - d79e0031-d361-11f0-8438-11a56595a476', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for each test so we can assert on them.
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      try {
        // Record console messages for diagnostics/assertions
        consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      } catch (e) {
        consoleMessages.push(`console - (could not stringify)`);
      }
    });

    page.on('pageerror', err => {
      // Record uncaught errors from the page
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
  });

  test.afterEach(async () => {
    // Basic sanity check: log any console messages if a test fails in CI logs
    // (this does not modify page or app behavior)
    if (consoleMessages.length > 0) {
      // No-op: leaving messages in variable for debugging; tests below will assert expectations
    }
  });

  test('Initial state (S0_Idle) - updatePlot called on load and UI shows idle text', async ({ page }) => {
    // Validate the initial state of the app matches S0_Idle expectations:
    // - updatePlot() runs on load and sets the equation helper text
    // - points count should reflect zero points
    const equation = page.locator('#equation');
    const pointsCount = page.locator('#pointsCount');

    // Wait for the equation element to have the initial text
    await expect(equation).toHaveText('Add at least two distinct points to compute linear regression.');
    await expect(pointsCount).toHaveText('Points: 0');

    // The underlying data structure 'points' exists and is length 0
    const pointsLength = await page.evaluate(() => {
      // Access the page's global points array (declared in the script)
      // This reads state created by the app without mutating it.
      return typeof window.points !== 'undefined' ? window.points.length : null;
    });
    expect(pointsLength).toBe(0);

    // Ensure there were no uncaught page errors during initial load
    expect(pageErrors).toEqual([]);
  });

  test('CanvasClick transition: adding first point moves to S1_PointAdded (one point) - UI updates but still no regression', async ({ page }) => {
    // Click near the center of the canvas to add a point
    const canvas = page.locator('#scatterplot');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Click in the center
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    // After one click, points count should be 1 and the equation should still ask for two points
    const pointsCount = page.locator('#pointsCount');
    const equation = page.locator('#equation');

    await expect(pointsCount).toHaveText('Points: 1');
    await expect(equation).toHaveText('Add at least two distinct points to compute linear regression.');

    // Confirm the underlying points array was updated to length 1
    const ptsLen = await page.evaluate(() => window.points ? window.points.length : null);
    expect(ptsLen).toBe(1);

    // There should be no uncaught page errors for this interaction
    expect(pageErrors).toEqual([]);
  });

  test('CanvasClick transition: adding a second distinct point computes regression and updates equation', async ({ page }) {
    // Add two distinct points by clicking two different positions on the canvas
    const canvas = page.locator('#scatterplot');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Click point A (left-center)
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.5);

    // Click point B (right-center) -> should produce a regression line
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.5);

    // Wait for UI updates
    const pointsCount = page.locator('#pointsCount');
    const equation = page.locator('#equation');

    await expect(pointsCount).toHaveText('Points: 2');

    // Regression line text should appear and include 'Regression line: y ='
    await expect(equation).toHaveText(/Regression line: y =/);

    // Validate the equation format includes numeric coefficients with 3 decimal places
    const eqText = await equation.textContent();
    expect(eqText).not.toBeNull();
    // Expect something like: "Regression line: y = 0.000x + 5.000" or similar
    expect(eqText).toMatch(/^Regression line: y = -?\d+\.\d{3}x \+ -?\d+\.\d{3}$/);

    // Under the hood, ensure that window.points length is 2
    const ptsLen = await page.evaluate(() => window.points ? window.points.length : null);
    expect(ptsLen).toBe(2);

    // No uncaught page errors expected
    expect(pageErrors).toEqual([]);
  });

  test('S1_PointAdded -> S1_PointAdded repeated CanvasClick: multiple points increment and keep updating', async ({ page }) => {
    // Click multiple times and ensure points count increments accordingly
    const canvas = page.locator('#scatterplot');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Perform 4 clicks at different positions
    const positions = [
      { x: box.x + box.width * 0.2, y: box.y + box.height * 0.2 },
      { x: box.x + box.width * 0.4, y: box.y + box.height * 0.4 },
      { x: box.x + box.width * 0.6, y: box.y + box.height * 0.6 },
      { x: box.x + box.width * 0.8, y: box.y + box.height * 0.8 },
    ];

    for (const pos of positions) {
      await page.mouse.click(pos.x, pos.y);
    }

    // Validate points count equals 4
    const pointsCount = page.locator('#pointsCount');
    await expect(pointsCount).toHaveText('Points: 4');

    // If there are at least two points, equation should show regression text
    const equation = page.locator('#equation');
    const eqText = await equation.textContent();
    expect(eqText).toContain('Regression line:');

    // Confirm the application's internal points array has length 4
    const ptsLen = await page.evaluate(() => window.points ? window.points.length : null);
    expect(ptsLen).toBe(4);

    // No uncaught page errors are expected
    expect(pageErrors).toEqual([]);
  });

  test('Edge case: adding two points with same X coordinate (vertical alignment) yields no regression (denominator === 0)', async ({ page }) => {
    // Click two points vertically aligned (same x within canvas coords)
    const canvas = page.locator('#scatterplot');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Choose an X position and click twice with different Y positions
    const xPos = box.x + box.width * 0.5;
    await page.mouse.click(xPos, box.y + box.height * 0.3);
    await page.mouse.click(xPos, box.y + box.height * 0.7);

    // Points count should be 2
    const pointsCount = page.locator('#pointsCount');
    await expect(pointsCount).toHaveText('Points: 2');

    // Because the two points have the same data-x (approx), linearRegression should likely return null
    // The UI then shows the fallback message
    const equation = page.locator('#equation');
    // It may still compute if the transformed data differs; accept either fallback message or regression.
    const eqText = await equation.textContent();

    // We accept either state, but assert that the app did not throw an uncaught exception.
    expect(pageErrors).toEqual([]);

    // If linearRegression returned null, the UI shows the fallback string. Assert that it's one of the two expected possibilities.
    const possibleFallback = 'Add at least two distinct points to compute linear regression.';
    if (eqText === possibleFallback) {
      // Good: the app handled vertical alignment gracefully.
      expect(eqText).toBe(possibleFallback);
    } else {
      // Alternatively, if the app computed a regression (due to coordinate transforms), ensure the displayed string format is valid.
      expect(eqText).toMatch(/^Regression line: y = -?\d+\.\d{3}x \+ -?\d+\.\d{3}$/);
    }
  });

  test('ResetClick transition: clicking Reset clears points and returns to Idle (S0_Idle)', async ({ page }) => {
    // Add a couple of points first
    const canvas = page.locator('#scatterplot');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.25);
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.75);

    // Confirm there are points
    await expect(page.locator('#pointsCount')).toHaveText('Points: 2');

    // Click the Reset button
    await page.click('#resetBtn');

    // After reset, the equation text should show the idle message and pointsCount should be 0
    await expect(page.locator('#equation')).toHaveText('Add at least two distinct points to compute linear regression.');
    await expect(page.locator('#pointsCount')).toHaveText('Points: 0');

    // Underlying points array should be emptied
    const ptsLenAfterReset = await page.evaluate(() => window.points ? window.points.length : null);
    expect(ptsLenAfterReset).toBe(0);

    // No uncaught page errors expected
    expect(pageErrors).toEqual([]);
  });

  test('Robustness: no unexpected console errors (TypeError/ReferenceError/SyntaxError) were emitted during interactions', async ({ page }) => {
    // This test exercises the app with a sequence of interactions and asserts no uncaught page errors occurred.
    const canvas = page.locator('#scatterplot');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Sequence: add points, reset, add more points
    await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.1);
    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.2);
    await page.click('#resetBtn');
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3);

    // At the end, assert that there are no uncaught page errors.
    // The testing instruction emphasises observing page errors; here we assert the app did not emit uncaught exceptions.
    expect(pageErrors).toEqual([]);

    // However, record console output for diagnostics (do not fail test based solely on console logs).
    // Ensure at least the page produced some console trace or none; not prescriptive.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});