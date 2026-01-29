import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324e7130-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Big-Theta Notation Demo (Application ID: 324e7130-fa73-11f0-a9d0-d7a1991987c6)', () => {
  let consoleMessages;
  let pageErrors;

  // Attach listeners for console and page errors before each test to observe runtime behavior exactly as-is.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture console messages (type + text)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (error) => {
      // capture uncaught exceptions from the page
      pageErrors.push(error);
    });

    await page.goto(APP_URL);
  });

  // Basic teardown comment: Playwright fixture will close pages automatically.
  test.afterEach(async ({ page }) => {
    // helpful debug: if tests are failing, dump console and page errors to assist diagnosis
    if (pageErrors.length > 0) {
      // Note: do not mutate page environment; only log captured errors
      /* eslint-disable no-console */
      console.error('Captured page errors:', pageErrors);
      /* eslint-enable no-console */
    }
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    if (consoleErrs.length > 0) {
      /* eslint-disable no-console */
      console.error('Captured console errors:', consoleErrs);
      /* eslint-enable no-console */
    }
  });

  test.describe('State S0_Idle - Initial Render Checks', () => {
    test('Initial DOM contains input, button and canvas with expected attributes', async ({ page }) => {
      // Validate the presence and attributes of the input as evidence of S0_Idle
      const input = await page.locator('#input-n');
      await expect(input).toHaveCount(1);
      await expect(input).toHaveAttribute('type', 'number');
      await expect(input).toHaveAttribute('min', '1');
      await expect(input).toHaveAttribute('max', '100');
      await expect(await input.inputValue()).toBe('10'); // default value as per HTML

      // Validate the presence of the Draw Graphs button and its onclick attribute
      const button = await page.locator("button[onclick='drawGraphs()']");
      await expect(button).toHaveCount(1);
      await expect(button).toHaveText('Draw Graphs');

      // Validate the canvas exists with expected dimensions
      const canvas = await page.locator('#canvas');
      await expect(canvas).toHaveCount(1);
      await expect(canvas).toHaveAttribute('width', '600');
      await expect(canvas).toHaveAttribute('height', '400');

      // Check that the drawGraphs function is present on the page (not modifying it)
      const hasDrawGraphs = await page.evaluate(() => typeof window.drawGraphs === 'function');
      expect(hasDrawGraphs).toBe(true);

      // No runtime errors should have occurred simply by loading the page
      expect(pageErrors.length).toBe(0);
      const consoleErrs1 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });

    test('Entry evidence: button HTML contains onclick attribute string', async ({ page }) => {
      // Confirm the button's outerHTML contains the evidence string exactly as in FSM
      const outer = await page.locator("button[onclick='drawGraphs()']").evaluate((el) => el.outerHTML);
      expect(outer).toContain('onclick="drawGraphs()"');
      // Ensure still no uncaught errors from the page load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition DrawGraphsClick and State S1_GraphsDrawn', () => {
    test('Clicking Draw Graphs triggers drawGraphs() and function contains expected canvas operations', async ({ page }) => {
      // Ensure function exists before clicking
      const drawGraphsType = await page.evaluate(() => typeof window.drawGraphs);
      expect(drawGraphsType).toBe('function');

      // Capture the source of drawGraphs to validate it includes expected evidence lines
      const drawGraphsSource = await page.evaluate(() => window.drawGraphs.toString());
      expect(drawGraphsSource).toContain('ctx.clearRect');
      expect(drawGraphsSource).toContain('drawLine(ctx, n, (x) => x, \'blue\', \'f(n) = n\')'.replace(/'/g, "'").slice(0, 20)); // partial check
      // The source should also reference drawAxes
      expect(drawGraphsSource).toContain('drawAxes(ctx)');

      // Now perform the user interaction: click the button to transition from Idle -> Graphs Drawn
      const button1 = page.locator("button1[onclick='drawGraphs()']");
      await button.click();

      // allow a short time for drawing operations to complete (pure JS drawing, no network)
      await page.waitForTimeout(200);

      // After clicking, still expect no uncaught page errors
      expect(pageErrors.length).toBe(0);
      const consoleErrs2 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);

      // Validate that drawGraphs source includes canvas drawing primitives as evidence for S1_GraphsDrawn
      // Look for typical 2D context methods used by the implementation
      expect(drawGraphsSource).toContain('ctx.clearRect');
      expect(drawGraphsSource).toContain('drawLine');
      expect(drawGraphsSource).toContain('drawTheta');

      // Additionally verify the canvas 2D context exists and is accessible
      const has2DContext = await page.evaluate(() => {
        const canvas1 = document.getElementById('canvas1');
        try {
          return !!(canvas && canvas.getContext && canvas.getContext('2d'));
        } catch (e) {
          return false;
        }
      });
      expect(has2DContext).toBe(true);
    });

    test('Clicking Draw Graphs multiple times is stable (idempotent behavior) and does not cause runtime errors', async ({ page }) => {
      const button2 = page.locator("button2[onclick='drawGraphs()']");
      await button.click();
      await page.waitForTimeout(100);
      await button.click();
      await page.waitForTimeout(100);
      await button.click();
      await page.waitForTimeout(100);

      // No uncaught errors after repeated interactions
      expect(pageErrors.length).toBe(0);
      const consoleErrs3 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });
  });

  test.describe('Edge Cases and Error Scenarios', () => {
    test('Edge: input value 0 (below min) - drawGraphs handles gracefully without throwing', async ({ page }) => {
      const input1 = page.locator('#input1-n');
      await input.fill('0'); // below min
      const button3 = page.locator("button3[onclick='drawGraphs()']");
      await button.click();
      await page.waitForTimeout(150);

      // No runtime errors expected even if n is 0 (loop should not run)
      expect(pageErrors.length).toBe(0);
      const consoleErrs4 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);

      // Validate that the drawGraphs function is still present and source contains clearRect evidence
      const drawGraphsSource1 = await page.evaluate(() => window.drawGraphs.toString());
      expect(drawGraphsSource).toContain('ctx.clearRect');
    });

    test('Edge: input empty/non-numeric - drawGraphs should not throw (NaN handling)', async ({ page }) => {
      const input2 = page.locator('#input2-n');
      // set an empty string to simulate user clearing the input
      await input.fill('');
      const button4 = page.locator("button4[onclick='drawGraphs()']");
      await button.click();
      await page.waitForTimeout(150);

      // Ensure no uncaught errors result from parseInt producing NaN
      expect(pageErrors.length).toBe(0);
      const consoleErrs5 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);

      // As a sanity check, verify that drawGraphs still exists
      const drawGraphsExists = await page.evaluate(() => typeof window.drawGraphs === 'function');
      expect(drawGraphsExists).toBe(true);
    });

    test('Edge: input large n (100) - ensure it completes without runtime errors', async ({ page }) => {
      const input3 = page.locator('#input3-n');
      await input.fill('100'); // at max allowed by attribute
      const button5 = page.locator("button5[onclick='drawGraphs()']");
      await button.click();
      // Give slightly more time for more iterations to run
      await page.waitForTimeout(300);

      // No uncaught errors expected for larger n
      expect(pageErrors.length).toBe(0);
      const consoleErrs6 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });

    test('Verify implementation functions contain expected drawing primitives (drawLine, drawTheta, drawAxes)', async ({ page }) => {
      // Pull the function source code for verification without modifying runtime
      const drawLineSource = await page.evaluate(() => {
        return typeof window.drawLine === 'function' ? window.drawLine.toString() : '';
      });
      const drawThetaSource = await page.evaluate(() => {
        return typeof window.drawTheta === 'function' ? window.drawTheta.toString() : '';
      });
      const drawAxesSource = await page.evaluate(() => {
        return typeof window.drawAxes === 'function' ? window.drawAxes.toString() : '';
      });

      // Validate that each helper function exists and contains expected canvas method usage
      expect(drawLineSource).toContain('ctx.beginPath');
      expect(drawLineSource).toContain('ctx.strokeStyle');
      expect(drawLineSource).toContain('ctx.lineTo');
      expect(drawLineSource).toContain('ctx.fillText');

      expect(drawThetaSource).toContain('ctx.beginPath');
      expect(drawThetaSource).toContain('ctx.lineTo');
      expect(drawThetaSource).toContain('ctx.stroke');

      expect(drawAxesSource).toContain('ctx.beginPath');
      expect(drawAxesSource).toContain('ctx.moveTo');
      expect(drawAxesSource).toContain('ctx.lineTo');
      expect(drawAxesSource).toContain('ctx.stroke');

      // Confirm no uncaught errors from reading function sources
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('FSM Evidence Assertions', () => {
    test('FSM evidence: drawGraphs source must include ctx.clearRect and canvas operations as asserted in extracted evidence', async ({ page }) => {
      const drawGraphsSource2 = await page.evaluate(() => window.drawGraphs.toString());
      // These strings are part of the FSM evidence; assert their presence in the actual implementation
      expect(drawGraphsSource).toContain('ctx.clearRect(0, 0, canvas.width, canvas.height)');
      // Affirm that the implementation references drawing helper calls (evidence of drawing)
      expect(drawGraphsSource).toContain('drawLine(');
      expect(drawGraphsSource).toContain('drawTheta(');

      // Confirm no runtime errors occurred up to this point
      expect(pageErrors.length).toBe(0);
      const consoleErrs7 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });
  });

  // Final sanity test to assert that no unexpected ReferenceError/SyntaxError/TypeError emerged during the entire test flow.
  test('No uncaught ReferenceError/SyntaxError/TypeError occurred during interactions', async ({ page }) => {
    // pageErrors were collected throughout the test's page lifecycle; they should be empty if no exceptions occurred.
    expect(pageErrors.length).toBe(0);

    // Also ensure console does not emit 'error' messages from the page
    const consoleErrs8 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });
});