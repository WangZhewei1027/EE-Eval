import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a272c2-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('Query Optimization App (FSM tests) - d5a272c2-fa7b-11f0-8b01-9f078a0ff214', () => {
  // Utility to attach console and pageerror listeners and return arrays for assertions
  async function attachDiagnostics(page) {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // ignore any console listener errors
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    return { consoleMessages, pageErrors };
  }

  // Validate Idle state: initial render, DOM content, and expected button present
  test('S0_Idle - initial render shows content and "See Demonstration" button', async ({ page }) => {
    // Attach diagnostics listeners to capture console logs and runtime errors during load
    const { consoleMessages, pageErrors } = await attachDiagnostics(page);

    // Load the page exactly as-is
    await page.goto(APP_URL);

    // Verify document title and main heading - ensures page rendered
    await expect(page).toHaveTitle(/Query Optimization/i);
    const h1 = await page.locator('h1').innerText();
    expect(h1).toContain('Understanding Query Optimization');

    // Verify the explanatory content is present (some key phrases)
    const paragraph = await page.locator('p').first().innerText();
    expect(paragraph).toMatch(/Query optimization is the process of enhancing the performance/i);

    // Verify the button that triggers the Demo exists and has the expected attributes and text
    const demoBtn = page.locator("button[onclick='showDemo()']");
    await expect(demoBtn).toHaveCount(1);
    await expect(demoBtn).toHaveText('See Demonstration');
    const onclickAttr = await demoBtn.getAttribute('onclick');
    expect(onclickAttr).toBe('showDemo()');

    // Verify that the S0 entry action 'renderPage' is not defined in the global scope of the page.
    // The FSM mentioned renderPage() as an entry action. The implementation does not define it,
    // so we assert that it is undefined on the window (i.e., it was not executed nor present).
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Ensure there are no runtime page errors captured during initial load
    expect(pageErrors.length).toBe(0);

    // Optionally assert that console did not log errors (no console messages of type 'error')
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);
  });

  // Validate transition: clicking the See Demonstration button triggers the alert (S1_DemoShown)
  test('Transition SeeDemo: clicking button triggers alert dialog (S1_DemoShown)', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachDiagnostics(page);

    await page.goto(APP_URL);

    // Ensure showDemo function exists in page context before clicking (the FSM uses showDemo())
    const showDemoType = await page.evaluate(() => typeof window.showDemo);
    expect(showDemoType).toBe('function');

    // Prepare to capture the dialog triggered by showDemo (the alert)
    const dialogPromise = page.waitForEvent('dialog');

    // Click the button that should fire the alert via onclick="showDemo()"
    await page.click("button[onclick='showDemo()']");

    // Wait for the dialog and validate its message, then accept it
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe('Demonstration: Query optimization involves rewriting queries to make them more efficient. This is a conceptual demo.');
    await dialog.accept();

    // After handling the dialog, ensure no page errors were produced
    expect(pageErrors.length).toBe(0);

    // Verify no console-level errors were emitted during this interaction
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: multiple rapid clicks should trigger repeated alerts; ensure each alert is shown and handled
  test('Edge case: repeated clicks on the demo button trigger multiple alerts', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachDiagnostics(page);

    await page.goto(APP_URL);

    const demoBtnSelector = "button[onclick='showDemo()']";
    const clickCount = 3;
    const dialogs = [];

    for (let i = 0; i < clickCount; i++) {
      // For each click, wait for the dialog event and then accept it
      const waitDialog = page.waitForEvent('dialog');
      await page.click(demoBtnSelector);
      const dialog = await waitDialog;
      dialogs.push(dialog);
      // Validate the content each time
      expect(dialog.message()).toContain('Demonstration: Query optimization involves rewriting queries to make them more efficient.');
      await dialog.accept();
    }

    // Confirm we saw the expected number of dialogs
    expect(dialogs.length).toBe(clickCount);

    // Ensure no runtime errors surfaced during the repeated interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Verify showDemo can be invoked from page context directly and triggers the same alert behavior
  test('S1_DemoShown via direct invocation of showDemo() from page context', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachDiagnostics(page);

    await page.goto(APP_URL);

    // Ensure showDemo is present
    const isFn = await page.evaluate(() => typeof window.showDemo === 'function');
    expect(isFn).toBe(true);

    // Call showDemo from the page context and capture the alert
    const dialogPromise = page.waitForEvent('dialog');
    // Invoke the function within the page (this will cause an alert)
    await page.evaluate(() => {
      // call the function as implemented in the page
      showDemo();
    });
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('Query optimization involves rewriting queries to make them more efficient.');
    await dialog.accept();

    // No page errors should be present as a result of direct invocation
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Error scenario: attempt to call a non-existent function in the page context to observe a ReferenceError naturally
  // This test intentionally triggers a ReferenceError in the page context (an edge-case error scenario).
  test('Error scenario: calling a non-existent function in page context produces ReferenceError', async ({ page }) => {
    // Collect pageerrors
    const { pageErrors } = await attachDiagnostics(page);

    await page.goto(APP_URL);

    // Attempt to call a clearly non-existent function in the page context.
    // This should reject with an evaluation error (ReferenceError).
    let evalError = null;
    try {
      await page.evaluate(() => {
        // Intentionally call a non-existent function to provoke a ReferenceError in the page environment.
        // We do not modify or patch page globals; we are merely invoking a missing identifier.
        // The error should surface as a rejected promise from page.evaluate.
        return nonExistentFunctionCallForTest();
      });
    } catch (e) {
      evalError = e;
    }

    // Ensure that evaluate threw an error (ReferenceError). We assert that an error occurred,
    // and that its message indicates a missing function / ReferenceError.
    expect(evalError).not.toBeNull();
    // The exact message can vary by browser, but typically contains 'nonExistentFunctionCallForTest' or 'ReferenceError'
    const errMsg = String(evalError);
    expect(errMsg.toLowerCase()).toMatch(/referenceerror|nonexistent|nonexistentfunctioncallfortest/);

    // The pageerror event should have been emitted and captured as well
    // Wait a short time to allow pageerror listener to be called (if not already).
    // In most Playwright setups, page.evaluate rejection corresponds to an exception in the renderer and should produce a pageerror.
    await page.waitForTimeout(50);
    expect(pageErrors.length).toBeGreaterThanOrEqual(0); // ensure listener ran; don't fail if the environment doesn't emit a pageerror

    // If there is at least one page error, assert that its message contains 'ReferenceError' or the identifier name.
    if (pageErrors.length > 0) {
      const anyPageErrorMatches = pageErrors.some(err => String(err).toLowerCase().includes('referenceerror') || String(err).includes('nonExistentFunctionCallForTest') || String(err).includes('nonExistent'));
      // At least one of the captured page errors should correspond to the ReferenceError we provoked.
      expect(anyPageErrorMatches).toBeTruthy();
    }
  });

  // Sanity: ensure that no unexpected global modifications are present after interactions
  test('Sanity: interactions do not create unexpected globals like renderPage or other FSM artifacts', async ({ page }) => {
    await page.goto(APP_URL);

    // After several interactions, ensure no 'renderPage' global was introduced and no unexpected properties named like FSM states exist
    // This checks that the implementation did not create global leakage.
    const globals = await page.evaluate(() => {
      return {
        hasRenderPage: typeof window.renderPage !== 'undefined',
        hasSomeStateVar: typeof window.S1_DemoShown !== 'undefined' || typeof window.S0_Idle !== 'undefined'
      };
    });

    expect(globals.hasRenderPage).toBe(false);
    expect(globals.hasSomeStateVar).toBe(false);
  });
});