import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8e3ee1-fa77-11f0-8492-31e949ed3c7c.html';

// Page object for the Big-O Notation Visualizer
class VisualizerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#startAnimation');
    this.line1 = page.locator('#line1');
    this.line2 = page.locator('#line2');
    this.line3 = page.locator('#line3');
  }

  // Navigate to the app and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the Start Animation button
  async clickStart() {
    await this.startButton.click();
  }

  // Return the inline style.height values (strings) for the three lines
  async getInlineHeights() {
    return await this.page.evaluate(() => {
      const l1 = document.getElementById('line1');
      const l2 = document.getElementById('line2');
      const l3 = document.getElementById('line3');
      return {
        line1: l1 ? l1.style.height : null,
        line2: l2 ? l2.style.height : null,
        line3: l3 ? l3.style.height : null,
      };
    });
  }

  // Return the computed heights (in pixels like "120px") for the three lines
  async getComputedHeights() {
    return await this.page.evaluate(() => {
      const l1 = document.getElementById('line1');
      const l2 = document.getElementById('line2');
      const l3 = document.getElementById('line3');
      const cs = (el) => (el ? window.getComputedStyle(el).height : null);
      return {
        line1: cs(l1),
        line2: cs(l2),
        line3: cs(l3),
      };
    });
  }

  // Return the inline style attributes for widths/opacities as strings (evidence)
  async getInlineStyleAttributes() {
    return await this.page.evaluate(() => {
      const l1 = document.getElementById('line1');
      const l2 = document.getElementById('line2');
      const l3 = document.getElementById('line3');
      return {
        line1: l1 ? l1.getAttribute('style') : null,
        line2: l2 ? l2.getAttribute('style') : null,
        line3: l3 ? l3.getAttribute('style') : null,
      };
    });
  }

  // Return whether the startAnimation element has an onclick handler and, if possible, its name
  async getStartOnclickInfo() {
    return await this.page.evaluate(() => {
      const btn = document.getElementById('startAnimation');
      if (!btn) return { exists: false };
      const handler = btn.onclick;
      if (!handler) return { exists: true, hasHandler: false };
      return { exists: true, hasHandler: true, name: handler.name || null, type: typeof handler };
    });
  }

  // Wait until the inline style heights are equal to the expected strings
  async waitForInlineHeights(expected, timeout = 2000) {
    const page = this.page;
    await page.waitForFunction(
      (exp) => {
        const l1 = document.getElementById('line1');
        const l2 = document.getElementById('line2');
        const l3 = document.getElementById('line3');
        if (!l1 || !l2 || !l3) return false;
        return l1.style.height === exp.line1 && l2.style.height === exp.line2 && l3.style.height === exp.line3;
      },
      expected,
      { timeout }
    );
  }
}

test.describe('Big-O Notation Visualizer - FSM and UI validation', () => {
  // Containers to collect runtime issues per test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // store the error object for assertions
      pageErrors.push(err);
    });

    // Collect console messages for inspection (type, text)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test, attach a little diagnostic if unexpected page errors were captured.
    // This does not mutate the page; only reports for debugging when assertions fail.
    if (pageErrors.length > 0) {
      // Log to the test output (Playwright will show this)
      // But do not modify the page or application code.
      // Keep this purely observational.
      // eslint-disable-next-line no-console
      console.error('Captured pageerror(s):', pageErrors.map((e) => e.message || String(e)));
    }
    if (consoleMessages.some((m) => m.type === 'error')) {
      // eslint-disable-next-line no-console
      console.error('Captured console error messages:', consoleMessages.filter((m) => m.type === 'error'));
    }
    // No other teardown required.
  });

  test('Initial Idle state: page renders Start Animation button and visual lines with expected attributes', async ({ page }) => {
    // Purpose: Validate the S0_Idle state from the FSM:
    // - Entry action: renderPage() effect observable via DOM elements
    // - Evidence: Start Animation button exists, lines exist with width/opacities set inline

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Assert Start Animation button exists and is visible
    await expect(vp.startButton).toBeVisible({ timeout: 2000 });
    // Assert lines exist in the DOM
    await expect(vp.line1).toBeVisible();
    await expect(vp.line2).toBeVisible();
    await expect(vp.line3).toBeVisible();

    // The inline style attributes should contain width and opacity as provided in HTML evidence
    const inlineAttrs = await vp.getInlineStyleAttributes();
    expect(inlineAttrs.line1).toBeTruthy();
    expect(inlineAttrs.line1).toContain('width: 20%');
    expect(inlineAttrs.line1).toContain('opacity: 0.8');

    expect(inlineAttrs.line2).toBeTruthy();
    expect(inlineAttrs.line2).toContain('width: 30%');
    expect(inlineAttrs.line2).toContain('opacity: 0.6');

    expect(inlineAttrs.line3).toBeTruthy();
    expect(inlineAttrs.line3).toContain('width: 40%');
    expect(inlineAttrs.line3).toContain('opacity: 0.4');

    // The visual height before animation should be zero (set by CSS .line { height: 0; })
    const computedHeights = await vp.getComputedHeights();
    // Computed heights should be a pixel value (e.g., "0px") - ensure they are not the animated percents yet
    expect(computedHeights.line1).toBeTruthy();
    expect(computedHeights.line2).toBeTruthy();
    expect(computedHeights.line3).toBeTruthy();
    expect(computedHeights.line1).toContain('px');
    // Most importantly, ensure inline style.height is empty string before animation
    const inlineHeights = await vp.getInlineHeights();
    expect(inlineHeights.line1).toBe('');
    expect(inlineHeights.line2).toBe('');
    expect(inlineHeights.line3).toBe('');

    // Ensure no uncaught page errors happened during initial render
    expect(pageErrors.length).toBe(0);
    // And no console.error messages were emitted during initial render
    expect(consoleMessages.some((m) => m.type === 'error')).toBe(false);
  });

  test('Transition: clicking Start Animation triggers animateGraphs and updates inline heights (S0 -> S1)', async ({ page }) => {
    // Purpose: Validate the StartAnimation event and transition to S1_Animating
    // - Event: click #startAnimation
    // - Expected observables: line1.style.height = '40%'; line2.style.height = '70%'; line3.style.height = '90%'

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Verify the onclick handler is attached to the button and references a function (evidence)
    const onclickInfoBefore = await vp.getStartOnclickInfo();
    expect(onclickInfoBefore.exists).toBe(true);
    // The app assigns document.getElementById("startAnimation").onclick = animateGraphs;
    // So there should be a handler and it should be of type 'function', name may be 'animateGraphs'
    expect(onclickInfoBefore.hasHandler).toBe(true);
    expect(onclickInfoBefore.type).toBe('function');
    // Name may be available; if so, it should include 'animateGraphs' (best effort)
    if (onclickInfoBefore.name) {
      expect(onclickInfoBefore.name.toLowerCase()).toContain('animategraphs');
    }

    // Click the button to trigger the animation function
    await vp.clickStart();

    // Wait for expected inline style heights to be set by animateGraphs
    const expectedHeights = { line1: '40%', line2: '70%', line3: '90%' };
    await vp.waitForInlineHeights(expectedHeights, 2000);

    // Retrieve inline heights and assert exact string values
    const inlineHeights = await vp.getInlineHeights();
    expect(inlineHeights.line1).toBe('40%');
    expect(inlineHeights.line2).toBe('70%');
    expect(inlineHeights.line3).toBe('90%');

    // As an additional check, verify computed heights are non-zero pixel values (visual change occurred)
    const computedAfter = await vp.getComputedHeights();
    expect(computedAfter.line1).not.toBeNull();
    expect(computedAfter.line1).not.toBe('0px');
    // Ensure the computed heights are larger than zero (contain px and not '0px')
    expect(computedAfter.line1).toMatch(/^\d+px$/); // simple check format, exact pixel value may vary

    // Ensure no uncaught page errors happened during or after the click
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console.error messages that indicate runtime errors like ReferenceError/SyntaxError/TypeError
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);

    // Also ensure none of the console messages reference common JS error names
    const joinedConsoleText = consoleMessages.map((m) => m.text).join(' ');
    expect(joinedConsoleText).not.toContain('ReferenceError');
    expect(joinedConsoleText).not.toContain('SyntaxError');
    expect(joinedConsoleText).not.toContain('TypeError');
  });

  test('Edge case: clicking Start Animation multiple times is idempotent for target inline heights', async ({ page }) => {
    // Purpose: Ensure repeated triggering of the StartAnimation event keeps the application in S1_Animating
    // and consistently sets the same inline heights (no unexpected side-effects).

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Click once
    await vp.clickStart();
    await vp.waitForInlineHeights({ line1: '40%', line2: '70%', line3: '90%' }, 2000);
    let inlineHeights = await vp.getInlineHeights();
    expect(inlineHeights.line1).toBe('40%');

    // Click again and assert values remain the same (function simply re-applies same style values)
    await vp.clickStart();
    // Small wait to let handler run again (should be synchronous)
    await vp.page.waitForTimeout(100);
    inlineHeights = await vp.getInlineHeights();
    expect(inlineHeights.line1).toBe('40%');
    expect(inlineHeights.line2).toBe('70%');
    expect(inlineHeights.line3).toBe('90%');

    // Confirm no page errors occurred across repeated interactions
    expect(pageErrors.length).toBe(0);
    // And ensure no console error messages (observational)
    expect(consoleMessages.some((m) => m.type === 'error')).toBe(false);
  });

  test('Observability: ensure the event handler assignment evidence exists and is inspectable', async ({ page }) => {
    // Purpose: Explicitly validate the FSM evidence: document.getElementById("startAnimation").onclick = animateGraphs;
    // We check that the onclick property is a function named animateGraphs (when available) and is callable.

    const vp = new VisualizerPage(page);
    await vp.goto();

    const onclickInfo = await vp.getStartOnclickInfo();
    expect(onclickInfo.exists).toBe(true);
    expect(onclickInfo.hasHandler).toBe(true);
    expect(onclickInfo.type).toBe('function');

    // Try to assert the name if provided; otherwise at least ensure the function is defined
    if (onclickInfo.name) {
      expect(onclickInfo.name.toLowerCase()).toContain('animategraphs');
    }

    // Confirm calling the function indirectly via the click works (sanity check)
    await vp.clickStart();
    await vp.waitForInlineHeights({ line1: '40%', line2: '70%', line3: '90%' }, 2000);

    // Ensure no runtime errors were thrown as a result of calling the handler
    expect(pageErrors.length).toBe(0);
  });

  test('Error observation test: assert there are no SyntaxError/ReferenceError/TypeError messages emitted (observational)', async ({ page }) => {
    // Purpose: This test collects console and page errors and asserts that none of the canonical JS error
    // types (ReferenceError, SyntaxError, TypeError) were emitted during load and a normal interaction.
    // This treats the absence of such errors as expected behavior for this application.

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Interact once
    await vp.clickStart();
    await vp.waitForInlineHeights({ line1: '40%', line2: '70%', line3: '90%' }, 2000);

    // Gather textual console output
    const texts = consoleMessages.map((m) => m.text).join('\n');

    // Assert no page errors captured
    expect(pageErrors.length).toBe(0);

    // Assert that no console message contains 'ReferenceError', 'SyntaxError', or 'TypeError'
    expect(texts).not.toContain('ReferenceError');
    expect(texts).not.toContain('SyntaxError');
    expect(texts).not.toContain('TypeError');

    // Also assert there are no console.error entries
    expect(consoleMessages.filter((m) => m.type === 'error').length).toBe(0);
  });
});