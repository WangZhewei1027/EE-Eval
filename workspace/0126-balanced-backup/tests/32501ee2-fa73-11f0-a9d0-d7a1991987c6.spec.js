import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/32501ee2-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Neural Networks Demo (FSM Validation) - 32501ee2-fa73-11f0-a9d0-d7a1991987c6', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Navigate to the page for each test and attach listeners to observe runtime behavior
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages with their types and text
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Attach the console and error arrays to the test attachments for easier debugging when running tests
    // Note: test.info().attach cannot be used in all environments; keep minimal teardown.
    // Close the page to ensure a clean environment for the next test
    await page.close();
  });

  test('Initial Idle State: canvas drawn on load (entry action draw executed)', async ({ page }) => {
    // This test validates the initial S0_Idle state's entry action: draw(trainingData..., [])
    // We verify that the canvas contains non-empty drawing after page load.
    const canvas = await page.$('#canvas');
    expect(canvas, 'canvas element should be present').not.toBeNull();

    // Get a data URL snapshot of the canvas after initial draw
    const dataUrl = await page.evaluate(() => {
      const c = document.getElementById('canvas');
      // toDataURL will reflect the drawn content; return its length and a small sample
      try {
        const url = c.toDataURL();
        return { length: url.length, sample: url.slice(0, 50) };
      } catch (e) {
        return { length: 0, sample: '' };
      }
    });

    // Basic sanity checks: dataUrl should be a non-empty PNG data URL string
    expect(typeof dataUrl.length).toBe('number');
    expect(dataUrl.length).toBeGreaterThan(1000); // ensure something was drawn (image data length non-trivial)

    // Ensure no unexpected runtime page errors occurred during initial draw
    expect(pageErrors.length, 'no page errors during initial load/draw').toBe(0);

    // Ensure console did not log any error messages during initial load
    const errorConsoles = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length, 'no console errors during initial load').toBe(0);
  });

  test('TrainButton existence and event handler wiring (transition S0_Idle -> S1_Training)', async ({ page }) => {
    // Validate the presence of the Train Neural Network button
    const trainBtn = await page.$('#trainBtn');
    expect(trainBtn, 'Train button should be present').not.toBeNull();

    // Verify that an onclick handler is attached to the button (evidence in FSM)
    const onclickType = await page.evaluate(() => {
      const btn = document.getElementById('trainBtn');
      // Return whether onclick is a function and a string-snippet of its source if possible
      return {
        hasOnclick: typeof btn.onclick === 'function',
        sourceSnippet: btn.onclick ? btn.onclick.toString().slice(0, 200) : ''
      };
    });
    expect(onclickType.hasOnclick, 'trainBtn.onclick should be a function').toBe(true);
    expect(onclickType.sourceSnippet.includes('for (let i = 0; i < 10000; i++)'), 'onclick should contain training loop evidence').toBe(true);
  });

  test('Clicking Train button transitions to Training state and updates DOM (S1_Training entry actions)', async ({ page }) => {
    // Ensure initial result div is empty (Idle state)
    const resultBefore = await page.$eval('#result', el => el.innerText);
    expect(resultBefore, 'result should be empty in Idle state').toBe('');

    // Capture canvas snapshot before training
    const beforeDataUrl = await page.$eval('#canvas', c => c.toDataURL());

    // Click the train button to trigger the training transition
    await page.click('#trainBtn');

    // Wait for the DOM update from the S1_Training state's entry actions
    await page.waitForFunction(() => {
      const el = document.getElementById('result');
      return el && el.innerText === 'Neural Network Trained!';
    }, { timeout: 10000 });

    // Verify the result message was set by the Training state's entry actions
    const resultAfter = await page.$eval('#result', el => el.innerText);
    expect(resultAfter).toBe('Neural Network Trained!');

    // Verify that the canvas was redrawn with predictions after training (post-training draw)
    const afterDataUrl = await page.$eval('#canvas', c => c.toDataURL());
    expect(afterDataUrl).not.toBe(beforeDataUrl);

    // Verify that neural network predictions exist and are in a reasonable range
    const predictions = await page.evaluate(() => {
      // trainingData and nn are defined in the page scope; use them to get predictions post-training
      try {
        return trainingData.map(item => nn.predict(item.inputs));
      } catch (e) {
        return null;
      }
    });
    expect(predictions, 'predictions array should be available after training').not.toBeNull();
    expect(Array.isArray(predictions)).toBe(true);
    expect(predictions.length).toBe(4);
    predictions.forEach(p => {
      expect(typeof p).toBe('number');
      // Predictions are sigmoid outputs: should be between 0 and 1
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });

    // Ensure no uncaught runtime errors occurred during training
    const trainingPageErrors = pageErrors.filter(e => e.message && e.message.length > 0);
    expect(trainingPageErrors.length, 'no page errors during training').toBe(0);

    // Ensure the console did not contain error entries during the click/training sequence
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'no console error messages during training').toBe(0);
  });

  test('Edge case: Rapid double-click does not crash and result remains correct', async ({ page }) => {
    // Ensure starting from Idle
    await page.reload({ waitUntil: 'load' });

    // Double-click the train button rapidly
    await page.click('#trainBtn');
    await page.click('#trainBtn');

    // Wait for the result to be set
    await page.waitForFunction(() => {
      const el = document.getElementById('result');
      return el && el.innerText === 'Neural Network Trained!';
    }, { timeout: 10000 });

    // Verify result remains exactly the expected text
    const resultText = await page.$eval('#result', el => el.innerText);
    expect(resultText).toBe('Neural Network Trained!');

    // Verify no uncaught exceptions occurred as a result of rapid clicks
    expect(pageErrors.length, 'no page errors after rapid double-click').toBe(0);

    // Also ensure console did not capture error-level messages
    const errorConsoles = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length, 'no console errors after rapid double-click').toBe(0);
  });

  test('FSM evidence and behaviors: verify training loop runs and predictions change from initial predictions', async ({ page }) => {
    // Capture initial predictions before training
    const initialPredictions = await page.evaluate(() => {
      try {
        return trainingData.map(item => nn.predict(item.inputs));
      } catch (e) {
        return null;
      }
    });
    expect(initialPredictions).not.toBeNull();
    expect(Array.isArray(initialPredictions)).toBe(true);

    // Trigger training
    await page.click('#trainBtn');

    // Wait for training completion marker
    await page.waitForFunction(() => document.getElementById('result').innerText === 'Neural Network Trained!', { timeout: 10000 });

    // Capture post-training predictions
    const postPredictions = await page.evaluate(() => {
      try {
        return trainingData.map(item => nn.predict(item.inputs));
      } catch (e) {
        return null;
      }
    });
    expect(postPredictions).not.toBeNull();
    expect(Array.isArray(postPredictions)).toBe(true);

    // Confirm that at least one prediction changed after training (evidence the training loop had an effect)
    const changed = initialPredictions.some((val, idx) => Math.abs(val - postPredictions[idx]) > 1e-6);
    expect(changed, 'at least one prediction should change after training iterations').toBe(true);

    // Confirm that the training loop specified in the FSM is present in the onclick handler (evidence)
    const onclickSource = await page.$eval('#trainBtn', btn => btn.onclick.toString());
    expect(onclickSource.includes('for (let i = 0; i < 10000; i++)'), 'onclick should contain the 10000-iteration training loop').toBe(true);
  });

  test('Observability: capture and report any ReferenceError, SyntaxError, or TypeError if they occur', async ({ page }) => {
    // This test's purpose is to observe runtime errors and assert their presence/absence.
    // We do not modify the page; we only report and assert on observed errors.

    // Trigger the training once to exercise code paths that might throw
    await page.click('#trainBtn');
    await page.waitForFunction(() => document.getElementById('result').innerText === 'Neural Network Trained!', { timeout: 10000 });

    // Inspect collected page errors to see if any are ReferenceError, SyntaxError, or TypeError
    const relevantErrors = pageErrors.filter(err => {
      if (!err || !err.message) return false;
      return /ReferenceError|SyntaxError|TypeError/.test(err.message);
    });

    // Assert that no such critical errors occurred
    expect(relevantErrors.length, 'no ReferenceError, SyntaxError, or TypeError should have occurred').toBe(0);

    // For debugging, if any console.error messages exist, fail the test and include them
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'no console.error calls during exercise of the app').toBe(0);
  });
});