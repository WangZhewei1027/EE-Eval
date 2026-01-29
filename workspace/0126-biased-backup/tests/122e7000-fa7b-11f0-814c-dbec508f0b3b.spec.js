import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122e7000-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Overfitting interactive app
class OverfittingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.learningRate = page.locator('#learning_rate');
    this.learningRateValue = page.locator('#learning_rate_value');
    this.batchSize = page.locator('#batch_size');
    this.batchSizeValue = page.locator('#batch_size_value');
    this.epochs = page.locator('#epochs');
    this.epochsValue = page.locator('#epochs_value');
    this.optimizer = page.locator('#optimizer');
    this.trainButton = page.locator('#train_button');
    this.graph = page.locator('#graph');
    this.h1 = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Set range input value and dispatch input event so page-level listeners (if any) would run.
  async setRangeValue(locator, value) {
    await locator.evaluate((el, v) => {
      // This will change the value and emit an input event.
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async clickTrainExpectingError(timeout = 5000) {
    // Start listening for pageerror before clicking so synchronous exceptions are captured.
    const waitForError = this.page.waitForEvent('pageerror', { timeout });
    await this.trainButton.click();
    const err = await waitForError;
    return err;
  }

  async clickTrainCaptureConsoleError(timeout = 5000) {
    // Another approach capturing console 'error' messages
    let consoleMessage = null;
    const listener = (msg) => {
      if (msg.type() === 'error') {
        consoleMessage = msg;
      }
    };
    this.page.on('console', listener);
    await this.trainButton.click();
    // wait briefly for console errors to propagate
    await this.page.waitForTimeout(250);
    this.page.off('console', listener);
    return consoleMessage;
  }
}

test.describe('Overfitting FSM - Idle (S0_Idle) and Training (S1_Training)', () => {
  let pageObject;

  test.beforeEach(async ({ page }) => {
    pageObject = new OverfittingPage(page);
    // Navigate to the app page before each test
    await pageObject.goto();
  });

  // Idle state validations
  test.describe('Idle State (S0_Idle) validations', () => {
    test('Page loads and shows the Idle state heading and controls', async ({ page }) => {
      // Validate heading exists as evidence for S0_Idle
      await expect(pageObject.h1).toHaveText('Overfitting');

      // Validate controls presence
      await expect(pageObject.learningRate).toBeVisible();
      await expect(pageObject.batchSize).toBeVisible();
      await expect(pageObject.epochs).toBeVisible();
      await expect(pageObject.optimizer).toBeVisible();
      await expect(pageObject.trainButton).toBeVisible();
    });

    test('Inputs have expected default attributes and displayed values', async ({ page }) => {
      // Check slider attributes and default values match implementation
      await expect(pageObject.learningRate).toHaveAttribute('min', '0.01');
      await expect(pageObject.learningRate).toHaveAttribute('max', '0.1');
      await expect(pageObject.learningRate).toHaveValue('0.05');
      await expect(pageObject.learningRateValue).toHaveText('0.05');

      await expect(pageObject.batchSize).toHaveAttribute('min', '32');
      await expect(pageObject.batchSize).toHaveAttribute('max', '1024');
      await expect(pageObject.batchSize).toHaveValue('128');
      await expect(pageObject.batchSizeValue).toHaveText('128');

      await expect(pageObject.epochs).toHaveAttribute('min', '1');
      await expect(pageObject.epochs).toHaveAttribute('max', '100');
      await expect(pageObject.epochs).toHaveValue('10');
      await expect(pageObject.epochsValue).toHaveText('10');

      // Optimizer select default
      await expect(pageObject.optimizer).toHaveValue('adam');
    });

    test('Changing range inputs updates the input.value but displayed span does not (no binding present)', async ({ page }) => {
      // Change learning rate slider value programmatically
      await pageObject.setRangeValue(pageObject.learningRate, '0.08');

      // The actual input element should reflect the new value
      await expect(pageObject.learningRate).toHaveValue('0.08');

      // There is no JavaScript hooked up to update the text span, so the displayed span should remain the original string
      // This verifies the current DOM behavior (edge case / missing binding)
      await expect(pageObject.learningRateValue).toHaveText('0.05');

      // Repeat for batch size
      await pageObject.setRangeValue(pageObject.batchSize, '256');
      await expect(pageObject.batchSize).toHaveValue('256');
      await expect(pageObject.batchSizeValue).toHaveText('128');

      // Repeat for epochs
      await pageObject.setRangeValue(pageObject.epochs, '20');
      await expect(pageObject.epochs).toHaveValue('20');
      await expect(pageObject.epochsValue).toHaveText('10');
    });

    test('Selecting optimizer option changes the select value in the DOM', async ({ page }) => {
      // Change optimizer to SGD
      await pageObject.optimizer.selectOption('sgd');
      await expect(pageObject.optimizer).toHaveValue('sgd');

      // Change optimizer to RMSProp
      await pageObject.optimizer.selectOption('rmsprop');
      await expect(pageObject.optimizer).toHaveValue('rmsprop');

      // Note: the global `optimizer` JS variable is not necessarily bound to select changes since no event handler is defined.
      // We are validating DOM behavior here.
    });
  });

  // Training state and transitions validations
  test.describe('Training State (S1_Training) and TrainButton transition', () => {
    test('Clicking Train triggers the train() entry action and results in runtime errors (observed as page errors)', async ({ page }) => {
      // Before clicking, ensure graph is empty
      await expect(pageObject.graph).toBeVisible();
      const initialChildren = await page.evaluate(() => document.getElementById('graph').children.length);
      expect(initialChildren).toBe(0);

      // Click the train button and wait for a page error event to be emitted.
      // The application contains several intentional/accidental runtime problems (e.g., recursive constructors, undefined Graph),
      // so we expect a runtime exception to be thrown when train() executes. We capture that error.
      const [err] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 5000 }),
        pageObject.trainButton.click()
      ]);

      // Validate that an error occurred and the message indicates known issues (stack overflow / undefined identifier)
      // We allow multiple possible error messages because different engines show errors differently.
      expect(err).toBeTruthy();
      expect(err.message).toMatch(/Maximum call stack size exceeded|call stack|Graph is not defined|ReferenceError|RangeError|TypeError/);

      // After the error, the graph container should not have a proper rendered canvas appended (train failed)
      const childCount = await page.evaluate(() => document.getElementById('graph').children.length);
      expect(childCount).toBe(0);
    });

    test('Console shows error messages when training is attempted (capture console.error)', async ({ page }) => {
      // Listen for console.error
      let consoleError = null;
      const onConsole = (msg) => {
        if (msg.type() === 'error') {
          consoleError = msg;
        }
      };
      page.on('console', onConsole);

      // Click train; because errors are thrown synchronously/asynchronously, wait a short while afterwards
      await pageObject.trainButton.click();
      await page.waitForTimeout(500); // give console messages time to arrive
      page.off('console', onConsole);

      // We expect at least one console.error message to have been recorded
      expect(consoleError).not.toBeNull();
      const text = consoleError.text();
      expect(text).toMatch(/ReferenceError|RangeError|Maximum call stack|Graph is not defined|Uncaught/);
    });

    test('Multiple train attempts continue to emit errors (robustness check)', async ({ page }) => {
      // First attempt
      let err1 = null;
      try {
        const p1 = Promise.all([page.waitForEvent('pageerror', { timeout: 4000 }), pageObject.trainButton.click()]);
        const result = await p1;
        err1 = result[0];
      } catch (e) {
        // It's acceptable if waitForEvent times out in some environments; capture fallback via console
        // But we still record that an error or some failure is expected behavior.
      }

      // Ensure some indication of runtime problem exists (either pageerror object or console error)
      let consoleError = null;
      const listener = (msg) => { if (msg.type() === 'error') consoleError = msg; };
      page.on('console', listener);
      // Second attempt
      await pageObject.trainButton.click();
      await page.waitForTimeout(300);
      page.off('console', listener);

      expect(err1 || consoleError).toBeTruthy();
      // If we have a console error, ensure it mentions a runtime issue
      if (consoleError) {
        expect(consoleError.text()).toMatch(/ReferenceError|RangeError|Maximum call stack|Graph is not defined|Uncaught/);
      } else if (err1) {
        expect(err1.message).toMatch(/ReferenceError|RangeError|Maximum call stack|Graph is not defined|TypeError/);
      }
    });
  });

  // Additional edge-case tests demonstrating broken internal implementations
  test.describe('Edge cases and error scenarios (demonstrate broken implementations)', () => {
    test('Verify that graph creation uses an undefined Graph constructor (observed via ReferenceError in some runs)', async ({ page }) => {
      // The app's train() attempts to append new Graph(x, y) while the defined helper is newGraph (lowercase).
      // This mismatch should lead to a ReferenceError about Graph not being defined in many environments.
      // We listen for either pageerror or console.error and assert that Graph-related text appears.

      // Prepare to capture either a pageerror or console error
      const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 4000 }).catch(() => null);

      // Also capture console errors
      let consoleErrMessage = null;
      const onConsole = (msg) => {
        if (msg.type() === 'error') {
          consoleErrMessage = msg.text();
        }
      };
      page.on('console', onConsole);

      // Trigger training
      await pageObject.trainButton.click();

      const pageErr = await pageErrorPromise;
      // give console a small window
      await page.waitForTimeout(250);
      page.off('console', onConsole);

      // At least one of these should indicate a problem referencing Graph or an unexpected runtime problem.
      const evidence = (pageErr && pageErr.message) ? pageErr.message : consoleErrMessage;
      expect(evidence).toBeTruthy();
      expect(evidence).toMatch(/Graph is not defined|Graph|Maximum call stack|ReferenceError|RangeError/);
    });

    test('Model/NeuralNetwork recursive construction causes stack issues (RangeError expected)', async ({ page }) => {
      // The implementation contains a recursive creation of NeuralNetwork inside its own constructor (in the first script block),
      // which will typically cause a "Maximum call stack size exceeded" RangeError when Model is instantiated during train().
      // We assert that such an error occurs when attempting to train.

      // Start waiting for pageerror then click
      const [err] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 5000 }).catch(() => null),
        pageObject.trainButton.click()
      ]);

      // Ensure we observed an error and it likely relates to recursion / stack overflow.
      expect(err).toBeTruthy();
      expect(err.message).toMatch(/Maximum call stack size exceeded|call stack|RangeError/);
    });
  });
});