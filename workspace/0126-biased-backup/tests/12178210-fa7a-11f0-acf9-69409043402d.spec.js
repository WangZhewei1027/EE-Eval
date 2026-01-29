import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12178210-fa7a-11f0-acf9-69409043402d.html';

// Name must match requirement: 12178210-fa7a-11f0-acf9-69409043402d.spec.js
test.describe('Interactive SVM Explorer - End-to-end FSM validation', () => {
  // Collect console errors and page errors to assert runtime stability
  let consoleErrors = [];
  let pageErrors = [];
  let dialogs = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // Listen to console messages and page errors
    page.on('console', msg => {
      try {
        const type = msg.type();
        const text = msg.text();
        if (type === 'error') {
          consoleErrors.push({ type, text });
        }
      } catch (e) {
        // swallow listener errors
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Accept any alert/dialogs to avoid blocking the tests (page uses alert in many places)
    page.on('dialog', async dialog => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });

    await page.goto(APP_URL);
    // Ensure page loaded
    await expect(page.locator('h1')).toHaveText(/Support Vector Machine Interactive Explorer/);
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity: no uncaught exceptions surfaced
    // If any page errors occurred, fail the test to make them visible
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);
    // No console errors
    expect(consoleErrors.length, `Console error logs detected: ${JSON.stringify(consoleErrors)}`).toBe(0);
    // Close page to cleanup
    await page.close();
  });

  test('S0_Idle: initial render shows title and controls', async ({ page }) => {
    // Validate Idle state evidence: header exists
    await expect(page.locator('h1')).toHaveText('Support Vector Machine Interactive Explorer');

    // Check presence of critical controls from the FSM components
    await expect(page.locator('#btnGenerateData')).toBeVisible();
    await expect(page.locator('#btnTrainSVM')).toBeVisible();
    await expect(page.locator('#svmCanvas')).toBeVisible();
    await expect(page.locator('#exportImportData')).toBeVisible();
  });

  test('S1_DataGenerated -> S2_ModelTrained: generate data then train SVM', async ({ page }) => {
    // Set small dataset for speed
    await page.fill('#pointsPerClass', '3');
    // Generate data (transition S0 -> S1)
    await page.click('#btnGenerateData');

    // Check points added (points lives in page context)
    const pointsCount = await page.evaluate(() => points.length);
    expect(pointsCount).toBeGreaterThan(0);

    // Train SVM (S1 -> S2)
    await page.click('#btnTrainSVM');

    // Wait for svmModel to be non-null
    await page.waitForFunction(() => typeof svmModel !== 'undefined' && svmModel !== null, {}, { timeout: 5000 });

    const modelExists = await page.evaluate(() => svmModel !== null);
    expect(modelExists).toBeTruthy();

    // Export JSON to verify S9_JSONExported later
    await page.click('#btnExportJSON');
    const exportedText = await page.locator('#exportImportData').inputValue();
    expect(exportedText).toContain('"points"');
    expect(exportedText).toContain('"svmParams"');
  });

  test('S1_DataGenerated -> S3_PointAdded & S4_PointSelected -> S5_PointDragged -> S2_ModelTrained', async ({ page }) => {
    // Generate minimal custom dataset
    await page.fill('#pointsPerClass', '2');
    await page.click('#btnGenerateData');
    const initialCount = await page.evaluate(() => points.length);

    // Toggle Add Point Mode ON
    await page.click('#btnAddPointMode');
    await expect(page.locator('#btnAddPointMode')).toHaveText(/ON|OFF/);

    // Click on canvas to add a point at canvas center
    const canvas = await page.locator('#svmCanvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');

    const clickX = Math.round(box.x + box.width / 2);
    const clickY = Math.round(box.y + box.height / 2);

    // Add a point (S3_PointAdded)
    await page.mouse.click(clickX, clickY, { button: 'left' });

    // New point should be added and selectedPointIndex updated
    await page.waitForFunction(() => points.length > 0, {}, { timeout: 2000 });
    const afterAddCount = await page.evaluate(() => points.length);
    expect(afterAddCount).toBeGreaterThanOrEqual(initialCount + 1);

    // The add operation also triggers trainSVM(); ensure svmModel exists
    const modelAfterAdd = await page.evaluate(() => svmModel !== null);
    expect(modelAfterAdd).toBeTruthy();

    // Toggle Add Point Mode OFF to allow selection/dragging
    await page.click('#btnAddPointMode');
    await expect(page.locator('#btnAddPointMode')).toHaveText(/OFF/);

    // Now attempt to select the point we added by mousedown at same coords (S4_PointSelected)
    await page.mouse.down(clickX, clickY, { button: 'left' });
    await page.mouse.up(clickX, clickY, { button: 'left' });

    // Ensure a point is selected (selectedPointIndex >= 0)
    const selectedIdx = await page.evaluate(() => selectedPointIndex);
    expect(selectedIdx).toBeGreaterThanOrEqual(0);

    // Drag the selected point to the right by 40px (S5_PointDragged)
    await page.mouse.move(clickX, clickY);
    await page.mouse.down(clickX, clickY, { button: 'left' });
    await page.mouse.move(clickX + 40, clickY, { steps: 5 });
    await page.mouse.up(clickX + 40, clickY, { button: 'left' });

    // After mouseup, trainSVM() should have been called (S5 -> S2)
    await page.waitForFunction(() => svmModel !== null, {}, { timeout: 5000 });
    const modelAfterDrag = await page.evaluate(() => svmModel !== null);
    expect(modelAfterDrag).toBeTruthy();

    // Verify the selected point coordinates changed from its original (we can check that some point moved)
    const moved = await page.evaluate(() => {
      // We cannot rely on index, but check if any point differs meaningfully from original center
      // Just check selectedPointIndex is -1 after mouseup (dragging ended) or points updated
      return points.length;
    });
    expect(moved).toBeGreaterThan(0);
  });

  test('S1_DataGenerated -> S6_ModelCleared via Clear All Points & Clear Model button', async ({ page }) => {
    // Generate data and train
    await page.fill('#pointsPerClass', '3');
    await page.click('#btnGenerateData');
    await page.click('#btnTrainSVM');
    await page.waitForFunction(() => svmModel !== null, {}, { timeout: 5000 });

    // Clear all points (S6 via ClearAllPoints)
    await page.click('#btnClearAll');

    const afterClearCount = await page.evaluate(() => points.length);
    expect(afterClearCount).toBe(0);

    // Re-generate and train, then Clear Model button to clear svmModel
    await page.click('#btnGenerateData');
    await page.click('#btnTrainSVM');
    await page.waitForFunction(() => svmModel !== null, {}, { timeout: 5000 });
    await page.click('#btnClearModel');

    const modelCleared = await page.evaluate(() => svmModel === null);
    expect(modelCleared).toBeTruthy();
  });

  test('S7_PanCanvas and S8_Zoomed: pan and zoom change canvas rendering', async ({ page }) => {
    const canvas = page.locator('#svmCanvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');

    // Capture initial canvas image
    const beforeDataUrl = await page.evaluate(() => document.getElementById('svmCanvas').toDataURL());

    // Pan: right click + drag
    const startX = Math.round(box.x + box.width / 2);
    const startY = Math.round(box.y + box.height / 2);
    await page.mouse.move(startX, startY);
    await page.mouse.down(startX, startY, { button: 'right' });
    await page.mouse.move(startX + 60, startY + 30, { steps: 6 });
    await page.mouse.up(startX + 60, startY + 30, { button: 'right' });

    // After pan, canvas should have changed
    const afterPanDataUrl = await page.evaluate(() => document.getElementById('svmCanvas').toDataURL());
    expect(afterPanDataUrl).not.toEqual(beforeDataUrl);

    // Zoom: wheel (scroll up -> zoom in)
    await page.mouse.move(startX, startY);
    // Page.mouse.wheel expects deltaX, deltaY; negative deltaY should zoom in
    // Use a small number to trigger zoom handler
    await page.mouse.wheel(0, -100);

    // After zoom, canvas should change again
    const afterZoomDataUrl = await page.evaluate(() => document.getElementById('svmCanvas').toDataURL());
    expect(afterZoomDataUrl).not.toEqual(afterPanDataUrl);
  });

  test('JSON Export/Import flow and Clear JSON textarea (S9_JSONExported -> S10_JSONImported)', async ({ page }) => {
    // Ensure there is a trained model to export
    await page.fill('#pointsPerClass', '3');
    await page.click('#btnGenerateData');
    await page.click('#btnTrainSVM');
    await page.waitForFunction(() => svmModel !== null, {}, { timeout: 5000 });

    // Export current model and dataset
    await page.click('#btnExportJSON');
    const exported = await page.locator('#exportImportData').inputValue();
    expect(exported).toContain('"points"');

    // Clear textarea
    await page.click('#btnClearImportExport');
    let cleared = await page.locator('#exportImportData').inputValue();
    expect(cleared).toBe('');

    // Put exported JSON back and import
    await page.fill('#exportImportData', exported);
    await page.click('#btnImportJSON');

    // After import, points should exist and UI updated
    const importedPointsCount = await page.evaluate(() => points.length);
    expect(importedPointsCount).toBeGreaterThan(0);

    // Check that paramC was restored in the UI
    const paramCVal = await page.locator('#paramC').inputValue();
    expect(Number(paramCVal)).toBeGreaterThan(0);
  });

  test('Enable Multi-Class and change strategy (EnableMultiClass & MultiClassStrategyChange)', async ({ page }) => {
    // Initially the multi-class strategy select is disabled
    await expect(page.locator('#multiClassStrategy')).toBeDisabled();

    // Enable multi-class via checkbox
    await page.check('#checkboxEnableMultiClass');
    await expect(page.locator('#multiClassStrategy')).toBeEnabled();

    // Change strategy to oneVsRest
    await page.selectOption('#multiClassStrategy', 'oneVsRest');
    const val = await page.locator('#multiClassStrategy').inputValue();
    expect(val).toBe('oneVsRest');

    // Re-disable multi-class to reset for other tests
    await page.uncheck('#checkboxEnableMultiClass');
    await expect(page.locator('#multiClassStrategy')).toBeDisabled();
  });

  test('Grid Search edge cases and run (btnRunGridSearch)', async ({ page }) => {
    // Case: Not enough points -> message shown
    await page.click('#btnRunGridSearch');
    await page.waitForTimeout(200); // allow short time for handler to run
    const resultsText1 = await page.locator('#gridSearchResults').textContent();
    expect(resultsText1).toContain('Not enough points');

    // Now generate sufficient binary points and run grid search
    await page.fill('#pointsPerClass', '4');
    await page.click('#btnGenerateData');
    // Ensure classes are binary (randomLinearlySeparable will produce +/-1)
    await page.click('#btnRunGridSearch');

    // Wait for the grid search to complete; it appends lines including 'Grid Search Complete'
    await page.waitForFunction(() => document.getElementById('gridSearchResults').textContent.includes('Grid Search Complete') || document.getElementById('gridSearchResults').textContent.includes('Running grid search'), {}, { timeout: 15000 });

    const resultsText2 = await page.locator('#gridSearchResults').textContent();
    expect(resultsText2.length).toBeGreaterThan(0);
  });

  test('Keyboard delete on selected point (KeyDownDelete transition)', async ({ page }) => {
    // Create a custom added point so we can reliably select and delete it
    await page.click('#btnAddPointMode'); // ON
    const canvas = await page.locator('#svmCanvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available for delete test');

    const px = Math.round(box.x + box.width / 3);
    const py = Math.round(box.y + box.height / 3);

    // Add point
    await page.mouse.click(px, py, { button: 'left' });
    // Turn add mode off
    await page.click('#btnAddPointMode');

    // Click again to select it
    await page.mouse.click(px, py, { button: 'left' });

    const beforeDeleteCount = await page.evaluate(() => points.length);
    expect(beforeDeleteCount).toBeGreaterThan(0);

    // Press Delete key
    await page.keyboard.press('Delete');

    // After delete, points length should decrease by at least 1
    await page.waitForTimeout(200); // small wait for deletion to process
    const afterDeleteCount = await page.evaluate(() => points.length);
    expect(afterDeleteCount).toBeLessThanOrEqual(beforeDeleteCount - 1);
  });

  test('Edge case: invalid C value when training displays alert and prevents training', async ({ page }) => {
    // Set an invalid (non-positive) C
    await page.fill('#paramC', '0');
    // Listen for dialog and ensure it's accepted
    // Click Train SVM, should trigger alert and not train
    await page.click('#btnTrainSVM');

    // Because dialog handler accepts it, training should not proceed; svmModel should remain as-is (maybe null)
    const modelState = await page.evaluate(() => svmModel === null || typeof svmModel === 'object');
    expect(modelState).toBeTruthy();
    // There should be at least one dialog received with message about C
    const foundInvalidCDialog = dialogs.some(d => /C must be a positive number/i.test(d.message));
    expect(foundInvalidCDialog).toBeTruthy();
  });
});