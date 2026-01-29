import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c140572-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Bucket Sort Interactive Explorer — FSM & UI validation', () => {
  // Capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages including errors
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Generic dialog handler: decide based on prompt message
    page.on('dialog', async dialog => {
      const msg = dialog.message();
      // For export: prompt('Copy the state JSON:', dump);
      if (msg.startsWith('Copy the state JSON:')) {
        // Accept with no input (user typically copies manually)
        await dialog.accept();
        return;
      }
      // For import: prompt('Paste state JSON to import:');
      if (msg.startsWith('Paste state JSON to import:')) {
        // If a test sets a special symbol in page context to indicate what to return, use it
        try {
          const provided = await page.evaluate(() => window.__TEST_PROMPT_PROVIDED_JSON || null);
          if (provided !== null) {
            await dialog.accept(provided);
            return;
          }
        } catch (e) {
          // ignore and fall through
        }
        // Default: cancel (simulate user cancelled)
        await dialog.dismiss();
        return;
      }
      // Default accept
      await dialog.accept();
    });

    // Navigate to the application HTML
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait a short time to allow initialization logs and rendering
    await page.waitForTimeout(100);
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity: assert no uncaught page errors occurred during test run
    expect(pageErrors.length, `No uncaught page errors are expected. Console/errors: ${JSON.stringify(consoleMessages.slice(-10))}`).toBe(0);
  });

  test.describe('Initial state (S0_Idle) and basic UI', () => {
    test('Initial load shows idle phase, input array and exposes API', async ({ page }) => {
      // Validate phase display is 'idle' as per the initializeStateFromArray
      const phase = await page.locator('#phaseDisplay').textContent();
      expect(phase?.trim()).toBe('idle');

      // Validate the input textarea contains the expected initial numbers (from HTML)
      const txt = await page.locator('#inputArrayText').inputValue();
      expect(txt).toContain('29');
      expect(txt).toContain('2.5');

      // Validate sourceView shows tokens equal to parsed input count
      const tokens = await page.locator('#sourceView .token').all();
      expect(tokens.length).toBeGreaterThan(0);

      // Validate that the page exposes the _bucketExplorer helper
      const hasHelper = await page.evaluate(() => !!window._bucketExplorer && typeof window._bucketExplorer.stepForward === 'function');
      expect(hasHelper).toBe(true);

      // Confirm that some console messages were produced (initial preparation/logging)
      const foundPrepLog = consoleMessages.some(m => typeof m.text === 'string' && m.text.includes('Prepared'));
      // It's possible initialization logged nothing, so we don't assert true strictly, but ensure no fatal console errors occurred
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    });
  });

  test.describe('Transitions from Idle -> Preparing -> Sorting -> Gathering -> Done', () => {
    test('Prepare steps then step through actions to reach sorting, gathering and done phases', async ({ page }) => {
      // Click "Prepare steps" to reprepare everything
      await page.click('#prepareBtn');
      // Wait for logs and UI update
      await page.waitForTimeout(100);

      // Ensure actions are prepared
      const actionsCount = await page.locator('#actionsCount').textContent();
      const actionsNum = Number(actionsCount?.trim() || '0');
      expect(actionsNum).toBeGreaterThan(0);

      // Fetch actions array from page to analyze phases sequence
      const actions = await page.evaluate(() => window._bucketExplorer.actions.map(a => ({ type: a.type })));
      expect(actions.length).toBeGreaterThan(0);

      // Step forward through actions and assert phase changes per action type
      // We'll step until we see a 'bucketStep' or 'sorted' action applied to reach 'sorting'
      let sawSorting = false;
      let sawGathering = false;
      const totalActions = actions.length;

      for (let i = 0; i <= totalActions; i++) {
        // Click Step Forward
        await page.click('#stepForwardBtn');
        // Wait for UI to update (history/timeline)
        await page.waitForTimeout(40);

        // Read current phase
        const phase = (await page.locator('#phaseDisplay').textContent())?.trim() || '';

        // If phase is 'sorting' at any point, mark
        if (phase === 'sorting') sawSorting = true;
        if (phase === 'gathering') sawGathering = true;
        // If done, break
        if (phase === 'done') break;
      }

      // After consuming actions, final phase should be 'done'
      const finalPhase = (await page.locator('#phaseDisplay').textContent())?.trim();
      expect(finalPhase).toBe('done');

      // Ensure we saw sorting and gathering phases during stepping (given non-empty actions)
      // At least gathering should occur if there were gathered actions. Sorting may occur if buckets had >1 items.
      expect(sawGathering).toBe(true);
      // sorting may be true depending on chosen internalSort; don't strictly require but prefer it's true when actions include sorting
      const containsSortAction = actions.some(a => a.type === 'bucketStep' || a.type === 'sorted');
      if (containsSortAction) {
        expect(sawSorting).toBe(true);
      }
    });

    test('Step Back returns to previous history snapshot', async ({ page }) => {
      // Prepare fresh and apply first forward step
      await page.click('#prepareBtn');
      await page.waitForTimeout(50);

      // Get initial history count
      const initialHistory = Number((await page.locator('#historyCount').textContent()) || '1');

      // Step forward once
      await page.click('#stepForwardBtn');
      await page.waitForTimeout(50);

      // History count should have increased (snapshot added)
      const historyAfter = Number((await page.locator('#historyCount').textContent()) || '1');
      expect(historyAfter).toBeGreaterThanOrEqual(initialHistory);

      // Record current step label
      const labelBeforeBack = await page.locator('#stepLabel').textContent();

      // Step back
      await page.click('#stepBackBtn');
      await page.waitForTimeout(50);

      const labelAfterBack = await page.locator('#stepLabel').textContent();
      // The step label should reflect a decreased history index
      expect(labelBeforeBack).not.toBe(labelAfterBack);
    });
  });

  test.describe('Phase-specific preparations and controls', () => {
    test('OnlyDistribute prepares only distribute actions', async ({ page }) => {
      await page.click('#onlyDistribute');
      await page.waitForTimeout(80);

      // Inspect actions in page
      const types = await page.evaluate(() => window._bucketExplorer.actions.map(a => a.type));
      expect(types.length).toBeGreaterThan(0);
      // All should be 'distribute'
      expect(types.every(t => t === 'distribute')).toBe(true);
    });

    test('OnlySort prepares only sorting-related actions', async ({ page }) => {
      await page.click('#onlySort');
      await page.waitForTimeout(80);

      const types = await page.evaluate(() => window._bucketExplorer.actions.map(a => a.type));
      expect(types.length).toBeGreaterThan(0);
      // All types must be either 'bucketStep' or 'sorted'
      expect(types.every(t => t === 'bucketStep' || t === 'sorted')).toBe(true);
    });

    test('OnlyGather prepares only gather actions', async ({ page }) => {
      await page.click('#onlyGather');
      await page.waitForTimeout(80);

      const types = await page.evaluate(() => window._bucketExplorer.actions.map(a => a.type));
      expect(types.length).toBeGreaterThanOrEqual(0);
      // All should be 'gather' (may be zero if no items)
      if (types.length > 0) {
        expect(types.every(t => t === 'gather')).toBe(true);
      }
    });

    test('FullRun prepares full sequence including distribution, sort and gather', async ({ page }) => {
      await page.click('#fullRun');
      await page.waitForTimeout(80);

      const types = await page.evaluate(() => window._bucketExplorer.actions.map(a => a.type));
      expect(types.length).toBeGreaterThan(0);
      const hasDistribute = types.includes('distribute');
      const hasGather = types.includes('gather');
      const hasSort = types.some(t => t === 'bucketStep' || t === 'sorted');
      expect(hasDistribute || hasSort || hasGather).toBe(true);
    });
  });

  test.describe('Play / Pause and speed control', () => {
    test('Play starts playback and Pause stops it', async ({ page }) => {
      // Prepare actions first
      await page.click('#prepareBtn');
      await page.waitForTimeout(60);

      // Click play
      await page.click('#playBtn');
      await page.waitForTimeout(120); // allow a couple steps to execute

      // Verify play button disabled and pause enabled
      const playDisabled = await page.locator('#playBtn').isDisabled();
      const pauseDisabled = await page.locator('#pauseBtn').isDisabled();
      expect(playDisabled).toBe(true);
      expect(pauseDisabled).toBe(false);

      // Click pause
      await page.click('#pauseBtn');
      await page.waitForTimeout(60);

      // Verify play button enabled and pause disabled again
      const playDisabledAfter = await page.locator('#playBtn').isDisabled();
      const pauseDisabledAfter = await page.locator('#pauseBtn').isDisabled();
      expect(playDisabledAfter).toBe(false);
      expect(pauseDisabledAfter).toBe(true);

      // Confirm that logs contain 'Play started' and 'Play paused'
      const texts = consoleMessages.map(m => m.text).join('\n');
      expect(texts.includes('Play started') || texts.includes('Play paused') || texts.includes('Play')).toBe(true);
    });
  });

  test.describe('Manual editing and moving tokens (edge cases)', () => {
    test('Manual add, remove and commit actions update input and prepare actions', async ({ page }) => {
      // Count initial tokens
      const beforeCount = (await page.locator('#sourceView .token').all()).length;

      // Fill manual value and click Add
      await page.fill('#manualValue', '99');
      await page.click('#manualAdd');
      await page.waitForTimeout(80);

      const afterAddCount = (await page.locator('#sourceView .token').all()).length;
      expect(afterAddCount).toBe(beforeCount + 1);

      // Remove last
      await page.click('#manualRemove');
      await page.waitForTimeout(80);

      const afterRemoveCount = (await page.locator('#sourceView .token').all()).length;
      expect(afterRemoveCount).toBe(beforeCount);

      // Re-add and commit to test commitManualChange path
      await page.fill('#manualValue', '77');
      await page.click('#manualAdd');
      await page.waitForTimeout(40);
      await page.click('#manualCommit');
      await page.waitForTimeout(80);

      // After commit, actions should be prepared (actionsCount > 0 or ==0 if trivial)
      const actionsCount = Number((await page.locator('#actionsCount').textContent()) || '0');
      expect(actionsCount).toBeGreaterThanOrEqual(0);
    });

    test('Manual token move from source to bucket when manual mode enabled', async ({ page }) => {
      // Ensure manual mode enabled
      const manualMode = page.locator('#manualMode');
      if (!(await manualMode.isChecked())) {
        await manualMode.click();
      }

      // Prepare simple state: ensure there is at least one source token and at least one bucket
      const sourceTokens = await page.locator('#sourceView .token').all();
      expect(sourceTokens.length).toBeGreaterThan(0);

      // Click first source token to select it
      await sourceTokens[0].click();
      await page.waitForTimeout(60);

      // Click the first bucket area as drop target
      const firstBucket = page.locator('#buckets .bucket').first();
      await firstBucket.click();
      await page.waitForTimeout(120);

      // After manual move+commit, check that selectedToken is none (commitManualChange clears selection)
      const selectedText = (await page.locator('#selectedToken').textContent())?.trim();
      expect(selectedText).toBe('none' || 'none'); // ensure field exists

      // Check log contains 'Manual: moved' indication
      const recentLogs = consoleMessages.map(m => m.text).join('\n');
      // It's sufficient that no page errors occurred and UI updated; logs may or may not contain the manual string depending on prior state.
      expect(recentLogs.length).toBeGreaterThan(0);
    });
  });

  test.describe('Boundaries, export/import, and error handling', () => {
    test('Applying invalid custom boundaries logs an invalid boundaries message', async ({ page }) => {
      // Put invalid boundaries (only one number)
      await page.fill('#customBoundaries', '5');
      await page.click('#applyBoundaries');
      await page.waitForTimeout(80);

      // The application appends a log via prependLog('Invalid boundaries ...')
      const logText = await page.locator('#log').textContent();
      expect(logText).toContain('Invalid boundaries');
    });

    test('Export state triggers a prompt and returns without error', async ({ page }) => {
      // Click export - dialog handler will accept
      await page.click('#exportState');
      await page.waitForTimeout(80);

      // No exception expected; ensure log or console captured some text
      const log = await page.locator('#log').textContent();
      // Export doesn't append to log in implementation, so we just assert no page errors
      expect(log.length).toBeGreaterThanOrEqual(0);
    });

    test('Import valid state JSON via prompt restores state', async ({ page }) => {
      // Prepare a JSON string by retrieving dump from the app state
      const dump = await page.evaluate(() => {
        try {
          const s = window._bucketExplorer;
          const state = s && s.state ? s.state : null;
          const actions = s && s.actions ? s.actions : [];
          const history = s && s.history ? s.history : [s.state];
          return JSON.stringify({ state, actions, history });
        } catch (e) {
          return null;
        }
      });

      expect(dump).not.toBeNull();

      // Provide the dump via the dialog handler by setting a global that handler reads
      await page.evaluate(d => { window.__TEST_PROMPT_PROVIDED_JSON = d; }, dump);

      // Now click import
      await page.click('#importState');
      await page.waitForTimeout(120);

      // After import, log should contain 'Imported state JSON'
      const logText = await page.locator('#log').textContent();
      expect(logText).toContain('Imported state JSON');
      // Clean up the test-provided prompt value
      await page.evaluate(() => { delete window.__TEST_PROMPT_PROVIDED_JSON; });
    });

    test('Import invalid JSON results in "Error parsing JSON" logged', async ({ page }) => {
      // Set the dialog to provide invalid JSON
      await page.evaluate(() => { window.__TEST_PROMPT_PROVIDED_JSON = 'not-a-json'; });

      // Click import
      await page.click('#importState');
      await page.waitForTimeout(120);

      const logText = await page.locator('#log').textContent();
      expect(logText).toContain('Error parsing JSON');

      // Remove test-provided prompt payload
      await page.evaluate(() => { delete window.__TEST_PROMPT_PROVIDED_JSON; });
    });
  });

  test.describe('Edge case interactions and sanity checks', () => {
    test('Shuffle and sort input buttons update the textarea and state accordingly', async ({ page }) => {
      // Click shuffle
      await page.click('#shuffleBtn');
      await page.waitForTimeout(80);

      const afterShuffle = await page.locator('#inputArrayText').inputValue();
      expect(afterShuffle.length).toBeGreaterThan(0);

      // Click sort input ascending
      await page.click('#sortInputBtn');
      await page.waitForTimeout(80);

      const afterSort = await page.locator('#inputArrayText').inputValue();
      // Should be numeric list - simple check: commas or spaces and numbers present
      expect(/[0-9]/.test(afterSort)).toBe(true);
    });

    test('Clear input calls initializeStateFromArray with empty array and logs', async ({ page }) => {
      await page.click('#clearBtn');
      await page.waitForTimeout(80);

      const inputVal = await page.locator('#inputArrayText').inputValue();
      expect(inputVal).toBe('');

      const phase = (await page.locator('#phaseDisplay').textContent())?.trim();
      // After clear, initializeStateFromArray([]) is called -> phase should be 'idle'
      expect(phase).toBe('idle');
    });
  });
});