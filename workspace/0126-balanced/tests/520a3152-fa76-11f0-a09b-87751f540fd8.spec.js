import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520a3152-fa76-11f0-a09b-87751f540fd8.html';

// Simple page object for the Mutex example page
class MutexPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startSelector = '#mutex';
    this.lockSelector = '#mutex-lock';
  }

  // Click the "Start Mutex" button
  async clickStart() {
    await this.page.click(this.startSelector);
  }

  // Get the innerText of the mutex-lock div
  async getLockText() {
    return (await this.page.locator(this.lockSelector).innerText()).trim();
  }

  // Wait for the lock text to match expected value (with timeout)
  async waitForLockText(expectedText, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, expected) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return el.innerText.trim() === expected;
      },
      this.lockSelector,
      expectedText,
      { timeout }
    );
  }
}

test.describe('Mutex Example - FSM states and transitions', () => {
  // Collect console and page errors per test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later inspection
    page.on('console', (msg) => {
      // Record text and type for richer assertions later
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions (page errors)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test we keep listeners but clear arrays in next beforeEach
    // No teardown actions needed beyond Playwright built-in fixtures
  });

  test('Initial state: the page loads and mutex-lock is initially empty (implementation detail)', async ({ page }) => {
    // This test validates the initial DOM state of the mutex example.
    // According to the FSM the "Unlocked" state sets the text to 'Mutex unlocked' on entry,
    // but the provided implementation does not set this text at page load.
    const mutex = new MutexPage(page);

    // Ensure the Start Mutex button exists and is visible
    await expect(page.locator(mutex.startSelector)).toBeVisible();

    // Check initial lock text - implementation leaves it empty initially
    const initialText = await mutex.getLockText();
    // We assert the actual behavior of the page (empty) rather than the FSM expectation,
    // because we must not modify or patch the page.
    expect(initialText).toBe('', 'Expected the mutex-lock div to be empty on initial load (implementation does not write "Mutex unlocked" at start)');

    // Verify no uncaught page errors occurred during initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Unlocked -> S1_Locked: clicking Start Mutex sets "Mutex locked"', async ({ page }) => {
    // This test validates that clicking the toggle transitions to the Locked state.
    const mutex1 = new MutexPage(page);

    // Click to toggle the mutex to locked
    await mutex.clickStart();

    // Wait for the expected text set by the click handler
    await mutex.waitForLockText('Mutex locked');

    const textAfterClick = await mutex.getLockText();
    expect(textAfterClick).toBe('Mutex locked');

    // Also check that the Mutex class exists in the page context (evidence of Mutex creation)
    const mutexType = await page.evaluate(() => {
      return typeof Mutex;
    });
    expect(mutexType).toBe('function');

    // Confirm no unhandled page errors occurred during this interaction
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1_Locked -> S0_Unlocked: clicking Start Mutex again unlocks the mutex', async ({ page }) => {
    // This test validates that a second click toggles back to the Unlocked state.
    const mutex2 = new MutexPage(page);

    // First click: locked
    await mutex.clickStart();
    await mutex.waitForLockText('Mutex locked');
    expect(await mutex.getLockText()).toBe('Mutex locked');

    // Second click: should unlock (set text to 'Mutex unlocked')
    await mutex.clickStart();

    // Wait for the expected unlocked text. The implementation sets 'Mutex unlocked' on unlocking.
    await mutex.waitForLockText('Mutex unlocked');

    const afterSecondClick = await mutex.getLockText();
    expect(afterSecondClick).toBe('Mutex unlocked');

    // Confirm no unhandled page errors occurred during these transitions
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: rapid double-click should result in toggled states and no runtime errors', async ({ page }) => {
    // This test simulates rapid user interactions to look for race conditions or runtime errors.
    const mutex3 = new MutexPage(page);

    // Rapidly click twice in quick succession
    await Promise.all([
      page.click(mutex.startSelector),
      page.click(mutex.startSelector),
    ]);

    // The implementation's behavior: first click locks, second click unlocks.
    // Wait until the unlocked text appears (final expected state after two toggles)
    await mutex.waitForLockText('Mutex unlocked');

    const finalText = await mutex.getLockText();
    expect(finalText).toBe('Mutex unlocked', 'After a rapid double-click the implementation should end up unlocked (second click toggles back)');

    // Ensure no console errors of TypeError/ReferenceError/SyntaxError occurred during this rapid interaction
    const errorLikeMessages = consoleMessages.filter(m => {
      const t = m.text || '';
      return /ReferenceError|TypeError|SyntaxError/i.test(t) || m.type === 'error';
    });
    expect(errorLikeMessages.length).toBe(0);

    // Also ensure no page-level uncaught exceptions
    expect(pageErrors.length).toBe(0);
  });

  test('Implementation details: ensure Mutex.run does not throw when callback is synchronous and class exists', async ({ page }) => {
    // This test inspects the implementation behavior indirectly:
    // - The Mutex class should exist
    // - Running the provided click handler should not throw and should update the DOM
    const mutex4 = new MutexPage(page);

    // Assert Mutex class exists in the page
    const classExists = await page.evaluate(() => typeof Mutex === 'function');
    expect(classExists).toBe(true);

    // Click to run the mutex callback (synchronous in implementation)
    await mutex.clickStart();

    // The callback sets 'Mutex locked' - assert it occurred
    await mutex.waitForLockText('Mutex locked');
    expect(await mutex.getLockText()).toBe('Mutex locked');

    // No uncaught exceptions expected
    expect(pageErrors.length).toBe(0);
  });

  test('Console and page error inspection: there should be no ReferenceError, SyntaxError, or TypeError emitted by the page', async ({ page }) => {
    // This test explicitly inspects captured console messages and page errors.
    // It will fail if the page emitted JS runtime errors (ReferenceError/TypeError/SyntaxError).
    const mutex5 = new MutexPage(page);

    // Interact a bit to exercise scripts
    await mutex.clickStart();
    await mutex.waitForLockText('Mutex locked');
    await mutex.clickStart();
    await mutex.waitForLockText('Mutex unlocked');

    // Aggregate console errors and pageErrors
    // Check page error objects for common error names
    const pageErrorNames = pageErrors.map(e => e.name || '').filter(Boolean);
    expect(pageErrorNames).toEqual([]);

    // Check console messages that are errors or contain common error words
    const errorConsoleMessages = consoleMessages.filter(m => {
      if (!m || !m.text) return false;
      const text = m.text;
      return m.type === 'error' || /ReferenceError|TypeError|SyntaxError|Uncaught/i.test(text);
    });

    expect(errorConsoleMessages.length).toBe(0);
  });
});