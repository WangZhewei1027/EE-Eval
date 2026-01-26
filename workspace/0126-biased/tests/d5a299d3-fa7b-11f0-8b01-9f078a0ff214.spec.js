import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a299d3-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('d5a299d3-fa7b-11f0-8b01-9f078a0ff214 - Routing Demo FSM', () => {
  // Collect console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Arrays to store diagnostics for assertions inside each test
    await page.evaluate(() => {
      // no-op to ensure page context exists early
      return true;
    });
  });

  // Test the initial Idle state: button is present and demo section is hidden by stylesheet
  test('Initial Idle state: button exists, demo hidden (CSS), inline style empty', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page as-is
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Validate button exists and has expected text and onclick evidence
    const button = page.locator('.button');
    await expect(button).toHaveCount(1);
    await expect(button).toHaveText('Show Demo of Routing Process');

    // The button's onclick attribute should reference showDemo()
    const onclickAttr = await page.$eval('.button', el => el.getAttribute('onclick'));
    expect(onclickAttr).toBe('showDemo()');

    // Demo element exists
    const demo = page.locator('#demo');
    await expect(demo).toHaveCount(1);

    // Inline style: style.display should be empty string initially (no inline style set)
    const inlineStyleDisplay = await page.$eval('#demo', el => el.style.display);
    expect(inlineStyleDisplay === '' || inlineStyleDisplay === null).toBeTruthy();

    // Computed style should reflect the stylesheet (display: none)
    const computedDisplay = await page.$eval('#demo', el => window.getComputedStyle(el).display);
    expect(computedDisplay).toBe('none');

    // showDemo should be defined as a function on the window (per HTML script)
    const hasShowDemo = await page.evaluate(() => typeof window.showDemo === 'function');
    expect(hasShowDemo).toBe(true);

    // There should be no page errors emitted during initial load for a well-formed page
    expect(pageErrors.length).toBe(0);

    // There should be no console error-level messages on initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test the transition: S0_Idle -> S1_DemoVisible (click button once)
  test('Transition Idle -> DemoVisible: clicking button shows demo (inline style set to block)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });

    const button = page.locator('.button');
    const demo = page.locator('#demo');

    // Click the button to trigger showDemo()
    await button.click();

    // After the click, the inline style.display should be 'block' (function sets inline style)
    const inlineDisplayAfterClick = await page.$eval('#demo', el => el.style.display);
    expect(inlineDisplayAfterClick).toBe('block');

    // Computed style should also be visible (block)
    const computedAfterClick = await page.$eval('#demo', el => window.getComputedStyle(el).display);
    expect(computedAfterClick === 'block' || computedAfterClick === 'table' || computedAfterClick === 'flex').toBeTruthy();

    // Demo content should contain the header text
    const demoText = await demo.textContent();
    expect(demoText).toContain('Demo: Simple Routing Example');

    // No page errors or console.error should have been emitted during normal click
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test the transition: S1_DemoVisible -> S2_DemoHidden (click button again)
  test('Transition DemoVisible -> DemoHidden: clicking button hides demo (inline style set to none)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });

    const button = page.locator('.button');
    const demo = page.locator('#demo');

    // Click once to show
    await button.click();
    // Click again to hide
    await button.click();

    // After second click, inline style.display should be 'none'
    const inlineDisplayAfterSecondClick = await page.$eval('#demo', el => el.style.display);
    expect(inlineDisplayAfterSecondClick).toBe('none');

    // Computed style should be none (hidden)
    const computedAfterSecondClick = await page.$eval('#demo', el => window.getComputedStyle(el).display);
    expect(computedAfterSecondClick).toBe('none');

    // No page errors or console.error should be emitted
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test repeated transitions and idempotency: S2 -> S1 -> S2 -> S1 via multiple clicks
  test('Repeated transitions: multiple clicks toggle demo visibility predictably', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    const button = page.locator('.button');

    // Sequence: click 1 -> visible, 2 -> hidden, 3 -> visible, 4 -> hidden, 5 -> visible
    for (let i = 1; i <= 5; i++) {
      await button.click();
      // small pause to let DOM update
      await page.waitForTimeout(50);
      const inlineDisplay = await page.$eval('#demo', el => el.style.display);
      const expected = (i % 2 === 1) ? 'block' : 'none';
      expect(inlineDisplay).toBe(expected);
    }

    // Final state after 5 clicks should be visible (block)
    const finalInline = await page.$eval('#demo', el => el.style.display);
    expect(finalInline).toBe('block');
  });

  // Edge case: rapid clicking (simulate user hammering the button) - ensure page remains consistent
  test('Edge case: rapid clicking does not crash the page and leaves demo in a deterministic state', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });

    const button = page.locator('.button');

    // Rapidly dispatch 20 clicks in quick succession
    for (let i = 0; i < 20; i++) {
      // We don't await click's internal effects fully to simulate rapid clicks
      await button.click({ delay: 0 });
    }

    // Wait briefly for JS toggles to settle
    await page.waitForTimeout(200);

    // After 20 toggles, even number => should be hidden
    const inlineDisplay = await page.$eval('#demo', el => el.style.display);
    expect(inlineDisplay).toBe('none');

    // Ensure there were no uncaught page errors during the flurry of clicks
    expect(pageErrors.length).toBe(0);

    // No console error-level messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Validate that calling the missing renderPage() results in a ReferenceError in the page context.
  // This test intentionally invokes a function that the FSM mentions (renderPage) but is not present
  // in the HTML implementation to assert that a ReferenceError occurs naturally (per instructions).
  test('Error scenario: calling missing renderPage() should throw ReferenceError in page context', async ({ page }) => {
    const pageErrors = [];
    const consoleMessages = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Attempt to call renderPage() in the page context and capture the thrown error
    let capturedError = null;
    try {
      // This will throw in the page context because renderPage is not defined in the HTML
      await page.evaluate(() => {
        // Intentionally call a function not defined in the page's JS to allow a ReferenceError to occur naturally
        // We do not catch it here; let it bubble to the Playwright evaluate call for capturing.
        // eslint-disable-next-line no-undef
        return renderPage();
      });
    } catch (err) {
      capturedError = err;
    }

    // We expect an error to have been thrown (ReferenceError)
    expect(capturedError).toBeTruthy();
    // Error message should indicate renderPage is not defined or be a ReferenceError
    expect(String(capturedError.message)).toMatch(/renderPage is not defined|ReferenceError/);

    // The page's pageerror handler should also have been called with an Error that references renderPage
    // (depending on the browser, the pageerror may or may not fire for an evaluate() thrown error,
    // but we assert that if a pageerror was captured, it references the missing function)
    if (pageErrors.length > 0) {
      const joined = pageErrors.map(e => String(e.message)).join(' | ');
      expect(joined).toMatch(/renderPage is not defined|ReferenceError/);
    }

    // There should be a console message related to the thrown error in some environments; if present, assert its content
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
    if (consoleErrorMsgs.length > 0) {
      const combined = consoleErrorMsgs.map(m => m.text).join(' | ');
      expect(combined).toMatch(/renderPage is not defined|ReferenceError/);
    }
  });

  // Validate programmatic invocation of showDemo (onEnter action referenced in FSM for Demo states)
  test('onEnter action (showDemo) exists and can be invoked programmatically to toggle demo', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Confirm showDemo exists and is callable
    const isFunction = await page.evaluate(() => typeof window.showDemo === 'function');
    expect(isFunction).toBe(true);

    // Programmatically invoke showDemo() to enter DemoVisible
    await page.evaluate(() => window.showDemo());
    const inlineAfterProgrammatic = await page.$eval('#demo', el => el.style.display);
    expect(inlineAfterProgrammatic).toBe('block');

    // Invoke again to hide (enter DemoHidden)
    await page.evaluate(() => window.showDemo());
    const inlineAfterSecond = await page.$eval('#demo', el => el.style.display);
    expect(inlineAfterSecond).toBe('none');
  });
});