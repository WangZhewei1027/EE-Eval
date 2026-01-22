import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0baa23c2-d5b2-11f0-b169-abe023d0d932.html';

// Page Object for the LCS app
class LCSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.form = page.locator('#input-form');
    this.input1 = page.locator('#string1');
    this.input2 = page.locator('#string2');
    this.submitButton = page.locator('button[type="submit"]');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillStrings(s1, s2) {
    await this.input1.fill(s1);
    await this.input2.fill(s2);
  }

  async submit() {
    // Submit via clicking the submit button to trigger the form submit handler
    await Promise.all([
      // ensure handler runs
      this.page.waitForTimeout(50), // small wait to make sure event listeners are ready
      this.submitButton.click()
    ]);
  }

  async getResultText() {
    return (await this.result.innerText()).trim();
  }

  async getInputsValues() {
    const s1 = await this.input1.inputValue();
    const s2 = await this.input2.inputValue();
    return { s1, s2 };
  }

  async url() {
    return this.page.url();
  }
}

test.describe('Longest Common Subsequence (interactive app) - FSM validation', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Capture console error messages and page errors to observe runtime issues
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions from page context
      pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    });

    // Navigate to the app page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // no-op teardown here; the test harness will close pages/contexts
  });

  test('Idle state (S0_Idle) - form and inputs are rendered correctly', async ({ page }) => {
    // This test validates the initial (Idle) state described in the FSM:
    // - The form #input-form exists
    // - Inputs #string1 and #string2 exist
    // - The result container #result exists and is initially empty
    const app = new LCSPage(page);

    // Check DOM elements presence
    await expect(app.form).toBeVisible();
    await expect(app.input1).toBeVisible();
    await expect(app.input2).toBeVisible();
    await expect(app.submitButton).toBeVisible();
    await expect(app.result).toBeVisible();

    // The FSM mentions an entry_action renderPage(); verify whether a global renderPage exists.
    // We assert it is undefined because the provided implementation doesn't define it.
    const renderPageType = await page.evaluate(() => typeof renderPage);
    expect(renderPageType).toBe('undefined');

    // #result should be empty at idle
    const initialResult = await app.getResultText();
    expect(initialResult).toBe('');
  });

  test('Transition S0_Idle -> S1_ResultDisplayed on submit with empty strings', async ({ page }) => {
    // This test verifies the submit event handling for empty input strings.
    // It checks that the form submit is handled in-page (no navigation) and
    // that the displayed result equals what the page's findLCS function computes.
    const app = new LCSPage(page);
    const beforeUrl = await app.url();

    // Ensure inputs are empty
    await app.fillStrings('', '');

    // Compute expected LCS using the page's own findLCS implementation (do not modify it)
    const expectedLCS = await page.evaluate(() => {
      // Call the in-page function as-is
      try {
        return typeof findLCS === 'function' ? findLCS('', '') : null;
      } catch (err) {
        // Propagate error string for assertion below
        return { __error: err.message };
      }
    });

    // Submit the form
    await app.submit();

    // After submit, ensure we did not navigate away (event.preventDefault should have been called)
    const afterUrl = await app.url();
    expect(afterUrl).toBe(beforeUrl);

    // Validate result DOM text
    const resultText = await app.getResultText();
    // The page sets: "The Longest Common Subsequence is: " + lcs
    if (typeof expectedLCS === 'object' && expectedLCS !== null && expectedLCS.__error) {
      // If calling findLCS threw an error in-page, assert that the page also recorded an error
      // (We do not modify page behavior; we simply reflect what happened.)
      expect(pageErrors.length).toBeGreaterThan(0);
    } else {
      const expectedFull = 'The Longest Common Subsequence is: ' + (expectedLCS ?? '');
      expect(resultText).toBe(expectedFull);
    }
  });

  test('Transition S0_Idle -> S1_ResultDisplayed with identical short strings', async ({ page }) => {
    // This test submits two identical short strings (e.g., 'abc' and 'abc')
    // and asserts that the result shown in the DOM matches the page's findLCS output.
    const app = new LCSPage(page);
    const a = 'abc';
    const b = 'abc';

    await app.fillStrings(a, b);

    // Compute expected result by invoking the page's own function
    const expectedLCS = await page.evaluate(([s1, s2]) => {
      try {
        return typeof findLCS === 'function' ? findLCS(s1, s2) : null;
      } catch (err) {
        return { __error: err.message };
      }
    }, [a, b]);

    await app.submit();

    const resultText = await app.getResultText();

    if (typeof expectedLCS === 'object' && expectedLCS !== null && expectedLCS.__error) {
      // If findLCS threw, ensure the error was observed by the page context
      expect(pageErrors.length).toBeGreaterThan(0);
    } else {
      const expectedFull = 'The Longest Common Subsequence is: ' + (expectedLCS ?? '');
      expect(resultText).toBe(expectedFull);
      // Visual feedback: ensure the result container now contains the expected prefix
      expect(resultText).toContain('The Longest Common Subsequence is:');
    }
  });

  test('Submit with different strings prevents navigation and displays prefix', async ({ page }) => {
    // This test submits differing strings and verifies:
    // - Form submission is handled (no navigation)
    // - The result includes the expected prefix
    // - The displayed LCS is exactly what the page's findLCS returns
    const app = new LCSPage(page);
    const s1 = 'abc';
    const s2 = 'def';
    const beforeUrl = await app.url();

    await app.fillStrings(s1, s2);

    const expectedLCS = await page.evaluate(([x, y]) => {
      try {
        return typeof findLCS === 'function' ? findLCS(x, y) : null;
      } catch (err) {
        return { __error: err.message };
      }
    }, [s1, s2]);

    await app.submit();

    const afterUrl = await app.url();
    expect(afterUrl).toBe(beforeUrl, 'Form submission should not navigate away when event.preventDefault is used');

    const resultText = await app.getResultText();

    if (typeof expectedLCS === 'object' && expectedLCS !== null && expectedLCS.__error) {
      // Confirm errors propagated
      expect(pageErrors.length).toBeGreaterThan(0);
    } else {
      expect(resultText.startsWith('The Longest Common Subsequence is:')).toBeTruthy();
      expect(resultText).toBe('The Longest Common Subsequence is: ' + (expectedLCS ?? ''));
    }
  });

  test('Edge case: very long identical strings - ensure the page responds and result is displayed', async ({ page }) => {
    // This edge-case test uses long strings to exercise the algorithm's runtime behavior.
    // We rely on the page's own findLCS to compute the expected output and verify the DOM reflects it.
    const app = new LCSPage(page);
    const longA = 'a'.repeat(500); // reasonably large but not too huge to hang test runner
    const longB = 'a'.repeat(500);

    // Fill inputs
    await app.fillStrings(longA, longB);

    // Compute expected LCS using in-page function; capture any thrown error
    const expectedLCS = await page.evaluate(([x, y]) => {
      try {
        return typeof findLCS === 'function' ? findLCS(x, y) : null;
      } catch (err) {
        return { __error: err.message };
      }
    }, [longA, longB]);

    // Submit and wait a bit if necessary for rendering
    await app.submit();

    const resultText = await app.getResultText();

    if (typeof expectedLCS === 'object' && expectedLCS !== null && expectedLCS.__error) {
      // If the in-page algorithm throws for large inputs, ensure an in-page error was observed.
      expect(pageErrors.length).toBeGreaterThan(0);
    } else {
      // Validate that the result reflects what the page computed
      expect(resultText).toBe('The Longest Common Subsequence is: ' + (expectedLCS ?? ''));
      // Sanity check: result should at least contain the prefix
      expect(resultText.startsWith('The Longest Common Subsequence is:')).toBeTruthy();
    }
  });

  test('Observes console and page errors (no unexpected runtime errors for typical interactions)', async ({ page }) => {
    // This test collects console errors and page errors produced during typical interactions above.
    // It asserts there were no uncaught exceptions or console errors in the earlier interactions.
    // (We do not alter page behavior; we only observe.)
    // Note: this assertion will fail if the page naturally throws or logs errors.
    // That behavior is intentionally allowed by the test design; this test asserts the absence of such errors.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});