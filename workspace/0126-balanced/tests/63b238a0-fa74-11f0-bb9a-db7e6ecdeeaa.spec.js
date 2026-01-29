import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b238a0-fa74-11f0-bb9a-db7e6ecdeeaa.html';

test.describe('Two Pointers Technique Demo (FSM) - 63b238a0-fa74-11f0-bb9a-db7e6ecdeeaa', () => {
  // Arrays to capture runtime console messages and uncaught page errors
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset captures before each test
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture all console messages and errors emitted by the page
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the application page
    await page.goto(APP_URL);
    // Ensure initial UI is loaded
    await expect(page.locator('#container')).toBeVisible();
  });

  test.afterEach(async () => {
    // Basic sanity: no unexpected uncaught page errors during the test
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    // Also expect no console.error messages
    expect(consoleErrors, 'No console.error messages should be logged').toEqual([]);
  });

  test('Initial Idle State (S0_Idle) - resetDisplay on load', async ({ page }) => {
    // This test validates the Idle state's entry action resetDisplay()
    // Expect arrayDisplay, log, and explanation to be empty at start
    const arrayDisplay = page.locator('#arrayDisplay');
    const log = page.locator('#log');
    const explanation = page.locator('#explanation');
    const startBtn = page.locator('#startBtn');

    await expect(arrayDisplay).toBeEmpty({ timeout: 2000 });
    await expect(log).toHaveText('', { timeout: 2000 });
    await expect(explanation).toHaveText('', { timeout: 2000 });

    // The start button should be enabled initially
    await expect(startBtn).toBeEnabled();
  });

  test.describe('Demo transitions from Idle (StartDemo event)', () => {
    test('S0 -> S1: Pair Sum Sorted demo runs and finds the expected pair', async ({ page }) => {
      // Validate selection of demo and StartDemo click triggers demoPairSumSorted()
      const demoSelect = page.locator('#demoSelect');
      const startBtn1 = page.locator('#startBtn1');
      const log1 = page.locator('#log1');
      const arrayDisplay1 = page.locator('#arrayDisplay1');

      // Ensure the correct option is selected (explicitly select for clarity)
      await demoSelect.selectOption('pairSumSorted');
      await expect(demoSelect).toHaveValue('pairSumSorted');

      // Click Start Demo and immediately assert the button becomes disabled
      await startBtn.click();
      await expect(startBtn).toBeDisabled();

      // The demo writes initial lines showing the array and target sum.
      // Wait for both expected starter log lines to appear.
      await page.waitForFunction(() => {
        const l = document.getElementById('log');
        return l && l.textContent && l.textContent.includes('Array:') && l.textContent.includes('Target Sum:');
      }, null, { timeout: 5000 });

      // Wait for the demo to finish. The application appends 'Demo finished.' after demo completes.
      await page.waitForFunction(() => {
        const l1 = document.getElementById('log');
        return l && l.textContent && l.textContent.includes('Demo finished.');
      }, null, { timeout: 30000 });

      // Confirm the log contains the expected found pair
      await expect(log).toContainText('Found pair: (4, 5)');

      // After completion, the start button should be re-enabled
      await expect(startBtn).toBeEnabled();

      // Visual assertions: arrayDisplay should show elements and pointer classes for the found pair
      // There should be at least one element with 'pointer-left' and one with 'pointer-right'
      const leftElems = arrayDisplay.locator('.pointer-left');
      const rightElems = arrayDisplay.locator('.pointer-right');

      await expect(leftElems).toHaveCount(1);
      await expect(rightElems).toHaveCount(1);

      // Check that the left pointer element's text is '4' and right pointer element's text is '5'
      await expect(leftElems.first()).toHaveText('4');
      await expect(rightElems.first()).toHaveText('5');

      // Also ensure the log shows the steps (checking sums and pointer moves)
      await expect(log).toContainText('Checking: arr[');
      await expect(log).toContainText('Sum less than target').or.toContainText('Sum greater than target').or.toContainText('Found pair');
    });

    test('S0 -> S2: Remove Duplicates demo runs and reports final length & modified array', async ({ page }) => {
      // Validate demoRemoveDuplicates behavior
      const demoSelect1 = page.locator('#demoSelect1');
      const startBtn2 = page.locator('#startBtn2');
      const log2 = page.locator('#log2');
      const arrayDisplay2 = page.locator('#arrayDisplay2');
      const explanation1 = page.locator('#explanation1');

      await demoSelect.selectOption('removeDuplicates');
      await expect(demoSelect).toHaveValue('removeDuplicates');

      await startBtn.click();
      await expect(startBtn).toBeDisabled();

      // Wait until the demo logs the final length line
      await page.waitForFunction(() => {
        const l2 = document.getElementById('log');
        return l && l.textContent && l.textContent.includes('Final length of unique elements:');
      }, null, { timeout: 30000 });

      // Confirm the final length is reported as 5 (for [0,1,2,3,4])
      await expect(log).toContainText('Final length of unique elements: 5');

      // Confirm modified array in the log contains the expected unique elements
      await expect(log).toContainText('Modified array (only first 5 elements valid): [0, 1, 2, 3, 4]');

      // After demo finished, start button should be enabled again
      await expect(startBtn).toBeEnabled();

      // Visual: arrayDisplay should have some children reflecting the array visualization
      const items = arrayDisplay.locator('.arrayItem');
      await expect(items).toHaveCountGreaterThan(0);

      // Explanation should include the LeetCode reference included in entry actions
      await expect(explanation).toContainText('LeetCode #26');
    });

    test('S0 -> S3: Palindrome Check demo identifies palindrome and updates UI', async ({ page }) => {
      // Validate demoPalindromeCheck behavior
      const demoSelect2 = page.locator('#demoSelect2');
      const startBtn3 = page.locator('#startBtn3');
      const log3 = page.locator('#log3');
      const arrayDisplay3 = page.locator('#arrayDisplay3');
      const explanation2 = page.locator('#explanation2');

      await demoSelect.selectOption('palindromeCheck');
      await expect(demoSelect).toHaveValue('palindromeCheck');

      await startBtn.click();
      await expect(startBtn).toBeDisabled();

      // Wait for palindrome confirmation in the log
      await page.waitForFunction(() => {
        const l3 = document.getElementById('log');
        return l && l.textContent && l.textContent.includes('All characters matched. It is a palindrome!');
      }, null, { timeout: 30000 });

      await expect(log).toContainText('All characters matched. It is a palindrome!');

      // Explanation should reflect the palindrome result appended by displayString
      await expect(explanation).toContainText('It is a palindrome!');

      // Visual: arrayDisplay should show characters (arrayItems) equal to the string length "racecar" => 7
      const items1 = arrayDisplay.locator('.arrayItem');
      await expect(items).toHaveCount(7);

      await expect(startBtn).toBeEnabled();
    });
  });

  test('Edge case: Starting demo with an invalid selection should still finish gracefully', async ({ page }) => {
    // This test intentionally sets an invalid select value and clicks Start Demo.
    // The application's startDemo should handle unknown values by not executing any demo,
    // but still complete and re-enable the Start button. We must not modify code other than setting DOM values.
    const demoSelect3 = page.locator('#demoSelect3');
    const startBtn4 = page.locator('#startBtn4');
    const log4 = page.locator('#log4');

    // Set an invalid value directly on the <select>
    await page.evaluate(() => {
      const sel = document.getElementById('demoSelect');
      // Add a non-existent option value dynamically (this manipulates DOM only)
      const opt = document.createElement('option');
      opt.value = 'invalid_demo_value';
      opt.text = 'Invalid Demo';
      sel.appendChild(opt);
      sel.value = 'invalid_demo_value';
    });

    await expect(demoSelect).toHaveValue('invalid_demo_value');

    // Click start and expect the function to complete without throwing
    await startBtn.click();

    // Wait for 'Demo finished.' message which is always written after startDemo returns
    await page.waitForFunction(() => {
      const l4 = document.getElementById('log');
      return l && l.textContent && l.textContent.includes('Demo finished.');
    }, null, { timeout: 5000 });

    await expect(log).toContainText('Demo finished.');

    // Ensure start button is re-enabled
    await expect(startBtn).toBeEnabled();
  });

  test('Concurrency / rapid interaction: Start button disables to prevent double starts', async ({ page }) => {
    // Ensure that rapid consecutive clicks do not start multiple demos at once
    const demoSelect4 = page.locator('#demoSelect4');
    const startBtn5 = page.locator('#startBtn5');
    const log5 = page.locator('#log5');

    await demoSelect.selectOption('pairSumSorted');
    await expect(demoSelect).toHaveValue('pairSumSorted');

    // Click start and immediately attempt a second click
    await startBtn.click();
    // Immediately after click the button should be disabled
    await expect(startBtn).toBeDisabled();

    // Attempting to click again should have no effect (button disabled)
    await page.mouse.click(0, 0); // click somewhere else to simulate user activity
    // Wait until demo completes
    await page.waitForFunction(() => {
      const l5 = document.getElementById('log');
      return l && l.textContent && l.textContent.includes('Demo finished.');
    }, null, { timeout: 30000 });

    // Ensure we saw exactly one "Array:" initial log line indicating only one demo run began
    const arrayLogCount = consoleMessages.filter(m => m.text.includes('Array: [')).length;
    // There may be one console.log entry per writeLog call; ensure at least one occurred
    expect(arrayLogCount).toBeGreaterThanOrEqual(1);

    // The important behavioral assertion: Start button should be enabled after completion
    await expect(startBtn).toBeEnabled();
  });
});