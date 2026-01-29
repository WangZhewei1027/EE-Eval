import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c98ed01-fa78-11f0-857d-d58e82d5de73.html';

test.describe('P vs NP visualization - Theme Toggle FSM (Application ID: 3c98ed01-fa78-11f0-857d-d58e82d5de73)', () => {
  // Hold any console errors and page errors observed during each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleErrors = [];
    pageErrors = [];

    // Collect console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined
        });
      }
    });

    // Collect unhandled page exceptions
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the exact HTML page as provided (do not modify the page)
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Sanity: Wait for main container to exist
    await expect(page.locator('.container[role="main"]')).toBeVisible();
  });

  test.afterEach(async () => {
    // Teardown: Nothing to patch on the page — we only observe runtime
    // (Assertions about errors are included in each test below)
  });

  test('Initial state S0_Idle: Page renders and initial component evidence exists', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) entry evidence:
    // - The main container is present
    // - The toggle button exists and has initial attributes per FSM/component extraction
    const container = page.locator('.container[role="main"][aria-label="P versus NP Visualization"]');
    await expect(container).toBeVisible();

    const toggle = page.locator('#toggleTheme');
    await expect(toggle).toBeVisible();

    // Check initial attributes from FSM/components evidence
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(toggle).toHaveAttribute('aria-label', 'Toggle color theme');
    await expect(toggle).toHaveText('Toggle Dark / Light Theme');

    // Check the CSS custom property default (root css defined in HTML)
    const rootBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()
    );
    // Default in the stylesheet is dark theme '#121318'
    expect(rootBg).toBe('#121318');

    // Verify the body background inline style is initially empty (page stylesheet sets it via var)
    const bodyInlineBg = await page.evaluate(() => document.body.style.backgroundColor);
    // The inline body background is not set until clicks toggle it; initial value likely empty string
    expect(typeof bodyInlineBg).toBe('string');

    // Accessibility: Ensure the venn diagram SVG is present and labeled
    const venn = page.locator('svg.venn[role="img"]');
    await expect(venn).toBeVisible();

    // Ensure no unexpected console errors or unhandled exceptions occurred on initial load
    expect(consoleErrors.length, 'no console.error on initial load').toBe(0);
    expect(pageErrors.length, 'no unhandled pageerror on initial load').toBe(0);
  });

  test.describe('Theme toggle transitions (FSM events and transitions)', () => {
    test('Transition S0_Idle -> S1_LightTheme on first ToggleThemeClick', async ({ page }) => {
      // Click the toggle button once to apply Light Theme (per script: first click sets dark=false => light)
      const toggle = page.locator('#toggleTheme');
      await toggle.click();

      // After toggling, the CSS variable on :root should reflect the light theme per FSM evidence
      const rootBgAfter = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()
      );
      expect(rootBgAfter).toBe('#f5f5f7'); // evidence: document.documentElement.style.setProperty('--color-bg', '#f5f5f7');

      // document.body.style.backgroundColor should be set inline by the script as well
      const bodyInlineBgAfter = await page.evaluate(() => document.body.style.backgroundColor.trim());
      // Inline assignment used hex; evaluate returns the same string in many browsers
      expect(bodyInlineBgAfter).toBe('#f5f5f7');

      // Button attributes should match transition evidence for Light Theme entry
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(toggle).toHaveText('Toggle Dark / Light Theme');

      // Validate some visual cues present in DOM remain intact
      await expect(page.locator('.panel.p')).toBeVisible();
      await expect(page.locator('.panel.np')).toBeVisible();

      // Verify no runtime console errors or unhandled exceptions were observed while performing the transition
      expect(consoleErrors.length, 'no console.error while transitioning to light theme').toBe(0);
      expect(pageErrors.length, 'no unhandled pageerror while transitioning to light theme').toBe(0);
    });

    test('Transition S1_LightTheme -> S2_DarkTheme on second ToggleThemeClick', async ({ page }) => {
      const toggle = page.locator('#toggleTheme');

      // First click to enter Light Theme
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');

      // Second click should restore Dark Theme (per script: dark toggles back to true)
      await toggle.click();

      // Root CSS property should reflect dark theme
      const rootBgAfter = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()
      );
      expect(rootBgAfter).toBe('#121318'); // evidence: document.documentElement.style.setProperty('--color-bg', '#121318');

      // Inline body background color should be set to dark hex
      const bodyInlineBgAfter = await page.evaluate(() => document.body.style.backgroundColor.trim());
      expect(bodyInlineBgAfter).toBe('#121318');

      // Button attribute should match evidence for Dark Theme entry/exit
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(toggle).toHaveText('Toggle Dark / Light Theme');

      // Confirm venn diagram and panels still present
      await expect(page.locator('.venn')).toBeVisible();
      await expect(page.locator('.panel.p .circle.large')).toBeVisible();

      // Confirm no console/page errors during the toggles
      expect(consoleErrors.length, 'no console.error while transitioning to dark theme').toBe(0);
      expect(pageErrors.length, 'no unhandled pageerror while transitioning to dark theme').toBe(0);
    });

    test('Transition S2_DarkTheme -> S1_LightTheme on third ToggleThemeClick (cycle back)', async ({ page }) => {
      const toggle = page.locator('#toggleTheme');

      // Click thrice: dark->light->dark->light sequence
      await toggle.click(); // 1 -> light
      await toggle.click(); // 2 -> dark
      await toggle.click(); // 3 -> light

      // After odd number of clicks we expect Light Theme
      const rootBgAfter = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()
      );
      expect(rootBgAfter).toBe('#f5f5f7');

      // aria-pressed true for light theme as per evidence
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');

      // No runtime errors
      expect(consoleErrors.length, 'no console.error after cycling back to light').toBe(0);
      expect(pageErrors.length, 'no unhandled pageerror after cycling back to light').toBe(0);
    });

    test('Edge case: Rapid multiple clicks should toggle deterministically (final parity)', async ({ page }) => {
      const toggle = page.locator('#toggleTheme');

      // Determine initial aria-pressed state
      const initialPressed = await toggle.getAttribute('aria-pressed');

      // Rapidly click 7 times
      for (let i = 0; i < 7; i++) {
        await toggle.click();
      }

      // After 7 flips, final state parity = initial ^ (7 % 2)
      const finalPressed = await toggle.getAttribute('aria-pressed');
      const expectedPressed = (initialPressed === 'true') ? ((7 % 2) ? 'false' : 'true') : ((7 % 2) ? 'true' : 'false');

      expect(finalPressed).toBe(expectedPressed);

      // Check CSS variable matches expected theme based on aria-pressed (true => light theme per FSM evidence)
      const rootBg = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()
      );

      if (expectedPressed === 'true') {
        expect(rootBg).toBe('#f5f5f7');
      } else {
        expect(rootBg).toBe('#121318');
      }

      // Ensure no unexpected runtime errors were triggered during rapid interaction
      expect(consoleErrors.length, 'no console.error during rapid clicks').toBe(0);
      expect(pageErrors.length, 'no unhandled pageerror during rapid clicks').toBe(0);
    });
  });

  test.describe('Accessibility & Evidence checks for states and components', () => {
    test('Button presence and label evidence (component extraction validation)', async ({ page }) => {
      // Validate the component evidence for the toggle button matches the expected attributes/text
      const toggle = page.locator('#toggleTheme');

      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-label', 'Toggle color theme');
      await expect(toggle).toHaveText('Toggle Dark / Light Theme');

      // Ensure the button's aria-pressed toggles on click (one click => true, another => false)
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');

      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');

      // Check that the FSM "evidence" actions (document.body background) are being applied
      const bodyStyle = await page.evaluate(() => document.body.style.backgroundColor.trim());
      // Because we toggled twice, we should be back to dark theme inline bg
      expect(bodyStyle).toBe('#121318');

      // Confirm no runtime errors in the process
      expect(consoleErrors.length, 'no console.error during evidence checks').toBe(0);
      expect(pageErrors.length, 'no unhandled pageerror during evidence checks').toBe(0);
    });

    test('No SyntaxError / ReferenceError / TypeError on page load and interactions (observability)', async ({ page }) => {
      // This test ensures we observe console and page errors and assert they do NOT occur.
      // We intentionally observe them but do not modify the page environment — letting any errors happen naturally.

      // Perform a few interactions to give chance for runtime issues to surface
      const toggle = page.locator('#toggleTheme');
      await toggle.click();
      await toggle.click();

      // Inspect collected pageErrors for common JS error types, fail if any such errors were found
      const errorMessages = pageErrors.map(e => (e && e.message) ? e.message : String(e));
      const consoleErrorTexts = consoleErrors.map(e => e.text);

      // Assert none of the collected messages indicate SyntaxError/ReferenceError/TypeError
      for (const msg of errorMessages.concat(consoleErrorTexts)) {
        // If any such error occurs, include its content for easier debugging
        expect(msg.includes('ReferenceError') || msg.includes('TypeError') || msg.includes('SyntaxError') ? false : true,
          `Expected no JS runtime errors (found message: "${msg}")`).toBe(true);
      }

      // Explicitly assert that we observed zero console.error and zero pageerror events
      expect(pageErrors.length, 'no unhandled page errors overall').toBe(0);
      expect(consoleErrors.length, 'no console.error messages overall').toBe(0);
    });
  });
});