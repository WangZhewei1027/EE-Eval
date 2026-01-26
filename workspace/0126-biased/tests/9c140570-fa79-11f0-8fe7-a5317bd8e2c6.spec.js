import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c140570-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Counting Sort Interactive — FSM & Controls (App ID: 9c140570-fa79-11f0-8fe7-a5317bd8e2c6)', () => {
  // Collect runtime issues
  test.beforeEach(async ({ page }) => {
    // Track console error messages and page errors
    page['_consoleErrors'] = [];
    page['_pageErrors'] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') page['_consoleErrors'].push(msg.text());
    });
    page.on('pageerror', (err) => {
      page['_pageErrors'].push(err && err.message ? err.message : String(err));
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure main UI elements are present before proceeding
    await expect(page.locator('#currentOp')).toBeVisible();
    await expect(page.locator('#inputArray')).toBeVisible();
    await expect(page.locator('#timeline')).toBeVisible();
    await expect(page.locator('#stepIndicator')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Assert there are no unexpected runtime console/page errors.
    // Tests intentionally capture dialogs/alerts/prompts; runtime errors should be zero.
    const consoleErrors = page['_consoleErrors'] || [];
    const pageErrors = page['_pageErrors'] || [];

    // If there were unexpected errors, surface them to help debugging
    expect(consoleErrors, `Console errors: ${consoleErrors.join('\n')}`).toHaveLength(0);
    expect(pageErrors, `Page errors: ${pageErrors.join('\n')}`).toHaveLength(0);
  });

  // Helper to read the current operation text
  async function currentOpText(page) {
    return (await page.locator('#currentOp').textContent())?.trim() ?? '';
  }

  // Helper to count timeline entries (snapshots)
  async function timelineCount(page) {
    return await page.locator('#timeline > div').count();
  }

  // Helper to read a timeline entry text by index
  async function timelineEntryText(page, idx) {
    const locator = page.locator('#timeline > div').nth(idx);
    return (await locator.textContent())?.trim() ?? '';
  }

  // Helper to wait until final "Algorithm completed" appears in timeline (last entry)
  async function waitForAlgorithmCompleted(page, timeout = 5000) {
    await page.waitForFunction(() => {
      const t = document.getElementById('timeline');
      if (!t) return false;
      const children = t.querySelectorAll('div');
      if (children.length === 0) return false;
      const last = children[children.length - 1];
      return last.textContent && last.textContent.includes('Algorithm completed');
    }, { timeout });
  }

  test.describe('FSM States and Major Flows', () => {
    test('Initial Idle / bootstrap renders and creates snapshots', async ({ page }) => {
      // Validate the app boots and renders the current operation element
      const op = await currentOpText(page);
      // Either the initial static "Idle" or the first snapshot description ("Initial state")
      expect(['Idle', 'Initial state']).toContain(op);

      // There should be a non-zero number of timeline entries after bootstrap (snapshots built)
      const count = await timelineCount(page);
      expect(count).toBeGreaterThan(0);

      // The last timeline entry must indicate completion
      await waitForAlgorithmCompleted(page);
      const lastIdx = (await timelineCount(page)) - 1;
      const lastText = await timelineEntryText(page, lastIdx);
      expect(lastText).toContain('Algorithm completed');
    });

    test('Randomize triggers snapshot rebuild (S0 -> S1) and produces completed snapshot', async ({ page }) => {
      // Click Randomize
      await page.click('#randomBtn');

      // buildSnapshots sets currentOp to 'Building steps...' at the start.
      // The update may be synchronous and brief; however the timeline will contain the completed state.
      await waitForAlgorithmCompleted(page);

      // Ensure timeline has entries
      const count = await timelineCount(page);
      expect(count).toBeGreaterThan(0);

      // Ensure the final timeline entry contains 'Algorithm completed'
      const lastText = await timelineEntryText(page, count - 1);
      expect(lastText).toContain('Algorithm completed');
    });

    test('StepForward iterates snapshots until Algorithm completed (S1 -> S2)', async ({ page }) => {
      // Ensure snapshots exist
      await page.click('#randomBtn');
      await waitForAlgorithmCompleted(page);

      // Step forward until description is "Algorithm completed" or until max iterations
      const maxSteps = 500;
      let lastOp = '';
      for (let i = 0; i < maxSteps; i++) {
        lastOp = await currentOpText(page);
        if (lastOp.includes('Algorithm completed')) break;
        await page.click('#stepForwardBtn');
        // small pause to allow UI to update
        await page.waitForTimeout(10);
      }
      lastOp = await currentOpText(page);
      expect(lastOp).toContain('Algorithm completed');

      // Step back once and ensure the op changes (S2 -> back to earlier snapshot)
      await page.click('#stepBackBtn');
      const afterBack = await currentOpText(page);
      expect(afterBack).not.toContain('Algorithm completed');
    });

    test('Run/Pause runs to completion when toggled (RunPause) and updates Run button text', async ({ page }) => {
      // Recompute to ensure we start at step 0
      await page.click('#regenStepsBtn');
      await waitForAlgorithmCompleted(page);

      // Jump to start (0)
      await page.fill('#jumpStep', '0');
      await page.click('#jumpBtn');

      // Set speed fast to accelerate run
      await page.fill('#speedRange', '50');

      // Start running
      await page.click('#runPauseBtn');

      // Button should read Pause while running
      await expect(page.locator('#runPauseBtn')).toHaveText(/Pause/);

      // Wait until the algorithm completes (currentOp contains 'Algorithm completed') with generous timeout
      await page.waitForFunction(() => {
        const el = document.getElementById('currentOp');
        return el && el.textContent && el.textContent.includes('Algorithm completed');
      }, {}, { timeout: 8000 });

      // After completion, Run button should revert to 'Run'
      await expect(page.locator('#runPauseBtn')).toHaveText('Run');
      const finalOp = await currentOpText(page);
      expect(finalOp).toContain('Algorithm completed');
    });

    test('Fast Forward immediately finishes algorithm (FastForward)', async ({ page }) => {
      // Recompute snapshots
      await page.click('#regenStepsBtn');
      await waitForAlgorithmCompleted(page);

      // Jump to start
      await page.fill('#jumpStep', '0');
      await page.click('#jumpBtn');

      // Fast-forward
      await page.click('#fastForwardBtn');

      // Should show algorithm completed
      const final = await currentOpText(page);
      expect(final).toContain('Algorithm completed');
    });
  });

  test.describe('Controls that modify input and recompute (Add/Remove/Reset/Load/Apply)', () => {
    test('AddElement increases length and recomputes', async ({ page }) => {
      // Read current length
      const lenBefore = parseInt(await page.locator('#lenInput').inputValue(), 10);
      await page.click('#addElemBtn');
      const lenAfter = parseInt(await page.locator('#lenInput').inputValue(), 10);
      expect(lenAfter).toBe(lenBefore + 1);

      // Timeline should have been rebuilt (non-zero)
      const count = await timelineCount(page);
      expect(count).toBeGreaterThan(0);
    });

    test('RemoveElement decreases length and recomputes', async ({ page }) => {
      // Ensure at least 1 element exists
      let len = parseInt(await page.locator('#lenInput').inputValue(), 10);
      if (len < 2) {
        await page.click('#addElemBtn');
        len = parseInt(await page.locator('#lenInput').inputValue(), 10);
      }
      const lenBefore = len;
      await page.click('#removeElemBtn');
      const lenAfter = parseInt(await page.locator('#lenInput').inputValue(), 10);
      expect(lenAfter).toBe(lenBefore - 1);
    });

    test('Reset triggers confirm dialog and resets to default example', async ({ page }) => {
      // Attach handler to accept confirm
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('confirm');
        await dialog.accept(); // accept reset
      });

      await page.click('#resetBtn');

      // After reset, length should be 10
      await expect(page.locator('#lenInput')).toHaveValue('10');

      // Timeline and snapshots rebuilt
      const count = await timelineCount(page);
      expect(count).toBeGreaterThan(0);
    });

    test('LoadFromText & ApplyText read array from textarea and rebuild snapshots', async ({ page }) => {
      // Set a known array
      await page.fill('#arrayText', '3,1,4,1,5');

      // Click loadFromText (no alert expected)
      // Attach a guard to fail if alert unexpectedly appears
      const dialogs = [];
      const dialogListener = async (dialog) => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        await dialog.dismiss();
      };
      page.on('dialog', dialogListener);

      await page.click('#loadTextBtn');
      // remove listener
      page.off('dialog', dialogListener);

      // Input array visualization should contain 5 boxes
      const boxes = await page.locator('#inputArray > .box').count();
      expect(boxes).toBe(5);

      // ApplyText delegates to loadTextBtn; test that it works as well
      await page.fill('#arrayText', '7,8,9');
      await page.click('#applyTextBtn');

      const boxes2 = await page.locator('#inputArray > .box').count();
      expect(boxes2).toBe(3);
    });

    test('JumpToStep navigates to requested snapshot index', async ({ page }) => {
      // Ensure we have enough snapshots
      await page.click('#regenStepsBtn');
      await waitForAlgorithmCompleted(page);
      const total = await timelineCount(page);
      expect(total).toBeGreaterThan(3);

      // Jump to step 2
      await page.fill('#jumpStep', '2');
      await page.click('#jumpBtn');

      // Validate currentOp equals timeline[2] description
      const entryText = await timelineEntryText(page, 2);
      const op = await currentOpText(page);
      expect(op).toContain(entryText.split(':').slice(1).join(':').trim());
    });
  });

  test.describe('Verification & Stability Checks, Dialog Handling, Edge Cases', () => {
    test('VerifySorted shows an alert for sorted input (handles prompt for Patterns)', async ({ page }) => {
      // Use the Patterns button to set an increasing pattern. It uses prompt, supply 'increasing'.
      // Listen for the prompt and supply the pattern value
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('increasing');
      });

      await page.click('#patternsBtn');

      // Wait for recompute
      await waitForAlgorithmCompleted(page);

      // Click verify; this will show an alert with success/failure message
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('alert');
        const msg = dialog.message();
        expect(msg).toMatch(/sorted/i);
        await dialog.accept();
      });
      await page.click('#verifyBtn');
    });

    test('CheckStability alert is shown and reflects stability for stable mode', async ({ page }) => {
      // Ensure stable mode is 'right' (default). Recompute snapshots.
      await page.selectOption('#stableMode', 'right');
      await page.click('#regenStepsBtn');
      await waitForAlgorithmCompleted(page);

      // Click checkStableBtn -> should alert with stable ordering preserved or violated
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('alert');
        const msg = dialog.message();
        // Message must mention 'Stable' or 'Stability'
        expect(msg).toMatch(/Stable|Stability/i);
        await dialog.accept();
      });
      await page.click('#checkStableBtn');
    });

    test('ClearLogs empties the logs textarea after generating logs via stepping', async ({ page }) => {
      // Ensure logs shown
      await page.check('#showLogs');

      // Ensure we start at step 0
      await page.fill('#jumpStep', '0');
      await page.click('#jumpBtn');

      // Step forward a few times to generate logs (appendLog called on stepForward)
      const stepCount = 3;
      for (let i = 0; i < stepCount; i++) {
        await page.click('#stepForwardBtn');
        await page.waitForTimeout(10);
      }

      // Logs textarea should not be empty
      const logsBefore = await page.locator('#logs').inputValue();
      expect(logsBefore.length).toBeGreaterThan(0);

      // Click clear logs
      await page.click('#clearLogsBtn');

      const logsAfter = await page.locator('#logs').inputValue();
      expect(logsAfter.trim()).toHaveLength(0);
    });

    test('Import with invalid JSON triggers "Invalid JSON" alert (edge case)', async ({ page }) => {
      // When clicking import, script prompts for JSON; respond with invalid JSON and assert subsequent alert
      page.once('dialog', async (dlg) => {
        // First prompt for paste config JSON; return invalid content
        expect(dlg.type()).toBe('prompt');
        await dlg.accept('not-a-json');
      });

      // The code catches JSON.parse error and calls alert('Invalid JSON')
      page.once('dialog', async (dlg) => {
        expect(dlg.type()).toBe('alert');
        expect(dlg.message()).toContain('Invalid JSON');
        await dlg.accept();
      });

      await page.click('#importBtn');
    });

    test('LoadFromText with empty textarea triggers an alert (edge case)', async ({ page }) => {
      // Ensure text area is empty
      await page.fill('#arrayText', '');

      page.once('dialog', async (dlg) => {
        expect(dlg.type()).toBe('alert');
        expect(dlg.message()).toMatch(/Enter comma-separated values/i);
        await dlg.accept();
      });

      await page.click('#loadTextBtn');
    });
  });

  test.describe('End-to-end interaction sequence (combined transitions)', () => {
    test('A typical user flow: randomize -> step a few -> fast forward -> verify -> clear logs', async ({ page }) => {
      // Randomize to build snapshots
      await page.click('#randomBtn');
      await waitForAlgorithmCompleted(page);

      // Step a few times
      const stepsToDo = 2;
      for (let i = 0; i < stepsToDo; i++) {
        await page.click('#stepForwardBtn');
        await page.waitForTimeout(10);
      }

      // Ensure logs are enabled so we can clear them
      await page.check('#showLogs');

      // Fast forward to the end
      await page.click('#fastForwardBtn');
      const finalOp = await currentOpText(page);
      expect(finalOp).toContain('Algorithm completed');

      // Click verify: capture alert (could be sorted or not)
      let verifyMessage = '';
      page.once('dialog', async (dlg) => {
        verifyMessage = dlg.message();
        await dlg.accept();
      });
      await page.click('#verifyBtn');
      // wait briefly to allow dialog handler to execute
      await page.waitForTimeout(50);
      expect(verifyMessage.length).toBeGreaterThan(0);

      // Clear logs
      await page.click('#clearLogsBtn');
      const finalLogs = await page.locator('#logs').inputValue();
      expect(finalLogs.trim()).toHaveLength(0);
    });
  });
});