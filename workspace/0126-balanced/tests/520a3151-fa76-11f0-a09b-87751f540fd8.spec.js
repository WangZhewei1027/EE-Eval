import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520a3151-fa76-11f0-a09b-87751f540fd8.html';

test.describe('520a3151-fa76-11f0-a09b-87751f540fd8 - Deadlock Example (FSM validation)', () => {
  // Navigate to the page before each test to ensure a fresh environment.
  test.beforeEach(async ({ page }) => {
    // Collect console messages for assertions
    page._consoleMessages = [];
    page.on('console', msg => {
      page._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect dialogs if any
    page._dialogs = [];
    page.on('dialog', async dialog => {
      page._dialogs.push({ type: dialog.type(), message: dialog.message() });
      // Dismiss to avoid blocking tests (we are observing, not altering behavior)
      await dialog.dismiss().catch(() => {});
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Cleanup listeners - Playwright will tear down page between tests, but remove references just in case
    page.removeAllListeners && page.removeAllListeners('console');
    page.removeAllListeners && page.removeAllListeners('dialog');
  });

  test.describe('Initial State (S0_Idle) validations', () => {
    test('renders four buttons with expected labels and global locks object present', async ({ page }) => {
      // Verify that four buttons are present and have correct text
      const buttons = await page.$$('button');
      expect(buttons.length).toBe(4);

      const texts = await Promise.all(buttons.map(async b => (await b.innerText()).trim()));
      expect(texts).toEqual(['Button 1', 'Button 2', 'Button 3', 'Button 4']);

      // Verify that the global `locks` object exists and all button locks start as false
      const locks = await page.evaluate(() => {
        // Return a simple serializable snapshot
        return {
          b1: typeof window.locks !== 'undefined' ? window.locks.button1.locked : null,
          b2: typeof window.locks !== 'undefined' ? window.locks.button2.locked : null,
          b3: typeof window.locks !== 'undefined' ? window.locks.button3.locked : null,
          b4: typeof window.locks !== 'undefined' ? window.locks.button4.locked : null
        };
      });

      // The implementation declares `let locks = {...}` so `window.locks` should be defined and all false initially
      expect(locks).toEqual({ b1: false, b2: false, b3: false, b4: false });
    });
  });

  test.describe('Event handling and transitions (ButtonClick -> lock/unlock)', () => {
    // This test validates the main ButtonClick behavior as implemented.
    test('clicking a button schedules deadlock function which leads to a TypeError from lockButton misuse', async ({ page }) => {
      // We expect an error to occur because the implementation calls lockButton with a button element
      // where lockButton expects an index into the `buttons` NodeList.
      // Listen for the pageerror event which surfaces unhandled exceptions.
      const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 7000 });

      // Click button1 to trigger the deadlock sequence
      await page.click('#button1');

      // The deadlock function uses a 2000ms setTimeout before calling lockButton, so wait for the page error
      const error = await pageErrorPromise;

      // Assert that this is a TypeError caused by attempting to read .locked of undefined (robust check)
      expect(error).toBeTruthy();
      expect(error.name).toBe('TypeError');
      // Message contents vary by browser; check for key hints
      expect(error.message).toMatch(/locked|Cannot read properties|reading/);

      // Also assert that no successful "Button is now locked" console message was produced
      const consoleTexts = page._consoleMessages.map(m => m.text);
      const foundLockedMessage = consoleTexts.some(t => /is now locked/.test(t));
      const foundUnlockedMessage = consoleTexts.some(t => /is now unlocked/.test(t));
      expect(foundLockedMessage).toBe(false);
      expect(foundUnlockedMessage).toBe(false);
    });

    test('all four buttons are wired to the same deadlock handler (each click produces the same TypeError)', async ({ page }) => {
      // We'll click each button in turn and assert that a pageerror occurs for each.
      for (let i = 1; i <= 4; i++) {
        // Reload to reset state and listeners so each iteration is isolated
        await page.goto(APP_URL, { waitUntil: 'load' });

        const selector = `#button${i}`;
        const pageErrorPromise1 = page.waitForEvent('pageerror', { timeout: 7000 });

        await page.click(selector);

        const error1 = await pageErrorPromise;
        expect(error).toBeTruthy();
        expect(error.name).toBe('TypeError');
        expect(error.message).toMatch(/locked|Cannot read properties|reading/);
      }
    });
  });

  test.describe('Edge cases and error scenario validations', () => {
    test('locks object remains unchanged (all false) after deadlock attempt that throws', async ({ page }) => {
      // Click a button to trigger the broken deadlock which should throw a TypeError
      const pageErrorPromise2 = page.waitForEvent('pageerror', { timeout: 7000 });
      await page.click('#button2');
      await pageErrorPromise;

      // After the error, verify the global locks object still shows false for all buttons
      const locksAfter = await page.evaluate(() => {
        return {
          b1: typeof window.locks !== 'undefined' ? window.locks.button1.locked : null,
          b2: typeof window.locks !== 'undefined' ? window.locks.button2.locked : null,
          b3: typeof window.locks !== 'undefined' ? window.locks.button3.locked : null,
          b4: typeof window.locks !== 'undefined' ? window.locks.button4.locked : null
        };
      });

      expect(locksAfter).toEqual({ b1: false, b2: false, b3: false, b4: false });
    });

    test('no alert dialogs are observed during the deadlock attempt that errors early', async ({ page }) => {
      // Reset any dialog captures
      page._dialogs = [];

      const pageErrorPromise3 = page.waitForEvent('pageerror', { timeout: 7000 });
      await page.click('#button3');
      await pageErrorPromise;

      // The implementation would call alert in lockButton/unlockButton on certain conditions,
      // but because the TypeError occurs early, we should observe no dialogs.
      expect(Array.isArray(page._dialogs)).toBe(true);
      expect(page._dialogs.length).toBe(0);
    });

    test('clicking non-button area does not trigger the deadlock handler or page errors', async ({ page }) => {
      // Click body (outside buttons) - should not cause the deadlock handler to fire
      // We give a short timeout: no pageerror must occur in this period
      const waitForPossibleError = page.waitForEvent('pageerror', { timeout: 1500 }).then(() => true).catch(() => false);

      await page.click('body', { position: { x: 5, y: 5 } });

      const errorOccurred = await waitForPossibleError;
      expect(errorOccurred).toBe(false);
    });
  });

  test.describe('FSM transition coverage commentary', () => {
    test('notes on observed transitions: due to runtime error the expected S0->S1 (lock) and S1->S2 (unlock) observable logs do not occur', async ({ page }) => {
      // Click any button to attempt the transition
      const pageErrorPromise4 = page.waitForEvent('pageerror', { timeout: 7000 });
      await page.click('#button4');
      await pageErrorPromise;

      // Collect console output for evidence messages
      const consoleTexts1 = page._consoleMessages.map(m => m.text);

      // The FSM expected console observables "Button is now locked" and "Button is now unlocked".
      // In this implementation, because of the TypeError, neither observable should be present.
      const hasLockText = consoleTexts.some(t => /now locked/.test(t));
      const hasUnlockText = consoleTexts.some(t => /now unlocked/.test(t));

      expect(hasLockText).toBe(false);
      expect(hasUnlockText).toBe(false);

      // Assert that the page has the four buttons still present (i.e., DOM didn't change)
      const buttonsRemaining = await page.$$('button');
      expect(buttonsRemaining.length).toBe(4);
    });
  });
});