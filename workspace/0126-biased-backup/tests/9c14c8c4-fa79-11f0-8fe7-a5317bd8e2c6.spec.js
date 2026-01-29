import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c14c8c4-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Sliding Window Maximum - Interactive Demo (FSM validation)', () => {
  // Common fixtures: capture console messages, page errors and dialog interactions.
  test.beforeEach(async ({ page }) => {
    // Arrays to store runtime observations for assertions
    page.context()._consoleMessages = [];
    page.context()._pageErrors = [];
    page.context()._dialogs = [];
    page.context()._promptResponses = [];

    page.on('console', msg => {
      page.context()._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      page.context()._pageErrors.push(err.message);
    });

    // Global dialog handler: supports queued prompt responses from tests
    page.on('dialog', async dialog => {
      page.context()._dialogs.push({ type: dialog.type(), message: dialog.message() });
      if (dialog.type() === 'prompt') {
        // If test queued a response, use it; otherwise accept with empty string
        const resp = page.context()._promptResponses.shift() ?? '';
        await dialog.accept(resp);
      } else {
        await dialog.accept();
      }
    });

    await page.goto(APP_URL);
    // Ensure page script had time to initialize
    await page.waitForSelector('#arrayView');
  });

  test.afterEach(async ({ page }) => {
    // Assert there were no uncaught page errors during each test
    const pageErrors = page.context()._pageErrors;
    expect(pageErrors).toEqual([]);
  });

  test.describe('Initial state and basic rendering', () => {
    test('initial idle -> S0_Idle rendering and exposed state', async ({ page }) => {
      // Validate that initial render shows the array and state is exposed on window
      const arrayView = await page.locator('#arrayView').innerText();
      expect(arrayView).toContain('Array:');
      // Check that window._slidingWindowState exists and holds expected defaults
      const state = await page.evaluate(() => {
        return {
          exists: !!window._slidingWindowState,
          arr: window._slidingWindowState ? window._slidingWindowState.arr.slice() : null,
          k: window._slidingWindowState ? window._slidingWindowState.k : null
        };
      });
      expect(state.exists).toBe(true);
      // From HTML initial input: "9, 11, 8, 5, 7, 10, 6"
      expect(state.arr).toEqual([9,11,8,5,7,10,6]);
      expect(state.k).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Array load/clear/randomize and edits (S1, S2, S3, S4, S5, S6)', () => {
    test('LoadArray transitions to Array Loaded (S1_ArrayLoaded)', async ({ page }) => {
      // Replace array input and click Load Array, then verify internal state and DOM
      await page.fill('#arrayInput', '1,2,3,4');
      await page.click('#loadArray');
      const arr = await page.evaluate(() => window._slidingWindowState.arr.slice());
      expect(arr).toEqual([1,2,3,4]);
      const arrayView = await page.locator('#arrayView').innerText();
      expect(arrayView).toContain('[0] 1');
      expect(arrayView).toContain('[3] 4');
    });

    test('ClearArray transitions to Array Cleared (S2_ArrayCleared)', async ({ page }) => {
      // Ensure some array then clear
      await page.fill('#arrayInput', '5 6 7');
      await page.click('#loadArray');
      await page.click('#clearArray');
      const arr = await page.evaluate(() => window._slidingWindowState.arr.slice());
      expect(arr).toEqual([]);
      // k should be clamped to 1 as per evidence
      const k = await page.evaluate(() => window._slidingWindowState.k);
      expect(k).toBe(1);
      const viewText = await page.locator('#arrayView').innerText();
      expect(viewText).toContain('(empty array)');
    });

    test('RandomizeArray creates an array within bounds (S3_ArrayRandomized)', async ({ page }) => {
      // Provide a seed for deterministic behavior and check sizes
      await page.fill('#randomSize', '7');
      await page.fill('#randomMin', '10');
      await page.fill('#randomMax', '15');
      await page.fill('#randomSeed', 'seed123');
      await page.click('#randomize');
      const arr = await page.evaluate(() => window._slidingWindowState.arr.slice());
      expect(arr.length).toBe(7);
      for (const v of arr) {
        expect(v).toBeGreaterThanOrEqual(10);
        expect(v).toBeLessThanOrEqual(15);
      }
    });

    test('Append, Prepend and Insert update array correctly (S4_ValueAppended, S5_ValuePrepended, S6_ValueInserted)', async ({ page }) => {
      // Start with known array
      await page.fill('#arrayInput', '10,20,30');
      await page.click('#loadArray');

      // Append 42
      await page.fill('#appendValue', '42');
      await page.click('#appendBtn');
      let arr = await page.evaluate(() => window._slidingWindowState.arr.slice());
      expect(arr[arr.length-1]).toBe(42);

      // Prepend 7
      await page.fill('#prependValue', '7');
      await page.click('#prependBtn');
      arr = await page.evaluate(() => window._slidingWindowState.arr.slice());
      expect(arr[0]).toBe(7);

      // Insert at index 1 value 99
      await page.fill('#insertIndex', '1');
      await page.fill('#insertValue', '99');
      await page.click('#insertBtn');
      arr = await page.evaluate(() => window._slidingWindowState.arr.slice());
      expect(arr[1]).toBe(99);

      // Edge case: insert with empty value should do nothing
      const before = await page.evaluate(() => window._slidingWindowState.arr.slice());
      await page.fill('#insertIndex', '0');
      await page.fill('#insertValue', '');
      await page.click('#insertBtn');
      const after = await page.evaluate(() => window._slidingWindowState.arr.slice());
      expect(after).toEqual(before);
    });
  });

  test.describe('Run, reset, stepping and play (S7, S8, S9, S10, S11)', () => {
    test('Run Full sets stepIndex to end and Reset resets run (S7_RunFull -> S8_ResetRun)', async ({ page }) => {
      // Load an array and run full
      await page.fill('#arrayInput', '1,3,2,5,4');
      await page.click('#loadArray');
      // Ensure we have computed trace
      await page.click('#runFull');
      const indices = await page.evaluate(() => ({ stepIndex: window._slidingWindowState.stepIndex, traceLen: window._slidingWindowState.trace.length }));
      expect(indices.traceLen).toBeGreaterThan(0);
      expect(indices.stepIndex).toBe(indices.traceLen - 1);

      // Reset run should set stepIndex to 0
      await page.click('#resetRun');
      const si = await page.evaluate(() => window._slidingWindowState.stepIndex);
      expect(si).toBe(0);
    });

    test('Step Back and Step Forward adjust stepIndex correctly (S9_StepBack, S10_StepForward)', async ({ page }) => {
      await page.fill('#arrayInput', '4,1,3,2,9');
      await page.click('#loadArray');
      await page.click('#runFull');
      const traceLen = await page.evaluate(() => window._slidingWindowState.trace.length);
      expect(traceLen).toBeGreaterThan(0);

      // Step back should decrement (but clamp >=0)
      await page.click('#stepBack');
      let stepIndex = await page.evaluate(() => window._slidingWindowState.stepIndex);
      // After runFull we were at end; stepping back should move one step earlier
      expect(stepIndex).toBe(traceLen - 2);

      // Step forward moves toward the end
      await page.click('#stepForward');
      stepIndex = await page.evaluate(() => window._slidingWindowState.stepIndex);
      expect(stepIndex).toBe(traceLen - 1);

      // Step back repeatedly should not go below 0
      for (let i = 0; i < 10; i++) await page.click('#stepBack');
      stepIndex = await page.evaluate(() => window._slidingWindowState.stepIndex);
      expect(stepIndex).toBeGreaterThanOrEqual(0);
    });

    test('Play toggles playing state and button text (S11_Playing)', async ({ page }) => {
      // Ensure there is a trace to play
      await page.fill('#arrayInput', '1,2,3,4,5,6');
      await page.click('#loadArray');
      await page.click('#runFull');
      // Set speed low for quick play
      await page.fill('#speed', '50');
      await page.click('#playPause'); // should start playing
      // Wait briefly to let play() schedule
      await page.waitForTimeout(120);
      let playing = await page.evaluate(() => window._slidingWindowState.playing === true);
      expect(playing).toBe(true);
      const btnText = await page.locator('#playPause').innerText();
      expect(btnText.toLowerCase()).toContain('pause');
      // Pause
      await page.click('#playPause');
      playing = await page.evaluate(() => window._slidingWindowState.playing === true);
      expect(playing).toBe(false);
      const btnText2 = await page.locator('#playPause').innerText();
      expect(btnText2.toLowerCase()).toContain('play');
    });
  });

  test.describe('Explain, export/import, and undo/redo (S12, S13, S14, S15, S16)', () => {
    test('Explain Current Step populates explainView (S12_ExplainingStep)', async ({ page }) => {
      await page.fill('#arrayInput', '2,1,4');
      await page.click('#loadArray');
      await page.click('#runFull');
      // Ensure a step exists and then ask for explanation
      await page.click('#stepExplain');
      const explainText = await page.locator('#explainView').innerText();
      expect(explainText.length).toBeGreaterThan(0);
      // Should mention 'Detailed explanation' for deque algorithm by default
      expect(explainText.toLowerCase()).toContain('detailed');
    });

    test('Export Snapshot opens a popup with JSON (S13_SnapshotExported)', async ({ page }) => {
      await page.fill('#arrayInput', '7,8,9');
      await page.click('#loadArray');

      // Wait for popup (window.open) and capture the new page
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        page.click('#exportJSON')
      ]);
      // Wait for content in popup to be available and check it contains JSON with "arr"
      await popup.waitForLoadState('domcontentloaded');
      const content = await popup.locator('pre').innerText();
      expect(content).toContain('"arr":');
      await popup.close();
    });

    test('Import Snapshot from JSON updates state (S14_SnapshotImported)', async ({ page }) => {
      // Create snapshot JSON programmatically from current state then import
      await page.fill('#arrayInput', '8,6,4');
      await page.click('#loadArray');
      const snapshot = await page.evaluate(() => {
        return JSON.stringify({
          arr: [11,22,33],
          k: 2,
          ks: [],
          algorithm: 'deque',
          tieBreak: 'right',
          circular: false,
          streaming: false
        }, null, 2);
      });
      await page.fill('#importText', snapshot);
      await page.click('#importJSON');
      // After import, the array should be updated
      const arr = await page.evaluate(() => window._slidingWindowState.arr.slice());
      expect(arr).toEqual([11,22,33]);
      const k = await page.evaluate(() => window._slidingWindowState.k);
      expect(k).toBe(2);
    });

    test('Undo and Redo restore previous snapshots (S15_UndoPerformed, S16_RedoPerformed)', async ({ page }) => {
      // Start from a known array
      await page.fill('#arrayInput', '1,2,3');
      await page.click('#loadArray');
      // Modify array via append
      await page.fill('#appendValue', '999');
      await page.click('#appendBtn');
      let arr = await page.evaluate(() => window._slidingWindowState.arr.slice());
      expect(arr[arr.length-1]).toBe(999);
      // Undo should revert the append
      await page.click('#undoBtn');
      arr = await page.evaluate(() => window._slidingWindowState.arr.slice());
      expect(arr.includes(999)).toBe(false);
      // Redo should reapply the append
      await page.click('#redoBtn');
      arr = await page.evaluate(() => window._slidingWindowState.arr.slice());
      expect(arr[arr.length-1]).toBe(999);
    });
  });

  test.describe('Streaming features and related alerts (S17, S18, S19, S20)', () => {
    test('AddNextElement and RemoveOldest show alerts when streaming disabled and work when enabled', async ({ page }) => {
      // Ensure streaming is disabled initially
      await page.uncheck('#streaming').catch(()=>{});
      // Click Add Next Element - should produce an alert instructing to enable streaming
      await page.click('#streamAdd');
      const dialogs = page.context()._dialogs;
      // There should be at least one dialog recorded and it should mention 'Enable streaming mode'
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length - 1].message.toLowerCase()).toContain('enable streaming mode');

      // Now enable streaming and add a next value
      await page.check('#streaming');
      // Provide a next value and click add
      await page.fill('#nextStreamValue', '55');
      await page.click('#streamAdd');
      let arr = await page.evaluate(() => window._slidingWindowState.arr.slice());
      expect(arr[arr.length - 1]).toBe(55);

      // Remove oldest element should remove first element when streaming enabled
      // Ensure array length >=1 then remove
      const before = await page.evaluate(() => window._slidingWindowState.arr.slice());
      if (before.length === 0) {
        // If empty, add one more
        await page.fill('#nextStreamValue', '7');
        await page.click('#streamAdd');
      }
      const firstBefore = await page.evaluate(() => window._slidingWindowState.arr[0]);
      await page.click('#streamRemove');
      const firstAfter = await page.evaluate(() => window._slidingWindowState.arr[0]);
      // Either array is now shorter or first element changed
      expect(firstAfter === undefined || firstAfter !== firstBefore).toBeTruthy();
    });

    test('Auto Stream starts and stops (S19_AutoStreaming, S20_StreamingStopped)', async ({ page }) => {
      // If streaming disabled, auto stream should alert
      await page.uncheck('#streaming').catch(()=>{});
      await page.click('#streamAuto');
      const dialogs = page.context()._dialogs;
      expect(dialogs[dialogs.length - 1].message.toLowerCase()).toContain('enable streaming mode');

      // Enable streaming and start auto stream with a short interval
      await page.check('#streaming');
      await page.fill('#nextStreamValue', '1,2,3');
      await page.fill('#streamInterval', '60'); // ms
      // Click auto stream and wait for popup of buttons toggled
      await page.click('#streamAuto');
      // After activation, streamAuto button should be disabled and streamStop enabled
      await page.waitForTimeout(80); // allow at least one interval to run
      const streamAutoDisabled = await page.evaluate(() => document.getElementById('streamAuto').disabled);
      const streamStopDisabled = await page.evaluate(() => document.getElementById('streamStop').disabled);
      expect(streamAutoDisabled).toBe(true);
      expect(streamStopDisabled).toBe(false);

      // Stop streaming and ensure buttons toggled back
      await page.click('#streamStop');
      await page.waitForTimeout(20);
      const streamAutoDisabled2 = await page.evaluate(() => document.getElementById('streamAuto').disabled);
      const streamStopDisabled2 = await page.evaluate(() => document.getElementById('streamStop').disabled);
      expect(streamAutoDisabled2).toBe(false);
      expect(streamStopDisabled2).toBe(true);
    }, { timeout: 120000 });
  });

  test.describe('Multi-k features and UI interactions (S21, S22)', () => {
    test('AddMultiK and ClearMultiK update multi-k list', async ({ page }) => {
      // Ensure kInput is set
      await page.fill('#kInput', '3');
      await page.click('#addMultiK');
      let multiText = await page.locator('#multiKList').innerText();
      expect(multiText).toContain('Multi windows');
      expect(multiText).toContain('3');

      // Adding again the same k should not duplicate (per implementation uses includes)
      await page.click('#addMultiK');
      multiText = await page.locator('#multiKList').innerText();
      // Still only one '3' occurrence - a simple check to ensure no empty behavior
      expect(multiText).toContain('3');

      // Clear multi-k
      await page.click('#clearMultiK');
      multiText = await page.locator('#multiKList').innerText();
      expect(multiText.toLowerCase()).toContain('(none)');
    });
  });

  test.describe('Log view interaction, keyboard shortcuts and edge behavior', () => {
    test('Clicking logView triggers prompt to jump to a step and jump occurs', async ({ page }) => {
      // Load array and produce trace
      await page.fill('#arrayInput', '1,2,3,4,5');
      await page.click('#loadArray');
      await page.click('#runFull');
      // Queue a prompt response '0' so the logView click handler will accept and set stepIndex to 0
      page.context()._promptResponses.push('0');
      // Click the log view to cause a prompt
      await page.click('#logView');
      // Wait briefly to allow renderAll
      await page.waitForTimeout(40);
      const stepIndex = await page.evaluate(() => window._slidingWindowState.stepIndex);
      expect(stepIndex).toBe(0);
    });

    test('Keyboard shortcuts: n (next), p (previous) and space (play/pause) respond', async ({ page }) => {
      // Prepare
      await page.fill('#arrayInput', '1,2,3,4,5');
      await page.click('#loadArray');
      await page.click('#runFull');
      // Press 'n' to go next (will clamp at end; so first reset to 0 then test)
      await page.click('#resetRun');
      await page.keyboard.press('n');
      let si = await page.evaluate(() => window._slidingWindowState.stepIndex);
      expect(si).toBeGreaterThanOrEqual(1);

      // Press 'p' to go back
      await page.keyboard.press('p');
      si = await page.evaluate(() => window._slidingWindowState.stepIndex);
      expect(si).toBeGreaterThanOrEqual(0);

      // Space toggles play/pause. Ensure playing changes state
      // set speed low so play starts quickly
      await page.fill('#speed', '50');
      const beforePlaying = await page.evaluate(() => window._slidingWindowState.playing);
      await page.keyboard.press('Space');
      await page.waitForTimeout(70);
      const duringPlaying = await page.evaluate(() => window._slidingWindowState.playing);
      expect(duringPlaying).toBe(!beforePlaying);
      // Stop playback by pressing Space again
      await page.keyboard.press('Space');
      await page.waitForTimeout(20);
      const afterPlaying = await page.evaluate(() => window._slidingWindowState.playing);
      expect(afterPlaying).toBe(false);
    });
  });

  test.describe('Edge cases and error/dialog observations', () => {
    test('Import with empty text shows alert and is handled', async ({ page }) => {
      // Ensure importText is empty and click import should alert
      await page.fill('#importText', '');
      await page.click('#importJSON');
      // Last dialog should instruct to paste snapshot
      const dialogs = page.context()._dialogs;
      const last = dialogs[dialogs.length - 1];
      expect(last.message.toLowerCase()).toContain('paste snapshot json into the text box');
    });

    test('Randomize with no seed uses Math.random (no crash) and keeps within bounds', async ({ page }) => {
      await page.fill('#randomSize', '5');
      await page.fill('#randomMin', '0');
      await page.fill('#randomMax', '3');
      await page.fill('#randomSeed', '');
      await page.click('#randomize');
      const arr = await page.evaluate(() => window._slidingWindowState.arr.slice());
      expect(arr.length).toBe(5);
      for (const v of arr) {
        expect(typeof v).toBe('number');
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(3);
      }
    });
  });
});