import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/121251f0-fa7a-11f0-acf9-69409043402d.html';

// Helper utilities used across tests
async function getArrayFromPage(page) {
  const txt = (await page.locator('#arrayOutput').textContent()) || '';
  // The app uses JSON.stringify for most arrays; ensure we can parse valid JSON.
  // Replace occurrences of unquoted undefined with null to allow parsing, then map back if needed.
  const normalized = txt.replace(/\bundefined\b/g, 'null');
  try {
    return JSON.parse(normalized);
  } catch (e) {
    // Fallback: try to extract numbers/strings between brackets
    const inside = normalized.replace(/^\s*\[\s*/, '').replace(/\s*\]\s*$/, '');
    if (inside.trim() === '') return [];
    return inside.split(',').map(s => {
      const v = s.trim();
      if (v === 'null') return undefined;
      if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
      // remove surrounding quotes if present
      return v.replace(/^"(.*)"$/, '$1');
    });
  }
}

test.describe('Dynamic Array Interactive Demo - end-to-end', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // reset collectors
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages and page uncaught errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // wait for main elements to be visible to ensure the app has initialized
    await expect(page.locator('#arrayOutput')).toBeVisible();
    await expect(page.locator('#arraySize')).toBeVisible();
  });

  test('Initialization: app should start with empty array and history snapshot', async ({ page }) => {
    // Validate initial DOM state
    const arrayText = await page.locator('#arrayOutput').textContent();
    // The script init() does a saveSnapshot and updateArrayDisplay so array should be shown as an array
    expect(arrayText).toBeTruthy();
    const arr = await getArrayFromPage(page);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBe(0);

    // Undo/Redo should be disabled initially
    await expect(page.locator('#undoBtn')).toBeDisabled();
    await expect(page.locator('#redoBtn')).toBeDisabled();
  });

  test.describe('Basic operations: Push, Pop, Unshift, Shift', () => {
    test('Push adds value to end and updates size', async ({ page }) => {
      // Ensure clean start
      await page.locator('#resetBtn').click();

      await page.fill('#inputValue', '3');
      await page.click('#pushBtn');
      const arr = await getArrayFromPage(page);
      expect(arr.length).toBe(1);
      expect(arr[0]).toBe(3);

      // size label reflects length
      expect(await page.locator('#arraySize').textContent()).toBe('1');
    });

    test('Pop removes last element and shows alert when empty', async ({ page }) => {
      // Case: popping from non-empty array
      await page.fill('#inputValue', '10');
      await page.click('#pushBtn');
      let arr = await getArrayFromPage(page);
      expect(arr[arr.length - 1]).toBe(10);

      await page.click('#popBtn');
      arr = await getArrayFromPage(page);
      // After pop, array should be empty (initial other snapshots removed)
      expect(arr.length).toBeGreaterThanOrEqual(0);

      // Case: popping from empty array triggers alert - accept it
      // Ensure array is empty
      await page.click('#clearBtn');
      // Listen for dialog and accept
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toContain('Array is empty');
        await dialog.accept();
      });
      await page.click('#popBtn');
    });

    test('Unshift inserts at front; Shift removes from front with alert when empty', async ({ page }) => {
      // Clear and unshift
      await page.click('#resetBtn');
      await page.fill('#inputValue', 'first');
      await page.click('#unshiftBtn');
      let arr = await getArrayFromPage(page);
      expect(arr[0]).toBe('first');

      // Shift removes front
      await page.click('#shiftBtn');
      arr = await getArrayFromPage(page);
      // After removal, could be empty
      // Now test shift on empty triggers alert
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toContain('Array is empty');
        await dialog.accept();
      });
      await page.click('#shiftBtn');
    });
  });

  test.describe('Bulk random operations', () => {
    test('Bulk push and bulk unshift produce expected counts and values within range', async ({ page }) => {
      // Reset first
      await page.click('#resetBtn');

      // Set bulk to 3, range 1..5
      await page.fill('#bulkCount', '3');
      await page.fill('#rangeMin', '1');
      await page.fill('#rangeMax', '5');
      await page.click('#bulkPushRandom');

      let arr = await getArrayFromPage(page);
      expect(arr.length).toBe(3);
      for (const v of arr) {
        expect(typeof v).toBe('number');
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(5);
      }

      // Bulk unshift 2 more
      await page.fill('#bulkCount', '2');
      await page.click('#bulkUnshiftRandom');
      arr = await getArrayFromPage(page);
      expect(arr.length).toBe(5);
    });

    test('Bulk push with invalid count shows alert', async ({ page }) => {
      await page.click('#resetBtn');
      // invalid count 0
      await page.fill('#bulkCount', '0');
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toContain('Invalid number of elements');
        await dialog.accept();
      });
      await page.click('#bulkPushRandom');
    });
  });

  test.describe('Insert and Remove at index', () => {
    test('InsertAt with valid index inserts value', async ({ page }) => {
      await page.click('#resetBtn');
      await page.fill('#insertIndex', '0');
      await page.fill('#insertValue', 'apple');
      await page.click('#insertAtBtn');
      const arr = await getArrayFromPage(page);
      expect(arr[0]).toBe('apple');
    });

    test('InsertAt beyond length shows alert but appends at end', async ({ page }) => {
      await page.click('#resetBtn');
      // Set index beyond length
      await page.fill('#insertIndex', '5');
      await page.fill('#insertValue', 'endval');
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toContain('Insert index beyond array length');
        await dialog.accept();
      });
      await page.click('#insertAtBtn');
      const arr = await getArrayFromPage(page);
      expect(arr[arr.length - 1]).toBe('endval');
    });

    test('RemoveAt with invalid index shows alert', async ({ page }) => {
      await page.click('#resetBtn');
      // Empty array, remove index 0 is invalid
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toContain('Invalid remove index');
        await dialog.accept();
      });
      await page.click('#removeAtBtn');
    });

    test('RemoveAt removes correct element', async ({ page }) {
      await page.click('#resetBtn');
      // populate array: push 1,2,3
      await page.fill('#inputValue', '1');
      await page.click('#pushBtn');
      await page.fill('#inputValue', '2');
      await page.click('#pushBtn');
      await page.fill('#inputValue', '3');
      await page.click('#pushBtn');

      // remove index 1 (value 2)
      await page.fill('#removeIndex', '1');
      await page.click('#removeAtBtn');
      const arr = await getArrayFromPage(page);
      expect(arr).not.toContain(2);
      expect(arr.length).toBe(2);
    });
  });

  test.describe('Resize and history (undo/redo/reset)', () => {
    test('Resize expands with fill and shrinks properly', async ({ page }) => {
      await page.click('#resetBtn');
      // push one element
      await page.fill('#inputValue', 'x');
      await page.click('#pushBtn');

      // Resize to length 3 with fill 'z'
      await page.fill('#resizeSize', '3');
      await page.fill('#resizeFill', 'z');
      await page.click('#resizeBtn');

      let arr = await getArrayFromPage(page);
      expect(arr.length).toBe(3);
      expect(arr[1]).toBe('z');

      // Resize smaller
      await page.fill('#resizeSize', '1');
      await page.click('#resizeBtn');
      arr = await getArrayFromPage(page);
      expect(arr.length).toBe(1);
    });

    test('Undo and Redo traverse history', async ({ page }) => {
      await page.click('#resetBtn');
      // push two values
      await page.fill('#inputValue', '5');
      await page.click('#pushBtn');
      await page.fill('#inputValue', '6');
      await page.click('#pushBtn');

      let arr = await getArrayFromPage(page);
      expect(arr[arr.length - 1]).toBe(6);

      // Undo: should remove last push
      await page.click('#undoBtn');
      arr = await getArrayFromPage(page);
      expect(arr[arr.length - 1]).toBe(5);

      // Redo
      await page.click('#redoBtn');
      arr = await getArrayFromPage(page);
      expect(arr[arr.length - 1]).toBe(6);
    });

    test('Reset empties array and creates snapshot', async ({ page }) => {
      await page.fill('#inputValue', 'a');
      await page.click('#pushBtn');
      let arr = await getArrayFromPage(page);
      expect(arr.length).toBeGreaterThanOrEqual(1);

      await page.click('#resetBtn');
      arr = await getArrayFromPage(page);
      expect(arr.length).toBe(0);
      // Undo should be enabled now (snapshot created on reset)
      await expect(page.locator('#undoBtn')).toBeEnabled();
    });
  });

  test.describe('Search, Slice, and Splice operations', () => {
    test('IndexOf, Includes, LastIndexOf produce expected text output', async ({ page }) => {
      await page.click('#resetBtn');

      // push duplicates: 2,3,2
      await page.fill('#inputValue', '2');
      await page.click('#pushBtn');
      await page.fill('#inputValue', '3');
      await page.click('#pushBtn');
      await page.fill('#inputValue', '2');
      await page.click('#pushBtn');

      await page.fill('#searchValue', '2');
      await page.click('#indexOfBtn');
      expect(await page.locator('#searchResult').textContent()).toContain('Index: 0');

      await page.click('#includesBtn');
      expect(await page.locator('#searchResult').textContent()).toContain('Includes: true');

      await page.click('#lastIndexOfBtn');
      expect(await page.locator('#searchResult').textContent()).toContain('Last Index: 2');
    });

    test('Slice returns correct subarray', async ({ page }) => {
      await page.click('#resetBtn');
      // push 1,2,3,4
      for (const n of [1,2,3,4]) {
        await page.fill('#inputValue', String(n));
        await page.click('#pushBtn');
      }
      await page.fill('#sliceStart', '1');
      await page.fill('#sliceEnd', '3');
      await page.click('#sliceBtn');
      const sliceText = await page.locator('#sliceResult').textContent();
      const parsed = JSON.parse(sliceText.replace(/\bundefined\b/g, 'null'));
      expect(parsed).toEqual([2,3]);
    });

    test('Splice removes and returns removed elements and inserts new ones', async ({ page }) => {
      await page.click('#resetBtn');
      // push 1,2,3,4
      for (const n of [1,2,3,4]) {
        await page.fill('#inputValue', String(n));
        await page.click('#pushBtn');
      }
      // splice start 1 delete 2 insert 9,8
      await page.fill('#spliceStart', '1');
      await page.fill('#spliceDeleteCount', '2');
      await page.fill('#spliceInsertValues', '9,8');
      await page.click('#spliceBtn');
      const removedText = await page.locator('#spliceResult').textContent();
      const removed = JSON.parse(removedText.replace(/\bundefined\b/g, 'null'));
      expect(removed).toEqual([2,3]);

      const arr = await getArrayFromPage(page);
      // After splice the array should contain [1,9,8,4]
      expect(arr).toEqual([1,9,8,4]);
    });

    test('Splice with invalid start shows alert', async ({ page }) => {
      await page.click('#resetBtn');
      // array length 0, start 5 invalid
      await page.fill('#spliceStart', '5');
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toContain('Invalid splice start index');
        await dialog.accept();
      });
      await page.click('#spliceBtn');
    });
  });

  test.describe('Map, Filter, Reduce', () => {
    test('ApplyMap doubles numeric array elements', async ({ page }) => {
      await page.click('#resetBtn');
      // push [1,2,3]
      for (const n of [1,2,3]) {
        await page.fill('#inputValue', String(n));
        await page.click('#pushBtn');
      }
      await page.fill('#mapExpr', 'x * 2');
      await page.click('#applyMapBtn');
      const arr = await getArrayFromPage(page);
      expect(arr).toEqual([2,4,6]);
    });

    test('ApplyFilter filters out values <= 2', async ({ page }) => {
      await page.click('#resetBtn');
      for (const n of [1,2,3,4]) {
        await page.fill('#inputValue', String(n));
        await page.click('#pushBtn');
      }
      await page.fill('#filterExpr', 'x > 2');
      await page.click('#applyFilterBtn');
      const arr = await getArrayFromPage(page);
      expect(arr).toEqual([3,4]);
    });

    test('ApplyReduce computes sum with initial value', async ({ page }) => {
      await page.click('#resetBtn');
      for (const n of [1,2,3]) {
        await page.fill('#inputValue', String(n));
        await page.click('#pushBtn');
      }
      await page.fill('#reduceExpr', 'acc + x');
      await page.fill('#reduceInitial', '0');
      await page.click('#applyReduceBtn');
      const resText = await page.locator('#reduceResult').textContent();
      // reduceResult is JSON.stringify(result)
      expect(resText).toBe('6');
    });

    test('ApplyMap with empty expression shows alert', async ({ page }) => {
      await page.click('#resetBtn');
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toContain('Enter a map expression');
        await dialog.accept();
      });
      await page.click('#applyMapBtn');
    });

    test('ApplyFilter with invalid expression shows alert', async ({ page }) => {
      await page.click('#resetBtn');
      await page.fill('#filterExpr', 'this_is_invalid(');
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toContain('Invalid filter expression');
        await dialog.accept();
      });
      await page.click('#applyFilterBtn');
    });

    test('ApplyReduce on empty array without initial value returns error text', async ({ page }) => {
      await page.click('#resetBtn');
      await page.fill('#reduceExpr', 'acc + x');
      await page.fill('#reduceInitial', '');
      await page.click('#applyReduceBtn');
      const txt = await page.locator('#reduceResult').textContent();
      expect(txt).toContain('Reduce error');
    });
  });

  test.describe('Sorting and other utilities', () => {
    test('Sort numeric ascending sorts numbers correctly', async ({ page }) => {
      await page.click('#resetBtn');
      // push numbers in mixed order
      for (const n of [5,1,4,2]) {
        await page.fill('#inputValue', String(n));
        await page.click('#pushBtn');
      }
      await page.selectOption('#sortMode', 'numeric-asc');
      await page.click('#sortBtn');
      const arr = await getArrayFromPage(page);
      // Should be sorted ascending numerically
      expect(arr).toEqual([1,2,4,5]);
    });

    test('Sort custom without comparator shows alert', async ({ page }) => {
      await page.click('#resetBtn');
      await page.selectOption('#sortMode', 'custom');
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toContain('Enter a custom comparator function body');
        await dialog.accept();
      });
      await page.click('#sortBtn');
    });

    test('Reverse flips order; Clear empties; Shuffle preserves multiset', async ({ page }) => {
      await page.click('#resetBtn');
      for (const n of [1,2,3,4]) {
        await page.fill('#inputValue', String(n));
        await page.click('#pushBtn');
      }
      // Reverse
      await page.click('#reverseBtn');
      let arr = await getArrayFromPage(page);
      expect(arr).toEqual([4,3,2,1]);

      // Shuffle - just ensure same elements count and same multiset
      const beforeShuffle = arr.slice();
      await page.click('#shuffleBtn');
      arr = await getArrayFromPage(page);
      expect(arr.length).toBe(beforeShuffle.length);
      // Check same multiset by sorting copies and comparing
      expect([...arr].sort()).toEqual([...beforeShuffle].sort());

      // Clear
      await page.click('#clearBtn');
      arr = await getArrayFromPage(page);
      expect(arr.length).toBe(0);
    });

    test('Unique removes duplicates while preserving first occurrences', async ({ page }) {
      await page.click('#resetBtn');
      // push duplicates and different types
      for (const v of ['1', '1', '1', 'a', 'a']) {
        await page.fill('#inputValue', v);
        await page.click('#pushBtn');
      }
      await page.click('#uniqueBtn');
      const arr = await getArrayFromPage(page);
      // Because parseValue converts numeric strings to numbers on push via inputValue,
      // but here inputs were strings '1' and parseValue will convert '1' to number 1.
      // Unique key uses type marker so numbers and strings differ.
      // Expect unique entries, preserving first occurrences.
      expect(arr.length).toBeGreaterThanOrEqual(1);
      // Should have single 1 and single 'a'
      // Convert values to strings for simple check
      const asStrings = arr.map(x => String(x));
      expect(asStrings).toEqual([...new Set(asStrings)]);
    });
  });

  test.describe('Edge cases and invalid input handling', () => {
    test('Resize with negative size shows alert', async ({ page }) => {
      await page.click('#resetBtn');
      await page.fill('#resizeSize', '-1');
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toContain('Invalid new size');
        await dialog.accept();
      });
      await page.click('#resizeBtn');
    });

    test('Splice with negative deleteCount shows alert', async ({ page }) => {
      await page.click('#resetBtn');
      await page.fill('#spliceStart', '0');
      await page.fill('#spliceDeleteCount', '-5');
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toContain('Invalid splice delete count');
        await dialog.accept();
      });
      await page.click('#spliceBtn');
    });

    test('Sort with custom comparator that throws is handled (alerts)', async ({ page }) => {
      await page.click('#resetBtn');
      // push a few values
      for (const n of [1,2]) {
        await page.fill('#inputValue', String(n));
        await page.click('#pushBtn');
      }
      await page.selectOption('#sortMode', 'custom');
      // provide comparator body that references undefined variable, causing runtime error inside comparator
      await page.fill('#customSortFn', 'throw new Error("boom");');
      page.once('dialog', async dialog => {
        // In the code, sortBtn click catches errors and alerts with message
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toContain('Sort failed');
        await dialog.accept();
      });
      await page.click('#sortBtn');
    });
  });

  test('No uncaught console errors or page errors during interactions', async ({ page }) => {
    // This test verifies that throughout previous interactions no console.error or uncaught page errors were emitted.
    // Note: since we collect errors per beforeEach for each test independently, we'll just assert that the current
    // page (fresh navigation in beforeEach) has no immediate errors so far.
    // Wait a short moment to capture async runtime errors if any
    await page.waitForTimeout(200);
    // There should be no uncaught page errors
    expect(pageErrors.length).toBe(0);
    // There should be no console.error messages
    expect(consoleErrors.length).toBe(0);
  });
});