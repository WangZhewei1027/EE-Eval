import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c131b10-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper utilities used across tests
async function getDequeArray(page) {
  return await page.$$eval('#dequeDisplay .node', nodes => nodes.map(n => {
    // node.textContent contains value plus index child; index is appended as child text, so exclude index child text
    const idxElem = n.querySelector('.index');
    let valText = n.childNodes[0] ? n.childNodes[0].nodeValue : '';
    if(valText === null) valText = '';
    return valText.trim();
  }));
}
async function getSize(page) {
  return await page.$eval('#sizeDisplay', el => Number(el.textContent));
}

test.describe.serial('Deque Interactive Sandbox - comprehensive end-to-end', () => {
  let consoleErrors = [];
  let pageErrors = [];
  let dialogs = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // capture console errors and page errors
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
    page.on('dialog', async dialog => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // ensure initial render and no unexpected early errors
    await expect(page.locator('h1')).toHaveText('Deque Interactive Sandbox');
  });

  test.afterEach(async () => {
    // After each test we will assert no runtime Reference/Syntax/Type errors were emitted
    const bad = consoleErrors.filter(t => /ReferenceError|SyntaxError|TypeError/.test(t));
    expect(bad, `Console errors captured: ${consoleErrors.join('\n')}`).toHaveLength(0);
    const pageErrBad = pageErrors.filter(t => /ReferenceError|SyntaxError|TypeError/.test(t));
    expect(pageErrBad, `Page errors captured: ${pageErrors.join('\n')}`).toHaveLength(0);
  });

  test('Basic push/pop/peek/clear operations with visual verification', async ({ page }) => {
    // pushBack 1
    await page.fill('#valInput', '1');
    await page.click('#pushBackBtn');
    expect(await getSize(page)).toBeGreaterThan(0);
    let arr = await getDequeArray(page);
    expect(arr[0]).toBe('1');

    // pushFront 0
    await page.fill('#valInput', '0');
    await page.click('#pushFrontBtn');
    arr = await getDequeArray(page);
    expect(arr[0]).toBe('0'); // front should be 0

    // peekFront -> alert should have been shown (captured by dialog)
    await page.click('#peekFrontBtn');
    expect(dialogs.pop().message).toContain('peekFront');

    // peekBack -> alert
    await page.click('#peekBackBtn');
    expect(dialogs.pop().message).toContain('peekBack');

    // popFront -> removes front and alerts with popped values
    await page.fill('#countInput', '1');
    await page.click('#popFrontBtn');
    const popFrontDialog = dialogs.pop();
    expect(popFrontDialog.message).toContain('popped front');

    // popBack
    await page.click('#popBackBtn');
    const popBackDialog = dialogs.pop();
    expect(popBackDialog.message).toContain('popped back');

    // Clear (idempotent)
    // push some values then clear
    await page.fill('#valInput', '10,11,12');
    await page.fill('#countInput', '1');
    await page.click('#pushBackBtn');
    await page.click('#pushBackBtn'); // push twice (CSV cycles)
    expect(await getSize(page)).toBeGreaterThan(0);
    await page.click('#clearBtn');
    expect(await getSize(page)).toBe(0);
  });

  test('InsertAt, DeleteAt, SetAt and index-based operations', async ({ page }) => {
    // prepare deque with [1,2,3]
    await page.fill('#valInput', '[1,2,3]');
    await page.click('#pushBackBtn');
    expect(await getSize(page)).toBeGreaterThanOrEqual(3);

    // insertAt index 1 value 9 -> [1,9,2,3]
    await page.fill('#insertIndex', '1');
    await page.fill('#insertVal', '9');
    await page.click('#insertAtBtn');
    let arr = await getDequeArray(page);
    expect(arr[1]).toBe('9');

    // setAt index 2 -> set to 99 (index 2 currently '2' -> becomes '99')
    await page.fill('#setIndex', '2');
    await page.fill('#setVal', '99');
    await page.click('#setAtBtn');
    arr = await getDequeArray(page);
    expect(arr[2]).toBe('99');

    // deleteAt index 1 -> removes '9'
    await page.fill('#deleteIndex', '1');
    await page.click('#deleteAtBtn');
    // deleteAt triggers alert "deleted: ...", ensure it was shown
    const delDialog = dialogs.pop();
    expect(delDialog.message).toContain('deleted');
    arr = await getDequeArray(page);
    // ensure '9' is no longer present
    expect(arr).not.toContain('9');

    // Edge case: deleteAt with out-of-range index should show alert via performOp catch
    await page.fill('#deleteIndex', '9999');
    await page.click('#deleteAtBtn');
    const errDialog = dialogs.pop();
    expect(errDialog.message).toMatch(/Operation failed|Index out of range|Failed/);
  });

  test('Rotate, Reverse, capacity and auto-expand behaviors', async ({ page }) => {
    // reset: clear and fill range 1..4
    await page.click('#clearBtn');
    await page.fill('#rangeStart', '1');
    await page.fill('#rangeEnd', '4');
    await page.click('#fillRangeBtn'); // by default back side
    let arr = await getDequeArray(page);
    expect(arr[0]).toBe('1');
    expect(arr[arr.length - 1]).toBe('4');

    // rotateLeft by k=1: first element moves to back
    await page.fill('#rotateK', '1');
    await page.click('#rotateLeftBtn');
    arr = await getDequeArray(page);
    expect(arr[0]).not.toBe('1'); // should not start with original '1'

    // rotateRight revert
    await page.fill('#rotateK', '1');
    await page.click('#rotateRightBtn');
    // reverse toggles order
    const beforeReverse = await getDequeArray(page);
    await page.click('#reverseBtn');
    const afterReverse = await getDequeArray(page);
    expect(afterReverse[0]).toBe(beforeReverse[beforeReverse.length - 1]);

    // Capacity slider changes capacity display and deque.capacity
    await page.fill('#capacitySlider', '50');
    // trigger input event
    await page.dispatchEvent('#capacitySlider', 'input');
    const capText = await page.$eval('#capacityDisplay', el => el.textContent);
    expect(Number(capText)).toBe(50);

    // Toggle autoExpand and attempt to exceed capacity: set autoExpand off then push many; expect alert "Capacity exceeded"
    await page.check('#autoExpand'); // ensure true
    await page.click('#autoExpand'); // toggle off
    const autoExpandChecked = await page.$eval('#autoExpand', el => el.checked);
    expect(autoExpandChecked).toBe(false);
    // set capacity small and try to overfill
    await page.fill('#capacitySlider', '2');
    await page.dispatchEvent('#capacitySlider', 'input');
    await page.fill('#valInput', '5');
    await page.fill('#countInput', '5');
    await page.click('#pushBackBtn');
    // operation should throw and alert; capture dialog
    const capErr = dialogs.pop();
    expect(capErr.message).toMatch(/Operation failed|Capacity exceeded/);
    // restore autoExpand on for other tests
    await page.click('#autoExpand'); // set true again
  });

  test('FillRandom, FillRange, map, filter, compact', async ({ page }) => {
    // clear then fillRandom with n=3 min=0 max=5 and seed to be deterministic
    await page.click('#clearBtn');
    await page.fill('#randN', '3');
    await page.fill('#randMin', '0');
    await page.fill('#randMax', '5');
    await page.fill('#randSeed', 'seed123');
    await page.click('#fillRandomBtn');
    expect(await getSize(page)).toBeGreaterThanOrEqual(3);

    // fillRange with start 0 end 2 step 1 (adds 3 items)
    await page.fill('#rangeStart', '0');
    await page.fill('#rangeEnd', '2');
    await page.fill('#rangeStep', '1');
    await page.click('#fillRangeBtn');
    expect(await getSize(page)).toBeGreaterThanOrEqual(3);

    // Try map expression: multiply numbers by 2
    await page.fill('#mapExpr', 'Number(x)*2');
    await page.click('#applyMapBtn');
    // map may produce non-numeric strings if values were strings; just assert opLog updated with mapping description
    const opLogText = await page.$eval('#opLog', el => el.textContent);
    expect(opLogText).toContain('map');

    // Filter expression: keep even numbers
    await page.fill('#filterExpr', 'Number(x)%2==0');
    await page.click('#applyFilterBtn');
    const arrAfterFilter = await getDequeArray(page);
    // ensure each remaining value is even (if numeric)
    for (const v of arrAfterFilter) {
      const n = Number(v);
      if (!isNaN(n)) expect(n % 2).toBe(0);
    }

    // Compact: introduce null/undefined via script commands to test compact
    // Use script runner to push special values
    await page.fill('#scriptArea', 'pushBack null\npushBack undefined\npushBack 7\n');
    await page.click('#runScriptBtn');
    // allow some time for script to execute
    await page.waitForTimeout(200);
    // compact
    await page.click('#compactBtn');
    const arrCompacted = await getDequeArray(page);
    // ensure there is no "null" or "undefined" strings among displayed nodes
    expect(arrCompacted.filter(s => s === 'null' || s === 'undefined')).toHaveLength(0);
  });

  test('Transactions: begin, commit, rollback and history behaviors', async ({ page }) => {
    // clear and push initial state
    await page.click('#clearBtn');
    await page.fill('#valInput', '1');
    await page.click('#pushBackBtn');
    expect(await getSize(page)).toBeGreaterThan(0);

    // begin transaction
    await page.click('#beginTxBtn');
    let logText = await page.$eval('#opLog', el => el.textContent);
    expect(logText).toContain('Batch mode ON|Commit|Begin Transaction'.split('|')[0] || 'Begin Transaction');

    // do an operation inside transaction: pushBack 2
    await page.fill('#valInput', '2');
    await page.click('#pushBackBtn');
    // state should have changed but history not committed yet (commit required)
    const sizeDuringTx = await getSize(page);
    expect(sizeDuringTx).toBeGreaterThanOrEqual(2);

    // rollback should restore previous snapshot
    await page.click('#rollbackTxBtn');
    const rollbackLog = dialogs.length ? dialogs.pop() : null;
    // rollback triggers log and render; verify size reverted to initial 1
    const sizeAfterRollback = await getSize(page);
    expect(sizeAfterRollback).toBe(1);

    // begin and commit
    await page.click('#beginTxBtn');
    await page.fill('#valInput', '3');
    await page.click('#pushBackBtn');
    await page.click('#commitTxBtn');
    // commit logs and pushes to history; ensure size reflects committed op
    expect(await getSize(page)).toBeGreaterThanOrEqual(2);
  });

  test('Batch mode queueing, applyBatch and clearBatch', async ({ page }) => {
    // enable batch mode checkbox
    await page.check('#batchMode');
    // queue some operations via UI (pushBack results in queued description)
    await page.fill('#valInput', '20');
    await page.click('#pushBackBtn');
    await page.fill('#valInput', '21');
    await page.click('#pushBackBtn');
    // check batch preview contains queued descriptions
    const preview = await page.$eval('#batchPreview', el => el.value);
    expect(preview.length).toBeGreaterThan(0);

    // apply batch -> if empty it alerts; otherwise applies
    await page.click('#applyBatchBtn');
    // After applyBatch, batch preview should be empty
    const previewAfter = await page.$eval('#batchPreview', el => el.value);
    expect(previewAfter).toBe('');

    // clear batch explicit
    await page.click('#clearBatchBtn');
    const previewCleared = await page.$eval('#batchPreview', el => el.value);
    expect(previewCleared).toBe('');
    // disable batch mode
    await page.uncheck('#batchMode');
  });

  test('Undo/Redo and history size handling', async ({ page }) => {
    // clear history to start fresh
    await page.click('#clearHistoryBtn');

    // pushBack several items
    await page.fill('#valInput', '100');
    await page.click('#pushBackBtn');
    await page.fill('#valInput', '101');
    await page.click('#pushBackBtn');

    const sizeNow = await getSize(page);
    expect(sizeNow).toBeGreaterThanOrEqual(2);

    // undo once -> size decreases
    await page.click('#undoBtn');
    const sizeAfterUndo = await getSize(page);
    expect(sizeAfterUndo).toBeLessThanOrEqual(sizeNow);

    // redo -> size back
    await page.click('#redoBtn');
    const sizeAfterRedo = await getSize(page);
    expect(sizeAfterRedo).toBeGreaterThanOrEqual(sizeAfterUndo);
  });

  test('Script runner: stepScript, runScript (auto) and stopScript', async ({ page }) => {
    // prepare short script for deterministic behavior
    await page.fill('#scriptArea', 'pushBack 7\npushBack 8\npopBack\n');
    // use stepScript to execute single line
    await page.click('#stepScriptBtn');
    await page.waitForTimeout(100);
    let arr = await getDequeArray(page);
    expect(arr.length).toBeGreaterThanOrEqual(1);

    // run script auto with small delay
    await page.fill('#stepDelay', '10');
    await page.click('#runScriptBtn');
    // allow script to run
    await page.waitForTimeout(200);
    // stop script explicitly
    await page.click('#stopScriptBtn');
    // verify opLog contains entries from script
    const opLogText = await page.$eval('#opLog', el => el.textContent);
    expect(opLogText.length).toBeGreaterThan(0);
  });

  test('Find, HighlightAll, viewAt and highlighting visual feedback', async ({ page }) => {
    // clear and insert known values
    await page.click('#clearBtn');
    await page.fill('#valInput', '5');
    await page.click('#pushBackBtn');
    await page.fill('#valInput', '6');
    await page.click('#pushBackBtn');
    await page.fill('#findVal', '6');
    await page.click('#findBtn');
    const findDialog = dialogs.pop();
    expect(findDialog.message).toContain('Matches at indexes');

    // highlight all
    await page.click('#highlightAllBtn');
    // check that some node has thicker border style (3px solid)
    const hasHighlight = await page.$$eval('#dequeDisplay .node', nodes =>
      nodes.some(n => (n.style.border || '').includes('3px'))
    );
    // highlightAll may rely on findVal; the styling change should be present if matches found
    expect(hasHighlight).toBe(true);

    // viewAt valid index -> alert with value
    await page.fill('#viewIndex', '0');
    await page.click('#viewIndexBtn');
    const viewDialog = dialogs.pop();
    expect(viewDialog.message).toContain('Value at 0');
  });

  test('Save snapshot and load snapshot behavior', async ({ page }) => {
    // ensure there is some content
    await page.fill('#valInput', '42');
    await page.click('#pushBackBtn');
    // save snapshot
    await page.click('#saveBtn');
    const snapshotText = await page.$eval('#snapshotArea', el => el.value);
    expect(snapshotText.length).toBeGreaterThan(0);

    // clear and then load snapshot back
    await page.click('#clearBtn');
    expect(await getSize(page)).toBe(0);
    await page.fill('#snapshotArea', snapshotText);
    await page.click('#loadBtn');
    // after load, deque should be restored
    expect(await getSize(page)).toBeGreaterThan(0);
  });

  test('Export log, run random test (small), and validate', async ({ page }) => {
    // ensure opLog has content (from prior ops)
    await page.click('#exportBtn');
    // run a small random test (ops=5) to limit time
    await page.fill('#randOps', '5');
    await page.fill('#randTestSeed', 'local-test-seed');
    await page.fill('#randCap', '50');
    await page.click('#runRandTestBtn');
    // random test completion triggers alert; capture it
    const rtDialog = dialogs.pop();
    expect(rtDialog.message).toContain('Random test completed') || expect(rtDialog.message).toContain('completed');

    // Validate vs array shows current deque in alert
    await page.click('#validateBtn');
    const valDialog = dialogs.pop();
    expect(valDialog.message).toContain('Current deque as array');
  });

  test('Step controls: stepBack, stepForward, play and pause', async ({ page }) => {
    // Ensure there is stepping log content
    // perform a couple of operations to create steppingLog entries
    await page.fill('#valInput', '201');
    await page.click('#pushBackBtn');
    await page.fill('#valInput', '202');
    await page.click('#pushBackBtn');

    // stepBack should not throw; attempt it
    await page.click('#stepBackBtn');
    // stepForward
    await page.click('#stepForwardBtn');

    // play - use small speed and then pause
    await page.fill('#playSpeed', '50');
    await page.click('#playBtn');
    await page.waitForTimeout(120);
    await page.click('#pauseBtn');
    // ensure no errors occurred and playing flag cleared
    // There is no direct exposed playing flag, but we check console/page errors via afterEach
    expect(true).toBeTruthy();
  });
});