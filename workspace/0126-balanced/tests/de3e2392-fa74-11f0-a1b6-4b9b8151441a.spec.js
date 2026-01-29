import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3e2392-fa74-11f0-a1b6-4b9b8151441a.html';

/**
 * Page Object for interacting with the Backpropagation Demo page.
 * Encapsulates common selectors and actions so tests remain readable.
 */
class BackpropPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      forwardBtn: '#forwardBtn',
      backpropBtn: '#backpropBtn',
      resetBtn: '#resetBtn',
      neuralNetwork: '#neuralNetwork',
      output: '#output',
      weightElements: '.weight',
      neuron: (layer, idx) => `#neuron-${layer}-${idx}`,
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickForward() {
    await this.page.click(this.selectors.forwardBtn);
  }

  async clickBackprop() {
    await this.page.click(this.selectors.backpropBtn);
  }

  async clickReset() {
    await this.page.click(this.selectors.resetBtn);
  }

  async getOutputText() {
    const el = await this.page.$(this.selectors.output);
    if (!el) return '';
    return (await el.innerText()).trim();
  }

  async countWeightElements() {
    return this.page.locator(this.selectors.weightElements).count();
  }

  async neuronText(layer, idx) {
    const sel = this.selectors.neuron(layer, idx);
    const el1 = await this.page.$(sel);
    if (!el) return null;
    return (await el.innerText()).trim();
  }

  async getNeuronValuesAll() {
    // returns array of text contents for neurons in all layers
    const container = await this.page.$(this.selectors.neuralNetwork);
    if (!container) return [];
    const neuronEls = await container.$$('.neuron');
    const values = [];
    for (const el of neuronEls) {
      values.push((await el.innerText()).trim());
    }
    return values;
  }
}

test.describe('Backpropagation Demo - FSM states and transitions', () => {
  // Collect page-level errors and console messages for assertions.
  /** @type {string[]} */
  let pageErrors;
  /** @type {{type: string, text: string}[]} */
  let consoleMsgs;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMsgs = [];

    // Listen for uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // capture stack or message
      pageErrors.push(String(err && err.stack ? err.stack : err));
    });

    // Capture console messages; collect only for diagnostics and assertions
    page.on('console', (msg) => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.describe('Initial Idle state (S0_Idle)', () => {
    test('should render the page and initial network visualization (renderPage())', async ({ page }) => {
      // Validate that on initial load the network is rendered and neurons exist
      const app = new BackpropPage(page);
      await app.goto();

      // Check that neural network container exists
      await expect(page.locator('#neuralNetwork')).toBeVisible();

      // There should be neuron elements for the 1-2-1 network (3 neurons)
      const neurons = await page.locator('#neuralNetwork .neuron');
      await expect(neurons).toHaveCount(3);

      // Check that the output container exists (initially may be empty)
      await expect(page.locator('#output')).toBeVisible();

      // No uncaught page errors should have occurred during initial render
      expect(pageErrors, 'No uncaught page errors during initial render').toEqual([]);
      // No console.error messages expected
      const consoleErrors = consoleMsgs.filter(m => m.type === 'error' || m.type === 'warning');
      expect(consoleErrors.length, 'No console errors/warnings during initial render').toBe(0);
    });

    test('rendered neurons show numeric values and color styles applied', async ({ page }) => {
      const app1 = new BackpropPage(page);
      await app.goto();

      const neuronValues = await app.getNeuronValuesAll();
      // Expect 3 neuron text nodes with numeric-looking contents like "-0.12" or "0.45"
      expect(neuronValues.length).toBeGreaterThanOrEqual(3);
      for (const txt of neuronValues) {
        // basic numeric format sanity check
        expect(txt).toMatch(/^-?\d+\.\d{2}$/);
      }

      // Ensure weight elements are present (renderNetwork builds .weight elements)
      const weightCount = await app.countWeightElements();
      // For 1-2-1 network there should be weights: input->hidden (2) and hidden->output (2) => 4
      // Implementation draws a connection per pair, so expect at least 3 or 4 depending on geometry.
      expect(weightCount).toBeGreaterThanOrEqual(3);

      // Assert no page errors
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Forward Pass state (S1_ForwardPass)', () => {
    test('clicking "Run Forward Pass" displays Output and Error (transition S0 -> S1)', async ({ page }) => {
      const app2 = new BackpropPage(page);
      await app.goto();

      // Click forward pass and validate DOM output text is updated with Output and Error
      await app.clickForward();

      const output = await app.getOutputText();
      expect(output).toContain('Output:');
      expect(output).toContain('Error:');

      // Also ensure numeric precision is present
      expect(output).toMatch(/Output:\s*-?\d+\.\d{4}/);
      expect(output).toMatch(/Error:\s*\d+\.\d{4}/);

      // Clicking forward again (S1 -> S1) should update the output (values may change slightly)
      const before = output;
      await app.clickForward();
      const after = await app.getOutputText();
      // After should still contain Output and Error
      expect(after).toContain('Output:');
      expect(after).toContain('Error:');
      // May or may not change numerically, but expect output content to be non-empty
      expect(after.length).toBeGreaterThan(0);

      // Check no uncaught exceptions during forward pass
      expect(pageErrors).toEqual([]);
      const consoleErrs = consoleMsgs.filter(m => m.type === 'error' || m.type === 'warning');
      expect(consoleErrs.length).toBe(0);
    });

    test('forward pass updates neuron DOM values (visual feedback)', async ({ page }) => {
      const app3 = new BackpropPage(page);
      await app.goto();

      // Grab neuron text before forward
      const beforeValues = await app.getNeuronValuesAll();
      await app.clickForward();
      const afterValues = await app.getNeuronValuesAll();

      // At least one neuron display should have been updated (hidden and output are recalculated)
      const changed = beforeValues.some((v, i) => v !== afterValues[i]);
      expect(changed).toBeTruthy();

      // No page errors
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Backpropagation state (S2_Backpropagation)', () => {
    test('clicking "Run Backpropagation" updates weights and appends message (transition S0 -> S2)', async ({ page }) => {
      const app4 = new BackpropPage(page);
      await app.goto();

      // Count weight elements before backprop
      const beforeWeights = await app.countWeightElements();

      // Click backprop and validate output messages
      await app.clickBackprop();

      const outText = await app.getOutputText();
      expect(outText).toContain('Weights updated using backpropagation!');
      expect(outText).toContain('New output:');

      // After backprop the renderNetwork() was called which re-drew weight elements.
      const afterWeights = await app.countWeightElements();
      expect(afterWeights).toBeGreaterThanOrEqual(0);
      // Ensure some weights exist
      expect(afterWeights).toBeGreaterThanOrEqual(3);

      // Repeated backprop (S2 -> S2) should append another "Weights updated..." message
      await app.clickBackprop();
      const afterSecond = await app.getOutputText();
      // There should be at least two occurrences of the weights update message now
      const matches = afterSecond.match(/Weights updated using backpropagation!/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(2);

      // No uncaught page errors
      expect(pageErrors).toEqual([]);
    });

    test('running backprop without explicit forward still completes without uncaught exceptions', async ({ page }) => {
      const app5 = new BackpropPage(page);
      await app.goto();

      // Directly click backprop (edge case: no prior forward)
      await app.clickBackprop();
      const out = await app.getOutputText();
      // Should still produce "Weights updated" and "New output"
      expect(out).toContain('Weights updated using backpropagation!');
      expect(out).toContain('New output:');

      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Network Reset state (S3_NetworkReset)', () => {
    test('clicking "Reset Network" creates a new NeuralNetwork and displays reset message (transition S0 -> S3)', async ({ page }) => {
      const app6 = new BackpropPage(page);
      await app.goto();

      // Capture neuron values and weights prior to reset
      const beforeNeurons = await app.getNeuronValuesAll();
      const beforeWeights1 = await app.countWeightElements();

      await app.clickReset();

      const out1 = await app.getOutputText();
      expect(out).toContain('Network reset with new random weights.');

      // After reset, network is re-rendered; neurons should exist and likely have different values
      const afterNeurons = await app.getNeuronValuesAll();
      expect(afterNeurons.length).toBeGreaterThanOrEqual(3);
      // It's possible values randomly match coincidentally, just ensure nodes are present
      expect(afterNeurons).not.toEqual([]); // non-empty array

      const afterWeights1 = await app.countWeightElements();
      expect(afterWeights).toBeGreaterThanOrEqual(3);

      // Clicking reset repeatedly (S3 -> S3) should keep showing the reset message
      await app.clickReset();
      const out2 = await app.getOutputText();
      const resets = (out2.match(/Network reset with new random weights\./g) || []).length;
      expect(resets).toBeGreaterThanOrEqual(1);

      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Integrated transition flows and edge cases', () => {
    test('Run forward -> backprop -> forward -> reset sequence produces expected outputs and no uncaught errors', async ({ page }) => {
      const app7 = new BackpropPage(page);
      await app.goto();

      // Run forward
      await app.clickForward();
      const afterForward = await app.getOutputText();
      expect(afterForward).toContain('Output:');
      expect(afterForward).toContain('Error:');

      // Run backprop
      await app.clickBackprop();
      const afterBackprop = await app.getOutputText();
      expect(afterBackprop).toContain('Weights updated using backpropagation!');
      expect(afterBackprop).toContain('New output:');

      // Run forward again to see updated outputs
      await app.clickForward();
      const secondForward = await app.getOutputText();
      expect(secondForward).toContain('Output:');
      expect(secondForward).toContain('Error:');

      // Reset network
      await app.clickReset();
      const resetOut = await app.getOutputText();
      expect(resetOut).toContain('Network reset with new random weights.');

      // Check no uncaught exceptions happened during the integrated flow
      expect(pageErrors).toEqual([]);
      const consoleErrs1 = consoleMsgs.filter(m => m.type === 'error' || m.type === 'warning');
      expect(consoleErrs.length).toBe(0);
    });

    test('rapid interactions: multiple quick clicks across controls should not produce uncaught exceptions', async ({ page }) => {
      const app8 = new BackpropPage(page);
      await app.goto();

      // Perform rapid clicks
      const actions = [
        app.clickForward(),
        app.clickBackprop(),
        app.clickForward(),
        app.clickReset(),
        app.clickBackprop(),
        app.clickForward()
      ];
      // Fire them in quick succession
      await Promise.all(actions);

      // Validate that final output contains at least one of the expected markers
      const finalOutput = await app.getOutputText();
      const ok = finalOutput.includes('Output:') || finalOutput.includes('Weights updated using backpropagation!') || finalOutput.includes('Network reset with new random weights.');
      expect(ok).toBeTruthy();

      // Ensure no uncaught page errors were thrown by racing operations
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Observability: console and runtime error capture', () => {
    test('should capture and assert there are no uncaught runtime errors or console.error messages', async ({ page }) => {
      const app9 = new BackpropPage(page);
      await app.goto();

      // Interact to exercise code paths
      await app.clickForward();
      await app.clickBackprop();
      await app.clickReset();

      // Diagnostic: log captured console messages (non-failing) but assert none are of type error
      const errors = consoleMsgs.filter(m => m.type === 'error');
      // Fail the test if there are console errors
      expect(errors.length, `No console.error messages; found: ${errors.map(e => e.text).join(' | ')}`).toBe(0);

      // Also ensure page did not emit uncaught exceptions
      expect(pageErrors.length, `No uncaught page errors; found: ${pageErrors.join(' || ')}`).toBe(0);
    });
  });
});