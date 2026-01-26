import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5af9922-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the Deque Explanation page
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = '#deque-demo';
    this.containerSelector = '.deque';
    this.scriptSelector = 'script';
    this.preSelector = '.deque pre';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtonText() {
    return this.page.innerText(this.runButton);
  }

  async clickRun() {
    await this.page.click(this.runButton);
  }

  async getPreText() {
    return this.page.innerText(this.preSelector);
  }

  // Return the text content of the first inline script tag to inspect the attached handler string
  async getFirstScriptContent() {
    return this.page.locator(this.scriptSelector).first().innerText();
  }

  async buttonExists() {
    return this.page.locator(this.runButton).count().then(c => c > 0);
  }
}

test.describe('Deque Explanation FSM tests (f5af9922-fa7c-11f0-adc7-178f556b1ee0)', () => {
  let dequePage;

  // Navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    dequePage = new DequePage(page);
    await dequePage.goto();
  });

  test.describe('State S0_Idle (Initial State) validations', () => {
    test('Idle state: page renders and contains the Run Deque Demo button and explanatory content', async ({ page }) => {
      // This test validates the initial Idle state rendering and static content presence.

      // Button exists and has correct id/text
      const exists = await dequePage.buttonExists();
      expect(exists).toBe(true);

      const text = await dequePage.getButtonText();
      expect(text).toContain('Run Deque Demo');

      // The page contains the descriptive container and a pre block showing the example implementation
      const preText = await dequePage.getPreText();
      expect(preText).toBeTruthy();
      // Ensure the pre block contains the example Deque implementation snippet (it should be displayed as text, not executed)
      expect(preText).toContain('var Deque = function()');
      expect(preText).toContain('Deque.prototype.push');

      // Verify that the script tag includes the addEventListener('click' registration string
      const scriptContent = await dequePage.getFirstScriptContent();
      expect(scriptContent).toContain("addEventListener('click'");
    });

    test('Idle state: FSM entry action renderPage() is not provided as a global function in the runtime', async ({ page }) => {
      // FSM metadata mentioned an entry action renderPage() for the Idle state.
      // The actual page does not define renderPage; assert it is undefined (do not inject or define it).
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');
    });
  });

  test.describe('Transition: Run Deque Demo (S0_Idle -> S1_DemoRunning) and Demo Running behavior', () => {
    test('Clicking Run Deque Demo should invoke the demo handler; because Deque is not defined it should raise a ReferenceError (observed via pageerror)', async ({ page }) => {
      // This test validates the transition event and the resulting runtime behavior (errors and console output).
      const consoleMessages = [];
      const pageErrors = [];

      // Capture console messages (info, log, error, etc.)
      page.on('console', msg => {
        try {
          // Use .text() for message body
          consoleMessages.push({ type: msg.type(), text: msg.text() });
        } catch (e) {
          consoleMessages.push({ type: 'unknown', text: String(e) });
        }
      });

      // Capture uncaught exceptions from the page
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      // Ensure Deque constructor is not defined on the page before clicking
      const dequeTypeBefore = await page.evaluate(() => typeof window.Deque);
      expect(dequeTypeBefore).toBe('undefined');

      // Perform the event: click the Run Deque Demo button
      await dequePage.clickRun();

      // Give the page a short moment to process events and emit console/pageerror events
      await page.waitForTimeout(100);

      // There should be at least one page error due to ReferenceError: Deque is not defined
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      // Ensure at least one of the captured page errors mentions Deque and not defined or ReferenceError
      const hasDequeReferenceError = pageErrors.some(msg =>
        /Deque/.test(msg) && (/not defined/i.test(msg) || /ReferenceError/i.test(msg))
      );
      expect(hasDequeReferenceError).toBe(true);

      // The FSM expected console log observables: "1", "3", "2", "1".
      // Because Deque is undefined and the demo throws early, these logs should NOT be present.
      const loggedTexts = consoleMessages.map(m => m.text);
      expect(loggedTexts).not.toContain('1');
      expect(loggedTexts).not.toContain('3');
      expect(loggedTexts).not.toContain('2');

      // Also assert that at least one console message corresponds to an error type (the thrown ReferenceError might also appear in console)
      const hasConsoleError = consoleMessages.some(m => m.type === 'error' || (/error/i.test(m.type)));
      expect(hasConsoleError || pageErrors.length > 0).toBe(true);
    });

    test('Click handler remains attached and repeated clicks continue to emit ReferenceErrors (edge case)', async ({ page }) => {
      // This test verifies that repeated invocations of the same event continue to surface the same error behavior.
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err.message));

      // Click twice to ensure repeated behavior
      await dequePage.clickRun();
      await page.waitForTimeout(50);
      await dequePage.clickRun();
      await page.waitForTimeout(100);

      // We expect at least two page errors (one for each click handler invocation)
      // Some browsers may coalesce or report slightly differently; be permissive but expect >=1
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Ensure the errors mention the missing Deque constructor each time (or at least once)
      const messagesContainDeque = pageErrors.some(msg =>
        /Deque/.test(msg) && (/not defined/i.test(msg) || /ReferenceError/i.test(msg))
      );
      expect(messagesContainDeque).toBe(true);
    });

    test('Transition expected console observables do not appear due to runtime error; verify absence explicitly', async ({ page }) => {
      // This test specifically asserts absence of the FSM expected observables as a result of the runtime error.

      const logged = [];
      page.on('console', m => logged.push(m.text()));

      // Click to run demo
      await dequePage.clickRun();
      await page.waitForTimeout(100);

      // The expected sequence 1, 3, 2, 1 should not be observed in console logs since code throws
      const logsConcatenated = logged.join(' | ');
      expect(logsConcatenated).not.toContain('1');
      expect(logsConcatenated).not.toContain('3');
      expect(logsConcatenated).not.toContain('2');
    });
  });

  test.describe('Additional validations and error scenarios', () => {
    test('Verify Deque constructor is not present on window and the demo relies on an undefined symbol (explicit check)', async ({ page }) => {
      // Confirm that Deque is not defined and that attempting to construct one would throw in the page context
      const dequeType = await page.evaluate(() => typeof Deque);
      expect(dequeType).toBe('undefined');

      // We deliberately do NOT attempt to construct Deque in the test context (that would mutate page globals).
      // Instead, assert that calling the handler will error (this duplicates earlier checks but is explicit).
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(e.message));

      await dequePage.clickRun();
      await page.waitForTimeout(100);

      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      expect(pageErrors.some(msg => /Deque/.test(msg))).toBe(true);
    });

    test('Sanity check: page has descriptive headings and algorithmic operations list', async ({ page }) => {
      // Ensure the informational content exists as part of the educational goal
      const headingExists = await page.locator('h2', { hasText: 'What is a Deque?' }).count();
      expect(headingExists).toBeGreaterThanOrEqual(1);

      const listItems = await page.locator('.deque ul li').allInnerTexts();
      expect(listItems.length).toBeGreaterThanOrEqual(4);
      expect(listItems[0].toLowerCase()).toContain('insert an element at the beginning');
    });
  });
});