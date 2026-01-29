import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83a82c1-fa7b-11f0-b314-ad8654ee5de8.html';

/**
 * Page object encapsulating interactions with the demo UI.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runDemo');
    this.coeffsEl = page.locator('#coeffs');
    this.r2El = page.locator('#r2');
    this.svgEl = page.locator('#demoCanvas');
    this.demoNote = page.locator('#demoNote');
  }

  // Click the run demo button
  async clickRun() {
    await this.runBtn.click();
  }

  // Get textual content of coefficients element
  async getCoeffsText() {
    return (await this.coeffsEl.textContent()) || '';
  }

  // Get textual content of r2 element
  async getR2Text() {
    return (await this.r2El.textContent()) || '';
  }

  // Return number of immediate child nodes in the SVG demo canvas
  async getSvgChildCount() {
    return await this.page.evaluate(() => {
      const svg = document.getElementById('demoCanvas');
      return svg ? svg.children.length : 0;
    });
  }

  // Count specific SVG element types (circle, line, text, etc.)
  async countSvgElements(tagName) {
    return await this.page.evaluate((tag) => {
      const svg = document.getElementById('demoCanvas');
      if (!svg) return 0;
      return svg.querySelectorAll(tag).length;
    }, tagName);
  }

  // Whether the demo note is visible (computed display not 'none')
  async isDemoNoteVisible() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demoNote');
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    });
  }

  // Wait for the demo to update coefficients (i.e., remove the placeholder '—')
  async waitForDemoToComplete(timeout = 2000) {
    await this.page.waitForFunction(() => {
      const coeffs = document.getElementById('coeffs');
      const r2 = document.getElementById('r2');
      if (!coeffs || !r2) return false;
      const coeffsText = coeffs.textContent || '';
      const r2Text = r2.textContent || '';
      return !coeffsText.includes('—') && r2Text.trim() !== '—';
    }, { timeout });
  }
}

test.describe('Linear Regression — Minimal Demo (FSM states & transitions) - d83a82c1-fa7b-11f0-b314-ad8654ee5de8', () => {
  // Collect runtime errors and console messages so tests can make assertions about them.
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Observe uncaught errors reported by the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // store the actual Error object for introspection in tests
      pageErrors.push(err);
    });

    // Capture console messages for debugging and assertions
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the exact HTML file provided
    await page.goto(APP_URL);
  });

  test.afterEach(async ({}, testInfo) => {
    // If a test failed, dump console messages to aid debugging
    if (testInfo.status !== testInfo.expectedStatus) {
      // Print console messages to standard output via testInfo attachments
      if (consoleMessages.length) {
        testInfo.attach('console-messages', {
          body: JSON.stringify(consoleMessages, null, 2),
          contentType: 'application/json'
        });
      }
      if (pageErrors.length) {
        testInfo.attach('page-errors', {
          body: pageErrors.map(e => String(e)).join('\n\n'),
          contentType: 'text/plain'
        });
      }
    }
  });

  test('Idle state (S0_Idle) renders initial UI correctly', async ({ page }) => {
    // This test validates the Idle state described in the FSM:
    // - The "Generate data & Fit line" button is present and visible.
    // - Coefficients display shows placeholders (—).
    // - R² display shows placeholder (—).
    // - SVG canvas exists and initially has no plotted elements.
    // - Demo note is hidden.
    const demo = new DemoPage(page);

    // Button exists and is visible with correct attributes
    await expect(demo.runBtn).toBeVisible();
    await expect(demo.runBtn).toHaveAttribute('title', 'Generate data and fit a line');

    // Coeffs and r2 show placeholders initially (evidence in FSM)
    const coeffsText = await demo.getCoeffsText();
    expect(coeffsText).toContain('—'); // placeholder present

    const r2Text = await demo.getR2Text();
    expect(r2Text.trim()).toBe('—');

    // SVG should exist and have zero or only axis children before clicking (script creates axes on plot; but before clicking, script hasn't added anything)
    const svgChildCount = await demo.getSvgChildCount();
    // Implementation: clearSvg() only runs when plotting; before click, svg is empty, so expect 0
    expect(svgChildCount).toBe(0);

    // Demo note should be hidden per initial HTML (style="display:none")
    const demoNoteVisible = await demo.isDemoNoteVisible();
    expect(demoNoteVisible).toBe(false);

    // Ensure there were no runtime page errors during initial render
    // We assert absence of uncaught exceptions (ReferenceError/TypeError/SyntaxError)
    expect(pageErrors.length, `Expected no page errors during initial render, saw: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

    // Console may contain benign messages, but ensure there are no severe console.error entries
    const severe = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(severe.length).toBe(0);
  });

  test('Transition GenerateDemo: clicking button runs demo and updates state to Demo Running (S1_DemoRunning)', async ({ page }) => {
    // This validates the FSM transition triggered by the click on #runDemo:
    // - generateSyntheticData() and fitLine() entry actions manifest as updated UI
    // - coefficients and R² are updated to numeric values
    // - svg receives plotted circles and a fitted line
    // - demo note becomes visible

    const demo = new DemoPage(page);

    // Capture initial placeholders
    const initialCoeffs = await demo.getCoeffsText();
    expect(initialCoeffs).toContain('—');

    const initialR2 = await demo.getR2Text();
    expect(initialR2.trim()).toBe('—');

    // Click to trigger GenerateDemo event
    await demo.clickRun();

    // Wait for the demo to finish updating coefficients & R² (script updates DOM synchronously after computation, but wait to be safe)
    await demo.waitForDemoToComplete(3000);

    // After clicking, coefficients should be numeric values formatted to 3 decimals
    const updatedCoeffs = await demo.getCoeffsText();
    // Regex: β0 = <number> ,  β1 = <number>  (toFixed(3) is used in implementation)
    const coeffsRegex = /β0 = -?\d+\.\d{3},\s*β1 = -?\d+\.\d{3}/;
    expect(updatedCoeffs).toMatch(coeffsRegex);

    // R² should be a numeric string like "0.###" or "-0.###"
    const updatedR2 = await demo.getR2Text();
    expect(updatedR2.trim()).not.toBe('—');
    const parsedR2 = parseFloat(updatedR2);
    expect(Number.isFinite(parsedR2)).toBe(true);
    // R² is expected to be between -1 and 1 in general
    expect(parsedR2).toBeGreaterThanOrEqual(-1.0);
    expect(parsedR2).toBeLessThanOrEqual(1.0);

    // Demo note should now be visible (script sets style.display = 'block')
    const demoNoteVisible = await demo.isDemoNoteVisible();
    expect(demoNoteVisible).toBe(true);

    // SVG should now contain plotted elements: axes (2 lines), many circles, and a fitted line
    const circleCount = await demo.countSvgElements('circle');
    const lineCount = await demo.countSvgElements('line');
    const textCount = await demo.countSvgElements('text');

    // Expect at least one circle (the scatter) and at least one fitted line
    expect(circleCount).toBeGreaterThanOrEqual(1);
    // There will be at least 3 lines: x axis, y axis, and fitted line
    expect(lineCount).toBeGreaterThanOrEqual(3);
    // There should be some text labels for axis
    expect(textCount).toBeGreaterThanOrEqual(2);

    // No uncaught exceptions should have been thrown during the click -> processing
    // If any ReferenceError/TypeError/SyntaxError occurred, they would be in pageErrors
    expect(pageErrors.length, `Unexpected page errors after running demo: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

    // There should be no console.error entries indicating runtime failures
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Repeated runs are idempotent-ish: subsequent clicks update DOM and do not crash', async ({ page }) => {
    // Edge case: clicking the button multiple times should re-generate new synthetic data,
    // update coefficients and svg content, and should not introduce uncaught errors.

    const demo = new DemoPage(page);

    // First run
    await demo.clickRun();
    await demo.waitForDemoToComplete(3000);

    const coeffsAfterFirst = await demo.getCoeffsText();
    const r2AfterFirst = await demo.getR2Text();
    const circlesAfterFirst = await demo.countSvgElements('circle');

    // Sanity checks from the first run
    expect(coeffsAfterFirst).toMatch(/β0 = -?\d+\.\d{3},\s*β1 = -?\d+\.\d{3}/);
    expect(Number.isFinite(parseFloat(r2AfterFirst))).toBe(true);
    expect(circlesAfterFirst).toBeGreaterThanOrEqual(1);

    // Second run
    await demo.clickRun();
    await demo.waitForDemoToComplete(3000);

    const coeffsAfterSecond = await demo.getCoeffsText();
    const r2AfterSecond = await demo.getR2Text();
    const circlesAfterSecond = await demo.countSvgElements('circle');

    // Postconditions:
    // - Coefficients should still be numeric and formatted correctly
    expect(coeffsAfterSecond).toMatch(/β0 = -?\d+\.\d{3},\s*β1 = -?\d+\.\d{3}/);
    expect(Number.isFinite(parseFloat(r2AfterSecond))).toBe(true);
    expect(circlesAfterSecond).toBeGreaterThanOrEqual(1);

    // The coefficients or r2 may change because data is re-generated; it's sufficient to assert they are valid.
    // Also ensure subsequent clicks didn't produce runtime errors
    expect(pageErrors.length, `Unexpected page errors after repeated runs: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('UI elements and accessibility attributes match FSM components', async ({ page }) => {
    // Validate that the DOM contains the components enumerated in the FSM:
    // - #runDemo button (text, class, title)
    // - #demoCanvas svg with expected attributes
    // - #coeffs and #r2 stat-line elements
    // - #demoNote exists, initially hidden

    const demo = new DemoPage(page);

    // Button text and attributes
    await expect(demo.runBtn).toBeVisible();
    await expect(demo.runBtn).toHaveText('Generate data & Fit line');
    await expect(demo.runBtn).toHaveAttribute('class', /primary/);
    await expect(demo.runBtn).toHaveAttribute('title', 'Generate data and fit a line');

    // SVG attributes
    const svg = await page.locator('#demoCanvas');
    await expect(svg).toHaveAttribute('width', '520');
    await expect(svg).toHaveAttribute('height', '320');
    await expect(svg).toHaveAttribute('aria-label', 'Scatter and fitted line');

    // Coeffs and r2 elements exist and use the stat-line class
    const coeffsLocator = page.locator('#coeffs');
    const r2Locator = page.locator('#r2');
    await expect(coeffsLocator).toHaveClass(/stat-line/);
    await expect(r2Locator).toHaveClass(/stat-line/);

    // demoNote exists and is hidden initially
    const demoNote = page.locator('#demoNote');
    await expect(demoNote).toBeHidden();

    // Confirm no runtime errors on simply querying these elements
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity: No SyntaxError/ReferenceError/TypeError leaked on load or interaction', async ({ page }) => {
    // This test explicitly asserts that there were no critical JS errors (SyntaxError, ReferenceError, TypeError)
    // either during load or while interacting with the demo. Per instructions, we observe page errors and let them
    // happen naturally; here we assert they did not occur.

    const demo = new DemoPage(page);

    // Interact with the page to exercise code paths
    await demo.clickRun();
    await demo.waitForDemoToComplete(3000);

    // Inspect collected pageErrors for critical error types
    const criticalErrors = pageErrors.filter(err => {
      const msg = String(err && err.message ? err.message : err);
      return /ReferenceError|TypeError|SyntaxError/.test(msg);
    });

    // Expect zero critical errors
    expect(criticalErrors.length, `Found critical errors: ${criticalErrors.map(e => String(e)).join('; ')}`).toBe(0);

    // Also assert no console.error messages were emitted
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });
});