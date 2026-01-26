import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122dfad1-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Linear Regression FSM (Application ID: 122dfad1-fa7b-11f0-814c-dbec508f0b3b)', () => {
  // Helper to collect console messages and page errors for each test run
  async function setupLogging(page) {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // pageerror handler receives an Error object
      pageErrors.push(err);
    });

    return { consoleMessages, pageErrors };
  }

  test.beforeEach(async ({ page }) => {
    // Ensure a fresh load for each test
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('S0_Idle: init() runs on page load and initial DOM/variables are set', async ({ page }) => {
    // This test validates the initial/Idle state and the onEnter action init().
    // It verifies that init() executed by checking the global variables created by the script
    // and ensuring the initial DOM still contains the expected inputs (duplicate IDs present).
    const { consoleMessages, pageErrors } = await setupLogging(page);

    // Load the application page
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait briefly to allow inline script init() to run
    await page.waitForTimeout(100);

    // Assert that no runtime page errors occurred during initialization
    expect(pageErrors.length, 'No page errors should occur during initial load').toBe(0);

    // Check that console didn't report any uncaught exceptions during init
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole, 'No console.error during init expected').toBeUndefined();

    // Read global variables set by the script: x, y, slope, intercept, plotData
    // These are top-level script bindings and are accessible via evaluate
    const vars = await page.evaluate(() => {
      // Collect values as-is; slope/intercept/x/y are initialized as strings
      return {
        x: typeof x !== 'undefined' ? x : null,
        y: typeof y !== 'undefined' ? y : null,
        slope: typeof slope !== 'undefined' ? slope : null,
        intercept: typeof intercept !== 'undefined' ? intercept : null,
        plotDataLength: typeof plotData !== 'undefined' ? plotData.length : null,
        // Count elements with duplicate IDs to demonstrate duplicate-ID situation in DOM
        idXCount: document.querySelectorAll('#x').length,
        idYCount: document.querySelectorAll('#y').length,
        // Ensure prediction input exists initially
        predictionExists: !!document.getElementById('prediction'),
        // Check that the fit button is present and is a button
        fitButtonTag: document.getElementById('fit-button') ? document.getElementById('fit-button').tagName : null
      };
    });

    // Validate init() set the expected initial string values
    expect(vars.x).toBe('1');
    expect(vars.y).toBe('2');
    expect(vars.slope).toBe('0');
    expect(vars.intercept).toBe('0');

    // plotData was initialized to an empty array in init()
    expect(vars.plotDataLength).toBe(0);

    // The HTML contains duplicate IDs (one in controls, one in output), assert both exist
    expect(vars.idXCount).toBeGreaterThanOrEqual(2);
    expect(vars.idYCount).toBeGreaterThanOrEqual(2);

    // Ensure prediction input exists initially
    expect(vars.predictionExists).toBe(true);

    // The Fit button should be present
    expect(vars.fitButtonTag).toBe('BUTTON');
  });

  test('Transition S0_Idle -> S1_Fitted: Clicking Fit triggers fit() and results in a runtime error (observed pageerror)', async ({ page }) => {
    // This test validates the transition triggered by clicking the Fit button.
    // The application code has a logical flaw that will naturally raise a runtime error inside fit().
    // We assert that a pageerror is emitted and that the error is a TypeError (or similar).
    const { consoleMessages, pageErrors } = await setupLogging(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure initial state before click
    const initialPlotDataLen = await page.evaluate(() => (typeof plotData !== 'undefined' ? plotData.length : null));
    expect(initialPlotDataLen).toBe(0);

    // Click the Fit button and wait for the pageerror to be emitted by the faulty fit() implementation.
    // Use Promise.all to race click and waiting for pageerror.
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'), // this resolves with the Error thrown inside the page
      page.click('#fit-button')
    ]);

    // Validate that a pageerror occurred and is an Error instance
    expect(error).toBeInstanceOf(Error);
    // The broken fit() should produce a TypeError when accessing data[0][0] because data is empty.
    // Different Chromium versions may have slightly different messages, so check the name and presence of 'TypeError'
    expect(error.name).toBe('TypeError');

    // The message is expected to reference 'undefined' or 'reading' or similar property-access issue.
    // We assert that the message contains indicative substrings.
    const msg = error.message || '';
    const indicative = ['undefined', 'reading', 'Cannot read', 'data[0]', 'of undefined'];
    const containsIndicative = indicative.some(substr => msg.includes(substr));
    expect(containsIndicative).toBe(true);

    // After the error, inspect the page-level variables to observe partial state changes:
    // slope assignment (m / data.length) happens before the failing access to data[0][0],
    // so slope is expected to be Infinity (division by zero).
    const varsAfterError = await page.evaluate(() => {
      return {
        slopeValue: typeof slope !== 'undefined' ? slope : null,
        interceptValue: typeof intercept !== 'undefined' ? intercept : null,
        plotDataLength: typeof plotData !== 'undefined' ? plotData.length : null,
        // Ensure output DOM still contains the original input elements (updatePlot wasn't reached)
        idXCount: document.querySelectorAll('#x').length,
        idYCount: document.querySelectorAll('#y').length
      };
    });

    // slope should have become Infinity due to division by zero in fit()
    // Numeric Infinity when serialized will be null via JSON, but evaluate returns the actual Infinity value
    expect(varsAfterError.slopeValue).toBe(Number.POSITIVE_INFINITY);

    // intercept should remain previous value (string '0') because its assignment was not completed due to error
    // Depending on environment the intercept might still be '0' (string) – assert that it's either '0' or numeric 0
    expect(['0', 0, null].includes(varsAfterError.interceptValue)).toBe(true);

    // plotData should remain empty because updatePlot() wasn't reached after the error
    expect(varsAfterError.plotDataLength).toBe(0);

    // The DOM should remain unchanged (updatePlot not executed)
    expect(varsAfterError.idXCount).toBeGreaterThanOrEqual(2);
    expect(varsAfterError.idYCount).toBeGreaterThanOrEqual(2);

    // Also assert that a console error was emitted (the runtime exception typically logs as uncaught exception)
    const anyConsoleError = consoleMessages.some(m => m.type === 'error' || m.text.toLowerCase().includes('uncaught'));
    expect(anyConsoleError).toBe(true);
  });

  test('Edge Case: Non-numeric X and Y values still lead to the same runtime error when clicking Fit', async ({ page }) => {
    // This test changes the input values to non-numeric strings and validates that the faulty logic
    // still results in a runtime error (i.e., the application code does not guard against invalid input).
    const { consoleMessages, pageErrors } = await setupLogging(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Fill the visible inputs (getElementById will target the first occurrence of the duplicate ID)
    // This simulates a user entering invalid data into the form before fitting.
    await page.fill('input#x', 'foo');
    await page.fill('input#y', 'bar');

    // Click Fit and wait for the pageerror that arises from the same logic path
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#fit-button')
    ]);

    // Validate a runtime error occurred
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('TypeError');

    // Confirm that plotData remains empty and slope becomes Infinity as before
    const after = await page.evaluate(() => ({
      slopeValue: typeof slope !== 'undefined' ? slope : null,
      plotDataLength: typeof plotData !== 'undefined' ? plotData.length : null,
      xValue: typeof x !== 'undefined' ? x : null, // value read from the first #x element
      yValue: typeof y !== 'undefined' ? y : null
    }));

    expect(after.plotDataLength).toBe(0);
    expect(after.slopeValue).toBe(Number.POSITIVE_INFINITY);
    expect(after.xValue).toBe('foo');
    expect(after.yValue).toBe('bar');
  });

  test('Sanity: After runtime error the UI remains interactive (Fit button still clickable) and further clicks emit additional errors', async ({ page }) => {
    // This test confirms that after an initial runtime error, the page did not become entirely unresponsive.
    // Subsequent clicks should still attempt to run fit() and produce further errors.
    const { consoleMessages, pageErrors } = await setupLogging(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    // First click to produce initial error
    await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#fit-button')
    ]);

    // Second click should also raise an error (the function remains bound to the button)
    const error2 = await page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);
    if (!error2) {
      // If the pageerror wasn't fired synchronously, attempt to click and wait explicitly
      const [err] = await Promise.all([
        page.waitForEvent('pageerror'),
        page.click('#fit-button')
      ]);
      expect(err).toBeInstanceOf(Error);
    } else {
      expect(error2).toBeInstanceOf(Error);
    }

    // Ensure the Fit button still exists and is enabled
    const fitButtonState = await page.evaluate(() => {
      const btn = document.getElementById('fit-button');
      return {
        exists: !!btn,
        disabled: btn ? btn.disabled : null
      };
    });
    expect(fitButtonState.exists).toBe(true);
    // The script never disables the button, so it should not be disabled
    expect(fitButtonState.disabled).toBe(false);
  });
});