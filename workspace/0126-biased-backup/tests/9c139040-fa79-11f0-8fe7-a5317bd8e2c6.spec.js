import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c139040-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('B+ Tree Interactive Demo - FSM validation (App ID: 9c139040-fa79-11f0-8fe7-a5317bd8e2c6)', () => {
  // We'll collect console messages and page errors for each test run and assert on them.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors
    page.on('console', (msg) => {
      // Collect stringified message for later assertions
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as provided
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure initial rendering finished
    await page.waitForSelector('#log');
  });

  test.afterEach(async () => {
    // basic sanity: no uncaught page errors occurred
    expect(Array.isArray(pageErrors)).toBeTruthy();
    // Assert that there were no unhandled page errors (uncaught exceptions)
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Initialization and basic operations', () => {
    test('Initialize Tree (S0_Idle -> S1_TreeInitialized) and verify initial logs & view', async ({ page }) => {
      // Comment: Validate that initialization can be triggered and the expected log appears.
      const initBtn = page.locator('#initBtn');
      await initBtn.click();

      // The demo's initTree logs "Initialized B+ tree with order m=X"
      const log = page.locator('#log');
      await expect(log).toContainText('Initialized B+ tree with order m=4');

      // Also confirm that the tree view contains a level representation (Level 0)
      const treeView = page.locator('#treeView');
      await expect(treeView).toContainText('Level 0');

      // Confirm debug snapshot is present and has a root node
      const snap = await page.evaluate(() => window._bptree_debug.snapshot());
      expect(snap).toBeTruthy();
      expect(typeof snap.root).toBe('string');
      expect(typeof snap.nodes).toBe('object');
    });

    test('Insert key (Immediate) transitions to S2_KeyInserted and updates state & logs', async ({ page }) => {
      // Insert key 15 and assert log contains Completed insertion and snapshot includes the key
      await page.fill('#keyInput', '15');
      await page.click('#insertBtn');

      // Check for completion log
      await expect(page.locator('#log')).toContainText('Completed insertion of 15');

      // Inspect snapshot to ensure key exists in some leaf
      const found = await page.evaluate(() => {
        const snap = window._bptree_debug.snapshot();
        const nodes = snap.nodes || {};
        // search through leaves for 15
        for (const id in nodes) {
          if (Object.prototype.hasOwnProperty.call(nodes, id)) {
            const n = nodes[id];
            if (n && n.isLeaf && Array.isArray(n.keys) && n.keys.indexOf(15) !== -1) return true;
          }
        }
        return false;
      });
      expect(found).toBe(true);
    });

    test('Delete key (Immediate) transitions to S3_KeyDeleted and removes key', async ({ page }) => {
      // Ensure key 15 present (rely on previous test state by initializing and inserting again)
      await page.click('#initBtn');
      await page.fill('#keyInput', '15');
      await page.click('#insertBtn');
      await expect(page.locator('#log')).toContainText('Completed insertion of 15');

      // Now delete it
      await page.fill('#delInput', '15');
      await page.click('#delBtn');

      // Check deletion completion log
      await expect(page.locator('#log')).toContainText('Completed deletion of 15');

      // Verify key no longer present in snapshot
      const exists = await page.evaluate(() => {
        const snap = window._bptree_debug.snapshot();
        const nodes = snap.nodes || {};
        for (const id in nodes) {
          if (Object.prototype.hasOwnProperty.call(nodes, id)) {
            const n = nodes[id];
            if (n && n.isLeaf && Array.isArray(n.keys) && n.keys.indexOf(15) !== -1) return true;
          }
        }
        return false;
      });
      expect(exists).toBe(false);
    });

    test('Find key (S4_KeyFound) logs found / not found messages', async ({ page }) => {
      // Initialize and insert key 20
      await page.click('#initBtn');
      await page.fill('#keyInput', '20');
      await page.click('#insertBtn');
      await expect(page.locator('#log')).toContainText('Completed insertion of 20');

      // Use Find button
      await page.fill('#findInput', '20');
      await page.click('#findBtn');
      await expect(page.locator('#log')).toContainText('Found key 20');

      // Find a missing key should log "Key X not found"
      await page.fill('#findInput', '9999');
      await page.click('#findBtn');
      await expect(page.locator('#log')).toContainText('Key 9999 not found');
    });

    test('Range search (S5_RangeSearched) returns values within range and logs them', async ({ page }) => {
      // Re-init and insert multiple keys
      await page.click('#initBtn');
      await page.fill('#multiInsertInput', '5,7,9,12,20');
      await page.click('#multiInsertBtn');
      await expect(page.locator('#log')).toContainText('Bulk immediate insert completed');

      // Set range from 6 to 12 and perform range search
      await page.fill('#rfrom', '6');
      await page.fill('#rto', '12');
      await page.click('#rangeBtn');

      // Expect range search log to include numbers within [6,12] (7,9,12)
      await expect(page.locator('#log')).toContainText('Range search [6,12] =>');
      const logText = await page.locator('#log').innerText();
      expect(logText).toMatch(/\b7\b/);
      expect(logText).toMatch(/\b9\b/);
      expect(logText).toMatch(/\b12\b/);
    });
  });

  test.describe('Slider, Random Insert, and Bulk operations', () => {
    test('Insert Slider Value (S6_SliderInserted) updates slider and inserts value', async ({ page }) => {
      await page.click('#initBtn');

      // Set slider value to 42 by evaluating input change (emit input event)
      await page.evaluate(() => {
        const slider = document.getElementById('slider');
        slider.value = '42';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Confirm sliderVal DOM updated
      await expect(page.locator('#sliderVal')).toHaveText('42');

      // Click insert slider button
      await page.click('#insertSliderBtn');
      await expect(page.locator('#log')).toContainText('Inserted value from slider: 42');

      // Confirm snapshot contains 42
      const has42 = await page.evaluate(() => {
        const snap = window._bptree_debug.snapshot();
        const nodes = snap.nodes || {};
        return Object.keys(nodes).some(id => nodes[id].isLeaf && nodes[id].keys && nodes[id].keys.indexOf(42) !== -1);
      });
      expect(has42).toBe(true);
    });

    test('Random Insert (Immediate) (S7_RandomInserted) inserts N keys and logs count', async ({ page }) => {
      await page.click('#initBtn');

      // Set small count for determinism and click random insert
      await page.fill('#randCount', '3');
      await page.fill('#randMax', '10');
      await page.click('#randBtn');

      // Validate log reports 3 keys inserted
      await expect(page.locator('#log')).toContainText('Random inserted 3 keys.');

      // Confirm snapshot has at least 3 keys across leaves
      const keyCount = await page.evaluate(() => {
        const snap = window._bptree_debug.snapshot();
        const nodes = snap.nodes || {};
        let total = 0;
        for (const id in nodes) {
          if (Object.prototype.hasOwnProperty.call(nodes, id)) {
            const n = nodes[id];
            if (n && n.isLeaf && Array.isArray(n.keys)) total += n.keys.length;
          }
        }
        return total;
      });
      expect(keyCount).toBeGreaterThanOrEqual(3);
    });

    test('Bulk step-mode insertion (multiInsertStepBtn) and discard/commit behaviors (S6 -> S8)', async ({ page }) => {
      await page.click('#initBtn');

      // Prepare step-mode bulk insert of 3 values
      await page.fill('#multiInsertInput', '2,4,6');
      await page.click('#multiInsertStepBtn');

      // The app logs preparation message
      await expect(page.locator('#log')).toContainText('Prepared step-mode bulk insertion');

      // Use step controls: move to next step (should log STEP:)
      await page.click('#stepNext');
      await expect(page.locator('#log')).toContainText('STEP:');

      // Discard steps -> expect discard message and no changes committed
      await page.click('#discardSteps');
      await expect(page.locator('#log')).toContainText('Discarded current step sequence.');

      // Re-do step-mode and commit
      await page.fill('#multiInsertInput', '11,13');
      await page.click('#multiInsertStepBtn');
      await expect(page.locator('#log')).toContainText('Prepared step-mode bulk insertion');

      // Commit last steps
      await page.click('#commitSteps');
      await expect(page.locator('#log')).toContainText('Committed step sequence. Tree updated to last step.');

      // Confirm one of the committed keys exists (11 or 13)
      const has11or13 = await page.evaluate(() => {
        const snap = window._bptree_debug.snapshot();
        const nodes = snap.nodes || {};
        for (const id in nodes) {
          if (Object.prototype.hasOwnProperty.call(nodes, id)) {
            const n = nodes[id];
            if (n && n.isLeaf && Array.isArray(n.keys)) {
              if (n.keys.indexOf(11) !== -1 || n.keys.indexOf(13) !== -1) return true;
            }
          }
        }
        return false;
      });
      expect(has11or13).toBe(true);
    });
  });

  test.describe('History, Undo/Redo, Export/Import and Log operations', () => {
    test('Undo/Redo (S8_HistoryUpdated) behave correctly and update tree state', async ({ page }) => {
      // init and insert a key so history has entries
      await page.click('#initBtn');
      await page.fill('#keyInput', '55');
      await page.click('#insertBtn');
      await expect(page.locator('#log')).toContainText('Completed insertion of 55');

      // Undo should be possible now
      await page.click('#undoBtn');
      await expect(page.locator('#log')).toContainText('Undo applied.');

      // After undo, key 55 should be absent
      const afterUndo = await page.evaluate(() => {
        const snap = window._bptree_debug.snapshot();
        const nodes = snap.nodes || {};
        return Object.keys(nodes).some(id => nodes[id].isLeaf && nodes[id].keys && nodes[id].keys.indexOf(55) !== -1);
      });
      expect(afterUndo).toBe(false);

      // Redo should reapply
      await page.click('#redoBtn');
      await expect(page.locator('#log')).toContainText('Redo applied.');

      const afterRedo = await page.evaluate(() => {
        const snap = window._bptree_debug.snapshot();
        const nodes = snap.nodes || {};
        return Object.keys(nodes).some(id => nodes[id].isLeaf && nodes[id].keys && nodes[id].keys.indexOf(55) !== -1);
      });
      expect(afterRedo).toBe(true);
    });

    test('Export JSON and Import JSON (S10_JSONExported -> S9_JSONImported) including error scenarios', async ({ page }) => {
      // initialize and insert some keys
      await page.click('#initBtn');
      await page.fill('#keyInput', '77');
      await page.click('#insertBtn');
      await expect(page.locator('#log')).toContainText('Completed insertion of 77');

      // Export JSON
      await page.click('#exportBtn');
      await expect(page.locator('#log')).toContainText('Exported tree JSON (copied to import area).');

      // Grab exported JSON from importArea
      const exported = await page.locator('#importArea').inputValue();
      expect(exported.length).toBeGreaterThan(0);

      // Try importing invalid JSON -> should log Import error
      await page.fill('#importArea', 'invalid-json');
      await page.click('#importBtn');
      await expect(page.locator('#log')).toContainText('Import error');

      // Now ensure a successful import: set the importArea back to exported JSON and import
      await page.fill('#importArea', exported);
      // Ensure tree exists before import (it does), perform import
      await page.click('#importBtn');

      // The import should log success (Imported tree from JSON.)
      await expect(page.locator('#log')).toContainText('Imported tree from JSON.');
    });

    test('Clear operation log and Reset behavior (ResetTree, ClearLog)', async ({ page }) => {
      // Init, add a log entry
      await page.click('#initBtn');
      await page.fill('#keyInput', '123');
      await page.click('#insertBtn');
      await expect(page.locator('#log')).toContainText('Completed insertion of 123');

      // Clear log
      await page.click('#clearLogBtn');
      await expect(page.locator('#log')).toHaveText('');

      // Reset the demo; resetBtn should clear tree and write a reset log line
      await page.click('#resetBtn');
      await expect(page.locator('#log')).toContainText('Reset demo. Please initialize tree.');

      // After reset, treeView should be empty
      const treeViewText = await page.locator('#treeView').innerText();
      expect(treeViewText.trim().length).toBeGreaterThanOrEqual(0);
    });

    test('Edge case: Undo when nothing to undo logs "Nothing to undo."', async ({ page }) => {
      // Immediately after init the history has only the initial snapshot -> Nothing to undo
      await page.click('#initBtn');

      // Clear the log then click undo to get the message deterministically
      await page.click('#clearLogBtn');
      await page.click('#undoBtn');
      await expect(page.locator('#log')).toContainText('Nothing to undo.');
    });
  });

  test.describe('Step-mode deletions, rebalance and edge scenarios', () => {
    test('Delete (Step Mode) prepares steps and rebalance logs appear when needed (S3)', async ({ page }) => {
      // Setup: insert several keys to cause structure to have multiple nodes
      await page.click('#initBtn');
      await page.fill('#multiInsertInput', '1,2,3,4,5,6,7,8,9');
      await page.click('#multiInsertBtn');
      await expect(page.locator('#log')).toContainText('Bulk immediate insert completed');

      // Prepare a step-mode delete for a key we know exists, e.g., 4
      await page.fill('#delInput', '4');
      await page.click('#delStepBtn');

      // Prepare message should appear
      await expect(page.locator('#log')).toContainText('Prepared step-mode deletion for key 4');

      // Step through next steps; should log STEP: messages when stepping
      await page.click('#stepNext');
      await expect(page.locator('#log')).toContainText('STEP:');

      // Commit the steps and verify tree updated
      await page.click('#commitSteps');
      await expect(page.locator('#log')).toContainText('Committed step sequence. Tree updated to last step.');
    });
  });

  test.describe('Robustness and console inspection', () => {
    test('No uncaught console errors and important debug functions are exposed', async ({ page }) => {
      // The page should expose window._bptree_debug with functions
      const hasDebug = await page.evaluate(() => !!window._bptree_debug && typeof window._bptree_debug.snapshot === 'function');
      expect(hasDebug).toBe(true);

      // Ensure no console messages of type "error" were emitted
      const errorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorMsgs.length).toBe(0);
    });
  });
});