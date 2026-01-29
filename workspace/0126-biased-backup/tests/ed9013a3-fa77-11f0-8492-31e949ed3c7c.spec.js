import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed9013a3-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Logistic Regression Visualizer (ed9013a3-fa77-11f0-8492-31e949ed3c7c) - FSM Validation', () => {
  // Arrays to collect runtime console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors as the page loads and during interactions
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // guard, though Playwright console events are dependable
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page under test; wait for network to be idle to allow resources to load
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
  });

  test.afterEach(async () => {
    // No explicit teardown required; listeners are bound to page fixture and cleared automatically.
  });

  test.describe('Initial UI and Idle state (S0_Idle)', () => {
    test('Initial DOM: button exists with text "Show Data" and overlay is hidden', async ({ page }) => {
      // Ensure the primary elements exist
      const showButton = page.locator('#showDataButton');
      const overlay = page.locator('#overlay');

      // Assert elements are present in DOM
      await expect(showButton).toBeVisible();
      await expect(overlay).toBeVisible(); // overlay exists, though visually hidden by opacity

      // Verify initial button label matches FSM evidence for Idle state
      await expect(showButton).toHaveText('Show Data');

      // Verify overlay initial classes include 'hide' and do NOT include 'show'
      const overlayClassList = await overlay.evaluate((el) => Array.from(el.classList));
      expect(overlayClassList).toContain('hide');
      expect(overlayClassList).not.toContain('show');

      // Verify computed style opacity is '0' initially (hide)
      const initialOpacity = await overlay.evaluate((el) => getComputedStyle(el).opacity);
      expect(['0', '0.0']).toContain(initialOpacity);

      // Verify overlay text content
      await expect(overlay).toHaveText('Data classification in progress...');

      // Assert no runtime page errors fired during initial render
      expect(pageErrors.length).toBe(0);

      // Also assert there are no console.error messages emitted on load
      const hasConsoleErrors = consoleMessages.some((m) => m.type === 'error');
      expect(hasConsoleErrors).toBeFalsy();
    });

    test('renderPage onEnter check: FSM mentions renderPage() but implementation does not define it', async ({ page }) => {
      // FSM entry action for S0_Idle mentions renderPage(), verify whether it exists on the window
      // We must not inject or define anything; only observe.
      const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
      // The HTML/JS provided does not define renderPage; assert it's undefined
      expect(hasRenderPage).toBe(false);

      // Confirm that absence of renderPage did not produce a ReferenceError on load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Show Data toggle event and transitions (ShowDataToggle)', () => {
    test('Transition S0_Idle -> S1_DataVisible: clicking show button adds "show" on overlay and changes button text to "Hide Data"', async ({ page }) => {
      const showButton = page.locator('#showDataButton');
      const overlay = page.locator('#overlay');

      // Precondition checks
      await expect(showButton).toHaveText('Show Data');
      const beforeHasShow = await overlay.evaluate((el) => el.classList.contains('show'));
      expect(beforeHasShow).toBe(false);

      // Click to trigger the ShowDataToggle event
      await showButton.click();

      // After click: overlay should contain 'show'
      const afterHasShow = await overlay.evaluate((el) => el.classList.contains('show'));
      expect(afterHasShow).toBe(true);

      // Button text should change to 'Hide Data' per FSM expected_observables
      await expect(showButton).toHaveText('Hide Data');

      // Because CSS .show sets opacity:1, computed style should reflect that
      const opacityAfter = await overlay.evaluate((el) => getComputedStyle(el).opacity);
      // Due to transitions, opacity should be '1' (string). Accept '1' or '1.0'
      expect(['1', '1.0']).toContain(opacityAfter);

      // Sanity: ensure overlay content remains unchanged
      await expect(overlay).toHaveText('Data classification in progress...');

      // Ensure no page errors were thrown by the click handler
      expect(pageErrors.length).toBe(0);

      // Ensure console didn't emit any 'error' level messages during this interaction
      const consoleErrorDuring = consoleMessages.some((m) => m.type === 'error');
      expect(consoleErrorDuring).toBeFalsy();
    });

    test('Transition S1_DataVisible -> S0_Idle: clicking hide button removes "show" and resets button text to "Show Data"', async ({ page }) => {
      const showButton = page.locator('#showDataButton');
      const overlay = page.locator('#overlay');

      // Bring overlay into visible state first (S1)
      await showButton.click();
      await expect(showButton).toHaveText('Hide Data');
      const isShown = await overlay.evaluate((el) => el.classList.contains('show'));
      expect(isShown).toBe(true);

      // Click again to toggle back to Idle (S0)
      await showButton.click();

      // After second click: overlay should no longer contain 'show'
      const afterHideHasShow = await overlay.evaluate((el) => el.classList.contains('show'));
      expect(afterHideHasShow).toBe(false);

      // Button text should revert to 'Show Data'
      await expect(showButton).toHaveText('Show Data');

      // Computed opacity should revert to '0' due to presence of .hide and absence of .show
      const opacityAfterHide = await overlay.evaluate((el) => getComputedStyle(el).opacity);
      expect(['0', '0.0']).toContain(opacityAfterHide);

      // Ensure no runtime exceptions occurred during toggling
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Rapid toggles: multiple quick clicks still leave UI in a consistent toggled state', async ({ page }) => {
      const showButton = page.locator('#showDataButton');
      const overlay = page.locator('#overlay');

      // Rapidly click the button 5 times
      // After an odd number of clicks, overlay should be visible (show present); even => hidden
      for (let i = 0; i < 5; i++) {
        await showButton.click();
      }

      // 5 clicks -> odd -> expect visible
      const isShowAfter5 = await overlay.evaluate((el) => el.classList.contains('show'));
      expect(isShowAfter5).toBe(true);
      await expect(showButton).toHaveText('Hide Data');

      // Now click one more time to make it 6 (even): expect hidden
      await showButton.click();
      const isShowAfter6 = await overlay.evaluate((el) => el.classList.contains('show'));
      expect(isShowAfter6).toBe(false);
      await expect(showButton).toHaveText('Show Data');

      // Check that rapid interactions did not cause JS runtime errors
      expect(pageErrors.length).toBe(0);
    });

    test('Idempotent behavior: clicking while overlay already in desired state toggles predictably', async ({ page }) => {
      const showButton = page.locator('#showDataButton');
      const overlay = page.locator('#overlay');

      // Ensure in Idle
      await expect(showButton).toHaveText('Show Data');

      // Click to show and click again to hide to ensure idempotence across cycles
      await showButton.click(); // to show
      await expect(showButton).toHaveText('Hide Data');
      expect(await overlay.evaluate((el) => el.classList.contains('show'))).toBe(true);

      await showButton.click(); // to hide
      await expect(showButton).toHaveText('Show Data');
      expect(await overlay.evaluate((el) => el.classList.contains('show'))).toBe(false);

      // Repeat one more cycle
      await showButton.click(); // to show
      await expect(showButton).toHaveText('Hide Data');
      expect(await overlay.evaluate((el) => el.classList.contains('show'))).toBe(true);

      // No errors should have been thrown
      expect(pageErrors.length).toBe(0);
    });

    test('Missing handlers / unexpected behavior: verify that clicking does not throw an exception even if global handlers are absent', async ({ page }) => {
      // This test ensures we do not attempt to patch or define anything. We simply observe behavior.
      // If global functions referenced by FSM (like renderPage) were required but missing and caused exceptions,
      // they would have appeared in pageErrors array captured by the test harness.

      // Ensure no renderPage exists (as verified earlier)
      const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
      expect(hasRenderPage).toBe(false);

      // Perform a click sequence to ensure absence does not cause exception
      const showButton = page.locator('#showDataButton');
      await showButton.click(); // should toggle, as implemented
      await showButton.click(); // toggle back

      // Assert no page-level exceptions were collected
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Logging and error observation summary', () => {
    test('No unexpected console.errors or page errors during full interaction suite', async ({ page }) => {
      // Perform a representative set of interactions
      const showButton = page.locator('#showDataButton');
      const overlay = page.locator('#overlay');

      // Click cycle
      await showButton.click();
      await showButton.click();
      await showButton.click();

      // Validate overlay state corresponds to odd number of clicks
      expect(await overlay.evaluate((el) => el.classList.contains('show'))).toBe(true);

      // Analyze captured console messages and page errors
      const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
      const anyReferenceErrorsInConsole = consoleMessages.some((m) => /ReferenceError/.test(m.text));
      const anyTypeErrorsInConsole = consoleMessages.some((m) => /TypeError/.test(m.text));
      const anySyntaxErrorsInConsole = consoleMessages.some((m) => /SyntaxError/.test(m.text));

      // The provided implementation is syntactically valid and should not produce runtime JS errors.
      // Assert there were no page errors and no console.error logs indicating ReferenceError/TypeError/SyntaxError
      expect(pageErrors.length).toBe(0);
      expect(errorConsoleMessages.length).toBe(0);
      expect(anyReferenceErrorsInConsole).toBeFalsy();
      expect(anyTypeErrorsInConsole).toBeFalsy();
      expect(anySyntaxErrorsInConsole).toBeFalsy();
    });
  });
});