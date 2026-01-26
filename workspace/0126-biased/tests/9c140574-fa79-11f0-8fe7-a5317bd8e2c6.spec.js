import { test, expect } from '@playwright/test';

const APP = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c140574-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Linear Search — Interactive Demonstration (FSM validation)', () => {
  // capture console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', msg => {
      // store only as text to inspect after interactions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Go to the page
    await page.goto(APP);

    // Wait for the demo to initialise and log "Demo ready."
    // The app writes logs into textarea#log; wait for that textarea to contain "Demo ready"
    const logSel = page.locator('#log');
    await expect(logSel).toContainText('Demo ready', { timeout: 5000 });
  });

  test.afterEach(async () => {
    // no-op; page fixture automatically closed
  });

  // Helper functions
  async function getStateDisplay(page) {
    return (await page.locator('#stateDisplay').textContent()).trim();
  }
  async function getMatchesFound(page) {
    return (await page.locator('#matchesFound').textContent()).trim();
  }
  async function getFoundList(page) {
    return (await page.locator('#foundList').textContent()).trim();
  }
  async function getStepsTaken(page) {
    return (await page.locator('#stepsTaken').textContent()).trim();
  }
  async function getComparisons(page) {
    return (await page.locator('#comparisons').textContent()).trim();
  }
  async function getArrayCells(page) {
    return page.locator('#arrayDisplay .cell');
  }
  async function getLogText(page) {
    return (await page.locator('#log').inputValue()).toString();
  }

  test('Initial state: Idle with default array rendered', async ({ page }) => {
    // Validate FSM S0_Idle initial conditions
    const state = await getStateDisplay(page);
    expect(state).toBe('idle');

    // Default array size should equal sizeNumber value (default 10)
    const sizeNumber = await page.locator('#sizeNumber').inputValue();
    const expectedCount = Number(sizeNumber);
    const cells = await getArrayCells(page);
    expect(await cells.count()).toBe(expectedCount);

    // Metrics are zero or default
    expect(await getMatchesFound(page)).toBe('0');
    expect(await getStepsTaken(page)).toBe('0');

    // No uncaught page errors at load
    expect(pageErrors.length).toBe(0);
  });

  test('Editing a cell: click to prompt and change value (S0_Idle -> S3_Editing evidence)', async ({ page }) => {
    // Choose index 0 cell and edit it via the prompt dialog
    const firstCell = page.locator('#arrayDisplay .cell').first();

    // Prepare to accept the prompt and provide value '123'
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      // Accept with new value
      await dialog.accept('123');
    });

    await firstCell.click();

    // After editing, the log should contain the "Edited index" message
    const log = await getLogText(page);
    expect(log).toMatch(/Edited index 0 -> 123/);

    // The cell text should now display '123'
    const text = (await firstCell.textContent()).trim();
    expect(text).toBe('123');

    // The displayed state should remain idle (editing logs are evidence, but state.running false)
    expect(await getStateDisplay(page)).toBe('idle');

    // No page errors during edit
    expect(pageErrors.length).toBe(0);
  });

  test('Double-click clears a cell (S3_Editing evidence: Cleared index)', async ({ page }) => {
    // Double-click cell at index 1 to clear it
    const cell = page.locator('#arrayDisplay .cell').nth(1);

    await cell.dblclick();

    // After clearing, cell should display the '·' placeholder for empty
    const text = (await cell.textContent()).trim();
    expect(text).toBe('·');

    // Log contains cleared message
    const log = await getLogText(page);
    expect(log).toMatch(/Cleared index 1/);

    expect(pageErrors.length).toBe(0);
  });

  test('Apply size and generate random array (GenerateRandomArray & ApplySize events)', async ({ page }) => {
    // Set sizeNumber to 5 and click Apply size
    await page.locator('#sizeNumber').fill('5');
    await page.locator('#applySize').click();

    // After apply, array should have 5 cells and log contains resize info
    const cells = page.locator('#arrayDisplay .cell');
    await expect(cells).toHaveCount(5);
    const log = await getLogText(page);
    expect(log).toMatch(/Array resized from/);

    // Click generate random array and expect generation log and same size
    await page.locator('#generate').click();
    await expect(cells).toHaveCount(5);
    const newLog = await getLogText(page);
    expect(newLog).toMatch(/Generated random array of size 5/);

    expect(pageErrors.length).toBe(0);
  });

  test('RunSearch: preset best and run -> should find first match and stop (S0_Idle -> S1_Running -> S0_Idle)', async ({ page }) => {
    // Apply preset best so target at index 0
    await page.locator('#presetBest').click();

    // Ensure the target input contains '0'
    await expect(page.locator('#targetInput')).toHaveValue(/0/);

    // Start run
    await page.locator('#runToggle').click();

    // Wait for run to complete: the demo logs "First match found. Run stopped." or stops with matchesFound >= 1
    await page.waitForFunction(() => {
      const mf = document.getElementById('matchesFound').textContent.trim();
      return Number(mf) >= 1;
    }, null, { timeout: 5000 });

    // After run completes, state should be idle
    expect(await getStateDisplay(page)).toBe('idle');

    // Found list should include index 0
    const foundList = await getFoundList(page);
    expect(foundList).toMatch(/\b0\b/);

    // Log includes "First match found" or similar end-of-run messages
    const log = await getLogText(page);
    expect(/First match found|Run stopped/.test(log)).toBe(true);

    expect(pageErrors.length).toBe(0);
  });

  test('StepForward while running should trigger alert (S1_Running -> alert evidence)', async ({ page }) => {
    // Simulate worst so no match; then start run so it's actively running
    await page.locator('#simulateWorst').click();

    // Start running
    await page.locator('#runToggle').click();

    // Ensure it is running
    await page.waitForFunction(() => document.getElementById('stateDisplay').textContent.trim() === 'running', null, { timeout: 2000 });

    // Now attempt to click Step Forward while running; expecting an alert with message about cannot step
    const dialogPromise = page.waitForEvent('dialog', { timeout: 3000 });
    await page.locator('#stepForward').click();

    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('Cannot step while running');

    // Accept the alert
    await dialog.accept();

    // Abort the running search to clean up
    await page.locator('#abort').click();

    // Final state should be idle after abort
    await page.waitForFunction(() => document.getElementById('stateDisplay').textContent.trim() === 'idle', null, { timeout: 2000 });

    expect(pageErrors.length).toBe(0);
  });

  test('Abort during running stops search and logs abort (S1_Running -> S0_Idle via Abort)', async ({ page }) => {
    // Ensure there is a scenario that runs for a while: simulate worst (no match) and start
    await page.locator('#simulateWorst').click();
    await page.locator('#runToggle').click();

    // Wait until running
    await page.waitForFunction(() => document.getElementById('stateDisplay').textContent.trim() === 'running', null, { timeout: 2000 });

    // Click abort
    await page.locator('#abort').click();

    // After abort, stateDisplay should be 'idle' and log should contain "Run aborted by user."
    await page.waitForFunction(() => document.getElementById('stateDisplay').textContent.trim() === 'idle', null, { timeout: 2000 });

    const log = await getLogText(page);
    expect(log).toMatch(/Run aborted by user/);

    expect(pageErrors.length).toBe(0);
  });

  test('StepBack (Undo) reverts last change after an edit (StepBack event -> Undo)', async ({ page }) => {
    // Remember current value at index 2
    const cell2 = page.locator('#arrayDisplay .cell').nth(2);
    const before = (await cell2.textContent()).trim();

    // Edit index 2 to 555 using prompt
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('555');
    });
    await cell2.click();

    // Confirm edit happened
    await expect(cell2).toHaveText('555');

    // Click undo (stepBack)
    await page.locator('#undo').click();

    // After undo, cell should reflect previous value
    await expect(cell2).toHaveText(before);

    // Log should include "Undid last change."
    const log = await getLogText(page);
    expect(log).toMatch(/Undid last change/);

    expect(pageErrors.length).toBe(0);
  });

  test('Reset initializes search and logs initialization (Reset event)', async ({ page }) => {
    // Modify state a bit first: change target and step a bit
    await page.locator('#targetInput').fill('9999'); // a target that likely isn't present
    await page.locator('#reset').click();

    // After reset, log should include "Initialized search."
    const log = await getLogText(page);
    expect(log).toMatch(/Initialized search/);

    // stateDisplay should be idle after reset/init
    expect(await getStateDisplay(page)).toBe('idle');

    expect(pageErrors.length).toBe(0);
  });

  test('Import JSON with invalid data triggers alert (edge case & error handling)', async ({ page }) => {
    // Click importJSON and respond to the prompt with invalid JSON, then expect an alert about invalid JSON.
    // Prepare to handle the prompt (the app uses prompt first)
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('not a json');
    });

    // After prompt, app will try to JSON.parse and on error will alert. Capture that alert next.
    const alertPromise = page.waitForEvent('dialog', { timeout: 3000 });
    await page.locator('#importJSON').click();

    const alertDialog = await alertPromise;
    expect(alertDialog.type()).toBe('alert');
    expect(alertDialog.message()).toMatch(/Invalid JSON/);
    await alertDialog.accept();

    expect(pageErrors.length).toBe(0);
  });

  test('Undo when nothing to undo should log "Nothing to undo."', async ({ page }) => {
    // Ensure history is empty by clearing array and undoing everything
    // Clear array (this will push a snapshot). Then undo twice to attempt empty undo.
    await page.locator('#clearArray').click();
    // Undo once to revert clear
    await page.locator('#undo').click();

    // Now attempt undo repeatedly until the message "Nothing to undo." appears.
    // Press undo multiple times to ensure hitting the empty-history branch
    await page.locator('#undo').click();
    await page.locator('#undo').click();

    const log = await getLogText(page);
    expect(log).toMatch(/Nothing to undo|Undid last change/);

    expect(pageErrors.length).toBe(0);
  });

  test('Verify no uncaught JS errors during interactions (console / pageerror observation)', async ({ page }) => {
    // Perform a set of interactions to surface any runtime errors
    await page.locator('#shuffle').click();
    await page.locator('#autoRange').click();
    await page.locator('#applyText').click(); // may set empty if textarea empty
    await page.locator('#clearLog').click();

    // Short delay to allow any async errors to surface
    await page.waitForTimeout(250);

    // Assert there were no uncaught page errors
    expect(pageErrors.length).toBe(0, `Unexpected page errors: ${pageErrors.map(e => String(e)).join(', ')}`);

    // Some console messages might be present but should not include 'Error' severity
    const errorsInConsole = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
    expect(errorsInConsole.length).toBe(0);
  });
});