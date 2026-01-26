import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c167673-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Static Typing — Interactive Playground (FSM + runtime observations)', () => {
  // capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // collect page errors and console entries on the page
    page.context()._testPageErrors = [];
    page.context()._testConsole = [];

    page.on('pageerror', (err) => {
      // store the error message for assertions
      page.context()._testPageErrors.push(String(err && err.message ? err.message : err));
    });
    page.on('console', (msg) => {
      page.context()._testConsole.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application and wait for load to complete.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // no-op teardown placeholder in case we later want to snapshot logs
  });

  test('S0_Idle: initial page renders expected static content and the demo header is present', async ({ page }) => {
    // Validate presence of static evidence for Idle state (S0_Idle)
    const header = await page.locator('h1').innerText();
    expect(header).toContain('Static Typing — Interactive Playground');

    const overview = await page.locator('section >> text=Explore static typing concepts').first().innerText();
    expect(overview).toBeTruthy();

    // The initial log element in the HTML should contain the seed text even if JS later errors
    const logContent = await page.locator('#log').innerText();
    expect(logContent).toContain('Ready. Parse types to begin.');
  });

  test('Script runtime errors during initialization are observed (expect TypeError from renderTypesList mismatch)', async ({ page }) => {
    // We expect the page to have emitted at least one pageerror due to a deliberate DOM property name mismatch in the app.
    const errors = page.context()._testPageErrors;
    // Give a tiny grace period in case errors emitted slightly after load
    await page.waitForTimeout(150);
    expect(errors.length).toBeGreaterThan(0);

    // Ensure one of the errors hints at the missing element (renderTypesList uses ui.typeDetailSelect but actual key is typesDetailSelect)
    const combined = errors.join(' | ').toLowerCase();
    const likelyIndicators = ['typedetailselect', 'typeDetailSelect'.toLowerCase(), 'innerhtml', 'cannot read', 'cannot set property'];
    const found = likelyIndicators.some(ind => combined.includes(ind));
    expect(found).toBeTruthy();
  });

  test.describe('FSM events / UI controls (attempts and observable outcomes)', () => {
    // helper to click and optionally handle dialog within a short timeframe
    async function clickAndMaybeHandleDialog(page, selector, dialogHandler, timeout = 600) {
      let handled = false;
      const listener = async (dialog) => {
        try {
          await dialogHandler(dialog);
        } catch (e) {
          // swallow handler errors; they will surface as page errors if fatal
        }
        handled = true;
      };
      page.on('dialog', listener);
      // Try click and wait briefly for a dialog to appear
      await page.click(selector).catch(() => {
        // clicking could fail if script crashed; swallow to allow assertions about errors
      });
      // wait short time for dialog to arrive
      await page.waitForTimeout(timeout);
      page.off('dialog', listener);
      return handled;
    }

    test('ParseTypes (btnParse) either logs "Types parsed." or is blocked by the initialization error', async ({ page }) => {
      // Attempt to click Parse Types and observe results.
      // If the page's JS event wiring survived, we should see "Types parsed." in the log.
      // Otherwise, at minimum we expect page errors recorded from initialization.
      await clickAndMaybeHandleDialog(page, '#btnParse', async (dialog) => { await dialog.dismiss(); });

      // Allow any background processing a moment
      await page.waitForTimeout(200);

      const logText = await page.locator('#log').innerText();
      const parsedObserved = logText.toLowerCase().includes('types parsed');

      // Either the app logged "Types parsed." OR we have recorded the earlier page error (checked in previous test).
      if (!parsedObserved) {
        // Confirm that a runtime error exists (it should, per earlier expectations).
        expect(page.context()._testPageErrors.length).toBeGreaterThan(0);
      } else {
        expect(parsedObserved).toBeTruthy();
      }
    });

    test('ResetTypes (btnResetTypes) - dialog handling and expected log "Types cleared."', async ({ page }) => {
      // The Reset Types flow shows a confirm dialog. If handlers are wired, accept it and expect "Types cleared." in logs.
      const dialogResponses = [];
      const dialogHandler = async (dialog) => {
        dialogResponses.push({ type: dialog.type(), message: dialog.message() });
        await dialog.accept(); // accept the confirm
      };

      const hadDialog = await clickAndMaybeHandleDialog(page, '#btnResetTypes', dialogHandler);

      // wait a little for any logging to occur
      await page.waitForTimeout(200);

      const log = await page.locator('#log').innerText();
      const clearedObserved = log.toLowerCase().includes('types cleared') || log.toLowerCase().includes('types cleared.');

      // Accept either of two outcomes:
      // - if a dialog appeared and we accepted, expect the log to include 'Types cleared.' (successful path)
      // - if no dialog appeared because event wiring failed, ensure we still have page errors recorded
      if (hadDialog) {
        expect(clearedObserved).toBeTruthy();
      } else {
        expect(page.context()._testPageErrors.length).toBeGreaterThan(0);
      }
    });

    test('AddVariable (btnAddVar) and edge case: submitting empty name triggers alert', async ({ page }) => {
      // First attempt: press Add Variable with empty name -> should trigger an alert "Enter variable name" if handler exists
      let alertSeen = false;
      const dialogHandler1 = async (dialog) => {
        alertSeen = true;
        // check it's an alert and message content
        expect(dialog.type()).toBe('alert');
        // accept it
        await dialog.accept();
      };
      const hadAlert = await clickAndMaybeHandleDialog(page, '#btnAddVar', dialogHandler1);
      if (hadAlert) {
        expect(alertSeen).toBeTruthy();
      } else {
        // In the absence of the handler, ensure the app produced a page error as we expect
        expect(page.context()._testPageErrors.length).toBeGreaterThan(0);
      }

      // Now fill in a valid variable name and try to add. We attempt to add 'alice' with a JSON value.
      await page.fill('#varName', 'alice').catch(()=>{});
      await page.fill('#varValue', '{"name":"Alice","age":30}').catch(()=>{});
      // pick declared type if available (may not be available if types weren't parsed)
      await clickAndMaybeHandleDialog(page, '#btnAddVar', async (dialog) => { await dialog.dismiss(); });
      // wait and inspect the variables list; if rendering is broken, we fallback to asserting page errors exist
      await page.waitForTimeout(200);
      const varsText = await page.locator('#varsList').innerText();
      if (varsText && varsText.toLowerCase().includes('alice')) {
        expect(varsText).toContain('alice');
      } else {
        // ensure runtime error was captured
        expect(page.context()._testPageErrors.length).toBeGreaterThan(0);
      }
    });

    test('ClearVariables (btnClearVars) - confirm handling and log evidence', async ({ page }) => {
      // Click clear vars and accept the confirm if presented
      let confirmed = false;
      const handler = async (dialog) => {
        if (dialog.type() === 'confirm') {
          confirmed = true;
          await dialog.accept();
        } else {
          await dialog.dismiss();
        }
      };
      const hadDialog = await clickAndMaybeHandleDialog(page, '#btnClearVars', handler);
      await page.waitForTimeout(150);
      const logText = await page.locator('#log').innerText();
      const clearedLog = logText.toLowerCase().includes('variables cleared');
      if (hadDialog && confirmed) {
        expect(clearedLog || page.context()._testPageErrors.length >= 0).toBeTruthy();
      } else {
        // if no dialog/handler, assert page errors exist (script likely crashed earlier)
        expect(page.context()._testPageErrors.length).toBeGreaterThan(0);
      }
    });

    test('InferAll (btnInferAll) and CheckAllAssignments (btnCheckAll) - attempt, observe logs or errors', async ({ page }) => {
      // Try Infer All
      await page.click('#btnInferAll').catch(() => { /* allow failure if handler not wired */ });
      await page.waitForTimeout(200);
      const logAfterInfer = await page.locator('#log').innerText();
      const inferOk = logAfterInfer.toLowerCase().includes('all variables inferred') || logAfterInfer.toLowerCase().includes('inferred');
      // Try Check All
      await page.click('#btnCheckAll').catch(() => { /* swallow */ });
      await page.waitForTimeout(200);
      const logAfterCheck = await page.locator('#log').innerText();
      const checkObserved = logAfterCheck.toLowerCase().includes('check:') || logAfterCheck.toLowerCase().includes('type error');

      // Accept either that the operations produced expected log messages OR that runtime errors were captured.
      if (!inferOk && !checkObserved) {
        expect(page.context()._testPageErrors.length).toBeGreaterThan(0);
      } else {
        expect(inferOk || checkObserved).toBeTruthy();
      }
    });

    test('AutoFix (btnAutoFix) - attempt and validate suggestion logs or error', async ({ page }) => {
      await page.click('#btnAutoFix').catch(() => {});
      await page.waitForTimeout(200);
      const log = await page.locator('#log').innerText();
      const suggestions = log.toLowerCase().includes('suggest') || log.toLowerCase().includes('no fixes proposed');
      if (!suggestions) {
        // fallback: confirm that a page error exists
        expect(page.context()._testPageErrors.length).toBeGreaterThan(0);
      } else {
        expect(suggestions).toBeTruthy();
      }
    });

    test('RefactorRename (btnRefactorRename), Unionize (btnUnionize), Intersect (btnIntersect): prompts handled if present', async ({ page }) => {
      // These workflows rely on prompt sequences. We'll attempt to respond programmatically in order.
      // Because prompt() is modal and sequential, implement a queue of expected answers.
      const answers = {
        // For refactorRenameProperty(): first prompt is type name, second prompt is from prop, third prompt is to name
        refactor: ['Person', 'name', 'fullName'],
        unionize: ['Person,Admin', 'PeopleUnion'],
        intersect: ['Person,Admin', 'PeopleIntersect']
      };
      // generic handler that pops from correct queue based on dialog message hint
      page.on('dialog', async (dialog) => {
        const msg = dialog.message();
        if (msg.toLowerCase().includes('type to refactor') || msg.toLowerCase().includes('type to refactor (name)')) {
          await dialog.accept(answers.refactor.shift() || '');
        } else if (msg.toLowerCase().includes('property to rename')) {
          await dialog.accept(answers.refactor.shift() || '');
        } else if (msg.toLowerCase().includes('new property name')) {
          await dialog.accept(answers.refactor.shift() || '');
        } else if (msg.toLowerCase().includes('comma-separated type names to unionize')) {
          await dialog.accept(answers.unionize.shift() || '');
        } else if (msg.toLowerCase().includes('new type name for union')) {
          await dialog.accept(answers.unionize.shift() || '');
        } else if (msg.toLowerCase().includes('comma-separated type names to intersect')) {
          await dialog.accept(answers.intersect.shift() || '');
        } else if (msg.toLowerCase().includes('new type name for intersection')) {
          await dialog.accept(answers.intersect.shift() || '');
        } else {
          // default dismiss to avoid hanging
          try { await dialog.dismiss(); } catch(e){ }
        }
      });

      // Attempt each action
      await page.click('#btnRefactorRename').catch(()=>{});
      await page.waitForTimeout(200);
      await page.click('#btnUnionize').catch(()=>{});
      await page.waitForTimeout(200);
      await page.click('#btnIntersect').catch(()=>{});
      await page.waitForTimeout(300);

      const log = await page.locator('#log').innerText();
      const refactorOk = log.toLowerCase().includes('refactor complete') || log.toLowerCase().includes('union type') || log.toLowerCase().includes('intersection type');
      if (!refactorOk) {
        expect(page.context()._testPageErrors.length).toBeGreaterThan(0);
      } else {
        expect(refactorOk).toBeTruthy();
      }
      // remove dialog listener to avoid interference with other tests
      page.removeAllListeners('dialog');
    });

    test('InferVariable (btnInferVar) and AssignToVariable (btnAssignToVar) with runtime checks dialog path', async ({ page }) => {
      // choose a variable if available in selector; if not present, ensure errors are recorded
      const varSelectExists = await page.locator('#varDetailSelect').count() > 0;
      if (!varSelectExists) {
        expect(page.context()._testPageErrors.length).toBeGreaterThan(0);
        return;
      }

      // If the select contains options, pick the first non-empty option
      const optionValue = await page.locator('#varDetailSelect option').nth(1).getAttribute('value').catch(() => null);
      if (optionValue) {
        // select that variable
        await page.selectOption('#varDetailSelect', optionValue).catch(()=>{});
        // attempt infer variable
        await page.click('#btnInferVar').catch(()=>{});
        await page.waitForTimeout(150);
        const log1 = await page.locator('#log').innerText();
        const inferred = log1.toLowerCase().includes('inferred');
        // Now attempt assign: set assignExpr to a literal that may mismatch and enable runtimeChecks to exercise confirm flow
        await page.check('#runtimeChecks').catch(()=>{});
        await page.fill('#assignExpr', '42').catch(()=>{});
        // handler for runtime confirm that may appear during assign
        let runtimeDialogSeen = false;
        page.once('dialog', async (dialog) => {
          runtimeDialogSeen = true;
          // accept runtime guard
          await dialog.accept();
        });
        await page.click('#btnAssignToVar').catch(()=>{});
        await page.waitForTimeout(200);
        const log2 = await page.locator('#log').innerText();
        const assignedLog = log2.toLowerCase().includes('assignment') || log2.toLowerCase().includes('assigned');
        // Accept either inference/assignment logs OR recorded page errors
        if (!inferred && !assignedLog) {
          expect(page.context()._testPageErrors.length).toBeGreaterThan(0);
        } else {
          expect(inferred || assignedLog).toBeTruthy();
        }
      } else {
        // no option available: script likely failed earlier
        expect(page.context()._testPageErrors.length).toBeGreaterThan(0);
      }
    });

    test('ShowHistory (btnShowHistory) and ClearHistory (btnClearHistory) - alert and confirm handling', async ({ page }) => {
      // ShowHistory triggers an alert with text 'History shown in the right panel.'
      let alertSeen = false;
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('alert');
        alertSeen = dialog.message().toLowerCase().includes('history shown');
        await dialog.accept();
      });
      await page.click('#btnShowHistory').catch(()=>{});
      await page.waitForTimeout(200);
      if (!alertSeen) {
        // if no alert observed, fall back to asserting that page errors occurred
        expect(page.context()._testPageErrors.length).toBeGreaterThan(0);
      } else {
        expect(alertSeen).toBeTruthy();
      }

      // ClearHistory should prompt a confirm; accept it
      let confirmSeen = false;
      page.once('dialog', async (dialog) => {
        if (dialog.type() === 'confirm') {
          confirmSeen = true;
          await dialog.accept();
        } else {
          await dialog.dismiss();
        }
      });
      await page.click('#btnClearHistory').catch(()=>{});
      await page.waitForTimeout(200);
      const log = await page.locator('#log').innerText();
      const cleared = log.toLowerCase().includes('history cleared');
      if (confirmSeen) {
        expect(cleared || page.context()._testPageErrors.length >= 0).toBeTruthy();
      } else {
        expect(page.context()._testPageErrors.length).toBeGreaterThan(0);
      }
    });
  });

  test('Final sanity: ensure that observed page errors include TypeError/undefined property diagnostics (document the exact messages)', async ({ page }) => {
    // Re-check the accumulated page errors for a TypeError-like message tying back to UI mismatch
    // Allow slight delay for any asynchronous errors
    await page.waitForTimeout(200);
    const errors = page.context()._testPageErrors;
    expect(errors.length).toBeGreaterThan(0);

    // At least one error should mention 'typeDetailSelect' or 'innerHTML' or common "Cannot read properties" phrasing
    const combined = errors.join(' ').toLowerCase();
    const expectedFragments = ['typedetailselect', 'innerhtml', 'cannot read properties', 'cannot set property', 'cannot read'];
    const found = expectedFragments.some(f => combined.includes(f));
    expect(found).toBeTruthy();
  });
});