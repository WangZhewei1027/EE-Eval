import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83b6d20-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('FSM tests for Backpropagation demo (Application ID: d83b6d20-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  // Reusable selectors
  const runDemoSelector = '#runDemo';
  const demoResultSelector = '#demoResult';

  // Helper to get computed display style
  async function getDisplayStyle(page) {
    return page.$eval(demoResultSelector, (el) => {
      // Use getComputedStyle to reflect actual layout-driven style
      return window.getComputedStyle(el).getPropertyValue('display');
    });
  }

  // Setup a fresh page and listeners before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and classify error-level logs separately
    page.on('console', (msg) => {
      consoleMessages.push(msg);
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg);
        }
      } catch (e) {
        // If msg.type() throws for some reason, still push into general messages
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect uncaught exceptions from the page (e.g., ReferenceError, TypeError, SyntaxError)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the exact page under test (load the page exactly as-is)
    await page.goto(URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // For diagnostic help, if a test fails we want to print consoleErrors and pageErrors in test output
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // Log them to the Playwright test runner output
      // Note: We do not modify page runtime; only report observed errors.
      // eslint-disable-next-line no-console
      console.warn('Observed pageErrors:', pageErrors);
      // eslint-disable-next-line no-console
      console.warn('Observed consoleErrors:', consoleErrors.map((m) => m.text()));
    }
  });

  test('Initial Idle state (S0_Idle) is rendered correctly', async ({ page }) => {
    // Validates the Idle state per FSM:
    // - renderPage() entry action is expected to have produced the initial UI.
    // - The runDemo button is present and has the expected text and attributes.
    // - demoResult is present but hidden (display:none).

    // Button exists and is visible
    const btn = await page.waitForSelector(runDemoSelector, { state: 'visible' });
    expect(btn).not.toBeNull();

    // Check button text content matches FSM / HTML evidence
    const btnText = await btn.textContent();
    expect(btnText).toBe('Show tiny demo gradients');

    // Confirm button attributes: class and aria-controls
    expect(await btn.getAttribute('class')).toContain('simple');
    expect(await btn.getAttribute('aria-controls')).toBe('demoResult');

    // demoResult div exists in DOM
    const out = await page.$(demoResultSelector);
    expect(out).not.toBeNull();

    // It should be hidden initially (style attribute and computed style)
    const styleAttr = await out.getAttribute('style');
    // The HTML evidence shows style="display:none", but computed style is authoritative
    expect(styleAttr).toContain('display:none');

    const display = await getDisplayStyle(page);
    expect(display).toBe('none');

    // Ensure aria attributes are present as per component description
    expect(await out.getAttribute('role')).toBe('region');
    expect(await out.getAttribute('aria-live')).toBe('polite');

    // Assert no uncaught page errors or console error logs were observed during initial render
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking the runDemo button shows the demo (transition S0_Idle -> S1_DemoVisible)', async ({ page }) => {
    // Validates the ShowDemo event and S1 entry actions:
    // - Clicking #runDemo sets demoResult display to block and sets button text to "Hide demo".
    const btn = await page.waitForSelector(runDemoSelector, { state: 'attached' });
    const out = await page.waitForSelector(demoResultSelector, { state: 'attached' });

    // Click to show the demo
    await btn.click();

    // After click, button text should update to "Hide demo"
    await expect(btn).toHaveText('Hide demo');

    // And the demo result should be visible (display != none)
    const displayAfterClick = await getDisplayStyle(page);
    expect(displayAfterClick).toBe('block');

    // The result container should contain the precomputed demo text lines
    const content = await out.textContent();
    expect(content).toContain('Tiny network backpropagation (precomputed numeric example):');
    expect(content).toContain('Forward pass results (approx):');
    expect(content).toContain('Backward pass gradients (approx):');
    expect(content).toContain('dW2 ≈ [-0.2640, -0.2949]');

    // Verify the FSM evidence: out.style.display = "block"; btn.textContent changed
    // (Already validated via computed style and button text)

    // Ensure no uncaught exceptions or console errors occurred during the click/transition
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking the runDemo button again hides the demo (transition S1_DemoVisible -> S0_Idle)', async ({ page }) => {
    // Validate HideDemo event: toggling back to Idle
    const btn = await page.waitForSelector(runDemoSelector, { state: 'attached' });
    const out = await page.waitForSelector(demoResultSelector, { state: 'attached' });

    // Show first to ensure we are in S1
    await btn.click();
    await expect(btn).toHaveText('Hide demo');
    expect(await getDisplayStyle(page)).toBe('block');

    // Click again to hide
    await btn.click();

    // After second click: button text should revert to original
    await expect(btn).toHaveText('Show tiny demo gradients');

    // And demoResult should be hidden again
    expect(await getDisplayStyle(page)).toBe('none');

    // Ensure the content remains present in the DOM (but hidden), not removed or duplicated
    const contentAfterHide = await out.textContent();
    expect(contentAfterHide).toContain('Tiny network backpropagation (precomputed numeric example):');

    // Assert no uncaught exceptions or console errors during the hide transition
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Rapid toggling (edge case): multiple quick clicks keep toggling without errors and preserve content', async ({ page }) => {
    // Edge case: user clicks quickly multiple times. Ensure the toggle remains consistent and no errors thrown.
    const btn = await page.waitForSelector(runDemoSelector, { state: 'attached' });
    const out = await page.waitForSelector(demoResultSelector, { state: 'attached' });

    // Capture initial innerHTML to verify no duplication
    const initialInnerHTML = await out.evaluate((el) => el.innerHTML);

    // Rapidly click the button 5 times with minimal delay
    for (let i = 0; i < 5; i++) {
      await btn.click();
      // little pause to allow DOM updates; small but realistic
      await page.waitForTimeout(50);
    }

    // After an odd number of clicks (5), demo should be visible and button should read "Hide demo"
    await expect(btn).toHaveText('Hide demo');
    expect(await getDisplayStyle(page)).toBe('block');

    // Ensure the content wasn't appended multiple times or corrupted
    const currentInnerHTML = await out.evaluate((el) => el.innerHTML);
    expect(currentInnerHTML).toBe(initialInnerHTML);

    // Click one more time to return to hidden state
    await btn.click();
    await page.waitForTimeout(50);
    expect(await getDisplayStyle(page)).toBe('none');
    await expect(btn).toHaveText('Show tiny demo gradients');

    // Ensure still no uncaught exceptions or console errors from rapid interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Accessibility and attributes verification for FSM components', async ({ page }) => {
    // Validate that the components declared in the FSM are present with expected ARIA and roles.
    const btn = await page.waitForSelector(runDemoSelector, { state: 'visible' });
    const out = await page.waitForSelector(demoResultSelector, { state: 'attached' });

    // Button should reference the result region via aria-controls
    const ariaControls = await btn.getAttribute('aria-controls');
    expect(ariaControls).toBe('demoResult');

    // The demo result region should have the role 'region' and an aria-live policy
    expect(await out.getAttribute('role')).toBe('region');
    expect(await out.getAttribute('aria-live')).toBe('polite');

    // The button is visible and keyboard-focusable by default
    await btn.focus();
    const focusedId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    expect(focusedId).toBe('runDemo');

    // No runtime errors introduced by focusing/reading attributes
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observe console logs and page errors (assert none of ReferenceError, SyntaxError, TypeError occurred)', async ({ page }) => {
    // This test explicitly checks for the absence of runtime errors like ReferenceError, SyntaxError, TypeError.
    // Listen was already set up in beforeEach; perform a typical interaction to allow any latent errors to surface.

    const btn = await page.waitForSelector(runDemoSelector, { state: 'attached' });
    // Click show/hide sequence to exercise the script
    await btn.click();
    await page.waitForTimeout(20);
    await btn.click();
    await page.waitForTimeout(20);

    // Build arrays of error types seen in pageErrors (uncaught exceptions)
    const errorNames = pageErrors.map((e) => (e && e.name) || (e && e.constructor && e.constructor.name) || String(e));

    // Ensure no common JS errors were thrown
    expect(errorNames).not.toContain('ReferenceError');
    expect(errorNames).not.toContain('SyntaxError');
    expect(errorNames).not.toContain('TypeError');

    // Also ensure no console.error logs were emitted
    const consoleErrorTexts = consoleErrors.map((m) => m.text());
    // If any console.error was logged, list it in the assertion failure message via expect
    expect(consoleErrorTexts.length).toBe(0);
  });
});