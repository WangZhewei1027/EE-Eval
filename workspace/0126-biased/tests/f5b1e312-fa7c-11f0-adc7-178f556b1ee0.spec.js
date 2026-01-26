import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b1e312-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the Big-Omega page
class BigOmegaPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.calculateButton = page.locator('button[onclick="calculateBigOmega()"]');
    this.resultLocator = page.locator('#big-omega');
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async isCalculateButtonVisible() {
    return await this.calculateButton.isVisible();
  }

  async getCalculateButtonText() {
    return await this.calculateButton.textContent();
  }

  async clickCalculate() {
    await this.calculateButton.click();
  }

  async hasResultElement() {
    return (await this.resultLocator.count()) > 0;
  }

  async getResultText() {
    if (await this.hasResultElement()) {
      return await this.resultLocator.textContent();
    }
    return null;
  }
}

test.describe('Big-Omega Interactive Application (FSM Validation)', () => {
  // Collect page errors and console messages for assertions
  let errors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    errors = [];
    consoleMessages = [];

    // Capture runtime page errors (e.g., ReferenceError, TypeError)
    page.on('pageerror', (err) => {
      // err is an Error object
      errors.push(err);
    });

    // Capture console messages for additional evidence
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  });

  test.describe('S0_Idle state checks (initial rendering and expected elements)', () => {
    test('S0_Idle: Page loads and shows Calculate button; no result element present', async ({ page }) => {
      // This test validates the Idle state (S0_Idle) entry render:
      // - The page should load
      // - The Calculate button described in the FSM should exist and be visible
      // - There should be no element with id "big-omega" before interaction
      // - No runtime page errors should have occurred on initial load

      const bigOmega = new BigOmegaPage(page);
      await bigOmega.goto();

      // Button exists and visible
      await expect(bigOmega.calculateButton).toBeVisible();
      const btnText = await bigOmega.getCalculateButtonText();
      // Confirm the button text roughly matches expected text from FSM
      expect(btnText).toContain('Calculate Big-Omega');

      // There is no result element before clicking (implementation doesn't include it)
      const hasResult = await bigOmega.hasResultElement();
      expect(hasResult).toBe(false);

      // No runtime errors should have occurred just from rendering the page
      expect(errors.length).toBe(0);

      // No console.error messages initially
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });
  });

  test.describe('CalculateBigOmega event and S1_Calculated transition', () => {
    test('Transition: Clicking the button triggers calculateBigOmega() and causes a runtime error due to missing #big-omega element', async ({ page }) => {
      // This test validates the transition from S0_Idle -> S1_Calculated:
      // - Clicking the button triggers calculateBigOmega()
      // - The function attempts to write to document.getElementById("big-omega").innerHTML
      // - Because #big-omega does not exist in the DOM, a TypeError/pageerror is expected
      // - We assert that a page error occurs and that the error message references innerHTML or big-omega

      const bigOmega = new BigOmegaPage(page);
      await bigOmega.goto();

      // Sanity: no result element present before clicking
      expect(await bigOmega.hasResultElement()).toBe(false);

      // Click the calculate button
      const clickPromise = bigOmega.clickCalculate();

      // Wait for the click to be processed
      await clickPromise;

      // Wait up to a short timeout for a page error to appear
      // We poll the errors array
      const waitForError = async (timeout = 2000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          if (errors.length > 0) return errors;
          await new Promise(r => setTimeout(r, 50));
        }
        return errors;
      };

      const captured = await waitForError(2000);

      // The application implementation attempts to set innerHTML on a non-existent element,
      // so we expect at least one runtime error (TypeError or similar).
      expect(captured.length).toBeGreaterThan(0);

      // Check error message content for expected clues (innerHTML / big-omega / Cannot set)
      const messages = captured.map(e => (e && e.message) || String(e));
      const joined = messages.join(' | ');
      // The exact message can differ across engines, so accept a set of substrings
      const expectedSubstrings = ['innerHTML', 'big-omega', 'Cannot set', 'null', 'cannot set'];
      const matches = expectedSubstrings.some(sub => joined.toLowerCase().includes(sub.toLowerCase()));
      expect(matches).toBeTruthy();

      // Verify that the result element still does not exist (since code errored before creating or updating it)
      expect(await bigOmega.hasResultElement()).toBe(false);

      // FSM expected observable: "Big-Omega Notation: O(n) (T(n) = 10)" will not actually be present due to the error.
      const resultText = await bigOmega.getResultText();
      expect(resultText).toBeNull();
    });

    test('Edge case: Multiple clicks produce repeated runtime errors (each invocation triggers the same failure)', async ({ page }) => {
      // This test validates repeated event invocations:
      // - Clicking the button multiple times should cause the calculateBigOmega function to run each time
      // - Each run will attempt the same DOM update and therefore generate errors repeatedly

      const bigOmega = new BigOmegaPage(page);
      await bigOmega.goto();

      // Reset any previously collected errors/console messages
      // (they're isolated per test by beforeEach, but ensure arrays are empty)
      // click once
      await bigOmega.clickCalculate();

      // Wait for first error
      await new Promise(r => setTimeout(r, 200));
      expect(errors.length).toBeGreaterThanOrEqual(1);

      // Capture count after first click
      const firstCount = errors.length;

      // Click again
      await bigOmega.clickCalculate();
      // Give time for second error to occur
      await new Promise(r => setTimeout(r, 200));

      // After second click, error count should increase (or at least not be less)
      expect(errors.length).toBeGreaterThanOrEqual(firstCount);

      // There should still be no visible result element
      expect(await bigOmega.hasResultElement()).toBe(false);
    });
  });

  test.describe('FSM entry/exit action observations and error scenarios', () => {
    test('Entry action for S1_Calculated (displayResult) leads to runtime failure and should be observable as a page error', async ({ page }) => {
      // The FSM specifies that on entering S1_Calculated, displayResult() runs.
      // The implementation places the result-setting logic directly in calculateBigOmega(),
      // which is therefore effectively the S1 entry action. This test confirms that invoking
      // that transition (by clicking) produces the pageerror that represents a failed entry action.

      const bigOmega = new BigOmegaPage(page);
      await bigOmega.goto();

      // Click to trigger transition and entry action
      await bigOmega.clickCalculate();

      // Wait for the error to be captured
      const waitForError = async (timeout = 2000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          if (errors.length > 0) return errors;
          await new Promise(r => setTimeout(r, 50));
        }
        return errors;
      };

      const capturedErrors = await waitForError(2000);
      expect(capturedErrors.length).toBeGreaterThan(0);

      // Validate that the error is the direct result of trying to update innerHTML of a missing element
      const msg = capturedErrors[0].message || String(capturedErrors[0]);
      expect(msg.toLowerCase()).toMatch(/innerhtml|big-omega|cannot set|null/);
    });

    test('DOM integrity: content outside the result area stays intact despite the runtime error', async ({ page }) => {
      // Even though the calculation results in an error, the rest of the page should still be present.
      // This verifies that the error is localized and doesn't crash the entire page rendering.

      const bigOmega = new BigOmegaPage(page);
      await bigOmega.goto();

      // Ensure main header and explanatory text exist
      const header = page.locator('h1');
      await expect(header).toHaveText(/Big-Omega Notation/);

      const paragraph = page.locator('p').first();
      await expect(paragraph).toBeVisible();

      // Trigger the error
      await bigOmega.clickCalculate();

      // Allow error to appear
      await new Promise(r => setTimeout(r, 200));
      expect(errors.length).toBeGreaterThan(0);

      // The header and main text should still be present and unchanged
      await expect(header).toHaveText(/Big-Omega Notation/);
      await expect(paragraph).toBeVisible();
    });
  });

  test.describe('Observability: console logging and error evidence', () => {
    test('No explicit console logs are expected; runtime error should appear as pageerror rather than console.log', async ({ page }) => {
      // The implementation does not console.log success messages; errors occur as page errors.
      const bigOmega = new BigOmegaPage(page);
      await bigOmega.goto();

      // Ensure no console messages of type 'warning' or 'error' initially
      const initialErrors = consoleMessages.filter(m => m.type === 'error');
      expect(initialErrors.length).toBe(0);

      // Trigger the runtime error
      await bigOmega.clickCalculate();
      await new Promise(r => setTimeout(r, 200));

      // There may or may not be console.error entries depending on environment;
      // the primary observable is pageerror in the errors array.
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});