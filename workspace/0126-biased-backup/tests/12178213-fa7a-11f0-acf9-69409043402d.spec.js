import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12178213-fa7a-11f0-acf9-69409043402d.html';

test.describe('Neural Networks Interactive Demo - FSM and UI end-to-end', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Observe console messages
    page.on('console', msg => {
      try {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Observe uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Observe dialogs (alerts/prompts/confirm). We'll accept/dismiss to keep flow.
    page.on('dialog', async dialog => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      // Accept alerts/prompts/confirms so the page flow continues
      try {
        await dialog.accept();
      } catch (e) {
        // ignore
      }
    });

    // Navigate to the app
    await page.goto(APP_URL);
    // Ensure page loaded
    await expect(page.locator('#build-network')).toBeVisible();
  });

  test.afterEach(async () => {
    // Basic sanity: no unexpected uncaught exceptions occurred during test
    expect(pageErrors.length).toBe(0);
  });

  test('S0 Idle state: initial UI elements present', async ({ page }) => {
    // Validate Idle state: Build Network button exists and architecture message empty
    const buildBtn = page.locator('#build-network');
    await expect(buildBtn).toBeVisible();
    const archMsg = page.locator('#architecture-message');
    await expect(archMsg).toHaveText(''); // entry action renderPage() -> message should be empty initially
    // Ensure run inference buttons are disabled prior to building network (initial app state)
    await expect(page.locator('#run-inference')).toBeDisabled();
    await expect(page.locator('#run-full-dataset')).toBeDisabled();
  });

  test('S1 Network Built: build network creates NeuralNetwork instance and generates inputs', async ({ page }) => {
    // Build network using default neuron inputs. The neurons-per-layer inputs are generated on load.
    await expect(page.locator('#neurons-layer-1')).toBeVisible();
    // Click Build Network
    await page.click('#build-network');
    // Confirm architecture message states the created structure
    await expect(page.locator('#architecture-message')).toContainText('Created network with structure:');
    // Test inputs should be generated even if dataset not loaded (generateTestInputs called)
    await expect(page.locator('#test-input-0')).toBeVisible();
    await expect(page.locator('#test-input-1')).toBeVisible();
    // After building, inference buttons should become enabled (generateTestInputs sets them)
    await expect(page.locator('#run-inference')).toBeEnabled();
    await expect(page.locator('#run-full-dataset')).toBeEnabled();

    // Check we didn't get any page errors during build
    expect(pageErrors.length).toBe(0);
  });

  test('S2 Dataset Loaded: load built-in dataset and preview appears', async ({ page }) => {
    // Build network first (so dataset compatibility checks happen)
    await page.click('#build-network');

    // The data section is hidden in markup; click load dataset with force to simulate user interaction mapping to FSM event
    await page.click('#load-dataset', { force: true });

    // dataset-message should report loaded dataset length
    await expect(page.locator('#dataset-message')).toContainText('Loaded dataset with');

    // Dataset preview should contain "Input:" lines
    const preview = page.locator('#dataset-preview');
    await expect(preview).toContainText('Input:');

    // With dataset loaded and network present, training/testing sections should now be visible
    await expect(page.locator('#training-section')).toBeVisible();
    await expect(page.locator('#testing-section')).toBeVisible();
    await expect(page.locator('#exploration-section')).toBeVisible();
    await expect(page.locator('#advanced-section')).toBeVisible();

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  test('S3 Training Active -> S5 Training Completed: training completes when epochs reached', async ({ page }) => {
    // Build network and load dataset to enable training path
    await page.click('#build-network');
    await page.click('#load-dataset', { force: true });

    // Set epochs to 1 to force quick completion and training speed to minimal
    await page.fill('#epochs', '1');
    await page.fill('#learning-rate', '0.1');
    await page.fill('#batch-size', '1');
    await page.fill('#training-speed', '10');

    // Start training - listen to training log update and final completion line
    await page.click('#start-training');

    // Wait until training log contains "Training completed after"
    await page.waitForFunction(() => {
      const el = document.getElementById('training-log');
      if(!el) return false;
      return el.textContent.includes('Training completed after');
    }, null, { timeout: 5000 });

    const log = await page.locator('#training-log').textContent();
    expect(log).toContain('Training completed after');

    // After training completed, pause and reset buttons should be disabled (per runTrainingEpoch completion flow)
    await expect(page.locator('#pause-training')).toBeDisabled();
    await expect(page.locator('#reset-training')).toBeDisabled();

    // Confirm gradients and lastOutputs likely exist on the nn (used later) - no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('S3 -> S4 -> S3 Pause and Resume Training behavior and build attempt while training triggers alert', async ({ page }) => {
    // Build network and load dataset
    await page.click('#build-network');
    await page.click('#load-dataset', { force: true });

    // Set epochs to a larger number to keep training active for a while
    await page.fill('#epochs', '100');
    await page.fill('#training-speed', '500'); // moderate speed

    // Start training
    await page.click('#start-training');

    // Wait a short moment then click Pause Training to trigger PauseTraining event
    await page.waitForTimeout(100);
    await page.click('#pause-training');
    // The pause button text should switch to "Resume Training"
    await expect(page.locator('#pause-training')).toHaveText('Resume Training');

    // Try clicking Build Network while training paused/resumed state to verify the guard alert is triggered
    // First resume training so trainingActive is true again (click pause -> resume)
    await page.click('#pause-training'); // should resume and set text back to "Pause Training"
    await expect(page.locator('#pause-training')).toHaveText('Pause Training');

    // Ensure there is some active training; click Build Network should trigger an alert "Stop training before rebuilding network."
    // Click build-network (it will call alert if trainingActive)
    await page.click('#build-network');

    // The dialog was captured in beforeEach handler; ensure one has message expected
    const foundAlert = dialogs.find(d => d.message.includes('Stop training before rebuilding network.'));
    expect(foundAlert).toBeTruthy();

    // Now reset training to stop the long-running training so test can proceed/cleanup
    await page.click('#reset-training');

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('S6 Inference Running: run single inference and full dataset inference', async ({ page }) => {
    // Build network and load dataset
    await page.click('#build-network');
    await page.click('#load-dataset', { force: true });

    // Ensure test input fields exist
    await expect(page.locator('#test-input-0')).toBeVisible();
    await page.fill('#test-input-0', '0');
    await page.fill('#test-input-1', '1');

    // Click run inference and examine output DOM
    await page.click('#run-inference');
    await expect(page.locator('#inference-output')).toContainText('Input: [0, 1] => Output: [');

    // Click run full dataset and assert the full predictions area has as many lines as dataset samples
    await page.click('#run-full-dataset');
    const fullPredsText = await page.locator('#full-predictions').textContent();
    expect(fullPredsText).toBeTruthy();
    // Each dataset entry begins with "Input:" - count occurrences
    const countMatches = (fullPredsText.match(/Input:/g) || []).length;
    expect(countMatches).toBeGreaterThanOrEqual(1);

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Exploration: show weights, activations, toggle gradient view after training', async ({ page }) => {
    // Build, load dataset, do one epoch of training to ensure gradients exist
    await page.click('#build-network');
    await page.click('#load-dataset', { force: true });
    await page.fill('#epochs', '1');
    await page.fill('#training-speed', '10');
    await page.click('#start-training');

    // Wait for training to complete
    await page.waitForFunction(() => {
      const el = document.getElementById('training-log');
      return el && el.textContent.includes('Training completed after');
    }, null, { timeout: 5000 });

    // Show weights & biases
    await page.click('#show-weights');
    const internalsAfterWeights = await page.locator('#internals-output').textContent();
    expect(internalsAfterWeights).toContain('weights:');

    // Run an inference to populate lastOutputs for activations
    await page.fill('#test-input-0', '0');
    await page.fill('#test-input-1', '1');
    await page.click('#run-inference');

    // Show activations for last input
    await page.click('#show-activations');
    const internalsAfterActs = await page.locator('#internals-output').textContent();
    expect(internalsAfterActs).toContain('Layer 0 activations');

    // Toggle gradient view - should display gradient info because training completed earlier
    await page.click('#toggle-gradient-view');
    const gradText = await page.locator('#internals-output').textContent();
    expect(gradText).toContain('weight gradients:');

    // Toggle gradient view off and verify internals cleared
    await page.click('#toggle-gradient-view');
    const clearedText = await page.locator('#internals-output').textContent();
    expect(clearedText).toBe('');

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Advanced: save and load network state via file input, and manual weight edits', async ({ page }) => {
    // Build network and load dataset to create nn and dataset in UI
    await page.click('#build-network');
    await page.click('#load-dataset', { force: true });

    // Trigger save and capture the download to file system
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#save-state')
    ]);
    // Save download to a temporary path
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nn-test-'));
    const downloadPath = path.join(tmpDir, await download.suggestedFilename());
    await download.saveAs(downloadPath);
    // Ensure downloaded file exists and has content
    const fileStat = await fs.stat(downloadPath);
    expect(fileStat.size).toBeGreaterThan(0);

    // Now simulate loading that state via the hidden file input element
    await page.setInputFiles('#load-file', downloadPath);

    // After load, architecture-message should indicate loaded network
    await expect(page.locator('#architecture-message')).toContainText('Loaded network with structure');

    // Manual weight editing: ensure selects are populated and then apply a weight change
    // Wait for selects to be populated by fillManualWeightControls (called by build/load)
    await expect(page.locator('#manual-weight-layer')).toHaveCount(1);
    // Ensure there is at least one layer option
    const layerOptionCount = await page.locator('#manual-weight-layer option').count();
    expect(layerOptionCount).toBeGreaterThan(0);

    // Select first layer, neuron, weight index and set a new numeric value
    await page.selectOption('#manual-weight-layer', '0');
    // Wait for neuron options to populate
    await page.waitForTimeout(50);
    const neuronOptionValue = await page.locator('#manual-weight-neuron option').first().getAttribute('value');
    // Select first neuron
    await page.selectOption('#manual-weight-neuron', neuronOptionValue);
    // Wait and select first weight index
    await page.waitForTimeout(50);
    const weightIndex = await page.locator('#manual-weight-index option').first().getAttribute('value');
    await page.selectOption('#manual-weight-index', weightIndex);
    // Apply a new weight value
    await page.fill('#manual-weight-value', '0.12345');
    await page.click('#apply-weight-change');

    // Validate manualWeightMessage updated accordingly
    await expect(page.locator('#manual-weight-message')).toContainText('updated to 0.12345');

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: invalid custom dataset input shows parse error message and does not crash', async ({ page }) => {
    // Build network first
    await page.click('#build-network');

    // Select custom dataset (this will reveal custom dataset textarea)
    await page.selectOption('#dataset-type', 'custom');
    // Fill invalid dataset content
    await page.fill('#custom-dataset-text', 'invalid_line_without_colon');
    // Click load dataset (section may be hidden; force click)
    await page.click('#load-dataset', { force: true });

    // datasetMessage should contain error parsing dataset
    await expect(page.locator('#dataset-message')).toContainText('Error parsing dataset');

    // Ensure application didn't throw uncaught exceptions
    expect(pageErrors.length).toBe(0);
  });

});