import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8348f51-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the demo toggle area
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoButton');
    this.demo = page.locator('#demoArea');
    this.demoSteps = page.locator('#demoArea .step');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtonText() {
    return await this.button.textContent();
  }

  async isDemoVisible() {
    // Check inline style first; fallback to computed style
    const inline = await this.demo.getAttribute('style');
    if (inline && inline.includes('display')) {
      // parse inline style for display value
      const match = inline.match(/display\s*:\s*([^;]+)/);
      if (match) return match[1].trim() !== 'none';
    }
    // fallback to computed style
    const display = await this.page.evaluate(el => {
      return window.getComputedStyle(el).getPropertyValue('display');
    }, await this.demo.elementHandle());
    return display !== 'none';
  }

  async getAriaExpanded() {
    return await this.button.getAttribute('aria-expanded');
  }

  async getAriaHidden() {
    return await this.demo.getAttribute('aria-hidden');
  }

  async clickToggle() {
    await this.button.click();
  }

  async demoContainsText(substring) {
    return await this.page.locator('#demoArea').innerText().then(text => text.includes(substring));
  }

  async demoStepCount() {
    return await this.demoSteps.count();
  }
}

// Group tests around the FSM states and transitions
test.describe('Merge Sort demo toggle - FSM validation', () => {
  // Collect console messages and page errors for each test to assert there are no uncaught exceptions
  test.beforeEach(async ({ page }) => {
    // Attach listeners to capture console messages and page errors for assertions
    page['_consoleMessages'] = [];
    page['_pageErrors'] = [];
    page.on('console', msg => {
      // store basic info so assertions can inspect message type/text
      page['_consoleMessages'].push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      page['_pageErrors'].push(err);
    });
    // Navigate to the app URL
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Teardown: little housekeeping - nothing to modify on page
    // But assert that there were no uncaught page errors and no console.error messages.
    const consoleErrors = page['_consoleMessages'].filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/i.test(m.text));
    // Assert that no page-level uncaught exceptions fired
    expect(page['_pageErrors'], 'expected no uncaught page errors (pageerror events)').toEqual([]);
    // Assert that console did not log errors or JavaScript exception strings
    expect(consoleErrors, `expected no console.error messages or JS exception strings, found: ${JSON.stringify(page['_consoleMessages'])}`).toEqual([]);
  });

  test('Initial state S0_Idle: button and demo area exist with expected initial attributes', async ({ page }) => {
    const demoPage = new DemoPage(page);

    // Validate initial DOM elements are present
    await expect(demoPage.button).toBeVisible();
    await expect(demoPage.demo).toBeVisible(); // the container exists; visibility checked separately

    // FSM S0_Idle evidence: button should show "Show demonstration steps for this example"
    const text = await demoPage.getButtonText();
    expect(text?.trim()).toBe('Show demonstration steps for this example');

    // aria-expanded should start as "false"
    const ariaExpanded = await demoPage.getAriaExpanded();
    expect(ariaExpanded).toBe('false');

    // demo area should start hidden per inline style and aria-hidden="true"
    const isVisible = await demoPage.isDemoVisible();
    expect(isVisible).toBe(false);

    const ariaHidden = await demoPage.getAriaHidden();
    expect(ariaHidden).toBe('true');

    // The demo area should contain the expected textual steps (evidence that content is rendered)
    const containsInitial = await demoPage.demoContainsText('Initial array:');
    expect(containsInitial).toBe(true);

    // Also assert that demo area has more than 0 step items
    const count = await demoPage.demoStepCount();
    expect(count).toBeGreaterThan(0);
  });

  test('Transition S0_Idle -> S1_DemoVisible on ToggleDemo (single click)', async ({ page }) => {
    const demoPage = new DemoPage(page);

    // Precondition: confirm hidden
    expect(await demoPage.isDemoVisible()).toBe(false);

    // Click the toggle button (event: ToggleDemo)
    await demoPage.clickToggle();

    // After click: demo area should be visible
    expect(await demoPage.isDemoVisible()).toBe(true);

    // Button text should change to 'Hide demonstration steps'
    const newText = await demoPage.getButtonText();
    expect(newText?.trim()).toBe('Hide demonstration steps');

    // aria attributes should reflect visible state
    expect(await demoPage.getAriaExpanded()).toBe('true');
    expect(await demoPage.getAriaHidden()).toBe('false');

    // Demo content still present and unchanged otherwise
    expect(await demoPage.demoContainsText('Final merge')).toBe(true);
  });

  test('Transition S1_DemoVisible -> S0_Idle on ToggleDemo (click twice)', async ({ page }) => {
    const demoPage = new DemoPage(page);

    // Click once to open
    await demoPage.clickToggle();
    expect(await demoPage.isDemoVisible()).toBe(true);

    // Click again to close
    await demoPage.clickToggle();
    expect(await demoPage.isDemoVisible()).toBe(false);

    // Button text should revert
    expect((await demoPage.getButtonText())?.trim()).toBe('Show demonstration steps for this example');

    // aria attributes should reflect hidden state
    expect(await demoPage.getAriaExpanded()).toBe('false');
    expect(await demoPage.getAriaHidden()).toBe('true');
  });

  test('Rapid toggling edge case: multiple quick clicks should alternate state predictably', async ({ page }) => {
    const demoPage = new DemoPage(page);

    // Rapidly click the button 5 times
    for (let i = 0; i < 5; i++) {
      await demoPage.clickToggle();
    }

    // After 5 clicks (odd), the demo should be visible
    expect(await demoPage.isDemoVisible()).toBe(true);
    expect((await demoPage.getButtonText())?.trim()).toBe('Hide demonstration steps');
    expect(await demoPage.getAriaExpanded()).toBe('true');
    expect(await demoPage.getAriaHidden()).toBe('false');

    // Click one more time to make even toggles (6 total) => hidden
    await demoPage.clickToggle();
    expect(await demoPage.isDemoVisible()).toBe(false);
    expect((await demoPage.getButtonText())?.trim()).toBe('Show demonstration steps for this example');
    expect(await demoPage.getAriaExpanded()).toBe('false');
    expect(await demoPage.getAriaHidden()).toBe('true');
  });

  test('Visual and content checks when visible: demo steps have expected text structure', async ({ page }) => {
    const demoPage = new DemoPage(page);

    // Open the demo
    await demoPage.clickToggle();
    expect(await demoPage.isDemoVisible()).toBe(true);

    // Ensure a sequence of expected step descriptions are present in order
    const demoText = await page.locator('#demoArea').innerText();
    expect(demoText.indexOf('Initial array:')).toBeGreaterThan(-1);
    expect(demoText.indexOf('Split 1:')).toBeGreaterThan(-1);
    expect(demoText.indexOf('Final merge')).toBeGreaterThan(-1);

    // The first step should include the array presented in the example
    expect(demoText).toContain('[38, 27, 43, 3, 9, 82, 10]');

    // Check there are multiple step blocks (ensures the textual demonstration lists multiple steps)
    const steps = await demoPage.demoStepCount();
    expect(steps).toBeGreaterThanOrEqual(8);
  });

  test('Edge case: ensure clicking an already-visible demo still toggles aria attributes and text correctly', async ({ page }) => {
    const demoPage = new DemoPage(page);

    // Open demo
    await demoPage.clickToggle();
    expect(await demoPage.isDemoVisible()).toBe(true);

    // Manually read attributes before second click
    const beforeText = (await demoPage.getButtonText())?.trim();
    const beforeAria = await demoPage.getAriaExpanded();
    expect(beforeText).toBe('Hide demonstration steps');
    expect(beforeAria).toBe('true');

    // Click again to hide
    await demoPage.clickToggle();

    // After hiding, attributes updated
    expect((await demoPage.getButtonText())?.trim()).toBe('Show demonstration steps for this example');
    expect(await demoPage.getAriaExpanded()).toBe('false');
    expect(await demoPage.getAriaHidden()).toBe('true');
  });

  test('Sanity: ensure there are no intentional JavaScript ReferenceError/TypeError/SyntaxError messages logged', async ({ page }) => {
    // This test relies on the afterEach global assertions that will fail if such errors exist.
    // Here we re-check console messages specifically for exception names to provide a clearer assertion.
    const msgArr = page['_consoleMessages'] || [];
    const exceptionMsgs = msgArr.filter(m => /ReferenceError|TypeError|SyntaxError|Uncaught/i.test(m.text));
    expect(exceptionMsgs.length).toBe(0);
  });
});