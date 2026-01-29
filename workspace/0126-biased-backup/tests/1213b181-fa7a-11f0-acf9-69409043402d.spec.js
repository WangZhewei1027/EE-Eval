import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1213b181-fa7a-11f0-acf9-69409043402d.html';

// Helper page-object-like selectors
function selectors(page) {
  return {
    arrayInput: page.locator('#array-input'),
    loadArrayBtn: page.locator('#load-array'),
    generateRandomBtn: page.locator('#generate-random'),
    randomSizeInput: page.locator('#random-size'),
    randomMinInput: page.locator('#random-min'),
    randomMaxInput: page.locator('#random-max'),
    stepForwardBtn: page.locator('#step-forward'),
    stepBackwardBtn: page.locator('#step-backward'),
    runAutoBtn: page.locator('#run-auto'),
    pauseAutoBtn: page.locator('#pause-auto'),
    resetBtn: page.locator('#reset'),
    clearLogBtn: page.locator('#clear-log'),
    autoIntervalInput: page.locator('#auto-interval'),
    arrayContainer: page.locator('#array-container'),
    statusText: page.locator('#status-text'),
    logContainer: page.locator('#log'),
    highlightCurrentCheckbox: page.locator('#highlight-current'),
    highlightMinCheckbox: page.locator('#highlight-min'),
    highlightSortedCheckbox: page.locator('#highlight-sorted')
  };
}

test.describe('Selection Sort Interactive Explorer - FSM and UI validation', () => {

  // Collect console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors on page object
    page._consoleMessages = [];
    page._pageErrors = [];
    page._dialogMessages = [];

    page.on('console', msg => {
      // record all console messages for assertions later
      page._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      page._pageErrors.push(err);
    });

    page.on('dialog', async dialog => {
      page._dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    await page.goto(BASE_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Assert there are no uncaught page errors (uncaught exceptions)
    expect(page._pageErrors.length, 'No uncaught page errors should occur').toBe(0);

    // Assert there are no console messages with type 'error'
    const consoleErrors = page._consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
    expect(consoleErrors.length, 'No console error-level messages expected').toBe(0);
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('displays initial status and Idle state entry action', async ({ page }) => {
      // Validate initial status text is the expected Idle message
      const s = selectors(page);
      await expect(s.statusText).toHaveText('Please input or generate an array to start sorting.');
      // No array elements present
      await expect(s.arrayContainer.locator('.array-element')).toHaveCount(0);
      // Buttons that should be disabled initially
      await expect(s.stepForwardBtn).toBeDisabled();
      await expect(s.stepBackwardBtn).toBeDisabled();
      await expect(s.runAutoBtn).toBeDisabled();
      await expect(s.pauseAutoBtn).toBeDisabled();
      await expect(s.resetBtn).toBeDisabled();
      // Log empty
      await expect(s.logContainer).toBeEmpty();
    });
  });

  test.describe('Array Loading (S1_ArrayLoaded) and transitions', () => {

    test('Load a valid array via Load Array button and verify UI state', async ({ page }) => {
      // This test loads a specific array and verifies S1 entry actions: initializeWithArray(arr), renderArray, renderLog, setStatus
      const s = selectors(page);

      await s.arrayInput.fill('5, 3, 8, 1, 9');
      await s.loadArrayBtn.click();

      // After load, status should report array length
      await expect(s.statusText).toHaveText('Array loaded with length 5. Ready to start.');

      // Array container should render 5 elements
      await expect(s.arrayContainer.locator('.array-element')).toHaveCount(5);

      // Log should have at least one entry (initial step)
      await expect(s.logContainer.locator('div')).toHaveCountGreaterThan(0);

      // Controls updated: step forward should be enabled, backward disabled, runAuto enabled, reset enabled
      await expect(s.stepForwardBtn).toBeEnabled();
      await expect(s.stepBackwardBtn).toBeDisabled();
      await expect(s.runAutoBtn).toBeEnabled();
      await expect(s.resetBtn).toBeEnabled();
      await expect(s.pauseAutoBtn).toBeDisabled();
    });

    test('Click a log entry to jump to that step (render and status update)', async ({ page }) => {
      const s = selectors(page);

      // Load array
      await s.arrayInput.fill('2,4,1');
      await s.loadArrayBtn.click();

      // Ensure log has items
      const logLines = s.logContainer.locator('div');
      await expect(logLines).toHaveCountGreaterThan(1);

      // Click the second log entry (index 1) and assert status changes accordingly
      const secondLine = logLines.nth(1);
      const textBefore = await secondLine.textContent();
      await secondLine.click();

      // Status should contain 'Step 1' and description snippet
      await expect(s.statusText).toContainText('Step 1:');

      // The clicked log entry should reflect aria-pressed true
      await expect(secondLine).toHaveAttribute('aria-pressed', 'true');
    });

    test('Invalid array input triggers alert and does not initialize', async ({ page }) => {
      const s = selectors(page);

      // Start fresh; ensure initial status present
      await expect(s.statusText).toHaveText('Please input or generate an array to start sorting.');

      // Enter invalid array (non-integer)
      await s.arrayInput.fill('5, a, 7');
      await s.loadArrayBtn.click();

      // Dialog should have been shown and accepted; verify message captured
      expect(page._dialogMessages.length).toBeGreaterThan(0);
      expect(page._dialogMessages[0]).toContain('Invalid input array');

      // Status should remain unchanged (no initialization)
      await expect(s.statusText).toHaveText('Please input or generate an array to start sorting.');

      // Array container should still be empty
      await expect(s.arrayContainer.locator('.array-element')).toHaveCount(0);
    });

    test('Generate Random Array creates array and initializes correctly', async ({ page }) => {
      const s = selectors(page);

      // Set small size to keep tests fast and deterministic-ish
      await s.randomSizeInput.fill('3');
      await s.randomMinInput.fill('1');
      await s.randomMaxInput.fill('5');

      // Click generate random
      await s.generateRandomBtn.click();

      // Status should reflect the loaded length
      await expect(s.statusText).toContainText('Array loaded with length');

      // Ensure array input got populated
      const arrayValue = await s.arrayInput.inputValue();
      expect(arrayValue.split(',').length).toBeGreaterThanOrEqual(1);

      // Array container should have 3 elements
      await expect(s.arrayContainer.locator('.array-element')).toHaveCount(3);
    });
  });

  test.describe('Step Controls and Sorting Progress (S2_Sorting)', () => {

    test('Step forward and backward update status and visuals', async ({ page }) => {
      const s = selectors(page);

      // Load array first
      await s.arrayInput.fill('4, 2, 6');
      await s.loadArrayBtn.click();

      // Click step forward and validate status changes to Step 1
      await s.stepForwardBtn.click();
      await expect(s.statusText).toContainText('Step 1:');

      // The array container should render a snapshot (still 3 elements)
      await expect(s.arrayContainer.locator('.array-element')).toHaveCount(3);

      // Step backward should now be enabled
      await expect(s.stepBackwardBtn).toBeEnabled();

      // Click step backward, status should change back to Step 0 (initial)
      await s.stepBackwardBtn.click();
      await expect(s.statusText).toContainText('Step 0:');

      // Press keyboard shortcut 'n' (next) when focus is not in an input to step forward
      await page.keyboard.press('n');
      await expect(s.statusText).toContainText('Step 1:');

      // Press 'p' to go back
      await page.keyboard.press('p');
      await expect(s.statusText).toContainText('Step 0:');
    });

    test('Run auto sorts the array to completion and final state observed (S3_Sorted)', async ({ page }) => {
      const s = selectors(page);

      // Use small array to keep number of steps small
      await s.arrayInput.fill('3,1,2');
      await s.loadArrayBtn.click();

      // Speed up auto interval
      await s.autoIntervalInput.fill('100');
      await s.autoIntervalInput.dispatchEvent('change'); // not required but mimic user change

      // Start auto run
      await s.runAutoBtn.click();

      // Wait until render shows finished state: all elements should have 'selected-sorted' class
      await page.waitForFunction(() => {
        const container = document.getElementById('array-container');
        if (!container) return false;
        const elems = Array.from(container.children);
        if (elems.length === 0) return false;
        return elems.every(el => el.classList.contains('selected-sorted'));
      }, null, { timeout: 5000 });

      // Status text should contain completion message (from final step description)
      await expect(s.statusText).toContainText('selection sort complete');

      // After completion runAuto should be disabled (no further forward steps)
      await expect(s.runAutoBtn).toBeDisabled();

      // Pause button should be disabled because auto stopped
      await expect(s.pauseAutoBtn).toBeDisabled();
    });

    test('Start auto then Pause auto mid-run stops progression', async ({ page }) => {
      const s = selectors(page);

      await s.autoIntervalInput.fill('100');
      await s.arrayInput.fill('6,5,4,3');
      await s.loadArrayBtn.click();

      // Start auto run
      await s.runAutoBtn.click();

      // Wait briefly to allow at least one step to happen
      await page.waitForTimeout(250);

      // While auto is running, pause button should be enabled; click it to stop
      if (await s.pauseAutoBtn.isEnabled()) {
        await s.pauseAutoBtn.click();
      }

      // After pause, pause button should be disabled and runAuto should be enabled again
      await expect(s.pauseAutoBtn).toBeDisabled();
      await expect(s.runAutoBtn).toBeEnabled();

      // Ensure status remains some 'Step' text
      const st = await s.statusText.textContent();
      expect(st).toMatch(/Step \d+:/);
    });
  });

  test.describe('Reset, Clear Log and Edge operations (S1 <-> S2 <-> S3 transitions)', () => {

    test('Reset during sorting returns to step 0 and shows reset status', async ({ page }) => {
      const s = selectors(page);

      await s.arrayInput.fill('9,7,8');
      await s.loadArrayBtn.click();

      // Move a couple of steps
      await s.stepForwardBtn.click();
      await s.stepForwardBtn.click();

      // Now reset
      await s.resetBtn.click();

      // Status should indicate reset
      await expect(s.statusText).toHaveText('Reset to initial state at step 0.');

      // After reset, first log entry should be active (Step 0)
      const firstLine = s.logContainer.locator('div').first();
      await expect(firstLine).toHaveAttribute('aria-pressed', 'true');

      // Array container should still render elements equal to input length
      await expect(s.arrayContainer.locator('.array-element')).toHaveCount(3);
    });

    test('Clear Log empties the log container', async ({ page }) => {
      const s = selectors(page);

      await s.arrayInput.fill('1,2,3');
      await s.loadArrayBtn.click();

      // Ensure log is non-empty
      await expect(s.logContainer.locator('div')).toHaveCountGreaterThan(0);

      // Clear log
      await s.clearLogBtn.click();

      // Log should be empty
      await expect(s.logContainer).toBeEmpty();
    });

    test('Toggle highlight checkboxes immediately rerenders current step without errors', async ({ page }) => {
      const s = selectors(page);

      await s.arrayInput.fill('2,3,1');
      await s.loadArrayBtn.click();

      // Toggle highlight options; these should re-render without throwing
      await s.highlightCurrentCheckbox.click();
      await s.highlightMinCheckbox.click();
      await s.highlightSortedCheckbox.click();

      // After toggles, ensure array elements still present
      await expect(s.arrayContainer.locator('.array-element')).toHaveCount(3);
    });
  });

  test.describe('Robustness and validation (edge cases)', () => {
    test('Generate random with invalid size triggers alert', async ({ page }) => {
      const s = selectors(page);

      // Provide invalid size (too small)
      await s.randomSizeInput.fill('1'); // min is 2
      await s.generateRandomBtn.click();

      // A dialog should have appeared
      expect(page._dialogMessages.length).toBeGreaterThan(0);
      expect(page._dialogMessages[page._dialogMessages.length - 1]).toContain('Random array size must be between 2 and 30.');
    });

    test('Min > Max in random generation triggers alert', async ({ page }) => {
      const s = selectors(page);

      await s.randomSizeInput.fill('3');
      await s.randomMinInput.fill('10');
      await s.randomMaxInput.fill('2'); // min > max

      await s.generateRandomBtn.click();

      expect(page._dialogMessages.length).toBeGreaterThan(0);
      expect(page._dialogMessages[page._dialogMessages.length - 1]).toContain('Min value cannot be greater than Max value.');
    });
  });
});