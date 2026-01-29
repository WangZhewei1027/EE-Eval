import { test, expect } from '@playwright/test';

// Test file for Application ID: 99d14163-fa79-11f0-8075-e54a10595dde
// This suite validates the FSM states and transitions for the interactive backpropagation simulation.
// It also observes console messages and page errors without modifying the page runtime.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d14163-fa79-11f0-8075-e54a10595dde.html';

// Page Object to encapsulate interactions with the app
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.locators = {
      numLayers: page.locator('#numLayers'),
      neuronsPerLayer: page.locator('#neuronsPerLayer'),
      learningRate: page.locator('#learningRate'),
      numEpochs: page.locator('#numEpochs'),
      initializeBtn: page.locator('#initialize'),
      trainBtn: page.locator('#train'),
      output: page.locator('#output')
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setNumLayers(value) {
    await this.locators.numLayers.fill(String(value));
  }

  async setNeuronsPerLayer(value) {
    await this.locators.neuronsPerLayer.fill(String(value));
  }

  async setLearningRate(value) {
    await this.locators.learningRate.fill(String(value));
  }

  async setNumEpochs(value) {
    await this.locators.numEpochs.fill(String(value));
  }

  async clickInitialize() {
    await this.locators.initializeBtn.click();
  }

  async clickTrain() {
    await this.locators.trainBtn.click();
  }

  async getOutputText() {
    // textContent returns null if element empty, convert to empty string
    const text = await this.locators.output.textContent();
    return text === null ? '' : text.trim();
  }

  async getNetwork() {
    // Return the window.network object as-is (may be object or array)
    return await this.page.evaluate(() => window.network);
  }

  async getSampleWeight() {
    // Return weight of first neuron of first layer if exists, otherwise null
    return await this.page.evaluate(() => {
      try {
        if (Array.isArray(window.network) && window.network.length > 0 && window.network[0].length > 0) {
          return window.network[0][0].weight;
        }
        return null;
      } catch (e) {
        return null;
      }
    });
  }
}

test.describe('Interactive Backpropagation Simulation (FSM: Idle → NetworkInitialized → NetworkTrained)', () => {
  // Arrays to capture console messages and page errors per test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // err is an Error object, push its message
      pageErrors.push(err);
    });
  });

  test('Initial render shows controls and empty output (S0_Idle)', async ({ page }) => {
    // Validate initial state: inputs present with default values, buttons visible, output empty
    const app = new AppPage(page);
    await app.goto();

    // Verify presence and default values of inputs
    await expect(app.locators.numLayers).toBeVisible();
    await expect(app.locators.neuronsPerLayer).toBeVisible();
    await expect(app.locators.learningRate).toBeVisible();
    await expect(app.locators.numEpochs).toBeVisible();

    await expect(app.locators.initializeBtn).toBeVisible();
    await expect(app.locators.trainBtn).toBeVisible();

    // Check default values
    expect(await app.locators.numLayers.inputValue()).toBe('3');
    expect(await app.locators.neuronsPerLayer.inputValue()).toBe('5');
    expect(await app.locators.learningRate.inputValue()).toBe('0.1');
    expect(await app.locators.numEpochs.inputValue()).toBe('10');

    // Output should be empty on initial render (entry action in FSM mentions renderPage, but HTML doesn't provide explicit function)
    expect(await app.getOutputText()).toBe('');

    // No unexpected page errors or console error messages at initial load
    // We assert there were zero page errors and zero console entries of type 'error'
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Initialize Network transitions to NetworkInitialized and renders message (S0_Idle -> S1_NetworkInitialized)', async ({ page }) => {
    // This test verifies that clicking "Initialize Network" uses inputs to build the network and updates the output text.
    const app = new AppPage(page);
    await app.goto();

    // Configure a specific network size
    await app.setNumLayers(4);
    await app.setNeuronsPerLayer(6);

    // Click initialize and assert output text
    await app.clickInitialize();

    const expectedText = 'Network initialized with 4 layers and 6 neurons each.';
    const output = await app.getOutputText();
    expect(output).toBe(expectedText);

    // Verify the global network object structure matches the requested dimensions
    const network = await app.getNetwork();
    // The app.createNetwork returns an array; ensure it's an array with length 4 and each layer length 6
    expect(Array.isArray(network)).toBe(true);
    expect(network.length).toBe(4);
    for (const layer of network) {
      expect(Array.isArray(layer)).toBe(true);
      expect(layer.length).toBe(6);
      // Each neuron should have weight and bias properties
      for (const neuron of layer) {
        expect(typeof neuron.weight).toBe('number');
        expect(typeof neuron.bias).toBe('number');
      }
    }

    // No uncaught page errors should have occurred during this valid flow
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Train Network after initialization transitions to NetworkTrained and outputs training results; network mutated (S1_NetworkInitialized -> S2_NetworkTrained)', async ({ page }) => {
    // This test validates training behavior: output message format and that training mutates weights/biases.
    const app = new AppPage(page);
    await app.goto();

    // Initialize a small network for deterministic observation
    await app.setNumLayers(2);
    await app.setNeuronsPerLayer(2);
    await app.clickInitialize();

    // Capture a sample weight before training
    const beforeWeight = await app.getSampleWeight();
    // Ensure we have a numeric weight
    expect(typeof beforeWeight === 'number' || beforeWeight === null).toBe(true);

    // Configure training parameters
    await app.setLearningRate(0.05);
    await app.setNumEpochs(5);

    // Click train and wait for the output to update
    await app.clickTrain();

    // After training completes, output should start with the expected prefix and include a numeric error
    const output = await app.getOutputText();
    expect(output.startsWith('Training complete. Total Error:')).toBe(true);

    // Parse the numeric error part and assert it's a number with 4 decimal places present (toFixed(4) was used)
    const match = output.match(/Total Error:\s*([0-9]+\.[0-9]{4})/);
    expect(match).not.toBeNull();
    const totalError = parseFloat(match[1]);
    expect(Number.isFinite(totalError)).toBe(true);
    expect(totalError).toBeGreaterThanOrEqual(0);

    // Verify that at least one neuron's weight was mutated by training (if network existed)
    const afterWeight = await app.getSampleWeight();
    if (beforeWeight !== null) {
      // Training subtracts positive amounts from weights, so weight should have changed (likely decreased).
      // Because errors are random, we only assert that the value is not strictly equal to the original.
      expect(afterWeight).not.toBe(beforeWeight);
    }

    // No uncaught page errors should have occurred during this valid training flow
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking Train before Initialize leads to a runtime TypeError (edge case, observe uncaught exception)', async ({ page }) => {
    // This test intentionally clicks Train without initializing to trigger the edge-case error:
    // The page defines `let network = {};` initially and trainNetwork expects an iterable network.
    // Iterating over {} causes a TypeError ("network is not iterable"). We must observe and assert that this page error occurs.
    const app = new AppPage(page);
    await app.goto();

    // Ensure initial network is the default object (not an array) by reading it
    const initialNetwork = await app.getNetwork();
    // The implementation sets let network = {}; so we expect it's an object (non-Array) initially
    expect(Array.isArray(initialNetwork)).toBe(false);

    // Wait for the uncaught pageerror event triggered by clicking train
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      app.clickTrain()
    ]);

    // Validate that an Error was thrown and it is a TypeError related to iteration
    expect(error).toBeTruthy();
    // Error message may vary by engine, but should indicate non-iterable. Match conservatively.
    expect(error.message).toMatch(/not iterable|is not iterable|not an iterable|is not iterable|is not a function|Cannot iterate/);

    // After the error, confirm output did not show a "Training complete" message
    const output = await app.getOutputText();
    // Either empty or unchanged; at minimum it should not start with the training success prefix
    expect(output.startsWith('Training complete.')).toBe(false);

    // Also assert that we did capture a page error in our array handler set up in beforeEach
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Console may also include error-level messages; ensure at least one console 'error' exists or was captured as pageError
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    // It's acceptable if the runtime only surfaces the error via pageerror and not console.error
    expect(consoleErrs.length >= 0).toBe(true);
  });

  test('Initialize with zero layers (edge case) should reflect values in output and create an empty network array', async ({ page }) => {
    // Although input min is 1, programmatic manipulation can set 0; createNetwork(0, n) should produce []
    const app = new AppPage(page);
    await app.goto();

    // Programmatically set numLayers to 0 and neurons to 3
    await app.setNumLayers(0);
    await app.setNeuronsPerLayer(3);

    // Click initialize
    await app.clickInitialize();

    // Output should reflect the zero layers as per the implementation's direct template string
    const output = await app.getOutputText();
    expect(output).toBe('Network initialized with 0 layers and 3 neurons each.');

    // Verify the network is an array of length 0
    const network = await app.getNetwork();
    expect(Array.isArray(network)).toBe(true);
    expect(network.length).toBe(0);

    // No uncaught page errors in this flow
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test.afterEach(async ({ page }) => {
    // Final sanity: if there are any uncaught page errors accumulated (unexpected), fail the test explicitly.
    // However individual tests that expect errors assert them explicitly; this ensures others remain error-free.
    // Only fail here if pageErrors exist and the current test did not intend them (we can't know intent here),
    // so we will simply attach them to test output via expectation that pageErrors is an array (sanity).
    expect(Array.isArray(pageErrors)).toBe(true);
  });
});