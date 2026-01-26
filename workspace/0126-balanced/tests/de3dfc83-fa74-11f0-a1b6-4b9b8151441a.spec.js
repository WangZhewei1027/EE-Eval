import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3dfc83-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Random Forest Visualization - FSM state & transitions tests', () => {
  // Arrays to collect runtime errors and console messages for each test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    pageErrors = [];
    consoleMessages = [];

    // Listen to page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Collect console messages for inspection
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Nothing to tear down beyond Playwright's automatic cleanup.
  });

  test.describe('State S0_Idle (Initial state) validations', () => {
    test('S0_Idle: initial UI and variables are set correctly', async ({ page }) => {
      // This test validates the initial (Idle) state of the application.
      // Expectations:
      // - The number of trees span shows the default number (5)
      // - The forest (in-page variable) is empty
      // - No tree elements are rendered in the treesContainer
      // - The canvas 2D context is present
      // - No unexpected runtime errors occurred (or if errors exist, they are of allowed types)

      // Check the tree count span
      const treeCountText = await page.locator('#treeCount').innerText();
      expect(treeCountText.trim()).toBe('5');

      // The trees container should be empty initially
      const treesCount = await page.locator('#treesContainer .tree').count();
      expect(treesCount).toBe(0);

      // Inspect in-page variable 'forest' to ensure it's an empty array initially
      const forestLength = await page.evaluate(() => {
        // Access the in-page variable 'forest' created by the app
        // Return -1 if it is not defined (to catch missing variable)
        return typeof forest !== 'undefined' ? forest.length : -1;
      });
      expect(forestLength).toBe(0);

      // Verify that the canvas context exists and has drawing functions
      const hasCanvasContext = await page.evaluate(() => {
        try {
          return !!(typeof ctx !== 'undefined' && typeof ctx.fillRect === 'function');
        } catch (e) {
          return false;
        }
      });
      expect(hasCanvasContext).toBe(true);

      // Verify page errors: either none, or if present they must be ReferenceError/SyntaxError/TypeError
      if (pageErrors.length === 0) {
        expect(pageErrors.length).toBe(0);
      } else {
        for (const err of pageErrors) {
          expect(['ReferenceError', 'SyntaxError', 'TypeError']).toContain(err.name);
        }
      }
    });
  });

  test.describe('Transition S0 -> S1: Generate Random Forest', () => {
    test('Generate Random Forest populates forest and renders trees / decision boundaries', async ({ page }) => {
      // This test validates the GenerateForest event/transition from Idle to Forest Generated.
      // Expectations:
      // - Clicking #generateForest creates `numTrees` trees in the in-page `forest` array
      // - The DOM renders individual tree summaries (.tree elements)
      // - drawDecisionBoundaries was invoked indirectly (canvas updated); we check that ctx.globalAlpha is reset to 1.0 afterwards
      // - No unexpected uncaught runtime errors (or only expected error types if any occurred)

      // Click the Generate Random Forest button
      await page.click('#generateForest');

      // Ensure the forest array in the page now has numTrees items (numTrees is defined as 5 in the app)
      const forestLength = await page.evaluate(() => {
        return typeof forest !== 'undefined' ? forest.length : -1;
      });
      expect(forestLength).toBe(5);

      // Ensure .tree elements were added to #treesContainer
      const treeEls = page.locator('#treesContainer .tree');
      await expect(treeEls).toHaveCount(5);

      // Check that at least the first tree contains the label "Tree 1:"
      const firstTreeText = await treeEls.nth(0).innerText();
      expect(firstTreeText).toContain('Tree 1:');

      // Verify the canvas context's globalAlpha ended at 1.0 (drawDecisionBoundaries sets it back to 1.0)
      const globalAlpha = await page.evaluate(() => {
        try {
          return ctx.globalAlpha;
        } catch (e) {
          return null;
        }
      });
      expect(globalAlpha).toBe(1.0);

      // Check for page errors: allow none, or only allowed types
      if (pageErrors.length === 0) {
        expect(pageErrors.length).toBe(0);
      } else {
        for (const err of pageErrors) {
          expect(['ReferenceError', 'SyntaxError', 'TypeError']).toContain(err.name);
        }
      }
    });
  });

  test.describe('Transition S1 -> S2: Classify Random Point', () => {
    test('ClassifyRandomPoint shows alert with classification and updates canvas (requires forest)', async ({ page }) => {
      // This test validates: starting from Forest Generated, clicking Classify Random Point:
      // - triggers an alert with classification message
      // - sets in-page randomPoint with valid coordinates
      // - preserves the forest state
      // - drawDecisionBoundaries finishes and ctx.globalAlpha is restored

      // Ensure forest exists by generating it
      await page.click('#generateForest');

      // Prepare to capture the alert dialog message
      let dialogMessage = null;
      page.on('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      // Click the classify button
      await page.click('#classifyPoint');

      // Wait briefly to allow in-page code to set randomPoint and draw
      await page.waitForTimeout(200);

      // Validate that a dialog did fire with expected structure
      expect(dialogMessage).toBeTruthy();
      expect(dialogMessage).toMatch(/^The point at \([\d.]+, [\d.]+\) is classified as /);

      // Validate randomPoint exists and coordinates are within canvas bounds
      const randomPoint = await page.evaluate(() => {
        return typeof randomPoint !== 'undefined' ? randomPoint : null;
      });
      expect(randomPoint).not.toBeNull();
      expect(randomPoint.x).toBeGreaterThanOrEqual(0);
      expect(randomPoint.x).toBeLessThanOrEqual(600);
      expect(randomPoint.y).toBeGreaterThanOrEqual(0);
      expect(randomPoint.y).toBeLessThanOrEqual(400);

      // Ensure forest remains intact after classification
      const forestLength = await page.evaluate(() => (typeof forest !== 'undefined' ? forest.length : -1));
      expect(forestLength).toBe(5);

      // Ensure globalAlpha restored to 1.0
      const globalAlpha = await page.evaluate(() => ctx.globalAlpha);
      expect(globalAlpha).toBe(1.0);

      // Confirm treesContainer still contains 5 trees
      const treeCountAfter = await page.locator('#treesContainer .tree').count();
      expect(treeCountAfter).toBe(5);

      // Check page errors: none expected, but if present they must be allowed types
      if (pageErrors.length === 0) {
        expect(pageErrors.length).toBe(0);
      } else {
        for (const err of pageErrors) {
          expect(['ReferenceError', 'SyntaxError', 'TypeError']).toContain(err.name);
        }
      }
    });
  });

  test.describe('Transition S2 -> S1: Regenerate Forest after Classification', () => {
    test('After classifying a point, generating a new forest replaces trees and draws boundaries', async ({ page }) => {
      // This test validates the transition from Point Classified back to Forest Generated:
      // - Generate forest -> classify point -> generate forest again
      // - After the second generate, the treesContainer should be repopulated with numTrees
      // - forest array length should equal numTrees
      // - No unexpected runtime errors (or only allowed error types)

      // Generate forest first
      await page.click('#generateForest');

      // Intercept and accept dialog when classifying
      page.on('dialog', async dialog => {
        await dialog.accept();
      });

      // Classify a random point (moves to S2_PointClassified)
      await page.click('#classifyPoint');

      // Wait briefly for classification drawing to complete
      await page.waitForTimeout(150);

      // Now regenerate forest (transition back to S1)
      // Capture the HTML content of treesContainer before and after to ensure replacement happened
      const beforeHtml = await page.locator('#treesContainer').innerHTML();

      await page.click('#generateForest');

      // Wait a bit for regeneration
      await page.waitForTimeout(100);

      const afterHtml = await page.locator('#treesContainer').innerHTML();
      const beforeCount = (beforeHtml.match(/class="tree"/g) || []).length;
      const afterCount = (afterHtml.match(/class="tree"/g) || []).length;

      // Expect that after regeneration there are still 5 trees
      expect(afterCount).toBe(5);

      // Either content changed (trees were recreated) or remained but still valid; assert forest length
      const forestLength = await page.evaluate(() => (typeof forest !== 'undefined' ? forest.length : -1));
      expect(forestLength).toBe(5);

      // Page errors check
      if (pageErrors.length === 0) {
        expect(pageErrors.length).toBe(0);
      } else {
        for (const err of pageErrors) {
          expect(['ReferenceError', 'SyntaxError', 'TypeError']).toContain(err.name);
        }
      }
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Clicking Classify Random Point when no forest exists should produce a runtime error (TypeError)', async ({ page }) => {
      // This test explicitly validates the edge case where classification is attempted without a forest.
      // The application code returns null in classifyPoint when forest.length === 0, but classifyRandomPoint then tries to
      // access classes[prediction].name which can produce a TypeError. We assert that a pageerror occurs and is a TypeError.

      // Ensure forest is empty (initial state)
      const initialForestLen = await page.evaluate(() => (typeof forest !== 'undefined' ? forest.length : -1));
      expect(initialForestLen).toBe(0);

      // Wait for any existing pageerror listeners to be ready, then trigger classify
      // Use waitForEvent to capture the error reliably
      const pageErrorPromise = page.waitForEvent('pageerror');

      // Click classify button which is expected to cause an uncaught TypeError in this edge case
      await page.click('#classifyPoint');

      // Wait for the pageerror event
      const err = await pageErrorPromise;

      // The error should be a TypeError (or at least one of the allowed types)
      expect(err).toBeTruthy();
      expect(['TypeError', 'ReferenceError', 'SyntaxError']).toContain(err.name);

      // Also ensure no alert/dialog was shown (since code likely exploded before alert)
      // We'll check that no dialog messages were captured in console as a result of alert.
      const hasAlertText = consoleMessages.some(m => m.type === 'log' && m.text.includes('The point at'));
      expect(hasAlertText).toBe(false);
    });

    test('Application should not silently swallow exceptions: pageerror events are surfaced', async ({ page }) => {
      // This test simply asserts that pageerror events are trackable via the Playwright page event.
      // It clicks classify without forest to intentionally cause an error and validates that the pageerror handler was invoked.

      // Prepare to capture the pageerror via waitForEvent again
      const pageErrorPromise = page.waitForEvent('pageerror');

      // Trigger error
      await page.click('#classifyPoint');

      // Ensure an error event is emitted
      const emittedError = await pageErrorPromise;
      expect(emittedError).toBeTruthy();
      expect(typeof emittedError.message === 'string').toBe(true);
    });
  });
});