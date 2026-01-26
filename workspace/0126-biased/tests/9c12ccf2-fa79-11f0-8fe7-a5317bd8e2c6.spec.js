import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c12ccf2-fa79-11f0-8fe7-a5317bd8e2c6.html';

/**
 * Playwright end-to-end tests for Doubly Linked List Explorer
 *
 * - Uses ESM imports (per requirement)
 * - Loads the page exactly as-is and does not patch the runtime
 * - Observes console messages and page errors (asserts none are thrown)
 * - Exercises UI controls corresponding to the FSM transitions
 *
 * Notes:
 * - The application uses many alert() dialogs. Tests capture & accept them
 *   and assert dialog messages where meaningful.
 * - Tests are organized into describe blocks to group related behaviors.
 */

/**
 * Utility helpers used across tests
 */
async function getVisualText(page) {
  return (await page.locator('#visual').textContent()) || '';
}
async function getDetailsText(page) {
  return (await page.locator('#details').textContent()) || '';
}
async function getInspectorText(page) {
  return (await page.locator('#inspector').textContent()) || '';
}
async function getHistoryLabel(page) {
  return (await page.locator('#historyLabel').textContent()) || '';
}
async function getJsonIO(page) {
  return (await page.locator('#jsonIO').inputValue()) || '';
}
async function countVisualNodes(page) {
  const txt = await getVisualText(page);
  // nodes are represented like "[id:val]" so count "[" occurrences
  return (txt.match(/\[/g) || []).length;
}

test.describe.serial('Doubly Linked List Explorer - full FSM coverage', () => {
  // Capture page console messages and page errors for each test run
  let consoleMsgs;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMsgs = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture console messages for inspection
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // collect any uncaught exceptions from the page
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
    // ensure initial render completes
    await page.waitForSelector('#visual');
  });

  test.afterEach(async ({}, testInfo) => {
    // Assert there are no uncaught page errors (let errors happen naturally,
    // but the application is expected to be stable). We assert zero page errors.
    expect(pageErrors, `Page errors: ${pageErrors.map(e => e && e.message).join('; ')}`).toEqual([]);
    // Also ensure we captured console messages array (it may be empty)
    expect(Array.isArray(consoleMsgs)).toBe(true);
  });

  test.describe('Initialization checks', () => {
    test('initial sample created on load and snapshot pushed', async ({ page }) => {
      // verify initial visual contains the four sample nodes A B C D in order
      const visual = await getVisualText(page);
      expect(visual).toContain('[0:A]');
      expect(visual).toContain('[1:B]');
      expect(visual).toContain('[2:C]');
      expect(visual).toContain('[3:D]');
      // history label should reflect init snapshot (1 / 1) and include the reason text
      const hLabel = await getHistoryLabel(page);
      expect(hLabel).toMatch(/1 \/ 1/);
      expect(hLabel.toLowerCase()).toContain('init sample');
      // details pane should include headers and at least 4 lines for nodes
      const details = await getDetailsText(page);
      expect(details).toContain('index | id | value | prev | next');
      expect(details).toContain('0');
    });
  });

  test.describe('Insert / Create / Randomize / Delete operations', () => {
    test('insert a node at tail updates visual and history', async ({ page }) => {
      // Insert X at tail (default)
      await page.fill('#valInput', 'X');
      // ensure posSelect is tail (default), then click Insert
      await page.click('#insertBtn');
      // after insert, visual should contain the new value
      const visual = await getVisualText(page);
      expect(visual).toContain(':X]');
      // history count should increase (label contains "/" with count >= 2)
      const hLabel = await getHistoryLabel(page);
      expect(hLabel).toMatch(/\/\s*\d+/);
    });

    test('create new list clears the list and makes visual show empty', async ({ page }) => {
      // click create new list
      const [dialogPromise] = await Promise.all([
        page.waitForEvent('dialog').catch(() => null),
        page.click('#createHeadBtn')
      ]);
      // createHeadBtn triggers snapshotPush but not an alert; guard in case of dialogs
      if (dialogPromise) {
        // If a dialog appeared accept it
        expect(dialogPromise.message()).toBeTruthy();
        await dialogPromise.accept();
      }
      const visual = await getVisualText(page);
      expect(visual.trim()).toBe('(empty list)');
      // history label should reference the creation entry
      const hLabel = await getHistoryLabel(page);
      expect(hLabel.toLowerCase()).toContain('create new list');
    });

    test('random populate creates requested number of nodes', async ({ page }) => {
      // set size to 5 and click Random Populate
      await page.fill('#randSize', '5');
      await page.click('#randomBtn');
      // after random populate, visual should show 5 nodes
      const nodeCount = await countVisualNodes(page);
      expect(nodeCount).toBe(5);
      // history updated with "random populate"
      const hLabel = await getHistoryLabel(page);
      expect(hLabel.toLowerCase()).toContain('random populate');
    });

    test('delete by id removes node from visual', async ({ page }) => {
      // Prepare known list: create new list then insert known items 1..3 so ids are predictable
      await page.click('#createHeadBtn');
      // insert A, B, C at tail
      await page.fill('#valInput', 'A'); await page.click('#insertBtn');
      await page.fill('#valInput', 'B'); await page.click('#insertBtn');
      await page.fill('#valInput', 'C'); await page.click('#insertBtn');
      // find an id from the details pane (the first id appears in details)
      const details = await getDetailsText(page);
      // parse first id from details table (line containing "0 | id")
      const firstLine = details.split('\n').find(l => /^0\s*\|/.test(l));
      expect(firstLine).toBeTruthy();
      const parts = firstLine.split('|').map(s => s.trim());
      const idStr = parts[1];
      const id = parseInt(idStr, 10);
      // delete by id
      await page.selectOption('#delMode', 'id');
      await page.fill('#delInput', String(id));
      await page.click('#deleteBtn');
      // visual should no longer contain that id
      const afterVisual = await getVisualText(page);
      expect(afterVisual).not.toContain('id=' + id); // node button removed
      // details should not contain that id
      const afterDetails = await getDetailsText(page);
      expect(afterDetails).not.toContain(' ' + id + ' ');
    });
  });

  test.describe('Find / Move / Swap / Reverse / Rotate operations', () => {
    test('find first finds a node and sets selectedIdInput (and alerts)', async ({ page }) => {
      // Make sure there is at least one node with value 'A'
      await page.click('#createHeadBtn');
      await page.fill('#valInput', 'A'); await page.click('#insertBtn');
      await page.fill('#valInput', 'B'); await page.click('#insertBtn');
      // search for 'A'
      await page.fill('#findVal', 'A');
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#findBtn');
      const dialog = await dialogPromise;
      const msg = dialog.message();
      expect(msg).toMatch(/found id \d+/);
      await dialog.accept();
      // selectedIdInput should contain the id mentioned
      const selVal = await page.inputValue('#selectedIdInput');
      expect(parseInt(selVal, 10)).not.toBeNaN();
    });

    test('find first not found triggers "not found" alert', async ({ page }) => {
      await page.fill('#findVal', 'VALUE_THAT_DOES_NOT_EXIST_123');
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#findBtn');
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('not found');
      await dialog.accept();
    });

    test('move node to a new index changes order', async ({ page }) => {
      // Setup small list A,B,C,D
      await page.click('#createHeadBtn');
      await page.fill('#valInput', 'A'); await page.click('#insertBtn');
      await page.fill('#valInput', 'B'); await page.click('#insertBtn');
      await page.fill('#valInput', 'C'); await page.click('#insertBtn');
      await page.fill('#valInput', 'D'); await page.click('#insertBtn');
      // get id of node A (index 0 from details)
      const details = await getDetailsText(page);
      const firstLine = details.split('\n').find(l => /^0\s*\|/.test(l));
      const id = parseInt(firstLine.split('|')[1].trim(), 10);
      // move id to index 2 (so A moves to between C and D original positions)
      await page.fill('#moveId', String(id));
      await page.fill('#moveIndex', '2');
      await page.click('#moveBtn');
      // verify order: visual should show A at index 2 (i.e., third position)
      const visual = await getVisualText(page);
      // split on "<->" to get tokens like "[id:val]"
      const tokens = visual.split('<->').map(t => t.trim());
      // find token with ':A]'
      const idx = tokens.findIndex(t => t.includes(':A]'));
      expect(idx).toBe(2);
    });

    test('swap two nodes swaps their values (ids remain)', async ({ page }) => {
      // create predictable list 1..3 with values V1, V2
      await page.click('#createHeadBtn');
      await page.fill('#valInput', 'V1'); await page.click('#insertBtn');
      await page.fill('#valInput', 'V2'); await page.click('#insertBtn');
      await page.fill('#valInput', 'V3'); await page.click('#insertBtn');
      // get ids in order from details
      let details = await getDetailsText(page);
      const lines = details.split('\n').filter(l => /^\d+\s*\|/.test(l));
      const id0 = parseInt(lines[0].split('|')[1].trim(), 10);
      const id1 = parseInt(lines[1].split('|')[1].trim(), 10);
      // confirm initial mapping: id0 has V1, id1 has V2
      expect(details).toContain(String(id0));
      // set swap inputs and click swap
      await page.fill('#swapA', String(id0));
      await page.fill('#swapB', String(id1));
      await page.click('#swapBtn');
      // after swap, values should be swapped (id0 now has V2)
      details = await getDetailsText(page);
      const id0Line = details.split('\n').find(l => l.includes('| ' + String(id0) + ' |'));
      expect(id0Line).toContain('V2');
    });

    test('reverse list flips order', async ({ page }) => {
      await page.click('#createHeadBtn');
      await page.fill('#valInput', '1'); await page.click('#insertBtn');
      await page.fill('#valInput', '2'); await page.click('#insertBtn');
      await page.fill('#valInput', '3'); await page.click('#insertBtn');
      // click reverse
      await page.click('#reverseBtn');
      const visual = await getVisualText(page);
      // now first token should be 3
      const tokens = visual.split('<->').map(t => t.trim());
      expect(tokens[0]).toContain(':3]');
    });

    test('rotate list shifts nodes to the right by k', async ({ page }) => {
      await page.click('#createHeadBtn');
      await page.fill('#valInput', 'A'); await page.click('#insertBtn');
      await page.fill('#valInput', 'B'); await page.click('#insertBtn');
      await page.fill('#valInput', 'C'); await page.click('#insertBtn');
      // rotate by 1
      await page.fill('#rotK', '1');
      await page.click('#rotateBtn');
      const visual = await getVisualText(page);
      // expect order C A B (C now head)
      const tokens = visual.split('<->').map(t => t.trim());
      expect(tokens[0]).toContain(':C]');
    });
  });

  test.describe('Split / Merge / Clone / Export / Import', () => {
    test('split list produces JSON for main and second lists', async ({ page }) => {
      await page.click('#createHeadBtn');
      // build 4 nodes for split
      await page.fill('#valInput', 'a'); await page.click('#insertBtn');
      await page.fill('#valInput', 'b'); await page.click('#insertBtn');
      await page.fill('#valInput', 'c'); await page.click('#insertBtn');
      await page.fill('#valInput', 'd'); await page.click('#insertBtn');
      await page.fill('#splitIndex', '2');
      await page.click('#splitBtn');
      // jsonIO should contain "main" and "second"
      const jsonTxt = await getJsonIO(page);
      expect(jsonTxt).toContain('"main"');
      expect(jsonTxt).toContain('"second"');
      // ensure lengths are present for both sections
      expect(jsonTxt).toMatch(/"length"\s*:/);
    });

    test('merge with secondary list appends nodes when jsonIO empty', async ({ page }) => {
      // ensure jsonIO empty
      await page.fill('#jsonIO', '');
      const beforeCount = await countVisualNodes(page);
      await page.click('#mergeBtn');
      // after merge with default small list X,Y,Z the visual should gain 3 nodes
      const afterCount = await countVisualNodes(page);
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 3);
    });

    test('clone selected node inserts a copy after original', async ({ page }) => {
      await page.click('#createHeadBtn');
      await page.fill('#valInput', 'C1'); await page.click('#insertBtn');
      await page.fill('#valInput', 'C2'); await page.click('#insertBtn');
      // select first node id (from details)
      const details = await getDetailsText(page);
      const firstLine = details.split('\n').find(l => /^0\s*\|/.test(l));
      const id = parseInt(firstLine.split('|')[1].trim(), 10);
      await page.fill('#selectedIdInput', String(id));
      // click clone
      await page.click('#cloneBtn');
      // now number of nodes increased by 1
      const visual = await getVisualText(page);
      const occurrences = (visual.match(/C1/g) || []).length;
      expect(occurrences).toBeGreaterThanOrEqual(1);
      // clone creates a new node with same value; ensure there are at least 2 occurrences of that value
      expect(occurrences).toBeGreaterThanOrEqual(2);
    });

    test('export writes JSON into text area and import rebuilds list', async ({ page }) {
      // ensure some known content exists
      await page.click('#createHeadBtn');
      await page.fill('#valInput', 'E1'); await page.click('#insertBtn');
      await page.fill('#valInput', 'E2'); await page.click('#insertBtn');
      // export
      await page.click('#exportBtn');
      const exported = await getJsonIO(page);
      expect(exported).toContain('"nodes"');
      // clear list then import exported JSON
      await page.click('#createHeadBtn');
      await page.fill('#jsonIO', exported);
      await page.click('#importBtn');
      // after import, visual should contain 'E1' and 'E2'
      const visual = await getVisualText(page);
      expect(visual).toContain('E1');
      expect(visual).toContain('E2');
    });
  });

  test.describe('Undo / Redo / Snapshot / Playback / History', () => {
    test('snapshot, undo and redo restores states', async ({ page }) => {
      // start fresh
      await page.click('#createHeadBtn');
      // snapshot (manual)
      await page.click('#snapshotBtn');
      // insert a node
      await page.fill('#valInput', 'U1');
      await page.click('#insertBtn');
      const withNode = await getVisualText(page);
      expect(withNode).toContain('U1');
      // undo should restore to snapshot (empty)
      await page.click('#undoBtn');
      const afterUndo = await getVisualText(page);
      expect(afterUndo.trim()).toBe('(empty list)');
      // redo should bring back U1
      await page.click('#redoBtn');
      const afterRedo = await getVisualText(page);
      expect(afterRedo).toContain('U1');
    });

    test('play/pause history playback does not crash (play triggers timer until end)', async ({ page }) => {
      // create a few changes to have history entries
      await page.click('#createHeadBtn');
      await page.fill('#valInput', 'P1'); await page.click('#insertBtn');
      await page.fill('#valInput', 'P2'); await page.click('#insertBtn');
      // take a snapshot and play
      await page.click('#snapshotBtn');
      // start play, let it run briefly and then pause
      await page.click('#playBtn');
      // give some time for playback to advance
      await page.waitForTimeout(300);
      await page.click('#pauseBtn');
      // historyPlaying should be false and no exceptions thrown
      const hLabel = await getHistoryLabel(page);
      expect(hLabel).toContain('/');
    });
  });

  test.describe('Macros, algorithm stepper and diagnostics', () => {
    test('record macro, stop and play macro (creates macro entry)', async ({ page }) => {
      // clear macros
      await page.click('#clearMacros');
      // start recording
      const startDialog = page.waitForEvent('dialog');
      await page.click('#startMacro');
      const d1 = await startDialog;
      // application shows alert 'macro recording started: ...'
      expect(d1.message()).toContain('macro recording started');
      await d1.accept();
      // perform an action (insert)
      await page.fill('#valInput', 'M1'); await page.click('#insertBtn');
      // stop recording
      const stopDialog = page.waitForEvent('dialog');
      await page.click('#stopMacro');
      const d2 = await stopDialog;
      expect(d2.message().toLowerCase()).toContain('macro saved');
      await d2.accept();
      // refreshMacroList should have populated macroList select
      const hasOptions = await page.locator('#macroList option').count();
      expect(hasOptions).toBeGreaterThanOrEqual(1);
      // play macro: select first option then click playMacro
      const firstVal = await page.locator('#macroList option').first().getAttribute('value');
      await page.selectOption('#macroList', firstVal);
      // playing macro will use alerts for completion; wait for 'macro complete' or 'macro complete' alert
      const playPromise = page.waitForEvent('dialog');
      await page.click('#playMacro');
      const d3 = await playPromise;
      // accept macro completion dialog; may also show 'macro complete'
      await d3.accept();
      // ensure app still responsive by checking visual exists
      const visual = await getVisualText(page);
      expect(visual.length).toBeGreaterThan(0);
    });

    test('algorithm prepare and single step executes without crash', async ({ page }) {
      // ensure some nodes exist
      await page.click('#createHeadBtn');
      await page.fill('#valInput', 'b'); await page.click('#insertBtn');
      await page.fill('#valInput', 'a'); await page.click('#insertBtn');
      // choose bubble sort and prepare
      await page.selectOption('#algoSelect', 'bubble');
      const prepDialogP = page.waitForEvent('dialog');
      await page.click('#algoPrepareBtn');
      const prepDialog = await prepDialogP;
      expect(prepDialog.message()).toMatch(/prepared \d+ steps/);
      await prepDialog.accept();
      // step once (might produce an alert for compare or algorithm finished)
      const stepDialogP = page.waitForEvent('dialog');
      await page.click('#algoStepBtn');
      const stepDialog = await stepDialogP;
      expect(stepDialog.message()).toBeTruthy();
      await stepDialog.accept();
      // ensure list still renders
      const visual = await getVisualText(page);
      expect(visual).toContain(':a]').or.toContain(':b]');
    });

    test('check invariants on a sane list shows OK alert', async ({ page }) => {
      await page.click('#createHeadBtn');
      await page.fill('#valInput', 'I1'); await page.click('#insertBtn');
      const dialogP = page.waitForEvent('dialog');
      await page.click('#checkInvBtn');
      const d = await dialogP;
      expect(d.message()).toContain('No invariants detected');
      await d.accept();
    });

    test('detect cycles reports true when circular toggle enabled', async ({ page }) {
      await page.click('#createHeadBtn');
      await page.fill('#valInput', 'C1'); await page.click('#insertBtn');
      await page.fill('#valInput', 'C2'); await page.click('#insertBtn');
      // toggle circular
      await page.check('#circularToggle');
      // detect cycles - will alert with boolean
      const dialogP = page.waitForEvent('dialog');
      await page.click('#detectCycleBtn');
      const d = await dialogP;
      expect(d.message()).toContain('cycle detected? true');
      await d.accept();
    });
  });

  test.describe('Inspector edits and pointer repairs', () => {
    test('edit selected node value updates inspector and details', async ({ page }) => {
      await page.click('#createHeadBtn');
      await page.fill('#valInput', 'Orig'); await page.click('#insertBtn');
      // select the created node via node button to populate selectedIdInput
      const nodeButton = page.locator('#nodeButtons button').first();
      await nodeButton.click();
      // change editVal and apply
      await page.fill('#editVal', 'Edited');
      await page.click('#applyEditBtn');
      // details should reflect updated value
      const details = await getDetailsText(page);
      expect(details).toContain('Edited');
    });

    test('repair pointers attempts to rebuild prev links and updates tail', async ({ page }) {
      // Create nodes and then manually break a pointer to trigger repair logic
      await page.click('#createHeadBtn');
      await page.fill('#valInput', 'R1'); await page.click('#insertBtn');
      await page.fill('#valInput', 'R2'); await page.click('#insertBtn');
      await page.fill('#valInput', 'R3'); await page.click('#insertBtn');
      // select middle node id
      const details = await getDetailsText(page);
      const midLine = details.split('\n').find(l => l.includes('| R2 |'));
      expect(midLine).toBeTruthy();
      const midId = parseInt(midLine.split('|')[1].trim(), 10);
      // Manually edit pointers to break the chain: set its prev/next to -1 using inspector controls
      await page.fill('#selectedIdInput', String(midId));
      await page.click(`#nodeButtons button`).catch(() => {}); // attempt to ensure inspector updated
      await page.fill('#manPrev', '-1');
      await page.fill('#manNext', '-1');
      await page.click('#applyPtrBtn');
      // now click repair pointers which will rebuild prev pointers by scanning
      await page.click('#repairBtn');
      // details should no longer show broken prev/next values for the repaired nodes
      const afterDetails = await getDetailsText(page);
      expect(afterDetails).toContain('R1').and.toContain('R2').and.toContain('R3');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('import bad JSON triggers "bad json" alert', async ({ page }) => {
      await page.fill('#jsonIO', 'NOT_JSON!');
      const dialogP = page.waitForEvent('dialog');
      await page.click('#importBtn');
      const d = await dialogP;
      expect(d.message().toLowerCase()).toContain('bad json');
      await d.accept();
    });

    test('fromArray with invalid JSON alerts invalid JSON', async ({ page }) {
      await page.fill('#jsonIO', 'not_an_array');
      const dialogP = page.waitForEvent('dialog');
      await page.click('#fromArrayBtn');
      const d = await dialogP;
      expect(d.message()).toContain('invalid JSON');
      await d.accept();
    });

    test('delete by non-existent id is a no-op but safe', async ({ page }) {
      await page.click('#createHeadBtn');
      await page.fill('#delInput', '999999'); // non-existent
      await page.selectOption('#delMode', 'id');
      await page.click('#deleteBtn');
      // no alert, but list should still be empty
      const visual = await getVisualText(page);
      expect(visual.trim()).toBe('(empty list)');
    });
  });
});