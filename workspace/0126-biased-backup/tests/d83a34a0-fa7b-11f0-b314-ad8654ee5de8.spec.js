import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83a34a0-fa7b-11f0-b314-ad8654ee5de8.html';

/**
 * Page Object for the small demo at the bottom of the page.
 * Encapsulates selectors and common interactions for clarity and reuse.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      demoBtn: '#demoBtn',
      demoContainer: '#demoContainer',
      demoJsonPre: '#demoJson'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButton() {
    return this.page.locator(this.selectors.demoBtn);
  }

  async getContainer() {
    return this.page.locator(this.selectors.demoContainer);
  }

  async getPre() {
    return this.page.locator(this.selectors.demoJsonPre);
  }

  async clickDemoBtn() {
    await this.page.click(this.selectors.demoBtn);
  }

  async getButtonText() {
    return (await this.getButton().innerText()).trim();
  }

  async isContainerVisible() {
    // Use computed style to match FSM evidence (container.style.display).
    return await this.page.$eval(this.selectors.demoContainer, el => {
      // Return the actual computed display value as the implementation toggles style.display
      return window.getComputedStyle(el).display;
    });
  }

  async getPreText() {
    return (await this.getPre().innerText());
  }

  async parsePreJson() {
    const text = await this.getPreText();
    // If empty string, JSON.parse will throw - let that happen naturally for the test to observe if needed.
    return JSON.parse(text);
  }
}

/**
 * Expected example object (must match exactly the example defined in the page's inline script).
 * This is used to validate the preformatted JSON output when the demo is shown.
 */
const EXPECTED_EXAMPLE = {
  type: "Assign",
  target: { type: "Identifier", name: "a" },
  value: {
    type: "Add",
    left: { type: "Identifier", name: "b" },
    right: {
      type: "Multiply",
      left: { type: "Number", value: 3 },
      right: {
        type: "Subtract",
        left: { type: "Identifier", name: "c" },
        right: { type: "Number", value: 2 }
      }
    }
  }
};

test.describe('AST Example Demo - FSM states and transitions', () => {
  // No global setup/teardown beyond Playwright fixtures. Each test will create its own DemoPage instance.

  test('S0_Idle: initial render - button present, container hidden, no script errors on load', async ({ page }) => {
    // Collect console errors and pageerrors to observe runtime issues
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Validate Idle state (S0_Idle)
    //  - Button should exist and show "Show example AST JSON"
    //  - Container should have display 'none' initially (as per HTML inline style)
    //  - Pre element should be empty at initial state
    const btnText = await demo.getButtonText();
    expect(btnText).toBe('Show example AST JSON');

    const containerDisplay = await demo.isContainerVisible();
    // The page uses inline style "display:none" initially, so computed display should be 'none'
    expect(containerDisplay).toBe('none');

    const preText = await demo.getPreText();
    expect(preText).toBe(''); // empty before toggling

    // Assert that no runtime errors were emitted during page load.
    // We observe console.error and pageerror events and expect none for this well-formed page.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S0 -> S1: clicking the demo button shows example AST JSON and updates button text', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Click to show. This is the ShowExampleAST event triggering transition S0->S1.
    await demo.clickDemoBtn();

    // Wait briefly for DOM update (the handler runs synchronously, but keep await for stability)
    await page.waitForTimeout(50);

    // Verify container is displayed (evidence: container.style.display = 'block').
    const containerDisplay = await demo.isContainerVisible();
    expect(containerDisplay).toBe('block');

    // Verify button text changed to 'Hide example AST JSON' (action from transition)
    const btnText = await demo.getButtonText();
    expect(btnText).toBe('Hide example AST JSON');

    // Verify pre contains pretty-printed JSON matching EXPECTED_EXAMPLE
    const preText = await demo.getPreText();
    // It should be a JSON string with indentation; parse it to compare the underlying object
    let parsed;
    try {
      parsed = JSON.parse(preText);
    } catch (err) {
      // If JSON.parse throws, fail with helpful message — but allow the natural error to surface too
      throw new Error('pre text was not valid JSON after showing demo: ' + err.message);
    }
    expect(parsed).toEqual(EXPECTED_EXAMPLE);

    // Ensure no console errors or uncaught page errors occurred during this interaction
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S1 -> S2: clicking the demo button again hides the example and restores button text', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Show first
    await demo.clickDemoBtn();
    await page.waitForTimeout(20);

    // Now hide (transition S1 -> S2)
    await demo.clickDemoBtn();
    await page.waitForTimeout(20);

    // Verify container is hidden and button text restored
    const containerDisplay = await demo.isContainerVisible();
    expect(containerDisplay).toBe('none');

    const btnText = await demo.getButtonText();
    expect(btnText).toBe('Show example AST JSON');

    // The pre may still contain text but it's visually hidden. The FSM evidence expects container.style.display = 'none';
    // Ensure there were no runtime errors during toggling.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S2 -> S1: toggling again shows the example and repopulates JSON (idempotency of transition)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Show -> Hide -> Show to test S2 -> S1
    await demo.clickDemoBtn(); // show
    await page.waitForTimeout(15);
    await demo.clickDemoBtn(); // hide
    await page.waitForTimeout(15);
    await demo.clickDemoBtn(); // show again (S2 -> S1)
    await page.waitForTimeout(15);

    // Validate visible and JSON correct
    const containerDisplay = await demo.isContainerVisible();
    expect(containerDisplay).toBe('block');

    const parsed = JSON.parse(await demo.getPreText());
    expect(parsed).toEqual(EXPECTED_EXAMPLE);

    const btnText = await demo.getButtonText();
    expect(btnText).toBe('Hide example AST JSON');

    // No runtime errors during repeated transitions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: rapid repeated clicks do not break toggling and produce no runtime errors', async ({ page }) => {
    // This validates robustness of the click handler to frequent toggles.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Perform rapid clicks: odd number of clicks should result in visible, even -> hidden.
    const clicks = 7;
    for (let i = 0; i < clicks; i++) {
      // fire-and-forget clicks quickly
      await demo.getButton().click();
    }

    // Wait a moment for any synchronous handler work to finish
    await page.waitForTimeout(50);

    const containerDisplay = await demo.isContainerVisible();
    // 7 is odd => should be visible (block)
    expect(containerDisplay).toBe('block');

    const btnText = await demo.getButtonText();
    expect(btnText).toBe('Hide example AST JSON');

    // Validate JSON is correct
    const parsed = JSON.parse(await demo.getPreText());
    expect(parsed).toEqual(EXPECTED_EXAMPLE);

    // Ensure no console errors or uncaught errors in rapid interaction scenario
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: capture console messages and page errors across lifecycle (sanity check)', async ({ page }) => {
    // This test focuses solely on observing console / page errors during load and interactions.
    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Interact: click show/hide twice
    await demo.clickDemoBtn();
    await page.waitForTimeout(10);
    await demo.clickDemoBtn();
    await page.waitForTimeout(10);

    // We expect a mostly quiet page: no console.error and no uncaught page errors.
    // If the implementation had runtime ReferenceError/SyntaxError/TypeError, they would appear here.
    // The assertion is that none happened in this environment.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);

    // Additionally, assert that console may have informational logs (not required). At minimum ensure we captured messages array.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});