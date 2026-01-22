import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b0082e1-d5c3-11f0-b41f-b131cbd11f51.html';

test.describe('Insertion Sort Visualization - FSM and UI tests (App ID: 6b0082e1-d5c3-11f0-b41f-b131cbd11f51)', () => {
  // Collect console errors and page errors for each test to assert there are none unexpected.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
        });
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
    });

    // Go to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Ensure no uncaught page errors or console errors were emitted during the test
    // We assert zero page errors / console errors to ensure runtime didn't throw ReferenceError/SyntaxError/TypeError.
    expect(pageErrors.length, `Expected no page errors but found: ${JSON.stringify(pageErrors)}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error messages but found: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test.describe('Initial state and Array Generation (S0_Idle -> S1_ArrayGenerated)', () => {
    test('On page load the visualizer should generate an initial array and update status', async ({ page }) => {
      // The constructor calls generateRandomArray() on DOMContentLoaded.
      const status = page.locator('#status');
      // Wait for status to become 'New array generated' (generateRandomArray sets this)
      await expect(status).toHaveText('New array generated');

      // The initial array size should match the arraySize input's value (default 15)
      const arraySizeValue = await page.locator('#arraySize').inputValue();
      const bars = page.locator('#arrayContainer .array-bar');
      await expect(bars).toHaveCount(parseInt(arraySizeValue, 10));

      // Buttons: startSort should be enabled, pauseResume disabled, stepSort enabled
      await expect(page.locator('#startSort')).toBeEnabled();
      await expect(page.locator('#pauseResume')).toBeDisabled();
      await expect(page.locator('#stepSort')).toBeEnabled();
    });

    test('Clicking "Generate New Array" produces a new array and updates status', async ({ page }) => {
      // Collect the previous first bar text to ensure the array changes (most likely changes)
      const firstBarBefore = await page.locator('#arrayContainer .array-bar').first().textContent();

      await page.click('#generateArray');

      // Status should reflect generation
      await expect(page.locator('#status')).toHaveText('New array generated');

      // Bars should be re-rendered - at least first bar text should change or remain valid numeric text
      const firstBarAfter = await page.locator('#arrayContainer .array-bar').first().textContent();
      expect(firstBarAfter).not.toBeNull();

      // startSort should be enabled after generation
      await expect(page.locator('#startSort')).toBeEnabled();
      await expect(page.locator('#pauseResume')).toBeDisabled();
      await expect(page.locator('#stepSort')).toBeEnabled();
    });

    test('Changing the array size slider triggers generation of a new array with the specified length (ChangeArraySize event)', async ({ page }) => {
      // Set array size to a smaller number and dispatch input event
      const newSize = 8;
      const sizeSlider = page.locator('#arraySize');
      await sizeSlider.evaluate((el, val) => {
        el.value = String(val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, newSize);

      // The array container should now have newSize bars
      await expect(page.locator('#arrayContainer .array-bar')).toHaveCount(newSize);

      // Status should be updated to 'New array generated' by generateRandomArray
      await expect(page.locator('#status')).toHaveText('New array generated');
    });
  });

  test.describe('Sorting lifecycle (S1_ArrayGenerated -> S2_Sorting -> S3_Paused -> S4_Reset)', () => {
    test('StartSorting transition enables/disables correct controls and sets status to processing (S2_Sorting entry)', async ({ page }) => {
      // Ensure we are in a generated state
      await expect(page.locator('#status')).toHaveText('New array generated');

      // Click startSort to begin sorting; performSort will start asynchronously
      await page.click('#startSort');

      // After starting: start button should be disabled, pauseResume enabled, generate disabled
      await expect(page.locator('#startSort')).toBeDisabled();
      await expect(page.locator('#pauseResume')).toBeEnabled();
      await expect(page.locator('#generateArray')).toBeDisabled();

      // Status should change and contain "Processing element at index" (the implementation updates status per element)
      await expect(page.locator('#status')).toContainText('Processing element at index');

      // pauseResume text should initially be "Pause"
      await expect(page.locator('#pauseResume')).toHaveText('Pause');
    });

    test('Pause and Resume sorting toggles pause button text (S2_Sorting <-> S3_Paused transitions)', async ({ page }) => {
      // Start sorting
      await page.click('#startSort');

      // Wait for processing to begin
      await expect(page.locator('#status')).toContainText('Processing element at index');

      // Click pause (togglePause should fire and set isPaused true, change button text to 'Resume')
      await page.click('#pauseResume');
      await expect(page.locator('#pauseResume')).toHaveText('Resume');

      // Clicking pauseResume again should resume and toggle text back to 'Pause'
      await page.click('#pauseResume');
      await expect(page.locator('#pauseResume')).toHaveText('Pause');

      // Note: The implementation does not explicitly set status to "Sorting paused" or "Sorting resumed".
      // We assert the visible button text change which is the implemented observable.
    });

    test('Reset during sorting stops sorting and returns UI to Ready to sort (S4_Reset)', async ({ page }) => {
      // Start sorting
      await page.click('#startSort');

      // Ensure we are processing
      await expect(page.locator('#status')).toContainText('Processing element at index');

      // Click reset while sorting - reset() should set isSorting=false and set status to 'Ready to sort'
      await page.click('#reset');

      // Status should be 'Ready to sort' per reset() implementation
      await expect(page.locator('#status')).toHaveText('Ready to sort');

      // Controls should be in reset state: start enabled, pauseResume disabled, stepSort enabled (per implementation)
      await expect(page.locator('#startSort')).toBeEnabled();
      await expect(page.locator('#pauseResume')).toBeDisabled();
      await expect(page.locator('#stepSort')).toBeEnabled();

      // Statistics should be reset to zero / starting state
      await expect(page.locator('#comparisons')).toHaveText('0');
      await expect(page.locator('#swaps')).toHaveText('0');
      await expect(page.locator('#currentStep')).toHaveText('0');
    });

    test('Reset while paused returns UI to Ready to sort (S3_Paused -> S4_Reset)', async ({ page }) => {
      // Start sorting
      await page.click('#startSort');

      // Wait for processing to begin
      await expect(page.locator('#status')).toContainText('Processing element at index');

      // Pause
      await page.click('#pauseResume');
      await expect(page.locator('#pauseResume')).toHaveText('Resume');

      // Click reset while paused
      await page.click('#reset');

      // Should restore to 'Ready to sort' and set pause button text back to 'Pause'
      await expect(page.locator('#status')).toHaveText('Ready to sort');
      await expect(page.locator('#pauseResume')).toHaveText('Pause');

      // pauseResume should be disabled after reset
      await expect(page.locator('#pauseResume')).toBeDisabled();
    });
  });

  test.describe('Step mode and UI controls', () => {
    test('Clicking Step when not sorting shows the step-mode message (StepSort event)', async ({ page }) => {
      // Ensure not sorting by resetting
      await page.click('#reset');
      await expect(page.locator('#status')).toHaveText('Ready to sort');

      // Click Step - performSingleStep updates status to a placeholder message
      await page.click('#stepSort');

      await expect(page.locator('#status')).toHaveText('Step mode not fully implemented in this demo');
    });

    test('Attempting to pause when not sorting does nothing (edge case)', async ({ page }) => {
      // Ensure not sorting
      await page.click('#reset');
      await expect(page.locator('#status')).toHaveText('Ready to sort');

      // pauseResume is disabled in this state, attempt to click should be ignored by the page
      const pauseBtn = page.locator('#pauseResume');
      await expect(pauseBtn).toBeDisabled();

      // Force a click (Playwright will still perform click even if disabled via DOM attribute),
      // however the application logic ignores togglePause if not sorting.
      // To reflect real user behavior, we assert nothing changes after trying to click disabled button.
      // We'll use evaluate to try to call click on the element but not expect thrown errors.
      await pauseBtn.evaluate((btn) => btn.click());

      // Status should remain 'Ready to sort'
      await expect(page.locator('#status')).toHaveText('Ready to sort');
    });
  });

  test.describe('Speed control and robustness', () => {
    test('Changing speed slider updates its value and does not throw errors (ChangeSpeed event)', async ({ page }) => {
      // Change speed slider value and dispatch input event
      const speedSlider = page.locator('#speed');
      await speedSlider.evaluate((el) => {
        el.value = '10';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // The slider should reflect the new value
      await expect(speedSlider).toHaveValue('10');

      // Start a small sort (reduce array size first to make it quick) to ensure changing speed doesn't break runtime
      await page.locator('#arraySize').evaluate((el) => {
        el.value = '5';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Click startSort and ensure sorting begins without emitting console/page errors
      await page.click('#startSort');
      await expect(page.locator('#status')).toContainText('Processing element at index');

      // Immediately reset to keep test quick (reset should be safe)
      await page.click('#reset');
      await expect(page.locator('#status')).toHaveText('Ready to sort');
    }, { timeout: 20000 }); // allow a bit longer for asynchronous sorting operations
  });

  test.describe('Observability: console and page error monitoring', () => {
    test('No ReferenceError/SyntaxError/TypeError thrown on load or interactions', async ({ page }) => {
      // The beforeEach already set up listeners. Perform a sequence of interactions to exercise code paths:
      await page.click('#generateArray');
      await page.locator('#arraySize').evaluate((el) => {
        el.value = '6';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.click('#startSort');

      // Wait until status indicates processing; then reset quickly
      await expect(page.locator('#status')).toContainText('Processing element at index');
      await page.click('#reset');

      // The afterEach will assert that pageErrors and consoleErrors arrays are empty.
      // Here we also explicitly assert no page errors captured so far.
      // (The final assertion will be done in afterEach; add a local check for clarity)
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});