import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d836b230-fa7b-11f0-b314-ad8654ee5de8.html';

// Page object for the demo page (encapsulates interactions & queries)
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoButton');
    this.demoArea = page.locator('#demoArea');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Returns the visible state of the demo area per Playwright (true if visible)
  async isDemoVisible() {
    return await this.demoArea.isVisible();
  }

  // Returns the boolean hidden property of the demo area (true if hidden)
  async demoHiddenProperty() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.hidden : undefined;
    }, '#demoArea');
  }

  async getButtonAriaPressed() {
    return await this.button.getAttribute('aria-pressed');
  }

  async getButtonText() {
    return await this.button.textContent();
  }

  async clickButton() {
    await this.button.click();
  }

  async pressButton(key = 'Enter') {
    // keyboard activation on a native <button>
    await this.button.press(key);
  }

  async clickInDemoArea() {
    await this.demoArea.click();
  }
}

test.describe('FSM: Greedy Algorithms — Activity Selection Demo', () => {
  // Collect console messages and page errors for each test to assert there are no unexpected errors.
  test.beforeEach(async ({ page }) => {
    // No-op here; actual listeners are attached per-test inside each test block to capture scope-specific events.
  });

  test.afterEach(async ({ page }) => {
    // After each test we give a brief moment for any late console messages / errors to surface.
    await page.waitForTimeout(20);
  });

  test('Initial state (S0_Idle): button present, aria-pressed="false", demo area hidden, renderPage NOT defined', async ({ page }) => {
    // This test validates the Idle state described in the FSM:
    // - The toggle button exists with the expected text and aria-pressed="false".
    // - The demo area is initially hidden.
    // - The FSM mentioned an entry action renderPage(); verify whether a global renderPage exists (it should not).
    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg);
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Basic DOM expectations for Idle state
    await expect(demo.button).toBeVisible({ timeout: 2000 });
    await expect(demo.button).toHaveText('Show Activity Selection Example');
    const aria = await demo.getButtonAriaPressed();
    expect(aria).toBe('false');

    // The demo area should be hidden according to the FSM evidence
    await expect(demo.demoArea).toBeHidden();
    // Also check the DOM property hidden is true
    const hiddenProp = await demo.demoHiddenProperty();
    expect(hiddenProp).toBe(true);

    // FSM mentions renderPage() as an entry action. The page's implementation does not define renderPage.
    // Verify that calling window.renderPage is not defined (i.e., entry action not present as a global function).
    // We assert that renderPage is undefined rather than trying to call it (do not modify runtime).
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // Ensure no uncaught page errors or console errors were emitted during load
    // (We check arrays captured above)
    await page.waitForTimeout(20);
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Keep console messages for human-readable diagnostics in failures (not asserting their exact content)
    // But assert that at least the "button" exists via console or not is not necessary.
    // This assertion ensures we observed the page without runtime exceptions.
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('Transition S0_Idle -> S1_DemoVisible on ToggleDemo (click): demo becomes visible and button updates', async ({ page }) => {
    // This test validates the transition when clicking the toggle button:
    // - demo.hidden becomes false (demo visible)
    // - button aria-pressed becomes "true"
    // - button text changes to "Hide Activity Selection Example"
    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg);
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Precondition check
    await expect(demo.demoArea).toBeHidden();
    expect(await demo.getButtonAriaPressed()).toBe('false');
    expect(await demo.getButtonText()).toBe('Show Activity Selection Example');

    // Trigger the ToggleDemo event (click)
    await demo.clickButton();

    // After the click, expect demo to be visible and attributes updated
    await expect(demo.demoArea).toBeVisible();
    const hiddenPropAfter = await demo.demoHiddenProperty();
    expect(hiddenPropAfter).toBe(false);

    expect(await demo.getButtonAriaPressed()).toBe('true');
    expect((await demo.getButtonText()).trim()).toBe('Hide Activity Selection Example');

    // The demo area should contain expected textual evidence from FSM (a short list of activities)
    await expect(demo.demoArea.locator('.example-list')).toBeVisible();
    const exampleText = await demo.demoArea.locator('.example-list').textContent();
    expect(exampleText).toContain('A1(1,4)');

    // No uncaught errors or console error messages should have been emitted
    await page.waitForTimeout(20);
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Keep console messages for debugging if needed
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('Transition S1_DemoVisible -> S0_Idle on ToggleDemo (click again): demo hides and button reverts', async ({ page }) => {
    // This test validates toggling back to Idle:
    // - Clicking the button when demo visible hides it and updates aria-pressed & text
    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg);
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Make sure demo is visible first
    await demo.clickButton();
    await expect(demo.demoArea).toBeVisible();
    expect(await demo.getButtonAriaPressed()).toBe('true');

    // Click to hide again
    await demo.clickButton();

    // Validate the expected observables for the S0_Idle state
    await expect(demo.demoArea).toBeHidden();
    const hiddenProp = await demo.demoHiddenProperty();
    expect(hiddenProp).toBe(true);

    expect(await demo.getButtonAriaPressed()).toBe('false');
    expect((await demo.getButtonText()).trim()).toBe('Show Activity Selection Example');

    // No uncaught runtime errors
    await page.waitForTimeout(20);
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('Edge cases: rapid/frequent toggles and keyboard activation behave deterministically', async ({ page }) => {
    // This test covers edge cases:
    // - Rapid multiple clicks flip state consistently.
    // - Keyboard activation (Enter) also toggles the demo (native button behavior).
    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg);
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Rapid clicks: click 5 times in quick succession.
    // Start expectation: hidden true
    await expect(demo.demoArea).toBeHidden();
    for (let i = 0; i < 5; i++) {
      // do not await between clicks to simulate fast user actions
      // but ensure Playwright processes them sequentially by awaiting each click
      await demo.clickButton();
    }

    // 5 toggles: odd => visible
    await expect(demo.demoArea).toBeVisible();
    expect(await demo.getButtonAriaPressed()).toBe('true');

    // Now press Enter on the button (keyboard activation) to toggle back
    await demo.pressButton('Enter');

    // Should now be hidden
    await expect(demo.demoArea).toBeHidden();
    expect(await demo.getButtonAriaPressed()).toBe('false');

    // Try Space as well (space key on a native button triggers click)
    await demo.pressButton('Space');
    await expect(demo.demoArea).toBeVisible();
    expect(await demo.getButtonAriaPressed()).toBe('true');

    // Clicking inside the demo area should NOT toggle the demo (only the button toggles)
    // Click inside an element within demo area and assert visibility unchanged
    await demo.clickInDemoArea();
    await expect(demo.demoArea).toBeVisible();
    expect(await demo.getButtonAriaPressed()).toBe('true');

    // No runtime errors
    await page.waitForTimeout(20);
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('Sanity: the demo event listener was attached and is passive (no runtime side-effects on repeated use)', async ({ page }) => {
    // This test does not and cannot introspect the {passive:true} option directly,
    // but it verifies that repeated toggling using the UI does not produce errors or exceptions,
    // which would indicate bad listener behavior.
    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg);
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Repeatedly toggle dozens of times to stress the simple listener
    for (let i = 0; i < 20; i++) {
      await demo.clickButton();
      // Small pause to let the DOM update and avoid artificially coalescing events
      await page.waitForTimeout(5);
    }

    // After 20 toggles, state depends on parity: 20 is even -> should be same as initial (hidden)
    await expect(demo.demoArea).toBeHidden();
    expect(await demo.getButtonAriaPressed()).toBe('false');

    // No runtime errors should have accumulated
    await page.waitForTimeout(20);
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // We observed console messages (if any) but none were errors
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('Robustness: verify DOM evidence strings from the FSM are present in page markup', async ({ page }) => {
    // This test asserts that the specific evidence strings (button HTML and demoArea presence) that
    // the FSM extraction used are present in the document.
    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg);
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Check that an element with id demoButton exists and contains the expected text
    const buttonText = (await demo.getButtonText()).trim();
    expect(buttonText).toBe('Show Activity Selection Example');

    // Check that demo area exists (even if hidden initially)
    const existsDemo = await page.$('#demoArea');
    expect(existsDemo).not.toBeNull();

    // The FSM evidence included the HTML snippet; validate parts of it exist:
    // - button has class "button"
    const btnClass = await page.$eval('#demoButton', el => el.className);
    expect(btnClass).toContain('button');

    // - demo area has class "demo" and initially has hidden property
    const demoClass = await page.$eval('#demoArea', el => el.className);
    expect(demoClass).toContain('demo');
    const hiddenProp = await demo.demoHiddenProperty();
    expect(hiddenProp).toBe(true);

    // No runtime errors
    await page.waitForTimeout(20);
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});