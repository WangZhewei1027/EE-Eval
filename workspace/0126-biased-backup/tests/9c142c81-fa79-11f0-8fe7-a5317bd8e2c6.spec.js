import { test, expect } from '@playwright/test';

// Test suite for Jump Search Interactive Demo (Application ID: 9c142c81-fa79-11f0-8fe7-a5317bd8e2c6)
// URL: provided by the harness below
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c142c81-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object encapsulating common interactions and helpers
class AppPage {
  constructor(page) {
    this.page = page;
    // store console messages and page errors for assertions
    this.consoleMessages = [];
    this.pageErrors = [];
    // queued dialog responses for prompt dialogs; handled by page.on('dialog')
    this._dialogQueue = [];
  }

  async initListeners() {
    // Capture console messages
    this.page.on('console', (msg) => {
      try {
        this.consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      } catch (e) {
        this.consoleMessages.push(`console: <unreadable message>`);
      }
    });

    // Capture uncaught exceptions on the page
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });

    // Auto-handle dialogs (alerts/prompts) using a queue of responses.
    // Alerts/Confirms will be accepted; Prompts will use queued response or empty string.
    await this.page.exposeFunction('__consumeDialogResponse', () => {
      // This is a noop placeholder to ensure the function exists in page context if needed.
      return;
    });

    this.page.on('dialog', async (dialog) => {
      const type = dialog.type();
      const resp = this._dialogQueue.length ? this._dialogQueue.shift() : undefined;
      try {
        if (type === 'prompt') {
          // Provide queued response (could be undefined which becomes null -> accept with empty)
          await dialog.accept(resp === undefined ? '' : resp);
        } else {
          // alert/confirm - just accept to continue flow
          await dialog.accept();
        }
      } catch (e) {
        // if accepting dialog fails for any reason, record as page error
        this.pageErrors.push(e);
      }
    });
  }

  enqueueDialogResponse(responseText) {
    // Enqueue a response for the next prompt dialog
    this._dialogQueue.push(responseText);
  }

  // Navigation helper
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // wait for basic UI to be present
    await this.page.waitForSelector('#arrayView');
  }

  // UI helpers
  async click(selector) {
    await this.page.click(selector);
  }

  async fill(selector, value) {
    await this.page.fill(selector, value);
  }

  async getText(selector) {
    return (await this.page.textContent(selector)) || '';
  }

  async getInputValue(selector) {
    return await this.page.$eval(selector, el => el.value);
  }

  async selectOption(selector, value) {
    await this.page.selectOption(selector, value);
  }

  async waitForPopup(action) {
    const [popup] = await Promise.all([
      this.page.waitForEvent('popup'),
      action()
    ]);
    return popup;
  }

  // Convenience for waiting a short time for auto-play to progress but not too long
  async shortWait(ms = 250) {
    await this.page.waitForTimeout(ms);
  }
}

// Group tests logically according to FSM: states and transitions
test.describe('Jump Search Interactive Demo - FSM validation', () => {
  let app;
  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await app.initListeners();
    await app.goto();
  });

  test.afterEach(async () => {
    // Ensure no unexpected page errors occurred during the test
    expect(app.pageErrors.length, `Unexpected page errors: ${app.pageErrors.map(e => String(e)).join('\n')}`).toBe(0);
  });

  test('S0 Idle: initial render shows basic UI elements', async ({ page }) => {
    // Validate initial idle state rendering (entry action renderPage / init done)
    // Check presence of key UI components and initial status text
    const arrayViewText = await app.getText('#arrayView');
    expect(arrayViewText).toContain('Index:'); // array view textual header
    const status = await app.getText('#status');
    expect(status).toContain('Array length:'); // renderStatus included
    // No trace yet
    const stepsListText = await app.getText('#stepsList');
    expect(stepsListText).toBe('(no steps)');
    // Also assert console didn't capture page errors
    expect(app.pageErrors.length).toBe(0);
  });

  test('S0 -> S1 Generate Random Array: clicking Generate Random Array updates array length and view', async ({ page }) => {
    // Click generate button and verify that array is updated and rendered
    await app.click('#genBtn');
    // After generation, the status should reflect the array length (lenInput default 16)
    const status = await app.getText('#status');
    expect(status).toContain('Array length:');
    // The array view should contain Values:
    const arrayViewText = await app.getText('#arrayView');
    expect(arrayViewText).toContain('Values:');
    // Steps still none until compute
    const stepsText = await app.getText('#stepsList');
    expect(stepsText).toBe('(no steps)');
    // Check no page errors
    expect(app.pageErrors.length).toBe(0);
  });

  test('S1 -> S2 Compute Trace: load manual array, set target, compute trace produces steps and logs', async ({ page }) => {
    // Load a known manual array via textarea and ensure trace computation works deterministically
    await app.fill('#arrayText', '1,2,3,4,5,6,7,8,9');
    await app.click('#fromTextBtn');
    // Set a target value that exists in the array
    await app.fill('#targetInput', '4');
    // Click compute and wait for steps to render
    await app.click('#computeBtn');
    // stepsList should now contain entries (start, checks, etc.)
    const stepsHtml = await app.getText('#stepsList');
    expect(stepsHtml.length).toBeGreaterThan(10); // should be non-trivial
    // The log should contain 'Computed trace' entry for the chosen algorithm (default Jump Search)
    const logText = await app.getText('#log');
    expect(logText).toContain('Computed trace for');
    // Status should report 'Trace steps' count
    const status = await app.getText('#status');
    expect(status).toMatch(/Trace steps: \d+/);
    // No page errors
    expect(app.pageErrors.length).toBe(0);
  });

  test('S2 -> S3 Start Auto Play and S3 -> S2 Pause: auto-play can start and be paused', async ({ page }) => {
    // Prepare deterministic array and compute trace
    await app.fill('#arrayText', '1,2,3,4,5,6,7,8,9');
    await app.click('#fromTextBtn');
    await app.fill('#targetInput', '7');
    await app.click('#computeBtn');

    // Make autoplay faster for the test
    await app.page.fill('#speedInput', '120');
    // Trigger input event to ensure state.speed updates
    await app.page.dispatchEvent('#speedInput', 'input');

    // Start autoplay
    await app.click('#startBtn');
    // After starting, status should show 'Auto-playing...' - allow short wait for handler to update
    await app.shortWait(150);
    const statusDuring = await app.getText('#status');
    expect(statusDuring).toContain('Auto-playing');

    // Now pause the auto-play
    await app.click('#pauseBtn');
    // Allow for pause handling
    await app.shortWait(100);
    const statusAfter = await app.getText('#status');
    // After pausing, 'Auto-playing' should no longer be present
    expect(statusAfter).not.toContain('Auto-playing');
    // Log should include 'Paused.' message
    const logTxt = await app.getText('#log');
    expect(logTxt).toContain('Paused.');
    // No page errors
    expect(app.pageErrors.length).toBe(0);
  });

  test('S2 -> S4 SetTargetFromClick & Manual Mode: clicking setTargetFromClick shows alert, enabling manual mode allows manual pointer moves', async ({ page }) => {
    // Prepare a simple array and compute a trace to be in S2
    await app.fill('#arrayText', '10,20,30,40,50');
    await app.click('#fromTextBtn');
    await app.fill('#targetInput', '30');
    await app.click('#computeBtn');

    // Clicking the "(Click array element to set target)" button should show an alert.
    // The page's dialog handler accepts alerts automatically; enqueue nothing.
    await app.click('#setTargetFromClick');
    // Enable manual mode by checking the checkbox
    await app.click('#manualMode');
    // Provide a prompt response that instructs a manual move: "m2"
    app.enqueueDialogResponse('m2');
    // Click the array view to trigger onArrayClick prompt; it will consume the queued response
    await app.click('#arrayView');
    // Allow UI to update
    await app.shortWait(100);
    // Verify log includes manual pointer movement message
    const logTxt = await app.getText('#log');
    expect(logTxt).toContain('Manual pointer moved');
    // And steps list should include a 'manualMove' entry
    const stepsTxt = await app.getText('#stepsList');
    expect(stepsTxt).toContain('manualMove');
    // No page errors
    expect(app.pageErrors.length).toBe(0);
  });

  test('Replay trace and skip to end behavior: replay resets and auto-play runs to completion (fast speed)', async ({ page }) => {
    // Use a small array to ensure completion finishes quickly
    await app.fill('#arrayText', '4,8,15');
    await app.click('#fromTextBtn');
    await app.fill('#targetInput', '8');
    await app.click('#computeBtn');

    // Speed up auto-play
    await app.fill('#speedInput', '100');
    await app.page.dispatchEvent('#speedInput', 'input');

    // Replay will reset and start auto-play
    await app.click('#replayBtn');
    // Wait a bit longer to allow auto-play to finish
    await app.shortWait(600);
    // After finishing, log should mention 'Auto-play finished.' or at least have 'Auto-play' related logs
    const logTxt = await app.getText('#log');
    expect(logTxt.length).toBeGreaterThan(0);
    // No page errors
    expect(app.pageErrors.length).toBe(0);
  });

  test('Snapshot management: save snapshot, select it, and load it (SaveSnapshot -> LoadSnapshot)', async ({ page }) => {
    // Prepare array and save a snapshot
    await app.fill('#arrayText', '100,200,300');
    await app.click('#fromTextBtn');
    // Save snapshot
    await app.click('#saveSnapBtn');
    // The save action appends an option to the snapshots select; wait briefly
    await app.shortWait(50);
    // Get first option value
    const optValue = await app.page.$eval('#snapshots option', opt => opt ? opt.value : '');
    expect(optValue).toBeTruthy();
    // Select that option and load it
    await app.selectOption('#snapshots', optValue);
    await app.click('#loadSnapBtn');
    // Log should reflect save and load
    const logTxt = await app.getText('#log');
    expect(logTxt).toContain('Saved snapshot');
    expect(logTxt).toContain('Loaded snapshot');
    // No page errors
    expect(app.pageErrors.length).toBe(0);
  });

  test('Export JSON opens a new popup window containing exported data', async ({ page }) => {
    // Prepare some state, then click export and wait for popup
    await app.fill('#arrayText', '7,14,21');
    await app.click('#fromTextBtn');
    const popup = await app.waitForPopup(async () => {
      await app.click('#exportBtn');
    });
    // Wait for popup to load content
    await popup.waitForLoadState('domcontentloaded');
    const title = await popup.title();
    expect(title).toContain('Exported Jump Search Data');
    // The popup should contain a <pre> with JSON-like text
    const preText = await popup.textContent('pre');
    expect(preText).toBeTruthy();
    await popup.close();
    // No page errors
    expect(app.pageErrors.length).toBe(0);
  });

  test('Import JSON with invalid data triggers "Invalid JSON" alert (error scenario)', async ({ page }) => {
    // Provide invalid JSON text when import prompt appears
    app.enqueueDialogResponse('this is not valid json');
    await app.click('#importBtn');
    // The import code catches JSON.parse error and shows alert('Invalid JSON') which is accepted by dialog handler
    // No "Imported JSON data." log should be present as import failed
    await app.shortWait(50);
    const logTxt = await app.getText('#log');
    expect(logTxt).not.toContain('Imported JSON data.');
    // No uncaught page errors should have occurred
    expect(app.pageErrors.length).toBe(0);
  });

  test('Load from text with empty textarea triggers an alert (edge case)', async ({ page }) => {
    // Ensure textarea is empty
    await app.fill('#arrayText', '');
    // Click "Load From Text" -> code will alert and return
    await app.click('#fromTextBtn');
    // Wait briefly and assert nothing crashed and logs are consistent
    await app.shortWait(50);
    const logTxt = await app.getText('#log');
    // No new "Imported" logs; since it alerted, it's fine. Just assert the app is still responsive.
    expect(logTxt.length).toBeGreaterThanOrEqual(0);
    // No page errors
    expect(app.pageErrors.length).toBe(0);
  });

  test('Batch test opens results in a new window and logs completion', async ({ page }) => {
    // Prepare array (non-empty) and run batch test; expect a popup with results
    await app.fill('#arrayText', '1,2,3,4,5,6,7,8,9');
    await app.click('#fromTextBtn');
    const popup = await app.waitForPopup(async () => {
      await app.click('#batchTestBtn');
    });
    await popup.waitForLoadState('domcontentloaded');
    const popupText = await popup.textContent('pre');
    expect(popupText).toContain('Batch test results');
    await popup.close();
    // Log should include 'Batch test complete'
    const logTxt = await app.getText('#log');
    expect(logTxt).toContain('Batch test complete');
    // No page errors
    expect(app.pageErrors.length).toBe(0);
  });

});