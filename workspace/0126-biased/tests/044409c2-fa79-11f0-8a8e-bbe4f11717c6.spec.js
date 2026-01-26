import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/044409c2-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object for the Graph page, capturing console logs and page errors for assertions
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages emitted by the page
    this.page.on('console', msg => {
      // Normalize text for easier assertions
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Collect runtime errors (unhandled exceptions) on the page
    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
  }

  // Click the graph element
  async clickGraph() {
    await this.page.click('.graph');
  }

  // Dispatch a wheel event on the graph element
  // deltaY can be positive or negative; default to 100 to simulate a scroll
  async wheelGraph(deltaY = 100, deltaX = 0) {
    await this.page.dispatchEvent('.graph', 'wheel', {
      deltaY,
      deltaX,
      bubbles: true,
      cancelable: true
    });
  }

  // Retrieve current collected console messages
  getConsoleTexts() {
    return this.consoleMessages.map(m => m.text);
  }

  // Retrieve current page errors messages
  getPageErrorMessages() {
    return this.pageErrors.map(e => (e && e.message) || String(e));
  }

  // Get bounding box / computed style info of the graph element
  async getGraphDimensions() {
    const box = await this.page.$eval('.graph', el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        width: rect.width,
        height: rect.height,
        styleWidth: style.width,
        styleHeight: style.height,
        borderRadius: style.borderRadius,
        borderStyle: style.borderStyle
      };
    });
    return box;
  }
}

test.describe('TCP/IP Graph Interactions - FSM S0_Idle', () => {
  let graphPage;

  // Load page and create page object before each test
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });
    graphPage = new GraphPage(page);
  });

  // Basic state validation: Idle state rendering and initial conditions
  test('Idle state: graph is rendered and visible with expected dimensions', async ({ page }) => {
    // Validate the graph element exists in the DOM
    const graphHandle = await page.$('.graph');
    expect(graphHandle).not.toBeNull();

    // Validate the computed dimensions match the inline style (800x400)
    const dims = await graphPage.getGraphDimensions();
    // rect widths are numbers; style width/height are strings like "800px"
    expect(Math.round(dims.width)).toBeGreaterThanOrEqual(790); // allow tiny rounding
    expect(Math.round(dims.height)).toBeGreaterThanOrEqual(390);
    expect(dims.styleWidth).toContain('800');
    expect(dims.styleHeight).toContain('400');

    // There should be no console logs immediately on load from the app's interactive handlers
    const messages = graphPage.getConsoleTexts();
    expect(messages.length).toBe(0);

    // There should be no runtime errors on page load for this implementation
    const errors = graphPage.getPageErrorMessages();
    expect(errors).toEqual([]);

    // Verify the FSM's declared entry action renderPage() is not present in the global scope.
    // The implementation does not define renderPage(); assert that it is undefined.
    const renderPageType = await page.evaluate(() => typeof renderPage);
    expect(renderPageType).toBe('undefined');
  });

  // Validate click event and transition behavior
  test('GraphClick event: clicking the graph logs "Graph clicked!"', async ({ page }) => {
    // Wait for the specific console message that should be emitted by click handler
    const [consoleMsg] = await Promise.all([
      page.waitForEvent('console', msg => msg.text() === 'Graph clicked!'),
      graphPage.clickGraph()
    ]);

    expect(consoleMsg).toBeDefined();
    expect(consoleMsg.text()).toBe('Graph clicked!');

    // Ensure our collected console messages reflect that
    const messages = graphPage.getConsoleTexts();
    expect(messages).toContain('Graph clicked!');

    // No runtime errors should have occurred
    expect(graphPage.getPageErrorMessages()).toEqual([]);
  });

  // Validate wheel (scroll) event and transition behavior
  test('GraphScroll event: wheel on the graph logs "Graph wheel scrolled!"', async ({ page }) => {
    // Use dispatchEvent to simulate a wheel event; wait for console log
    const [consoleMsg] = await Promise.all([
      page.waitForEvent('console', msg => msg.text() === 'Graph wheel scrolled!'),
      graphPage.wheelGraph(120) // typical scroll delta
    ]);

    expect(consoleMsg).toBeDefined();
    expect(consoleMsg.text()).toBe('Graph wheel scrolled!');

    // Confirm collected console messages
    const messages = graphPage.getConsoleTexts();
    expect(messages).toContain('Graph wheel scrolled!');

    // No runtime errors should have been captured
    expect(graphPage.getPageErrorMessages()).toEqual([]);
  });

  // Validate repeated interactions and counting of console logs for transitions that loop back to same Idle state
  test('Repeated interactions: multiple clicks and wheel events produce multiple logs', async ({ page }) => {
    // Click 3 times, wheel twice, and collect console outputs
    const clickPromises = [];
    for (let i = 0; i < 3; i++) {
      clickPromises.push(graphPage.clickGraph());
    }
    // Dispatch clicks sequentially to ensure handlers run
    for (const p of clickPromises) {
      await p;
    }

    // Dispatch two wheel events
    await graphPage.wheelGraph(100);
    await graphPage.wheelGraph(-50);

    // Small delay to ensure all console events are captured
    await page.waitForTimeout(100);

    const messages = graphPage.getConsoleTexts();
    const clickedCount = messages.filter(t => t === 'Graph clicked!').length;
    const wheelCount = messages.filter(t => t === 'Graph wheel scrolled!').length;

    expect(clickedCount).toBe(3);
    // Two wheel events produced two logs
    expect(wheelCount).toBe(2);

    // No runtime errors expected
    expect(graphPage.getPageErrorMessages()).toEqual([]);
  });

  // Edge case: clicking outside graph must not trigger graph's click handler
  test('Click outside graph does not trigger Graph clicked! log', async ({ page }) => {
    // Count messages before clicking outside
    const before = graphPage.getConsoleTexts().length;

    // Click near top-left where the header is present (outside the graph)
    // Use absolute coordinates: choose 10,10 which is in header area
    await page.mouse.click(10, 10);

    // Wait a short moment to allow any stray handlers to run
    await page.waitForTimeout(100);

    const afterMessages = graphPage.getConsoleTexts();
    // There should be no new "Graph clicked!" message as the click was outside .graph
    const newGraphClickedMessages = afterMessages.slice(before).filter(t => t === 'Graph clicked!');
    expect(newGraphClickedMessages.length).toBe(0);

    // No runtime errors occurred
    expect(graphPage.getPageErrorMessages()).toEqual([]);
  });

  // Edge case: wheel event with zero delta values still triggers the handler in this implementation
  test('Wheel event with zero deltas still triggers Graph wheel scrolled!', async ({ page }) => {
    // Dispatch a wheel event with zero deltas
    const [consoleMsg] = await Promise.all([
      page.waitForEvent('console', msg => msg.text() === 'Graph wheel scrolled!'),
      graphPage.wheelGraph(0)
    ]);

    expect(consoleMsg).toBeDefined();
    expect(consoleMsg.text()).toBe('Graph wheel scrolled!');

    // Check that the console messages captured include the wheel message
    const messages = graphPage.getConsoleTexts();
    expect(messages).toContain('Graph wheel scrolled!');

    // No runtime errors expected
    expect(graphPage.getPageErrorMessages()).toEqual([]);
  });

  // Verify there are no unexpected runtime errors when interacting with the page (explicit check)
  test('No unexpected runtime errors occur during interactions', async ({ page }) => {
    // Perform a sequence of interactions
    await graphPage.clickGraph();
    await graphPage.wheelGraph(80);
    await graphPage.clickGraph();

    // Allow events to flush and handlers to run
    await page.waitForTimeout(100);

    // Ensure no page errors were recorded by Playwright's pageerror listener
    const errors = graphPage.getPageErrorMessages();
    expect(errors).toEqual([]);
  });
});