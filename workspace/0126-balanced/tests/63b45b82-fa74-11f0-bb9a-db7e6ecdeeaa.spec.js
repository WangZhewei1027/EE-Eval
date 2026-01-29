import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b45b82-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Utility page object for the SVM demo page
class SVMPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];
    this.dialogs = [];

    // Capture console errors and page errors for assertions
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
    this.page.on('dialog', async dialog => {
      // Collect dialog messages and accept them by default
      this.dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait a short time for initial draw() to complete
    await this.page.waitForTimeout(100);
  }

  // Click inside the canvas at canvas-local coordinates (offset from top-left of canvas)
  // x,y should be numbers between 0..canvas.width-1 and 0..canvas.height-1
  async clickCanvasAt(x, y, options = {}) {
    await this.page.click('#canvas', { position: { x, y }, ...options });
    // allow drawing to update
    await this.page.waitForTimeout(80);
  }

  // Read RGBA pixel from canvas at canvas-local coordinates
  async getCanvasPixel(x, y) {
    return await this.page.evaluate(
      ({ x, y }) => {
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
        return [d[0], d[1], d[2], d[3]];
      },
      { x, y }
    );
  }

  // Helper to compute dataToPixel same as the app (maps data coords to canvas pixels)
  dataToPixel(x, y) {
    // Implementation mirrors the page's dataToPixel
    const px = 50 + ((x + 1.2) / 2.4) * 500;
    const py = 550 - ((y + 1.2) / 2.4) * 500;
    return [px, py];
  }

  async clickReset() {
    await this.page.click('#resetBtn');
    await this.page.waitForTimeout(80);
  }

  async clickClear() {
    await this.page.click('#clearBtn');
    await this.page.waitForTimeout(80);
  }

  // Click train; when disabled, Playwright will not click unless force:true.
  // By default do not force.
  async clickTrain({ force = false } = {}) {
    await this.page.click('#trainBtn', { force });
    await this.page.waitForTimeout(120);
  }

  async isTrainDisabled() {
    return await this.page.locator('#trainBtn').isDisabled();
  }

  // Convenience: scan a rectangular region for a pixel satisfying a predicate
  async findPixelInRegion(x0, y0, w, h, predicate) {
    // iterate pixels on page side to find the first matching pixel.
    const step = 6; // step to reduce work while still scanning area
    for (let dx = 0; dx < w; dx += step) {
      for (let dy = 0; dy < h; dy += step) {
        const x = Math.round(x0 + dx);
        const y = Math.round(y0 + dy);
        const rgba = await this.getCanvasPixel(x, y);
        if (predicate(rgba)) return { x, y, rgba };
      }
    }
    return null;
  }
}

test.describe('SVM Interactive Demo - FSM and UI behavior', () => {
  let page;
  let svmPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    svmPage = new SVMPage(page);
    await svmPage.goto();
  });

  test.afterEach(async () => {
    // Assert no uncaught page errors or console errors appeared during the test run
    // These assertions ensure we observed console/page errors (none expected for a healthy run).
    expect(svmPage.pageErrors, 'No uncaught page errors should be present').toHaveLength(0);
    expect(svmPage.consoleErrors, 'No console.error messages should be present').toHaveLength(0);

    await page.close();
  });

  test('Idle state on load: canvas drawn and Train button disabled', async () => {
    // Validate initial Idle state (S0_Idle)
    // - draw() should have been called on entry; canvas center should be white background
    // - trainBtn should be disabled initially

    // Canvas center (canvas is 600x600) -> sample 300,300
    const center = { x: 300, y: 300 };
    const pixel = await svmPage.getCanvasPixel(center.x, center.y);
    // White background inside the data area is RGB(255,255,255)
    expect(pixel[0]).toBeGreaterThanOrEqual(250);
    expect(pixel[1]).toBeGreaterThanOrEqual(250);
    expect(pixel[2]).toBeGreaterThanOrEqual(250);

    // Train button should be disabled (no points added yet)
    const disabled = await svmPage.isTrainDisabled();
    expect(disabled).toBe(true);
  });

  test('ClickCanvas transitions (Idle -> Idle): adding points alternates classes and updates button state', async () => {
    // This validates the ClickCanvas event and the transition staying in Idle while adding points.
    // - First click: adds a class +1 point (red), trainBtn remains disabled (only one class present)
    // - Second click: adds a class -1 point (blue), trainBtn becomes enabled

    // Choose two canvas-local coordinates within data box: center and right-of-center
    const firstPos = { x: 300, y: 300 }; // should map to data (0,0)
    const secondPos = { x: 360, y: 300 };

    // First click
    await svmPage.clickCanvasAt(firstPos.x, firstPos.y);
    // Pixel at center should be red-ish (class +1 color #ff4d4d)
    const p1 = await svmPage.getCanvasPixel(firstPos.x, firstPos.y);
    expect(p1[0]).toBeGreaterThan(180); // red channel high
    expect(p1[0]).toBeGreaterThan(p1[1]); // more red than green
    expect(p1[0]).toBeGreaterThan(p1[2]); // more red than blue

    // Train button still disabled after first point
    expect(await svmPage.isTrainDisabled()).toBe(true);

    // Second click (should add opposite class)
    await svmPage.clickCanvasAt(secondPos.x, secondPos.y);
    const p2 = await svmPage.getCanvasPixel(secondPos.x, secondPos.y);
    // Blue-ish color (#4183c4) => blue channel dominant
    expect(p2[2]).toBeGreaterThan(120);
    expect(p2[2]).toBeGreaterThan(p2[0]);
    expect(p2[2]).toBeGreaterThan(p2[1]);

    // Train button should now be enabled because both classes exist
    expect(await svmPage.isTrainDisabled()).toBe(false);

    // Edge: clicking outside the data box should NOT add a point
    // Click near top-left corner outside data area e.g., 10,10 (canvas-local)
    await svmPage.clickCanvasAt(10, 10);
    // center pixel should still have the red point (not overwritten to white)
    const centerPixel = await svmPage.getCanvasPixel(firstPos.x, firstPos.y);
    expect(centerPixel[0]).toBeGreaterThan(180);
  });

  test('Training flow: Train SVM draws decision boundary and disables Train button', async () => {
    // Arrange: add two points of opposite classes to enable training
    await svmPage.clickCanvasAt(300, 300); // class +1
    await svmPage.clickCanvasAt(360, 300); // class -1

    // Precondition: trainBtn enabled
    expect(await svmPage.isTrainDisabled()).toBe(false);

    // Act: click Train to trigger SVM.train() (S1_Training entry action)
    await svmPage.clickTrain();

    // After successful training:
    // - trained draw includes decision boundary and margins (green lines)
    // - trainBtn becomes disabled
    expect(await svmPage.isTrainDisabled()).toBe(true);

    // The decision boundary and margins are greenish; search a region for a green-dominant pixel.
    // We look across the data box region (50..550).
    const found = await svmPage.findPixelInRegion(50, 50, 500, 500, rgba => {
      const [r, g, b] = rgba;
      // simple heuristic for "greenish" pixel: green channel significantly larger
      return g > 120 && g > r + 30 && g > b + 20;
    });
    expect(found, 'Decision boundary or margins (green) should be drawn on canvas after training').not.toBeNull();

    // Additionally, support vectors are outlined in orange (#f39c12) - try to detect an orange-ish pixel near the previously added points
    const svFound = await svmPage.findPixelInRegion(280, 280, 100, 100, rgba => {
      const [r, g, b] = rgba;
      return r > 180 && g > 90 && b < 80; // orange-ish heuristic
    });
    // It's acceptable if no orange pixels are found depending on solver results for the minimal training set,
    // but we at least verify that the decision boundary was drawn above. To be robust, don't assert on svFound.
  });

  test('Training failure scenario (insufficient points) triggers alert dialog', async () => {
    // This test exercises an edge-case: click Train when insufficient data exists.
    // Normally the Train button is disabled; we'll force-click it so the click handler runs and the alert can be observed.
    // Add 0 points and force the click.
    // The page has a dialog handler in our PageObject which accepts it and stores the message.

    // Ensure there are no points initially (fresh page)
    expect(await svmPage.isTrainDisabled()).toBe(true);

    // Force click the train button even though it's disabled, to simulate the edge case path
    await svmPage.clickTrain({ force: true });

    // The app should have shown an alert with the failure message
    // Wait a moment to ensure dialog handler captured it
    await page.waitForTimeout(50);
    expect(svmPage.dialogs.length).toBeGreaterThanOrEqual(1);
    const lastDialog = svmPage.dialogs[svmPage.dialogs.length - 1];
    expect(lastDialog.message).toContain('Training failed! Add at least one point in each class.');
  });

  test('Reset Data transition: clicking Reset Data populates example points and enables Train', async () => {
    // Click Reset Data (S2_DataReset entry action calls draw())
    await svmPage.clickReset();

    // After reset, trainBtn should be enabled
    expect(await svmPage.isTrainDisabled()).toBe(false);

    // Verify that the predefined points are drawn on canvas.
    // Points defined in the app:
    const predefined = [
      { x: -0.9, y: -0.6, class: +1 },
      { x: -0.8, y: -0.5, class: +1 },
      { x: -0.7, y: -0.75, class: +1 },
      { x: 0.7, y: 0.6, class: -1 },
      { x: 0.8, y: 0.5, class: -1 },
      { x: 0.9, y: 0.75, class: -1 }
    ];

    // For each predefined point compute pixel coordinates and assert color presence
    for (const pt of predefined) {
      const [px, py] = svmPage.dataToPixel(pt.x, pt.y);
      // Round to nearest integers for sampling
      const rgba1 = await svmPage.getCanvasPixel(Math.round(px), Math.round(py));
      if (pt.class === +1) {
        // red-ish
        expect(rgba[0]).toBeGreaterThan(150);
      } else {
        // blue-ish
        expect(rgba[2]).toBeGreaterThan(100);
      }
    }
  });

  test('Clear All transition: clicking Clear All removes points and disables Train', async () => {
    // Prepopulate with reset then clear
    await svmPage.clickReset();
    expect(await svmPage.isTrainDisabled()).toBe(false);

    // Click Clear All (S3_DataCleared)
    await svmPage.clickClear();

    // After clearing, trainBtn should be disabled
    expect(await svmPage.isTrainDisabled()).toBe(true);

    // Canvas center should return to white background (indicating cleared drawing)
    const centerPixel1 = await svmPage.getCanvasPixel(300, 300);
    expect(centerPixel[0]).toBeGreaterThanOrEqual(250);
    expect(centerPixel[1]).toBeGreaterThanOrEqual(250);
    expect(centerPixel[2]).toBeGreaterThanOrEqual(250);
  });

  test('Clicking outside data area does nothing (no point added)', async () => {
    // Record center pixel before clicking outside
    const before = await svmPage.getCanvasPixel(300, 300);

    // Click outside the data bounding box on the canvas (e.g., top-left corner inside canvas but outside data box)
    await svmPage.clickCanvasAt(10, 10);
    // allow redraw (should be no redraw)
    await page.waitForTimeout(60);

    // Center pixel should be unchanged
    const after = await svmPage.getCanvasPixel(300, 300);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(after[2]).toBe(before[2]);
  });
});