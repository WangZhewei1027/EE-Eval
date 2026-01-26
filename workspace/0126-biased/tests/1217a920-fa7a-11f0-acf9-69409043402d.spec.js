import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1217a920-fa7a-11f0-acf9-69409043402d.html';

test.describe('Backpropagation Interactive Demonstration (FSM) - 1217a920-fa7a-11f0-acf9-69409043402d', () => {
  // Will hold console messages and page errors observed during each test
  let consoleMessages = [];
  let pageErrors = [];
  let dialogs = [];

  test.beforeEach(async ({ page }) => {
    // reset trackers
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // auto-accept dialogs but record them
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
    // ensure page loaded
    await expect(page.locator('h1')).toHaveText(/Backpropagation Interactive Demonstration/);
  });

  test.afterEach(async () => {
    // sanity: ensure we recorded console and page errors arrays for debugging if needed
    // (actual assertions about pageErrors are in tests themselves)
  });

  test('Initial Idle state: page renders and interactive sections are hidden', async ({ page }) => {
    // Verify initial visible elements and hidden sections per Idle (S0_Idle)
    await expect(page.locator('#build-network')).toBeVisible();
    await expect(page.locator('#network-state-note')).toBeVisible();
    // Sections that should be hidden initially
    await expect(page.locator('#network-config')).toHaveCSS('display', 'none');
    await expect(page.locator('#training-inputs')).toHaveCSS('display', 'none');
    await expect(page.locator('#training-controls')).toHaveCSS('display', 'none');
    await expect(page.locator('#example-forward')).toHaveCSS('display', 'none');
    await expect(page.locator('#backprop-steps')).toHaveCSS('display', 'none');

    // No runtime errors expected during initial load
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Network Build and Configuration (S1 -> S2)', () => {
    test('BuildNetwork: clicking Build Network transitions to Network Built and renders controls', async ({ page }) => {
      // Build the network with default values (inputs=2, hidden=2, outputs=1)
      await page.click('#build-network');

      // Network state note text updated
      await expect(page.locator('#network-state-note')).toHaveText(/Network built: 2 inputs → 2 hidden → 1 outputs/);

      // Previously hidden sections should now be visible
      await expect(page.locator('#network-config')).toBeVisible();
      await expect(page.locator('#training-inputs')).toBeVisible();
      await expect(page.locator('#training-controls')).toBeVisible();
      await expect(page.locator('#example-forward')).toBeVisible();
      await expect(page.locator('#backprop-steps')).toBeVisible();

      // Weights and biases controls rendered with numeric inputs
      const weightsInputs = await page.locator('#weights-biases-controls input[type="number"]').count();
      expect(weightsInputs).toBeGreaterThan(0);

      // Forward input default generated for number of inputs
      const forwardInput = await page.locator('#forward-input').inputValue();
      expect(forwardInput.split(',').length).toBe(2);

      // Ensure no uncaught page errors after building
      expect(pageErrors.length).toBe(0);
    });

    test('ResetWeights: clicking Reset All Weights & Biases updates the controls (values change)', async ({ page }) => {
      // Build first
      await page.click('#build-network');

      // capture some IH weights before reset
      const ihSelectors = await page.locator('#weights-biases-controls input[data-layer="IH"]').all();
      const ihBefore = [];
      for (let i = 0; i < ihSelectors.length; i++) {
        ihBefore.push(await ihSelectors[i].inputValue());
      }

      // click reset weights
      await page.click('#reset-weights');

      // capture after values
      const ihAfter = [];
      const ihSelectorsAfter = await page.locator('#weights-biases-controls input[data-layer="IH"]').all();
      for (let i = 0; i < ihSelectorsAfter.length; i++) {
        ihAfter.push(await ihSelectorsAfter[i].inputValue());
      }

      // At least one weight should change after reset (randomized). If all equal, it's extremely unlikely.
      const anyDifferent = ihBefore.some((v, idx) => v !== ihAfter[idx]);
      expect(anyDifferent).toBe(true);

      // No page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Training Examples (S3)', () => {
    test('AddTrainingExample: valid training example is added and rendered', async ({ page }) => {
      // Build network
      await page.click('#build-network');

      // Fill training input and target with correct lengths
      await page.fill('#training-input', '0.5, -0.3');
      await page.fill('#training-target', '1');

      // Add example
      await page.click('#add-training-example');

      // Verify training examples list updated
      const listText = await page.locator('#training-examples-list').innerText();
      expect(listText).toContain('Input: [0.500');
      expect(listText).toContain('Target: [1.000');

      // Ensure no alert was raised for success (dialogs recorded)
      // addTrainingExample uses alerts only on errors, so dialogs should remain empty
      expect(dialogs.length).toBe(0);

      // No page errors
      expect(pageErrors.length).toBe(0);
    });

    test('ClearTrainingExamples: clears list after adding', async ({ page }) => {
      // Build network and add sample
      await page.click('#build-network');
      await page.fill('#training-input', '0.1, 0.2');
      await page.fill('#training-target', '0');
      await page.click('#add-training-example');

      // Ensure added
      await expect(page.locator('#training-examples-list')).toContainText('Input:');

      // Clear
      await page.click('#clear-training-examples');

      // Ensure cleared text
      const clearedHtml = await page.locator('#training-examples-list').innerHTML();
      expect(clearedHtml).toContain('No training examples added.');

      expect(pageErrors.length).toBe(0);
    });

    test('AddTrainingExample: error when input length mismatches triggers alert', async ({ page }) => {
      await page.click('#build-network');
      // Enter wrong input length (only one number instead of 2)
      await page.fill('#training-input', '0.5');
      await page.fill('#training-target', '1');

      // Click add and expect an alert dialog about input length mismatch
      await page.click('#add-training-example');

      // One dialog should have been recorded
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const lastDialog = dialogs[dialogs.length - 1];
      expect(lastDialog.message).toMatch(/Input length mismatch/i);

      // Reset dialogs for subsequent tests
      dialogs = [];

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Training Actions (S4)', () => {
    test('TrainOneEpoch: clicking Train One Epoch shows alert with average loss', async ({ page }) => {
      await page.click('#build-network');
      // add training example
      await page.fill('#training-input', '0.2, 0.3');
      await page.fill('#training-target', '0.7');
      await page.click('#add-training-example');

      // Click train one epoch
      await page.click('#train-step');

      // train-step shows an alert; capture it
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const d = dialogs.pop();
      expect(d.message).toMatch(/Trained 1 epoch on all examples/i);
      expect(d.message).toMatch(/Average loss:/i);

      // No page errors from training execution
      expect(pageErrors.length).toBe(0);
    });

    test('TrainManyEpochs: clicking Train Multiple Epochs with valid count shows alert', async ({ page }) => {
      await page.click('#build-network');
      // add training example
      await page.fill('#training-input', '0.1, 0.2');
      await page.fill('#training-target', '0.0');
      await page.click('#add-training-example');

      // set epochs
      await page.fill('#train-many-count', '5');
      await page.click('#train-many');

      // expect dialog about training epochs
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const d = dialogs.pop();
      expect(d.message).toMatch(/Trained 5 epochs on all examples/i);
      expect(d.message).toMatch(/Average loss:/i);

      expect(pageErrors.length).toBe(0);
    });

    test('TrainOneEpoch: error scenario - clicking Train One Epoch with no training data triggers alert', async ({ page }) => {
      await page.click('#build-network');

      // ensure training examples cleared
      await page.click('#clear-training-examples');

      // click train-step expecting an alert about adding training data first
      await page.click('#train-step');

      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const d = dialogs.pop();
      expect(d.message).toMatch(/Add some training data first/i);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Forward Pass and Outputs (S5)', () => {
    test('RunForwardPass and ShowLayerOutputs reflect computed activations', async ({ page }) => {
      await page.click('#build-network');

      // Provide a valid forward input (length matches input count)
      await page.fill('#forward-input', '0.5, -0.5');
      await page.click('#run-forward');

      // Inspect forward-output: should contain "Output:" and array
      const forwardText = await page.locator('#forward-output').innerText();
      expect(forwardText).toMatch(/Output:/i);
      expect(forwardText).toMatch(/\[.*\]/);

      // Now click show layer outputs and ensure activations are reported
      await page.click('#show-layer-outputs');

      const layerText = await page.locator('#forward-output').innerText();
      expect(layerText).toMatch(/Hidden layer activations:/i);
      expect(layerText).toMatch(/Output layer activations:/i);

      expect(pageErrors.length).toBe(0);
    });

    test('RunForwardPass: invalid input vector is handled gracefully', async ({ page }) => {
      await page.click('#build-network');

      // Enter mismatched forward input length
      await page.fill('#forward-input', '1.0'); // should be 2 values
      await page.click('#run-forward');

      const forwardText = await page.locator('#forward-output').innerText();
      expect(forwardText).toContain('Invalid input vector.');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Backpropagation Step-Through (S6)', () => {
    test('StartBackpropagation: cannot start without training data', async ({ page }) => {
      await page.click('#build-network');
      // ensure no training data present
      await page.click('#clear-training-examples');
      await page.click('#start-bp-step');

      // Should get an alert asking to add training data
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const d = dialogs.pop();
      expect(d.message).toMatch(/Add training data to explore backpropagation steps/i);

      // No page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Full backpropagation step-through: start -> next -> prev -> cancel -> final commit', async ({ page }) => {
      await page.click('#build-network');

      // Add a training example so step-through can start
      await page.fill('#training-input', '0.4, -0.2');
      await page.fill('#training-target', '0.9');
      await page.click('#add-training-example');

      // Start the step-through
      await page.click('#start-bp-step');

      // After starting: next enabled, prev disabled, cancel enabled, start disabled
      await expect(page.locator('#next-bp-step')).toBeEnabled();
      await expect(page.locator('#prev-bp-step')).toBeDisabled();
      await expect(page.locator('#cancel-bp-step')).toBeEnabled();
      await expect(page.locator('#start-bp-step')).toBeDisabled();

      // Inspect bp output initial step (should be step 1)
      let bpText = await page.locator('#bp-step-output').innerText();
      expect(bpText).toMatch(/Step 1: Calculate output layer errors/);

      // Click next a few times to progress through steps
      await page.click('#next-bp-step'); // step 2
      bpText = await page.locator('#bp-step-output').innerText();
      expect(bpText).toMatch(/Step 2: Calculate output gradients/i);

      await page.click('#next-bp-step'); // step 3
      bpText = await page.locator('#bp-step-output').innerText();
      expect(bpText).toMatch(/Step 3: Calculate hidden layer errors/i);

      // Go back one step
      await page.click('#prev-bp-step'); // step 2 again
      bpText = await page.locator('#bp-step-output').innerText();
      expect(bpText).toMatch(/Step 2: Calculate output gradients/i);

      // Progress to the final completion step to commit updates
      // Repeatedly click next until disabled
      while (await page.locator('#next-bp-step').isEnabled()) {
        await page.click('#next-bp-step');
      }

      // After final step, next should be disabled
      expect(await page.locator('#next-bp-step').isEnabled()).toBe(false);
      bpText = await page.locator('#bp-step-output').innerText();
      expect(bpText).toMatch(/Backpropagation step is complete and weights and biases updated/i);

      // Now cancel the step-through and ensure UI resets (start enabled)
      await page.click('#cancel-bp-step');
      await expect(page.locator('#bp-step-output')).toHaveText('');
      await expect(page.locator('#start-bp-step')).toBeEnabled();
      await expect(page.locator('#next-bp-step')).toBeDisabled();
      await expect(page.locator('#prev-bp-step')).toBeDisabled();
      await expect(page.locator('#cancel-bp-step')).toBeDisabled();

      expect(pageErrors.length).toBe(0);
    });
  });

  test('ShowCurrentNetworkState (S1 / internal state): displays JSON snapshot of current network', async ({ page }) => {
    await page.click('#build-network');

    // Show current state
    await page.click('#show-state');

    const stateText = await page.locator('#network-state').innerText();
    expect(stateText).toContain('"inputCount":');
    expect(stateText).toContain('"hiddenCount":');
    expect(stateText).toContain('"outputCount":');
    expect(stateText).toContain('"weightsIH":');
    expect(stateText).toContain('"biasesH":');

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: invalid architecture inputs are rejected', async ({ page }) => {
    // Enter invalid architecture values and attempt to build
    await page.fill('#input-nodes', '0'); // invalid (min 1)
    await page.fill('#hidden-nodes', '0');
    await page.fill('#output-nodes', '0');

    await page.click('#build-network');

    // Should see an alert about invalid architecture inputs
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const d = dialogs.pop();
    expect(d.message).toMatch(/Invalid architecture inputs/i);

    // Reset inputs back to valid for subsequent tests
    await page.fill('#input-nodes', '2');
    await page.fill('#hidden-nodes', '2');
    await page.fill('#output-nodes', '1');

    expect(pageErrors.length).toBe(0);
  });

  test('Observe console messages and ensure no uncaught page errors during complex interactions', async ({ page }) => {
    // Do a sequence of actions: build, add training, train one epoch, forward pass, start bp and cancel
    await page.click('#build-network');

    await page.fill('#training-input', '0.5, 0.5');
    await page.fill('#training-target', '0.1');
    await page.click('#add-training-example');

    await page.click('#train-step');
    // consume the train dialog
    if (dialogs.length) dialogs.pop();

    await page.fill('#forward-input', '0.1, 0.2');
    await page.click('#run-forward');

    await page.click('#start-bp-step');
    // cancel
    await page.click('#cancel-bp-step');

    // After the interactions ensure no uncaught page errors were recorded
    expect(pageErrors.length).toBe(0);

    // Bonus: there should be some console messages captured (not necessarily required)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });
});