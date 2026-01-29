import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a16153-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object Model for the Floyd-Warshall demo page
class FloydWarshallPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getHeaderText() {
    return this.page.textContent('h1');
  }

  async getFirstParagraphText() {
    return this.page.textContent('p');
  }

  async demoButton() {
    return this.page.locator('#demoButton');
  }

  async demoButtonAttributes() {
    const handle = await this.page.$('#demoButton');
    if (!handle) return {};
    return this.page.evaluate((el) => {
      return {
        id: el.id,
        class: el.className,
        href: el.getAttribute('href'),
        onclick: el.getAttribute('onclick'),
        innerText: el.innerText,
      };
    }, handle);
  }

  // Click the demo button and handle the browser dialog(s).
  // Returns an array of dialog messages observed during the clicks.
  async clickDemoTimes(times = 1) {
    const messages = [];
    this.page.on('dialog', async (dialog) => {
      messages.push(dialog.message());
      await dialog.accept();
    });

    for (let i = 0; i < times; i++) {
      await this.demoButton().click();
      // small wait to let dialog fire and be handled
      await this.page.waitForTimeout(50);
    }
    // give some time for any remaining dialogs
    await this.page.waitForTimeout(100);
    return messages;
  }

  // Evaluate whether showDemo is defined as a function on window
  async isShowDemoFunctionDefined() {
    return this.page.evaluate(() => typeof window.showDemo === 'function');
  }

  // Evaluate whether renderPage is defined on window (FSM expected entry_action)
  async isRenderPageDefined() {
    return this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }

  // Try calling renderPage inside a try/catch in page context and return the caught error string (if any)
  // This intentionally executes inside the page context but does not alter globals.
  async tryCallRenderPageAndReturnErrorString() {
    return this.page.evaluate(() => {
      try {
        // Attempt to call; if undefined this will throw a ReferenceError
        // We purposely do not define or patch anything; we just observe behavior.
        // Wrap in try/catch to return the thrown error as a string for assertion.
        // Note: This is executed within the page context only.
        // eslint-disable-next-line no-undef
        renderPage();
        return 'no-error';
      } catch (e) {
        return e && e.toString ? e.toString() : String(e);
      }
    });
  }
}

test.describe('Floyd-Warshall Algorithm Interactive Page (FSM tests)', () => {
  // Collect console and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages and page errors so we can assert none (or detect if any) occurred.
    page.on('console', (msg) => {
      // Collect only warnings and errors for visibility; include type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Unhandled exceptions on the page (ReferenceError/SyntaxError/TypeError etc.)
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // After each test, assert that there were no uncaught page errors.
    // The HTML/JS for this app is expected to be well-formed; any unexpected runtime errors would be captured here.
    expect(pageErrors.length, `Expected no unhandled page errors, but got: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
  });

  test.describe('State S0_Idle - Initial rendered page', () => {
    test('renders the main title and introductory paragraph (entry evidence for S0_Idle)', async ({ page }) => {
      // Validate initial page rendering matches FSM evidence for S0_Idle
      const model = new FloydWarshallPage(page);

      // Title should match exactly as in HTML
      const title = await model.getHeaderText();
      expect(title).toBe('Floyd-Warshall Algorithm');

      // First paragraph should contain expected descriptive substring
      const pText = await model.getFirstParagraphText();
      expect(pText).toContain('The Floyd-Warshall algorithm');

      // No unhandled page errors occurred during load (asserted in afterEach)
    });

    test('does not define renderPage() (FSM mentions renderPage entry_action but implementation does not include it)', async ({ page }) => {
      const model = new FloydWarshallPage(page);

      // FSM S0_Idle.entry_actions lists renderPage(); verify whether the implementation actually exposes it.
      const defined = await model.isRenderPageDefined();
      // The provided HTML does not include a renderPage function; assert that it's undefined.
      expect(defined).toBe(false);

      // Additionally, demonstrate what calling it would produce (ReferenceError) when invoked inside page context.
      // We call it inside page context wrapped in try/catch so we can observe the error string without modifying globals.
      const errorString = await model.tryCallRenderPageAndReturnErrorString();
      expect(errorString).toContain('ReferenceError');
    });
  });

  test.describe('Transition: ShowDemo (S0_Idle -> S1_DemoShown)', () => {
    test('demo button exists with expected attributes and onclick evidence', async ({ page }) => {
      const model = new FloydWarshallPage(page);

      const attrs = await model.demoButtonAttributes();
      // Validate selector, text and attributes per FSM components/evidence
      expect(attrs.id).toBe('demoButton');
      expect(attrs.class).toContain('button');
      expect(attrs.innerText).toBe('Show Demo');
      // The HTML inline onclick attribute should reference showDemo()
      expect(attrs.onclick).toBe('showDemo()');
      // href should be "#" as in implementation
      expect(attrs.href).toBe('#');
    });

    test('clicking Show Demo triggers the expected alert dialog (entry action showDemo())', async ({ page }) => {
      const model = new FloydWarshallPage(page);

      // Verify showDemo is defined as a function on window before clicking
      const isDefined = await model.isShowDemoFunctionDefined();
      expect(isDefined).toBe(true);

      // Click once and assert dialog message matches expected FSM observable
      const messages = await model.clickDemoTimes(1);
      expect(messages.length).toBe(1);
      expect(messages[0]).toBe('The demonstration feature is not implemented. This page focuses on textual education.');

      // After the dialog, page DOM should remain unchanged (no navigation or DOM mutation expected)
      const title = await model.getHeaderText();
      expect(title).toBe('Floyd-Warshall Algorithm');
    });

    test('clicking Show Demo multiple times should show multiple alerts (edge case)', async ({ page }) => {
      const model = new FloydWarshallPage(page);

      // Click the button twice and collect alert messages
      const messages = await model.clickDemoTimes(2);
      // Expect two dialogs with identical messages
      expect(messages.length).toBe(2);
      expect(messages[0]).toBe('The demonstration feature is not implemented. This page focuses on textual education.');
      expect(messages[1]).toBe('The demonstration feature is not implemented. This page focuses on textual education.');
    });

    test('invoking showDemo via page.evaluate behaves as expected (callable function) without producing unhandled errors', async ({ page }) => {
      // Call the function inside the page context; wrap call to capture return or thrown error string
      const result = await page.evaluate(() => {
        try {
          // call the function; it produces an alert which in Playwright is handled by 'dialog' event.
          // Since there's no accessible return, we return a flag indicating call was attempted.
          // eslint-disable-next-line no-undef
          showDemo();
          return 'called';
        } catch (e) {
          return e && e.toString ? e.toString() : String(e);
        }
      });

      // We expect that calling showDemo did not throw a ReferenceError inside page context (it's defined)
      expect(result).toBe('called');
    });
  });

  test.describe('Observability: console and runtime errors', () => {
    test('page should not emit console.error or unhandled page errors during normal usage', async ({ page }) => {
      const model = new FloydWarshallPage(page);

      // Interact with the page to exercise typical flows
      await model.demoButton(); // ensure element accessible
      await model.clickDemoTimes(1);

      // Give some time for console messages to be collected
      await page.waitForTimeout(100);

      // Filter any console messages of severity 'error'
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      // Assert there are no console.error messages
      expect(errorConsoleMessages.length, `Unexpected console.error messages: ${JSON.stringify(errorConsoleMessages)}`).toBe(0);

      // Unhandled page errors are asserted in afterEach hook
    });

    test('no SyntaxError/TypeError/ReferenceError observed as unhandled page errors after load and interactions', async ({ page }) => {
      const model = new FloydWarshallPage(page);

      // Perform typical interactions
      await model.clickDemoTimes(1);

      // Wait briefly
      await page.waitForTimeout(50);

      // Ensure pageErrors captured earlier are empty (afterEach will also assert)
      expect(pageErrors.length).toBe(0);
    });
  });
});