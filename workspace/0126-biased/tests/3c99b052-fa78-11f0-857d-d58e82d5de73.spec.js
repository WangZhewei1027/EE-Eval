import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c99b052-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object model for the Transaction page.
 * Encapsulates selectors and common interactions for clearer tests.
 */
class TransactionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      status: '.status',
      btnToggle: '#btnToggleStatus',
      btnCopy: '#btnCopyID',
      txIdSpan: 'text=TX-9845B8273', // fallback selector to find the visible TX id text
    };
  }

  async goto() {
    await this.page.goto(BASE_URL);
    // ensure initial microtasks on page complete
    await this.page.waitForLoadState('domcontentloaded');
  }

  async getStatusText() {
    return (await this.page.locator(this.selectors.status).innerText()).trim();
  }

  async getStatusAriaLabel() {
    return await this.page.locator(this.selectors.status).getAttribute('aria-label');
  }

  async getStatusStyle(name) {
    // returns computed style value for the status element for a given property name
    return await this.page.evaluate(
      ({ sel, prop }) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        return window.getComputedStyle(el).getPropertyValue(prop);
      },
      { sel: this.selectors.status, prop: name }
    );
  }

  async getToggleAriaPressed() {
    return await this.page.locator(this.selectors.btnToggle).getAttribute('aria-pressed');
  }

  async clickToggle() {
    await this.page.click(this.selectors.btnToggle);
  }

  async clickCopy() {
    await this.page.click(this.selectors.btnCopy);
  }

  async getCopyButtonText() {
    return (await this.page.locator(this.selectors.btnCopy).innerText()).trim();
  }

  async getVisibleTxIdText() {
    const el = this.page.locator(this.selectors.txIdSpan);
    if (await el.count()) {
      return (await el.innerText()).trim();
    }
    // fallback: look into the second .row span center
    const fallback = await this.page.locator('.transaction-card .row >> nth=1 >> span').nth(1).innerText().catch(() => '');
    return fallback.trim();
  }
}

test.describe('Transaction Concept - Visual Experience (FSM & UI)', () => {
  // Arrays to capture runtime errors and console error messages per test
  /** @type {Array<ErrorEvent>} */
  let pageErrors;
  /** @type {Array<{type:string, text: string}>} */
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture page errors (unhandled exceptions) that bubble up to the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages, especially console.error outputs
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ type: msg.type(), text: msg.text() });
      }
    });
  });

  test.describe('FSM state validation and ToggleStatus transitions', () => {
    test('Initial state should be CONFIRMED and have corresponding aria and styling changes', async ({ page }) => {
      const tx = new TransactionPage(page);
      await tx.goto();

      // Validate initial status text and ARIA label content (onEnter updateStatus(0) executed)
      const statusText = await tx.getStatusText();
      expect(statusText).toBe('CONFIRMED');

      const ariaLabel = await tx.getStatusAriaLabel();
      expect(ariaLabel).toContain('confirmed'); // should be "Transaction status: confirmed"

      // The toggle button aria-pressed should reflect index 0 (false)
      const ariaPressed = await tx.getToggleAriaPressed();
      expect(ariaPressed).toBe('false');

      // Verify that the status element has a background (set via inline style by updateStatus)
      const background = await tx.getStatusStyle('background-image'); // some browsers expose gradient via background-image
      const backgroundFallback = await tx.getStatusStyle('background'); // fallback to background
      expect(background || backgroundFallback).toBeTruthy();

      // Ensure no fatal runtime errors occurred during load
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Toggling cycles through CONFIRMED -> PENDING -> FAILED -> CONFIRMED', async ({ page }) => {
      const tx = new TransactionPage(page);
      await tx.goto();

      // Confirm initial
      expect(await tx.getStatusText()).toBe('CONFIRMED');
      expect(await tx.getToggleAriaPressed()).toBe('false');

      // Toggle once -> PENDING
      await tx.clickToggle();
      await page.waitForTimeout(50); // small wait to allow DOM updates
      expect(await tx.getStatusText()).toBe('PENDING');
      // When not CONFIRMED, aria-pressed set to 'true'
      expect(await tx.getToggleAriaPressed()).toBe('true');

      // Toggle again -> FAILED
      await tx.clickToggle();
      await page.waitForTimeout(50);
      expect(await tx.getStatusText()).toBe('FAILED');
      expect(await tx.getToggleAriaPressed()).toBe('true');

      // Toggle again -> back to CONFIRMED
      await tx.clickToggle();
      await page.waitForTimeout(50);
      expect(await tx.getStatusText()).toBe('CONFIRMED');
      expect(await tx.getToggleAriaPressed()).toBe('false');

      // Rapid toggle edge-case: click three times quickly and validate final state
      await Promise.all([tx.clickToggle(), tx.clickToggle(), tx.clickToggle()]);
      await page.waitForTimeout(100);
      // After three quick toggles from CONFIRMED -> should end up at CONFIRMED (3 mod 3 = 0)
      expect(await tx.getStatusText()).toBe('CONFIRMED');

      // Assert again no unexpected page errors from toggle interactions
      expect(pageErrors.length).toBe(0);
    });

    test('State-specific visual evidence: boxShadow and background update for each state', async ({ page }) => {
      const tx = new TransactionPage(page);
      await tx.goto();

      // mapping of expected substrings that are set in the inline style values
      const expectedMap = {
        CONFIRMED: ['3a86ff', '8338ec'],
        PENDING: ['ffba08', 'faa307'],
        FAILED: ['ff006e', 'd90429'],
      };

      // Helper to assert state visuals
      async function assertStateVisuals(expectedKey) {
        const s = await tx.getStatusText();
        expect(s).toBe(expectedKey);

        const bg = (await tx.getStatusStyle('background')) || (await tx.getStatusStyle('background-image'));
        const boxShadow = await tx.getStatusStyle('box-shadow');

        // The JS sets background to a linear-gradient with hex colors; assert substrings exist
        for (const substr of expectedMap[expectedKey]) {
          const foundInBg = bg && bg.includes(substr);
          const foundInShadow = boxShadow && boxShadow.includes(substr);
          expect(foundInBg || foundInShadow).toBeTruthy();
        }
      }

      // CONFIRMED initial
      await assertStateVisuals('CONFIRMED');

      // PENDING
      await tx.clickToggle();
      await page.waitForTimeout(50);
      await assertStateVisuals('PENDING');

      // FAILED
      await tx.clickToggle();
      await page.waitForTimeout(50);
      await assertStateVisuals('FAILED');
    });
  });

  test.describe('CopyTransactionID interaction and edge cases', () => {
    test('Copy button shows feedback (Copied! or Failed) and reverts to original label', async ({ page }) => {
      const tx = new TransactionPage(page);
      await tx.goto();

      // Ensure visible tx id text exists in page
      const visibleTxId = await tx.getVisibleTxIdText();
      expect(visibleTxId).toBeTruthy();
      expect(visibleTxId).toContain('TX-9845B8273');

      // Click copy - it will attempt navigator.clipboard.writeText(txIDText)
      await tx.clickCopy();

      // After clicking, the button text should change to 'Copied!' on success or 'Failed' on error
      // We will accept either and then assert it reverts to 'Copy TX ID' after the timeout
      const feedback = await Promise.any([
        (async () => {
          await page.waitForFunction(
            (selector) => document.querySelector(selector) && document.querySelector(selector).innerText.trim() === 'Copied!',
            tx.selectors.btnCopy,
            { timeout: 1200 }
          );
          return 'Copied!';
        })(),
        (async () => {
          await page.waitForFunction(
            (selector) => document.querySelector(selector) && document.querySelector(selector).innerText.trim() === 'Failed',
            tx.selectors.btnCopy,
            { timeout: 1200 }
          );
          return 'Failed';
        })(),
      ]).catch(() => {
        // If neither text change observed quickly, read current text as fallback
        return tx.getCopyButtonText();
      });

      expect(['Copied!', 'Failed', 'Copy TX ID']).toContain(feedback);

      // Wait for the revert timeout which is 1600ms in the implementation; allow some buffer
      await page.waitForTimeout(1700);
      const finalText = await tx.getCopyButtonText();
      expect(finalText).toBe('Copy TX ID');

      // No uncaught page errors should arise from clipboard attempts (they are handled inside try/catch)
      expect(pageErrors.length).toBe(0);
    });

    test('Copy action does not mutate transaction ID element(s) in the DOM', async ({ page }) => {
      const tx = new TransactionPage(page);
      await tx.goto();

      const before = await tx.getVisibleTxIdText();

      await tx.clickCopy();
      await page.waitForTimeout(50); // minor delay for DOM side effects (button label change)

      const after = await tx.getVisibleTxIdText();
      expect(after).toBe(before); // The copy should not alter the displayed TX id
    });
  });

  test.describe('Accessibility and focus behavior', () => {
    test('Status element and flow steps are focusable and have sensible attributes', async ({ page }) => {
      const tx = new TransactionPage(page);
      await tx.goto();

      // Focus the status element via keyboard tabbing sequence.
      // We'll press Tab until our status element is focused (with a safety limit).
      const maxTabs = 12;
      let focused = false;
      for (let i = 0; i < maxTabs; i++) {
        await page.keyboard.press('Tab');
        const active = await page.evaluate(() => document.activeElement?.className || '');
        if (typeof active === 'string' && active.includes('status')) {
          focused = true;
          break;
        }
      }
      expect(focused).toBeTruthy();

      // Ensure flow diagram steps have tabindex and are reachable
      const stepCount = await page.locator('.flow-diagram .step').count();
      expect(stepCount).toBeGreaterThanOrEqual(4);
      for (let i = 0; i < stepCount; i++) {
        const step = page.locator('.flow-diagram .step').nth(i);
        const tabIndex = await step.getAttribute('tabindex');
        expect(tabIndex).toBeTruthy(); // should be "0"
      }
    });
  });

  test.describe('Runtime diagnostics: console & page errors are observed', () => {
    test('Collects console.error and pageerror events and asserts none are fatal', async ({ page }) => {
      const tx = new TransactionPage(page);
      await tx.goto();

      // Perform interactions that may expose runtime issues
      // Toggle multiple times and click copy to exercise code paths
      await tx.clickToggle();
      await tx.clickToggle();
      await tx.clickToggle();
      await tx.clickCopy();

      // Allow short time for any errors to surface
      await page.waitForTimeout(300);

      // Log captured console errors and page errors into test output (useful for debugging)
      if (consoleErrors.length) {
        console.log('Captured console.error messages:');
        for (const err of consoleErrors) {
          console.log(err.text);
        }
      }
      if (pageErrors.length) {
        console.log('Captured page errors:');
        for (const err of pageErrors) {
          console.log(err && err.message ? err.message : String(err));
        }
      }

      // Assert that no unhandled runtime exceptions (ReferenceError, TypeError, SyntaxError) occurred.
      // If any such errors exist, fail with details for debugging.
      const problematic = pageErrors.filter((err) => {
        const msg = err && err.message ? err.message : String(err);
        return /ReferenceError|TypeError|SyntaxError/.test(msg);
      });
      expect(problematic.length).toBe(0);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // If any unexpected runtime errors were captured, attach them to the test report for visibility.
    if (pageErrors && pageErrors.length > 0) {
      for (let i = 0; i < pageErrors.length; i++) {
        testInfo.attach(`pageerror-${i}`, {
          body: String(pageErrors[i].stack || pageErrors[i].message || pageErrors[i]),
          contentType: 'text/plain',
        });
      }
    }
    if (consoleErrors && consoleErrors.length > 0) {
      for (let i = 0; i < consoleErrors.length; i++) {
        testInfo.attach(`console-error-${i}`, {
          body: consoleErrors[i].text,
          contentType: 'text/plain',
        });
      }
    }
  });
});