import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5af7211-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Page Object for the Circular Linked List demo page.
 * Encapsulates common interactions and queries used by the tests.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demo-button');
    this.preCode = page.locator('pre code');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtonText() {
    return await this.button.innerText();
  }

  async isButtonVisible() {
    return await this.button.isVisible();
  }

  async clickDemo() {
    await this.button.click();
  }

  async getPreCodeText() {
    return await this.preCode.innerText();
  }

  async getHeaderText() {
    return await this.header.innerText();
  }
}

test.describe('Circular Linked List - FSM validation and UI checks', () => {
  // Ensure each test gets a fresh page
  test.beforeEach(async ({ page }) => {
    // no-op here; navigation happens inside tests via DemoPage.goto()
  });

  test.describe('Idle state (S0_Idle) - initial render checks', () => {
    test('renders the page and shows the Demonstrate button and static content', async ({ page }) => {
      // Arrange: create page object and navigate
      const demo = new DemoPage(page);
      await demo.goto();

      // Assert: header is present and correct
      const headerText = await demo.getHeaderText();
      expect(headerText).toContain('Circular Linked List');

      // Assert: the demo button exists and is visible with correct text
      expect(await demo.isButtonVisible()).toBe(true);
      const btnText = await demo.getButtonText();
      expect(btnText).toBe('Demonstrate Circular Linked List');

      // Assert: the <pre><code> block includes the CircularLinkedList implementation text
      const codeText = await demo.getPreCodeText();
      // The implementation is present as text (not executed). We check for function names.
      expect(codeText).toMatch(/function CircularLinkedList\(\)/);
      expect(codeText).toMatch(/function insertAtHead/);

      // Verify that before any interaction there are no page errors emitted
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));
      // briefly wait a tiny bit to ensure no errors fire upon load
      await page.waitForTimeout(100);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition: ButtonClick (S0_Idle -> S1_Demonstrating)', () => {
    test('clicking the Demonstrate button triggers the demo handler which references CircularLinkedList and produces a ReferenceError', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Collect console messages and page errors
      const consoleMessages = [];
      page.on('console', msg => {
        // capture type and text for assertions
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });

      const pageErrors = [];
      page.on('pageerror', err => {
        // push the Error object for robust assertions
        pageErrors.push(err);
      });

      // Act: click the demo button which in the current page implementation tries to use CircularLinkedList
      await demo.clickDemo();

      // The click handler calls new CircularLinkedList() but CircularLinkedList is not defined in the runtime
      // so we expect a page error (ReferenceError). Wait for at least one pageerror event.
      // Use waitForEvent to be deterministic if possible; fallback to a short timeout check.
      let observedError = null;
      try {
        observedError = await page.waitForEvent('pageerror', { timeout: 2000 });
      } catch (e) {
        // If waitForEvent times out, we still continue to assert using collected pageErrors array below.
      }

      // Consolidate observed errors
      if (observedError) pageErrors.push(observedError);

      // Assert: at least one page error occurred
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Assert: at least one of the errors mentions CircularLinkedList or 'is not defined'
      const errorMessages = pageErrors.map(e => (e && e.message) || String(e));
      const hasReferenceError = errorMessages.some(msg => /CircularLinkedList/.test(msg) || /is not defined/.test(msg));
      expect(hasReferenceError).toBe(true);

      // Assert: no successful console.log of the list contents occurred (the demo intended to console.log(list.printList()))
      const hasArrayPrint = consoleMessages.some(m => /\[.*\d.*\]/.test(m.text)); // looks for an array-like output
      expect(hasArrayPrint).toBe(false);

      // Also assert that console errors (if any) reference the same problem
      const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
      const consoleHasReference = consoleErrorMessages.some(text => /CircularLinkedList/.test(text) || /is not defined/.test(text));
      // It is acceptable if the console does or does not contain the error (depending on browser/runtime),
      // but if it does, it should mention CircularLinkedList
      if (consoleErrorMessages.length > 0) {
        expect(consoleHasReference).toBe(true);
      }
    });

    test('multiple clicks produce repeated errors (robustness / edge case)', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      // Click multiple times rapidly
      await Promise.all([
        demo.clickDemo(),
        demo.clickDemo(),
        demo.clickDemo()
      ]);

      // Wait a bit for page errors to be emitted for each click
      await page.waitForTimeout(500);

      // Expect at least one error; ideally one per click, but we allow >=1 to be robust across environments
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Every error should mention the undefined reference if it's the same underlying issue
      for (const err of pageErrors) {
        const msg = err && err.message ? err.message : String(err);
        // Accept broad matches: mention CircularLinkedList or 'is not defined'
        expect(/CircularLinkedList|is not defined/.test(msg)).toBe(true);
      }
    });
  });

  test.describe('Implementation evidence and FSM expectations', () => {
    test('the script handler for the button click exists and includes the demo sequence text', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // The page contains a <script> block with the click handler; check script text contains expected evidence strings.
      // We fetch all script element contents and search them.
      const scripts = await page.$$eval('script', els => els.map(e => e.innerText));
      // Join and search for the key evidence lines
      const joined = scripts.join('\n');

      // Evidence identified in the FSM: demoButton.addEventListener('click', ...)
      expect(joined).toMatch(/demoButton\.addEventListener\s*\(\s*'click'/);

      // Evidence: references to insertAtHead and printList exist in the handler text
      expect(joined).toMatch(/insertAtHead\(1\)/);
      expect(joined).toMatch(/printList\(\)/);
    });
  });

  test.describe('Negative assertions and error reporting behavior', () => {
    test('no successful demonstration occurs due to missing CircularLinkedList; assert user-visible DOM is unchanged', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Snapshot of relevant DOM before click
      const beforeButtonText = await demo.getButtonText();
      const beforeCodeText = await demo.getPreCodeText();

      // Listen for page errors to ensure the click triggers the runtime error path
      const errors = [];
      page.on('pageerror', e => errors.push(e));

      // Click demo button
      await demo.clickDemo();

      // Wait for possible errors to occur
      try {
        await page.waitForEvent('pageerror', { timeout: 1500 });
      } catch (e) {
        // ignore timeout
      }

      // DOM should remain present and unchanged in terms of the demo button and static code content
      const afterButtonText = await demo.getButtonText();
      const afterCodeText = await demo.getPreCodeText();

      expect(afterButtonText).toBe(beforeButtonText);
      expect(afterCodeText).toBe(beforeCodeText);

      // Ensure error(s) were observed
      expect(errors.length).toBeGreaterThanOrEqual(1);
      const msgs = errors.map(e => e.message);
      expect(msgs.some(m => /CircularLinkedList|is not defined/.test(m))).toBe(true);
    });
  });
});