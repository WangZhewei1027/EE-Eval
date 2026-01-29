import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3e2390-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('K-Nearest Neighbors Demo (FSM + UI) - de3e2390-fa74-11f0-a1b6-4b9b8151441a', () => {
  // Collect console messages and page errors for each test run
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture console messages and page errors
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright's automatic cleanup.
  });

  test('Initial state (Idle) - currentMode null, no points, no testPoint', async ({ page }) => {
    // Validate initial global state (FSM S0_Idle evidence)
    const state = await page.evaluate(() => {
      return {
        currentMode: typeof currentMode === 'undefined' ? 'undefined' : currentMode,
        pointsLength: Array.isArray(points) ? points.length : 'no-points-array',
        testPoint: typeof testPoint === 'undefined' ? 'undefined' : testPoint,
        resultHTML: document.getElementById('result').innerHTML.trim()
      };
    });

    // Expectation based on HTML implementation: currentMode initialized to null, points = [], testPoint = null
    expect(state.currentMode).toBeNull();
    expect(state.pointsLength).toBe(0);
    expect(state.testPoint).toBeNull();
    expect(state.resultHTML).toBe('');

    // Ensure no uncaught page errors occurred during initial load
    expect(pageErrors.length).toBe(0);

    // Also ensure no severe console messages were printed (allowing info/debug)
    const severe = consoleMessages.filter(m => ['error', 'warning'].includes(m.type));
    expect(severe.length).toBe(0);
  });

  test.describe('Mode selection and Canvas interactions (Add Red / Blue / Test)', () => {
    test('Click Add Red -> currentMode becomes "red"; canvas click adds a red training point', async ({ page }) => {
      // Select Add Red mode
      await page.click('#addRed');
      // Confirm currentMode set to 'red'
      const modeAfterButton = await page.evaluate(() => currentMode);
      expect(modeAfterButton).toBe('red');

      // Click on canvas at a known coordinate
      await page.click('#canvas', { position: { x: 100, y: 80 } });
      // Small wait to allow synchronous drawing and state mutation
      await page.waitForTimeout(50);

      // Validate a training point was added and color is 'red'
      const after = await page.evaluate(() => {
        return {
          pointsLength: points.length,
          lastPoint: points[points.length - 1],
          currentMode: currentMode
        };
      });

      expect(after.pointsLength).toBeGreaterThanOrEqual(1);
      expect(after.lastPoint.color).toBe('red');

      // Note: FSM transition expects returning to Idle (currentMode = null) after canvas click.
      // The implementation does NOT reset currentMode, so we assert actual behavior here:
      expect(after.currentMode).toBe('red');
    });

    test('Click Add Blue -> currentMode becomes "blue"; canvas click adds a blue training point', async ({ page }) => {
      // Select Add Blue mode
      await page.click('#addBlue');
      const modeAfterButton = await page.evaluate(() => currentMode);
      expect(modeAfterButton).toBe('blue');

      // Click on canvas at another coordinate
      await page.click('#canvas', { position: { x: 150, y: 120 } });
      await page.waitForTimeout(50);

      const after = await page.evaluate(() => {
        return {
          pointsLength: points.length,
          lastPoint: points[points.length - 1],
          currentMode: currentMode
        };
      });

      expect(after.pointsLength).toBeGreaterThanOrEqual(1);
      expect(after.lastPoint.color).toBe('blue');
      // Implementation keeps currentMode as 'blue' (no reset to idle)
      expect(after.currentMode).toBe('blue');
    });

    test('Canvas click while no mode selected should not add training or test points', async ({ page }) => {
      // Ensure currentMode is null (Idle)
      await page.evaluate(() => { currentMode = null; });
      const beforePoints = await page.evaluate(() => points.length);

      // Click on canvas without selecting a mode
      await page.click('#canvas', { position: { x: 200, y: 50 } });
      await page.waitForTimeout(50);

      const afterPoints = await page.evaluate(() => points.length);
      expect(afterPoints).toBe(beforePoints);
    });

    test('Add Test Point flow: after training points added, adding test triggers classification and draws result', async ({ page }) => {
      // Clear first to start deterministic
      await page.click('#clear');

      // Add one red training point
      await page.click('#addRed');
      await page.click('#canvas', { position: { x: 60, y: 60 } });
      await page.waitForTimeout(20);

      // Add one blue training point
      await page.click('#addBlue');
      await page.click('#canvas', { position: { x: 120, y: 60 } });
      await page.waitForTimeout(20);

      // Switch to test mode
      await page.click('#addTest');
      const mode = await page.evaluate(() => currentMode);
      expect(mode).toBe('test');

      // Click canvas to add the test point between red and blue
      await page.click('#canvas', { position: { x: 90, y: 60 } });
      await page.waitForTimeout(50);

      // Validate testPoint set and resultDiv contains classification info
      const result = await page.evaluate(() => {
        return {
          pointsLength: points.length,
          testPoint: testPoint,
          resultHTML: document.getElementById('result').innerText.replace(/\s+/g, ' ').trim()
        };
      });

      expect(result.pointsLength).toBe(2);
      expect(result.testPoint).toBeTruthy();
      expect(result.testPoint.color).toBe('green');

      // With one red and one blue neighbor and default K=3, nearest neighbors = both -> tie
      expect(result.resultHTML).toContain('K = 3');
      expect(result.resultHTML).toMatch(/Nearest neighbors:\s*1 red,\s*1 blue/);
      expect(result.resultHTML).toMatch(/Test point is classified as:\s*tie/i);

      // Implementation note: currentMode remains 'test' after clicking (no reset). Assert actual value:
      const currentModeNow = await page.evaluate(() => currentMode);
      expect(currentModeNow).toBe('test');
    });
  });

  test.describe('K value changes and reclassification', () => {
    test('Changing K updates classification when testPoint exists', async ({ page }) => {
      // Start from clear state
      await page.click('#clear');

      // Add two training points: one red near left, one blue near right
      await page.click('#addRed');
      await page.click('#canvas', { position: { x: 50, y: 250 } });
      await page.waitForTimeout(10);

      await page.click('#addBlue');
      await page.click('#canvas', { position: { x: 200, y: 250 } });
      await page.waitForTimeout(10);

      // Add test point closer to red
      await page.click('#addTest');
      await page.click('#canvas', { position: { x: 80, y: 250 } });
      await page.waitForTimeout(50);

      // Verify initial classification with default K=3 -> tie (2 neighbors)
      let htmlBefore = await page.evaluate(() => document.getElementById('result').innerText.replace(/\s+/g, ' ').trim());
      expect(htmlBefore).toContain('K = 3');
      expect(htmlBefore).toMatch(/Nearest neighbors:\s*1 red,\s*1 blue/);

      // Change K to 1 (edge of allowed range) -> testPoint should classify as the nearest neighbor's color
      await page.fill('#kValue', '1');
      // Fire change event by hovering and pressing Enter (some browsers may require blur), explicitly dispatch change
      await page.evaluate(() => {
        const input = document.getElementById('kValue');
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await page.waitForTimeout(50);

      const htmlAfterK1 = await page.evaluate(() => document.getElementById('result').innerText.replace(/\s+/g, ' ').trim());
      expect(htmlAfterK1).toContain('K = 1');
      // With K=1, expected classification is the color of the single nearest neighbor which we placed near red
      // So we expect >=1 red in nearest neighbors and classification to be red
      expect(htmlAfterK1).toMatch(/Nearest neighbors:\s*1 red,\s*0 blue/);
      expect(htmlAfterK1).toMatch(/Test point is classified as:\s*red/i);

      // Edge case: set K to 0 (invalid according to min), implementation will parseInt => 0 and slice(0,0) => no neighbors -> tie
      await page.fill('#kValue', '0');
      await page.evaluate(() => {
        const input = document.getElementById('kValue');
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await page.waitForTimeout(50);

      const htmlAfterK0 = await page.evaluate(() => document.getElementById('result').innerText.replace(/\s+/g, ' ').trim());
      expect(htmlAfterK0).toContain('K = 0');
      // No neighbors considered -> both counts zero -> tie
      expect(htmlAfterK0).toMatch(/Nearest neighbors:\s*0 red,\s*0 blue/);
      expect(htmlAfterK0).toMatch(/Test point is classified as:\s*tie/i);
    });
  });

  test.describe('Clear All points (S4_ClearAll)', () => {
    test('Click Clear All resets points, testPoint, currentMode and result display', async ({ page }) => {
      // Add a red point and a test point to ensure non-empty state
      await page.click('#addRed');
      await page.click('#canvas', { position: { x: 30, y: 30 } });
      await page.waitForTimeout(10);

      await page.click('#addTest');
      await page.click('#canvas', { position: { x: 35, y: 35 } });
      await page.waitForTimeout(20);

      // Now clear all
      await page.click('#clear');
      await page.waitForTimeout(20);

      const afterClear = await page.evaluate(() => {
        return {
          pointsExists: !!window.points,
          pointsLength: Array.isArray(points) ? points.length : -1,
          testPoint: typeof testPoint === 'undefined' ? 'undefined' : testPoint,
          currentMode: typeof currentMode === 'undefined' ? 'undefined' : currentMode,
          resultHTML: document.getElementById('result').innerHTML.trim()
        };
      });

      // Expectations from implementation's clearAll(): points=[], testPoint=null, currentMode=null, result cleared
      expect(afterClear.pointsExists).toBe(true);
      expect(afterClear.pointsLength).toBe(0);
      expect(afterClear.testPoint).toBeNull();
      expect(afterClear.currentMode).toBeNull();
      expect(afterClear.resultHTML).toBe('');
    });
  });

  test.describe('Error observation & robustness checks', () => {
    test('No uncaught ReferenceError/SyntaxError/TypeError on normal flows', async ({ page }) => {
      // Run a sequence of typical interactions and ensure no page errors were emitted
      await page.click('#addRed');
      await page.click('#canvas', { position: { x: 40, y: 150 } });
      await page.click('#addBlue');
      await page.click('#canvas', { position: { x: 140, y: 150 } });
      await page.click('#addTest');
      await page.click('#canvas', { position: { x: 90, y: 150 } });

      // Change K
      await page.fill('#kValue', '2');
      await page.evaluate(() => {
        document.getElementById('kValue').dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Allow any potential errors to surface
      await page.waitForTimeout(100);

      // Assert that there were no uncaught page errors during these interactions
      // (If there are errors, they will be available in pageErrors; this assertion will fail and surface them)
      expect(pageErrors.length).toBe(0);
    });

    test('Console should not contain runtime errors or warnings after interactions', async ({ page }) => {
      // Do some interactions
      await page.click('#addRed');
      await page.click('#canvas', { position: { x: 60, y: 200 } });
      await page.click('#addTest');
      await page.click('#canvas', { position: { x: 80, y: 200 } });

      // Allow console messages to accumulate
      await page.waitForTimeout(50);

      // Look for error or warning messages in the captured console
      const severe = consoleMessages.filter(m => ['error', 'warning'].includes(m.type));
      // Prefer to fail the test if any severe console messages are present
      expect(severe.length).toBe(0);
    });
  });
});