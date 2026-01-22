import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b0034c2-d5c3-11f0-b41f-b131cbd11f51.html';

class GraphPage {
  /**
   * Page object for adjacency list visualization app.
   * Encapsulates selectors and common interactions.
   */
  constructor(page) {
    this.page = page;
    this.textarea = page.locator('#graphInput');
    this.visualizeButton = page.locator('button[onclick="visualizeGraph()"]');
    this.clearButton = page.locator('button[onclick="clearGraph()"]');
    this.loadExampleButton = page.locator('button[onclick="loadExample()"]');
    this.svg = page.locator('#graphSVG');
    this.adjacencyTable = page.locator('#adjacencyTable');
    this.errorDiv = page.locator('#error');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickVisualize() {
    await this.visualizeButton.click();
    // Wait until either svg has children or an error message appears
    await Promise.race([
      this.page.waitForFunction(() => {
        const svg = document.getElementById('graphSVG');
        return svg && svg.children.length > 0;
      }, { timeout: 2000 }).catch(() => {}),
      this.page.waitForFunction(() => {
        const err = document.getElementById('error');
        return err && err.textContent.trim().length > 0;
      }, { timeout: 2000 }).catch(() => {})
    ]);
  }

  async clickClear() {
    await this.clearButton.click();
    // Wait for DOM to be cleared
    await this.page.waitForFunction(() => {
      const svg = document.getElementById('graphSVG');
      const table = document.getElementById('adjacencyTable');
      const input = document.getElementById('graphInput');
      const err = document.getElementById('error');
      return svg && svg.children.length === 0 &&
             table && table.children.length === 0 &&
             input && input.value === '' &&
             err && err.textContent.trim() === '';
    }, { timeout: 2000 });
  }

  async clickLoadExample() {
    await this.loadExampleButton.click();
    // loadExample calls visualizeGraph internally, so wait for visualization
    await this.page.waitForFunction(() => {
      const svg = document.getElementById('graphSVG');
      return svg && svg.children.length > 0;
    }, { timeout: 2000 });
  }

  async getSvgChildCount() {
    return await this.page.evaluate(() => {
      const svg = document.getElementById('graphSVG');
      return svg ? svg.children.length : 0;
    });
  }

  async getNodeGroupCount() {
    // Node groups are <g> elements appended for nodes
    return await this.page.evaluate(() => {
      const svg = document.getElementById('graphSVG');
      if (!svg) return 0;
      return Array.from(svg.children).filter(n => n.nodeName.toLowerCase() === 'g').length;
    });
  }

  async getEdgeCount() {
    return await this.page.evaluate(() => {
      const svg = document.getElementById('graphSVG');
      if (!svg) return 0;
      return Array.from(svg.querySelectorAll('.edge')).length;
    });
  }

  async getEdgeLabelCount() {
    return await this.page.evaluate(() => {
      const svg = document.getElementById('graphSVG');
      if (!svg) return 0;
      return Array.from(svg.querySelectorAll('.edge-label')).length;
    });
  }

  async getAdjacencyTableHTML() {
    return await this.page.evaluate(() => {
      const table = document.getElementById('adjacencyTable');
      return table ? table.innerHTML : '';
    });
  }

  async getInputValue() {
    return await this.page.evaluate(() => {
      const input = document.getElementById('graphInput');
      return input ? input.value : '';
    });
  }

  async getErrorText() {
    return await this.page.evaluate(() => {
      const err = document.getElementById('error');
      return err ? err.textContent.trim() : '';
    });
  }
}

test.describe('Adjacency List Visualization - FSM states and transitions', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for observation/assertions
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      const entry = { type: msg.type(), text: msg.text() };
      consoleMessages.push(entry);
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test('Initial load: page elements present and initial visualization runs (if any) - Idle/OnEnter', async ({ page }) => {
    // This test validates the initial state: textarea exists, buttons exist, and onload may trigger visualization
    const gp = new GraphPage(page);
    await gp.goto();

    // Verify main components are present
    await expect(gp.textarea).toBeVisible();
    await expect(gp.visualizeButton).toBeVisible();
    await expect(gp.clearButton).toBeVisible();
    await expect(gp.loadExampleButton).toBeVisible();
    await expect(gp.svg).toBeVisible();
    await expect(gp.adjacencyTable).toBeVisible();
    await expect(gp.errorDiv).toBeVisible();

    // The app sets window.onload = visualizeGraph; so by the time page load finished,
    // the SVG should be populated. Wait a short time and assert svg has children (GraphVisualized)
    const svgChildCount = await gp.getSvgChildCount();
    expect(svgChildCount).toBeGreaterThan(0);

    // Adjacency table should be populated as well
    const tableHTML = await gp.getAdjacencyTableHTML();
    expect(tableHTML).toContain('Adjacency List Representation');
    expect(tableHTML).toContain('Adjacency Matrix');

    // No uncaught runtime errors should have happened during load
    expect(pageErrors.length).toBe(0);
    // No console.error entries
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('VisualizeGraph: clicking Visualize on valid input draws graph and populates adjacency table (S0 -> S1)', async ({ page }) => {
    // This test validates the transition from Idle to GraphVisualized when user clicks Visualize with valid input
    const gp = new GraphPage(page);
    await gp.goto();

    // Ensure textarea has default content; replace with a known small graph to make assertions simpler
    const sample = `X: Y, Z
Y: X
Z: X`;
    await gp.textarea.fill(sample);

    // Click visualize
    await gp.clickVisualize();

    // After visualization, SVG should contain node groups and edges
    const nodeGroups = await gp.getNodeGroupCount();
    expect(nodeGroups).toBe(3); // X, Y, Z

    const edgeCount = await gp.getEdgeCount();
    // For undirected edges without duplicates, expect edges: X-Y, X-Z -> 2 edges
    expect(edgeCount).toBeGreaterThanOrEqual(2);

    // Adjacency table should contain the vertex rows
    const tableHTML = await gp.getAdjacencyTableHTML();
    expect(tableHTML).toContain('<strong>X</strong>');
    expect(tableHTML).toContain('<strong>Y</strong>');
    expect(tableHTML).toContain('<strong>Z</strong>');
    // No error displayed
    const errText = await gp.getErrorText();
    expect(errText).toBe('');

    // No uncaught runtime errors occurred
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('VisualizeGraph with empty input displays error (S0 -> S2 Error)', async ({ page }) => {
    // This test validates the error transition when user clicks Visualize with empty input
    const gp = new GraphPage(page);
    await gp.goto();

    // Clear input via page interactions to simulate empty input
    await gp.textarea.fill('');
    // Ensure previous visualization is not present by clearing svg and table manually via clickClear (use button)
    // But do not call clearGraph directly; click Clear button to follow user flow
    await gp.clickClear();

    // Now click visualize with empty textarea
    await gp.visualizeButton.click();

    // Wait a bit for error message to appear
    await page.waitForFunction(() => {
      const err = document.getElementById('error');
      return err && err.textContent.trim().length > 0;
    }, { timeout: 2000 });

    const errText = await gp.getErrorText();
    expect(errText).toBe('Please enter graph data.');

    // Ensure SVG and adjacency table are empty after the erroneous visualize attempt
    const svgCount = await gp.getSvgChildCount();
    expect(svgCount).toBe(0);
    const tableHTML = await gp.getAdjacencyTableHTML();
    expect(tableHTML.trim()).toBe('');

    // No uncaught runtime errors (the app handles empty input path)
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('LoadExample button loads weighted example and visualizes graph (S0 -> S1 via LoadExample)', async ({ page }) => {
    // This test validates that clicking "Load Example" loads weighted data and visualizes it
    const gp = new GraphPage(page);
    await gp.goto();

    // First clear to ensure deterministic behavior
    await gp.clickClear();

    // Click Load Example which sets textarea and calls visualizeGraph internally
    await gp.clickLoadExample();

    // The input should now contain weighted example values
    const inputValue = await gp.getInputValue();
    expect(inputValue).toContain('A: B(2), C(3)');

    // SVG should have been populated
    const svgChildCount = await gp.getSvgChildCount();
    expect(svgChildCount).toBeGreaterThan(0);

    // Adjacency table should list weighted neighbors like B(2)
    const tableHTML = await gp.getAdjacencyTableHTML();
    expect(tableHTML).toContain('B(2)');
    expect(tableHTML).toContain('C(3)');
    expect(tableHTML).toContain('Adjacency Matrix');

    // Edge labels for weights are rendered as text elements when weight !== 1
    const edgeLabelCount = await gp.getEdgeLabelCount();
    expect(edgeLabelCount).toBeGreaterThan(0);

    // No runtime errors occurred during loadExample or visualize
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('ClearGraph clears input, svg, table and error (S1 -> S0)', async ({ page }) => {
    // This test validates the ClearGraph transition: after a visualization, Clear returns app to Idle state
    const gp = new GraphPage(page);
    await gp.goto();

    // Ensure there's a visualization (initial load already does this); verify svg has children
    let svgCount = await gp.getSvgChildCount();
    expect(svgCount).toBeGreaterThan(0);

    // Click Clear and assert everything cleared
    await gp.clickClear();

    // Input field cleared
    const inputValue = await gp.getInputValue();
    expect(inputValue).toBe('');

    // SVG empty
    svgCount = await gp.getSvgChildCount();
    expect(svgCount).toBe(0);

    // Adjacency table empty
    const tableHTML = await gp.getAdjacencyTableHTML();
    expect(tableHTML.trim()).toBe('');

    // Error cleared
    const errText = await gp.getErrorText();
    expect(errText).toBe('');

    // No runtime errors occurred during clear
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Sequential transitions: visualize -> clear -> loadExample -> visualize (comprehensive path coverage)', async ({ page }) => {
    // This test walks through multiple transitions to cover the FSM paths in sequence
    const gp = new GraphPage(page);
    await gp.goto();

    // 1) Visualize a custom graph
    const sample = `P: Q, R
Q: P
R: P`;
    await gp.textarea.fill(sample);
    await gp.clickVisualize();

    let nodes = await gp.getNodeGroupCount();
    expect(nodes).toBe(3);

    // 2) Clear the graph
    await gp.clickClear();
    let svgCount = await gp.getSvgChildCount();
    expect(svgCount).toBe(0);

    // 3) Load example (weighted) and ensure visualized
    await gp.clickLoadExample();
    const inputAfterLoad = await gp.getInputValue();
    expect(inputAfterLoad).toContain('A: B(2), C(3)');

    const tableHTML = await gp.getAdjacencyTableHTML();
    expect(tableHTML).toContain('Adjacency List Representation');

    // 4) Click Visualize again (even though loadExample already visualized) to ensure idempotency
    await gp.clickVisualize();
    const svgAfter = await gp.getSvgChildCount();
    expect(svgAfter).toBeGreaterThan(0);

    // Throughout the sequence, no uncaught errors should have occurred
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test.afterEach(async ({ }, testInfo) => {
    // Provide helpful debugging info when a test fails by logging console and page errors counts
    if (testInfo.status !== testInfo.expectedStatus) {
      // Print captured console messages and page errors to the test output for debugging
      // (Playwright will include these if the test fails)
      // We avoid modifying the page; only observing
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', JSON.stringify(consoleMessages, null, 2));
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors.map(e => e.toString()));
    }
  });
});