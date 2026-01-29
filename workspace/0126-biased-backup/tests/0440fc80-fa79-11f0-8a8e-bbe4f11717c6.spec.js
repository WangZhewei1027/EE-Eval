import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0440fc80-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Array Interactive Application - FSM validation (0440fc80-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  // Basic navigation for every test: load the page fresh
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  test('Initial Idle state (S0_Idle) - page loads and required DOM elements are present', async ({ page }) => {
    // This test validates the Idle state: page should render header, footer, image and two buttons
    // Also capture any page errors emitted during normal page load
    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Verify static elements
    await expect(page.locator('.header h1')).toHaveText('Array');
    await expect(page.locator('.footer p')).toHaveText('© 2023 Array');

    // The example array section and image should be present
    await expect(page.locator('.array h2')).toHaveText('Example Array');
    const img = page.locator('.array img[alt="Array Image"]');
    await expect(img).toBeVisible();

    // There should be two distinct buttons with visible texts as per FSM/evidence
    const btnPrint = page.getByRole('button', { name: 'Print Array' });
    const btnPrintAnim = page.getByRole('button', { name: 'Print Array with Animation' });
    await expect(btnPrint).toBeVisible();
    await expect(btnPrintAnim).toBeVisible();

    // Also verify the raw selector used in the FSM exists twice (two buttons share the same onclick)
    const onclickButtons = await page.locator("button[onclick='printArray()']").elementHandles();
    expect(onclickButtons.length).toBe(2);

    // There should be no unexpected page errors during a normal load
    expect(pageErrors.length).toBe(0);
  });

  test('S0_Idle onEnter action "renderPage()" is referenced by FSM — calling it should produce a ReferenceError (verify error behavior)', async ({ page }) => {
    // The FSM lists renderPage() as an entry action, but the implementation does not define it.
    // We intentionally call it to verify the page throws a ReferenceError / not defined error naturally.
    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    let caughtError = null;
    try {
      // This will evaluate in the page context and should reject because renderPage is not defined.
      await page.evaluate(() => {
        // Intentionally call the missing function to observe natural error behavior
        // This mimics what would happen if the FSM expected the page to call renderPage() on enter.
        // We do NOT define or patch renderPage; we let the runtime throw.
        // eslint-disable-next-line no-undef
        return renderPage();
      });
    } catch (err) {
      caughtError = err;
    }

    // We expect an error to have been thrown by the evaluate call
    expect(caughtError).not.toBeNull();
    // The error message should reference renderPage (engine dependent, so check for renderPage token)
    expect(String(caughtError.message)).toContain('renderPage');

    // The pageerror event should also capture the ReferenceError that occurred in the page context
    // At least one pageerror should be present and reference renderPage
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const anyPageErrorMentionsRenderPage = pageErrors.some(e => String(e.message).includes('renderPage'));
    expect(anyPageErrorMentionsRenderPage).toBeTruthy();
  });

  test('Transition PrintArray (S0_Idle -> S1_ArrayPrinted) via "Print Array" button logs expected console output', async ({ page }) => {
    // Validate that clicking the "Print Array" button triggers printArray() and logs the expected messages.
    const consoleMessages = [];
    page.on('console', (msg) => {
      // Collect only console.log messages for clarity, but store all for examination
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    const btn = page.getByRole('button', { name: 'Print Array' });
    await btn.click();

    // Wait a short time for logs to be emitted
    await page.waitForTimeout(200);

    // There should be at least two console logs: one for "Array:" and one for "Array with Image:"
    const texts = consoleMessages.map(m => m.text);
    const hasArrayLog = texts.some(t => t.includes('Array:'));
    const hasArrayWithImageLog = texts.some(t => t.includes('Array with Image:'));

    expect(hasArrayLog).toBeTruthy();
    expect(hasArrayWithImageLog).toBeTruthy();

    // Ensure the array log contains numbers 1 through 10 in some form
    const arrayLogMsg = texts.find(t => t.includes('Array:'));
    expect(arrayLogMsg).toBeTruthy();
    // Check few numbers appear as a sanity check
    expect(arrayLogMsg).toMatch(/1/);
    expect(arrayLogMsg).toMatch(/10/);

    // The DOM should remain present (image still visible)
    await expect(page.locator('.array img[alt="Array Image"]')).toBeVisible();
  });

  test('Transition PrintArrayWithAnimation (S0_Idle -> S1_ArrayPrinted) via "Print Array with Animation" button logs expected console output', async ({ page }) => {
    // Validate that clicking the "Print Array with Animation" button triggers the same printArray() behavior.
    const consoleMessages = [];
    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });

    const btnAnim = page.getByRole('button', { name: 'Print Array with Animation' });
    await btnAnim.click();

    // Wait for logs to appear
    await page.waitForTimeout(200);

    const hasArrayLog = consoleMessages.some(t => t.includes('Array:'));
    const hasArrayWithImageLog = consoleMessages.some(t => t.includes('Array with Image:'));

    expect(hasArrayLog).toBeTruthy();
    expect(hasArrayWithImageLog).toBeTruthy();

    // Validate that the image reference string is present in the "Array with Image" log text
    const imageLog = consoleMessages.find(t => t.includes('Array with Image:'));
    expect(imageLog).toBeTruthy();
    expect(imageLog).toContain('https://picsum.photos/200/300');
  });

  test('S1 Array Printed entry action "printArray()" - calling printArray() directly produces the same console output', async ({ page }) => {
    // The FSM lists printArray() as an entry action for the Array Printed state.
    // We invoke the function directly in the page context to ensure the function exists and behaves as expected.
    const consoleMessages = [];
    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });

    // Call printArray directly - it should be defined in the page script
    await page.evaluate(() => {
      // Call the function defined by the page. We do NOT redefine it.
      // eslint-disable-next-line no-undef
      return printArray();
    });

    // Small delay to ensure console events are captured
    await page.waitForTimeout(200);

    // Expect both console messages to have been emitted
    const hasArrayLog = consoleMessages.some(t => t.includes('Array:'));
    const hasArrayWithImageLog = consoleMessages.some(t => t.includes('Array with Image:'));

    expect(hasArrayLog).toBeTruthy();
    expect(hasArrayWithImageLog).toBeTruthy();
  });

  test('Edge case: rapid repeated clicks produce repeated console logs (debounce / reentrancy check)', async ({ page }) => {
    // Rapidly click the Print Array button multiple times and ensure logs scale accordingly
    const consoleMessages = [];
    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });

    const btn = page.getByRole('button', { name: 'Print Array' });

    // Click 3 times quickly
    await Promise.all([
      btn.click(),
      btn.click(),
      btn.click()
    ]);

    // Wait so console logs are flushed
    await page.waitForTimeout(300);

    // Each click should emit two logs: "Array:" and "Array with Image:"
    const arrayLogsCount = consoleMessages.filter(t => t.includes('Array:')).length;
    const arrayWithImageLogsCount = consoleMessages.filter(t => t.includes('Array with Image:')).length;

    expect(arrayLogsCount).toBeGreaterThanOrEqual(3);
    expect(arrayWithImageLogsCount).toBeGreaterThanOrEqual(3);
  });

  test('Verify there are exactly two buttons that use the onclick attribute printArray() (component extraction check)', async ({ page }) => {
    // Check the component extraction count implied by the FSM: two buttons with same onclick
    const handles = await page.locator("button[onclick='printArray()']").elementHandles();
    // Should find exactly 2 as per FSM
    expect(handles.length).toBe(2);
    // Validate their visible texts correspond to the evidence
    const texts = await Promise.all(handles.map(h => h.innerText()));
    expect(texts.some(t => t.includes('Print Array'))).toBeTruthy();
    expect(texts.some(t => t.includes('Print Array with Animation'))).toBeTruthy();
  });

  test('Intentional error scenario: ensure page emits pageerror if a missing function is invoked from within the page', async ({ page }) => {
    // This test reinforces the app's natural error behavior: invoking an undefined function leads to pageerror.
    const errors = [];
    const errorPromise = new Promise((resolve) => {
      page.on('pageerror', (err) => {
        errors.push(err);
        resolve(err);
      });
    });

    // Trigger an undefined function name intentionally via evaluate
    // We choose a random function name unlikely to exist to avoid interfering with actual implementation
    let evalError = null;
    try {
      await page.evaluate(() => {
        // eslint-disable-next-line no-undef
        return definitelyDoesNotExistFunctionXYZ123();
      });
    } catch (e) {
      evalError = e;
    }

    // Wait for pageerror to fire (or timeout if it doesn't)
    await Promise.race([
      errorPromise,
      new Promise(res => setTimeout(res, 500))
    ]);

    // There should be an evaluation error and a pageerror captured
    expect(evalError).not.toBeNull();
    expect(String(evalError.message)).toContain('definitelyDoesNotExistFunctionXYZ123');

    expect(errors.length).toBeGreaterThanOrEqual(1);
    const pageErrMsg = String(errors[0].message);
    expect(pageErrMsg).toContain('definitelyDoesNotExistFunctionXYZ123');
  });
});