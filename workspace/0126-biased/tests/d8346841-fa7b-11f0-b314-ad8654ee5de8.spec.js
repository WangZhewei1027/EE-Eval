import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8346841-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('d8346841-fa7b-11f0-b314-ad8654ee5de8 — Selection Sort demo FSM tests', () => {
  // Containers to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Standard selectors used across tests
  const SELECTORS = {
    demoBtn: '#demoBtn',
    demoArea: '#demoArea',
    demoText: '#demoText'
  };

  // Setup: for each test open a fresh page and attach listeners to record console and page errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages for inspection
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the provided HTML page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Teardown: after each test assert that we successfully observed console & page events collection
  test.afterEach(async () => {
    // Ensure our capture arrays exist (this mainly verifies the hooks executed)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();
  });

  test.describe('Initial state (S0_Idle) validation', () => {
    test('Initial DOM reflects Idle state: button present and demo area hidden, demo text prefilled', async ({ page }) => {
      // Validate demo button exists and has expected attributes
      const btn = page.locator(SELECTORS.demoBtn);
      await expect(btn).toBeVisible();
      await expect(btn).toHaveAttribute('aria-controls', 'demoArea');
      await expect(btn).toHaveAttribute('aria-expanded', 'false');
      await expect(btn).toHaveText('Show Demonstration Steps');

      // Validate demo area exists and is initially hidden (class contains 'hidden' and aria-hidden="true")
      const demo = page.locator(SELECTORS.demoArea);
      await expect(demo).toHaveAttribute('aria-hidden', 'true');
      const demoClass = await demo.getAttribute('class');
      expect(demoClass).toBeTruthy();
      expect(demoClass.includes('hidden')).toBe(true);

      // Computed style should hide the element (display: none due to .hidden)
      const display = await demo.evaluate(el => window.getComputedStyle(el).display);
      expect(display === 'none').toBeTruthy();

      // The demoText element should be filled on initial load even while hidden (entry action equivalence)
      const demoText = page.locator(SELECTORS.demoText);
      await expect(demoText).toBeVisible({ timeout: 0 }).catch(() => {
        // demoText is inside a hidden container; to check content we read textContent via evaluate
      });
      const textContent = await page.locator(SELECTORS.demoText).evaluate(el => el.textContent || '');
      expect(textContent.length).toBeGreaterThan(0);
      expect(textContent).toContain('Initial array: [64, 25, 12, 22, 11]');
      expect(textContent).toContain('Final array: [11, 12, 22, 25, 64]');

      // Confirm no uncaught page errors were thrown during load
      expect(pageErrors.length).toBe(0);
      // Confirm there were no console.error messages during load
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Event: ShowDemo (click) and transitions between S0_Idle <-> S1_DemoVisible', () => {
    test('Clicking the demo button shows the demoArea and updates aria attributes and button text', async ({ page }) => {
      const btn = page.locator(SELECTORS.demoBtn);
      const demo = page.locator(SELECTORS.demoArea);

      // Precondition: demoArea hidden
      await expect(btn).toHaveAttribute('aria-expanded', 'false');
      await expect(demo).toHaveAttribute('aria-hidden', 'true');

      // Trigger: click the button to show demonstration (S0_Idle -> S1_DemoVisible)
      await btn.click();

      // Postconditions: demoArea should be visible (no 'hidden' class), aria-hidden -> "false"
      const demoClassAfter = await demo.getAttribute('class');
      expect(demoClassAfter).toBeTruthy();
      expect(demoClassAfter.includes('hidden')).toBe(false);

      await expect(demo).toHaveAttribute('aria-hidden', 'false');

      // Button aria-expanded should be true and its text should change to 'Hide Demonstration Steps'
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
      await expect(btn).toHaveText('Hide Demonstration Steps');

      // The content should still contain expected lines
      const content = await page.locator(SELECTORS.demoText).evaluate(el => el.textContent || '');
      expect(content).toContain('i = 0: Search A[0..4] for minimum');
      expect(content).toContain('Totals for this run (swap only when needed): comparisons = 10, swaps = 3');

      // No uncaught page errors should have occurred by showing the demo
      expect(pageErrors.length).toBe(0);
      // No console error-level messages
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking the demo button again hides the demoArea and updates aria attributes and button text', async ({ page }) => {
      const btn = page.locator(SELECTORS.demoBtn);
      const demo = page.locator(SELECTORS.demoArea);

      // First click to show
      await btn.click();
      await expect(demo).toHaveAttribute('aria-hidden', 'false');
      await expect(btn).toHaveAttribute('aria-expanded', 'true');

      // Second click to hide (S1_DemoVisible -> S0_Idle)
      await btn.click();

      // After second click, demoArea should have 'hidden' class and aria-hidden true
      const demoClassAfter = await demo.getAttribute('class');
      expect(demoClassAfter.includes('hidden')).toBe(true);
      await expect(demo).toHaveAttribute('aria-hidden', 'true');

      // Button aria-expanded should be false and text returns to original
      await expect(btn).toHaveAttribute('aria-expanded', 'false');
      await expect(btn).toHaveText('Show Demonstration Steps');

      // Ensure text content remained stable (content should still be present in DOM)
      const content = await page.locator(SELECTORS.demoText).evaluate(el => el.textContent || '');
      expect(content).toContain('Initial array: [64, 25, 12, 22, 11]');

      // Confirm no uncaught page errors during toggling
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Rapid toggling: multiple clicks alternate visibility predictably', async ({ page }) => {
      const btn = page.locator(SELECTORS.demoBtn);
      const demo = page.locator(SELECTORS.demoArea);

      // Perform 5 rapid clicks
      for (let i = 0; i < 5; i++) {
        await btn.click();
      }

      // After odd number of clicks (5) the area should be visible
      const demoClass = await demo.getAttribute('class');
      expect(demoClass.includes('hidden')).toBe(false);
      await expect(btn).toHaveAttribute('aria-expanded', 'true');

      // Now do one more click to make it hidden again (total 6)
      await btn.click();
      const demoClass2 = await demo.getAttribute('class');
      expect(demoClass2.includes('hidden')).toBe(true);
      await expect(btn).toHaveAttribute('aria-expanded', 'false');

      // Confirm no runtime errors occurred during rapid interaction
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Keyboard activation (Enter) toggles the demo area as expected', async ({ page }) => {
      const btn = page.locator(SELECTORS.demoBtn);
      const demo = page.locator(SELECTORS.demoArea);

      // Focus the button and press Enter to activate (this should trigger click handler)
      await btn.focus();
      await page.keyboard.press('Enter');

      // Should be visible after Enter
      await expect(demo).toHaveAttribute('aria-hidden', 'false');
      await expect(btn).toHaveAttribute('aria-expanded', 'true');

      // Press Space to toggle back (Space also activates button)
      await page.keyboard.press('Space');
      await expect(demo).toHaveAttribute('aria-hidden', 'true');
      await expect(btn).toHaveAttribute('aria-expanded', 'false');

      // No page errors produced by keyboard activation
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Accessibility and attribute invariants', () => {
    test('demoArea has role and aria-live attributes; button aria-controls matches demo id', async ({ page }) => {
      const btn = page.locator(SELECTORS.demoBtn);
      const demo = page.locator(SELECTORS.demoArea);

      // Check role and aria-live
      await expect(demo).toHaveAttribute('role', 'region');
      await expect(demo).toHaveAttribute('aria-live', 'polite');

      // aria-controls on button points to demoArea id
      await expect(btn).toHaveAttribute('aria-controls', 'demoArea');

      // Ensure the DOM structure contains the expected strong/presence of the demonstration heading
      const headingText = await demo.locator('strong').innerText();
      expect(headingText).toContain('Demonstration: selection sort on [64, 25, 12, 22, 11]');

      // No console/page errors introduced
      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    });
  });

  test.describe('Edge cases and negative scenarios', () => {
    test('Clicking a non-existent selector should not silently succeed (selector absence is detectable)', async ({ page }) => {
      // Attempt to locate a non-existent element and assert it is not present
      const missing = page.locator('#thisSelectorDoesNotExist');
      await expect(missing).toHaveCount(0);

      // Ensure absence does not produce page errors
      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    });

    test('Demo text remains intact across toggles (content persistence)', async ({ page }) => {
      const btn = page.locator(SELECTORS.demoBtn);
      const demoText = page.locator(SELECTORS.demoText);

      // Record initial content
      const initial = await demoText.evaluate(el => el.textContent || '');

      // Toggle visible and hidden multiple times
      await btn.click();
      await btn.click();
      await btn.click();
      await btn.click();

      // Content should be unchanged (no dynamic changes other than visibility)
      const after = await demoText.evaluate(el => el.textContent || '');
      expect(after).toBe(initial);

      // Confirm no runtime errors happened
      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    });
  });

  test.describe('Diagnostics: capture and assert console and page errors behavior', () => {
    test('No uncaught exceptions, ReferenceError, TypeError, or SyntaxError should be emitted during normal usage', async ({ page }) => {
      // Perform several interactions that exercise the script paths
      const btn = page.locator(SELECTORS.demoBtn);
      await btn.click();
      await btn.click();
      await btn.click();

      // We must not patch or modify the runtime; simply assert that we observed zero uncaught page errors
      // If any such errors existed, pageErrors would contain them and this assertion would fail (as required)
      expect(pageErrors.length).toBe(0);

      // Also ensure console did not emit any console.error messages
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);

      // For additional diagnostics, ensure we captured console messages (at least info-level from no-op)
      expect(Array.isArray(consoleMessages)).toBeTruthy();
    });
  });
});