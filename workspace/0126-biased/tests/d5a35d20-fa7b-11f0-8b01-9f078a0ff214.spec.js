import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a35d20-fa7b-11f0-8b01-9f078a0ff214.html';

/**
 * Simple Page Object for the Random Forest example page.
 * Encapsulates selectors and common interactions to keep tests readable.
 */
class RandomForestPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator("button[onclick='showExample()']");
    this.output = page.locator('#exampleOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtonText() {
    return this.button.innerText();
  }

  async getButtonOnclickAttribute() {
    return this.button.getAttribute('onclick');
  }

  async clickToggle() {
    await this.button.click();
  }

  async isOutputVisible() {
    // Playwright's isVisible checks computed styles and DOM.
    return this.output.isVisible();
  }

  async getOutputComputedDisplay() {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).display;
    }, '#exampleOutput');
  }

  async getOutputText() {
    return this.output.innerText();
  }
}

test.describe('Understanding Random Forest Algorithm - FSM and UI tests', () => {
  // Arrays to collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors from the page for assertions later.
    page.on('console', (msg) => {
      // Save the console message object for more detailed inspection in tests.
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });

    page.on('pageerror', (error) => {
      // Save page error objects (uncaught exceptions)
      pageErrors.push(error);
    });
  });

  test.afterEach(async () => {
    // Nothing to tear down explicitly; listeners are tied to page and cleared by Playwright fixtures.
  });

  test('Initial Idle state: button present and example output is hidden', async ({ page }) => {
    // This test validates the S0_Idle state per FSM:
    // - The page renders a button with onclick handler showExample()
    // - The example output (#exampleOutput) is present but initially hidden (display: none)
    const rf = new RandomForestPage(page);

    await rf.goto();

    // Validate button presence and text
    await expect(rf.button).toBeVisible();
    const btnText = await rf.getButtonText();
    expect(btnText).toContain('Show a Simple Random Forest Example');

    // Validate button has the expected onclick attribute referring to showExample()
    const onclickAttr = await rf.getButtonOnclickAttribute();
    expect(onclickAttr).toBe('showExample()');

    // Validate output exists in DOM and is hidden initially
    await expect(rf.output).toBeVisible({ timeout: 1 }).catch(() => {}); // intentionally ignore visibility assert; we'll check computed style
    const display = await rf.getOutputComputedDisplay();
    expect(display === 'none' || display === '').toBeTruthy();

    // Validate content inside the output matches the FSM description
    const outputText = await rf.getOutputText();
    expect(outputText).toContain('This is a simple demonstration of how Random Forest aggregates predictions');

    // Ensure no uncaught page errors occurred during initial render
    expect(pageErrors.length).toBe(0);

    // Ensure console has no messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('ShowExample event transitions to Example Visible (S0_Idle -> S1_ExampleVisible)', async ({ page }) => {
    // This test validates the transition triggered by clicking the button once.
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Precondition: output hidden
    expect(await rf.isOutputVisible()).toBe(false);

    // Click the button to trigger showExample()
    await rf.clickToggle();

    // After click: output should be visible (display: block)
    expect(await rf.isOutputVisible()).toBe(true);
    const display = await rf.getOutputComputedDisplay();
    expect(display).toBe('block');

    // No page errors or console errors should have been emitted during the interaction
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('ShowExample toggles back to Example Hidden (S1_ExampleVisible -> S2_ExampleHidden)', async ({ page }) => {
    // Validate that clicking again hides the example (toggle behavior).
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Make visible first
    await rf.clickToggle();
    expect(await rf.isOutputVisible()).toBe(true);

    // Click again to hide
    await rf.clickToggle();
    expect(await rf.isOutputVisible()).toBe(false);
    const display = await rf.getOutputComputedDisplay();
    // The implementation sets display to 'none' explicitly when hiding.
    expect(display).toBe('none');

    // Validate no runtime page errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Toggle multiple times: S2 -> S1 -> S2 -> S1 (multiple transitions)', async ({ page }) => {
    // Validate repeated transitions across the FSM states are stable and deterministic.
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Sequence: initial hidden -> click -> visible -> click -> hidden -> click -> visible
    expect(await rf.isOutputVisible()).toBe(false);

    await rf.clickToggle(); // 1 -> visible
    expect(await rf.isOutputVisible()).toBe(true);

    await rf.clickToggle(); // 2 -> hidden
    expect(await rf.isOutputVisible()).toBe(false);

    await rf.clickToggle(); // 3 -> visible
    expect(await rf.isOutputVisible()).toBe(true);

    // Final display should be 'block'
    expect(await rf.getOutputComputedDisplay()).toBe('block');

    // Ensure no console or page errors across the interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: rapid double-click should result in two toggles (end up in original state)', async ({ page }) => {
    // This test attempts to simulate a rapid double-click scenario.
    // If the control simply toggles on each click, two rapid clicks should return to the initial state.
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Ensure initial hidden
    expect(await rf.isOutputVisible()).toBe(false);

    // Rapid double click: fire two click requests without awaiting between them.
    // Use Promise.all to send two click events in quick succession.
    await Promise.all([
      rf.button.click(),
      rf.button.click()
    ]);

    // After two toggles, we should be back to hidden
    expect(await rf.isOutputVisible()).toBe(false);
    expect(await rf.getOutputComputedDisplay()).toBe('none');

    // No page errors introduced by rapid interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('DOM mutation validation: button and output elements exist and maintain expected attributes', async ({ page }) => {
    // This test ensures structural invariants: selectors remain present and attributes are unchanged.
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Button is still in the DOM and has same onclick
    await expect(rf.button).toBeAttached();
    const onclick = await rf.getButtonOnclickAttribute();
    expect(onclick).toBe('showExample()');

    // Output element exists with the expected id and class
    await expect(rf.output).toBeAttached();
    const id = await rf.output.getAttribute('id');
    const cls = await rf.output.getAttribute('class');
    expect(id).toBe('exampleOutput');
    expect(cls).toContain('output');

    // Text content includes the explanation about majority vote
    const text = await rf.getOutputText();
    expect(text).toContain('majority vote results in \'Yes\'');
  });

  test('Monitoring console and page errors across the full usage scenario', async ({ page }) => {
    // This test performs a series of interactions and then inspects collected console messages and page errors.
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Perform a set of interactions: show, hide, show
    await rf.clickToggle();
    await rf.clickToggle();
    await rf.clickToggle();

    // Wait a short moment for any async errors to surface in the console/pageerror events
    await page.waitForTimeout(100);

    // We expect that the implementation does not emit ReferenceError/SyntaxError/TypeError for normal usage.
    // Collect any console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    if (consoleErrors.length > 0) {
      // If errors exist, fail the test with details for debugging.
      const messages = consoleErrors.map(m => `${m.type}: ${m.text} @ ${JSON.stringify(m.location)}`).join('\n');
      throw new Error(`Unexpected console errors were emitted:\n${messages}`);
    }

    // Also ensure no uncaught page errors
    if (pageErrors.length > 0) {
      const details = pageErrors.map(e => e.message).join('\n');
      throw new Error(`Unexpected page errors occurred:\n${details}`);
    }

    // As an explicit assertion if there are truly no errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Negative/robustness: verify behavior when element styles are manipulated externally', async ({ page }) => {
    // This test attempts to mutate the element style from the test (simulating an external script)
    // and then uses the page's own toggle function to see how it behaves.
    // NOTE: We do not modify page JS functions; we only mutate DOM styles (allowed).
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Force the output element to have an inline style different from expected initial ('display: none;')
    await page.evaluate(() => {
      const out = document.getElementById('exampleOutput');
      if (out) {
        out.style.display = 'inline'; // non-expected display value
      }
    });

    // Now click the button which uses the toggling logic relying on (output.style.display === 'none' || output.style.display === '')
    // With 'inline' present, the logic should set it to 'none' (since it's neither 'none' nor '')
    await rf.clickToggle();

    // After clicking, the implementation toggles based on the exact check, so it should set to 'none' here.
    const displayAfter = await rf.getOutputComputedDisplay();
    expect(displayAfter).toBe('none');

    // Click again should toggle to 'block'
    await rf.clickToggle();
    const displayAfter2 = await rf.getOutputComputedDisplay();
    expect(displayAfter2).toBe('block');

    // Check no runtime errors were generated by these manipulations
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});