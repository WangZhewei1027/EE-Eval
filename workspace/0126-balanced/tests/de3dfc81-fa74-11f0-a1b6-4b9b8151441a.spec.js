import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3dfc81-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Logistic Regression Visualization - FSM states and events', () => {
  // Collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console 'error' messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : null
        });
      }
    });

    // Capture uncaught page errors (runtime exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err.message ? err.message : String(err));
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Basic sanity expectations about console/page errors are asserted in each test explicitly.
  });

  test('Initial Idle state (S0_Idle): charts initialized and data generated on load', async ({ page }) => {
    // This test validates onEnter actions for the Idle state:
    // - initCharts() creates scatterChart and costChart
    // - generateData() populates dataPoints and updates the scatter plot
    // We assert the presence of chart objects and that data was generated.

    // Wait until scatterChart and costChart globals are defined and dataPoints populated
    await page.waitForFunction(() => {
      return typeof window.scatterChart !== 'undefined'
        && typeof window.costChart !== 'undefined'
        && Array.isArray(window.dataPoints)
        && window.dataPoints.length > 0;
    }, null, { timeout: 5000 });

    // Inspect chart internals from the page context
    const initialState = await page.evaluate(() => {
      return {
        scatterExists: !!window.scatterChart,
        costExists: !!window.costChart,
        dataPointsLength: window.dataPoints ? window.dataPoints.length : 0,
        scatterDatasetsCount: window.scatterChart ? window.scatterChart.data.datasets.length : 0,
        class0Count: window.scatterChart ? window.scatterChart.data.datasets[0].data.length : 0,
        class1Count: window.scatterChart ? window.scatterChart.data.datasets[1].data.length : 0,
        costDataPoints: window.costChart ? window.costChart.data.datasets[0].data.length : 0,
        weights: window.weights ? window.weights.slice() : null,
        bias: typeof window.bias !== 'undefined' ? window.bias : null
      };
    });

    // Assertions
    expect(initialState.scatterExists).toBeTruthy();
    expect(initialState.costExists).toBeTruthy();
    expect(initialState.dataPointsLength).toBeGreaterThan(0);
    expect(initialState.scatterDatasetsCount).toBe(2);
    expect(initialState.class0Count).toBeGreaterThan(0);
    expect(initialState.class1Count).toBeGreaterThan(0);
    // On initial generateData call (from onload) costHistory should have been reset -> cost dataset length 0
    expect(initialState.costDataPoints).toBe(0);
    // weights and bias should be reset to zeros after generateData()
    expect(Array.isArray(initialState.weights)).toBeTruthy();
    expect(initialState.weights[0]).toBe(0);
    expect(initialState.weights[1]).toBe(0);
    expect(initialState.bias).toBe(0);

    // Validate no runtime page errors or console errors were observed during load
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('Generate New Data event (S0_Idle -> S1_DataGenerated): clicking button regenerates data and clears decision boundary', async ({ page }) => {
    // This test validates the GenerateData event:
    // - Clicking '#generateData' regenerates dataPoints and resets model state
    // - Decision boundary must be removed (datasets length back to 2)

    // Ensure initial data exists
    await page.waitForFunction(() => window.dataPoints && window.dataPoints.length > 0, null, { timeout: 5000 });

    // Record old dataset counts to detect change
    const before = await page.evaluate(() => {
      return {
        dataPointsLength: window.dataPoints.length,
        scatterDatasetsCount: window.scatterChart ? window.scatterChart.data.datasets.length : 0,
        lastDecisionLabel: window.scatterChart && window.scatterChart.data.datasets.length > 2
          ? window.scatterChart.data.datasets[window.scatterChart.data.datasets.length - 1].label
          : null
      };
    });

    // Click the Generate New Data button
    await page.click('#generateData');

    // Wait for dataPoints to change or scatter datasets to update
    await page.waitForFunction(
      (prevLength) => {
        return window.dataPoints && window.dataPoints.length !== prevLength && window.scatterChart && window.scatterChart.data.datasets.length === 2;
      },
      before.dataPointsLength,
      { timeout: 5000 }
    );

    // Inspect new state
    const after = await page.evaluate(() => {
      return {
        dataPointsLength: window.dataPoints.length,
        scatterDatasetsCount: window.scatterChart.data.datasets.length,
        class0Count: window.scatterChart.data.datasets[0].data.length,
        class1Count: window.scatterChart.data.datasets[1].data.length,
        // decision boundary removed? datasets should be exactly 2 for only two classes
        hasDecisionBoundary: window.scatterChart.data.datasets.length > 2,
        weights: window.weights.slice(),
        bias: window.bias,
        costDataPoints: window.costChart.data.datasets[0].data.length
      };
    });

    expect(after.dataPointsLength).toBeGreaterThan(0);
    expect(after.scatterDatasetsCount).toBe(2);
    expect(after.class0Count).toBeGreaterThan(0);
    expect(after.class1Count).toBeGreaterThan(0);
    expect(after.hasDecisionBoundary).toBe(false);
    // weights and bias reset on generateData
    expect(after.weights[0]).toBe(0);
    expect(after.weights[1]).toBe(0);
    expect(after.bias).toBe(0);
    // cost chart should be reset to zero data points
    expect(after.costDataPoints).toBe(0);

    // Validate no runtime page errors or console errors during the interaction
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('AdjustLearningRate and AdjustEpochs events update the displayed values', async ({ page }) => {
    // This test validates the input events:
    // - Adjusting '#learningRate' updates '#lrValue'
    // - Adjusting '#epochs' updates '#epochsValue'
    // We simulate 'input' events and verify the displayed spans are updated accordingly.

    // Set learning rate to 0.05 via DOM manipulation and dispatch input event
    await page.$eval('#learningRate', (el) => {
      el.value = '0.05';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Set epochs to 2000 via DOM manipulation and dispatch input event
    await page.$eval('#epochs', (el) => {
      el.value = '2000';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Wait for UI textContent updates
    await page.waitForFunction(() => {
      return document.getElementById('lrValue').textContent.trim() === '0.05' &&
             document.getElementById('epochsValue').textContent.trim() === '2000';
    }, null, { timeout: 2000 });

    // Read values back
    const displayed = await page.evaluate(() => {
      return {
        lrValueText: document.getElementById('lrValue').textContent.trim(),
        epochsValueText: document.getElementById('epochsValue').textContent.trim(),
        lrInputValue: document.getElementById('learningRate').value,
        epochsInputValue: document.getElementById('epochs').value,
        lrMin: document.getElementById('learningRate').getAttribute('min'),
        lrMax: document.getElementById('learningRate').getAttribute('max'),
        epochsMin: document.getElementById('epochs').getAttribute('min'),
        epochsMax: document.getElementById('epochs').getAttribute('max')
      };
    });

    expect(displayed.lrValueText).toBe('0.05');
    expect(displayed.lrInputValue).toBe('0.05');
    expect(displayed.epochsValueText).toBe('2000');
    expect(displayed.epochsInputValue).toBe('2000');

    // Basic attribute sanity checks
    expect(displayed.lrMin).toBe('0.001');
    expect(displayed.lrMax).toBe('0.1');
    expect(displayed.epochsMin).toBe('100');
    expect(displayed.epochsMax).toBe('5000');

    // Validate no runtime page errors or console errors during the input interactions
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('Train Model event (S1_DataGenerated -> S2_ModelTrained): model trains, cost history recorded, decision boundary drawn', async ({ page }) => {
    // This test validates the TrainModel event and entry actions for S2_ModelTrained:
    // - trainModel() should update weights, bias, push costHistory entries, update costChart,
    //   and draw a decision boundary dataset on the scatterChart.
    //
    // To keep the test fast and deterministic we lower epochs to 100 and set a reasonable learning rate.
    // We rely on DOM input manipulation to set epochs and learning rate, then click the Train Model button.
    // After the synchronous training completes, we assert chart internals and model parameter changes.

    // Ensure data exists (generateData called on load)
    await page.waitForFunction(() => window.dataPoints && window.dataPoints.length > 0, null, { timeout: 5000 });

    // Set training parameters to faster values for testing
    await page.$eval('#learningRate', el => { el.value = '0.01'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.$eval('#epochs', el => { el.value = '100'; el.dispatchEvent(new Event('input', { bubbles: true })); });

    // Ensure UI shows our set values
    await page.waitForFunction(() => document.getElementById('lrValue').textContent.trim() === '0.01' &&
                                      document.getElementById('epochsValue').textContent.trim() === '100', null, { timeout: 2000 });

    // Capture model state before training
    const beforeTrain = await page.evaluate(() => {
      return {
        weights: window.weights ? window.weights.slice() : null,
        bias: typeof window.bias !== 'undefined' ? window.bias : null,
        costHistoryLength: Array.isArray(window.costHistory) ? window.costHistory.length : 0,
        scatterDatasetsCount: window.scatterChart ? window.scatterChart.data.datasets.length : 0
      };
    });

    // Sanity: before training weights should be zeros from generateData
    expect(beforeTrain.weights[0]).toBe(0);
    expect(beforeTrain.weights[1]).toBe(0);
    expect(beforeTrain.bias).toBe(0);
    expect(beforeTrain.scatterDatasetsCount).toBeGreaterThanOrEqual(2);

    // Click Train Model button (trainModel is synchronous but may take some time)
    await page.click('#trainModel');

    // Wait until costHistory has at least one entry and decision boundary dataset appears
    await page.waitForFunction(() => {
      return Array.isArray(window.costHistory) && window.costHistory.length > 0 &&
             window.scatterChart && window.scatterChart.data.datasets.length > 2;
    }, null, { timeout: 10000 });

    // Read state after training
    const afterTrain = await page.evaluate(() => {
      const scatter = window.scatterChart;
      const cost = window.costChart;
      const decisionSet = scatter.data.datasets.length > 2 ? scatter.data.datasets[scatter.data.datasets.length - 1] : null;

      return {
        weights: window.weights.slice(),
        bias: window.bias,
        costHistoryLength: window.costHistory.length,
        costChartLabelsLength: cost.data.labels.length,
        costChartDataPoints: cost.data.datasets[0].data.length,
        scatterDatasetsCount: scatter.data.datasets.length,
        decisionLabel: decisionSet ? decisionSet.label : null,
        decisionPointsCount: decisionSet ? decisionSet.data.length : 0
      };
    });

    // Check that training updated weights/bias (they should not remain all zeros)
    const weightsChanged = !(afterTrain.weights[0] === 0 && afterTrain.weights[1] === 0 && afterTrain.bias === 0);
    expect(weightsChanged).toBeTruthy();

    // Cost history should have entries (with epochs=100 and pushing every 10 epochs, expect 10 or 11 entries)
    expect(afterTrain.costHistoryLength).toBeGreaterThan(0);
    expect(afterTrain.costChartDataPoints).toBe(afterTrain.costHistoryLength);
    expect(afterTrain.costChartLabelsLength).toBe(afterTrain.costHistoryLength);

    // Decision boundary dataset must have been added
    expect(afterTrain.scatterDatasetsCount).toBeGreaterThanOrEqual(3);
    expect(afterTrain.decisionLabel).toContain('Decision Boundary');
    expect(afterTrain.decisionPointsCount).toBeGreaterThan(0);

    // Validate no runtime page errors or console errors during training
    // Training does some math which can be sensitive to numerical issues; assert that no uncaught exceptions occurred.
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('Edge case: training with minimal learning rate and minimal epochs still produces cost entries and decision boundary', async ({ page }) => {
    // This test explores edge cases:
    // - Set learningRate to minimum and epochs to minimum (as per input attributes)
    // - Ensure training runs without throwing and produces cost entries and a decision boundary.
    // This helps validate numerical stability and input handling edge cases.

    // Ensure ready
    await page.waitForFunction(() => window.dataPoints && window.dataPoints.length > 0, null, { timeout: 5000 });

    // Set to minimal values defined by attributes
    await page.$eval('#learningRate', el => { el.value = el.getAttribute('min'); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.$eval('#epochs', el => { el.value = el.getAttribute('min'); el.dispatchEvent(new Event('input', { bubbles: true })); });

    // Confirm displayed values updated
    await page.waitForFunction(() => document.getElementById('lrValue').textContent.trim() === document.getElementById('learningRate').getAttribute('min') &&
                                      document.getElementById('epochsValue').textContent.trim() === document.getElementById('epochs').getAttribute('min'),
                                null, { timeout: 2000 });

    // Click Train Model
    await page.click('#trainModel');

    // With epochs at min (100), costHistory should still get entries (>0) and decision boundary drawn
    await page.waitForFunction(() => Array.isArray(window.costHistory) && window.costHistory.length > 0 &&
                                     window.scatterChart && window.scatterChart.data.datasets.length > 2, null, { timeout: 10000 });

    const edgeResult = await page.evaluate(() => {
      const costEntries = window.costHistory.length;
      const scatterCount = window.scatterChart.data.datasets.length;
      const decisionSet1 = scatterCount > 2 ? window.scatterChart.data.datasets[window.scatterChart.data.datasets.length - 1] : null;
      return {
        costEntries,
        scatterCount,
        decisionLabel: decisionSet ? decisionSet.label : null
      };
    });

    expect(edgeResult.costEntries).toBeGreaterThan(0);
    expect(edgeResult.scatterCount).toBeGreaterThanOrEqual(3);
    expect(edgeResult.decisionLabel).toContain('Decision Boundary');

    // Validate no uncaught exceptions occurred during this edge scenario
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });
});