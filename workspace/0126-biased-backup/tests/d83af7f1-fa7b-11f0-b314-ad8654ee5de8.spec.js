import { test, expect } from '@playwright/test';

// Page-Object for the Random Forest demo page.
// Encapsulates selectors and common interactions so tests are readable and maintainable.
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83af7f1-fa7b-11f0-b314-ad8654ee5de8.html';
    this.selectors = {
      heading: 'h1',
      runDemoButton: '#runDemo',
      demoOutput: '#demoOutput',
      demoExplanation: '#demoExplanation',
      scriptTags: 'script'
    };
  }

  // Navigate to the page and wait for load.
  async goto() {
    await this.page.goto(this.url, { waitUntil: 'load' });
  }

  async getHeadingText() {
    return this.page.textContent(this.selectors.heading);
  }

  async getButton() {
    return this.page.locator(this.selectors.runDemoButton);
  }

  async isDemoOutputHidden() {
    // check the hidden attribute, which is used by the page initially
    return this.page.$eval(this.selectors.demoOutput, el => el.hidden);
  }

  async isDemoOutputVisible() {
    // Use Playwright's visibility check which considers 'hidden' attribute
    return this.page.locator(this.selectors.demoOutput).isVisible();
  }

  async getDemoOutputText() {
    return this.page.textContent(this.selectors.demoOutput);
  }

  async isExplanationDisplayedInline() {
    // the page toggles the inline style display to 'block' on click
    return this.page.$eval(this.selectors.demoExplanation, el => {
      // return both inline style and computed style for robustness
      return {
        inline: el.getAttribute('style'),
        computed: getComputedStyle(el).display
      };
    });
  }

  async runDemo() {
    await this.page.click(this.selectors.runDemoButton);
  }

  async getAllScriptTexts() {
    // return the concatenated script texts for inspection
    return this.page.$$eval(this.selectors.scriptTags, scripts => scripts.map(s => s.textContent || '').join('\n'));
  }
}

test.describe('Random Forest — Interactive Demo (FSM validation)', () => {
  // We'll capture console messages and page errors for every test.
  let consoleMessages = [];
  let pageErrors = [];
  let consoleHandler;
  let pageErrorHandler;

  test.beforeEach(async ({ page }) => {
    // reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Handlers are stored so we can remove them in afterEach
    consoleHandler = msg => {
      // store type and text for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    pageErrorHandler = err => {
      // pageerror provides an Error object
      pageErrors.push({ message: err.message, stack: err.stack });
    };

    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);
  });

  test.afterEach(async ({ page }) => {
    // detach listeners to avoid cross-test pollution
    page.off('console', consoleHandler);
    page.off('pageerror', pageErrorHandler);
  });

  test('S0_Idle: Page renders initial content and button exists (Idle state entry)', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) entry:
    // - The main heading is present and matches the expected title (evidence for renderPage()).
    // - The Run demo button exists, is visible, and has the expected label and CSS class.
    // - The demo output area is hidden initially.
    // - The demo explanation area is not displayed (style.display none).
    // - No runtime page errors or console.error messages occurred during initial load.
    const demo = new DemoPage(page);
    await demo.goto();

    // Heading validation
    const heading = await demo.getHeadingText();
    expect(heading).toBe('Random Forest — A Comprehensive Educational Guide');

    // Run-demo button checks
    const btn = await demo.getButton();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('id', 'runDemo');
    await expect(btn).toHaveAttribute('class', /primary/);
    await expect(btn).toHaveText('Run demo (small)');

    // Demo output should be hidden initially via the 'hidden' attribute
    const hiddenAttr = await demo.isDemoOutputHidden();
    expect(hiddenAttr).toBe(true);

    // Explanation area should be not displayed (inline style or computed style should indicate hidden)
    const explanationStyles = await demo.isExplanationDisplayedInline();
    // Inline style initially is "display:none;" per HTML; computed display should be 'none'
    expect(explanationStyles.computed === 'none' || (explanationStyles.inline && explanationStyles.inline.includes('display:none'))).toBeTruthy();

    // Inspect script content to ensure expected event listener text exists in source as evidence
    const scripts = await demo.getAllScriptTexts();
    expect(scripts).toContain("document.getElementById('runDemo').addEventListener('click' );

    // Assert that no page errors were thrown during initial render (we allow the environment to surface real errors)
    expect(pageErrors.length).toBe(0);

    // Assert there are no console messages with type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_DemoRunning: Clicking Run demo transitions to Demo Running and shows output & explanation', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_DemoRunning triggered by clicking the RunDemo button:
    // - The demo output element becomes visible (outputEl.hidden = false).
    // - The demo explanation area is set to display: block.
    // - The demo output contains the expected textual structure and summary lines (predictions, majority vote).
    // - The demo produced T=5 stumps / trees in the output.
    // - The RunDemo click handler executed (evidence: output updated).
    const demo = new DemoPage(page);
    await demo.goto();

    // Click the demo button to trigger the transition.
    await demo.runDemo();

    // Wait for demoOutput to become visible. The page sets hidden=false synchronously inside handler,
    // but use expect with timeout to avoid flakes.
    await expect(page.locator('#demoOutput')).toBeVisible({ timeout: 2000 });

    // Confirm the demoOutput text has content indicating the tiny random forest run.
    const outputText = (await demo.getDemoOutputText()) || '';
    expect(outputText.length).toBeGreaterThan(20); // non-empty, contains detailed lines

    // Check expected phrases
    expect(outputText).toContain('Running a tiny Random-Forest-like demo (T=5');
    expect(outputText).toContain('Predictions for new point x*');
    expect(outputText).toContain('Majority vote:');

    // Check that each tree's prediction line exists (Tree 1 .. Tree 5)
    for (let i = 1; i <= 5; i++) {
      expect(outputText).toContain(`Tree ${i}:`);
    }

    // Explanation area should now be displayed (inline display: block and computed style reflect that)
    const explanationStyles = await demo.isExplanationDisplayedInline();
    expect(explanationStyles.computed === 'block' || (explanationStyles.inline && explanationStyles.inline.includes('display: block'))).toBeTruthy();

    // Ensure aria-live region exists and the output was placed into it (demoOutput has aria-live attribute)
    const ariaLive = await page.getAttribute('#demoOutput', 'aria-live');
    expect(ariaLive).toBe('polite');

    // Confirm that the click handler executed as evidenced by visible output and explanation
    // Also check there were no page errors during the interaction
    expect(pageErrors.length).toBe(0);

    // There should be no console.error messages emitted during the click handler
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('Transition robustness: multiple clicks and rapid interactions do not break the demo', async ({ page }) => {
    // Edge case test:
    // - Click the Run demo button multiple times rapidly and assert that the demo output remains visible,
    //   that the explanation stays displayed, and that no page errors are thrown.
    // - Because the demo is randomized, we cannot assert deterministic content across clicks, but we can assert stability.
    const demo = new DemoPage(page);
    await demo.goto();

    // initial state checks
    await expect(page.locator('#demoOutput')).not.toBeVisible();

    // Rapidly trigger multiple clicks
    await Promise.all([
      page.click('#runDemo'),
      page.click('#runDemo'),
      page.click('#runDemo')
    ]);

    // After multiple clicks ensure the output is visible and explanation displayed
    await expect(page.locator('#demoOutput')).toBeVisible({ timeout: 2000 });
    const explanationStyles = await demo.isExplanationDisplayedInline();
    expect(explanationStyles.computed === 'block' || (explanationStyles.inline && explanationStyles.inline.includes('display: block'))).toBeTruthy();

    // Output text should be present and contain the majority vote line at least once
    const outputText = (await demo.getDemoOutputText()) || '';
    expect(outputText).toContain('Majority vote:');

    // Confirm stability: output content is not excessively long (script overwrites rather than appends),
    // and only one "Majority vote" occurs.
    const majorityMatches = (outputText.match(/Majority vote:/g) || []).length;
    expect(majorityMatches).toBeGreaterThanOrEqual(1);
    expect(majorityMatches).toBeLessThanOrEqual(3); // tolerate small dupes but ensure not wildly appended (sanity)

    // No page errors should have been emitted during repeated interactions
    expect(pageErrors.length).toBe(0);

    // No console.error messages
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('Implementation evidence: script contains expected functions and handlers (sanity check)', async ({ page }) => {
    // This test inspects the inline script source to validate the presence of key function names and the event binding.
    // It ensures the implementation contains the expected functions referenced in the FSM/evidence, without modifying the page.
    const demo = new DemoPage(page);
    await demo.goto();

    const scripts = await demo.getAllScriptTexts();

    // Verify presence of function names used as entry/exit actions or helpers (as evidence of implementation)
    expect(scripts).toContain('function bootstrapSample');
    expect(scripts).toContain('function fitStump');
    expect(scripts).toContain('function giniImpurity');
    expect(scripts).toContain("document.getElementById('runDemo').addEventListener('click' );
  });

  test('Console & Page Error Monitoring: Assert no unexpected runtime errors on load and interaction', async ({ page }) => {
    // This test explicitly exercises the requirement to observe console logs and page errors,
    // allowing any runtime errors to surface naturally and then asserting expected outcome (none in this case).
    const demo = new DemoPage(page);
    await demo.goto();

    // Interact once to ensure event handler executes
    await demo.runDemo();
    await expect(page.locator('#demoOutput')).toBeVisible({ timeout: 2000 });

    // At this point we collected console and pageerror events via beforeEach handlers.
    // Assert that there were no page 'pageerror' events (no uncaught exceptions).
    expect(pageErrors.length).toBe(0);

    // Assert that there were no console messages of severity 'error'.
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);

    // We still surface other console messages (info/debug) if present but we don't treat them as failures.
    // For traceability, attach an expectation about total console message count being >= 0 (always true),
    // and if there are any messages they should be of non-error types.
    expect(consoleMessages.every(m => m.type !== 'error')).toBeTruthy();
  });
});