import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d14162-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Interactive Neural Network Demo
class NeuralNetworkPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getElement(selector) {
    return this.page.locator(selector);
  }

  async setNumLayers(value) {
    const slider = this.page.locator('#num_layers');
    // Playwright slider set can use evaluate; use input.fill via set input value and dispatch input event
    await slider.evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  async getLayerCountText() {
    return this.page.locator('#layer_count').textContent();
  }

  async setNeuronsPerLayer(value) {
    const input = this.page.locator('#neurons_per_layer');
    // set value and trigger input event
    await input.fill(String(value));
    await input.evaluate((el) => el.dispatchEvent(new Event('input', { bubbles: true })));
  }

  async getNeuronsPerLayerValue() {
    return this.page.locator('#neurons_per_layer').inputValue();
  }

  async clickCreateNetwork() {
    await this.page.click('#create_network');
  }

  async clickTrainNetwork() {
    await this.page.click('#train_network');
  }

  async clickRunNetwork() {
    await this.page.click('#run_network');
  }

  async setInputData(csv) {
    const input = this.page.locator('#input_data');
    await input.fill(csv);
  }

  async setTestData(csv) {
    const input = this.page.locator('#test_data');
    await input.fill(csv);
  }

  async getNetworkConfigText() {
    return this.page.locator('#network_config').textContent();
  }

  async getOutputDisplayText() {
    return this.page.locator('#output_display').textContent();
  }
}

// Helper to capture console and page errors
async function attachErrorCollectors(page) {
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (message) => {
    // Collect console messages of type error for later assertions
    if (message.type() === 'error') {
      consoleErrors.push({
        text: message.text(),
        location: message.location ? message.location() : undefined,
      });
    }
  });

  page.on('pageerror', (error) => {
    // Collect uncaught exceptions from the page (ReferenceError, TypeError, etc.)
    pageErrors.push({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  });

  return { consoleErrors, pageErrors };
}

test.describe('Interactive Neural Network Demo (FSM validations)', () => {
  // The tests will instantiate a new page per test by default (Playwright fixture).
  test.beforeEach(async ({ page }) => {
    // nothing global to do here; each test navigates in its body
  });

  test.afterEach(async ({ page }) => {
    // ensure dialogs are closed if any stray alerts remain
    // Playwright auto-dismisses dialogs that are unhandled after test ends, but no-op here
  });

  test('S0_Idle: initial page renders controls and no uncaught errors', async ({ page }) => {
    // Validate Idle state: controls present and initial values correct.
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
    const nn = new NeuralNetworkPage(page);
    await nn.goto();

    // Check presence and initial values of controls
    await expect(page.locator('#num_layers')).toBeVisible();
    await expect(page.locator('#layer_count')).toBeVisible();
    await expect(page.locator('#neurons_per_layer')).toBeVisible();
    await expect(page.locator('#create_network')).toBeVisible();
    await expect(page.locator('#network_config')).toBeVisible();
    await expect(page.locator('#output_display')).toBeVisible();

    // Verify the default slider value and displayed count (FSM evidence: value="3")
    const layerCountText = await nn.getLayerCountText();
    expect(layerCountText.trim()).toBe('3');

    // Verify neurons per layer default
    const neuronsVal = await nn.getNeuronsPerLayerValue();
    expect(neuronsVal).toBe('5');

    // Ensure no console.error or uncaught page errors were emitted during initial load
    expect(consoleErrors.length, 'No console.error messages should be emitted on page load').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors should occur on page load').toBe(0);
  });

  test('S1_NetworkCreated: clicking Create Network displays network configuration JSON', async ({ page }) => {
    // Validate transition S0 -> S1 via CreateNetworkClick and evidence of network creation
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
    const nn = new NeuralNetworkPage(page);
    await nn.goto();

    // Ensure default counts are present
    const defaultLayerCount = Number((await nn.getLayerCountText()).trim());
    const defaultNeurons = Number(await nn.getNeuronsPerLayerValue());

    // Click create and validate network_config is populated with correct shape
    await nn.clickCreateNetwork();

    // network_config is filled synchronously in the page script; wait for non-empty text
    await expect(page.locator('#network_config')).not.toHaveText('', { timeout: 2000 });

    const configText = (await nn.getNetworkConfigText()) || '';
    // Basic sanity: should be valid JSON representing an array
    let parsed;
    try {
      parsed = JSON.parse(configText);
    } catch (e) {
      parsed = null;
    }
    expect(parsed, 'Network config should be valid JSON').not.toBeNull();
    expect(Array.isArray(parsed), 'Network config should be an array (layers)').toBe(true);
    expect(parsed.length, 'Number of layers in network should match selected numLayers').toBe(defaultLayerCount);

    // Each layer should be an array of neurons with length equal to neuronsPerLayer
    for (const layer of parsed) {
      expect(Array.isArray(layer)).toBe(true);
      expect(layer.length).toBe(defaultNeurons);
      // Values should be numbers (random weights)
      for (const w of layer) expect(typeof w).toBe('number');
    }

    // No console errors or uncaught exceptions during network creation
    expect(consoleErrors.length, 'No console.error during create_network').toBe(0);
    expect(pageErrors.length, 'No page errors during create_network').toBe(0);
  });

  test('Changing num_layers updates display and affects created network (edge case)', async ({ page }) => {
    // Validate NumLayersChange event and that create uses updated value
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
    const nn = new NeuralNetworkPage(page);
    await nn.goto();

    // Change number of layers to 4
    await nn.setNumLayers(4);
    let layerCountText = (await nn.getLayerCountText()).trim();
    expect(layerCountText).toBe('4');

    // Create network and verify number of layers equals 4
    await nn.clickCreateNetwork();
    await expect(page.locator('#network_config')).not.toHaveText('', { timeout: 2000 });
    const parsed = JSON.parse((await nn.getNetworkConfigText()) || '[]');
    expect(parsed.length).toBe(4);

    // No uncaught errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S2_NetworkTrained: successful training when input length matches neurons per layer', async ({ page }) => {
    // Validate TrainNetworkClick transition yields "Network trained!" when inputs correct
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
    const nn = new NeuralNetworkPage(page);
    await nn.goto();

    // Ensure neurons_per_layer remains default (so neuronsPerLayer variable in script remains numeric 5)
    const neuronsBefore = await nn.getNeuronsPerLayerValue();
    expect(neuronsBefore).toBe('5'); // numeric variable in script is still number 5 until changed

    // Create network
    await nn.clickCreateNetwork();
    await expect(page.locator('#network_config')).not.toHaveText('', { timeout: 2000 });

    // Provide input_data with 5 comma-separated numbers to match neuronsPerLayer
    await nn.setInputData('0.1,0.2,0.3,0.4,0.5');

    // There should be no alert for this correct case; call click and then check output_display
    await nn.clickTrainNetwork();

    // After training, output_display should read "Network trained!"
    await expect(page.locator('#output_display')).toHaveText('Network trained!', { timeout: 2000 });

    // No alert dialogs should have been shown; also verify no console/page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('TrainNetworkClick: shows alert when input data length mismatches neurons per layer (error scenario)', async ({ page }) => {
    // Validate the alert path when input length doesn't match neurons per layer
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
    const nn = new NeuralNetworkPage(page);
    await nn.goto();

    // Change neurons_per_layer to 3 (this sets neuronsPerLayer variable in script to a string "3")
    await nn.setNeuronsPerLayer(3);

    // Create network with the new neurons per layer
    await nn.clickCreateNetwork();
    await expect(page.locator('#network_config')).not.toHaveText('', { timeout: 2000 });

    // Provide input_data intentionally of wrong length (2 instead of 3)
    await nn.setInputData('0.1,0.2');

    // Expect an alert dialog when clicking train due to mismatch
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      nn.clickTrainNetwork(),
    ]);

    expect(dialog).toBeTruthy();
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe('Input data must match the number of neurons per layer!');
    await dialog.dismiss();

    // Ensure output_display was NOT set to "Network trained!"
    const outputText = (await nn.getOutputDisplayText()) || '';
    expect(outputText).not.toBe('Network trained!');

    // No uncaught exceptions should have occurred; only a dialog error condition
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S3_NetworkRun: running the network displays JSON output (and sequence create->train->run)', async ({ page }) => {
    // Validate RunNetworkClick transition and that output_display contains JSON output
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
    const nn = new NeuralNetworkPage(page);
    await nn.goto();

    // Create network with defaults
    await nn.clickCreateNetwork();
    await expect(page.locator('#network_config')).not.toHaveText('', { timeout: 2000 });
    const config = JSON.parse((await nn.getNetworkConfigText()) || '[]');

    const neuronsPerLayer = config.length > 0 ? config[0].length : 5;

    // Provide test data matching neuronsPerLayer so run proceeds
    const testValues = new Array(neuronsPerLayer).fill(0).map((_, i) => (0.1 * (i + 1)).toFixed(3));
    const testCsv = testValues.join(',');

    await nn.setTestData(testCsv);

    // Click run and ensure output_display becomes JSON string
    await nn.clickRunNetwork();

    // output_display is set synchronously to JSON.stringify(output)
    await expect(page.locator('#output_display')).not.toHaveText('', { timeout: 2000 });
    const outText = (await nn.getOutputDisplayText()) || '';

    // Validate that outText is valid JSON array-of-arrays and sizes match the network
    let parsedOut;
    try {
      parsedOut = JSON.parse(outText);
    } catch (e) {
      parsedOut = null;
    }
    expect(parsedOut, 'Run output should be valid JSON').not.toBeNull();
    expect(Array.isArray(parsedOut)).toBe(true);
    expect(parsedOut.length).toBe(config.length);
    for (const layer of parsedOut) {
      expect(Array.isArray(layer)).toBe(true);
      expect(layer.length).toBe(neuronsPerLayer);
      for (const v of layer) {
        expect(typeof v).toBe('number');
      }
    }

    // Basic numeric sanity check: output values are weight * testData[0]
    const firstTestValue = Number(testValues[0]);
    // Compare first element computed:
    if (config.length > 0 && config[0].length > 0) {
      const expectedFirst = config[0][0] * firstTestValue;
      // Allow small floating diff
      expect(Math.abs(parsedOut[0][0] - expectedFirst)).toBeLessThan(1e-6);
    }

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Full sequence: create -> train -> run produces expected outputs', async ({ page }) => {
    // Validate a full happy-path flow across states: S0 -> S1 -> S2 -> S3
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
    const nn = new NeuralNetworkPage(page);
    await nn.goto();

    // Create network
    await nn.clickCreateNetwork();
    await expect(page.locator('#network_config')).not.toHaveText('', { timeout: 2000 });

    // Train: use matching input_data (default neuronsPerLayer = 5)
    await nn.setInputData('0.5,0.5,0.5,0.5,0.5');
    await nn.clickTrainNetwork();
    await expect(page.locator('#output_display')).toHaveText('Network trained!', { timeout: 2000 });

    // Run: use matching test_data
    await nn.setTestData('1,1,1,1,1');
    await nn.clickRunNetwork();
    // Expect JSON output
    await expect(page.locator('#output_display')).not.toHaveText('Network trained!', { timeout: 2000 });
    const outText = (await nn.getOutputDisplayText()) || '';
    const parsed = JSON.parse(outText);
    expect(Array.isArray(parsed)).toBe(true);

    // No console/page errors across the full flow
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});