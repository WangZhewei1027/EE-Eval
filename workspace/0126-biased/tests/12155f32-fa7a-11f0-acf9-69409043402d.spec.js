import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-biased/html/12155f32-fa7a-11f0-acf9-69409043402d.html';

test.describe('Process Exploration Interactive - FSM validation', () => {
  // Capture page errors and console messages for each test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait a short while to allow the inline script to initialize
    await page.waitForTimeout(50);
  });

  test.afterEach(async () => {
    // Ensure no uncaught page errors occurred during the test run
    expect(pageErrors.map((e) => e.message || String(e))).toEqual(
      []
    );
    // Not asserting on consoleMessages contents except ensuring it is an array
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  test.describe('Process lifecycle (start, pause, resume, reset)', () => {
    test('Start process enables controls and enters Start step', async ({ page }) => {
      // Validate initial UI state: process not started
      const stateDisplay = page.locator('#stateDisplay');
      await expect(stateDisplay).toContainText("Process not started");

      // Click Start Process
      await page.locator('#startProcessBtn').click();

      // After starting, status should show RUNNING and current step 'Start [start]'
      await expect(stateDisplay).toContainText('Status: RUNNING');
      await expect(stateDisplay).toContainText('Start [start]');

      // Buttons expected states after starting
      await expect(page.locator('#pauseProcessBtn')).toBeEnabled();
      await expect(page.locator('#resumeProcessBtn')).toBeDisabled();
      await expect(page.locator('#resetProcessBtn')).toBeEnabled();

      // Log textarea should contain "Process started."
      const logArea = page.locator('#log');
      await expect(logArea).toHaveValue(/Process started\./);
    });

    test('Pause and resume toggles paused state and buttons', async ({ page }) => {
      await page.locator('#startProcessBtn').click();

      // Pause the process
      await page.locator('#pauseProcessBtn').click();
      await expect(page.locator('#stateDisplay')).toContainText('(PAUSED)');

      // Pause should be disabled after pausing, resume enabled
      await expect(page.locator('#pauseProcessBtn')).toBeDisabled();
      await expect(page.locator('#resumeProcessBtn')).toBeEnabled();

      // Resume the process
      await page.locator('#resumeProcessBtn').click();
      await expect(page.locator('#stateDisplay')).not.toContainText('(PAUSED)');

      // After resume, pause becomes enabled again
      await expect(page.locator('#pauseProcessBtn')).toBeEnabled();
      await expect(page.locator('#resumeProcessBtn')).toBeDisabled();
    });

    test('Reset returns process to idle and clears state indicators', async ({ page }) => {
      await page.locator('#startProcessBtn').click();

      // Reset the process
      await page.locator('#resetProcessBtn').click();

      // Confirm stateDisplay shows process not started and status idle semantics
      await expect(page.locator('#stateDisplay')).toContainText("Process not started");
      // Reset should make reset button disabled (idle)
      await expect(page.locator('#resetProcessBtn')).toBeDisabled();

      // Data view should be rendered (no keys)
      await expect(page.locator('#dataView')).toHaveValue(/\(No data keys match filter\)/);
    });
  });

  test.describe('Step navigation, validation, and branching', () => {
    test('Advance from Start to Validation and require input before advancing', async ({ page }) => {
      await page.locator('#startProcessBtn').click();

      // Advance from start -> validation
      await page.locator('#advanceStepBtn').click();

      // Should be in Validation step
      await expect(page.locator('#stateDisplay')).toContainText('Validation Step [validation]');

      // Custom input should be enabled since validation requires input
      await expect(page.locator('#customInput')).toBeEnabled();
      await expect(page.locator('#submitInputBtn')).toBeEnabled();

      // Trying to click advance (should be disabled due to requiresInput)
      await expect(page.locator('#advanceStepBtn')).toBeDisabled();
    });

    test('Submit input "pass" goes to Approved branch, "fail" goes to Rejected', async ({ page }) => {
      // Start and get to validation
      await page.locator('#startProcessBtn').click();
      await page.locator('#advanceStepBtn').click();

      // Submit "pass" input
      await page.locator('#customInput').fill('please pass this');
      await page.locator('#submitInputBtn').click();

      // Should have entered Approved
      await expect(page.locator('#stateDisplay')).toContainText('Approved Branch [approved]');
      // Data should include validationResult set to "approved"
      await expect(page.locator('#dataView')).toContainText('validationResult: approved');

      // Now navigate back to validation by jumping to validation step for next part of test
      // Use Jump control: select 'Validation Step' in selector and click Jump
      await page.locator('#stepSelector').selectOption({ value: 'validation' });
      await page.locator('#jumpStepBtn').click();
      await expect(page.locator('#stateDisplay')).toContainText('Validation Step [validation]');

      // Submit "fail" input to go to rejected
      await page.locator('#customInput').fill('definitely fail this');
      await page.locator('#submitInputBtn').click();
      await expect(page.locator('#stateDisplay')).toContainText('Rejected Branch [rejected]');
      await expect(page.locator('#dataView')).toContainText('validationResult: rejected');
    });

    test('Branching from Approved to Execution via Take Branch prompt', async ({ page }) => {
      // Start -> validation -> submit pass -> approved
      await page.locator('#startProcessBtn').click();
      await page.locator('#advanceStepBtn').click();
      await page.locator('#customInput').fill('pass it');
      await page.locator('#submitInputBtn').click();
      await expect(page.locator('#stateDisplay')).toContainText('Approved Branch [approved]');

      // Branch: approved possibleNext = ["execution", "review"]
      // Intercept the prompt and choose option 1 (execution)
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        // Accept with "1" to pick the first choice (execution)
        await dialog.accept('1');
      });

      await page.locator('#branchStepBtn').click();

      // Now should be in execution step
      await expect(page.locator('#stateDisplay')).toContainText('Execution Step [execution]');
      // Execution step resets progress to 0 and enables the progress slider
      await expect(page.locator('#progressSlider')).toBeEnabled();
      await expect(page.locator('#progressValue')).toHaveText('0%');
    });

    test('Execution progress updates data and can branch to Completed and Failed', async ({ page }) => {
      // Start and navigate to execution
      await page.locator('#startProcessBtn').click();
      await page.locator('#advanceStepBtn').click();
      await page.locator('#customInput').fill('pass');
      await page.locator('#submitInputBtn').click();

      // Branch to execution via prompt
      page.once('dialog', async (dialog) => {
        await dialog.accept('1'); // choose execution
      });
      await page.locator('#branchStepBtn').click();
      await expect(page.locator('#stateDisplay')).toContainText('Execution Step [execution]');

      // Set progress to 50 using DOM evaluation to trigger input event
      await page.locator('#progressSlider').evaluate((el) => {
        el.value = '50';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Progress UI and data view should reflect 50%
      await expect(page.locator('#progressValue')).toHaveText('50%');
      await expect(page.locator('#dataView')).toContainText('progress: 50');

      // Now branch to Completed (choice 1) using Take Branch prompt
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('1'); // completed
      });
      await page.locator('#branchStepBtn').click();
      await expect(page.locator('#stateDisplay')).toContainText('Completed [completed]');
      // Data should contain completedAt timestamp (presence check)
      await expect(page.locator('#dataView')).toContainText('completedAt:');

      // Reset then run again and branch to Failed to cover failed path
      await page.locator('#resetProcessBtn').click();
      await page.locator('#startProcessBtn').click();
      await page.locator('#advanceStepBtn').click();
      await page.locator('#customInput').fill('pass');
      await page.locator('#submitInputBtn').click();
      page.once('dialog', async (d) => await d.accept('1')); // to execution
      await page.locator('#branchStepBtn').click();

      // Now branch to failed (choice 2)
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('2'); // failed
      });
      await page.locator('#branchStepBtn').click();
      await expect(page.locator('#stateDisplay')).toContainText('Failed [failed]');
      await expect(page.locator('#dataView')).toContainText('failedAt:');
    });

    test('Rejected path advances to Modify Data and back to Validation via branch', async ({ page }) {
      // Start -> validation -> submit 'fail' to get rejected
      await page.locator('#startProcessBtn').click();
      await page.locator('#advanceStepBtn').click();
      await page.locator('#customInput').fill('fail');
      await page.locator('#submitInputBtn').click();
      await expect(page.locator('#stateDisplay')).toContainText('Rejected Branch [rejected]');

      // From rejected, branch to modifyData (choice index 1)
      page.once('dialog', async (d) => {
        expect(d.type()).toBe('prompt');
        await d.accept('1'); // modifyData
      });
      await page.locator('#branchStepBtn').click();
      await expect(page.locator('#stateDisplay')).toContainText('Modify Data [modifyData]');

      // From Modify Data, branch to Validation to close the loop
      page.once('dialog', async (d) => {
        await d.accept('1'); // validation
      });
      await page.locator('#branchStepBtn').click();
      await expect(page.locator('#stateDisplay')).toContainText('Validation Step [validation]');
    });
  });

  test.describe('Data manipulation, filtering, and edge cases', () => {
    test('Set and delete data keys, filter data, and clear filter', async ({ page }) => {
      // Ensure page is running so dataView updates are rendered
      await page.locator('#startProcessBtn').click();

      // Set some keys
      await page.locator('#dataKeyInput').fill('alpha');
      await page.locator('#dataValueInput').fill('1');
      await page.locator('#setDataBtn').click();
      await expect(page.locator('#dataView')).toContainText('alpha: 1');

      await page.locator('#dataKeyInput').fill('beta');
      await page.locator('#dataValueInput').fill('2');
      await page.locator('#setDataBtn').click();
      await expect(page.locator('#dataView')).toContainText('beta: 2');

      // Filter to only show keys that include 'a' (should show 'alpha' only)
      await page.locator('#filterDataInput').fill('a');
      // Trigger input event (the input handler listens to input)
      await page.locator('#filterDataInput').dispatchEvent('input');
      await expect(page.locator('#dataView')).toContainText('alpha: 1');
      await expect(page.locator('#dataView')).not.toContainText('beta: 2');

      // Clear the filter
      await page.locator('#clearFilterBtn').click();
      await expect(page.locator('#dataView')).toContainText('alpha: 1');
      await expect(page.locator('#dataView')).toContainText('beta: 2');

      // Delete key 'alpha'
      await page.locator('#dataKeyInput').fill('alpha');
      await page.locator('#deleteDataBtn').click();
      await expect(page.locator('#dataView')).not.toContainText('alpha: 1');

      // Attempt deleting a non-existing key should trigger alert
      // Listen for the alert and assert message contains 'Data key not found.'
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toContain('Data key not found');
        await dialog.accept();
      });
      await page.locator('#dataKeyInput').fill('nonexistent-key');
      await page.locator('#deleteDataBtn').click();
    });

    test('Edge cases: submit empty input, advance when input required, and take branch when no options', async ({ page }) {
      // Start and go to validation
      await page.locator('#startProcessBtn').click();
      await page.locator('#advanceStepBtn').click();
      await expect(page.locator('#stateDisplay')).toContainText('Validation Step [validation]');

      // Attempt to submit empty input -> should show alert
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toContain('Input cannot be empty');
        await dialog.accept();
      });
      // Ensure customInput is empty then click submit
      await page.locator('#customInput').fill('');
      await page.locator('#submitInputBtn').click();

      // Attempt to advance while input required (advanceStepBtn should be disabled)
      await expect(page.locator('#advanceStepBtn')).toBeDisabled();

      // Jump to a step with no branching and attempt to takeBranch (should alert 'No branching options')
      // Jump to 'start' (no branching), then click Take Branch
      await page.locator('#stepSelector').selectOption({ value: 'start' });
      await page.locator('#jumpStepBtn').click();
      // Ensure we are in Start
      await expect(page.locator('#stateDisplay')).toContainText('Start [start]');

      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toContain('No branching options');
        await dialog.accept();
      });
      await page.locator('#branchStepBtn').click();
    });
  });

  test.describe('Logging and UI rendering checks', () => {
    test('Log area records major actions and can be cleared', async ({ page }) => {
      // Start process and perform some actions to generate logs
      await page.locator('#startProcessBtn').click();
      await page.locator('#advanceStepBtn').click();
      await page.locator('#customInput').fill('pass');
      await page.locator('#submitInputBtn').click();

      // Log should have multiple entries including "Process started." and "Entered step" entries
      const logArea = page.locator('#log');
      const logText = await logArea.inputValue();
      expect(logText).toMatch(/Process started\./);
      expect(logText).toMatch(/Entered step:/);

      // Clear the log using button
      await page.locator('#clearLogBtn').click();
      await expect(logArea).toHaveValue('');
    });
  });
});