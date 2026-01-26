import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c16c490-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Random Forest Interactive Sandbox - FSM end-to-end', () => {
  // Capture page errors and console errors for each test
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    // Accept any alerts that the app shows (many actions produce alert())
    page.on('dialog', async (dialog) => {
      try { await dialog.accept(); } catch (e) { /* ignore */ }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // wait for initial generation done by the inline init() which clicks generate
    await page.waitForTimeout(200); // small wait for initial UI rendering and drawPlot
  });

  test.afterEach(async () => {
    // basic sanity: ensure no unexpected uncaught page errors or console errors
    // If the app produces errors they will surface here and fail tests (as required: let them occur naturally)
    expect(pageErrors, 'No uncaught page errors').toEqual([]);
    expect(consoleErrors, 'No console.error messages').toEqual([]);
  });

  test.describe('S0_Idle & S1_DataGenerated: Initial rendering and Generate action', () => {
    test('renders controls and initial dataset (Idle -> DataGenerated)', async ({ page }) => {
      // Verify basic controls exist
      await expect(page.locator('#generateBtn')).toHaveCount(1);
      await expect(page.locator('#csvInput')).toHaveCount(1);
      await expect(page.locator('#trainBtn')).toHaveCount(1);

      // The page init() clicks generateBtn automatically; verify Data preview shows data
      const preview = page.locator('#dataPreview');
      await expect(preview).toContainText('Showing');
      await expect(preview.locator('table')).toHaveCount(1);

      // Click Generate again with different nSamples to trigger S1_DataGenerated entry actions
      await page.fill('#nSamples', '50');
      await page.click('#generateBtn');

      // The log is recorded in trainingLog <pre>, check it contains "Generated synthetic dataset"
      const logPre = page.locator('#trainingLog pre');
      await expect(logPre).toContainText('Generated synthetic dataset');

      // Ensure the preview updated to show rows for the newly generated dataset (limit 10)
      await expect(preview).toContainText('Showing 10 of');
    });

    test('clearData returns to No data (Idle after clearing)', async ({ page }) => {
      // Clear existing data
      await page.click('#clearData');
      // Data preview should show 'No data'
      await expect(page.locator('#dataPreview')).toContainText('No data');
      // Ensure selectors are emptied
      await expect(page.locator('#selectFeatures option')).toHaveCount(0);
      await expect(page.locator('#selectTarget option')).toHaveCount(0);
    });
  });

  test.describe('S2_CSVParsed: CSV upload and parsing', () => {
    test('parse CSV from text area (ParseCSV event)', async ({ page }) => {
      // Prepare a small CSV content with header
      const csv = 'a,b,target\n1,2,0\n3,4,1\n5,6,0\n';
      // Paste into csvArea
      await page.fill('#csvArea', csv);
      // Ensure header checkbox is checked
      const headerChecked = await page.isChecked('#headerRow');
      if (!headerChecked) await page.click('#headerRow');
      // Click Parse CSV
      await page.click('#parseCsv');

      // After parse, dataPreview should show a table with 3 rows
      const preview = page.locator('#dataPreview');
      await expect(preview).toContainText('Showing 3 of 3 rows').or.toContainText('Showing 3 of'); // tolerant check

      // Feature selectors should be populated
      await expect(page.locator('#selectFeatures option')).toHaveCount(2); // a,b
      await expect(page.locator('#selectTarget option')).toHaveCountGreaterThan(0);
    });

    test('upload CSV via file input loads into text area (UploadCSV event)', async ({ page }) => {
      // Create a CSV file via in-memory upload
      const csvContent = 'f0,f1,target\n0.1,0.2,0\n0.2,0.3,1\n';
      await page.setInputFiles('#csvInput', {
        name: 'test.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvContent, 'utf8')
      });

      // The FileReader on change sets csvArea.value asynchronously and logs
      // Wait for log "Loaded file into text area."
      await page.waitForFunction(() => {
        const pre = document.querySelector('#trainingLog pre');
        return pre && pre.textContent && pre.textContent.indexOf('Loaded file into text area.') !== -1;
      });

      // Now click "Use Uploaded" to trigger parseCsv
      await page.click('#useUploaded');

      // Because parseCsv will parse current csvArea and call drawPlot, ensure dataPreview updated
      await expect(page.locator('#dataPreview')).toContainText('Showing');

      // Ensure selectFeatures populated
      await expect(page.locator('#selectFeatures option')).toHaveCount(2);
    });
  });

  test.describe('S3_ModelTrained: Training, metrics, importances, and predictions', () => {
    test('Train model (TrainModel event) and display metrics/importances', async ({ page }) => {
      // Ensure there is data (generate small dataset)
      await page.fill('#nSamples', '60');
      await page.click('#generateBtn');
      await page.waitForTimeout(100);

      // Set a small number of estimators to speed up test
      await page.fill('#nEstimators', '5');
      // Click train
      await page.click('#trainBtn');

      // Wait for training completion log
      await page.waitForFunction(() => {
        const pre = document.querySelector('#trainingLog pre');
        return pre && /Training completed/.test(pre.textContent || '');
      }, { timeout: 5000 });

      // modelJsonArea should be populated with JSON
      const modelJsonArea = page.locator('#modelJsonArea');
      await expect(modelJsonArea).not.toHaveText('');

      // Parse model JSON and assert MODEL.trained and trees exist (via reading JSON area)
      const modelText = await modelJsonArea.inputValue();
      const parsed = JSON.parse(modelText);
      expect(parsed.trees && Array.isArray(parsed.trees), 'model.trees present').toBeTruthy();
      expect(parsed.trees.length > 0, 'at least one tree trained').toBeTruthy();

      // Metrics and importances displayed
      await expect(page.locator('#metrics')).toContainText('Train accuracy');
      await expect(page.locator('#importances')).toContainText('feature').or.toContainText('importance');
    });

    test('single step training adds one tree (StepTrainModel)', async ({ page }) => {
      // Ensure dataset exists
      await page.fill('#nSamples', '40');
      await page.click('#generateBtn');
      await page.waitForTimeout(100);

      // Reset model first
      await page.click('#resetModelBtn');

      // Click step train
      await page.click('#stepTrainBtn');

      // Wait for modelJsonArea to be updated
      await page.waitForFunction(() => {
        const area = document.querySelector('#modelJsonArea');
        return area && area.value && area.value.indexOf('"trees"') !== -1;
      }, { timeout: 3000 });

      const modelText = await page.locator('#modelJsonArea').inputValue();
      const parsed = JSON.parse(modelText);
      expect(parsed.trees.length >= 1, 'a single tree was added').toBeTruthy();
    });

    test('resetModel clears model state and UI', async ({ page }) => {
      // Ensure model exists by training quickly
      await page.click('#trainBtn');
      await page.waitForTimeout(200);

      // Reset
      await page.click('#resetModelBtn');

      // trainingLog cleared and modelJsonArea emptied
      await expect(page.locator('#trainingLog pre')).toHaveText('');
      await expect(page.locator('#modelJsonArea')).toHaveText('');
      await expect(page.locator('#predictionDetails')).toHaveText('');
    });
  });

  test.describe('S4_IncrementalTraining: Start and Pause incremental training', () => {
    test('start incremental creates periodic trees and pause stops it', async ({ page }) => {
      // Ensure dataset & reset model
      await page.fill('#nSamples', '80');
      await page.click('#generateBtn');
      await page.waitForTimeout(50);
      await page.click('#resetModelBtn');

      // configure incremental to be quick and limited
      await page.fill('#incInterval', '50');
      await page.fill('#maxTreesLimit', '3');
      // ensure nEstimators is higher but incremental will stop at limit
      await page.fill('#nEstimators', '10');

      // Start incremental
      await page.click('#startIncremental');

      // Wait for "Started incremental training." in log
      await page.waitForFunction(() => {
        const pre = document.querySelector('#trainingLog pre');
        return pre && pre.textContent.indexOf('Started incremental training.') !== -1;
      }, { timeout: 2000 });

      // Wait until modelJsonArea shows multiple trees (at least 1)
      await page.waitForFunction(() => {
        try {
          const a = document.querySelector('#modelJsonArea');
          if (!a || !a.value) return false;
          const parsed = JSON.parse(a.value);
          return parsed.trees && parsed.trees.length >= 1;
        } catch (e) { return false; }
      }, { timeout: 5000 });

      // Pause incremental training
      await page.click('#pauseIncremental');

      // Verify log contains 'Paused incremental training.'
      await expect(page.locator('#trainingLog pre')).toContainText('Paused incremental training.');
    });
  });

  test.describe('S5_PredictionDisplayed: Inspect/Explain predictions and what-if', () => {
    test('show prediction, per-tree votes and what-if modify and produce prediction', async ({ page }) => {
      // Ensure we have a trained model
      await page.fill('#nSamples', '60');
      await page.click('#generateBtn');
      await page.waitForTimeout(50);
      await page.fill('#nEstimators', '5');
      await page.click('#trainBtn');

      // Wait for training completed
      await page.waitForFunction(() => {
        const pre = document.querySelector('#trainingLog pre');
        return pre && /Training completed/.test(pre.textContent || '');
      }, { timeout: 5000 });

      // Show prediction for sample index 0
      await page.fill('#sampleIndex', '0');
      await page.click('#showPredictionBtn');

      // predictionDetails should contain predicted class and true class
      await expect(page.locator('#predictionDetails')).toContainText('predicted class');
      await expect(page.locator('#predictionDetails')).toContainText('True class');

      // Per-tree votes
      await page.click('#perTreeVotesBtn');
      await expect(page.locator('#predictionDetails')).toContainText('Per-tree votes');

      // What-if: click to open inputs and then apply
      await page.click('#whatIfBtn');

      // Wait for the Apply button inside predictionDetails
      await page.waitForSelector('#wifApply', { timeout: 2000 });
      // change a feature input slightly (if present)
      const wifInputs = await page.locator('[id^=wif_]').elementHandles();
      if (wifInputs.length > 0) {
        // modify first feature a bit
        await wifInputs[0].fill('0.123');
      }
      // Click apply
      await page.click('#wifApply');

      // After applying, predictionDetails should include "Prediction for modified row"
      await expect(page.locator('#predictionDetails')).toContainText('Prediction for modified row');
    });

    test('showTree displays a textual tree', async ({ page }) => {
      // Ensure trained
      await page.fill('#nSamples', '40');
      await page.click('#generateBtn');
      await page.waitForTimeout(50);
      await page.fill('#nEstimators', '3');
      await page.click('#trainBtn');

      // Wait training
      await page.waitForFunction(() => {
        const pre = document.querySelector('#trainingLog pre');
        return pre && pre.textContent.indexOf('Training completed') !== -1;
      }, { timeout: 5000 });

      // Ensure treeIndex 0 is valid then click showTreeBtn
      await page.fill('#treeIndex', '0');
      await page.click('#showTreeBtn');

      // treeDisplay should contain "Leaf" or "Node"
      await expect(page.locator('#treeDisplay pre')).toContainText('Leaf').or.toContainText('Node');
    });
  });

  test.describe('Advanced / Export / Import / OOB / Cross-Validation flows', () => {
    test('export model to JSON area and import it back via file input', async ({ page }) => {
      // Ensure a trained model exists
      await page.fill('#nSamples', '50');
      await page.click('#generateBtn');
      await page.waitForTimeout(50);
      await page.fill('#nEstimators', '3');
      await page.click('#trainBtn');

      // Export model to text area
      await page.click('#exportModelBtn');

      // Wait for modelJsonArea to have content
      await page.waitForFunction(() => {
        const area = document.querySelector('#modelJsonArea');
        return area && area.value && area.value.trim().length > 0;
      }, { timeout: 3000 });

      const modelText = await page.locator('#modelJsonArea').inputValue();
      // Create a temp "file" from this JSON and upload it to importModelFile
      await page.setInputFiles('#importModelFile', {
        name: 'model.json',
        mimeType: 'application/json',
        buffer: Buffer.from(modelText, 'utf8')
      });

      // Click importModelBtn to trigger import
      await page.click('#importModelBtn');

      // Wait for "Model imported." log entry
      await page.waitForFunction(() => {
        const pre = document.querySelector('#trainingLog pre');
        return pre && pre.textContent.indexOf('Model imported.') !== -1;
      }, { timeout: 3000 });

      // modelJsonArea should still contain JSON (imported)
      await expect(page.locator('#modelJsonArea')).not.toHaveText('');
    });

    test('computeOOB (approx) shows alert and logs', async ({ page }) => {
      // Train with bootstrap=true (default)
      await page.fill('#nSamples', '60');
      await page.click('#generateBtn');
      await page.waitForTimeout(50);
      await page.fill('#nEstimators', '4');
      await page.click('#trainBtn');

      // Click compute OOB - it will show an alert; dialog handler accepts it automatically
      await page.click('#computeOOB');

      // Wait for trainingLog to contain 'Approx OOB accuracy' entry
      await page.waitForFunction(() => {
        const pre = document.querySelector('#trainingLog pre');
        return pre && pre.textContent.indexOf('Approx OOB accuracy') !== -1;
      }, { timeout: 3000 });
    });

    test('cross-validate (with k>=2) runs and produces an alert', async ({ page }) => {
      // Ensure dataset
      await page.fill('#nSamples', '90');
      await page.click('#generateBtn');
      await page.waitForTimeout(50);

      // Set CV folds to 3 and ensure RNG stable
      await page.fill('#cvFolds', '3');
      await page.fill('#nEstimators', '2');

      // Click Cross-Validate (will alert final message, accepted automatically)
      await page.click('#crossValidateBtn');

      // Confirm trainingLog has fold logs
      await page.waitForFunction(() => {
        const pre = document.querySelector('#trainingLog pre');
        return pre && /Fold 1 acc:/.test(pre.textContent || '');
      }, { timeout: 5000 });
    });

    test('export CSV and download model triggers anchor click without errors', async ({ page }) => {
      // Ensure data exists
      await page.fill('#nSamples', '30');
      await page.click('#generateBtn');
      await page.waitForTimeout(50);

      // Click export CSV
      await page.click('#exportCsvBtn');

      // Click download model (will create data URI and click)
      await page.click('#downloadModelBtn');

      // No errors should be produced and the app should remain responsive
      await expect(page.locator('#dataPreview')).toContainText('Showing');
    });
  });

  test.describe('Feature selection and add row edge cases', () => {
    test('applyFeatureSelection requires selection and updates features', async ({ page }) => {
      // Generate dataset with 3 features
      await page.fill('#nFeatures', '3');
      await page.fill('#nSamples', '20');
      await page.click('#generateBtn');
      await page.waitForTimeout(50);

      // Try clicking Apply without selecting features -> will alert (handled)
      await page.click('#applyFeatureSelection');
      // Then select two features and apply
      // Select two options by evaluating in page context
      await page.evaluate(() => {
        const sel = document.getElementById('selectFeatures');
        // select first two options
        for (let i=0;i<sel.options.length;i++) sel.options[i].selected = (i<2);
        sel.dispatchEvent(new Event('change'));
      });
      await page.click('#applyFeatureSelection');
      // After apply, featureNames length should be 2 and preview updated
      await expect(page.locator('#dataPreview')).toContainText('Showing');
    });

    test('addRow validates input length and adds row when correct', async ({ page }) => {
      // Ensure there is data with 2 features
      await page.fill('#nFeatures', '2');
      await page.fill('#nSamples', '10');
      await page.click('#generateBtn');
      await page.waitForTimeout(50);

      // Enter mismatched row (should alert)
      await page.fill('#newRowInput', '1,2,3,4');
      await page.click('#addRowBtn'); // alert will be accepted

      // Now add a correct row (features + target)
      await page.fill('#newRowInput', '0.1,0.2,1');
      await page.click('#addRowBtn');

      // Expect preview to reference 'Added row.' in training log
      await expect(page.locator('#trainingLog pre')).toContainText('Added row.');
    });
  });

});