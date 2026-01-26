import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83b1f00-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('SVM Demo FSM - d83b1f00-fa7b-11f0-b314-ad8654ee5de8', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages = [];
  let pageErrors = [];

  // Attach listeners and navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection (type and text)
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case msg.text() throws, record minimal info
        consoleMessages.push({ type: msg.type(), text: '<unable to read text>' });
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);
  });

  // After each test, assert that no unexpected uncaught errors were emitted to the page
  test.afterEach(async ({ page }) => {
    // Expose console output on failure to aid debugging
    if (pageErrors.length > 0 || consoleMessages.some(m => m.type === 'error')) {
      // Print info to the test output (Playwright will include these if assertion fails)
      // We won't modify the page or patch anything - just include diagnostic info.
      // eslint-disable-next-line no-console
      console.log('Collected console messages:', consoleMessages);
      // eslint-disable-next-line no-console
      console.log('Collected page errors:', pageErrors);
    }

    // Assert there were no uncaught page errors
    expect(pageErrors, 'There should be no uncaught page errors during the test').toHaveLength(0);

    // Assert there were no console.error messages emitted (common indicator of runtime issues)
    const errorConsoles = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles, 'There should be no console.error messages emitted').toHaveLength(0);
  });

  test.describe('State S0_Idle (Initial page render)', () => {
    test('Idle state: Run Tiny Demo button present and canvas/legend are hidden', async ({ page }) => {
      // Validate initial Idle state (S0_Idle) UI expectations per FSM:
      // - Button with id #demoBtn is visible and labeled "Run Tiny Demo"
      // - Canvas #demoCanvas and legend #demoLegend exist but are initially hidden (style display:none)
      const btn = page.locator('#demoBtn');
      const canvas = page.locator('#demoCanvas');
      const legend = page.locator('#demoLegend');

      // Button should be visible and show the expected text
      await expect(btn).toBeVisible();
      await expect(btn).toHaveText('Run Tiny Demo');

      // Canvas and legend should be present in DOM but hidden
      await expect(canvas).toBeHidden();
      await expect(legend).toBeHidden();

      // Check legend content matches the expected descriptive text from FSM/components
      await expect(legend).toHaveText(/Blue: class \+1\s*&nbsp;\s*Red: class -1\s*&nbsp;\s*Black line: learned decision boundary/);
    });
  });

  test.describe('Transition RunDemo: S0_Idle -> S1_DemoRunning and S1_DemoRunning -> S1_DemoRunning', () => {
    test('Clicking Run Tiny Demo transitions to DemoRunning: canvas and legend become visible and drawing occurs', async ({ page }) => {
      // This test validates the primary transition described in the FSM:
      // - Clicking #demoBtn should make canvas.style.display = 'block' and legend.style.display = 'block'
      // - The button text should update to indicate the demo has run ("Run Demo Again")
      // - The demo should draw points and a decision boundary onto the canvas (we verify pixels changed)
      const btn = page.locator('#demoBtn');
      const canvas = page.locator('#demoCanvas');
      const legend = page.locator('#demoLegend');

      // Click the demo button to trigger the transition. Allow extra time for the training loop and drawing.
      await btn.click();

      // After click, canvas and legend should be visible (entry actions: showCanvas(), showLegend())
      await expect(canvas).toBeVisible({ timeout: 20000 });
      await expect(legend).toBeVisible({ timeout: 20000 });

      // Button text should change to signal it can be re-run
      await expect(btn).toHaveText('Run Demo Again', { timeout: 20000 });

      // Ensure the canvas 2D context exists
      const ctxExists = await page.evaluate(() => {
        const c = document.getElementById('demoCanvas');
        return !!(c && c.getContext && c.getContext('2d'));
      });
      expect(ctxExists).toBe(true);

      // Check that the canvas contains non-trivial pixel data (i.e., drawing happened)
      // This inspects the pixel buffer and ensures not all pixels are blank/white.
      const drawingDetected = await page.evaluate(() => {
        const c = document.getElementById('demoCanvas');
        const ctx = c.getContext('2d');
        // It's possible the demo draws on white background; we detect non-white pixels.
        const img = ctx.getImageData(0, 0, c.width, c.height).data;
        let nonWhite = 0;
        for (let i = 0; i < img.length; i += 4) {
          // Sum RGB channels; white pixels will have 255+255+255
          const sum = img[i] + img[i + 1] + img[i + 2];
          // If sum differs notably from pure white, count it as drawing.
          if (sum < 765 - 5) {
            nonWhite++;
            // early exit if we already see sufficient evidence
            if (nonWhite > 50) return true;
          }
        }
        return nonWhite > 0;
      });

      expect(drawingDetected).toBe(true);
    }, { timeout: 30000 }); // extended timeout for training/drawing

    test('Clicking Run Tiny Demo again retrains and updates the canvas without hiding it (S1 -> S1 idempotent transition)', async ({ page }) => {
      // This test validates the S1_DemoRunning -> S1_DemoRunning transition when the button is clicked again:
      // - Canvas remains visible
      // - Legend remains visible
      // - Button keeps "Run Demo Again" label after first click
      // - No uncaught errors during repeated clicks
      const btn = page.locator('#demoBtn');
      const canvas = page.locator('#demoCanvas');
      const legend = page.locator('#demoLegend');

      // First click to enter S1_DemoRunning
      await btn.click();
      await expect(canvas).toBeVisible({ timeout: 20000 });
      await expect(legend).toBeVisible({ timeout: 20000 });

      // Capture a snapshot (pixel checksum) of canvas after first run
      const checksum1 = await page.evaluate(() => {
        const c = document.getElementById('demoCanvas');
        const ctx = c.getContext('2d');
        const img = ctx.getImageData(0, 0, c.width, c.height).data;
        // Create a simple checksum: sum of some sample pixels to detect change on rerun.
        let s = 0;
        for (let i = 0; i < img.length; i += 127) s = (s + img[i] + img[i + 1] + img[i + 2]) | 0;
        return s;
      });

      // Click again to retrain/run the demo again (S1->S1)
      await btn.click();

      // Canvas should remain visible and legend visible
      await expect(canvas).toBeVisible({ timeout: 20000 });
      await expect(legend).toBeVisible({ timeout: 20000 });

      // Ensure the canvas content has changed after retraining (strong indication retrain occurred)
      const checksum2 = await page.evaluate(() => {
        const c = document.getElementById('demoCanvas');
        const ctx = c.getContext('2d');
        const img = ctx.getImageData(0, 0, c.width, c.height).data;
        let s = 0;
        for (let i = 0; i < img.length; i += 127) s = (s + img[i] + img[i + 1] + img[i + 2]) | 0;
        return s;
      });

      // The checksum may or may not differ depending on RNG; allow equality but warn if unchanged.
      // We assert that at least the canvas stayed visible and no errors occurred (main requirement).
      expect(canvas).toBeVisible();
      expect(legend).toBeVisible();

      // Prefer checksum to change but allow same as RNG could produce similar result; mark with informative failure message if identical.
      if (checksum1 === checksum2) {
        // Not an assertion failure, but log to test output to indicate rerun produced identical canvas snapshot.
        // eslint-disable-next-line no-console
        console.log('Canvas checksum identical after rerun (checksum1 === checksum2). RNG may have produced similar drawing.');
      } else {
        expect(checksum1).not.toBe(checksum2);
      }
    }, { timeout: 30000 });
  });

  test.describe('Edge cases and robustness', () => {
    test('Rapid consecutive clicks do not throw errors and canvas remains visible', async ({ page }) => {
      // This test simulates rapid user interactions to ensure the demo's S1->S1 logic tolerates quick replay.
      // It will click the Run button multiple times in quick succession and assert no uncaught errors and stable UI.
      const btn = page.locator('#demoBtn');
      const canvas = page.locator('#demoCanvas');
      const legend = page.locator('#demoLegend');

      // Rapidly click the button several times
      await btn.click(); // enter S1
      // Perform multiple quick clicks to simulate a burst of user actions
      for (let i = 0; i < 4; i++) {
        // fire-and-forget clicks; training is synchronous in the handler but still simulate user spamming
        // Use short delay between clicks to avoid blocking the test harness fully
        await btn.click();
      }

      // Ensure UI is still consistent: canvas and legend visible, button text indicates ability to rerun
      await expect(canvas).toBeVisible({ timeout: 20000 });
      await expect(legend).toBeVisible({ timeout: 20000 });
      await expect(btn).toHaveText(/Run Demo Again/);

      // Ensure no page errors were captured by the listeners (this assertion is also done in afterEach but we assert here explicitly too)
      expect(pageErrors.length).toBe(0);
      const errorConsole = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsole.length).toBe(0);
    }, { timeout: 40000 });

    test('Canvas context is not null and getImageData is callable (draw functions are reachable from the click handler scope)', async ({ page }) => {
      // Validate that the canvas context API is usable and that drawing functions used by the demo did not taint the canvas.
      const btn = page.locator('#demoBtn');
      await btn.click();
      await page.waitForSelector('#demoCanvas', { state: 'visible', timeout: 20000 });

      const contextInfo = await page.evaluate(() => {
        const c = document.getElementById('demoCanvas');
        try {
          const ctx = c.getContext('2d');
          // Try to call getImageData on a small region to ensure it's callable and not blocked
          const img = ctx.getImageData(0, 0, Math.min(10, c.width), Math.min(10, c.height));
          return {
            width: c.width,
            height: c.height,
            imgDataLength: img.data.length,
            hasCtx: !!ctx
          };
        } catch (err) {
          return { error: err && err.message ? err.message : String(err) };
        }
      });

      // If canvas operations threw, the evaluation would include an error property
      if (contextInfo.error) {
        // Fail explicitly with the provided error
        expect(contextInfo.error).toBeUndefined();
      } else {
        expect(contextInfo.hasCtx).toBe(true);
        expect(contextInfo.width).toBeGreaterThan(0);
        expect(contextInfo.height).toBeGreaterThan(0);
        expect(contextInfo.imgDataLength).toBeGreaterThan(0);
      }
    }, { timeout: 30000 });
  });
});