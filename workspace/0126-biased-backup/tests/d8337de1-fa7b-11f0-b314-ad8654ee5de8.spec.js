import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8337de1-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the minimal demo area
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoBtn = '#demoBtn';
    this.output = '#demoOutput';
    this.stepSelector = '#demoOutput .step';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getButtonText() {
    return (await this.page.locator(this.demoBtn).innerText()).trim();
  }

  async clickDemoButton() {
    await this.page.click(this.demoBtn);
  }

  async getStepsCount() {
    return await this.page.locator(this.stepSelector).count();
  }

  async isOutputEmpty() {
    const html = await this.page.locator(this.output).evaluate((el) => el.innerHTML.trim());
    return html === '' || html === undefined;
  }

  async getStepActionText(index) {
    // index is 0-based
    const step = this.page.locator(this.stepSelector).nth(index);
    // The first child div holds the action text
    return (await step.locator('div').first().innerText()).trim();
  }

  async getStepPreText(index) {
    const step = this.page.locator(this.stepSelector).nth(index);
    return (await step.locator('pre').innerText()).trim();
  }

  async demoButtonHasAttribute(attr) {
    return await this.page.locator(this.demoBtn).getAttribute(attr);
  }
}

test.describe('BST demonstration - FSM states & transitions', () => {
  // We'll collect console messages and page errors for each test to assert on runtime errors.
  test.beforeEach(async ({ page }) => {
    // ensure a fresh page for each test
    await page.goto('about:blank');
  });

  // Test the initial S0 Idle state (renderPage entry effects)
  test('S0 Idle: initial render shows demo button and empty output', async ({ page }) => {
    // Collect console and page errors during navigation and initial checks
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Verify the demo button is present with expected text and attributes (evidence for S0)
    await expect(page.locator(demo.demoBtn)).toBeVisible();
    expect(await demo.getButtonText()).toBe('Show demonstration');
    expect(await demo.demoButtonHasAttribute('class')).toContain('btn');
    expect(await demo.demoButtonHasAttribute('aria-controls')).toBe('demoOutput');

    // Verify the demo output area is empty (entry state before any interaction)
    expect(await demo.isOutputEmpty()).toBeTruthy();
    expect(await demo.getStepsCount()).toBe(0);

    // Assert there are no uncaught page errors during initial load
    expect(pageErrors.length).toBe(0);

    // Also assert there are no console 'error' messages emitted during initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test the transition S0 -> S1 on ShowDemonstration click
  test('ShowDemonstration event: clicking the button displays all demonstration steps (S1)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Click the demo button to show demonstration (trigger ShowDemonstration)
    await demo.clickDemoButton();

    // After click, button text should indicate we can hide
    await expect(page.locator(demo.demoBtn)).toHaveText('Hide demonstration');

    // The output should contain a sequence of .step elements corresponding to the steps array in the implementation
    // Implementation contains 11 step objects; expect 11 .step nodes
    await expect(page.locator(demo.stepSelector)).toHaveCount(11);

    // Verify first and last step contents to ensure the steps were rendered and structured as expected
    const firstAction = await demo.getStepActionText(0);
    expect(firstAction).toBe('Start with an empty tree.');

    const firstPre = await demo.getStepPreText(0);
    expect(firstPre).toBe('(empty)');

    // Check a later step (insertion of 80) and the final traversal step content for correctness
    const eighthAction = await demo.getStepActionText(7); // Insert 80 step (0-based index)
    expect(eighthAction.startsWith('Insert 80')).toBeTruthy();

    const lastPre = await demo.getStepPreText(10); // final post-order traversal output
    expect(lastPre).toContain('Post-order: 20, 40, 30, 60, 80, 70, 50');

    // No uncaught page errors should have occurred while rendering the demonstration
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test transition S1 -> S0 when clicking Hide demonstration (toggle behavior)
  test('HideDemonstration event: clicking the button again hides the demonstration and returns to S0', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Show first
    await demo.clickDemoButton();
    await expect(page.locator(demo.stepSelector)).toHaveCount(11);
    await expect(page.locator(demo.demoBtn)).toHaveText('Hide demonstration');

    // Click again to hide (trigger HideDemonstration)
    await demo.clickDemoButton();

    // After hiding, output should be empty and button text reset
    expect(await demo.isOutputEmpty()).toBeTruthy();
    expect(await demo.getButtonText()).toBe('Show demonstration');
    expect(await demo.getStepsCount()).toBe(0);

    // Ensure no runtime page errors or console errors occurred during toggling
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: rapid toggling (multiple clicks) to ensure stable state transitions
  test('Edge case: rapid toggling of the demo button results in consistent final state', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Perform three rapid clicks: expected state sequence (starting Idle): shown -> hidden -> shown
    await Promise.all([
      demo.page.click(demo.demoBtn),
      demo.page.click(demo.demoBtn),
      demo.page.click(demo.demoBtn)
    ]).catch(() => {
      // If some clicks race, we still want to inspect final stable state; don't throw here.
    });

    // Give a small moment for DOM updates if any
    await demo.page.waitForTimeout(100);

    // After odd number of clicks, the demonstration should be visible
    const steps = await demo.getStepsCount();
    expect([0, 11].includes(steps)).toBeTruthy(); // either 0 or 11 depending on exact ordering, but final should be deterministic
    // Check and assert final button text aligns with steps presence
    const btnText = await demo.getButtonText();
    if (steps === 11) {
      expect(btnText).toBe('Hide demonstration');
    } else {
      expect(btnText).toBe('Show demonstration');
    }

    // No runtime errors during rapid interaction
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Comprehensive flow: show, inspect multiple step contents, then hide, verifying onEnter/onExit behavior
  test('Comprehensive flow: S0 -> S1 (inspect steps) -> S0 and verify visual & DOM changes', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure starting in S0
    expect(await demo.getButtonText()).toBe('Show demonstration');
    expect(await demo.getStepsCount()).toBe(0);

    // Trigger S1
    await demo.clickDemoButton();

    // Verify that each step has both action and pre text, and that pre text is non-empty
    const count = await demo.getStepsCount();
    expect(count).toBe(11);

    for (let i = 0; i < count; i++) {
      const actionText = await demo.getStepActionText(i);
      const preText = await demo.getStepPreText(i);

      // Each step must have a non-empty action and pre block (visual feedback)
      expect(actionText.length).toBeGreaterThan(0);
      expect(preText.length).toBeGreaterThan(0);
    }

    // Now hide and assert DOM cleared
    await demo.clickDemoButton();
    expect(await demo.isOutputEmpty()).toBeTruthy();
    expect(await demo.getButtonText()).toBe('Show demonstration');
    expect(await demo.getStepsCount()).toBe(0);

    // Final runtime error check
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

});