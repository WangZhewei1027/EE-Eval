import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-biased/html/1213ffa1-fa7a-11f0-acf9-69409043402d.html';

test.describe('Linear Search Interactive Demo - FSM validation (App ID: 1213ffa1-fa7a-11f0-acf9-69409043402d)', () => {
  let consoleMessages;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    // Capture console messages, page errors and dialogs for assertions
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    page.on('console', msg => {
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push('<console parsing error>');
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      // Accept to avoid blocking
      await dialog.accept();
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
    // Wait for main elements to be visible so page has initialized
    await expect(page.locator('#arrayDisplay')).toBeVisible();
    await expect(page.locator('#btnLoadArray')).toBeVisible();
  });

  test.afterEach(async () => {
    // Basic guard: there should be no uncaught page errors during normal operation
    // We assert this at the end of each test to catch runtime exceptions.
    expect(pageErrors.length).toBe(0);
  });

  test('S0_Idle - initial render shows Idle state (renderPage entry effects)', async ({ page }) => {
    // Validate that initial UI reflects Idle state from FSM
    await expect(page.locator('#arrayDisplay')).toHaveText('[ ]');
    await expect(page.locator('#currentIndexDisplay')).toHaveText('-');
    await expect(page.locator('#maxIndexDisplay')).toHaveText('-');
    await expect(page.locator('#searchStatus')).toHaveText('No search started.');

    // Navigation controls start disabled
    await expect(page.locator('#btnStepForward')).toBeDisabled();
    await expect(page.locator('#btnStepBackward')).toBeDisabled();
    await expect(page.locator('#btnAutoSearch')).toBeDisabled();

    // No error messages on load
    expect(pageErrors.length).toBe(0);
    // Console should capture some initial logs or be empty; at least no errors in console
    const errorConsoleLines = consoleMessages.filter(m => /error|uncaught|exception/i.test(m));
    expect(errorConsoleLines.length).toBe(0);
  });

  test.describe('Array Loading and Search Setup (S0 -> S1 -> S2)', () => {
    test('LoadArray event transitions to Array Loaded (S1_ArrayLoaded)', async ({ page }) => {
      // Enter a valid numeric array and load it
      await page.fill('#arrayInput', '10, 20, 30');
      await page.click('#btnLoadArray');

      // Expect array displayed and reset search status
      await expect(page.locator('#arrayDisplay')).toHaveText(/[10|20|30]/);
      await expect(page.locator('#currentIndexDisplay')).toHaveText('-');
      await expect(page.locator('#maxIndexDisplay')).toHaveText('2');

      // The log should contain "Array loaded with length 3."
      const logText = await page.locator('#log').innerText();
      expect(logText).toMatch(/Array loaded with length 3\./);

      // Search status should reflect resetSearch() entry action
      await expect(page.locator('#searchStatus')).toHaveText('Search reset, ready to start.');
    });

    test('SetTarget event transitions to Searching (S2_Searching) and enables stepping', async ({ page }) => {
      // Load array
      await page.fill('#arrayInput', '1,2,3');
      await page.click('#btnLoadArray');

      // Enter target and set it
      await page.fill('#targetValue', '2');
      // btnSetTarget becomes enabled after array loaded and target entered
      await expect(page.locator('#btnSetTarget')).toBeEnabled();
      await page.click('#btnSetTarget');

      // Expect search target set status and log entry
      await expect(page.locator('#searchStatus')).toHaveText(/Target set: '2'\. Ready to start search\./);
      const logText = await page.locator('#log').innerText();
      expect(logText).toMatch(/Search target set to '2'/);

      // After setting target, step forward should be enabled (array exists, not completed)
      await expect(page.locator('#btnStepForward')).toBeEnabled();
    });
  });

  test.describe('Stepping, Completion, and Backward navigation', () => {
    test('StepForward finds target and transitions to Search Completed (S3_SearchCompleted)', async ({
      page
    }) => {
      // Load array where target is at index 0 to observe immediate found behavior
      await page.fill('#arrayInput', '7,8,9');
      await page.click('#btnLoadArray');

      await page.fill('#targetValue', '7');
      await page.click('#btnSetTarget');

      // Click step forward to find target at index 0
      await page.click('#btnStepForward');

      // Expect searchStatus to indicate found and completion
      await expect(page.locator('#searchStatus')).toHaveText('Target found at index 0. Search completed.');
      // Current index updated
      await expect(page.locator('#currentIndexDisplay')).toHaveText('0');

      // After completion, StepForward should be disabled
      await expect(page.locator('#btnStepForward')).toBeDisabled();
    });

    test('StepBackward decrements currentIndex and updates status', async ({ page }) => {
      // Load and set up for a case where we can step back
      await page.fill('#arrayInput', '1,2,3');
      await page.click('#btnLoadArray');

      await page.fill('#targetValue', '2'); // target at index 1
      await page.click('#btnSetTarget');

      // Step forward twice: first to idx 0 (no match), second to idx 1 (found)
      await page.click('#btnStepForward');
      await expect(page.locator('#searchStatus')).toHaveText(/No match at index 0\./);
      await page.click('#btnStepForward');
      await expect(page.locator('#searchStatus')).toHaveText('Target found at index 1. Search completed.');
      await expect(page.locator('#currentIndexDisplay')).toHaveText('1');

      // Now step backward to move to index 0
      await page.click('#btnStepBackward');
      await expect(page.locator('#currentIndexDisplay')).toHaveText('0');
      await expect(page.locator('#searchStatus')).toHaveText(/Stepped backward to index 0\./);
    });
  });

  test.describe('Auto Search, Jumping, and Match Navigation', () => {
    test('AutoSearch starts and Stop Auto Search toggles buttons (AutoSearch event)', async ({ page }) => {
      // Load array and set target
      await page.fill('#arrayInput', '4,5,6');
      await page.click('#btnLoadArray');

      await page.fill('#targetValue', '6');
      await page.click('#btnSetTarget');

      // Start auto search; this should disable Start auto and enable Stop auto
      await page.click('#btnAutoSearch');
      await expect(page.locator('#btnAutoSearch')).toBeDisabled();
      await expect(page.locator('#btnStopAuto')).toBeEnabled();

      // Immediately stop auto search
      await page.click('#btnStopAuto');

      // Buttons should toggle back
      await expect(page.locator('#btnAutoSearch')).toBeEnabled();
      await expect(page.locator('#btnStopAuto')).toBeDisabled();
    });

    test('JumpToIndex updates current index and reports status (JumpToIndex event)', async ({ page }) => {
      await page.fill('#arrayInput', '11,22,33,44');
      await page.click('#btnLoadArray');

      // Jump to index 2 (valid)
      await page.fill('#jumpIndex', '2');
      // btnJumpIndex is enabled after array load
      await expect(page.locator('#btnJumpIndex')).toBeEnabled();
      await page.click('#btnJumpIndex');

      await expect(page.locator('#searchStatus')).toHaveText(/Jumped to index 2/);
      await expect(page.locator('#currentIndexDisplay')).toHaveText('2');

      // Jump to out-of-bounds index should report Index out of bounds.
      await page.fill('#jumpIndex', '100');
      await page.click('#btnJumpIndex');
      await expect(page.locator('#searchStatus')).toHaveText('Index out of bounds.');
    });

    test('HighlightAllMatches and ClearHighlights behavior after finding multiple matches', async ({ page }) => {
      // Create an array with duplicate entries
      await page.fill('#arrayInput', '5,5,7');
      await page.click('#btnLoadArray');

      // Switch to "All occurrences" search mode: radios become enabled after array loaded
      const allRadio = page.locator('input[name="searchMode"][value="all"]');
      await expect(allRadio).toBeEnabled();
      await allRadio.check();

      // Set target to 5 and set it
      await page.fill('#targetValue', '5');
      await page.click('#btnSetTarget');

      // Step through until both 5's are found.
      // First step -> idx0 found (all-mode continues), second step -> idx1 found
      await page.click('#btnStepForward');
      await expect(page.locator('#matchCount')).toHaveText('1');
      await page.click('#btnStepForward');
      await expect(page.locator('#matchCount')).toHaveText('2');

      // Highlight all matches
      await expect(page.locator('#btnHighlightAllMatches')).toBeEnabled();
      await page.click('#btnHighlightAllMatches');

      // Array display should contain '*' markers around matches (e.g., *5*)
      const displayText = await page.locator('#arrayDisplay').innerText();
      expect(displayText).toContain('*5*');

      // Clear highlights
      await page.click('#btnClearHighlights');
      const displayTextAfterClear = await page.locator('#arrayDisplay').innerText();
      // After clearing, no '*' should be present
      expect(displayTextAfterClear).not.toContain('*5*');
    });
  });

  test.describe('Error and edge cases', () => {
    test('Loading invalid numeric array shows validation error', async ({ page }) => {
      // Provide invalid numeric input (letters) and attempt to load
      await page.fill('#arrayInput', 'a, b, 3');
      await page.click('#btnLoadArray');

      // arrayError element should briefly show an error about invalid number
      const errorLocator = page.locator('#arrayError');
      await expect(errorLocator).toHaveText(/Invalid number at position/i, { timeout: 2000 });

      // Wait for the script to clear the error (setTimeout 3s)
      await expect(errorLocator).toHaveText('', { timeout: 4000 });
    });

    test('Setting invalid target triggers dialog error (invalid numeric target)', async ({ page }) => {
      // Load numeric array
      await page.fill('#arrayInput', '2,4,6');
      await page.click('#btnLoadArray');

      // Enter invalid target (non-number) and attempt to set
      await page.fill('#targetValue', 'notANumber');
      // Clicking Set Target will raise a caught exception which triggers alert in the catch block.
      await page.click('#btnSetTarget');

      // We captured dialogs in beforeEach; expect at least one dialog message that contains "Error setting target"
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const found = dialogs.some(d => /Error setting target/i.test(d));
      expect(found).toBeTruthy();
    });

    test('Keyboard shortcuts: Space triggers StepForward when enabled', async ({ page }) => {
      // Load and set up target so stepping is possible
      await page.fill('#arrayInput', '9,8');
      await page.click('#btnLoadArray');

      await page.fill('#targetValue', '8');
      await page.click('#btnSetTarget');

      // Ensure step forward enabled
      await expect(page.locator('#btnStepForward')).toBeEnabled();

      // Press Space to trigger a step forward (global handler listens on body)
      await page.keyboard.press('Space');

      // After pressing space, currentIndex should be 0 (first step) or 'Target found...' if target is first
      // Since target is 8 at index 1, first step is index 0 (no match)
      await expect(page.locator('#currentIndexDisplay')).toHaveText('0');
      await expect(page.locator('#searchStatus')).toHaveText(/No match at index 0\./);
    });
  });

  test('Comprehensive console and runtime checks across interactions', async ({ page }) => {
    // Perform a sequence of interactions while we have the listeners active
    await page.fill('#arrayInput', '100,200,300');
    await page.click('#btnLoadArray');

    await page.fill('#targetValue', '200');
    await page.click('#btnSetTarget');

    await page.click('#btnStepForward'); // index 0
    await page.click('#btnStepForward'); // index 1 -> found

    // Verify that expected log messages were emitted
    const logText = await page.locator('#log').innerText();
    expect(logText).toMatch(/Array loaded with length 3\./);
    expect(logText).toMatch(/Search target set to '200'/);

    // Validate no uncaught runtime errors occurred
    expect(pageErrors.length).toBe(0);

    // Sanity-check: console should contain our log lines (logMessage uses textContent on #log; also console may not have them, but ensure console didn't record errors)
    const consoleErrors = consoleMessages.filter(m => /error|uncaught|exception/i.test(m));
    expect(consoleErrors.length).toBe(0);
  });
});