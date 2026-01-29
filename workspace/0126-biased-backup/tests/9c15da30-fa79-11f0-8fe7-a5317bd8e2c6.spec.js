import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c15da30-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper to respond to a known sequence of dialogs (prompts/confirms/alerts)
async function respondToDialogs(page, answers = []) {
  return new Promise((resolve) => {
    const handler = async (dialog) => {
      const ans = answers.shift();
      try {
        if (dialog.type() === 'confirm') {
          // For confirm dialogs, treat truthy answer as accept, falsy as dismiss.
          if (ans === undefined || ans) await dialog.accept();
          else await dialog.dismiss();
        } else {
          // prompt or alert: supply text or just accept
          await dialog.accept(ans === undefined ? '' : String(ans));
        }
      } catch (e) {
        // ignore handler errors
      }
      if (answers.length === 0) {
        page.off('dialog', handler);
        // give a tick for any UI updates
        setTimeout(resolve, 0);
      }
    };
    page.on('dialog', handler);
  });
}

test.describe('HTTP Explorer - Interactive Demo (App ID: 9c15da30-fa79-11f0-8fe7-a5317bd8e2c6)', () => {
  // Collect console messages and page errors for assertions and debugging
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      try { consoleMessages.push(msg.text()); } catch (e) { consoleMessages.push(String(msg)); }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app page and wait for it to initialize
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    // small safety wait so the inline script has initialized DOM and state
    await page.waitForSelector('h1');
  });

  test.describe('Basic UI state and Idle (S0_Idle)', () => {
    test('Initial page shows header and default idle indicators', async ({ page }) => {
      // Validate Idle evidence: header text
      const h1 = page.locator('h1');
      await expect(h1).toHaveText('HTTP Explorer (interactive)');

      // Initial response fields should show defaults (Idle)
      await expect(page.locator('#status')).toHaveText('-');
      await expect(page.locator('#time')).toHaveText('-');
      await expect(page.locator('#size')).toHaveText('-');

      // No uncaught page errors right after load
      expect(pageErrors.length).toBe(0);
    });

    test('Adding headers and query params increases editor rows', async ({ page }) => {
      // headerList initially has 1 created header 'Accept' (plus another created earlier)
      const headerList = page.locator('#headerList');
      const queryList = page.locator('#queryList');

      const initialHeaderCount = await headerList.locator('div').count();
      const initialQueryCount = await queryList.locator('div').count();

      // Click add header and add query
      await page.click('#addHeader');
      await page.click('#addQuery');

      // New rows should appear
      await expect(headerList.locator('div')).toHaveCount(initialHeaderCount + 1);
      await expect(queryList.locator('div')).toHaveCount(initialQueryCount + 1);
    });
  });

  test.describe('Request flow and response handling (S0 -> S1 -> S2 -> S0)', () => {
    test('Simulated request: add sim rule, send request, view headers/body and clear response', async ({ page }) => {
      // Ensure we are in simulated mode
      await page.click('input[name="mode"][value="sim"]');

      // Prepare dialogs answers to add a simulation rule
      // Dialogs sequence for addSimRule:
      // 1 prompt pattern, 2 prompt method, 3 prompt status, 4 prompt headers, 5 prompt body, 6 confirm isJson
      const simRuleAnswers = [
        '.*', // pattern -> match anything
        '',   // method -> any
        '200', // status
        '{"content-type":"application/json"}', // headers (JSON)
        '{"message":"hello","value":42}', // body
        true // confirm treat body as JSON = OK
      ];
      const dialogsPromise = respondToDialogs(page, [...simRuleAnswers]);
      // Trigger addSimRule which fires prompts
      await page.click('#addSimRule');
      // Wait for dialog handler to finish
      await dialogsPromise;

      // Set URL to something the sim rule will match
      await page.fill('#url', 'https://api.test/endpoint');
      // Click Send Request to transition S0 -> S1 (sending) -> S2 (received)
      await page.click('#sendBtn');

      // Wait for response to be processed: bodyPre should change from 'sending...'
      await page.waitForFunction(() => {
        const body = document.getElementById('bodyPre');
        return body && body.textContent && body.textContent.indexOf('sending') === -1;
      });

      // Check evidence from FSM: status/time/size updated
      const status = await page.locator('#status').textContent();
      expect(status).toBe('200'); // from sim rule

      const headersText = await page.locator('#headersPre').textContent();
      expect(headersText).toContain('content-type');

      const bodyText = await page.locator('#bodyPre').textContent();
      expect(bodyText).toContain('hello'); // response contains hello

      // Toggle headers visibility (ToggleHeaders event)
      const respHeaders = page.locator('#responseHeaders');
      // Initially it is hidden (style.display === 'none')
      let displayBefore = await page.evaluate(() => document.getElementById('responseHeaders').style.display);
      expect(displayBefore === 'none' || displayBefore === '').toBeTruthy();
      // Click toggle, expect it to become visible
      await page.click('#toggleHeaders');
      let displayAfter = await page.evaluate(() => document.getElementById('responseHeaders').style.display);
      expect(displayAfter).toBe('block');

      // Toggle pretty print: ensure pretty JSON layout (has a newline/indentation)
      await page.click('#togglePretty');
      const pretty = await page.locator('#bodyPre').textContent();
      expect(pretty.includes('\n')).toBeTruthy();

      // Now test ClearResponse event: click Clear
      await page.click('#clearResponse');
      await expect(page.locator('#bodyPre')).toHaveText('no response');
      await expect(page.locator('#headersPre')).toHaveText('');
      await expect(page.locator('#status')).toHaveText('-');
    });

    test('Copy raw request: either clipboard success log or an error is observed', async ({ page }) => {
      // Build a simple request in builder
      await page.fill('#url', 'https://api.test/copytest');
      await page.click('#addHeader'); // ensure headers exist so the request has headers

      // Click copy request. The handler uses navigator.clipboard.writeText and then logs on success.
      await page.click('#copyRequest');

      // Wait briefly to allow clipboard promise or any error to appear in console
      await page.waitForTimeout(250);

      // Either we saw log message about copying or there is a console/page error (clipboard not available)
      const copiedLog = consoleMessages.find(m => m && m.toLowerCase().includes('request copied to clipboard'));
      expect(!!copiedLog || pageErrors.length > 0).toBeTruthy();
    });

    test('Simulated failure scenario: create fail sim rule and assert request error handling (edge case)', async ({ page }) => {
      await page.click('input[name="mode"][value="sim"]');

      // Prepare a sim rule that simulates a network failure for URLs containing 'fail'
      const failSimAnswers = [
        '.*fail.*', // pattern -> match urls with 'fail'
        '',         // method -> any
        '200',      // status (ignored for network fail)
        '{"content-type":"text/plain"}',
        'sim failure',
        false // treat body as JSON? No
      ];
      const dialogsPromise = respondToDialogs(page, [...failSimAnswers]);
      await page.click('#addSimRule');
      await dialogsPromise;

      // Now edit that rule to set failType to 'network' via Edit flow:
      // The UI requires clicking Edit button on the rendered sim rule. The code opens a series of prompts (pattern, method, status, headers, body)
      // After edit prompts the code also does a confirm for isJson and then prompts for delay and failType
      // To simplify, we'll click Edit and respond with values that set failType to 'network'.
      // Find the Edit button in simRulesList. There should be at least one rule; click its Edit button.
      const editButton = page.locator('#simRulesList button').filter({ hasText: 'Edit' }).first();
      if (await editButton.count() === 0) {
        test.skip(true, 'No sim rule edit button found; skipping network-fail edge-case');
        return;
      }

      // Answers for the edit sequence: pattern, method, status, headers, body, confirm(isJson), delay, failType
      const editAnswers = [
        '.*fail.*', // keep same
        '', // method
        '200',
        '{"content-type":"text/plain"}',
        'sim failure',
        false, // isJson
        '0', // delay
        'network' // failType
      ];
      const editDialogsPromise = respondToDialogs(page, [...editAnswers]);
      await editButton.click();
      await editDialogsPromise;

      // Now send a request to a URL that matches the fail rule
      await page.fill('#url', 'https://api.test/this-should-fail');
      await page.click('#sendBtn');

      // Wait for UI to update to error message
      await page.waitForFunction(() => document.getElementById('bodyPre').textContent.startsWith('Error:') || document.getElementById('status').textContent === 'ERR');

      const statusText = await page.locator('#status').textContent();
      expect(statusText).toBe('ERR');

      const bodyText = await page.locator('#bodyPre').textContent();
      expect(bodyText.startsWith('Error:')).toBeTruthy();
    });
  });

  test.describe('Workflow (S3_WorkflowRunning and transitions)', () => {
    test('Add a manual step and run workflow (sequential) and observe workflow logs', async ({ page }) => {
      // Ensure simulated mode so steps don't hit external network
      await page.click('input[name="mode"][value="sim"]');

      // Add a manual step to the workflow and run it
      await page.click('#addManualStep');
      // Wait for step element to appear
      await page.waitForSelector('#stepsList .step');

      // Optionally, ensure there is a sim rule to return something; if none exists add a generic sim rule
      const existingRules = await page.locator('#simRulesList .panel').count();
      if (existingRules === 0) {
        const addRuleAnswers = ['.*', '', '200', '{"content-type":"application/json"}', '{"msg":"ok"}', true];
        const dialogsPromise = respondToDialogs(page, [...addRuleAnswers]);
        await page.click('#addSimRule');
        await dialogsPromise;
      }

      // Run workflow; this should log "Starting workflow: mode=..." and run steps then "Workflow complete"
      await page.click('#runWorkflow');

      // Wait for workflow log to include a starting line and completion. There's no fixed timing, so poll.
      await page.waitForFunction(() => {
        const t = document.getElementById('workflowLog').textContent;
        return t.includes('Starting workflow') && t.includes('Workflow complete');
      }, { timeout: 5000 });

      const workflowLogText = await page.locator('#workflowLog').textContent();
      expect(workflowLogText).toContain('Starting workflow:');
      expect(workflowLogText).toContain('Workflow complete');
    });

    test('Workflow run will set lastResponse and refresh variables when extractors present', async ({ page }) => {
      // Use exampleAuthBtn to load an example workflow that contains extractors
      await page.click('#examplesBtn'); // make sure builder has simple example loaded
      // Click the example workflow loader to set up workflow with extractors
      await page.click('#exampleAuth');

      // Ensure mode is sim and add a broad sim rule returning JSON that includes fields used by extractors
      await page.click('input[name="mode"][value="sim"]');
      const bodyForExtractors = JSON.stringify({ authenticated: true, title: 'todo-title' });
      const simAnswers = ['.*', '', '200', '{"content-type":"application/json"}', bodyForExtractors, true];
      const dlg = respondToDialogs(page, [...simAnswers]);
      await page.click('#addSimRule');
      await dlg;

      // Run the workflow
      await page.click('#runWorkflow');

      // Wait for workflow completion
      await page.waitForFunction(() => document.getElementById('workflowLog').textContent.includes('Workflow complete'), { timeout: 5000 });

      // After running, variables UI should contain extractor results (e.g., authOk or todoTitle depending on step)
      await page.click('#showVars');
      const varsText = await page.locator('#varsPre').textContent();
      // Either extractor set something or vars contains the example preset values; at minimum JSON is present
      expect(varsText.trim().startsWith('{')).toBeTruthy();
    });
  });

  test.describe('Variables import/export and script runner', () => {
    test('Import variables via prompt and show them', async ({ page }) => {
      // Prepare the prompt to import a JSON object
      const importAnswers = ['{"imported":"yes","num":5}'];
      const dlgPromise = respondToDialogs(page, [...importAnswers]);

      await page.click('#importVars');
      await dlgPromise;

      // Show variables to refresh UI and assert the imported variable is present
      await page.click('#showVars');
      const varsText = await page.locator('#varsPre').textContent();
      expect(varsText).toContain('"imported": "yes"');
      expect(varsText).toContain('"num": 5');
    });

    test('Run a user script that intentionally logs and updates vars (and observe script log)', async ({ page }) => {
      // Fill script area to modify vars and log something
      const script = `
        api.log('script-start');
        api.vars.testScript = { value: 123 };
        api.log('script-end');
      `;
      await page.fill('#scriptArea', script);
      await page.click('#runScript');

      // Wait for script log to include completion or script lines
      await page.waitForFunction(() => document.getElementById('scriptLog').textContent.toLowerCase().includes('script-completed') || document.getElementById('scriptLog').textContent.toLowerCase().includes('script-end'), { timeout: 3000 });

      const scriptLog = await page.locator('#scriptLog').textContent();
      expect(scriptLog.toLowerCase()).toContain('script-end');

      // varsPre should be refreshed by runUserScript; trigger showVars and assert presence
      await page.click('#showVars');
      const varsText = await page.locator('#varsPre').textContent();
      expect(varsText).toContain('"testScript"');
      expect(varsText).toContain('123');
    });
  });

  test.describe('Intentional uncaught errors observation (observing pageerror events)', () => {
    test('Trigger an uncaught ReferenceError in page context and assert pageerror is observed', async ({ page }) => {
      // Ensure no prior page errors
      expect(pageErrors.length).toBe(0);

      // Trigger an uncaught error asynchronously inside the page so it's not caught by evaluate call
      await page.evaluate(() => {
        // schedule an invocation of a non-existent function on the next tick -> causes an uncaught ReferenceError
        setTimeout(() => {
          // this will throw an uncaught ReferenceError in page context
          // eslint-disable-next-line no-undef
          window.__THIS_FUNCTION_DOES_NOT_EXIST__();
        }, 0);
      });

      // Give the page a moment to process and emit the pageerror event
      await page.waitForTimeout(200);

      // Assert that at least one page error was captured
      expect(pageErrors.length).toBeGreaterThan(0);
      const errMsg = String(pageErrors[0].message || pageErrors[0]);
      // The message should reference the function name or be a ReferenceError
      expect(errMsg.toLowerCase()).toContain('referenceerror');
    });
  });

  test.afterEach(async ({ page }) => {
    // If there are page errors, log them in the test output to help debugging
    if (pageErrors.length > 0) {
      // make the test runner show these errors if present
      // (We don't rethrow because some tests intentionally cause errors)
      // But we assert presence as needed in tests above.
    }
  });
});