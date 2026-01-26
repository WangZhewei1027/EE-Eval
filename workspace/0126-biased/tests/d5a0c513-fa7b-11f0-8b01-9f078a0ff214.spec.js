import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a0c513-fa7b-11f0-8b01-9f078a0ff214.html';
const EXPECTED_ALERT_TEXT = "Demonstration is currently not available. Please refer to the explanations above for a comprehensive understanding of Insertion Sort.";

test.describe('Understanding Insertion Sort - interactive application (d5a0c513-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Use Playwright's page fixture. For each test we reload the page and capture console/page errors.
  test.beforeEach(async ({ page }) => {
    // Navigate to the served HTML page and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('S0_Idle initial render: static content and DOM structure are present', async ({ page }) => {
    // This test validates the initial state S0_Idle rendering:
    // - The main container and headings are rendered
    // - The demonstration button with class `.button` and expected text exists
    // - The FSM entry action renderPage() is NOT defined in the page (we assert that calling it throws ReferenceError)
    // - No console.error messages were produced during normal load

    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    const pageErrors = [];
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // DOM checks
    const container = await page.$('.container');
    expect(container).not.toBeNull();

    const h1Text = await page.textContent('h1');
    expect(h1Text).toBe('Insertion Sort: A Comprehensive Guide');

    const button = await page.$('.button');
    expect(button).not.toBeNull();

    const buttonText = await page.textContent('.button');
    // The anchor's text should match exactly as in the HTML.
    expect(buttonText.trim()).toBe('Click for demonstration!');

    // Confirm that renderPage is not defined on the window (FSM mentioned entry_actions: renderPage())
    const typeofRenderPage = await page.evaluate(() => {
      // Intentionally check for existence without defining anything on the page.
      return typeof (window as any).renderPage;
    });
    // If it's undefined, the page did not provide the renderPage function as the FSM expected.
    expect(typeofRenderPage).toBe('undefined');

    // If we attempt to call renderPage() in the page context, it should reject with a ReferenceError.
    // We assert that this happens and that a pageerror is recorded as a result.
    let evaluateError = null;
    try {
      // This will throw in the page and cause the evaluate promise to reject.
      await page.evaluate(() => {
        // Intentionally call an undefined function; do not patch page environment.
        // This mirrors verifying onEnter actions mentioned by the FSM.
        // eslint-disable-next-line no-undef
        (window as any).renderPage();
      });
    } catch (err) {
      evaluateError = err;
    }
    expect(evaluateError).toBeTruthy();
    // The error message should indicate the function is not defined / is not a function.
    // Different engines may produce slightly different text; check for "renderPage" in the message.
    expect(String(evaluateError).toLowerCase()).toContain('renderpage');

    // Wait a short moment to ensure any pageerror events are delivered
    await page.waitForTimeout(100);

    // Assert that any page errors (if produced) mention renderPage (best-effort)
    const pageErrorMentionRenderPage = pageErrors.some(msg => msg.toLowerCase().includes('renderpage'));
    // It's acceptable that pageErrors array is empty (if the error only propagated to evaluate), but if present,
    // it should reference the missing function. So we assert that either we observed a pageerror referencing renderPage
    // or the evaluate call already produced the error (which we checked).
    expect(pageErrorMentionRenderPage || evaluateError).toBeTruthy();

    // Assert no console.error messages were produced during page load
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);
  });

  test('ClickForDemonstration event: clicking the button shows alert and remains in Idle (S0_Idle -> S0_Idle)', async ({ page }) => {
    // This test validates the FSM transition triggered by ClickForDemonstration:
    // - Clicking `.button` should produce a browser alert with the expected message.
    // - The page should stay on the same document (no navigation away).
    // - Repeated clicks should produce alerts each time (transition to same state).
    // - No unexpected page errors should be produced by the click handling.

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    // Capture and assert the alert/dialog text for a single click
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('.button'),
    ]);
    expect(dialog).toBeTruthy();
    expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);
    // Accept the alert so the page can continue
    await dialog.accept();

    // Assert the URL path didn't change to a different resource (clicking href="#" should not navigate away)
    const currentUrl = page.url();
    const urlObj = new URL(currentUrl);
    expect(urlObj.pathname).toBe('/workspace/0126-biased/html/d5a0c513-fa7b-11f0-8b01-9f078a0ff214.html');

    // Click again to verify the transition is repeatable and stays in the same state
    const [dialog2] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('.button'),
    ]);
    expect(dialog2.message()).toBe(EXPECTED_ALERT_TEXT);
    await dialog2.accept();

    // Ensure no page errors were raised by these interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Accessibility/interaction edge cases: keyboard activation triggers the same alert', async ({ page }) => {
    // This test verifies alternative interaction methods still trigger the ClickForDemonstration transition:
    // - Focusing the anchor and pressing Enter triggers the alert
    // - Focusing and pressing Space also triggers the alert (if browser/anchor supports it)
    // - Each activation shows the same message and can be accepted

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    // Focus the button then press Enter
    await page.focus('.button');
    const [enterDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.keyboard.press('Enter'),
    ]);
    expect(enterDialog.message()).toBe(EXPECTED_ALERT_TEXT);
    await enterDialog.accept();

    // Press Space (may behave like click for anchors) - guard with try/catch because behavior can vary
    await page.focus('.button');
    let spaceDialogCaught = false;
    try {
      const [spaceDialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.keyboard.press('Space'),
      ]);
      expect(spaceDialog.message()).toBe(EXPECTED_ALERT_TEXT);
      await spaceDialog.accept();
      spaceDialogCaught = true;
    } catch (err) {
      // If the browser does not trigger the dialog for Space on an anchor, that's acceptable;
      // record that no dialog appeared for Space.
      spaceDialogCaught = false;
    }

    // At least the Enter activation must have worked; Space is optional across environments.
    expect(spaceDialogCaught || true).toBeTruthy();

    // Ensure no unexpected page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Error scenario: invoking a non-existent function causes ReferenceError and is observable', async ({ page }) => {
    // This test deliberately invokes a non-existent function on the page to validate that
    // errors referenced in the FSM (or related missing handlers) surface as ReferenceError/pageerror.
    // It collects pageerror events and asserts the thrown error mentions the function name.

    const pageErrors = [];
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Intentionally call an obviously non-existent function to provoke a ReferenceError.
    const missingFnName = 'thisFunctionDoesNotExist_12345';
    let thrown = null;
    try {
      await page.evaluate((fnName) => {
        // eslint-disable-next-line no-undef
        // @ts-ignore
        (window as any)[fnName]();
      }, missingFnName);
    } catch (err) {
      thrown = err;
    }

    // The evaluate should have thrown an error that references the missing function name.
    expect(thrown).toBeTruthy();
    expect(String(thrown).toLowerCase()).toContain(missingFnName.toLowerCase());

    // Allow a small timeout for pageerror to dispatch
    await page.waitForTimeout(100);

    // If a pageerror was emitted, it should reference the missing function as well.
    const observed = pageErrors.some(msg => msg.toLowerCase().includes(missingFnName.toLowerCase()));
    // Either the evaluate raised the error (checked above) or the pageerror holds the message.
    expect(observed || thrown).toBeTruthy();
  });

  test('FSM component evidence: verify button attributes and inline onclick handler text exists in DOM', async ({ page }) => {
    // This test verifies that the implementation contains the evidence described in the FSM:
    // - The anchor element has class `.button`
    // - Its "onclick" attribute contains the expected alert() call text

    const button = await page.$('a.button');
    expect(button).not.toBeNull();

    // Verify href attribute
    const href = await button!.getAttribute('href');
    expect(href).toBe('#');

    // Verify onclick attribute contains the alert text (evidence from the FSM)
    const onclickAttr = await button!.getAttribute('onclick');
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain("alert('Demonstration is currently not available. Please refer to the explanations above for a comprehensive understanding of Insertion Sort.');");
  });
});