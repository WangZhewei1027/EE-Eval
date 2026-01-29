import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3e2391-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Neural Network Visualization - FSM validation', () => {
  // Arrays to collect console and page errors for assertions
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture all console messages and categorize errors separately
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture unhandled page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the application page and wait for network idle to allow onload/initNetwork to run
    await page.goto(APP_URL, { waitUntil: 'networkidle' });

    // Wait a short while to allow window.onload and initNetwork to complete drawing weights
    await page.waitForTimeout(200);
  });

  test.afterEach(async () => {
    // no-op: individual tests do not need special teardown here
  });

  test.describe('Initialization (S0_Idle) - initNetwork on load', () => {
    test('should call initNetwork on load and draw initial weights (expect 8 connections)', async ({ page }) => {
      // Verify weights array exists on the window and has the expected nested structure
      const weightsShape = await page.evaluate(() => {
        // Do not modify anything, just inspect the global 'weights' variable
        if (!window.weights) return null;
        return {
          topLevelLength: window.weights.length,
          firstMatrixDims: window.weights[0] ? [window.weights[0].length, window.weights[0][0] ? window.weights[0][0].length : 0] : null,
          secondMatrixDims: window.weights[1] ? [window.weights[1].length, window.weights[1][0] ? window.weights[1][0].length : 0] : null
        };
      });

      // Expect the weights global to match expected dimensions:
      // weights[0] -> 3 x 2, weights[1] -> 2 x 1
      expect(weightsShape).not.toBeNull();
      expect(weightsShape.topLevelLength).toBe(2);
      expect(weightsShape.firstMatrixDims).toEqual([3, 2]);
      expect(weightsShape.secondMatrixDims).toEqual([2, 1]);

      // Verify that .weight divs were drawn (should be 3*2 + 2*1 = 8)
      const weightsCount = await page.locator('#weights .weight').count();
      expect(weightsCount).toBe(8);

      // Verify that the initial neuron labels are present (X1..Y)
      const inputTexts = await page.locator('.input-layer .neuron').allTextContents();
      expect(inputTexts).toEqual(expect.arrayContaining(['X1', 'X2', 'X3']));

      const hiddenTexts = await page.locator('.hidden-layer .neuron').allTextContents();
      expect(hiddenTexts).toEqual(expect.arrayContaining(['H1', 'H2']));

      const outputText = await page.locator('.output-layer .neuron').textContent();
      expect(outputText.trim()).toBe('Y');

      // Assert that there were no immediate page errors during initialization
      expect(pageErrors).toEqual([]);
      // Assert that there were no console.error messages logged during initialization
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Forward Pass (S1_ForwardPass) - activateNetwork()', () => {
    test('clicking "Run Forward Pass" triggers animate and updates neuron values and styles', async ({ page }) => {
      // Click the Run Forward Pass button (selector from FSM)
      const runButton = page.locator("button[onclick='activateNetwork()']");
      await expect(runButton).toBeVisible();
      await runButton.click();

      // Wait long enough for the animation/timeouts in activateNetwork to complete:
      // The script uses staggered setTimeouts up to ~400 + 300 + 200 = 900ms, allow buffer
      await page.waitForTimeout(1200);

      // After activation, input neurons should show numeric values (e.g. "0.12")
      const inputNeurons = page.locator('.input-layer .neuron');
      const inputCount = await inputNeurons.count();
      expect(inputCount).toBe(3);
      for (let i = 0; i < inputCount; i++) {
        const text = (await inputNeurons.nth(i).textContent()).trim();
        // Should be formatted as a number with 2 decimals (e.g., "0.12")
        expect(text).toMatch(/^\d?\.\d{2}$/);
        // Style transform should have scale
        const style = await inputNeurons.nth(i).getAttribute('style');
        expect(style).toEqual(expect.stringContaining('transform'));
        expect(style).toEqual(expect.stringContaining('scale('));
      }

      // Hidden neurons should have numeric activations and customized background-color style
      const hiddenNeurons = page.locator('.hidden-layer .neuron');
      const hiddenCount = await hiddenNeurons.count();
      expect(hiddenCount).toBe(2);
      for (let i = 0; i < hiddenCount; i++) {
        const text = (await hiddenNeurons.nth(i).textContent()).trim();
        expect(text).toMatch(/^\d?\.\d{2}$/);
        const style = await hiddenNeurons.nth(i).getAttribute('style');
        expect(style).toEqual(expect.stringContaining('transform'));
        // The script sets backgroundColor via style - ensure it's present
        expect(style).toEqual(expect.stringContaining('background-color') || expect.stringContaining('backgroundColor'));
      }

      // Output neuron should also be updated to a numeric activation
      const outputNeuron = page.locator('.output-layer .neuron');
      const outputText = (await outputNeuron.textContent()).trim();
      expect(outputText).toMatch(/^\d?\.\d{2}$/);
      const outputStyle = await outputNeuron.getAttribute('style');
      expect(outputStyle).toEqual(expect.stringContaining('transform'));
      expect(outputStyle).toEqual(expect.stringContaining('background-color') || expect.stringContaining('backgroundColor'));

      // Ensure no uncaught errors happened during forward pass
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('repeated fast clicks on Run Forward Pass do not produce uncaught exceptions (edge case)', async ({ page }) => {
      const runButton = page.locator("button[onclick='activateNetwork()']");
      await expect(runButton).toBeVisible();

      // Rapidly click the button multiple times
      await runButton.click();
      await runButton.click();
      await runButton.click();

      // Wait sufficiently for all timeouts to have settled
      await page.waitForTimeout(1500);

      // No page errors should be thrown even under rapid repeated activation
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);

      // Ensure output neuron contains a numeric value after repeated activations
      const outputText = (await page.locator('.output-layer .neuron').textContent()).trim();
      expect(outputText).toMatch(/^\d?\.\d{2}$/);
    });
  });

  test.describe('Randomize Weights (S2_WeightsRandomized) - randomizeWeights()', () => {
    test('clicking "Randomize Weights" updates the weights and redraws connections', async ({ page }) => {
      const weightsContainer = page.locator('#weights');
      await expect(weightsContainer).toBeVisible();

      // Capture weights container HTML before randomization
      const beforeHTML = await weightsContainer.evaluate(node => node.innerHTML);

      // Click the Randomize Weights button (selector from FSM)
      const randButton = page.locator("button[onclick='randomizeWeights()']");
      await expect(randButton).toBeVisible();
      await randButton.click();

      // Wait briefly for drawWeights to run
      await page.waitForTimeout(200);

      // Capture weights container HTML after randomization
      const afterHTML = await weightsContainer.evaluate(node => node.innerHTML);

      // There should still be 8 weight elements
      const weightsCount = await page.locator('#weights .weight').count();
      expect(weightsCount).toBe(8);

      // The innerHTML should have changed due to new weight elements/styles (very likely)
      // Use a sanity check: innerHTML before and after should not be strictly equal
      expect(afterHTML).not.toBe(beforeHTML);

      // Verify that global weights array changed values and still has expected dimensions
      const weightsShape = await page.evaluate(() => {
        if (!window.weights) return null;
        return {
          firstMatrixDims: [window.weights[0].length, window.weights[0][0] ? window.weights[0][0].length : 0],
          secondMatrixDims: [window.weights[1].length, window.weights[1][0] ? window.weights[1][0].length : 0],
        };
      });
      expect(weightsShape.firstMatrixDims).toEqual([3, 2]);
      expect(weightsShape.secondMatrixDims).toEqual([2, 1]);

      // Ensure no uncaught exceptions occurred during randomization
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('multiple randomize clicks keep the DOM stable and do not throw (edge case)', async ({ page }) => {
      const randButton = page.locator("button[onclick='randomizeWeights()']");
      await expect(randButton).toBeVisible();

      // Click multiple times
      await randButton.click();
      await randButton.click();
      await randButton.click();

      // Wait for redraws
      await page.waitForTimeout(300);

      // Verify still 8 weight elements
      const weightsCount = await page.locator('#weights .weight').count();
      expect(weightsCount).toBe(8);

      // No errors on repeated randomization
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('FSM Transitions and Actions - combined scenarios', () => {
    test('Idle -> Forward Pass transition and then Idle -> Randomize Weights works sequentially', async ({ page }) => {
      // Start from initial state: ensure initNetwork was called
      const initialWeightsCount = await page.locator('#weights .weight').count();
      expect(initialWeightsCount).toBe(8);

      // Transition: Idle -> Forward Pass
      await page.locator("button[onclick='activateNetwork()']").click();
      await page.waitForTimeout(1200);

      // Verify output updated
      const outputText = (await page.locator('.output-layer .neuron').textContent()).trim();
      expect(outputText).toMatch(/^\d?\.\d{2}$/);

      // Transition: Idle -> Randomize Weights (from Idle conceptually; function can be called any time)
      await page.locator("button[onclick='randomizeWeights()']").click();
      await page.waitForTimeout(200);

      // Verify weights redrawn
      const weightsCountAfter = await page.locator('#weights .weight').count();
      expect(weightsCountAfter).toBe(8);

      // Verify that neurons still have their activation text (forward pass values remain until next activation)
      const outTextAfter = (await page.locator('.output-layer .neuron').textContent()).trim();
      expect(outTextAfter).toMatch(/^\d?\.\d{2}$/);

      // No runtime errors during sequence
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Console and Error observation', () => {
    test('should not produce ReferenceError, SyntaxError, or TypeError during load and interactions', async ({ page }) => {
      // The prior interactions in beforeEach have already run; ensure that pageErrors and consoleErrors are empty
      // We will perform an additional quick interaction to ensure stability: click both buttons once
      await page.locator("button[onclick='activateNetwork()']").click();
      await page.locator("button[onclick='randomizeWeights()']").click();

      // Allow time for possible errors to surface
      await page.waitForTimeout(1000);

      // Collect any console messages of type 'error'
      // Assert there are no uncaught page errors (ReferenceError/TypeError/etc.)
      expect(pageErrors).toEqual([]);

      // Assert there were no console.error messages
      expect(consoleErrors).toEqual([]);

      // As a guard, assert that any console messages captured are informational (log/warn/info)
      for (const msg of consoleMessages) {
        expect(['log', 'info', 'warning', 'warn', 'debug']).toContain(msg.type);
      }
    });
  });
});