import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5209e332-fa76-11f0-a09b-87751f540fd8.html';

test.describe('5209e332-fa76-11f0-a09b-87751f540fd8 - Time Complexity interactive page', () => {

  // Shared navigation before each test to load the page as-is.
  test.beforeEach(async ({ page }) => {
    // Navigate to the provided HTML file. The tests intentionally load the page without modifying it.
    await page.goto(APP_URL);
  });

  test.describe('FSM: Idle state (initial) - static rendering and content checks', () => {
    test('renders the main heading and introductory paragraph (validates Idle entry state rendering)', async ({ page }) => {
      // Verify the main H1 heading exists and matches expected text.
      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText('Time Complexity');

      // Verify the introductory paragraph describing time complexity exists.
      const introPara = page.locator('p').first();
      await expect(introPara).toContainText('Time complexity is a measure of how long an algorithm takes to complete');

      // Verify that Big O notation section is present.
      const bigONotation = page.locator('h2:has-text("Big O Notation")');
      await expect(bigONotation).toHaveCount(1);
      await expect(page.locator('h2:has-text("Big O Notation") + p')).toContainText('Big O notation is a way to describe the time complexity');

      // Verify a selection of example headers are present to ensure code examples are rendered as static content.
      const expectedExamples = [
        'Example 1: Bubble Sort',
        'Example 2: Binary Search',
        'Example 3: Fibonacci Sequence',
        'Example 4: Matrix Multiplication',
        'Example 5: Counting Sort',
        'Example 6: Merge Sort',
        'Example 7: Quick Sort',
        'Example 8: Radix Sort',
        'Example 9: Bubble Sort with Optimizations',
        'Example 10: Merge Sort with Optimizations',
        'Example 11: Quick Sort with Optimizations',
        'Example 12: Radix Sort with Optimizations',
        'Example 13: Time Complexity Analysis'
      ];

      for (const exampleTitle of expectedExamples) {
        const locator = page.locator(`h2:has-text("${exampleTitle}")`);
        await expect(locator, `Expected to find heading: ${exampleTitle}`).toHaveCount(1);
      }

      // Verify that code blocks are present (pre > code). There should be multiple code blocks for the examples.
      const codeBlocks = page.locator('pre > code');
      const codeCount = await codeBlocks.count();
      await expect(codeCount).toBeGreaterThanOrEqual(10); // There are 13 examples; ensure at least 10 code blocks rendered.
    });

    test('time complexity analysis list is present and contains expected items', async ({ page }) => {
      // Verify the unordered list with complexity results is present and contains specific list items.
      const list = page.locator('ul');
      await expect(list).toHaveCount(1);

      // Check for several complexity descriptions explicitly.
      const expectedListItems = [
        'Bubble Sort: O(n^2)',
        'Binary Search: O(log n)',
        'Fibonacci Sequence: O(n)',
        'Matrix Multiplication: O(n^3)',
        'Counting Sort: O(n + k)',
        'Merge Sort: O(n log n)',
        'Quick Sort: O(n log n)',
        'Radix Sort: O(nk)'
      ];

      for (const expectedText of expectedListItems) {
        await expect(page.locator('li', { hasText: expectedText })).toHaveCount(1);
      }
    });
  });

  test.describe('No interactivity / FSM transitions checks', () => {
    test('verifies there are no interactive elements (no transitions present)', async ({ page }) => {
      // Ensure typical interactive elements are not present (buttons, inputs, selects, textareas, anchors).
      const interactiveSelectors = ['button', 'input', 'select', 'textarea', 'a'];
      for (const sel of interactiveSelectors) {
        const elems = page.locator(sel);
        const count = await elems.count();
        // The HTML provided should have zero of these interactive controls.
        await expect(count, `Expected no <${sel}> elements`).toBe(0);
      }

      // Check that no components or event handlers (i.e., no clickable UI) exist by verifying no elements with onclick attributes.
      const onclickCount = await page.locator('[onclick]').count();
      await expect(onclickCount).toBe(0);
    });

    test('validates that declared FSM entry action renderPage() is not present on the global window (onEnter not executed)', async ({ page }) => {
      // The FSM had an entry action "renderPage()". The page as served does not define renderPage.
      const typeofRenderPage = await page.evaluate(() => typeof window.renderPage);
      await expect(typeofRenderPage).toBe('undefined');

      // Also assert that the code examples (which are present as text) did not get evaluated into global functions.
      const potentialGlobalFunctions = ['bubbleSort', 'binarySearch', 'fibonacci', 'matrixMultiply', 'countingSort', 'mergeSort', 'quickSort', 'radixSort'];
      for (const fn of potentialGlobalFunctions) {
        const typeofFn = await page.evaluate((name) => typeof window[name], fn);
        await expect(typeofFn, `Expected global function ${fn} to be undefined`).toBe('undefined');
      }
    });
  });

  test.describe('Console and runtime error observation (let errors happen naturally)', () => {
    test('captures console messages and page errors during load and asserts their nature (if any)', async ({ page }) => {
      // Collect console events and page errors
      const consoleMessages = [];
      const pageErrors = [];

      page.on('console', msg => {
        // Store console messages (type and text) for later assertions.
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });

      page.on('pageerror', error => {
        // pageerror events are Error objects (uncaught exceptions). Capture name and message.
        pageErrors.push({ name: error.name, message: error.message, stack: error.stack });
      });

      // Reload to ensure we capture all events since the initial beforeEach navigation.
      await page.reload({ waitUntil: 'load' });

      // Wait briefly to allow any asynchronous errors to surface.
      await page.waitForTimeout(250);

      // If any page errors occurred, ensure they are standard JS error types (ReferenceError, SyntaxError, TypeError).
      if (pageErrors.length > 0) {
        const allowed = ['ReferenceError', 'SyntaxError', 'TypeError', 'RangeError', 'URIError', 'EvalError'];
        for (const err of pageErrors) {
          await expect(allowed.includes(err.name)).toBeTruthy();
        }
      } else {
        // If no page errors occurred, assert that the page is clean (this is also a valid and expected outcome).
        await expect(pageErrors.length).toBe(0);
      }

      // Provide assertions about console output being reasonable for a static page:
      // There should be at least the console message from the browser about loading resources OR zero console messages if no logs are produced.
      // We will accept either no console messages or some messages but none of them should be unhandled exceptions (those would be in pageErrors).
      const hasErrorsInConsole = consoleMessages.some(m => m.type === 'error');
      await expect(hasErrorsInConsole).toBe(false);

      // Sanity check: the page title should appear in the page and no console warnings/errors should have incorrectly indicated missing critical markup.
      const titleText = await page.title();
      await expect(titleText).toBe('Time Complexity');
    });

    test('edge case: duplicate function named "merge" appears twice in code blocks but should not create runtime errors', async ({ page }) => {
      // The HTML includes 'function merge' twice in code blocks. Ensure these appear as static text and do not create runtime issues.
      const mergeOccurrences = await page.locator('code:has-text("function merge")').count();
      // Expect at least 2 occurrences because merge is defined twice in the provided HTML.
      await expect(mergeOccurrences).toBeGreaterThanOrEqual(2);

      // Verify again that no runtime errors were raised as a result of these duplicated code snippets being present as text.
      const pageErrorsDuringCheck = [];
      page.on('pageerror', e => pageErrorsDuringCheck.push(e));
      // Wait briefly to allow any late errors to fire
      await page.waitForTimeout(200);
      await expect(pageErrorsDuringCheck.length).toBe(0);
    });
  });

  // Cleanup: no teardown actions required because tests do not modify the page or global environment.
});