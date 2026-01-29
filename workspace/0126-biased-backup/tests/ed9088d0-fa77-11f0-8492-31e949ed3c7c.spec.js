import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed9088d0-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Symmetric Cryptography Visualization - FSM and UI tests (ed9088d0-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Helper to collect console messages and uncaught page errors for each test
  const attachLoggingListeners = (page, consoleMessages, pageErrors) => {
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  };

  test('S0_Idle: initial render - page elements, styles and absence of runtime errors on load', async ({ page }) => {
    // This test validates the Idle state (S0_Idle):
    // - The page renders the title, description, graphic and toggle button.
    // - The button contains the expected onclick evidence.
    // - Initial computed styles (from CSS) are present.
    // - There are no uncaught page errors or console.error messages on load.
    const consoleMessages = [];
    const pageErrors = [];
    attachLoggingListeners(page, consoleMessages, pageErrors);

    await page.goto(APP_URL);

    // Basic DOM presence checks
    await expect(page.locator('h1')).toHaveText(/Symmetric Cryptography/);
    await expect(page.locator('.description')).toHaveCount(1);
    await expect(page.locator('.graphic')).toHaveCount(1);
    const button = page.locator('.button');
    await expect(button).toHaveCount(1);
    // Verify onclick evidence exists on the button element as specified in the FSM/evidence
    const onclickAttr = await button.getAttribute('onclick');
    expect(onclickAttr).toBeTruthy();
    // The attribute in the HTML is: onclick="toggleBackground()"
    expect(onclickAttr).toContain('toggleBackground');

    // Check computed styles for initial theme (from CSS)
    const computedStyles = await page.evaluate(() => {
      const s = window.getComputedStyle(document.body);
      return {
        backgroundColor: s.backgroundColor,
        color: s.color
      };
    });

    // CSS sets background-color: #2c3e50 and color: #ecf0f1
    expect(computedStyles.backgroundColor).toBe('rgb(44, 62, 80)');
    expect(computedStyles.color).toBe('rgb(236, 240, 241)');

    // Assert there were no uncaught page errors during load
    expect(pageErrors.length).toBe(0);

    // Assert there were no console messages of type 'error' (if the app logs other console types that's fine)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition tests: ToggleTheme click sequence toggles inline styles and computed styles as expected', async ({ page }) => {
    // This test validates FSM transitions and observable effects of toggleBackground():
    // - Verify inline style changes and computed style changes across multiple toggles.
    // Note: Implementation uses element.style comparisons which mean first click may only set inline style
    // without changing computed color, subsequent clicks will produce visible computed color changes.
    const consoleMessages = [];
    const pageErrors = [];
    attachLoggingListeners(page, consoleMessages, pageErrors);

    await page.goto(APP_URL);

    // Capture initial values
    const initial = await page.evaluate(() => {
      return {
        inlineBg: document.body.style.backgroundColor, // likely ''
        inlineColor: document.body.style.color, // likely ''
        computedBg: window.getComputedStyle(document.body).backgroundColor,
        computedColor: window.getComputedStyle(document.body).color,
      };
    });

    expect(initial.inlineBg).toBe('');
    expect(initial.inlineColor).toBe('');
    expect(initial.computedBg).toBe('rgb(44, 62, 80)');
    expect(initial.computedColor).toBe('rgb(236, 240, 241)');

    // 1st click: expected effect per implementation: sets inline styles to the "dark" hex (#2c3e50/#ecf0f1),
    // but computed colors remain visually the same because CSS already used those values.
    await page.click('.button');

    const after1 = await page.evaluate(() => {
      return {
        inlineBg: document.body.style.backgroundColor,
        inlineColor: document.body.style.color,
        computedBg: window.getComputedStyle(document.body).backgroundColor,
        computedColor: window.getComputedStyle(document.body).color,
      };
    });

    // Inline styles should now be present and normalized (browsers often normalize hex to rgb)
    expect(after1.inlineBg).not.toBe('');
    expect(after1.inlineColor).not.toBe('');
    // But computed colors likely unchanged after first click
    expect(after1.computedBg).toBe('rgb(44, 62, 80)');
    expect(after1.computedColor).toBe('rgb(236, 240, 241)');

    // 2nd click: because inline style now equals 'rgb(44, 62, 80)' when normalized,
    // the function should switch to the light theme ('#ecf0f1') producing visible computed changes.
    await page.click('.button');

    const after2 = await page.evaluate(() => {
      return {
        inlineBg: document.body.style.backgroundColor,
        inlineColor: document.body.style.color,
        computedBg: window.getComputedStyle(document.body).backgroundColor,
        computedColor: window.getComputedStyle(document.body).color,
      };
    });

    // Now computed background should be the light theme and text color the dark theme.
    expect(after2.computedBg).toBe('rgb(236, 240, 241)'); // #ecf0f1
    expect(after2.computedColor).toBe('rgb(44, 62, 80)'); // #2c3e50

    // 3rd click: toggles back to dark theme
    await page.click('.button');

    const after3 = await page.evaluate(() => {
      return {
        computedBg: window.getComputedStyle(document.body).backgroundColor,
        computedColor: window.getComputedStyle(document.body).color,
      };
    });

    expect(after3.computedBg).toBe('rgb(44, 62, 80)');
    expect(after3.computedColor).toBe('rgb(236, 240, 241)');

    // Ensure no uncaught errors occurred during interaction
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: rapid toggling and stability under multiple clicks', async ({ page }) => {
    // Validate that multiple rapid clicks do not produce uncaught errors and the theme remains consistent.
    const consoleMessages = [];
    const pageErrors = [];
    attachLoggingListeners(page, consoleMessages, pageErrors);

    await page.goto(APP_URL);

    // Perform a burst of rapid clicks
    for (let i = 0; i < 7; i++) {
      // Use evaluate to call the function directly to simulate rapid-fire invocations without waiting for transitions
      // This calls an existing global function and doesn't modify the runtime.
      await page.evaluate(() => toggleBackground());
    }

    // After odd number (7) of toggles the theme should be toggled relative to initial:
    // initial: dark; after odd toggles => light
    const final = await page.evaluate(() => {
      return {
        computedBg: window.getComputedStyle(document.body).backgroundColor,
        computedColor: window.getComputedStyle(document.body).color,
      };
    });

    // Expect a consistent result (light theme)
    expect(final.computedBg).toBeOneOf
      ? expect(final.computedBg).toBeOneOf(['rgb(236, 240, 241)', 'rgb(44, 62, 80)']) // fallback if extension not available
      : null;
    // More strict assertion: since 7 is odd, background should be light
    expect(final.computedBg).toBe('rgb(236, 240, 241)');
    expect(final.computedColor).toBe('rgb(44, 62, 80)');

    // No uncaught errors should have occurred
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Verify FSM entry action "renderPage()" is not present in implementation (onEnter check)', async ({ page }) => {
    // The FSM lists an entry action "renderPage()". Validate whether that function exists in the page.
    // We must not inject or define renderPage ourselves. We only observe.
    await page.goto(APP_URL);

    const hasRenderPage = await page.evaluate(() => {
      return typeof window.renderPage !== 'function';
    });

    // We expect the implementation does NOT define renderPage (per provided HTML), so typeof should not be 'function'
    expect(hasRenderPage).toBe(true); // true means renderPage is NOT a function on window
  });

  test('Error scenario: triggering an uncaught ReferenceError and observing pageerror event', async ({ page }) => {
    // This test intentionally triggers an uncaught ReferenceError in the page context
    // by scheduling an async callback that calls a nonexistent function. We then assert that
    // Playwright captured a pageerror (ReferenceError).
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    // Trigger an uncaught ReferenceError via setTimeout (so it's not caught by our test evaluate wrapper)
    await page.evaluate(() => {
      // This will schedule a call that references a nonexistent symbol and will throw asynchronously.
      // We do not catch it here on purpose so that it surfaces as an uncaught exception.
      setTimeout(() => {
        // eslint-disable-next-line no-undef
        missingFunctionThatDoesNotExist(); // should cause ReferenceError
      }, 0);
    });

    // Wait for the pageerror to be emitted. Use a small timeout to avoid flakiness.
    await new Promise(resolve => setTimeout(resolve, 100));

    // At least one page error should be captured and its name should be ReferenceError
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const hasReferenceError = pageErrors.some(e => e.name === 'ReferenceError' || /ReferenceError/.test(String(e)));
    expect(hasReferenceError).toBe(true);
  });

  test('Local caught ReferenceError via evaluate: invoking a missing function inside evaluate and asserting caught exception', async ({ page }) => {
    // This test demonstrates a caught ReferenceError inside page.evaluate and asserts that it can be observed.
    await page.goto(APP_URL);

    const result = await page.evaluate(() => {
      try {
        // This will throw a ReferenceError which we catch locally.
        // We return information about the caught error back to the test harness.
        // This does not produce an uncaught pageerror event because we caught it here.
        // eslint-disable-next-line no-undef
        missingFnLocal();
        return { threw: false };
      } catch (e) {
        return { threw: true, name: e && e.name, message: String(e && e.message) };
      }
    });

    expect(result.threw).toBe(true);
    expect(result.name).toBe('ReferenceError');
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
  });

  test('Accessibility of interactive elements and evidence checks (button onclick attribute and graphic animation presence)', async ({ page }) => {
    // Validate presence of evidence described in the FSM: button with onclick and graphic element with animation.
    await page.goto(APP_URL);

    // Button evidence
    const buttonOnclick = await page.locator('.button').getAttribute('onclick');
    expect(buttonOnclick).toBe('toggleBackground()');

    // Graphic evidence: ensure .graphic exists and has CSS animations applied (we check computed animation-name)
    const graphicStyles = await page.evaluate(() => {
      const el = document.querySelector('.graphic');
      if (!el) return null;
      const s = window.getComputedStyle(el);
      return {
        animationName: s.animationName,
        animationDuration: s.animationDuration,
      };
    });

    expect(graphicStyles).not.toBeNull();
    // animationName may be 'pulse' or a browser-specific string; ensure animation is present (non-empty name and duration)
    expect(graphicStyles.animationName).toBeTruthy();
    expect(graphicStyles.animationDuration).toBeTruthy();
  });
});