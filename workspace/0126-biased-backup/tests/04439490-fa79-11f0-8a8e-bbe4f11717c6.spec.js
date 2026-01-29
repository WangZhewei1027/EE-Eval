import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04439490-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object Model for the Context Switching page
class ContextSwitchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = 'button.button';
    this.firstButtonSelector = 'div.button-container > button.button:nth-of-type(1)';
    this.secondButtonSelector = 'div.button-container > button.button:nth-of-type(2)';
    this.containerSelector = '.container';
    this.headerSelector = '.header h1';
    this.descriptionSelector = '.header p';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtons() {
    return this.page.$$(this.buttonSelector);
  }

  async getButtonTexts() {
    const buttons = await this.getButtons();
    const texts = [];
    for (const b of buttons) texts.push((await b.innerText()).trim());
    return texts;
  }

  async clickFirstButton() {
    await this.page.click(this.firstButtonSelector);
  }

  async clickSecondButton() {
    await this.page.click(this.secondButtonSelector);
  }

  async getOnClickAttributeForButton(index = 1) {
    const selector = `div.button-container > button.button:nth-of-type(${index})`;
    return this.page.getAttribute(selector, 'onclick');
  }

  async getHeaderText() {
    return (await this.page.textContent(this.headerSelector))?.trim();
  }

  async getDescriptionText() {
    return (await this.page.textContent(this.descriptionSelector))?.trim();
  }
}

test.describe('Context Switching FSM Tests (Application ID: 04439490-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  // Shared state for console messages and page errors observed during each test
  let consoleMessages;
  let pageErrors;
  let consoleHandler;
  let errorHandler;

  test.beforeEach(async ({ page }) => {
    // Initialize holders
    consoleMessages = [];
    pageErrors = [];

    // Handlers capture console logs and uncaught page errors
    consoleHandler = (msg) => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // In case reading msg.text() throws, capture the exception as a page error entry
        pageErrors.push(e);
      }
    };

    errorHandler = (err) => {
      pageErrors.push(err);
    };

    // Attach listeners BEFORE navigation so we capture any errors/logs during load
    page.on('console', consoleHandler);
    page.on('pageerror', errorHandler);

    // Navigate to the application under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Clean up listeners
    page.off('console', consoleHandler);
    page.off('pageerror', errorHandler);

    // Small sanity: if there are unexpected page errors, print them to test output for debugging
    if (pageErrors.length > 0) {
      // Do not modify page runtime; just fail the test with helpful info
      // Tests will make explicit assertions about errors where appropriate
    }
  });

  test.describe('State: S0_Idle (Initial rendering and structure)', () => {
    test('renders initial UI with two buttons and header (S0_Idle evidence)', async ({ page }) => {
      // Validate initial render: header, description, container present, and exactly two .button elements
      const p = new ContextSwitchPage(page);

      // Header and description present
      const headerText = await p.getHeaderText();
      expect(headerText).toBe('Context Switching');

      const desc = await p.getDescriptionText();
      expect(desc).toContain('This is a demo of context switching');

      // There should be exactly two buttons per FSM evidence
      const buttons = await p.getButtons();
      expect(buttons.length).toBe(2);

      // Verify button visible texts correspond to evidence in FSM
      const texts = await p.getButtonTexts();
      // The implementation includes "Switch Context" and "Switch Context (Again)"
      expect(texts).toContain('Switch Context');
      expect(texts).toContain('Switch Context (Again)');

      // Verify onclick attributes exist and reference switchContext()
      const onclick1 = await p.getOnClickAttributeForButton(1);
      const onclick2 = await p.getOnClickAttributeForButton(2);
      expect(onclick1).toBeTruthy();
      expect(onclick2).toBeTruthy();
      expect(onclick1).toContain('switchContext()');
      expect(onclick2).toContain('switchContext()');

      // At initial idle state we do NOT expect the "Context switched!" message yet
      const foundInitialLog = consoleMessages.some(m => m.text === 'Context switched!');
      expect(foundInitialLog).toBe(false);

      // No uncaught page errors should have occurred during load in a correct implementation
      // We assert pageErrors length is zero; if not, the failing assertion will indicate unexpected runtime errors
      expect(pageErrors.length).toBe(0);
    });

    test('initialization should not produce a ReferenceError for renderPage (edge case check)', async ({ page }) => {
      // FSM mentioned an entry action "renderPage()", but the implementation does not call renderPage().
      // We assert that no ReferenceError has occurred automatically (i.e., nothing attempted to call undefined renderPage).
      // This test validates that the absence of renderPage() being called does NOT produce runtime ReferenceError on load.
      const refErrors = pageErrors.filter(err => String(err).includes('ReferenceError'));
      expect(refErrors.length).toBe(0);
    });
  });

  test.describe('Events and transitions: SwitchContext (click .button)', () => {
    test('S0_Idle -> S1_ContextSwitched: clicking first button logs "Context switched!"', async ({ page }) => {
      const p = new ContextSwitchPage(page);

      // Prepare to wait for the console log that indicates the context switched observable
      const consolePromise = page.waitForEvent('console', {
        predicate: msg => msg.type() === 'log' && msg.text() === 'Context switched!',
      });

      // Trigger the event (click first button)
      await p.clickFirstButton();

      // Await console log
      const msg = await consolePromise;
      expect(msg.type()).toBe('log');
      expect(msg.text()).toBe('Context switched!');

      // Confirm our captured consoleMessages array also contains the event
      const captured = consoleMessages.filter(m => m.text === 'Context switched!');
      expect(captured.length).toBeGreaterThanOrEqual(1);

      // No new page errors should have been produced by the click
      expect(pageErrors.length).toBe(0);
    });

    test('S1_ContextSwitched -> S0_Idle: clicking second button logs "Context switched!" again (transition back)', async ({ page }) => {
      const p = new ContextSwitchPage(page);

      // Click first to get into switched context (logs)
      const firstLogPromise = page.waitForEvent('console', {
        predicate: msg => msg.type() === 'log' && msg.text() === 'Context switched!',
      });
      await p.clickFirstButton();
      await firstLogPromise;

      // Now click second button to represent a transition back
      const secondLogPromise = page.waitForEvent('console', {
        predicate: msg => msg.type() === 'log' && msg.text() === 'Context switched!',
      });
      await p.clickSecondButton();
      const msg2 = await secondLogPromise;
      expect(msg2.text()).toBe('Context switched!');

      // Ensure at least two "Context switched!" messages exist in captured consoleMessages
      const matched = consoleMessages.filter(m => m.text === 'Context switched!');
      expect(matched.length).toBeGreaterThanOrEqual(2);
    });

    test('rapid multiple clicks produce multiple "Context switched!" logs (edge case and idempotency test)', async ({ page }) => {
      const p = new ContextSwitchPage(page);
      const clicks = 5;

      // Pre-register waiters for expected console messages before firing clicks
      const waiters = Array.from({ length: clicks }, () =>
        page.waitForEvent('console', {
          predicate: msg => msg.type() === 'log' && msg.text() === 'Context switched!',
        })
      );

      // Fire clicks in quick succession on the same button
      for (let i = 0; i < clicks; i++) {
        await p.clickFirstButton();
      }

      // Await all console log events
      const messages = await Promise.all(waiters);
      expect(messages.length).toBe(clicks);
      for (const m of messages) {
        expect(m.text()).toBe('Context switched!');
      }

      // Confirm the captured consoleMessages reflects these logs
      const matched = consoleMessages.filter(m => m.text === 'Context switched!');
      expect(matched.length).toBeGreaterThanOrEqual(clicks);
    });

    test('clicking non-button areas does NOT trigger context switch (negative test)', async ({ page }) => {
      // Clicking the page background should not call switchContext() because only buttons have onclick handlers
      const beforeCount = consoleMessages.filter(m => m.text === 'Context switched!').length;

      // Click the body (non-button)
      await page.click('body');

      // Wait briefly to allow any accidental logs to occur
      await page.waitForTimeout(150);

      const afterCount = consoleMessages.filter(m => m.text === 'Context switched!').length;
      expect(afterCount).toBe(beforeCount);
    });
  });

  test.describe('Runtime observation and error-safety checks', () => {
    test('no unhandled exceptions or syntax errors during interaction (observed as pageerror events)', async ({ page }) => {
      const p = new ContextSwitchPage(page);

      // Interact with the page to ensure typical usage does not surface errors
      const tries = 3;
      for (let i = 0; i < tries; i++) {
        // Wait for the console log corresponding to each click
        const waiter = page.waitForEvent('console', {
          predicate: msg => msg.type() === 'log' && msg.text() === 'Context switched!',
        });
        await p.clickFirstButton();
        await waiter;
      }

      // After interactions, assert that there were no page errors captured
      expect(pageErrors.length).toBe(0);
    });

    test('observes console logs and ensures expected observable text exists per FSM', async ({ page }) => {
      const p = new ContextSwitchPage(page);

      // Trigger a single transition to generate the observable
      const waiter = page.waitForEvent('console', {
        predicate: msg => msg.type() === 'log' && msg.text() === 'Context switched!',
      });
      await p.clickSecondButton();
      const consoleMsg = await waiter;

      // Verify the FSM expected observable "Context switched!" is exactly what was logged
      expect(consoleMsg.text()).toBe('Context switched!');
    });
  });
});