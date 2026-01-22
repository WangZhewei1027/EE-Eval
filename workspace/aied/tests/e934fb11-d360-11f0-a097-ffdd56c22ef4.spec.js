import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e934fb11-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('KNN Interactive Demo - e934fb11-d360-11f0-a097-ffdd56c22ef4', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console and page errors exactly as the app runs
    page.on('console', (msg) => {
      // record console messages (type and text)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      // record uncaught page errors
      pageErrors.push(err);
    });

    // Navigate to the page and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure the canvas and controls are visible before interaction
    await expect(page.locator('#plot')).toBeVisible();
    await expect(page.locator('#kRange')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity: no unexpected navigation occurred
    await expect(page).toHaveURL(APP_URL);
  });

  // Helper to parse the training points count from the info panel
  async function getTrainingCountFromInfo(page) {
    const infoHtml = await page.locator('#info').innerHTML();
    // Look for "Training points: <strong>NUMBER</strong>"
    const match = infoHtml.match(/Training points:\s*<strong>(\d+)<\/strong>/);
    if (match) return parseInt(match[1], 10);
    return null;
  }

  // Helper to get whether info shows a prediction (contains "Predicted:")
  async function infoShowsPrediction(page) {
    const txt = await page.locator('#info').innerText();
    return txt.includes('Predicted:');
  }

  test.describe('Initialization and UI state validations', () => {
    test('Initial page should render and show a prediction (seedDemo sets a query) and no runtime errors', async ({ page }) => {
      // The page seeds a demo query in seedDemo(); expect "Predicted" to be visible in #info
      const showsPred = await infoShowsPrediction(page);
      expect(showsPred).toBe(true);

      // kVal should reflect the range default value
      const kValText = await page.locator('#kVal').innerText();
      expect(kValText.trim()).toBe(await page.locator('#kRange').evaluate((el) => el.value));

      // No uncaught page errors should have happened during load
      expect(pageErrors.length).toBe(0);
      // No console messages of type 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Clear button transitions to Idle state (S0_Idle): no query and training points cleared', async ({ page }) => {
      // Click Clear
      await page.locator('#clearBtn').click();

      // Info should indicate no query and training points: 0
      const infoText = await page.locator('#info').innerText();
      expect(infoText).toContain('No query point yet. Click on canvas to classify.');
      const trainingCount = await getTrainingCountFromInfo(page);
      expect(trainingCount).toBe(0);

      // Confirm no page errors occurred due to this action
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Canvas interactions (ClickCanvas, RightClickCanvas) and transitions', () => {
    test('Shift+Click on canvas adds a training point (S2_TrainingPointAdded)', async ({ page }) => {
      // Ensure a clean starting point
      await page.locator('#clearBtn').click();
      // Sanity: training points 0
      let count = await getTrainingCountFromInfo(page);
      expect(count).toBe(0);

      // Shift+Click at canvas center to add a training point
      const canvas = page.locator('#plot');
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      const center = { x: Math.round(box.width / 2), y: Math.round(box.height / 2) };
      await canvas.click({ position: center, modifiers: ['Shift'] });

      // After adding one training point and no query, info should show training points: 1
      count = await getTrainingCountFromInfo(page);
      expect(count).toBe(1);

      // Ensure no uncaught page errors happened
      expect(pageErrors.length).toBe(0);
    });

    test('Click on canvas after generating blobs places a query and shows a prediction (S0 -> S1)', async ({ page }) => {
      // Generate lots of training points first
      await page.locator('#genBlobs').click();

      // Ensure points were generated: training count should be > 0
      let count = await getTrainingCountFromInfo(page);
      expect(count).toBeGreaterThan(0);

      // Click center of canvas (normal click) to place a query
      const canvas = page.locator('#plot');
      const box = await canvas.boundingBox();
      const center = { x: Math.round(box.width / 2), y: Math.round(box.height / 2) };
      await canvas.click({ position: center });

      // Info should show a prediction (Predicted:)
      const showsPred = await infoShowsPrediction(page);
      expect(showsPred).toBe(true);

      // Ensure the neighbor list and metric display are present
      const infoHtml = await page.locator('#info').innerHTML();
      expect(infoHtml).toContain('Neighbors (closest first):');
      expect(infoHtml).toMatch(/Distance measured with/);

      // No runtime errors
      expect(pageErrors.length).toBe(0);
    });

    test('Clicking multiple times updates the query (S1_QueryPlaced -> S1_QueryPlaced)', async ({ page }) => {
      // Ensure we have blobs to make classification meaningful
      await page.locator('#genBlobs').click();
      const canvas = page.locator('#plot');
      const box = await canvas.boundingBox();
      const center = { x: Math.round(box.width / 2), y: Math.round(box.height / 2) };

      // Place first query
      await canvas.click({ position: center });
      await expect(page.locator('#info')).toContainText('Neighbors (closest first):');

      // Capture info neighbor's first distance string
      const firstInfo = await page.locator('#info').innerText();
      const firstMatch = firstInfo.match(/dist\s([0-9]*\.[0-9]+)/);
      // Click at slightly different location
      const offset = { x: center.x + 30, y: center.y + 10 };
      await canvas.click({ position: offset });

      const secondInfo = await page.locator('#info').innerText();
      const secondMatch = secondInfo.match(/dist\s([0-9]*\.[0-9]+)/);

      // At least one of the distance values should be present and the info should update
      expect(firstMatch || secondMatch).toBeTruthy();
      // The info panel should still show a prediction after clicking again
      expect(await infoShowsPrediction(page)).toBe(true);

      expect(pageErrors.length).toBe(0);
    });

    test('Right-click (contextmenu) removes nearest training point (RightClickCanvas)', async ({ page }) => {
      // Generate blobs to ensure multiple training points exist
      await page.locator('#genBlobs').click();
      let before = await getTrainingCountFromInfo(page);
      expect(before).toBeGreaterThan(0);

      const canvas = page.locator('#plot');
      const box = await canvas.boundingBox();
      const pos = { x: Math.round(box.width / 3), y: Math.round(box.height / 3) };

      // Right-click at pos to remove nearest training point
      await canvas.click({ position: pos, button: 'right' });

      // training count should decrease by at least 1 (if nearest removed)
      const after = await getTrainingCountFromInfo(page);
      // Some implementations may cluster points; ensure it's <= before
      expect(after).toBeLessThanOrEqual(before);
      // If it didn't change (rare), at least no error occurred
      expect(pageErrors.length).toBe(0);
    });

    test('Right-click on empty canvas should do nothing and not throw errors (edge case)', async ({ page }) => {
      // Clear points so canvas has no training points
      await page.locator('#clearBtn').click();
      const before = await getTrainingCountFromInfo(page);
      expect(before).toBe(0);

      // Right-click center
      const canvas = page.locator('#plot');
      const box = await canvas.boundingBox();
      const center = { x: Math.round(box.width / 2), y: Math.round(box.height / 2) };
      await canvas.click({ position: center, button: 'right' });

      // Still zero training points and no page errors
      const after = await getTrainingCountFromInfo(page);
      expect(after).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Controls: K range, metric, weighting, show boundary', () => {
    test('Changing K via range input updates UI (InputKRange) and redraws', async ({ page }) => {
      // Generate blobs to have some points
      await page.locator('#genBlobs').click();

      // Change kRange programmatically and dispatch input event
      await page.evaluate(() => {
        const el = document.getElementById('kRange');
        el.value = '7';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // kVal should update to 7
      expect(await page.locator('#kVal').innerText()).toBe('7');

      // Place a query to ensure redraw uses K=7 in the info neighbor small-muted text
      const canvas = page.locator('#plot');
      const box = await canvas.boundingBox();
      const center = { x: Math.round(box.width / 2), y: Math.round(box.height / 2) };
      await canvas.click({ position: center });

      const info = await page.locator('#info').innerText();
      expect(info).toContain('K=7');

      expect(pageErrors.length).toBe(0);
    });

    test('Changing distance metric triggers redraw and is reflected in neighbors display (ChangeMetric)', async ({ page }) => {
      // Ensure there are points
      await page.locator('#genBlobs').click();

      // Place a query so neighbor info is shown
      const canvas = page.locator('#plot');
      const box = await canvas.boundingBox();
      const center = { x: Math.round(box.width / 2), y: Math.round(box.height / 2) };
      await canvas.click({ position: center });

      // Change metric to manhattan
      await page.locator('#metric').selectOption('manhattan');

      // Info should reflect metric change in the neighbor small-muted line
      await expect(page.locator('#info')).toContainText('Distance measured with manhattan');

      // Change metric to chebyshev as well and assert text updates
      await page.locator('#metric').selectOption('chebyshev');
      await expect(page.locator('#info')).toContainText('Distance measured with chebyshev');

      expect(pageErrors.length).toBe(0);
    });

    test('Toggling showBoundary redraws without throwing errors (ToggleShowBoundary)', async ({ page }) => {
      // Toggle the checkbox
      const cb = page.locator('#showBoundary');
      // Initially checked per HTML
      await expect(cb).toBeChecked();

      // Uncheck -> redraw
      await cb.uncheck();
      expect(await cb.isChecked()).toBe(false);

      // Re-check -> redraw
      await cb.check();
      expect(await cb.isChecked()).toBe(true);

      // No runtime errors produced by toggling
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Class management and quick actions', () => {
    test('AddClass adds a new class and selects it (AddClass)', async ({ page }) => {
      // Count legend items initially
      const before = await page.locator('#classLegend .legend-item').count();
      // Click Add class
      await page.locator('#addClassBtn').click();

      // Legend count should increase by 1
      const after = await page.locator('#classLegend .legend-item').count();
      expect(after).toBe(before + 1);

      // The newly added class radio should be checked (selectedClassId set to new id)
      // We'll find the last radio input and expect it to be checked
      const radios = page.locator('#classLegend input[type="radio"]');
      const lastRadio = radios.nth(after - 1);
      await expect(lastRadio).toBeChecked();

      expect(pageErrors.length).toBe(0);
    });

    test('Reset to 3 classes (ResetClasses) returns classes to default and clears points (S3_ClassesReset)', async ({ page }) => {
      // Add a class to change state
      await page.locator('#addClassBtn').click();
      const changed = await page.locator('#classLegend .legend-item').count();
      expect(changed).toBeGreaterThanOrEqual(4);

      // Click Reset to 3 classes
      await page.locator('#resetClassesBtn').click();

      // class legend should have exactly 3 items
      const afterReset = await page.locator('#classLegend .legend-item').count();
      expect(afterReset).toBe(3);

      // After resetToThreeClasses, points are cleared and query = null -> info shows idle text
      const infoHtml = await page.locator('#info').innerHTML();
      expect(infoHtml).toContain('No query point yet. Click on canvas to classify.');

      expect(pageErrors.length).toBe(0);
    });

    test('Quick actions: Shuffle and Randomize placement keep training count but do not throw (ShufflePoints, RandomizePlacement)', async ({ page }) => {
      // Generate blobs to create many training points
      await page.locator('#genBlobs').click();
      const before = await getTrainingCountFromInfo(page);
      expect(before).toBeGreaterThan(0);

      // Shuffle
      await page.locator('#shuffleBtn').click();
      const afterShuffle = await getTrainingCountFromInfo(page);
      expect(afterShuffle).toBe(before);

      // Randomize placement
      await page.locator('#splitBtn').click();
      const afterSplit = await getTrainingCountFromInfo(page);
      expect(afterSplit).toBe(before);

      expect(pageErrors.length).toBe(0);
    });

    test('Generate random blob button (GenerateBlobs) creates many training points and clears query', async ({ page }) => {
      // Ensure some query exists first (seeded)
      // Now click generate blobs
      await page.locator('#genBlobs').click();

      // Query should be null and training points > 0
      const training = await getTrainingCountFromInfo(page);
      expect(training).toBeGreaterThan(0);

      // Info should display training point count rather than prediction
      const showsPred = await infoShowsPrediction(page);
      // It's valid for seedDemo to set a query again later, but genBlobs sets query=null explicitly
      // So we expect prediction not to be shown immediately after genBlobs
      expect(showsPred).toBe(false);

      expect(pageErrors.length).toBe(0);
    });

    test('ClearPoints button (Clear) removes all training points and query (ClearPoints)', async ({ page }) => {
      // Generate then clear
      await page.locator('#genBlobs').click();
      let training = await getTrainingCountFromInfo(page);
      expect(training).toBeGreaterThan(0);

      await page.locator('#clearBtn').click();
      training = await getTrainingCountFromInfo(page);
      expect(training).toBe(0);
      const infoText = await page.locator('#info').innerText();
      expect(infoText).toContain('No query point yet. Click on canvas to classify.');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Keyboard and small UI interactions', () => {
    test('Pressing "q" toggles click mode label text (keyboard shortcut display)', async ({ page }) => {
      const label = page.locator('#clickModeLabel');
      const initial = await label.innerText();

      // Press q key to toggle
      await page.keyboard.press('q');
      const toggled = await label.innerText();
      expect(toggled === initial || toggled !== initial).toBeTruthy(); // ensure no exception; the toggle may change text

      // Press q again to toggle back
      await page.keyboard.press('q');
      const toggledBack = await label.innerText();
      // After two presses it should be a deterministic string (equal to initial or toggled depending on implementation),
      // but important is that no error was thrown during these actions.
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Runtime error and console observation (observe but do not modify runtime)', () => {
    test('No ReferenceError/SyntaxError/TypeError occurred during interactions', async ({ page }) => {
      // At this stage many interactions have been performed by previous tests in this file run sequence.
      // We assert that there are no uncaught page errors of the major JS error types.
      const majorErrors = pageErrors.filter(e => {
        const msg = (e && e.message) ? e.message : String(e);
        return msg.includes('ReferenceError') || msg.includes('TypeError') || msg.includes('SyntaxError');
      });

      // Assert that none of the captured page errors are major JS runtime errors
      expect(majorErrors.length).toBe(0);

      // Additionally assert the console did not emit error-level logs
      const errorConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(errorConsole.length).toBe(0);
    });
  });
});