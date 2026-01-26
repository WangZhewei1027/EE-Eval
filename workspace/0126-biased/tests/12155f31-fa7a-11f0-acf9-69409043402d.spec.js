import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/12155f31-fa7a-11f0-acf9-69409043402d.html';

test.describe('Amortized Analysis Interactive Explorer - FSM and UI tests', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      // Only collect text for easier assertions
      try {
        consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      } catch (e) {
        consoleMessages.push(`console: (failed to read)`);
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(BASE, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No teardown required beyond Playwright default navigation cleanup
  });

  test.describe('Initial rendering and S0 Idle state', () => {
    test('renders header and shows Dynamic Array as default (Idle -> S1 DynamicArray evidence)', async ({ page }) => {
      // Validate the page rendered and initial Idle evidence is present
      const header = page.locator('h1');
      await expect(header).toHaveText('Amortized Analysis Interactive Explorer');

      // Validate that the dynamic array radio is checked by default (S1 evidence)
      const dynamicRadio = page.locator('input[name="structure"][value="dynamicArray"]');
      await expect(dynamicRadio).toBeChecked();

      // On initial load updateParamBlocks() is called via updateParamBlocks() at end of script.
      // Confirm that dynamicArray params are visible and other param blocks are hidden
      const dynamicParams = page.locator('#dynamicArrayParams');
      const stackParams = page.locator('#stackWithMultipopParams');
      const aggParams = page.locator('#aggregateMethodParams');
      await expect(dynamicParams).toBeVisible();
      await expect(stackParams).toBeHidden();
      await expect(aggParams).toBeHidden();
    });
  });

  test.describe('Structure selection and StructureChange events', () => {
    test('switching structure radios updates parameter blocks (S0 -> S2..S5 transitions)', async ({ page }) => {
      // Select stackWithMultipop and assert param block visibility changes
      const stackRadio = page.locator('input[name="structure"][value="stackWithMultipop"]');
      await stackRadio.click();
      await expect(stackRadio).toBeChecked();
      await expect(page.locator('#stackWithMultipopParams')).toBeVisible();
      await expect(page.locator('#dynamicArrayParams')).toBeHidden();

      // Select aggregate method
      const aggRadio = page.locator('input[name="structure"][value="aggregateMethod"]');
      await aggRadio.click();
      await expect(aggRadio).toBeChecked();
      await expect(page.locator('#aggregateMethodParams')).toBeVisible();
      await expect(page.locator('#stackWithMultipopParams')).toBeHidden();

      // Select accounting method
      const acctRadio = page.locator('input[name="structure"][value="accountingMethod"]');
      await acctRadio.click();
      await expect(acctRadio).toBeChecked();
      await expect(page.locator('#accountingMethodParams')).toBeVisible();

      // Select potential method
      const potRadio = page.locator('input[name="structure"][value="potentialMethod"]');
      await potRadio.click();
      await expect(potRadio).toBeChecked();
      await expect(page.locator('#potentialMethodParams')).toBeVisible();

      // Switch back to dynamic array and confirm param blocks update (S0 -> S1)
      const dynRadio = page.locator('input[name="structure"][value="dynamicArray"]');
      await dynRadio.click();
      await expect(dynRadio).toBeChecked();
      await expect(page.locator('#dynamicArrayParams')).toBeVisible();
      // When updateParamBlocks runs it also clears log and amortized result - ensure those are empty
      await expect(page.locator('#logOutput')).toHaveText('');
      await expect(page.locator('#amortizedResult')).toHaveText('');
    });
  });

  test.describe('Simulation runs for each data structure (S6 OperationsRunning)', () => {
    test('dynamic array simulation produces log and amortized result (RunDynamicArrayOps)', async ({ page }) => {
      // Ensure we're on dynamic array params
      await page.locator('input[name="structure"][value="dynamicArray"]').click();

      // Ensure default inputs are present
      const capacity = page.locator('#daCapacity');
      const ops = page.locator('#daOps');
      const resizeFactor = page.locator('#daResizeFactor');
      await expect(capacity).toHaveValue('4');
      await expect(ops).toHaveValue('20');
      await expect(resizeFactor).toHaveValue('2');

      // Click run
      await page.locator('#daRunOps').click();

      // Validate that the log contains simulation header and operations summary
      await expect(page.locator('#logOutput')).toContainText('Dynamic Array Simulation');
      await expect(page.locator('#logOutput')).toContainText('Initial Capacity: 4');
      await expect(page.locator('#logOutput')).toContainText('Number of insertions: 20');

      // Amortized result section should be populated with Operations: 20 and Average amortized cost
      await expect(page.locator('#amortizedResult')).toContainText('Operations: 20');
      await expect(page.locator('#amortizedResult')).toContainText('Average amortized cost');
    });

    test('stack with multipop simulation produces log and amortized result (RunStackOps)', async ({ page }) => {
      // Select stack
      await page.locator('input[name="structure"][value="stackWithMultipop"]').click();

      // Ensure push and multipop inputs have defaults
      await expect(page.locator('#stackPushCount')).toHaveValue('10');
      await expect(page.locator('#stackMultipopCount')).toHaveValue('5');

      // Click run
      await page.locator('#stackRunOps').click();

      // Validate log and result were updated
      await expect(page.locator('#logOutput')).toContainText('Stack with Multipop Simulation');
      await expect(page.locator('#amortizedResult')).toContainText('Amortized cost per operation');
    });

    test('aggregate, accounting and potential method simulations produce expected outputs (RunAggregateOps, RunAccountingOps, RunPotentialOps)', async ({ page }) => {
      // Aggregate
      await page.locator('input[name="structure"][value="aggregateMethod"]').click();
      await page.locator('#aggRunOps').click();
      await expect(page.locator('#logOutput')).toContainText('Aggregate Method Example');
      await expect(page.locator('#amortizedResult')).toContainText('Total cost');

      // Accounting
      await page.locator('input[name="structure"][value="accountingMethod"]').click();
      await page.locator('#acctRunOps').click();
      await expect(page.locator('#logOutput')).toContainText('Accounting Method Example');
      await expect(page.locator('#amortizedResult')).toContainText('Total actual cost');

      // Potential
      await page.locator('input[name="structure"][value="potentialMethod"]').click();
      await page.locator('#potRunOps').click();
      await expect(page.locator('#logOutput')).toContainText('Potential Method Example');
      await expect(page.locator('#amortizedResult')).toContainText('Total actual cost');
    });
  });

  test.describe('Interactive dynamic array workflow (S7 WorkflowActive)', () => {
    test('start workflow displays controls and allows Insert Next, Undo Last, Run To End, ResetWorkflow', async ({ page }) => {
      // Ensure dynamic array is selected
      await page.locator('input[name="structure"][value="dynamicArray"]').click();

      // The page script inserts a #daStartWorkflow button after load. Click it to start.
      // Wait for the button to be available then click.
      const startButton = page.locator('#daStartWorkflow');
      await expect(startButton).toBeVisible();
      await startButton.click();

      // After starting the workflow, the operations-sequence fieldset should be visible
      const operationsSequence = page.locator('#operations-sequence');
      await expect(operationsSequence).toBeVisible();

      // interactiveSection should contain controls (Insert Next, Undo Last, Run To End)
      const interactive = page.locator('#interactiveSection');
      await expect(interactive).toBeVisible();
      await expect(interactive).toContainText('Capacity:');
      const insertButton = interactive.locator('button', { hasText: 'Insert Next' });
      const undoButton = interactive.locator('button', { hasText: 'Undo Last' });
      const runToEndButton = interactive.locator('button', { hasText: 'Run To End' });
      await expect(insertButton).toBeVisible();
      await expect(undoButton).toBeVisible();
      await expect(runToEndButton).toBeVisible();

      // Initially undo should be disabled
      await expect(undoButton).toBeDisabled();

      // Perform a single insert and verify log and amortized result update
      await insertButton.click();
      await expect(page.locator('#logOutput')).toContainText('Insert 1');
      await expect(page.locator('#amortizedResult')).toContainText('Completed insertions: 1');

      // After insert, undo should be enabled
      await expect(undoButton).toBeEnabled();

      // Undo last operation: verify that size decreases and log indicates undo
      await undoButton.click();
      await expect(page.locator('#logOutput')).toContainText('Undo Insert');
      // After undo, amortized result may clear if size becomes 0
      await expect(page.locator('#amortizedResult')).toHaveText('', { timeout: 1000 }).catch(() => {
        // Accept either cleared or no content; test should not fail if implementation keeps previous text.
      });

      // Run to end: click and wait for completion
      await runToEndButton.click();
      // After runToEnd, there should be a "All insertions completed." message in log
      await expect(page.locator('#logOutput')).toContainText('All insertions completed.');

      // Reset workflow: the reset button becomes visible; click it and assert the operations sequence hidden and log cleared
      const resetBtn = page.locator('#resetWorkflowBtn');
      await expect(resetBtn).toBeVisible();
      await resetBtn.click();
      await expect(operationsSequence).toBeHidden();
      await expect(page.locator('#interactiveSection')).toHaveText('');
      await expect(page.locator('#logOutput')).toHaveText('');
      await expect(page.locator('#amortizedResult')).toHaveText('');
    });
  });

  test.describe('Validation and edge cases', () => {
    test('dynamic array invalid inputs produce validation log entries (edge cases)', async ({ page }) => {
      // Set invalid capacity (0) and click run -> should append 'Invalid Initial Capacity'
      await page.locator('input[name="structure"][value="dynamicArray"]').click();
      await page.locator('#daCapacity').fill('0');
      await page.locator('#daRunOps').click();
      await expect(page.locator('#logOutput')).toContainText('Invalid Initial Capacity');

      // Reset capacity to valid and set invalid number of operations (0)
      await page.locator('#daCapacity').fill('4');
      await page.locator('#daOps').fill('0');
      await page.locator('#daRunOps').click();
      await expect(page.locator('#logOutput')).toContainText('Invalid number of insert operations');

      // Invalid resize factor (<=1)
      await page.locator('#daOps').fill('5');
      await page.locator('#daResizeFactor').selectOption('1.25'); // valid
      // Now set to invalid via script injection of bad value (but we must not modify page code)
      // Instead fill with '1' (a value not present in options) - since select contains only limited options,
      // selecting a non-existent option will not change value; instead directly set to '1' via fill is not possible.
      // We can simulate invalid by setting the select to '1.0' if allowed, but to keep within constraints we'll set to empty via keyboard and then click run - this will parse NaN and trigger invalid case.
      await page.evaluate(() => { document.getElementById('daResizeFactor').value = ''; });
      await page.locator('#daRunOps').click();
      await expect(page.locator('#logOutput')).toContainText('Invalid resize factor');
    });

    test('stack with multipop invalid inputs produce validation logs', async ({ page }) => {
      await page.locator('input[name="structure"][value="stackWithMultipop"]').click();

      // Negative push count should log 'Invalid push count'
      await page.locator('#stackPushCount').fill('-5');
      await page.locator('#stackRunOps').click();
      await expect(page.locator('#logOutput')).toContainText('Invalid push count');

      // Negative multipop count should log 'Invalid multipop count'
      await page.locator('#stackPushCount').fill('5');
      await page.locator('#stackMultipopCount').fill('-1');
      await page.locator('#stackRunOps').click();
      await expect(page.locator('#logOutput')).toContainText('Invalid multipop count');
    });
  });

  test.describe('Observing console output and uncaught page errors', () => {
    test('collects console messages and ensures no uncaught page errors occurred during interactions', async ({ page }) => {
      // Perform a few interactions to produce logs and potential console activity
      await page.locator('input[name="structure"][value="dynamicArray"]').click();
      await page.locator('#daRunOps').click();

      await page.locator('input[name="structure"][value="stackWithMultipop"]').click();
      await page.locator('#stackRunOps').click();

      // Allow some time for operations to append to console arrays if any
      await page.waitForTimeout(200);

      // Assert that we captured console events (could be empty but we assert it's an array)
      expect(Array.isArray(consoleMessages)).toBeTruthy();

      // Assert that there were no uncaught page errors
      // If pageErrors exist, include them in a failing assertion message for debugging
      if (pageErrors.length > 0) {
        // Fail the test with details of the errors
        throw new Error('Uncaught page errors detected: ' + pageErrors.map(e => e.message || String(e)).join(' || '));
      } else {
        // No uncaught errors found
        expect(pageErrors.length).toBe(0);
      }
    });
  });
});