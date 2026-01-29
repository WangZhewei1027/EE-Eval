import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9b5e02-fa78-11f0-857d-d58e82d5de73.html';

// Page Object Model for the interactive application
class StaticTypingPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      toggleBtn: '#toggleTheme',
      codePanel: '.code-panel',
      pre: '.code-panel pre.code-content'
    };
  }

  // Navigate to the page and wait for load
  async goto() {
    await this.page.goto(BASE_URL, { waitUntil: 'load' });
    // ensure the main interactive elements are present
    await Promise.all([
      this.page.waitForSelector(this.selectors.toggleBtn),
      this.page.waitForSelector(this.selectors.codePanel),
      this.page.waitForSelector(this.selectors.pre)
    ]);
  }

  // Return the button element handle
  async toggleButton() {
    return this.page.locator(this.selectors.toggleBtn);
  }

  // Click the toggle button
  async clickToggle() {
    await this.page.click(this.selectors.toggleBtn);
  }

  // Press keyboard key on toggle button (to test accessibility activation)
  async pressKeyOnToggle(key) {
    const btn = this.page.locator(this.selectors.toggleBtn);
    await btn.focus();
    await this.page.keyboard.press(key);
  }

  // Read aria-pressed of the toggle button
  async getAriaPressed() {
    return this.page.getAttribute(this.selectors.toggleBtn, 'aria-pressed');
  }

  // Read button text content
  async getButtonText() {
    return this.page.textContent(this.selectors.toggleBtn);
  }

  // Read inline background style of code panel (value set by JS on toggle)
  async getCodePanelInlineBackground() {
    return this.page.$eval(this.selectors.codePanel, el => el.style.background || '');
  }

  // Read inline boxShadow style of code panel
  async getCodePanelInlineBoxShadow() {
    return this.page.$eval(this.selectors.codePanel, el => el.style.boxShadow || '');
  }

  // Read computed color of the pre element (returns rgb(...) string)
  async getPreComputedColor() {
    return this.page.$eval(this.selectors.pre, el => getComputedStyle(el).color);
  }

  // Read inline color style of pre (if any)
  async getPreInlineColor() {
    return this.page.$eval(this.selectors.pre, el => el.style.color || '');
  }
}

test.describe('Static Typing — Theme Toggle FSM (3c9b5e02-fa78-11f0-857d-d58e82d5de73)', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset error collectors for each test
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        // store textual representation for assertions and debugging
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Collect page errors (unhandled exceptions)
    page.on('pageerror', error => {
      pageErrors.push({
        message: error.message,
        stack: error.stack
      });
    });
  });

  test.afterEach(async () => {
    // After each test, ensure that no unexpected runtime errors were emitted.
    // This asserts that the page executed without console 'error' messages or uncaught page errors.
    // If errors did occur naturally, the arrays would be non-empty and the assertion would fail,
    // surfacing runtime issues in the implementation.
    expect(consoleErrors, `Console error messages were emitted: ${JSON.stringify(consoleErrors, null, 2)}`).toHaveLength(0);
    expect(pageErrors, `Unhandled page errors were emitted: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
  });

  test('Initial state: S0_DarkTheme is represented by the toggle button (aria-pressed=false)', async ({ page }) => {
    // Validate initial "Dark Theme" state per FSM evidence:
    // - toggleBtn should have aria-pressed="false"
    // - button text should be "Dark Theme"
    // We do not modify the page; we only assert the existing initial state.
    const app = new StaticTypingPage(page);
    await app.goto();

    // Validate toggle button existence and initial attributes
    const ariaPressed = await app.getAriaPressed();
    const btnText = await app.getButtonText();

    // The FSM evidence expects aria-pressed to be 'false' in dark theme state
    expect(ariaPressed).toBe('false');
    expect(btnText.trim()).toBe('Dark Theme');

    // Also confirm the pre element uses the dark colored text as per CSS (computed style)
    // CSS defines pre.color: #c9f7f0 -> rgb(201, 247, 240)
    const preColor = await app.getPreComputedColor();
    expect(preColor).toBe('rgb(201, 247, 240)');
  });

  test('Transition: ToggleThemeClick -> clicking toggles to Light Theme (S0 -> S1)', async ({ page }) => {
    // Validate that clicking the toggle button transitions the UI to the Light Theme:
    // - aria-pressed becomes 'true'
    // - button text becomes 'Light Theme'
    // - codePanel.style.background is set to the expected light background string
    // - pre computed color changes to the lightStyles.color (rgb(25, 31, 36))
    const app = new StaticTypingPage(page);
    await app.goto();

    // Perform the click that should trigger the ToggleThemeClick event
    await app.clickToggle();

    // Assert the FSM target state evidence: aria-pressed 'true' and button text change
    const ariaPressedAfter = await app.getAriaPressed();
    const btnTextAfter = (await app.getButtonText()).trim();
    expect(ariaPressedAfter).toBe('true');
    expect(btnTextAfter).toBe('Light Theme');

    // The implementation sets inline styles when switching to light theme.
    // The JS sets: codePanel.style.background = 'linear-gradient(145deg, #edf2f7, #d1dae6)'
    const inlineBackground = await app.getCodePanelInlineBackground();
    expect(inlineBackground).toBe('linear-gradient(145deg, #edf2f7, #d1dae6)');

    // The pre element color should be set to lightStyles.color '#191f24' -> rgb(25, 31, 36)
    const preColorAfter = await app.getPreComputedColor();
    expect(preColorAfter).toBe('rgb(25, 31, 36)');
  });

  test('Transition: ToggleThemeClick -> clicking again toggles back to Dark Theme (S1 -> S0)', async ({ page }) => {
    // Validate toggling twice returns to the original state:
    // - after two clicks aria-pressed should be 'false'
    // - button text should revert to 'Dark Theme'
    // - codePanel.style.background should be darkStyles.background string
    // - pre computed color reverts to dark color rgb(201, 247, 240)
    const app = new StaticTypingPage(page);
    await app.goto();

    // Click twice (S0 -> S1 -> S0)
    await app.clickToggle(); // to Light
    await app.clickToggle(); // back to Dark

    const ariaPressedFinal = await app.getAriaPressed();
    const btnTextFinal = (await app.getButtonText()).trim();
    expect(ariaPressedFinal).toBe('false');
    expect(btnTextFinal).toBe('Dark Theme');

    // The implementation sets inline background when toggling back to dark:
    // codePanel.style.background = 'linear-gradient(145deg, #15202b, #192734)'
    const inlineBackgroundFinal = await app.getCodePanelInlineBackground();
    expect(inlineBackgroundFinal).toBe('linear-gradient(145deg, #15202b, #192734)');

    const preColorFinal = await app.getPreComputedColor();
    expect(preColorFinal).toBe('rgb(201, 247, 240)');
  });

  test('Accessibility / Edge case: activating the toggle via keyboard toggles theme', async ({ page }) => {
    // Validate keyboard interaction (Enter and Space) also triggers the same transition event.
    const app = new StaticTypingPage(page);
    await app.goto();

    // Activate with Enter (should toggle to Light)
    await app.pressKeyOnToggle('Enter');
    let ariaPressed = await app.getAriaPressed();
    expect(ariaPressed).toBe('true');

    // Activate with Space (should toggle back to Dark)
    await app.pressKeyOnToggle('Space');
    ariaPressed = await app.getAriaPressed();
    expect(ariaPressed).toBe('false');
  });

  test('Edge case: rapid multiple clicks maintain deterministic toggling behavior', async ({ page }) => {
    // Rapidly click the toggle several times and ensure final state matches parity of number of clicks.
    const app = new StaticTypingPage(page);
    await app.goto();

    // Click 5 times rapidly -> odd number => should end in Light Theme (aria-pressed 'true')
    const rapidClicks = 5;
    for (let i = 0; i < rapidClicks; i++) {
      // Fire clicks without awaiting re-render delays to simulate rapid user clicks
      await page.click('#toggleTheme');
    }

    const ariaPressedRapid = await app.getAriaPressed();
    expect(ariaPressedRapid).toBe('true');

    // Now click one more time to make it even (6) -> should be back to Dark
    await app.clickToggle();
    expect(await app.getAriaPressed()).toBe('false');
  });

  test('DOM robustness: verify that expected elements exist and attributes are stable', async ({ page }) => {
    // This test ensures that core components referenced in FSM/extraction summary are present and have correct initial attributes.
    // The extraction summary mentions a button with id="toggleTheme" and aria-label and aria-pressed attributes.
    const app = new StaticTypingPage(page);
    await app.goto();

    const toggle = page.locator('#toggleTheme');
    await expect(toggle).toHaveAttribute('aria-label', 'Toggle code panel theme');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // Ensure the code-panel has an accessible label and the pre has aria-live polices as implemented
    const codePanel = page.locator('.code-panel');
    await expect(codePanel).toHaveAttribute('aria-label', 'Example code demonstrating static typing');

    const pre = page.locator('pre.code-content');
    await expect(pre).toHaveAttribute('aria-live', 'polite');
    await expect(pre).toHaveAttribute('aria-atomic', 'true');
  });

  test('Observation: listen to console and page errors during interaction', async ({ page }) => {
    // This test purposely interacts with the page while capturing console/page errors to assert that the app does not emit runtime errors.
    const app = new StaticTypingPage(page);
    await app.goto();

    // Interact: toggle theme a few times and hover tooltips to exercise code paths
    await app.clickToggle();
    await app.clickToggle();

    // Hover over a tooltip token to trigger ::after pseudo behavior (no DOM changes but exercise)
    await page.hover('.token.type.tooltip');

    // The afterEach will assert that consoleErrors and pageErrors arrays remain empty.
    // We still perform an explicit check here to fail fast if any errors already occurred.
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });
});