import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a33cdb2-ffc5-11f0-8b43-1ffa87931c43.html';

test.describe('Linear Regression Demo (FSM: Idle <-> PointsAdded) - 5a33cdb2-ffc5-11f0-8b43-1ffa87931c43', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let consoleLogs = [];

  test.beforeEach(async ({ page }) => {
    // Clear collectors
    pageErrors = [];
    consoleErrors = [];
    consoleLogs = [];

    // Collect page errors and console messages
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleLogs.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    // Navigate to the application and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure the initial synchronous draw() call in the script had a chance to run
    await page.waitForTimeout(100);
  });

  test.afterEach(async ({ page }) => {
    // Verify there were no uncaught page errors during the test steps
    // (we assert zero unexpected page errors / console.error messages)
    expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console.error messages: ${consoleErrors.join(' | ')}`).toHaveLength(0);

    // Close the page to ensure clean state for next test
    await page.close();
  });

  test('Initial state S0_Idle: canvas and UI initialized, formula shows prompt', async ({ page }) => {
    // Validate presence of canvas and reset button and formula div
    const canvas = page.locator('#canvas');
    const resetBtn = page.locator('#resetButton');
    const formula = page.locator('#formula');

    // Canvas should be visible and have correct attributes
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('width', '600');
    await expect(canvas).toHaveAttribute('height', '400');

    // Reset button visible with correct text
    await expect(resetBtn).toBeVisible();
    await expect(resetBtn).toHaveText('Reset Points');

    // On initial load (Idle state) the app should display the prompt to add points
    await expect(formula).toHaveText('Add at least two distinct points to compute linear regression.');
  });

  test('ClickCanvas: single click transitions Idle -> PointsAdded (one point added, still insufficient)', async ({ page }) => {
    // This test validates that a click inside the plotting area adds a point,
    // but with only one point the regression is not computed.
    const canvas = page.locator('#canvas');
    const formula = page.locator('#formula');

    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');

    // Click inside plotting area: choose a point well within margins (margin = 40)
    const offsetX = 200;
    const offsetY = 200;
    await canvas.click({ position: { x: offsetX, y: offsetY } });

    // Allow drawing to complete
    await page.waitForTimeout(100);

    // With only one point, regression cannot be computed
    await expect(formula).toHaveText('Add at least two distinct points to compute linear regression.');
  });

  test('ClickCanvas twice: PointsAdded -> PointsAdded (two distinct points produce regression line)', async ({ page }) => {
    // This test validates repeated ClickCanvas transitions within S1_PointsAdded:
    // adding a second, distinct-x point computes a regression line and updates formula text.
    const canvas = page.locator('#canvas');
    const formula = page.locator('#formula');

    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');

    // First click
    await canvas.click({ position: { x: 180, y: 220 } });
    await page.waitForTimeout(80);

    // Second click at a different x to ensure denominator != 0
    await canvas.click({ position: { x: 420, y: 260 } });
    await page.waitForTimeout(150);

    // After two distinct points, formula should show computed regression line
    const txt = await formula.textContent();
    expect(txt).not.toBeNull();
    // Expect text to start with 'Regression line: y = ' and contain 'x'
    expect(txt).toMatch(/^Regression line: y = .*x/);
  });

  test('ResetPoints: clicking reset clears points and returns to Idle state', async ({ page }) => {
    // Add two points first to ensure we're in PointsAdded
    const canvas = page.locator('#canvas');
    const resetBtn = page.locator('#resetButton');
    const formula = page.locator('#formula');

    await canvas.click({ position: { x: 170, y: 210 } });
    await page.waitForTimeout(60);
    await canvas.click({ position: { x: 430, y: 210 } });
    await page.waitForTimeout(120);

    // Sanity: regression computed
    await expect(formula).toMatchText(/Regression line: y = .*x/);

    // Click reset to clear points
    await resetBtn.click();
    await page.waitForTimeout(100);

    // After reset, formula should be back to the Idle prompt
    await expect(formula).toHaveText('Add at least two distinct points to compute linear regression.');
  });

  test('Edge case: clicking outside plotting margin does not add a point', async ({ page }) => {
    // This test validates that clicks inside the canvas but within the margin are ignored.
    // Use position near top-left corner of canvas which is within margin (margin=40)
    const canvas = page.locator('#canvas');
    const formula = page.locator('#formula');

    // Ensure starting from Idle state
    await page.locator('#resetButton').click();
    await page.waitForTimeout(80);
    await expect(formula).toHaveText('Add at least two distinct points to compute linear regression.');

    // Click inside the margin (should be ignored)
    await canvas.click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(80);

    // Still Idle prompt (no points added)
    await expect(formula).toHaveText('Add at least two distinct points to compute linear regression.');

    // Click near the bottom-right margin (should also be ignored)
    await canvas.click({ position: { x: 590, y: 390 } });
    await page.waitForTimeout(80);
    await expect(formula).toHaveText('Add at least two distinct points to compute linear regression.');
  });

  test('Edge case: two points with identical x produce no regression (denominator zero)', async ({ page }) => {
    // This test validates the denominator==0 handling in linearRegression() when all x are identical.
    const canvas = page.locator('#canvas');
    const formula = page.locator('#formula');

    // Ensure starting fresh
    await page.locator('#resetButton').click();
    await page.waitForTimeout(80);
    await expect(formula).toHaveText('Add at least two distinct points to compute linear regression.');

    // Pick a fixed canvas X that is inside plotting area but not on the margin
    const fixedOffsetX = 300;

    // Click twice at exactly the same canvas x but different y
    await canvas.click({ position: { x: fixedOffsetX, y: 150 } });
    await page.waitForTimeout(80);
    await canvas.click({ position: { x: fixedOffsetX, y: 300 } });
    await page.waitForTimeout(150);

    // Because both points have identical data x, denominator becomes zero -> no regression
    await expect(formula).toHaveText('Add at least two distinct points to compute linear regression.');
  });

  test('Observe console logs and errors during comprehensive interaction sequence', async ({ page }) => {
    // This test performs a longer sequence of interactions and asserts there are no uncaught errors.
    const canvas = page.locator('#canvas');
    const resetBtn = page.locator('#resetButton');
    const formula = page.locator('#formula');

    // Sequence: add three points (distinct), verify regression, reset, attempt invalid clicks
    await canvas.click({ position: { x: 160, y: 240 } });
    await page.waitForTimeout(60);
    await canvas.click({ position: { x: 260, y: 190 } });
    await page.waitForTimeout(60);
    await canvas.click({ position: { x: 420, y: 230 } });
    await page.waitForTimeout(160);

    // After three points, formula should show regression line
    await expect(formula).toMatchText(/Regression line: y = .*x/);

    // Reset and ensure no errors thrown in process
    await resetBtn.click();
    await page.waitForTimeout(120);
    await expect(formula).toHaveText('Add at least two distinct points to compute linear regression.');

    // Review collected console logs (non-error) for informational purposes
    // Ensure we captured some console activity (could be zero depending on app)
    // We assert no console.error and no page errors (this is enforced in afterEach),
    // but we still check that our collectors are functional:
    expect(Array.isArray(consoleLogs)).toBeTruthy();
  });
});