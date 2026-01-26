import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cd0fd1-fa7c-11f0-ba20-415c525382ea.html';

// Page Object Model for the SDLC demo page
class SDLCPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '#showPhasesBtn';
    this.outputSelector = '#phasesOutput';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButton() {
    return await this.page.$(this.buttonSelector);
  }

  async getOutput() {
    return await this.page.$(this.outputSelector);
  }

  async clickToggle() {
    const btn = await this.getButton();
    await btn.click();
  }

  async buttonText() {
    const btn = await this.getButton();
    return await this.page.evaluate((b) => b.textContent, btn);
  }

  async outputText() {
    const out = await this.getOutput();
    return await this.page.evaluate((o) => o.textContent, out);
  }

  async outputDisplayStyle() {
    // read inline style.display and computed style to be robust
    const out = await this.getOutput();
    const inline = await this.page.evaluate((o) => o.style.display, out);
    const computed = await this.page.evaluate((o) => window.getComputedStyle(o).display, out);
    return { inline, computed };
  }

  async hasAriaLive() {
    const out = await this.getOutput();
    return await this.page.evaluate((o) => o.getAttribute('aria-live'), out);
  }
}

test.describe('SDLC Phases Overview - FSM states and transitions', () => {
  // Collect console messages and page errors to assert they (do or do not) occur naturally.
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Listen to console events to capture logs and errors.
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Listen to uncaught exceptions on the page.
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('Initial Idle state: renderPage() entry action should display the toggle button and hidden output', async ({ page }) => {
    // Arrange: navigate to the app and create the page object
    const sd = new SDLCPage(page);
    await sd.goto();

    // Assert: the toggle button exists with the exact initial label
    const btn = await sd.getButton();
    expect(btn, 'Expected the show/hide button to be present in the DOM').not.toBeNull();
    const btnText = await sd.buttonText();
    expect(btnText).toBe('Show SDLC Phases Overview');

    // Assert: the phases output element exists and is hidden initially (inline style and computed style)
    const out = await sd.getOutput();
    expect(out, 'Expected the output container to be present').not.toBeNull();
    const display = await sd.outputDisplayStyle();
    // Inline style should be 'none' per HTML; computed style should be 'none' as well
    expect(display.inline).toBe('none');
    expect(display.computed).toBe('none');

    // This verifies the FSM entry action "renderPage()" (evidence: button rendered)
    // Verify aria-live attribute present and set to 'polite'
    const ariaLive = await sd.hasAriaLive();
    expect(ariaLive).toBe('polite');

    // Observe console and page errors: we allow them to occur naturally; assert none happened on initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('ShowPhases transition: clicking button displays phases, updates content and button text (S0_Idle -> S1_PhasesVisible)', async ({ page }) => {
    const sd = new SDLCPage(page);
    await sd.goto();

    // Act: click the toggle button to show the phases overview
    await sd.clickToggle();

    // Assert: the output becomes visible (inline style 'block' and computed style not 'none')
    const display = await sd.outputDisplayStyle();
    expect(display.inline === 'block' || display.computed !== 'none').toBeTruthy();

    // Assert: the output contains the expected SDLC phases text
    const text = await sd.outputText();
    expect(text).toContain('1. Requirement Analysis');
    expect(text).toContain('6. Maintenance');
    expect(text).toContain('Deployment');

    // Assert: button text toggled to the hide label as per transition actions
    const btnText = await sd.buttonText();
    expect(btnText).toBe('Hide SDLC Phases Overview');

    // This validates the FSM transition from S0_Idle to S1_PhasesVisible and the entry action "displayPhasesOverview()"

    // Confirm no JS runtime errors occurred during the transition
    // (we observe console errors and page errors and assert none)
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('HidePhases transition: clicking again hides phases and resets button (S1_PhasesVisible -> S0_Idle)', async ({ page }) => {
    const sd = new SDLCPage(page);
    await sd.goto();

    // Show first
    await sd.clickToggle();

    // Then hide
    await sd.clickToggle();

    // Assert: the output is hidden again (inline style 'none' and computed 'none')
    const display = await sd.outputDisplayStyle();
    expect(display.inline).toBe('none');
    expect(display.computed).toBe('none');

    // Assert: button text reset to initial show label
    const btnText = await sd.buttonText();
    expect(btnText).toBe('Show SDLC Phases Overview');

    // Even though output was hidden, its textContent should remain set (the implementation sets it before hiding)
    const outText = await sd.outputText();
    expect(outText.length).toBeGreaterThan(0);
    expect(outText).toContain('Requirement Analysis');

    // Confirm no JS runtime errors occurred during hide transition
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: rapid toggling should not produce errors and should end in a consistent state', async ({ page }) => {
    const sd = new SDLCPage(page);
    await sd.goto();

    // Rapidly click the toggle button multiple times
    const clicks = 7; // odd number should result in visible output
    for (let i = 0; i < clicks; i++) {
      await sd.clickToggle();
    }

    // After odd number of clicks, output should be visible
    const displayAfter = await sd.outputDisplayStyle();
    // either inline 'block' or computed not 'none'
    expect(displayAfter.inline === 'block' || displayAfter.computed !== 'none').toBeTruthy();

    // Now click once more to ensure it hides cleanly
    await sd.clickToggle();
    const displayFinal = await sd.outputDisplayStyle();
    expect(displayFinal.inline).toBe('none');
    expect(displayFinal.computed).toBe('none');

    // Verify no page errors were emitted during rapid interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Also verify the button text ended up correct ('Show' after hiding)
    const btnTextFinal = await sd.buttonText();
    expect(btnTextFinal).toBe('Show SDLC Phases Overview');
  });

  test('Behavioral checks and robustness: the output uses aria-live and preserves content when hidden', async ({ page }) => {
    const sd = new SDLCPage(page);
    await sd.goto();

    // Ensure aria-live is present initially
    const ariaLiveBefore = await sd.hasAriaLive();
    expect(ariaLiveBefore).toBe('polite');

    // Show the content
    await sd.clickToggle();

    // Confirm aria-live still present and content length seems reasonable
    const ariaLiveDuring = await sd.hasAriaLive();
    expect(ariaLiveDuring).toBe('polite');
    const outputText = await sd.outputText();
    expect(outputText).toMatch(/Requirement Analysis/);

    // Hide the content and ensure the DOM retains the text (hidden but available)
    await sd.clickToggle();
    const outputTextAfter = await sd.outputText();
    expect(outputTextAfter).toMatch(/Requirement Analysis/);

    // Confirm accessibility attribute remains unchanged
    const ariaLiveAfter = await sd.hasAriaLive();
    expect(ariaLiveAfter).toBe('polite');

    // No runtime exceptions expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: capture console messages and page errors during navigation and interactions', async ({ page }) => {
    const sd = new SDLCPage(page);

    // Navigate and perform a few interactions while capturing console output
    await sd.goto();
    await sd.clickToggle(); // show
    await sd.clickToggle(); // hide

    // We expect the page to not emit console errors or page errors in normal operation.
    // Make assertions that reflect the actual observed state (zero errors).
    expect(consoleErrors.length).toBe(0, `Expected no console.error messages, found: ${JSON.stringify(consoleErrors)}`);
    expect(pageErrors.length).toBe(0, `Expected no uncaught page errors, found: ${JSON.stringify(pageErrors)}`);

    // But we do assert that we captured some console activity (info/debug) maybe none; we simply ensure our listener ran
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});