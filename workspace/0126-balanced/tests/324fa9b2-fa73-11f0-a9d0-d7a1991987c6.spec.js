import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324fa9b2-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Abstract Syntax Tree Demo - FSM Validation (Application ID: 324fa9b2-fa73-11f0-a9d0-d7a1991987c6)', () => {
  // Shared setup: navigate to the page before each test and collect console/page errors
  test.beforeEach(async ({ page }) => {
    // Attach listeners to record console messages and page errors for assertions
    page.context()._astConsoleMessages = [];
    page.context()._astPageErrors = [];

    page.on('console', (msg) => {
      // store console messages for later assertions; convert to string for easier checks
      try {
        page.context()._astConsoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      } catch (e) {
        // ignore collecting errors about console message collection
      }
    });

    page.on('pageerror', (err) => {
      page.context()._astPageErrors.push(err);
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup custom properties to avoid leakage between tests in the same context
    try {
      delete page.context()._astConsoleMessages;
      delete page.context()._astPageErrors;
    } catch (e) {
      // ignore
    }
  });

  test('S0_Idle: initial render shows input, button and empty output (verify entry actions presence/absence)', async ({ page }) => {
    // This test validates the initial Idle state (S0_Idle) evidence:
    // - input#expression exists and has correct placeholder
    // - button#generateAST exists and is visible
    // - div#output exists and is empty
    // - FSM entry action renderPage() is mentioned in the FSM, verify it is not defined on the page (do NOT call it)
    const expr = page.locator('#expression');
    const button = page.locator('#generateAST');
    const output = page.locator('#output');

    await expect(expr).toBeVisible();
    await expect(expr).toHaveAttribute('placeholder', 'Enter expression (e.g., 3 + 5)');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Generate AST');

    // Output should be present and initially empty
    await expect(output).toBeVisible();
    const outputHTML = await output.innerHTML();
    expect(outputHTML.trim()).toBe('', 'Expected output div to be empty on initial render');

    // Verify the FSM-declared entry action renderPage is not defined in the global scope.
    // We must not call or inject anything; just check that the function does not exist.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Ensure no page errors occurred just by loading the page
    const pageErrors = page.context()._astPageErrors || [];
    expect(pageErrors.length).toBe(0);
  });

  test('Transition GenerateAST_Click with valid expression "3 + 5" should display AST nodes and replace output each time', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_AST_Generated:
    // - entering expression "3 + 5"
    // - clicking the Generate AST button results in AST rendered in #output
    // - ensure displayAST clears previous output (output.innerHTML = '') by clicking twice
    const expr1 = page.locator('#expression');
    const button1 = page.locator('#generateAST');
    const output1 = page.locator('#output1');

    // Ensure no pre-existing page errors recorded
    expect((page.context()._astPageErrors || []).length).toBe(0);

    await expr.fill('3 + 5');

    // Click to generate AST
    await button.click();

    // Wait for the AST to be rendered: at least one element with class 'node' should be present
    const nodeLocator = output.locator('.node');
    await expect(nodeLocator.first()).toBeVisible();

    // The AST for "3 + 5" should contain a BinaryExpression node and two Literal nodes (left/right)
    const outputText = await output.innerText();
    expect(outputText).toContain('BinaryExpression');
    // There should be at least two 'Literal' occurrences (left and right)
    const literalOccurrences = (outputText.match(/Literal/g) || []).length;
    expect(literalOccurrences).toBeGreaterThanOrEqual(2);

    // Verify that clicking again replaces (does not append) the output:
    // Count direct children of #output after first render
    const childCountAfterFirst = await page.evaluate(() => {
      const out = document.getElementById('output');
      return out ? out.children.length : 0;
    });

    // Click again
    await button.click();

    // Wait a short time to allow re-render
    await page.waitForTimeout(100);

    const childCountAfterSecond = await page.evaluate(() => {
      const out1 = document.getElementById('output');
      return out ? out.children.length : 0;
    });

    // The displayAST function sets output.innerHTML = '' before appending, so number of top-level children should be reset to 1
    expect(childCountAfterFirst).toBeGreaterThanOrEqual(1);
    expect(childCountAfterSecond).toBeGreaterThanOrEqual(1);
    expect(childCountAfterSecond).toBe(1);

    // Ensure no uncaught page errors occurred for this valid expression
    const pageErrors1 = page.context()._astPageErrors || [];
    expect(pageErrors.length).toBe(0);
  });

  test('Transition GenerateAST_Click with empty input triggers parsing error (edge case) and a pageerror is emitted', async ({ page }) => {
    // This test validates the error scenario where the input expression is empty.
    // The parser should throw "Unexpected token: undefined" and this uncaught error should be observable as a pageerror.
    const expr2 = page.locator('#expression');
    const button2 = page.locator('#generateAST');
    const output2 = page.locator('#output2');

    // Ensure field is empty
    await expr.fill('');

    // Wait for the pageerror event triggered by the click -> parse -> throw
    // use Promise.all to ensure we capture the pageerror that results from clicking
    const [pageError] = await Promise.all([
      page.waitForEvent('pageerror'),
      button.click()
    ]);

    // Assert that the captured error message matches expected parser error
    expect(pageError).toBeTruthy();
    const msg = pageError.message || pageError.toString();
    expect(msg).toContain('Unexpected token');

    // Output should remain empty because displayAST is never reached successfully
    const outputHTML1 = await output.innerHTML();
    expect(outputHTML.trim()).toBe('', 'Expected output to remain empty when parsing fails');

    // Also ensure our stored page errors include at least one error and it matches the observed one
    const storedErrors = page.context()._astPageErrors || [];
    expect(storedErrors.length).toBeGreaterThanOrEqual(1);
    expect(storedErrors.some(e => (e.message || e.toString()).includes('Unexpected token'))).toBe(true);
  });

  test('Transition GenerateAST_Click with trailing operator "3 +" triggers parsing error (edge case)', async ({ page }) => {
    // This test validates another malformed expression edge-case: operator at end.
    // It should similarly throw an "Unexpected token: undefined" error.
    const expr3 = page.locator('#expression');
    const button3 = page.locator('#generateAST');

    await expr.fill('3 +');

    const [pageError] = await Promise.all([
      page.waitForEvent('pageerror'),
      button.click()
    ]);

    expect(pageError).toBeTruthy();
    const msg1 = pageError.message || pageError.toString();
    expect(msg).toContain('Unexpected token');

    // Confirm stored errors captured by the listener include this message
    const storedErrors1 = page.context()._astPageErrors || [];
    expect(storedErrors.length).toBeGreaterThanOrEqual(1);
    expect(storedErrors.some(e => (e.message || e.toString()).includes('Unexpected token'))).toBe(true);
  });

  test('Event wiring: clicking #generateAST triggers the handler (behavioral verification)', async ({ page }) => {
    // Verifies that the Generate AST button has an event listener attached and clicking it leads to some action.
    // We do this by spying on the output change when a simple literal is input.
    const expr4 = page.locator('#expression');
    const button4 = page.locator('#generateAST');
    const output3 = page.locator('#output3');

    await expr.fill('42');

    // Click and wait for a node to appear in output
    await button.click();

    // The AST for a single literal is just a Literal node; ensure the output contains 'Literal'
    await expect(output.locator('.node')).toBeVisible();
    const outText = await output.innerText();
    expect(outText).toContain('Literal');

    // No page errors expected for this simple literal
    const pageErrors2 = page.context()._astPageErrors || [];
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity check: console should not show uncaught exceptions on valid interactions', async ({ page }) => {
    // This test confirms that during normal valid usage (simple input) there are no console.error page errors recorded.
    const expr5 = page.locator('#expression');
    const button5 = page.locator('#generateAST');

    await expr.fill('7 + 8');
    await button.click();

    // Small wait to let any async errors bubble up (if any)
    await page.waitForTimeout(100);

    const pageErrors3 = page.context()._astPageErrors || [];
    // For this valid input, we expect no uncaught errors
    expect(pageErrors.length).toBe(0);

    // Also ensure console did not record any 'error' messages
    const consoleMessages = page.context()._astConsoleMessages || [];
    const errorConsoleCount = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning').length;
    expect(errorConsoleCount).toBe(0);
  });
});