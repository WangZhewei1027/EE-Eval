import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b4afc1-d5c2-11f0-9651-0f1ae31ac260.html';

test.describe('K-Means Clustering Interactive Demo - FSM coverage', () => {
  // Helper to attach console/page error listeners and return collectors
  async function attachErrorCollectors(page) {
    const consoleErrors = [];
    const consoleWarnings = [];
    const pageErrors = [];

    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error') consoleErrors.push({ text: msg.text(), location: msg.location() });
      if (type === 'warning') consoleWarnings.push({ text: msg.text(), location: msg.location() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    return { consoleErrors, consoleWarnings, pageErrors };
  }

  test.beforeEach(async ({ page }) => {
    // Nothing global to set up beyond navigation per test
  });

  test.afterEach(async ({ page }) => {
    // Ensure any dialogs left open are closed to avoid cross-test interference
    page.on('dialog', async dialog => {
      try {
        await dialog.dismiss();
      } catch (e) { /* ignore */ }
    });
  });

  test('Initial (S0_Idle) state: page loads and shows initial instructions', async ({ page }) => {
    // Attach collectors for console and page errors
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

    // Navigate to the app
    await page.goto(BASE_URL);

    // Validate canvas exists and has expected dimensions (evidence of draw() and initial DOM presence)
    const canvas = page.locator('#canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('width', '700');
    await expect(canvas).toHaveAttribute('height', '500');

    // Validate initial info text as per initial draw() entry action
    const info = page.locator('#info');
    await expect(info).toBeVisible();
    await expect(info).toContainText('Set parameters and generate points');

    // Ensure there are no unexpected console errors or uncaught page errors on initial load
    expect(consoleErrors.length, `Console errors on load: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors on load: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test.describe('Point creation and S0 -> S1 / ADD_POINT transitions', () => {
    test('Add a point by clicking on the canvas (ADD_POINT) and validate info update', async ({ page }) => {
      const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

      await page.goto(BASE_URL);

      const info = page.locator('#info');
      const canvas = page.locator('#canvas');

      // Click near center of canvas to add a point
      const box = await canvas.boundingBox();
      if (!box) throw new Error('Canvas bounding box not available');
      const x = Math.round(box.x + box.width / 2);
      const y = Math.round(box.y + box.height / 2);

      await page.mouse.click(x, y);

      // After adding a point, info text should indicate a point was added
      await expect(info).toContainText('Point added');

      // Adding a point should not produce console errors or uncaught exceptions
      expect(consoleErrors.length, `Console errors while adding point: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors while adding point: ${JSON.stringify(pageErrors)}`).toBe(0);
    });

    test('Generate random points (GENERATE_POINTS) transitions to PointsGenerated (S1)', async ({ page }) => {
      const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

      await page.goto(BASE_URL);

      const generateBtn = page.locator('#generateBtn');
      const info = page.locator('#info');
      const legend = page.locator('#legend');
      const kInput = page.locator('#kInput');
      const pointsInput = page.locator('#pointsInput');

      // Ensure inputs are present
      await expect(kInput).toHaveValue('3');
      await expect(pointsInput).toHaveValue('150');

      // Click generate - should create random points and initialize centers
      await generateBtn.click();

      // Info text should reflect that points were generated
      await expect(info).toContainText('random points generated');

      // Legend should show clusters for the number of centers initialized (k)
      const k = parseInt(await kInput.inputValue(), 10);
      // Legend innerHTML will list Cluster 1, Cluster 2...
      const legendHtml = await legend.innerHTML();
      for (let i = 1; i <= k; i++) {
        expect(legendHtml).toContain(`Cluster ${i}`);
      }

      // No console errors or page errors should have occurred
      expect(consoleErrors.length, `Console errors during generate: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors during generate: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });

  test.describe('Clustering steps and running (S1 -> S2 -> S4 -> S3)', () => {
    test('Step clustering (STEP_CLUSTERS) when no points shows appropriate info', async ({ page }) => {
      const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

      await page.goto(BASE_URL);

      // Ensure no points: click clear to be sure
      const clearBtn = page.locator('#clearBtn');
      await clearBtn.click();

      const stepBtn = page.locator('#stepBtn');
      const info = page.locator('#info');

      // Click Step with no points; expected message per implementation
      await stepBtn.click();
      await expect(info).toContainText('No points available');

      expect(consoleErrors.length, `Console errors during empty-step: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors during empty-step: ${JSON.stringify(pageErrors)}`).toBe(0);
    });

    test('Perform one step after generating points (S1 -> S2)', async ({ page }) => {
      const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

      await page.goto(BASE_URL);

      const generateBtn = page.locator('#generateBtn');
      const stepBtn = page.locator('#stepBtn');
      const info = page.locator('#info');

      // Generate points
      await generateBtn.click();
      // Then click Step to perform an iteration
      await stepBtn.click();

      // The implementation sets info to either 'Performed one iteration...' or 'Clustering has converged.'
      const infoText = await info.textContent();
      expect(
        infoText,
        'Info text after first step should indicate either one iteration performed or convergence'
      ).toMatch(/Performed one iteration of K-Means|Clustering has converged|K-Means converged/);

      expect(consoleErrors.length, `Console errors during step: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors during step: ${JSON.stringify(pageErrors)}`).toBe(0);
    });

    test('Run clustering to completion (RUN_CLUSTERS) disables controls and converges', async ({ page }) => {
      const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

      await page.goto(BASE_URL);

      const generateBtn = page.locator('#generateBtn');
      const runBtn = page.locator('#runBtn');
      const stepBtn = page.locator('#stepBtn');
      const info = page.locator('#info');
      const kInput = page.locator('#kInput');
      const pointsInput = page.locator('#pointsInput');
      const clearBtn = page.locator('#clearBtn');
      const resetBtn = page.locator('#resetBtn');

      // Generate points to have data
      await generateBtn.click();

      // Click Run - should set info to Running clustering... and disable controls
      await runBtn.click();

      // When running begins, info should contain 'Running clustering...' at least momentarily.
      await expect(info).toContainText(/Running clustering|K-Means converged/);

      // Controls should be disabled while running
      // We allow time for state change to happen; if clustering converges immediately, controls will be re-enabled,
      // so we check that either they are disabled or the info indicates convergence.
      const stepDisabled = await stepBtn.isDisabled();
      const runDisabled = await runBtn.isDisabled();
      const generateDisabled = await generateBtn.isDisabled();
      const kDisabled = await kInput.isDisabled();

      // At least one of two valid end states:
      // - Running in progress: many controls disabled
      // - Already converged: info shows 'converged' and controls re-enabled
      const infoText = await info.textContent();
      const converged = /K-Means converged|converged in \d+ iteration/.test(infoText || '');

      if (!converged) {
        expect(stepDisabled || runDisabled || generateDisabled || kDisabled, 'Controls should be disabled while running').toBeTruthy();
      } else {
        // If converged, ensure info mentions convergence
        expect(infoText).toMatch(/K-Means converged in \d+ iteration/);
      }

      // Wait up to a reasonable time for convergence if not already converged
      if (!converged) {
        await expect(info).toMatch(/K-Means converged in \d+ iteration/, { timeout: 5000 });
      }

      // After run completes, controls should be enabled again
      await expect(stepBtn).toBeEnabled({ timeout: 5000 });
      await expect(runBtn).toBeEnabled({ timeout: 5000 });
      await expect(generateBtn).toBeEnabled({ timeout: 5000 });
      await expect(kInput).toBeEnabled({ timeout: 5000 });
      await expect(pointsInput).toBeEnabled({ timeout: 5000 });
      await expect(clearBtn).toBeEnabled({ timeout: 5000 });
      await expect(resetBtn).toBeEnabled({ timeout: 5000 });

      expect(consoleErrors.length, `Console errors during run: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors during run: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });

  test.describe('Resetting, Clearing and Input edge cases', () => {
    test('Reset clustering when k > number of points triggers alert and returns false', async ({ page }) => {
      const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

      await page.goto(BASE_URL);

      const kInput = page.locator('#kInput');
      const clearBtn = page.locator('#clearBtn');
      const canvas = page.locator('#canvas');
      const resetBtn = page.locator('#resetBtn');

      // Ensure cleared state
      await clearBtn.click();

      // Add a single point manually
      const box = await canvas.boundingBox();
      if (!box) throw new Error('Canvas bounding box not available');
      const x = Math.round(box.x + box.width / 3);
      const y = Math.round(box.y + box.height / 3);
      await page.mouse.click(x, y);

      // Set k to a value greater than points (e.g., 5)
      await kInput.fill('5');
      // Listen for the alert dialog
      const dialogPromise = page.waitForEvent('dialog');

      // Click Reset - resetClustering should alert because k > points.length
      await resetBtn.click();

      const dialog = await dialogPromise;
      const message = dialog.message();
      // The alert message in implementation: "Number of clusters (k) must be less than or equal to number of points."
      expect(message).toContain('Number of clusters (k) must be less than or equal to number of points.');
      await dialog.accept();

      // After dismissing alert, ensure no console/page errors
      expect(consoleErrors.length, `Console errors during reset-alert: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors during reset-alert: ${JSON.stringify(pageErrors)}`).toBe(0);
    });

    test('Clear points (CLEAR_POINTS) empties data and subsequent Step shows no points', async ({ page }) => {
      const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

      await page.goto(BASE_URL);

      const generateBtn = page.locator('#generateBtn');
      const clearBtn = page.locator('#clearBtn');
      const stepBtn = page.locator('#stepBtn');
      const info = page.locator('#info');

      // Generate points first, then clear them
      await generateBtn.click();
      await clearBtn.click();

      // Info should indicate points cleared
      await expect(info).toContainText('Cleared all points and clusters');

      // Now Step should show 'No points available' message
      await stepBtn.click();
      await expect(info).toContainText('No points available');

      expect(consoleErrors.length, `Console errors during clear: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors during clear: ${JSON.stringify(pageErrors)}`).toBe(0);
    });

    test('kInput change event clamps bounds and respects points count', async ({ page }) => {
      const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

      await page.goto(BASE_URL);

      const kInput = page.locator('#kInput');
      const pointsInput = page.locator('#pointsInput');
      const generateBtn = page.locator('#generateBtn');

      // If there are no points, setting k greater than max should clamp to 10 and then to points.length||1 -> should become 1
      await kInput.fill('20');
      await kInput.dispatchEvent('change');
      // Because points.length == 0, implementation sets kInput.value = points.length || 1 -> 1
      await expect(kInput).toHaveValue('1');

      // Now generate a small number of points (e.g., 20) and set k higher than points count to see adjustment on generate
      await pointsInput.fill('20');
      await pointsInput.dispatchEvent('change');
      await kInput.fill('50');
      await kInput.dispatchEvent('change');
      // Click generate; code will adjust k to n and set info message accordingly
      await generateBtn.click();

      const info = page.locator('#info');
      await expect(info).toContainText('adjusting k');

      // Ensure kInput is updated to the points count (20)
      await expect(kInput).toHaveValue('20');

      expect(consoleErrors.length, `Console errors during kInput change: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors during kInput change: ${JSON.stringify(pageErrors)}`).toBe(0);
    });

    test('pointsInput change event clamps to allowed min and max values', async ({ page }) => {
      const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

      await page.goto(BASE_URL);

      const pointsInput = page.locator('#pointsInput');

      // Try setting below min
      await pointsInput.fill('5');
      await pointsInput.dispatchEvent('change');
      await expect(pointsInput).toHaveValue('10');

      // Try setting above max
      await pointsInput.fill('5000');
      await pointsInput.dispatchEvent('change');
      await expect(pointsInput).toHaveValue('1000');

      expect(consoleErrors.length, `Console errors during pointsInput change: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors during pointsInput change: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });

  test.describe('Observability: console and page errors are monitored for each user flow', () => {
    test('No unexpected runtime errors during a typical user flow', async ({ page }) => {
      const { consoleErrors, pageErrors } = await attachErrorCollectors(page);

      await page.goto(BASE_URL);

      // Typical flow: generate, step, run, clear
      const generateBtn = page.locator('#generateBtn');
      const stepBtn = page.locator('#stepBtn');
      const runBtn = page.locator('#runBtn');
      const clearBtn = page.locator('#clearBtn');
      const info = page.locator('#info');

      await generateBtn.click();
      await stepBtn.click();

      // Run clustering - wait for convergence
      await runBtn.click();
      await expect(info).toMatch(/K-Means converged in \d+ iteration/, { timeout: 7000 });

      await clearBtn.click();

      // After the flow, assert there were no console errors or uncaught exceptions
      expect(consoleErrors.length, `Unexpected console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Unexpected page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });
});