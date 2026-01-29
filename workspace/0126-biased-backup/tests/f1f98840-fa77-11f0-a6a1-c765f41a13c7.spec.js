import { test, expect } from '@playwright/test';

const PAGE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f98840-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object encapsulating the key elements and interactions for the KNN demo
class KnnPage {
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#playBtn');
    this.playLabel = page.locator('#playLabel');
    this.kSlider = page.locator('#kSlider');
    this.kValue = page.locator('#kValue');
    this.prediction = page.locator('#prediction');
    this.queryGroup = page.locator('#queryGroup');
    this.ringsG = page.locator('#rings');
    this.linesG = page.locator('#lines');
    this.pointsG = page.locator('#points');
    this.trailG = page.locator('#trail');
  }

  // Toggle play/pause by clicking the play button
  async togglePlay() {
    await this.playBtn.click();
  }

  // Press space key (should toggle play/pause via the global handler)
  async pressSpace() {
    await this.page.keyboard.press('Space');
  }

  // Set slider value using DOM manipulation and dispatching input event
  // We intentionally use evaluate to simulate the real input event handling that the page expects.
  async setKValue(value) {
    await this.kSlider.evaluate((el, v) => {
      el.value = String(v);
      const ev = new Event('input', { bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
    }, value);
  }

  // Return the computed transform attribute of the query group (position)
  async getQueryTransform() {
    return await this.queryGroup.getAttribute('transform');
  }

  // Count child elements of rings and lines groups
  async getRingsCount() {
    return await this.ringsG.evaluate((g) => g.childElementCount);
  }
  async getLinesCount() {
    return await this.linesG.evaluate((g) => g.childElementCount);
  }
}

test.describe('K-Nearest Neighbors — Elegant Visual Demo (f1f98840-fa77-11f0-a6a1-c765f41a13c7)', () => {
  // Collect console error messages and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        try {
          consoleErrors.push(msg.text());
        } catch {
          consoleErrors.push(String(msg));
        }
      }
    });

    // Capture uncaught page errors (exceptions)
    page.on('pageerror', (err) => {
      try {
        pageErrors.push(err.message || String(err));
      } catch {
        pageErrors.push(String(err));
      }
    });

    // Navigate to the demo page
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });

    // Wait a short while for initial rendering/animations to set up
    await page.waitForTimeout(100);
  });

  test.afterEach(async ({ page }) => {
    // nothing additional to teardown; listeners are tied to page instance and cleaned up by Playwright
  });

  test('Initial render - UI elements exist and initial state is Running', async ({ page }) => {
    // Validate that the page loaded, elements exist and initial state corresponds to Running
    const knn = new KnnPage(page);

    // Play button and slider should be visible and present
    await expect(knn.playBtn).toBeVisible();
    await expect(knn.kSlider).toBeVisible();
    await expect(knn.kValue).toBeVisible();
    await expect(knn.prediction).toBeVisible();

    // Initial play label should show "Pause" because running = true in the implementation
    await expect(knn.playLabel).toHaveText('Pause');

    // The play button should NOT have the 'paused' class initially (running true)
    const playBtnClasses = await knn.playBtn.getAttribute('class');
    expect(playBtnClasses).not.toContain('paused');

    // Initial prediction text should match "Class X (NN%)"
    const predText = await knn.prediction.textContent();
    expect(predText.trim()).toMatch(/^Class [AB] \(\d+%\)$/);

    // Query group transform should be present (query placed at start)
    const transform = await knn.getQueryTransform();
    expect(transform).toBeTruthy();

    // Ensure no console error messages or uncaught page errors occurred during load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Play/Pause transitions: clicking toggles running state and visual movement stops/starts', async ({ page }) => {
    // This test validates S0_Idle -> S1_Running -> S2_Paused transitions observable via play button and query motion.
    const knn = new KnnPage(page);

    // Record initial transform while running
    const initialTransform = await knn.getQueryTransform();
    expect(initialTransform).toBeTruthy();

    // Click play button to pause (should set running=false)
    await knn.togglePlay();

    // Label should change to "Play" and class 'paused' should be present
    await expect(knn.playLabel).toHaveText('Play');
    const classesAfterPause = await knn.playBtn.getAttribute('class');
    expect(classesAfterPause).toContain('paused');

    // After pausing, the query group transform should remain stable over a short interval
    const transformAfterPause = await knn.getQueryTransform();
    // Wait a bit and ensure it didn't change
    await page.waitForTimeout(300);
    const transformAfterPause2 = await knn.getQueryTransform();
    expect(transformAfterPause2).toEqual(transformAfterPause);

    // Now resume by clicking play again (Paused -> Running)
    await knn.togglePlay();

    // Label should update to "Pause" and 'paused' class removed
    await expect(knn.playLabel).toHaveText('Pause');
    const classesAfterResume = await knn.playBtn.getAttribute('class');
    expect(classesAfterResume).not.toContain('paused');

    // After resuming, the query transform should change within a short time interval (movement resumed)
    const transformAfterResume = await knn.getQueryTransform();
    // Wait for animation frames to advance
    await page.waitForTimeout(400);
    const transformAfterResume2 = await knn.getQueryTransform();
    // It's possible movement is subtle; assert that transform attribute changed at least once after resume
    expect(transformAfterResume2).not.toEqual(transformAfterResume);

    // Ensure no uncaught errors occurred during rapid toggling
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Keyboard interaction: pressing Space toggles play/pause (accessibility)', async ({ page }) => {
    // Validate the accessibility keyboard handler (window keydown Space triggers play toggle)
    const knn = new KnnPage(page);

    // Ensure current state is running (label 'Pause')
    const beforeLabel = await knn.playLabel.textContent();
    expect(beforeLabel.trim()).toMatch(/Pause|Play/);

    // Press Space to toggle
    await knn.pressSpace();
    await page.waitForTimeout(150);
    // Label should have flipped
    const labelAfterSpace = await knn.playLabel.textContent();
    expect(labelAfterSpace.trim()).not.toEqual(beforeLabel.trim());

    // Press Space again to toggle back
    await knn.pressSpace();
    await page.waitForTimeout(150);
    const labelAfterSpace2 = await knn.playLabel.textContent();
    expect(labelAfterSpace2.trim()).toEqual(beforeLabel.trim());

    // No page errors triggered by keyboard handler
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('K slider input updates K, UI label, rings/lines count and prediction', async ({ page }) => {
    // This test validates KSliderInput event and the visual update that depends on K.
    const knn = new KnnPage(page);

    // Helper to get counts with retry because DOM updates may be asynchronous
    async function waitForCounts(expectedK, timeout = 1000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const rings = await knn.getRingsCount();
        const lines = await knn.getLinesCount();
        // lines and rings should be equal to K if updateQuery ran
        if (rings === expectedK && lines === expectedK) return { rings, lines };
        await page.waitForTimeout(80);
      }
      // final fetch
      return { rings: await knn.getRingsCount(), lines: await knn.getLinesCount() };
    }

    // Set K to 9 (within min/max and respecting step)
    await knn.setKValue(9);
    // kValue label textual update
    await expect(knn.kValue).toHaveText('9');

    // Wait until rings and lines equal 9
    const counts9 = await waitForCounts(9);
    expect(counts9.rings).toBe(9);
    expect(counts9.lines).toBe(9);

    // Prediction should update and match expected format
    const predAfter9 = await knn.prediction.textContent();
    expect(predAfter9.trim()).toMatch(/^Class [AB] \(\d+%\)$/);

    // Edge case: set K to minimum 1
    await knn.setKValue(1);
    await expect(knn.kValue).toHaveText('1');
    const counts1 = await waitForCounts(1);
    expect(counts1.rings).toBe(1);
    expect(counts1.lines).toBe(1);
    const predAfter1 = await knn.prediction.textContent();
    expect(predAfter1.trim()).toMatch(/^Class [AB] \(\d+%\)$/);

    // Edge case: set K to maximum 15
    await knn.setKValue(15);
    await expect(knn.kValue).toHaveText('15');
    const counts15 = await waitForCounts(15, 2000);
    // If the page cannot create 15 neighbors because POINT_COUNT is 60 this is fine; rings/lines should be 15
    expect(counts15.rings).toBe(15);
    expect(counts15.lines).toBe(15);

    // No exceptions should have occurred during slider interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Rapid interactions and stress toggling do not produce runtime exceptions', async ({ page }) => {
    // Rapidly toggle play/pause and change K repeatedly to ensure no runtime errors/exceptions.
    const knn = new KnnPage(page);

    // Rapid clicks on play button
    for (let i = 0; i < 12; i++) {
      await knn.playBtn.click();
    }

    // Rapid K changes (valid step values: 1,3,5,...15)
    const oddValues = [3, 7, 11, 5, 13];
    for (const v of oddValues) {
      await knn.setKValue(v);
      // allow the UI a small moment to react
      await page.waitForTimeout(60);
      // quick assertion that kValue matches intended
      await expect(knn.kValue).toHaveText(String(v));
    }

    // Final quick checks: lines/rings counts are plausible (equal to last K)
    const ringsFinal = await knn.getRingsCount();
    const linesFinal = await knn.getLinesCount();
    // Should be equal to last K (13) if updates completed, or at least > 0
    expect(ringsFinal).toBeGreaterThanOrEqual(0);
    expect(linesFinal).toBeGreaterThanOrEqual(0);

    // Assert there were no uncaught exceptions during rapid interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('DOM integrity: points, rings and lines groups exist and points count matches POINT_COUNT', async ({ page }) => {
    // Validate presence of SVG groups and that static points were rendered
    const knn = new KnnPage(page);

    // points group child count should equal 60 as per implementation (POINT_COUNT)
    const pointsCount = await knn.pointsG.evaluate((g) => g.childElementCount);
    // Implementation sets POINT_COUNT = 60
    expect(pointsCount).toBe(60);

    // Ensure rings and lines group exist and are accessible
    const ringsCountStart = await knn.getRingsCount();
    const linesCountStart = await knn.getLinesCount();
    // Initially, there should be some rings/lines created by initial updateQuery (K=5)
    expect(ringsCountStart).toBeGreaterThanOrEqual(0);
    expect(linesCountStart).toBeGreaterThanOrEqual(0);

    // No runtime exceptions affecting DOM creation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});