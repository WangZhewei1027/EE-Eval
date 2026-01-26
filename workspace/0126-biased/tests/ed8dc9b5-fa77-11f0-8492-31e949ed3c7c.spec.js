import { test, expect } from '@playwright/test';

// Test file: ed8dc9b5-fa77-11f0-8492-31e949ed3c7c.spec.js
// URL under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/ed8dc9b5-fa77-11f0-8492-31e949ed3c7c.html

// Helper page object for interacting with the visualization page.
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.svg = page.locator('#graph');
  }

  // Click the start button to trigger visualization
  async clickStart() {
    await this.startBtn.click();
  }

  // Return counts of <line> and <circle> elements inside the SVG
  async getSvgElementCounts() {
    const lineCount = await this.page.evaluate(() => {
      const svg = document.getElementById('graph');
      return svg ? svg.querySelectorAll('line').length : 0;
    });
    const circleCount = await this.page.evaluate(() => {
      const svg = document.getElementById('graph');
      return svg ? svg.querySelectorAll('circle').length : 0;
    });
    return { lineCount, circleCount };
  }

  // Return raw innerHTML of svg (used to check immediate clearing)
  async getSvgInnerHTML() {
    return await this.page.evaluate(() => {
      const svg = document.getElementById('graph');
      return svg ? svg.innerHTML : '';
    });
  }

  // Wait until the svg has at least expectedLines and expectedCircles or timeouts
  async waitForElements(expectedLines, expectedCircles, timeout = 7000) {
    const start = Date.now();
    while ((Date.now() - start) < timeout) {
      const counts = await this.getSvgElementCounts();
      if (counts.lineCount >= expectedLines && counts.circleCount >= expectedCircles) {
        return counts;
      }
      await this.page.waitForTimeout(50);
    }
    return await this.getSvgElementCounts();
  }

  // Inspect attributes of the first line and circle (if present)
  async getFirstLineAttributes() {
    return await this.page.evaluate(() => {
      const svg = document.getElementById('graph');
      const line = svg ? svg.querySelector('line') : null;
      if (!line) return null;
      return {
        stroke: line.getAttribute('stroke'),
        strokeWidth: line.getAttribute('stroke-width'),
        x1: line.getAttribute('x1'),
        x2: line.getAttribute('x2'),
      };
    });
  }

  async getFirstCircleAttributes() {
    return await this.page.evaluate(() => {
      const svg = document.getElementById('graph');
      const circle = svg ? svg.querySelector('circle') : null;
      if (!circle) return null;
      return {
        r: circle.getAttribute('r'),
        fill: circle.getAttribute('fill'),
        cx: circle.getAttribute('cx'),
      };
    });
  }
}

test.describe('Kruskal\'s Algorithm Visualization - FSM based tests', () => {
  // Collect page errors and console messages for assertions / diagnostics
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught exceptions (pageerror)
    page.on('pageerror', (err) => {
      // store the Error object for later assertions
      pageErrors.push(err);
    });

    // Collect console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the provided static HTML page
    await page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/ed8dc9b5-fa77-11f0-8492-31e949ed3c7c.html', { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Nothing special to teardown per test beyond Playwright's default cleanup.
    // We intentionally do not modify or patch the page's runtime.
  });

  test('Idle state: initial render shows Start button and an empty SVG graph', async ({ page }) => {
    // This test validates the FSM initial state S0_Idle: renderPage() implied
    // - The Start button is present with correct text and class
    // - The SVG graph is present and initially empty (no child elements)

    const kruskal = new KruskalPage(page);

    // Assert Start button visibility and text
    await expect(kruskal.startBtn).toBeVisible();
    await expect(kruskal.startBtn).toHaveText('Start Visualization');
    // Assert button has class 'button'
    const btnClass = await page.locator('#startBtn').getAttribute('class');
    expect(btnClass).toContain('button');

    // Assert svg exists
    await expect(kruskal.svg).toBeVisible();

    // SVG should be empty initially
    const innerHTML = await kruskal.getSvgInnerHTML();
    expect(innerHTML.trim()).toBe('');

    // Ensure no runtime page errors of critical types occurred so far in this test
    // We assert that no ReferenceError/SyntaxError/TypeError were thrown by the page during load.
    const criticalErrors = pageErrors.filter(e => /ReferenceError|SyntaxError|TypeError/.test(e && e.message));
    expect(criticalErrors.length, `Expected no critical runtime errors on initial load but found: ${criticalErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  test('Visualizing state: clicking Start triggers visualizeKruskal and draws edges over time', async ({ page }) => {
    // This test validates FSM transition S0_Idle -> S1_Visualizing via StartVisualization event
    // It verifies that visualizeKruskal() runs (entry action) and edges & circles are added to the SVG with expected attributes.
    const kruskal = new KruskalPage(page);

    // Ensure initially empty
    const initialCounts = await kruskal.getSvgElementCounts();
    expect(initialCounts.lineCount).toBe(0);
    expect(initialCounts.circleCount).toBe(0);

    // Click Start to begin visualization
    await kruskal.clickStart();

    // The implementation schedules the first edge at 0ms, subsequent every 800ms.
    // We expect at least one line+circle almost immediately.
    await page.waitForTimeout(100); // small pause to let immediate additions happen
    const afterFirst = await kruskal.getSvgElementCounts();
    expect(afterFirst.lineCount).toBeGreaterThanOrEqual(1);
    expect(afterFirst.circleCount).toBeGreaterThanOrEqual(1);

    // Now wait for the full animation to complete:
    // There are 6 edges; timeouts set at 0, 800, 1600, 2400, 3200, 4000 ms.
    // Wait a bit past the last delay to ensure all have been drawn.
    await page.waitForTimeout(4500);

    const finalCounts = await kruskal.getSvgElementCounts();
    expect(finalCounts.lineCount).toBe(6);
    expect(finalCounts.circleCount).toBe(6);

    // Verify attributes of the first drawn elements conform to the implementation:
    const firstLineAttrs = await kruskal.getFirstLineAttributes();
    expect(firstLineAttrs).not.toBeNull();
    expect(firstLineAttrs.stroke).toBe('#34495e');
    expect(firstLineAttrs.strokeWidth).toBe('4');

    const firstCircleAttrs = await kruskal.getFirstCircleAttributes();
    expect(firstCircleAttrs).not.toBeNull();
    expect(firstCircleAttrs.r).toBe('5');
    // Note: color strings in HTML may differ in case; compare in a case-insensitive way
    expect(firstCircleAttrs.fill.toLowerCase()).toBe('#e74c3c');

    // Ensure no critical runtime page errors occurred during this interaction
    const criticalErrors = pageErrors.filter(e => /ReferenceError|SyntaxError|TypeError/.test(e && e.message));
    expect(criticalErrors.length, `Expected no critical runtime errors during visualization but found: ${criticalErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  test('Restarting visualization clears the SVG immediately and replays the animation', async ({ page }) => {
    // This test exercises an edge case: invoking the Start button after a visualization completes.
    // It asserts that on re-entry the svg is cleared synchronously (svg.innerHTML = '') as implemented
    // and that the animation can run again to completion.

    const kruskal = new KruskalPage(page);

    // Start visualization and wait until it fully completes
    await kruskal.clickStart();
    await page.waitForTimeout(4500); // allow the 6 edges to be drawn
    let counts = await kruskal.getSvgElementCounts();
    expect(counts.lineCount).toBe(6);
    expect(counts.circleCount).toBe(6);

    // Click Start again; visualizeKruskal() calls svg.innerHTML = '' synchronously at start
    await kruskal.clickStart();

    // Immediately after clicking, the svg should be cleared (no child elements)
    const innerAfterImmediateClick = await kruskal.getSvgInnerHTML();
    expect(innerAfterImmediateClick.trim(), 'SVG should be cleared immediately when restarting visualization').toBe('');

    // Allow the second run to finish
    await page.waitForTimeout(4500);
    counts = await kruskal.getSvgElementCounts();
    expect(counts.lineCount).toBe(6);
    expect(counts.circleCount).toBe(6);

    // Verify that the second run did not produce unexpected additional element types
    // (i.e., only lines and circles are present)
    const rawInner = await kruskal.getSvgInnerHTML();
    // quick check: no <rect> or other unexpected tags in the innerHTML
    expect(/<rect|<g|<path/.test(rawInner)).toBe(false);

    // Assert absence of critical page errors during the restart scenario
    const criticalErrors = pageErrors.filter(e => /ReferenceError|SyntaxError|TypeError/.test(e && e.message));
    expect(criticalErrors.length, `Expected no critical runtime errors during restart but found: ${criticalErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  test('Observes console messages and ensures no uncaught critical JS errors occurred during the test session', async ({ page }) => {
    // This test demonstrates observation of console logs and page errors.
    // We do not modify the page; we only assert whether critical runtime errors occurred naturally.

    // As a basic interaction, invoke the visualization once to generate console/JS activity if any.
    const kruskal = new KruskalPage(page);
    await kruskal.clickStart();
    // Wait for full animation
    await page.waitForTimeout(4500);

    // Inspect collected console messages (if any) - useful for debugging
    // Make sure there are console messages captured (not required, but they might be empty)
    // We'll assert that none of the captured pageerror events indicate ReferenceError/SyntaxError/TypeError.

    // Convert captured pageErrors to message strings for assertion diagnostics
    const errorMessages = pageErrors.map(e => (e && e.message) || String(e));

    // Fail the test if any runtime critical errors occurred
    const foundCritical = errorMessages.filter(m => /ReferenceError|SyntaxError|TypeError/.test(m));
    expect(foundCritical.length, `No critical runtime errors should occur. Found: ${foundCritical.join('; ')}`).toBe(0);

    // Additionally, assert that the console did not contain obvious "Uncaught" error messages
    const consoleErrors = consoleMessages.filter(c => c.type === 'error' || /uncaught/i.test(c.text));
    expect(consoleErrors.length, `Expected no console errors, found: ${consoleErrors.map(c => c.text).join(' | ')}`).toBe(0);
  });

});