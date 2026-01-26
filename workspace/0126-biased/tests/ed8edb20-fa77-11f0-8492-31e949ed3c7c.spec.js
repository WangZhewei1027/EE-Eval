import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8edb20-fa77-11f0-8492-31e949ed3c7c.html';

// Page object encapsulating interactions and queries for the monitor page
class MonitorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.monitor = page.locator('.monitor');
    this.button = page.locator('button.button');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Returns the inline style transform value (what the script sets on monitor.style.transform)
  async inlineTransform() {
    return await this.page.evaluate(() => {
      const el = document.querySelector('.monitor');
      return el ? el.style.transform : null;
    });
  }

  // Returns the computed transform (may be 'none' or a matrix string)
  async computedTransform() {
    return await this.page.evaluate(() => {
      const el = document.querySelector('.monitor');
      return el ? getComputedStyle(el).transform : null;
    });
  }

  async clickToggle() {
    await this.button.click();
  }

  async isButtonVisible() {
    return await this.button.isVisible();
  }

  async isButtonEnabled() {
    return await this.button.isEnabled();
  }

  async onclickAttribute() {
    return await this.page.evaluate(() => {
      const btn = document.querySelector('button.button');
      return btn ? btn.getAttribute('onclick') : null;
    });
  }

  // Access the page-scoped `animated` variable if present
  async getAnimatedVariable() {
    return await this.page.evaluate(() => {
      // return undefined if not present so test can detect missing global
      return typeof animated !== 'undefined' ? animated : undefined;
    });
  }
}

test.describe('Stunning Monitor Visualization - FSM tests', () => {
  let monitorPage;
  let consoleEvents;
  let pageErrors;

  // Setup before each test: navigate to page and attach listeners to capture console messages and page errors.
  test.beforeEach(async ({ page }) => {
    consoleEvents = [];
    pageErrors = [];

    // Collect console messages for later assertions (type + text)
    page.on('console', (msg) => {
      consoleEvents.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    monitorPage = new MonitorPage(page);
    await monitorPage.goto();

    // Wait a short moment to let any synchronous runtime errors surface
    await page.waitForTimeout(100);
  });

  // Teardown not required beyond Playwright fixtures, but keep a final check to ensure we captured events
  test.afterEach(async () => {
    // Nothing to tear down explicitly; listeners are scoped to page and will be disposed by Playwright.
  });

  test('Initial state S0_Idle: animated variable is false and monitor has no inline transform', async ({ page }) => {
    // Validate we can see the essential elements: monitor and button
    await expect(page.locator('.monitor')).toBeVisible();
    await expect(page.locator('button.button')).toBeVisible();

    // The FSM's initial evidence: let animated = false;
    const animatedVar = await monitorPage.getAnimatedVariable();
    // The script defines `let animated = false;` globally, so it should be false at load
    expect(animatedVar).toBe(false);

    // No inline transform should be set initially (monitor.style.transform is empty string)
    const inline = await monitorPage.inlineTransform();
    // Inline transform may be '' (empty string) when not explicitly set
    expect(inline === '' || inline === null).toBeTruthy();

    // Computed transform should not indicate the rotated state; either 'none' or some matrix that's not rotateY(-20deg)
    const computed = await monitorPage.computedTransform();
    expect(computed).toBeTruthy(); // should exist
    // Ensure it is not already the rotated -20deg state (script sets precise inline values on toggle)
    // When inline transform is not set the computed transform is typically 'none'
    expect(computed === 'none' || !computed.toLowerCase().includes('rotatey')).toBeTruthy();

    // Assert that no uncaught page errors occurred during initial load
    expect(pageErrors.length, `Expected no page errors on load, got: ${pageErrors.map(e=>String(e)).join('; ')}`).toBe(0);

    // Assert that no console.error messages were emitted during load
    const consoleErrors = consoleEvents.filter(e => e.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages on load, got: ${consoleErrors.map(e=>e.text).join('; ')}`).toBe(0);
  });

  test('Transition S0_Idle -> S1_Animated: clicking toggle sets inline transform to rotateY(-20deg)', async ({ page }) => {
    // Click the button to toggle animation ON
    await monitorPage.clickToggle();

    // Wait slightly longer than the transition duration (0.5s in CSS) to allow inline style to be set and transition to run
    await page.waitForTimeout(600);

    // The global variable should now be true
    const animatedVar = await monitorPage.getAnimatedVariable();
    expect(animatedVar).toBe(true);

    // The script sets monitor.style.transform = 'rotateY(-20deg)'
    const inline = await monitorPage.inlineTransform();
    expect(inline).toBe('rotateY(-20deg)');

    // computed transform should reflect a transform value (not 'none')
    const computed = await monitorPage.computedTransform();
    expect(computed).toBeTruthy();
    expect(computed === 'none' ? false : true).toBeTruthy();

    // Ensure no page errors or console.error were emitted as a result of the interaction
    expect(pageErrors.length, `Expected no page errors after toggling on, got: ${pageErrors.map(e=>String(e)).join('; ')}`).toBe(0);
    const consoleErrors = consoleEvents.filter(e => e.type === 'error');
    expect(consoleErrors.length, `Expected no console.error after toggling on, got: ${consoleErrors.map(e=>e.text).join('; ')}`).toBe(0);
  });

  test('Transition S1_Animated -> S0_Idle: clicking toggle again resets inline transform to rotateY(0deg)', async ({ page }) => {
    // First click to go to animated state
    await monitorPage.clickToggle();
    await page.waitForTimeout(600);

    // Second click to toggle back to idle
    await monitorPage.clickToggle();
    await page.waitForTimeout(600);

    // The global variable should now be false
    const animatedVar = await monitorPage.getAnimatedVariable();
    expect(animatedVar).toBe(false);

    // The script sets monitor.style.transform = 'rotateY(0deg)' on toggling back
    const inline = await monitorPage.inlineTransform();
    // Depending on browser, inline style should exactly match 'rotateY(0deg)'
    expect(inline).toBe('rotateY(0deg)');

    // No runtime errors or console.error should have occurred during these interactions
    expect(pageErrors.length, `Expected no page errors after toggling back, got: ${pageErrors.map(e=>String(e)).join('; ')}`).toBe(0);
    const consoleErrors = consoleEvents.filter(e => e.type === 'error');
    expect(consoleErrors.length, `Expected no console.error after toggling back, got: ${consoleErrors.map(e=>e.text).join('; ')}`).toBe(0);
  });

  test('Edge case: rapid toggling produces a correct final state after an odd/even number of toggles', async ({ page }) => {
    // Rapidly click the toggle button 5 times (odd)
    for (let i = 0; i < 5; i++) {
      await monitorPage.clickToggle();
    }

    // Wait for transitions to settle
    await page.waitForTimeout(800);

    // Starting from false, 5 toggles => true (animated)
    const animatedVarAfter5 = await monitorPage.getAnimatedVariable();
    expect(animatedVarAfter5).toBe(true);
    const inlineAfter5 = await monitorPage.inlineTransform();
    expect(inlineAfter5).toBe('rotateY(-20deg)');

    // Now click once more to make it even (6 total) -> should be idle
    await monitorPage.clickToggle();
    await page.waitForTimeout(600);
    const animatedVarAfter6 = await monitorPage.getAnimatedVariable();
    expect(animatedVarAfter6).toBe(false);
    const inlineAfter6 = await monitorPage.inlineTransform();
    expect(inlineAfter6).toBe('rotateY(0deg)');

    // Ensure no unexpected page errors
    expect(pageErrors.length, `Unexpected page errors during rapid toggling: ${pageErrors.map(e=>String(e)).join('; ')}`).toBe(0);
    const consoleErrors = consoleEvents.filter(e => e.type === 'error');
    expect(consoleErrors.length, `Unexpected console.error messages during rapid toggling: ${consoleErrors.map(e=>e.text).join('; ')}`).toBe(0);
  });

  test('Button attributes and accessibility checks', async () => {
    // Button visibility and enabled state
    expect(await monitorPage.isButtonVisible()).toBe(true);
    expect(await monitorPage.isButtonEnabled()).toBe(true);

    // The FSM and HTML indicate the button should have onclick="toggleAnimation()"
    const onclickAttr = await monitorPage.onclickAttribute();
    expect(onclickAttr).toBe('toggleAnimation()');

    // Sanity check: clicking the button toggles the `animated` variable as expected
    const before = await monitorPage.getAnimatedVariable();
    await monitorPage.clickToggle();
    // Wait for the script to toggle the value
    await new Promise(r => setTimeout(r, 200));
    const after = await monitorPage.getAnimatedVariable();
    expect(after).toBe(before === false ? true : false);

    // No page errors or console error messages should be present from attribute checks
    expect(pageErrors.length, `Expected no page errors during attribute checks, got: ${pageErrors.map(e=>String(e)).join('; ')}`).toBe(0);
    const consoleErrors = consoleEvents.filter(e => e.type === 'error');
    expect(consoleErrors.length, `Expected no console.error during attribute checks, got: ${consoleErrors.map(e=>e.text).join('; ')}`).toBe(0);
  });

  test('Observes console and page errors throughout interactions and reports findings', async ({ page }) => {
    // This test demonstrates capturing of console messages and page errors across lifecycle
    // Trigger a few interactions
    await monitorPage.clickToggle();
    await page.waitForTimeout(300);
    await monitorPage.clickToggle();
    await page.waitForTimeout(300);

    // Inspect captured console messages - we expect no console.error entries for this clean app
    const errors = consoleEvents.filter(e => e.type === 'error');
    expect(errors.length, `Console errors were emitted: ${errors.map(e => e.text).join('; ')}`).toBe(0);

    // Inspect captured page errors - expect none for well-formed JS in this page
    expect(pageErrors.length, `Page errors were emitted: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

    // However, if any runtime errors are present, fail the test with details so they are visible to maintainers
  });
});