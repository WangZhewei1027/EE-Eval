import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/718c4800-d362-11f0-85a0-d3271c47ca09.html';

test.describe('Divide and Conquer (Application ID: 718c4800-d362-11f0-85a0-d3271c47ca09) - FSM validation', () => {

  // Test: Initial render corresponds to the Idle (S0_Idle) state.
  test('Initial render - Idle state: DOM elements present and initial script error observed', async ({ page }) => {
    // Collect page errors that occur during load
    const errors = [];
    page.on('pageerror', (err) => {
      errors.push(err ? String(err.message || err) : String(err));
    });

    // Navigate to the page (this will execute the faulty inline script)
    await page.goto(APP_URL);

    // Wait a short time to allow any synchronous on-load errors to fire
    // (the page contains a misspelled function call that throws immediately)
    await page.waitForTimeout(200);

    // Verify presence of expected DOM elements described in the FSM (Idle state)
    await expect(page.locator('h1')).toHaveText('Divide and Conquer');
    await expect(page.locator('#divider-form')).toBeVisible();
    await expect(page.locator('#width')).toBeVisible();
    await expect(page.locator('#height')).toBeVisible();
    await expect(page.locator('button[onclick="calculate()"]')).toHaveText('Calculate');
    await expect(page.locator('#result')).toBeVisible();

    // The implementation intentionally contains a typo: "dividAndConquer();" which should raise a ReferenceError
    // Assert that at least one page error occurred and that it references the misspelled function
    expect(errors.length).toBeGreaterThanOrEqual(1);
    const joinedErrors = errors.join(' | ').toLowerCase();
    expect(joinedErrors).toContain('dividandconquer'); // ensure the missing function name is present in the error(s)

    // Ensure that result area is initially empty (no successful calculation performed)
    const initialResult = await page.locator('#result').textContent();
    expect(initialResult.trim()).toBe('');
  });

  // Test: Clicking the Calculate button triggers the onclick which references a missing calculate() function -> ReferenceError
  test('Calculate button click leads to ReferenceError for missing calculate() (S0 -> S1 event handling error)', async ({ page }) => {
    // Navigate to the page
    await page.goto(APP_URL);

    // Listen for the pageerror caused by the button's onclick (calculate() is not defined)
    const clickErrorPromise = page.waitForEvent('pageerror');

    // Perform the user action described in the FSM: click the Calculate button
    await page.click('button[onclick="calculate()"]');

    // Wait for the pageerror that should result from the missing calculate() function
    const clickError = await clickErrorPromise;
    const message = String(clickError.message || clickError).toLowerCase();

    // Assert that the error message references the missing 'calculate' function
    expect(message).toContain('calculate');

    // The DOM result should be unchanged because the onclick handler could not execute
    const resultText = await page.locator('#result').textContent();
    expect(resultText.trim()).toBe('');
  });

  // Test: Direct invocation of divideAndConquer() to validate S1_Calculating -> S3_Win transition (result <= 2)
  test('Direct divideAndConquer() invocation produces "You win!" when result <= 2 (S1 -> S3)', async ({ page }) => {
    await page.goto(APP_URL);

    // Reset any prior errors array capture (we're not asserting load errors here)
    // Prepare the environment so the existing divideAndConquer function (declared in the page) computes a value <= 2.
    // The page defines global variables width and height at load; we will set those existing globals (not define new ones).
    // Set result to 0 to ensure deterministic behavior for this invocation.
    await page.evaluate(() => {
      // width and height variables already exist in the page scope; assign numeric values that will produce width/height = 1
      // This uses existing variables rather than creating new globals from scratch.
      try {
        window.width = 2;
        window.height = 2;
        window.result = 0;
      } catch (e) {
        // allow exceptions to surface if they occur; test assertions will catch failures
        throw e;
      }
    });

    // Call the function that represents the "divide and conquer" calculation
    // This should execute the defined divideAndConquer function and set the #result text to "You win!"
    await page.evaluate(() => {
      // Call the existing function; it is defined in the page script
      divideAndConquer();
    });

    // Verify that the transition to the Win final state occurred by checking the DOM text
    const resultText = await page.locator('#result').textContent();
    expect(resultText.trim()).toBe('You win!');
  });

  // Test: Direct invocation of divideAndConquer() to validate S1_Calculating -> S2_GameOver transition (result > 2)
  test('Direct divideAndConquer() invocation produces "The game is over!" when result > 2 (S1 -> S2)', async ({ page }) => {
    await page.goto(APP_URL);

    // Prepare environment: set globals so that width/height yields a quotient > 2 and reset result counter
    await page.evaluate(() => {
      try {
        // This updates existing globals that the page's function reads.
        window.width = 10;
        window.height = 2;
        window.result = 0;
      } catch (e) {
        throw e;
      }
    });

    // Invoke divideAndConquer which should now set the DOM to "The game is over!"
    await page.evaluate(() => {
      divideAndConquer();
    });

    const resultText = await page.locator('#result').textContent();
    expect(resultText.trim()).toBe('The game is over!');
  });

  // Edge cases & error scenarios
  test('Attempting to call missing functions like calculate() or renderPage() from the page context throws ReferenceError', async ({ page }) => {
    await page.goto(APP_URL);

    // Calling calculate() should reject because the function isn't defined
    await expect(page.evaluate(() => {
      // This will throw in the page context; page.evaluate will reject with that exception
      // We return a sentinel if, unexpectedly, calculate exists and runs without error.
      try {
        // Attempt to call calculate which does not exist in the page
        // This call is expected to throw
        // eslint-disable-next-line no-undef
        return calculate();
      } catch (err) {
        // rethrow to make page.evaluate reject
        throw err;
      }
    })).rejects.toThrow(/calculate/i);

    // Similarly, renderPage is referenced in the FSM as an entry action but is not implemented in the HTML.
    // Attempt to call renderPage() and assert it throws a ReferenceError.
    await expect(page.evaluate(() => {
      try {
        // Attempt to call renderPage which is not defined on the page
        // eslint-disable-next-line no-undef
        return renderPage();
      } catch (err) {
        throw err;
      }
    })).rejects.toThrow(/renderpage/i);
  });

  // Validate that repeated invocations accumulate result (behavioral edge)
  test('Repeated divideAndConquer() invocations accumulate result and change final outcome appropriately', async ({ page }) => {
    await page.goto(APP_URL);

    // Reset globals for deterministic accumulation
    await page.evaluate(() => {
      window.width = 6;
      window.height = 3; // width/height = 2
      window.result = 0;
      // Ensure the result element is empty before starting
      const el = document.getElementById('result');
      if (el) el.innerHTML = '';
    });

    // First call: result becomes 2 => "You win!" (result <= 2)
    await page.evaluate(() => divideAndConquer());
    let text = (await page.locator('#result').textContent()).trim();
    expect(text).toBe('You win!');

    // Second call: result becomes 4 (previous 2 + 2) => now >2 => "The game is over!"
    await page.evaluate(() => divideAndConquer());
    text = (await page.locator('#result').textContent()).trim();
    expect(text).toBe('The game is over!');
  });

});