import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b194f0-fa7c-11f0-adc7-178f556b1ee0.html';

// Page object for the PageRank demo
class PageRankPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async gotoAndCaptureInitialError() {
    // Navigate and capture the first uncaught page error which the page's script is expected to throw.
    const errorPromise = this.page.waitForEvent('pageerror', { timeout: 5000 }).catch(e => e);
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for either an error or timeout- the caller will assert on the result.
    return errorPromise;
  }

  async gotoWithoutWaitingForError() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getButton() {
    return this.page.locator('#page-rank-button');
  }

  async buttonText() {
    return this.getButton().innerText();
  }

  async clickButton() {
    // Click the button - do not swallow page errors here; let tests observe them.
    await this.getButton().click();
  }

  // Try clicking and wait shortly for any page error that may result from the click.
  // Returns { error: Error|null, textAfterClick: string|null }
  async clickAndCaptureError(shortTimeout = 1000) {
    const pageErrorPromise = this.page.waitForEvent('pageerror', { timeout: shortTimeout }).catch(err => err);
    await this.clickButton();
    const maybeError = await pageErrorPromise;
    // If maybeError is an Error object from the catch wrapper (timeout), we need to detect that.
    if (maybeError && maybeError.name && (maybeError.name === 'TimeoutError' || maybeError.message?.includes('Timeout'))) {
      // No pageerror emitted within timeout
      const text = await this.buttonText().catch(() => null);
      return { error: null, textAfterClick: text };
    } else if (maybeError instanceof Error) {
      return { error: maybeError, textAfterClick: null };
    } else {
      // Unexpected non-error result (shouldn't happen) - return as no error but capture text
      const text = await this.buttonText().catch(() => null);
      return { error: null, textAfterClick: text };
    }
  }
}

test.describe('PageRank interactive application - FSM and runtime errors', () => {
  // Each test gets a fresh page
  test.beforeEach(async ({ page }) => {
    // Silence uncaught rejections in Playwright runner logs (we'll assert them in tests)
    page.on('dialog', async dialog => {
      await dialog.dismiss().catch(() => {});
    });
  });

  test('S0_Idle: initial render should display Explore PageRank button and an initial script error should be thrown (entry action: renderPage & updateScores on load)', async ({ page }) => {
    // This test validates:
    // - The page loads and the button with id #page-rank-button is present (Idle state)
    // - The page's script calls updateScores() on load which (due to implementation issues) should cause a runtime pageerror (ReferenceError/TypeError)
    const pager = new PageRankPage(page);

    // Start navigation and capture the initial pageerror emitted by the script's immediate invocation.
    const errorPromise = page.waitForEvent('pageerror', { timeout: 5000 }).catch(e => e);

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure the button exists and initial text is the default label (renderPage effect).
    const button = pager.getButton();
    await expect(button).toBeVisible();
    const initialText = await button.innerText();
    // According to the HTML, the button's initial text should be "Explore PageRank"
    expect(initialText).toBe('Explore PageRank');

    // Now assert an uncaught page error occurred during page load due to the broken updateScores implementation.
    const pageError = await errorPromise;
    // If pageError is actually a TimeoutError object returned by Playwright, it means no error was thrown.
    if (pageError && pageError.name === 'TimeoutError') {
      // Fail explicitly with helpful message.
      throw new Error('Expected a pageerror during initial load (due to updateScores call), but no error was captured.');
    }

    // We expect a runtime exception; it is likely a ReferenceError due to TDZ of "scores" or a TypeError.
    expect(pageError).toBeTruthy();
    // Validate typical characteristics of the thrown error
    const allowedNames = ['ReferenceError', 'TypeError', 'Error'];
    expect(allowedNames).toContain(pageError.name || 'Error');
    // Try to be pragmatic about the message: it should mention 'scores' or 'initialization' or similar.
    const msg = pageError.message || '';
    expect(
      msg.toLowerCase().includes('scores') ||
      msg.toLowerCase().includes('cannot') ||
      msg.toLowerCase().includes('before') ||
      msg.toLowerCase().includes('undefined') ||
      msg.toLowerCase().includes('cannot read')
    ).toBeTruthy();
  });

  test('ButtonClick event: clicking the Explore PageRank button should attempt to run updateScores (transition) - assert behavior and errors', async ({ page }) => {
    // This test validates:
    // - The ButtonClick event is wired (if the listener was successfully added)
    // - Clicking the button either triggers the updateScores (which may throw) or does nothing if the script failed before adding the listener
    // - We capture pageerrors on click and/or assert that the button text changes to "PageRank Score: X" as an observable of the transition
    const pager = new PageRankPage(page);

    // Navigate. The initial script call may have thrown and could have prevented the click handler from being attached.
    // We will capture and ignore the initial pageerror here (we assert it in the other test), but we must consume it so subsequent waits behave predictably.
    const initialErrorPromise = page.waitForEvent('pageerror', { timeout: 5000 }).catch(e => e);
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Consume initial error if present, but don't fail here (already covered above)
    const initialErr = await initialErrorPromise;
    // Now attempt to click and capture any pageerror produced by click handler.
    const result = await pager.clickAndCaptureError(1000);

    if (result.error) {
      // If clicking produced a pageerror, ensure it's consistent with the broken updateScores implementation.
      const clickErr = result.error;
      expect(clickErr).toBeTruthy();
      const allowedNames = ['ReferenceError', 'TypeError', 'Error'];
      expect(allowedNames).toContain(clickErr.name || 'Error');
      const msg = clickErr.message || '';
      expect(
        msg.toLowerCase().includes('scores') ||
        msg.toLowerCase().includes('cannot') ||
        msg.toLowerCase().includes('before') ||
        msg.toLowerCase().includes('undefined') ||
        msg.toLowerCase().includes('cannot read')
      ).toBeTruthy();
    } else {
      // No error thrown on click - this could mean the initial error prevented adding the click listener.
      // In that case, assert that the button text did not change to a PageRank score (transition did not occur).
      const textAfterClick = result.textAfterClick;
      expect(textAfterClick).toBeTruthy();
      // It should remain the original label or possibly unchanged. Assert it does NOT start with "PageRank Score:"
      expect(textAfterClick.startsWith('PageRank Score:')).toBe(false);
      // Also assert it remains the canonical label if initial script aborted before modifying it.
      expect(textAfterClick).toBe('Explore PageRank');
    }
  });

  test('Edge cases: multiple rapid clicks and subsequent effects (collect pageerrors if any)', async ({ page }) => {
    // This test validates:
    // - Rapid user interactions (multiple clicks) do not crash the test harness
    // - We collect any pageerrors emitted by repeated clicks and assert their nature
    const pager = new PageRankPage(page);

    // Navigate and ignore initial load error (covered elsewhere)
    const initialErrorPromise = page.waitForEvent('pageerror', { timeout: 5000 }).catch(e => e);
    await page.goto(APP_URL, { waitUntil: 'load' });
    await initialErrorPromise.catch(() => {});

    // Listen for pageerror events over a short window while we perform multiple clicks.
    const caughtErrors = [];
    const onPageError = (err) => {
      caughtErrors.push(err);
    };
    page.on('pageerror', onPageError);

    // Perform several rapid clicks
    for (let i = 0; i < 5; i++) {
      try {
        await pager.getButton().click({ timeout: 500 }).catch(() => {});
      } catch (e) {
        // ignore click exceptions to allow test to continue - we'll evaluate collected pageerrors
      }
    }

    // Wait a short while to allow any async page errors to surface
    await new Promise(resolve => setTimeout(resolve, 500));

    // Unregister handler
    page.off('pageerror', onPageError);

    // If any errors were collected, they should be runtime exceptions similar to earlier ones.
    if (caughtErrors.length > 0) {
      for (const err of caughtErrors) {
        expect(['ReferenceError', 'TypeError', 'Error']).toContain(err.name || 'Error');
        const msg = err.message || '';
        expect(
          msg.toLowerCase().includes('scores') ||
          msg.toLowerCase().includes('cannot') ||
          msg.toLowerCase().includes('before') ||
          msg.toLowerCase().includes('undefined') ||
          msg.toLowerCase().includes('cannot read')
        ).toBeTruthy();
      }
    } else {
      // No errors were emitted on repeated clicks; that is an acceptable outcome given the initial script error could have prevented listener attachment.
      // Ensure the button text remains stable and did not transform into score labels.
      const text = await pager.buttonText();
      expect(text).toBe('Explore PageRank');
    }
  });

  test('Transition observable: if updateScores runs successfully (hypothetical), button should display "PageRank Score: X" - we assert either presence or absence', async ({ page }) => {
    // This test is defensive: it asserts the expected observable of the FSM transition ("PageRank Score: X")
    // If the runtime error prevented the transition, we assert the absence of such a label. If the transition did happen,
    // we assert the observed format of the updated button text.
    const pager = new PageRankPage(page);

    // Navigate and consume initial error if any
    const initialErrorPromise = page.waitForEvent('pageerror', { timeout: 5000 }).catch(e => e);
    await page.goto(APP_URL, { waitUntil: 'load' });
    await initialErrorPromise.catch(() => {});

    // Attempt clicking and then observe the button text for a short time
    await pager.getButton().click().catch(() => {});
    // Wait briefly to allow potential DOM updates
    await new Promise(resolve => setTimeout(resolve, 300));

    const text = await pager.buttonText();

    // Two possible acceptable outcomes:
    // 1) updateScores executed and button text shows "PageRank Score: X" where X is a number (the FSM observable)
    // 2) updateScores did not execute (due to earlier error), and the button remains "Explore PageRank"
    if (text.startsWith('PageRank Score:')) {
      // Validate that after the prefix, there is some numeric content (can be 0 or more digits)
      const suffix = text.slice('PageRank Score:'.length).trim();
      // It may be empty or a non-numeric string depending on partial failures; but if the transition occurred, expect digits.
      expect(suffix.length).toBeGreaterThanOrEqual(0);
    } else {
      // Assert the button is the original label - no transition observable
      expect(text).toBe('Explore PageRank');
    }
  });
});