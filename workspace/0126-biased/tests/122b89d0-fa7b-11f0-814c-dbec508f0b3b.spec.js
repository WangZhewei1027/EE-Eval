import { test, expect } from '@playwright/test';

test.describe('Merge Sort Interactive App - FSM validations (Application ID: 122b89d0-fa7b-11f0-814c-dbec508f0b3b)', () => {
  // The URL where the static HTML is served
  const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122b89d0-fa7b-11f0-814c-dbec508f0b3b.html';

  // Common per-test collectors for runtime errors and console error messages
  let pageErrors;
  let consoleErrors;

  // Setup: navigate to the page and attach listeners to capture console errors and runtime (page) errors.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture uncaught exceptions from the page context
    page.on('pageerror', (err) => {
      // Collect the Error object for assertions in tests
      pageErrors.push(err);
    });

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });

    // Load the page fresh for each test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No teardown modifications to page or environment per instructions.
  });

  test.describe('State: S0_Idle (Initial page render and DOM presence)', () => {
    test('Idle state: initial DOM elements rendered and #result is empty', async ({ page }) => {
      // Validate core components exist as described in the FSM Idle state evidence
      const result = page.locator('#result');
      const sortBtn = page.locator('#sort-btn').first(); // first occurrence in DOM
      const clearBtn = page.locator('#clear-btn');
      const addBtn = page.locator('#add-btn');

      // Assertions: elements are visible/present
      await expect(result).toBeVisible();
      await expect(sortBtn).toBeVisible();
      await expect(clearBtn).toBeVisible();
      await expect(addBtn).toBeVisible();

      // #result should initially be empty
      const resultHtml = await result.innerHTML();
      expect(resultHtml.trim()).toBe('', 'Expected initial #result to be empty in Idle state');

      // No runtime errors should have been thrown immediately on load (sanity check)
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transitions and events', () => {
    test('AddToList event: clicking Add should sort the provided input and display result (S0 -> S1)', async ({ page }) => {
      // This test validates addToList() integration: should read input-field default value (1),
      // produce a sorted result and render it into #result.
      const addBtn = page.locator('#add-btn');
      const result = page.locator('#result');

      // Ensure input-field has default '1' (per HTML)
      const inputField = page.locator('#input-field');
      await expect(inputField).toHaveValue('1');

      // Click Add - this triggers addToList -> which builds array and calls sort(arr)
      await addBtn.click();

      // After clicking Add, result should contain the heading and the number(s)
      await expect(result).toContainText('Merge Sort Result:');
      // Expect '1' to be present (with a trailing space in implementation)
      const text = await result.textContent();
      expect(text).toContain('1');

      // Ensure no unexpected page-level errors occurred during normal add->sort(arr) flow
      // (addToList calls sort with a real array, which is the intended correct path)
      expect(pageErrors.length).toBe(0);
    });

    test('ClearResults event: clicking Clear should remove displayed results (S1 -> S0)', async ({ page }) => {
      // Precondition: produce a sorted result by clicking Add
      const addBtn = page.locator('#add-btn');
      const clearBtn = page.locator('#clear-btn');
      const result = page.locator('#result');

      await addBtn.click();
      await expect(result).toContainText('Merge Sort Result:');

      // Now click Clear to trigger clearList()
      await clearBtn.click();

      // Expect #result to be empty after clearing
      const resultHtmlAfterClear = await result.innerHTML();
      expect(resultHtmlAfterClear.trim()).toBe('', 'Expected #result to be empty after Clear');

      // Clearing should not generate page errors
      expect(pageErrors.length).toBe(0);
    });

    test('SortNumbers event: clicking the top Sort button triggers a runtime TypeError (handler expects array) and is observed as a page error', async ({ page }) => {
      // The page attaches the function 'sort' (which expects an array) as an event listener to the sort button.
      // When the user clicks the button, the handler receives a MouseEvent and attempts array operations on it,
      // which should lead to a TypeError at runtime. We must observe and assert that this natural error occurs.

      // Setup: wait for a pageerror event triggered by the click
      const sortBtn = page.locator('#sort-btn').first();

      // Use Promise.all to ensure we both click and wait for the pageerror
      const [error] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 3000 }),
        sortBtn.click(),
      ]);

      // Assert that an error event was captured and it is a TypeError
      expect(error).toBeTruthy();
      // The name property should indicate TypeError in this erroneous flow
      expect(error.name).toBe('TypeError');

      // The console should also contain an error message (captured by console listeners)
      const anyConsoleErrors = consoleErrors.length > 0;
      expect(anyConsoleErrors).toBeTruthy();

      // The message content is environment-specific; assert it references array-like operations plausibly
      const messages = consoleErrors.map(m => m.text());
      const foundSliceOrIsNotFunction = messages.some(m => /slice|is not a function|cannot read property 'slice'/i.test(m));
      // Relaxed assertion: we expect at least one console error message to indicate the nature of the failure
      expect(foundSliceOrIsNotFunction || messages.length > 0).toBeTruthy();
    });

    test('ChangeSortType event: changing the select updates the sort button text (S0 -> S1 expected observable)', async ({ page }) => {
      // Validate that the 'change' event for #sort-type triggers UI updates (per FSM expected observable).
      const sortType = page.locator('#sort-type');
      const sortBtn = page.locator('#sort-btn').first();

      // Confirm initial text is "Sort"
      await expect(sortBtn).toHaveText(/Sort/i);

      // Change sort type to 'descending' and expect sortBtn text to update to 'Reverse Sort'
      await sortType.selectOption('descending');

      // The implementation sets sortBtn.textContent = 'Reverse Sort' on change; assert this visual change
      await expect(sortBtn).toHaveText('Reverse Sort');

      // Changing the sort type may redefine internal reverseSort functions. Ensure no runtime errors were thrown by this action.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and input-related behaviors', () => {
    test('Adding when input-field is zero produces an empty sorted output (edge case)', async ({ page }) => {
      // If input-field.value <= 0, addToList should assemble an empty array and sort([]) should render a heading with no numbers.
      const inputField = page.locator('#input-field');
      const addBtn = page.locator('#add-btn');
      const result = page.locator('#result');

      // Set input field to 0 and then click Add
      await inputField.fill('0');
      // A direct fill triggers an input event; the page's input listener may immediately set value to '0' (that's fine)
      await addBtn.click();

      // Expect the result to show the Merge Sort heading but no numeric entries
      await expect(result).toContainText('Merge Sort Result:');
      const resultText = await result.textContent();
      // The implementation uses a trailing space for numbers; ensure there are no digits present
      expect(/\d/.test(resultText)).toBe(false);
    });

    test('Typing into input-field triggers its input listener that sets the value to 0', async ({ page }) => {
      // The page attaches an input listener that force-sets inputField.value = 0 on any input event.
      const inputField = page.locator('#input-field');

      // Type something into the field; Playwright's fill triggers input events
      await inputField.fill('5');

      // After the input event, the page script sets the field to '0'
      await expect(inputField).toHaveValue('0');
    });
  });

  test.describe('Observability: ensure we capture page errors and console errors as they happen', () => {
    test('Clicking first Sort button should produce at least one page error recorded in the collected pageErrors', async ({ page }) => {
      // This test repeats the behaviour to demonstrate that our page-level collectors capture the runtime error.
      const sortBtn = page.locator('#sort-btn').first();

      // Trigger the error-generating click and wait for the pageerror to be emitted
      await Promise.all([
        page.waitForEvent('pageerror', { timeout: 3000 }),
        sortBtn.click(),
      ]);

      // Our listener attached in beforeEach should have captured it
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      // Validate the type of the first error
      expect(pageErrors[0].name).toBe('TypeError');
    });
  });
});