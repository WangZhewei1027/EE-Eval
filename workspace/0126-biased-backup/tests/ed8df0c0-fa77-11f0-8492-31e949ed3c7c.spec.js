import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8df0c0-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Prim\'s Algorithm Visualization - FSM validation', () => {
  // Arrays to collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  // Attach listeners and navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for later assertions / inspection
    page.on('console', msg => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // ignore any console reading issues
      }
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Load the application exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Basic sanity: pageErrors array is available to tests for assertions
    // Nothing to teardown beyond Playwright fixtures
  });

  test.describe('State S0_Idle (Initial State) - Idle checks', () => {
    test('Initial page load should be in Idle state with mstEdges.length === 0', async ({ page }) => {
      // This test verifies the initial FSM Idle state and evidence:
      // - mstEdges.length === 0
      // - drawCanvas was invoked indirectly (we validate observable DOM state)
      // - startButton has onclick assigned as a function

      // Assert that the canvas element exists
      const canvasExists = await page.$('#canvas');
      expect(canvasExists).not.toBeNull();

      // Verify the start button exists and has correct text
      const buttonText = await page.$eval('#startButton', btn => btn.textContent.trim());
      expect(buttonText).toBe('Start Animation');

      // Verify that mstEdges exists and is empty on load (evidence of Idle state)
      const mstLength = await page.evaluate(() => {
        // Return -1 if mstEdges is not defined so test fails loudly
        if (typeof window.mstEdges === 'undefined') return -1;
        return window.mstEdges.length;
      });
      expect(mstLength).toBe(0);

      // Verify visited array exists and all entries are false (no vertex visited initially)
      const visitedAllFalse = await page.evaluate(() => {
        if (!Array.isArray(window.visited)) return false;
        return window.visited.every(v => v === false);
      });
      expect(visitedAllFalse).toBe(true);

      // Verify the startButton onclick handler is assigned (evidence from FSM)
      const onclickType = await page.evaluate(() => {
        const btn = document.getElementById('startButton');
        // Some environments may not expose the onclick as a function; return typeof
        return btn && typeof btn.onclick;
      });
      expect(onclickType).toBe('function');

      // Ensure there were no uncaught page errors on initial load
      expect(pageErrors.length).toBe(0);

      // Optionally capture console output; there should be none relevant from the app
      // but we still assert the collection worked (array exists)
      expect(Array.isArray(consoleMessages)).toBe(true);
    });
  });

  test.describe('Event: StartAnimation and State S1_Animating (Animating)', () => {
    test('Clicking Start Animation transitions to Animating and begins building MST', async ({ page }) => {
      // This test validates:
      // - The Start Animation click triggers primAlgorithm (transition S0 -> S1)
      // - mstEdges grows over time to vertices.length - 1
      // - visited array updates correspondingly
      // - Clicking the button again once animation started does not restart the algorithm
      // - No uncaught exceptions occur during the animation

      // Sanity checks before clicking
      const initialMst = await page.evaluate(() => (window.mstEdges || []).length);
      expect(initialMst).toBe(0);

      // Click the Start Animation button to trigger primAlgorithm()
      await page.click('#startButton');

      // Wait for the algorithm to add at least one edge (animation is asynchronous via setTimeout)
      await page.waitForFunction(() => {
        return Array.isArray(window.mstEdges) && window.mstEdges.length >= 1;
      }, {}, { timeout: 7000 });

      // After at least one edge added, assert observable properties:
      const mstAfterFirst = await page.evaluate(() => window.mstEdges.length);
      expect(mstAfterFirst).toBeGreaterThanOrEqual(1);

      // The number of visited vertices should equal mstEdges.length + 1 (initial vertex + edges)
      const relationHolds = await page.evaluate(() => {
        if (!Array.isArray(window.visited) || !Array.isArray(window.mstEdges) || !Array.isArray(window.vertices)) return false;
        const visitedCount = window.visited.filter(Boolean).length;
        return visitedCount === window.mstEdges.length + 1;
      });
      expect(relationHolds).toBe(true);

      // Now wait for the algorithm to finish building the full MST:
      // Expect mstEdges.length === vertices.length - 1
      await page.waitForFunction(() => {
        return Array.isArray(window.mstEdges) && Array.isArray(window.vertices) && window.mstEdges.length === (window.vertices.length - 1);
      }, {}, { timeout: 12000 });

      const finalMstLength = await page.evaluate(() => window.mstEdges.length);
      const vertexCount = await page.evaluate(() => window.vertices.length);
      expect(finalMstLength).toBe(vertexCount - 1);

      // Verify visited count equals total vertices
      const visitedCountFinal = await page.evaluate(() => window.visited.filter(Boolean).length);
      expect(visitedCountFinal).toBe(vertexCount);

      // Clicking the start button again should NOT add duplicate edges because the handler checks mstEdges.length === 0
      const beforeSecondClick = finalMstLength;
      await page.click('#startButton');
      // Wait a small amount to allow any unexpected behavior
      await page.waitForTimeout(500);
      const afterSecondClick = await page.evaluate(() => window.mstEdges.length);
      expect(afterSecondClick).toBe(beforeSecondClick);

      // Ensure no uncaught page errors occurred during the entire animation
      expect(pageErrors.length).toBe(0);
    });

    test('Rapid repeated clicks do not cause errors or multiple algorithm runs', async ({ page }) => {
      // This edge-case test clicks the Start button repeatedly and ensures:
      // - No page errors are thrown
      // - The algorithm still ends up with correct MST
      // - No duplicate edges are pushed beyond expected count

      // Rapidly click the button 6 times
      for (let i = 0; i < 6; i++) {
        await page.click('#startButton');
      }

      // Wait for MST to complete as before
      await page.waitForFunction(() => {
        return Array.isArray(window.mstEdges) && Array.isArray(window.vertices) && window.mstEdges.length === (window.vertices.length - 1);
      }, {}, { timeout: 15000 });

      const finalMstLength = await page.evaluate(() => window.mstEdges.length);
      const vertexCount = await page.evaluate(() => window.vertices.length);
      expect(finalMstLength).toBe(vertexCount - 1);

      // Confirm no uncaught errors
      expect(pageErrors.length).toBe(0);

      // Ensure consoleMessages were collected (even if empty); this ensures our listener worked
      expect(Array.isArray(consoleMessages)).toBe(true);
    });

    test('Animation loop performs incremental updates (S1_Animating self-transition)', async ({ page }) => {
      // This test focuses on the repeated animationLoop transition behavior:
      // - Each loop adds edges (addEdges) and redraws (drawCanvas).
      // - We assert that mstEdges increments stepwise over time.

      // Start the algorithm
      await page.click('#startButton');

      // Wait for first edge
      await page.waitForFunction(() => (window.mstEdges || []).length >= 1, {}, { timeout: 7000 });
      const after1 = await page.evaluate(() => window.mstEdges.length);
      expect(after1).toBeGreaterThanOrEqual(1);

      // Wait for second edge (if graph requires it)
      await page.waitForFunction(() => (window.mstEdges || []).length >= 2, {}, { timeout: 7000 });
      const after2 = await page.evaluate(() => window.mstEdges.length);
      expect(after2).toBeGreaterThanOrEqual(after1);

      // Ensure monotonic increase: mstEdges should not shrink
      expect(after2).toBeGreaterThanOrEqual(after1);

      // Wait for completion as final assertion (ensure loops kept executing)
      await page.waitForFunction(() => window.mstEdges.length === (window.vertices.length - 1), {}, { timeout: 12000 });
      const finalLen = await page.evaluate(() => window.mstEdges.length);
      expect(finalLen).toBe((await page.evaluate(() => window.vertices.length)) - 1);

      // No uncaught runtime exceptions during multiple animationLoop cycles
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('API presence and expected functions (onEnter/onExit evidence)', () => {
    test('Prim algorithm and drawing functions are present on window', async ({ page }) => {
      // Validate that functions referenced as entry actions exist (primAlgorithm, drawCanvas)
      const functionsExist = await page.evaluate(() => {
        return {
          primAlgorithm: typeof window.primAlgorithm === 'function',
          drawCanvas: typeof window.drawCanvas === 'function',
          drawEdges: typeof window.drawEdges === 'function',
          drawVertices: typeof window.drawVertices === 'function'
        };
      });

      expect(functionsExist.primAlgorithm).toBe(true);
      expect(functionsExist.drawCanvas).toBe(true);
      expect(functionsExist.drawEdges).toBe(true);
      expect(functionsExist.drawVertices).toBe(true);

      // Ensure no page errors occurred while introspecting these functions
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error handling and negative scenarios', () => {
    test('No unexpected ReferenceError/SyntaxError/TypeError emitted during normal usage', async ({ page }) => {
      // The application should run without throwing uncaught ReferenceError/SyntaxError/TypeError
      // during loads and interactions covered above.
      // We assert that pageErrors array does not contain these error types.
      // Note: pageErrors contains Error objects; inspect their name/messages.

      // Trigger normal usage: start and finish algorithm (if not already finished)
      const alreadyComplete = await page.evaluate(() => Array.isArray(window.mstEdges) && Array.isArray(window.vertices) && window.mstEdges.length === window.vertices.length - 1);
      if (!alreadyComplete) {
        await page.click('#startButton');
        await page.waitForFunction(() => Array.isArray(window.mstEdges) && Array.isArray(window.vertices) && window.mstEdges.length === window.vertices.length - 1, {}, { timeout: 15000 });
      }

      // Now assert there are no page errors of serious types
      const errorNames = pageErrors.map(e => e.name || '');
      const hasSerious = errorNames.some(name => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(name));
      expect(hasSerious).toBe(false);
      // Also assert there are no page errors at all
      expect(pageErrors.length).toBe(0);
    });
  });
});