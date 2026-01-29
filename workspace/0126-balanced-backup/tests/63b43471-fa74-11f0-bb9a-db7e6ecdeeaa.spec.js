import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b43471-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Helper to click on canvas at element-relative pixel coordinates
async function clickCanvasAt(page, offsetX, offsetY) {
  const canvas = page.locator('#canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas bounding box not available');
  const clickX = Math.max(1, Math.min(box.width - 1, offsetX));
  const clickY = Math.max(1, Math.min(box.height - 1, offsetY));
  await page.mouse.click(box.x + clickX, box.y + clickY);
}

test.describe('Linear Regression Demo (FSM) - 63b43471-fa74-11f0-bb9a-db7e6ecdeeaa', () => {
  // Containers for console and error messages observed during each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In rare cases msg.type() can throw; still record raw text
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application HTML served by the given server
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure the main components are present before any test runs
    await expect(page.locator('#canvas')).toHaveCount(1);
    await expect(page.locator('#resetBtn')).toHaveCount(1);
    await expect(page.locator('#randomBtn')).toHaveCount(1);
    await expect(page.locator('#slope')).toHaveCount(1);
    await expect(page.locator('#intercept')).toHaveCount(1);
    await expect(page.locator('#r2')).toHaveCount(1);
  });

  test.afterEach(async () => {
    // After each test, assert there were no uncaught page errors
    // and no console messages of type 'error'. We allow other console types.
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length, 'No uncaught page errors should have happened').toBe(0);
    expect(errorConsole.length, 'No console.error messages expected').toBe(0);
  });

  test('Initial state S0_Idle: page renders and initial equation/r2 are zeros', async ({ page }) => {
    // Verify entry action renderPage() effect: the UI elements are present and initial redraw() set text to zeros
    const slope = page.locator('#slope');
    const intercept = page.locator('#intercept');
    const r2 = page.locator('#r2');

    await expect(slope).toHaveText('0');
    await expect(intercept).toHaveText('0');
    await expect(r2).toHaveText('0');

    // The canvas element should have width/height attributes as declared
    const canvasHandle = await page.$('#canvas');
    const widthAttr = await canvasHandle.getAttribute('width');
    const heightAttr = await canvasHandle.getAttribute('height');
    expect(widthAttr).toBe('600');
    expect(heightAttr).toBe('400');
  });

  test('S0 -> S1: Click canvas to add points and state transitions to Point Added (S1_PointAdded)', async ({ page }) => {
    // This test simulates adding two distinct points on the canvas, expecting regression computed and UI updated.
    // Click first point (single point -> regression unavailable, remains zero)
    await clickCanvasAt(page, 100, 100);
    // After one point regression remains unavailable
    await expect(page.locator('#slope')).toHaveText('0');
    await expect(page.locator('#intercept')).toHaveText('0');
    await expect(page.locator('#r2')).toHaveText('0');

    // Click a second distinct point to allow regression calculation (should update slope/intercept/r2)
    await clickCanvasAt(page, 300, 250);

    // Wait until slope or r2 changes from '0' (regression calculated)
    await page.waitForFunction(() => {
      const s = document.getElementById('slope').textContent;
      const r = document.getElementById('r2').textContent;
      return s !== '0' || r !== '0';
    });

    const slopeText = await page.locator('#slope').textContent();
    const interceptText = await page.locator('#intercept').textContent();
    const r2Text = await page.locator('#r2').textContent();

    // slope/intercept/r2 should now be numeric strings (not the default '0')
    expect(slopeText).not.toBeNull();
    expect(r2Text).not.toBeNull();
    expect(slopeText.trim()).not.toBe('0');
    // r2 should be a parsable number between 0 and 1 inclusive (floating rounding possible)
    const r2Val = parseFloat(r2Text);
    expect(Number.isFinite(r2Val)).toBe(true);
    expect(r2Val >= -1 && r2Val <= 1).toBe(true); // allow small negative numerical artifacts in degenerate cases
  });

  test('S1 (PointAdded) -> S1 (PointAdded): Multiple clicks add more points and redraw updates equation', async ({ page }) => {
    // Add three distinct points and assert slope/intercept/r2 update again appropriately
    await clickCanvasAt(page, 80, 120);
    await clickCanvasAt(page, 220, 160);
    await clickCanvasAt(page, 420, 60);

    // Wait for a non-default slope or r2
    await page.waitForFunction(() => {
      return document.getElementById('slope').textContent !== '0' ||
             document.getElementById('r2').textContent !== '0';
    });

    const slopeText = await page.locator('#slope').textContent();
    const r2Text = await page.locator('#r2').textContent();

    expect(slopeText.trim()).not.toBe('0');
    const r2Val = parseFloat(r2Text);
    expect(Number.isFinite(r2Val)).toBe(true);
  });

  test('ResetPoints transitions to S2_PointsReset and clears points (entry action redraw())', async ({ page }) => {
    // Add some points first
    await clickCanvasAt(page, 120, 80);
    await clickCanvasAt(page, 240, 200);

    // Ensure regression computed
    await page.waitForFunction(() => document.getElementById('r2').textContent !== '0' || document.getElementById('slope').textContent !== '0');

    // Click Reset button
    await page.click('#resetBtn');

    // After reset redraw(), spans should revert to default zeros
    await expect(page.locator('#slope')).toHaveText('0');
    await expect(page.locator('#intercept')).toHaveText('0');
    await expect(page.locator('#r2')).toHaveText('0');
  });

  test('GenerateRandomPoints transitions to S3_RandomPointsGenerated and updates canvas & equation', async ({ page }) => {
    // Click the random button to generate ~20 points
    await page.click('#randomBtn');

    // Wait until either slope or r2 changes from default '0'
    await page.waitForFunction(() => {
      const s = document.getElementById('slope').textContent;
      const r = document.getElementById('r2').textContent;
      return s !== '0' || r !== '0';
    });

    const slopeText = await page.locator('#slope').textContent();
    const r2Text = await page.locator('#r2').textContent();

    // After random generation it's very likely slope and/or r2 are non-zero numeric values
    expect(slopeText.trim().length).toBeGreaterThan(0);
    expect(Number.isFinite(parseFloat(slopeText))).toBe(true);
    expect(Number.isFinite(parseFloat(r2Text))).toBe(true);
  });

  test('Edge case: identical x-values (vertical alignment) leads to denominator zero and regression null -> UI stays at zeros', async ({ page }) => {
    // Click twice at the same canvas X (same px) but different Y positions to create identical data x values
    // Choose an X offset around center
    const xOffset = 250;
    await clickCanvasAt(page, xOffset, 100);
    await clickCanvasAt(page, xOffset, 200);

    // When variance(x) === 0 the implementation returns null and UI should show default zeros
    // Wait a short while to allow handlers to run
    await page.waitForTimeout(100);

    // The application sets slope/intercept/r2 to '0' when regression is null
    await expect(page.locator('#slope')).toHaveText('0');
    await expect(page.locator('#intercept')).toHaveText('0');
    await expect(page.locator('#r2')).toHaveText('0');
  });

  test('Edge case: clicking canvas outside effective data range is ignored (no change)', async ({ page }) => {
    // The implementation clamps data to [0,10] and ignores clicks that map outside range.
    // We simulate clicking exactly on the canvas edges; these should still map to valid data.
    // To test ignored clicks we attempt to click at coordinates outside the canvas - expect no effect.
    // Use page.mouse to click outside element bounds intentionally.
    const canvasBox = await page.locator('#canvas').boundingBox();
    if (!canvasBox) throw new Error('Canvas box not found for edge-case test');

    // Record current state
    const beforeSlope = await page.locator('#slope').textContent();
    const beforeR2 = await page.locator('#r2').textContent();

    // Click far outside the canvas (should not trigger canvas click handlers)
    await page.mouse.click(canvasBox.x + canvasBox.width + 50, canvasBox.y + canvasBox.height + 50);
    await page.waitForTimeout(100); // allow any unexpected handlers to run

    const afterSlope = await page.locator('#slope').textContent();
    const afterR2 = await page.locator('#r2').textContent();

    // No change expected as click was outside canvas
    expect(afterSlope).toBe(beforeSlope);
    expect(afterR2).toBe(beforeR2);
  });

  test('Observability: ensure no unexpected ReferenceError/SyntaxError/TypeError occurred in console', async ({ page }) => {
    // This test explicitly checks captured console and pageerror arrays for fatal JS errors.
    // pageErrors contains uncaught exceptions; consoleMessages contains console.error entries as well.
    const errorConsole = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    // Fail if any uncaught page errors exist
    expect(pageErrors.length, `No uncaught page errors expected; found: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    // Fail if any console.error messages are present
    expect(errorConsole.length, `No console.error messages expected; found: ${errorConsole.join(' | ')}`).toBe(0);
  });
});