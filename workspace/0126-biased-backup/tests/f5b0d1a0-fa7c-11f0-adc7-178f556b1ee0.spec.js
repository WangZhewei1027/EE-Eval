import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b0d1a0-fa7c-11f0-adc7-178f556b1ee0.html';

// Helper page object for the Radix Sort demo
class RadixSortPage {
  constructor(page) {
    this.page = page;
    this.button = page.locator('button[onclick="radixSort()"]');
    this.h1 = page.locator('h1');
    this.explanations = page.locator('.text-explanation');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickSortButton() {
    await this.button.click();
  }

  async hasRenderPageFunction() {
    return await this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }

  async callRadixSortWithArray(arr) {
    // We deliberately call the in-page function to let its runtime errors surface.
    return await this.page.evaluate((a) => {
      // Intentionally call the global function; let errors happen naturally.
      return window.radixSort(a);
    }, arr);
  }
}

test.describe('Radix Sort FSM - f5b0d1a0-fa7c-11f0-adc7-178f556b1ee0', () => {
  // Collect pageerrors and console messages for assertions in each test.
  test.beforeEach(async ({ page }) => {
    // Nothing here; navigation and listeners are set in each test to keep isolation.
  });

  test.afterEach(async ({ page }) => {
    // Ensure page is closed between tests by Playwright automatically.
  });

  test('S0_Idle: Page renders with expected content and Sort button is present (Idle state)', async ({ page }) => {
    // Validate initial render state: the page loads, title and header exist, and the Sort button is visible.
    const errors = [];
    page.on('pageerror', (err) => errors.push(err));
    const consoles = [];
    page.on('console', (msg) => consoles.push({ type: msg.type(), text: msg.text() }));

    const radix = new RadixSortPage(page);
    await radix.goto();

    // Basic DOM assertions for Idle state
    await expect(radix.h1).toHaveText(/Radix Sort/i);
    await expect(radix.button).toBeVisible();
    await expect(radix.button).toHaveText('Sort the List');

    // The FSM's S0_Idle entry action claims renderPage() should be executed.
    // The implementation does not define renderPage; assert that fact explicitly.
    const hasRenderPage = await radix.hasRenderPageFunction();
    // We expect renderPage to be undefined since the HTML doesn't define it.
    expect(hasRenderPage).toBe(false);

    // Verify that no unexpected page errors occurred purely on load (if any, we'll surface them).
    // It's okay if there are console messages; capture them for debugging, assert none are fatal.
    expect(errors.length).toBe(0);

    // The DOM should not have produced any sorted list elements; the button remains present.
    await expect(radix.button).toBeVisible();
  });

  test('SortButtonClick event: clicking the Sort button triggers radixSort() and produces a page error (Sorting state)', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Sorting upon clicking the button.
    // It also asserts the runtime error that occurs because the button calls radixSort() with no args.

    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const consoles = [];
    page.on('console', (msg) => consoles.push({ type: msg.type(), text: msg.text() }));

    const radix = new RadixSortPage(page);
    await radix.goto();

    // Confirm pre-click: no errors
    expect(pageErrors.length).toBe(0);

    // Click the button; the inline onclick calls radixSort() without arguments.
    // The function expects an array and will throw; we intentionally allow that to happen.
    await radix.button.click();

    // Wait a short time to allow the pageerror to be emitted.
    await page.waitForTimeout(200);

    // We expect at least one page error occurred as a result of calling radixSort() with undefined arr.
    expect(pageErrors.length).toBeGreaterThan(0);

    // Inspect the first error to ensure it's associated with the arr/buckets undefined problem.
    const errorMessage = String(pageErrors[0].message || pageErrors[0]);
    // Robust regex to match likely error messages across browsers/engines.
    expect(errorMessage.toLowerCase()).toMatch(/(arr|undefined|iterable|not defined|is not defined|cannot|reading)/i);

    // The UI should still show the Sort button (no navigation or destructive DOM change).
    await expect(radix.button).toBeVisible();
    // No new sorted list DOM nodes are expected; the page simply errored.
  });

  test('S1_Sorting via direct invocation: calling radixSort with a valid array leads to a ReferenceError for buckets', async ({ page }) => {
    // The implementation has a bug: buckets is declared inside the while loop block, and later referenced outside,
    // which should result in a ReferenceError ("buckets is not defined"). We assert that error surfaces.

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const radix = new RadixSortPage(page);
    await radix.goto();

    // Call the function with a valid array via evaluate and capture the thrown exception.
    let caught = null;
    try {
      // This call is expected to throw; we let it throw and catch it here to assert on the message.
      await radix.callRadixSortWithArray([3, 1, 2]);
    } catch (err) {
      caught = err;
    }

    // Ensure an error was thrown during evaluate
    expect(caught).not.toBeNull();

    const errMsg = String(caught && (caught.message || caught));
    // The error should mention 'buckets' or 'is not defined' or similar.
    expect(errMsg.toLowerCase()).toMatch(/(buckets|is not defined|not defined|referenceerror)/i);

    // Also confirm that the pageerror was emitted in-page (some engines emit both).
    // Allow some time for the pageerror handler to receive the error.
    await page.waitForTimeout(100);
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const pageErrMsg = String(pageErrors[0].message || pageErrors[0]);
    expect(pageErrMsg.toLowerCase()).toMatch(/(buckets|is not defined|not defined|referenceerror)/i);
  });

  test('Edge cases: calling radixSort with an empty array and checking resulting errors', async ({ page }) => {
    // Calling radixSort([]) is another edge case: while loop may not execute, but buckets will be undefined
    // outside the loop, leading to a ReferenceError. We assert this behavior.

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const radix = new RadixSortPage(page);
    await radix.goto();

    // Call with empty array and capture the thrown error
    let caught = null;
    try {
      await radix.callRadixSortWithArray([]);
    } catch (err) {
      caught = err;
    }

    expect(caught).not.toBeNull();
    const errMsg = String(caught && (caught.message || caught));
    expect(errMsg.toLowerCase()).toMatch(/(buckets|is not defined|not defined|referenceerror)/i);

    // Confirm pageerror emitted
    await page.waitForTimeout(100);
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Sanity check: verify onclick attribute and component signature match FSM evidence', async ({ page }) => {
    // Confirm the presence of the button with the exact onclick attribute specified by the FSM.
    const radix = new RadixSortPage(page);
    await radix.goto();

    // FSM evidence suggests selector button[onclick='radixSort()'] exists.
    // We assert that the attribute value contains radixSort() - exact quoting may vary in serialization,
    // but the attribute should include the function call.
    const onclickValue = await page.locator('button').getAttribute('onclick');
    expect(onclickValue).toBeTruthy();
    expect(onclickValue).toContain('radixSort');

    // Ensure clicking doesn't remove the button even after errors.
    // We intentionally ignore the thrown error and just ensure the button remains in DOM afterward.
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    // Click and ignore promise rejection from page error (we do not call evaluate here).
    await radix.button.click();
    await page.waitForTimeout(150);

    // Button should still be visible.
    await expect(radix.button).toBeVisible();
    // There should be at least one page error recorded from the click.
    expect(pageErrors.length).toBeGreaterThan(0);
  });
});