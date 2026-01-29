import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8e3ee4-fa77-11f0-8492-31e949ed3c7c.html';

// Page object for the Time Complexity Visualization page
class ComplexityPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    // capture console messages and page errors for assertions
    this.page.on('console', msg => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // returns the button handle
  async getVisualizeButton() {
    return await this.page.$('#visualizeButton');
  }

  // returns the graph container handle
  async getGraphContainer() {
    return await this.page.$('#graph-container');
  }

  // clicks the visualize button and waits for bars to appear (or a short timeout)
  async clickVisualize() {
    const btn = await this.getVisualizeButton();
    if (!btn) throw new Error('Visualize button not found on page');
    await btn.click();
    // wait a little for DOM updates and transitions to take effect
    await this.page.waitForTimeout(300);
  }

  // returns array of bar information from the DOM:
  // [{ text, styleWidth, styleHeight, transform, transitionDelay }]
  async getBarsInfo() {
    return await this.page.$$eval('#graph-container .bar', bars =>
      bars.map(bar => ({
        text: bar.innerText || '',
        styleWidth: bar.style.width || '',
        styleHeight: bar.style.height || '',
        transform: bar.style.transform || '',
        transitionDelay: bar.style.transitionDelay || '',
        // include computed color to ensure styles applied
        color: window.getComputedStyle(bar).color,
      }))
    );
  }

  // helper to insert a dummy node into the container (edge-case preparation)
  async insertDummyNode() {
    await this.page.evaluate(() => {
      const container = document.getElementById('graph-container');
      const dummy = document.createElement('div');
      dummy.id = 'dummy-node';
      dummy.innerText = 'DUMMY';
      container.appendChild(dummy);
    });
  }

  // count console messages filtered by type (e.g., 'error')
  consoleCount(type) {
    return this.consoleMessages.filter(m => m.type === type).length;
  }
}

test.describe('Time Complexity Visualization - FSM and UI tests', () => {
  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {ComplexityPage} */
  let cp;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    cp = new ComplexityPage(page);
    await cp.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Idle state (S0_Idle): initial render shows visualize button and empty graph', async () => {
    // This test validates the initial (Idle) state of the application:
    // - the "Visualize Complexity" button exists and is visible
    // - the graph container exists and initially has no bars
    // - the expected onclick handler is registered on the button
    // - the FSM-declared entry action renderPage() is not forcibly present as a global function (we check its absence)
    const btn = await cp.getVisualizeButton();
    expect(btn).not.toBeNull();
    // ensure button has expected text
    const btnText = await btn.innerText();
    expect(btnText).toContain('Visualize Complexity');

    // graph container exists
    const container = await cp.getGraphContainer();
    expect(container).not.toBeNull();

    // container should have no .bar children initially
    const initialBars = await page.$$(`#graph-container .bar`);
    expect(initialBars.length).toBe(0);

    // the page's script assigns an onclick handler: verify that it's attached
    const onclickType = await page.evaluate(() => typeof document.getElementById('visualizeButton').onclick);
    expect(onclickType).toBe('function');

    // Verify that the FSM's mentioned entry function renderPage is NOT defined on window (since the HTML doesn't define it)
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    // We expect it to be 'undefined' because HTML does not define renderPage()
    expect(renderPageType).toBe('undefined');

    // Ensure no uncaught page errors happened during initial load
    expect(cp.pageErrors.length).toBe(0);
    // Also ensure no console.error messages were emitted during load
    expect(cp.consoleCount('error')).toBe(0);
  });

  test('Visualizing state (S1_Visualizing): clicking the button creates bars with expected properties', async () => {
    // This test validates the transition from Idle -> Visualizing:
    // - clicking the visualize button should create multiple bars inside the graph container
    // - each bar should have class "bar", correct innerText, style.width, style.height, transform and transitionDelay set
    // - the FSM-declared entry visualizeComplexity() is not a global function (we assert its absence)
    // - no runtime errors should occur during the click
    // Confirm visualizeComplexity() global absence
    const visualizeComplexityType = await page.evaluate(() => typeof window.visualizeComplexity);
    expect(visualizeComplexityType).toBe('undefined');

    // Click the visualize button
    await cp.clickVisualize();

    // Get bar info
    const bars = await cp.getBarsInfo();
    // The implementation defines 7 complexities, so we expect 7 bars
    expect(bars.length).toBe(7);

    // expected complexity names and heights from the page script
    const expected = [
      { name: 'O(1)', height: '40px' },
      { name: 'O(log n)', height: '70px' },
      { name: 'O(n)', height: '100px' },
      { name: 'O(n log n)', height: '150px' },
      { name: 'O(n^2)', height: '200px' },
      { name: 'O(2^n)', height: '300px' },
      { name: 'O(n!)', height: '350px' },
    ];

    // Validate each bar's textual label and style properties
    for (let i = 0; i < expected.length; i++) {
      const bar = bars[i];
      expect(bar.text).toContain(expected[i].name);

      // styleHeight exactly matches the px string set in script
      expect(bar.styleHeight).toBe(expected[i].height);

      // styleWidth was set as `${(index + 1) * 10}%` in the script
      const expectedWidth = `${(i + 1) * 10}%`;
      expect(bar.styleWidth).toBe(expectedWidth);

      // transform should have translateX set to `${10 * index}%`
      const expectedTranslate = `translateX(${10 * i}%)`;
      expect(bar.transform).toBe(expectedTranslate);

      // transitionDelay was added: `${index * 100}ms`
      const expectedDelay = `${i * 100}ms`;
      expect(bar.transitionDelay).toBe(expectedDelay);

      // color should be computed (text color set to #ecf0f1)
      // we check that the computed color is a non-empty string (browser-dependent format)
      expect(typeof bar.color).toBe('string');
      expect(bar.color.length).toBeGreaterThan(0);
    }

    // Ensure there were no uncaught errors during the click action
    expect(cp.pageErrors.length).toBe(0);
    expect(cp.consoleCount('error')).toBe(0);
  });

  test('Transition behavior: clicking twice clears previous bars and recreates them', async () => {
    // This test validates the transition behavior when the VisualizeClick event fires multiple times:
    // - the first click creates bars
    // - we insert a dummy node to simulate pre-existing content and verify that the click handler clears it
    // - the second click should remove the dummy node and re-create only the expected bars
    // - also ensure new DOM nodes are created (not the exact same node references)

    // Perform first click to create bars
    await cp.clickVisualize();
    let barsFirst = await page.$$(`#graph-container .bar`);
    expect(barsFirst.length).toBe(7);

    // Insert a dummy node to the graph container to simulate non-bar content existing prior to a click
    await cp.insertDummyNode();
    // Confirm dummy node present
    let dummyExists = await page.$('#dummy-node');
    expect(dummyExists).not.toBeNull();

    // Click again - the handler should set innerHTML = '' and then re-append bars
    await cp.clickVisualize();

    // After second click, dummy node should no longer exist
    dummyExists = await page.$('#dummy-node');
    expect(dummyExists).toBeNull();

    // Bars should exist again and count should still be 7
    const barsSecond = await page.$$(`#graph-container .bar`);
    expect(barsSecond.length).toBe(7);

    // Ensure that the nodes after second click are distinct DOM nodes (i.e., were recreated)
    // We compare the object ids by retrieving unique properties (like outerHTML) and ensure content consistent,
    // but node handles would be different references.
    const outerHTMLsFirst = await Promise.all(barsFirst.map(handle => handle.evaluate(node => node.outerHTML)));
    const outerHTMLsSecond = await Promise.all(barsSecond.map(handle => handle.evaluate(node => node.outerHTML)));
    // The HTML content for bars should be equal in structure, but the actual DOM nodes are new (handles are not the same)
    expect(outerHTMLsFirst.length).toBe(outerHTMLsSecond.length);
    for (let i = 0; i < outerHTMLsFirst.length; i++) {
      expect(outerHTMLsSecond[i]).toContain(expectedNameFromOuterHTML(outerHTMLsFirst[i]));
    }

    // Ensure no page errors occurred during the double-click sequence
    expect(cp.pageErrors.length).toBe(0);
    expect(cp.consoleCount('error')).toBe(0);
  });

  test('Edge case: attempting to click a non-existent selector throws an error we can observe', async () => {
    // This test purposefully attempts to click a selector that does not exist.
    // We assert that Playwright throws an error for clicking a non-existent element,
    // and that this does not create unexpected page-runtime errors.
    let threw = false;
    try {
      // This will cause Playwright to throw because selector does not match anything
      await page.click('#nonExistentButton', { timeout: 500 });
    } catch (err) {
      threw = true;
      // Expect the thrown error to be a Playwright error mentioning 'No node found' or 'waiting for selector' depending on version
      expect(err).toBeInstanceOf(Error);
      expect(String(err.message).length).toBeGreaterThan(0);
    }
    expect(threw).toBe(true);

    // Ensure that despite the test-level click failure, the page itself did not emit runtime errors
    expect(cp.pageErrors.length).toBe(0);
    expect(cp.consoleCount('error')).toBe(0);
  });

  test('Sanity: verify presence and structure of key components declared in FSM', async () => {
    // This test asserts that the components declared in the FSM (visualize button, graph container) are present,
    // and that the expected evidence strings (parts of implementation) are present in script-assigned properties.
    const btn = await cp.getVisualizeButton();
    const container = await cp.getGraphContainer();
    expect(btn).not.toBeNull();
    expect(container).not.toBeNull();

    // Check that the button's id matches the FSM selector evidence
    const buttonId = await btn.getAttribute('id');
    expect(buttonId).toBe('visualizeButton');

    // The graph container should have id 'graph-container' per FSM evidence
    const containerId = await container.getAttribute('id');
    expect(containerId).toBe('graph-container');

    // Check that the onclick assignment exists (evidence string: 'visualizeButton.onclick = () => {')
    const onclickType = await page.evaluate(() => typeof document.getElementById('visualizeButton').onclick);
    expect(onclickType).toBe('function');

    // Confirm no runtime page errors or console.error messages
    expect(cp.pageErrors.length).toBe(0);
    expect(cp.consoleCount('error')).toBe(0);
  });
});

/**
 * Helper to extract the expected name from a bar outerHTML string produced earlier.
 * This is used only to loosely compare that recreated bars contain expected names.
 * @param {string} outerHTML
 */
function expectedNameFromOuterHTML(outerHTML) {
  // outerHTML includes the innerText (e.g., <div class="bar" style="...">O(1)</div>)
  // Extract content between the tags quickly:
  const match = outerHTML.match(/>([^<]+)<\/div>$/);
  if (match && match[1]) return match[1];
  return '';
}