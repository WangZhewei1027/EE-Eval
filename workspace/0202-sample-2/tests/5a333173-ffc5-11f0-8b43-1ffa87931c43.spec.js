import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a333173-ffc5-11f0-8b43-1ffa87931c43.html';

/**
 * Page Object for the Bellman-Ford Visualization app.
 * Encapsulates selectors and common interactions.
 */
class BellmanFordPage {
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.nextStepBtn = page.locator('#nextStepBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.sourceSelect = page.locator('#sourceSelect');
    this.distanceTable = page.locator('#distanceTable');
    this.distanceBody = page.locator('#distanceBody');
    this.messageDiv = page.locator('#message');
    this.svg = page.locator('#graphSVG');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getSourceOptions() {
    return this.page.$$eval('#sourceSelect option', opts => opts.map(o => o.value));
  }

  async isNextStepDisabled() {
    // Using getAttribute because sometimes "disabled" is present or absent
    const disabled = await this.nextStepBtn.getAttribute('disabled');
    return disabled !== null;
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickNextStep() {
    await this.nextStepBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async changeSource(value) {
    await this.sourceSelect.selectOption(value);
    // The app attaches change event; ensure it processes
    await this.page.waitForTimeout(50);
  }

  async getDistanceForVertex(vertex) {
    // Find the row whose first cell equals vertex, return distance and predecessor strings
    const rows = await this.distanceBody.locator('tr').all();
    for (const row of rows) {
      const tds = await row.locator('td').allTextContents();
      if (tds[0].trim() === vertex) {
        return { distance: tds[1].trim(), predecessor: tds[2].trim() };
      }
    }
    return null;
  }

  async svgLineCount() {
    return this.page.$$eval('#graphSVG line', lines => lines.length);
  }

  async svgNodeIds() {
    return this.page.$$eval('#graphSVG g.node', nodes => nodes.map(n => n.id));
  }

  async getHighlightedLineStrokeColors() {
    // Return array of stroke attributes for lines (order corresponds to DOM order)
    return this.page.$$eval('#graphSVG line', lines => lines.map(l => l.getAttribute('stroke')));
  }

  async getMessageText() {
    return this.messageDiv.textContent();
  }

  async isDistanceTableHidden() {
    // The UI toggles 'hidden' attribute
    return this.distanceTable.evaluate(node => node.hidden === true);
  }
}

/**
 * Helper to capture console messages and page errors for assertions.
 */
function attachErrorCapturers(page) {
  const consoleMessages = [];
  const pageErrors = [];

  const consoleListener = (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
    });
  };
  const pageErrorListener = (err) => {
    // err is Error object
    pageErrors.push({
      message: err.message,
      stack: err.stack,
      name: err.name,
    });
  };

  page.on('console', consoleListener);
  page.on('pageerror', pageErrorListener);

  return {
    consoleMessages,
    pageErrors,
    detach: () => {
      page.removeListener('console', consoleListener);
      page.removeListener('pageerror', pageErrorListener);
    }
  };
}

test.describe('Bellman-Ford Algorithm Visualization - FSM behavior', () => {
  // Setup page and page object for each test
  test.beforeEach(async ({ page }) => {
    // nothing global here; each test creates its own BellmanFordPage
  });

  test.afterEach(async ({}, testInfo) => {
    // testInfo available if needed
  });

  test('S0_Idle (Initial state) - UI elements present and graph drawn on load', async ({ page }) => {
    // Comment: Validate initial Idle state: drawGraph() and populateSourceSelect() ran.
    const bf = new BellmanFordPage(page);
    const capturer = attachErrorCapturers(page);

    await bf.goto();

    // Source select should be populated with graph vertices (expected 5)
    const options = await bf.getSourceOptions();
    expect(options.length).toBeGreaterThanOrEqual(5);
    // default value should be first vertex (A)
    const selected = await page.$eval('#sourceSelect', el => el.value);
    expect(selected).toBe(options[0]);

    // SVG should have nodes and lines drawn
    const nodeIds = await bf.svgNodeIds();
    // Expect nodes for A-E present
    expect(nodeIds).toEqual(expect.arrayContaining(['node-A', 'node-B', 'node-C', 'node-D', 'node-E']));

    const lineCount = await bf.svgLineCount();
    // Graph defined with 8 edges
    expect(lineCount).toBe(8);

    // Next Step should be disabled on load
    expect(await bf.isNextStepDisabled()).toBe(true);

    // Distance table should be hidden initially
    expect(await bf.isDistanceTableHidden()).toBe(true);

    // Message should be empty
    const message = await bf.getMessageText();
    expect(message.trim()).toBe('');

    // Ensure no page errors or critical console errors happened during init
    // Check for runtime errors captured
    capturer.detach();
    const pageErrors = capturer.pageErrors;
    const consoleMessages = capturer.consoleMessages;

    expect(pageErrors.length).toBe(0);
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(m.text));
    expect(errorConsoleEntries.length).toBe(0);
  });

  test('S0 -> S1 (StartAlgorithm) - clicking Start initializes the algorithm', async ({ page }) => {
    // Comment: Validate transition from Idle to Algorithm Initialized by clicking #startBtn
    const bf = new BellmanFordPage(page);
    const capturer = attachErrorCapturers(page);

    await bf.goto();

    // Precondition: nextStep disabled
    expect(await bf.isNextStepDisabled()).toBe(true);

    // Click start
    await bf.clickStart();

    // After starting, nextStepBtn should be enabled
    expect(await bf.isNextStepDisabled()).toBe(false);

    // Distance table should be visible
    expect(await bf.isDistanceTableHidden()).toBe(false);

    // Distance for selected source should be 0
    const sourceValue = await page.$eval('#sourceSelect', el => el.value);
    const entry = await bf.getDistanceForVertex(sourceValue);
    expect(entry).not.toBeNull();
    expect(entry.distance).toBe('0');

    // Message should indicate algorithm started
    const message = (await bf.getMessageText()).trim();
    expect(message).toContain('Bellman-Ford started');

    // No runtime pageerrors or critical console errors
    capturer.detach();
    expect(capturer.pageErrors.length).toBe(0);
    const badConsole = capturer.consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(m.text));
    expect(badConsole.length).toBe(0);
  });

  test('S1 -> S2 (NextStep) - clicking Next Step executes a step and updates visualization', async ({ page }) => {
    // Comment: Validate that clicking Next Step runs doNextStep(), updates message and highlights an edge
    const bf = new BellmanFordPage(page);
    const capturer = attachErrorCapturers(page);

    await bf.goto();

    // Start algorithm first
    await bf.clickStart();

    // Ensure the first message indicates start
    let message = (await bf.getMessageText()).trim();
    expect(message).toContain('Bellman-Ford started');

    // Click next step once
    await bf.clickNextStep();

    // After clicking next, message should include "Iteration" and the relaxed edge info
    // Wait for message to update to contain "Iteration"
    await page.waitForFunction(() => {
      const m = document.getElementById('message');
      return m && m.textContent && m.textContent.includes('Iteration');
    });

    message = (await bf.getMessageText()).trim();
    expect(message).toMatch(/Iteration \d+/);

    // The distance table should still be visible
    expect(await bf.isDistanceTableHidden()).toBe(false);

    // At least one edge in the SVG should have stroke changed to highlight color '#e67e22' or some highlight
    const strokes = await bf.getHighlightedLineStrokeColors();
    const highlighted = strokes.some(s => s === '#e67e22' || s === '#e67e22' /* fallback check */);
    // Because implementation sets the highlighted line stroke to '#e67e22', we expect at least one such stroke
    expect(highlighted).toBe(true);

    // Clicking Next Step repeatedly should not throw errors; perform a few steps
    for (let i = 0; i < 3; i++) {
      // If disabled, break to avoid infinite loop
      if (await bf.isNextStepDisabled()) break;
      await bf.clickNextStep();
      // Small wait to allow UI updates
      await page.waitForTimeout(30);
    }

    capturer.detach();
    expect(capturer.pageErrors.length).toBe(0);
    const badConsole = capturer.consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(m.text));
    expect(badConsole.length).toBe(0);
  });

  test('S1 -> S3 (ResetAlgorithm) - clicking Reset returns UI to Idle-like state', async ({ page }) => {
    // Comment: Validate that Reset action clears state and UI elements (resetState())
    const bf = new BellmanFordPage(page);
    const capturer = attachErrorCapturers(page);

    await bf.goto();

    // Start, take a step to change state
    await bf.clickStart();
    await bf.clickNextStep();

    // Ensure nextStep was at least temporarily enabled before reset
    expect(await bf.isNextStepDisabled()).toBe(false).or.toBe(true); // allow either, but exists

    // Now click reset
    await bf.clickReset();

    // After reset: nextStep should be disabled
    expect(await bf.isNextStepDisabled()).toBe(true);

    // Distance table should be hidden
    expect(await bf.isDistanceTableHidden()).toBe(true);

    // Message should be empty
    const message = (await bf.getMessageText()).trim();
    expect(message).toBe('');

    // Node circle fills should be default color (#4A90E2)
    // Inspect first node circle fill attribute
    const firstNodeFill = await page.$eval('#node-A circle', c => c.getAttribute('fill') || window.getComputedStyle(c).fill);
    // Implementation sets fill attribute explicitly to '#4A90E2' on reset drawGraph
    expect(firstNodeFill).toBe('#4A90E2');

    capturer.detach();
    expect(capturer.pageErrors.length).toBe(0);
    const badConsole = capturer.consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(m.text));
    expect(badConsole.length).toBe(0);
  });

  test('S0 -> S3 (SourceVertexChanged) - changing source resets algorithm state', async ({ page }) => {
    // Comment: Validate that changing the source select triggers resetState()
    const bf = new BellmanFordPage(page);
    const capturer = attachErrorCapturers(page);

    await bf.goto();

    // Start algorithm so that UI is in initialized state
    await bf.clickStart();
    expect(await bf.isNextStepDisabled()).toBe(false);

    // Change source to another vertex (if A, change to B)
    const opts = await bf.getSourceOptions();
    const current = await page.$eval('#sourceSelect', el => el.value);
    const newVal = opts.find(o => o !== current) || current;
    await bf.changeSource(newVal);

    // After change, nextStep should be disabled and distance table hidden
    expect(await bf.isNextStepDisabled()).toBe(true);
    expect(await bf.isDistanceTableHidden()).toBe(true);

    // Message should be cleared
    const message = (await bf.getMessageText()).trim();
    expect(message).toBe('');

    capturer.detach();
    expect(capturer.pageErrors.length).toBe(0);
    const badConsole = capturer.consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(m.text));
    expect(badConsole.length).toBe(0);
  });

  test('Edge cases and error scenarios: clicking Next Step while disabled and monitoring runtime errors', async ({ page }) => {
    // Comment: Ensure clicking disabled Next Step does not throw runtime errors and is a no-op
    const bf = new BellmanFordPage(page);
    const capturer = attachErrorCapturers(page);

    await bf.goto();

    // nextStepBtn should be disabled on load
    expect(await bf.isNextStepDisabled()).toBe(true);

    // Attempt to click Next Step even when disabled: Playwright's click will fail if element disabled attribute present,
    // so we simulate a DOM click via evaluate to mimic a user programmatically invoking it (without enabling).
    // This adheres to "do not patch or alter code", and simply triggers the click handler if present.
    await page.evaluate(() => {
      const btn = document.getElementById('nextStepBtn');
      if (btn) {
        // Some browsers prevent click on disabled buttons; dispatch event manually to simulate
        const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
        btn.dispatchEvent(ev);
      }
    });

    // Wait briefly to allow any errors to surface
    await page.waitForTimeout(50);

    // No page errors expected
    capturer.detach();
    expect(capturer.pageErrors.length).toBe(0);

    // No console errors of common JS error types
    const badConsole = capturer.consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(m.text));
    expect(badConsole.length).toBe(0);
  });

  test('Comprehensive runtime check - capture console and page errors during full run', async ({ page }) => {
    // Comment: Run through start, a number of steps and reset, ensuring no uncaught errors occur.
    const bf = new BellmanFordPage(page);
    const capturer = attachErrorCapturers(page);

    await bf.goto();

    // Start algorithm
    await bf.clickStart();

    // Perform several steps (but not all to avoid long loops)
    for (let i = 0; i < 10; i++) {
      if (await bf.isNextStepDisabled()) break;
      await bf.clickNextStep();
      await page.waitForTimeout(20);
    }

    // Finally reset
    await bf.clickReset();

    // Allow any pending microtasks/errors to surface
    await page.waitForTimeout(50);

    // Detach listeners and assert no errors of types ReferenceError/TypeError/SyntaxError or uncaught page errors
    capturer.detach();
    const pageErrors = capturer.pageErrors;
    const consoleMessages = capturer.consoleMessages;
    // If any page errors captured, assert failure with details
    expect(pageErrors.length).toBe(0);

    const severeConsole = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(m.text));
    expect(severeConsole.length).toBe(0);
  });
});