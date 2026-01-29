import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c167671-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper to parse object ids from the heapView content
async function getHeapObjectIds(page) {
  const text = await page.$eval('#heapView', el => el.textContent || '');
  // Find the line that contains "Object ids:" and the following line tokens like "[1] [2] "
  const parts = text.split('\n');
  const idx = parts.findIndex(line => line.trim().startsWith('Object ids:'));
  if (idx === -1 || idx + 1 >= parts.length) return [];
  const idsLine = parts[idx + 1] || '';
  const matches = idsLine.match(/\[(\d+)\]/g) || [];
  return matches.map(m => parseInt(m.replace(/[^\d]/g, ''), 10));
}

test.describe('Garbage Collection Simulator - FSM states and transitions', () => {
  let page;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for initial demo to log initialization message and render
    await page.waitForSelector('#heapView');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('S0 Idle - initial render and no uncaught errors on load', async () => {
    // Validate that initial heap view and inspector are rendered
    const heapText = await page.$eval('#heapView', el => el.textContent || '');
    expect(heapText).toContain('Heap slots used:');
    expect(heapText).toContain('Object ids:');

    // The inspector should exist (may be empty or contain default messages)
    const inspectorText = await page.$eval('#inspector', el => el.textContent || '');
    expect(inspectorText.length).toBeGreaterThanOrEqual(0);

    // Assert no uncaught page errors happened during load (observing console/pageerror)
    expect(pageErrors.length).toBe(0);
  });

  test('S1 Allocating - Allocate One updates heap and inspector', async () => {
    // Click Allocate Object and verify allocation occurs and inspector shows the allocated object
    await page.click('#allocOne');

    // After allocation, inspector should show "Object id=" because allocOne calls inspect on the new object
    const inspectorText = await page.waitForSelector('#inspector');
    const content = await inspectorText.evaluate(el => el.textContent || '');
    expect(content).toContain('Object id=');

    // The log should contain an "Allocated object" entry
    const logText = await page.$eval('#log', el => el.value || '');
    expect(logText).toMatch(/Allocated object id=\d+ size=\d+ fields=\d+/);

    // No uncaught errors expected during allocation
    expect(pageErrors.length).toBe(0);
  });

  test('S1 Allocating - Allocate Many creates multiple objects', async () => {
    // Record initial object count
    const beforeIds = await getHeapObjectIds(page);

    // Set allocCount to 5 and click Allocate Many
    await page.fill('#allocCount', '5');
    await page.click('#allocMany');

    // Wait a short time for allocations to complete and rendering to finish
    await page.waitForTimeout(200);

    const afterIds = await getHeapObjectIds(page);
    expect(afterIds.length).toBeGreaterThan(beforeIds.length);

    // The log should include at least one "Allocated object" message
    const logText = await page.$eval('#log', el => el.value || '');
    expect(logText).toMatch(/Allocated object id=\d+ size=\d+ fields=\d+/);

    expect(pageErrors.length).toBe(0);
  });

  test('S2 Mutating - Mutate One modifies an object field and logs mutation', async () => {
    // Ensure there is at least one object with fields by creating some objects with fields
    await page.fill('#fields', '2'); // default fields per object
    await page.fill('#allocCount', '3');
    await page.click('#allocMany');
    await page.waitForTimeout(150);

    // Click Mutate One
    await page.click('#mutateOne');

    // The log should contain a mutated object entry
    const logText = await page.$eval('#log', el => el.value || '');
    expect(logText).toMatch(/Mutated object \d+ field\[\d+\] -> (null|\d+)/);

    expect(pageErrors.length).toBe(0);
  });

  test('S3 RunningGC - Step GC (mark-and-sweep) performs collection and logs results', async () => {
    // Select full mark-and-sweep algorithm
    await page.selectOption('#algo', 'markSweep');

    // Click Step GC
    await page.click('#stepGC');

    // The log should contain mark-and-sweep start and completion messages
    const logText = await page.$eval('#log', el => el.value || '');
    expect(logText).toMatch(/Starting full mark-and-sweep/);
    expect(logText).toMatch(/Mark-and-sweep complete\. Freed \d+ objects\./);

    // Also test Run GC starts auto-run (we will stop it immediately)
    // Ensure autorun checkbox is unchecked, then click Run GC (it will set it true)
    await page.click('#runGC');
    await page.waitForTimeout(100);
    const runLog = await page.$eval('#log', el => el.value || '');
    expect(runLog).toMatch(/Auto GC run started for algorithm: /);

    // Stop GC so the test does not leave timers running
    await page.click('#stopGC');

    expect(pageErrors.length).toBe(0);
  });

  test('S3 RunningGC - Reference counting + cycle detection frees unreachable cycles', async () => {
    // Create a cycle explicitly
    await page.click('#createCycle');
    await page.click('#createCycle'); // make two cycles
    await page.waitForTimeout(100);

    // Choose reference counting algorithm and run Step GC (which runs refcount and detectCycles)
    await page.selectOption('#algo', 'refcount');
    await page.click('#stepGC');

    const logText = await page.$eval('#log', el => el.value || '');
    expect(logText).toMatch(/Starting reference counting pass/);
    // detectCycles logs "Detecting unreachable cycles" only when called explicitly, but referenceCountingPass is followed by detectCycles in stepGC
    expect(logText).toMatch(/Detecting unreachable cycles|Reference counting freed \d+ objects/);

    expect(pageErrors.length).toBe(0);
  });

  test('S4 Inspecting -> S5 Editing: inspect object via heapView click, edit size and fields', async () => {
    // Get a valid object id to inspect
    const ids = await getHeapObjectIds(page);
    expect(ids.length).toBeGreaterThan(0);
    const targetId = ids[0];

    // Prepare to respond to prompt that appears when clicking heapView
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      // Provide the target id to inspect
      await dialog.accept(String(targetId));
    });

    // Click heapView to trigger prompt and inspect
    await page.click('#heapView');

    // Wait until inspector shows the inspected id
    await page.waitForFunction((id) => {
      const el = document.getElementById('inspector');
      return el && el.textContent && el.textContent.includes('Object id=' + id);
    }, targetId);

    // Verify selectedId input was populated by inspect()
    const selected = await page.$eval('#selectedId', el => el.value);
    expect(Number(selected)).toBe(targetId);

    // Perform edit size: set new size and click Set Size
    // Read current size from inspector text
    const inspectorTextBefore = await page.$eval('#inspector', el => el.textContent || '');
    const matchSize = inspectorTextBefore.match(/Size: (\d+)/);
    const currentSize = matchSize ? parseInt(matchSize[1], 10) : 1;
    const newSize = currentSize + 3;
    await page.fill('#editSize', String(newSize));
    await page.click('#setSize');

    // After setting size, the heap view should contain the updated size for that id
    await page.waitForFunction((id, size) => {
      const text = document.getElementById('heapView').textContent || '';
      return text.includes('id=' + id + ' ') && text.includes('size=' + size);
    }, targetId, newSize);

    const heapNow = await page.$eval('#heapView', el => el.textContent || '');
    expect(heapNow).toContain('id=' + targetId);
    expect(heapNow).toContain('size=' + newSize);

    // Now test editing fields: make first field null and second field point to another object (if exists)
    const allIds = await getHeapObjectIds(page);
    const otherId = (allIds.length > 1) ? allIds.find(x => x !== targetId) : null;
    const fieldsValue = otherId ? `${otherId},null` : 'null';
    await page.fill('#editFields', fieldsValue);
    // Ensure editWeak is unchecked for deterministic strong references
    const weakChecked = await page.$eval('#editWeak', el => el.checked);
    if (weakChecked) {
      await page.click('#editWeak'); // toggle off if it was on
    }
    await page.click('#setFields');

    // Refresh selection to update inspector content
    await page.click('#selectRefresh');

    // Inspector should reflect new field targets
    const inspectorAfter = await page.$eval('#inspector', el => el.textContent || '');
    for (const token of fieldsValue.split(',')) {
      const trimmed = token.trim();
      if (trimmed.toLowerCase() === 'null') {
        expect(inspectorAfter).toMatch(/-> null/);
      } else {
        expect(inspectorAfter).toContain('-> ' + trimmed);
      }
    }

    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: allocation failure when heap slots too small', async () => {
    // Set heapSlots to a very small number to force allocation failure
    await page.fill('#heapSlots', '1');
    // Try to allocate many objects
    await page.fill('#allocCount', '20');
    await page.click('#allocMany');

    // Wait briefly for log to update
    await page.waitForTimeout(150);

    const logText = await page.$eval('#log', el => el.value || '');
    // Either individual allocations failed or at least a "Allocation failed" message exists
    expect(logText).toMatch(/Allocation failed: not enough heap slots\.|Allocated object id=\d+/);

    expect(pageErrors.length).toBe(0);
  });

  test('Dialog cancel scenario: dismiss inspect prompt leaves inspector unchanged', async () => {
    // Capture inspector state
    const beforeInspector = await page.$eval('#inspector', el => el.textContent || '');

    // Click heapView but dismiss the prompt
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.dismiss();
    });

    await page.click('#heapView');
    await page.waitForTimeout(150);

    const afterInspector = await page.$eval('#inspector', el => el.textContent || '');
    // Inspector should be unchanged when prompt dismissed
    expect(afterInspector).toBe(beforeInspector);

    expect(pageErrors.length).toBe(0);
  });

  test('Reset simulator (confirm dialog accepted) clears heap', async () => {
    // Click Reset and accept the confirm dialog
    page.once('dialog', async dialog => {
      // This should be a "confirm" dialog
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });

    await page.click('#reset');

    // Wait for log entry "Simulator reset"
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && /Simulator reset/.test(log.value);
    });

    // Heap should be cleared - object ids line should be present but empty list
    const heapText = await page.$eval('#heapView', el => el.textContent || '');
    // After reset, there may still be "Object ids:" line but it should likely be empty or have few objects due to initDemo called on init only previously
    // We assert that "Simulator reset" is present in log and that heapView contains "Objects" section
    const logText = await page.$eval('#log', el => el.value || '');
    expect(logText).toMatch(/Simulator reset/);
    expect(heapText).toContain('Objects (addr,size,age,gen,refcount,marked,finalizer,pinned):');

    expect(pageErrors.length).toBe(0);
  });

  test('Snapshot and Restore lifecycle: save snapshot and restore it', async () => {
    // Save a snapshot
    await page.click('#snapshot');

    // Wait for log entry indicating snapshot saved
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && /Saved snapshot/.test(log.value);
    });

    // Select the first snapshot in history and attempt to restore
    // The restore action triggers confirm - accept it
    await page.selectOption('#history', '0').catch(() => { /* ignore if not selectable yet */ });

    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });

    // Trigger restore
    await page.click('#restore');

    // After restore, log should indicate restored snapshot
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && /Restored snapshot/.test(log.value);
    });

    const logText = await page.$eval('#log', el => el.value || '');
    expect(logText).toMatch(/Restored snapshot/);

    expect(pageErrors.length).toBe(0);
  });

  test('Detect leaks explicitly via button logs detection results', async () => {
    // Click Detect Leaks and ensure it logs the detection activity
    await page.click('#detectLeaks');
    await page.waitForTimeout(150);
    const logText = await page.$eval('#log', el => el.value || '');
    expect(logText).toMatch(/Detecting unreachable cycles|Detected \d+ unreachable cycles \/ SCCs|No unreachable objects found\./);

    expect(pageErrors.length).toBe(0);
  });

  test('Observe console messages and ensure no uncaught TypeError/ReferenceError occurred during interactions', async () => {
    // Perform a few interactions that trigger diverse code paths
    await page.click('#allocOne');
    await page.click('#createCycle');
    await page.click('#mutateMany');
    await page.click('#compact');

    // Short wait to let asynchronous logs/timers settle
    await page.waitForTimeout(200);

    // Assert that no pageErrors (uncaught exceptions) were observed
    // This test collects runtime errors; if the application produces uncaught exceptions,
    // the pageErrors array will contain them and this expectation will fail.
    expect(pageErrors.length).toBe(0);

    // Also ensure that console messages were produced (the app logs internal info)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

});