import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8379c90-fa7b-11f0-b314-ad8654ee5de8.html';

/**
 * Page object encapsulating common interactions and queries for the "Process — Comprehensive Explanation" page.
 */
class ProcessPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#show-example');
    this.example = page.locator('#example');
    this.headerTitle = page.locator('header h1');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  async buttonText() {
    return this.button.textContent();
  }

  async isExampleVisible() {
    // Use Playwright's visibility assertions as the source-of-truth for visual state.
    return await this.example.isVisible();
  }

  async exampleHasHiddenClass() {
    const cls = await this.example.getAttribute('class');
    // getAttribute may return null if attribute absent, or '' if empty string set by script.
    return typeof cls === 'string' && cls.split(/\s+/).includes('hidden');
  }

  async clickToggle() {
    await this.button.click();
  }

  async getExampleInnerText() {
    return this.example.innerText();
  }
}

// Group tests related to the FSM states and transitions.
test.describe('FSM: Process — Comprehensive Explanation (d8379c90-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // We'll capture console messages and page errors to validate runtime behavior/side-effects.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Record console events (all types) for inspection.
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // If console message inspection causes an error, record it as a synthetic console entry.
        consoleMessages.push({ type: 'internal', text: `console event read error: ${String(e)}` });
      }
    });

    // Record unhandled page errors (these are exceptions bubbling to window.onerror / unhandledrejection).
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test.
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
  });

  test.afterEach(async () => {
    // No teardown required beyond Playwright fixtures; this hook exists for clarity.
  });

  test('Initial state: Idle (S0_Idle) - button rendered and example hidden', async ({ page }) => {
    // This test validates the S0_Idle state: the button exists and the example is hidden by default.
    const pp = new ProcessPage(page);

    // Sanity: header/title hasn't changed (ensures page loaded).
    await expect(pp.headerTitle).toHaveText('Process — Comprehensive Explanation');

    // The toggle button should be present and have the FSM-specified initial label.
    await expect(pp.button).toBeVisible();
    await expect(pp.button).toHaveText('Show Scheduling Example (FCFS, SJF, RR)');

    // The example area should be present in the DOM but hidden (class 'hidden' and not visible).
    await expect(pp.example).toBeHidden();
    // Confirm the class attribute contains 'hidden' initially.
    const hasHidden = await pp.exampleHasHiddenClass();
    expect(hasHidden).toBe(true);

    // Confirm no runtime page errors occurred during initial load.
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: ShowExample click toggles example visible (S0_Idle -> S1_ExampleVisible)', async ({ page }) => {
    // This test validates clicking the button reveals the example and updates button label accordingly.
    const pp = new ProcessPage(page);

    // Click to show the example.
    await pp.clickToggle();

    // After click: example should be visible and not have the 'hidden' class (script sets className to '').
    await expect(pp.example).toBeVisible();
    const hasHiddenAfterShow = await pp.exampleHasHiddenClass();
    expect(hasHiddenAfterShow).toBe(false);

    // Button text should change to "Hide Scheduling Example".
    await expect(pp.button).toHaveText('Hide Scheduling Example');

    // Verify that the example contains expected content (sanity check of inner content).
    const inner = await pp.getExampleInnerText();
    expect(inner).toContain('Example: 4 processes');
    expect(inner).toContain('FCFS');
    expect(inner).toContain('Round Robin (quantum = 4)');

    // Also assert no page errors were emitted by this interaction.
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: ShowExample click toggles back to hidden (S1_ExampleVisible -> S0_Idle)', async ({ page }) => {
    // This test validates clicking the toggle button twice returns to the Idle state with example hidden.
    const pp = new ProcessPage(page);

    // First click: show.
    await pp.clickToggle();
    await expect(pp.example).toBeVisible();
    await expect(pp.button).toHaveText('Hide Scheduling Example');

    // Second click: hide again.
    await pp.clickToggle();

    // Expect example hidden and button text restored.
    await expect(pp.example).toBeHidden();
    await expect(pp.button).toHaveText('Show Scheduling Example (FCFS, SJF, RR)');

    // Confirm class attribute returns to include 'hidden'.
    const hasHiddenFinally = await pp.exampleHasHiddenClass();
    expect(hasHiddenFinally).toBe(true);

    expect(pageErrors.length).toBe(0);
  });

  test('Rapid toggling: repeated clicks produce consistent parity and no errors', async ({ page }) => {
    // Edge case: simulate a rapid sequence of clicks and ensure visibility toggles consistently.
    const pp = new ProcessPage(page);

    const clicks = 7; // odd -> final state should be "shown"
    for (let i = 0; i < clicks; i++) {
      // Use click without awaiting animation since there's no animation; we await the click action itself.
      await pp.clickToggle();
    }

    // After 7 toggles (odd), example should be visible.
    const visible = await pp.isExampleVisible();
    expect(visible).toBe(true);
    await expect(pp.button).toHaveText('Hide Scheduling Example');

    // Now perform one more to make it even (hidden).
    await pp.clickToggle();
    await expect(pp.example).toBeHidden();
    await expect(pp.button).toHaveText('Show Scheduling Example (FCFS, SJF, RR)');

    // No page errors observed.
    expect(pageErrors.length).toBe(0);
  });

  test('Robustness: clicking the button does not alter unrelated page content', async ({ page }) => {
    // Ensure the toggle action only affects the example area and toggle button text.
    const pp = new ProcessPage(page);

    const originalHeader = await pp.headerTitle.textContent();

    // Click to show.
    await pp.clickToggle();
    await expect(pp.example).toBeVisible();

    // Header should remain unchanged.
    await expect(pp.headerTitle).toHaveText(originalHeader);

    // Click to hide again.
    await pp.clickToggle();
    await expect(pp.example).toBeHidden();

    // Confirm header still unchanged.
    await expect(pp.headerTitle).toHaveText(originalHeader);

    expect(pageErrors.length).toBe(0);
  });

  test('Console and runtime error observations: record console messages and page errors', async ({ page }) => {
    // This test explicitly inspects recorded console messages and page errors.
    // We DO NOT inject or patch anything; we only assert on what naturally occurred.
    // The page is largely static and the script is small; we expect no console errors or uncaught exceptions.
    // However, the test records them and asserts expectations explicitly.

    // Give the page a short moment to possibly emit deferred console messages or errors.
    await page.waitForTimeout(200);

    // Log captured console messages for test diagnostics (these are available in Playwright test output).
    // We assert there are no error-level console messages and no page errors.
    const errorConsoles = consoleMessages.filter(m => m.type === 'error');
    if (errorConsoles.length > 0) {
      // If there are error console messages, fail the test with details.
      const details = errorConsoles.map(m => `[console.${m.type}] ${m.text}`).join('\n');
      // Use expect to fail with a helpful message.
      expect(errorConsoles.length, `Unexpected console.error messages:\n${details}`).toBe(0);
    }

    // Assert no uncaught page errors (these are thrown exceptions visible to page.on('pageerror')).
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

    // Additionally assert that the console captured the expected informational text when toggling (if any).
    // The page's script does not write to the console by design; so we just ensure no unexpected logs appear.
    // We still assert that consoleMessages is an array (sanity).
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});