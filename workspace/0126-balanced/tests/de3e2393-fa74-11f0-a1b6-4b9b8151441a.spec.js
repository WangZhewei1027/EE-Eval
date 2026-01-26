import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3e2393-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Overfitting Demonstration - FSM Tests (de3e2393-fa74-11f0-a1b6-4b9b8151441a)', () => {
  // Shared arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset captures
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for observation and assertions
    page.on('console', msg => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application and wait for load (window.onload triggers initialization)
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure chart and initial data have time to initialize (window.onload should call initChart & generateData)
    await page.waitForFunction(() => {
      return typeof window.chart !== 'undefined' &&
             Array.isArray(window.trainingData) &&
             Array.isArray(window.testData) &&
             window.trainingData.length > 0 &&
             window.testData.length > 0;
    });
  });

  test.afterEach(async () => {
    // no-op cleanup hook provided for clarity; Playwright handles context cleanup
  });

  test.describe('S0 Idle - Initialization', () => {
    test('page loads and entry actions initChart() and generateData() run (Idle state S0)', async ({ page }) => {
      // Verify chart object and initial datasets were created
      const state = await page.evaluate(() => {
        return {
          hasChart: typeof chart !== 'undefined',
          datasetsCount: chart ? chart.data.datasets.length : 0,
          trainingLength: Array.isArray(trainingData) ? trainingData.length : 0,
          testLength: Array.isArray(testData) ? testData.length : 0,
          dataset0Label: chart ? chart.data.datasets[0].label : null,
          dataset1Label: chart ? chart.data.datasets[1].label : null
        };
      });

      // Assert chart exists and there are three datasets configured
      expect(state.hasChart).toBe(true);
      expect(state.datasetsCount).toBe(3);
      // Assert that generateData populated training and test sets
      expect(state.trainingLength).toBeGreaterThan(0);
      expect(state.testLength).toBeGreaterThan(0);
      // Check labels to ensure correct datasets (training/test)
      expect(state.dataset0Label).toBe('Training Data');
      expect(state.dataset1Label).toBe('Test Data');

      // Assert that no uncaught page errors occurred during initialization
      expect(pageErrors.length, `Unexpected page errors during load: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    });
  });

  test.describe('S1 Data Generated - Generate New Data event/transition', () => {
    test('clicking "Generate New Data" regenerates training and test data (GenerateData event)', async ({ page }) => {
      // Capture a snapshot of current training data for comparison
      const before = await page.evaluate(() => {
        return {
          training: JSON.stringify(trainingData),
          test: JSON.stringify(testData),
          trainingLength: trainingData.length,
          testLength: testData.length
        };
      });

      // Click the "Generate New Data" button
      await page.click("button[onclick='generateData()']");

      // Wait until dataset arrays in chart are updated and differ from previous snapshot
      await page.waitForFunction(
        (prevTrainingStr, prevTestStr) => {
          try {
            return JSON.stringify(window.trainingData) !== prevTrainingStr ||
                   JSON.stringify(window.testData) !== prevTestStr;
          } catch (e) {
            return false;
          }
        },
        before.training,
        before.test
      );

      // Verify chart datasets 0 and 1 reflect the training/test arrays and have nonzero lengths
      const after = await page.evaluate(() => {
        return {
          trainingLength: trainingData.length,
          testLength: testData.length,
          dataset0Length: chart.data.datasets[0].data.length,
          dataset1Length: chart.data.datasets[1].data.length,
          dataset0EqualsTraining: JSON.stringify(chart.data.datasets[0].data) === JSON.stringify(trainingData),
          dataset1EqualsTest: JSON.stringify(chart.data.datasets[1].data) === JSON.stringify(testData)
        };
      });

      expect(after.trainingLength).toBeGreaterThan(0);
      expect(after.testLength).toBeGreaterThan(0);
      expect(after.dataset0Length).toBe(after.trainingLength);
      expect(after.dataset1Length).toBe(after.testLength);
      expect(after.dataset0EqualsTraining).toBe(true);
      expect(after.dataset1EqualsTest).toBe(true);

      // No uncaught page errors for this interaction
      expect(pageErrors.length, `Page errors after Generate Data: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    });
  });

  test.describe('S2 Model Fitted - Fit Model events/transitions', () => {
    // Helper to click a fitModel button and wait for chart to update with model data
    async function clickAndWaitForModel(page, degree) {
      // Click the corresponding button by onclick attribute
      await page.click(`button[onclick='fitModel(${degree})']`);

      // Wait for chart.dataset[2] to have data points and the label to update to include the degree
      await page.waitForFunction(d => {
        if (typeof window.chart === 'undefined') return false;
        const ds = window.chart.data.datasets[2];
        return Array.isArray(ds.data) && ds.data.length > 0 && typeof ds.label === 'string' && ds.label.includes(String(d));
      }, degree);
    }

    test('Fit a linear model (degree 1) updates model dataset (FitModelDegree1)', async ({ page }) => {
      // Click linear degree 1 and wait for model points
      await clickAndWaitForModel(page, 1);

      const modelState = await page.evaluate(() => {
        return {
          modelLength: chart.data.datasets[2].data.length,
          modelLabel: chart.data.datasets[2].label,
          currentModelDegree: currentModelDegree
        };
      });

      expect(modelState.modelLength).toBeGreaterThan(0);
      expect(modelState.modelLabel).toContain('Degree 1');
      expect(modelState.currentModelDegree).toBe(1);

      // No uncaught page errors for this fit operation
      expect(pageErrors.length, `Errors after fitting degree 1: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    });

    test('Fit a cubic model (degree 3) updates model dataset (FitModelDegree3)', async ({ page }) => {
      await clickAndWaitForModel(page, 3);

      const modelState = await page.evaluate(() => {
        return {
          modelLength: chart.data.datasets[2].data.length,
          modelLabel: chart.data.datasets[2].label,
          currentModelDegree: currentModelDegree
        };
      });

      expect(modelState.modelLength).toBeGreaterThan(0);
      expect(modelState.modelLabel).toContain('Degree 3');
      expect(modelState.currentModelDegree).toBe(3);

      expect(pageErrors.length, `Errors after fitting degree 3: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    });

    test('Fit a high degree model (degree 10) updates model dataset (FitModelDegree10)', async ({ page }) => {
      await clickAndWaitForModel(page, 10);

      const modelState = await page.evaluate(() => {
        return {
          modelLength: chart.data.datasets[2].data.length,
          modelLabel: chart.data.datasets[2].label,
          currentModelDegree: currentModelDegree,
          // Inspect a few numerical values to ensure they are finite numbers (not NaN/Infinity)
          firstY: chart.data.datasets[2].data[0] ? chart.data.datasets[2].data[0].y : null,
          someYsFinite: chart.data.datasets[2].data.slice(0, 10).every(p => Number.isFinite(p.y))
        };
      });

      expect(modelState.modelLength).toBeGreaterThan(0);
      expect(modelState.modelLabel).toContain('Degree 10');
      expect(modelState.currentModelDegree).toBe(10);
      // It's acceptable numerically for some instability; however, we assert that at least some y values are finite.
      expect(modelState.someYsFinite).toBe(true);

      // Confirm no unhandled page errors were thrown
      expect(pageErrors.length, `Errors after fitting degree 10: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    });

    test('Fit a very high degree model (degree 20) updates model dataset (FitModelDegree20) and observe numerical stability', async ({ page }) => {
      await clickAndWaitForModel(page, 20);

      const modelState = await page.evaluate(() => {
        // Return stats about the generated polynomial prediction line
        const arr = chart.data.datasets[2].data || [];
        const count = arr.length;
        let finiteCount = 0;
        let nanCount = 0;
        let infCount = 0;
        for (let i = 0; i < arr.length; i++) {
          const v = arr[i].y;
          if (Number.isFinite(v)) finiteCount++;
          else if (Number.isNaN(v)) nanCount++;
          else if (!Number.isFinite(v)) infCount++;
        }
        return {
          modelLength: count,
          modelLabel: chart.data.datasets[2].label,
          currentModelDegree: currentModelDegree,
          finiteCount,
          nanCount,
          infCount
        };
      });

      expect(modelState.modelLength).toBeGreaterThan(0);
      expect(modelState.modelLabel).toContain('Degree 20');
      expect(modelState.currentModelDegree).toBe(20);
      // For a very high-degree fit there may be numerical instability; assert that at least some finite results were produced
      expect(modelState.finiteCount).toBeGreaterThan(0);

      // It's important to capture any page errors; assert none were thrown as unhandled exceptions
      expect(pageErrors.length, `Errors after fitting degree 20: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Calling fitModel when trainingData is empty triggers generateData fallback and does not throw', async ({ page }) => {
      // Clear trainingData and chart dataset 0 to simulate empty training set scenario
      await page.evaluate(() => {
        trainingData = [];
        testData = [];
        if (typeof chart !== 'undefined') {
          chart.data.datasets[0].data = [];
          chart.data.datasets[1].data = [];
          chart.update();
        }
      });

      // Sanity check that trainingData is empty
      const emptyCheck = await page.evaluate(() => trainingData.length);
      expect(emptyCheck).toBe(0);

      // Click fitModel(3) which should detect empty trainingData and call generateData internally
      await page.click("button[onclick='fitModel(3)']");

      // Wait for generateData to populate trainingData and chart again
      await page.waitForFunction(() => {
        return Array.isArray(window.trainingData) && window.trainingData.length > 0 &&
               Array.isArray(window.testData) && window.testData.length > 0;
      });

      // Verify training data repopulated and model dataset generated
      const after = await page.evaluate(() => {
        return {
          trainingLength: trainingData.length,
          testLength: testData.length,
          modelLength: chart.data.datasets[2].data.length,
          modelLabel: chart.data.datasets[2].label,
          currentModelDegree: currentModelDegree
        };
      });

      expect(after.trainingLength).toBeGreaterThan(0);
      expect(after.testLength).toBeGreaterThan(0);
      // After fitModel(3) fallback, the modelDegree should be set to 3 and model data present
      expect(after.currentModelDegree).toBe(3);
      expect(after.modelLength).toBeGreaterThan(0);

      // Ensure no uncaught exceptions bubbled up
      expect(pageErrors.length, `Page errors during fitModel fallback: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    });

    test('UI components exist and have expected text (component-level checks)', async ({ page }) => {
      // Check buttons exist and their visible text content matches expectations
      const texts = await page.$$eval('div.controls button', buttons => buttons.map(b => b.textContent.trim()));
      expect(texts).toContain('Generate New Data');
      expect(texts).toContain('Linear (Degree 1)');
      expect(texts).toContain('Cubic (Degree 3)');
      expect(texts).toContain('High Degree (10)');
      expect(texts).toContain('Very High Degree (20)');

      // Ensure canvas element exists for chart rendering
      const canvasExists = await page.$('canvas#chart');
      expect(canvasExists).not.toBeNull();

      // No page errors from mere DOM existence checks
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console / Page error observation', () => {
    test('collect console messages and assert no uncaught JS errors were thrown during the test session', async ({ page }) => {
      // By this point, previous interactions have been performed within beforeEach/test blocks.
      // We assert that there were no uncaught page errors captured.
      // We also ensure consoleMessages is an array and report a summary if needed.
      expect(Array.isArray(consoleMessages)).toBe(true);

      // Provide a helpful failure message if pageErrors exist
      expect(pageErrors.length, `Uncaught page errors were captured: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

      // If needed for debugging, the test could inspect consoleMessages contents.
      // We assert that at least the page produced some console activity from libraries (not strictly required).
      // However, do not mandate console messages exist (they may be absent depending on environment).
    });
  });
});