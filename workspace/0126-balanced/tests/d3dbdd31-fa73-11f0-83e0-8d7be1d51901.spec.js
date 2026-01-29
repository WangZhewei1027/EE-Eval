import { test, expect } from '@playwright/test';

test.describe('KNN Interactive Demo (d3dbdd31-fa73-11f0-83e0-8d7be1d51901)', () => {
  // URL of the page under test
  const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3dbdd31-fa73-11f0-83e0-8d7be1d51901.html';

  // Containers for runtime errors / console errors observed during each test
  let consoleErrors;
  let pageErrors;

  // Helper: click on canvas at given coordinates relative to canvas top-left
  async function clickCanvasAt(page, x, y, options = {}) {
    const canvas = page.locator('#canvas');
    await canvas.waitFor();
    // Playwright's click position is relative to element's top-left
    await canvas.click({ position: { x, y }, ...options });
  }

  // Helper: set range input value and dispatch input event
  async function setRangeValue(page, selector, value) {
    await page.$eval(selector, (el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  // Setup before each test: navigate to app and attach listeners to capture console/page errors
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // capture console messages; record those with type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // capture unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    await page.goto(APP_URL);
    // ensure main heading is rendered before tests proceed
    await expect(page.locator('h1')).toHaveText('K-Nearest Neighbors (KNN) — Interactive Demo');
  });

  // Teardown: ensure there were no console.errors or unhandled page errors during the test
  test.afterEach(async () => {
    // If there are any console or page errors, fail the test with details
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      const msgs = [
        ...consoleErrors.map(e => `ConsoleError: ${e.text}`),
        ...pageErrors.map(e => `PageError: ${e}`)
      ].join('\n');
      // throw to make failures visible
      throw new Error('Runtime errors detected during test:\n' + msgs);
    }
  });

  test.describe('Initial UI and rendering', () => {
    test('renders expected controls and canvas', async ({ page }) => {
      // Verify controls exist and initial values are correct
      await expect(page.locator('#mode')).toBeVisible();
      await expect(page.locator('#classSelect')).toBeVisible();
      await expect(page.locator('#kRange')).toBeVisible();
      await expect(page.locator('#kVal')).toHaveText('5');
      await expect(page.locator('#distMetric')).toBeVisible();
      await expect(page.locator('#weighting')).toBeVisible();
      await expect(page.locator('#clearBtn')).toBeVisible();
      await expect(page.locator('#randomBtn')).toBeVisible();
      await expect(page.locator('#boundaryBtn')).toBeVisible();
      await expect(page.locator('#autoClassifyBtn')).toBeVisible();
      await expect(page.locator('#explainBtn')).toBeVisible();
      await expect(page.locator('#canvas')).toBeVisible();

      // result and neighbors text should show 'none' initially (no query yet)
      await expect(page.locator('#result')).toContainText('Query result: <em>none</em>');
      await expect(page.locator('#neighbors')).toHaveText(/Nearest neighbors: none/);
    });
  });

  test.describe('Primary interactions and transitions', () => {
    test('Random clusters, place query, and classification display', async ({ page }) => {
      // Click Random clusters to ensure training points exist
      await page.click('#randomBtn');

      // Switch to query mode
      await page.selectOption('#mode', 'query');

      // Place query roughly at center of canvas
      const canvasBox = await page.locator('#canvas').boundingBox();
      const cx = Math.floor((canvasBox.width) / 2);
      const cy = Math.floor((canvasBox.height) / 2);

      // Click to set query point
      await clickCanvasAt(page, cx, cy);

      // Expect resultDiv to update to something other than 'none'
      await expect(page.locator('#result')).not.toContainText('none');

      // Neighbors should list at least one neighbor
      await expect(page.locator('#neighbors')).toContainText('Nearest neighbors:');

      // The result should include one of the class labels A/B/C
      const resultText = await page.locator('#result').innerText();
      expect(resultText).toMatch(/A|B|C/);
    });

    test('Changing k (kRange) updates display', async ({ page }) => {
      // Ensure there are points by generating random clusters and placing a query
      await page.click('#randomBtn');
      await page.selectOption('#mode', 'query');

      // Place a query so classification is shown
      await clickCanvasAt(page, 100, 80);
      await expect(page.locator('#result')).not.toContainText('none');

      // Change k to 3
      await setRangeValue(page, '#kRange', 3);
      // kVal should reflect change
      await expect(page.locator('#kVal')).toHaveText('3');

      // Changing the k should update classification display (still show Query result)
      await expect(page.locator('#result')).not.toContainText('none');
    });

    test('Changing distance metric and weighting updates classification without errors', async ({ page }) => {
      // Create points and a query
      await page.click('#randomBtn');
      await page.selectOption('#mode', 'query');
      await clickCanvasAt(page, 120, 150);
      await expect(page.locator('#result')).not.toContainText('none');

      // Change distance metric to manhattan
      await page.selectOption('#distMetric', 'manhattan');
      // The display should still show something (not crash)
      await expect(page.locator('#result')).not.toContainText('none');

      // Change weighting to distance
      await page.selectOption('#weighting', 'distance');
      await expect(page.locator('#result')).not.toContainText('none');
    });

    test('Class selection change is a no-op but does not throw', async ({ page }) => {
      // Change class selection and ensure no runtime errors
      await page.selectOption('#classSelect', '2'); // select Class C
      // No visible change expected, but ensure controls are still usable
      await expect(page.locator('#classSelect')).toHaveValue('2');
    });

    test('Clear button removes all points and query and updates UI', async ({ page }) => {
      // Generate points and place a query
      await page.click('#randomBtn');
      await page.selectOption('#mode', 'query');
      await clickCanvasAt(page, 60, 60);
      await expect(page.locator('#result')).not.toContainText('none');

      // Clear everything
      await page.click('#clearBtn');

      // After clearing, result and neighbors should be 'none'
      await expect(page.locator('#result')).toContainText('Query result: <em>none</em>');
      await expect(page.locator('#neighbors')).toHaveText(/Nearest neighbors: none/);
    });

    test('Auto-classify button places a query and updates classification', async ({ page }) => {
      // Ensure there are training points
      await page.click('#randomBtn');

      // Click the auto-classify button, which places a query randomly and classifies
      await page.click('#autoClassifyBtn');

      // Expect result to not be 'none' when points exist
      await expect(page.locator('#result')).not.toContainText('none');
      await expect(page.locator('#neighbors')).not.toContainText('none');
    });

    test('Toggle decision regions renders without runtime errors', async ({ page }) => {
      // Click the boundary toggle a few times to exercise rendering of regions
      await page.click('#boundaryBtn');
      await page.click('#boundaryBtn');
      // No explicit DOM change expected, but ensure UI still available
      await expect(page.locator('#boundaryBtn')).toBeVisible();
    });

    test('Explain button shows help alert when no query exists', async ({ page }) => {
      // Ensure cleared state
      await page.click('#clearBtn');

      // Click explain and expect an alert instructing to place query first
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#explainBtn'),
      ]);
      const msg = dialog.message();
      expect(msg).toContain('Place a query point first');
      await dialog.accept();
    });

    test('Explain button shows detailed explanation when query present', async ({ page }) => {
      // Ensure training points exist, place query
      await page.click('#randomBtn');
      await page.selectOption('#mode', 'query');
      await clickCanvasAt(page, 200, 140);
      await expect(page.locator('#result')).not.toContainText('none');

      // Click explain; an alert with explanation should appear
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#explainBtn'),
      ]);
      const msg1 = dialog.message();
      expect(msg).toContain('Classification explanation');
      expect(msg).toMatch(/Nearest neighbors \(closest first\):/);
      // accept dialog
      await dialog.accept();
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Adding a training point, placing query exactly on it yields 100% probability', async ({ page }) => {
      // Start from cleared state to avoid other nearby points influencing result
      await page.click('#clearBtn');

      // Switch to add mode and set class to A (0), then add a point at 100,100
      await page.selectOption('#mode', 'add');
      await page.selectOption('#classSelect', '0');
      await clickCanvasAt(page, 100, 100);

      // Switch to query mode and place query at the exact same coordinates
      await page.selectOption('#mode', 'query');
      await clickCanvasAt(page, 100, 100);

      // Expect result to include 100.0% for the corresponding class
      const resultHtml = await page.locator('#result').innerHTML();
      // The probabilities are displayed like "A: 100.0%"
      expect(resultHtml).toMatch(/A: .*100\.0%/);
    });

    test('Erase mode removes the last added training point', async ({ page }) => {
      // Clear existing data
      await page.click('#clearBtn');

      // Add a single training point
      await page.selectOption('#mode', 'add');
      await page.selectOption('#classSelect', '1'); // Class B
      const px = 150, py = 150;
      await clickCanvasAt(page, px, py);

      // Verify that placing a query at same point yields 100% for class B
      await page.selectOption('#mode', 'query');
      await clickCanvasAt(page, px, py);
      const resultBefore = await page.locator('#result').innerText();
      expect(resultBefore).toMatch(/B: .*100\.0%/);

      // Now switch to erase and click near the same spot to remove the training point
      await page.selectOption('#mode', 'erase');
      // Click very near previous location (within erase threshold < 20px)
      await clickCanvasAt(page, px + 4, py + 3);

      // Now place query at same coordinates again
      await page.selectOption('#mode', 'query');
      await clickCanvasAt(page, px, py);

      // With no training points, result should show none
      await expect(page.locator('#result')).toContainText('Query result: <em>none</em>');
      await expect(page.locator('#neighbors')).toHaveText(/Nearest neighbors: none/);
    });

    test('k value larger than number of points handled gracefully', async ({ page }) => {
      // Clear and add only 2 points
      await page.click('#clearBtn');
      await page.selectOption('#mode', 'add');
      await clickCanvasAt(page, 50, 50);
      await clickCanvasAt(page, 80, 80);

      // Place query
      await page.selectOption('#mode', 'query');
      await clickCanvasAt(page, 60, 60);

      // Set k to a large number (beyond max allowed slider value we set to max=25)
      // But we can set to max anyway; ensures algorithm uses Math.min(k, points.length)
      await setRangeValue(page, '#kRange', 25);
      await expect(page.locator('#kVal')).toHaveText('25');

      // Expect classification to not throw and neighbors to list something (<= points.length)
      await expect(page.locator('#neighbors')).not.toContainText('none');
    });

    test('Keyboard shortcuts: Backspace removes last added point when in add mode', async ({ page }) => {
      // Clear, then add two points
      await page.click('#clearBtn');
      await page.selectOption('#mode', 'add');
      await clickCanvasAt(page, 30, 30);
      await clickCanvasAt(page, 40, 40);

      // Press Backspace -- should remove last point (internal), but we validate via placing query
      await page.keyboard.press('Backspace');

      // Place a query near the second point location (40,40) - since it was removed,
      // classification should not necessarily show that class exclusively; we at least assert no runtime errors
      await page.selectOption('#mode', 'query');
      await clickCanvasAt(page, 40, 40);
      // neighbors may be non-none or none depending on remaining points; ensure UI responds
      await expect(page.locator('#result')).toBeVisible();
    });

    test('Resize and keyboard random trigger (r) do not throw', async ({ page }) => {
      // Trigger window resize event
      await page.evaluate(() => { window.dispatchEvent(new Event('resize')); });
      // Trigger 'r' keydown to generate random clusters
      await page.keyboard.press('r');
      // Ensure UI still available
      await expect(page.locator('#randomBtn')).toBeVisible();
    });
  });
});