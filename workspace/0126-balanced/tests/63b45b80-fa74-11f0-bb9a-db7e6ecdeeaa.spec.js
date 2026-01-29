import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b45b80-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object encapsulating interactions and queries against the Decision Tree page
class DecisionTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.formSelector = '#feature-form';
    this.feature1Selector = '#feature1';
    this.feature2Selector = '#feature2';
    this.submitButtonSelector = 'button[type="submit"]';
    this.predictionSelector = '#prediction-result';
    this.svgSelector = 'svg';
    this.headingSelector = 'h1';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for the form to ensure script initialization completed
    await this.page.waitForSelector(this.formSelector);
  }

  async getHeadingText() {
    return this.page.textContent(this.headingSelector);
  }

  async getSvgExists() {
    return this.page.$(this.svgSelector) !== null;
  }

  async getFeature1Value() {
    return this.page.$eval(this.feature1Selector, el => el.value);
  }

  async getFeature2Value() {
    return this.page.$eval(this.feature2Selector, el => el.value);
  }

  async setFeature1(value) {
    // Use fill which works for number inputs too
    await this.page.fill(this.feature1Selector, String(value));
  }

  async selectFeature2(value) {
    // Use selectOption when option exists
    await this.page.selectOption(this.feature2Selector, value);
  }

  async setFeature2Raw(value) {
    // Directly set the select's value even if not an option (to test unknown category)
    await this.page.$eval(this.feature2Selector, (el, v) => { el.value = v; }, value);
  }

  async submitForm() {
    await Promise.all([
      this.page.waitForEvent('domcontentloaded').catch(() => {}), // not guaranteed but safe to not hang
      this.page.click(this.submitButtonSelector),
    ]);
    // Wait a tiny bit for the UI updates (prediction text, highlights)
    await this.page.waitForTimeout(100);
  }

  async getPredictionText() {
    return this.page.$eval(this.predictionSelector, el => el.textContent.trim());
  }

  async getHighlightedNodeAriaLabels() {
    // Return aria-labels of node groups whose rect fill was changed to the highlight color (#80deea)
    return this.page.$$eval('svg g.node', nodes => {
      const highlighted = [];
      nodes.forEach(g => {
        const rect = g.querySelector('rect');
        // Inline style is used by highlightPath: rect.style.fill = "#80deea";
        const inlineFill = rect && rect.style && rect.style.fill;
        // Also consider computed style as fallback
        const computedFill = window.getComputedStyle(rect).fill;
        if (inlineFill === '#80deea' || inlineFill === '#80deea;' || computedFill === 'rgb(128, 222, 234)') {
          highlighted.push(g.getAttribute('aria-label'));
        }
      });
      return highlighted;
    });
  }

  async getAllRectFills() {
    return this.page.$$eval('svg g.node rect', rects => rects.map(r => {
      const inlineFill1 = r.style && r.style.fill ? r.style.fill : null;
      const computed = window.getComputedStyle(r).fill;
      return { inlineFill, computedFill: computed };
    }));
  }
}

test.describe('Decision Tree FSM and UI Integration Tests', () => {
  let page;
  let dtPage;
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ browser }) => {
    pageErrors = [];
    consoleMessages = [];

    page = await browser.newPage();

    // Collect page errors (uncaught exceptions) and console messages for assertions later
    page.on('pageerror', (err) => {
      // push message string (could be ReferenceError, TypeError, etc.)
      pageErrors.push(String(err && err.message ? err.message : err));
    });
    page.on('console', msg => {
      // capture console messages with type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    dtPage = new DecisionTreePage(page);
    await dtPage.goto();
  });

  test.afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test('S0_Idle: initial render shows heading, SVG, default inputs and initial prediction', async () => {
    // This test validates the initial (Idle) state: page rendered, tree drawn, and initial auto-submission result visible.

    // Verify page heading matches FSM evidence for S0_Idle
    const heading = await dtPage.getHeadingText();
    expect(heading).toBe('Decision Tree Classifier Demonstration');

    // SVG drawing exists and has the expected aria-label
    const svgExists = await dtPage.getSvgExists();
    expect(svgExists).toBeTruthy();

    // Default input values should reflect the HTML initialization
    const f1 = await dtPage.getFeature1Value();
    expect(f1).toBe('8'); // default value attribute is 8

    const f2 = await dtPage.getFeature2Value();
    // The script sets feature2.value = "Red" during initialization, so expect 'Red'
    expect(f2).toBe('Red');

    // The page script dispatches an initial submit event on load; ensure prediction is present and correct for (8, Red):
    const predictionText = await dtPage.getPredictionText();
    expect(predictionText).toBe('Prediction: Class A');

    // Ensure the highlightPath ran and at least one node is highlighted (S2_PredictionDisplayed evidence)
    const highlighted1 = await dtPage.getHighlightedNodeAriaLabels();
    expect(highlighted.length).toBeGreaterThan(0);
    // At least one highlighted node should indicate the prediction (Class A appears in aria-label of leaf)
    expect(highlighted.some(label => label && label.includes('Class A'))).toBeTruthy();

    // There should be no uncaught page errors during initial render
    expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
  });

  test('Transition S0 -> S1 -> S2: submitting values that route to Class B shows prediction and highlights the Class B leaf', async () => {
    // This test exercises the form submit event and verifies the classify and highlight flows.
    // Set feature1 to a value > 10 (e.g., 20) so the tree takes the right branch leading to Class B.
    await dtPage.setFeature1(20);
    // Ensure feature2 is set to a valid option as required by the form (choose Red but any is fine)
    await dtPage.selectFeature2('Red');

    // Submit the form and wait for UI updates
    await dtPage.submitForm();

    // Expect the prediction to indicate Class B (feature1 > 10 -> Leaf Class B)
    const predictionText1 = await dtPage.getPredictionText();
    expect(predictionText).toBe('Prediction: Class B');

    // Verify that the highlighted nodes include the Class B leaf (by checking aria-label)
    const highlighted2 = await dtPage.getHighlightedNodeAriaLabels();
    expect(highlighted.length).toBeGreaterThan(0);
    expect(highlighted.some(label => label && label.includes('Class B'))).toBeTruthy();

    // Also assert that at least one rect has the computed highlight color (rgb value for #80deea)
    const rectFills = await dtPage.getAllRectFills();
    expect(rectFills.some(r => r.inlineFill === '#80deea' || r.computedFill === 'rgb(128, 222, 234)')).toBeTruthy();

    // No uncaught errors should have been emitted while performing the transition
    expect(pageErrors, `Unexpected page errors during submit: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
  });

  test('Edge case: invalid numeric input shows validation message and does not highlight path', async () => {
    // This test submits an invalid numeric value and asserts correct error handling in UI.
    // Clear the numeric input to trigger isNaN branch
    await dtPage.setFeature1(''); // empty string -> NaN in parseFloat

    // Ensure feature2 has a valid value
    await dtPage.selectFeature2('Red');

    // Submit the form
    await dtPage.submitForm();

    // Expect the specific message for invalid numeric input
    const predictionText2 = await dtPage.getPredictionText();
    expect(predictionText).toBe('Please provide a valid number for Feature 1.');

    // Because the function returns early on invalid numeric input, highlightPath should not have been called
    const highlighted3 = await dtPage.getHighlightedNodeAriaLabels();
    // All rects should have their default fill (#e0f7fa) — no highlighted nodes
    expect(highlighted.length).toBe(0);

    // No uncaught errors should have been thrown when handling invalid input
    expect(pageErrors).toHaveLength(0);
  });

  test('Edge case: missing categorical selection shows required-selection message', async () => {
    // This test ensures that when feature2 is not selected, the form indicates the issue.

    // Use a valid numeric value
    await dtPage.setFeature1(5);

    // Select the empty option (value "")
    await dtPage.selectFeature2(''); // selects the "Select" placeholder option

    // Submit the form
    await dtPage.submitForm();

    // Expect the specific message for missing categorical selection
    const predictionText3 = await dtPage.getPredictionText();
    expect(predictionText).toBe('Please select a value for Feature 2.');

    // No nodes should be highlighted when form validation fails
    const highlighted4 = await dtPage.getHighlightedNodeAriaLabels();
    expect(highlighted.length).toBe(0);

    expect(pageErrors).toHaveLength(0);
  });

  test('Edge case: unknown categorical value (not in tree) yields Unknown category handling', async () => {
    // This test programmatically sets a category that isn't present in the tree branches and verifies the message.

    // Choose feature1 that goes to the left branch (<= 10) so feature2 branch is consulted
    await dtPage.setFeature1(5);

    // Programmatically set feature2 to a value not present in the select options (e.g., "Yellow")
    // We intentionally set the value directly to emulate unexpected input (the page does not validate against allowed options)
    await dtPage.setFeature2Raw('Yellow');

    // Submit the form
    await dtPage.submitForm();

    // The classifyInput returns "Unknown category" and the submit handler maps that to a user-facing message
    const predictionText4 = await dtPage.getPredictionText();
    expect(predictionText).toBe('Input category for Feature 2 not recognized by the tree.');

    // Because category is unknown, highlightPath should not highlight a leaf for that category
    const highlighted5 = await dtPage.getHighlightedNodeAriaLabels();
    // It may still highlight the root depending on implementation; we assert it does not highlight a leaf predicting a class
    const predictsClass = highlighted.some(label => label && (label.includes('Class A') || label.includes('Class B')));
    expect(predictsClass).toBeFalsy();

    expect(pageErrors).toHaveLength(0);
  });

  test('Observability: capture console messages and ensure no uncaught exceptions were emitted during lifecycle', async () => {
    // This test simply validates that the page did not emit unhandled errors and collects console messages.
    // We don't assert on specific console messages since the page does not intentionally log, but we ensure no page errors.

    // Already loaded in beforeEach. Just ensure the arrays are accessible and check for errors.
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // No uncaught page errors during the lifecycle
    expect(pageErrors).toHaveLength(0);

    // As an additional check, ensure that if any console messages exist, they are strings and types are known
    for (const msg of consoleMessages) {
      expect(typeof msg.text).toBe('string');
      expect(typeof msg.type).toBe('string');
    }
  });
});