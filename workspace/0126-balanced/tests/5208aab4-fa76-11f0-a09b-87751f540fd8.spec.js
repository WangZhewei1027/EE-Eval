import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5208aab4-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Selection Sort Interactive Application (FSM: S0_Idle -> S1_Sorting)', () => {
  let page;
  let context;
  let consoleMessages;
  let pageErrors;

  // Setup a fresh browser context & page for each test and attach listeners
  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page
    page.on('console', (msg) => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      } catch (e) {
        // In rare cases msg.text() can throw; capture minimal info
        consoleMessages.push({ type: msg.type(), text: '<unreadable-console-message>' });
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application under test (listeners attached before navigation)
    await page.goto(APP_URL);
  });

  // Teardown after each test
  test.afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
    if (context) {
      await context.close();
    }
  });

  test('S0_Idle: Page renders static elements and initial DOM evidence exists', async () => {
    // Validate that the header exists and matches expected evidence of S0_Idle
    const headerText = await page.textContent('h1');
    expect(headerText).toBe('Selection Sort');

    // Validate the output paragraph exists and is initially empty (as in the HTML)
    const outputText = await page.textContent('#output');
    // It should be an empty string since the script doesn't set it
    expect(outputText).toBe('');

    // The FSM S0 entry action mentions renderPage(), but the implementation does not define it.
    // Verify that renderPage is not present on the window (we do not call or define it).
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // The implementation does run selectionSort on load, so we expect console logs.
    // Check that the page emitted a console message containing "Original array:"
    const hasOriginalLog = consoleMessages.some(m => m.text.includes('Original array:'));
    expect(hasOriginalLog).toBe(true);

    // Ensure there are no unexpected runtime page errors on initial load
    expect(pageErrors.length).toBe(0);
  });

  test('S1_Sorting: selectionSort runs on load and arr becomes sorted (transition StartSorting)', async () => {
    // Verify that the selectionSort function exists on the page
    const isSelectionSortFn = await page.evaluate(() => typeof window.selectionSort === 'function');
    expect(isSelectionSortFn).toBe(true);

    // The original script declares a global `arr`. Confirm it exists and has the expected initial length
    // (we read it post-execution; it should be mutated to the sorted result after load)
    const arrValue = await page.evaluate(() => window.arr);
    // After the script runs on load, arr should be an array (the code sorts it in-place).
    expect(Array.isArray(arrValue)).toBe(true);
    expect(arrValue.length).toBe(7);

    // Confirm the array is sorted in ascending order as the FSM transition expects
    const expectedSorted = [11, 12, 22, 25, 34, 64, 90];
    const finalArr = await page.evaluate(() => window.arr);
    expect(finalArr).toEqual(expectedSorted);

    // Validate console messages: there should be at least one "Sorted array is:" log emitted during swaps
    const sortedLogs = consoleMessages.filter(m => m.text.includes('Sorted array is:'));
    expect(sortedLogs.length).toBeGreaterThanOrEqual(1);

    // The final "Sorted array is:" message should contain the sorted sequence "11,12,22,25,34,64,90"
    const lastSortedText = sortedLogs[sortedLogs.length - 1].text;
    expect(lastSortedText).toContain('11,12,22,25,34,64,90');

    // Confirm initial "Original array:" log exists
    expect(consoleMessages.some(m => m.text.includes('Original array:'))).toBe(true);

    // No unhandled page errors during the normal load/sort
    expect(pageErrors.length).toBe(0);
  });

  test('Transition verification: StartSorting triggers selectionSort(arr) automatically (observable logs)', async () => {
    // Assert that the automatic transition StartSorting happened by checking console log ordering:
    // There should be an "Original array:" message and then one or more "Sorted array is:" messages.
    const originalIndex = consoleMessages.findIndex(m => m.text.includes('Original array:'));
    const firstSortedIndex = consoleMessages.findIndex(m => m.text.includes('Sorted array is:'));

    expect(originalIndex).toBeGreaterThanOrEqual(0);
    expect(firstSortedIndex).toBeGreaterThanOrEqual(0);
    // The first sorted message should occur after or at the same time as the original log
    expect(firstSortedIndex).toBeGreaterThanOrEqual(originalIndex);

    // Validate expected observable message per FSM: the sorted array final message is present
    const foundFinalSorted = consoleMessages.some(m => m.text.includes('11,12,22,25,34,64,90'));
    expect(foundFinalSorted).toBe(true);
  });

  test('Edge case: sorting small arrays (empty and single element) does not throw and yields expected results', async () => {
    // Call selectionSort on an empty array and verify it completes without throwing and array remains empty
    const resultEmpty = await page.evaluate(() => {
      const a = [];
      try {
        selectionSort(a);
        return { ok: true, value: a };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    });
    expect(resultEmpty.ok).toBe(true);
    expect(resultEmpty.value).toEqual([]);

    // Call selectionSort on a single-element array
    const resultSingle = await page.evaluate(() => {
      const b = [42];
      try {
        selectionSort(b);
        return { ok: true, value: b };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    });
    expect(resultSingle.ok).toBe(true);
    expect(resultSingle.value).toEqual([42]);

    // Call selectionSort on a small unsorted array and ensure it sorts correctly
    const resultSmall = await page.evaluate(() => {
      const c = [3, 1, 2];
      try {
        selectionSort(c);
        return { ok: true, value: c };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    });
    expect(resultSmall.ok).toBe(true);
    expect(resultSmall.value).toEqual([1, 2, 3]);
  });

  test('Error scenario: calling selectionSort(null) should produce a runtime TypeError (observed as thrown and as a pageerror)', async () => {
    // Ensure no prior page errors
    expect(pageErrors.length).toBe(0);

    // Calling selectionSort(null) without catching should cause an error both in evaluate and as a pageerror.
    // We assert that the evaluate promise rejects and that a pageerror is captured.
    await expect(page.evaluate(() => selectionSort(null))).rejects.toThrow();

    // Give the browser a short moment to dispatch pageerror event
    await page.waitForTimeout(50);

    // There should be at least one page error captured
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // The error message should indicate a TypeError or inability to read 'length' from null
    const lastErrorMessage = String(pageErrors[pageErrors.length - 1]?.message || '');
    expect(lastErrorMessage).toMatch(/TypeError|Cannot read|Cannot read properties|cannot read/i);
  });

  test('Sanity check: do not modify global environment (selectionSort exists, renderPage absent)', async () => {
    // Confirm selectionSort is still a function and renderPage is not defined (we did not inject globals)
    const [selectionSortType, renderPageType] = await page.evaluate(() => {
      return [typeof window.selectionSort, typeof window.renderPage];
    });
    expect(selectionSortType).toBe('function');
    expect(renderPageType).toBe('undefined');
  });

  // Additional check: verify that console messages include the intermediate swap logs (evidence of step-by-step sorting)
  test('Intermediate logs: sorting emits intermediate "Sorted array is:" messages during swaps', async () => {
    const swapLogs = consoleMessages.filter(m => m.text.includes('Sorted array is:'));
    // There should be multiple swap logs (at least 1), reflecting swaps during selection sort.
    expect(swapLogs.length).toBeGreaterThanOrEqual(1);

    // Each swap log should contain the prefix text
    for (const msg of swapLogs) {
      expect(msg.text.startsWith('Sorted array is:')).toBe(true);
    }
  });
});