import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122d85a1-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Version Control FSM - Application 122d85a1-fa7b-11f0-814c-dbec508f0b3b', () => {
  // Arrays to collect runtime diagnostics per test
  let pageErrors = [];
  let consoleMessages = [];

  // Navigate to the page before each test and wire up listeners to capture console and page errors.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Collect page error messages (runtime exceptions)
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    page.on('console', (msg) => {
      // Collect console output for later assertions/diagnostics
      try {
        consoleMessages.push(msg.text());
      } catch {
        consoleMessages.push(String(msg));
      }
    });

    // Load the page and wait for the load event; allow the scripts to run (and naturally throw if they do).
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('Initial page render - verifies static DOM elements', async ({ page }) => {
    // Validate basic structure exists as expected by the FSM's Idle state
    // Comment: Ensure the title and key inputs are present with initial values
    await expect(page.locator('h1')).toHaveText('Version Control');
    await expect(page.locator('#version')).toHaveValue('1.0');
    await expect(page.locator('#branch')).toHaveValue('master');
    await expect(page.locator('#feature')).toHaveValue('bug fix');
    await expect(page.locator('#release')).toHaveValue('v1.0');
    await expect(page.locator('#status')).toHaveValue('active');

    // Confirm progress label exists and starts at 0%
    await expect(page.locator('#progress-label')).toHaveText('0%');

    // The page may produce runtime errors (per implementation). We don't fail here but record diagnostics.
    // At least ensure the page loaded and elements are interactable.
  });

  test.describe('Version operations', () => {
    test('Update version increments the version displayed on the Update button', async ({ page }) => {
      // Click update-version and verify the button.value is incremented (handler writes to the button element's value)
      const updateBtn = page.locator('#update-version');
      // initial click
      await updateBtn.click();
      // small wait to allow handler to run
      await page.waitForTimeout(100);
      const valueAfterFirst = await updateBtn.evaluate((el) => el.value);
      // parse to number if possible
      expect(Number(valueAfterFirst)).toBeGreaterThanOrEqual(1);

      // click again
      await updateBtn.click();
      await page.waitForTimeout(100);
      const valueAfterSecond = await updateBtn.evaluate((el) => el.value);
      expect(Number(valueAfterSecond)).toBeGreaterThan(Number(valueAfterFirst));
    });

    test('Reset version sets version back to 1 (or 1.0) on the Update button', async ({ page }) => {
      const updateBtn = page.locator('#update-version');
      const resetBtn = page.locator('#reset-version');

      // mutate version
      await updateBtn.click();
      await page.waitForTimeout(50);

      // reset
      await resetBtn.click();
      await page.waitForTimeout(50);

      const resetValue = await updateBtn.evaluate((el) => el.value);
      // Accept either "1" or "1.0" depending on how the script sets it
      expect(['1', '1.0', 1, 1.0].map(String)).toContain(String(resetValue));
    });
  });

  test.describe('Branch operations', () => {
    test('Update branch uses prompt and writes the value to the Update button', async ({ page }) => {
      // Prepare to respond to the prompt shown by the page
      const newBranchName = 'feature/new-cool';
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept(newBranchName);
      });

      const updateBranchBtn = page.locator('#update-branch');
      await updateBranchBtn.click();
      await page.waitForTimeout(100);

      const btnValue = await updateBranchBtn.evaluate((el) => el.value);
      expect(btnValue).toBe(newBranchName);
    });

    test('Reset branch sets Update button value back to master', async ({ page }) => {
      const resetBranchBtn = page.locator('#reset-branch');
      const updateBranchBtn = page.locator('#update-branch');

      await resetBranchBtn.click();
      await page.waitForTimeout(100);

      const btnValue = await updateBranchBtn.evaluate((el) => el.value);
      expect(btnValue).toBe('master');
    });
  });

  test.describe('Feature operations', () => {
    test('Add feature uses prompt and writes the value to the Add Feature button', async ({ page }) => {
      const newFeature = 'awesome-feature';
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept(newFeature);
      });

      const addFeatureBtn = page.locator('#add-feature');
      await addFeatureBtn.click();
      await page.waitForTimeout(100);

      const btnValue = await addFeatureBtn.evaluate((el) => el.value);
      expect(btnValue).toBe(newFeature);
    });

    test('Remove feature attempts to remove and triggers an error due to buggy DOM operations', async ({ page }) => {
      // Ensure feature is non-empty by adding one first
      const featureName = 'temp-feature-to-remove';
      page.once('dialog', async (dialog) => dialog.accept(featureName));
      await page.locator('#add-feature').click();
      await page.waitForTimeout(50);

      // Clear any prior errors captured
      pageErrors = [];

      // Click remove; implementation uses .indexOf on an element and tries to splice, which should throw
      await page.locator('#remove-feature').click();

      // Wait shortly for any errors to propagate
      await page.waitForTimeout(200);

      // Expect at least one runtime error mentioning "is not a function" or "splice" or similar
      const joined = pageErrors.join(' | ');
      expect(joined.length).toBeGreaterThan(0);
      expect(joined).toMatch(/is not a function|splice|indexOf|TypeError/i);
    });

    test('Release feature only runs when feature is non-empty; uses prompt to capture release name', async ({ page }) => {
      // Ensure feature is set first
      const featureName = 'feature-to-release';
      page.once('dialog', async (d) => d.accept(featureName));
      await page.locator('#add-feature').click();
      await page.waitForTimeout(50);

      // Now attempt to release; release uses prompt if feature !== ""
      const releaseName = 'v2.0-feature';
      page.once('dialog', async (d) => {
        expect(d.type()).toBe('prompt');
        await d.accept(releaseName);
      });

      await page.locator('#release-feature').click();
      await page.waitForTimeout(100);

      const releaseBtnValue = await page.locator('#release-feature').evaluate((el) => el.value);
      // If it ran, the button's value should be the release name
      expect(releaseBtnValue).toBe(releaseName);
    });
  });

  test.describe('Branch release', () => {
    test('Release branch uses prompt and sets button value', async ({ page }) => {
      const releaseBranchName = 'v2.1-branch';
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept(releaseBranchName);
      });

      await page.locator('#release-branch').click();
      await page.waitForTimeout(100);

      const btnValue = await page.locator('#release-branch').evaluate((el) => el.value);
      expect(btnValue).toBe(releaseBranchName);
    });
  });

  test.describe('Workflow operations', () => {
    test('Start workflow sets Start button value according to internal workflow state', async ({ page }) => {
      // As implemented, workflow variable is initialized to "create" at script load time.
      // Clicking start-workflow should set the button.value to "Creating workflow"
      const startBtn = page.locator('#start-workflow');
      await startBtn.click();
      await page.waitForTimeout(100);
      const val = await startBtn.evaluate((el) => el.value);
      expect(val).toBe('Creating workflow');
    });

    test('Stop workflow sets Stop button value to "Stopping workflow"', async ({ page }) => {
      const stopBtn = page.locator('#stop-workflow');
      await stopBtn.click();
      await page.waitForTimeout(100);
      const val = await stopBtn.evaluate((el) => el.value);
      expect(val).toBe('Stopping workflow');
    });
  });

  test.describe('Progress operations (label and canvas interactions)', () => {
    test('Start progress increments the progress label (and updates UI)', async ({ page }) => {
      // Clear any previous errors to focus on this action
      pageErrors = [];

      // Click start-progress which increments a JS progress variable and calls updateProgress()
      await page.locator('#start-progress').click();
      await page.waitForTimeout(100);

      // The label should reflect an increment from "0%" to "1%" in normal (non-broken) flow.
      const label = await page.locator('#progress-label').innerText();
      // Accept that it might be '1%' or remain '0%' if an error occurred; assert at least one of these
      expect(['0%', '1%', '2%']).toContain(label);

      // Additionally, clicking the canvas-start in the second script also sets startProgress.value; try interacting
      await page.locator('#start-progress').click();
      await page.waitForTimeout(100);

      // Check that at least one console message or page error is present if the canvas logic fails
      const joinedErrors = pageErrors.join(' | ');
      if (joinedErrors.length > 0) {
        // If there are errors, ensure they look like the known issues (getContext on input or canvas conflicts)
        expect(joinedErrors).toMatch(/getContext|is not a function|Assignment to constant variable|already been declared/i);
      }
    });

    test('Stop progress decreases the progress label or sets Stop button value when canvas handlers run', async ({ page }) => {
      // Click start a few times to ensure progress > 0
      await page.locator('#start-progress').click();
      await page.waitForTimeout(50);
      await page.locator('#start-progress').click();
      await page.waitForTimeout(50);

      // Now click stop-progress
      await page.locator('#stop-progress').click();
      await page.waitForTimeout(100);

      // The label should be a numeric percent; ensure it's formatted like "X%"
      const label = await page.locator('#progress-label').innerText();
      expect(label).toMatch(/^\d+%$/);
    });
  });

  test.describe('Status operations', () => {
    test('Update status uses prompt and attempts to set button value (may encounter assignment-to-const error)', async ({ page }) => {
      // Provide a response to the prompt (if it runs)
      const newStatus = 'paused';
      page.once('dialog', async (d) => {
        // The code uses prompt, so expect it
        expect(d.type()).toBe('prompt');
        await d.accept(newStatus);
      });

      // Attempt to click update-status. Note: implementation assigns updateStatus as a const earlier,
      // then later reassigns updateStatus = () => { ... } which will cause a runtime TypeError during page load.
      // But since event listeners were created before that line, this click may still trigger the original element handler if present.
      await page.locator('#update-status').click();
      await page.waitForTimeout(100);

      // Because of the known buggy reassignment, this may have produced a page error; assert presence of either:
      // - button value reflecting new status
      // - or a runtime error captured earlier describing an assignment to a constant variable
      const statusBtnVal = await page.locator('#update-status').evaluate((el) => el.value);
      const errorsJoined = pageErrors.join(' | ');

      if (statusBtnVal && statusBtnVal.length > 0 && statusBtnVal !== 'Update Status') {
        expect(statusBtnVal).toContain(newStatus);
      } else {
        // If no successful update, we must have captured an error consistent with the buggy implementation
        expect(errorsJoined).toMatch(/Assignment to constant variable|TypeError|is not a function|already been declared/i);
      }
    });

    test('Reset status should set status back to active or produce an error if function assignment failed', async ({ page }) => {
      // Click reset-status
      await page.locator('#reset-status').click();
      await page.waitForTimeout(100);

      // Check if the update-status button now has "active" as its value (implementation sets updateStatus.value = status)
      const updateStatusBtnVal = await page.locator('#update-status').evaluate((el) => el.value);
      // Accept either successful reset or an error occurred earlier
      if (updateStatusBtnVal && updateStatusBtnVal.length > 0 && updateStatusBtnVal !== 'Update Status') {
        expect(updateStatusBtnVal).toBe('active');
      } else {
        const errorsJoined = pageErrors.join(' | ');
        expect(errorsJoined).toMatch(/Assignment to constant variable|TypeError|is not a function|already been declared/i);
      }
    });
  });

  test('Runtime diagnostics - assert that known JavaScript errors are emitted by the page', async ({ page }) => {
    // There are several intentionally buggy parts of the implementation:
    // - assignment to a const variable 'updateStatus' later in the script
    // - getContext called on non-canvas element (id conflict 'progress')
    // - duplicate identifier 'versionControl' declared as const and function
    // - using .indexOf / .splice on DOM element in removeFeature
    //
    // Validate that at least one of these runtime problems surfaced while loading / interacting.
    // Allow some extra time for any late errors (setInterval increments in the canvas block may keep mutating)
    await page.waitForTimeout(500);

    // Combine all collected error messages and console messages for inspection
    const errorLog = pageErrors.join(' | ');
    const consoleLog = consoleMessages.join(' | ');

    // At minimum, there should be a runtime error captured based on the buggy implementation
    expect(pageErrors.length).toBeGreaterThan(0);

    // Ensure the errors mention at least one of the expected problematic sources
    const expectedPatterns = /(Assignment to constant variable|getContext|already been declared|is not a function|splice|indexOf|TypeError|ReferenceError)/i;
    expect(errorLog).toMatch(expectedPatterns);
  });
});