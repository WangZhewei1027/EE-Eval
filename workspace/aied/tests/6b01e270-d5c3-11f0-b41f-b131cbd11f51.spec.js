import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b01e270-d5c3-11f0-b41f-b131cbd11f51.html';

test.describe.serial('KNN Visualization - FSM state and transitions (6b01e270-d5c3-11f0-b41f-b131cbd11f51)', () => {
  // We'll capture console messages and page errors for each test,
  // so we can both observe runtime problems and assert none occur unexpectedly.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions / runtime errors
    page.on('pageerror', err => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Load the page and wait for onload handlers
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for chart global to initialize; chart is created on window.onload
    await page.waitForFunction(() => typeof window.chart !== 'undefined' && window.chart !== null);
  });

  test.afterEach(async () => {
    // Sanity check: fail test if any uncaught page errors were observed.
    // The application should run without uncaught errors; record captured console messages for debugging.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
    expect(pageErrors, `Page errors: ${JSON.stringify(pageErrors)} | Console errors: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(consoleErrors.length, `Console error entries found: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Initial state (S0_Idle) - onEnter actions executed and UI initialized', async ({ page }) => {
    // Validate UI initial values from FSM entry actions: initChart() and updateChart()
    // 1) kValueDisplay should reflect default kValue = 3
    const kDisplay = await page.locator('#kValueDisplay').textContent();
    expect(kDisplay?.trim()).toBe('3');

    // 2) testX/testY displays initial 0.5
    const testXDisplay = await page.locator('#testXDisplay').textContent();
    const testYDisplay = await page.locator('#testYDisplay').textContent();
    expect(testXDisplay?.trim()).toBe('0.50');
    expect(testYDisplay?.trim()).toBe('0.50');

    // 3) Chart object should exist and datasets should reflect training data presence
    const datasetCounts = await page.evaluate(() => {
      return {
        classA: window.chart.data.datasets[0].data.length,
        classB: window.chart.data.datasets[1].data.length,
        testPoint: window.chart.data.datasets[2].data.length,
        neighbors: window.chart.data.datasets[3].data.length
      };
    });
    // initial training data had 8 points split across classes (A and B)
    expect(datasetCounts.classA + datasetCounts.classB).toBe(8);
    expect(datasetCounts.testPoint).toBe(1);

    // 4) Prediction result and neighbors info should be populated by updateChart()
    const predictionResult = await page.locator('#predictionResult').textContent();
    const neighborsInfo = await page.locator('#neighborsInfo').textContent();
    expect(predictionResult).toContain('Prediction:');
    expect(predictionResult).toContain('K value:');
    expect(neighborsInfo).toContain('Nearest Neighbors:');

    // No page errors or console errors should have occurred up to this point (checked in afterEach)
  });

  test('K_VALUE_CHANGE transition updates kValue display and prediction (set K to 5 then to edge values)', async ({ page }) => {
    // Change K value to 5 and dispatch input event to trigger handler
    await page.locator('#kValue').evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, '5');

    // Validate display updated
    const kDisplayAfter = await page.locator('#kValueDisplay').textContent();
    expect(kDisplayAfter?.trim()).toBe('5');

    // Prediction result should reflect the new K value
    const predAfter = await page.locator('#predictionResult').textContent();
    expect(predAfter).toContain('K value: 5');

    // Edge cases: set to min (1) and max (15) to ensure bounds behave
    await page.locator('#kValue').evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, '1');
    expect((await page.locator('#kValueDisplay').textContent())?.trim()).toBe('1');

    await page.locator('#kValue').evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, '15');
    expect((await page.locator('#kValueDisplay').textContent())?.trim()).toBe('15');

    // Ensure prediction result says K value: 15 after setting to 15
    expect((await page.locator('#predictionResult').textContent())).toContain('K value: 15');
  });

  test('TEST_X_CHANGE and TEST_Y_CHANGE transitions update test point and chart', async ({ page }) => {
    // Set testX to 0.25
    await page.locator('#testX').evaluate((el, val) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, '0.25');

    // Set testY to 0.75
    await page.locator('#testY').evaluate((el, val) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, '0.75');

    // Validate displays updated to two decimals
    expect((await page.locator('#testXDisplay').textContent())?.trim()).toBe('0.25');
    expect((await page.locator('#testYDisplay').textContent())?.trim()).toBe('0.75');

    // Prediction result should reflect the test point coordinates
    const predictionText = await page.locator('#predictionResult').textContent();
    expect(predictionText).toContain('(0.25, 0.75)');

    // Validate chart's test point dataset updated as well (dataset index 2)
    const chartTestPoint = await page.evaluate(() => {
      return window.chart.data.datasets[2].data[0];
    });
    // Values stored as numbers approximately equal
    expect(Number(chartTestPoint.x).toFixed(2)).toBe('0.25');
    expect(Number(chartTestPoint.y).toFixed(2)).toBe('0.75');
  });

  test('ADD_RANDOM_POINT transition adds a training point and updates datasets', async ({ page }) => {
    // Get current total training points
    const totalBefore = await page.evaluate(() => {
      return window.chart.data.datasets[0].data.length + window.chart.data.datasets[1].data.length;
    });

    // Click "Add Random Training Point" button
    await page.click('button[onclick="addRandomPoint()"]');

    // After click, total training points should increase by 1
    // Wait for any synchronous updates (updateChartData/updateChart are synchronous)
    const totalAfter = await page.evaluate(() => {
      return window.chart.data.datasets[0].data.length + window.chart.data.datasets[1].data.length;
    });
    expect(totalAfter).toBe(totalBefore + 1);

    // Neighbors info should still be populated (string contains "Nearest Neighbors")
    const neighborsInfoAfter = await page.locator('#neighborsInfo').textContent();
    expect(neighborsInfoAfter).toContain('Nearest Neighbors:');
  });

  test('RESET_DATA transition restores training data and UI values', async ({ page }) => {
    // First, modify state: add random point to change from initial
    await page.click('button[onclick="addRandomPoint()"]');
    const totalAfterAdd = await page.evaluate(() => window.chart.data.datasets[0].data.length + window.chart.data.datasets[1].data.length);
    expect(totalAfterAdd).toBeGreaterThanOrEqual(9); // at least 9 after addition

    // Now click reset
    await page.click('button[onclick="resetData()"]');

    // After reset, total training points should be back to the initial 8
    const totalAfterReset = await page.evaluate(() => window.chart.data.datasets[0].data.length + window.chart.data.datasets[1].data.length);
    expect(totalAfterReset).toBe(8);

    // kValue and testPoint displays should be reset to defaults
    expect((await page.locator('#kValueDisplay').textContent())?.trim()).toBe('3');
    expect((await page.locator('#testXDisplay').textContent())?.trim()).toBe('0.50');
    expect((await page.locator('#testYDisplay').textContent())?.trim()).toBe('0.50');

    // Prediction result should match reset test point
    const predReset = await page.locator('#predictionResult').textContent();
    expect(predReset).toContain('(0.50, 0.50)');
    expect(predReset).toContain('K value: 3');
  });

  test('Clicking on canvas sets test point (chart onClick handler) and updates displays', async ({ page }) => {
    // Record previous testX/testY
    const prevX = (await page.locator('#testXDisplay').textContent())?.trim();
    const prevY = (await page.locator('#testYDisplay').textContent())?.trim();

    // Click approximately center of the canvas to trigger onClick handler
    const canvas = page.locator('#knnChart');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    // Click at center
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    // After click, testXDisplay and testYDisplay should update and differ from previous values
    const newX = (await page.locator('#testXDisplay').textContent())?.trim();
    const newY = (await page.locator('#testYDisplay').textContent())?.trim();
    // It's possible the click maps to the same 0.50 if center is exactly that; we validate it's a properly formatted value
    expect(newX).toMatch(/^\d\.\d{2}$/);
    expect(newY).toMatch(/^\d\.\d{2}$/);

    // Ensure the chart's test point dataset matches the displayed values
    const chartPoint = await page.evaluate(() => window.chart.data.datasets[2].data[0]);
    expect(Number(chartPoint.x).toFixed(2)).toBe(newX);
    expect(Number(chartPoint.y).toFixed(2)).toBe(newY);
  });

  test('Edge cases: set testX/testY to 0 and 1 and verify neighbors/prediction behave without errors', async ({ page }) => {
    // Set both sliders to extremes 0 and 1
    await page.locator('#testX').evaluate((el) => {
      el.value = '0';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('#testY').evaluate((el) => {
      el.value = '1';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Validate displays
    expect((await page.locator('#testXDisplay').textContent())?.trim()).toBe('0.00');
    expect((await page.locator('#testYDisplay').textContent())?.trim()).toBe('1.00');

    // Prediction and neighbors info should still populate
    const predEdge = await page.locator('#predictionResult').textContent();
    const neighborsEdge = await page.locator('#neighborsInfo').textContent();
    expect(predEdge).toContain('Prediction:');
    expect(neighborsEdge).toContain('Nearest Neighbors:');
  });

  test('State invariants and expected DOM changes across multiple interactions', async ({ page }) => {
    // Perform a sequence: set K=7, move test point, add random point, reset
    await page.locator('#kValue').evaluate((el) => { el.value = '7'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('#testX').evaluate((el) => { el.value = '0.33'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('#testY').evaluate((el) => { el.value = '0.66'; el.dispatchEvent(new Event('input', { bubbles: true })); });

    // Capture state after inputs
    const afterInputs = await page.evaluate(() => ({
      k: document.getElementById('kValueDisplay').textContent,
      tx: document.getElementById('testXDisplay').textContent,
      ty: document.getElementById('testYDisplay').textContent,
      trainingCount: window.chart.data.datasets[0].data.length + window.chart.data.datasets[1].data.length
    }));
    expect(afterInputs.k?.trim()).toBe('7');
    expect(afterInputs.tx?.trim()).toBe('0.33');
    expect(afterInputs.ty?.trim()).toBe('0.66');

    // Add random training point
    await page.click('button[onclick="addRandomPoint()"]');
    const afterAddCount = await page.evaluate(() => window.chart.data.datasets[0].data.length + window.chart.data.datasets[1].data.length);
    expect(afterAddCount).toBe(afterInputs.trainingCount + 1);

    // Reset and ensure back to initial invariants
    await page.click('button[onclick="resetData()"]');
    const afterReset = await page.evaluate(() => ({
      k: document.getElementById('kValueDisplay').textContent,
      tx: document.getElementById('testXDisplay').textContent,
      ty: document.getElementById('testYDisplay').textContent,
      trainingCount: window.chart.data.datasets[0].data.length + window.chart.data.datasets[1].data.length
    }));
    expect(afterReset.k?.trim()).toBe('3');
    expect(afterReset.tx?.trim()).toBe('0.50');
    expect(afterReset.ty?.trim()).toBe('0.50');
    expect(afterReset.trainingCount).toBe(8);
  });
});