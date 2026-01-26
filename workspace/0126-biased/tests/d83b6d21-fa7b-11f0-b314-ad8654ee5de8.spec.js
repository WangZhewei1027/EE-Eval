import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83b6d21-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('d83b6d21-fa7b-11f0-b314-ad8654ee5de8 — Overfitting demo (FSM validation)', () => {
  // Collect console and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (including errors) emitted by the page
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the exact HTML as provided
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({ page }) => {
    // Expose console and page error context in test output if something unexpected happens.
    // (No modifications of the page are performed here; just logging for debugging.)
    if (pageErrors.length > 0) {
      // Throw to make failing tests obvious if uncaught exceptions occurred
      const aggregated = pageErrors.map(e => e.stack || e.message || String(e)).join('\n---\n');
      // Fail the test explicitly
      throw new Error(`Page had uncaught errors:\n${aggregated}`);
    }
    // Also fail if there were console 'error' messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    if (consoleErrors.length > 0) {
      const aggregated = consoleErrors.map(m => `[${m.type}] ${m.text}`).join('\n');
      throw new Error(`Console reported error/warning messages:\n${aggregated}`);
    }
  });

  test.describe('Initial (S0_Idle) state validation', () => {
    test('Initial render: button exists, enabled, and legend shows initial instruction', async ({ page }) => {
      // Validate the initial idle state (S0_Idle) entry actions: renderPage() equivalent
      const btn = page.locator('button#runDemo');
      await expect(btn).toHaveCount(1);
      await expect(btn).toBeVisible();
      await expect(btn).toBeEnabled();
      await expect(btn).toHaveText('Run demonstration');

      // Legend should instruct to click the button (S0 evidence)
      const legend = page.locator('#legend');
      await expect(legend).toBeVisible();
      await expect(legend).toContainText('Click "Run demonstration" to generate data and view fits.');
      
      // The SVG should exist and initially contain at least the background rect (per HTML)
      const svg = page.locator('#plot');
      await expect(svg).toBeVisible();
      // Count children before any user interaction to establish baseline
      const initialChildCount = await page.locator('#plot > *').count();
      expect(initialChildCount).toBeGreaterThanOrEqual(1); // at minimum the rect background
    });
  });

  test.describe('Transition S0 -> S1 (RunDemoClick) and S1 behavior', () => {
    test('Clicking Run demonstration triggers disabled state, text "Running…" and draws the demo', async ({ page }) => {
      const btn = page.locator('button#runDemo');
      const svgChildrenBefore = await page.locator('#plot > *').count();

      // Click the button to trigger transition to Running Demo (S1_RunningDemo)
      await btn.click();

      // Immediately after click, per implementation the button is disabled and text set synchronously
      await expect(btn).toBeDisabled();
      await expect(btn).toHaveText('Running…');

      // While button is disabled, attempting another click should fail (edge-case)
      // This asserts that the control was actually disabled and not clickable
      await expect(page.click('button#runDemo')).rejects.toThrow();

      // Wait for the demo to finish (the code uses setTimeout 150ms then draws, so allow some buffer)
      await expect(btn).toHaveText('Run demonstration', { timeout: 2000 });
      await expect(btn).toBeEnabled();

      // After completion, the SVG should have been cleared and redrawn with many elements.
      const svgChildrenAfter = await page.locator('#plot > *').count();
      expect(svgChildrenAfter).toBeGreaterThan(svgChildrenBefore, 'SVG should have more child elements after drawing the demo');

      // Legend should now contain training and test MSE summaries (evidence of drawDemo())
      const legendText = await page.locator('#legend').textContent();
      expect(legendText).toBeTruthy();
      expect(legendText).toMatch(/Training MSE:/);
      expect(legendText).toMatch(/Test MSE \(w.r.t. noise-free sin\):/);
    });

    test('Repeated run: after completion, clicking again should re-run demo and update visuals again', async ({ page }) => {
      const btn = page.locator('button#runDemo');

      // First run
      await btn.click();
      await expect(btn).toHaveText('Run demonstration', { timeout: 2000 });
      await expect(btn).toBeEnabled();

      // Capture legend content after first run
      const legend = page.locator('#legend');
      const legendA = await legend.textContent();

      // Second run
      await btn.click();

      // Button should again go to disabled state and show intermediate text
      await expect(btn).toBeDisabled();
      await expect(btn).toHaveText('Running…');

      // Wait for second run to finish
      await expect(btn).toHaveText('Run demonstration', { timeout: 2000 });
      await expect(btn).toBeEnabled();

      // Legend should be updated again (content may differ slightly due to deterministic RNG, but must contain the metrics header)
      const legendB = await legend.textContent();
      expect(legendB).toBeTruthy();
      expect(legendB).toMatch(/Training MSE:/);
      expect(legendB).toMatch(/Test MSE \(w.r.t. noise-free sin\):/);
      // The legend content should be a string; it may change between runs
      expect(legendB).not.toBeNull();
      // It is acceptable for legend to be same if RNG is deterministic, but ensure it remains present
      // (No assertion that it must differ — that would be flaky)
    });
  });

  test.describe('Edge cases, robustness, and errors', () => {
    test('Attempting to click while handler is running produces an actionable error (element disabled)', async ({ page }) => {
      const btn = page.locator('button#runDemo');

      // Click to start run — this should synchronously disable the button
      await btn.click();
      await expect(btn).toBeDisabled();

      // Attempting to click the disabled button should reject — ensure Playwright surfaces that
      // Use expect(...).rejects.toThrow to assert Playwright cannot click a disabled control.
      await expect(page.click('button#runDemo')).rejects.toThrow();

      // Wait for completion to cleanup
      await expect(btn).toHaveText('Run demonstration', { timeout: 2000 });
      await expect(btn).toBeEnabled();
    });

    test('No uncaught ReferenceError / SyntaxError / TypeError appear in console or pageerrors during normal usage', async ({ page }) => {
      const btn = page.locator('button#runDemo');

      // Run the demo once to exercise the drawing code path
      await btn.click();
      await expect(btn).toHaveText('Run demonstration', { timeout: 2000 });

      // Evaluate collected errors from listeners (populated in beforeEach)
      // We assert zero page errors and zero console errors after exercising the app.
      // If there were any, afterEach will fail the test by throwing with aggregated errors.
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('DOM and visual correctness assertions (post-run)', () => {
    test('SVG contains expected types of elements after drawing (paths, lines, circles, text)', async ({ page }) => {
      const btn = page.locator('button#runDemo');
      const svg = page.locator('#plot');

      // Ensure a run has executed
      await btn.click();
      await expect(btn).toHaveText('Run demonstration', { timeout: 2000 });

      // Check presence of a few SVG element types that drawDemo creates
      // At least one path (true function and fit curves)
      const pathCount = await page.locator('#plot path').count();
      expect(pathCount).toBeGreaterThanOrEqual(2); // true function + at least one fit

      // Circles for training points
      const circleCount = await page.locator('#plot circle').count();
      expect(circleCount).toBeGreaterThanOrEqual(1);

      // Lines for grid/axes/legend markers
      const lineCount = await page.locator('#plot line').count();
      expect(lineCount).toBeGreaterThanOrEqual(1);

      // Text elements
      const textCount = await page.locator('#plot text').count();
      expect(textCount).toBeGreaterThanOrEqual(1);

      // Legend DOM should contain the expected headings
      const legend = page.locator('#legend');
      await expect(legend).toContainText('Training MSE:');
      await expect(legend).toContainText('Test MSE (w.r.t. noise-free sin):');
    });
  });

});