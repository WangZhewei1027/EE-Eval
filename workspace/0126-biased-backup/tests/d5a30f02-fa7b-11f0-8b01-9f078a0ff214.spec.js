import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a30f02-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('Garbage Collection Demo (FSM) - d5a30f02-fa7b-11f0-8b01-9f078a0ff214', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Attach listeners and navigate to the page before each test to get a fresh state
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (info, warn, error, etc.)
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect unhandled exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid leakage across tests (Playwright closes pages between tests normally)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('S0_Idle: Initial render - Show Demo button present and demo hidden', async ({ page }) => {
    // Validate initial state S0_Idle per FSM:
    // - The "Show Demo" button should be present.
    // - The demo div (#demo) should exist in DOM and be hidden (style.display === 'none').
    // - No uncaught page errors should have occurred during initial load.

    // Check Show Demo button exists and has correct text
    const button = page.locator('.demo-button');
    await expect(button).toHaveCount(1);
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Show Demo');

    // Check onclick attribute references showDemo()
    const onclickAttr = await button.getAttribute('onclick');
    expect(onclickAttr).toBe('showDemo()');

    // Check demo element exists and is hidden by inline style
    const demo = page.locator('#demo');
    await expect(demo).toHaveCount(1);

    // Verify computed style - should not be visible initially
    const demoDisplay = await demo.evaluate((el) => {
      // read inline style and computed style for robustness
      return {
        inline: el.getAttribute('style'),
        computed: window.getComputedStyle(el).display
      };
    });
    // inline style should reference display:none per implementation
    expect(demoDisplay.inline).toContain('display:none');
    // computed style should be 'none' making it not visible
    expect(demoDisplay.computed).toBe('none');

    // Ensure no console error messages were logged during load
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);

    // Ensure there were no uncaught page errors on load
    expect(pageErrors.length).toBe(0);
  });

  test('Transition ShowDemo: clicking the Show Demo button displays the demo (S0 -> S1)', async ({ page }) => {
    // Validate the transition defined in the FSM:
    // - User clicks the .demo-button (event ShowDemo)
    // - The #demo element should become displayed (entry action showDemo executed)

    const button = page.locator('.demo-button');
    const demo = page.locator('#demo');

    // Click the Show Demo button to trigger the transition
    await button.click();

    // After clicking, the demo element should be visible (display: block)
    await expect(demo).toBeVisible();

    // Verify inline style changed to "block" as per evidence in FSM
    const inlineStyle = await demo.getAttribute('style');
    // The implementation sets demoDiv.style.display = "block"; so inline style should contain display:block
    expect(inlineStyle).toContain('display: block');

    // Double-check computed style reflects display block
    const computedDisplay = await demo.evaluate(el => window.getComputedStyle(el).display);
    expect(computedDisplay).toBe('block');

    // Confirm no unexpected uncaught page errors during this interaction
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Idempotency / Edge Case: Clicking Show Demo multiple times does not break the page', async ({ page }) => {
    // Validate clicking the button multiple times keeps the demo visible and does not introduce errors

    const button = page.locator('.demo-button');
    const demo = page.locator('#demo');

    // Click it twice quickly
    await button.click();
    await button.click();

    // Demo remains visible
    await expect(demo).toBeVisible();
    const computedDisplay = await demo.evaluate(el => window.getComputedStyle(el).display);
    expect(computedDisplay).toBe('block');

    // There should be no console error messages or uncaught page errors caused by repeated clicks
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Verify entry/exit actions: showDemo exists and renderPage is not implemented (calling it causes TypeError)', async ({ page }) => {
    // This test inspects the presence of the functions referenced by the FSM:
    // - showDemo should be defined as a function (used by the button).
    // - renderPage is declared as an entry action in the FSM but is NOT implemented in the HTML;
    //   when invoked it should produce a TypeError in the page context (window.renderPage is not a function).

    // Check that showDemo is defined on the window as a function
    const showDemoType = await page.evaluate(() => typeof window.showDemo);
    expect(showDemoType).toBe('function');

    // Check that renderPage is undefined on the window (not implemented in HTML)
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Attempt to invoke renderPage and capture the thrown error naturally inside the page context.
    // We won't modify the page globals; we will call it and observe the error produced.
    const renderPageResult = await page.evaluate(() => {
      try {
        // This will throw because renderPage is undefined; calling it should trigger a TypeError
        // in the page context: "window.renderPage is not a function"
        // We catch it so the page does not emit an unhandled exception, and return details to the test.
        window.renderPage();
        return { ok: true };
      } catch (e) {
        return { ok: false, name: e.name, message: e.message };
      }
    });

    // Expect the call to fail and return a TypeError name
    expect(renderPageResult.ok).toBe(false);
    // The ECMAScript error for calling undefined is typically a TypeError
    expect(renderPageResult.name).toBe('TypeError');
    expect(renderPageResult.message).toMatch(/is not a function|undefined/);

    // There should still be no uncaught page errors because we caught the error inside the page.evaluate
    expect(pageErrors.length).toBe(0);
  });

  test('Observe natural JS errors in page context: ReferenceError, SyntaxError, TypeError', async ({ page }) => {
    // This test intentionally triggers several error types in the page context and asserts they occur.
    // Per instructions, we let these errors happen naturally inside evaluate and assert the thrown results.

    // 1) ReferenceError: access an undefined identifier directly
    await expect(page.evaluate(() => {
      // Accessing an undeclared variable triggers a ReferenceError
      // This will cause the returned promise to reject with an error
      // We don't catch it here so expect().rejects will observe it
      // Note: The text of the thrown error typically contains 'ReferenceError'
      // Use a unique identifier to make the error message predictable
      return nonExistentUniqueVariable12345;
    })).rejects.toThrow(/ReferenceError/);

    // 2) SyntaxError: create a Function with invalid source to trigger SyntaxError
    await expect(page.evaluate(() => {
      // This will throw a SyntaxError when attempting to construct the Function
      // Use deliberately invalid code to ensure a SyntaxError is thrown
      return new Function('return ('); // invalid JS -> SyntaxError
    })).rejects.toThrow(/SyntaxError/);

    // 3) TypeError: attempt to call a non-function value (null)
    await expect(page.evaluate(() => {
      // Calling null as a function triggers a TypeError
      const n = null;
      return n();
    })).rejects.toThrow(/TypeError/);

    // After intentionally triggering and observing the errors through evaluate rejections,
    // ensure that these interactions did not produce additional unexpected uncaught page errors
    // (depending on how the page runtime surfaces evaluate exceptions, pageerror may or may not have entries;
    // requiring a strict count here can be brittle across runtimes, so we assert that any collected page errors
    // are instances of Error and contain expected names when present.)
    for (const err of pageErrors) {
      // If the runtime reported page errors, ensure they are Error objects
      expect(err).toBeInstanceOf(Error);
      // If messages are available, they should mention common JS error kinds
      if (err.message) {
        expect(/ReferenceError|SyntaxError|TypeError|Error/.test(err.message)).toBeTruthy();
      }
    }
  });

  test('State evidence and DOM verification: Ensure demo content text matches expected description', async ({ page }) => {
    // This test validates that the #demo content contains the expected heading and explanatory paragraph
    // which is part of the S1_DemoVisible state's evidence (Memory Allocation Simulation).

    const demo = page.locator('#demo');

    // Before clicking, demo should be hidden
    await expect(demo).not.toBeVisible();

    // Click to show demo
    await page.locator('.demo-button').click();

    // Validate heading inside demo
    const heading = demo.locator('h3');
    await expect(heading).toHaveText('Memory Allocation Simulation:');

    // Validate the demo contains explanatory text referencing memory allocation and clearing
    const paragraph = demo.locator('p');
    const paragraphText = await paragraph.textContent();
    expect(paragraphText).toMatch(/Imagine that each time an object is created, a block of memory is allocated/i);
    expect(paragraphText).toMatch(/cleared to free the memory|eligible for garbage collection/i);

    // Ensure again no uncaught page errors from this normal interaction
    expect(pageErrors.length).toBe(0);
  });
});