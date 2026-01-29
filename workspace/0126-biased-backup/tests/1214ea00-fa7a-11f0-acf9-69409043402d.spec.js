import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/1214ea00-fa7a-11f0-acf9-69409043402d.html';

// Page Object encapsulating interactions and common assertions
class GreedyPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];

    // Collect console error messages and page errors to assert later
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });

    // Safety: default dialog handler to accept alerts if test doesn't explicitly handle them
    this.page.on('dialog', async dialog => {
      // If a test set up a one-off dialog handler, that will run first (we use page.once in tests).
      // This global handler is a fallback to avoid tests hanging due to unhandled dialogs.
      try {
        if (dialog.type() === 'prompt') {
          await dialog.accept('');
        } else {
          await dialog.accept();
        }
      } catch (e) {
        // ignore
      }
    });

    // Locators
    this.problemSelect = () => this.page.locator('#problem-select');
    this.resetProblemBtn = () => this.page.locator('#reset-problem');
    this.inputsContainer = () => this.page.locator('#problem-inputs');
    this.algorithmControls = () => this.page.locator('#algorithm-controls');
    this.stepBtn = () => this.page.locator('#step-btn');
    this.runBtn = () => this.page.locator('#run-btn');
    this.undoBtn = () => this.page.locator('#undo-btn');
    this.resetAlgoBtn = () => this.page.locator('#reset-algo-btn');
    this.compareBtn = () => this.page.locator('#compare-btn');
    this.randomizeBtn = () => this.page.locator('#randomize-btn');
    this.exportBtn = () => this.page.locator('#export-btn');
    this.importBtn = () => this.page.locator('#import-btn');
    this.output = () => this.page.locator('#output');
    this.log = () => this.page.locator('#log');
  }

  async goto() {
    await this.page.goto(BASE);
    // Wait for initial JS init to complete by ensuring inputs container has content
    await expect(this.inputsContainer()).toBeVisible();
  }

  // Helpers to interact with inputs by id suffix (e.g., 'coins' -> '#input-coins')
  inputLocator(id) {
    return this.page.locator(`#input-${id}`);
  }

  // Select problem via <select>
  async selectProblem(key) {
    await this.problemSelect().selectOption(key);
    // wait for inputs to re-render (description paragraph appears)
    await expect(this.inputsContainer()).toBeVisible();
  }

  // Click reset / load problem button
  async clickResetProblem() {
    await this.resetProblemBtn().click();
  }

  // Click reset algorithm which triggers readInputsValidate()
  async clickResetAlgorithm() {
    await this.resetAlgoBtn().click();
  }

  // Step algorithm one time
  async clickStep() {
    await this.stepBtn().click();
  }

  // Run to end
  async clickRunToEnd() {
    await this.runBtn().click();
  }

  // Undo
  async clickUndo() {
    await this.undoBtn().click();
  }

  // Compare button (will produce an alert) - test should provide a dialog handler before calling this
  async clickCompare() {
    await this.compareBtn().click();
  }

  // Randomize - this calls readInputsValidate at the end; wait for algorithm controls to be visible
  async clickRandomize() {
    await this.randomizeBtn().click();
  }

  // Export - prompt shows JSON; return the defaultValue (JSON) from the prompt dialog
  async clickExportAndGetJSON() {
    return new Promise(async (resolve) => {
      this.page.once('dialog', async dialog => {
        // Expect a prompt with defaultValue containing JSON
        const message = dialog.message();
        const defaultVal = dialog.defaultValue();
        // Accept the prompt (user would copy manually)
        await dialog.accept();
        resolve({ message, defaultVal });
      });
      await this.exportBtn().click();
    });
  }

  // Import - supply the provided jsonText to the prompt; resolve to the sequence of alert dialogs if any
  async clickImportWithJSON(jsonText) {
    return new Promise(async (resolve) => {
      // We will capture subsequent alert dialogs triggered by import handler (e.g., success or error)
      let alerts = [];
      const dialogHandler = async dialog => {
        alerts.push({ type: dialog.type(), message: dialog.message(), defaultValue: dialog.defaultValue() });
        // For prompt, provide the text; for alert, accept
        try {
          if (dialog.type() === 'prompt') {
            await dialog.accept(jsonText);
          } else {
            await dialog.accept();
          }
        } catch (e) {
          // ignore
        }
      };
      this.page.on('dialog', dialogHandler);
      await this.importBtn().click();
      // Allow small delay for processing and potential alerts
      await this.page.waitForTimeout(150);
      this.page.off('dialog', dialogHandler);
      resolve(alerts);
    });
  }

  async getOutputText() {
    return this.output().innerText();
  }

  async getLogText() {
    return this.log().innerText();
  }

  // Expose collected console and page errors for assertions
  getConsoleErrors() {
    return this.consoleErrors;
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

// Group tests
test.describe('Greedy Algorithms Interactive Demonstration (Application ID: 1214ea00-fa7a-11f0-acf9-69409043402d)', () => {
  let gp;

  test.beforeEach(async ({ page }) => {
    gp = new GreedyPage(page);
    await gp.goto();
  });

  test('Initial state: Idle loads coinChange and algorithm controls are hidden', async () => {
    // Validate algorithm controls are hidden per initial load (loadProblemInputs('coinChange') sets display none)
    await expect(gp.algorithmControls()).not.toBeVisible();

    // Validate inputs for coinChange are present
    await expect(gp.inputLocator('coins')).toBeVisible();
    await expect(gp.inputLocator('amount')).toBeVisible();

    // Output and log should be empty
    expect(await gp.getOutputText()).toBe('');
    expect(await gp.getLogText()).toBe('');

    // No page or console errors on initial load
    expect(gp.getConsoleErrors()).toHaveLength(0);
    expect(gp.getPageErrors()).toHaveLength(0);
  });

  test('Problem select change: selecting activitySelection hides controls and shows activity inputs', async () => {
    // Select activity selection
    await gp.selectProblem('activitySelection');

    // Algorithm controls remain hidden after selecting a problem until inputs are validated
    await expect(gp.algorithmControls()).not.toBeVisible();

    // Validate the activity input textarea exists
    await expect(gp.inputLocator('activities')).toBeVisible();

    // Validate description paragraph contains expected substring
    const inputsHtml = await gp.inputsContainer().innerText();
    expect(inputsHtml).toContain('Activity Selection');

    // No console or page errors
    expect(gp.getConsoleErrors()).toHaveLength(0);
    expect(gp.getPageErrors()).toHaveLength(0);
  });

  test('Reset / Load Problem button reloads inputs and keeps controls hidden (implementation-driven)', async () => {
    // Switch to fractional knapsack then click reset
    await gp.selectProblem('fractionalKnapsack');
    await gp.clickResetProblem();

    // Implementation uses loadProblemInputs which sets algorithm-controls to 'none'
    await expect(gp.algorithmControls()).not.toBeVisible();

    // Ensure input fields exist for capacity and items
    await expect(gp.inputLocator('capacity')).toBeVisible();
    await expect(gp.inputLocator('items')).toBeVisible();

    // No console/page errors
    expect(gp.getConsoleErrors()).toHaveLength(0);
    expect(gp.getPageErrors()).toHaveLength(0);
  });

  test('Reset Algorithm (readInputsValidate) loads state and makes algorithm controls visible for valid inputs', async ({ page }) => {
    // Ensure we are on coinChange initially
    // click Reset Algorithm to validate default inputs (defaults are valid)
    // Because resetAlgorithmHandler invokes readInputsValidate, we expect controls to become visible and log to contain 'Problem loaded'
    // Prepare to accept any alert (fallback)
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await gp.clickResetAlgorithm();

    // Algorithm controls should now be visible
    await expect(gp.algorithmControls()).toBeVisible();

    // Output should contain 'Coins:' and target amount text
    const out = await gp.getOutputText();
    expect(out).toContain('Coins:');
    expect(out).toContain('Target amount:');

    // Log should contain the 'Problem loaded' message
    const lg = await gp.getLogText();
    expect(lg).toContain('Problem loaded: coinChange');

    // No console/page errors
    expect(gp.getConsoleErrors()).toHaveLength(0);
    expect(gp.getPageErrors()).toHaveLength(0);
  });

  test('Step Algorithm executes greedyStep, updates output and log', async () => {
    // Load and validate inputs first
    await gp.clickResetAlgorithm();
    await expect(gp.algorithmControls()).toBeVisible();

    // Capture current chosenCoins count by reading output text
    let beforeOut = await gp.getOutputText();
    // Perform a single step
    await gp.clickStep();

    // After a step, output should show 'Chosen coins:' with at least one coin
    const out = await gp.getOutputText();
    expect(out).toContain('Chosen coins:');
    expect(out).toMatch(/Chosen coins:.*\d/); // at least one digit in chosen coins

    // Log should contain a 'Step 1' message
    const log = await gp.getLogText();
    expect(log).toMatch(/Step \d+: Picked coin/);

    // No console/page errors
    expect(gp.getConsoleErrors()).toHaveLength(0);
    expect(gp.getPageErrors()).toHaveLength(0);
  });

  test('Run to End completes algorithm and logs steps; Undo reverts last step', async () => {
    // Ensure validated problem loaded
    await gp.clickResetAlgorithm();
    await expect(gp.algorithmControls()).toBeVisible();

    // Run to end
    await gp.clickRunToEnd();

    // After runToEnd, log should contain 'Run to end: executed'
    const logText = await gp.getLogText();
    expect(logText).toMatch(/Run to end: executed \d+ steps/);

    // Output should reflect completion (for coinChange remaining probably 0 or 'Chosen coins' populated)
    const out = await gp.getOutputText();
    expect(out).toContain('Chosen coins:');

    // Now undo one step - ensure there is something to undo
    // Click undo and accept any alert dialogs
    await gp.clickUndo();

    // After undo, log should contain 'Undid one step'
    const afterUndoLog = await gp.getLogText();
    expect(afterUndoLog).toContain('Undid one step');

    // No console/page errors
    expect(gp.getConsoleErrors()).toHaveLength(0);
    expect(gp.getPageErrors()).toHaveLength(0);
  });

  test('Reset Algorithm with invalid inputs triggers error alert and leaves algorithm controls hidden', async ({ page }) => {
    // For coinChange, set amount to an invalid value (0) to provoke validation error
    await gp.inputLocator('amount').fill('0');

    // Expect an alert due to validation failure - set up one-off handler to capture it
    const alerts = [];
    page.once('dialog', async dialog => {
      alerts.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // Click Reset Algorithm which triggers readInputsValidate -> will alert
    await gp.clickResetAlgorithm();

    // We expect at least one alert captured and message contains 'Error'
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].message).toContain('Error');

    // Controls should be hidden after failed validation (implementation sets display none in catch)
    await expect(gp.algorithmControls()).not.toBeVisible();

    // No unexpected console/page errors
    expect(gp.getConsoleErrors()).toHaveLength(0);
    expect(gp.getPageErrors()).toHaveLength(0);
  });

  test('Compare Greedy vs Exhaustive shows alert and logs result for coinChange', async ({ page }) => {
    // Ensure coinChange loaded and validated
    await gp.clickResetAlgorithm();
    await expect(gp.algorithmControls()).toBeVisible();

    // Perform a couple of steps to have a greedy solution
    await gp.clickStep();
    await gp.clickStep();

    // Intercept the alert produced by compareGreedyVsExhaustive
    const dialogs = [];
    page.once('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // Click compare
    await gp.clickCompare();

    // Validate that an alert was shown and contains expected substring
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0].message).toContain('Greedy solution coin count');

    // Log should also contain the same message
    const log = await gp.getLogText();
    expect(log).toContain('Greedy solution coin count');

    // No console/page errors
    expect(gp.getConsoleErrors()).toHaveLength(0);
    expect(gp.getPageErrors()).toHaveLength(0);
  });

  test('Randomize Inputs updates inputs and loads state (algorithm controls visible)', async () => {
    // Ensure coinChange is selected
    await gp.selectProblem('coinChange');

    // Click randomize which eventually calls readInputsValidate
    await gp.clickRandomize();

    // After randomize + validation, algorithm-controls should be visible
    await expect(gp.algorithmControls()).toBeVisible();

    // Output should show 'Coins:' and 'Target amount'
    const out = await gp.getOutputText();
    expect(out).toContain('Coins:');
    expect(out).toContain('Target amount:');

    // No console/page errors
    expect(gp.getConsoleErrors()).toHaveLength(0);
    expect(gp.getPageErrors()).toHaveLength(0);
  });

  test('Export and Import JSON: export shows prompt with JSON, import with invalid JSON shows error, import with valid JSON restores state', async ({ page }) => {
    // Validate inputs loaded (use coinChange)
    await gp.clickResetAlgorithm();

    // Do one step to change state
    await gp.clickStep();

    // Export - capture prompt defaultValue JSON
    const exportResult = await gp.clickExportAndGetJSON();
    expect(exportResult.message).toContain('Copy this JSON text:');
    // defaultVal should contain JSON text (stringified object)
    expect(exportResult.defaultVal).toContain('"problemKey"');
    expect(exportResult.defaultVal).toContain('"state"');

    // Now test importing invalid JSON - provide 'invalid' to prompt
    // Prepare to capture alert resulting from JSON.parse error
    const invalidImportAlerts = [];
    page.once('dialog', async dialog => {
      // Dialog is prompt - respond with invalid JSON
      await dialog.accept('this is not json');
    });
    // Next dialog should be an alert showing error message - capture it
    page.once('dialog', async dialog => {
      invalidImportAlerts.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });
    await gp.importBtn().click();
    await gp.page.waitForTimeout(100);

    expect(invalidImportAlerts.length).toBeGreaterThanOrEqual(1);
    expect(invalidImportAlerts[0].message).toContain('Error importing JSON');

    // Now import the valid JSON we got from export
    const validJSON = exportResult.defaultVal;
    // Provide the exported JSON string back to the prompt
    const importAlerts = await gp.clickImportWithJSON(validJSON);

    // After successful import, the code logs 'Imported problem and state loaded' and shows algorithm-controls
    const logText = await gp.getLogText();
    expect(logText).toContain('Imported problem and state loaded');

    // Algorithm controls should be visible after successful import
    await expect(gp.algorithmControls()).toBeVisible();

    // Output should be populated based on imported state
    const out = await gp.getOutputText();
    expect(out).toContain('Coins:');

    // No console/page errors
    expect(gp.getConsoleErrors()).toHaveLength(0);
    expect(gp.getPageErrors()).toHaveLength(0);
  });

  test('Huffman coding: run to end produces final codes and logs merging steps', async ({ page }) => {
    // Select Huffman problem
    await gp.selectProblem('huffmanCoding');

    // Validate inputs and then click Reset Algorithm to parse default inputs
    await gp.clickResetAlgorithm();
    await expect(gp.algorithmControls()).toBeVisible();

    // Run to end - this will merge until one node remains and then build codes
    await gp.clickRunToEnd();

    // Output should include 'Final Huffman Codes'
    const out = await gp.getOutputText();
    expect(out).toContain('Final Huffman Codes');

    // Log should have merges recorded (Step N: Merged nodes)
    const logText = await gp.getLogText();
    expect(logText).toMatch(/Step \d+: Merged nodes freq=\d+ and freq=\d+ into \d+/);

    // No console/page errors
    expect(gp.getConsoleErrors()).toHaveLength(0);
    expect(gp.getPageErrors()).toHaveLength(0);
  });

  // Final test to assert that there were no unexpected runtime console or page errors across interactions
  test('No unexpected page runtime errors or console errors during typical interactions', async () => {
    // This test reuses the gp's collected errors from earlier interactions in this test scope.
    // Because Playwright creates a fresh context per test, we ensure the current test's page has no errors.
    expect(gp.getConsoleErrors()).toHaveLength(0);
    expect(gp.getPageErrors()).toHaveLength(0);
  });
});