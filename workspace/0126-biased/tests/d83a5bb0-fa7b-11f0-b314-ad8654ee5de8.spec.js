import { test, expect } from '@playwright/test';

// Page object model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83a5bb0-fa7b-11f0-b314-ad8654ee5de8.html';
    this.runDemoSelector = '#runDemo';
    this.demoResultSelector = '#demoResult';
  }

  async goto() {
    await this.page.goto(this.url);
    // Wait for main interactive elements to be available
    await this.page.waitForSelector(this.runDemoSelector, { state: 'visible' });
    await this.page.waitForSelector(this.demoResultSelector);
  }

  async clickRunDemo() {
    await this.page.click(this.runDemoSelector);
  }

  async getButtonText() {
    return this.page.locator(this.runDemoSelector).innerText();
  }

  async isDemoVisible() {
    // Use computed style to check display property
    return this.page.$eval(this.demoResultSelector, el => {
      return window.getComputedStyle(el).display !== 'none';
    });
  }

  async getDemoText() {
    return this.page.$eval(this.demoResultSelector, el => el.textContent);
  }

  async getDemoDisplayStyle() {
    return this.page.$eval(this.demoResultSelector, el => window.getComputedStyle(el).display);
  }
}

test.describe('Static Typing — Demo FSM (d83a5bb0-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Containers for console messages and page errors observed during each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages and page errors to observe runtime behavior.
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // Basic sanity: ensure no unexpected page-level errors (ReferenceError, SyntaxError, TypeError)
    // We assert none occurred; the application should run without runtime script errors.
    const errorTypesOfInterest = ['ReferenceError', 'SyntaxError', 'TypeError'];

    // Collect any console messages that look like errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' ||
      errorTypesOfInterest.some(t => m.text.includes(t)));

    // If there were pageErrors or consoleErrors, include details in assertion message for easier debugging
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors: ${consoleErrors.map(c => c.text).join(' | ')}`).toBe(0);
  });

  test('Initial state S0_Idle: Run demo button present and demo result hidden', async ({ page }) => {
    // Validate initial "Idle" state described in FSM:
    // - The Run demo button should be present with the expected label.
    // - The demo result region should exist, be empty, and be hidden (display:none).
    const demo = new DemoPage(page);
    await demo.goto();

    // Button existence and text
    const button = page.locator(demo.runDemoSelector);
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Run demo: infer types');

    // demoResult should be present but hidden and empty
    const demoResult = page.locator(demo.demoResultSelector);
    await expect(demoResult).toBeHidden();

    // Ensure it's empty initially
    const text = await demoResult.textContent();
    expect(text === null || text.trim() === '' , 'demoResult should start empty').toBe(true);

    // Assert no runtime page errors or console errors were observed during initial load.
    // (Detailed assertions performed in afterEach.)
  });

  test('Transition S0_Idle -> S1_DemoVisible: Clicking Run demo shows the demo and populates content', async ({ page }) => {
    // Validate that clicking the button:
    // - Sets demoResult.style.display = 'block' (visible)
    // - Populates the textual demo output
    // - Changes the button text to "Hide demo"
    const demo = new DemoPage(page);
    await demo.goto();

    // Click to show demo (trigger RunDemoClick event)
    await demo.clickRunDemo();

    // The UI should update: demo area visible
    const visible = await demo.isDemoVisible();
    expect(visible, 'demoResult should be visible after clicking Run demo').toBe(true);

    // The button label should change to "Hide demo"
    const btnText = await demo.getButtonText();
    expect(btnText).toBe('Hide demo');

    // The demo text should contain the expected header and at least one example result line
    const demoText = await demo.getDemoText();
    expect(demoText).toBeTruthy();
    expect(demoText).toContain('Simple Static Type Inference Demo (textual, deterministic)');
    expect(demoText).toContain('Example 1: Identity function and applications');

    // Verify the FSM's onEnter-like actions:
    // Entry action for DemoVisible included: out.style.display = 'block'; out.textContent = '';
    // We verify display is 'block' and that textContent is non-empty (populated by the script after clearing).
    const displayStyle = await demo.getDemoDisplayStyle();
    expect(displayStyle === 'block' || displayStyle === 'inline' || displayStyle === 'inline-block' || displayStyle === 'flex')
      .toBeTruthy();

    // After clicking to show, no page errors should have occurred (checked in afterEach).
  });

  test('Transition S1_DemoVisible -> S0_Idle: Clicking Hide demo hides the demo result', async ({ page }) => {
    // Validate toggling back to Idle:
    // - When in DemoVisible, clicking the button again hides the demo (out.style.display = 'none')
    // - The button text returns to original "Run demo: infer types"
    const demo = new DemoPage(page);
    await demo.goto();

    // Show first
    await demo.clickRunDemo();
    await expect(page.locator(demo.demoResultSelector)).toBeVisible();

    // Click again to hide (trigger the transition back)
    await demo.clickRunDemo();

    // The demo result area should be hidden again
    const display = await demo.getDemoDisplayStyle();
    expect(display).toBe('none');

    // Button text should revert
    const btnText = await demo.getButtonText();
    expect(btnText).toBe('Run demo: infer types');

    // The textual content may remain in the DOM but should not be visible; ensure that hiding is achieved via display:none
    const demoText = await demo.getDemoText();
    // textContent may still be populated; assert it's a string (could be empty or previous content)
    expect(typeof demoText === 'string').toBe(true);
  });

  test('Edge cases: rapid toggling and repeated clicks do not cause runtime errors and maintain consistent state', async ({ page }) => {
    // Simulate multiple quick clicks and ensure the FSM toggles deterministically without throwing errors.
    const demo = new DemoPage(page);
    await demo.goto();

    // Rapidly click the button 5 times with small pauses to mimic user behavior
    for (let i = 0; i < 5; i++) {
      await demo.clickRunDemo();
      // small pause to allow the UI to update
      await page.waitForTimeout(80);
    }

    // After 5 toggles, the visibility is deterministic: starting hidden, odd number of clicks -> visible
    const expectedVisible = (5 % 2) === 1;
    const actualVisible = await demo.isDemoVisible();
    expect(actualVisible).toBe(expectedVisible);

    // Check the button label matches the visible state
    const btnText = await demo.getButtonText();
    if (expectedVisible) {
      expect(btnText).toBe('Hide demo');
    } else {
      expect(btnText).toBe('Run demo: infer types');
    }

    // No runtime page errors or console errors should have been emitted during rapid toggling (checked in afterEach).
  });

  test('Content semantics: the demo output contains all three predefined examples and their results', async ({ page }) => {
    // Ensure the textual demo includes all three examples and their respective result lines when shown.
    const demo = new DemoPage(page);
    await demo.goto();

    await demo.clickRunDemo();
    await expect(page.locator(demo.demoResultSelector)).toBeVisible();

    const dd = await demo.getDemoText();
    expect(dd).toContain('Example 1: Identity function and applications');
    expect(dd).toContain('Example 2: Function composition (simple)');
    expect(dd).toContain('Example 3: Ill-typed example (type error)');

    // Verify specific expected result fragments
    expect(dd).toContain('Inferred: id : ∀t. t -> t ; a : int ; b : bool');
    expect(dd).toContain('Inferred: incThenDouble : int -> int');
    expect(dd).toContain('Compile-time error: cannot apply function expecting int to a value of type bool');
  });

  test('Accessibility: demo result region has role and aria-live attributes and is present in the DOM', async ({ page }) => {
    // Validate that the demoResult element includes the ARIA attributes specified in the FSM/components.
    const demo = new DemoPage(page);
    await demo.goto();

    const locator = page.locator(demo.demoResultSelector);
    await expect(locator).toHaveAttribute('role', 'region');
    await expect(locator).toHaveAttribute('aria-live', 'polite');

    // style attribute initially should indicate display:none per the HTML
    const styleAttr = await locator.getAttribute('style');
    expect(styleAttr).toContain('display:none');

    // Show and ensure aria-live is still present
    await demo.clickRunDemo();
    await expect(locator).toHaveAttribute('aria-live', 'polite');
  });

  test('Observability: no console ReferenceError/SyntaxError/TypeError messages emitted on load and interactions', async ({ page }) => {
    // This test explicitly exercises page interactions and then asserts (again) that no console messages
    // contain common runtime error types. The afterEach will also enforce this, but we include an explicit check here.
    const demo = new DemoPage(page);
    await demo.goto();

    // Interact: show and hide demo
    await demo.clickRunDemo();
    await demo.clickRunDemo();
    await demo.clickRunDemo();

    // Inspect collected console messages and page errors captured during this test's lifecycle
    // (Note: the actual arrays are validated in afterEach; here we do an inline check for clarity.)
    const errorTypesOfInterest = ['ReferenceError', 'SyntaxError', 'TypeError'];
    const consoleErrors = consoleMessages.filter(m =>
      m.type === 'error' || errorTypesOfInterest.some(t => m.text.includes(t))
    );

    expect(consoleErrors.length, `No console errors of type ReferenceError/SyntaxError/TypeError expected, found: ${consoleErrors.map(c => c.text).join(' | ')}`).toBe(0);
    expect(pageErrors.length, `No page errors expected, found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });
});