import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c998942-fa78-11f0-857d-d58e82d5de73.html';

// Helper to normalize rgb string e.g. "rgb(15, 23, 42)" -> "rgb(15,23,42)"
function normalizeRgb(rgb) {
  return rgb.replace(/\s+/g, '');
}

test.describe('3c998942-fa78-11f0-857d-d58e82d5de73 — NoSQL interactive app (FSM validation)', () => {
  let consoleErrors = [];
  let consoleWarnings = [];
  let pageErrors = [];

  // Setup: navigate to the page for each test and attach listeners to capture console & runtime errors.
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleWarnings = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        consoleErrors.push(text);
      } else if (type === 'warning') {
        consoleWarnings.push(text);
      }
      // Always keep full console history on debug
    });

    // Capture unhandled page errors (e.g., ReferenceError, TypeError, SyntaxError)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    // Load the application as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({}, testInfo) => {
    // Attach captured diagnostics to the test's output for easier debugging if a test fails.
    if (consoleErrors.length > 0) {
      testInfo.attach('consoleErrors', { body: consoleErrors.join('\n\n'), contentType: 'text/plain' });
    }
    if (consoleWarnings.length > 0) {
      testInfo.attach('consoleWarnings', { body: consoleWarnings.join('\n\n'), contentType: 'text/plain' });
    }
    if (pageErrors.length > 0) {
      testInfo.attach('pageErrors', { body: pageErrors.join('\n\n'), contentType: 'text/plain' });
    }
  });

  test.describe('Initial state (S0_Idle) and page render checks', () => {
    test('renders main container and header — validates Idle state entry (renderPage)', async ({ page }) => {
      // Verify main container exists and has expected role/aria-label (evidence of S0_Idle)
      const mainRole = await page.getAttribute('main.container', 'role').catch(() => null);
      // If selecting via class fails, use a stable selector
      const mainSelectorExists = await page.$('main.container[role="main"][aria-label="NoSQL concept visualization"]') !== null;
      expect(mainSelectorExists).toBeTruthy();

      // Header and descriptive paragraph exist
      const h1Text = await page.textContent('header h1');
      expect(h1Text).toBeTruthy();
      expect(h1Text.trim()).toMatch(/NoSQL/i);

      const pText = await page.textContent('header p');
      expect(pText).toContain('Flexible, schema-less');

      // Ensure initial theme (CSS) is the dark theme per style defaults (S2 evidence present as initial visual)
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const color = await page.evaluate(() => getComputedStyle(document.body).color);
      expect(normalizeRgb(bg)).toBe(normalizeRgb('rgb(15, 23, 42)')); // #0f172a
      expect(normalizeRgb(color)).toBe(normalizeRgb('rgb(224, 231, 255)')); // #e0e7ff

      // Ensure no runtime errors were thrown on initial load
      expect(pageErrors.length, `Unexpected page errors on load: ${pageErrors.join('\n')}`).toBe(0);
    });
  });

  test.describe('Theme toggling (S1_LightTheme <-> S2_DarkTheme)', () => {
    test('toggles to Light Theme on first click and updates aria/state (S1_LightTheme evidence)', async ({ page }) => {
      // Ensure toggle button exists
      const toggle = await page.$('#themeToggle');
      expect(toggle).not.toBeNull();

      // Initial aria-pressed should be "false" (per HTML) but darkTheme variable is true meaning dark currently active.
      // The script toggles darkTheme boolean on click; first click should set light theme (#f1f5f9 / #334155)
      await page.click('#themeToggle');

      // Wait for style mutation to take effect
      await page.waitForTimeout(50);

      const bgAfter = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const colorAfter = await page.evaluate(() => getComputedStyle(document.body).color);
      const ariaPressed = await page.getAttribute('#themeToggle', 'aria-pressed');
      const buttonText = (await page.textContent('#themeToggle')) || '';

      expect(normalizeRgb(bgAfter)).toBe(normalizeRgb('rgb(241, 245, 249)')); // #f1f5f9
      expect(normalizeRgb(colorAfter)).toBe(normalizeRgb('rgb(51, 65, 85)')); // #334155
      expect(ariaPressed).toBe('true'); // evidence the attribute toggled
      expect(buttonText.trim()).toMatch(/Switch to Dark Theme/i);
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('toggles back to Dark Theme on second click and updates aria/state (S2_DarkTheme evidence)', async ({ page }) => {
      // Click twice to go light -> dark
      await page.click('#themeToggle'); // to light
      await page.waitForTimeout(30);
      await page.click('#themeToggle'); // back to dark
      await page.waitForTimeout(50);

      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const color = await page.evaluate(() => getComputedStyle(document.body).color);
      const ariaPressed = await page.getAttribute('#themeToggle', 'aria-pressed');
      const buttonText = (await page.textContent('#themeToggle')) || '';

      expect(normalizeRgb(bg)).toBe(normalizeRgb('rgb(15, 23, 42)')); // #0f172a
      expect(normalizeRgb(color)).toBe(normalizeRgb('rgb(224, 231, 255)')); // #e0e7ff
      expect(ariaPressed).toBe('false');
      expect(buttonText.trim()).toMatch(/Switch to Light Theme/i);

      // Rapid toggles (edge case) — ensure no errors thrown when toggling repeatedly
      for (let i = 0; i < 5; i++) {
        await page.click('#themeToggle');
        await page.waitForTimeout(10);
      }
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('visual differences persist and attributes reflect the current theme after multiple toggles', async ({ page }) => {
      // Toggle an odd number of times to end up in the Light Theme
      for (let i = 0; i < 3; i++) {
        await page.click('#themeToggle');
        await page.waitForTimeout(20);
      }
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const color = await page.evaluate(() => getComputedStyle(document.body).color);
      const ariaPressed = await page.getAttribute('#themeToggle', 'aria-pressed');

      // After 3 clicks: initial dark -> click1 light -> click2 dark -> click3 light
      expect(normalizeRgb(bg)).toBe(normalizeRgb('rgb(241, 245, 249)')); // #f1f5f9
      expect(normalizeRgb(color)).toBe(normalizeRgb('rgb(51, 65, 85)')); // #334155
      expect(ariaPressed).toBe('true');
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Info modal behavior and transitions (S3_InfoModalVisible <-> S4_InfoModalHidden)', () => {
    test('opens modal on info button click and focuses close button (S3_InfoModalVisible evidence)', async ({ page }) => {
      // Ensure modal is initially hidden
      const initialHidden = await page.getAttribute('#infoModal', 'hidden');
      // The 'hidden' attribute may exist (value is ""), or be null; check computed hidden property via JS
      const initialHiddenProp = await page.evaluate(() => document.getElementById('infoModal').hidden);
      expect(initialHiddenProp).toBe(true);

      // Click info button to show modal
      await page.click('#infoBtn');

      // Wait briefly for focus change and DOM update
      await page.waitForTimeout(50);

      const hiddenAfter = await page.evaluate(() => document.getElementById('infoModal').hidden);
      expect(hiddenAfter).toBe(false);

      // The close button should be focused after opening
      const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
      expect(activeId).toBe('closeModal');

      // Check that close button exists and is visible in DOM
      const closeBtn = await page.$('#closeModal');
      expect(closeBtn).not.toBeNull();

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('closes modal when clicking the Close button and focuses info button (S4_InfoModalHidden evidence)', async ({ page }) => {
      // Open modal first
      await page.click('#infoBtn');
      await page.waitForTimeout(30);

      // Click the close button inside modal
      await page.click('#closeModal');
      await page.waitForTimeout(30);

      const hiddenAfterClose = await page.evaluate(() => document.getElementById('infoModal').hidden);
      expect(hiddenAfterClose).toBe(true);

      // Focus should return to the infoBtn
      const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
      expect(activeId).toBe('infoBtn');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('closes modal when pressing Escape key while modal is visible (CloseInfoEsc transition)', async ({ page }) => {
      // Open modal first
      await page.click('#infoBtn');
      await page.waitForTimeout(30);

      // Ensure modal visible first
      let hidden = await page.evaluate(() => document.getElementById('infoModal').hidden);
      expect(hidden).toBe(false);

      // Press Escape to close
      await page.keyboard.press('Escape');
      await page.waitForTimeout(30);

      hidden = await page.evaluate(() => document.getElementById('infoModal').hidden);
      expect(hidden).toBe(true);

      // Focus should be back to info button
      const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
      expect(activeId).toBe('infoBtn');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('pressing Escape when modal is hidden does not throw and does not change state (edge case)', async ({ page }) => {
      // Ensure modal is hidden
      await page.evaluate(() => document.getElementById('infoModal').hidden = true);
      // Press Escape when hidden
      await page.keyboard.press('Escape');
      // Wait briefly to let any handler run
      await page.waitForTimeout(20);

      const hidden = await page.evaluate(() => document.getElementById('infoModal').hidden);
      expect(hidden).toBe(true);

      // No page errors should be observed
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('FSM coverage checks and additional assertions', () => {
    test('verifies FSM states and evidence: S1 and S2 styles as entry evidence and S3/S4 modal hidden state', async ({ page }) => {
      // Evidence for S1_LightTheme when toggled to light
      await page.click('#themeToggle'); // -> light
      await page.waitForTimeout(20);
      const bgLight = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const colorLight = await page.evaluate(() => getComputedStyle(document.body).color);
      expect(normalizeRgb(bgLight)).toBe(normalizeRgb('rgb(241, 245, 249)')); // #f1f5f9
      expect(normalizeRgb(colorLight)).toBe(normalizeRgb('rgb(51, 65, 85)')); // #334155

      // Evidence for S2_DarkTheme when toggled back
      await page.click('#themeToggle'); // -> dark
      await page.waitForTimeout(20);
      const bgDark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const colorDark = await page.evaluate(() => getComputedStyle(document.body).color);
      expect(normalizeRgb(bgDark)).toBe(normalizeRgb('rgb(15, 23, 42)')); // #0f172a
      expect(normalizeRgb(colorDark)).toBe(normalizeRgb('rgb(224, 231, 255)')); // #e0e7ff

      // Modal hidden state evidence (S4)
      // Open then close and inspect DOM boolean hidden (not attribute string)
      await page.click('#infoBtn');
      await page.waitForTimeout(20);
      let hiddenVisible = await page.evaluate(() => document.getElementById('infoModal').hidden);
      expect(hiddenVisible).toBe(false); // S3 evidence

      await page.click('#closeModal');
      await page.waitForTimeout(20);
      let hiddenAfter = await page.evaluate(() => document.getElementById('infoModal').hidden);
      expect(hiddenAfter).toBe(true); // S4 evidence

      // Confirm no JS runtime errors happened during these transitions
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('observes console and page errors: assert none occurred during entire scenario', async ({ page }) => {
      // Perform a set of interactions to simulate typical usage
      await page.click('#themeToggle');
      await page.waitForTimeout(10);
      await page.click('#infoBtn');
      await page.waitForTimeout(10);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(10);
      await page.click('#themeToggle');

      // Final assertions on collected diagnostics
      // The expectation here is that the original implementation runs without throwing ReferenceError/SyntaxError/TypeError.
      expect(pageErrors.length, `Expected no page errors, but got: ${pageErrors.join('\n')}`).toBe(0);
      expect(consoleErrors.length, `Expected no console.error messages, but got: ${consoleErrors.join('\n')}`).toBe(0);

      // Console warnings are acceptable but report them for visibility
      // We assert nothing about warnings beyond collecting them.
    });
  });
});