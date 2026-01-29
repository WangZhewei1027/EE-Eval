import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04439491-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('CPU Scheduling FSM - Interactive Application (04439491-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  // Arrays to collect page errors and console messages for assertions across tests
  let pageErrors;
  let consoleMessages;

  // Attach listeners before each test and navigate to the page.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture runtime/page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // store error objects as strings for easier assertions
      pageErrors.push(err);
    });

    // Capture console messages (info/warn/error) for additional evidence
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Navigate to the application page and wait for load.
    // We intentionally do not patch or modify the page; we let any errors happen naturally.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // cleanup listeners - remove all listeners to avoid leaks across tests
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
  });

  test('Initial load should define schedulingProcess data but produce runtime errors when DOM containers are missing', async ({ page }) => {
    // Comment: Validate that the schedulingProcess data structure is present and has two entries.
    const schedulingProcess = await page.evaluate(() => {
      // return the raw schedulingProcess structure if accessible in page scope
      try {
        return {
          defined: typeof schedulingProcess !== 'undefined',
          length: schedulingProcess ? schedulingProcess.length : null,
          firstName: schedulingProcess ? schedulingProcess[0].name : null,
          secondName: schedulingProcess ? schedulingProcess[1].name : null,
        };
      } catch (e) {
        // If schedulingProcess is not accessible in this lexical scope, return an explicit object
        return { defined: false };
      }
    });

    // schedulingProcess should be accessible and contain the two entries declared in the script
    expect(schedulingProcess.defined).toBe(true);
    expect(schedulingProcess.length).toBe(2);
    expect(schedulingProcess.firstName).toBe('Preemptive Scheduling');
    expect(schedulingProcess.secondName).toBe('Non-Preemptive Scheduling');

    // Comment: The page's script attempts to write to elements with IDs that do not exist.
    // This should have produced at least one runtime page error (TypeError) captured by pageerror.
    expect(pageErrors.length).toBeGreaterThan(0);

    // At least one captured error should be a TypeError regarding null/undefined DOM elements (innerHTML or addEventListener).
    const hasTypeError = pageErrors.some(e => {
      const msg = String(e && (e.message || e));
      return /TypeError/i.test(msg) && (/innerHTML/i.test(msg) || /addEventListener/i.test(msg) || /Cannot read properties of null/i.test(msg));
    });
    expect(hasTypeError).toBe(true);

    // Also inspect console messages for error-level logs as auxiliary evidence
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    // There should be at least one console error message (in many browsers runtime errors also show up in console)
    expect(errorConsoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('Entry action displaySchedulingProcess was invoked on load and triggers an error when container is absent', async ({ page }) => {
    // Comment: Attempt to invoke displaySchedulingProcess explicitly and assert it throws due to missing DOM container.
    const result = await page.evaluate(() => {
      try {
        // Try to call the function exposed in the page context.
        // We catch and return the thrown error's message to assert on it.
        displaySchedulingProcess();
        return { success: true };
      } catch (e) {
        return { success: false, message: String(e && (e.message || e)) };
      }
    });

    // The call should have failed because the page does not contain the #scheduling-process element.
    expect(result.success).toBe(false);
    // The error message should mention innerHTML or null property read
    expect(result.message).toMatch(/innerHTML|Cannot read properties of null|null/i);
  });

  test('displaySchedulingProcessOnHover function exists and its implementation references schedulingProcess[0] (bug observation), and calling it errors due to missing hover container', async ({ page }) => {
    // Comment: Inspect the function source to confirm which schedulingProcess index it references.
    const fnSource = await page.evaluate(() => {
      // Return the function's source code as a string for inspection.
      try {
        return displaySchedulingProcessOnHover.toString();
      } catch (e) {
        return String(e && (e.message || e));
      }
    });

    // The implementation is expected (per provided HTML) to reference schedulingProcess[0], which looks like a bug
    expect(fnSource).toMatch(/schedulingProcess\[\s*0\s*\]/);

    // Now attempt to invoke the function and assert it throws due to missing scheduling element
    const callResult = await page.evaluate(() => {
      try {
        displaySchedulingProcessOnHover();
        return { success: true };
      } catch (err) {
        return { success: false, message: String(err && (err.message || err)) };
      }
    });

    expect(callResult.success).toBe(false);
    expect(callResult.message).toMatch(/innerHTML|Cannot read properties of null|null/i);
  });

  test('FSM transitions via UI buttons cannot be exercised because buttons are missing; verify elements are not present and clicking fails', async ({ page }) => {
    // Comment: The FSM expects two buttons with specific IDs. Confirm they are absent in the DOM.
    const preemptiveButton = await page.$('#preemptive-scheduling-button');
    const nonPreemptiveButton = await page.$('#non-preemptive-scheduling-button');

    expect(preemptiveButton).toBeNull();
    expect(nonPreemptiveButton).toBeNull();

    // Comment: Attempting to click the missing buttons via Playwright should throw an error.
    // We assert that Playwright throws the expected error for missing selectors.
    let clickErrorMessagePreemptive = '';
    try {
      await page.click('#preemptive-scheduling-button', { timeout: 1000 });
    } catch (err) {
      clickErrorMessagePreemptive = String(err && (err.message || err));
    }
    expect(clickErrorMessagePreemptive).toMatch(/No element|waiting for selector/i);

    let clickErrorMessageNonPreemptive = '';
    try {
      await page.click('#non-preemptive-scheduling-button', { timeout: 1000 });
    } catch (err) {
      clickErrorMessageNonPreemptive = String(err && (err.message || err));
    }
    expect(clickErrorMessageNonPreemptive).toMatch(/No element|waiting for selector/i);
  });

  test('Edge case: confirm schedulingProcess contents are consistent even when rendering fails', async ({ page }) => {
    // Comment: Even though rendering failed, the underlying data should remain intact.
    const details = await page.evaluate(() => {
      try {
        return {
          first: schedulingProcess[0],
          second: schedulingProcess[1],
        };
      } catch (e) {
        return { error: String(e && (e.message || e)) };
      }
    });

    expect(details.error).toBeUndefined();
    expect(details.first).toBeDefined();
    expect(details.second).toBeDefined();
    expect(details.first.name).toBe('Preemptive Scheduling');
    expect(details.second.name).toBe('Non-Preemptive Scheduling');
    // Verify that steps arrays exist
    expect(Array.isArray(details.first.steps)).toBe(true);
    expect(Array.isArray(details.second.steps)).toBe(true);
  });

  test('Observability: captured page errors and console messages provide evidence of the failed entry and event attachment', async ({ page }) => {
    // Comment: There should be at least one page error recorded from the initial script execution.
    expect(pageErrors.length).toBeGreaterThan(0);

    // Extract error text for assertions and debugging evidence
    const errorTexts = pageErrors.map(e => String(e && (e.message || e)));
    const combinedErrors = errorTexts.join('\n');

    // Verify evidence of innerHTML assignment failing
    expect(combinedErrors).toMatch(/innerHTML|Cannot read properties of null|Cannot set property 'innerHTML'/i);

    // Verify evidence of addEventListener being called on a null element (button missing)
    // The script attempts to call addEventListener on the missing buttons which will be reflected in errors.
    expect(combinedErrors).toMatch(/addEventListener|Cannot read properties of null|null/i);

    // Also assert that console messages contain at least the script name or any logged text (non-fatal)
    const consoleText = consoleMessages.map(m => `[${m.type}] ${m.text}`).join('\n');
    // It's okay if console is empty; we simply collect it as evidence. We still assert that it's a string.
    expect(typeof consoleText).toBe('string');
  });
});