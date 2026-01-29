import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5af9920-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Stack interactive application (FSM verification)', () => {
  // Shared arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset captures
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors for assertions
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // Defensive: if reading message fails, still record minimal info
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Load the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // detach listeners by closing page (Playwright will do this automatically for isolated tests)
    await page.close();
  });

  test('Initial State: "Click to demonstrate" button is present and visible', async ({ page }) => {
    // Validate initial state S0_Initial evidence: the button exists with expected text
    const button = page.locator('#stack-demo');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Click to demonstrate');

    // Ensure no runtime errors have occurred on initial load (no premature page errors)
    expect(pageErrors.length).toBe(0);

    // Ensure that the example <script> inside <pre> did not execute on page load:
    // we assert that no console log from the example (like "3", "2", "false", "true") was emitted.
    const foundExampleLogs = consoleMessages.some(m =>
      /(^|\s)(3|2|false|true)($|\s)/.test(m.text)
    );
    expect(foundExampleLogs).toBeFalsy();
  });

  test('Click event triggers the demo handler: verifies presence of handler source and expected actions in script', async ({ page }) => {
    // Validate that a script element contains the click handler and the stack operation strings.
    // This verifies the FSM "actions" (push/pop/peek/isEmpty) are present in the implementation text.
    const scriptsText = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script')).map(s => s.textContent || '')
    );

    // Find a script that registers the click handler
    const handlerScript = scriptsText.find(t => t.includes('addEventListener') || t.includes('stack.push'));

    expect(handlerScript).toBeTruthy();

    // Confirm that the handler script contains the push/pop/peek/isEmpty sequences (entry/transition actions)
    expect(handlerScript).toContain('stack.push(1)');
    expect(handlerScript).toContain('stack.push(2)');
    expect(handlerScript).toContain('stack.push(3)');
    expect(handlerScript).toContain('stack.pop()');
    expect(handlerScript).toContain('stack.peek()');
    expect(handlerScript).toContain('stack.isEmpty()');

    // Also ensure the code registers an event listener for the #stack-demo button
    expect(handlerScript).toMatch(/getElementById\(["']stack-demo["']\)\.addEventListener\s*\(\s*["']click["']/);
  });

  test('Clicking the demo button results in a ReferenceError because Stack class is only present in the <pre> text (not executed)', async ({ page }) => {
    // This test validates the runtime error scenario: onClick, the page tries to create `new Stack()` but Stack is not defined
    // We wait for the 'pageerror' event that will be emitted when the ReferenceError occurs.
    const [pageError] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#stack-demo')
    ]);

    // We expect a ReferenceError (Stack is not defined). Browser error messages vary, so do a flexible match.
    expect(pageError).toBeTruthy();
    expect(pageError.message).toMatch(/Stack.*not defined|Stack is not defined/i);

    // Confirm that we recorded the error in the pageErrors array as well
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    expect(pageErrors[pageErrors.length - 1].message).toMatch(/Stack.*not defined|Stack is not defined/i);

    // The intended console.log outputs from a successful demo (like "3" and "2") should NOT appear since the handler failed.
    const hasNumericLogs = consoleMessages.some(m => /(^|\s)(3|2)($|\s)/.test(m.text));
    expect(hasNumericLogs).toBeFalsy();
  });

  test('Multiple clicks each trigger the same runtime error (transition attempts fail consistently)', async ({ page }) => {
    // Click multiple times and ensure each click produces a pageerror (ReferenceError)
    const clicks = 3;
    const capturedErrors = [];

    for (let i = 0; i < clicks; i++) {
      // Wait for the next pageerror triggered by each click
      const [err] = await Promise.all([
        page.waitForEvent('pageerror'),
        page.click('#stack-demo')
      ]);
      capturedErrors.push(err);
    }

    // Assert that we captured the expected number of errors
    expect(capturedErrors.length).toBe(clicks);

    // Assert that each error message indicates the missing Stack definition
    for (const err of capturedErrors) {
      expect(err.message).toMatch(/Stack.*not defined|Stack is not defined/i);
    }

    // Overall pageErrors array should have at least the same count (could include prior errors)
    expect(pageErrors.length).toBeGreaterThanOrEqual(clicks);
  });

  test('FSM transitions (S1..S4) cannot complete due to runtime error: verify absence of expected successful logs and presence of handler code', async ({ page }) => {
    // The FSM expects console outputs for transitions:
    // - S1 (after pushes) would result in "Stack contains 3 elements" observable (implementation logs pop/peek/isEmpty)
    // - S2: pop logs 3
    // - S3: peek logs 2
    // - S4: isEmpty logs true
    //
    // This test clicks once and asserts these successful observables are absent, because the handler throws ReferenceError.
    await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#stack-demo')
    ]);

    // Ensure none of the expected successful observables are present in the console logs
    const consoleText = consoleMessages.map(m => m.text).join('\n');
    expect(consoleText).not.toContain('3');
    expect(consoleText).not.toContain('2');
    expect(consoleText).not.toContain('true');
    expect(consoleText).not.toContain('false');

    // For extra assurance, validate that the source code contains the evidence strings for transitions (so FSM mapping matches implementation text)
    const scriptsText = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script')).map(s => s.textContent || '')
    );

    const evidenceScript = scriptsText.find(t =>
      t.includes('stack.push(1);') && t.includes('stack.pop()') && t.includes('console.log(stack.peek())')
    );
    // The script containing the handler should exist and include the evidence lines (even though not executed)
    expect(evidenceScript).toBeTruthy();
  });

  test('Edge case: clicking non-existent element does not produce extra page errors', async ({ page }) => {
    // Attempt to click an element that does not exist and ensure Playwright throws a timeout/locator error on client side,
    // but we assert that no additional page runtime errors (ReferenceError, TypeError, SyntaxError) are produced by the page itself.
    let playwrightErrorOccurred = false;
    try {
      // This will throw in Playwright because the element is not found within the default timeout.
      await page.click('#nonexistent-button', { timeout: 1000 });
    } catch (e) {
      playwrightErrorOccurred = true;
      // expected: Playwright throws a click/timeout error; this is not a page runtime error, we just note it.
    }

    expect(playwrightErrorOccurred).toBeTruthy();

    // Ensure no new page-level runtime errors were introduced by attempting to click a missing element
    // (pageErrors should only contain errors from legitimate handler runs)
    // In practice, it should remain the same as before (no new runtime exceptions).
    // We assert that all captured pageErrors (if any) are ReferenceError related to Stack not being defined.
    for (const err of pageErrors) {
      expect(err.message).toMatch(/Stack.*not defined|Stack is not defined/i);
    }
  });

  test('Implementation sanity: the example code is displayed as text inside <pre> and did not execute on load', async ({ page }) => {
    // The <pre> block should contain the example script text (the script tag appears as content and thus is not executed)
    const preText = await page.locator('pre').innerText();
    expect(preText).toContain('class Stack');
    expect(preText).toContain('push(element)');
    expect(preText).toContain('pop()');
    expect(preText).toContain('peek()');
    expect(preText).toContain('isEmpty()');

    // Confirm that on page load there were no example console logs emitted (the script inside <pre> did not run)
    const logsOnLoad = consoleMessages.filter(m => m.type === 'log' || m.type === 'debug');
    // There should be zero logs reflecting the example run; specifically verify absence of sample outputs
    const sampleOutputs = ['3', '2', 'false', 'true'];
    for (const out of sampleOutputs) {
      expect(logsOnLoad.some(l => l.text.includes(out))).toBeFalsy();
    }
  });
});