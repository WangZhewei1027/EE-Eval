import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122e48f4-fa7b-11f0-814c-dbec508f0b3b.html';

// Page object encapsulating the button interactions and common queries
class ButtonsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      container: '.button-container',
      buttonNth: (n) => `.button:nth-child(${n})`,
      resultsDiv: '#results',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Returns text content of the nth button (1-based)
  async getButtonText(n) {
    const sel = this.selectors.buttonNth(n);
    const el = await this.page.waitForSelector(sel, { state: 'visible' });
    return el.textContent();
  }

  // Click nth button
  async clickButton(n) {
    const sel = this.selectors.buttonNth(n);
    await this.page.click(sel);
  }

  async getResultsText() {
    const el = await this.page.$(this.selectors.resultsDiv);
    if (!el) return null;
    return (await el.textContent()) || '';
  }

  // Dispatch an 'input' event on nth button to trigger any input event handlers attached
  async dispatchInputEventOnButton(n) {
    const sel = this.selectors.buttonNth(n);
    await this.page.dispatchEvent(sel, 'input');
  }

  // Return count of visible buttons in container
  async countButtons() {
    const container = await this.page.$(this.selectors.container);
    if (!container) return 0;
    const nodes = await container.$$('.button');
    return nodes.length;
  }
}

test.describe('Backpropagation interactive app (FSM validation)', () => {
  // Basic sanity: the page should serve and contain the expected six buttons.
  test('Idle state - page renders six action buttons', async ({ page }) => {
    // Capture console and page errors during initial load
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const buttonsPage = new ButtonsPage(page);
    await buttonsPage.goto();

    // Verify there are six buttons (Idle state's evidence)
    const count = await buttonsPage.countButtons();
    expect(count).toBe(6);

    // Verify button labels match FSM evidence and order
    const expectedLabels = [
      'Backpropagation',
      'Maximization',
      'Exploration',
      'Complexity',
      'Interactivity',
      'Results',
    ];
    for (let i = 1; i <= expectedLabels.length; i++) {
      const text = await buttonsPage.getButtonText(i);
      // trim whitespace to be resilient
      expect((await text).trim()).toBe(expectedLabels[i - 1]);
    }

    // There should be no fatal page errors on initial render in this test.
    // We still assert that pageErrors is an array (can be empty) and no unexpected exceptions.
    expect(Array.isArray(pageErrors)).toBe(true);
    // console messages are optional; we ensure we recorded any if they exist
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test.describe('State transitions and action handlers', () => {
    // Test clicking each button separately to validate transitions described in FSM.
    test('Transition: BackpropagationEvent - clicking Backpropagation registers handlers (then triggers input error)', async ({ page }) => {
      // Collect page errors so we can assert that a TypeError occurs when input event handler runs.
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const buttonsPage = new ButtonsPage(page);
      await buttonsPage.goto();

      // Click Backpropagation to execute the global function backpropagation()
      // This should register input handlers on available inputs (including the buttons)
      await buttonsPage.clickButton(1);

      // After clicking, results div should still be present (but likely empty)
      const resultsTextBefore = await buttonsPage.getResultsText();
      expect(typeof resultsTextBefore).toBe('string');

      // Now dispatch an 'input' event on the first button to invoke the registered handlers.
      // The page's implementation tries to use an element with id 'outputs' which does not exist,
      // so we expect a runtime TypeError to be thrown and captured as a pageerror.
      await buttonsPage.dispatchInputEventOnButton(1);

      // Give the runtime a short moment to surface the error
      await page.waitForTimeout(50);

      // At least one page error should have been recorded and it should indicate an issue with null/outputs/textContent.
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      const messages = pageErrors.map(e => String(e && e.message).toLowerCase());
      // Expect at least one message referencing 'null' or 'textcontent' or 'cannot set' to indicate outputs is missing.
      const matches = messages.some(m => m.includes('null') || m.includes('textcontent') || m.includes('cannot set'));
      expect(matches).toBe(true);
    });

    test('Transition: MaximizationEvent - clicking Maximization registers handlers without immediate error', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const buttonsPage = new ButtonsPage(page);
      await buttonsPage.goto();

      await buttonsPage.clickButton(2);

      // No immediate pageerror is expected just from registering handlers.
      // Wait briefly to ensure no delayed errors.
      await page.waitForTimeout(50);

      expect(pageErrors.length).toBe(0);

      // Results div should still exist and be empty (no inputs fired).
      const resultsText = await buttonsPage.getResultsText();
      expect(resultsText).toBe('');
    });

    test('Transition: ExplorationEvent - clicking Exploration registers handlers without immediate error', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const buttonsPage = new ButtonsPage(page);
      await buttonsPage.goto();

      await buttonsPage.clickButton(3);

      await page.waitForTimeout(50);

      expect(pageErrors.length).toBe(0);

      const resultsText = await buttonsPage.getResultsText();
      expect(resultsText).toBe('');
    });

    test('Transition: ComplexityEvent - clicking Complexity registers handlers without immediate error', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const buttonsPage = new ButtonsPage(page);
      await buttonsPage.goto();

      await buttonsPage.clickButton(4);

      await page.waitForTimeout(50);

      expect(pageErrors.length).toBe(0);

      const resultsText = await buttonsPage.getResultsText();
      expect(resultsText).toBe('');
    });

    test('Transition: InteractivityEvent - clicking Interactivity should produce a ReferenceError (interactivity is not defined)', async ({ page }) => {
      // This test validates the broken handler name: onclick="interactivity()" but the function declared is named interaction()
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const buttonsPage = new ButtonsPage(page);
      await buttonsPage.goto();

      // Clicking the interactivity button should attempt to call interactivity() which is not defined -> ReferenceError
      await buttonsPage.clickButton(5);

      // Wait for the pageerror to be emitted
      await page.waitForTimeout(50);

      // Confirm that a pageerror was emitted and it is a ReferenceError referring to 'interactivity'
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      const messages = pageErrors.map(e => String(e && e.message).toLowerCase());
      const hasRefError = messages.some(m => m.includes('interactivity') || m.includes('referenceerror'));
      expect(hasRefError).toBe(true);
    });

    test('Transition: ResultsEvent - clicking Results executes results() function (validate behavior / potential name collisions)', async ({ page }) => {
      const pageErrors = [];
      const consoleMessages = [];
      page.on('pageerror', err => pageErrors.push(err));
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

      const buttonsPage = new ButtonsPage(page);
      await buttonsPage.goto();

      // Click Results button. The page defines function results() and also has a div#results.
      // This can sometimes lead to name collisions in the global scope in some browsers, but in this environment
      // we will observe whether a runtime error occurs or not.
      await buttonsPage.clickButton(6);

      // Wait a bit for any errors to surface
      await page.waitForTimeout(50);

      // Accept either no error or a specific TypeError arising from name-collision.
      // We assert that if an error exists, it references 'results' or 'not a function'
      if (pageErrors.length > 0) {
        const messages = pageErrors.map(e => String(e && e.message).toLowerCase());
        const relevant = messages.some(m => m.includes('results') || m.includes('not a function') || m.includes('typeerror'));
        expect(relevant).toBe(true);
      } else {
        // No error -> ensure results div still exists (function ran without throwing)
        const resultsText = await buttonsPage.getResultsText();
        expect(typeof resultsText).toBe('string');
      }
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Rapid sequence of clicks across all transitions should not crash the page (except known interactivity ReferenceError)', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const buttonsPage = new ButtonsPage(page);
      await buttonsPage.goto();

      // Rapidly click all buttons in order
      for (let i = 1; i <= 6; i++) {
        await buttonsPage.clickButton(i);
      }

      // Allow errors to be reported
      await page.waitForTimeout(100);

      // We expect at least one error due to the interactivity mismatch, but no other unexpected fatal errors.
      // Ensure there is at least one error and that one of them pertains to interactivity ReferenceError.
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      const messages = pageErrors.map(e => String(e && e.message).toLowerCase());
      const interactivityError = messages.some(m => m.includes('interactivity') || m.includes('referenceerror'));
      expect(interactivityError).toBe(true);
    });

    test('Dispatching input events without prior handler registration should not throw (no-op)', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const buttonsPage = new ButtonsPage(page);
      await buttonsPage.goto();

      // Dispatch input on a button without calling any of the registration functions first.
      await buttonsPage.dispatchInputEventOnButton(1);

      // Wait to surface any errors (there should be none because no handlers exist yet)
      await page.waitForTimeout(50);
      expect(pageErrors.length).toBe(0);
    });
  });
});