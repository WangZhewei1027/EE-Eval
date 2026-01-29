import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1213b183-fa7a-11f0-acf9-69409043402d.html';

test.describe('Merge Sort Interactive Demo - FSM validation (Application ID 1213b183-fa7a-11f0-acf9-69409043402d)', () => {
  // Capture console messages, page errors and dialog messages for assertions
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Auto-accept and record any dialogs (alerts) produced by the page
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      try {
        await dialog.accept();
      } catch (e) {
        // swallow accept errors in case the dialog was already dismissed
      }
    });

    // Navigate to the application
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // After each test we assert there were no unexpected runtime exceptions
    // (This is important to surface runtime TypeError/ReferenceError/SyntaxError if they happen)
    expect(pageErrors.length).toBe(0);
    // No console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Initial state (S0_NoArrayLoaded)', () => {
    test('initial setup populates minimal state and disables controls', async ({ page }) => {
      // Validate visible texts correspond to "No array loaded" initial state
      const currentArrayPre = page.locator('#currentArrayPre');
      const currentOpPre = page.locator('#currentOperationPre');

      await expect(currentArrayPre).toHaveText('[]');
      await expect(currentOpPre).toHaveText('No array loaded');

      // Controls that should be disabled on initial setup
      await expect(page.locator('#stepForwardBtn')).toBeDisabled();
      await expect(page.locator('#stepBackBtn')).toBeDisabled();
      await expect(page.locator('#autoPlayBtn')).toBeDisabled();
      await expect(page.locator('#pauseBtn')).toBeDisabled();
      await expect(page.locator('#jumpToBtn')).toBeDisabled();
      await expect(page.locator('#resetBtn')).toBeDisabled();
      await expect(page.locator('#modifyBtn')).toBeDisabled();

      // The states list should contain exactly one item: step 0 "No array loaded"
      const statesListChildren = page.locator('#statesList > div');
      await expect(statesListChildren).toHaveCount(1);
      await expect(statesListChildren.first()).toContainText('No array loaded');
    });
  });

  test.describe('Loading & Generating arrays (S0 -> S1 transitions)', () => {
    test('LOAD_ARRAY transitions to S1_ArrayLoaded and builds states', async ({ page }) => {
      // Enter a valid array and click load
      const arrayInput = page.locator('#arrayInput');
      await arrayInput.fill('3, 1, 2');

      await page.click('#loadArrayBtn');

      // After loading we expect the display to show the initial array and controls to enable
      await expect(page.locator('#currentArrayPre')).toHaveText('[3, 1, 2]');
      await expect(page.locator('#currentOperationPre')).toHaveText('Initial array');

      // Buttons that depend on history should now be enabled
      await expect(page.locator('#stepForwardBtn')).toBeEnabled();
      // step back is disabled because we are at step 0
      await expect(page.locator('#stepBackBtn')).toBeDisabled();
      await expect(page.locator('#jumpToBtn')).toBeEnabled();
      await expect(page.locator('#resetBtn')).toBeEnabled();
      await expect(page.locator('#modifyBtn')).toBeEnabled();
      await expect(page.locator('#autoPlayBtn')).toBeEnabled();

      // The states list should now contain multiple recorded steps for merge sort
      const statesListItems = page.locator('#statesList > div');
      await expect(statesListItems).toHaveCountGreaterThan(1);

      // First item should be the initial array step
      await expect(statesListItems.nth(0)).toContainText('Initial array');
    });

    test('GENERATE_RANDOM_ARRAY produces array when size valid; invalid size shows alert', async ({ page }) => {
      // invalid size: set to 1 and click -> should trigger alert
      await page.fill('#randomSizeInput', '1');
      await page.click('#randomArrayBtn');

      // Dialog should have been shown and accepted by our handler
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const lastDialog = dialogMessages[dialogMessages.length - 1];
      expect(lastDialog).toContain('Invalid size');

      // Now generate a valid random array size (e.g., 5)
      dialogMessages.length = 0; // clear recorded dialogs for clarity
      await page.fill('#randomSizeInput', '5');
      await page.click('#randomArrayBtn');

      // After successful generation, arrayInput should be populated
      const arrayInputValue = await page.locator('#arrayInput').inputValue();
      // Should contain at least a comma-separated list of numbers
      expect(arrayInputValue.split(/[\s,]+/).length).toBeGreaterThanOrEqual(2);

      // And states should be created (jumpToBtn enabled)
      await expect(page.locator('#jumpToBtn')).toBeEnabled();
      const statesListItems = page.locator('#statesList > div');
      await expect(statesListItems).toHaveCountGreaterThan(1);
    });
  });

  test.describe('History navigation and stepping (S1_ArrayLoaded behavior)', () => {
    test('STEP_FORWARD and STEP_BACK change current step and update display', async ({ page }) => {
      // Ensure we have a deterministic small array loaded
      await page.fill('#arrayInput', '4 2 7 1');
      await page.click('#loadArrayBtn');

      // Step forward once
      await page.click('#stepForwardBtn');
      // Operation should reflect a split or merge (non-initial)
      const opText = await page.locator('#currentOperationPre').textContent();
      expect(opText).toBeTruthy();
      expect(opText).not.toBe('Initial array');

      // Now step back and expect we return to initial
      await page.click('#stepBackBtn');
      await expect(page.locator('#currentOperationPre')).toHaveText('Initial array');

      // Keyboard shortcuts: ArrowRight -> step forward; ArrowLeft -> step back
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#currentOperationPre')).not.toHaveText('Initial array');
      await page.keyboard.press('ArrowLeft');
      await expect(page.locator('#currentOperationPre')).toHaveText('Initial array');
    });

    test('JUMP_TO_STEP moves to explicit step; invalid jump shows alert', async ({ page }) => {
      // Load a small array to ensure multiple steps
      await page.fill('#arrayInput', '10,9,8,7');
      await page.click('#loadArrayBtn');

      // Determine number of steps by counting states list items
      const statesListItems = page.locator('#statesList > div');
      const count = await statesListItems.count();
      expect(count).toBeGreaterThan(1);

      // Valid jump: go to the last step
      const lastIndex = count - 1;
      await page.fill('#jumpToInput', String(lastIndex));
      await page.click('#jumpToBtn');
      // Verify currentArrayPre now shows sorted or merged result from last step
      const curArr = await page.locator('#currentArrayPre').textContent();
      expect(curArr).toBeTruthy();

      // Invalid jump: too large -> should alert
      await page.fill('#jumpToInput', String(count + 100));
      await page.click('#jumpToBtn');

      // The alert should have been shown and recorded
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const foundInvalidJump = dialogMessages.some(msg => msg.includes('Invalid step number'));
      expect(foundInvalidJump).toBe(true);
    });

    test('RESET returns to initial step 0', async ({ page }) => {
      await page.fill('#arrayInput', '5,4,3');
      await page.click('#loadArrayBtn');

      // move forward
      await page.click('#stepForwardBtn');
      await expect(page.locator('#currentOperationPre')).not.toHaveText('Initial array');

      // click reset should go back to initial
      await page.click('#resetBtn');
      await expect(page.locator('#currentOperationPre')).toHaveText('Initial array');
      await expect(page.locator('#currentArrayPre')).toHaveText('[5, 4, 3]');
    });
  });

  test.describe('Auto Play (S1 -> S2 -> S1 transitions)', () => {
    test('AUTO_PLAY starts progression and PAUSE stops it (state transitions)', async ({ page }) => {
      // Load a small array
      await page.fill('#arrayInput', '6,3,9,2');
      await page.click('#loadArrayBtn');

      // Increase speed to make auto-play progress faster
      await page.locator('#speedSlider').evaluate((el) => {
        el.value = '10';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Record initial step index shown in jumpToInput
      const initialStep = parseInt(await page.locator('#jumpToInput').inputValue(), 10);

      // Start auto play
      await page.click('#autoPlayBtn');
      // After starting, autoPlayBtn disabled and pauseBtn enabled
      await expect(page.locator('#autoPlayBtn')).toBeDisabled();
      await expect(page.locator('#pauseBtn')).toBeEnabled();

      // Wait briefly to allow auto-play to advance at least one step
      await page.waitForTimeout(350);

      const midStep = parseInt(await page.locator('#jumpToInput').inputValue(), 10);
      expect(midStep).toBeGreaterThanOrEqual(initialStep);

      // Pause the auto-play
      await page.click('#pauseBtn');

      // After pausing, autoPlayBtn enabled again and pause disabled
      await expect(page.locator('#autoPlayBtn')).toBeEnabled();
      await expect(page.locator('#pauseBtn')).toBeDisabled();

      // Confirm current step did not continue to change after a short delay
      const stepAfterPause = parseInt(await page.locator('#jumpToInput').inputValue(), 10);
      await page.waitForTimeout(250);
      const stepAfterWait = parseInt(await page.locator('#jumpToInput').inputValue(), 10);
      expect(stepAfterWait).toBe(stepAfterPause);
    });
  });

  test.describe('Modify array element (MODIFY_ARRAY_ELEMENT event)', () => {
    test('MODIFY_ARRAY_ELEMENT updates base array and rebuilds states', async ({ page }) => {
      // Load a known array
      await page.fill('#arrayInput', '100,200,300');
      await page.click('#loadArrayBtn');

      // Ensure modify inputs are enabled
      await expect(page.locator('#modifyIndexInput')).toBeEnabled();
      await expect(page.locator('#modifyValueInput')).toBeEnabled();
      await expect(page.locator('#modifyBtn')).toBeEnabled();

      // Change index 0 value to 999 and click modify
      await page.fill('#modifyIndexInput', '0');
      await page.fill('#modifyValueInput', '999');
      await page.click('#modifyBtn');

      // After modification, initial array (step 0) should reflect change
      await expect(page.locator('#currentArrayPre')).toHaveText('[999, 200, 300]');

      // States list should be rebuilt (more than one step for array length 3)
      const statesListItems = page.locator('#statesList > div');
      await expect(statesListItems).toHaveCountGreaterThan(1);
      await expect(statesListItems.first()).toContainText('Initial array');
    });

    test('MODIFY_ARRAY_ELEMENT with out of bounds index triggers alert', async ({ page }) => {
      // Load a small array
      await page.fill('#arrayInput', '1,2');
      await page.click('#loadArrayBtn');

      // Provide an out-of-bounds index (e.g., 5)
      await page.fill('#modifyIndexInput', '5');
      await page.fill('#modifyValueInput', '42');
      await page.click('#modifyBtn');

      // An alert "Index out of bounds" should be shown
      const found = dialogMessages.some(msg => msg.includes('Index out of bounds'));
      expect(found).toBe(true);
    });
  });

  test.describe('Input validation edge cases', () => {
    test('LOAD_ARRAY with invalid input triggers alert and does not change state', async ({ page }) => {
      // Invalid textual input
      await page.fill('#arrayInput', 'foo, bar');
      await page.click('#loadArrayBtn');

      // Should have produced an alert about invalid array input
      const found = dialogMessages.some(msg => msg.includes('Invalid array input'));
      expect(found).toBe(true);

      // The application should remain in the "No array loaded" or previous state.
      // Because we started with initial setup, ensure we still have one state and current array is empty
      await expect(page.locator('#currentArrayPre')).toHaveText('[]');
      await expect(page.locator('#currentOperationPre')).toHaveText('No array loaded');
    });
  });
});