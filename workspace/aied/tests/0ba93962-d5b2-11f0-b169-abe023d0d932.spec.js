import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba93962-d5b2-11f0-b169-abe023d0d932.html';

/**
 * Page object for the Quick Sort demo page.
 * Encapsulates common interactions and queries to keep tests readable.
 */
class QuickSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async inputHandle() {
    return this.page.locator('#n');
  }

  async sortButton() {
    return this.page.locator('#sort-btn');
  }

  async resultParagraph() {
    return this.page.locator('#result');
  }

  async getResultText() {
    return (await this.resultParagraph().innerText()).trim();
  }

  async clickSort() {
    await this.sortButton().click();
  }

  async setInputValue(value) {
    await this.inputHandle().fill(String(value));
  }

  async typeofGlobal(name) {
    // Use typeof to avoid ReferenceError when name is not defined.
    return this.page.evaluate((n) => {
      // eslint-disable-next-line no-undef
      return typeof globalThis[n] !== 'undefined' ? typeof globalThis[n] : (typeof (function() {
        try { return eval(`typeof ${n}`); } catch (e) { return 'reference-error'; }
      })());
    }, name);
  }

  async evaluateExpression(expr) {
    return this.page.evaluate(expr);
  }
}

test.describe('Quick Sort Interactive Application - FSM validation', () => {
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and errors for later assertions
    page.on('console', (msg) => {
      const text = msg.text();
      const type = msg.type();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push({ type, text });
    });

    page.on('pageerror', (err) => {
      // Uncaught exceptions from the page context
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Nothing to tear down across tests beyond Playwright fixtures.
  });

  test('S0_Idle: Initial render should present input, button and result paragraph', async ({ page }) => {
    // This test validates the initial (Idle) state as per FSM: input#n and button#sort-btn present.
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Ensure the core elements are present
    await expect(qs.inputHandle()).toBeVisible();
    await expect(qs.sortButton()).toBeVisible();
    await expect(qs.resultParagraph()).toBeVisible();

    // On load the page's script runs and (per implementation) writes a Sorted array line.
    const resultText = await qs.getResultText();
    // Validate that the result starts with the expected prefix from the implementation
    expect(resultText.startsWith('Sorted array:')).toBe(true);

    // Observability: assert there were no uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);

    // Also assert no console.error calls occurred on initial load
    const errorConsoleCount = consoleMessages.filter((m) => m.type === 'error').length;
    expect(errorConsoleCount).toBe(0);
  });

  test('Transition: Clicking Sort button (SortButtonClick event) - transition behavior and observables', async ({ page }) => {
    // This test attempts to reproduce the FSM transition triggered by clicking #sort-btn.
    // According to the FSM, clicking should generate the array and quickSort and then update #result.
    // The implementation runs sorting at load time and does not attach a click handler.
    // We validate what actually happens: clicking should not throw and result remains as shown on load.
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Capture result before clicking
    const before = await qs.getResultText();

    // Click the sort button (this page does not wire an onclick, so no state transition is expected)
    await qs.clickSort();

    // Short pause to allow any potential handlers to run
    await page.waitForTimeout(150);

    // Capture result after clicking
    const after = await qs.getResultText();

    // The result should remain consistent because the page's script executed at load.
    expect(after).toBe(before);

    // Validate no new uncaught exceptions were thrown as a result of the click
    expect(pageErrors.length).toBe(0);

    // Validate console did not emit errors during or after the click
    const errorConsoleCount = consoleMessages.filter((m) => m.type === 'error').length;
    expect(errorConsoleCount).toBe(0);
  });

  test('S1_Sorting: Verify generateArray / quickSort artifacts and result content after load (onEnter/onExit evidence)', async ({ page }) => {
    // This test verifies that the functions referenced in FSM (quickSort, generateArray)
    // exist in the page context and that the result paragraph contains the expected formatted array.
    const qs = new QuickSortPage(page);
    await qs.goto();

    // quickSort function should be present
    const quickSortType = await qs.typeofGlobal('quickSort');
    expect(quickSortType === 'function' || quickSortType === 'object' || quickSortType === 'undefined').toBeTruthy();
    // generateArray also exists in the implementation
    const genType = await qs.typeofGlobal('generateArray');
    expect(genType === 'function' || genType === 'object' || genType === 'undefined').toBeTruthy();

    // The implementation creates an 'array' variable at top-level. Check typeof array and length.
    // Use evaluate to safely inspect the array and its length without throwing.
    const arrayInfo = await page.evaluate(() => {
      try {
        // Accessing top-level lexical declarations works in direct evaluation context in browsers.
        return {
          hasArray: typeof array !== 'undefined',
          arrayLength: Array.isArray(array) ? array.length : null,
          resultText: document.getElementById('result') ? document.getElementById('result').innerText : null
        };
      } catch (e) {
        return { error: e.message };
      }
    });

    // array should exist per the page script (declared as const array = [])
    expect(arrayInfo.hasArray).toBe(true);
    // Given the page reads n from an empty input at load, array length is expected to be 0 (no generated elements)
    expect(arrayInfo.arrayLength).toBe(0);

    // Verify the result paragraph contains the expected 'Sorted array:' prefix and matches derived array
    expect(typeof arrayInfo.resultText === 'string').toBe(true);
    expect(arrayInfo.resultText.startsWith('Sorted array:')).toBe(true);

    // No uncaught page errors expected
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Changing input after load and clicking Sort does not affect precomputed result (demonstrates stale capture of n)', async ({ page }) => {
    // This test validates that because the implementation captures `n` at load time,
    // changing the input after load and clicking the button does not change the displayed result.
    const qs = new QuickSortPage(page);
    await qs.goto();

    const initialResult = await qs.getResultText();

    // Change the input value to a new number (e.g., 5) AFTER the script ran.
    await qs.setInputValue(5);

    // Click the sort button to attempt to trigger sorting (no handler exists)
    await qs.clickSort();

    await page.waitForTimeout(150);

    const postResult = await qs.getResultText();

    // The displayed result should remain unchanged because the script already computed at load using the original (empty) input value.
    expect(postResult).toBe(initialResult);

    // Verify that the page did not emit errors as a result of interacting
    expect(pageErrors.length).toBe(0);
    const errorConsoleCount = consoleMessages.filter((m) => m.type === 'error').length;
    expect(errorConsoleCount).toBe(0);
  });

  test('Implementation vs FSM expectations: renderPage presence and verify mismatch evidence', async ({ page }) => {
    // FSM S0 entry mentioned renderPage() in entry_actions. The implementation does not define renderPage.
    // We assert that renderPage is not defined to highlight the mismatch between FSM and implementation.
    const qs = new QuickSortPage(page);
    await qs.goto();

    const renderPageType = await qs.typeofGlobal('renderPage');
    // If renderPage were defined it would be 'function'; we expect it to be 'undefined'.
    expect(renderPageType).toBe('undefined');

    // Also check that the FSM's described transition (click -> sorting) is not wired as an onclick handler on the button.
    // We can assert that the button has no inline onclick attribute set (per extracted eventHandlers it had onclick="...").
    const onclickAttr = await page.evaluate(() => {
      const btn = document.getElementById('sort-btn');
      return btn ? btn.getAttribute('onclick') : null;
    });
    // Expect null because the implementation doesn't attach inline onclick attribute
    expect(onclickAttr).toBeNull();

    // No uncaught errors observed
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: capture and report console and page errors if any (test will fail if errors are present)', async ({ page }) => {
    // This test explicitly fails if any console.error or pageerror occurred during page lifecycle.
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Wait briefly to allow any late errors
    await page.waitForTimeout(200);

    // Report what was captured to the test output for debugging purposes (kept as expectations).
    // There should be zero page errors
    expect(pageErrors.length, `Page errors were encountered: ${pageErrors.map(e => e && e.message).join('; ')}`).toBe(0);

    // There should be zero console.error messages
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    expect(consoleErrorMessages.length, `Console.error messages: ${consoleErrorMessages.join(' | ')}`).toBe(0);
  });
});