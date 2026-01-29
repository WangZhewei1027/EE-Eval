import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122c2610-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Topological Sort interactive app (FSM validation and runtime errors)', () => {
  // Shared variables to capture runtime diagnostics
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Reset arrays for each test
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught errors from the page
    page.on('pageerror', (err) => {
      // err is an Error object; store message for assertions
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Capture console messages for additional evidence
    page.on('console', (msg) => {
      // store type and text for later inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application page and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // nothing special to teardown beyond Playwright's fixtures
  });

  test('Page should render major UI components (buttons and sliders are present)', async ({ page }) => {
    // Validate presence and visibility of primary elements described in the FSM
    const sortButton = page.locator('#sort-button');
    const sortButton2 = page.locator('#sort-button-2');
    const sortButton3 = page.locator('#sort-button-3');
    const sortButton4 = page.locator('#sort-button-4');

    // Sliders
    const numVertices = page.locator('#num-vertices');
    const numEdges = page.locator('#num-edges');
    const maxEdges = page.locator('#max-edges');

    // Value display spans
    const numVerticesValue = page.locator('#num-vertices-value');
    const numEdgesValue = page.locator('#num-edges-value');
    const maxEdgesValue = page.locator('#max-edges-value');

    // Assert main controls exist in the DOM
    await expect(sortButton).toBeVisible();
    await expect(sortButton2).toBeVisible();
    await expect(sortButton3).toBeVisible();
    await expect(sortButton4).toBeVisible();

    await expect(numVertices).toBeVisible();
    await expect(numEdges).toBeVisible();
    await expect(maxEdges).toBeVisible();

    // Assert default textual values shown in spans match HTML initial values
    await expect(numVerticesValue).toHaveText('10');
    await expect(numEdgesValue).toHaveText('10');
    await expect(maxEdgesValue).toHaveText('10');

    // Also assert the slider input element attributes match expectations (min, max, value)
    expect(await numVertices.getAttribute('min')).toBe('3');
    expect(await numVertices.getAttribute('max')).toBe('100');
    expect(await numVertices.getAttribute('value')).toBe('10');

    expect(await numEdges.getAttribute('min')).toBe('3');
    expect(await numEdges.getAttribute('max')).toBe('100');
    expect(await numEdges.getAttribute('value')).toBe('10');

    expect(await maxEdges.getAttribute('min')).toBe('3');
    expect(await maxEdges.getAttribute('max')).toBe('100');
    expect(await maxEdges.getAttribute('value')).toBe('10');
  });

  test('Page script contains runtime/parse errors and these are reported (assert Syntax/Reference errors occur)', async ({ page }) => {
    // The implementation contains conflicting declarations (let sortButton and function sortButton())
    // which should cause a SyntaxError or similar parsing/runtime error. We assert that at least one
    // pageerror was raised and that it references the problematic identifier or indicates a syntax issue.

    // Wait a short time to allow any asynchronous errors to surface
    await page.waitForTimeout(200);

    // There should be at least one page error captured
    expect(pageErrors.length).toBeGreaterThan(0);

    // Assert that an error message refers to either 'sortButton' or a syntax/duplicate-declaration message.
    const combined = pageErrors.join('\n');
    const indicator = /sortButton|already been declared|SyntaxError|Identifier/i;
    expect(indicator.test(combined)).toBeTruthy();
  });

  test('Clicking primary Sort button does not perform FSM transitions due to script errors (button text remains "Sort")', async ({ page }) => {
    // This test attempts the FSM transition event: clicking #sort-button.
    // Because the page script fails to parse/run properly, the sort() handler is not available,
    // and therefore clicking should not change the button text to 'Sorted' or 'Not Sorted'.
    const sortBtn = page.locator('#sort-button');

    // Confirm initial state text
    await expect(sortBtn).toHaveText('Sort');

    // Click the button
    await sortBtn.click();

    // Allow a brief moment for any handlers (if they existed) to run and for potential errors to appear
    await page.waitForTimeout(200);

    // The expected FSM transition would change the text to 'Sorted' or 'Not Sorted'.
    // Because of the script error we instead assert that the text remains unchanged.
    await expect(sortBtn).toHaveText('Sort');

    // Also assert that a runtime error was captured (either previously on load or as result of click)
    expect(pageErrors.length).toBeGreaterThan(0);

    // Provide diagnostic context by checking console messages were recorded (helpful when debugging tests)
    // At least the consoleMessages array should be present (could be empty)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  test('Clicking auxiliary sort buttons (#sort-button-2/3/4) does not produce successful transitions and their text remains "Sort"', async ({ page }) => {
    // Validate the other sort buttons behave similarly (no transition due to broken script)
    const ids = ['#sort-button-2', '#sort-button-3', '#sort-button-4'];

    for (const id of ids) {
      const btn = page.locator(id);
      await expect(btn).toHaveText('Sort');
      await btn.click();
      // Wait briefly for any potential handler
      await page.waitForTimeout(100);
      // Should stay unchanged
      await expect(btn).toHaveText('Sort');
    }

    // Confirm that page errors exist (script did not run fully)
    expect(pageErrors.length).toBeGreaterThan(0);
  });

  test('Adjusting sliders and dispatching input events does not update display spans (no input handlers attached as expected from broken script)', async ({ page }) => {
    // Attempt to change slider values and dispatch input events, then assert the display spans are unchanged.
    const slider = page.locator('#num-vertices');
    const valueSpan = page.locator('#num-vertices-value');

    // Confirm starting text
    await expect(valueSpan).toHaveText('10');

    // Set slider value to 20 via evaluate and dispatch an 'input' event
    await slider.evaluate((el) => {
      el.value = '20';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Wait a short time to allow any event handlers to run (if they existed)
    await page.waitForTimeout(150);

    // In the broken implementation, there is no handler updating the span for this slider.
    // Therefore the span text should remain the original '10'
    await expect(valueSpan).toHaveText('10');

    // Also verify the slider's value attribute did change in the DOM
    expect(await slider.inputValue()).toBe('20');
  });

  test('Edge case assertions: verify expected FSM final states are NOT reached because of script errors', async ({ page }) => {
    // FSM expects transitions leading to states S1_Sorted or S2_NotSorted that are observable via button text changes.
    // Since the page has parsing/runtime errors, those states should not be reached during tests.
    const allButtons = [
      page.locator('#sort-button'),
      page.locator('#sort-button-2'),
      page.locator('#sort-button-3'),
      page.locator('#sort-button-4'),
    ];

    // Ensure none of the buttons show 'Sorted' or 'Not Sorted'
    for (const btn of allButtons) {
      const text = (await btn.textContent())?.trim();
      // It should remain the initial 'Sort' for all of them in the broken environment
      expect(['Sorted', 'Not Sorted'].includes(text)).toBeFalsy();
      expect(text).toBe('Sort');
    }

    // Re-assert that at least one syntax/runtime error exists pointing to the root cause
    const combined = pageErrors.join('\n');
    const indicator = /sortButton|already been declared|SyntaxError|Identifier/i;
    expect(indicator.test(combined)).toBeTruthy();
  });

  test('Diagnostic: capture and surface console messages and errors for troubleshooting', async ({ page }) => {
    // This test is primarily diagnostic: it ensures we have captured console messages and page errors,
    // and that those messages contain helpful context (if any).
    // It will not fail the suite if the console is empty, but will assert the presence of page errors.

    // Wait briefly for any late messages
    await page.waitForTimeout(100);

    // At minimum we should have captured page errors from the broken script
    expect(pageErrors.length).toBeGreaterThan(0);

    // Log the first few messages into test output when running - using expect to ensure they are strings
    for (const msg of pageErrors.slice(0, 5)) {
      expect(typeof msg).toBe('string');
    }

    // Console messages can be zero or more; if present then each must have text
    for (const c of consoleMessages.slice(0, 10)) {
      expect(typeof c.text).toBe('string');
    }
  });
});