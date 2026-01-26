import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9a9ab1-fa78-11f0-857d-d58e82d5de73.html';

// Page Object for the interactive page
class ApiPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.btnShow = page.locator('#btnShowExample');
    this.btnReset = page.locator('#btnReset');
    this.example = page.locator('#exampleResponse');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickShow() {
    await this.btnShow.click();
  }

  async clickReset() {
    await this.btnReset.click();
  }

  async getExampleDisplay() {
    // Read inline style display value
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? window.getComputedStyle(el).display : null;
    }, '#exampleResponse');
  }

  async isShowDisabled() {
    return await this.btnShow.isDisabled();
  }

  async isResetDisabled() {
    return await this.btnReset.isDisabled();
  }

  async activeElementId() {
    return await this.page.evaluate(() => document.activeElement?.id || null);
  }
}

test.describe('REST API — Visual Elegance (FSM Validation)', () => {
  // Arrays to collect runtime errors and console error messages per test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location && msg.location(),
        });
      }
    });

    // Collect unhandled page errors (exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Nothing to teardown globally — individual tests assert runtime errors as needed.
  });

  test('Initial state (S0_Idle): Page loads with expected Idle state UI', async ({ page }) => {
    // Validate initial state (Idle): render page and verify elements present and attributes
    const api = new ApiPage(page);
    await api.goto();

    // DOM presence checks
    await expect(api.btnShow).toBeVisible({ timeout: 2000 });
    await expect(api.btnReset).toBeVisible();
    await expect(api.example).toBeVisible(); // <pre> is in DOM but style display may be none

    // Verify example is hidden initially (S0_Idle evidence: display none)
    const display = await api.getExampleDisplay();
    expect(display).toBe('none');

    // Verify buttons' enabled/disabled states as in FSM Idle evidence
    expect(await api.isResetDisabled()).toBe(true); // Reset should be disabled
    expect(await api.isShowDisabled()).toBe(false); // Show should be enabled

    // Verify accessibility attributes per component definitions
    await expect(api.btnShow).toHaveAttribute('aria-describedby', 'descExample');
    await expect(api.btnReset).toHaveAttribute('aria-describedby', 'descReset');
    await expect(api.example).toHaveAttribute('aria-label', 'Example JSON Response');

    // Ensure no runtime page errors or console errors occurred during initial load
    expect(consoleErrors, `Console error(s) on load: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    expect(pageErrors, `Page error(s) on load: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
  });

  test('ShowExample event transitions Idle -> Example Visible (S0 -> S1)', async ({ page }) => {
    // Validate clicking "Show Example Response" reveals the example and toggles button states
    const api = new ApiPage(page);
    await api.goto();

    // Sanity preconditions
    expect(await api.getExampleDisplay()).toBe('none');
    expect(await api.isShowDisabled()).toBe(false);
    expect(await api.isResetDisabled()).toBe(true);

    // Click show button and assert transition observables
    await api.clickShow();

    // example.style.display should become 'block'
    const displayAfterShow = await api.getExampleDisplay();
    expect(displayAfterShow).toBe('block');

    // btnShow should become disabled, btnReset should become enabled
    expect(await api.isShowDisabled()).toBe(true);
    expect(await api.isResetDisabled()).toBe(false);

    // Focus behavior: code calls btnShow.focus() after showing, so active element should be show button
    const activeId = await api.activeElementId();
    expect(activeId).toBe('btnShowExample');

    // Check for any runtime errors during the interaction
    expect(consoleErrors, `Console errors after ShowExample: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    expect(pageErrors, `Page errors after ShowExample: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
  });

  test('ResetView event transitions Example Visible -> Example Hidden (S1 -> S2)', async ({ page }) => {
    // Validate clicking "Reset View" hides the example and toggles button states back
    const api = new ApiPage(page);
    await api.goto();

    // Bring the page into S1 by showing example first
    await api.clickShow();
    expect(await api.getExampleDisplay()).toBe('block');
    expect(await api.isShowDisabled()).toBe(true);
    expect(await api.isResetDisabled()).toBe(false);

    // Click reset and assert observables for transition to S2
    await api.clickReset();

    // example.style.display should become 'none'
    const displayAfterReset = await api.getExampleDisplay();
    expect(displayAfterReset).toBe('none');

    // btnShow should be enabled and btnReset disabled again
    expect(await api.isShowDisabled()).toBe(false);
    expect(await api.isResetDisabled()).toBe(true);

    // Focus after reset: code sets focus to btnShow, so active element should be btnShowExample
    const activeId = await api.activeElementId();
    expect(activeId).toBe('btnShowExample');

    // No runtime errors should be produced by this sequence
    expect(consoleErrors, `Console errors after ResetView: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    expect(pageErrors, `Page errors after ResetView: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
  });

  test('Toggle behavior: Hidden -> Visible -> Hidden (S2 -> S1 -> S2) multiple times', async ({ page }) => {
    // Ensure repeated toggles behave deterministically and produce no runtime errors
    const api = new ApiPage(page);
    await api.goto();

    // Start from S0 Idle (hidden)
    expect(await api.getExampleDisplay()).toBe('none');

    // Show
    await api.clickShow();
    expect(await api.getExampleDisplay()).toBe('block');
    expect(await api.isShowDisabled()).toBe(true);
    expect(await api.isResetDisabled()).toBe(false);

    // Reset
    await api.clickReset();
    expect(await api.getExampleDisplay()).toBe('none');
    expect(await api.isShowDisabled()).toBe(false);
    expect(await api.isResetDisabled()).toBe(true);

    // Show again (S2 -> S1)
    await api.clickShow();
    expect(await api.getExampleDisplay()).toBe('block');
    expect(await api.isShowDisabled()).toBe(true);
    expect(await api.isResetDisabled()).toBe(false);

    // Final check for runtime errors after multiple toggles
    expect(consoleErrors, `Console errors after toggles: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    expect(pageErrors, `Page errors after toggles: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
  });

  test('Edge case: Attempting to click disabled Reset button should not change state and should be blocked by Playwright', async ({ page }) => {
    // This test asserts that the Reset button is initially disabled and that Playwright will not allow a normal click.
    // We catch the Playwright rejection when trying to click a disabled control and assert no runtime page exceptions occurred.
    const api = new ApiPage(page);
    await api.goto();

    // Ensure Reset is disabled in Idle
    expect(await api.isResetDisabled()).toBe(true);

    // Attempt to click the disabled reset button without forcing.
    // Playwright should throw an error like "Element is not enabled" — we assert that such an error is thrown.
    let clickError = null;
    try {
      await api.clickReset();
    } catch (err) {
      clickError = err;
    }
    expect(clickError, 'Expected click on disabled button to throw an error').not.toBeNull();
    expect(String(clickError)).toMatch(/not enabled|Element is not enabled|is disabled|is not visible|not clickable/i);

    // Verify state remains Idle (example still hidden, show enabled)
    expect(await api.getExampleDisplay()).toBe('none');
    expect(await api.isShowDisabled()).toBe(false);
    expect(await api.isResetDisabled()).toBe(true);

    // Validate no unexpected runtime errors were thrown by the page itself (page logic didn't crash)
    expect(consoleErrors, `Console errors after clicking disabled reset: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    expect(pageErrors, `Page errors after clicking disabled reset: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
  });

  test('Accessibility and semantics: ARIA + focus behavior across transitions', async ({ page }) => {
    // Validate ARIA roles, live regions, and focus changes that FSM implies in transitions
    const api = new ApiPage(page);
    await api.goto();

    // ARIA roles present
    await expect(api.example).toHaveAttribute('role', 'region');
    await expect(api.example).toHaveAttribute('aria-live', 'polite');

    // Show and check aria-live region becomes visible (still role attributes remain)
    await api.clickShow();
    expect(await api.getExampleDisplay()).toBe('block');
    await expect(api.example).toHaveAttribute('aria-label', 'Example JSON Response');

    // After showing, focus should be on show button (per implementation)
    let activeId = await api.activeElementId();
    expect(activeId).toBe('btnShowExample');

    // Reset and focus should again be on show button (per implementation)
    await api.clickReset();
    activeId = await api.activeElementId();
    expect(activeId).toBe('btnShowExample');

    // Ensure no console or page errors during accessibility checks
    expect(consoleErrors, `Console errors during accessibility checks: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    expect(pageErrors, `Page errors during accessibility checks: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
  });

  test('Runtime error observation: assert no unexpected ReferenceError/SyntaxError/TypeError on load and interactions', async ({ page }) => {
    // This test explicitly ensures that no JS runtime exceptions (ReferenceError, TypeError, SyntaxError, etc.) propagate to the page.
    // According to the requirements, we observe console and page errors and assert whether errors happened.
    const api = new ApiPage(page);
    await api.goto();

    // Perform several interactions to surface any latent errors
    await api.clickShow();
    await api.clickReset();
    await api.clickShow();

    // Gather any collected errors and assert none occurred.
    // If any errors did occur, we include their text in the assertion message to aid debugging.
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      // Provide detailed diagnostics in the failure message
      const diagnostics = {
        consoleErrors,
        pageErrors: pageErrors.map((e) => (e && e.stack) ? e.stack : String(e)),
      };
      // Fail the test with full diagnostics
      expect(diagnostics, 'Expected no runtime console or page errors during interactions').toEqual({
        consoleErrors: [],
        pageErrors: [],
      });
    } else {
      // Explicit pass: no errors found
      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    }
  });
});