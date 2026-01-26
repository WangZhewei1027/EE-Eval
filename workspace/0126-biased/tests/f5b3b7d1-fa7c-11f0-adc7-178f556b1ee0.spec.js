import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b3b7d1-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Page Object for the Static Typing demo page.
 * Encapsulates interactions and collects console messages and page errors for assertions.
 */
class StaticTypingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages and page errors for later inspection.
    this.page.on('console', (msg) => {
      // Normalize text capture
      try {
        this.consoleMessages.push({ text: msg.text(), type: msg.type() });
      } catch (e) {
        // If a console message reading throws for some reason, capture a fallback.
        this.consoleMessages.push({ text: '<unreadable console message>', type: msg.type() });
      }
    });

    this.page.on('pageerror', (error) => {
      this.pageErrors.push(error);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for content to be visible that indicates the page rendered.
    await this.page.waitForSelector('h1', { state: 'visible' });
  }

  async getHeadingText() {
    return this.page.textContent('h1');
  }

  async hasDynamicButton() {
    return await this.page.$('#dynamic-variables') !== null;
  }

  async clickDynamicVariables() {
    // Click the button that should trigger console.log("The value of x is: " + x);
    await this.page.click('#dynamic-variables');
  }

  getConsoleMessages() {
    return this.consoleMessages.slice();
  }

  getPageErrors() {
    return this.pageErrors.slice();
  }

  /**
   * Wait for a console message containing the provided substring.
   * Resolves to the console message object from Playwright.
   */
  async waitForConsoleText(substring, opts = { timeout: 2000 }) {
    return this.page.waitForEvent('console', {
      predicate: (msg) => {
        try {
          return msg.text().includes(substring);
        } catch {
          return false;
        }
      },
      ...opts,
    });
  }
}

describe('Static Typing FSM - f5b3b7d1-fa7c-11f0-adc7-178f556b1ee0', () => {
  // Shared page object for each test.
  let pageObj;

  test.beforeEach(async ({ page }) => {
    pageObj = new StaticTypingPage(page);
    await pageObj.goto();
  });

  test.afterEach(async ({ page }) => {
    // Basic teardown: ensure no lingering navigation/state affects following tests.
    try {
      await page.close();
    } catch {
      // ignore
    }
  });

  test.describe('State S0_Idle (Initial Render)', () => {
    test('renders the page and exposes the "Try Dynamic Variables" button (S0 entry action: renderPage)', async () => {
      // This test validates the entry action for S0 (renderPage()) by checking visible content.
      const heading = await pageObj.getHeadingText();
      expect(heading).toContain('Static Typing');

      // The FSM evidence includes the dynamic variables button - assert it exists.
      const hasButton = await pageObj.hasDynamicButton();
      expect(hasButton).toBe(true);

      // No runtime page errors should be present immediately after load.
      const pageErrors = pageObj.getPageErrors();
      expect(pageErrors.length).toBe(0);

      // No console messages should have been emitted on initial load in this demo.
      const consoleMessages = pageObj.getConsoleMessages();
      // It's acceptable if other messages exist in the environment, but assert that the specific FSM log hasn't happened yet.
      const fsmLogExists = consoleMessages.some((m) => m.text.includes('The value of x is:'));
      expect(fsmLogExists).toBe(false);
    });
  });

  test.describe('Event: ClickDynamicVariables and Transition S0 -> S1', () => {
    test('clicking the "Try Dynamic Variables" button emits the expected console.log and transitions state (S1_Variables_Tried)', async () => {
      // This test validates the transition triggered by clicking the button.
      // Prepare to wait for the exact console output the FSM references.
      const waitFor = pageObj.waitForConsoleText('The value of x is: 5');

      // Perform the user action described by the FSM.
      await pageObj.clickDynamicVariables();

      // Wait for the expected console message to be emitted.
      const consoleEvent = await waitFor;
      expect(consoleEvent).toBeDefined();
      expect(consoleEvent.text()).toContain('The value of x is: 5');

      // After the click, assert that the collected console messages include the expected log.
      const consoleMessages = pageObj.getConsoleMessages();
      const found = consoleMessages.find((m) => m.text.includes('The value of x is: 5'));
      expect(found).toBeTruthy();

      // Verify that no page errors were produced as a result of the click.
      const pageErrors = pageObj.getPageErrors();
      expect(pageErrors.length).toBe(0);
    });

    test('clicking the button multiple times produces multiple console logs (robustness)', async () => {
      // Edge case: user clicks repeatedly; each click should produce another console log.
      const clicks = 3;
      const waiters = [];

      // For each click, prepare a waiter for the console event to ensure we capture them in order.
      for (let i = 0; i < clicks; i++) {
        waiters.push(pageObj.waitForConsoleText('The value of x is: 5'));
      }

      // Fire clicks sequentially but without awaiting between them to simulate quick user interaction.
      for (let i = 0; i < clicks; i++) {
        await pageObj.clickDynamicVariables();
      }

      // Await all expected console messages.
      const events = await Promise.all(waiters);
      expect(events.length).toBe(clicks);

      // Confirm the console message text is correct for each event.
      for (const ev of events) {
        expect(ev.text()).toContain('The value of x is: 5');
      }

      // Ensure recorded consoleMessages array includes at least `clicks` occurrences.
      const recorded = pageObj.getConsoleMessages().filter((m) => m.text.includes('The value of x is: 5'));
      expect(recorded.length).toBeGreaterThanOrEqual(clicks);
    });
  });

  test.describe('Error & Edge Cases', () => {
    test('attempting to click a non-existent selector throws an error (Playwright-level error scenario)', async () => {
      // This test intentionally attempts an invalid interaction to validate error handling scenarios.
      // We do not modify the page; we simply attempt an impossible click and assert Playwright throws.
      // Expect the click to reject with an error (no global page changes).
      await expect(async () => {
        await pageObj.page.click('#non-existent', { timeout: 500 });
      }).rejects.toThrow();
    });

    test('no unexpected runtime errors (pageerror) occur during normal usage', async () => {
      // Click the button once and ensure there are no uncaught exceptions recorded as page errors.
      await pageObj.clickDynamicVariables();

      // Wait briefly to allow any potential asynchronous errors to surface.
      await pageObj.waitForConsoleText('The value of x is: 5', { timeout: 2000 }).catch(() => {
        // If the console message didn't appear, we still want to assert page errors; continue.
      });

      const pageErrors = pageObj.getPageErrors();
      // In this demo implementation there should be no runtime errors.
      expect(pageErrors.length).toBe(0);
    });

    test('reload the page and ensure the initial state is restored (idempotence of render)', async () => {
      // Reload and check that the initial content and button are present again (S0_Idle).
      await pageObj.page.reload();
      await pageObj.page.waitForSelector('h1', { state: 'visible' });

      const heading = await pageObj.getHeadingText();
      expect(heading).toContain('Static Typing');

      const hasButton = await pageObj.hasDynamicButton();
      expect(hasButton).toBe(true);

      // After reload, previous captured console messages should be cleared in a real new context,
      // but our Page Object keeps prior messages — ensure we can still observe new logs after click.
      await pageObj.clickDynamicVariables();
      const ev = await pageObj.waitForConsoleText('The value of x is: 5', { timeout: 2000 });
      expect(ev).toBeDefined();
    });
  });
});