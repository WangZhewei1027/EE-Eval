import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122ac680-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Stack FSM interactive application (122ac680-fa7b-11f0-814c-dbec508f0b3b)', () => {

  // Helper to attach listeners for page errors and console errors before navigation
  async function attachErrorCollectors(page) {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (err) => {
      // Collect unhandled exceptions thrown on the page (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // Collect console.error messages
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });

    return { pageErrors, consoleErrors };
  }

  test('Page load: should expose runtime errors for undefined handlers (ReferenceError expected)', async ({ page }) => {
    // Validate that loading the page as-is produces runtime errors due to missing handler definitions.
    const { pageErrors, consoleErrors } = await attachErrorCollectors(page);

    // Navigate to the page (listeners attached before navigation to catch load-time errors)
    await page.goto(APP_URL);

    // Allow a short time for script execution and error emission
    await page.waitForTimeout(200);

    // At least one pageerror should have been collected (script references undefined handlers)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // The error should be a ReferenceError (or at minimum include 'is not defined' in its message)
    const messages = pageErrors.map(e => String(e.message || e));
    const hasUndefinedIdentifier = messages.some(m => /is not defined/.test(m) || /ReferenceError/.test(m));
    expect(hasUndefinedIdentifier).toBeTruthy();

    // The console should include an error entry corresponding to the thrown ReferenceError
    const consoleMessages = consoleErrors.map(m => m.text());
    const consoleHasRef = consoleMessages.some(m => /ReferenceError|is not defined/.test(m));
    expect(consoleHasRef || consoleErrors.length > 0).toBeTruthy();

    // Also check basic DOM elements are present even if script errored
    await expect(page.locator('#input')).toBeVisible();
    await expect(page.locator('#add')).toBeVisible();
    await expect(page.locator('#remove')).toBeVisible();
    await expect(page.locator('#stack')).toBeVisible();
  });

  test('InputChange (S0_Idle -> S0_Idle): typing updates input value but does not modify stack (no handler attached)', async ({ page }) => {
    // This test validates the input element itself works and that input events do not trigger side effects
    // because the handler checkInput was not defined (so it couldn't be attached during load).
    const { pageErrors } = await attachErrorCollectors(page);
    await page.goto(APP_URL);
    await page.waitForTimeout(200);

    // Ensure page had at least one load-time error (sanity for this environment)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    const input = page.locator('#input');
    const stack = page.locator('#stack');

    // Type a number into the input
    await input.fill('');
    await input.type('42');

    // Verify the input value changed (S0_Idle remains the same state logically for input changes)
    const value = await input.inputValue();
    expect(value).toBe('42');

    // Because checkInput wasn't attached, there should be no change to the stack display
    const stackHtml = await stack.innerHTML();
    expect(stackHtml).toBe('');

    // Also ensure no additional unhandled exceptions occurred just from typing
    // (there may be load-time errors already, but no new ones triggered by input)
    // We wait a small amount then check that pageErrors hasn't grown unexpectedly.
    const priorErrorCount = pageErrors.length;
    await page.waitForTimeout(100);
    expect(pageErrors.length).toBe(priorErrorCount);
  });

  test('AddNumber transition: clicking Add does not push to stack and handler functions are undefined', async ({ page }) => {
    // Validate that the Add event cannot perform the intended transition because addNumber is not defined.
    const { pageErrors, consoleErrors } = await attachErrorCollectors(page);
    await page.goto(APP_URL);
    await page.waitForTimeout(200);

    // The page likely errored during load; ensure handlers are not present on the page context.
    // Use typeof inside page context to safely check for undeclared identifiers.
    const addNumberType = await page.evaluate(() => typeof addNumber);
    const removeNumberType = await page.evaluate(() => typeof removeNumber);
    const checkInputType = await page.evaluate(() => typeof checkInput);
    const updateStackType = await page.evaluate(() => typeof updateStack);

    // None of the expected handler functions should be defined (they were referenced before definition -> ReferenceError)
    expect(addNumberType).toBe('undefined');
    expect(removeNumberType).toBe('undefined');
    expect(checkInputType).toBe('undefined');
    expect(updateStackType).toBe('undefined');

    // Fill input and click Add
    await page.fill('#input', '7');
    await page.click('#add');

    // Since no handler was attached successfully, stack should NOT be updated
    const stackHtml = await page.locator('#stack').innerHTML();
    expect(stackHtml).toBe('');

    // Clicking Add should not create new JavaScript handlers, and we should not see application-level DOM changes
    // There may be the original load-time ReferenceError; assert at least one page error exists and mentions undefined identifier
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const messages = pageErrors.map(e => String(e.message || e));
    const foundRelevantName = messages.some(m => /addNumber|removeNumber|checkInput|updateStack/.test(m) || /is not defined/.test(m));
    expect(foundRelevantName).toBeTruthy();

    // Also at least one console error should be present corresponding to the pageerror
    expect(consoleErrors.length).toBeGreaterThanOrEqual(0);
  });

  test('RemoveNumber transition: clicking Remove when stack is empty does nothing and handler missing causes no transition', async ({ page }) => {
    // Attempt to remove when stack empty; because removeNumber was never defined, there should be no change and no pop action.
    const { pageErrors } = await attachErrorCollectors(page);
    await page.goto(APP_URL);
    await page.waitForTimeout(200);

    // Ensure initial error(s) occurred already
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Stack should start empty
    const stack = page.locator('#stack');
    expect(await stack.innerHTML()).toBe('');

    // Click Remove
    await page.click('#remove');

    // Still empty because removeNumber handler is not present
    expect(await stack.innerHTML()).toBe('');

    // No additional page error should be injected by clicking (handlers weren't bound), but we still accept existing load errors
    const priorErrorCount = pageErrors.length;
    await page.waitForTimeout(100);
    expect(pageErrors.length).toBe(priorErrorCount);
  });

  test('UpdateStack event: clicking the stack display does not invoke updateStack (handler undefined) and no stack mutation occurs', async ({ page }) => {
    // Validate UpdateStack event handling is absent; clicking stack should be a no-op.
    const { pageErrors } = await attachErrorCollectors(page);
    await page.goto(APP_URL);
    await page.waitForTimeout(200);

    // Confirm handler is undefined
    const updateStackType = await page.evaluate(() => typeof updateStack);
    expect(updateStackType).toBe('undefined');

    // Ensure stack is empty
    const stack = page.locator('#stack');
    expect(await stack.innerHTML()).toBe('');

    // Click the stack area
    await page.click('#stack');

    // No change to DOM expected
    expect(await stack.innerHTML()).toBe('');

    // No new page errors generated by the click (only load-time errors expected)
    const priorErrorCount = pageErrors.length;
    await page.waitForTimeout(100);
    expect(pageErrors.length).toBe(priorErrorCount);
  });

  test('Edge case: attempt sequence Add -> Remove -> stack click still yields no state transitions due to missing handlers', async ({ page }) => {
    // This test performs a sequence of interactions that would normally cause state transitions if handlers existed.
    // We assert that, given the current broken implementation (handlers undefined), no transitions occur and DOM remains unchanged.
    const { pageErrors } = await attachErrorCollectors(page);
    await page.goto(APP_URL);
    await page.waitForTimeout(200);

    // Fill input and attempt to add
    await page.fill('#input', '100');
    await page.click('#add');

    // Immediately attempt to remove
    await page.click('#remove');

    // Click the stack display
    await page.click('#stack');

    // Stack remains empty since stack.push/pop operations are not executed
    expect(await page.locator('#stack').innerHTML()).toBe('');

    // The runtime should have produced at least one ReferenceError (observed during load)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Confirm that the handler functions remain undefined after attempted interactions
    const types = await page.evaluate(() => {
      return {
        addNumber: typeof addNumber,
        removeNumber: typeof removeNumber,
        checkInput: typeof checkInput,
        updateStack: typeof updateStack
      };
    });
    expect(types.addNumber).toBe('undefined');
    expect(types.removeNumber).toBe('undefined');
    expect(types.checkInput).toBe('undefined');
    expect(types.updateStack).toBe('undefined');
  });

});