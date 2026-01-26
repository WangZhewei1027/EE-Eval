import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d59fdab1-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the Linked Lists demo page
class LinkedListDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleButton = page.locator("button[onclick='toggleDemo()']");
    this.demoSection = page.locator('#demoSection');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickToggle() {
    await this.toggleButton.click();
  }

  async pressToggleWithKeyboard(key = 'Enter') {
    await this.toggleButton.focus();
    await this.page.keyboard.press(key);
  }

  async isDemoVisible() {
    // Use Playwright's visibility check which relies on computed styles
    return await this.demoSection.isVisible();
  }

  async getDemoInlineDisplayProperty() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demoSection');
      return el ? el.style.display : null;
    });
  }

  async getDemoComputedDisplayProperty() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demoSection');
      if (!el) return null;
      return window.getComputedStyle(el).display;
    });
  }

  async getToggleButtonText() {
    return await this.toggleButton.innerText();
  }

  async getToggleOnclickAttribute() {
    return await this.toggleButton.getAttribute('onclick');
  }

  async getDemoInnerTextSnippet() {
    return await this.demoSection.innerText();
  }

  async getDemoBackgroundColor() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demoSection');
      if (!el) return null;
      return window.getComputedStyle(el).backgroundColor;
    });
  }
}

test.describe('Linked Lists Demo FSM - d59fdab1-fa7b-11f0-8b01-9f078a0ff214', () => {
  // Arrays to collect runtime console messages and page errors for assertions
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect all console messages
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Collect uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // err is an Error object; capture useful details
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({}, testInfo) => {
    // If a test failed, attach console and page error summaries to diagnostics
    if (testInfo.status !== testInfo.expectedStatus) {
      testInfo.attach('consoleMessages', {
        body: JSON.stringify({ consoleMessages, consoleErrors, pageErrors }, null, 2),
        contentType: 'application/json',
      });
    }
  });

  test('Initial state S0_Idle: page renders and demo section is hidden', async ({ page }) => {
    // Validate initial render and Idle state of the FSM (S0_Idle)
    const pagePO = new LinkedListDemoPage(page);

    // Page-level sanity checks
    await expect(page).toHaveURL(APP_URL);
    await expect(page).toHaveTitle(/Understanding Linked Lists/i);

    // The toggle button should be present with the expected text and onclick handler
    await expect(pagePO.toggleButton).toBeVisible();
    await expect(await pagePO.getToggleButtonText()).toMatch(/Toggle Demonstration Example/);
    await expect(await pagePO.getToggleOnclickAttribute()).toBe('toggleDemo()');

    // The demo section should exist in the DOM
    await expect(pagePO.demoSection).toBeTruthy();

    // FSM evidence: on initial load, demoSection is hidden.
    // Check both inline style and computed style to cover both possibilities.
    const inlineDisplay = await pagePO.getDemoInlineDisplayProperty();
    const computedDisplay = await pagePO.getDemoComputedDisplayProperty();

    // Inline style is likely '' initially, but computed style should be 'none' due to stylesheet.
    expect(['', 'none', null]).toContain(inlineDisplay);
    expect(computedDisplay).toBe('none');

    // Using Playwright visibility helper: not visible
    expect(await pagePO.isDemoVisible()).toBeFalsy();

    // Ensure no runtime page errors (ReferenceError, SyntaxError, TypeError) occurred during load
    // We expect zero page errors for a well-formed page; collect any if they occurred naturally
    const criticalErrors = pageErrors.filter(e => /ReferenceError|TypeError|SyntaxError/i.test(e.name));
    expect(criticalErrors.length).toBe(0);

    // Also ensure console had no error-level messages during load
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoVisible: clicking toggle shows demo section', async ({ page }) => {
    // Validate toggling from Idle to Demo Visible
    const pagePO = new LinkedListDemoPage(page);

    // Precondition: demo should be hidden
    expect(await pagePO.isDemoVisible()).toBeFalsy();

    // Perform the event: click the ToggleDemo button
    await pagePO.clickToggle();

    // Expected observable: #demoSection is visible
    await expect(pagePO.demoSection).toBeVisible();
    expect(await pagePO.isDemoVisible()).toBeTruthy();

    // After toggle, inline style is likely 'block' because the script sets it directly
    const inlineDisplay = await pagePO.getDemoInlineDisplayProperty();
    expect(inlineDisplay).toBe('block');

    // Verify some visual cues: background color matches the CSS for the demo section
    const bgColor = await pagePO.getDemoBackgroundColor();
    // The stylesheet sets background-color: #f0f0f0; computed color in most browsers is 'rgb(240, 240, 240)'
    expect(['rgb(240, 240, 240)', 'rgba(240, 240, 240, 1)']).toContain(bgColor);

    // Check that the demo section contains expected text describing the demonstration
    const demoText = await pagePO.getDemoInnerTextSnippet();
    expect(demoText).toMatch(/simple demonstration of the linked list operations/i);

    // Ensure no unexpected runtime errors occurred during the transition
    const criticalErrors = pageErrors.filter(e => /ReferenceError|TypeError|SyntaxError/i.test(e.name));
    expect(criticalErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1_DemoVisible -> S2_DemoHidden: clicking toggle hides demo section', async ({ page }) => {
    // Validate toggling from Visible to Hidden
    const pagePO = new LinkedListDemoPage(page);

    // Ensure we are in visible state by toggling once if needed
    if (!(await pagePO.isDemoVisible())) {
      await pagePO.clickToggle();
      await expect(pagePO.demoSection).toBeVisible();
    }

    // Now perform the event again to hide
    await pagePO.clickToggle();

    // Expected observable: #demoSection is hidden
    await expect(pagePO.demoSection).not.toBeVisible();
    expect(await pagePO.isDemoVisible()).toBeFalsy();

    // After hiding, inline style should be 'none' per the toggle implementation
    const inlineDisplay = await pagePO.getDemoInlineDisplayProperty();
    expect(inlineDisplay).toBe('none');

    // No unexpected runtime errors occurred during the transition
    const criticalErrors = pageErrors.filter(e => /ReferenceError|TypeError|SyntaxError/i.test(e.name));
    expect(criticalErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S2_DemoHidden -> S1_DemoVisible: toggling from hidden shows demo section again', async ({ page }) => {
    // Start from hidden state; toggle to visible and assert
    const pagePO = new LinkedListDemoPage(page);

    // Ensure hidden
    if (await pagePO.isDemoVisible()) {
      await pagePO.clickToggle();
      await expect(pagePO.demoSection).not.toBeVisible();
    }

    // Toggle to visible
    await pagePO.clickToggle();

    // Assert visible
    await expect(pagePO.demoSection).toBeVisible();
    expect(await pagePO.isDemoVisible()).toBeTruthy();

    // Inline style should be 'block'
    const inlineDisplay = await pagePO.getDemoInlineDisplayProperty();
    expect(inlineDisplay).toBe('block');

    // No unexpected runtime errors occurred during the transition
    const criticalErrors = pageErrors.filter(e => /ReferenceError|TypeError|SyntaxError/i.test(e.name));
    expect(criticalErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: rapid multiple toggles alternate visibility correctly', async ({ page }) => {
    // Rapidly click the toggle multiple times and assert the alternating nature of the demo visibility
    const pagePO = new LinkedListDemoPage(page);

    // Start from a known state: ensure hidden
    if (await pagePO.isDemoVisible()) {
      await pagePO.clickToggle();
      await expect(pagePO.demoSection).not.toBeVisible();
    }

    // Click 5 times rapidly
    for (let i = 0; i < 5; i++) {
      await pagePO.clickToggle();
      // Small wait to allow DOM updates; toggle implementation is synchronous but allow microtask scheduling
      await page.waitForTimeout(10);
    }

    // After 5 toggles starting from hidden: odd -> visible
    expect(await pagePO.isDemoVisible()).toBeTruthy();

    // Click once more to return to hidden
    await pagePO.clickToggle();
    expect(await pagePO.isDemoVisible()).toBeFalsy();

    // Confirm no JS runtime errors were emitted during rapid toggling
    const criticalErrors = pageErrors.filter(e => /ReferenceError|TypeError|SyntaxError/i.test(e.name));
    expect(criticalErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Accessibility/interaction variant: activate toggle using keyboard (Enter/Space)', async ({ page }) => {
    // Validate that the button can be activated via keyboard which should trigger the same onclick behavior
    const pagePO = new LinkedListDemoPage(page);

    // Ensure hidden to start
    if (await pagePO.isDemoVisible()) {
      await pagePO.clickToggle();
      await expect(pagePO.demoSection).not.toBeVisible();
    }

    // Press Enter to toggle
    await pagePO.pressToggleWithKeyboard('Enter');
    await expect(pagePO.demoSection).toBeVisible();

    // Press Space to toggle back (space also activates when button is focused)
    await pagePO.pressToggleWithKeyboard('Space');
    await expect(pagePO.demoSection).not.toBeVisible();

    // No runtime errors
    const criticalErrors = pageErrors.filter(e => /ReferenceError|TypeError|SyntaxError/i.test(e.name));
    expect(criticalErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Runtime diagnostic: report any ReferenceError/TypeError/SyntaxError if present', async ({ page }) => {
    // This test collects any critical JS errors that may have occurred anywhere during the test session.
    // It asserts that none occurred, but will surface details if they did.
    // Note: per instructions we must observe errors happening naturally and assert accordingly.
    // Here we assert that none of the critical errors occurred (the page is expected to be correct).
    const criticalErrors = pageErrors.filter(e => /ReferenceError|TypeError|SyntaxError/i.test(e.name));
    // If any are present, attach them to the test output (Playwright will surface attachments added in afterEach).
    expect(criticalErrors.length).toBe(0);

    // Also assert there are no console.error messages
    expect(consoleErrors.length).toBe(0);
  });
});