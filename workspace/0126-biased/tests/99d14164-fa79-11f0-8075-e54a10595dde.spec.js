import { test, expect } from '@playwright/test';

// URL of the served HTML page
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d14164-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the Overfitting Demonstration page
class OverfittingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // selectors from the provided HTML
    this.h1 = 'h1';
    this.numPointsInput = '#data-points';
    this.generateBtn = '#generate-data';
    this.clearBtn = '#clear-data';
    this.modelComplexity = '#model-complexity';
    this.complexityValue = '#complexity-value';
    this.trainBtn = '#train-model';
    this.showPlotBtn = '#show-plot';
    this.dataVisualization = '#data-visualization';
    this.resultSpan = '#result';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for main heading to ensure page rendered
    await this.page.waitForSelector(this.h1);
  }

  async getHeadingText() {
    return (await this.page.textContent(this.h1)) || '';
  }

  async getResultText() {
    return (await this.page.textContent(this.resultSpan)) || '';
  }

  async setNumPoints(n) {
    await this.page.fill(this.numPointsInput, String(n));
  }

  async clickGenerate() {
    await this.page.click(this.generateBtn);
  }

  async clickClear() {
    await this.page.click(this.clearBtn);
  }

  async setModelComplexity(value) {
    // using evaluate to set value and dispatch input event to mimic user input more reliably
    await this.page.$eval(this.modelComplexity, (el, v) => {
      el.value = String(v);
      const ev = new Event('input', { bubbles: true });
      el.dispatchEvent(ev);
    }, value);
  }

  async getComplexityValueText() {
    return (await this.page.textContent(this.complexityValue)) || '';
  }

  async clickTrain() {
    await this.page.click(this.trainBtn);
  }

  async clickShowPlot() {
    await this.page.click(this.showPlotBtn);
  }
}

// Group related tests
test.describe('Overfitting Demonstration - FSM validation and UI tests', () => {
  // shared variables for capturing console and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Ensure no unexpected uncaught exceptions bubbled up
    expect(pageErrors, 'There should be no uncaught page errors').toEqual([]);
    // No console errors either (other types like log/warn are acceptable)
    const consoleErrors = consoleMessages.filter((c) => c.type === 'error');
    expect(consoleErrors, 'There should be no console.error messages').toEqual([]);
    // Close page after each test (Playwright will normally handle this, but explicit is fine)
    await page.close();
  });

  test('Initial State (S0_Idle) - page renders and initial DOM is correct', async ({ page }) => {
    // Validate initial render according to S0_Idle
    const app = new OverfittingPage(page);
    await app.goto();

    // Expect header present
    const heading = await app.getHeadingText();
    expect(heading.trim()).toBe('Overfitting Demonstration');

    // Expect initial result to be 'N/A'
    const result = await app.getResultText();
    expect(result.trim()).toBe('N/A');

    // Ensure complexity display shows default '1'
    const complexityText = await app.getComplexityValueText();
    expect(complexityText.trim()).toBe('1');
  });

  test.describe('Data Generation and Clearing (S1_DataGenerated -> S2_DataCleared)', () => {
    test('Generate Data transitions to Data Generated state and updates result', async ({ page }) => {
      // This test validates GenerateData event and S1_DataGenerated evidence
      const app = new OverfittingPage(page);
      await app.goto();

      // Set number of points and generate
      await app.setNumPoints(5);
      await app.clickGenerate();

      // Expect result text to reflect generated points
      const result = await app.getResultText();
      expect(result).toBe('Data generated. 5 points created.');

      // Data visualization remains empty until Show Plot clicked
      const viz = await page.textContent(app.dataVisualization);
      expect(viz.trim()).toBe('');
    });

    test('Clear Data transitions to Data Cleared state and updates result', async ({ page }) => {
      // Validate ClearData event and S2_DataCleared evidence
      const app = new OverfittingPage(page);
      await app.goto();

      // Generate some data first
      await app.setNumPoints(3);
      await app.clickGenerate();
      expect(await app.getResultText()).toBe('Data generated. 3 points created.');

      // Now clear
      await app.clickClear();
      expect(await app.getResultText()).toBe('Data cleared.');
    });
  });

  test.describe('Model Complexity Adjustment and Training (S1_DataGenerated -> S3_ModelTrained / S4_Alert)', () => {
    test('Adjust model complexity updates displayed complexity (AdjustModelComplexity event)', async ({ page }) => {
      // Validate AdjustModelComplexity event and evidence
      const app = new OverfittingPage(page);
      await app.goto();

      // Move slider to 7
      await app.setModelComplexity(7);
      const complexityText = await app.getComplexityValueText();
      expect(complexityText.trim()).toBe('7');
    });

    test('Train Model without data triggers Alert (guard: dataPoints.length === 0 -> S4_Alert)', async ({ page }) => {
      // Validate TrainModel guard condition leading to alert when no data present
      const app = new OverfittingPage(page);
      await app.goto();

      // Ensure data is cleared / none present
      await app.clickClear();

      // Listen for dialog, clicking train should trigger alert
      const dialogs = [];
      page.on('dialog', (dialog) => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        dialog.dismiss(); // dismiss to continue
      });

      await app.clickTrain();

      // We expect exactly one alert dialog with guard message
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const found = dialogs.some(d => d.message === 'Please generate data points before training the model.');
      expect(found).toBe(true);

      // result text remains 'Data cleared.' after guard-triggered alert
      expect(await app.getResultText()).toBe('Data cleared.');
    });

    test('Train Model with data trains and reports an error rate (S3_ModelTrained)', async ({ page }) => {
      // Validate TrainModel event in presence of data; S3 evidence contains an error rate
      const app = new OverfittingPage(page);
      await app.goto();

      // Generate data and set complexity
      await app.setNumPoints(8);
      await app.clickGenerate();
      expect(await app.getResultText()).toBe('Data generated. 8 points created.');

      // Set complexity to 4
      await app.setModelComplexity(4);
      expect(await app.getComplexityValueText()).toBe('4');

      // Train the model
      await app.clickTrain();

      // The result text should match the pattern "Model trained with complexity 4. Error rate: X.XXXX"
      const result = await app.getResultText();
      expect(result.startsWith('Model trained with complexity 4. Error rate:')).toBe(true);

      // Validate the error rate formatting (four decimal places)
      const match = result.match(/Error rate:\s*([0-9]*\.[0-9]{4})$/);
      expect(match, 'Result should contain an error rate with 4 decimals').not.toBeNull();
      // Also ensure the numeric value is a finite number
      if (match) {
        const num = parseFloat(match[1]);
        expect(Number.isFinite(num)).toBe(true);
      }
    });

    test('Train Model after clearing data triggers alert again (edge case)', async ({ page }) => {
      // Generate data, clear it, then attempt train -> should alert (guard)
      const app = new OverfittingPage(page);
      await app.goto();

      await app.setNumPoints(2);
      await app.clickGenerate();
      expect(await app.getResultText()).toBe('Data generated. 2 points created.');

      // Clear and verify
      await app.clickClear();
      expect(await app.getResultText()).toBe('Data cleared.');

      // Capture dialog
      let alerted = false;
      page.on('dialog', (dialog) => {
        if (dialog.message().includes('Please generate data points before training the model.')) {
          alerted = true;
        }
        dialog.dismiss();
      });

      await app.clickTrain();
      expect(alerted).toBe(true);
    });
  });

  test.describe('Visualization (ShowPlot event) and Dialog content', () => {
    test('Show Plot displays alert containing data visualization lines for each point', async ({ page }) => {
      // Validate ShowPlot event and S1_DataGenerated->S1_DataGenerated evidence for visualization content
      const app = new OverfittingPage(page);
      await app.goto();

      const NUM = 4;
      await app.setNumPoints(NUM);
      await app.clickGenerate();
      expect(await app.getResultText()).toBe(`Data generated. ${NUM} points created.`);

      // Capture the plot alert dialog
      let dialogMessage = null;
      page.on('dialog', (dialog) => {
        dialogMessage = dialog.message();
        dialog.dismiss();
      });

      await app.clickShowPlot();

      // Assert dialog was shown with expected structure
      expect(dialogMessage, 'Show Plot should trigger an alert with visualization content').not.toBeNull();
      expect(dialogMessage.startsWith('Data Visualization:')).toBe(true);

      // Count points lines in the dialog message (Point 1:, Point 2:, ...)
      const pointMatches = dialogMessage.match(/Point\s+\d+:/g) || [];
      expect(pointMatches.length).toBe(NUM);
    });

    test('Show Plot with no data shows header but no points (edge case)', async ({ page }) => {
      // If no data has been generated, the alert will show "Data Visualization:" with empty content
      const app = new OverfittingPage(page);
      await app.goto();

      // Ensure cleared
      await app.clickClear();
      expect(await app.getResultText()).toBe('Data cleared.');

      // Capture dialog
      let dialogMessage = null;
      page.on('dialog', (dialog) => {
        dialogMessage = dialog.message();
        dialog.dismiss();
      });

      await app.clickShowPlot();

      expect(dialogMessage).not.toBeNull();
      // It should at least contain the header
      expect(dialogMessage.startsWith('Data Visualization:')).toBe(true);

      // There should be no 'Point ' occurrences
      const pointMatches = dialogMessage.match(/Point\s+\d+:/g) || [];
      expect(pointMatches.length).toBe(0);
    });
  });

  test.describe('Edge Cases: Input limits and large generation', () => {
    test('Generating maximum allowed points (100) updates the result accordingly', async ({ page }) => {
      const app = new OverfittingPage(page);
      await app.goto();

      // Set to max (100) and generate
      await app.setNumPoints(100);
      await app.clickGenerate();

      expect(await app.getResultText()).toBe('Data generated. 100 points created.');

      // Show plot and ensure it reports 100 points via dialog
      let dialogMessage = null;
      page.on('dialog', (dialog) => {
        dialogMessage = dialog.message();
        dialog.dismiss();
      });

      await app.clickShowPlot();

      expect(dialogMessage).not.toBeNull();
      const pointMatches = dialogMessage.match(/Point\s+\d+:/g) || [];
      expect(pointMatches.length).toBe(100);
    });

    test('Setting model complexity to extremes and training produces valid formatted results', async ({ page }) => {
      const app = new OverfittingPage(page);
      await app.goto();

      // Generate a small dataset
      await app.setNumPoints(5);
      await app.clickGenerate();
      expect(await app.getResultText()).toBe('Data generated. 5 points created.');

      // Test complexity minimal (1)
      await app.setModelComplexity(1);
      expect(await app.getComplexityValueText()).toBe('1');
      await app.clickTrain();
      let res1 = await app.getResultText();
      expect(res1.startsWith('Model trained with complexity 1. Error rate:')).toBe(true);

      // Test complexity maximal (10)
      await app.setModelComplexity(10);
      expect(await app.getComplexityValueText()).toBe('10');
      await app.clickTrain();
      let res2 = await app.getResultText();
      expect(res2.startsWith('Model trained with complexity 10. Error rate:')).toBe(true);

      // Ensure error rate formatting still has four decimals
      expect(res2.match(/Error rate:\s*([0-9]*\.[0-9]{4})$/)).not.toBeNull();
    });
  });
});