import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a299d0-fa7b-11f0-8b01-9f078a0ff214.html';

// Page object for the demonstration application
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Selector described in the FSM and implementation
    this.toggleButton = page.locator("button[onclick='showDemonstration()']");
    this.demoDiv = page.locator('#demonstration');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for button to be available as a quick sanity check
    await this.toggleButton.waitFor({ state: 'visible', timeout: 3000 });
  }

  // Return computed visibility based on getComputedStyle
  async isDemoVisible() {
    return await this.demoDiv.evaluate((el) => {
      return window.getComputedStyle(el).display !== 'none';
    });
  }

  // Return the inline style.display value (to check the function's direct effect)
  async demoInlineDisplayValue() {
    return await this.demoDiv.evaluate((el) => el.style.display);
  }

  async clickToggle() {
    await this.toggleButton.click();
  }

  // Returns inner text of the demonstration area for content assertions
  async demoText() {
    return await this.demoDiv.textContent();
  }

  // Check that the showDemonstration function exists in global scope
  async hasShowDemonstrationFunction() {
    return await this.page.evaluate(() => typeof window.showDemonstration === 'function');
  }
}

test.describe('Understanding HTTP - Demonstration FSM tests (d5a299d0-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Containers for console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Attach listeners to capture console messages and page errors
    page._collectedConsole = [];
    page._collectedPageErrors = [];

    page.on('console', (msg) => {
      // Collect all console messages with their type and text
      page._collectedConsole.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Collect unhandled exceptions
      page._collectedPageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test assert that no unexpected page errors or console errors occurred.
    // The FSM and provided implementation are expected to be stable; this assertion ensures no runtime errors.
    const consoleErrors = (page._collectedConsole || []).filter(m => m.type === 'error');
    const pageErrors = page._collectedPageErrors || [];

    // If there are errors, include their messages in the assertion output for debugging.
    expect(pageErrors.length, `No uncaught page errors expected. Found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `No console.error messages expected. Found: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test('Initial state (S0_Idle): demonstration is hidden and button is present', async ({ page }) => {
    // This test validates the FSM initial state S0_Idle:
    // - #demonstration should be hidden (computed display none)
    // - the button that triggers the demonstration exists and has the expected text
    const demo = new DemoPage(page);
    await demo.goto();

    // Button presence and text
    await expect(demo.toggleButton).toBeVisible();
    await expect(demo.toggleButton).toHaveText('Show HTTP Request Example');

    // Demo div exists but is hidden by CSS initially (computed style should be 'none')
    const visible = await demo.isDemoVisible();
    expect(visible, '#demonstration should be hidden in the Idle state').toBe(false);

    // Inline style is likely empty initially because CSS sets display:none; ensure code accounts for that
    const inlineDisplay = await demo.demoInlineDisplayValue();
    // It is acceptable for inline style to be '' initially (script checks for ''), assert that it's either '' or 'none'
    expect(['', 'none']).toContain(inlineDisplay);
  });

  test('Transition S0_Idle -> S1_DemonstrationVisible when clicking the button shows demonstration', async ({ page }) => {
    // This test validates the "ShowDemonstration" event:
    // - clicking the button should make #demonstration visible (computed display block)
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure the showDemonstration function exists (entry action must be callable)
    const hasFn = await demo.hasShowDemonstrationFunction();
    expect(hasFn, 'showDemonstration function should be defined on the page').toBe(true);

    // Click the toggle button to transition to Demonstration Visible
    await demo.clickToggle();

    // After clicking, computed style should show the demo
    const visible = await demo.isDemoVisible();
    expect(visible, 'After clicking the button, #demonstration should be visible').toBe(true);

    // Inline style should have been set to 'block' by the function implementation
    const inlineDisplay = await demo.demoInlineDisplayValue();
    expect(inlineDisplay, 'Inline style.display should be set to block after first click').toBe('block');

    // Content sanity checks - the demonstration area should contain expected heading text
    const text = await demo.demoText();
    expect(text).toContain('HTTP Request Demonstration');
    expect(text).toContain('GET / HTTP/1.1');
  });

  test('Transition S1_DemonstrationVisible -> S0_Idle clicking the button again hides demonstration', async ({ page }) => {
    // This test validates toggling back to Idle:
    // - clicking the same button when demonstration is visible hides it
    const demo = new DemoPage(page);
    await demo.goto();

    // Show it first
    await demo.clickToggle();
    expect(await demo.isDemoVisible(), 'Demo should be visible after first click').toBe(true);

    // Click again to hide
    await demo.clickToggle();

    // After second click, computed style should be hidden
    expect(await demo.isDemoVisible(), 'Demo should be hidden after second click').toBe(false);

    // The inline style should now be 'none' (script sets inline to 'none' on hide)
    const inlineDisplayAfterHide = await demo.demoInlineDisplayValue();
    expect(inlineDisplayAfterHide, 'Inline style.display should be set to none after hiding').toBe('none');
  });

  test('Repeated toggles maintain correct visible/hidden states (idempotence and stability)', async ({ page }) => {
    // This test exercises multiple transitions repeatedly to ensure state toggling remains stable
    const demo = new DemoPage(page);
    await demo.goto();

    // Click a sequence of times and assert expected parity: odd -> visible, even -> hidden
    for (let i = 1; i <= 5; i++) {
      await demo.clickToggle();
      const expectedVisible = i % 2 === 1;
      const actualVisible = await demo.isDemoVisible();
      expect(actualVisible, `After ${i} clicks expected visible=${expectedVisible}`).toBe(expectedVisible);
    }
  });

  test('Clicking inside the demonstration content does not trigger errors or unexpected state changes', async ({ page }) => {
    // Edge case: interacting with inner content should not cause state transitions or JS errors
    const demo = new DemoPage(page);
    await demo.goto();

    // Show demo
    await demo.clickToggle();
    expect(await demo.isDemoVisible(), 'Demo should be visible after click').toBe(true);

    // Click inside the demonstration area (for example on the <pre> block). This should not hide it.
    // We intentionally exercise user interaction inside the demo content.
    const preLocator = page.locator('#demonstration pre').first();
    await expect(preLocator).toBeVisible();
    await preLocator.click();

    // Ensure no runtime errors were emitted (checked in afterEach) and the demo remains visible
    expect(await demo.isDemoVisible(), 'Clicking inside the demo should not hide it').toBe(true);
  });

  test('Sanity check: showDemonstration toggles inline style from empty -> block -> none according to implementation logic', async ({ page }) => {
    // This test inspects the inline style transitions to validate the exact implementation behavior described in the HTML.
    const demo = new DemoPage(page);
    await demo.goto();

    // Initial inline style should be '' (CSS hides via stylesheet)
    const initialInline = await demo.demoInlineDisplayValue();
    expect(initialInline === '' || initialInline === 'none', 'Initial inline style should be empty string or none').toBeTruthy();

    // First click should set inline style to 'block'
    await demo.clickToggle();
    expect(await demo.demoInlineDisplayValue(), 'After first click inline style should be block').toBe('block');

    // Second click should set inline style to 'none'
    await demo.clickToggle();
    expect(await demo.demoInlineDisplayValue(), 'After second click inline style should be none').toBe('none');
  });
});