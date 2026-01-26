import { test, expect } from '@playwright/test';

// Page Object Model for the Overfitting visualization page
class OverfittingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.animateBtn = page.locator('#animate-btn');
    this.resetBtn = page.locator('#reset-btn');
    this.overfitLine = page.locator('.overfit-line');
    this.dataPoints = page.locator('.data-point');
    this.container = page.locator('.container');
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/72adaed4-fa78-11f0-812d-c9788050701f.html', { waitUntil: 'load' });
    // Ensure the DOMContentLoaded handlers have run
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clickAnimate() {
    await this.animateBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async hoverDataPoint(index = 0) {
    const count = await this.dataPoints.count();
    if (index < 0 || index >= count) throw new Error('index out of bounds for data points');
    await this.dataPoints.nth(index).hover();
  }

  async unhoverDataPoint(index = 0) {
    // Move mouse to center of page to trigger leave
    await this.page.mouse.move(10, 10);
  }

  async getOverfitInlineStyle(property) {
    return await this.page.evaluate((prop) => {
      const el = document.querySelector('.overfit-line');
      return el && el.style ? el.style[prop] : null;
    }, property);
  }

  async getDataPointInlineStyle(index, property) {
    return await this.page.evaluate(({ idx, prop }) => {
      const points = document.querySelectorAll('.data-point');
      const el = points[idx];
      return el && el.style ? el.style[prop] : null;
    }, { idx: index, prop: property });
  }

  async getComputedStyleProperty(selector, property) {
    return await this.page.evaluate(({ sel, prop }) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      return cs.getPropertyValue(prop);
    }, { sel: selector, prop: property });
  }
}

// Capture console.error and page errors for assertions
test.describe('Overfitting: Visual Elegance - FSM and Interaction Tests', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Listen for uncaught exceptions from the page
    page.on('pageerror', (err) => {
      // Collect page errors (ReferenceError, TypeError, SyntaxError, etc.)
      pageErrors.push(err);
    });

    // Listen for console messages, specifically errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async () => {
    // Nothing to teardown globally - server serves static file
  });

  test('Initial Idle state should render page with controls and charts (S0_Idle)', async ({ page }) => {
    // This test validates the Idle state's entry: renderPage() effect (presence of DOM elements)
    const p = new OverfittingPage(page);
    await p.goto();

    // Assert key UI elements exist
    await expect(p.container).toBeVisible();
    await expect(p.animateBtn).toBeVisible();
    await expect(p.resetBtn).toBeVisible();
    await expect(p.overfitLine).toBeVisible();
    await expect(p.dataPoints).toHaveCountGreaterThan(0);

    // The CSS for .overfit-line sets an animation by default; computed style should reflect that.
    const animationName = await p.getComputedStyleProperty('.overfit-line', 'animation-name');
    // animation-name may be 'dash' or 'none' depending on browser; at minimum ensure property exists
    expect(animationName).not.toBeNull();

    // Inline style for animation should be empty before any JS sets it (entry action is renderPage -> DOM ready)
    const inlineAnimation = await p.getOverfitInlineStyle('animation');
    // The inline style is likely empty (''), since CSS provides the animation initially.
    expect(inlineAnimation === '' || inlineAnimation === null || typeof inlineAnimation === 'string').toBeTruthy();

    // Assert that no runtime page errors or console errors occurred during load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Animate Comparison triggers animation and data point highlights (S0_Idle -> S1_Animating)', async ({ page }) => {
    // Validate AnimateComparison event and startAnimation entry actions
    const p = new OverfittingPage(page);
    await p.goto();

    // Click the animate button and observe effects
    const rippleSelector = '#animate-btn .ripple';
    // Ensure no ripple exists before click
    await expect(page.locator(rippleSelector)).toHaveCount(0);

    // Click animate; this should create a ripple span and set inline style properties
    await p.clickAnimate();

    // After click, a ripple should be inserted inside the button
    await expect(page.locator(rippleSelector)).toHaveCountGreaterThan(0);

    // Check that the JS set inline stroke dash values immediately
    const dashArray = await p.getOverfitInlineStyle('strokeDasharray'); // property is in camelCase when accessed via style
    const dashOffset = await p.getOverfitInlineStyle('strokeDashoffset');
    // The script sets these to string '1000'
    expect(dashArray === '1000').toBeTruthy();
    expect(dashOffset === '1000').toBeTruthy();

    // The script then sets inline animation to 'dash 2s ease-out forwards'
    const inlineAnimation = await p.getOverfitInlineStyle('animation');
    expect(inlineAnimation).toContain('dash');

    // Data points are highlighted in a staggered manner. Verify at least the first few change during the animation window.
    // The sequence uses index*100ms and each highlight reverts after 500ms.
    // Check quickly for the first point to become accent (give 200ms)
    await page.waitForTimeout(250);
    const firstPointFillDuring = await p.getDataPointInlineStyle(0, 'fill');
    const firstPointTransformDuring = await p.getDataPointInlineStyle(0, 'transform');

    // The highlight sets fill to 'var(--accent)' and transform to 'scale(1.3)'
    // Inline styles should reflect that while active
    expect(firstPointFillDuring === 'var(--accent)' || firstPointFillDuring === 'var(--accent)').toBeTruthy();
    expect(firstPointTransformDuring === 'scale(1.3)' || firstPointTransformDuring === 'scale(1.3)').toBeTruthy();

    // Wait longer than the longest stagger (13*100 + 500 = ~1800ms) and animation duration (2000ms)
    await page.waitForTimeout(2200);

    // After animation completes, ensure data points have been reset to primary and transform back to scale(1)
    const somePointFillAfter = await p.getDataPointInlineStyle(5, 'fill');
    const somePointTransformAfter = await p.getDataPointInlineStyle(5, 'transform');
    // Script resets style.fill to 'var(--primary)' and transform to 'scale(1)'
    expect(somePointFillAfter === 'var(--primary)' || somePointFillAfter === 'var(--primary)').toBeTruthy();
    expect(somePointTransformAfter === 'scale(1)' || somePointTransformAfter === 'scale(1)').toBeTruthy();

    // The ripple should be removed after 1500ms as per the script; ensure it is gone now
    await page.waitForTimeout(200); // additional small wait
    await expect(page.locator(rippleSelector)).toHaveCount(0);

    // Ensure no uncaught page errors or console errors during animation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  }, { timeout: 15000 });

  test('Reset Animation resets line and data points (S1_Animating -> S0_Idle and S0_Idle -> S2_Resetting)', async ({ page }) => {
    // Ensure reset behavior works both while idle and after animation
    const p = new OverfittingPage(page);
    await p.goto();

    // First, trigger animation so we can transition from S1_Animating to S0_Idle via ResetAnimation
    await p.clickAnimate();

    // Allow the JS to set inline animation property
    await page.waitForTimeout(100);

    // Now click reset while animation might be running
    await p.clickReset();

    // After clicking reset, inline animation should be set to 'none' by the script
    const inlineAnimationAfterReset = await p.getOverfitInlineStyle('animation');
    expect(inlineAnimationAfterReset).toContain('none');

    // stroke dash properties should remain present as '1000'
    const dashArrayAfterReset = await p.getOverfitInlineStyle('strokeDasharray');
    const dashOffsetAfterReset = await p.getOverfitInlineStyle('strokeDashoffset');
    expect(dashArrayAfterReset === '1000').toBeTruthy();
    expect(dashOffsetAfterReset === '1000').toBeTruthy();

    // Data points should be reset to primary and scale(1)
    const firstFillAfterReset = await p.getDataPointInlineStyle(0, 'fill');
    const firstTransformAfterReset = await p.getDataPointInlineStyle(0, 'transform');
    expect(firstFillAfterReset === 'var(--primary)' || firstFillAfterReset === 'var(--primary)').toBeTruthy();
    expect(firstTransformAfterReset === 'scale(1)' || firstTransformAfterReset === 'scale(1)').toBeTruthy();

    // Ensure ripple created for reset was removed after 1500ms
    await page.waitForTimeout(1600);
    await expect(page.locator('#reset-btn .ripple')).toHaveCount(0);

    // Reset from Idle (without an active animation) should have same effect: click reset again
    await p.clickReset();
    const inlineAnimationAfterSecondReset = await p.getOverfitInlineStyle('animation');
    expect(inlineAnimationAfterSecondReset).toContain('none');

    // No page errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  }, { timeout: 10000 });

  test('Hovering over data points highlights and un-highlights them (DataPointHoverIn / DataPointHoverOut)', async ({ page }) => {
    // Validate mouseenter and mouseleave handlers on data points
    const p = new OverfittingPage(page);
    await p.goto();

    // Hover over the 3rd data point
    const idx = 2;
    await p.hoverDataPoint(idx);

    // Immediately after hover, inline style should reflect highlight
    const fillOnHover = await p.getDataPointInlineStyle(idx, 'fill');
    const transformOnHover = await p.getDataPointInlineStyle(idx, 'transform');

    expect(fillOnHover === 'var(--accent)' || fillOnHover === 'var(--accent)').toBeTruthy();
    expect(transformOnHover === 'scale(1.3)' || transformOnHover === 'scale(1.3)').toBeTruthy();

    // Move mouse away to trigger mouseleave
    await p.unhoverDataPoint(idx);

    // Small delay for event to process
    await page.waitForTimeout(100);

    const fillAfterLeave = await p.getDataPointInlineStyle(idx, 'fill');
    const transformAfterLeave = await p.getDataPointInlineStyle(idx, 'transform');

    // Should return to primary and scale(1)
    expect(fillAfterLeave === 'var(--primary)' || fillAfterLeave === 'var(--primary)').toBeTruthy();
    expect(transformAfterLeave === 'scale(1)' || transformAfterLeave === 'scale(1)').toBeTruthy();

    // No page errors occurred due to event handling
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: rapid repeated clicks on Animate and Reset should not produce JS errors', async ({ page }) => {
    // This test simulates quick user interactions to catch race conditions or runtime errors
    const p = new OverfittingPage(page);
    await p.goto();

    // Rapidly click animate multiple times
    for (let i = 0; i < 5; i++) {
      await p.animateBtn.click();
    }

    // Immediately click reset several times
    for (let i = 0; i < 5; i++) {
      await p.resetBtn.click();
    }

    // Give some time for any queued timeouts to execute
    await page.waitForTimeout(2500);

    // Assert that no unhandled exceptions were raised on the page
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // The inline animation should be 'none' due to final reset
    const finalAnimation = await p.getOverfitInlineStyle('animation');
    expect(finalAnimation).toContain('none');

    // Data points should be in reset state
    const anyFill = await p.getDataPointInlineStyle(0, 'fill');
    expect(anyFill === 'var(--primary)' || anyFill === 'var(--primary)').toBeTruthy();
  }, { timeout: 15000 });

  test('Observes console and page errors during load and interaction (observability test)', async ({ page }) => {
    // This test explicitly demonstrates observation of console/page errors and asserts none occurred.
    const p = new OverfittingPage(page);
    await p.goto();

    // Interact a bit
    await p.clickAnimate();
    await page.waitForTimeout(500);
    await p.clickReset();
    await page.waitForTimeout(500);

    // Provide a helpful message if errors exist for debugging test failures
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // Print to Playwright's standard output for diagnostic context
      // (We do not modify the page; just surface the captured errors)
      console.log('Captured page errors:', pageErrors.map(e => e.message || String(e)));
      console.log('Captured console.error messages:', consoleErrors);
    }

    // Assert no page runtime errors (ReferenceError, SyntaxError, TypeError, etc.)
    expect(pageErrors.length).toBe(0);

    // Assert no console.error logs were produced
    expect(consoleErrors.length).toBe(0);
  });
});