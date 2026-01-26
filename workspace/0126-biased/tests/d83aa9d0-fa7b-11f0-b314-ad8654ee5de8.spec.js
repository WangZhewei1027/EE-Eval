import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83aa9d0-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('d83aa9d0-fa7b-11f0-b314-ad8654ee5de8 — Logistic Regression demo (sigmoid visualization)', () => {
  // Collect console errors and page errors for each test to assert there are none (or to observe any natural errors).
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console events and capture error-level messages
    page.on('console', msg => {
      // capture console.error and explicit 'error' messages
      if (msg.type() === 'error') {
        consoleErrors.push({ type: msg.type(), text: msg.text() });
      }
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is, allow full load.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No teardown beyond Playwright's fixtures; we keep listeners ephemeral per test via beforeEach.
  });

  test.describe('Initial state (FSM: S0_Idle)', () => {
    test('Initial DOM: button exists and demo container is hidden', async ({ page }) => {
      // This test validates S0_Idle evidence:
      // - The primary button #showDemo is present with expected text.
      // - The demo container starts hidden (display:none).
      // - There is no global renderPage function defined (FSM entry_actions referenced renderPage()).
      const showDemo = await page.$('#showDemo');
      expect(showDemo, 'Expected a button with id #showDemo to be present').not.toBeNull();

      const buttonText = await page.textContent('#showDemo');
      expect(buttonText).toContain('Show simple demo');

      // Button should be enabled initially
      const isDisabled = await page.$eval('#showDemo', (b) => b.disabled);
      expect(isDisabled).toBe(false);

      // demoContainer initial style should be display:none
      const demoDisplay = await page.$eval('#demoContainer', el => {
        // return the inline style display value and computed style for clarity
        return { inline: el.getAttribute('style'), computed: window.getComputedStyle(el).display };
      });
      // The HTML sets inline style to display:none; computed display should also be 'none'
      expect(demoDisplay.inline).toContain('display:none');
      expect(demoDisplay.computed).toBe('none');

      // FSM mentioned an entry action renderPage() for S0_Idle. Verify whether such a function exists — do NOT inject or call it.
      const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
      // We assert that the page did not define renderPage (the implementation uses an IIFE instead).
      expect(hasRenderPage).toBe(false);

      // Assert no console errors or page errors happened during initial load
      expect(consoleErrors.length, `Console errors on load: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors on load: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });

  test.describe('Interaction and transitions (FSM: ShowDemoClick, S1_DemoVisible)', () => {
    test('Clicking #showDemo reveals demoContainer, draws on canvas, disables button and updates text', async ({ page }) => {
      // This test validates the transition from S0_Idle -> S1_DemoVisible:
      // - clicking the button sets demoContainer.style.display = 'block'
      // - drawSigmoid() runs (we verify canvas has non-empty content)
      // - button becomes disabled and text changes to 'Demo rendered'

      // Sanity pre-checks
      await expect(page.locator('#showDemo')).toHaveCount(1);
      await expect(page.locator('#demoContainer')).toHaveCount(1);
      await expect(page.locator('#sigmoidCanvas')).toHaveCount(1);

      // Click the demo button
      await page.click('#showDemo');

      // After click, demoContainer should be visible (computed display !== 'none').
      const displayAfter = await page.$eval('#demoContainer', el => window.getComputedStyle(el).display);
      expect(displayAfter === 'block' || displayAfter === 'flex' || displayAfter === 'inline-block').toBeTruthy();

      // The button should be disabled and text changed to "Demo rendered"
      const btnDisabled = await page.$eval('#showDemo', b => b.disabled);
      expect(btnDisabled).toBe(true);

      const btnText = await page.textContent('#showDemo');
      expect(btnText).toContain('Demo rendered');

      // Verify the canvas attributes (width/height) match expected component evidence
      const canvasAttrs = await page.$eval('#sigmoidCanvas', c => ({ w: c.width, h: c.height }));
      expect(canvasAttrs.w).toBe(760);
      expect(canvasAttrs.h).toBe(300);

      // Ensure drawing happened: check that canvas.toDataURL() returns a non-trivial PNG data string
      const dataUrl = await page.$eval('#sigmoidCanvas', (c) => c.toDataURL('image/png'));
      expect(typeof dataUrl).toBe('string');
      expect(dataUrl.startsWith('data:image/png')).toBe(true);
      // Length should be reasonably large (tiny images still produce headers > 1000 chars)
      expect(dataUrl.length).toBeGreaterThan(1500);

      // Additionally sample a pixel near the center where the sigmoid curve is expected to be drawn.
      // The implementation draws the sigmoid roughly centered; sample canvas pixel at center.
      const centerPixel = await page.$eval('#sigmoidCanvas', (c) => {
        const ctx = c.getContext('2d');
        const x = Math.floor(c.width / 2);
        const y = Math.floor(c.height / 2);
        const d = ctx.getImageData(x, y, 1, 1).data;
        return { x, y, rgba: [d[0], d[1], d[2], d[3]] };
      });

      // The center pixel should not be fully transparent and is expected to differ from pure white background (255,255,255).
      const [r, g, b, a] = centerPixel.rgba;
      expect(a).toBeGreaterThan(0);
      const isWhite = (r === 255 && g === 255 && b === 255);
      // It's acceptable if it's not white (the central curve/axes/text should have colored pixels). Assert not white.
      expect(isWhite).toBe(false);

      // Validate that the canvas contains textual annotations for example z values by checking for some colored pixels near right of center.
      // Sample a few offsets to increase confidence that drawing executed.
      const samplePixels = await page.$eval('#sigmoidCanvas', (c) => {
        const ctx = c.getContext('2d');
        const w = c.width, h = c.height;
        const coords = [
          { x: Math.floor(w * 0.5), y: Math.floor(h * 0.5) },
          { x: Math.floor(w * 0.6), y: Math.floor(h * 0.4) },
          { x: Math.floor(w * 0.4), y: Math.floor(h * 0.6) }
        ];
        return coords.map(({ x, y }) => {
          const d = ctx.getImageData(x, y, 1, 1).data;
          return { x, y, rgba: [d[0], d[1], d[2], d[3]] };
        });
      });

      // At least one sampled pixel should not be pure white
      const hasNonWhite = samplePixels.some(p => !(p.rgba[0] === 255 && p.rgba[1] === 255 && p.rgba[2] === 255));
      expect(hasNonWhite).toBe(true);

      // Assert no console-level errors or page errors occurred during the interaction
      expect(consoleErrors.length, `Console errors during interaction: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors during interaction: ${JSON.stringify(pageErrors)}`).toBe(0);
    });

    test('Subsequent clicks do not change disabled state or text (demo is static/minimal)', async ({ page }) => {
      // After initial click, the button is disabled. This test ensures further clicks do nothing (guard against double-render).
      await page.click('#showDemo');

      // Confirm first click produced the expected state
      await expect(page.locator('#showDemo')).toBeDisabled();
      await expect(page.locator('#showDemo')).toHaveText(/Demo rendered/);

      // Try to click again; since it's disabled, Playwright click will still attempt; guard by verifying disabled property after 'attempted' click.
      // Use JavaScript to dispatch a click event to simulate potential edge-case re-clicks without enabling the button.
      await page.evaluate(() => {
        const btn = document.getElementById('showDemo');
        if (btn) {
          try {
            btn.click();
          } catch (e) {
            // let any exceptions be captured by pageerror handler naturally
          }
        }
      });

      // Re-assert disabled and text unchanged
      const btnDisabled2 = await page.$eval('#showDemo', b => b.disabled);
      const btnText2 = await page.textContent('#showDemo');
      expect(btnDisabled2).toBe(true);
      expect(btnText2).toContain('Demo rendered');

      // The demoContainer should remain visible and the canvas still present
      const demoVisible = await page.$eval('#demoContainer', el => window.getComputedStyle(el).display);
      expect(demoVisible).not.toBe('none');
      const canvasExists = await page.$('#sigmoidCanvas');
      expect(canvasExists).not.toBeNull();

      // No new console or page errors should have been introduced by the attempted re-click
      expect(consoleErrors.length, `Console errors after re-click attempt: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors after re-click attempt: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });

  test.describe('Edge cases & validation', () => {
    test('Canvas context exists and is 2D (guard against getContext failures)', async ({ page }) => {
      // Ensure that the canvas context is present and of type '2d'.
      const ctxType = await page.$eval('#sigmoidCanvas', c => {
        try {
          const ctx = c.getContext('2d');
          return ctx ? Object.prototype.toString.call(ctx) : null;
        } catch (e) {
          // If getContext throws, let the pageerror or returned value reflect that.
          return null;
        }
      });

      // The typical toString for CanvasRenderingContext2D is "[object CanvasRenderingContext2D]" but it can vary.
      expect(ctxType).not.toBeNull();
    });

    test('Sanity check: the page does not throw ReferenceError/SyntaxError/TypeError on load (observe natural errors)', async ({ page }) => {
      // This test explicitly asserts that no uncaught page errors were raised during page load and setup.
      // If there were errors, they would have been captured in pageErrors or consoleErrors.
      // We assert that those arrays are empty.
      expect(pageErrors.length, `Unexpected page errors captured: ${JSON.stringify(pageErrors)}`).toBe(0);
      expect(consoleErrors.length, `Unexpected console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);

      // For completeness, list any console warnings (non-error) but do not fail on them; they are logged for debugging.
      // We intentionally do not assert on warnings as the FSM does not specify them.
    });
  });
});