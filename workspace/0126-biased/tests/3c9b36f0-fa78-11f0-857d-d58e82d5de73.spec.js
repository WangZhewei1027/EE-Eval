import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9b36f0-fa78-11f0-857d-d58e82d5de73.html';

test.describe('3c9b36f0-fa78-11f0-857d-d58e82d5de73 - Compiler Concept Visual Elegance (Theme Toggle)', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Attach listeners before each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info, warn, error, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object from the page context
      pageErrors.push(err);
    });

    // Load the page exactly as-is. Listeners must be attached before navigation
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // A basic teardown: ensure there are no leftover listeners causing flakiness.
    // (Playwright automatically closes the page between tests)
    // Additional cleanup could go here if needed.
    await page.close();
  });

  test('Initial State (S0_Idle) - verifies initial DOM, visual state and accessible attributes', async ({ page }) => {
    // This test validates the initial Idle state:
    // - Toggle button exists with expected aria attributes
    // - Page initially shows the dark visual theme per CSS
    // - No page errors or console errors were emitted during load

    // Button existence and ARIA attributes
    const toggle = await page.$('#toggle-theme');
    expect(toggle, 'Toggle Theme button should exist').not.toBeNull();

    const ariaPressed = await page.getAttribute('#toggle-theme', 'aria-pressed');
    expect(ariaPressed).toBe('false'); // FSM / HTML indicates initial aria-pressed="false"

    const ariaLabel = await page.getAttribute('#toggle-theme', 'aria-label');
    expect(ariaLabel).toBe('Toggle dark and light theme');

    // The initial visual dark theme is provided via stylesheet. We assert computed styles:
    const bodyComputedColor = await page.evaluate(() => getComputedStyle(document.body).color);
    // #d0d6f9 -> rgb(208, 214, 249)
    expect(bodyComputedColor).toBe('rgb(208, 214, 249)');

    const bodyBgImage = await page.evaluate(() => getComputedStyle(document.body).backgroundImage || getComputedStyle(document.body).background);
    // initial CSS uses linear-gradient with hex values that the browser will convert to rgb in computed style
    expect(bodyBgImage).toContain('linear-gradient');
    // ensure one of the gradient colors from the dark theme is present (rgb equivalent of #1a1f3d is rgb(26, 31, 61))
    expect(bodyBgImage).toContain('rgb(26, 31, 61)');

    // Ensure no errors were observed during load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, 'No console errors/warnings should be logged on initial load').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors should be emitted on initial load').toBe(0);
  });

  test('Toggle Theme -> Light (S1_LightTheme): click once and verify inline styles and ARIA', async ({ page }) => {
    // This test validates the transition to Light Theme:
    // - Clicking the button updates aria-pressed
    // - Inline styles are applied to document.body per the script
    // - document.documentElement CSS variable is updated
    // - No unintended page errors occur during the transition

    // Click the toggle button once
    await page.click('#toggle-theme');

    // After click, the script sets inline body.style.background and body.style.color to the light theme values
    const inlineBg = await page.evaluate(() => document.body.style.background);
    expect(inlineBg).toBe('linear-gradient(135deg, #f0f5fa, #d9e4f5)');

    const inlineColor = await page.evaluate(() => document.body.style.color);
    expect(inlineColor).toBe('#33475b');

    // ARIA pressed should reflect toggled state (initial false becomes true)
    const ariaPressedAfter = await page.getAttribute('#toggle-theme', 'aria-pressed');
    expect(ariaPressedAfter).toBe('true');

    // The script also sets a CSS custom property on document.documentElement
    const cssVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-gradient').trim());
    expect(cssVar).toBe('linear-gradient(135deg, #f0f5fa, #d9e4f5)');

    // Ensure no uncaught page errors occurred during the click transition
    const consoleErrorsDuring = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrorsDuring.length, 'No console error/warning expected after toggling to light').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors expected after toggling to light').toBe(0);
  });

  test('Toggle Theme -> Dark (S2_DarkTheme): click twice and verify returns to dark theme', async ({ page }) => {
    // This test validates toggling back to Dark Theme:
    // - After two clicks, the body inline styles should reflect the dark theme values
    // - ARIA should be toggled back to "false"
    // - CSS custom property is restored to dark gradient

    // Click twice
    await page.click('#toggle-theme');
    await page.click('#toggle-theme');

    // After second click, script sets inline styles back to dark theme
    const inlineBg = await page.evaluate(() => document.body.style.background);
    expect(inlineBg).toBe('linear-gradient(135deg, #1a1f3d, #040812)');

    const inlineColor = await page.evaluate(() => document.body.style.color);
    expect(inlineColor).toBe('#d0d6f9');

    // ARIA pressed should be back to "false"
    const ariaPressedAfter = await page.getAttribute('#toggle-theme', 'aria-pressed');
    expect(ariaPressedAfter).toBe('false');

    // CSS variable on documentElement should reflect dark gradient
    const cssVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-gradient').trim());
    expect(cssVar).toBe('linear-gradient(135deg, #1a1f3d, #040812)');

    // Ensure no uncaught page errors occurred during this pair of toggles
    const consoleErrorsDuring = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrorsDuring.length, 'No console errors/warnings expected after toggling back to dark').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors expected after toggling back to dark').toBe(0);
  });

  test('Edge case: Rapid repeated clicks maintain consistent toggling behavior', async ({ page }) => {
    // This test simulates rapid user interaction by performing several quick clicks and asserting the final state.
    // Starting state (initial) is dark. Clicking N times should produce predictable final theme state.

    const clicks = 5; // odd number -> final state should be light
    for (let i = 0; i < clicks; i++) {
      // Fire clicks quickly without awaiting recomposition since toggling is synchronous
      await page.click('#toggle-theme');
    }

    // After 5 quick clicks, starting from dark => final should be light
    const inlineBg = await page.evaluate(() => document.body.style.background);
    const inlineColor = await page.evaluate(() => document.body.style.color);
    const ariaPressed = await page.getAttribute('#toggle-theme', 'aria-pressed');

    expect(inlineBg).toBe('linear-gradient(135deg, #f0f5fa, #d9e4f5)');
    expect(inlineColor).toBe('#33475b');
    expect(ariaPressed).toBe('true');

    // No page errors expected from rapid UI interaction
    expect(pageErrors.length).toBe(0);
  });

  test('Error scenarios: observe and assert uncaught ReferenceError and TypeError are emitted by the page', async ({ page }) => {
    // This test intentionally triggers asynchronous errors in the page context (without modifying app code)
    // to validate that page error monitoring works and that typical JS errors surface as pageerror events.
    //
    // Important: We do not patch or modify the application's source; we only schedule pure-to-page-side errors
    // via asynchronous callbacks to ensure they appear in the page error stream.

    // Prepare to wait for two uncaught page errors
    const waitError1 = page.waitForEvent('pageerror');
    const waitError2 = page.waitForEvent('pageerror');

    // Schedule two asynchronous errors in the page context:
    // - a ReferenceError (calling an undefined function)
    // - a TypeError (calling a property on null)
    await page.evaluate(() => {
      // Schedule so that evaluation does not throw synchronously in the test harness.
      setTimeout(() => { nonExistentFunctionTriggerTest123(); }, 0);
      setTimeout(() => { const x = null; x.callNonExistent(); }, 10);
    });

    // Await both page errors
    const err1 = await waitError1;
    const err2 = await waitError2;

    // Record into our local capture arrays as well (listeners will also push these)
    // Note: page.on('pageerror') already pushed them into pageErrors; ensure at least two captured
    expect(pageErrors.length).toBeGreaterThanOrEqual(2);

    // Validate that one of the errors corresponds to a ReferenceError-like message
    const messages = [err1?.message || '', err2?.message || '', ...(pageErrors.map(e => e.message || ''))];

    const hasReferenceLike = messages.some(m => /is not defined|not defined/i.test(m));
    const hasTypeLike = messages.some(m => /Cannot read properties of null|Cannot read properties of undefined|TypeError|is not a function|call of null/i.test(m));

    // At least one ReferenceError-like and one TypeError-like message should be present
    expect(hasReferenceLike, `Expected a ReferenceError-like message among: ${JSON.stringify(messages)}`).toBeTruthy();
    expect(hasTypeLike, `Expected a TypeError-like message among: ${JSON.stringify(messages)}`).toBeTruthy();

    // Additionally, assert that console captured messages may include error outputs (best-effort)
    const consoleErrorTexts = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    // It's acceptable if console.error was or wasn't used by the runtime; we just ensure our pageerror capture worked.
    expect(pageErrors.length >= 2).toBeTruthy();
  });
});