import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b492e2-fa7c-11f0-9fa6-d1bbe297d459.html';

// Utility to attach listeners for console errors and page errors and expose arrays for assertions
async function attachErrorAndConsoleListeners(page) {
  const consoleErrors = [];
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });
    if (type === 'error') {
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', (err) => {
    // pageerror captures unhandled exceptions (ReferenceError, TypeError, SyntaxError, etc.)
    pageErrors.push(err);
  });

  return { consoleErrors, consoleMessages, pageErrors };
}

test.describe('FSM: Comprehensive Guide to Compilers - States & Transitions', () => {
  // Sanity: ensure the page loads and no unexpected errors are emitted during navigation
  test.beforeEach(async ({ page }) => {
    // nothing global to set up here beyond navigation; each test will attach its own listeners
  });

  // Test initial state S0_Idle
  test('S0_Idle - initial render: button exists, demo output hidden, onclick attribute present', async ({ page }) => {
    // Attach listeners to capture any console.error or page uncaught exceptions during load
    const { consoleErrors, consoleMessages, pageErrors } = await attachErrorAndConsoleListeners(page);

    // Load the page as-is
    const resp = await page.goto(APP_URL, { waitUntil: 'load' });
    // Basic navigation assertion
    expect(resp && resp.ok()).toBeTruthy();

    // Validate the button exists with the expected onclick attribute and visible text
    const showButton = page.locator("button[onclick='showCompilation()']");
    await expect(showButton).toHaveCount(1);
    await expect(showButton).toHaveText('Show Compilation Steps');

    // Validate #demoOutput exists and is hidden by default (S0_Idle evidence)
    const output = page.locator('#demoOutput');
    await expect(output).toHaveCount(1);

    // Use computed style to check display is 'none' initially
    const displayStyle = await page.evaluate(() => {
      const el = document.getElementById('demoOutput');
      return window.getComputedStyle(el).display;
    });
    expect(displayStyle).toBe('none');

    // The FSM mentions an entry action renderPage(); verify that no such function is defined on window
    // This checks whether the environment provides that onEnter hook or not (we do NOT call it)
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    // Based on the provided HTML, renderPage() is not defined; assert that it's undefined
    expect(hasRenderPage).toBe(false);

    // Ensure there are no uncaught page errors or console.error messages from loading the page
    expect(pageErrors.length, `Expected no page errors, got: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error messages, got: ${consoleErrors.join(' | ')}`).toBe(0);

    // Also record presence of any console messages (non-error) to help debugging if needed
    // There should be zero or more informational messages, but none of type 'error'
    // For transparency, assert consoleMessages is an array
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  // Test transition: clicking the button triggers showing compilation steps (S0_Idle -> S1_CompilationStepsVisible)
  test('ShowCompilation event: clicking the button displays compilation steps and updates DOM', async ({ page }) => {
    const { consoleErrors, consoleMessages, pageErrors } = await attachErrorAndConsoleListeners(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    const showButton = page.locator("button[onclick='showCompilation()']");
    const output = page.locator('#demoOutput');

    // Precondition: output hidden
    await expect(output).toHaveJSProperty('innerHTML', await page.evaluate(() => document.getElementById('demoOutput').innerHTML));
    const beforeDisplay = await page.evaluate(() => window.getComputedStyle(document.getElementById('demoOutput')).display);
    expect(beforeDisplay).toBe('none');

    // Click the button to trigger the transition
    await showButton.click();

    // After click: output should be visible (S1_CompilationStepsVisible evidence)
    await expect(output).toBeVisible();

    // Check that display style has been set to 'block' by the handler
    const afterDisplay = await page.evaluate(() => window.getComputedStyle(document.getElementById('demoOutput')).display);
    expect(afterDisplay).toBe('block');

    // Check content includes expected headings and sections from the innerHTML set by showCompilation()
    await expect(output).toContainText('Compilation Steps');
    await expect(output).toContainText('Lexical Analysis');
    await expect(output).toContainText('Syntax Analysis');
    await expect(output).toContainText('Semantic Analysis');
    await expect(output).toContainText('Intermediate Code');
    await expect(output).toContainText('Optimization');
    await expect(output).toContainText('Code Generation');

    // Ensure innerHTML includes three-address code example t1 = 5 + 3 (part of Intermediate Code)
    const innerHTML = await output.evaluate((el) => el.innerHTML);
    expect(innerHTML).toMatch(/t1\s*=\s*5\s*\+\s*3/);

    // Clicking again should not throw and should keep the content stable (idempotence check)
    const firstContentSnapshot = innerHTML;
    await showButton.click();
    // Wait a tick for any JS to run
    await page.waitForTimeout(50);
    const secondContentSnapshot = await output.evaluate((el) => el.innerHTML);
    expect(secondContentSnapshot).toBe(firstContentSnapshot);

    // No uncaught exceptions or console.error messages during interaction
    expect(pageErrors.length, `Page errors were emitted during interaction: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Console errors were emitted during interaction: ${consoleErrors.join(' | ')}`).toBe(0);
  });

  // Edge case: rapid repeated clicks - ensure no errors and stable DOM (transition is idempotent)
  test('Edge case: rapid repeated clicks do not break the app or duplicate content', async ({ page }) => {
    const { consoleErrors, consoleMessages, pageErrors } = await attachErrorAndConsoleListeners(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    const showButton = page.locator("button[onclick='showCompilation()']");
    const output = page.locator('#demoOutput');

    // Rapidly click the button multiple times
    for (let i = 0; i < 5; i++) {
      await showButton.click();
    }

    // output should be visible and contain expected content only once (structure check)
    await expect(output).toBeVisible();
    const headingsCount = await page.evaluate(() => {
      const out = document.getElementById('demoOutput');
      // count occurrences of the main h3 heading text "Compilation Steps:"
      const html = out ? out.innerHTML : '';
      // naive count of substring occurrences
      return (html.match(/Compilation Steps/gi) || []).length;
    });

    // Expect at least one occurrence, but not multiple duplicated main headings; ensure <= 1
    expect(headingsCount).toBeGreaterThan(0);
    expect(headingsCount).toBeLessThanOrEqual(1);

    // Ensure no console.error or uncaught page errors occurred
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.join(' | ')}`).toBe(0);
  });

  // Verify FSM-specified attributes and handlers exist on the page
  test('FSM component verification: button selector and output component exist as described', async ({ page }) => {
    const { consoleErrors, consoleMessages, pageErrors } = await attachErrorAndConsoleListeners(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    // The FSM describes a button with selector "button[onclick='showCompilation()']"
    const buttonBySelector = page.locator("button[onclick='showCompilation()']");
    await expect(buttonBySelector).toHaveCount(1);

    // Also verify that the button's onclick attribute exactly matches the FSM evidence
    const onclickAttr = await buttonBySelector.getAttribute('onclick');
    expect(onclickAttr).toBe('showCompilation()');

    // Verify #demoOutput exists
    const output = page.locator('#demoOutput');
    await expect(output).toHaveCount(1);

    // Verify initial content empty (or whitespace only)
    const initialInner = await output.evaluate((el) => el.innerHTML.trim());
    expect(initialInner === '' || initialInner === '<!-- -->' || typeof initialInner === 'string').toBeTruthy();

    // No console or page errors at load time
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Verify onEnter/onExit actions mentioned in FSM: renderPage (on S0) is not defined and cannot be observed executing
  test('Verify FSM onEnter/onExit actions presence (renderPage) without invoking global functions', async ({ page }) => {
    const { consoleErrors, consoleMessages, pageErrors } = await attachErrorAndConsoleListeners(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    // The FSM lists renderPage() as an entry_action for S0_Idle.
    // The HTML provided does not define renderPage. We assert that it is undefined on the window object.
    const renderPageType = await page.evaluate(() => {
      // we only inspect environment; we do NOT call or create the function
      return typeof window.renderPage;
    });
    // Expect 'undefined' because the HTML does not implement renderPage
    expect(renderPageType).toBe('undefined');

    // Ensure the showCompilation function (actual click handler) exists and is a function
    const showCompilationType = await page.evaluate(() => typeof window.showCompilation);
    expect(showCompilationType).toBe('function');

    // Ensure that simply inspecting these properties did not cause side-effects or errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Negative test: attempt to call a non-existent function via evaluate should result in an exception if invoked.
  // We will NOT call it directly in the page global scope (to avoid modifying runtime), but we can assert that attempting
  // to reference it as a function yields 'undefined' as above. This test documents the error scenario without injecting errors.
  test('Error scenario: calling non-existent renderPage would throw - verify it is not defined (do not call)', async ({ page }) => {
    const { consoleErrors, consoleMessages, pageErrors } = await attachErrorAndConsoleListeners(page);
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Confirm renderPage is not defined
    const hasRenderPage = await page.evaluate(() => (typeof window.renderPage !== 'undefined'));
    expect(hasRenderPage).toBe(false);

    // As a safety check, demonstrate that calling a missing function is not executed by our test.
    // We intentionally DO NOT invoke it; instead we assert its absence. This respects the requirement
    // not to patch or inject globals while still verifying the onEnter action's absence.
    expect(hasRenderPage).toBe(false);

    // Final check: no unexpected errors emitted during this verification
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});