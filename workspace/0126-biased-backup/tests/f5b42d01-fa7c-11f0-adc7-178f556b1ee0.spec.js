import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b42d01-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('K-Nearest Neighbors FSM and interactive app validation (f5b42d01-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // This suite validates the Idle and RunningKNN states described in the FSM,
  // observes console output, and asserts that the runtime errors (ReferenceError)
  // happen naturally (no patching/monkey-patching of the page).

  // Helper to collect console messages during navigation or interactions.
  const collectConsoleMessages = (page, messages) => {
    const handler = msg => {
      try {
        messages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // ignore any issues reading console messages
      }
    };
    page.on('console', handler);
    return () => page.off('console', handler);
  };

  test('Idle state: page renders and contains the "Run KNN Example" button', async ({ page }) => {
    // Validate that the page renders correctly (renderPage() entry action effect),
    // and that the demonstration button is present and visible.
    const consoleMessages = [];
    const detachConsole = collectConsoleMessages(page, consoleMessages);

    // We expect the page to execute runKNNExample() on load which (by design)
    // references an undefined X variable. Capture the first pageerror triggered by that.
    const [pageError] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.goto(APP_URL),
    ]);

    // Basic DOM expectations (Idle state's evidence)
    await expect(page.locator('h1')).toHaveText('K-Nearest Neighbors');
    const runButton = page.locator('button.demonstration-button');
    await expect(runButton).toBeVisible();
    await expect(runButton).toHaveText('Run KNN Example');
    await expect(runButton).toBeEnabled();

    // The page has an inline script that calls runKNNExample() during load.
    // That function references `X` which is not defined in the provided HTML,
    // so a ReferenceError should have been thrown. Assert that the error occurred.
    expect(pageError).toBeTruthy();
    // The message format can vary by engine, but it should mention 'X' and 'not defined'.
    expect(pageError.message).toEqual(expect.any(String));
    expect(pageError.message).toMatch(/X.*not defined|not defined.*X|X is not defined/i);

    // Verify that 'Nearest neighbors:' was NOT successfully logged to console
    // because the function failed before reaching the console.log.
    const foundNearestLog = consoleMessages.some(m => m.text.includes('Nearest neighbors:'));
    expect(foundNearestLog).toBeFalsy();

    // The runKNNExample function should still be defined on the window (declared in script).
    const fnType = await page.evaluate(() => typeof window.runKNNExample);
    expect(fnType).toBe('function');

    detachConsole();
  });

  test('Transition: clicking "Run KNN Example" triggers runKNNExample and yields a ReferenceError (Idle -> RunningKNN)', async ({ page }) => {
    // Verify that clicking the button triggers the same behavior: runKNNExample runs and causes a ReferenceError.
    const consoleMessages = [];
    const detachConsole = collectConsoleMessages(page, consoleMessages);

    // Load the page. The page's inline call already executes once on load and will throw.
    await page.goto(APP_URL);

    // Ensure the button exists and is ready to be clicked.
    const runButton = page.locator('button.demonstration-button');
    await expect(runButton).toBeVisible();
    await expect(runButton).toBeEnabled();

    // Clicking the button should invoke runKNNExample again and produce a pageerror (ReferenceError).
    const [pageError] = await Promise.all([
      page.waitForEvent('pageerror'),
      runButton.click(),
    ]);

    expect(pageError).toBeTruthy();
    expect(pageError.message).toEqual(expect.any(String));
    expect(pageError.message).toMatch(/X.*not defined|not defined.*X|X is not defined/i);

    // Ensure that the console still does not show 'Nearest neighbors:' from a successful run.
    const foundNearestLog = consoleMessages.some(m => m.text.includes('Nearest neighbors:'));
    expect(foundNearestLog).toBeFalsy();

    // The function remains callable (exists on window), even after the error.
    const fnType = await page.evaluate(() => typeof window.runKNNExample);
    expect(fnType).toBe('function');

    detachConsole();
  });

  test('Edge case: multiple rapid clicks cause multiple ReferenceErrors but page stays interactive', async ({ page }) => {
    // This test clicks the button multiple times and asserts that each click produces an error,
    // demonstrating that the RunningKNN entry action is invoked on user event each time.
    await page.goto(APP_URL);

    const runButton = page.locator('button.demonstration-button');
    await expect(runButton).toBeVisible();

    // Perform three rapid clicks and wait for three pageerror events.
    const errorPromises = [];
    for (let i = 0; i < 3; i++) {
      errorPromises.push(page.waitForEvent('pageerror'));
      // small delay between clicks to ensure events are fired sequentially
      await runButton.click();
    }

    const errors = await Promise.all(errorPromises);
    expect(errors.length).toBe(3);
    for (const err of errors) {
      expect(err.message).toEqual(expect.any(String));
      expect(err.message).toMatch(/X.*not defined|not defined.*X|X is not defined/i);
    }

    // After errors, page should still allow evaluating simple expressions.
    const title = await page.title();
    expect(title).toContain('K-Nearest Neighbors');

    // Also ensure the button is still enabled for further interactions.
    await expect(runButton).toBeEnabled();
  });

  test('Implementation evidence: Example code block and explanatory text are present (FSM S0 content evidence)', async ({ page }) => {
    // Validate that the static content described in the FSM (educational text, example code block)
    // is present on the page as part of renderPage() entry action.
    await page.goto(APP_URL);

    // Check for headings and descriptive paragraphs
    await expect(page.locator('h2', { hasText: 'How KNN Works' })).toBeVisible();
    await expect(page.locator('h2', { hasText: 'KNN Algorithm' })).toBeVisible();
    await expect(page.locator('pre')).toBeVisible();

    // Ensure the example code contains 'KNeighborsClassifier' (as in the provided example).
    const preText = await page.locator('pre').innerText();
    expect(preText).toMatch(/KNeighborsClassifier|load_iris|train_test_split|Accuracy:/i);
  });

  test('Observe console and page errors without attempting to modify page globals (verify natural errors occur)', async ({ page }) => {
    // This test explicitly asserts that we do NOT patch globals and that the page
    // throws the native ReferenceError as-is. We load the page and capture the pageerror.
    const consoleMessages = [];
    const detachConsole = collectConsoleMessages(page, consoleMessages);

    const [pageError] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.goto(APP_URL),
    ]);

    // Assert the error is a ReferenceError involving X being undefined.
    expect(pageError).toBeDefined();
    expect(pageError.message).toMatch(/X.*not defined|not defined.*X|X is not defined/i);

    // There should be no successful 'Nearest neighbors:' log because the function failed early.
    const nearestFound = consoleMessages.some(m => m.text.includes('Nearest neighbors:'));
    expect(nearestFound).toBe(false);

    // Confirm we did not alter global environment: evaluate presence of a made-up global should be false.
    const hasInjectedGlobal = await page.evaluate(() => typeof window.__PLAYWRIGHT_INJECTED_GLOBAL__ !== 'undefined');
    expect(hasInjectedGlobal).toBe(false);

    detachConsole();
  });

});