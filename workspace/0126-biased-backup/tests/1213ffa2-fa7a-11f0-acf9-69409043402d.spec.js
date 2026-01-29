import { test, expect } from '@playwright/test';

// Test suite for Binary Search Interactive Explorer
// Application ID: 1213ffa2-fa7a-11f0-acf9-69409043402d
// URL served at: http://127.0.0.1:5500/workspace/0126-biased/html/1213ffa2-fa7a-11f0-acf9-69409043402d.html

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1213ffa2-fa7a-11f0-acf9-69409043402d.html';

test.describe('Binary Search Interactive Explorer - FSM & UI tests', () => {
  let consoleMessages;
  let pageErrors;

  // Helper: wait until logOutput contains a substring (with timeout)
  async function waitForLogContains(page, substring, timeout = 2000) {
    const locator = page.locator('#logOutput');
    await page.waitForFunction(
      (el, text) => el && el.textContent && el.textContent.indexOf(text) !== -1,
      locator,
      substring,
      { timeout }
    );
  }

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture console messages for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // capture uncaught exceptions from the page
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure the page initial content is ready
    await expect(page.locator('h1')).toHaveText('Binary Search Interactive Explorer');
  });

  test.afterEach(async () => {
    // Sanity: ensure no uncaught page errors during tests
    expect(pageErrors, 'No uncaught page errors should be present').toEqual([]);
  });

  test('S0_Idle: initial Idle state is rendered correctly', async ({ page }) => {
    // Validate initial idle state (entry_action: renderPage())
    const stateOutput = page.locator('#stateOutput');
    await expect(stateOutput).toHaveText('(Load array and set target to start)');

    // Array visualization area should be empty text (no table)
    const arrayVis = await page.locator('#arrayVis').innerText();
    expect(arrayVis.trim() === '' || arrayVis.includes('(Array empty)')).toBeTruthy();

    // Buttons initial states: only Load Array enabled
    await expect(page.locator('#loadArrayBtn')).toBeEnabled();
    await expect(page.locator('#setTargetBtn')).toBeEnabled();
    // Many controls disabled until array+target set
    await expect(page.locator('#autoStepToggleBtn')).toBeDisabled();
    await expect(page.locator('#stepForwardBtn')).toBeDisabled();
    await expect(page.locator('#stepBackwardBtn')).toBeDisabled();
    await expect(page.locator('#resetSearchBtn')).toBeDisabled();
    await expect(page.locator('#manualCompareBtn')).toBeDisabled();
    await expect(page.locator('#exploreAllBtn')).toBeDisabled();
    await expect(page.locator('#showSummaryBtn')).toBeDisabled();

    // No page errors observed so far
    expect(pageErrors.length).toBe(0);
  });

  test('LOAD_ARRAY transition to S1_ArrayLoaded - valid and invalid inputs', async ({ page }) => {
    // Invalid array (not sorted)
    await page.locator('#arrayInput').fill('3, 2, 1');
    await page.locator('#loadArrayBtn').click();
    // Should log invalid input message
    await waitForLogContains(page, 'Invalid input array.');
    expect((await page.locator('#logOutput').textContent())).toContain('Invalid input array');

    // Now load a valid sorted array
    await page.locator('#arrayInput').fill('1, 3, 5, 7, 9');
    await page.locator('#loadArrayBtn').click();
    // Expect log and state update
    await waitForLogContains(page, 'Array loaded with 5 elements.');
    await expect(page.locator('#stateOutput')).toHaveText('Target not set.');

    // After loading array, many controls remain disabled until target set
    await expect(page.locator('#manualCompareBtn')).toBeDisabled();
    await expect(page.locator('#autoStepToggleBtn')).toBeDisabled();

    // Ensure no page errors
    expect(pageErrors.length).toBe(0);
  });

  test('SET_TARGET transition to S2_TargetSet and resetSearchSession behavior', async ({ page }) => {
    // Prepare: load array first
    await page.locator('#arrayInput').fill('1,3,5,7,9');
    await page.locator('#loadArrayBtn').click();
    await waitForLogContains(page, 'Array loaded with 5 elements.');

    // Try to set invalid (empty) target
    await page.locator('#targetInput').fill('');
    await page.locator('#setTargetBtn').click();
    await waitForLogContains(page, 'Empty target input.');
    expect((await page.locator('#logOutput').textContent())).toContain('Empty target input.');

    // Now set valid target value (7)
    await page.locator('#targetInput').fill('7');
    await page.locator('#setTargetBtn').click();
    // Expect logs: Target set and Search session reset
    await waitForLogContains(page, 'Target set to 7.');
    await waitForLogContains(page, 'Search session reset for target 7.');

    // After resetSearchSession we expect UI to show current search state for the target
    await expect(page.locator('#stateOutput')).toContainText('Current search state for target 7:');

    // Buttons should be enabled for control now
    await expect(page.locator('#manualCompareBtn')).toBeEnabled();
    await expect(page.locator('#autoStepToggleBtn')).toBeEnabled();
    await expect(page.locator('#stepForwardBtn')).toBeEnabled();
    await expect(page.locator('#stepBackwardBtn')).toBeEnabled();
    await expect(page.locator('#resetSearchBtn')).toBeEnabled();
    await expect(page.locator('#exploreAllBtn')).toBeEnabled();
    await expect(page.locator('#showSummaryBtn')).toBeEnabled();

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('MANUAL_COMPARE transitions: step through to found and then step backward', async ({ page }) => {
    // Load array and set target so we can manually drive comparisons
    await page.locator('#arrayInput').fill('1,3,5,7,9');
    await page.locator('#loadArrayBtn').click();
    await waitForLogContains(page, 'Array loaded with 5 elements.');
    await page.locator('#targetInput').fill('7');
    await page.locator('#setTargetBtn').click();
    await waitForLogContains(page, 'Target set to 7.');

    // At start: mid = floor(0+4/2) = 2 -> value 5. We will submit 'less' (5 < 7)
    await page.locator('#manualCompareInput').selectOption('less');
    await page.locator('#manualCompareBtn').click();

    // Expect a step log and state update (low should move to 3)
    await waitForLogContains(page, 'Step:');
    const stateTextAfterFirst = await page.locator('#stateOutput').textContent();
    expect(stateTextAfterFirst).toContain('Low index: 3');
    expect(stateTextAfterFirst).toContain('Mid index: 3');

    // Next step: mid = 3, value 7 -> submit 'equal'
    await page.locator('#manualCompareInput').selectOption('equal');
    await page.locator('#manualCompareBtn').click();

    // Expect search ended with found message and index 3
    await waitForLogContains(page, 'Target 7 found at index 3.');
    await expect(page.locator('#stateOutput')).toHaveText('Search ended: target 7 found at index 3.');

    // Array visualization should highlight found item; check that there's a cell with 'found' class
    const foundCells = await page.locator('#arrayVis td.found').allTextContents();
    expect(foundCells.length).toBeGreaterThanOrEqual(1);
    expect(foundCells[0]).toBe('7'); // first found cell should contain '7'

    // Now click step backward to revert last step
    await page.locator('#stepBackwardBtn').click();
    await waitForLogContains(page, 'Stepped backward one step.');
    // After stepping backward, search should be in-progress again (not ended)
    const afterBackState = await page.locator('#stateOutput').textContent();
    expect(afterBackState).toContain('Current search state for target 7:');

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('STEP_FORWARD auto-step and toggling AUTO_STEP', async ({ page }) => {
    // Load and set target
    await page.locator('#arrayInput').fill('1,3,5,7,9');
    await page.locator('#loadArrayBtn').click();
    await waitForLogContains(page, 'Array loaded with 5 elements.');
    await page.locator('#targetInput').fill('9');
    await page.locator('#setTargetBtn').click();
    await waitForLogContains(page, 'Target set to 9.');

    // Click Step Forward - should auto-choose comparison based on current mid vs target
    await page.locator('#stepForwardBtn').click();
    await waitForLogContains(page, 'Auto-step forward using comparison:');
    // The auto-step should progress UI; ensure stateOutput updates
    const stateAfterStep = await page.locator('#stateOutput').textContent();
    expect(stateAfterStep).toContain('Current search state for target 9:');

    // Reset search to start state
    await page.locator('#resetSearchBtn').click();
    await waitForLogContains(page, 'Search session reset for target 9.');

    // Toggle Auto-Step ON
    await page.locator('#autoStepToggleBtn').click();
    // Should change button text to Stop Auto-Step
    await expect(page.locator('#autoStepToggleBtn')).toHaveText('Stop Auto-Step');
    await waitForLogContains(page, 'Auto-step started');

    // Provide a manualCompareInput value so the auto-step timer can consume it and progress
    // Set manualCompareInput to 'less' to advance; wait for a step log triggered by auto-step timer
    await page.locator('#manualCompareInput').selectOption('less');
    // Wait for the auto-step interval to process the selection and log a Step
    await waitForLogContains(page, 'Step:');

    // Now stop auto-step
    await page.locator('#autoStepToggleBtn').click();
    await expect(page.locator('#autoStepToggleBtn')).toHaveText('Start Auto-Step');
    await waitForLogContains(page, 'Auto-step stopped.');

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('RESET_SEARCH transition and edge cases: reset without array/target', async ({ page }) => {
    // Reload to initial page to ensure clean environment
    await page.reload();
    await expect(page.locator('#stateOutput')).toHaveText('(Load array and set target to start)');

    // Try clicking resetSearchBtn when still disabled/no array
    await page.locator('#resetSearchBtn').click();
    // Because the button is disabled in initial state, clicking shouldn't have effect; there should be no new logs
    const initialLog = await page.locator('#logOutput').textContent();
    expect(initialLog.trim()).toBe('');

    // Load array then attempt reset before setting target (button disabled)
    await page.locator('#arrayInput').fill('1,2,3');
    await page.locator('#loadArrayBtn').click();
    await waitForLogContains(page, 'Array loaded with 3 elements.');
    // resetSearchBtn remains disabled until target set
    await expect(page.locator('#resetSearchBtn')).toBeDisabled();

    // Attempt to set target with invalid non-number
    await page.locator('#targetInput').fill('not-a-number');
    await page.locator('#setTargetBtn').click();
    await waitForLogContains(page, 'Target must be a valid number.');

    // Now set a valid target and then reset search
    await page.locator('#targetInput').fill('2');
    await page.locator('#setTargetBtn').click();
    await waitForLogContains(page, 'Target set to 2.');
    await waitForLogContains(page, 'Search session reset for target 2.');

    // Now click resetSearchBtn to truly reset the search (keeps array and target)
    await page.locator('#resetSearchBtn').click();
    await waitForLogContains(page, 'Search session reset for target 2.');

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('EXPLORE_ALL and SHOW_SUMMARY flows produce exploration results and summary', async ({ page }) => {
    // Load array and set target
    await page.locator('#arrayInput').fill('1,2,3,4');
    await page.locator('#loadArrayBtn').click();
    await waitForLogContains(page, 'Array loaded with 4 elements.');
    await page.locator('#targetInput').fill('3');
    await page.locator('#setTargetBtn').click();
    await waitForLogContains(page, 'Target set to 3.');

    // Start exhaustive exploration
    await page.locator('#exploreAllBtn').click();
    // Exploration completion log should appear
    await waitForLogContains(page, 'Exploration complete. Number of paths discovered:');
    // Show summary
    await page.locator('#showSummaryBtn').click();
    // The 'logOutput' pre is replaced with summary content by showExplorationSummary
    await page.waitForFunction(() => {
      const el = document.getElementById('logOutput');
      return el && el.textContent && el.textContent.indexOf('EXPLORATION SUMMARY:') === 0;
    }, null, { timeout: 2000 });

    const summaryText = await page.locator('#logOutput').textContent();
    expect(summaryText).toContain('EXPLORATION SUMMARY:');
    expect(summaryText).toMatch(/Total paths:\s*\d+/);

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: manual compare with unset selection logs an error', async ({ page }) => {
    // Load array and set target
    await page.locator('#arrayInput').fill('10,20,30');
    await page.locator('#loadArrayBtn').click();
    await waitForLogContains(page, 'Array loaded with 3 elements.');
    await page.locator('#targetInput').fill('20');
    await page.locator('#setTargetBtn').click();
    await waitForLogContains(page, 'Target set to 20.');

    // Ensure manualCompareInput is unset and click manualCompareBtn to trigger invalid submission
    await page.locator('#manualCompareInput').selectOption('unset');
    await page.locator('#manualCompareBtn').click();
    await waitForLogContains(page, 'No comparison selected, cannot proceed step.');
    expect((await page.locator('#logOutput').textContent())).toContain('No comparison selected, cannot proceed step.');

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Keyboard shortcut: pressing Enter on manualCompareInput triggers submission', async ({ page }) => {
    // Load array and set target
    await page.locator('#arrayInput').fill('2,4,6,8');
    await page.locator('#loadArrayBtn').click();
    await waitForLogContains(page, 'Array loaded with 4 elements.');
    await page.locator('#targetInput').fill('6');
    await page.locator('#setTargetBtn').click();
    await waitForLogContains(page, 'Target set to 6.');

    // Choose 'equal' when mid corresponds to 6 (simulate until mid becomes 2 -> value 6)
    // We'll use stepForward until mid is 2, then use keyboard Enter to submit 'equal'
    // Step forward first to reach correct mid if necessary
    await page.locator('#stepForwardBtn').click();
    await waitForLogContains(page, 'Auto-step forward using comparison:');

    // Ensure manual compare is enabled and set to equal
    await page.locator('#manualCompareInput').selectOption('equal');

    // Focus the select and press Enter - the app listens for keydown Enter to trigger click
    const select = page.locator('#manualCompareInput');
    await select.focus();
    await page.keyboard.press('Enter');

    // Wait for a step log
    await waitForLogContains(page, 'Step:');

    // Confirm either found or next state reached; ensure no page errors
    expect(pageErrors.length).toBe(0);
  });
});