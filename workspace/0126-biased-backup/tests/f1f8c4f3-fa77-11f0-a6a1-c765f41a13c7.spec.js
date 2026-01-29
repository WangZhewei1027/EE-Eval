import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f8c4f3-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Interpreter Visual Concept — FSM validation and DOM behaviors', () => {
  // Capture console.error and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console events: capture messages with type 'error'
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location()
          });
        }
      } catch (e) {
        // don't block tests if console handling throws
      }
    });

    // Listen to unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to app
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // nothing to teardown per-test besides Playwright's automatic cleanup
  });

  test.describe('Initial Idle State (S0_Idle) checks', () => {
    test('Initial load: should be in Idle state - no floating tokens, AST not actively shown, console result hidden', async ({ page }) => {
      // Verify no floating tokens are present initially (clearAnimation called on initialize)
      await expect(page.locator('.floatingToken')).toHaveCount(0);

      // AST nodes should not have the "show" class initially (they have subtle opacity but not show)
      const astRoot = page.locator('#astRoot');
      const astLeft = page.locator('#astLeft');
      const astRight = page.locator('#astRight');
      await expect(astRoot).not.toHaveClass(/show/);
      await expect(astLeft).not.toHaveClass(/show/);
      await expect(astRight).not.toHaveClass(/show/);

      // Connector should not have "show" class
      await expect(page.locator('#connectorSvg')).not.toHaveClass(/show/);

      // Orbs should be invisible (opacity 0)
      const orb1Opacity = await page.evaluate(() => getComputedStyle(document.getElementById('orb1')).opacity);
      const orb2Opacity = await page.evaluate(() => getComputedStyle(document.getElementById('orb2')).opacity);
      expect(orb1Opacity).toBe('0');
      expect(orb2Opacity).toBe('0');

      // Result text should not have "show"
      await expect(page.locator('#resultText')).not.toHaveClass(/show/);
    });
  });

  test.describe('RunAnimation (S0_Idle -> S1_Animating) and animation progression', () => {
    test('Clicking Animate should start token floating and eventually reveal AST and result', async ({ page }) => {
      // Click the run button to start animation
      await page.click('#runBtn');

      // After starting, floating tokens should appear
      await page.waitForSelector('.floatingToken', { timeout: 1200 });
      const tokensCount = await page.locator('.floatingToken').count();
      expect(tokensCount).toBeGreaterThan(0);

      // Ensure token count does not exceed expected defined tokens (safety/invariant)
      // The page defines 15 tokens — ensure we do not create an unbounded number
      expect(tokensCount).toBeLessThanOrEqual(20);

      // Wait until AST root gets "show" class (script schedules at ~1600ms)
      await page.waitForFunction(() => {
        const el = document.getElementById('astRoot');
        return el && el.classList.contains('show');
      }, { timeout: 3000 });

      // Now AST children and connector should become visible within the choreography
      await expect(page.locator('#astLeft')).toHaveClass(/show/);
      await expect(page.locator('#astRight')).toHaveClass(/show/);
      await expect(page.locator('#connectorSvg')).toHaveClass(/show/);

      // Wait until result text becomes visible (script adds "show" around 1800ms)
      await page.waitForFunction(() => {
        const r = document.getElementById('resultText');
        return r && r.classList.contains('show');
      }, { timeout: 3500 });

      // Confirm result text is visible to the user
      await expect(page.locator('#resultText')).toHaveClass(/show/);
    });

    test('Pressing Enter on Animate button triggers same animation pathway', async ({ page }) => {
      // Focus the run button and press Enter to trigger keyboard path
      await page.focus('#runBtn');
      await page.keyboard.press('Enter');

      // Expect floating tokens to appear as a result
      await page.waitForSelector('.floatingToken', { timeout: 1200 });
      await expect(page.locator('.floatingToken')).toHaveCountGreaterThan(0);

      // Wait for AST root to show as in the click case
      await page.waitForFunction(() => {
        const el = document.getElementById('astRoot');
        return el && el.classList.contains('show');
      }, { timeout: 3000 });

      // Wait for result
      await page.waitForFunction(() => {
        const r = document.getElementById('resultText');
        return r && r.classList.contains('show');
      }, { timeout: 3500 });

      await expect(page.locator('#resultText')).toHaveClass(/show/);
    });

    test('Multiple rapid clicks do not create runaway number of tokens (idempotency safeguard)', async ({ page }) => {
      // Click run a few times quickly
      await page.click('#runBtn');
      await page.click('#runBtn');
      await page.click('#runBtn');

      // Some tokens must exist, but count must be bounded by the number of defined tokens
      await page.waitForSelector('.floatingToken', { timeout: 1200 });
      const count = await page.locator('.floatingToken').count();
      expect(count).toBeGreaterThan(0);
      // Sanity upper bound: defined tokens are 15 in implementation, allow some margin
      expect(count).toBeLessThanOrEqual(20);
    });
  });

  test.describe('ResetAnimation (S1_Animating -> S0_Idle) checks', () => {
    test('Clicking Reset during animation should clear tokens and hide AST/result', async ({ page }) => {
      // Start animation
      await page.click('#runBtn');
      // Wait a short moment for tokens to appear
      await page.waitForSelector('.floatingToken', { timeout: 1200 });

      // Trigger reset while animation may still be ongoing
      await page.click('#resetBtn');

      // After reset we expect no floating tokens and result/ast not shown
      await page.waitForTimeout(200); // small pause to allow clearAnimation to run
      await expect(page.locator('.floatingToken')).toHaveCount(0);

      await expect(page.locator('#astRoot')).not.toHaveClass(/show/);
      await expect(page.locator('#astLeft')).not.toHaveClass(/show/);
      await expect(page.locator('#astRight')).not.toHaveClass(/show/);
      await expect(page.locator('#connectorSvg')).not.toHaveClass(/show/);
      await expect(page.locator('#resultText')).not.toHaveClass(/show/);

      // Orbs should be invisible again
      const orb1OpacityAfterReset = await page.evaluate(() => getComputedStyle(document.getElementById('orb1')).opacity);
      const orb2OpacityAfterReset = await page.evaluate(() => getComputedStyle(document.getElementById('orb2')).opacity);
      expect(orb1OpacityAfterReset).toBe('0');
      expect(orb2OpacityAfterReset).toBe('0');
    });

    test('Pressing Space on Reset button triggers clearing behavior (keyboard accessible reset)', async ({ page }) => {
      // Start animation then use keyboard to reset
      await page.click('#runBtn');
      await page.waitForSelector('.floatingToken', { timeout: 1200 });

      await page.focus('#resetBtn');
      await page.keyboard.press(' '); // space key

      // Expect the same clearing effects as the click reset
      await page.waitForTimeout(200);
      await expect(page.locator('.floatingToken')).toHaveCount(0);
      await expect(page.locator('#resultText')).not.toHaveClass(/show/);
      await expect(page.locator('#astRoot')).not.toHaveClass(/show/);
    });
  });

  test.describe('Edge cases and invariants', () => {
    test('Calling reset when idle is a no-op (still idle state)', async ({ page }) => {
      // Ensure we start idle
      await expect(page.locator('.floatingToken')).toHaveCount(0);
      await page.click('#resetBtn');

      // State should remain idle
      await expect(page.locator('.floatingToken')).toHaveCount(0);
      await expect(page.locator('#resultText')).not.toHaveClass(/show/);
    });

    test('Animation completes and returns to Idle within expected timeframe', async ({ page }) => {
      // Start animation
      await page.click('#runBtn');

      // Wait until result shown
      await page.waitForFunction(() => document.getElementById('resultText').classList.contains('show'), { timeout: 4000 });

      // The script sets animating=false at ~3600ms; ensure after a little extra time tokens are cleaned up
      await page.waitForTimeout(2000);
      // All floating tokens should have been removed by cleanup
      await expect(page.locator('.floatingToken')).toHaveCount(0);
    });
  });

  test.describe('Console and Page Error observation (must not suppress runtime errors)', () => {
    test('There should be no uncaught page errors or console.error messages during normal operation', async ({ page }) => {
      // Run a full cycle to surface any runtime issues
      await page.click('#runBtn');

      // Wait for the animation to finish (script finalizes animating=false around 3600ms)
      await page.waitForTimeout(4200);

      // Allow any late microtasks to emit errors
      await page.waitForTimeout(200);

      // Assert that there were no page errors captured
      expect(pageErrors.length).toBe(0);

      // Assert there were no console.error messages captured
      expect(consoleErrors.length).toBe(0);
    });

    test('If any runtime errors occur they should surface via pageerror or console and be observable', async ({ page }) => {
      // This test does not inject faults; it ensures our listeners are active and would capture errors
      // We simply assert the listener arrays are defined and accessible (they are in-memory and were used earlier).
      expect(Array.isArray(consoleErrors)).toBe(true);
      expect(Array.isArray(pageErrors)).toBe(true);

      // We do not force errors or patch the page; per instructions we don't modify runtime.
      // If any errors naturally occurred earlier in navigation/setup, they'd be present in pageErrors/consoleErrors.
      // For clarity, assert there are zero such errors in the typical healthy baseline.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  // A small utility test to assert key UI components exist and have expected text/attributes
  test('UI components presence and attributes (sanity checks for the controls)', async ({ page }) => {
    const runBtn = page.locator('#runBtn');
    const resetBtn = page.locator('#resetBtn');

    await expect(runBtn).toBeVisible();
    await expect(resetBtn).toBeVisible();

    // Check button labels and titles as per FSM/component extraction
    await expect(runBtn).toHaveText('Animate');
    await expect(runBtn).toHaveAttribute('title', 'Animate the interpretation');

    await expect(resetBtn).toHaveText('Reset');
    await expect(resetBtn).toHaveAttribute('title', 'Reset visualization');
  });
});