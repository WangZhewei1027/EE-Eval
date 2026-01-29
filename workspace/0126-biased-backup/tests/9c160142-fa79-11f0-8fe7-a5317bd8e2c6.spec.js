import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c160142-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('REST API Interactive Playground - FSM and UI validation', () => {
  // Arrays to collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;
  let lastDialogMessage;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    lastDialogMessage = null;

    // Capture console messages of type 'error'
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions (pageerror)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Capture dialogs (alerts/confirms/prompts) and accept them by default,
    // while recording the last message so tests can assert on alert contents
    page.on('dialog', async dialog => {
      lastDialogMessage = dialog.message();
      await dialog.accept();
    });

    // Navigate to the page fresh for every test
    await page.goto(APP_URL, { waitUntil: 'networkidle' });

    // Basic sanity: wait for the primary heading to ensure page loaded
    await expect(page.locator('h1')).toHaveText('REST API Interactive Playground');
  });

  test.afterEach(async () => {
    // By default ensure no unexpected console or page errors were emitted during each test.
    // Tests that intentionally cause UI alerts will still pass if no console/page errors happened.
    expect(consoleErrors, 'No console.error messages should appear').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should appear').toEqual([]);
  });

  test.describe('Idle state and initial render', () => {
    test('S0_Idle: should render main heading and request builder controls', async ({ page }) => {
      // Validate presence of main UI components per Idle state's entry action (renderPage)
      await expect(page.locator('h1')).toHaveText('REST API Interactive Playground');

      // Check that key controls exist
      await expect(page.locator('#send-request')).toBeVisible();
      await expect(page.locator('#req-method')).toBeVisible();
      await expect(page.locator('#req-url')).toHaveValue('/todos');
      await expect(page.locator('#history-list')).toBeVisible();
      await expect(page.locator('#presets-list')).toBeVisible();
    });
  });

  test.describe('Send Request / Request Sent (S1_RequestSent)', () => {
    test('SendRequest: clicking Send Request displays a response and records history', async ({ page }) => {
      // Ensure method and URL are set for a GET that should succeed
      await page.selectOption('#req-method', 'GET');
      await page.fill('#req-url', '/todos');

      // Click Send Request and wait for response UI updates
      await page.click('#send-request');

      // Wait for the response status to be updated (displayResponse sets it)
      await expect(page.locator('#res-status')).toHaveText(/^\d+$/);

      // Check that status is 200 for GET /todos
      const statusText = await page.locator('#res-status').innerText();
      expect(Number(statusText)).toBeGreaterThanOrEqual(200);
      expect(Number(statusText)).toBeLessThan(300);

      // Response body should be populated
      const bodyText = await page.locator('#res-body').innerText();
      expect(bodyText).not.toBe('-');
      expect(bodyText.length).toBeGreaterThan(0);

      // History should now contain at least one entry
      const historyItems = await page.locator('#history-list li').count();
      expect(historyItems).toBeGreaterThanOrEqual(1);

      // Logs area should contain an entry about sending
      const logs = await page.locator('#res-log').innerText();
      expect(logs.toLowerCase()).toContain('sending get /todos');
    });

    test('Edge case: retry with backoff button triggers retries and displays responses', async ({ page }) => {
      // Choose a URL that will return 200 for GET
      await page.selectOption('#req-method', 'GET');
      await page.fill('#req-url', '/todos');

      // Click retry button - this triggers retryWithBackoff which should update res-status
      await page.click('#send-repeat');

      // Expect some response displayed
      await expect(page.locator('#res-status')).toHaveText(/\d+/);
      const status = Number(await page.locator('#res-status').innerText());
      expect(status).toBeGreaterThanOrEqual(200);
    });
  });

  test.describe('Attach File (AttachFile event)', () => {
    test('AttachFile: attaching a file embeds base64 into body', async ({ page }) => {
      // Create a small in-memory file and set it on the file input
      const fileName = 'test.txt';
      const fileContent = 'hello play';
      await page.setInputFiles('#req-file', {
        name: fileName,
        mimeType: 'text/plain',
        buffer: Buffer.from(fileContent, 'utf8')
      });

      // Click Attach file to body, this triggers FileReader and updates #req-body
      await page.click('#attach-file');

      // Wait for the req-body to update (it is JSON containing fileName and fileData)
      await expect(page.locator('#req-body')).toHaveText(/fileName/);

      const body = await page.locator('#req-body').innerText();
      expect(body).toContain(fileName);
      expect(body).toMatch(/fileData\"\s*:\s*\"[A-Za-z0-9+/=]+\"/);
    });

    test('AttachFile without selecting file should show alert', async ({ page }) => {
      // Ensure no file is selected: set empty files
      await page.setInputFiles('#req-file', []); // clear
      // Reset captured last dialog
      lastDialogMessage = null;

      // Click attach-file - should trigger an alert 'Choose a file first'
      await page.click('#attach-file');

      // The dialog handler accepts the alert; assert message recorded
      expect(lastDialogMessage).toContain('Choose a file first');
    });
  });

  test.describe('Batch Composer (S2_BatchComposerOpen)', () => {
    test('OpenBatchComposer: batch composer toggles visibility and run-batch shows results', async ({ page }) => {
      // Open batch composer
      await page.click('#batch-open');

      // The batch area should become visible (display not 'none')
      const batchArea = page.locator('#batch-area');
      await expect(batchArea).toBeVisible();

      // Run batch with default content - the UI's sample contains two requests,
      // run-batch will call MockServer.handleRequest and display results.
      await page.click('#run-batch');

      // Ensure batch-results updated
      await expect(page.locator('#batch-results')).toHaveText(/^\s*\[/); // JSON array text
      const resultsText = await page.locator('#batch-results').innerText();
      expect(resultsText.length).toBeGreaterThan(2);

      // Close the batch composer
      await page.click('#close-batch');
      await expect(batchArea).toBeHidden();
    });

    test('Edge case: invalid JSON in batch composer triggers alert', async ({ page }) => {
      // Open batch composer
      await page.click('#batch-open');

      // Put invalid JSON
      await page.fill('#batch-text', 'this is not json');

      // Reset last dialog
      lastDialogMessage = null;

      // Click Run Batch - should trigger alert('Invalid JSON')
      await page.click('#run-batch');

      expect(lastDialogMessage).toContain('Invalid JSON');
    });
  });

  test.describe('Recording Sequence (S3_RecordingSequence)', () => {
    test('StartRecordingSequence: toggle recording and ensure sequence is recorded', async ({ page }) => {
      // Ensure sequence list is initially empty
      const initialCount = await page.locator('#sequence-list li').count();

      // Toggle recording on
      await page.click('#record-toggle');
      await expect(page.locator('#record-toggle')).toHaveText('Stop Recording Sequence');

      // Send a request so the recording mechanism appends a step
      await page.selectOption('#req-method', 'GET');
      await page.fill('#req-url', '/todos');
      await page.click('#send-request');

      // Wait a short moment for sequence to render
      await page.waitForTimeout(200);

      const afterCount = await page.locator('#sequence-list li').count();
      expect(afterCount).toBeGreaterThanOrEqual(initialCount + 1);

      // Toggle recording off for cleanup
      await page.click('#record-toggle');
      await expect(page.locator('#record-toggle')).toHaveText('Start Recording Sequence');
    });

    test('Play and clear sequence - add step and run/playback', async ({ page }) => {
      // Add a conditional step via UI inputs
      await page.fill('#seq-cond', 'true'); // always true
      await page.fill('#seq-req', '{"method":"GET","url":"/todos"}');
      await page.click('#add-seq-step');

      // Ensure step added
      const stepCount = await page.locator('#sequence-list li').count();
      expect(stepCount).toBeGreaterThanOrEqual(1);

      // Play sequence - this should execute the saved request(s) and update res-status/res-body
      await page.click('#play-sequence');
      await page.waitForTimeout(200);

      const status = await page.locator('#res-status').innerText();
      expect(Number(status)).toBeGreaterThanOrEqual(200);

      // Clear sequence
      await page.click('#clear-sequence');
      const cleared = await page.locator('#sequence-list li').count();
      expect(cleared).toBe(0);
    });
  });

  test.describe('Presets (S4_PresetSaved and LoadPreset)', () => {
    test('SavePreset and LoadPreset: save current builder state and load it', async ({ page }) => {
      // Prepare a distinctive request builder state
      await page.selectOption('#req-method', 'POST');
      await page.fill('#req-url', '/users');
      await page.fill('#req-body', JSON.stringify({ name: 'TestUser' }));

      // Save preset
      await page.click('#save-preset');

      // Load presets UI
      await page.click('#load-preset');

      // There should be at least one preset listed with a Load button
      const presetItems = page.locator('#presets-list li');
      await expect(presetItems).toHaveCountGreaterThan(0);
      const loadButton = presetItems.locator('button', { hasText: 'Load' });
      await expect(loadButton).toHaveCountGreaterThan(0);

      // Click the first Load button to restore fields
      await loadButton.first().click();

      // url and method should match the saved preset
      await expect(page.locator('#req-method')).toHaveValue('POST');
      await expect(page.locator('#req-url')).toHaveValue('/users');
      const bodyText = await page.locator('#req-body').innerText();
      expect(bodyText).toContain('TestUser');
    });
  });

  test.describe('History management (S5_HistoryCleared)', () => {
    test('ClearHistory: should clear the recent requests history', async ({ page }) => {
      // Make sure there is at least one history item by sending a request
      await page.selectOption('#req-method', 'GET');
      await page.fill('#req-url', '/todos');
      await page.click('#send-request');

      // Ensure history has entries
      await expect(page.locator('#history-list li')).toHaveCountGreaterThan(0);

      // Click clear history - this triggers clearing and localStorage change
      await page.click('#clear-history');

      // history list should be empty
      await expect(page.locator('#history-list li')).toHaveCount(0);
    });
  });

  test.describe('Server controls, tokens and custom routes', () => {
    test('Server mode change to maintenance results in 503 responses, restart recovers', async ({ page }) => {
      // Set server mode to maintenance
      await page.selectOption('#server-mode', 'maintenance');
      // Confirm UI updated
      await expect(page.locator('#server-state')).toHaveText('maintenance');

      // Send a request; the server should respond with 503 as per code
      await page.selectOption('#req-method', 'GET');
      await page.fill('#req-url', '/todos');
      await page.click('#send-request');

      // Expect 503
      await expect(page.locator('#res-status')).toHaveText('503');

      // Restart server via button
      await page.click('#restart-server');
      await expect(page.locator('#server-state')).toHaveText('normal');

      // Send again and expect success
      await page.click('#send-request');
      await expect(page.locator('#res-status')).not.toHaveText('503');
    });

    test('Issue token and token list reflect issued token', async ({ page }) => {
      // Click issue token button
      await page.click('#issue-token');

      // Token list should have at least one item
      const tokens = page.locator('#token-list li');
      await expect(tokens).toHaveCountGreaterThan(0);

      // The token text should contain 'tkn_'
      const tokenText = await tokens.first().innerText();
      expect(tokenText).toContain('tkn_');
    });

    test('Custom route: add a route and get expected templated response', async ({ page }) => {
      // Add a custom route: GET /greet/:name -> status 200 and template
      await page.selectOption('#custom-method', 'GET');
      await page.fill('#custom-path', '/greet/:name');
      await page.fill('#custom-status', '200');
      await page.fill('#custom-template', '{ "msg": "Hello {{param.name}}", "q": "{{query.q}}" }');

      await page.click('#add-custom-route');

      // Confirm route added to UI list
      await expect(page.locator('#custom-routes li')).toHaveCountGreaterThan(0);

      // Call the custom route via Request Builder
      await page.selectOption('#req-method', 'GET');
      await page.fill('#req-url', '/greet/Playwright?q=hi'); // include query; parseUrlQuery will separate
      await page.click('#send-request');

      // Expect 200 and body to contain the greeting
      await expect(page.locator('#res-status')).toHaveText('200');
      const body = await page.locator('#res-body').innerText();
      expect(body).toContain('Hello Playwright');
      expect(body).toContain('"q": "hi"');
    });
  });
});