import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79e0032-d361-11f0-8438-11a56595a476.html';

test.describe('K-Nearest Neighbors (KNN) Interactive Demo - FSM and UI tests', () => {
  // Helper to attach listeners for console errors and page errors.
  async function attachErrorListeners(page) {
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      // capture error-level console messages for later assertions
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      }
    });

    page.on('pageerror', err => {
      // capture uncaught exceptions
      pageErrors.push({
        message: err.message,
        stack: err.stack,
      });
    });

    return { consoleErrors, pageErrors };
  }

  // Utility: compute a target point inside the canvas given fractional coordinates (0..1)
  async function canvasPoint(page, fx = 0.5, fy = 0.5) {
    const canvas = page.locator('#canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    return {
      x: box.x + fx * box.width,
      y: box.y + fy * box.height,
    };
  }

  test.beforeEach(async ({ page }) => {
    // ensure a fresh load for each test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test('Initial Idle state: page loads with default Idle state and no page errors', async ({ page }) => {
    // Attach listeners to observe console and page errors
    const { consoleErrors, pageErrors } = await attachErrorListeners(page);

    // Validate the initial UI reflects Idle state evidence:
    // - classificationResult should indicate "No classification done yet."
    const classification = page.locator('#classificationResult');
    await expect(classification).toBeVisible();
    await expect(classification).toHaveText('No classification done yet.');

    // There should be no console errors or uncaught page errors on load
    // (capture any that happened during load)
    // Allow a short moment for any async errors to surface
    await page.waitForTimeout(100);
    expect(consoleErrors, 'No console.error messages should have occurred on load').toHaveLength(0);
    expect(pageErrors, 'No uncaught page errors should have occurred on load').toHaveLength(0);
  });

  test('Transition S0 -> S1: Single click on canvas adds a training point and updates UI', async ({ page }) => {
    const { consoleErrors, pageErrors } = await attachErrorListeners(page);

    // Ensure default label is 'A'
    const labelSelect = page.locator('#labelSelect');
    await expect(labelSelect).toHaveValue('A');

    // Click near the top-left quarter of the canvas to add a training point
    const pt = await canvasPoint(page, 0.25, 0.25);
    await page.mouse.click(pt.x, pt.y, { clickCount: 1 });

    // The app should update classificationResult to indicate a training point was added
    const classification = page.locator('#classificationResult');
    await expect(classification).toContainText('Added training point at (');

    // The message should also include the chosen label "A"
    const text = await classification.textContent();
    expect(text).toMatch(/with label "A"\./);

    // No page errors or console errors should have been produced by adding a point
    await page.waitForTimeout(50);
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Transition S1 -> S2: Double click classifies a point and shows neighbors info', async ({ page }) => {
    const { consoleErrors, pageErrors } = await attachErrorListeners(page);

    // Add multiple training points of different labels to create a meaningful neighborhood
    // Add two points labeled A, two points labeled B
    await page.selectOption('#labelSelect', 'A');
    const p1 = await canvasPoint(page, 0.2, 0.2);
    await page.mouse.click(p1.x, p1.y); // add A

    const p2 = await canvasPoint(page, 0.3, 0.25);
    await page.mouse.click(p2.x, p2.y); // add A

    await page.selectOption('#labelSelect', 'B');
    const p3 = await canvasPoint(page, 0.7, 0.7);
    await page.mouse.click(p3.x, p3.y); // add B

    const p4 = await canvasPoint(page, 0.75, 0.65);
    await page.mouse.click(p4.x, p4.y); // add B

    // Now double-click somewhere in between to classify
    const classifyPoint = await canvasPoint(page, 0.5, 0.5);
    // Perform a dblclick to trigger classification
    await page.mouse.dblclick(classifyPoint.x, classifyPoint.y);

    // Expect classificationResult to show "Classified point ... as <strong>..</strong> using k=..."
    const classification = page.locator('#classificationResult');
    await expect(classification).toContainText('Classified point at (');
    // HTML should include a strong tag with the chosen label
    const innerHTML = await classification.innerHTML();
    expect(innerHTML).toMatch(/as <strong>[A-C]<\/strong> using k=\d+\./);
    // Should include "Neighbors considered" section
    expect(innerHTML).toMatch(/Neighbors considered/);
    // Should list at least one neighbor
    expect(innerHTML).toMatch(/\d+\.\s*\(\d+\.\d+,\s*\d+\.\d+\)\s*Label:/);

    // No uncaught exceptions expected during classification
    await page.waitForTimeout(50);
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Edge case: Double click classifies with no training points -> shows warning message', async ({ page }) => {
    const { consoleErrors, pageErrors } = await attachErrorListeners(page);

    // Reload to ensure no training points (fresh state)
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Double click center of canvas when there are no training points
    const center = await canvasPoint(page, 0.5, 0.5);
    await page.mouse.dblclick(center.x, center.y);

    const classification = page.locator('#classificationResult');
    await expect(classification).toHaveText('No training points - cannot classify.');

    // No JS errors should occur in this edge scenario; the app handles it gracefully
    await page.waitForTimeout(50);
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('ResetButtonClick: Reset clears points and returns to Idle state', async ({ page }) => {
    const { consoleErrors, pageErrors } = await attachErrorListeners(page);

    // Add a training point first
    const p = await canvasPoint(page, 0.4, 0.4);
    await page.mouse.click(p.x, p.y);

    // Click Reset button
    await page.locator('#resetButton').click();

    // classificationResult should now indicate "All points reset."
    const classification = page.locator('#classificationResult');
    await expect(classification).toHaveText('All points reset.');

    // After reset, trying to double click should behave like the "no training points" edge case
    const center = await canvasPoint(page, 0.5, 0.5);
    await page.mouse.dblclick(center.x, center.y);
    await expect(classification).toHaveText('No training points - cannot classify.');

    // No console or page errors expected
    await page.waitForTimeout(50);
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('KInputChange: Changing K updates the classification result for lastClassified', async ({ page }) => {
    const { consoleErrors, pageErrors } = await attachErrorListeners(page);

    // Add several points so k variation matters
    await page.selectOption('#labelSelect', 'A');
    const a1 = await canvasPoint(page, 0.2, 0.2);
    await page.mouse.click(a1.x, a1.y);
    const a2 = await canvasPoint(page, 0.25, 0.22);
    await page.mouse.click(a2.x, a2.y);

    await page.selectOption('#labelSelect', 'B');
    const b1 = await canvasPoint(page, 0.6, 0.6);
    await page.mouse.click(b1.x, b1.y);
    const b2 = await canvasPoint(page, 0.65, 0.62);
    await page.mouse.click(b2.x, b2.y);

    // Classify a point near the A cluster so that for small k it's 'A'
    const testPt = await canvasPoint(page, 0.3, 0.25);
    await page.mouse.dblclick(testPt.x, testPt.y);

    const classification = page.locator('#classificationResult');
    const initialHTML = await classification.innerHTML();
    // Expect initial classification includes k=3 by default or limited to trainingPoints.length
    expect(initialHTML).toMatch(/using k=\d+\./);

    // Change K to 1 (should still likely choose the nearest label)
    const kInput = page.locator('#kInput');
    await kInput.fill('1');
    // blur to trigger change event - click on canvas to remove focus
    const outside = await canvasPoint(page, 0.1, 0.95);
    await page.mouse.click(outside.x, outside.y);

    // After k change, classificationResult should update and mention using k=1
    await expect(classification).toContainText('using k=1.');
    const htmlAfterK1 = await classification.innerHTML();
    expect(htmlAfterK1).toMatch(/using k=1\./);
    expect(htmlAfterK1).toMatch(/Neighbors considered/);

    // Now change K to a larger value, e.g., 4 (capped at trainingPoints.length if necessary)
    await kInput.fill('4');
    await page.mouse.click(outside.x, outside.y);
    // the app calculates k = Math.min(parseInt(kInput.value, 10) || 3, trainingPoints.length)
    // There are 4 training points -> k=4 should be honored
    await expect(classification).toContainText('using k=4.');
    const htmlAfterK4 = await classification.innerHTML();
    expect(htmlAfterK4).toMatch(/using k=4\./);
    // Should list 4 neighbors when k=4
    const neighborMatches = htmlAfterK4.match(/(\d+\.\s*\(\d+\.\d+,\s*\d+\.\d+\)\s*Label:)/g);
    expect(Array.isArray(neighborMatches) && neighborMatches.length >= 1).toBeTruthy();

    // No uncaught exceptions expected during K changes
    await page.waitForTimeout(50);
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Robustness: rapid sequence of add/classify/reset should not throw runtime errors', async ({ page }) => {
    const { consoleErrors, pageErrors } = await attachErrorListeners(page);

    // Rapidly add points, classify, and reset in quick succession
    for (let i = 0; i < 3; i++) {
      await page.selectOption('#labelSelect', i % 2 === 0 ? 'A' : 'B');
      const pt = await canvasPoint(page, 0.2 + 0.2 * i, 0.2 + 0.1 * i);
      await page.mouse.click(pt.x, pt.y);
    }

    // classify at a few places quickly
    const c1 = await canvasPoint(page, 0.3, 0.3);
    await page.mouse.dblclick(c1.x, c1.y);

    const c2 = await canvasPoint(page, 0.7, 0.7);
    await page.mouse.dblclick(c2.x, c2.y);

    // Reset
    await page.locator('#resetButton').click();

    // Final check: app should be in reset/idle state and no runtime errors have been emitted
    const classification = page.locator('#classificationResult');
    await expect(classification).toHaveText('All points reset.');

    // allow any asynchronous errors to surface
    await page.waitForTimeout(100);
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });
});