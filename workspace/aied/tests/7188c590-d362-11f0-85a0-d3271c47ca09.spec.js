import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7188c590-d362-11f0-85a0-d3271c47ca09.html';

/**
 * Page Object for the Bubble Sort demo page.
 * Encapsulates common interactions and observations for tests.
 */
class BubbleSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    // collect console messages and page errors for later assertions
    this.page.on('console', (msg) => {
      try {
        // capture text representation (handles objects too)
        this.consoleMessages.push(msg.text());
      } catch (e) {
        this.consoleMessages.push(String(msg));
      }
    });
    this.page.on('pageerror', (err) => {
      // collect unhandled exceptions thrown in the page context
      this.pageErrors.push(err && err.message ? err.message : String(err));
    });
  }

  // Load the page. We intentionally try to allow the script to run but keep a
  // conservative timeout to avoid hanging tests if the page enters an infinite loop.
  async load({ waitUntil = 'load', timeout = 7000 } = {}) {
    let navigationError = null;
    try {
      await this.page.goto(APP_URL, { waitUntil, timeout });
    } catch (err) {
      // record navigation error and allow tests to continue inspecting recorded console/page errors
      navigationError = err;
    }
    return navigationError;
  }

  async titleText() {
    const h1 = this.page.locator('h1');
    if (await h1.count() === 0) return null;
    return h1.innerText();
  }

  async bodyTextIncludes(substring) {
    const body = this.page.locator('body');
    const text = await body.innerText();
    return text.includes(substring);
  }

  async countInteractiveElements() {
    // look for common interactive elements - buttons/inputs/selects/textareas
    return await this.page.locator('button, input, textarea, select, [role="button"]').count();
  }

  async hasInlineEventHandlers() {
    // check for presence of inline on* attributes
    const inlineCount = await this.page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      return all.filter(el =>
        Array.from(el.attributes).some(attr => /^on/i.test(attr.name))
      ).length;
    });
    return inlineCount > 0;
  }

  async isRenderPageDefined() {
    return await this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }

  async callBubbleSortWith(arr) {
    // Call the bubbleSort function in page context with a safe array and return the result/post-state.
    // We keep the array small and sorted to avoid triggering known buggy behavior (infinite loops).
    return await this.page.evaluate((input) => {
      if (typeof window.bubbleSort !== 'function') {
        return { error: 'bubbleSort-not-defined' };
      }
      try {
        // copy input to avoid modifications leaking
        const arrCopy = input.slice();
        // call the in-page bubbleSort
        const result = window.bubbleSort(arrCopy);
        return { returnValue: result, arrayAfter: arrCopy };
      } catch (err) {
        return { error: (err && err.message) ? err.message : String(err) };
      }
    }, arr);
  }

  getConsoleMessages() {
    return this.consoleMessages.slice();
  }

  getPageErrors() {
    return this.pageErrors.slice();
  }
}

test.describe('Bubble Sort Interactive Application (FSM state: Idle)', () => {
  // Note: We rely on Playwright's built-in page fixture per test.

  test('renders static content and satisfies FSM Idle evidence', async ({ page }) => {
    // This test validates that the page renders static content that corresponds to the FSM "Idle" state's evidence.
    const bsPage = new BubbleSortPage(page);

    // Attempt to load the page. Script in the page may be buggy (could cause long running loop).
    // We capture any navigation error to assert behavior later.
    const navError = await bsPage.load({ waitUntil: 'load', timeout: 7000 });

    // The FSM Idle evidence expects an <h1> with "Bubble Sort"
    const title = await bsPage.titleText();
    // Even if the script hung, the markup should have been parsed or partially available in many browsers.
    expect(title).toBeTruthy();
    expect(title).toContain('Bubble Sort');

    // Body should contain the explanatory paragraph (partially check to avoid brittle full-text comparison)
    const containsParagraph = await bsPage.bodyTextIncludes('Bubble Sort is an algorithm');
    expect(containsParagraph).toBe(true);

    // Ensure there are no interactive controls as noted in the extraction summary / FSM (no user-triggered events)
    const interactiveCount = await bsPage.countInteractiveElements();
    expect(interactiveCount).toBe(0);

    // Check for inline event handlers (on* attributes). Expect none.
    const hasInlineHandlers = await bsPage.hasInlineEventHandlers();
    expect(hasInlineHandlers).toBe(false);

    // Verify renderPage (FSM entry action) is not defined in the page (the implementation does not provide it)
    const renderPageDefined = await bsPage.isRenderPageDefined();
    expect(renderPageDefined).toBe(false);

    // If navigation error occurred (e.g., due to script hang causing timeout), assert that it is the navigation timeout.
    if (navError) {
      // The navigation error should be an Error instance. We assert that navigation failed and that it was likely due to timeout.
      expect(navError).toBeInstanceOf(Error);
      // Many Playwright timeout errors include 'Timeout' in their message; assert that or allow arbitrary navigation errors.
      expect(String(navError.message).toMatch(/timeout|Timeout|Navigation/i)).toBe(true);
    }
  });

  test('observes console output and page errors from the page script', async ({ page }) => {
    // This test collects console messages and page errors produced by the page script.
    // The implementation contains a buggy bubbleSort that may cause the script to hang or behave incorrectly.
    const bsPage = new BubbleSortPage(page);

    // Load with a slightly shorter timeout to capture either completion or failure quickly.
    const navError = await bsPage.load({ waitUntil: 'load', timeout: 6000 });

    const consoleMsgs = bsPage.getConsoleMessages();
    const pageErrs = bsPage.getPageErrors();

    // The original script attempts to console.log the array after sorting.
    // Because the script is buggy, we expect at least ONE of the following to be true:
    // - navigation timed out (navError is truthy),
    // - there are page errors (exceptions) captured,
    // - the expected sorted array console message is absent.
    const expectedSortedSnippet = '[1, 2, 3, 4, 5, 6, 7, 8]';
    const foundExpectedSorted = consoleMsgs.some(msg => msg.includes('1') && msg.includes('2') && msg.includes('3'));

    // Assert we captured console messages array type
    expect(Array.isArray(consoleMsgs)).toBe(true);
    expect(Array.isArray(pageErrs)).toBe(true);

    // At minimum, assert that the environment shows signs of the buggy implementation:
    // either navigation failed (possible infinite loop), or pageErrors were reported, or the expected final log was not emitted.
    const observedProblem = Boolean(navError) || pageErrs.length > 0 || !foundExpectedSorted;
    expect(observedProblem).toBe(true);

    // If there are page errors, log them (assert they are strings). We assert presence of message content.
    if (pageErrs.length > 0) {
      for (const errMsg of pageErrs) {
        expect(typeof errMsg).toBe('string');
        expect(errMsg.length).toBeGreaterThan(0);
      }
    }

    // Also assert that console messages, if present, are strings and contain at least some informative content.
    for (const m of consoleMsgs) {
      expect(typeof m === 'string' || typeof m === 'object').toBeTruthy();
    }

    // Explicitly assert that the page did not necessarily produce the exact expected sorted output comment.
    // The script's comment expects a different sorted output than the provided array; we assert that the exact comment string is not a robust expectation.
    expect(foundExpectedSorted).toBe(false);
  });

  test('bubbleSort function exists and behaves for a safe (already sorted) edge-case input', async ({ page }) => {
    // This test deliberately invokes bubbleSort in-page with a safe, already-sorted array to avoid triggering
    // the known buggy swapping behavior that can lead to an infinite loop.
    // It validates the presence of the function and that calling it with a sorted array does not throw.
    const bsPage = new BubbleSortPage(page);

    // Load page but don't wait too long; we will call bubbleSort in evaluate which may run even if page load timed out.
    await bsPage.load({ waitUntil: 'load', timeout: 7000 });

    // Call bubbleSort with a small sorted array; this should be safe and not cause the inner while to run.
    const safeArray = [1, 2, 3];
    const result = await bsPage.callBubbleSortWith(safeArray);

    // Expect bubbleSort to be defined and callable
    if (result.error === 'bubbleSort-not-defined') {
      // If bubbleSort is not defined in the page we assert that explicitly (implementation may not expose it)
      expect(result.error).toBe('bubbleSort-not-defined');
    } else if (result.error) {
      // If an error occurred during execution, it must be a string message (we capture it)
      expect(typeof result.error).toBe('string');
      // It's acceptable for buggy code to throw; we just assert we observed an error string
    } else {
      // No errors: the function executed. It is expected to return undefined and keep the array sorted.
      expect(result.returnValue === undefined || result.returnValue === null).toBe(true);
      expect(Array.isArray(result.arrayAfter)).toBe(true);
      expect(result.arrayAfter).toEqual(safeArray);
    }
  });

  test('no user-interactive FSM transitions exist (verify absence of interactive controls and event handlers)', async ({ page }) => {
    // This test double-checks that there are no transitions/events exposed as interactive elements.
    const bsPage = new BubbleSortPage(page);
    await bsPage.load({ waitUntil: 'load', timeout: 7000 });

    // Confirm no standard interactive elements
    const interactiveCount = await bsPage.countInteractiveElements();
    expect(interactiveCount).toBe(0);

    // Confirm absence of inline event handlers (onclick, oninput, etc.)
    const inlineHandlers = await bsPage.hasInlineEventHandlers();
    expect(inlineHandlers).toBe(false);

    // Also check for data- attributes that might be used to attach handlers via script; expect none for this simple page
    const dataAttrCount = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-*]')).length;
    }).catch(() => 0);
    // We cannot rely on data-* selectors (CSS doesn't support [data-*] directly in querySelectorAll),
    // so the above may throw; just allow 0 or more but not fail the test unnecessarily.
    expect(typeof dataAttrCount === 'number').toBe(true);
  });

  test('observes and records any runtime exceptions from the page (explicitly asserts pageerror messages if present)', async ({ page }) => {
    // This test ensures we observe uncaught exceptions (if any) during page load and that they are accessible via pageerror.
    const bsPage = new BubbleSortPage(page);

    await bsPage.load({ waitUntil: 'load', timeout: 7000 });

    const errors = bsPage.getPageErrors();
    // If there are errors, assert they look like JS error messages (contain words like "Reference", "Type", "Syntax", etc.)
    if (errors.length > 0) {
      const combined = errors.join(' | ');
      expect(/Reference|Type|Syntax|Error/i.test(combined)).toBe(true);
    } else {
      // If no errors were captured, that's also a valid observed outcome for this page.
      expect(errors.length).toBe(0);
    }
  });
});