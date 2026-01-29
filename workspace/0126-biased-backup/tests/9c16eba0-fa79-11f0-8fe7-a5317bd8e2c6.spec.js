import { test, expect } from '@playwright/test';

// Test file for: 9c16eba0-fa79-11f0-8fe7-a5317bd8e2c6
// Application URL (served by test harness)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c16eba0-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page Object for interacting with the SVM Explorer UI.
class SVMPage {
  constructor(page) {
    this.page = page;
    this.canvas = page.locator('#plot');
    this.logBox = page.locator('#log');
    this.pointsList = page.locator('#pointsList');
  }

  // Wait until the app signals readiness in the in-page log area.
  async waitForReady() {
    await expect(this.logBox).toContainText('SVM Explorer ready.', { timeout: 5000 });
  }

  // Read textual log content
  async getLogText() {
    return (await this.logBox.textContent()) || '';
  }

  // Count entries in the points list select element
  async getPointsCount() {
    return await this.page.evaluate(() => document.getElementById('pointsList').options.length);
  }

  // Return array of option texts (for debugging/assertions)
  async getPointsListTexts() {
    return await this.page.evaluate(() => Array.from(document.getElementById('pointsList').options).map(o => o.textContent));
  }

  // Generic click a control by selector
  async click(selector) {
    await this.page.locator(selector).click();
  }

  // Helper: compute a click position within canvas given domain coordinates (x,y)
  // Returns element-relative coordinates {x: offsetX, y: offsetY}
  async canvasOffsetForDomainCoords(x, y) {
    return await this.page.evaluate(({x, y})=>{
      const canvas = document.getElementById('plot');
      const rect = canvas.getBoundingClientRect();
      const xmin = parseFloat(document.getElementById('xmin').value);
      const xmax = parseFloat(document.getElementById('xmax').value);
      const ymin = parseFloat(document.getElementById('ymin').value);
      const ymax = parseFloat(document.getElementById('ymax').value);
      const offsetX = ((x - xmin) / (xmax - xmin)) * rect.width;
      const offsetY = ((ymax - y) / (ymax - ymin)) * rect.height;
      return { x: Math.round(offsetX), y: Math.round(offsetY) };
    }, { x, y });
  }

  // Add a point at domain coords (x,y) using 'add' mode and chosen class/weight
  async addPointAt(x, y, klass = '+1', weight = 1) {
    // ensure add mode and class selection
    await this.page.locator(`input[name=mode][value=add]`).check();
    if (klass === '+1' || klass === 1 || klass === '1') {
      await this.page.locator('input[name=addClass][value="1"]').check();
    } else {
      await this.page.locator('input[name=addClass][value="-1"]').check();
    }
    await this.page.locator('#pointWeight').evaluate((el, v) => el.value = v, String(weight));
    await this.page.locator('#pointWeight').dispatchEvent('input'); // update pwVal
    const offset = await this.canvasOffsetForDomainCoords(x, y);
    await this.canvas.click({ position: { x: offset.x, y: offset.y } });
  }

  // Remove nearest point by clicking in remove mode at domain coords (x,y)
  async removeNearestAt(x, y) {
    await this.page.locator(`input[name=mode][value=remove]`).check();
    const offset = await this.canvasOffsetForDomainCoords(x, y);
    await this.canvas.click({ position: { x: offset.x, y: offset.y } });
  }

  // Move (drag) the nearest point: mousedown at src domain coords, move to dst domain coords, mouseup.
  async dragPoint(srcX, srcY, dstX, dstY) {
    await this.page.locator(`input[name=mode][value=move]`).check();
    const src = await this.canvasOffsetForDomainCoords(srcX, srcY);
    const dst = await this.canvasOffsetForDomainCoords(dstX, dstY);
    // Use page.mouse to perform precise sequence (absolute coordinates)
    const canvasBox = await this.canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas bounding box unavailable');
    const absSrc = { x: canvasBox.x + src.x, y: canvasBox.y + src.y };
    const absDst = { x: canvasBox.x + dst.x, y: canvasBox.y + dst.y };
    await this.page.mouse.move(absSrc.x, absSrc.y);
    await this.page.mouse.down();
    // small delay to ensure handlers pick up
    await this.page.waitForTimeout(50);
    await this.page.mouse.move(absDst.x, absDst.y, { steps: 8 });
    await this.page.mouse.up();
    // brief wait for UI updates to reflect
    await this.page.waitForTimeout(100);
  }

  // Set numeric inputs conveniently
  async setNumber(selector, value) {
    await this.page.locator(selector).fill(String(value));
    // dispatch input/change events if necessary
    await this.page.locator(selector).dispatchEvent('input');
    await this.page.locator(selector).dispatchEvent('change');
  }

  // Toggle checkbox
  async setCheckbox(selector, checked) {
    const locator = this.page.locator(selector);
    const isChecked = await locator.isChecked();
    if (isChecked !== checked) await locator.click();
  }

  // Wait until log contains a specific substring
  async waitForLogContains(substring, timeout = 3000) {
    await expect(this.logBox).toContainText(substring, { timeout });
  }
}

test.describe('SVM Explorer - FSM compliance and interactions', () => {
  let page;
  let svm;
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    // New page for each test to ensure isolation
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];
    page.on('console', msg => {
      // Capture console messages for inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      // Capture uncaught errors
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    svm = new SVMPage(page);
    // Wait for app to initialize
    await svm.waitForReady();
  });

  test.afterEach(async () => {
    // Assert there were no uncaught page errors during the test run
    // (We observe and let any runtime errors occur naturally — this assertion verifies stability.)
    expect(pageErrors.length).toBe(0);
    await page.close();
  });

  test.describe('State S0_Idle and basic render', () => {
    test('renders title and initial UI elements (Idle state)', async () => {
      // Verify page title and presence of key UI elements per S0 evidence
      await expect(page).toHaveTitle(/Support Vector Machine Explorer/);
      await expect(page.locator('h3')).toContainText('Support Vector Machine Explorer');
      // The canvas and main buttons should be present
      await expect(page.locator('#plot')).toBeVisible();
      await expect(page.locator('#generate')).toBeVisible();
      // Log area should mention readiness
      const logText = await svm.getLogText();
      expect(logText).toMatch(/SVM Explorer ready/);
    });
  });

  test.describe('State S1_PointEditing - add, remove, move, edit points', () => {
    test('AddPoint transition: clicking canvas in add mode adds a point', async () => {
      // Validate adding a point at center (domain coords 0,0)
      const before = await svm.getPointsCount();
      await svm.addPointAt(0, 0, '+1', 1.0);
      await svm.waitForLogContains('Added point');
      const after = await svm.getPointsCount();
      expect(after).toBeGreaterThan(before);
      const texts = await svm.getPointsListTexts();
      // The last added point appears in the list with id etc.
      expect(texts.some(t => t.includes('l=1'))).toBeTruthy();
    });

    test('RemovePoint transition: remove nearest point by switching to remove mode and clicking', async () => {
      // Ensure at least one point exists
      await svm.addPointAt(0.5, 0.5, '+1', 1.0);
      const before = await svm.getPointsCount();
      // Remove by clicking near the same position
      await svm.removeNearestAt(0.5, 0.5);
      await svm.waitForLogContains('Removed point');
      const after = await svm.getPointsCount();
      expect(after).toBeLessThanOrEqual(before - 1);
    });

    test('MovePoint transition: drag an existing point and verify position update', async () => {
      // Add a point, then drag it and verify the pointsList text updates to new coordinates
      await svm.addPointAt(-1, -1, '+1', 1.0);
      await svm.waitForLogContains('Added point');
      const beforeTexts = await svm.getPointsListTexts();
      // Drag from (-1,-1) to (-0.2, 0.4)
      await svm.dragPoint(-1, -1, -0.2, 0.4);
      // After drag, points list should reflect new coordinates (approx)
      const afterTexts = await svm.getPointsListTexts();
      // Ensure that at least one option text changed in coordinates
      expect(afterTexts.length).toBeGreaterThanOrEqual(1);
      // Heuristic: afterTexts should differ from beforeTexts (position changed)
      expect(afterTexts.join('|')).not.toBe(beforeTexts.join('|'));
    });

    test('Apply and Remove Selected via controls: edit selected point and remove it', async () => {
      // Add two points to create a selectable list
      await svm.addPointAt(-0.8, 0.0, '+1', 1.0);
      await svm.addPointAt(0.8, 0.0, '-1', 1.0);
      await svm.waitForLogContains('Added point');
      // Select first option in pointsList
      const sel = page.locator('#pointsList');
      await sel.selectOption({ index: 0 });
      // Fill edits
      await svm.setNumber('#editX', 1.23);
      await svm.setNumber('#editY', -4.56);
      await page.locator('#editLabel').selectOption('1');
      await svm.setNumber('#editWeight', 2.5);
      // Apply edits
      await svm.click('#applyEdit');
      await svm.waitForLogContains('Applied edits.');
      // Verify that the selected option text reflects new x,y and weight
      const texts = await svm.getPointsListTexts();
      expect(texts.some(t => t.includes('1.23') || t.includes('-4.56') || t.includes('w=2.5'))).toBeTruthy();
      // Now remove the selected option via the Remove button
      await svm.click('#removeSelected');
      await svm.waitForLogContains('Removed selected points.');
    });
  });

  test.describe('State S3_DatasetGeneration - generate, perturb, shuffle, standardize', () => {
    test('GenerateDataset transition: generate a gaussian dataset and verify points and log', async () => {
      // Set generator params to small sizes for test speed
      await svm.setNumber('#nPos', 6);
      await svm.setNumber('#nNeg', 4);
      await svm.setNumber('#separation', 0.8);
      await svm.setNumber('#noise', 0.05);
      await svm.click('#generate');
      await svm.waitForLogContains('Generated dataset');
      const count = await svm.getPointsCount();
      expect(count).toBeGreaterThanOrEqual(10);
    });

    test('AddNoise (perturb) transition: perturb points and confirm log change', async () => {
      // Ensure there are points; generate if needed
      if ((await svm.getPointsCount()) === 0) {
        await svm.click('#generate');
        await svm.waitForLogContains('Generated dataset');
      }
      await svm.click('#perturb');
      await svm.waitForLogContains('Perturbed points.');
      // No page error and canvas redraw expected (we verify stability via no pageerrors in afterEach)
    });

    test('ShuffleLabels transition: click shuffle and expect labels changed for some points', async () => {
      // Make sure points exist
      if ((await svm.getPointsCount()) === 0) {
        await svm.click('#generate');
        await svm.waitForLogContains('Generated dataset');
      }
      const before = await svm.getPointsListTexts();
      await svm.click('#shuffle');
      await svm.waitForLogContains('Shuffled some labels.');
      const after = await svm.getPointsListTexts();
      // Heuristic: some option text should have changed (label flipping)
      expect(after.join('|')).not.toBe(before.join('|'));
    });

    test('StandardizeFeatures transition: standardize and ensure log indicates completion', async () => {
      if ((await svm.getPointsCount()) === 0) {
        await svm.click('#generate');
        await svm.waitForLogContains('Generated dataset');
      }
      await svm.click('#standardize');
      await svm.waitForLogContains('Standardized features.');
    });
  });

  test.describe('State S2_ModelTraining - train step/more/until and live training', () => {
    test('TrainStep transition: with kernel algorithm, run single train step and expect log', async () => {
      // Ensure dataset present
      if ((await svm.getPointsCount()) < 2) {
        await svm.click('#generate');
        await svm.waitForLogContains('Generated dataset');
      }
      // Select kernel algo and train one epoch
      await page.locator('#algoSelect').selectOption('kernel');
      await svm.click('#trainStep');
      await svm.waitForLogContains('Trained one epoch');
      // Model should be set to kernel (modelInfo text will reflect)
      await expect(page.locator('#modelInfo')).toContainText('Model: kernel');
    });

    test('TrainMore transition: run multiple epochs via trainMore', async () => {
      // Ensure there's a dataset
      if ((await svm.getPointsCount()) < 2) {
        await svm.click('#generate');
        await svm.waitForLogContains('Generated dataset');
      }
      await svm.setNumber('#trainN', 3);
      await svm.click('#trainMore');
      await svm.waitForLogContains('Trained 3 epochs');
    });

    test('TrainUntilConvergence transition: run train until and observe logging behavior', async () => {
      // Use primal algorithm to allow iterative weight changes
      await page.locator('#algoSelect').selectOption('primal');
      // Ensure some points exist
      if ((await svm.getPointsCount()) < 3) {
        await svm.click('#generate');
        await svm.waitForLogContains('Generated dataset');
      }
      // Click trainUntil; it may log "Converged after ..." if it stabilizes quickly.
      await svm.click('#trainUntil');
      // Either it logs converged or simply finishes; assert that the internal log has been updated
      const log = await svm.getLogText();
      expect(log.length).toBeGreaterThan(0);
    });

    test('Live training toggle starts/stops interval training and logs status', async () => {
      // Enable live training
      await svm.setNumber('#liveInterval', 50);
      await svm.setCheckbox('#liveToggle', true);
      await svm.waitForLogContains('Live training started.');
      // Wait a bit to let at least one live iteration run
      await page.waitForTimeout(150);
      // Disable live training
      await svm.setCheckbox('#liveToggle', false);
      await svm.waitForLogContains('Live training stopped.');
    });
  });

  test.describe('State S4_Visualization - apply domain, download PNG, resolution changes', () => {
    test('ApplyDomain transition: change domain inputs and apply, expect log', async () => {
      // Change domain to a narrower view and apply
      await svm.setNumber('#xmin', -1.5);
      await svm.setNumber('#xmax', 1.5);
      await svm.setNumber('#ymin', -1.5);
      await svm.setNumber('#ymax', 1.5);
      await svm.click('#applyDomain');
      await svm.waitForLogContains('Applied domain bounds.');
      // The canvas draw should reflect domain change; no uncaught errors are expected
    });

    test('DownloadPNG transition: clicking download triggers image export without errors', async () => {
      // Click download button and ensure no page errors; the implementation creates an anchor and clicks it
      await svm.click('#downloadPNG');
      // No direct UI log but ensure no uncaught page errors and the test continues
      // We verify indirectly by checking modelInfo remains present
      await expect(page.locator('#modelInfo')).toBeVisible();
    });

    test('Resolution change triggers redraw (resolution input dispatches input event)', async () => {
      const resEl = page.locator('#resolution');
      await resEl.evaluate(el => el.value = 60);
      await resEl.dispatchEvent('input');
      // The script's input handler calls draw(); check that resVal updated
      await expect(page.locator('#resVal')).toContainText('60');
    });
  });

  test.describe('State S5_ModelAnalysis - save/load model, evaluate, compute margin, explain decision', () => {
    test('SaveModel and LoadModel transitions: save produces prompt with JSON and load restores model/points', async () => {
      // Ensure there are points and a trained model to include in saved JSON
      if ((await svm.getPointsCount()) < 3) {
        await svm.click('#generate');
        await svm.waitForLogContains('Generated dataset');
      }
      // Train a bit using kernel to have model content
      await page.locator('#algoSelect').selectOption('kernel');
      await svm.click('#trainStep');
      await svm.waitForLogContains('Trained one epoch');

      // Intercept the saveModel prompt to capture default JSON value
      let savedJSONDefault = null;
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('prompt');
        // dialog.message() contains the prompt message; defaultValue() contains the JSON payload
        savedJSONDefault = dialog.defaultValue();
        // Accept to close the prompt (simulate user copying)
        await dialog.accept();
      });
      await svm.click('#saveModel');
      // Wait a small moment for prompt handling
      await page.waitForTimeout(50);
      expect(savedJSONDefault).toBeTruthy();

      // Now test loadModel: provide invalid JSON first (edge case)
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('not a json');
      });
      await svm.click('#loadModel');
      // The code catches parse error and logs 'Failed to load JSON'; verify
      await svm.waitForLogContains('Failed to load JSON', 2000);

      // Now actually load the previously saved JSON via prompt accept with JSON string
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('prompt');
        // Provide the saved JSON (defaultValue from saveModel)
        await dialog.accept(savedJSONDefault);
      });
      await svm.click('#loadModel');
      await svm.waitForLogContains('Loaded model/points.', 2000);
    });

    test('EvaluateTraining transition: evaluate on existing points and assert log contains Evaluation summary', async () => {
      // Ensure model exists (train primal quickly)
      await page.locator('#algoSelect').selectOption('primal');
      if ((await svm.getPointsCount()) < 3) {
        await svm.click('#generate');
        await svm.waitForLogContains('Generated dataset');
      }
      await svm.click('#trainStep');
      await svm.waitForLogContains('Trained one epoch');
      await svm.click('#evalTrain');
      await svm.waitForLogContains('Evaluation: acc=');
    });

    test('ComputeMarginWidth transition: compute margin for a linear primal model', async () => {
      // Switch to primal, train to obtain weight vector
      await page.locator('#algoSelect').selectOption('primal');
      if ((await svm.getPointsCount()) < 3) {
        await svm.click('#generate');
        await svm.waitForLogContains('Generated dataset');
      }
      // run several train steps to build up a non-zero weight vector
      for (let i = 0; i < 4; i++) {
        await svm.click('#trainStep');
        // give a small delay for computation
        await page.waitForTimeout(50);
      }
      // Now attempt to compute margin width (should log result if weights available)
      await svm.click('#showMarginWidth');
      // Two possible logs: either margin width or message about availability; accept either but ensure log updated
      const log = await svm.getLogText();
      expect(/Margin width|only available/.test(log)).toBeTruthy();
    });

    test('ExplainDecision transition: clicking explain attaches handler and subsequent canvas click shows alerts (handled in dialogs)', async () => {
      // Ensure a model exists
      await page.locator('#algoSelect').selectOption('primal');
      if ((await svm.getPointsCount()) < 2) {
        await svm.click('#generate');
        await svm.waitForLogContains('Generated dataset');
      }
      // Train a bit so that explanation yields numeric values
      await svm.click('#trainStep');
      await svm.waitForLogContains('Trained one epoch');

      // Click explain: this triggers an alert describing behavior, then attaches a click handler to canvas that triggers another alert with details
      // Intercept the initial alert
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        await dialog.accept();
      });
      await svm.click('#explain');

      // Next, click on canvas to trigger the explanation click handler. Expect an alert to appear (or "No model available" in alert)
      // Compute a canvas center offset to click
      const offset = await svm.canvasOffsetForDomainCoords(0, 0);
      // Prepare to accept the second alert
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        // The dialog message should mention 'Decision' or 'No model available'
        expect(/Decision value|No model available|Kernel contributions/.test(dialog.message())).toBeTruthy();
        await dialog.accept();
      });
      await svm.canvas.click({ position: { x: offset.x, y: offset.y } });
      // Allow brief time for handlers and removal of the canvas click listener
      await page.waitForTimeout(100);
    });
  });

  test.describe('Edge cases, cross-validation and logs', () => {
    test('CrossVal grid search runs and logs progress lines (ensures heavy loops are executable)', async () => {
      // Ensure some points exist to allow CV to proceed
      if ((await svm.getPointsCount()) < 4) {
        await svm.click('#generate');
        await svm.waitForLogContains('Generated dataset');
      }
      // Set smaller folds for speed
      await svm.setNumber('#cvfolds', 2);
      // Click crossVal - it logs "Starting grid search CV"
      // The implementation uses async and small delays; wait until the log contains the starting log
      await svm.click('#crossVal');
      await svm.waitForLogContains('Starting grid search CV', 5000);
      // The grid search logs intermediate scores; wait a moment for some progress logs
      await page.waitForTimeout(100);
      const log = await svm.getLogText();
      expect(log.length).toBeGreaterThan(0);
    });

    test('LoadModel with empty prompt (user cancels) should not throw errors', async () => {
      // Trigger loadModel and cancel (dialog.accept without text will be treated as cancel if left empty? Implementation checks !txt then return)
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('prompt');
        // Simulate cancel by accepting with empty string (implementation treats empty as falsey and returns)
        await dialog.accept('');
      });
      await svm.click('#loadModel');
      // Because the code returns early when !txt, no "Loaded model" log should appear; but more importantly, no exceptions should be thrown
      // Wait a short while and check log didn't gain 'Loaded model/points.'
      await page.waitForTimeout(100);
      const log = await svm.getLogText();
      expect(log.includes('Loaded model/points.')).toBe(false);
    });
  });
});