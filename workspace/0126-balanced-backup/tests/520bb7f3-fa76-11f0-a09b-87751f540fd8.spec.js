import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520bb7f3-fa76-11f0-a09b-87751f540fd8.html';

test.describe('K-Nearest Neighbors Interactive Application (520bb7f3-...)', () => {
  // Arrays to capture runtime errors and console error messages for each test run.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors before each test
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture unhandled page errors (pageerror)
    page.on('pageerror', err => {
      // err is an Error instance
      pageErrors.push({ name: err.name, message: err.message });
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('Initial render: page shows input, button and empty result (Idle state evidence)', async ({ page }) => {
    // This test validates the initial Idle state has been rendered:
    // - the features input exists and has required attribute
    // - the Find KNN button exists with proper text and onclick evidence
    // - the result container exists and is initially empty
    // - no runtime errors occurred on initial load
    const features = page.locator('#features');
    const button = page.locator('.button');
    const result = page.locator('#result');

    // Input exists and is visible
    await expect(features).toBeVisible();
    // 'required' attribute should be present as per HTML implementation
    const requiredAttr = await features.getAttribute('required');
    expect(requiredAttr).toBe('true');

    // Button exists, visible, and text matches the FSM evidence
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Find KNN');

    // The button's onclick attribute should reference findKNN() according to the evidence
    const onclick = await button.getAttribute('onclick');
    expect(onclick).toBe('findKNN()');

    // Result container should be present and empty initially (no results printed)
    const resultInnerHTML = await page.$eval('#result', el => el.innerHTML);
    expect(resultInnerHTML).toBe('');

    // Verify that no console errors or page errors occurred during load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);

    // The FSM Idle state's entry action referenced renderPage(), but the HTML has no such function.
    // Verify that renderPage is not defined on the window (verifies onEnter action is not present).
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);
  });

  test('Clicking "Find KNN" (no input) - expects a runtime TypeError and no result appended', async ({ page }) => {
    // This test validates the transition triggered by clicking the Find KNN button.
    // The implementation contains runtime errors: we assert that a TypeError occurs
    // (feature.forEach is not a function) and that no results were added to #result.

    // Prepare to capture the pageerror event that the broken function should throw.
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Click the Find KNN button (this triggers the onclick="findKNN()" call)
    await page.click('.button');

    // Wait for the error to surface
    const err = await pageErrorPromise;

    // Assert that the error is a TypeError (implementation attempts to call .forEach on an object)
    expect(err).toBeTruthy();
    // Different engines may include slightly different messages but should mention "forEach" or "is not a function"
    expect(err.name).toBe('TypeError');
    expect(err.message.toLowerCase()).toContain('foreach');

    // Confirm that console reported an error message as well (if any console.error was emitted)
    // We allow either direct pageerror or console error, but at least one should be present.
    expect(consoleErrors.length + pageErrors.length).toBeGreaterThanOrEqual(1);

    // Ensure #result remains empty because the script failed before appending results.
    const resultInnerHTMLAfter = await page.$eval('#result', el => el.innerHTML);
    expect(resultInnerHTMLAfter).toBe('');
    // Also ensure no <p> elements were appended to the result area.
    const paragraphCount = await page.$$eval('#result p', ps => ps.length);
    expect(paragraphCount).toBe(0);
  });

  test('Clicking "Find KNN" with input value set (edge case) still triggers the same runtime error', async ({ page }) => {
    // This test covers an edge case: user enters comma-separated features into the input
    // and clicks the button. Despite providing input, the broken implementation should still
    // throw the same TypeError early in the function. We assert the error and that no results are shown.

    // Fill in the features input with a plausible value (this will also exercise parsing code paths)
    await page.fill('#features', '1,2,3');

    // Prepare to capture the runtime error
    const [err] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('.button') // trigger the error-producing function
    ]);

    // Validate error characteristics
    expect(err).toBeTruthy();
    expect(err.name).toBe('TypeError');
    expect(err.message.toLowerCase()).toContain('foreach');

    // Validate that no result entries were appended
    const resultInnerHTMLAfter = await page.$eval('#result', el => el.innerHTML);
    expect(resultInnerHTMLAfter).toBe('');
    const paragraphCount = await page.$$eval('#result p', ps => ps.length);
    expect(paragraphCount).toBe(0);

    // Confirm that the page's console also captured an error message textually mentioning forEach
    const hadConsoleForEach = consoleErrors.some(text => text.toLowerCase().includes('foreach'));
    // It's acceptable if the consoleErrors array is empty (some browsers only raise pageerror).
    // But if there is a console error, it should mention forEach.
    if (consoleErrors.length > 0) {
      expect(hadConsoleForEach).toBe(true);
    }
  });

  test('Verify evidence elements and transition expectations from FSM: button has onclick evidence', async ({ page }) => {
    // This test double-checks the FSM evidence mapping:
    // - The button element exists with the class .button and onclick attribute containing findKNN()
    // - The input element #features exists and is required
    // - The visual element #result exists
    const button = page.locator('button.button');
    await expect(button).toBeVisible();
    const onclickAttr = await button.getAttribute('onclick');
    expect(onclickAttr).toBe('findKNN()');

    const features = page.locator('#features');
    await expect(features).toBeVisible();
    expect(await features.getAttribute('required')).toBe('true');

    const result = page.locator('#result');
    await expect(result).toBeVisible();

    // Attempt a click that triggers the transition; we expect the real implementation to throw,
    // so the FSM's transition to S1_ResultDisplayed (printing results) does not occur in practice.
    const pageErrorPromise = page.waitForEvent('pageerror');
    await page.click('.button');
    const err = await pageErrorPromise;

    // Assert that an error occurred (confirming the transition's action failed)
    expect(err).toBeTruthy();
    expect(err.name).toBe('TypeError');

    // Because the action failed, the expected observable "Display results in the result div"
    // did not happen. Confirm #result remains empty.
    const resultInnerHTMLAfter = await page.$eval('#result', el => el.innerHTML);
    expect(resultInnerHTMLAfter).toBe('');
  });
});