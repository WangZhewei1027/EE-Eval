import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8374e71-fa7b-11f0-b314-ad8654ee5de8.html';

/**
 * Page object model for the example toggle interactive.
 * Encapsulates locators and common operations.
 */
class ExamplePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggle = page.locator('#toggleExample');
    this.area = page.locator('#exampleArea');
  }

  // Navigate to the app and wait for initial DOM
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // allow any inline scripts to execute
    await this.page.waitForLoadState('networkidle');
  }

  // Returns the button's visible text
  async getButtonText() {
    return (await this.toggle.innerText()).trim();
  }

  // Returns the inline style display attribute value of the example area
  async getAreaInlineDisplay() {
    return await this.area.evaluate((el) => el.style.display);
  }

  // Returns whether area is considered visible based on inline style set by script
  async isAreaVisible() {
    const disp = await this.getAreaInlineDisplay();
    // Script toggles between 'none' and 'block'. Treat 'block' as visible.
    return disp === 'block';
  }

  // Click the toggle button
  async clickToggle() {
    await this.toggle.click();
  }

  // Convenience to click multiple times
  async clickToggleTimes(n) {
    for (let i = 0; i < n; i++) {
      await this.clickToggle();
      // small delay to allow handler to run and DOM to update
      await this.page.waitForTimeout(50);
    }
  }
}

test.describe('NP-Completeness Interactive — FSM validation', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // reset captures
    consoleMessages = [];
    pageErrors = [];

    // capture console messages (text + type)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we will assert there were no unexpected runtime errors.
    // This verifies the page loaded and executed its inline script without throwing.
    // We also check the console for any messages of type 'error' or mentions of ReferenceError/SyntaxError/TypeError.
    expect(pageErrors.length, 'No uncaught page errors should have occurred').toBe(0);

    const errorConsole = consoleMessages.filter((m) => m.type === 'error' ||
      /ReferenceError|SyntaxError|TypeError/i.test(m.text));

    expect(
      errorConsole.length,
      `No console errors or JavaScript exceptions should be present; found: ${JSON.stringify(errorConsole)}`
    ).toBe(0);
  });

  test.describe('Initial state (S0_Idle)', () => {
    test('Initial Idle state renders button and hides example area', async ({ page }) => {
      // This test validates entry actions for Idle (renderPage()) by checking the initial DOM.
      const p = new ExamplePage(page);
      await p.goto();

      // Button exists and has the correct initial text
      await expect(p.toggle).toBeVisible();
      const btnText = await p.getButtonText();
      expect(btnText).toBe('Show / Hide Example Reduction');

      // Example area should be present in the DOM and inline style should be 'none' (hidden)
      await expect(p.area).toBeVisible(); // element exists in layout (visibility via CSS not considered here)
      const display = await p.getAreaInlineDisplay();
      // The implementation sets style="display:none;" inline in HTML. We assert that inline style reflects hidden state.
      expect(display).toBe('none');
    });
  });

  test.describe('Toggle behavior and FSM transitions', () => {
    test('S0_Idle -> S1_ExampleVisible: clicking shows the example and updates button text', async ({ page }) => {
      // Validate transition from Idle to Example Visible
      const p = new ExamplePage(page);
      await p.goto();

      // Precondition: area hidden
      expect(await p.getAreaInlineDisplay()).toBe('none');
      expect(await p.getButtonText()).toBe('Show / Hide Example Reduction');

      // Trigger: click toggle
      await p.clickToggle();

      // After click, example area should be visible (inline style 'block') and button text should change
      expect(await p.getAreaInlineDisplay()).toBe('block');
      expect(await p.getButtonText()).toBe('Hide Example Reduction');

      // Additionally verify some content inside the example area (sanity check on DOM change)
      // There should be an <h3> with text "Example formula"
      const exampleHeading = p.area.locator('h3', { hasText: 'Example formula' });
      await expect(exampleHeading).toBeVisible();
    });

    test('S1_ExampleVisible -> S2_ExampleHidden: clicking hides the example and resets button text', async ({ page }) => {
      // Validate transition from Visible to Hidden
      const p = new ExamplePage(page);
      await p.goto();

      // Show first
      await p.clickToggle();
      expect(await p.getAreaInlineDisplay()).toBe('block');
      expect(await p.getButtonText()).toBe('Hide Example Reduction');

      // Click again to hide
      await p.clickToggle();

      // After second click, inline style should be 'none' and button text reset
      expect(await p.getAreaInlineDisplay()).toBe('none');
      expect(await p.getButtonText()).toBe('Show / Hide Example Reduction');

      // The example area still exists in DOM; verify it contains the expected preformatted formula text
      const pre = p.area.locator('pre');
      await expect(pre).toBeVisible();
      const preText = (await pre.innerText()).trim();
      expect(preText.length).toBeGreaterThan(0);
      expect(preText).toContain('(x1 ∨ x2 ∨ ¬x3)');
    });

    test('S2_ExampleHidden -> S1_ExampleVisible: toggling multiple times alternates visibility correctly', async ({ page }) => {
      // Validate repeated toggles cycle between states as defined in FSM (Hidden -> Visible -> Hidden ...)
      const p = new ExamplePage(page);
      await p.goto();

      // Start hidden; click 5 times (odd -> visible)
      await p.clickToggleTimes(5);

      // After 5 clicks, visible
      expect(await p.isAreaVisible()).toBe(true);
      expect(await p.getButtonText()).toBe('Hide Example Reduction');

      // Click once more -> 6 total -> hidden
      await p.clickToggle();
      expect(await p.isAreaVisible()).toBe(false);
      expect(await p.getButtonText()).toBe('Show / Hide Example Reduction');
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Rapid clicks: parity of clicks results in expected final state', async ({ page }) => {
      // Rapidly click the button 10 times and verify final state matches parity
      const p = new ExamplePage(page);
      await p.goto();

      // Initially hidden. After 10 clicks (even), should remain hidden.
      await p.clickToggleTimes(10);
      expect(await p.isAreaVisible()).toBe(false);
      expect(await p.getButtonText()).toBe('Show / Hide Example Reduction');

      // Now click once more -> 11 (odd) visible
      await p.clickToggle();
      expect(await p.isAreaVisible()).toBe(true);
      expect(await p.getButtonText()).toBe('Hide Example Reduction');
    });

    test('DOM integrity: example area contains expected structural elements when visible', async ({ page }) => {
      // Ensure that when example is visible, it contains expected subsections and that content did not get corrupted
      const p = new ExamplePage(page);
      await p.goto();

      // Show area
      await p.clickToggle();
      expect(await p.isAreaVisible()).toBe(true);

      // Check presence of several key headings inside exampleArea
      const headings = [
        'Example formula',
        'Step 1: Create vertices',
        'Step 2: Add edges between vertices from different clauses if literals are not contradictory',
        'Step 3: Set k = number of clauses = 3'
      ];

      for (const text of headings) {
        const locator = p.area.locator('h3', { hasText: text });
        // Some headings are <h3>, some are <h3> with slightly different phrasing; assert at least one matching node is present
        await expect(locator.first(), `Expected heading containing "${text}"`).toBeVisible();
      }

      // sanity: pre block contains the sample formula
      const pre = p.area.locator('pre');
      await expect(pre).toContainText('x1');
      await expect(pre).toContainText('x4');
    });

    test('No unexpected JavaScript exceptions or console errors occurred during interactions', async ({ page }) => {
      // This test specifically stresses the page by toggling a few times while capturing logs,
      // then asserts that no uncaught JS exceptions or console error messages were emitted.
      const p = new ExamplePage(page);

      // Attach local listeners (these will add to the arrays in beforeEach)
      await p.goto();

      // Perform interactions
      await p.clickToggleTimes(3);
      await p.page.waitForTimeout(100);
      await p.clickToggleTimes(2);

      // At the end of the test block, afterEach will assert no page errors and no console errors.
      // We add additional runtime assertions here as well for clarity:
      const jsErrors = pageErrors.length;
      expect(jsErrors, 'There should be no uncaught JS exceptions during interactions').toBe(0);

      const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || /ReferenceError|SyntaxError|TypeError/i.test(m.text));
      expect(consoleErrors.length, `Console should not contain runtime error messages; found: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });
  });
});