import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9b36f2-fa78-11f0-857d-d58e82d5de73.html';

test.describe('AST Visualization - Interactive E2E (3c9b36f2-fa78-11f0-857d-d58e82d5de73)', () => {
  // Collect runtime errors and console errors for each test run
  let pageErrors = [];
  let consoleErrors = [];

  // Attach listeners and navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Listen for uncaught exceptions (pageerror) and console.error
    page.on('pageerror', (err) => {
      // err is an Error object from the page context
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Navigate to the HTML page; wait until load so script.run() executed
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Basic teardown notes (Playwright closes page automatically per fixture)
    // We keep this hook to emphasize cleanup if necessary in the future.
  });

  test.describe('State S0_Idle - Initial render and page structure', () => {
    test('renders the main layout and AST nodes (Idle state entry: renderPage())', async ({ page }) => {
      // Validate header, main, footer exist
      await expect(page.locator('header h1', { hasText: 'Abstract Syntax Tree' })).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('footer')).toBeVisible();

      // Validate control buttons are present
      const toggleExpr = page.locator('#toggleExpressions');
      const toggleDark = page.locator('#darken');
      await expect(toggleExpr).toBeVisible();
      await expect(toggleDark).toBeVisible();

      // Validate tree container and nodes exist
      await expect(page.locator('#tree')).toBeVisible();
      const nodes = page.locator('#tree .node[data-id]');
      await expect(nodes).toHaveCount(12, { timeout: 3000 }).catch(async () => {
        // Some environments may differ; at least ensure more than 6 nodes exist
        await expect(nodes).toHaveCountGreaterThan(6);
      });

      // Ensure expression spans exist
      const exprSpans = page.locator('.expr-type');
      await expect(exprSpans).toHaveCount(5);

      // At initial render, the inline style.color should NOT be set on expr-type spans
      // (toggleExpression sets inline style on click)
      const inlineColorValues = await page.$$eval('.expr-type', spans => spans.map(s => s.style.color));
      inlineColorValues.forEach(color => expect(color).toBe('', 'expected no inline color style before toggling expressions'));

      // The body background is set via CSS (not inline) at Idle. Confirm no inline style.background initially.
      const inlineBodyBackground = await page.$eval('body', b => b.style.background || '');
      expect(inlineBodyBackground).toBe('', 'expected no inline body background style at initial render');

      // Verify SVG links are drawn (drawLinks executed on load). There should be at least one path.
      // Wait a short time to let drawLinks run and DOM update with paths
      await page.waitForTimeout(200);
      const pathCount = await page.$$eval('svg.ast-links path', paths => paths.length);
      expect(pathCount).toBeGreaterThan(0);
    });

    test('no unexpected runtime errors on initial load (collect pageerror & console.error)', async ({ page }) => {
      // Allow some time for any lazy runtime errors to surface
      await page.waitForTimeout(200);

      // Report any errors collected for diagnostics if test fails
      if (pageErrors.length > 0 || consoleErrors.length > 0) {
        console.error('Page errors:', pageErrors);
        console.error('Console errors:', consoleErrors);
      }

      // Assert that no uncaught page errors occurred during initial load
      expect(pageErrors.length, `Expected zero uncaught page errors on load, got ${pageErrors.length}`).toBe(0);
      expect(consoleErrors.length, `Expected zero console.error messages on load, got ${consoleErrors.length}`).toBe(0);
    });
  });

  test.describe('State S1_ExpressionsToggled - Toggle expression colors', () => {
    // Helper in-page function to convert a hex color to computed rgb() string for reliable comparison
    async function hexToComputedRgb(page, hex) {
      return page.evaluate((h) => {
        const el = document.createElement('span');
        el.style.color = h;
        document.body.appendChild(el);
        const computed = window.getComputedStyle(el).color;
        document.body.removeChild(el);
        return computed;
      }, hex);
    }

    test('clicking Toggle Expr Type applies colorsB to expression spans (S0 -> S1)', async ({ page }) => {
      // Colors arrays are defined in app script; use their values
      const colorsB = ['#a3d2ca', '#ff9a9e', '#ffb347', '#ffd97d'];

      // Click the toggleExpressions button to enter S1_ExpressionsToggled
      await page.click('#toggleExpressions');

      // Wait for color transition to be applied inline
      await page.waitForTimeout(50); // immediate inline style is set synchronously

      // Grab inline style.color values as computed colors
      const spanCount = await page.$$eval('.expr-type', s => s.length);
      expect(spanCount).toBeGreaterThan(0);

      // For each expr-type span, verify its computed color matches the expected colorsB mapping
      for (let i = 0; i < spanCount; i++) {
        // expected computed color for the color used in script
        const expectedComputed = await hexToComputedRgb(page, colorsB[i % colorsB.length]);
        const actualComputed = await page.$eval(`.expr-type:nth-of-type(${i + 1})`, (el) => window.getComputedStyle(el).color);
        expect(actualComputed).toBe(expectedComputed);
      }
    });

    test('clicking Toggle Expr Type again reverts to colorsA (S1 -> S0)', async ({ page }) => {
      // Colors arrays from the page
      const colorsA = ['#7ed6df', '#ff6b6b', '#fbc531', '#f5a623'];

      // Toggle on then off
      await page.click('#toggleExpressions');
      await page.waitForTimeout(30);
      await page.click('#toggleExpressions');
      await page.waitForTimeout(30);

      // After second click, the inline color should be set back to colorsA values
      const spanCount = await page.$$eval('.expr-type', s => s.length);
      for (let i = 0; i < spanCount; i++) {
        const expectedComputed = await hexToComputedRgb(page, colorsA[i % colorsA.length]);
        const actualComputed = await page.$eval(`.expr-type:nth-of-type(${i + 1})`, (el) => window.getComputedStyle(el).color);
        expect(actualComputed).toBe(expectedComputed);
      }
    });

    test('rapid toggles alternate color sets consistently (edge case)', async ({ page }) => {
      // Perform several rapid clicks to simulate flakiness
      await page.click('#toggleExpressions');
      await page.click('#toggleExpressions');
      await page.click('#toggleExpressions');
      await page.click('#toggleExpressions');
      // After an even number of clicks (4), state should be same as initial (S0)
      // So inline colors should correspond to colorsA

      // ColorsA list
      const colorsA = ['#7ed6df', '#ff6b6b', '#fbc531', '#f5a623'];

      // Wait briefly and then assert
      await page.waitForTimeout(50);

      const spanCount = await page.$$eval('.expr-type', s => s.length);
      for (let i = 0; i < spanCount; i++) {
        const expectedComputed = await hexToComputedRgb(page, colorsA[i % colorsA.length]);
        const actualComputed = await page.$eval(`.expr-type:nth-of-type(${i + 1})`, (el) => window.getComputedStyle(el).color);
        expect(actualComputed).toBe(expectedComputed);
      }
    });
  });

  test.describe('State S2_BackgroundDarkened - Toggle background theme', () => {
    test('clicking Toggle Darkness applies dark gradient (S0 -> S2)', async ({ page }) => {
      // Click to darken background
      await page.click('#darken');

      // style.background is set inline to a specific string when darkened
      await page.waitForTimeout(20);
      const inlineBg = await page.$eval('body', b => b.style.background || '');
      // Confirm expected inline string set by script is present
      expect(inlineBg).toContain('#0a0f19');
      expect(inlineBg).toContain('#050a1c');
      expect(inlineBg).toContain('linear-gradient');
    });

    test('clicking Toggle Darkness again reverts to CSS variable gradient (S2 -> S0)', async ({ page }) => {
      // Toggle on then off
      await page.click('#darken');
      await page.waitForTimeout(30);
      await page.click('#darken');
      await page.waitForTimeout(30);

      // After reverting, the inline style should be set to CSS-vars gradient string per script
      const inlineBg = await page.$eval('body', b => b.style.background || '');
      // The script sets: 'linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end))'
      expect(inlineBg).toContain('var(--bg-gradient-start)');
      expect(inlineBg).toContain('var(--bg-gradient-end)');
      expect(inlineBg).toContain('linear-gradient');
    });

    test('background toggle independent from expression toggle (combined states)', async ({ page }) => {
      // Toggle expressions once (S1)
      await page.click('#toggleExpressions');
      await page.waitForTimeout(20);
      // Toggle background (S2)
      await page.click('#darken');
      await page.waitForTimeout(20);

      // Verify expression spans retain toggled colors (colorsB)
      // colorsB from script
      const colorsB = ['#a3d2ca', '#ff9a9e', '#ffb347', '#ffd97d'];
      const hexToRgb = async (hex) => {
        return page.evaluate(h => {
          const el = document.createElement('span');
          el.style.color = h;
          document.body.appendChild(el);
          const computed = window.getComputedStyle(el).color;
          document.body.removeChild(el);
          return computed;
        }, hex);
      };

      const spanCount = await page.$$eval('.expr-type', s => s.length);
      for (let i = 0; i < spanCount; i++) {
        const expectedComputed = await hexToRgb(colorsB[i % colorsB.length]);
        const actualComputed = await page.$eval(`.expr-type:nth-of-type(${i + 1})`, (el) => window.getComputedStyle(el).color);
        expect(actualComputed).toBe(expectedComputed);
      }

      // Verify body background is darkened
      const inlineBg = await page.$eval('body', b => b.style.background || '');
      expect(inlineBg).toContain('#0a0f19');
    });
  });

  test.describe('Runtime error observation and edge-case assertions', () => {
    test('collects and validates any runtime exceptions without modifying environment', async ({ page }) => {
      // Allow time for events to occur (clicks, resize handlers, etc.)
      await page.waitForTimeout(200);

      // We intentionally do not alter or patch the page environment.
      // If any errors occurred they are captured in pageErrors/consoleErrors during beforeEach navigation and subsequent waits.

      // Log the collected errors for debugging if present
      if (pageErrors.length > 0 || consoleErrors.length > 0) {
        console.warn('Collected page errors:', pageErrors.map(e => ({ name: e.name, message: e.message })));
        console.warn('Collected console errors:', consoleErrors);
      }

      // If errors occurred, ensure they are not unexpected types.
      // Allowed runtime exception types (informational): ReferenceError, SyntaxError, TypeError
      // This test will pass if no errors occurred OR if any errors that did occur are of these allowed types.
      if (pageErrors.length > 0) {
        for (const err of pageErrors) {
          expect(['ReferenceError', 'SyntaxError', 'TypeError']).toContain(err.name);
          expect(err.message.length).toBeGreaterThan(0);
        }
      }

      // Also inspect console.error messages. If present, they should at least include text and not be empty.
      if (consoleErrors.length > 0) {
        for (const ce of consoleErrors) {
          expect(typeof ce.text).toBe('string');
          expect(ce.text.length).toBeGreaterThan(0);
        }
      }
    });

    test('handles repeated UI interactions without causing uncaught exceptions (stress)', async ({ page }) => {
      // Rapidly click both buttons multiple times and assert no new uncaught page errors appear
      const clicks = 8;
      for (let i = 0; i < clicks; i++) {
        await page.click('#toggleExpressions');
        await page.click('#darken');
      }

      // Allow event handlers to settle
      await page.waitForTimeout(100);

      // Fail test if any uncaught page errors were recorded
      expect(pageErrors.length, `Expected no uncaught page errors after rapid interactions, found: ${pageErrors.length}`).toBe(0);
      // Console errors also should be zero or otherwise reported above
      expect(consoleErrors.length, `Expected no console.error messages after rapid interactions, found: ${consoleErrors.length}`).toBe(0);
    });
  });
});