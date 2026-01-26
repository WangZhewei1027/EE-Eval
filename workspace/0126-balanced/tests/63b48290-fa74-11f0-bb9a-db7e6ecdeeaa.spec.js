import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b48290-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for interacting with the KNN visualization page
class KNNPage {
  constructor(page) {
    this.page = page;
    this.canvasSelector = '#canvas';
    this.kInputSelector = '#kInput';
    this.clearBtnSelector = '#clearBtn';
    this.randomBtnSelector = '#randomBtn';
  }

  // Wait for the app to be ready (canvas present)
  async waitForReady() {
    await this.page.waitForSelector(this.canvasSelector);
    await this.page.waitForSelector(this.kInputSelector);
    await this.page.waitForSelector(this.clearBtnSelector);
    await this.page.waitForSelector(this.randomBtnSelector);
  }

  // Get the document title
  async title() {
    return this.page.title();
  }

  // Get the K input value as number
  async getKValue() {
    const val = await this.page.$eval(this.kInputSelector, el => el.value);
    return Number(val);
  }

  // Set K input value (simulate user input)
  async setKValue(val) {
    const input = await this.page.$(this.kInputSelector);
    await input.fill(String(val));
    // trigger input event if needed by blurring/focusing
    await input.press('Tab');
  }

  // Click canvas at coordinates relative to top-left of the canvas
  async clickCanvasAt(x, y, options = {}) {
    const canvas = await this.page.$(this.canvasSelector);
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not found');
    const clickX = box.x + x;
    const clickY = box.y + y;
    await this.page.mouse.click(clickX, clickY, options);
  }

  // Move mouse to canvas-relative coordinates
  async moveMouseTo(x, y) {
    const canvas = await this.page.$(this.canvasSelector);
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not found');
    const moveX = box.x + x;
    const moveY = box.y + y;
    await this.page.mouse.move(moveX, moveY);
  }

  // Move mouse outside canvas to trigger mouseleave
  async moveMouseOutside() {
    // Move to top-left of page (likely outside)
    await this.page.mouse.move(0, 0);
  }

  // Click the clear button
  async clickClear() {
    await this.page.click(this.clearBtnSelector);
  }

  // Click the random button
  async clickRandom() {
    await this.page.click(this.randomBtnSelector);
  }

  // Focus the canvas element (for keyboard interactions)
  async focusCanvas() {
    await this.page.focus(this.canvasSelector);
  }

  // Press a key while canvas focused
  async pressKey(key) {
    await this.page.keyboard.press(key);
  }

  // Get canvas toDataURL to compare drawn content
  async getCanvasDataURL() {
    return await this.page.$eval(this.canvasSelector, canvas => {
      try {
        return canvas.toDataURL();
      } catch (err) {
        return null;
      }
    });
  }

  // Small helper to wait for a redraw to occur
  async waitForRedraw(ms = 120) {
    await this.page.waitForTimeout(ms);
  }
}

test.describe('KNN Visualization - FSM and Interaction Tests', () => {
  let page;
  let knn;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture page runtime errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    knn = new KNNPage(page);
    await knn.waitForReady();

    // Allow initial redraw to finish
    await knn.waitForRedraw();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Initial Idle state: page loads and initial UI elements are correct', async () => {
    // Validate the app is in Idle state (S0_Idle) by checking existence of controls
    await expect(page.locator('#canvas')).toBeVisible();
    await expect(page.locator('#kInput')).toBeVisible();
    await expect(page.locator('#clearBtn')).toBeVisible();
    await expect(page.locator('#randomBtn')).toBeVisible();

    // K default value is 3
    const kVal = await knn.getKValue();
    expect(kVal).toBe(3);

    // Title indicates the next class (should reflect initial currentClassIndex = 0 -> A)
    const title = await knn.title();
    expect(title).toContain('Next class: A');

    // Capture initial canvas state to compare later
    const initialCanvas = await knn.getCanvasDataURL();
    expect(initialCanvas).toBeTruthy();
  });

  test('Add a point with click transitions to Point Added (S1_PointAdded)', async () => {
    // Capture canvas before click
    const before = await knn.getCanvasDataURL();

    // Click on canvas at (100, 80)
    await knn.clickCanvasAt(100, 80);
    await knn.waitForRedraw();

    // After click, canvas should change (point added)
    const after = await knn.getCanvasDataURL();
    expect(after).toBeTruthy();
    expect(after).not.toEqual(before);

    // Title still should show Next class: A (no class cycle)
    const title = await knn.title();
    expect(title).toContain('Next class: A');
  });

  test('Shift-click cycles class then adds point (class cycling via ClickCanvas & nextClass)', async () => {
    // Ensure initial title is Class A
    const titleBefore = await knn.title();
    expect(titleBefore).toContain('Next class: A');

    // Shift-click at a different position; shiftKey should cycle class before adding
    // Use mouse.click with modifiers: 'Shift'
    await knn.clickCanvasAt(150, 120, { modifiers: ['Shift'] });
    await knn.waitForRedraw();

    // After shift-click title should update to Next class: B (because it cycled before adding)
    const titleAfter = await knn.title();
    expect(titleAfter).toContain('Next class: B');

    // Canvas should have changed
    const canvasData = await knn.getCanvasDataURL();
    expect(canvasData).toBeTruthy();
  });

  test('Mouse move updates query point visualization (MouseMoveCanvas event)', async () => {
    // Move mouse to near center - this should cause redraw with a query point
    const before = await knn.getCanvasDataURL();
    await knn.moveMouseTo(300, 200);
    await knn.waitForRedraw();

    const after = await knn.getCanvasDataURL();
    expect(after).toBeTruthy();
    // There should be a visible change when moving the mouse (query point drawn)
    expect(after).not.toEqual(before);
  });

  test('Mouse leave hides query visualization (MouseLeaveCanvas event)', async () => {
    // Move inside and then leave
    await knn.moveMouseTo(320, 210);
    await knn.waitForRedraw();
    const insideData = await knn.getCanvasDataURL();
    expect(insideData).toBeTruthy();

    // Move mouse outside to trigger mouseleave and redraw
    await knn.moveMouseOutside();
    await knn.waitForRedraw();

    const outsideData = await knn.getCanvasDataURL();
    expect(outsideData).toBeTruthy();
    // Likely different from the inside (query removed)
    expect(outsideData).not.toEqual(insideData);
  });

  test('Change K value via input triggers redraw and clamps out-of-range values (InputKChange)', async () => {
    // Record initial canvas
    const before = await knn.getCanvasDataURL();

    // Set K to 5 and ensure value updated to 5
    await knn.setKValue(5);
    await knn.waitForRedraw();
    expect(await knn.getKValue()).toBe(5);

    const afterSet5 = await knn.getCanvasDataURL();
    expect(afterSet5).toBeTruthy();
    // Redraw should reflect K change - can differ
    expect(afterSet5).not.toEqual(before);

    // Edge case: set K to 0 -> should clamp to 1
    await knn.setKValue(0);
    await knn.waitForRedraw();
    expect(await knn.getKValue()).toBe(1);

    // Edge case: set K to very large number -> clamp to 10 (max)
    await knn.setKValue(999);
    await knn.waitForRedraw();
    expect(await knn.getKValue()).toBe(10);
  });

  test('Add random points transitions to Random Points Added (S3_RandomPointsAdded)', async () => {
    const before = await knn.getCanvasDataURL();

    // Click random button to add 15 random points
    await knn.clickRandom();
    // Wait a bit for looped pushes and redraw
    await knn.waitForRedraw(200);

    const after = await knn.getCanvasDataURL();
    expect(after).toBeTruthy();
    // Canvas should definitely change when random points are added
    expect(after).not.toEqual(before);
  });

  test('Clear button removes all points (Points Cleared S2_PointsCleared)', async () => {
    // Add random points first to ensure canvas has many points
    await knn.clickRandom();
    await knn.waitForRedraw(200);
    const withPoints = await knn.getCanvasDataURL();

    // Clear points
    await knn.clickClear();
    await knn.waitForRedraw(120);

    const cleared = await knn.getCanvasDataURL();
    expect(cleared).toBeTruthy();

    // After clearing, canvas should be different from the one with many points
    expect(cleared).not.toEqual(withPoints);

    // Optionally cleared might be same as initial blank; ensure at least different from withPoints
  });

  test('Keyboard controls: cycle class (c) and add point (Enter/Space) (KeyDownCanvas)', async () => {
    // Focus canvas to send key events
    await knn.focusCanvas();
    const titleBefore = await knn.title();

    // Press 'c' to cycle class
    await knn.pressKey('KeyC');
    await knn.waitForRedraw(100);
    const titleAfterC = await knn.title();
    // Title should have changed to next class (A->B or similar)
    expect(titleAfterC).not.toEqual(titleBefore);

    // Capture canvas before adding with Enter
    const before = await knn.getCanvasDataURL();

    // Press Enter to add point at current mousePos (initially center)
    await knn.pressKey('Enter');
    await knn.waitForRedraw(120);

    const after = await knn.getCanvasDataURL();
    expect(after).toBeTruthy();
    expect(after).not.toEqual(before);

    // Press Space to add another point
    const before2 = after;
    await knn.pressKey('Space');
    await knn.waitForRedraw(120);
    const after2 = await knn.getCanvasDataURL();
    expect(after2).toBeTruthy();
    expect(after2).not.toEqual(before2);
  });

  test('Edge case: non-integer input in K field behaves robustly', async () => {
    // Input a non-numeric value via page.evaluate (simulating user or script)
    await page.$eval('#kInput', el => { el.value = 'abc'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await knn.waitForRedraw(120);

    // K should be clamped/coerced to a valid number (code sets to 1 if NaN)
    const kAfter = await knn.getKValue();
    expect(kAfter).toBeGreaterThanOrEqual(1);
    expect(kAfter).toBeLessThanOrEqual(10);
  });

  test('No unexpected runtime errors or console.error messages occurred during interactions', async () => {
    // This test validates that no page errors or console.error were emitted during setup/interactions.
    // Note: page.on('pageerror') and page.on('console') collected errors in beforeEach.
    expect(pageErrors.length).toBe(0, `Expected no page errors, but got: ${pageErrors.map(e => e.message).join(' | ')}`);
    expect(consoleErrors.length).toBe(0, `Expected no console.error messages, but got: ${consoleErrors.map(e => e.text).join(' | ')}`);
  });
});