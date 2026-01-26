import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9a4c90-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page object for DNS explanation page.
 * Encapsulates locators and common interactions.
 */
class DNSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.btn = page.locator('#btnExplain');
    this.info = page.locator('#infoText');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickToggle() {
    await this.btn.click();
  }

  async getButtonText() {
    return (await this.btn.textContent())?.trim();
  }

  async getButtonAriaPressed() {
    return await this.btn.getAttribute('aria-pressed');
  }

  async infoHasHiddenClass() {
    const cls = await this.info.getAttribute('class');
    return cls ? cls.split(/\s+/).includes('hidden') : false;
  }

  async getInfoInnerHTML() {
    const html = await this.info.evaluate((el) => el.innerHTML);
    return html;
  }
}

test.describe('DNS - Explanation Toggle FSM tests (3c9a4c90-fa78-11f0-857d-d58e82d5de73)', () => {
  // Arrays to record runtime console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages and page errors without altering page globals
    page.on('console', (msg) => {
      // Capture type and text for debugging/assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      // Capture thrown errors (uncaught exceptions)
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // detach listeners by closing the page to avoid leaking handlers across tests
    // (Playwright test runner will close pages by default, but we ensure no extra actions)
    try {
      await page.close();
    } catch (e) {
      // ignore errors on close
    }
  });

  test('Initial state (S0_Idle): page renders and shows Idle state controls', async ({ page }) => {
    // Validate initial renderPage() entry effect by loading page and checking DOM
    const dns = new DNSPage(page);
    await dns.goto();

    // Ensure components are present
    await expect(dns.btn).toBeVisible();
    await expect(dns.info).toBeVisible(); // info-text element is present but may be visually hidden via class

    // Button should be in Idle state: aria-pressed="false" and text "Show Explanation"
    const btnText = await dns.getButtonText();
    expect(btnText).toBe('Show Explanation');

    const ariaPressed = await dns.getButtonAriaPressed();
    expect(ariaPressed).toBe('false');

    // infoText should be hidden and empty per FSM evidence for S0_Idle
    const hasHiddenClass = await dns.infoHasHiddenClass();
    expect(hasHiddenClass).toBe(true);

    const infoHTML = await dns.getInfoInnerHTML();
    // Expect empty string (exact) per FSM expected behavior for Idle
    expect(infoHTML).toBe('');

    // Observe console and page errors; the app should not emit runtime errors on load.
    // We assert that no uncaught page errors occurred during load.
    expect(pageErrors.length).toBe(0);

    // No console messages of type 'error' should be emitted on initial load.
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0 -> S1 (ToggleExplanation): clicking button shows explanation', async ({ page }) => {
    // This test validates the transition from Idle to Explanation Visible
    const dns = new DNSPage(page);
    await dns.goto();

    // Click the toggle button to show explanation
    await dns.clickToggle();

    // After click: button aria-pressed should be 'true' and text 'Hide Explanation'
    const ariaPressedAfter = await dns.getButtonAriaPressed();
    expect(ariaPressedAfter).toBe('true');

    const btnTextAfter = await dns.getButtonText();
    expect(btnTextAfter).toBe('Hide Explanation');

    // infoText should have the 'hidden' class removed and innerHTML populated with explanation
    const hasHiddenAfter = await dns.infoHasHiddenClass();
    expect(hasHiddenAfter).toBe(false);

    const infoHTMLAfter = await dns.getInfoInnerHTML();
    // The innerHTML is a multiline template; we assert on meaningful substrings to avoid whitespace fragility.
    expect(infoHTMLAfter).toContain('How DNS Works');
    expect(infoHTMLAfter).toContain('Local Resolver');
    expect(infoHTMLAfter.trim().length).toBeGreaterThan(0);

    // Ensure no uncaught page errors happened during the transition
    expect(pageErrors.length).toBe(0);

    // Also ensure there were no 'error' console messages during the interaction
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1 -> S0 (ToggleExplanation): clicking again hides explanation', async ({ page }) => {
    // Validate the transition from Explanation Visible back to Idle
    const dns = new DNSPage(page);
    await dns.goto();

    // Show explanation first
    await dns.clickToggle();

    // Confirm it's shown
    expect(await dns.getButtonAriaPressed()).toBe('true');
    expect(await dns.getButtonText()).toBe('Hide Explanation');
    expect(await dns.infoHasHiddenClass()).toBe(false);
    expect((await dns.getInfoInnerHTML()).length).toBeGreaterThan(0);

    // Click again to hide
    await dns.clickToggle();

    // After second click: button returns to aria-pressed="false" and text "Show Explanation"
    const ariaPressedFinal = await dns.getButtonAriaPressed();
    expect(ariaPressedFinal).toBe('false');

    const btnTextFinal = await dns.getButtonText();
    expect(btnTextFinal).toBe('Show Explanation');

    // infoText should be hidden again and cleared
    const hasHiddenFinal = await dns.infoHasHiddenClass();
    expect(hasHiddenFinal).toBe(true);

    const infoHTMLFinal = await dns.getInfoInnerHTML();
    expect(infoHTMLFinal).toBe('');

    // Ensure no runtime page errors occurred during the hide transition
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: rapid toggles should not throw and final state must be consistent', async ({ page }) => {
    // Simulate rapid user clicks to ensure stability
    const dns = new DNSPage(page);
    await dns.goto();

    // Perform 5 rapid toggles
    const clicks = 5;
    for (let i = 0; i < clicks; i++) {
      // Using click without waiting between clicks to simulate rapid interaction
      // This mirrors a user double/triple-clicking the control
      await dns.btn.click();
    }

    // After odd number (5) of clicks, the expected state is Explanation Visible (S1)
    const expectedAria = clicks % 2 === 1 ? 'true' : 'false';
    const expectedText = clicks % 2 === 1 ? 'Hide Explanation' : 'Show Explanation';
    const expectedHidden = !(clicks % 2 === 1);

    expect(await dns.getButtonAriaPressed()).toBe(expectedAria);
    expect(await dns.getButtonText()).toBe(expectedText);
    expect(await dns.infoHasHiddenClass()).toBe(expectedHidden ? true : false);

    // If visible, ensure content present; if hidden, ensure cleared
    const infoHTML = await dns.getInfoInnerHTML();
    if (expectedHidden) {
      expect(infoHTML).toBe('');
    } else {
      expect(infoHTML).toContain('How DNS Works');
    }

    // No uncaught errors should have occurred during rapid interaction
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Robustness: verify DOM attributes and accessibility cues for both states', async ({ page }) => {
    // Verify button's aria-label exists and infoText has aria-live and other attributes (FSM components)
    const dns = new DNSPage(page);
    await dns.goto();

    // Button should have the aria-label as described in the component definition
    const ariaLabel = await dns.btn.getAttribute('aria-label');
    expect(ariaLabel).toBe('Toggle explanation text');

    // infoText should include aria-live, aria-atomic and aria-relevant attributes
    expect(await dns.info.getAttribute('aria-live')).toBe('polite');
    expect(await dns.info.getAttribute('aria-atomic')).toBe('true');
    expect(await dns.info.getAttribute('aria-relevant')).toBe('additions removals');

    // Toggle to show and re-check attributes remain consistent and content populated
    await dns.clickToggle();
    expect(await dns.getButtonAriaPressed()).toBe('true');
    expect(await dns.info.getAttribute('aria-live')).toBe('polite');

    // Ensure no DOM attribute mutation aside from the intended aria-pressed and textContent changes
    // (We check that aria-label is unchanged)
    expect(await dns.btn.getAttribute('aria-label')).toBe('Toggle explanation text');

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });
});