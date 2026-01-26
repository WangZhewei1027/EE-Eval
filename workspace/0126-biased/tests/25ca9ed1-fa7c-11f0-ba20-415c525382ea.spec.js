import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25ca9ed1-fa7c-11f0-ba20-415c525382ea.html';

// Page object model for the demo app
class FloydWarshallPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '#demoButton';
    this.resultSelector = '#demoResult';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async waitForLoad() {
    // Wait for the button to be present as an indicator the page loaded
    await this.page.waitForSelector(this.buttonSelector, { state: 'visible', timeout: 5000 });
  }

  async clickShowResult() {
    await this.page.click(this.buttonSelector);
  }

  async getResultText() {
    const el = await this.page.waitForSelector(this.resultSelector, { state: 'attached', timeout: 2000 });
    return el.evaluate((node) => node.textContent);
  }

  async isResultVisible() {
    return this.page.$eval(this.resultSelector, (el) => {
      // Use computed style since inline style may change
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    });
  }

  async getResultDisplayStyle() {
    return this.page.$eval(this.resultSelector, (el) => el.style.display || getComputedStyle(el).display);
  }

  async getButtonText() {
    return this.page.$eval(this.buttonSelector, (el) => el.textContent);
  }
}

test.describe('Floyd-Warshall Interactive Demo - FSM validation and DOM behavior', () => {
  // Arrays to capture console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app
    const app = new FloydWarshallPage(page);
    await app.goto();
    await app.waitForLoad();
  });

  test.afterEach(async () => {
    // nothing special to teardown, listeners are tied to page fixture and will be cleaned up
  });

  test.describe('S0_Idle (Initial state) validations', () => {
    test('Initial UI: button is visible and result panel is hidden', async ({ page }) => {
      const app = new FloydWarshallPage(page);

      // Validate button exists and has correct label
      const btnText = await app.getButtonText();
      expect(btnText).toBe('Show Floyd-Warshall Result (Demo)');

      // Result element should exist and be hidden initially (display: none)
      const resultDisplay = await app.getResultDisplayStyle();
      // Inline style sets display:none; so we expect either an explicit "none" or computed style "none"
      expect(resultDisplay).toBe('none');

      // Also ensure no page errors occurred during initial load
      expect(pageErrors.length).toBe(0);
      // And no console messages of type 'error'
      const errorConsoles = consoleMessages.filter((m) => m.type === 'error');
      expect(errorConsoles.length).toBe(0);
    });

    test('FSM evidence: Idle state shows the demo button markup', async ({ page }) => {
      // Ensure the expected markup snippet exists in DOM
      const demoButton = await page.$('#demoButton');
      expect(demoButton).not.toBeNull();
      const tagName = await demoButton.evaluate((el) => el.tagName.toLowerCase());
      expect(tagName).toBe('button');

      // Check the result container exists with inline style including display:none
      const demoResult = await page.$('#demoResult');
      expect(demoResult).not.toBeNull();
      const inlineStyle = await demoResult.evaluate((el) => el.getAttribute('style') || '');
      expect(inlineStyle).toContain('display:none');

      // Confirm again no runtime errors were emitted on load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition: ShowResult (S0_Idle -> S1_ResultVisible)', () => {
    test('Click demo button shows formatted shortest-path matrix and reveals result div', async ({ page }) => {
      const app = new FloydWarshallPage(page);

      // Click the demo button which triggers the floyd-warshall computation and updates the result div
      await app.clickShowResult();

      // After clicking, result should become visible
      const visible = await app.isResultVisible();
      expect(visible).toBeTruthy();

      // Read the text and validate it matches the expected formatted matrix
      const text = await app.getResultText();
      // Build expected string exactly as the page's formatMatrix produces
      const expectedMatrix = [
        '   | 1  2  3  4',
        '---+------------',
        '1 |  0  3  5  7 ',
        '2 |  8  0  2  3 ',
        '3 |  5  ∞  0  1 ',
        '4 |  2  ∞  ∞  0 ',
        ''
      ].join('\n'); // final newline included by formatMatrix loop

      const expectedFull = 'All-Pairs Shortest Path Distance Matrix:\n\n' + expectedMatrix;

      // Normalize whitespace at ends to be robust
      expect(text.trim()).toBe(expectedFull.trim());

      // The inline style of the resultDiv should be set to block by the click handler
      const displayStyle = await app.getResultDisplayStyle();
      expect(displayStyle).toBe('block');

      // Validate no runtime exceptions occurred during the click/compute
      expect(pageErrors.length).toBe(0);
      const errorConsoles = consoleMessages.filter((m) => m.type === 'error');
      expect(errorConsoles.length).toBe(0);
    });

    test('Clicking the button multiple times is idempotent and does not throw errors', async ({ page }) => {
      const app = new FloydWarshallPage(page);

      // Click the button three times
      await app.clickShowResult();
      await app.clickShowResult();
      await app.clickShowResult();

      // Result should still be visible
      expect(await app.isResultVisible()).toBeTruthy();

      // Text should remain consistent
      const textAfter = await app.getResultText();
      expect(textAfter).toContain('All-Pairs Shortest Path Distance Matrix:');

      // Still no page errors or console errors after repeated interactions
      expect(pageErrors.length).toBe(0);
      const errorConsoles = consoleMessages.filter((m) => m.type === 'error');
      expect(errorConsoles.length).toBe(0);
    });
  });

  test.describe('Edge cases & error observation', () => {
    test('Result content contains expected numeric entries and special infinity symbol', async ({ page }) => {
      const app = new FloydWarshallPage(page);

      await app.clickShowResult();

      const text = await app.getResultText();

      // Check for specific pair distances mentioned in the FSM/example
      expect(text).toContain('1 |'); // row header
      expect(text).toContain('2 |');
      expect(text).toContain('3 |');
      expect(text).toContain('4 |');

      // Example assertions from the narrative: distance 1->3 = 5 and 2->4 = 3
      expect(text).toContain(' 5 '); // presence of 5 (1->3)
      // There may be multiple '5' occurrences; ensure 2->4 = 3 exists
      // Ensure '2 |  8  0  2  3 ' row contains ' 3 ' at end
      const lines = text.split('\n').map((l) => l.trim());
      const row2 = lines.find((l) => l.startsWith('2 |'));
      expect(row2).toBeDefined();
      expect(row2).toMatch(/2 \|\s*8\s*0\s*2\s*3/);

      // Check for infinity symbol presence for unreachable pairs
      expect(text).toContain('∞');

      // Verify that no uncaught exceptions or console errors were emitted while generating output
      expect(pageErrors.length).toBe(0);
      const errorConsoles = consoleMessages.filter((m) => m.type === 'error');
      expect(errorConsoles.length).toBe(0);
    });

    test('Observes console messages and pageerrors while loading and interacting (assert none occurred)', async ({ page }) => {
      const app = new FloydWarshallPage(page);

      // Interact once to generate any potential runtime logs
      await app.clickShowResult();

      // We assert there are zero page errors and zero console error messages.
      // This both observes runtime and asserts expected error-free behavior.
      expect(pageErrors.length).toBe(0, 'Expected no uncaught page errors during load/interactions');

      const consoleErrors = consoleMessages.filter((c) => c.type === 'error');
      expect(consoleErrors.length).toBe(0, 'Expected no console.error messages during load/interactions');
    });
  });
});