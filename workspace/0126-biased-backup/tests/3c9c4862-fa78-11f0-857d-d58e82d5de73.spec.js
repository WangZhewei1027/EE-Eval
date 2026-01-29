import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9c4862-fa78-11f0-857d-d58e82d5de73.html';

test.describe('Overfitting Visualization — FSM and UI validation (3c9c4862-fa78-11f0-857d-d58e82d5de73)', () => {
  // Collect console.error messages and page errors for each test to assert no runtime errors occur.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console events and capture only error-level messages.
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location ? msg.location() : null
          });
        }
      } catch (e) {
        // In case of unexpected console event shapes, still record a representation.
        consoleErrors.push({ text: String(msg) });
      }
    });

    // Capture unhandled errors thrown on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test. We do not modify the page in any other way.
    await page.goto(BASE_URL);
  });

  test.afterEach(async () => {
    // Nothing special to teardown; the Playwright fixtures handle closing pages.
  });

  test('Initial load triggers Idle -> Animating transition and curves animate in sequence', async ({ page }) => {
    // This test validates the Window_Load transition from S0_Idle -> S1_Animating,
    // i.e., the page's load handler calls startAnimation() (after a 400ms delay),
    // and the three curves receive their animation classes in sequence.

    // Basic DOM existence checks
    const btn = page.locator('#btnReplay');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('aria-label', 'Replay animation');
    await expect(btn).toHaveAttribute('aria-live', 'polite');

    // Ensure curve elements exist
    const trueCurve = page.locator('.curve-true');
    const underfitCurve = page.locator('.curve-underfit');
    const overfitCurve = page.locator('.curve-overfit');

    await expect(trueCurve).toHaveCount(1);
    await expect(underfitCurve).toHaveCount(1);
    await expect(overfitCurve).toHaveCount(1);

    // Wait for animate-true class to appear. According to implementation:
    // window.load -> setTimeout(startAnimation, 400)
    // startAnimation -> setTimeout(() => add animate-true, 100)
    // So animate-true expected around 500ms after load. Allow margin.
    await page.waitForFunction(() => {
      const el = document.querySelector('.curve-true');
      return el && el.classList.contains('animate-true');
    }, undefined, { timeout: 3000 });

    // After animate-true, the underfit and overfit follow at later offsets.
    await page.waitForFunction(() => {
      const u = document.querySelector('.curve-underfit');
      return u && u.classList.contains('animate-underfit');
    }, undefined, { timeout: 4000 });

    await page.waitForFunction(() => {
      const o = document.querySelector('.curve-overfit');
      return o && o.classList.contains('animate-overfit');
    }, undefined, { timeout: 5000 });

    // Verify that data points and legend are present (visual feedback & DOM)
    await expect(page.locator('g[aria-label="Training data points"] circle.datapoint.train')).toHaveCount(12);
    await expect(page.locator('g[aria-label="Test data points"] circle.datapoint.test')).toHaveCount(10);

    await expect(page.locator('.legend')).toBeVisible();
    await expect(page.locator('text.axis-label')).toHaveCount(2);

    // Ensure no runtime console errors or unhandled page errors happened during initial load/animation.
    // We assert that none were captured. If any exist, include them in the message for debugging.
    expect(consoleErrors.length, `Console.error messages were emitted: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `Unhandled page errors were thrown: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
  });

  test('Clicking Replay Animation triggers animations and focuses the Replay button', async ({ page }) => {
    // This test validates the ReplayAnimation_Click event:
    // Clicking #btnReplay should call startAnimation() and focus the button,
    // causing the animate-* classes to be re-applied with expected timings.

    const btn = page.locator('#btnReplay');
    await expect(btn).toBeVisible();

    // Click the button to trigger the transition from Idle->Animating (event-driven)
    await btn.click();

    // After click, the implementation calls startAnimation() which adds animate-true after 100ms.
    await page.waitForFunction(() => {
      const el = document.querySelector('.curve-true');
      return el && el.classList.contains('animate-true');
    }, undefined, { timeout: 2000 });

    // Underfit and overfit should follow per startAnimation timings.
    await page.waitForFunction(() => {
      const u = document.querySelector('.curve-underfit');
      return u && u.classList.contains('animate-underfit');
    }, undefined, { timeout: 3000 });

    await page.waitForFunction(() => {
      const o = document.querySelector('.curve-overfit');
      return o && o.classList.contains('animate-overfit');
    }, undefined, { timeout: 4000 });

    // The implementation focuses the button after click.
    const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    expect(activeId).toBe('btnReplay');

    // Verify no runtime console errors or unhandled page errors occurred as a result of the click.
    expect(consoleErrors.length, `Console.error messages were emitted during click: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `Unhandled page errors were thrown during click: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
  });

  test('Rapid repeated clicks do not cause uncaught errors and animations still apply', async ({ page }) => {
    // Edge case: simulate rapid user clicks on Replay button.
    // This ensures startAnimation/resetAnimation are re-entrant and do not throw.

    const btn = page.locator('#btnReplay');
    await expect(btn).toBeVisible();

    // Rapid clicks
    await btn.click();
    await btn.click();
    await btn.click();

    // Wait for expected animation classes (should be present after last triggered startAnimation)
    await page.waitForFunction(() => {
      const el = document.querySelector('.curve-true');
      return el && el.classList.contains('animate-true');
    }, undefined, { timeout: 3000 });

    await page.waitForFunction(() => {
      const u = document.querySelector('.curve-underfit');
      return u && u.classList.contains('animate-underfit');
    }, undefined, { timeout: 4000 });

    await page.waitForFunction(() => {
      const o = document.querySelector('.curve-overfit');
      return o && o.classList.contains('animate-overfit');
    }, undefined, { timeout: 5000 });

    // Assert the button remains focused after last click
    const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    expect(activeId).toBe('btnReplay');

    // Ensure no console errors or unhandled page errors resulted from rapid interactions.
    expect(consoleErrors.length, `Console.error messages during rapid clicks: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `Unhandled page errors during rapid clicks: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
  });

  test('Accessibility and semantic checks: sr-only description, aria labels, and role semantics', async ({ page }) => {
    // Validate that descriptive elements and accessibility attributes exist per HTML implementation.

    // The hidden description paragraph with id="desc" should be present and have sr-only class.
    const desc = page.locator('#desc');
    await expect(desc).toBeVisible(); // it is visually hidden via CSS but is in the DOM; Playwright's toBeVisible checks computed visibility; sr-only uses off-screen technique but still considered visible to accessibility API. Use toHaveClass instead to be robust.
    await expect(desc).toHaveClass(/sr-only/);

    // The main svg should be present and have role/img and aria-hidden set to true for decorative purposes.
    const svg = page.locator('svg.canvas-holder');
    await expect(svg).toHaveAttribute('role', 'img');

    // Check legend presence and items
    const legend = page.locator('.legend');
    await expect(legend).toBeVisible();
    // Expect legend to contain items for Underfit, True, Overfit, Training Data and Test Data
    await expect(legend.locator('text=Underfit Model')).toHaveCount(1);
    await expect(legend.locator('text=True Model')).toHaveCount(1);
    await expect(legend.locator('text=Overfit Model')).toHaveCount(1);
    await expect(legend.locator('text=Training Data')).toHaveCount(1);
    await expect(legend.locator('text=Test Data')).toHaveCount(1);

    // Ensure no runtime errors captured while performing these checks.
    expect(consoleErrors.length, `Console.error messages during accessibility checks: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `Unhandled page errors during accessibility checks: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
  });

  test('No unexpected ReferenceError/SyntaxError/TypeError occurred during page lifecycle', async ({ page }) => {
    // This test explicitly inspects any captured page errors and console errors for
    // common JavaScript error types. The implementation should not produce such errors.
    // If such errors exist, fail and report details.

    // Wait briefly to let any late-onset errors surface (e.g., async callbacks).
    await page.waitForTimeout(500);

    // Combine errors for reporting
    const errorMessages = [];
    for (const ce of consoleErrors) {
      errorMessages.push({ source: 'console.error', msg: ce.text, location: ce.location });
    }
    for (const pe of pageErrors) {
      errorMessages.push({ source: 'pageerror', msg: pe.message || String(pe), stack: pe.stack || null });
    }

    // If any errors exist, assert failure and include the collected errors for debugging.
    expect(errorMessages.length, `Expected no ReferenceError/SyntaxError/TypeError or other runtime errors, but found: ${JSON.stringify(errorMessages, null, 2)}`).toBe(0);
  });
});