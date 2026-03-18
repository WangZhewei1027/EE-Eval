import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a33cdb3-ffc5-11f0-8b43-1ffa87931c43.html';

test.describe('KNN Interactive Demo - FSM validation (Idle, PointAdded, HoverUnknown)', () => {
  // Arrays to capture runtime errors and console errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location()
          });
        }
      } catch (e) {
        // guard - do not interfere with page runtime
      }
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', error => {
      pageErrors.push(String(error));
    });

    // Navigate to the app under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Assert that no runtime/page errors happened during test. The app should run without uncaught exceptions.
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    expect(consoleErrors, 'No console.error messages should have been emitted').toEqual([]);
  });

  // Helper to read a single pixel color from the canvas at element-relative coordinates
  async function getCanvasPixel(page, x, y) {
    return await page.evaluate(({ x, y }) => {
      const canvas = document.getElementById('knnCanvas');
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
      return { r: data[0], g: data[1], b: data[2], a: data[3] };
    }, { x, y });
  }

  // Helper to click on canvas at coordinates (relative to canvas top-left)
  async function clickCanvasAt(page, x, y, options = {}) {
    const canvas = page.locator('#knnCanvas');
    // Playwright page.click supports position relative to element
    await canvas.click({ position: { x, y }, button: options.button || 'left', modifiers: options.modifiers || [] });
    // allow UI redraw to complete
    await page.waitForTimeout(80);
  }

  test('Initial Idle state: controls present, initial draw performed', async ({ page }) => {
    // Validate presence of key controls and initial state evidence (kValue label and info panel empty)
    const kValue = await page.locator('#kValue').textContent();
    expect(kValue.trim()).toBe('3'); // initial k value label

    const infoText = await page.locator('#info').textContent();
    expect(infoText.trim()).toBe(''); // no hover info initially (Idle)

    // Validate canvas exists and top-left corner is white (initial draw but corner should be empty/background)
    const pixel = await getCanvasPixel(page, 5, 5);
    // Expect mostly white background (alpha 255). Allow small tolerance.
    expect(pixel.r).toBeGreaterThanOrEqual(250);
    expect(pixel.g).toBeGreaterThanOrEqual(250);
    expect(pixel.b).toBeGreaterThanOrEqual(250);
    expect(pixel.a).toBeGreaterThan(0);
  });

  test('Adding points (left, right, shift+click) transitions to PointAdded state and draws points', async ({ page }) => {
    // Choose coordinates at top-left corner likely empty to add points without colliding with initial examples
    const posA = { x: 15, y: 15 }; // left click -> Class A
    const posB = { x: 25, y: 25 }; // right click -> Class B
    const posUnknown = { x: 35, y: 35 }; // shift+click -> unknown

    // Ensure initial pixels are background (white)
    const beforeA = await getCanvasPixel(page, posA.x, posA.y);
    expect(beforeA.r).toBeGreaterThanOrEqual(250);

    // Left click to add Class A point
    await clickCanvasAt(page, posA.x, posA.y, { button: 'left' });
    await page.waitForTimeout(100);

    // Pixel at posA should have changed (no longer pure white)
    const afterA = await getCanvasPixel(page, posA.x, posA.y);
    const isAColored = !(afterA.r >= 250 && afterA.g >= 250 && afterA.b >= 250);
    expect(isAColored).toBe(true);

    // Right click to add Class B point
    const beforeB = await getCanvasPixel(page, posB.x, posB.y);
    expect(beforeB.r).toBeGreaterThanOrEqual(250);

    // Use right mouse button
    await clickCanvasAt(page, posB.x, posB.y, { button: 'right' });
    await page.waitForTimeout(100);

    const afterB = await getCanvasPixel(page, posB.x, posB.y);
    const isBColored = !(afterB.r >= 250 && afterB.g >= 250 && afterB.b >= 250);
    expect(isBColored).toBe(true);

    // Shift + left click to add unknown point
    const beforeU = await getCanvasPixel(page, posUnknown.x, posUnknown.y);
    expect(beforeU.r).toBeGreaterThanOrEqual(250);

    await clickCanvasAt(page, posUnknown.x, posUnknown.y, { button: 'left', modifiers: ['Shift'] });
    await page.waitForTimeout(120);

    const afterU = await getCanvasPixel(page, posUnknown.x, posUnknown.y);
    const isUColored = !(afterU.r >= 250 && afterU.g >= 250 && afterU.b >= 250);
    expect(isUColored).toBe(true);

    // The canvas has been redrawn after each addition; verify no console errors emitted during operations (checked in afterEach)
  });

  test('Hovering over unknown point shows hover info (drawHover) and transitions to HoverUnknown', async ({ page }) => {
    // Add a new unknown point at a distinct area
    const unknownPos = { x: 60, y: 60 };
    // Ensure that prior to addition the pixel is background
    const before = await getCanvasPixel(page, unknownPos.x, unknownPos.y);
    expect(before.r).toBeGreaterThanOrEqual(250);

    // Add an unknown point via Shift+click
    await clickCanvasAt(page, unknownPos.x, unknownPos.y, { button: 'left', modifiers: ['Shift'] });
    await page.waitForTimeout(120);

    // Move mouse into the canvas at that point to trigger mousemove and hover behavior
    // Need to compute absolute coordinates; use bounding box
    const canvasBox = await page.locator('#knnCanvas').boundingBox();
    if (!canvasBox) throw new Error('Canvas bounding box not found');

    const absX = canvasBox.x + unknownPos.x;
    const absY = canvasBox.y + unknownPos.y;

    // Move mouse to the unknown point to trigger hover
    await page.mouse.move(absX, absY);
    // Allow hover drawing and info update
    await page.waitForTimeout(150);

    // The info panel should now contain "Hovered Unknown Point"
    const info = await page.locator('#info').innerText();
    expect(info).toContain('Hovered Unknown Point');

    // Also expect predicted class line present in info
    expect(info).toMatch(/Predicted class:/i);
  });

  test('Mouse leave clears hover info (onExit of HoverUnknown -> Idle)', async ({ page }) => {
    // Add an unknown point so we can hover then leave
    const unknownPos = { x: 90, y: 90 };

    await clickCanvasAt(page, unknownPos.x, unknownPos.y, { button: 'left', modifiers: ['Shift'] });
    await page.waitForTimeout(80);

    // Move to the unknown point to produce hover info
    const canvasBox = await page.locator('#knnCanvas').boundingBox();
    if (!canvasBox) throw new Error('Canvas bounding box not found');

    const absX = canvasBox.x + unknownPos.x;
    const absY = canvasBox.y + unknownPos.y;
    await page.mouse.move(absX, absY);
    await page.waitForTimeout(100);

    // Verify hover info present
    let infoText = await page.locator('#info').textContent();
    expect(infoText && infoText.length).toBeGreaterThan(0);

    // Move mouse outside the canvas (mouseleave)
    // Move to coordinates just outside bottom-right of canvas
    await page.mouse.move(canvasBox.x + canvasBox.width + 20, canvasBox.y + canvasBox.height + 20);
    await page.waitForTimeout(120);

    // info should now be cleared
    infoText = await page.locator('#info').textContent();
    expect(infoText.trim()).toBe('');
  });

  test('Adjusting k (range input) triggers redraw and enforces odd k (KRangeInput event)', async ({ page }) => {
    // Programmatically set kRange to an even value (4) and dispatch input.
    // The application should adjust it to an odd number and update the kValue label.
    await page.evaluate(() => {
      const r = document.getElementById('kRange');
      r.value = '4';
      r.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // allow input handler to run
    await page.waitForTimeout(120);

    // Read back displayed kValue and the kRange value
    const kValueText = await page.locator('#kValue').textContent();
    const kRangeValue = await page.evaluate(() => document.getElementById('kRange').value);

    // kRangeValue and kValueText should represent an odd number (app logic ensures oddness)
    const kNum = parseInt(kRangeValue, 10);
    const kLabelNum = parseInt((kValueText || '').trim(), 10);
    expect(Number.isInteger(kNum)).toBe(true);
    expect(kNum % 2).toBe(1); // odd
    expect(kNum).toBe(kLabelNum);

    // Changing k triggers redraw; verify canvas still contains non-background pixels (still drawn)
    const samplePixel = await getCanvasPixel(page, 100, 100);
    // We do not assert a very specific color, only that drawing remains functional.
    expect(samplePixel.a).toBeGreaterThan(0);
  });

  test('Clear button resets all points and redraws (ClearPoints event)', async ({ page }) => {
    // Add a point in a corner, verify colored, then clear and verify returned to background
    const testPos = { x: 45, y: 45 };
    // Add a class A point
    await clickCanvasAt(page, testPos.x, testPos.y, { button: 'left' });
    await page.waitForTimeout(120);

    // Confirm pixel changed
    const colored = await getCanvasPixel(page, testPos.x, testPos.y);
    expect(!(colored.r >= 250 && colored.g >= 250 && colored.b >= 250)).toBe(true);

    // Click clear button
    await page.click('#clear-btn');
    await page.waitForTimeout(150);

    // Pixel at testPos should be background (white) after clearing
    const afterClear = await getCanvasPixel(page, testPos.x, testPos.y);
    expect(afterClear.r).toBeGreaterThanOrEqual(250);
    expect(afterClear.g).toBeGreaterThanOrEqual(250);
    expect(afterClear.b).toBeGreaterThanOrEqual(250);

    // And info panel should be cleared as well
    const infoText = await page.locator('#info').textContent();
    expect(infoText.trim()).toBe('');
  });

  test('Edge case: moving mouse over blank area does not produce hover info', async ({ page }) => {
    // Move to blank area likely far from points
    const canvasBox = await page.locator('#knnCanvas').boundingBox();
    if (!canvasBox) throw new Error('Canvas bounding box not found');

    const absX = canvasBox.x + 5;
    const absY = canvasBox.y + canvasBox.height - 5;

    await page.mouse.move(absX, absY);
    await page.waitForTimeout(120);

    // There should be no hover info
    const info = await page.locator('#info').textContent();
    expect(info.trim()).toBe('');
  });
});