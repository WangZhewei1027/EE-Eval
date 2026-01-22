import { test, expect } from '@playwright/test';

// Test suite for Application ID: 71887771-d362-11f0-85a0-d3271c47ca09
// URL served at:
// http://127.0.0.1:5500/workspace/batch-1207/html/71887771-d362-11f0-85a0-d3271c47ca09.html
//
// These tests validate the single FSM state (S0_Idle) and the entry action displayUnion.
// They also inspect the page for interactive elements (there should be none),
// validate exported functions existence, and intentionally trigger an error scenario
// by calling displayUnion with invalid (null) inputs to observe natural runtime errors.
// The tests deliberately do NOT modify page globals or patch any functions.

const APP_URL =
  'http://127.0.0.1:5500/workspace/batch-1207/html/71887771-d362-11f0-85a0-d3271c47ca09.html';

// Page object encapsulating common operations on the union-find page.
class UnionPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Array} consoles array to capture console messages
   * @param {Array} pageErrors array to capture page errors
   */
  constructor(page, consoles, pageErrors) {
    this.page = page;
    this.consoles = consoles;
    this.pageErrors = pageErrors;
  }

  // Return innerHTML of #union-find element (may be empty string)
  async getUnionFindContent() {
    // Use evaluate to guard against element missing
    return await this.page.evaluate(() => {
      const el = document.getElementById('union-find');
      return el ? el.innerHTML : null;
    });
  }

  // Call displayUnion in the page context with provided args
  async callDisplayUnion(subsets, elements) {
    return await this.page.evaluate(
      ({ subsets, elements }) => {
        // Call the global function as-is; allow natural errors to surface.
        return displayUnion(subsets, elements);
      },
      { subsets, elements }
    );
  }

  // Helper to check existence/type of a global function name
  async typeofGlobal(name) {
    return await this.page.evaluate((n) => typeof window[n], name);
  }

  // Count interactive elements on the page
  async countInteractiveElements() {
    return await this.page.evaluate(() => {
      const selectors = ['button', 'input', 'select', 'textarea', 'a'];
      return selectors.reduce((acc, sel) => acc + document.querySelectorAll(sel).length, 0);
    });
  }
}

test.describe('Union-Find interactive application (Application ID: 71887771-d362-11f0-85a0-d3271c47ca09)', () => {
  // Arrays capturing console messages and page errors per test
  let consoles;
  let pageErrors;
  let unionPage;

  // Create fresh listeners and navigate before each test to ensure isolation.
  test.beforeEach(async ({ page }) => {
    consoles = [];
    pageErrors = [];

    // Capture all console messages
    page.on('console', (msg) => {
      // Push an object with type and text for richer assertions
      consoles.push({ type: msg.type(), text: msg.text() });
    });

    // Capture all page runtime errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // err is an Error; record its message and stack lightly
      pageErrors.push({ message: err.message, stack: err.stack });
    });

    // Navigate to the application page and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Create page object instance
    unionPage = new UnionPage(page, consoles, pageErrors);
  });

  test.afterEach(async () => {
    // Cleanup references (not strictly necessary, but explicit)
    consoles = [];
    pageErrors = [];
    unionPage = null;
  });

  test('Initial state (S0_Idle) should run entry action displayUnion and update the DOM (entry action observed)', async () => {
    // The FSM S0_Idle has entry action displayUnion(['A', 'B'], ['a', 'b'])
    // Validate that displayUnion exists and was executed by checking the target element.
    // The provided implementation produces an empty string for the result, so we expect ''.
    const content = await unionPage.getUnionFindContent();

    // Assert the element exists (null would indicate the element is missing)
    expect(content).not.toBeNull();

    // According to the implementation, displayUnion runs on load and sets innerHTML to a string.
    // In the current implementation that string is empty, so we expect an empty string.
    expect(content).toBe('');

    // Verify the global function displayUnion exists and is a function
    const typeofDisplayUnion = await unionPage.typeofGlobal('displayUnion');
    expect(typeofDisplayUnion).toBe('function');

    // Also ensure the other helper functions exist (they are referenced in the script)
    const expectedFunctions = ['getElements', 'findSubsets', 'findUnion'];
    for (const fn of expectedFunctions) {
      const t = await unionPage.typeofGlobal(fn);
      expect(t).toBe('function');
    }

    // Ensure there were no console error messages on initial load
    const errorConsoleMessages = consoles.filter((c) => c.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);

    // There should be no uncaught page errors when the page first loads
    expect(pageErrors.length).toBe(0);
  });

  test('Page should have no interactive elements and therefore no transitions or user-driven events', async () => {
    // FSM extraction notes said there are no interactive elements. Confirm that.
    const interactiveCount = await unionPage.countInteractiveElements();
    expect(interactiveCount).toBe(0);

    // Also check for presence of clickable links (anchor tags)
    const anchorCount = await unionPage.page.evaluate(() => document.querySelectorAll('a').length);
    expect(anchorCount).toBe(0);

    // Confirm that the page's body contains descriptive text as expected
    const heading = await unionPage.page.evaluate(() => document.querySelector('h1')?.textContent || '');
    expect(heading.trim()).toBe('Union-Find');

    // No transitions exist in the FSM; ensure no elements that commonly drive transitions are present
    // (buttons/inputs/links already checked above)
  });

  test('Calling displayUnion with valid arrays should not throw and should update the DOM according to implementation', async () => {
    // Call displayUnion with new arrays. The implementation still produces an empty string,
    // but the function should execute without throwing.
    await expect(
      unionPage.page.evaluate(() => {
        // Call using arrays that differ from the initial ones to ensure the function still works
        return displayUnion(['X'], ['x']);
      })
    ).resolves.toBeUndefined(); // displayUnion does not return a value (undefined)

    // After the call, the #union-find content should be a string (likely empty)
    const content = await unionPage.getUnionFindContent();
    expect(typeof content).toBe('string');
    // Implementation produces empty string, assert that it's either empty string or some string
    expect(content).toBe(''); // conservative assertion based on current implementation

    // No new page errors should have been recorded during this valid call
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: calling displayUnion with null arguments should throw a natural TypeError and produce a pageerror', async () => {
    // This test intentionally invokes the function with invalid inputs to let the runtime throw naturally.
    // We expect a TypeError (attempting to read .length of null), and to see a pageerror event.

    // Prepare a fresh capture for this test (the beforeEach already set arrays to empty)
    expect(pageErrors.length).toBe(0);

    // Attempt to call displayUnion with nulls and assert the Promise rejects with an evaluation error.
    // The thrown error message can vary by engine, so match generically for TypeError/cannot read.
    await expect(unionPage.page.evaluate(() => displayUnion(null, null))).rejects.toThrow(
      /TypeError|Cannot read properties|Cannot read property/i
    );

    // Give the page a short moment for any pageerror event to be emitted
    // (Usually immediate, but be conservative)
    await unionPage.page.waitForTimeout(50);

    // There should be at least one page error captured
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // The most recent page error message should indicate the nature of the failure
    const latest = pageErrors[pageErrors.length - 1].message;
    expect(latest).toMatch(/TypeError|Cannot read properties|Cannot read property/i);
  });

  test('Inspect console messages and page errors across lifecycle (sanity check)', async () => {
    // This test summarizes the console / page error state in a readable assertion.
    // On initial load we assert there are no console errors and no page errors.
    // This is redundant with the first test but serves as a grouped sanity verification.

    // Ensure we still have the #union-find element present
    const elExists = await unionPage.page.evaluate(() => !!document.getElementById('union-find'));
    expect(elExists).toBe(true);

    // No console messages of type "error" on initial load
    const errorConsoleMessages = consoles.filter((c) => c.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);

    // No page errors should exist at this point (each test uses a fresh page)
    expect(pageErrors.length).toBe(0);
  });
});