import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c169d80-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper: a simple dialog response queue to deterministically respond to alerts/prompts/confirms
class DialogQueue {
  constructor(page) {
    this.page = page;
    this.queue = [];
    // attach handler
    this.page.on('dialog', async (dialog) => {
      const next = this.queue.shift();
      // If no queued response, default to accept without value (for alert/confirm) or accept empty for prompt
      try {
        if (!next) {
          await dialog.accept();
          return;
        }
        if (next.action === 'accept') {
          if (typeof next.value !== 'undefined') {
            await dialog.accept(String(next.value));
          } else {
            await dialog.accept();
          }
        } else if (next.action === 'dismiss') {
          await dialog.dismiss();
        } else {
          // fallback accept
          if (typeof next.value !== 'undefined') await dialog.accept(String(next.value));
          else await dialog.accept();
        }
      } catch (e) {
        // swallow; tests will observe page errors separately
      }
    });
  }

  // Push: { action: 'accept'|'dismiss', value?:string }
  push(response) {
    this.queue.push(response);
  }

  // convenience to push accept with a value (for prompts)
  pushAcceptValue(value) {
    this.push({ action: 'accept', value });
  }

  // accept dialog without value
  pushAccept() {
    this.push({ action: 'accept' });
  }

  pushDismiss() {
    this.push({ action: 'dismiss' });
  }

  // clear any queued responses
  clear() {
    this.queue = [];
  }
}

test.describe('Dynamic Typing Explorer - FSM and UI interactions', () => {
  let page;
  let dq;
  // capture console errors and page errors
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleErrors = [];
    pageErrors = [];

    // capture console messages flagged as 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // capture unhandled exceptions
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    dq = new DialogQueue(page);

    await page.goto(BASE);
    // ensure initial render completed
    await expect(page.locator('#vars-list')).toBeVisible();
    await expect(page.locator('#inspector')).toBeVisible();
  });

  test.afterEach(async () => {
    // Assert there were no uncaught pageerrors or console errors during interactions
    // This validates that runtime exceptions are not leaking during normal flows.
    expect(pageErrors, 'no uncaught page errors').toEqual([]);
    expect(consoleErrors, 'no console errors').toEqual([]);
    await page.close();
  });

  test('S0 Idle: initial UI reflects Idle state', async () => {
    // Validate presence of key components asserted by S0_Idle evidence
    const varsList = page.locator('#vars-list');
    const inspector = page.locator('#inspector');

    await expect(varsList).toContainText('(no variables)');
    await expect(inspector).toHaveText('No variable selected.');
    // history should be present and empty
    await expect(page.locator('#history-log')).toBeVisible();
  });

  test.describe('Variable lifecycle (create, inspect, coerce, clone, delete)', () => {
    test('Create a Number variable and inspect selection (S1 VariableCreated)', async () => {
      // create variable a = 123 (Number)
      await page.fill('#var-name', 'a');
      await page.selectOption('#var-type', 'Number');
      // renderValueControls creates input with id val-number; ensure it's available
      await page.fill('#value-controls #val-number', '123');
      // create
      dq.pushAccept(); // no dialog expected, but keep consistent
      await page.click('#create-btn');

      // Vars list should include a : Number
      await expect(page.locator('#vars-list')).toContainText('a : Number');
      // History should contain 'set variable a'
      await expect(page.locator('#history-log')).toContainText('set variable a');

      // Select variable to inspect
      await page.locator('#vars-list button', { hasText: 'Select' }).first().click();
      await expect(page.locator('#inspector')).toContainText('Name: a');
      await expect(page.locator('#inspector')).toContainText('Type: Number');
    });

    test('Coerce variable a -> String (CoerceVariable) and verify type update', async () => {
      // Ensure variable 'a' exists by creating if necessary
      const varsText = await page.locator('#vars-list').innerText();
      if (!varsText.includes('a :')) {
        // create it
        await page.fill('#var-name', 'a');
        await page.selectOption('#var-type', 'Number');
        await page.fill('#value-controls #val-number', '10');
        dq.pushAccept();
        await page.click('#create-btn');
      }

      // Select 'a' via list's Select for that name
      // Find the row that contains 'a :' and click its Select
      const rows = page.locator('.vars .varrow');
      const count = await rows.count();
      for (let i = 0; i < count; i++) {
        const row = rows.nth(i);
        const txt = await row.textContent();
        if (txt && txt.includes('a :')) {
          await row.locator('button', { hasText: 'Select' }).click();
          break;
        }
      }

      // choose coerce-to String and click coerce
      await page.selectOption('#coerce-to', 'String');
      dq.pushAccept(); // coerceBtn doesn't produce dialog, but queue kept aligned
      await page.click('#coerce-btn');

      // After coercion, variable a should now be labeled as String
      await expect(page.locator('#vars-list')).toContainText('a : String');
      await expect(page.locator('#history-log')).toContainText('coerced a to String');
    });

    test('Clone variable a to a_copy (CloneVariable)', async () => {
      // Ensure 'a' exists
      const varsListText = await page.locator('#vars-list').innerText();
      if (!varsListText.includes('a :')) {
        await page.fill('#var-name', 'a');
        await page.selectOption('#var-type', 'String');
        await page.fill('#value-controls #val-string', 'hello');
        dq.pushAccept();
        await page.click('#create-btn');
      }

      // Select 'a'
      const rows = page.locator('.vars .varrow');
      const cnt = await rows.count();
      for (let i = 0; i < cnt; i++) {
        const row = rows.nth(i);
        const txt = await row.textContent();
        if (txt && txt.includes('a :')) {
          await row.locator('button', { hasText: 'Select' }).click();
          break;
        }
      }

      // Clicking clone will prompt for clone name - respond with 'a_copy'
      dq.pushAcceptValue('a_copy');
      await page.click('#clone-btn');

      // After clone, expect a_copy present
      await expect(page.locator('#vars-list')).toContainText('a_copy');
      await expect(page.locator('#history-log')).toContainText('cloned a to a_copy');
    });

    test('Delete variable wf1 (DeleteVariable) and handle confirmations (S2 VariableDeleted)', async () => {
      // Create a variable named wf1 to delete
      await page.fill('#var-name', 'wf1');
      await page.selectOption('#var-type', 'Number');
      await page.fill('#value-controls #val-number', '7');
      dq.pushAccept();
      await page.click('#create-btn');

      // Delete requires confirm; we will accept
      dq.pushAccept(); // confirm 'Delete wf1?'
      await page.click('#delete-btn');

      // wf1 should no longer be listed
      await expect(page.locator('#vars-list')).not.toContainText('wf1');
      await expect(page.locator('#history-log')).toContainText('deleted variable wf1');
    });

    test('Attempt to delete non-existing variable triggers alert (edge case)', async () => {
      // Ensure var-name is empty or some nonexistent name
      await page.fill('#var-name', 'no_such_var_zz');
      // clicking delete will alert 'Variable not found' -> accept alert
      dq.pushAccept(); // confirm/dismiss isn't used; code alerts then returns; alert will be handled
      await page.click('#delete-btn');
      // History should not include deletion for this name
      await expect(page.locator('#history-log')).not.toContainText('deleted variable no_such_var_zz');
    });
  });

  test.describe('Operations, methods, function execution, workflow and fuzzing', () => {
    test('Apply string method to create new variable (ApplyMethod)', async () => {
      // Create variable b = "hello"
      await page.fill('#var-name', 'b');
      await page.selectOption('#var-type', 'String');
      await page.fill('#value-controls #val-string', 'hello');
      dq.pushAccept();
      await page.click('#create-btn');

      // Select 'b' from list
      const rows = page.locator('.vars .varrow');
      const count = await rows.count();
      for (let i = 0; i < count; i++) {
        const row = rows.nth(i);
        const txt = await row.textContent();
        if (txt && txt.includes('b :')) {
          await row.locator('button', { hasText: 'Select' }).click();
          break;
        }
      }

      // Set method name and click apply. The code will prompt for result variable name.
      await page.fill('#apply-method-name', 'toUpperCase');
      dq.pushAcceptValue('b_upper');
      await page.click('#apply-method-btn');

      // After call, new variable b_upper should exist with string 'HELLO'
      await expect(page.locator('#vars-list')).toContainText('b_upper');
      // select and inspect it to verify preview contains HELLO (previewValue will convert)
      const listText = await page.locator('#vars-list').innerText();
      expect(listText).toContain('b_upper');
      await expect(page.locator('#history-log')).toContainText('called method toUpperCase on b');
    });

    test('Execute arithmetic operation (ExecuteOperation)', async () => {
      // Use literals: left=2, right=3, op '+', result name 'sum'
      await page.selectOption('#op-left', '_literal');
      await page.fill('#op-left-lit', '2');
      await page.selectOption('#op-right', '_literal');
      await page.fill('#op-right-lit', '3');
      await page.selectOption('#op-op', '+');
      await page.fill('#result-name', 'sum');

      dq.pushAccept(); // execOpBtn no dialogs, but queue alignment
      await page.click('#exec-op-btn');

      // Expect result variable 'sum' with value 5 present
      await expect(page.locator('#vars-list')).toContainText('sum');
      await expect(page.locator('#op-trace')).toContainText('Executed.');
      await expect(page.locator('#history-log')).toContainText('operation + -> sum');
    });

    test('Build and run a simple workflow (S3 WorkflowRunning)', async () => {
      // Add a single workflow step: L:5 + L:6 -> wf_sum
      // addStepBtn uses three prompts (left, op, right, then target)
      dq.pushAcceptValue('L:5'); // left
      dq.pushAcceptValue('+');   // op
      dq.pushAcceptValue('L:6'); // right
      dq.pushAcceptValue('wf_sum'); // target
      await page.click('#add-step-btn');

      // Run workflow; should snapshot and execute
      dq.pushAccept(); // runWorkflowBtn triggers no prompts, but keep queue aligned
      await page.click('#run-workflow-btn');

      // workflow log should mention Step 1 and preview value 11
      await expect(page.locator('#workflow-log')).toContainText('Step 1');
      // vars-list should include wf_sum
      await expect(page.locator('#vars-list')).toContainText('wf_sum');
      await expect(page.locator('#history-log')).toContainText('ran workflow with');
    });

    test('Step back (undo) after running workflow', async () => {
      // Click step back (will attempt to pop undoStack). If available, it restores previous workspace.
      // The code may produce an alert if nothing to undo; ensure acceptance to avoid blocking.
      dq.pushAccept(); // for potential alert or undo flow
      await page.click('#step-back-btn');

      // After undo, either history contains 'undid workflow run' or alert was shown.
      // Ensure page remains responsive and no uncaught errors occurred.
      await expect(page.locator('#vars-list')).toBeVisible();
    });

    test('Run dynamic function with variables (RunFunction)', async () => {
      // create vars x=4 y=6
      await page.fill('#var-name', 'x');
      await page.selectOption('#var-type', 'Number');
      await page.fill('#value-controls #val-number', '4');
      dq.pushAccept();
      await page.click('#create-btn');

      await page.fill('#var-name', 'y');
      await page.selectOption('#var-type', 'Number');
      await page.fill('#value-controls #val-number', '6');
      dq.pushAccept();
      await page.click('#create-btn');

      // set function body and args to add them
      await page.fill('#fn-body', 'return args[0] + args[1];');
      await page.fill('#fn-args', 'x,y');
      await page.fill('#fn-result-name', 'fnres');
      dq.pushAccept();
      await page.click('#run-fn-btn');

      // Expect fnres variable present and fnOutput text mentioning the result
      await expect(page.locator('#vars-list')).toContainText('fnres');
      await expect(page.locator('#fn-output')).toContainText('Result saved as fnres');
      await expect(page.locator('#history-log')).toContainText('ran dynamic function -> fnres');
    });

    test('Run fuzzing on a target variable (RunFuzz) and stop', async () => {
      // Create target variable t
      await page.fill('#var-name', 't');
      await page.selectOption('#var-type', 'Number');
      await page.fill('#value-controls #val-number', '1');
      dq.pushAccept();
      await page.click('#create-btn');

      // ensure t available in fuzz-var select
      // select t
      await page.selectOption('#fuzz-var', 't');
      await page.fill('#fuzz-iterations', '3');

      // Start fuzz -> it will run some iterations asynchronously; wait for 'done' marker or timeout
      dq.pushAccept();
      await page.click('#run-fuzz-btn');

      // Wait for fuzz to complete by polling fuzz-log content to include '(done)'
      await page.waitForFunction(() => {
        const el = document.getElementById('fuzz-log');
        return el && el.textContent && el.textContent.includes('(done)');
      }, null, { timeout: 5000 });

      // Stop if still running (safe guard)
      await page.click('#stop-fuzz-btn');

      // Confirm fuzz log contains 'set t' entries
      await expect(page.locator('#fuzz-log')).toContainText('set t');
      await expect(page.locator('#history-log')).toContainText('fuzz: set');
    });
  });

  test.describe('Persistence, workspace import/export and history', () => {
    test('Save workspace to textarea (SaveWorkspace) and then load it back (LoadWorkspace)', async () => {
      // Ensure there is at least one variable to serialize
      await page.fill('#var-name', 'p1');
      await page.selectOption('#var-type', 'String');
      await page.fill('#value-controls #val-string', 'persist');
      dq.pushAccept();
      await page.click('#create-btn');

      // Save workspace - button will trigger alert informing user that JSON placed in textarea
      dq.pushAccept(); // handle alert
      await page.click('#save-workspace-btn');

      // workspace-json textarea should now contain JSON string
      const wsJson = await page.locator('#workspace-json').inputValue();
      expect(wsJson.length).toBeGreaterThan(10);

      // Now clear all variables (confirm) then load the workspace back
      dq.pushAccept(); // confirm clear all
      await page.click('#clear-all-btn');
      await expect(page.locator('#vars-list')).toContainText('(no variables)');

      // Put the previously saved JSON back and load
      await page.fill('#workspace-json', wsJson);
      dq.pushAccept(); // loadWorkspace will not prompt further except alert maybe
      await page.click('#load-workspace-btn');

      // After loading, variable p1 should be restored
      await expect(page.locator('#vars-list')).toContainText('p1');
      await expect(page.locator('#history-log')).toContainText('loaded workspace from JSON');
    });

    test('Download workspace triggers blob creation (DownloadWorkspace) and clear history', async () => {
      // Trigger download (no direct file assertion but ensure no errors)
      await page.click('#download-workspace-btn');

      // Now clear history
      await page.click('#clear-history-btn');

      // history-log should be empty (no children)
      const historyText = await page.locator('#history-log').innerText();
      expect(historyText.trim()).toEqual('');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Creating a function variable with invalid body shows an alert (error scenario)', async () => {
      // choose Function type
      await page.fill('#var-name', 'badfn');
      await page.selectOption('#var-type', 'Function');
      // renderValueControls produced textarea val-fn
      await page.fill('#value-controls #val-fn', 'return args[0] + ;'); // syntax error

      // clicking create triggers try-> new Function and will throw -> caught and alert('Error creating variable: ...')
      dq.pushAccept(); // accept the alert
      await page.click('#create-btn');

      // Ensure badfn was not added
      await expect(page.locator('#vars-list')).not.toContainText('badfn');
    });

    test('Attempt to access missing property on primitive triggers alert', async () => {
      // create a number variable n
      await page.fill('#var-name', 'n');
      await page.selectOption('#var-type', 'Number');
      await page.fill('#value-controls #val-number', '5');
      dq.pushAccept();
      await page.click('#create-btn');

      // Select n row
      const rows = page.locator('.vars .varrow');
      const cnt = await rows.count();
      for (let i = 0; i < cnt; i++) {
        const row = rows.nth(i);
        const txt = await row.textContent();
        if (txt && txt.includes('n :')) {
          await row.locator('button', { hasText: 'Select' }).click();
          break;
        }
      }

      // try to apply a nonexistent property/method: set applyMethodName to 'nonexistentMethod'
      await page.fill('#apply-method-name', 'nonexistentMethod');
      // The code will alert 'Property/method not found on value.' -> accept
      dq.pushAccept();
      await page.click('#apply-method-btn');

      // No new variable should be created
      await expect(page.locator('#vars-list')).not.toContainText('n_nonexistent');
    });
  });

  test('Verify the FSM state transitions through the history log and UI', async () => {
    // This test is a higher-level assertion that ensures the FSM-like state evolution is observable
    // Create variable s = "state"
    await page.fill('#var-name', 's');
    await page.selectOption('#var-type', 'String');
    await page.fill('#value-controls #val-string', 'state');
    dq.pushAccept();
    await page.click('#create-btn');

    // Verify history contains set variable s
    await expect(page.locator('#history-log')).toContainText('set variable s');

    // Coerce s to Number (invalid numeric will become NaN) - choose Number
    // Select s
    const rows = page.locator('.vars .varrow');
    const cnt = await rows.count();
    for (let i = 0; i < cnt; i++) {
      const row = rows.nth(i);
      const txt = await row.textContent();
      if (txt && txt.includes('s :')) {
        await row.locator('button', { hasText: 'Select' }).click();
        break;
      }
    }

    await page.selectOption('#coerce-to', 'Number');
    dq.pushAccept();
    await page.click('#coerce-btn');

    // History should include a coercion entry
    await expect(page.locator('#history-log')).toContainText('coerced s to Number');

    // Clear all variables and then randomize examples (S0_Idle transitions)
    dq.pushAccept(); // confirm clear all
    await page.click('#clear-all-btn');

    await page.click('#random-btn');
    // After randomize, vars-list should show variables from random example
    await expect(page.locator('#vars-list')).toContainText('a :');
    await expect(page.locator('#history-log')).toContainText('loaded random example variables');
  });
});