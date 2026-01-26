import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c989ee2-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object for the Big-Theta visualization app.
 * Encapsulates common interactions and selectors used across tests.
 */
class BigThetaPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleFuncSel = '#toggleLinear';
    this.toggleDarkSel = '#toggleDark';
    this.mainFuncSel = '#mainFunc';
    this.lowerSel = '#lowerBound';
    this.upperSel = '#upperBound';
    this.explanationSel = '#explanation';
    this.gridGroupSel = 'svg > g';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure main UI is present
    await Promise.all([
      this.page.waitForSelector(this.toggleFuncSel),
      this.page.waitForSelector(this.toggleDarkSel),
      this.page.waitForSelector(this.mainFuncSel),
    ]);
    // Wait for the initial graph update to finish (updateGraph runs on init)
    await this.page.waitForTimeout(100); // small pause to let JS mutations settle
  }

  async getToggleFunctionText() {
    return (await this.page.locator(this.toggleFuncSel).textContent()) || '';
  }

  async getToggleFunctionAriaPressed() {
    return (await this.page.locator(this.toggleFuncSel).getAttribute('aria-pressed'));
  }

  async getToggleDarkText() {
    return (await this.page.locator(this.toggleDarkSel).textContent()) || '';
  }

  async getToggleDarkAriaPressed() {
    return (await this.page.locator(this.toggleDarkSel).getAttribute('aria-pressed'));
  }

  async clickToggleFunction() {
    await this.page.click(this.toggleFuncSel);
    // allow DOM updates to happen
    await this.page.waitForTimeout(80);
  }

  async clickToggleDark() {
    await this.page.click(this.toggleDarkSel);
    await this.page.waitForTimeout(80);
  }

  async getPathD(selector) {
    return await this.page.locator(selector).getAttribute('d');
  }

  async getExplanationHtml() {
    return await this.page.locator(this.explanationSel).innerHTML();
  }

  async getComputedBodyColor() {
    return await this.page.evaluate(() => window.getComputedStyle(document.body).color);
  }

  async getGridTextContents() {
    return await this.page.$$eval(`${this.gridGroupSel} text`, els => els.map(e => e.textContent?.trim() || ''));
  }

  async gridGroupChildCount() {
    return await this.page.$$eval(`${this.gridGroupSel} *`, els => els.length);
  }
}

test.describe('Big-Theta Notation — Visualized Elegance (FSM Validation)', () => {
  // Capture runtime console errors and page errors across each test run
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console events for errors
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // swallow unexpected listener issues
      }
    });

    // Listen to uncaught page errors
    page.on('pageerror', err => {
      // err may be Error; capture its name and message
      pageErrors.push({
        name: err && err.name ? err.name : 'UnknownError',
        message: err && err.message ? err.message : String(err),
        stack: err && err.stack ? err.stack : undefined,
      });
    });

    const app = new BigThetaPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // nothing to teardown beyond Playwright default; arrays are reset in beforeEach
  });

  test('Initial state: Quadratic function and dark theme should be reflected in the DOM (S0_Quadratic & S2_DarkMode)', async ({ page }) => {
    const app = new BigThetaPage(page);

    // Validate that the function toggle shows Quadratic (entry action updateGraph sets button text)
    const funcText = await app.getToggleFunctionText();
    expect(funcText).toContain('Quadratic', 'Initial state should indicate Quadratic function via button text');

    // aria-pressed should be "true" for Quadratic per updateGraph call
    const funcPressed = await app.getToggleFunctionAriaPressed();
    expect(funcPressed).toBe('true');

    // The main path 'd' attribute should be present and non-empty after initialization
    const mainD = await app.getPathD(app.mainFuncSel);
    expect(typeof mainD).toBe('string');
    expect(mainD.length).toBeGreaterThan(10, 'main function path "d" attribute should be populated');

    // The lower and upper bound paths should also be populated
    const lowerD = await app.getPathD(app.lowerSel);
    const upperD = await app.getPathD(app.upperSel);
    expect(lowerD).toBeTruthy();
    expect(upperD).toBeTruthy();

    // Grid group should contain generated grid lines and labels after updateGraph
    const childCount = await app.gridGroupChildCount();
    expect(childCount).toBeGreaterThan(0, 'SVG grid group should contain generated grid lines and text nodes');

    // Explanation box should reference quadratic growth
    const explanation = await app.getExplanationHtml();
    expect(explanation.toLowerCase()).toContain('quadratic');

    // Verify initial computed body text color corresponds to dark theme (#e0e6f0 => rgb(224, 230, 240))
    const initialColor = await app.getComputedBodyColor();
    expect(initialColor).toContain('224, 230, 240', 'Initial body color should reflect dark theme text color');

    // No uncaught errors should have occurred during initial load
    // We capture console errors and page errors; assert none of these are fatal JS error types
    // (If any are present, fail and include details)
    // NOTE: per testing contract we only observe; we do not modify or patch the page.
    const fatalPageErrors = pageErrors.filter(e => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name));
    expect(fatalPageErrors.length).toBe(0, `No fatal JS errors (ReferenceError/TypeError/SyntaxError) should have occurred on load. Found: ${JSON.stringify(fatalPageErrors)}`);
  });

  test('ToggleFunctionType: Quadratic -> Linear transition (S0_Quadratic -> S1_Linear) updates graph and aria attributes', async ({ page }) => {
    const app = new BigThetaPage(page);

    // Capture previous path data to ensure it changes
    const prevMainD = await app.getPathD(app.mainFuncSel);
    const prevLowerD = await app.getPathD(app.lowerSel);
    const prevUpperD = await app.getPathD(app.upperSel);

    // Perform the transition by clicking the toggle function button
    await app.clickToggleFunction();

    // Validate button text updates to indicate Linear
    const funcTextAfter = await app.getToggleFunctionText();
    expect(funcTextAfter).toContain('Linear', 'After toggle, button text should indicate Linear function');

    // aria-pressed should now be "false" for linear per updateGraph branch
    const funcPressedAfter = await app.getToggleFunctionAriaPressed();
    expect(funcPressedAfter).toBe('false');

    // Graph paths should have updated (d attribute should differ from previous)
    const mainDAfter = await app.getPathD(app.mainFuncSel);
    const lowerDAfter = await app.getPathD(app.lowerSel);
    const upperDAfter = await app.getPathD(app.upperSel);

    expect(mainDAfter).toBeTruthy();
    expect(mainDAfter).not.toBe(prevMainD);
    expect(lowerDAfter).not.toBe(prevLowerD);
    expect(upperDAfter).not.toBe(prevUpperD);

    // Grid labels should reflect n ticks for linear (n values are present)
    const gridTexts = await app.getGridTextContents();
    const hasNTicks = gridTexts.some(t => t.includes('n='));
    expect(hasNTicks).toBe(true);

    // Explanation should reference linear growth
    const explanationAfter = await app.getExplanationHtml();
    expect(explanationAfter.toLowerCase()).toContain('linear');

    // No fatal page errors thrown during transition
    const fatalPageErrors = pageErrors.filter(e => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name));
    expect(fatalPageErrors.length).toBe(0, `No fatal JS errors should occur during function toggle. Found: ${JSON.stringify(fatalPageErrors)}`);
  });

  test('ToggleFunctionType: Linear -> Quadratic transition (S1_Linear -> S0_Quadratic) returns graph and UI back', async ({ page }) => {
    const app = new BigThetaPage(page);

    // Ensure we are in Linear state by toggling once if necessary
    const currentText = await app.getToggleFunctionText();
    if (!currentText.toLowerCase().includes('linear')) {
      await app.clickToggleFunction();
      await page.waitForTimeout(50);
    }

    // Capture path data in linear state
    const linearMainD = await app.getPathD(app.mainFuncSel);

    // Click again to go back to Quadratic
    await app.clickToggleFunction();

    // Validate UI updated to Quadratic
    const funcTextAfter = await app.getToggleFunctionText();
    expect(funcTextAfter).toContain('Quadratic');
    const funcPressed = await app.getToggleFunctionAriaPressed();
    expect(funcPressed).toBe('true');

    // Graph's main path should differ from the linearMainD
    const mainDAfter = await app.getPathD(app.mainFuncSel);
    expect(mainDAfter).toBeTruthy();
    expect(mainDAfter).not.toBe(linearMainD);

    // Explanation returns to mention quadratic
    const explanation = await app.getExplanationHtml();
    expect(explanation.toLowerCase()).toContain('quadratic');

    // No fatal page errors during this back-and-forth
    const fatalPageErrors = pageErrors.filter(e => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name));
    expect(fatalPageErrors.length).toBe(0, `No fatal JS errors should occur during function toggle back-and-forth. Found: ${JSON.stringify(fatalPageErrors)}`);
  });

  test('ToggleDarkMode: Dark -> Light -> Dark transitions update body styles and button aria attributes (S2_DarkMode <-> S3_LightMode)', async ({ page }) => {
    const app = new BigThetaPage(page);

    // Initial computed color should reflect the dark theme text color
    const beforeColor = await app.getComputedBodyColor();
    expect(beforeColor).toContain('224, 230, 240', 'Starting in dark theme should result in light text color');

    // Click to toggle to Light Mode (darkMode true -> false)
    await app.clickToggleDark();

    // After toggling, computed color should be #333 -> '51, 51, 51'
    const afterColor = await app.getComputedBodyColor();
    expect(afterColor).toContain('51, 51, 51', 'After toggling, body text color should change to the light-mode color');

    // Toggle button's aria-pressed should reflect true in light mode per implementation
    const darkAriaPressedAfter = await app.getToggleDarkAriaPressed();
    expect(darkAriaPressedAfter).toBe('true');

    // Button text should have changed to indicate the new state (Toggle Dark/Light Mode)
    const darkBtnText = await app.getToggleDarkText();
    expect(darkBtnText.toLowerCase()).toContain('dark', 'Button text should indicate dark/light wording after toggle');

    // Click again to go back to dark
    await app.clickToggleDark();

    // After toggling back, computed color should again be the original dark-mode text color
    const finalColor = await app.getComputedBodyColor();
    expect(finalColor).toContain('224, 230, 240', 'Toggling back should restore dark theme text color');

    // aria-pressed should be "false" after returning to dark (per implementation)
    const darkAriaPressedFinal = await app.getToggleDarkAriaPressed();
    // Implementation sets aria-pressed="false" when switching to dark
    expect(darkAriaPressedFinal).toBe('false');

    // Ensure no fatal JS errors during rapid UI toggles
    const fatalPageErrors = pageErrors.filter(e => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name));
    expect(fatalPageErrors.length).toBe(0, `No fatal JS errors should occur during dark/light toggles. Found: ${JSON.stringify(fatalPageErrors)}`);
  });

  test('Edge case: Rapidly toggle function type multiple times and verify stability (no crashes, final state consistent)', async ({ page }) => {
    const app = new BigThetaPage(page);

    // Rapidly click the function toggle 5 times
    for (let i = 0; i < 5; i++) {
      await app.clickToggleFunction();
    }

    // After odd number of clicks (5), starting from Quadratic -> should end up Linear
    const finalText = await app.getToggleFunctionText();
    expect(finalText.toLowerCase()).toContain('linear', 'After odd number of toggles, final state should be Linear');

    // Graph path should be set and reasonably sized
    const mainD = await app.getPathD(app.mainFuncSel);
    expect(mainD).toBeTruthy();
    expect(mainD.length).toBeGreaterThan(10);

    // Check that grid redraws produced some text nodes; this ensures updateGraph did rerun multiple times
    const gridTexts = await app.getGridTextContents();
    expect(gridTexts.length).toBeGreaterThanOrEqual(5);

    // Confirm no fatal JS errors occurred during the rapid toggling
    const fatalPageErrors = pageErrors.filter(e => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name));
    expect(fatalPageErrors.length).toBe(0, `Rapid toggling should not produce fatal JS errors. Found: ${JSON.stringify(fatalPageErrors)}`);
  });

  test('Observability: Collect console.error and pageerror events and assert none are fatal JS errors', async ({ page }) => {
    const app = new BigThetaPage(page);

    // Perform a couple of interactions to surface any latent errors
    await app.clickToggleFunction();
    await app.clickToggleDark();
    await app.clickToggleFunction();

    // Wait a brief moment for any asynchronous errors to bubble up
    await page.waitForTimeout(150);

    // Validate that we captured any console.error messages (if present, they are recorded)
    // But fail if any represent fatal JS errors (we consider ReferenceError/TypeError/SyntaxError fatal)
    const fatalPageErrors = pageErrors.filter(e => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name));
    const consoleErrorTexts = consoleErrors.map(c => c.text);

    // If any fatal page errors were captured, surface them in the assertion message
    expect(fatalPageErrors.length).toBe(0, `No fatal page errors should be present. Found: ${JSON.stringify(fatalPageErrors)}`);

    // For transparency, assert that console.error may be empty or contain informational errors, but none should indicate SyntaxError/ReferenceError/TypeError
    const combinedConsoleErrorText = consoleErrorTexts.join('\n');
    const suspiciousConsole = combinedConsoleErrorText.match(/ReferenceError|TypeError|SyntaxError/);
    expect(suspiciousConsole).toBeNull();
  });
});