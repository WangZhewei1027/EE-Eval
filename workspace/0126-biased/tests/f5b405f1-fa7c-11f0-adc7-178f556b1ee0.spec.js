import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b405f1-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object Model for the Decision Trees app
class DecisionTreesPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('#demo-button');
    this.interactivity = page.locator('#interactivity');
    this.paragraphs = {
      concept: page.locator('#concept'),
      theory: page.locator('#theory'),
      algorithms: page.locator('#algorithms'),
      textualExplanations: page.locator('#textual-explanations'),
      educationalContent: page.locator('#educational-content'),
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickDemo() {
    await this.demoButton.click();
  }

  async getInteractivityHTML() {
    return await this.interactivity.evaluate((el) => el.innerHTML);
  }

  async getParagraphText(id) {
    if (!this.paragraphs[id]) throw new Error(`Unknown paragraph id ${id}`);
    return await this.paragraphs[id].innerText();
  }

  // Calls a function defined on the page and returns its result
  async evalOnPage(fn, ...args) {
    return await this.page.evaluate(fn, ...args);
  }
}

// Grouping tests related to the FSM and the interactive app
test.describe('Decision Trees FSM and Interactivity (f5b405f1-fa7c-11f0-adc7-178f556b1ee0)', () => {
  let pageErrors = [];
  let consoleErrors = [];

  // Setup + teardown for each test
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture unhandled page errors (e.g., ReferenceError, TypeError, SyntaxError)
    page.on('pageerror', (err) => {
      // store full error object for diagnostics
      pageErrors.push(err);
    });

    // Capture console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      }
    });

    // Navigate to the page under test
    const dtPage = new DecisionTreesPage(page);
    await dtPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // Ensure we detach listeners if needed (Playwright cleans up pages automatically).
    // We assert on captured errors in dedicated tests below.
  });

  test('Initial state (S0_Idle) - page renders and demo button exists', async ({ page }) => {
    // This test validates the Idle state: UI renders, textual content is present, and interactivity area is empty.
    const dt = new DecisionTreesPage(page);

    // Verify demo button is present and visible
    await expect(dt.demoButton).toBeVisible();
    await expect(dt.demoButton).toHaveText('Explore Decision Trees');

    // Verify the informational paragraphs are rendered and non-empty
    const concept = await dt.getParagraphText('concept');
    const theory = await dt.getParagraphText('theory');
    const algorithms = await dt.getParagraphText('algorithms');
    const textual = await dt.getParagraphText('textualExplanations');
    const educational = await dt.getParagraphText('educationalContent');

    expect(concept.trim().length).toBeGreaterThan(0);
    expect(theory.trim().length).toBeGreaterThan(0);
    expect(algorithms.trim().length).toBeGreaterThan(0);
    expect(textual.trim().length).toBeGreaterThan(0);
    expect(educational.trim().length).toBeGreaterThan(0);

    // Interactivity div should be empty initially (Idle state -> renderPage())
    const initialInteractivity = await dt.getInteractivityHTML();
    expect(initialInteractivity.trim()).toBe('');

    // Ensure no runtime errors were emitted during initial load
    expect(pageErrors.length, `Unexpected page errors on load: ${pageErrors.map(e => e.toString()).join('\n')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages on load: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Transition (ExploreDecisionTrees) - clicking the demo button builds and displays a tree (S1_TreeDisplayed)', async ({ page }) => {
    // This test simulates the user event ExploreDecisionTrees and validates the transition to Tree Displayed.
    const dt = new DecisionTreesPage(page);

    // Click the demo button to trigger buildDecisionTree(data) and displayTree(tree)
    await dt.clickDemo();

    // Wait for interactivity to be populated - the implementation sets innerHTML synchronously,
    // but waitFor expects DOM change for safety across environments.
    await page.waitForFunction(() => {
      const el = document.getElementById('interactivity');
      return el && el.innerHTML.trim().length > 0;
    });

    const html = await dt.getInteractivityHTML();

    // Validate that the displayTree wrote something into the interactivity div.
    expect(html.trim().length).toBeGreaterThan(0);

    // Validate that at least the feature name used in the demo data ("age") appears in the displayed tree.
    // The FSM expected "Decision tree displayed in the interactivity div."
    expect(html).toContain('age');

    // Validate that displayTree set document.getElementById("interactivity").innerHTML (evidence)
    const interactivityInner = await page.evaluate(() => document.getElementById('interactivity').innerHTML);
    expect(interactivityInner).toBe(html);

    // Verify page-level functions exist and behaved during the click:
    const buildType = await dt.evalOnPage(() => typeof buildDecisionTree);
    const displayType = await dt.evalOnPage(() => typeof displayTree);
    expect(buildType).toBe('function');
    expect(displayType).toBe('function');

    // Ensure no runtime errors occurred during transition
    expect(pageErrors.length, `Unexpected page errors during click: ${pageErrors.map(e => e.toString()).join('\n')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages during click: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Functions behavior and edge cases - buildDecisionTree/displayTree validation', async ({ page }) => {
    // This test inspects the onEnter action buildDecisionTree(data) and displayTree side-effects,
    // and tests edge cases like empty input.
    const dt = new DecisionTreesPage(page);

    // Verify buildDecisionTree returns an object for the demo data by invoking it directly in page context
    const demoData = [
      { feature: 'age', value: 25 },
      { feature: 'age', value: 30 },
      { feature: 'age', value: 35 }
    ];
    const treeResult = await dt.evalOnPage((data) => {
      // Access the global buildDecisionTree defined in the page
      return buildDecisionTree(data);
    }, demoData);

    // The simple implementation is expected to return an object (possibly with keys)
    expect(typeof treeResult).toBe('object');
    expect(treeResult).not.toBeNull();

    // Edge case: empty data should return an object (likely empty)
    const emptyTree = await dt.evalOnPage((data) => buildDecisionTree(data), []);
    expect(typeof emptyTree).toBe('object');
    // usually empty object, so JSON.stringify should be "{}" or similar
    expect(JSON.stringify(emptyTree)).toBe('{}');

    // Call displayTree with an empty tree - it should set interactivity.innerHTML to empty string and return undefined
    const displayReturn = await dt.evalOnPage(() => {
      const ret = displayTree({});
      return { returned: ret, htmlAfter: document.getElementById('interactivity').innerHTML };
    });
    expect(displayReturn.returned).toBeUndefined();
    expect(displayReturn.htmlAfter).toBe('');

    // Ensure no runtime errors throughout these function calls
    expect(pageErrors.length, `Unexpected page errors during function tests: ${pageErrors.map(e => e.toString()).join('\n')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages during function tests: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Edge cases and robustness - multiple rapid clicks should not crash the page', async ({ page }) => {
    // This test clicks the demo button multiple times (rapidly) to ensure the transition is stable and idempotent.
    const dt = new DecisionTreesPage(page);

    // Click the demo button multiple times
    await Promise.all([
      dt.clickDemo(),
      dt.clickDemo(),
      dt.clickDemo()
    ]);

    // Wait a short while for DOM updates; displayTree is synchronous but we wait for safety.
    await page.waitForTimeout(200);

    const html = await dt.getInteractivityHTML();
    expect(html.trim().length).toBeGreaterThan(0);
    expect(html).toContain('age');

    // Validate that multiple clicks did not produce unhandled exceptions
    expect(pageErrors.length, `Unexpected page errors after multiple clicks: ${pageErrors.map(e => e.toString()).join('\n')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages after multiple clicks: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Observability: ensure no ReferenceError/SyntaxError/TypeError occurred during full scenario', async ({ page }) => {
    // This test explicitly asserts that no severe errors (ReferenceError, SyntaxError, TypeError) occurred.
    // We allow the app to run through a full interaction sequence (load + click) and then inspect errors.

    const dt = new DecisionTreesPage(page);
    // Perform the primary interaction
    await dt.clickDemo();
    await page.waitForFunction(() => {
      const el = document.getElementById('interactivity');
      return el && el.innerHTML.trim().length > 0;
    });

    // Inspect captured pageErrors for specific error types
    const foundProblematic = pageErrors.filter((err) => {
      // err.name may be 'ReferenceError', 'TypeError', etc.
      return ['ReferenceError', 'TypeError', 'SyntaxError'].includes(err.name);
    });

    // If any such errors exist, fail the test with details. Otherwise assert zero.
    expect(foundProblematic.length, `Detected runtime errors: ${foundProblematic.map(e => `${e.name}: ${e.message}`).join('; ')}`).toBe(0);

    // Also ensure there were no console.error messages emitted
    expect(consoleErrors.length, `Detected console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });
});