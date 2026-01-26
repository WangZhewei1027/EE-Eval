import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f8c4f0-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Design Patterns — Visual Showcase (Theme Toggle & FSM states)', () => {
  // Helper to attach listeners to observe console.error and page errors for a given page.
  async function observeErrors(page) {
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        try {
          consoleErrors.push(msg.text());
        } catch (e) {
          consoleErrors.push(String(msg));
        }
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message || String(err));
    });

    return { consoleErrors, pageErrors };
  }

  // Test: initial load should render Idle state (S0_Idle) with body data-theme="dark"
  test('loads page and initial idle state is dark (S0_Idle) and reveal happens', async ({ page }) => {
    // Attach observers for console and page errors
    const { consoleErrors, pageErrors } = await observeErrors(page);

    // Load the page (the script sets initial theme based on localStorage or default)
    await page.goto(URL, { waitUntil: 'load' });

    // Verify initial theme on body is "dark" as per the HTML initial markup and idle state evidence
    const bodyTheme = await page.getAttribute('body', 'data-theme');
    expect(bodyTheme).toBe('dark');

    // The toggle button should exist and reflect the dark state via aria-pressed="false"
    const btn = page.locator('#themeToggle');
    await expect(btn).toHaveAttribute('title', 'Toggle theme');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');

    // localStorage should have been set to 'dark' by applyTheme during initial script run
    const storedTheme = await page.evaluate(() => localStorage.getItem('dp-theme'));
    expect(storedTheme).toBe('dark');

    // The staged reveal adds 'visible' class to .pattern-card and .orb elements after load/timeouts.
    // Wait for at least one pattern-card and three orbs to become visible to assert the reveal runs.
    await page.waitForSelector('.pattern-card.visible', { timeout: 3000 });
    const visibleCards = await page.locator('.pattern-card.visible').count();
    expect(visibleCards).toBeGreaterThanOrEqual(1);
    // Orbs should also become visible (3 orbs)
    await page.waitForSelector('.orb.visible', { timeout: 4000 });
    const visibleOrbs = await page.locator('.orb.visible').count();
    expect(visibleOrbs).toBeGreaterThanOrEqual(3);

    // Assert that no console errors or page errors occurred during a normal load.
    // Per instructions we observe console/page errors and assert their occurrences (here expecting none).
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test: toggling theme from dark -> light -> dark and checking DOM, aria and localStorage updates.
  test('toggles theme on button click (S2_DarkTheme -> S1_LightTheme -> S2_DarkTheme)', async ({ page }) => {
    const { consoleErrors, pageErrors } = await observeErrors(page);

    await page.goto(URL, { waitUntil: 'load' });

    const btn = page.locator('#themeToggle');

    // Initial assumptions before any interaction
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');

    // Click to toggle -> should switch to light theme
    await btn.click();

    // Verify expected observables for Light Theme (S1_LightTheme)
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'light');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');

    // The button's innerHTML should have been updated to the sun icon; check for distinctive element/text
    const btnInnerAfterLight = await page.locator('#themeToggle').innerHTML();
    // sunIcon() contains a circle element with cx="12" in the implementation
    expect(btnInnerAfterLight).toContain('circle');
    expect(btnInnerAfterLight).toContain('cx="12"');

    // localStorage must reflect the change to 'light'
    const themeAfterLight = await page.evaluate(() => localStorage.getItem('dp-theme'));
    expect(themeAfterLight).toBe('light');

    // Click again -> should go back to dark (S1 -> S2)
    await btn.click();

    await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');

    // moonIcon() contains the distinctive "M21 12.8" path segment in the implementation
    const btnInnerAfterDark = await page.locator('#themeToggle').innerHTML();
    expect(btnInnerAfterDark).toContain('M21 12.8');

    const themeAfterDark = await page.evaluate(() => localStorage.getItem('dp-theme'));
    expect(themeAfterDark).toBe('dark');

    // Ensure no console or page errors were emitted during toggling
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test: page respects existing localStorage dp-theme on load (Edge case / alternative initial state)
  test('initializes with light theme when localStorage dp-theme is set to light (S1_LightTheme on enter)', async ({ page }) => {
    const { consoleErrors, pageErrors } = await observeErrors(page);

    // First load to ensure a fresh page context
    await page.goto(URL, { waitUntil: 'load' });

    // Now set localStorage to 'light' and reload to simulate returning-user preference
    await page.evaluate(() => localStorage.setItem('dp-theme', 'light'));
    await page.reload({ waitUntil: 'load' });

    // After reload, the page's script should read localStorage and apply 'light'
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'light');

    const btn = page.locator('#themeToggle');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');

    // The button icon should reflect the sun (circle element)
    const inner = await btn.innerHTML();
    expect(inner).toContain('circle');
    expect(await page.evaluate(() => localStorage.getItem('dp-theme'))).toBe('light');

    // No page or console errors expected in this edge scenario
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test: rapid toggling should still produce deterministic final theme state
  test('rapid multiple toggles produce deterministic final theme state', async ({ page }) => {
    const { consoleErrors, pageErrors } = await observeErrors(page);

    await page.goto(URL, { waitUntil: 'load' });

    const btn = page.locator('#themeToggle');

    // Perform a rapid sequence of clicks
    const clicks = 5; // odd -> final should be opposite of initial (initial dark -> light)
    for (let i = 0; i < clicks; i++) {
      // Use dispatchEvent click rather than waiting between clicks to simulate rapid user clicks
      await btn.click();
    }

    // After 5 rapid toggles, starting from 'dark' we should be on 'light'
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'light');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('dp-theme'))).toBe('light');

    // Flip once more to make sure transitions continue to work
    await btn.click();
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark');

    // No errors expected under rapid interaction
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test: Observing console and page errors globally (assert none occur during normal usage).
  test('observes and asserts console/page errors (should be none under normal circumstances)', async ({ page }) => {
    // Collect console and page errors across navigation/interactions
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message || String(err));
    });

    // Visit, wait for load and perform a couple of interactions
    await page.goto(URL, { waitUntil: 'load' });
    await page.locator('#themeToggle').click();
    await page.locator('#themeToggle').click();
    await page.waitForTimeout(300); // allow any async callbacks to run

    // Assert that no unexpected runtime errors have been emitted to console or pageerror
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Additional verification test to ensure UI elements and accessibility attributes exist as expected
  test('accessibility and structural checks for theme control and visual components', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'load' });

    const toolbar = page.locator('.controls[role="toolbar"]');
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveAttribute('aria-label', 'Theme controls');

    const btn = page.locator('#themeToggle');
    await expect(btn).toBeVisible();
    // confirm the button has the class 'btn' and initial aria-pressed attribute
    await expect(btn).toHaveClass(/btn/);
    await expect(btn).toHaveAttribute('aria-pressed', /^(true|false)$/);

    // Verify the three major orbit nodes exist in the DOM as part of the visual diagram
    await expect(page.locator('#orbC')).toBeVisible();
    await expect(page.locator('#orbS')).toBeVisible();
    await expect(page.locator('#orbB')).toBeVisible();

    // Confirm presence of pattern cards and that they have descriptive text — demonstrates proper renderPage() entry action
    const titles = await page.$$eval('.pattern-title', els => els.map(e => e.textContent && e.textContent.trim()));
    expect(titles).toContain('Creational Patterns');
    expect(titles).toContain('Structural Patterns');
    expect(titles).toContain('Behavioral Patterns');
  });
});