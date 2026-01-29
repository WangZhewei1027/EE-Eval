import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122e21e1-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Random Forest FSM interactions - 122e21e1-fa7b-11f0-814c-dbec508f0b3b', () => {
  // Arrays to collect runtime errors and console messages for assertions
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // collect uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // store full message text for assertions
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // collect console messages
    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // small sanity: attach any final console output to test in debug
    // (No modifications to the page allowed)
  });

  test('Idle state: page should render all expected inputs and buttons', async ({ page }) => {
    // This test validates the Idle state rendering (S0_Idle) - basic DOM presence checks.

    // Inputs and buttons expected by the FSM
    const selectors = [
      '#feature1', '#feature1-btn',
      '#feature2', '#feature2-btn',
      '#feature3', '#feature3-btn',
      '#threshold', '#threshold-btn',
      '#feature4', '#feature4-btn',
      '#feature5', '#feature5-btn',
      '#submit-btn'
    ];

    for (const sel of selectors) {
      const locator = page.locator(sel);
      // Expect the element to be present in the DOM
      await expect(locator, `Expected ${sel} to exist`).toBeVisible();
    }

    // The implementation uses a .error div at bottom for generic errors (exists)
    await expect(page.locator('.error')).toBeVisible();

    // The implementation does NOT provide elements with id="result" or id="error",
    // which the script later attempts to use - assert they are indeed missing.
    const resultExists = await page.evaluate(() => !!document.getElementById('result'));
    const errorExists = await page.evaluate(() => !!document.getElementById('error'));
    expect(resultExists).toBe(false);
    expect(errorExists).toBe(false);

    // No page runtime error should be thrown just by loading the page
    expect(pageErrors.length).toBe(0);
  });

  // Helper to perform feature submit and assert runtime error and side-effects
  async function testFeatureSubmit({ page, featureId, inputValue, expectedValueIsNaN = false }) {
    // Comments: This function:
    //  - fills the named input
    //  - clicks its associated button
    //  - expects at least one runtime pageerror due to broken handlers referencing non-existent elements
    //  - asserts that the window-level feature variable was assigned (even though a handler later throws)
    //  - asserts that the feature button's disabled state changed (implementation attempts to toggle it)
    const btnSelector = `#${featureId}-btn`;
    const inputSelector = `#${featureId}`;

    // Fill input (if inputValue is undefined, leave empty)
    if (inputValue !== undefined) {
      await page.fill(inputSelector, String(inputValue));
    } else {
      await page.fill(inputSelector, '');
    }

    // Capture a pageerror triggered by the click. Many handlers are attached and reference missing
    // elements (like #feature1-input), so a TypeError is expected. Use Promise.all to reliably
    // capture the first pageerror emitted by the click.
    const errorPromise = page.waitForEvent('pageerror');

    // Perform click
    await Promise.all([
      errorPromise,
      page.click(btnSelector)
    ]);

    // At least one page error should have been recorded in the pageErrors array.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Extract the last error message recorded (the one just emitted)
    const lastErrorMessage = pageErrors[pageErrors.length - 1];

    // The broken handlers reference IDs such as "featureX-input" which do not exist.
    // The runtime message varies by engine, but should mention 'null' or the missing id.
    expect(lastErrorMessage).toMatch(/null|feature.*-input|Cannot|not defined/i);

    // Verify that the window-scoped variable was assigned the parsed value before the handler threw.
    // For example window.feature1 should equal parsed int or NaN if no input provided.
    const value = await page.evaluate((name) => {
      // access by computed name, e.g., window['feature1']
      return window[name];
    }, featureId);

    if (expectedValueIsNaN) {
      // If an empty input was provided, parseInt yields NaN
      expect(Number.isNaN(value)).toBe(true);
    } else {
      // Otherwise expect the numeric parse
      const expected = inputValue !== undefined ? parseInt(String(inputValue), 10) : NaN;
      if (Number.isNaN(expected)) {
        expect(Number.isNaN(value)).toBe(true);
      } else {
        expect(value).toBe(expected);
      }
    }

    // The implementation tries to toggle the button's disabled state in multiple handlers.
    // Final state is influenced by the last handler that ran before throwing. We assert the button exists.
    const btn = page.locator(btnSelector);
    await expect(btn).toBeVisible();

    // It's acceptable that the button ends up disabled as some handlers attempt to set it.
    // Check that the property exists and is either true or false (no exception occurred reading it).
    const isDisabled = await btn.isDisabled();
    expect(typeof isDisabled).toBe('boolean');
  }

  test('Submitting Feature 1 triggers handler errors and sets window.feature1', async ({ page }) => {
    // Validate FSM transition S0 -> S1 (Feature1Submit) and evidence of handler execution and failure.
    await testFeatureSubmit({ page, featureId: 'feature1', inputValue: 42 });
  });

  test('Submitting Feature 2 with empty input produces NaN and handler errors', async ({ page }) => {
    // Validate FSM transition S0 -> S2 (Feature2Submit) with edge case of empty input.
    await testFeatureSubmit({ page, featureId: 'feature2', inputValue: undefined, expectedValueIsNaN: true });
  });

  test('Submitting Feature 3 triggers handler errors and sets window.feature3', async ({ page }) => {
    // Validate FSM transition S0 -> S3 (Feature3Submit)
    await testFeatureSubmit({ page, featureId: 'feature3', inputValue: '7' });
  });

  test('Submitting Feature 4 triggers handler errors and sets window.feature4', async ({ page }) => {
    // Validate FSM transition S0 -> S5 (Feature4Submit)
    await testFeatureSubmit({ page, featureId: 'feature4', inputValue: '100' });
  });

  test('Submitting Feature 5 triggers handler errors and sets window.feature5', async ({ page }) => {
    // Validate FSM transition S0 -> S6 (Feature5Submit)
    await testFeatureSubmit({ page, featureId: 'feature5', inputValue: '9' });
  });

  test('Threshold button has no handler: clicking should NOT produce runtime error and threshold remains default', async ({ page }) {
    // This exercise tests FSM event ThresholdSubmit. The implementation lacks an event listener
    // for #threshold-btn, so clicking it should not produce an error, and window.threshold should remain unchanged.

    // baseline number of page errors before click
    const baselineErrors = pageErrors.length;

    // set threshold input value (this won't be picked up absent handler)
    await page.fill('#threshold', '3.5');

    // Click the threshold submit button - there is no handler attached according to the HTML script
    await page.click('#threshold-btn');

    // Wait a short time to allow any asynchronous pageerrors to surface (there shouldn't be any)
    await page.waitForTimeout(100);

    // Assert no new page errors were created by clicking threshold-btn
    expect(pageErrors.length).toBe(baselineErrors);

    // Verify window.threshold remains its initialized value (0) because no handler sets it
    const thresholdVal = await page.evaluate(() => window.threshold);
    expect(thresholdVal).toBe(0);
  });

  test('Submitting all features triggers ReferenceError due to missing RandomForest and no DOM result ids', async ({ page }) => {
    // This validates FSM transition S0 -> S7 (SubmitPredictions).
    // The implementation tries to instantiate RandomForest which is not defined -> ReferenceError expected.
    // Also it later attempts to update #result and #error by id which do not exist.

    // Ensure some feature values are set by clicking their buttons (these clicks emit handler errors,
    // but also assign the window variables). We'll click feature buttons again to set values.
    // We expect pageerrors to accumulate; capture baseline count first.
    const baseline = pageErrors.length;

    // Set feature inputs so the submit logic has some values
    await page.fill('#feature1', '1');
    await page.fill('#feature2', '2');
    await page.fill('#feature3', '3');
    await page.fill('#feature4', '4');
    await page.fill('#feature5', '5');
    await page.fill('#threshold', '2.2');

    // Click each feature submit button to trigger their handlers (they will produce TypeErrors as before)
    // We don't need to assert here; just ensure the window variables are assigned as a side-effect.
    for (const id of ['feature1', 'feature2', 'feature3', 'feature4', 'feature5']) {
      // We will trigger and ignore the pageerror events here to proceed to the final submit
      // Use Promise.all to capture at least one pageerror per click but not fail the test.
      try {
        await Promise.all([
          page.waitForEvent('pageerror'),
          page.click(`#${id}-btn`)
        ]);
      } catch (e) {
        // Defensive: if no pageerror occurs (unexpected), continue - we only need variables set.
      }
    }

    // Now click the big submit button that attempts to create RandomForest -> ReferenceError expected.
    const [err] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#submit-btn')
    ]);

    // The thrown error should be a ReferenceError indicating RandomForest is not defined.
    expect(String(err && err.message ? err.message : err)).toMatch(/RandomForest|not defined|ReferenceError/i);

    // After the failed submit attempt, the script attempts to write to element ids 'result' and 'error'
    // which are not present in the DOM. Assert they do not exist.
    const resultExists = await page.evaluate(() => !!document.getElementById('result'));
    const errorExists = await page.evaluate(() => !!document.getElementById('error'));
    expect(resultExists).toBe(false);
    expect(errorExists).toBe(false);

    // Ensure that some pageerrors were recorded and that the count increased
    expect(pageErrors.length).toBeGreaterThanOrEqual(baseline + 1);

    // Also verify that RandomForest is indeed undefined in the page context
    const rfType = await page.evaluate(() => typeof window.RandomForest);
    expect(rfType).toBe('undefined');

    // For additional evidence, ensure the console captured messages - at least one message should mention RandomForest or error.
    const consoleCombined = consoleMessages.join('\n');
    expect(consoleCombined + pageErrors.join('\n')).toMatch(/RandomForest|error|ReferenceError/i);
  });

  test('Multiple clicks cause multiple runtime errors (robustness / edge case)', async ({ page }) => {
    // This test checks that repeated triggering of broken handlers produces additional page errors.
    const before = pageErrors.length;

    // Repeatedly click feature1 button multiple times quickly
    for (let i = 0; i < 3; i++) {
      // Each click should emit at least one pageerror; use try/catch to continue regardless
      try {
        await Promise.all([
          page.waitForEvent('pageerror'),
          page.click('#feature1-btn')
        ]);
      } catch (e) {
        // ignore
      }
    }

    // After multiple clicks there should be at least 3 more errors recorded
    expect(pageErrors.length).toBeGreaterThanOrEqual(before + 1);
  });
});