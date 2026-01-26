import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1214c2f3-fa7a-11f0-acf9-69409043402d.html';

// Page Object for the DP Interactive Demo
class DPApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.problemSelect = page.locator('#problem');
    this.inputsArea = page.locator('#inputs-area');
    this.resetBtn = page.locator('#reset');
    this.runBtn = page.locator('#run');
    this.autoRunBtn = page.locator('#autoRun');
    this.prevStepBtn = page.locator('#prevStep');
    this.nextStepBtn = page.locator('#nextStep');
    this.output = page.locator('#output');
    this.tableOutput = page.locator('#tableOutput');
    this.stepDelay = page.locator('#stepDelay');
  }

  async waitForAppReady() {
    // Wait for the initial guidance printed on load
    await this.page.waitForFunction(() => {
      const out = document.getElementById('output');
      return out && out.textContent && out.textContent.length > 0;
    });
  }

  async getOutputText() {
    return (await this.output.textContent()) || '';
  }

  async getTableText() {
    return (await this.tableOutput.textContent()) || '';
  }

  async selectProblem(value) {
    await this.problemSelect.selectOption(value);
    // the selection triggers updateInputs and prints guidance; wait for inputs-area to be filled
    await this.page.waitForTimeout(20);
    await this.page.waitForFunction((val) => {
      const ia = document.getElementById('inputs-area');
      return ia && ia.innerHTML && ia.innerHTML.length > 0;
    }, value);
  }

  async setFibN(n) {
    const el = this.page.locator('#fib_n');
    await el.fill(String(n));
  }

  async setStepDelay(ms) {
    await this.stepDelay.fill(String(ms));
  }

  async clickRun() {
    await this.runBtn.click();
  }

  async clickAutoRun() {
    await this.autoRunBtn.click();
  }

  async clickNext() {
    await this.nextStepBtn.click();
  }

  async clickPrev() {
    await this.prevStepBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async fillKnapsackInputs(weights, values, capacity) {
    await this.page.locator('#knapsack_weights').fill(weights);
    await this.page.locator('#knapsack_values').fill(values);
    await this.page.locator('#knapsack_capacity').fill(String(capacity));
  }

  async waitForOutputContains(substring, timeout = 3000) {
    await this.page.waitForFunction((s) => {
      const out = document.getElementById('output');
      return out && out.textContent && out.textContent.includes(s);
    }, substring, { timeout });
  }

  async waitForRunDisabled(timeout = 5000) {
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('run');
      return btn && btn.disabled;
    }, {}, { timeout });
  }
}

test.describe('Dynamic Programming Interactive Demo - FSM state and transition tests', () => {
  let page;
  let app;
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];
    page.on('console', (msg) => {
      // capture console messages for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      // capture uncaught exceptions
      pageErrors.push(err);
    });
    await page.goto(APP_URL);
    app = new DPApp(page);
    await app.waitForAppReady();
  });

  test.afterEach(async () => {
    // Ensure no uncaught page errors occurred during the test
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    await page.close();
  });

  test('Initial Idle state (S0_Idle) shows guidance and empty table', async () => {
    // Validate the initial printed guidance exists and table is empty
    const out = await app.getOutputText();
    expect(out).toContain('Select a DP problem, adjust inputs, then run or step through the computation.');
    const table = await app.getTableText();
    expect(table).toBe('');
    // Buttons initial states: prev/next disabled per UI
    await expect(app.prevStepBtn).toBeDisabled();
    await expect(app.nextStepBtn).toBeDisabled();
    await expect(app.runBtn).toBeEnabled();
  });

  test('Selecting a problem updates inputs and transitions to Problem Selected (S1_ProblemSelected)', async () => {
    // Select knapsack and validate inputs area updated and guidance printed
    await app.selectProblem('knapsack');
    // inputs area should now contain knapsack input fields
    await expect(page.locator('#knapsack_weights')).toBeVisible();
    await expect(page.locator('#knapsack_values')).toBeVisible();
    await expect(page.locator('#knapsack_capacity')).toBeVisible();

    // The page's selection handler prints a prompt
    const out = await app.getOutputText();
    expect(out).toContain('Please enter inputs and click Run / Step Execute.');

    // Ensure run and autoRun are enabled and prev/next disabled
    await expect(app.runBtn).toBeEnabled();
    await expect(app.autoRunBtn).toBeEnabled();
    await expect(app.prevStepBtn).toBeDisabled();
    await expect(app.nextStepBtn).toBeDisabled();
  });

  test('Initializing solver and performing the first step (S1 -> S2 -> S3)', async () => {
    // Select Fibonacci and initialize via Run (init + one step)
    await app.selectProblem('fib');

    // Set a small n to keep the test fast and deterministic
    await app.setFibN(6);

    // Click Run. If solver is not initialized, Run will call initSolverFromInputs and then stepForward once.
    await app.clickRun();

    // After a run, table should show dp values and output should contain an explanation for the step
    const table = await app.getTableText();
    expect(table).toContain('dp[i]'); // table rendering includes dp label

    const out = await app.getOutputText();
    // The final output after Run includes the solver's explanation for the performed step
    expect(out).toMatch(/Step\s+\d+:/);

    // prevStep should now be enabled (we have progressed at least one step)
    await expect(app.prevStepBtn).toBeEnabled();
    await expect(app.nextStepBtn).toBeEnabled();
  });

  test('Step forward (S6_StepForward) and Step back (S5_StepBack) behavior', async () => {
    // Use Fibonacci, small n for quick checks
    await app.selectProblem('fib');
    await app.setFibN(6);

    // Initialize solver first by clicking run (this will also perform the first step)
    await app.clickRun();

    const firstTable = await app.getTableText();

    // Click Next (step forward) and verify table state changes
    await app.clickNext();
    const secondTable = await app.getTableText();
    expect(secondTable).not.toEqual(firstTable);
    const out2 = await app.getOutputText();
    expect(out2).toMatch(/Step\s+\d+:/);

    // Click Previous (step back) and verify we revert to earlier table state
    await app.clickPrev();
    const backTable = await app.getTableText();
    expect(backTable).toEqual(firstTable);

    // If we go back to initial step, prev button may become disabled
    // Attempt to click prev again; the UI will print "Cannot go further back." and disable prev if at earliest state
    await app.clickPrev();
    const outAfterCannotBack = await app.getOutputText();
    expect(outAfterCannotBack).toContain('Cannot go further back.');
    // prev should be disabled now
    await expect(app.prevStepBtn).toBeDisabled();
  });

  test('Auto Run (AutoRunComplete) finishes and results in runBtn disabled (S3 -> S4)', async () => {
    // Use Fibonacci with a very small n and small delay to finish quickly
    await app.selectProblem('fib');
    await app.setFibN(5); // small problem
    await app.setStepDelay(50); // minimal delay to speed up auto-run

    // Click Auto Run to execute to completion
    await app.clickAutoRun();

    // Wait for run button to become disabled by the auto-run completion logic
    await app.waitForRunDisabled(10000);

    // After auto-run completes, run and autoRun buttons should be disabled
    await expect(app.runBtn).toBeDisabled();
    await expect(app.autoRunBtn).toBeDisabled();

    // prevStep and nextStep should be enabled to allow navigation post-completion
    await expect(app.prevStepBtn).toBeEnabled();
    await expect(app.nextStepBtn).toBeEnabled();
  });

  test('Reset inputs clears solver state and prints reset message (ResetInputs)', async () => {
    // Initialize a solver first (fib)
    await app.selectProblem('fib');
    await app.setFibN(6);
    await app.clickRun();

    // Now click reset
    await app.clickReset();

    // After reset, the UI should print a reset confirmation and re-render the initial table state
    const out = await app.getOutputText();
    expect(out).toContain('Reset completed. Use Run / Step buttons to execute.');

    const table = await app.getTableText();
    // Rendered table after reset should exist and contain dp placeholders or initial values
    expect(table).toContain('dp[i]');
    // After reset, prev/next should be disabled and run available
    await expect(app.prevStepBtn).toBeDisabled();
    await expect(app.nextStepBtn).toBeDisabled();
    await expect(app.runBtn).toBeEnabled();
  });

  test('Invalid inputs (edge case) produce parse error messages and no uncaught exceptions (Error scenario)', async () => {
    // Select knapsack and deliberately provide mismatched arrays to cause a parse error
    await app.selectProblem('knapsack');

    // Fill invalid knapsack inputs: weights length != values length
    await app.fillKnapsackInputs('1,2,3', '10,20', 5);

    // Click Run, the parser should throw and Run handler catches and prints a user-facing error
    await app.clickRun();

    // Wait for expected error text printed in the output area
    await app.waitForOutputContains('Error parsing inputs:', 2000);
    const out = await app.getOutputText();
    expect(out).toContain('Weights and values arrays must be the same length');

    // Confirm that no uncaught page errors were generated (the thrown error was handled by app)
    // This assertion is done in afterEach via pageErrors length check as well.
    expect(pageErrors.length).toBe(0);
  });

  test('Ensure console did not log unexpected errors during normal flows', async () => {
    // Perform some normal flows: select problems and initialize few solvers
    await app.selectProblem('lcs');
    await page.locator('#lcs_s1').fill('ABC');
    await page.locator('#lcs_s2').fill('ACB');
    await app.clickRun();

    await app.selectProblem('coinchange');
    await page.locator('#coinchange_coins').fill('1,3,4');
    await page.locator('#coinchange_amount').fill('6');
    await app.clickRun();

    // There should be no console.error messages recorded
    const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errors.length).toBe(0);
  });
});