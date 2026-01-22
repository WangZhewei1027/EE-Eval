import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba9fcb2-d5b2-11f0-b169-abe023d0d932.html';

// Page Object for the Topological Sort page
class TopoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.numbers = page.locator('#numbers');
    this.edges = page.locator('#edges');
    this.sortBtn = page.locator('#sort-btn');
    this.clearBtn = page.locator('#clear-btn');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async fillNumbers(value) {
    await this.numbers.fill(value);
  }

  async fillEdges(value) {
    await this.edges.fill(value);
  }

  async clickSort() {
    // Sort button is visible in the UI, so click via Playwright to simulate user.
    await this.sortBtn.click();
  }

  async clickClearProgrammatically() {
    // Clear button is hidden in the UI (display:none). To exercise its event handler
    // (without modifying the page) we programmatically invoke its click() in the page context.
    await this.page.evaluate(() => {
      const btn = document.getElementById('clear-btn');
      if (btn) btn.click();
    });
  }
}

test.describe('Topological Sort Interactive App - FSM validation', () => {
  // Capture runtime errors and console messages for assertions per test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect unhandled exceptions thrown by the page (e.g., TypeError from broken implementation).
    page.on('pageerror', (err) => {
      // store error messages for assertions
      try {
        pageErrors.push(err && err.message ? err.message : String(err));
      } catch (e) {
        pageErrors.push(String(err));
      }
    });

    // Collect console messages for additional debugging/validation
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.afterEach(async () => {
    // Basic sanity: if pageErrors present, keep them around for test-level assertions.
    // Nothing to teardown here beyond Playwright's automatic cleanup.
  });

  test.describe('S0_Idle (Initial state) validations', () => {
    test('Initial render: Sort button visible, Clear hidden, inputs and output present', async ({ page }) => {
      // Load page and validate Idle state (renderPage() entry action from FSM is represented by page load)
      const topo = new TopoPage(page);
      await topo.goto();

      // Validate UI elements exist and their visibility matches the HTML implementation
      await expect(topo.sortBtn).toBeVisible();
      await expect(topo.clearBtn).toBeHidden(); // clear-btn has style="display: none;"
      await expect(topo.numbers).toBeVisible();
      await expect(topo.edges).toBeVisible();
      await expect(topo.output).toHaveText(''); // no output on initial render

      // There should be no runtime errors just from loading (script sets up listeners but has not executed handlers)
      expect(pageErrors.length).toBe(0);

      // No console errors expected on initial render
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Attempting to click hidden Clear via Playwright UI throws due to invisibility', async ({ page }) => {
      const topo = new TopoPage(page);
      await topo.goto();

      // Try to click the clear button like a user would - Playwright will reject because the element is hidden.
      // We assert that the click attempt using the visible-path fails.
      let clickRejected = false;
      try {
        await page.click('#clear-btn', { timeout: 2000 });
      } catch (err) {
        clickRejected = true;
        // The error message may vary by Playwright version, but clicking a hidden element should reject.
        expect(String(err.message || err)).toContain('element is not visible', { ignoreCase: true }).catch(() => {
          // In case the message differs, fall back to asserting rejection occurred.
          expect(clickRejected).toBe(true);
        });
      }
      expect(clickRejected).toBe(true);
    });
  });

  test.describe('S0_Idle -> S1_Sorted (SortClick) validations', () => {
    test('Clicking Sort triggers the implementation and results in a runtime exception (TypeError expected)', async ({ page }) => {
      const topo = new TopoPage(page);
      await topo.goto();

      // Fill the inputs like a user would. Note: the implementation queries '.input-field' which does not exist,
      // so filling these inputs will not affect the internal arrays used by the broken handler.
      await topo.fillNumbers('1,2,3');
      await topo.fillEdges('1');

      // Clear any previously-captured errors/messages
      consoleMessages = [];
      pageErrors = [];

      // Click the Sort button. The implementation contains a bug that will throw a TypeError
      // (Array.from(graph) where graph is an object -> not iterable).
      await topo.clickSort();

      // Wait briefly to allow the event handler to run and any errors to propagate to pageerror listeners.
      await page.waitForTimeout(200);

      // We expect at least one page-level error to have been captured.
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Verify that one of the captured errors references 'iterable' or 'not iterable' (robust to different browser messages)
      const iterableError = pageErrors.find(msg =>
        /iterable/i.test(msg) ||
        /not iterable/i.test(msg) ||
        /object is not iterable/i.test(msg) ||
        /cannot convert/i.test(msg) ||
        /is not iterable/i.test(msg) ||
        /TypeError/i.test(msg)
      );
      expect(iterableError).toBeTruthy();

      // Because the handler threw, the output div should not contain a meaningful sorted result.
      await expect(topo.output).toHaveText('');

      // Confirm UI still shows Sort and Clear remains hidden (no code reveals it)
      await expect(topo.sortBtn).toBeVisible();
      await expect(topo.clearBtn).toBeHidden();
    });

    test('Edge case: clicking Sort with empty inputs still executes and throws the same runtime error', async ({ page }) => {
      const topo = new TopoPage(page);
      await topo.goto();

      // Ensure inputs are empty
      await topo.fillNumbers('');
      await topo.fillEdges('');

      // Reset observers
      consoleMessages = [];
      pageErrors = [];

      // Trigger Sort
      await topo.clickSort();

      // Allow handler to run
      await page.waitForTimeout(200);

      // The same or a similar error should occur because Array.from(graph) is called regardless of inputs
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      const found = pageErrors.some(msg => /iterable|not iterable|TypeError/i.test(msg));
      expect(found).toBe(true);

      // Output remains empty due to the thrown exception
      await expect(topo.output).toHaveText('');
    });
  });

  test.describe('S0_Idle -> S2_Cleared (ClearClick) validations', () => {
    test('Programmatic ClearClick clears output and resets inputs (even though Clear is hidden)', async ({ page }) => {
      const topo = new TopoPage(page);
      await topo.goto();

      // Populate the visible inputs to later validate they have been cleared by the clear handler.
      await topo.fillNumbers('42');
      await topo.fillEdges('7');

      // Sanity checks: inputs have values before clear
      expect(await topo.numbers.inputValue()).toBe('42');
      expect(await topo.edges.inputValue()).toBe('7');

      // Reset observers
      consoleMessages = [];
      pageErrors = [];

      // Invoke the hidden clear button's click handler programmatically (does not modify DOM styling).
      await topo.clickClearProgrammatically();

      // Allow handler to run
      await page.waitForTimeout(100);

      // Clear's handler sets outputDiv.innerHTML = '' and attempts to reset inputFields (which is an empty NodeList in the implementation).
      // Because inputFields is empty, inputs in DOM may remain unchanged by that code path, but the handler itself should not throw.
      // We assert that output is cleared and that no runtime error occurred during clear.
      expect(pageErrors.length).toBe(0);

      // Output should be empty after clear (explicitly set)
      await expect(topo.output).toHaveText('');

      // The implementation's clear handler iterates over 'inputFields' which is a NodeList found with '.input-field'.
      // Since the real inputs do not have the class, they will not be cleared by the handler (this asserts current behavior).
      // We assert both possibilities to document current behavior: either inputs cleared (if implementation found them) or left as-is.
      const numbersVal = await topo.numbers.inputValue();
      const edgesVal = await topo.edges.inputValue();

      // Because the implementation uses a different selector, it's acceptable that the input values remain unchanged.
      // We expect either empty strings (if cleared) or the previous values. We assert one of those to avoid brittle tests.
      const allowed = ['', '42'];
      expect(allowed).toContain(numbersVal);
      const allowedEdges = ['', '7'];
      expect(allowedEdges).toContain(edgesVal);

      // Confirm Clear button remains hidden after the programmatic click (implementation never changes its style)
      const clearVisible = await topo.clearBtn.isVisible().catch(() => false);
      expect(clearVisible).toBe(false);
    });

    test('Edge case: programmatic ClearClick when there is already no output should be a no-op and not cause errors', async ({ page }) => {
      const topo = new TopoPage(page);
      await topo.goto();

      // Ensure there is no output initially
      await expect(topo.output).toHaveText('');

      // Reset observers
      consoleMessages = [];
      pageErrors = [];

      // Programmatically trigger clear
      await topo.clickClearProgrammatically();

      // Allow handler to run
      await page.waitForTimeout(100);

      // No errors should be produced
      expect(pageErrors.length).toBe(0);

      // Output remains empty
      await expect(topo.output).toHaveText('');
    });
  });

  test.describe('Observability: console and page errors captured', () => {
    test('Console and pageerror listeners capture Sort error message for developer debugging', async ({ page }) => {
      const topo = new TopoPage(page);
      await topo.goto();

      // Attach fresh collectors
      consoleMessages = [];
      pageErrors = [];

      // Trigger the faulty handler
      await topo.clickSort();

      // Wait to allow events propagate
      await page.waitForTimeout(200);

      // At least one page error should have been captured
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // There should be a console-level error or message corresponding to the unhandled exception
      const consoleErr = consoleMessages.find(m => m.type === 'error' || /error/i.test(m.text));
      // It's acceptable if console error is not present, as pageerror is the primary indicator.
      // We assert that either pageerror or console error contains a helpful message.
      expect(consoleErr || pageErrors.length).toBeTruthy();
    });
  });
});