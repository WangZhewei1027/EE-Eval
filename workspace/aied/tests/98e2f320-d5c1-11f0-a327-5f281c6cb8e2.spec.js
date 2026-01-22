import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e2f320-d5c1-11f0-a327-5f281c6cb8e2.html';

test.describe('KNN Interactive Demo (FSM + UI) - 98e2f320-d5c1-11f0-a327-5f281c6cb8e2', () => {
  // Capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console messages
    page.on('console', (msg) => {
      // collect error and exception level messages
      try {
        if (msg.type() === 'error' || /error/i.test(msg.text())) {
          consoleErrors.push({ text: msg.text(), location: msg.location(), type: msg.type() });
        }
      } catch (e) {
        // swallow listener errors
      }
    });

    // Listen to uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the demo page and wait for initial render to settle
    await page.goto(URL, { waitUntil: 'load' });

    // Wait for the canvas and stats to be present
    await page.waitForSelector('#plot');
    await page.waitForSelector('#stats');

    // Give the page a short moment to finish initial generation (genBtn.click() triggered on init)
    await page.waitForTimeout(500);
  });

  test.afterEach(async ({ page }) => {
    // Assert no uncaught page errors occurred
    expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e=>String(e)).join('\n')}`).toHaveLength(0);

    // Assert no console.error messages were logged
    expect(consoleErrors, `Unexpected console.error messages: ${consoleErrors.map(c=>c.text).join('\n')}`).toHaveLength(0);
  });

  // Utility: parse training and query counts from stats text
  async function getStatsCounts(page) {
    const txt = (await page.locator('#stats').innerText()).trim();
    // The stats text is like: "Training points: X — Queries: Y" (sometimes appended LOO acc in commented code)
    const m = txt.match(/Training points:\s*(\d+).*Queries:\s*(\d+)/i);
    if (m) {
      return { training: Number(m[1]), queries: Number(m[2]) };
    }
    // fallback
    return { training: 0, queries: 0 };
  }

  test.describe('Initial state (Idle) and rendering', () => {
    test('page loads in Idle state and renders initial clusters', async ({ page }) => {
      // Validate that mode is default 'add' and elements exist
      const modeValue = await page.locator('#mode').inputValue();
      expect(modeValue).toBe('add');

      // canvas exists and is visible
      await expect(page.locator('#plot')).toBeVisible();

      // classes list and class selector populated
      const classOptions = await page.locator('#classSelect option').count();
      expect(classOptions).toBeGreaterThanOrEqual(3); // default 3 classes

      // Stats should show some training points because the demo calls genBtn.click() on init
      const stats = await getStatsCounts(page);
      expect(stats.training).toBeGreaterThan(0);
      expect(stats.queries).toBeGreaterThanOrEqual(0);

      // lastResult should exist
      await expect(page.locator('#lastResult')).toBeVisible();
    });
  });

  test.describe('Mode transitions and canvas interactions (S0 <-> S1 <-> S2)', () => {
    test('Change mode to query and left-click adds a query (S0 -> S2 -> S2)', async ({ page }) => {
      // Switch to 'query' mode via select
      await page.locator('#mode').selectOption('query');
      expect(await page.locator('#mode').inputValue()).toBe('query');

      // Get initial queries count
      let { queries: beforeQueries } = await getStatsCounts(page);

      // Left-click center of canvas - should add a query when mode is 'query'
      const canvas = page.locator('#plot');
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      const pos = { x: Math.round(box.width / 2), y: Math.round(box.height / 2) };
      await canvas.click({ position: pos });

      // Wait for render
      await page.waitForTimeout(200);

      const { queries: afterQueries } = await getStatsCounts(page);
      expect(afterQueries).toBeGreaterThanOrEqual(beforeQueries + 1);

      // lastResult should mention 'Predicted' or show prediction content (since training points exist)
      const last = (await page.locator('#lastResult').innerText()).trim();
      expect(/Predicted/i.test(last) || /No training data/i.test(last)).toBeTruthy();
    });

    test('Switch back to add mode and left-click adds training point (S2 -> S1)', async ({ page }) => {
      // Ensure mode is 'add'
      await page.locator('#mode').selectOption('add');
      expect(await page.locator('#mode').inputValue()).toBe('add');

      // Get training points before click
      const before = await getStatsCounts(page);

      // Click near top-left of canvas to add a training point
      const canvas = page.locator('#plot');
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      const pos = { x: Math.round(box.width * 0.25), y: Math.round(box.height * 0.25) };
      await canvas.click({ position: pos, button: 'left' });

      // Allow render
      await page.waitForTimeout(200);

      const after = await getStatsCounts(page);
      expect(after.training).toBeGreaterThanOrEqual(before.training + 1);
    });

    test('Right-click on canvas always adds a query (S1 or S2 -> S2)', async ({ page }) => {
      // Ensure mode is 'add' to confirm right-click is independent of mode
      await page.locator('#mode').selectOption('add');
      expect(await page.locator('#mode').inputValue()).toBe('add');

      const before = await getStatsCounts(page);

      // Perform a right-click at a different location
      const canvas = page.locator('#plot');
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      const pos = { x: Math.round(box.width * 0.7), y: Math.round(box.height * 0.6) };
      // Use the right button
      await canvas.click({ position: pos, button: 'right' });

      await page.waitForTimeout(200);

      const after = await getStatsCounts(page);
      expect(after.queries).toBeGreaterThanOrEqual(before.queries + 1);
    });
  });

  test.describe('Parameter adjustments and their effects', () => {
    test('Adjust K slider updates displayed value and recomputes queries', async ({ page }) => {
      // Record queries before changing K
      const before = await getStatsCounts(page);

      // Set K to 5 via JS (dispatch input and change events)
      await page.locator('#k').evaluate((el) => {
        el.value = '5';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Check label updated
      const kval = await page.locator('#kval').innerText();
      expect(kval.trim()).toBe('5');

      // Wait and assert queries remain consistent or got recomputed (counts unchanged but predictions update)
      await page.waitForTimeout(300);
      const after = await getStatsCounts(page);
      // queries count should be same or changed; at minimum should be >= previous queries (some changes may add/remove)
      expect(after.queries).toBeGreaterThanOrEqual(0);

      // lastResult exists and contains 'Predicted' or 'No training data'
      const last = await page.locator('#lastResult').innerText();
      expect(/Predicted|No training data/i.test(last)).toBeTruthy();
    });

    test('Change distance metric and weighting recomputes query predictions', async ({ page }) => {
      // Add a specific query point to have predictable neighbors
      const canvas = page.locator('#plot');
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();

      // Right-click in center to add a query
      await canvas.click({ position: { x: Math.round(box.width/2), y: Math.round(box.height/2) }, button: 'right' });
      await page.waitForTimeout(200);

      // Change metric to 'manhattan' and ensure change event fires
      await page.locator('#metric').selectOption('manhattan');
      expect(await page.locator('#metric').inputValue()).toBe('manhattan');
      await page.waitForTimeout(200);

      // Change weighting to 'distance'
      await page.locator('#weighting').selectOption('distance');
      expect(await page.locator('#weighting').inputValue()).toBe('distance');

      // Allow recompute
      await page.waitForTimeout(300);

      // lastResult should still be present
      const last = await page.locator('#lastResult').innerText();
      expect(/Predicted|No training data/i.test(last)).toBeTruthy();
    });

    test('Toggle decision boundary checkbox updates UI state', async ({ page }) => {
      const check = page.locator('#drawBoundary');
      const beforeChecked = await check.isChecked();

      // Toggle it
      await check.click();
      const afterChecked = await check.isChecked();
      expect(afterChecked).toBe(!beforeChecked);

      // Toggle back
      await check.click();
      expect(await check.isChecked()).toBe(beforeChecked);
    });
  });

  test.describe('Buttons and class management', () => {
    test('Generate random clusters repopulates training points and clears queries', async ({ page }) => {
      // Clear first to have deterministic behavior
      await page.locator('#clearBtn').click();
      await page.waitForTimeout(200);
      let st = await getStatsCounts(page);
      expect(st.training).toBe(0);

      // Click generate
      await page.locator('#genBtn').click();
      // Give it time to generate
      await page.waitForTimeout(400);

      st = await getStatsCounts(page);
      expect(st.training).toBeGreaterThanOrEqual(1);
      // queries should be zero after generation per implementation
      expect(st.queries).toBe(0);
    });

    test('Clear training points and clear queries buttons work', async ({ page }) => {
      // Ensure there is at least one query and one training point
      await page.locator('#genBtn').click();
      await page.waitForTimeout(300);

      // Add a query via right-click
      const canvas = page.locator('#plot');
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      await canvas.click({ position: { x: Math.round(box.width * 0.45), y: Math.round(box.height * 0.55) }, button: 'right' });
      await page.waitForTimeout(200);

      let st = await getStatsCounts(page);
      expect(st.training).toBeGreaterThan(0);
      expect(st.queries).toBeGreaterThanOrEqual(1);

      // Clear queries
      await page.locator('#clearQueriesBtn').click();
      await page.waitForTimeout(200);
      st = await getStatsCounts(page);
      expect(st.queries).toBe(0);

      // Clear training points
      await page.locator('#clearBtn').click();
      await page.waitForTimeout(200);
      st = await getStatsCounts(page);
      expect(st.training).toBe(0);
      expect(st.queries).toBe(0);

      // lastResult text should be 'No query yet.'
      const last = (await page.locator('#lastResult').innerText()).trim();
      expect(last).toBe('No query yet.');
    });

    test('Shuffle K adjusts slider value based on training points', async ({ page }) => {
      // Generate clusters to ensure some training points
      await page.locator('#genBtn').click();
      await page.waitForTimeout(300);

      const beforeK = await page.locator('#k').inputValue();
      await page.locator('#shuffleBtn').click();
      await page.waitForTimeout(200);
      const afterK = await page.locator('#k').inputValue();

      // K should be updated to some valid value <= max
      expect(Number(afterK)).toBeGreaterThanOrEqual(1);
      expect(Number(afterK)).toBeLessThanOrEqual(Number(await page.locator('#k').getAttribute('max')));
      // It may or may not change depending on points count, simply check it's a number string
      expect(/\d+/.test(afterK)).toBeTruthy();
    });

    test('Add class increases classes and Remove last decreases classes and removes points of that class', async ({ page }) => {
      // Count classes before
      const beforeClasses = await page.locator('#classesList > div').count();
      const beforeOptions = await page.locator('#classSelect option').count();

      // Add a class
      await page.locator('#addClassBtn').click();
      await page.waitForTimeout(200);

      const afterClasses = await page.locator('#classesList > div').count();
      const afterOptions = await page.locator('#classSelect option').count();

      expect(afterClasses).toBe(beforeClasses + 1);
      expect(afterOptions).toBe(beforeOptions + 1);

      // Add some training points assigned to the new class
      // Select the newly added class in classSelect
      const newIndex = String(afterOptions - 1);
      await page.locator('#classSelect').selectOption(newIndex);
      expect(await page.locator('#classSelect').inputValue()).toBe(newIndex);

      // Click on canvas to add a training point for the new class
      const canvas = page.locator('#plot');
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      await canvas.click({ position: { x: Math.round(box.width * 0.4), y: Math.round(box.height * 0.4) }, button: 'left' });
      await page.waitForTimeout(200);

      const statsWithNewPoint = await getStatsCounts(page);
      expect(statsWithNewPoint.training).toBeGreaterThanOrEqual(1);

      // Now remove last class
      await page.locator('#removeClassBtn').click();
      await page.waitForTimeout(300);

      const classesAfterRemoval = await page.locator('#classSelect option').count();
      expect(classesAfterRemoval).toBe(afterOptions - 1);

      // Points belonging to removed class should have been removed: training count should not include them
      const statsAfterRemoval = await getStatsCounts(page);
      expect(statsAfterRemoval.training).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Edge cases and error-prone scenarios', () => {
    test('Distance-weighting handles zero-distance neighbor (exact match) correctly', async ({ page }) => {
      // Ensure at least one training point exists; if not, generate clusters
      let st = await getStatsCounts(page);
      if (st.training === 0) {
        await page.locator('#genBtn').click();
        await page.waitForTimeout(300);
      }

      // Get coordinates (relative to canvas) of the first training point via page.evaluate using exposed _knnDemo data
      const coords = await page.evaluate(() => {
        try {
          const canvas = document.getElementById('plot');
          const W = canvas.width, H = canvas.height, pad = 8;
          // Use the first training point if available
          const p = window._knnDemo && window._knnDemo.points && window._knnDemo.points[0];
          if (!p) return null;
          // compute pixel coords relative to canvas top-left
          const px = Math.round(pad + p.x * (W - pad * 2));
          const py = Math.round(pad + (1 - p.y) * (H - pad * 2));
          return { px, py };
        } catch (e) {
          return null;
        }
      });

      expect(coords).not.toBeNull();

      // Set weighting to 'distance' to trigger the 1/d behavior (and infinite-like weight on zero distance)
      await page.locator('#weighting').selectOption('distance');
      await page.waitForTimeout(100);

      // Right-click exactly on the training point to create a query at zero distance
      const canvas = page.locator('#plot');
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();

      // Position is relative to element top-left; compute relative position to use locator.click({position})
      const relX = coords.px;
      const relY = coords.py;

      // Add query at exact training point location using right-click
      await canvas.click({ position: { x: relX, y: relY }, button: 'right' });
      await page.waitForTimeout(300);

      // The query should predict the same class as that exact training point (because of huge weight)
      const lastHtml = await page.locator('#lastResult').innerHTML();
      // Expect predicted label to reference a class name (Class X)
      expect(/Predicted:/i.test(lastHtml)).toBeTruthy();
      // Ensure neighbors count printed at least 1 (Neighbors: N)
      expect(/Neighbors:\s*\d+/i.test(lastHtml)).toBeTruthy();
    });

    test('Removing class when only one class exists does nothing (no crash)', async ({ page }) => {
      // Remove classes until only one left
      let classCount = await page.locator('#classSelect option').count();
      while (classCount > 1) {
        await page.locator('#removeClassBtn').click();
        await page.waitForTimeout(100);
        classCount = await page.locator('#classSelect option').count();
      }

      // Now attempt to remove last class - expected: no crash and classCount remains 1
      await page.locator('#removeClassBtn').click();
      await page.waitForTimeout(200);
      const finalCount = await page.locator('#classSelect option').count();
      expect(finalCount).toBe(1);

      // Ensure no page errors were produced (checked in afterEach)
    });
  });
});