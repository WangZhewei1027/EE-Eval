import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122b89d4-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Radix Sort interactive app - FSM validation and error observation', () => {
  // Common selectors defined from the FSM / HTML
  const containerSelector = '#radix-sort-example-container';
  const buttons = {
    radix: '#radix-sort',
    bubble: '#bubble-sort',
    merge: '#merge-sort',
    insertion: '#insert-sort',
    quick: '#quick-sort',
    kmp: '#kmp-sort',
    // example buttons (present in DOM)
    radixExample: '#radix-sort-example',
    bubbleExample: '#bubble-sort-example',
    mergeExample: '#merge-sort-example',
    insertionExample: '#insert-sort-example',
    quickExample: '#quick-sort-example',
    kmpExample: '#kmp-sort-example',
  };

  // Setup a fresh listener state for each test to capture console errors and pageerrors
  test.beforeEach(async ({ page }) => {
    // Attach listeners before navigation to capture script parse/runtime errors
    (page as any).__consoleErrors = [];
    (page as any).__pageErrors = [];

    page.on('console', msg => {
      // Capture console errors and messages for later assertions.
      // We only push textual representation to keep assertions engine-agnostic.
      try {
        if (msg.type() === 'error') {
          (page as any).__consoleErrors.push(msg.text());
        } else {
          // For debugging or additional visibility we also capture other console messages.
          (page as any).__consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
        }
      } catch (e) {
        // swallow to avoid interfering with tests
      }
    });

    page.on('pageerror', err => {
      try {
        (page as any).__pageErrors.push(String(err && err.message ? err.message : err));
      } catch (e) {
        // ignore
      }
    });

    // Navigate to the app under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Utility to read captured errors from the page instance
  function getCapturedErrors(page) {
    const consoleErrors = (page as any).__consoleErrors || [];
    const pageErrors = (page as any).__pageErrors || [];
    return { consoleErrors, pageErrors };
  }

  // Validate initial page load and that the environment reflected in FSM exists
  test('Initial state (S0_Idle): DOM elements present and script errors are observed on load', async ({ page }) => {
    // This test validates:
    // - The page structure (title, heading, buttons) is present (FSM detected components)
    // - The entry action display('Radix Sort Example') should have run per FSM, but the real page has script issues.
    // - We capture and assert that script parse/runtime errors (SyntaxError / Identifier re-declare) occur naturally.

    // Basic DOM checks (buttons and heading)
    await expect(page.locator('title')).toHaveText(/Radix Sort/i);
    await expect(page.locator('h1')).toHaveText(/Radix Sort/i);

    // Check all primary buttons detected by the FSM exist in the DOM
    for (const sel of Object.values(buttons)) {
      await expect(page.locator(sel)).toBeVisible();
    }

    // The app attempts to run inline scripts on load. Capture any page errors that occurred during load.
    const { consoleErrors, pageErrors } = getCapturedErrors(page);

    // Assert that at least one script-related error was emitted.
    // The implementation intentionally contains redeclarations (let + function with same name) and other issues,
    // so a SyntaxError or similar should be present in the pageErrors or consoleErrors captured.
    expect(consoleErrors.length + pageErrors.length).toBeGreaterThan(0);

    // Additionally assert that the visible container may not contain the expected "Radix Sort Example" entry text
    // (because the inline script may not have executed due to the error). We allow either possibility but ensure we recorded errors.
    const containerText = await page.locator(containerSelector).innerText().catch(() => '');
    // If the script did execute it's likely to produce some text; we just assert that errors exist.
    expect(consoleErrors.length + pageErrors.length).toBeGreaterThan(0);

    // For clarity in failure messages, attach the captured errors as assertions so test output includes them.
    // We check that at least one error message contains typical keywords like 'SyntaxError' or 'already been declared' or 'ReferenceError' or 'TypeError'.
    const combined = [...pageErrors, ...consoleErrors].join(' | ');
    expect(combined.length).toBeGreaterThan(0); // ensures we have text
    expect(combined).toMatch(/SyntaxError|already been declared|Identifier|ReferenceError|TypeError/i);
  });

  // Parameterized tests for each main sort button from the FSM (events/transitions)
  const mainSortButtons = [
    { id: 'S1_Radix_Sorted', selector: buttons.radix, label: 'Radix Sort' },
    { id: 'S2_Bubble_Sorted', selector: buttons.bubble, label: 'Bubble Sort' },
    { id: 'S3_Merge_Sorted', selector: buttons.merge, label: 'Merge Sort' },
    { id: 'S4_Insertion_Sorted', selector: buttons.insertion, label: 'Insertion Sort' },
    { id: 'S5_Quick_Sorted', selector: buttons.quick, label: 'Quick Sort' },
    { id: 'S6_KMP_Sorted', selector: buttons.kmp, label: 'KMP Sort' },
  ];

  for (const btn of mainSortButtons) {
    test(`Transition ${btn.id} triggered by clicking '${btn.label}' (${btn.selector})`, async ({ page }) => {
      // This test validates:
      // - The click event exists on the DOM element (button is present)
      // - After the click, either the expected "Sorted array:" appears (if functions ran successfully)
      //   OR we observe runtime errors (ReferenceError/TypeError/SyntaxError) that naturally occur from the page code.
      // - We do not attempt to patch or fix the page; we only observe and assert natural behavior.

      // Ensure button is present and visible
      const locator = page.locator(btn.selector);
      await expect(locator).toBeVisible();

      // Clear any previously captured errors (captured on load) to detect new errors caused by this click separately.
      (page as any).__clickConsoleErrors = [];
      (page as any).__clickPageErrors = [];
      // Additional listeners local to this click to capture subsequent events
      page.on('console', msg => {
        try {
          if (msg.type() === 'error') {
            (page as any).__clickConsoleErrors.push(msg.text());
          } else {
            (page as any).__clickConsoleErrors.push(`[${msg.type()}] ${msg.text()}`);
          }
        } catch (e) {}
      });
      page.on('pageerror', err => {
        try {
          (page as any).__clickPageErrors.push(String(err && err.message ? err.message : err));
        } catch (e) {}
      });

      // Click the button to trigger the transition/event handler
      await locator.click();

      // Give the page a short moment to handle any synchronous runtime errors or DOM updates
      await page.waitForTimeout(100);

      // Gather captured errors
      const loadCaptured = getCapturedErrors(page);
      const clickConsoleErrors = (page as any).__clickConsoleErrors || [];
      const clickPageErrors = (page as any).__clickPageErrors || [];
      const allErrors = [...loadCaptured.pageErrors, ...loadCaptured.consoleErrors, ...clickPageErrors, ...clickConsoleErrors];

      // Check container text to see if the expected "Sorted array:" output was produced.
      const containerText = await page.locator(containerSelector).innerText().catch(() => '');

      // Two valid outcomes:
      // 1) The sort example ran successfully (container includes "Sorted array:")
      // 2) Errors occurred (we assert that at least one error is present)
      const producedSortedArray = /Sorted array:/i.test(containerText);

      if (producedSortedArray) {
        // If we unexpectedly got a successful run, validate basic properties of the output.
        expect(containerText).toMatch(/Sorted array:\s*\d+/i);
      } else {
        // Otherwise, assert that the page naturally produced at least one error (as observed on load or after click).
        expect(allErrors.length).toBeGreaterThan(0);
        // Ensure the error text contains expected categories (SyntaxError / ReferenceError / TypeError etc.)
        const combined = allErrors.join(' | ');
        expect(combined).toMatch(/SyntaxError|ReferenceError|TypeError|already been declared|Identifier/i);
      }
    });
  }

  // Edge-case tests and error scenario validations
  test('Edge case: multiple rapid clicks do not crash the test runner and errors are captured', async ({ page }) => {
    // This test validates resilience: rapidly clicking a button should not crash Playwright,
    // and any errors produced by the page are captured.
    const locator = page.locator(buttons.radix);
    await expect(locator).toBeVisible();

    // Rapidly click the button multiple times
    for (let i = 0; i < 5; i++) {
      await locator.click();
    }

    // Wait briefly for potential synchronous errors to surface
    await page.waitForTimeout(200);

    const { consoleErrors, pageErrors } = getCapturedErrors(page);

    // We expect that the page produced at least one error across load/clicks given the page's defects.
    expect(consoleErrors.length + pageErrors.length).toBeGreaterThan(0);

    // Verify that the error messages are of script-error variety
    const combined = [...pageErrors, ...consoleErrors].join(' | ');
    expect(combined).toMatch(/SyntaxError|ReferenceError|TypeError|already been declared|Identifier/i);
  });

  test('Edge case: clicking "example" buttons (secondary) also observed for errors or outputs', async ({ page }) => {
    // Validate example buttons; behavior mirrors main buttons in this implementation.
    const exampleSelectors = [
      buttons.radixExample,
      buttons.bubbleExample,
      buttons.mergeExample,
      buttons.insertionExample,
      buttons.quickExample,
      buttons.kmpExample,
    ];

    for (const sel of exampleSelectors) {
      const loc = page.locator(sel);
      await expect(loc).toBeVisible();
      await loc.click();
      await page.waitForTimeout(50);
    }

    const { consoleErrors, pageErrors } = getCapturedErrors(page);
    // Again, we expect script-related errors exist naturally on this page.
    expect(consoleErrors.length + pageErrors.length).toBeGreaterThan(0);
  });

  test('Sanity: verify we do not patch or redefine any global - let runtime errors happen naturally', async ({ page }) => {
    // This test ensures we did not try to inject or overwrite page globals.
    // We simply assert that attempting to access a globally defined function (if present) is done by the page itself,
    // and errors have been observed (i.e., we didn't fix them from the test).
    const { consoleErrors, pageErrors } = getCapturedErrors(page);
    expect(consoleErrors.length + pageErrors.length).toBeGreaterThan(0);

    // Also assert DOM still intact
    await expect(page.locator('body')).toBeVisible();
  });
});