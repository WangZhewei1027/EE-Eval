import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b014631-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object for interacting with the visualizer UI
class VisualizerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.locators = {
      addNodeBtn: page.locator('#addNodeBtn'),
      addEdgeBtn: page.locator('#addEdgeBtn'),
      resetBtn: page.locator('#resetBtn'),
      topologicalSortBtn: page.locator('#topologicalSortBtn'),
      nextStepBtn: page.locator('#nextStepBtn'),
      presetSelect: page.locator('#presetGraphs'),
      nodeNameInput: page.locator('#nodeName'),
      fromNodeSelect: page.locator('#fromNode'),
      toNodeSelect: page.locator('#toNode'),
      graphContainer: page.locator('#graphContainer'),
      algorithmSteps: page.locator('#algorithmSteps'),
      topologicalOrder: page.locator('#topologicalOrder'),
      errorMessage: page.locator('#errorMessage'),
    };
  }

  async addNode(name) {
    await this.locators.nodeNameInput.fill(name);
    await this.locators.addNodeBtn.click();
  }

  async addEdge(fromValue, toValue) {
    // select the options in the selects
    await this.locators.fromNodeSelect.selectOption(fromValue);
    await this.locators.toNodeSelect.selectOption(toValue);
    await this.locators.addEdgeBtn.click();
  }

  async clickRunSort() {
    await this.locators.topologicalSortBtn.click();
  }

  async clickNextStep() {
    await this.locators.nextStepBtn.click();
  }

  async clickReset() {
    await this.locators.resetBtn.click();
  }

  async selectPreset(value) {
    await this.locators.presetSelect.selectOption(value);
  }

  async getNodeElementByName(name) {
    return this.page.locator(`#node-${name}`);
  }

  async getNodeCount() {
    return this.page.locator('.node').count();
  }

  async getEdgeLineCount() {
    return this.page.locator('.edge').count();
  }

  async getArrowCount() {
    return this.page.locator('.arrow').count();
  }

  async getAlgorithmStepsCount() {
    return this.locators.algorithmSteps.locator('.step').count();
  }

  async getAlgorithmStepText(index) {
    return this.locators.algorithmSteps.locator(`#step-${index}`).textContent();
  }

  async isNextStepDisabled() {
    return await this.locators.nextStepBtn.isDisabled();
  }

  async getTopologicalOrderText() {
    return this.locators.topologicalOrder.textContent();
  }

  async getErrorMessageText() {
    return this.locators.errorMessage.textContent();
  }

  async waitForStepHighlight(index) {
    const selector = `#step-${index}.current-step`;
    await this.page.waitForSelector(selector);
  }
}

test.describe('Topological Sort Visualization - FSM and UI tests', () => {
  // Each test gets a fresh page and fresh error/console captures
  test.beforeEach(async ({ page }) => {
    // No-op here; individual tests will navigate and set up their own listeners as needed
  });

  test.describe('Idle state (S0_Idle)', () => {
    test('should render control buttons and initial UI (Next Step disabled)', async ({ page }) => {
      // Load the app
      await page.goto(APP_URL);

      // Basic presence assertions for idle state controls
      await expect(page.locator('#addNodeBtn')).toBeVisible();
      await expect(page.locator('#addEdgeBtn')).toBeVisible();
      await expect(page.locator('#resetBtn')).toBeVisible();
      await expect(page.locator('#topologicalSortBtn')).toBeVisible();
      await expect(page.locator('#nextStepBtn')).toBeVisible();
      // Next Step should be disabled on initial render
      await expect(page.locator('#nextStepBtn')).toBeDisabled();

      // Node name input should exist with placeholder and maxlength attributes
      const nodeInput = page.locator('#nodeName');
      await expect(nodeInput).toBeVisible();
      await expect(nodeInput).toHaveAttribute('placeholder', 'Enter node name');
      await expect(nodeInput).toHaveAttribute('maxlength', '1');
    });
  });

  test.describe('Node and Edge operations (S1_NodeAdded & S2_EdgeAdded)', () => {
    test('adding a node without a name shows an inline error', async ({ page }) => {
      await page.goto(APP_URL);
      const v = new VisualizerPage(page);

      // Attempt to add node without filling name
      await v.locators.addNodeBtn.click();

      // Expect an inline error message to be shown
      await expect(v.locators.errorMessage).toHaveText('Please enter a node name');
    });

    test('can add nodes, update selects, and prevent duplicates', async ({ page }) => {
      await page.goto(APP_URL);
      const v = new VisualizerPage(page);

      // Add node 'A'
      await v.addNode('A');
      // Node element should exist in graph container
      await expect(await v.getNodeElementByName('A')).toBeVisible();

      // from and to selects should have option 'A'
      await expect(v.locators.fromNodeSelect.locator('option', { hasText: 'A' })).toHaveCount(1);
      await expect(v.locators.toNodeSelect.locator('option', { hasText: 'A' })).toHaveCount(1);

      // Add another node 'B'
      await v.addNode('B');
      await expect(await v.getNodeElementByName('B')).toBeVisible();

      // Trying to add duplicate 'A' should produce an inline error
      await v.addNode('A');
      await expect(v.locators.errorMessage).toHaveText('Node A already exists');

      // After duplicate attempt, still only two nodes exist
      const nodeCount = await v.getNodeCount();
      expect(nodeCount).toBe(2);
    });

    test('adding edges validates selections, self-edge and duplicates, and creates edge DOM elements', async ({ page }) => {
      await page.goto(APP_URL);
      const v = new VisualizerPage(page);

      // Set up two nodes A and B
      await v.addNode('A');
      await v.addNode('B');

      // Attempt to add edge without selecting nodes -> shows error
      await v.locators.addEdgeBtn.click();
      await expect(v.locators.errorMessage).toHaveText('Please select both from and to nodes');

      // Attempt to add self-edge A->A
      await v.locators.fromNodeSelect.selectOption('A');
      await v.locators.toNodeSelect.selectOption('A');
      await v.locators.addEdgeBtn.click();
      await expect(v.locators.errorMessage).toHaveText('Cannot create an edge from a node to itself');

      // Add valid edge A->B
      await v.locators.fromNodeSelect.selectOption('A');
      await v.locators.toNodeSelect.selectOption('B');
      await v.locators.addEdgeBtn.click();

      // Edge line and arrow elements should be appended
      const edgeLines = await v.getEdgeLineCount();
      const arrows = await v.getArrowCount();
      expect(edgeLines).toBeGreaterThanOrEqual(1);
      expect(arrows).toBeGreaterThanOrEqual(1);

      // Attempt duplicate edge A->B should show error
      await v.locators.fromNodeSelect.selectOption('A');
      await v.locators.toNodeSelect.selectOption('B');
      await v.locators.addEdgeBtn.click();
      await expect(v.locators.errorMessage).toHaveText('Edge from A to B already exists');
    });
  });

  test.describe('Topological sorting and stepping (S3_Sorting & S4_NextStep)', () => {
    test('can run topological sort on a linear graph and step through the algorithm', async ({ page }) => {
      await page.goto(APP_URL);

      // Capture page errors and console errors during this test and fail if any occur
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', err => pageErrors.push(err));
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const v = new VisualizerPage(page);

      // Build linear graph A -> B -> C
      await v.addNode('A');
      await v.addNode('B');
      await v.addNode('C');

      // Add edges A->B and B->C
      await v.addEdge('A', 'B');
      await v.addEdge('B', 'C');

      // Run the topological sort
      await v.clickRunSort();

      // Expect algorithm steps to be rendered
      const stepsCount = await v.getAlgorithmStepsCount();
      expect(stepsCount).toBeGreaterThan(0);

      // Next step button should be enabled now
      await expect(v.locators.nextStepBtn).toBeEnabled();

      // Topological order should display A → B → C
      const orderText = (await v.getTopologicalOrderText()) || '';
      expect(orderText.replace(/\s/g, '')).toContain('A→B→C');

      // The first step (index 0) should be highlighted
      await v.waitForStepHighlight(0);

      // Click Next Step and ensure highlight moves forward until the last step disables the button
      // We'll click until button becomes disabled or up to stepsCount times to avoid infinite loops
      let safety = 0;
      while (!(await v.isNextStepDisabled()) && safety < stepsCount + 2) {
        await v.clickNextStep();
        safety++;
      }
      // After finishing steps, Next should be disabled
      await expect(v.locators.nextStepBtn).toBeDisabled();

      // Ensure no unexpected runtime page errors occurred during these operations
      expect(pageErrors.length, `Page errors occurred: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `Console errors occurred: ${consoleErrors.join('; ')}`).toBe(0);
    });

    test('detects cycle when graph contains a cycle and displays cycle message', async ({ page }) => {
      await page.goto(APP_URL);
      const v = new VisualizerPage(page);

      // Create cycle A <-> B
      await v.addNode('A');
      await v.addNode('B');
      await v.addEdge('A', 'B');
      await v.addEdge('B', 'A');

      // Run topological sort
      await v.clickRunSort();

      // Expect topologicalOrder to show cycle detected message (innerHTML includes red span)
      const orderHtml = await v.locators.topologicalOrder.innerHTML();
      expect(orderHtml).toContain('Cycle detected! Graph is not a DAG.');
    });
  });

  test.describe('Reset and Preset Graph behavior (S5_Reset & SelectPresetGraph)', () => {
    test('clicking Reset triggers a runtime TypeError because reset() is not implemented', async ({ page }) => {
      await page.goto(APP_URL);

      // Listen for pageerror event and trigger Reset; the code intentionally calls this.reset(), which doesn't exist
      const [error] = await Promise.all([
        page.waitForEvent('pageerror'),
        page.click('#resetBtn'),
      ]);

      // The error should be a TypeError indicating reset is not a function
      expect(error).toBeTruthy();
      const message = error.message || '';
      expect(message).toMatch(/reset is not a function|this\.reset is not a function|Cannot read properties of undefined/);
    });

    test('selecting a preset graph triggers loadPresetGraph which calls missing reset() -> TypeError', async ({ page }) => {
      await page.goto(APP_URL);

      // Selecting a preset triggers loadPresetGraph which calls this.reset() at top and should throw
      const [error] = await Promise.all([
        page.waitForEvent('pageerror'),
        page.selectOption('#presetGraphs', 'linear'),
      ]);

      expect(error).toBeTruthy();
      const message = error.message || '';
      expect(message).toMatch(/reset is not a function|this\.reset is not a function|Cannot read properties of undefined/);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('adding edge without nodes shows validation error and does not throw runtime error', async ({ page }) => {
      await page.goto(APP_URL);

      // Capture any pageerrors - shouldn't be any for this validation scenario
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(e));

      const v = new VisualizerPage(page);
      // Try to add edge with no nodes present
      await v.locators.addEdgeBtn.click();

      // Should display the inline validation error
      await expect(v.locators.errorMessage).toHaveText('Please select both from and to nodes');

      // No runtime page errors should have been emitted
      expect(pageErrors.length).toBe(0);
    });

    test('pressing Enter in node input adds node (keypress listener)', async ({ page }) => {
      await page.goto(APP_URL);
      const v = new VisualizerPage(page);

      // Press Enter in the node input to add node 'X'
      await v.locators.nodeNameInput.fill('X');
      await v.locators.nodeNameInput.press('Enter');

      // Node should exist
      await expect(await v.getNodeElementByName('X')).toBeVisible();
    });
  });
});