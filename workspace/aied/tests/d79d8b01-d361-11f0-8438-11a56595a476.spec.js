import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79d8b01-d361-11f0-8438-11a56595a476.html';

// Page Object for the Topological Sort demo page
class TopoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      graphInput: '#graphInput',
      runBtn: '#runBtn',
      errorMsg: '#errorMsg',
      result: '#result',
      graphViz: '#graphViz',
      svgCanvas: '#svgCanvas',
      svgNodes: '#svgCanvas .node'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  async fillInput(text) {
    await this.page.fill(this.selectors.graphInput, text);
  }

  async clickRun() {
    await Promise.all([
      this.page.waitForTimeout(10), // allow event handler to run; operations are synchronous but dom updates async
      this.page.click(this.selectors.runBtn)
    ]);
  }

  async getErrorText() {
    return (await this.page.locator(this.selectors.errorMsg).textContent()) || '';
  }

  async getResultText() {
    return (await this.page.locator(this.selectors.result).textContent()) || '';
  }

  async getResultHTML() {
    return (await this.page.locator(this.selectors.result).innerHTML()) || '';
  }

  async graphVizInnerHTML() {
    return (await this.page.locator(this.selectors.graphViz).innerHTML()) || '';
  }

  async svgExists() {
    return await this.page.locator(this.selectors.svgCanvas).count() > 0;
  }

  async countSvgNodes() {
    return await this.page.locator(this.selectors.svgNodes).count();
  }

  async getPlaceholder() {
    return await this.page.locator(this.selectors.graphInput).getAttribute('placeholder');
  }
}

test.describe('Topological Sort Demonstration - FSM states and transitions', () => {

  // Track any uncaught page errors and console messages for each test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // Store the error object/message for assertions
      pageErrors.push(err);
    });

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
  });

  test.afterEach(async ({ page }) => {
    // A small sanity check to ensure there are no unexpected uncaught errors in the page
    // Tests that intentionally produce handled errors will assert pageErrors is empty because the app catches them.
    // If any uncaught errors appeared in the page runtime, fail the test here explicitly.
    expect(pageErrors.length).toBe(0);
    // Also check there are no console messages of type 'error'
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
    // Close page to ensure a clean slate between tests (Playwright will usually do this, but explicit is fine)
    await page.close();
  });

  test.describe('S0_Idle (Initial State) - Page rendering and initial DOM', () => {
    test('renders input textarea and Run button on load (Idle state entry actions)', async ({ page }) => {
      const topo = new TopoPage(page);

      // Validate presence of main components
      await expect(page.locator(topo.selectors.graphInput)).toBeVisible();
      await expect(page.locator(topo.selectors.runBtn)).toBeVisible();

      // Validate placeholder text contains the example input snippet
      const placeholder = await topo.getPlaceholder();
      expect(placeholder).toContain('Example input');

      // On idle there should be no error or result displayed and graphViz should be empty
      const errorText = await topo.getErrorText();
      const resultText = await topo.getResultText();
      const viz = await topo.graphVizInnerHTML();

      expect(errorText.trim()).toBe('');
      expect(resultText.trim()).toBe('');
      expect(viz.trim()).toBe('');
    });
  });

  test.describe('S0_Idle -> S1_Error transitions (invalid or empty input)', () => {
    test('clicking Run with empty input displays "Input graph is empty." (handled error)', async ({ page }) => {
      const topo = new TopoPage(page);

      // Ensure textarea is empty
      await topo.fillInput('');
      await topo.clickRun();

      // Error message should be displayed in the error div (caught and shown)
      const errorText = await topo.getErrorText();
      expect(errorText).toBe('Input graph is empty.');

      // Graph visualization should be cleared
      const viz = await topo.graphVizInnerHTML();
      expect(viz.trim()).toBe('');
    });

    test('clicking Run with malformed line shows format error and no uncaught page errors', async ({ page }) => {
      const topo = new TopoPage(page);

      // Malformed line (no arrow)
      await topo.fillInput('BadLine');
      await topo.clickRun();

      const errorText = await topo.getErrorText();
      expect(errorText).toBe('Invalid line format: "BadLine"');

      // Ensure no svg created
      const exists = await topo.svgExists();
      expect(exists).toBe(false);
    });

    test('clicking Run with an empty node in a line shows "Empty node found..."', async ({ page }) => {
      const topo = new TopoPage(page);

      // Line with empty target
      await topo.fillInput('A -> ');
      await topo.clickRun();

      const errorText = await topo.getErrorText();
      expect(errorText).toContain('Empty node found');

      // Ensure graphViz cleared
      const viz = await topo.graphVizInnerHTML();
      expect(viz.trim()).toBe('');
    });

    test('detects cycle and displays cycle error message', async ({ page }) => {
      const topo = new TopoPage(page);

      // A simple 2-node cycle
      await topo.fillInput('A -> B\nB -> A');
      await topo.clickRun();

      const errorText = await topo.getErrorText();
      expect(errorText).toBe('Graph has at least one cycle; topological sort not possible.');

      // Ensure no svg
      const exists = await topo.svgExists();
      expect(exists).toBe(false);
    });
  });

  test.describe('S0_Idle -> S2_Result transition (valid input leads to result and visualization)', () => {
    test('valid sample input displays topological order and visualizes graph', async ({ page }) => {
      const topo = new TopoPage(page);

      // Use the example input from the FSM / placeholder
      const sample = `A -> C
B -> C
C -> D
D -> E`;

      await topo.fillInput(sample);
      await topo.clickRun();

      // Result div should include the "Topological Order:" and the expected order
      const resultHTML = await topo.getResultHTML();
      expect(resultHTML).toContain('Topological Order:');
      // Deterministic expected order for this input is A → B → C → D → E
      expect(resultHTML).toContain('A → B → C → D → E');

      // Visualization: svg canvas should exist and contain node groups
      const exists = await topo.svgExists();
      expect(exists).toBe(true);

      // Expect five node elements corresponding to A,B,C,D,E
      const nodeCount = await topo.countSvgNodes();
      expect(nodeCount).toBe(5);

      // Basic check: each node label should appear in the svg text content
      const svgContent = await page.locator('#svgCanvas').innerText();
      expect(svgContent).toContain('A');
      expect(svgContent).toContain('B');
      expect(svgContent).toContain('C');
      expect(svgContent).toContain('D');
      expect(svgContent).toContain('E');
    });

    test('visualization layout handles nodes with varied spacing and still draws expected nodes', async ({ page }) => {
      const topo = new TopoPage(page);

      // Reordered input with additional whitespace and blank lines
      const sample = `
  B   ->   C

A->C
C ->   D

D -> E
`;

      await topo.fillInput(sample);
      await topo.clickRun();

      // Should still produce a valid topological order (A and B before C)
      const resultHTML = await topo.getResultHTML();
      expect(resultHTML).toContain('Topological Order:');
      // Order should still be A → B → C → D → E (A before B or B before A is possible depending on parsing order,
      // but given parse & build behavior, earlier edge insertion leads to A then B; to be robust check presence)
      expect(resultHTML).toMatch(/A.*C.*D.*E|B.*C.*D.*E/);

      // Ensure svg exists and node count is 5
      expect(await topo.svgExists()).toBe(true);
      expect(await topo.countSvgNodes()).toBe(5);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('large number of simple chain edges produces correct order and no uncaught errors', async ({ page }) => {
      const topo = new TopoPage(page);

      // Construct a chain A -> B -> C -> ... -> J
      const nodes = 'ABCDEFGHIJ'.split('');
      const lines = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        lines.push(`${nodes[i]} -> ${nodes[i + 1]}`);
      }
      const input = lines.join('\n');

      await topo.fillInput(input);
      await topo.clickRun();

      // Expect topological order is the same chain
      const resultHTML = await topo.getResultHTML();
      // Build expected string "A → B → C ..."
      const expectedOrder = nodes.join(' → ');
      expect(resultHTML).toContain(expectedOrder);

      // Check svg has nodes length equal to nodes count
      expect(await topo.countSvgNodes()).toBe(nodes.length);
    });
  });

  test.describe('Monitoring console and runtime errors for all interactions', () => {
    test('no uncaught runtime errors appear during normal and error-handling flows', async ({ page }) => {
      const topo = new TopoPage(page);

      // Sequence of interactions: valid, invalid, empty, cycle
      await topo.fillInput(`A -> C
B -> C
C -> D`);
      await topo.clickRun();

      await topo.fillInput('BadLine');
      await topo.clickRun();

      await topo.fillInput('');
      await topo.clickRun();

      await topo.fillInput('X -> Y\nY -> X');
      await topo.clickRun();

      // At this point, the afterEach hook will assert there were no pageErrors and no console errors.
      // Additionally we assert that consoleMessages don't contain uncaught exception traces
      const errorConsoles = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoles.length).toBe(0);
    });
  });

});