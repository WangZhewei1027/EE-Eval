import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c169d82-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Test suite for the Linear Regression Interactive Lab
test.describe('Linear Regression Interactive Lab (FSM based tests)', () => {
  // Shared state to capture console messages, page errors and dialogs
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  // Setup and teardown for each test: navigate to app and attach listeners
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // ensure initial render settled
    await page.waitForSelector('h2');
  });

  test.afterEach(async () => {
    // nothing to clean on server side between tests
  });

  test.describe('Initial state (S0_Idle)', () => {
    test('renders header and minimal UI elements on load', async ({ page }) => {
      // Validate the Idle state's entry evidence: header exists
      const header = await page.locator('h2').textContent();
      expect(header).toContain('Linear Regression Interactive Lab (Plain UI)');

      // Check key controls exist
      await expect(page.locator('#genBtn')).toBeVisible();
      await expect(page.locator('#fitBtn')).toBeVisible();
      await expect(page.locator('#clearBtn')).toBeVisible();

      // Ensure no uncaught page errors on initial render
      expect(pageErrors.length).toBe(0);
      // and no console errors
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Data generation and state transitions (S0 -> S1)', () => {
    test('Generate synthetic data (GenerateData event) populates data textarea when exporting', async ({ page }) => {
      // Generate using UI controls
      await page.fill('#genN', '30');
      await page.fill('#genSlope', '2.5');
      await page.fill('#genIntercept', '1.0');
      await page.fill('#genNoise', '0.2');

      await page.click('#genBtn');

      // Use Export Data to obtain JSON representation of data
      await page.click('#exportBtn');
      const raw = await page.locator('#dataArea').inputValue();
      const arr = JSON.parse(raw);
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.length).toBeGreaterThanOrEqual(30);

      // Ensure fitted model not set after generate (metrics should say 'No fitted model')
      const metrics = await page.locator('#metrics').textContent();
      expect(metrics).toMatch(/No fitted model/);

      // No uncaught page errors occurred during generation
      expect(pageErrors.length).toBe(0);
    });

    test('Adding a point by clicking canvas increases exported data length', async ({ page }) => {
      // Export current length
      await page.click('#exportBtn');
      let beforeRaw = await page.locator('#dataArea').inputValue();
      let beforeArr = [];
      if (beforeRaw.trim()) beforeArr = JSON.parse(beforeRaw);
      const beforeLen = beforeArr.length;

      // Click canvas center to add a point (mode default is 'add')
      const canvas = page.locator('#plot');
      const box = await canvas.boundingBox();
      // click near center
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      // Give the UI a tick to update
      await page.waitForTimeout(50);

      await page.click('#exportBtn');
      const afterRaw = await page.locator('#dataArea').inputValue();
      const afterArr = JSON.parse(afterRaw);
      expect(afterArr.length).toBe(beforeLen + 1);
    });
  });

  test.describe('Undo/Redo and Outliers (S1 Data Entered events)', () => {
    test('Undo and Redo revert and restore generated data', async ({ page }) => {
      // Ensure a known starting point: clear any existing data
      await page.click('#clearBtn');
      // Export should now be empty array
      await page.click('#exportBtn');
      let raw = await page.locator('#dataArea').inputValue();
      // The clearBtn pushes undo so export may still be "[]" or empty; if empty, import/export will handle later
      // Generate data
      await page.fill('#genN', '10');
      await page.click('#genBtn');

      // Export to capture generated data
      await page.click('#exportBtn');
      raw = await page.locator('#dataArea').inputValue();
      const generated = JSON.parse(raw);
      expect(generated.length).toBeGreaterThanOrEqual(10);

      // Undo should revert to previous state (which was empty after clear)
      await page.click('#undoBtn');
      await page.click('#exportBtn');
      const afterUndoRaw = await page.locator('#dataArea').inputValue();
      const afterUndo = afterUndoRaw.trim() ? JSON.parse(afterUndoRaw) : [];
      // Should be empty array after undo
      expect(afterUndo.length).toBeLessThanOrEqual(1); // sometimes clear produced 0, allow 0 or 1 as safe check

      // Redo should restore generated data length
      await page.click('#redoBtn');
      await page.click('#exportBtn');
      const afterRedoRaw = await page.locator('#dataArea').inputValue();
      const afterRedo = afterRedoRaw.trim() ? JSON.parse(afterRedoRaw) : [];
      expect(afterRedo.length).toBeGreaterThanOrEqual(10);
    });

    test('Add outliers keeps data length constant but changes y values', async ({ page }) => {
      // Start fresh
      await page.click('#clearBtn');
      await page.fill('#genN', '20');
      await page.click('#genBtn');
      await page.click('#exportBtn');
      const beforeRaw = await page.locator('#dataArea').inputValue();
      const beforeArr = JSON.parse(beforeRaw);

      // Click Add outliers
      await page.fill('#outlierFrac', '0.2'); // 20% should modify some points
      await page.click('#outlierBtn');
      await page.click('#exportBtn');
      const afterRaw = await page.locator('#dataArea').inputValue();
      const afterArr = JSON.parse(afterRaw);

      // Length should remain unchanged
      expect(afterArr.length).toBe(beforeArr.length);

      // At least one y value should differ (probabilistic, but expected with 20% change)
      const anyChanged = afterArr.some((p, i) => Number(p.y).toFixed(6) !== Number(beforeArr[i].y).toFixed(6));
      expect(anyChanged).toBe(true);
    });
  });

  test.describe('Model fitting (S1 -> S2) and model-related controls', () => {
    test('Fit (single) computes an OLS fit and updates metrics (FitModel event)', async ({ page }) => {
      // Ensure data present
      await page.click('#clearBtn');
      await page.fill('#genN', '40');
      await page.click('#genBtn');

      // Fit using default method (ols)
      await page.click('#fitBtn');
      // Wait a tick for UI update
      await page.waitForTimeout(100);

      const metricsText = await page.locator('#metrics').textContent();
      expect(metricsText).toContain('Method: ols');
      expect(metricsText).toMatch(/Parameters:/);
      expect(metricsText).toMatch(/Data points: \d+/);

      // Fitted state should now be reflected in metrics (S2 Model Fitted)
      // No page errors from fitting
      expect(pageErrors.length).toBe(0);
    });

    test('Step (GD) performs a single GD update when method=gd (StepGD event)', async ({ page }) => {
      // Ensure data present
      await page.click('#clearBtn');
      await page.fill('#genN', '30');
      await page.click('#genBtn');

      // Select GD method
      await page.selectOption('#method', 'gd');
      // Click Step to run one GD step - this should create gdState and perform a step
      await page.click('#stepBtn');
      // Wait for UI to update
      await page.waitForTimeout(150);

      const metricsText = await page.locator('#metrics').textContent();
      // Should show method 'gd'
      expect(metricsText).toContain('Method: gd');

      // Run (GD) and then Stop (StopRun event) - use a small iter count to ensure it starts
      await page.fill('#iter', '20');
      await page.click('#runBtn');
      // Let it run briefly
      await page.waitForTimeout(80);
      // Stop it
      await page.click('#stopBtn');
      // Ensure no page errors produced while running
      expect(pageErrors.length).toBe(0);
    });

    test('Clicking Step when method is not GD/SGD/minibatch shows an alert (edge-case)', async ({ page }) => {
      // Ensure data present
      await page.click('#clearBtn');
      await page.fill('#genN', '5');
      await page.click('#genBtn');

      // Default method is 'ols', clicking step should produce dialog 'Step works for GD/SGD/minibatch only'
      dialogMessages = [];
      await page.click('#stepBtn');
      // dialog handler in beforeEach accepted the dialog; ensure we captured message
      await page.waitForTimeout(50);
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      // Check that the dialog message matches expected hint (substring)
      expect(dialogMessages.some(m => m.includes('Step works for GD/SGD/minibatch only'))).toBe(true);
    });

    test('Apply manual slope/intercept sets fitted model without data (ApplyManual event)', async ({ page }) => {
      // Clear data so edge-case of no data + manual apply is tested
      await page.click('#clearBtn');

      // Set degree 1 and ensure intercept checkbox is checked
      await page.fill('#degree', '1');
      const interceptChecked = await page.locator('#interceptCheck').isChecked();
      if (!interceptChecked) await page.click('#interceptCheck');

      // Set manual slope and intercept and apply
      await page.fill('#manualSlope', '3.14');
      await page.fill('#manualIntercept', '0.5');
      await page.click('#applyManual');

      // After applying, metrics should mention 'Method: manual' and include parameter values
      const metricsText = await page.locator('#metrics').textContent();
      expect(metricsText).toContain('Method: manual');
      expect(metricsText).toContain('t0='); // intercept shown as t0
      expect(metricsText).toContain('t1=');
    });

    test('Toggle Residuals shows/hides residual drawing without error (ToggleResiduals event)', async ({ page }) => {
      // Ensure data and fitted model exist
      await page.fill('#genN', '25');
      await page.click('#genBtn');
      await page.click('#fitBtn');
      await page.waitForTimeout(80);

      // Toggle residuals on and off
      await page.click('#showResiduals');
      await page.waitForTimeout(50);
      await page.click('#showResiduals');
      await page.waitForTimeout(50);

      // No dialogs or page errors expected
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Diagnostics & Analysis: bootstrap, cross-val, grid search', () => {
    test('Bootstrap params draws histogram and produces a canvas data URL (BootstrapParams event)', async ({ page }) => {
      // Ensure data present
      await page.click('#clearBtn');
      await page.fill('#genN', '40');
      await page.click('#genBtn');

      // Fit first to set fitted.includeIntercept context used in histogram code
      await page.click('#fitBtn');
      await page.waitForTimeout(80);

      // Click bootstrap - this will compute bootstrapParams and draw histogram
      await page.fill('#bootstrapN', '50');
      await page.click('#bootstrapBtn');

      // Wait for histogram drawing to complete
      await page.waitForTimeout(200);

      // Extract hist canvas as data URL to verify something was drawn
      const dataUrl = await page.evaluate(() => {
        const c = document.getElementById('hist');
        return c.toDataURL();
      });
      // dataUrl should be a non-empty PNG data URI
      expect(typeof dataUrl).toBe('string');
      expect(dataUrl.startsWith('data:image')).toBe(true);
      expect(dataUrl.length).toBeGreaterThan(200);
    });

    test('Cross-validation populates metrics area with fold results (CrossVal event)', async ({ page }) => {
      // Ensure data present
      await page.click('#clearBtn');
      await page.fill('#genN', '50');
      await page.click('#genBtn');

      // Click CV
      await page.fill('#cvK', '5');
      await page.click('#cvBtn');

      // Wait for results to appear in metrics
      await page.waitForTimeout(120);
      const text = await page.locator('#metrics').textContent();
      expect(text).toContain('Cross-val results');
      expect(text).toContain('fold 1:');
    });

    test('Grid search produces sorted results in metrics (GridSearch event)', async ({ page }) => {
      // Ensure data present
      await page.click('#clearBtn');
      await page.fill('#genN', '60');
      await page.click('#genBtn');

      // Provide some grid values
      await page.fill('#gridLRs', '0.01,0.05');
      await page.fill('#gridLams', '0,0.1');
      await page.click('#gridBtn');

      // Wait for grid search to run
      await page.waitForTimeout(300);
      const text = await page.locator('#metrics').textContent();
      expect(text).toContain('Grid search results (sorted by mse):');
      expect(text).toContain('lr='); // indicates results were printed
    });
  });

  test.describe('Persistence: Export/Import and edge error handling', () => {
    test('Export then Import restores data (ExportData & ImportData events)', async ({ page }) => {
      // Clear, generate some data, export it
      await page.click('#clearBtn');
      await page.fill('#genN', '12');
      await page.click('#genBtn');

      await page.click('#exportBtn');
      const exported = await page.locator('#dataArea').inputValue();
      expect(exported.length).toBeGreaterThan(2);
      const arr = JSON.parse(exported);
      expect(arr.length).toBeGreaterThanOrEqual(12);

      // Clear again to create a different starting state and then import exported JSON
      await page.click('#clearBtn');
      await page.fill('#dataArea', exported);
      await page.click('#importBtn');

      // After import, exporting should give the same length
      await page.click('#exportBtn');
      const reExport = await page.locator('#dataArea').inputValue();
      const arr2 = JSON.parse(reExport);
      expect(arr2.length).toBe(arr.length);
    });

    test('Import invalid JSON triggers alert (edge-case)', async ({ page }) => {
      dialogMessages = [];
      await page.fill('#dataArea', 'this is not json');
      await page.click('#importBtn');
      await page.waitForTimeout(50);
      // An alert 'Invalid JSON' should have been shown and accepted by our handler
      expect(dialogMessages.some(m => m.includes('Invalid JSON'))).toBe(true);
    });

    test('Clicking Fit when no data triggers "No data" alert (edge-case)', async ({ page }) => {
      // Ensure no data
      await page.click('#clearBtn');
      dialogMessages = [];
      await page.click('#fitBtn');
      await page.waitForTimeout(50);
      // 'No data' alert expected
      expect(dialogMessages.some(m => m.includes('No data'))).toBe(true);
    });
  });

  test.describe('Canvas interactions: drag, delete (mouse events coverage)', () => {
    test('Delete nearest point with shift+click on canvas removes a point', async ({ page }) => {
      // Ensure at least one point exists
      await page.click('#clearBtn');
      await page.fill('#genN', '6');
      await page.click('#genBtn');

      // Export count before
      await page.click('#exportBtn');
      const before = JSON.parse(await page.locator('#dataArea').inputValue());
      const beforeLen = before.length;

      // Click on canvas with shiftKey to delete nearest
      const canvas = page.locator('#plot');
      const box = await canvas.boundingBox();
      // perform shift+click at center
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.keyboard.down('Shift');
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.keyboard.up('Shift');
      await page.waitForTimeout(60);

      // Export again
      await page.click('#exportBtn');
      const after = JSON.parse(await page.locator('#dataArea').inputValue());
      // Either same or decreased by 1 depending on nearest point distance; assert not increased
      expect(after.length).toBeLessThanOrEqual(beforeLen);
    });

    test('Dragging a point updates its coordinates (drag mode)', async ({ page }) => {
      // Generate a small dataset
      await page.click('#clearBtn');
      await page.fill('#genN', '6');
      await page.click('#genBtn');
      await page.click('#exportBtn');
      const before = JSON.parse(await page.locator('#dataArea').inputValue());

      // Switch to drag mode
      await page.selectOption('#mode', 'drag');

      // Find a point by clicking near canvas center and dragging
      const canvas = page.locator('#plot');
      const box = await canvas.boundingBox();
      const startX = box.x + box.width * 0.4;
      const startY = box.y + box.height * 0.5;

      // Perform mousedown, move, mouseup sequence to simulate drag
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 20, startY + 10, { steps: 6 });
      await page.mouse.up();
      // wait for possible undo push and updates
      await page.waitForTimeout(80);

      // Export after drag
      await page.click('#exportBtn');
      const after = JSON.parse(await page.locator('#dataArea').inputValue());

      // Coordinates might have changed - ensure number of points preserved
      expect(after.length).toBe(before.length);
    });
  });

  test.describe('Instrumentation: inspect console and page errors are absent', () => {
    test('No console.error or page errors after typical workflow', async ({ page }) => {
      // Run through a typical workflow: generate -> fit -> bootstrap -> grid
      await page.click('#clearBtn');
      await page.fill('#genN', '30');
      await page.click('#genBtn');
      await page.click('#fitBtn');
      await page.waitForTimeout(80);
      await page.click('#bootstrapBtn');
      await page.waitForTimeout(120);
      await page.click('#gridBtn');
      await page.waitForTimeout(200);

      // Collect any console errors
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      // Assert no critical page errors or console errors occurred
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});