import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d332d70-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('K-Nearest Neighbors Interactive Demo (FSM) - 6d332d70-fa7a-11f0-ba5b-57721b046e74', () => {
  // Arrays to capture console errors and page errors for assertions
  let consoleErrors = [];
  let pageErrors = [];

  // Helper to count rows in the dataset table
  const getDataRowCount = async (page) => {
    return await page.locator('#dataTableBody tr').count();
  };

  // Setup: navigate to the page and attach listeners for console and page errors
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure the app had time to initialize drawing and table population (if any)
    await page.waitForTimeout(100); // small wait for synchronous init to complete
  });

  // Teardown: simple check that no unexpected errors were logged during test
  test.afterEach(async ({ page }) => {
    // Make these assertions at the end of each test to observe runtime problems
    expect(pageErrors, `No uncaught page errors should occur. Observed: ${pageErrors.join(' | ')}`)
      .toHaveLength(0);
    expect(consoleErrors, `No console.error logs should occur. Observed: ${consoleErrors.join(' | ')}`)
      .toHaveLength(0);
  });

  test.describe('UI controls and K/metric updates', () => {
    test('UpdateKValue should change displayed K and internal k variable (UpdateKValue)', async ({ page }) => {
      // Verify initial display
      const display = page.locator('#kValueDisplay');
      await expect(display).toHaveText('3');

      // Set the range input to 7 by dispatching an input event
      await page.locator('input#kValue').evaluate((el) => {
        el.value = '7';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // The visible display should update
      await expect(display).toHaveText('7');

      // Also verify the global variable k was updated
      const kValue = await page.evaluate(() => window.k);
      expect(kValue).toBe(7);
    });

    test('UpdateDistanceMetric should change distanceMetric state (UpdateDistanceMetric)', async ({ page }) => {
      // Change the select to Manhattan
      await page.selectOption('#distanceMetric', 'manhattan');
      // The application updates distanceMetric on change - verify internal variable
      const metric = await page.evaluate(() => window.distanceMetric);
      expect(metric).toBe('manhattan');

      // Change again to Chebyshev to ensure multiple changes work
      await page.selectOption('#distanceMetric', 'chebyshev');
      const metric2 = await page.evaluate(() => window.distanceMetric);
      expect(metric2).toBe('chebyshev');
    });
  });

  test.describe('Dataset management and generation', () => {
    test('GenerateRandomData populates dataset and increases rows (GenerateRandomData)', async ({ page }) => {
      // Ensure initially clear
      await page.locator('button[onclick="clearData()"]').click();
      await expect(await getDataRowCount(page)).toBe(0);

      // Generate random data
      await page.locator('button[onclick="generateRandomData()"]').click();

      // generateRandomData should add 30 points (3 classes * 10 each)
      const count = await getDataRowCount(page);
      expect(count).toBeGreaterThanOrEqual(30);
    });

    test('ClearData empties the dataset (ClearData)', async ({ page }) => {
      // First ensure there is data
      await page.locator('button[onclick="generateRandomData()"]').click();
      const beforeCount = await getDataRowCount(page);
      expect(beforeCount).toBeGreaterThan(0);

      // Now clear
      await page.locator('button[onclick="clearData()"]').click();
      const afterCount = await getDataRowCount(page);
      expect(afterCount).toBe(0);
    });

    test('LoadSampleData loads predefined points and allows removal (LoadSampleData, removePoint)', async ({ page }) => {
      await page.locator('button[onclick="clearData()"]').click();
      await page.locator('button[onclick="loadSampleData()"]').click();

      // loadSampleData adds 15 points (5 + 5 + 5)
      let count = await getDataRowCount(page);
      expect(count).toBe(15);

      // Remove the first point using its Remove button and check count decreases
      const firstRemove = page.locator('#dataTableBody tr').first().locator('button');
      await expect(firstRemove).toHaveText('Remove');
      await firstRemove.click();

      const newCount = await getDataRowCount(page);
      expect(newCount).toBe(14);
    });

    test('AddRandomPoint should add a single point with selected class (AddRandomPoint)', async ({ page }) => {
      await page.locator('button[onclick="clearData()"]').click();
      // Select class 2 in classToAdd
      await page.selectOption('#classToAdd', '2');

      // Click add random point
      await page.locator('button[onclick="addRandomPoint()"]').click();

      const count = await getDataRowCount(page);
      expect(count).toBe(1);

      // Verify the class displayed in table row is "Class 2"
      const classText = await page.locator('#dataTableBody tr td:nth-child(4)').textContent();
      expect(classText).toContain('Class 2');
    });
  });

  test.describe('Manual placement and canvas interactions', () => {
    test('EnableManualPlacement displays alert and allows placing a point on canvas (EnableManualPlacement & HandleCanvasClick)', async ({ page }) => {
      await page.locator('button[onclick="clearData()"]').click();

      // Prepare to handle the alert that enableManualPlacement triggers
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.locator('button[onclick="enableManualPlacement()"]').click()
      ]);
      // Accept the alert to proceed
      await dialog.accept();

      // After enabling manual placement, click on the canvas center to add a point
      const canvas = page.locator('#canvas');
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();

      // Click center
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      const before = await getDataRowCount(page);
      await page.mouse.click(centerX, centerY);
      // small wait for handler to run
      await page.waitForTimeout(50);

      const after = await getDataRowCount(page);
      expect(after).toBe(before + 1);
    });

    test('Clicking canvas when manualPlacementMode is false should not add a point (HandleCanvasClick edge case)', async ({ page }) => {
      await page.locator('button[onclick="clearData()"]').click();

      // Ensure manualPlacementMode is false (initial state)
      const manualMode = await page.evaluate(() => window.manualPlacementMode);
      expect(manualMode).toBe(false);

      const canvas = page.locator('#canvas');
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();

      const before = await getDataRowCount(page);
      // Click somewhere on the canvas
      await page.mouse.click(box.x + 10, box.y + 10);
      await page.waitForTimeout(50);
      const after = await getDataRowCount(page);
      expect(after).toBe(before);
    });
  });

  test.describe('Classification flows', () => {
    test('ClassifyPoint with no data shows appropriate message (ClassifyPoint edge case)', async ({ page }) => {
      // Ensure data cleared
      await page.locator('button[onclick="clearData()"]').click();

      // Set test coordinates
      await page.fill('#testX', '0.1');
      await page.fill('#testY', '0.1');

      // Click classify
      await page.locator('button[onclick="classifyPoint()"]').click();

      const results = await page.locator('#results').textContent();
      expect(results).toContain('No data points available');
    });

    test('ClassifyPoint predicts class when data exists and shows neighbors (ClassifyPoint & ToggleNeighbors)', async ({ page }) => {
      // Load sample data
      await page.locator('button[onclick="clearData()"]').click();
      await page.locator('button[onclick="loadSampleData()"]').click();

      // Set test point coordinates near class 0 cluster
      await page.fill('#testX', '0.15');
      await page.fill('#testY', '0.15');
      // Ensure k is 3
      await page.locator('input#kValue').evaluate(el => { el.value = '3'; el.dispatchEvent(new Event('input', { bubbles: true })); });

      // Click classify
      await page.locator('button[onclick="classifyPoint()"]').click();

      const resultsHTML = await page.locator('#results').innerHTML();
      expect(resultsHTML).toContain('Predicted class');

      // Toggle neighbors visualization and verify internal flag toggles
      const beforeShowNeighbors = await page.evaluate(() => window.showNeighbors);
      await page.locator('button[onclick="toggleNeighbors()"]').click();
      const afterShowNeighbors = await page.evaluate(() => window.showNeighbors);
      expect(afterShowNeighbors).toBe(!beforeShowNeighbors);
    });

    test('AddTestPointToData requires classification first and then adds point (AddTestPointToData)', async ({ page }) => {
      await page.locator('button[onclick="clearData()"]').click();

      // Try adding test point without classification - should alert
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.locator('button[onclick="addTestPointToData()"]').click()
      ]);
      // The app shows alert 'Please classify the point first'
      expect(dialog.message()).toContain('Please classify the point first');
      await dialog.accept();

      // Load sample data and classify
      await page.locator('button[onclick="loadSampleData()"]').click();
      await page.fill('#testX', '0.15');
      await page.fill('#testY', '0.15');
      await page.locator('button[onclick="classifyPoint()"]').click();

      // Now add the classified test point to the dataset
      const before = await getDataRowCount(page);
      await page.locator('button[onclick="addTestPointToData()"]').click();
      await page.waitForTimeout(50);
      const after = await getDataRowCount(page);
      expect(after).toBe(before + 1);

      // Verify test inputs reset to default 0.5
      const testXVal = await page.inputValue('#testX');
      const testYVal = await page.inputValue('#testY');
      expect(testXVal).toBe('0.5');
      expect(testYVal).toBe('0.5');

      // Results cleared
      const resultsText = await page.locator('#results').textContent();
      expect(resultsText.trim()).toBe('');
    });
  });

  test.describe('Visualization toggles and decision boundary', () => {
    test('ToggleDecisionBoundary toggles internal flag and draw occurs (ToggleDecisionBoundary & drawDecisionBoundary)', async ({ page }) => {
      // Ensure deterministic start
      await page.locator('button[onclick="clearData()"]').click();
      // Confirm initial state
      const initial = await page.evaluate(() => window.showDecisionBoundary);
      // Toggle
      await page.locator('button[onclick="toggleDecisionBoundary()"]').click();
      const after = await page.evaluate(() => window.showDecisionBoundary);
      expect(after).toBe(!initial);

      // Toggle back
      await page.locator('button[onclick="toggleDecisionBoundary()"]').click();
      const after2 = await page.evaluate(() => window.showDecisionBoundary);
      expect(after2).toBe(initial);
    });
  });

  test.describe('Canvas-based KNN internals', () => {
    test('findNearestNeighbors and predictClass behave as expected on a small dataset', async ({ page }) => {
      // Clear and add specific points to control neighbors
      await page.locator('button[onclick="clearData()"]').click();

      // Use evaluate to call addPoint in page context for deterministic coordinates
      await page.evaluate(() => {
        // Add one class 0 near (0.1,0.1)
        addPoint(0.1, 0.1, 0);
        // Add two class 1 near (0.9,0.9)
        addPoint(0.9, 0.9, 1);
        addPoint(0.85, 0.9, 1);
      });

      // Place test point near (0.12, 0.1) and set k=3
      await page.fill('#testX', '0.12');
      await page.fill('#testY', '0.10');
      await page.locator('input#kValue').evaluate(el => { el.value = '3'; el.dispatchEvent(new Event('input', { bubbles: true })); });

      // Classify - expected predicted class likely class 0 because neighbor at .1,.1 is close, but two class1 are far.
      await page.locator('button[onclick="classifyPoint()"]').click();
      const results = await page.locator('#results').textContent();
      expect(results).toContain('Predicted class');

      // Verify the testPoint.class variable matches predicted class shown in results
      const predictedClass = await page.evaluate(() => window.testPoint.class);
      expect(String(results)).toContain(`Class ${predictedClass}`);
    });
  });
});