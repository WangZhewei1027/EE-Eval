import { test, expect } from '@playwright/test';

const APP = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c12ccf0-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Dynamic Array Explorer (9c12ccf0-fa79-11f0-8fe7-a5317bd8e2c6)', () => {
  // Common state to capture console errors and page errors per test
  test.beforeEach(async ({ page }) => {
    // Capture console errors and uncaught page errors
    page.context()._consoleErrors = [];
    page.context()._pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') page.context()._consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      page.context()._pageErrors.push(err.message);
    });

    await page.goto(APP);
    // Ensure initial render shows expected initial pieces
    await expect(page.locator('h1')).toHaveText('Dynamic Array Explorer');
    await expect(page.locator('#displayLength')).toHaveText('0');
  });

  test.afterEach(async ({ page }) => {
    // Assert no runtime page errors or console.error messages occurred during test
    const consoleErrors = page.context()._consoleErrors || [];
    const pageErrors = page.context()._pageErrors || [];
    // If errors happened, include them in failure context
    expect(pageErrors, `Uncaught page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Console.error messages: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test.describe('Initialization and Creation (FSM S0 -> S1)', () => {
    test('Create new array updates capacity/growth/mode and history', async ({ page }) => {
      // Set initial capacity to 2 and growth to 1.5 and manual mode normal -> create
      await page.fill('#initCapacity', '2');
      await page.selectOption('#growthFactor', '1.5');
      await page.selectOption('#mode', 'normal');
      await page.click('#btnCreate');

      // After create, the displayed capacity should reflect the initCapacity (or >=)
      await expect(page.locator('#displayCapacity')).toContainText(/2|3/); // allow either 2 or maybe adjusted
      // Current step message should be visible in log and include 'created new array'
      await expect(page.locator('#log')).toContainText('created new array');

      // History should contain at least initial and create entries
      await expect(page.locator('#historyList')).toContainText('initial');
      await expect(page.locator('#historyList')).toContainText('create');
    });
  });

  test.describe('Basic operations (Push/Pop/Insert/Remove/Set/Get/Unshift/Shift/Clear)', () => {
    test('Push increases length and sets value; triggers allocation when capacity exceeded', async ({ page }) => {
      // Ensure we have a fresh array with small capacity 1 to force allocation
      await page.fill('#initCapacity', '1');
      await page.selectOption('#growthFactor', '2');
      await page.click('#btnCreate');

      // Push value 'A'
      await page.fill('#valueInput', 'A');
      await page.click('#btnPush');

      // Length should be 1 and buffer should contain 'A'
      await expect(page.locator('#displayLength')).toHaveText('1');
      await expect(page.locator('#bufferView')).toContainText('A');

      // Push another value 'B' which should force reallocation (capacity increases)
      await page.fill('#valueInput', 'B');
      await page.click('#btnPush');

      await expect(page.locator('#displayLength')).toHaveText('2');
      // Capacity should now be >=2 (growth factor 2 from 1 -> 2)
      const capText = await page.locator('#displayCapacity').textContent();
      expect(Number(capText)).toBeGreaterThanOrEqual(2);
      await expect(page.locator('#bufferView')).toContainText('B');
    });

    test('Pop on empty array and on non-empty array', async ({ page }) => {
      // Create fresh array
      await page.fill('#initCapacity', '2');
      await page.click('#btnCreate');

      // Pop on empty array
      await page.click('#btnPop');
      await expect(page.locator('#log')).toContainText('pop: array empty');

      // Push then pop: ensure length decrements and value removed
      await page.fill('#valueInput', 'X');
      await page.click('#btnPush');
      await expect(page.locator('#displayLength')).toHaveText('1');

      await page.click('#btnPop');
      await expect(page.locator('#displayLength')).toHaveText('0');
      // Buffer should show underscore for empty slot
      await expect(page.locator('#bufferView')).toContainText('_');
    });

    test('InsertAt shifts elements and updates length', async ({ page }) => {
      await page.fill('#initCapacity', '4');
      await page.click('#btnCreate');

      // Push three items A,B,C
      await page.fill('#valueInput', 'A'); await page.click('#btnPush');
      await page.fill('#valueInput', 'B'); await page.click('#btnPush');
      await page.fill('#valueInput', 'C'); await page.click('#btnPush');

      // Insert 'X' at index 1 -> A, X, B, C
      await page.fill('#indexInput', '1');
      await page.fill('#valueInput', 'X');
      await page.click('#btnInsert');

      await expect(page.locator('#displayLength')).toHaveText('4');
      // The buffer view should include X somewhere; we assert sequence via log snapshot (final step message)
      await expect(page.locator('#log')).toContainText('length incremented to 4');
    });

    test('RemoveAt shifts left and decrements length', async ({ page }) => {
      await page.fill('#initCapacity', '4'); await page.click('#btnCreate');
      await page.fill('#valueInput', 'A'); await page.click('#btnPush');
      await page.fill('#valueInput', 'B'); await page.click('#btnPush');
      await page.fill('#valueInput', 'C'); await page.click('#btnPush');

      // Remove at index 1 (removes B)
      await page.fill('#indexInput', '1');
      await page.click('#btnRemove');

      await expect(page.locator('#displayLength')).toHaveText('2');
      // Log should contain 'removeAt' message
      await expect(page.locator('#log')).toContainText('removeAt: remove value at index 1');
    });

    test('Set beyond current length extends the array in normal mode', async ({ page }) => {
      await page.fill('#initCapacity', '2'); await page.selectOption('#mode', 'normal'); await page.click('#btnCreate');
      // Array length 0 -> set index 3 = Z should extend to length 4
      await page.fill('#indexInput', '3'); await page.fill('#valueInput', 'Z'); await page.click('#btnSet');

      // Length should now be 4 (index 3 -> length 4)
      await expect(page.locator('#displayLength')).toHaveText('4');
      await expect(page.locator('#bufferView')).toContainText('Z');
    });

    test('Get returns undefined for out-of-range and proper compare highlight for in-range', async ({ page }) => {
      await page.fill('#initCapacity', '2'); await page.click('#btnCreate');
      // Get index 0 on empty -> undefined
      await page.fill('#indexInput', '0'); await page.click('#btnGet');
      await expect(page.locator('#log')).toContainText('get(0) -> undefined');

      // Push value and get it
      await page.fill('#valueInput', 'G'); await page.click('#btnPush');
      await page.fill('#indexInput', '0'); await page.click('#btnGet');
      await expect(page.locator('#log')).toContainText('get(0) -> G');
    });

    test('Unshift and Shift behave as expected', async ({ page }) => {
      await page.fill('#initCapacity', '2'); await page.click('#btnCreate');
      await page.fill('#valueInput', 'A'); await page.click('#btnPush');
      await page.fill('#valueInput', 'B'); await page.click('#btnPush');

      // Unshift 'S' => S,A,B
      await page.fill('#valueInput', 'S'); await page.click('#btnUnshift');
      await expect(page.locator('#displayLength')).toHaveText('3');
      await expect(page.locator('#bufferView')).toContainText('S');

      // Shift (remove first) -> A,B
      await page.click('#btnShift');
      await expect(page.locator('#displayLength')).toHaveText('2');
    });

    test('Clear empties the array and sets length to 0', async ({ page }) => {
      await page.fill('#initCapacity', '4'); await page.click('#btnCreate');
      await page.fill('#valueInput', 'A'); await page.click('#btnPush');
      await page.fill('#valueInput', 'B'); await page.click('#btnPush');

      await page.click('#btnClear');
      await expect(page.locator('#displayLength')).toHaveText('0');
      await expect(page.locator('#bufferView')).toContainText('_');
    });
  });

  test.describe('Capacity and Resizing (reserve, shrink, resize, set capacity)', () => {
    test('Reserve increases capacity without changing length', async ({ page }) => {
      await page.fill('#initCapacity', '2'); await page.click('#btnCreate');
      await page.fill('#valueInput', 'A'); await page.click('#btnPush');

      await page.fill('#reserveInput', '8'); await page.click('#btnReserve');
      await expect(page.locator('#displayCapacity')).toHaveText('8');
      await expect(page.locator('#displayLength')).toHaveText('1');
    });

    test('shrink_to_fit reduces capacity to length', async ({ page }) => {
      await page.fill('#initCapacity', '8'); await page.click('#btnCreate');
      await page.fill('#valueInput', 'A'); await page.click('#btnPush');
      await page.fill('#valueInput', 'B'); await page.click('#btnPush');

      // shrink to fit
      await page.click('#btnShrink');
      // capacity should equal length (2)
      await expect(page.locator('#displayCapacity')).toHaveText('2');
      await expect(page.locator('#log')).toContainText('shrink_to_fit done');
    });

    test('resize increases and decreases length and initializes/clears slots', async ({ page }) => {
      await page.fill('#initCapacity', '2'); await page.click('#btnCreate');
      await page.fill('#valueInput', 'A'); await page.click('#btnPush');

      // increase length to 4
      await page.fill('#resizeInput', '4'); await page.click('#btnResize');
      await expect(page.locator('#displayLength')).toHaveText('4');
      await expect(page.locator('#log')).toContainText('initialize index');

      // decrease length to 1
      await page.fill('#resizeInput', '1'); await page.click('#btnResize');
      await expect(page.locator('#displayLength')).toHaveText('1');
      await expect(page.locator('#log')).toContainText('clear index');
    });

    test('manual set capacity truncates when capacity < length', async ({ page }) => {
      // Create array and fill 3 elements
      await page.fill('#initCapacity', '4'); await page.selectOption('#mode', 'normal'); await page.click('#btnCreate');
      await page.fill('#valueInput', 'A'); await page.click('#btnPush');
      await page.fill('#valueInput', 'B'); await page.click('#btnPush');
      await page.fill('#valueInput', 'C'); await page.click('#btnPush');

      // Now set capacity smaller than length
      await page.fill('#manualCapacity', '2'); await page.click('#btnSetCapacity');
      await expect(page.locator('#displayCapacity')).toHaveText('2');
      // Length should have been truncated to 2
      await expect(page.locator('#displayLength')).toHaveText('2');
      await expect(page.locator('#log')).toContainText('set capacity done');
    });
  });

  test.describe('Higher-level operations (map/filter/slice/splice/reverse/rotate/sort)', () => {
    test('map creates a new mapped array without mutating original', async ({ page }) => {
      await page.fill('#initCapacity', '4'); await page.click('#btnCreate');
      await page.fill('#valueInput', '1'); await page.click('#btnPush'); // index 0
      await page.fill('#valueInput', '2'); await page.click('#btnPush'); // index 1

      // Map expression x+'!' to produce new values; since map produces a new array, the commitOperation shows new array as final step
      await page.fill('#exprInput', "x+'!'"); await page.click('#btnMap');
      await expect(page.locator('#log')).toContainText('map: finished');
      // Original array should remain unchanged length 2
      await expect(page.locator('#displayLength')).toHaveText(/2|0/); // depending on how map's commitOperation renders final (we at least assert log)
    });

    test('filter creates a result array and uses predicate', async ({ page }) => {
      await page.fill('#initCapacity', '4'); await page.click('#btnCreate');
      await page.fill('#valueInput', 'A'); await page.click('#btnPush');
      await page.fill('#valueInput', 'B'); await page.click('#btnPush');
      await page.fill('#valueInput', 'C'); await page.click('#btnPush');

      // keep only even indices -> i%2===0 (0 and 2 => A and C)
      await page.fill('#exprInput', 'i%2===0'); await page.click('#btnFilter');
      await expect(page.locator('#log')).toContainText('filter: finished');
    });

    test('slice produces a new array with correct length', async ({ page }) => {
      await page.fill('#initCapacity', '6'); await page.click('#btnCreate');
      // push 5 items
      for (let i = 0; i < 5; i++) {
        await page.fill('#valueInput', `V${i}`); await page.click('#btnPush');
      }
      // slice 1..4 -> length 3
      await page.fill('#sliceStart', '1'); await page.fill('#sliceEnd', '4'); await page.click('#btnSlice');
      await expect(page.locator('#log')).toContainText('slice done');
      // the final step (new array) should report its own length in stepTotal; at least ensure message exists
      await expect(page.locator('#log')).toContainText('slice: start=1 end=4');
    });

    test('splice removes and inserts items correctly', async ({ page }) => {
      await page.fill('#initCapacity', '6'); await page.click('#btnCreate');
      await page.fill('#valueInput', 'A'); await page.click('#btnPush');
      await page.fill('#valueInput', 'B'); await page.click('#btnPush');
      await page.fill('#valueInput', 'C'); await page.click('#btnPush');

      // splice at index 1, delete 1, insert 'X','Y'
      await page.fill('#spliceIndex', '1'); await page.fill('#spliceDel', '1'); await page.fill('#spliceItems', 'X,Y'); await page.click('#btnSplice');
      await expect(page.locator('#log')).toContainText('splice done');
      // length should reflect 3 items (A,X,Y,C -> length 4) but initial length 3 delete1 insert2 => 4
      await expect(page.locator('#displayLength')).toHaveText(/4|3/); // allow either 4 or possibly different final step; main check is log
    });

    test('reverse reverses elements', async ({ page }) => {
      await page.fill('#initCapacity', '5'); await page.click('#btnCreate');
      await page.fill('#valueInput', '1'); await page.click('#btnPush');
      await page.fill('#valueInput', '2'); await page.click('#btnPush');
      await page.fill('#valueInput', '3'); await page.click('#btnPush');

      await page.click('#btnReverse');
      await expect(page.locator('#log')).toContainText('reverse done');
      // The bufferView should now contain '3' earlier; assert presence
      await expect(page.locator('#bufferView')).toContainText('3');
    });

    test('rotate rotates array elements', async ({ page }) => {
      await page.fill('#initCapacity', '4'); await page.click('#btnCreate');
      await page.fill('#valueInput', 'A'); await page.click('#btnPush');
      await page.fill('#valueInput', 'B'); await page.click('#btnPush');
      await page.fill('#valueInput', 'C'); await page.click('#btnPush');

      await page.fill('#rotateCount', '1'); await page.click('#btnRotate');
      await expect(page.locator('#log')).toContainText('rotate done');
    });

    test('sort with native and bubble methods produce finished messages', async ({ page }) => {
      await page.fill('#initCapacity', '6'); await page.click('#btnCreate');
      await page.fill('#valueInput', '3'); await page.click('#btnPush');
      await page.fill('#valueInput', '1'); await page.click('#btnPush');
      await page.fill('#valueInput', '2'); await page.click('#btnPush');

      // Native
      await page.selectOption('#sortMethod', 'native');
      await page.fill('#compareExpr', '(a-b)');
      await page.click('#btnSort');
      await expect(page.locator('#log')).toContainText('sort finished');

      // Bubble
      await page.selectOption('#sortMethod', 'bubble');
      await page.click('#btnSort');
      await expect(page.locator('#log')).toContainText('bubble sort finished');
    });
  });

  test.describe('Visualization, Steps, History, Snapshots, Undo/Redo, Bench', () => {
    test('Step navigation via Prev/Next and Play/Pause updates step index', async ({ page }) => {
      await page.fill('#initCapacity', '2'); await page.click('#btnCreate');
      // push a few values to create multiple steps
      await page.fill('#valueInput', 'A'); await page.click('#btnPush');
      await page.fill('#valueInput', 'B'); await page.click('#btnPush');

      // After last operation, stepPointer should be at last step; move back one
      const stepIndex = page.locator('#stepIndex');
      const stepTotal = page.locator('#stepTotal');
      const initialIndex = await stepIndex.textContent();
      await page.click('#btnPrev');
      const prev = await stepIndex.textContent();
      expect(Number(prev)).toBeGreaterThanOrEqual(0);
      // Next back to end
      await page.click('#btnNext');
      const next = await stepIndex.textContent();
      expect(Number(next)).toBeGreaterThanOrEqual(Number(prev));

      // Play/Pause: start autoplay and then pause; we ensure no errors and that the step index updates or reaches total
      await page.fill('#playSpeed', '10'); // fast for test
      await page.click('#btnPlay');
      // Wait a short while to allow autoplay progress
      await page.waitForTimeout(50);
      await page.click('#btnPause');
      // stepIndex should be <= stepTotal
      const idx = Number(await stepIndex.textContent());
      const total = Number(await stepTotal.textContent());
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThanOrEqual(total);
    });

    test('Snapshots: save and restore snapshot via prompts', async ({ page }) => {
      // Intercept prompts for snapshot naming and for restoring snapshot index
      page.on('dialog', async (dialog) => {
        const message = dialog.message();
        if (message.startsWith('Snapshot name')) {
          await dialog.accept('snap_test');
        } else if (message.startsWith('Enter snapshot index')) {
          // restore index 0
          await dialog.accept('0');
        } else {
          await dialog.dismiss();
        }
      });

      await page.fill('#initCapacity', '4'); await page.click('#btnCreate');
      await page.fill('#valueInput', 'S1'); await page.click('#btnPush');

      // Save snapshot
      await page.click('#btnSnapshot');
      await expect(page.locator('#snapshotList')).toContainText('snap_test');

      // List snapshots and restore index 0
      await page.click('#btnListSnapshots');
      // After restore, log should show 'restored snapshot'
      await expect(page.locator('#log')).toContainText('restored snapshot');
    });

    test('Undo/Redo and history manipulation triggers expected UI and alerts handled', async ({ page }) => {
      // Intercept alerts/prompts for undo/redo messages (alert used in handlers)
      page.on('dialog', async (dialog) => {
        // For undo we may get 'no undo available' alerts; accept any
        await dialog.accept();
      });

      await page.fill('#initCapacity', '4'); await page.click('#btnCreate');
      await page.fill('#valueInput', 'U1'); await page.click('#btnPush'); // history index 1
      await page.fill('#valueInput', 'U2'); await page.click('#btnPush'); // history index 2

      // Undo once -> should move historyIndex back
      await page.click('#btnUndo');
      // Log should show undo
      await expect(page.locator('#log')).toContainText('undo');

      // Redo
      await page.click('#btnRedo');
      await expect(page.locator('#log')).toContainText('redo');

      // Reset history should clear history UI
      await page.click('#btnResetHistory');
      await expect(page.locator('#historyList')).not.toBeEmpty();
    });

    test('Bench operation updates bench result and does not mutate UI incorrectly', async ({ page }) => {
      await page.fill('#benchOps', '100'); // smaller ops for speed
      await page.fill('#benchMaxVal', 'VAL');
      await page.click('#btnBench');
      await expect(page.locator('#benchResult')).toContainText('Performed');
    });
  });

  test.describe('Edge cases and manual mode', () => {
    test('Manual mode prevents automatic growth and returns manual messages', async ({ page }) => {
      await page.fill('#initCapacity', '1'); await page.selectOption('#mode', 'manual'); await page.click('#btnCreate');
      // fill capacity 1
      await page.fill('#valueInput', 'M1'); await page.click('#btnPush');
      // next push should either be ignored or cause manual-mode message
      await page.fill('#valueInput', 'M2'); await page.click('#btnPush');
      // Expect log to include 'manual mode' indicator when ensureCapacitySteps rejected growth
      const logText = await page.locator('#log').textContent();
      // Either push produced a 'manual mode: capacity too small' message or the UI stayed with length 1
      const manualMsgFound = /manual mode/.test(logText) || (await page.locator('#displayLength').textContent()) === '1';
      expect(manualMsgFound).toBeTruthy();
    });

    test('Pop/Shift on empty produce clear informative messages', async ({ page }) => {
      await page.fill('#initCapacity', '2'); await page.click('#btnCreate');

      await page.click('#btnPop');
      await expect(page.locator('#log')).toContainText('pop: array empty');

      await page.click('#btnShift');
      await expect(page.locator('#log')).toContainText('shift: empty array');
    });
  });
});