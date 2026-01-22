import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f18278f1-d366-11f0-9b19-a558354ece3e.html';

test.describe('KNN Visualization FSM and UI tests - f18278f1-d366-11f0-9b19-a558354ece3e', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Collect console errors and page errors for each test
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      // pageerror gives actual Error object
      pageErrors.push(err);
    });

    // Navigate to the application as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Wait a short time to allow initialization scripts to run (drawCanvas etc.)
    await page.waitForTimeout(100);
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond page lifecycle; keep hooks for clarity
  });

  test.describe('Initial state and component presence', () => {
    test('Initial DOM components exist and initial mode is set to Add Class A', async ({ page }) => {
      // Verify essential controls are present
      await expect(page.locator('#classA')).toHaveCount(1);
      await expect(page.locator('#classB')).toHaveCount(1);
      await expect(page.locator('#classify')).toHaveCount(1);
      await expect(page.locator('#clear')).toHaveCount(1);
      await expect(page.locator('#kValue')).toHaveCount(1);
      await expect(page.locator('#knnCanvas')).toHaveCount(1);
      await expect(page.locator('#kDisplay')).toHaveText('3');

      // The script calls setMode('classA') during initialization, so window.mode should be 'classA'
      const mode = await page.evaluate(() => window.mode);
      expect(mode).toBe('classA');

      // The classA button should have 'active' class after initialization
      const classAHasActive = await page.locator('#classA').getAttribute('class');
      expect(classAHasActive).toContain('active');

      // Confirm no ReferenceError/SyntaxError/TypeError were thrown during load
      const hasSpecificErrors = pageErrors.some(err =>
        ['ReferenceError', 'SyntaxError', 'TypeError'].includes(err.name)
      ) || consoleErrors.some(err => /(ReferenceError|SyntaxError|TypeError)/.test(err.text));
      expect(hasSpecificErrors).toBe(false);
    });
  });

  test.describe('Mode switching (S0_AddClassA, S1_AddClassB, S2_Classify)', () => {
    test('Clicking Add Class B toggles active class and updates status text', async ({ page }) => {
      // Click Class B button
      await page.click('#classB');
      // classB should be active
      const classBClass = await page.locator('#classB').getAttribute('class');
      expect(classBClass).toContain('active');

      // classA should no longer be active
      const classAClass = await page.locator('#classA').getAttribute('class');
      expect(classAClass).not.toContain('active');

      // Status text should indicate adding Class B training points
      const status = await page.locator('#status').textContent();
      expect(status).toContain('Click to add Class B (Red) training points');

      // Verify global mode variable
      const mode = await page.evaluate(() => window.mode);
      expect(mode).toBe('classB');

      // No critical runtime errors
      const hasSpecificErrors = pageErrors.some(err =>
        ['ReferenceError', 'SyntaxError', 'TypeError'].includes(err.name)
      ) || consoleErrors.some(err => /(ReferenceError|SyntaxError|TypeError)/.test(err.text));
      expect(hasSpecificErrors).toBe(false);
    });

    test('Clicking Classify toggles active state and updates status text', async ({ page }) => {
      await page.click('#classify');
      const classifyClass = await page.locator('#classify').getAttribute('class');
      expect(classifyClass).toContain('active');

      const status = await page.locator('#status').textContent();
      expect(status).toContain('Click on the canvas to classify a new point');

      const mode = await page.evaluate(() => window.mode);
      expect(mode).toBe('classify');
    });

    test('Clicking Add Class A returns to classA mode and updates status', async ({ page }) => {
      // Switch away then back
      await page.click('#classify');
      await page.click('#classA');
      const classAClass = await page.locator('#classA').getAttribute('class');
      expect(classAClass).toContain('active');

      const status = await page.locator('#status').textContent();
      expect(status).toContain('Click to add Class A (Blue) training points');

      const mode = await page.evaluate(() => window.mode);
      expect(mode).toBe('classA');
    });
  });

  test.describe('Canvas interactions and transitions (point addition, classification, clearing)', () => {
    test('Adding a Class A point by clicking the canvas increases points.classA', async ({ page }) => {
      // Ensure in classA mode
      await page.click('#classA');

      // Click at coordinate (50,50) relative to top-left of canvas
      const canvas = page.locator('#knnCanvas');
      await canvas.click({ position: { x: 50, y: 50 } });

      // Read points.object
      const classACount = await page.evaluate(() => window.points.classA.length);
      expect(classACount).toBeGreaterThanOrEqual(1);

      // Status text should indicate point added
      const status = await page.locator('#status').textContent();
      expect(status).toContain('Added Class A point');

      // The added point coordinates should be within expected bounds (~50)
      const lastPoint = await page.evaluate(() => window.points.classA[window.points.classA.length - 1]);
      expect(lastPoint).toBeTruthy();
      expect(typeof lastPoint.x).toBe('number');
      expect(typeof lastPoint.y).toBe('number');
      expect(Math.abs(lastPoint.x - 50)).toBeLessThan(20); // some tolerance
      expect(Math.abs(lastPoint.y - 50)).toBeLessThan(20);
    });

    test('Adding a Class B point by clicking the canvas increases points.classB', async ({ page }) => {
      // Switch to Class B
      await page.click('#classB');

      // Click at different location
      const canvas = page.locator('#knnCanvas');
      await canvas.click({ position: { x: 120, y: 80 } });

      const classBCount = await page.evaluate(() => window.points.classB.length);
      expect(classBCount).toBeGreaterThanOrEqual(1);

      const status = await page.locator('#status').textContent();
      expect(status).toContain('Added Class B point');

      const lastPoint = await page.evaluate(() => window.points.classB[window.points.classB.length - 1]);
      expect(lastPoint).toBeTruthy();
      expect(typeof lastPoint.x).toBe('number');
      expect(typeof lastPoint.y).toBe('number');
    });

    test('Classification when training data exists: neighbors and classification are set', async ({ page }) => {
      // Ensure there are at least 2 training points (one each)
      await page.click('#classA');
      await page.locator('#knnCanvas').click({ position: { x: 60, y: 60 } });
      await page.click('#classB');
      await page.locator('#knnCanvas').click({ position: { x: 140, y: 140 } });

      // Switch to classify mode
      await page.click('#classify');

      // Click to classify near Class A point to bias classification
      await page.locator('#knnCanvas').click({ position: { x: 70, y: 70 } });

      // points.classifying should exist
      const classifying = await page.evaluate(() => window.points.classifying);
      expect(classifying).toBeTruthy();
      expect(Array.isArray(classifying.neighbors)).toBe(true);

      // neighbors length should be min(kValue, total training points)
      const kValue = await page.evaluate(() => window.kValue);
      const totalTraining = await page.evaluate(() => window.points.classA.length + window.points.classB.length);
      const expectedNeighbors = Math.min(kValue, totalTraining);
      expect(classifying.neighbors.length).toBe(expectedNeighbors);

      // Classification status should reflect one of the classes or tie
      const status = await page.locator('#status').textContent();
      expect(status).toMatch(/Classification: (Class A|Class B|Tie)/);

      // Examine classification field
      const classification = await page.evaluate(() => window.points.classifying.classification);
      expect(['classA', 'classB', 'tie']).toContain(classification);
    });

    test('Updating K value updates kDisplay and re-classifies when a classifying point exists', async ({ page }) => {
      // Prepare training data and a classifying point
      await page.click('#classA');
      await page.locator('#knnCanvas').click({ position: { x: 80, y: 80 } });
      await page.click('#classB');
      await page.locator('#knnCanvas').click({ position: { x: 130, y: 130 } });
      await page.click('#classify');
      await page.locator('#knnCanvas').click({ position: { x: 100, y: 100 } });

      // Confirm classifying exists
      let neighborsBefore = await page.evaluate(() => window.points.classifying.neighbors.length);
      expect(neighborsBefore).toBeGreaterThanOrEqual(1);

      // Change K value slider to 1 via DOM manipulation (simulating user input)
      const kSlider = page.locator('#kValue');
      await kSlider.evaluate((el) => { el.value = '1'; el.dispatchEvent(new Event('input', { bubbles: true })); });

      // kDisplay must reflect new value
      await expect(page.locator('#kDisplay')).toHaveText('1');

      // kValue global should have been updated
      const kValue = await page.evaluate(() => window.kValue);
      expect(kValue).toBe(1);

      // neighbors should now be of length 1 (or min total training)
      const neighborsAfter = await page.evaluate(() => window.points.classifying.neighbors.length);
      const totalTraining = await page.evaluate(() => window.points.classA.length + window.points.classB.length);
      expect(neighborsAfter).toBe(Math.min(kValue, totalTraining));
    });

    test('Clearing canvas resets points and status (S3_Cleared)', async ({ page }) => {
      // Add some points first
      await page.click('#classA');
      await page.locator('#knnCanvas').click({ position: { x: 40, y: 40 } });
      await page.click('#classB');
      await page.locator('#knnCanvas').click({ position: { x: 150, y: 150 } });

      // Click clear
      await page.click('#clear');

      // points should be reset
      const pointsAfterClear = await page.evaluate(() => window.points);
      expect(pointsAfterClear).toEqual({ classA: [], classB: [], classifying: null });

      // Status text should indicate cleared
      const status = await page.locator('#status').textContent();
      expect(status).toBe('Canvas cleared. Add training points to begin.');
    });

    test('Attempting to classify without training data results in instructive status', async ({ page }) => {
      // Ensure cleared state
      await page.click('#clear');

      // Switch to classify mode
      await page.click('#classify');

      // Click to classify at some location
      await page.locator('#knnCanvas').click({ position: { x: 200, y: 200 } });

      // According to implementation, points.classifying will be set, but status should say to add training points
      const status = await page.locator('#status').textContent();
      expect(status).toBe('Add training points before classifying');

      const classifying = await page.evaluate(() => window.points.classifying);
      // classifying object exists (the implementation sets it), but classification remains null and neighbors empty
      expect(classifying).toBeTruthy();
      expect(Array.isArray(classifying.neighbors)).toBe(true);
      expect(classifying.neighbors.length).toBe(0);
      expect(classifying.classification).toBe(null);
    });

    test('Touch interaction on the canvas triggers point addition (Canvas_Touch event)', async ({ page }) => {
      // Switch to classA for adding via touch
      await page.click('#classA');

      // Dispatch a proper TouchEvent in the page context targeting the canvas
      await page.evaluate(() => {
        const canvas = document.getElementById('knnCanvas');
        const rect = canvas.getBoundingClientRect();
        // Create a Touch object and a TouchEvent
        const touchInit = {
          identifier: Date.now(),
          target: canvas,
          clientX: rect.left + 30,
          clientY: rect.top + 30,
          pageX: rect.left + 30,
          pageY: rect.top + 30,
          screenX: rect.left + 30,
          screenY: rect.top + 30
        };
        // Some browsers require Touch to be constructed; fallback to a simple object in touches array if constructor unavailable
        let touch;
        try {
          touch = new Touch(touchInit);
        } catch (e) {
          touch = touchInit;
        }
        let touchEvent;
        try {
          touchEvent = new TouchEvent('touchstart', { touches: [touch], bubbles: true, cancelable: true });
        } catch (e) {
          // Fallback for environments where TouchEvent constructor isn't available
          touchEvent = document.createEvent('Event');
          touchEvent.initEvent('touchstart', true, true);
          touchEvent.touches = [touch];
        }
        canvas.dispatchEvent(touchEvent);
      });

      // After touchstart handling, there should be at least one classA point
      const classACount = await page.evaluate(() => window.points.classA.length);
      expect(classACount).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Error observation and robustness checks', () => {
    test('No unexpected ReferenceError/SyntaxError/TypeError occurred during interactions', async ({ page }) => {
      // After previous interactions in this test run, assert there were no critical JS errors
      const hasSpecificPageErrors = pageErrors.some(err =>
        ['ReferenceError', 'SyntaxError', 'TypeError'].includes(err.name)
      );

      const hasSpecificConsoleErrors = consoleErrors.some(err => /(ReferenceError|SyntaxError|TypeError)/.test(err.text));

      // We expect the application to run without those runtime exceptions.
      expect(hasSpecificPageErrors || hasSpecificConsoleErrors).toBe(false);
    });

    test('Capture and surface any console errors if present (fails test with details)', async ({ page }) => {
      // This test will intentionally fail if there are console errors, and will print them for debugging.
      if (consoleErrors.length > 0 || pageErrors.length > 0) {
        // Construct readable details
        let details = 'Console errors:\n';
        for (const c of consoleErrors) details += JSON.stringify(c) + '\n';
        details += 'Page errors:\n';
        for (const p of pageErrors) details += `${p.name}: ${p.message}\n${p.stack}\n`;
        // Fail with details so CI shows the exact runtime errors
        throw new Error(details);
      }

      // If none, assert pass
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});