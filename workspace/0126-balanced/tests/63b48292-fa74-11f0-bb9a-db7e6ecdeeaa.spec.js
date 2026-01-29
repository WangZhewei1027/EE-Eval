import { test, expect } from '@playwright/test';

// Test file for Application ID: 63b48292-fa74-11f0-bb9a-db7e6ecdeeaa
// URL served at:
// http://127.0.0.1:5500/workspace/0126-balanced/html/63b48292-fa74-11f0-bb9a-db7e6ecdeeaa.html

// Page object encapsulating common interactions and queries
class BackpropPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input1 = page.locator('#input1');
    this.input2 = page.locator('#input2');
    this.target = page.locator('#target');
    this.input1Val = page.locator('#input1Val');
    this.input2Val = page.locator('#input2Val');
    this.targetVal = page.locator('#targetVal');
    this.trainBtn = page.locator('#trainStepBtn');
    this.log = page.locator('#log');
    this.weightValues = page.locator('#weight-values');
    this.inputNeurons = page.locator('#inputLayer .neuron');
    this.hiddenNeurons = page.locator('#hiddenLayer .neuron');
    this.outputNeurons = page.locator('#outputLayer .neuron');
  }

  // Navigate to the page
  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-balanced/html/63b48292-fa74-11f0-bb9a-db7e6ecdeeaa.html');
  }

  // Set a range input value and dispatch 'input' event so the page handlers run
  async setRangeValue(selector, value) {
    await this.page.$eval(selector, (el, v) => {
      el.value = String(v);
      // Dispatch both input and change to be safe
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }

  async setInput1(value) {
    await this.setRangeValue('#input1', value);
  }
  async setInput2(value) {
    await this.setRangeValue('#input2', value);
  }
  async setTarget(value) {
    await this.setRangeValue('#target', value);
  }

  async clickTrain() {
    await this.trainBtn.click();
  }

  async getLogText() {
    return (await this.log.textContent()) ?? '';
  }

  async getWeightsText() {
    return (await this.weightValues.textContent()) ?? '';
  }

  async getInput1Span() {
    return (await this.input1Val.textContent()) ?? '';
  }
  async getInput2Span() {
    return (await this.input2Val.textContent()) ?? '';
  }
  async getTargetSpan() {
    return (await this.targetVal.textContent()) ?? '';
  }

  async getInputNeuronText(index) {
    // index 0-based
    const el = this.inputNeurons.nth(index);
    return (await el.textContent()) ?? '';
  }

  async getHiddenNeuronTitle(index) {
    return await this.hiddenNeurons.nth(index).getAttribute('title');
  }

  async getOutputNeuronTitle(index) {
    return await this.outputNeurons.nth(index).getAttribute('title');
  }

  async getHiddenNeuronStyleBg(index) {
    return await this.hiddenNeurons.nth(index).evaluate(el => el.style.backgroundColor || window.getComputedStyle(el).backgroundColor);
  }

  async getOutputNeuronStyleBg(index) {
    return await this.outputNeurons.nth(index).evaluate(el => el.style.backgroundColor || window.getComputedStyle(el).backgroundColor);
  }
}

// Collect console messages and page errors across tests
test.describe('Backpropagation Demonstration - FSM and UI integration tests', () => {
  // We'll capture console messages and page errors per test to assert no unexpected runtime exceptions occur.
  test.beforeEach(async ({ page }) => {
    // Ensure a fresh page with listeners
    page.setDefaultTimeout(10000);
  });

  test.describe('Idle State (S0_Idle) validations', () => {
    test('On load the page enters Idle: sliders text and weights are displayed (entry actions)', async ({ page }) => {
      // This test validates S0_Idle entry actions: updateSlidersText() and displayWeights()
      const bp = new BackpropPage(page);

      // Capture runtime errors and console
      const pageErrors = [];
      const consoleMessages = [];
      page.on('pageerror', err => pageErrors.push(err));
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

      await bp.goto();

      // Verify the slider display spans reflect initial values (updateSlidersText should have run)
      const i1 = await bp.getInput1Span();
      const i2 = await bp.getInput2Span();
      const t = await bp.getTargetSpan();
      expect(i1).toBe('0.50'); // initial value 0.5 formatted to 2 decimals
      expect(i2).toBe('0.50');
      // target initial value is 1, formatted to 2 decimals (script uses toFixed(2))
      expect(t).toBe('1.00');

      // Verify weights are displayed in the #weight-values container (displayWeights should have run)
      const weightsText = await bp.getWeightsText();
      expect(weightsText).toContain('Input to Hidden weights');
      expect(weightsText).toContain('Hidden to Output weights');

      // Verify input neurons were initialized (updateInputNeurons called at end of script on load)
      const inputNeuron0 = await bp.getInputNeuronText(0);
      expect(inputNeuron0).toContain('I1');
      expect(inputNeuron0).toContain('0.50');

      // No unexpected runtime exceptions occurred during load
      expect(pageErrors.length).toBe(0);
      // Console should not contain errors (info logs may be empty); assert no 'error' typed console messages
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0);
    });
  });

  test.describe('Input events (Input1Change, Input2Change, TargetChange)', () => {
    test('Changing Input 1 updates display text and input neuron DOM (Input1Change transition)', async ({ page }) => {
      // Validate S0_Idle self-transition on input event: updateSlidersText()
      const bp1 = new BackpropPage(page);
      const pageErrors1 = [];
      page.on('pageerror', err => pageErrors.push(err));

      await bp.goto();

      // Change input1 to 0.75 and assert the visible span updates
      await bp.setInput1(0.75);
      const i1span = await bp.getInput1Span();
      expect(i1span).toBe('0.75');

      // The input neuron DOM text and title should update to reflect value
      const inputNeuronText = await bp.getInputNeuronText(0);
      expect(inputNeuronText).toContain('I1');
      expect(inputNeuronText).toContain('0.75');

      const title = await page.locator('#inputLayer .neuron').first().getAttribute('title');
      expect(title).toContain('Input Neuron 1 Value');

      expect(pageErrors.length).toBe(0);
    });

    test('Changing Input 2 updates display text and input neuron DOM (Input2Change transition)', async ({ page }) => {
      const bp2 = new BackpropPage(page);
      const pageErrors2 = [];
      page.on('pageerror', err => pageErrors.push(err));

      await bp.goto();

      await bp.setInput2(0.25);
      const i2span = await bp.getInput2Span();
      expect(i2span).toBe('0.25');

      const inputNeuronText1 = await bp.getInputNeuronText(1);
      expect(inputNeuronText).toContain('I2');
      expect(inputNeuronText).toContain('0.25');

      const title1 = await page.locator('#inputLayer .neuron').nth(1).getAttribute('title1');
      expect(title).toContain('Input Neuron 2 Value');

      expect(pageErrors.length).toBe(0);
    });

    test('Changing Target updates display text (TargetChange transition)', async ({ page }) => {
      const bp3 = new BackpropPage(page);
      const pageErrors3 = [];
      page.on('pageerror', err => pageErrors.push(err));

      await bp.goto();

      await bp.setTarget(0.42);
      const tspan = await bp.getTargetSpan();
      expect(tspan).toBe('0.42');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Training State (S1_Training) and transitions', () => {
    test('Clicking "Train One Step" triggers training: logs, neuron activation updates, and weights change (TrainStepClick transition)', async ({ page }) => {
      // This test validates transition S0_Idle -> S1_Training on clicking the button and the associated entry action trainStep()
      const bp4 = new BackpropPage(page);
      const pageErrors4 = [];
      const consoleMessages1 = [];
      page.on('pageerror', err => pageErrors.push(err));
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

      await bp.goto();

      // Record weights snapshot prior to training
      const weightsBefore = await bp.getWeightsText();
      expect(weightsBefore.length).toBeGreaterThan(0);

      // Set deterministic inputs for reproducibility within test (we cannot control random initial weights)
      await bp.setInput1(1.0);
      await bp.setInput2(0.0);
      await bp.setTarget(1.0);

      // Click "Train One Step"
      await bp.clickTrain();

      // After clicking training, the log should contain forward pass info and squared error and backprop update lines
      const logText = await bp.getLogText();
      expect(logText).toContain('Forward Pass');
      expect(logText).toContain('Output activations');
      expect(logText).toMatch(/Squared Error:/);

      // Backprop logs: there should be lines indicating updated weights and biases
      expect(logText).toMatch(/Updated w_ho\[\d+\]\[\d+\] by/);
      expect(logText).toMatch(/Updated w_ih\[\d+\]\[\d+\] by/);
      expect(logText).toMatch(/Updated output bias/);
      expect(logText).toMatch(/Updated hidden bias/);

      // Displayed weights should be updated and differ from the snapshot taken before the training step
      const weightsAfter = await bp.getWeightsText();
      expect(weightsAfter.length).toBeGreaterThan(0);
      // It's possible only small changes happened; still expect the string to change due to formatting with toFixed
      expect(weightsAfter).not.toBe(weightsBefore);

      // Neuron activations should be shown in hidden and output neuron elements (titles updated)
      const hiddenTitle0 = await bp.getHiddenNeuronTitle(0);
      const hiddenTitle1 = await bp.getHiddenNeuronTitle(1);
      const outputTitle0 = await bp.getOutputNeuronTitle(0);
      // Titles should contain 'Activation' indicating updateNeuronActivations ran
      expect(hiddenTitle0).toContain('Activation');
      expect(hiddenTitle1).toContain('Activation');
      expect(outputTitle0).toContain('Output Neuron Activation');

      // Also check style background colors changed to indicate visual feedback
      const hiddenBg0 = await bp.getHiddenNeuronStyleBg(0);
      const outputBg0 = await bp.getOutputNeuronStyleBg(0);
      expect(hiddenBg0).toMatch(/rgb\(/); // should be CSS rgb string
      expect(outputBg0).toMatch(/rgb\(/);

      // No uncaught page errors emitted
      expect(pageErrors.length).toBe(0);

      // The page does not necessarily emit console messages; ensure no console errors
      const consoleErrorMsgs1 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0);
    });

    test('Consecutive train clicks update weights cumulatively and clear previous logs (S1_Training re-entry)', async ({ page }) => {
      // This test ensures repeated transition to S1_Training runs trainStep() each time and logs are reset per step
      const bp5 = new BackpropPage(page);
      const pageErrors5 = [];
      page.on('pageerror', err => pageErrors.push(err));

      await bp.goto();

      // Click train once, capture log and weights
      await bp.setInput1(0.2);
      await bp.setInput2(0.8);
      await bp.setTarget(0.6);
      await bp.clickTrain();

      const logAfterFirst = await bp.getLogText();
      const weightsAfterFirst = await bp.getWeightsText();

      // Click train a second time
      await bp.clickTrain();
      const logAfterSecond = await bp.getLogText();
      const weightsAfterSecond = await bp.getWeightsText();

      // Each trainStep clears logs at start; therefore the latest log should not contain content from the first run beyond the fresh step
      expect(logAfterSecond).toContain('Inputs: [');
      // The second run's log should be different (fresh) and weights should change again (cumulative updates)
      expect(weightsAfterSecond).not.toBe(weightsAfterFirst);

      expect(pageErrors.length).toBe(0);
    });

    test('Edge case training with extreme inputs (0 and 1) does not throw and produces logs', async ({ page }) => {
      // Tests one training step with inputs at extremes to exercise numeric stability code paths
      const bp6 = new BackpropPage(page);
      const pageErrors6 = [];
      page.on('pageerror', err => pageErrors.push(err));

      await bp.goto();

      await bp.setInput1(0.0);
      await bp.setInput2(1.0);
      await bp.setTarget(0.0);

      await bp.clickTrain();

      const logText1 = await bp.getLogText();
      // Should still produce forward pass and backprop output consistency
      expect(logText).toContain('Forward Pass');
      expect(logText).toMatch(/Hidden activations/);
      expect(logText).toMatch(/Output activations/);
      // Should contain updated weight lines
      expect(logText).toMatch(/Updated w_ho\[\d+\]\[\d+\] by/);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error observation and robustness', () => {
    test('No uncaught exceptions (ReferenceError, TypeError, SyntaxError) occur during user interactions', async ({ page }) => {
      // This test purposefully performs typical interactions and asserts no page errors occurred.
      // Per test instructions we do not patch or alter the app; we only observe runtime behavior.
      const bp7 = new BackpropPage(page);
      const pageErrors7 = [];
      page.on('pageerror', err => pageErrors.push(err));

      await bp.goto();

      // Perform several interactions
      await bp.setInput1(0.33);
      await bp.setInput2(0.66);
      await bp.setTarget(0.5);
      await bp.clickTrain();
      await bp.setInput1(0.9);
      await bp.clickTrain();

      // Assert that no uncaught errors were emitted
      // If there were ReferenceError/TypeError/SyntaxError these would appear here
      expect(pageErrors.length).toBe(0);
    });
  });
});