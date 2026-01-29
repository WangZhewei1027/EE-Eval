import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8397151-fa7b-11f0-b314-ad8654ee5de8.html';

// Page object representing the minimal interactive parts used in the FSM.
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Navigate to the page and wait for main container to be available.
  async load() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await this.page.waitForSelector('.container');
  }

  // Returns locator for the toggle button
  button() {
    return this.page.locator('#demoToggle');
  }

  // Returns locator for the demo panel
  demo() {
    return this.page.locator('#demo');
  }

  // Click the toggle button
  async clickToggle() {
    await this.button().click();
  }

  // Gets the button's aria-expanded attribute as string
  async getButtonAriaExpanded() {
    return await this.button().getAttribute('aria-expanded');
  }

  // Gets the button visible text content trimmed
  async getButtonText() {
    return (await this.button().innerText()).trim();
  }

  // Gets the demo element's aria-hidden attribute as string
  async getDemoAriaHidden() {
    return await this.demo().getAttribute('aria-hidden');
  }

  // Gets the demo element's inline style attribute (string) if present
  async getDemoInlineStyle() {
    return await this.demo().getAttribute('style');
  }

  // Gets the computed display style for the demo element (e.g., 'none' or 'block')
  async getDemoComputedDisplay() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).display;
    }, '#demo');
  }

  // Returns true if demo is considered visible via computedStyle
  async isDemoVisible() {
    const display = await this.getDemoComputedDisplay();
    return display !== 'none';
  }
}

test.describe('d8397151-fa7b-11f0-b314-ad8654ee5de8 — Demo toggle FSM tests', () => {
  // Arrays to collect console messages and page errors for each test.
  let consoleMessages;
  let pageErrors;

  // Setup a fresh page for each test, attach listeners to capture console & page errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info/warn/error). We'll assert none are errors later.
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture unhandled page errors (e.g., ReferenceError, TypeError).
    page.on('pageerror', (err) => {
      // Serialize to include name and message for assertions
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    });
  });

  // No explicit teardown needed; Playwright closes pages between tests automatically.
  // But assert that we didn't accidentally collect errors across tests by cleaning arrays in beforeEach.

  test('Initial state (S0_Idle) - button exists, demo hidden, aria attributes set', async ({ page }) => {
    const demoPage = new DemoPage(page);
    // Load the page (do not modify any JS on the page)
    await demoPage.load();

    // Verify the toggle button exists and its initial attributes match the FSM evidence.
    const button = demoPage.button();
    await expect(button).toBeVisible(); // button is visible in UI
    const ariaExpanded = await demoPage.getButtonAriaExpanded();
    expect(ariaExpanded).toBe('false'); // expected initial state per FSM

    const buttonText = await demoPage.getButtonText();
    expect(buttonText).toBe('Toggle small merge demonstration'); // initial label per HTML

    // Verify demo panel exists in the DOM and is hidden initially.
    const demo = demoPage.demo();
    await expect(demo).toBeVisible(); // element exists; "visible" here means in DOM; computed style may be none
    // Check the inline style attribute and computed style
    const inlineStyle = await demoPage.getDemoInlineStyle();
    expect(inlineStyle).toBeTruthy(); // attribute exists (style="display:none;")
    expect(inlineStyle).toContain('display:none');
    const computedDisplay = await demoPage.getDemoComputedDisplay();
    expect(computedDisplay).toBe('none'); // ensure it's not rendered (hidden)

    const ariaHidden = await demoPage.getDemoAriaHidden();
    expect(ariaHidden).toBe('true'); // matches FSM evidence

    // Observe console & page errors did not produce any runtime errors on load.
    // We assert that no pageerror events fired and no console messages of type "error" exist.
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoVisible on ToggleDemo (click) - demo becomes visible', async ({ page }) => {
    const demoPage = new DemoPage(page);
    await demoPage.load();

    // Validate precondition
    expect(await demoPage.getDemoAriaHidden()).toBe('true');
    expect(await demoPage.getButtonAriaExpanded()).toBe('false');

    // Perform the event: click toggle button
    await demoPage.clickToggle();

    // After click, verify expected observables per transition evidence:
    // - demo[aria-hidden='false']
    // - demo[style*='display: block']
    const ariaHiddenAfter = await demoPage.getDemoAriaHidden();
    expect(ariaHiddenAfter).toBe('false');

    const inlineStyleAfter = await demoPage.getDemoInlineStyle();
    expect(inlineStyleAfter).toBeTruthy();
    // Inline style might be "display:block;" — assert it contains display and block
    expect(inlineStyleAfter.replace(/\s/g, '')).toContain('display:block');

    const computedDisplay = await demoPage.getDemoComputedDisplay();
    expect(computedDisplay === 'block' || computedDisplay === 'inline' || computedDisplay === 'flex' || computedDisplay === 'grid').toBeTruthy();
    // Also ensure button aria-expanded updated and button text changed to "Hide merge demonstration"
    const ariaExpandedAfter = await demoPage.getButtonAriaExpanded();
    expect(ariaExpandedAfter).toBe('true');
    const buttonTextAfter = await demoPage.getButtonText();
    expect(buttonTextAfter).toBe('Hide merge demonstration');

    // Ensure no runtime errors were thrown during the toggle action.
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1_DemoVisible -> S2_DemoHidden on ToggleDemo (click) - hides again', async ({ page }) => {
    const demoPage = new DemoPage(page);
    await demoPage.load();

    // Bring panel visible first
    await demoPage.clickToggle();
    expect(await demoPage.getDemoAriaHidden()).toBe('false');
    expect(await demoPage.getButtonAriaExpanded()).toBe('true');

    // Now click to hide
    await demoPage.clickToggle();

    // After click, verify demo is hidden again as per FSM (S2_DemoHidden)
    const ariaHiddenAfterHide = await demoPage.getDemoAriaHidden();
    expect(ariaHiddenAfterHide).toBe('true');

    const inlineStyleAfterHide = await demoPage.getDemoInlineStyle();
    expect(inlineStyleAfterHide).toBeTruthy();
    expect(inlineStyleAfterHide.replace(/\s/g, '')).toContain('display:none');

    const computedDisplayAfterHide = await demoPage.getDemoComputedDisplay();
    expect(computedDisplayAfterHide).toBe('none');

    const ariaExpandedAfterHide = await demoPage.getButtonAriaExpanded();
    expect(ariaExpandedAfterHide).toBe('false');

    // Ensure no runtime errors during the hide action.
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S2_DemoHidden -> S1_DemoVisible on ToggleDemo (click) - shows after hidden state', async ({ page }) => {
    const demoPage = new DemoPage(page);
    await demoPage.load();

    // Ensure starting hidden
    expect(await demoPage.getDemoAriaHidden()).toBe('true');

    // Click once to show
    await demoPage.clickToggle();

    // Now we should be in visible state
    expect(await demoPage.getDemoAriaHidden()).toBe('false');
    expect(await demoPage.getButtonAriaExpanded()).toBe('true');

    // Minimal checks of observables
    const inlineStyle = await demoPage.getDemoInlineStyle();
    expect(inlineStyle.replace(/\s/g, '')).toContain('display:block');
    const computedDisplay = await demoPage.getDemoComputedDisplay();
    expect(computedDisplay !== 'none').toBeTruthy();

    // Check for no unexpected runtime errors
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Rapid toggles -- state alternates predictably and demo element remains present', async ({ page }) => {
    const demoPage = new DemoPage(page);
    await demoPage.load();

    // We'll click the toggle button several times rapidly and verify the expected visible/hidden alternating behavior.
    // Starting state: hidden ('false' for aria-expanded)
    const steps = 5; // odd number ensures final should be visible
    for (let i = 0; i < steps; i++) {
      await demoPage.clickToggle();
      // After each click, briefly wait for microtask to allow event handler to run
      await page.waitForTimeout(20);
      // Compute expected state after i+1 clicks:
      const shouldBeVisible = ((i + 1) % 2) === 1;
      const computedVisible = await demoPage.isDemoVisible();
      expect(computedVisible).toBe(shouldBeVisible);
      // Also check aria attributes consistent with computed visibility
      const demoAriaHidden = await demoPage.getDemoAriaHidden();
      expect(demoAriaHidden).toBe(shouldBeVisible ? 'false' : 'true');
      const btnAria = await demoPage.getButtonAriaExpanded();
      expect(btnAria).toBe(shouldBeVisible ? 'true' : 'false');

      // Ensure the demo element itself is never removed from DOM
      const demoCount = await page.locator('#demo').count();
      expect(demoCount).toBeGreaterThan(0);
    }

    // Final assertion: after odd number of clicks, should be visible
    expect(await demoPage.isDemoVisible()).toBe(true);

    // Check console & page errors didn't occur during rapid interactions
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Accessibility attributes remain string "true"/"false" and button text toggles consistently', async ({ page }) => {
    const demoPage = new DemoPage(page);
    await demoPage.load();

    // Check initial types are strings and values are 'true'/'false'
    const initialButtonAria = await demoPage.getButtonAriaExpanded();
    expect(typeof initialButtonAria).toBe('string');
    expect(['true', 'false']).toContain(initialButtonAria);

    const initialDemoAria = await demoPage.getDemoAriaHidden();
    expect(typeof initialDemoAria).toBe('string');
    expect(['true', 'false']).toContain(initialDemoAria);

    // Toggle and verify types remain strings and button text switches between two known labels
    await demoPage.clickToggle();
    const expandedAfter = await demoPage.getButtonAriaExpanded();
    const demoHiddenAfter = await demoPage.getDemoAriaHidden();
    expect(typeof expandedAfter).toBe('string');
    expect(['true', 'false']).toContain(expandedAfter);
    expect(typeof demoHiddenAfter).toBe('string');
    expect(['true', 'false']).toContain(demoHiddenAfter);

    const textAfterShow = await demoPage.getButtonText();
    expect(textAfterShow).toBe('Hide merge demonstration');

    // Toggle back
    await demoPage.clickToggle();
    const textAfterHide = await demoPage.getButtonText();
    expect(textAfterHide).toBe('Toggle small merge demonstration');

    // No runtime errors related to ARIA changes
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console messages and page errors: capture and surface if any ReferenceError/TypeError/SyntaxError occurred', async ({ page }) => {
    const demoPage = new DemoPage(page);
    await demoPage.load();

    // Perform an action to exercise the event handler
    await demoPage.clickToggle();
    await page.waitForTimeout(20);

    // Collect any console text that mentions common JS error names
    const errorLikeConsole = consoleMessages.filter((m) =>
      /ReferenceError|TypeError|SyntaxError|Uncaught/i.test(m.text)
    );

    // Collect page errors by name
    const jsPageErrors = pageErrors.map((e) => e.name);

    // Assert that no unhandled page errors of the types ReferenceError/TypeError/SyntaxError occurred.
    // If such an error did occur naturally, this test surfaces it by failing with detailed information.
    const problematicPageErrors = pageErrors.filter((e) =>
      e.name === 'ReferenceError' || e.name === 'TypeError' || e.name === 'SyntaxError'
    );

    expect(problematicPageErrors.length).toBe(0);

    // Also assert there are no console.error messages that contain JS error names.
    expect(errorLikeConsole.length).toBe(0);

    // As an additional check: ensure console messages captured (if any) are informational only.
    // We still allow console messages but assert none are of type 'error'.
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // If any page errors were captured of other types, fail and surface them (keeps tests honest).
    expect(jsPageErrors).toEqual([]); // expects no page errors at all
  });
});