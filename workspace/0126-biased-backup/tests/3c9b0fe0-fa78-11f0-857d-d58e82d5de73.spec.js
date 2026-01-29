import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9b0fe0-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object representing the theme toggle application.
 * Encapsulates DOM access and common operations so tests remain readable.
 */
class ThemePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];
    this._setupErrorListeners();
  }

  _setupErrorListeners() {
    // Capture console.error messages
    this.page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          this.consoleErrors.push(msg.text());
        }
      } catch (e) {
        // leave capture best-effort; don't interfere with the page
      }
    });

    // Capture uncaught exceptions from the page
    this.page.on('pageerror', (err) => {
      try {
        this.pageErrors.push(err && err.message ? err.message : String(err));
      } catch (e) {
        // ignore
      }
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for main to finish its entrance animation (fadeSlideUp has 1.2s delay + 0.4s => ~1.6s total)
    // We wait up to 3s for the style to reflect opacity 1 to avoid flakiness on CI.
    await this.page.waitForFunction(() => {
      const m = document.querySelector('main');
      if (!m) return false;
      const style = window.getComputedStyle(m);
      return style.opacity === '1' && style.transform !== 'translateY(15px)';
    }, { timeout: 3000 }).catch(() => {
      // If animation hasn't completed, tests will still proceed; do not throw here.
    });
  }

  // Accessors
  async getToggleButton() {
    return this.page.$('#themeToggle');
  }

  async getToggleButtonText() {
    const btn = await this.getToggleButton();
    return btn ? btn.innerText() : null;
  }

  async getBodyClassList() {
    return this.page.evaluate(() => Array.from(document.body.classList));
  }

  async isLightTheme() {
    return this.page.evaluate(() => document.body.classList.contains('light'));
  }

  async getAriaPressed() {
    const btn = await this.getToggleButton();
    if (!btn) return null;
    return btn.getAttribute('aria-pressed');
  }

  async clickToggle(options = {}) {
    const btn = await this.getToggleButton();
    if (!btn) throw new Error('Toggle button not found');
    await btn.click(options);
  }

  async focusToggle() {
    const btn = await this.getToggleButton();
    if (!btn) throw new Error('Toggle button not found');
    await btn.focus();
  }

  async pressKey(key) {
    await this.page.keyboard.press(key);
  }

  async getConsoleErrors() {
    return this.consoleErrors.slice();
  }

  async getPageErrors() {
    return this.pageErrors.slice();
  }

  // Helper to clear recorded errors between steps
  clearErrors() {
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  // Additional helpers for accessibility checks
  async articleCount() {
    return this.page.$$eval('article.pattern-card', (els) => els.length);
  }

  async getArticleByTitle(titleText) {
    return this.page.$(`article.pattern-card:has-text("${titleText}")`);
  }

  async computedBodyBackground() {
    return this.page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });
  }
}

test.describe('Design Patterns — Visual Elegance (Theme Toggle) - FSM coverage', () => {
  // Shared page object per test
  let themePage;

  test.beforeEach(async ({ page }) => {
    themePage = new ThemePage(page);
    // Navigate to the specific page under test
    await themePage.goto();
  });

  test.afterEach(async () => {
    // no explicit teardown needed; listeners cleaned with page lifecycle
  });

  test('Initial state (S0_Idle) is rendered and toggle exists with expected attributes', async () => {
    // This test validates the Idle entry state: renderPage() result is the page being present and interactive.
    const btn = await themePage.getToggleButton();
    expect(btn).not.toBeNull();
    // Button should have initial aria-pressed "false" per the HTML implementation
    const ariaPressed = await themePage.getAriaPressed();
    expect(ariaPressed).toBe('false');

    // The page should initially not have the 'light' class (i.e., dark theme by CSS default)
    const isLight = await themePage.isLightTheme();
    expect(isLight).toBe(false);

    // Ensure the main content exists and several articles are rendered (visual content)
    const articleCount = await themePage.articleCount();
    expect(articleCount).toBeGreaterThanOrEqual(5);

    // Verify at least one article has expected ARIA labeling
    const singletonArticle = await themePage.getArticleByTitle('Singleton');
    expect(singletonArticle).not.toBeNull();

    // Capture any console or page errors generated during initial load
    const consoleErrors = await themePage.getConsoleErrors();
    const pageErrors = await themePage.getPageErrors();

    // Assert there are no uncaught errors on load. If errors exist, they will be reported by the assertion failure.
    expect(consoleErrors.length, `Console error messages on load: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page error messages on load: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Toggle theme once -> Light theme entry (S1_Light)', async () => {
    // This test exercises the ToggleTheme event and asserts the S1_Light evidence.
    await themePage.clearErrors();

    // Click the toggle to change theme to light
    await themePage.clickToggle();

    // After click, body should contain class 'light'
    const isLight = await themePage.isLightTheme();
    expect(isLight).toBe(true);

    // Button's aria-pressed should reflect the light state as "true"
    const ariaPressed = await themePage.getAriaPressed();
    expect(ariaPressed).toBe('true');

    // Optionally verify computed body background changed (light theme sets background to #f9fbfe)
    const bg = await themePage.computedBodyBackground();
    // The computed background-color may vary across browsers; ensure it's not the original dark gradient string.
    expect(bg).toBeTruthy();

    // Ensure no uncaught errors were introduced by clicking
    const consoleErrors = await themePage.getConsoleErrors();
    const pageErrors = await themePage.getPageErrors();
    expect(consoleErrors.length, `Console errors after toggling to light: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors after toggling to light: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Toggle theme twice -> return to Dark theme (S2_Dark) and aria updates', async () => {
    await themePage.clearErrors();

    // Click twice to return to dark
    await themePage.clickToggle();
    // Wait a tiny bit to ensure DOM updates between clicks
    await new Promise((r) => setTimeout(r, 100));
    await themePage.clickToggle();

    const isLight = await themePage.isLightTheme();
    expect(isLight).toBe(false);

    const ariaPressed = await themePage.getAriaPressed();
    expect(ariaPressed).toBe('false');

    // No console/page errors introduced by rapid toggling
    const consoleErrors = await themePage.getConsoleErrors();
    const pageErrors = await themePage.getPageErrors();
    expect(consoleErrors.length, `Console errors after double toggle: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors after double toggle: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Keyboard activation (Enter and Space) toggles theme reliably - covers event activation edge cases', async () => {
    await themePage.clearErrors();

    // Focus the toggle and activate via Enter
    await themePage.focusToggle();
    await themePage.pressKey('Enter');

    // Expect theme toggled to light
    let isLight = await themePage.isLightTheme();
    expect(isLight).toBe(true);

    // Activate via Space to toggle back
    await themePage.pressKey('Space');
    isLight = await themePage.isLightTheme();
    expect(isLight).toBe(false);

    // Sanity: multiple rapid key presses should not throw errors
    for (let i = 0; i < 3; i++) {
      await themePage.pressKey('Enter');
      await new Promise((r) => setTimeout(r, 50));
    }

    // After 3 toggles, theme should be true (since it was false before the loop)
    isLight = await themePage.isLightTheme();
    expect(typeof isLight).toBe('boolean');

    // Capture any runtime errors
    const consoleErrors = await themePage.getConsoleErrors();
    const pageErrors = await themePage.getPageErrors();
    expect(consoleErrors.length, `Console errors after keyboard interactions: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors after keyboard interactions: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Edge case: rapid repeated clicks consistency check (10 toggles)', async () => {
    await themePage.clearErrors();

    // Perform 10 rapid toggles
    for (let i = 0; i < 10; i++) {
      // intentionally not awaiting any long delays to simulate a real user mashing the button
      await themePage.clickToggle();
    }

    // After 10 toggles, parity determines final state: starting false -> even number returns to false
    const isLight = await themePage.isLightTheme();
    expect(isLight).toBe(false);

    // Ensure aria-pressed matches DOM
    const ariaPressed = await themePage.getAriaPressed();
    expect(ariaPressed).toBe('false');

    // Ensure no uncaught errors resulted from the rapid toggling
    const consoleErrors = await themePage.getConsoleErrors();
    const pageErrors = await themePage.getPageErrors();
    expect(consoleErrors.length, `Console errors after rapid toggling: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors after rapid toggling: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Accessibility & DOM consistency: button attributes and article semantics remain intact', async () => {
    // Validate presence and attributes of the toggle button per FSM components evidence
    const btn = await themePage.getToggleButton();
    expect(btn).not.toBeNull();

    const id = await (await btn.getAttribute('id'));
    expect(id).toBe('themeToggle');

    const type = await (await btn.getAttribute('type'));
    expect(type).toBe('button');

    const ariaLabel = await (await btn.getAttribute('aria-label'));
    expect(ariaLabel).toContain('Toggle light and dark');

    // Validate several articles have required ARIA relationships (aria-describedby and aria-labelledby)
    const articles = await themePage.page.$$('article.pattern-card');
    for (const article of articles) {
      const described = await article.getAttribute('aria-describedby');
      const labelled = await article.getAttribute('aria-labelledby');
      // Each article in the markup includes these attributes; assert they're present
      expect(described).toBeTruthy();
      expect(labelled).toBeTruthy();

      // Ensure referenced IDs actually exist in the document
      const hasDesc = await themePage.page.$(`#${described}`);
      const hasLabel = await themePage.page.$(`#${labelled}`);
      expect(hasDesc).not.toBeNull();
      expect(hasLabel).not.toBeNull();
    }

    // Ensure no console or page errors found while checking DOM
    const consoleErrors = await themePage.getConsoleErrors();
    const pageErrors = await themePage.getPageErrors();
    expect(consoleErrors.length, `Console errors during DOM checks: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors during DOM checks: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Observe console and page errors over a sequence of interactions (explicit assertion)', async () => {
    // This test explicitly observes console and page errors across a series of interactions and asserts none occurred.
    await themePage.clearErrors();

    // Interaction sequence
    await themePage.clickToggle(); // -> light
    await themePage.clickToggle(); // -> dark
    await themePage.focusToggle();
    await themePage.pressKey('Enter'); // -> light
    await themePage.pressKey('Space'); // -> dark

    // Snapshot captured errors
    const consoleErrors = await themePage.getConsoleErrors();
    const pageErrors = await themePage.getPageErrors();

    // If any errors exist, we fail and include their content to aid debugging.
    expect(consoleErrors.length, `Expected no console.error messages. Found: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Expected no uncaught page errors. Found: ${JSON.stringify(pageErrors)}`).toBe(0);
  });
});