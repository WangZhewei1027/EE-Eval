import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ab64e1-fa78-11f0-812d-c9788050701f.html';

/**
 * Page Object representing the P vs NP visualization page.
 * Encapsulates common element lookups and interactions used across tests.
 */
class PvsNPPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleSelector = '#solveToggle';
    this.connectionSelector = '#connectionLine';
    this.particlesSelector = '#particles';
    this.introSelector = '#intro';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getToggleText() {
    return (await this.page.locator(this.toggleSelector).textContent())?.trim();
  }

  async clickToggle() {
    await this.page.click(this.toggleSelector);
  }

  async isConnectionVisible() {
    return await this.page.locator(this.connectionSelector).evaluate((el) => el.classList.contains('visible'));
  }

  async connectionOpacity() {
    return await this.page.locator(this.connectionSelector).evaluate((el) => {
      // computedStyle accessible in page context
      const cs = window.getComputedStyle(el);
      return cs.getPropertyValue('opacity');
    });
  }

  async waitForIntroVisible(timeout = 2000) {
    // The page schedules adding .visible to #intro after 300ms.
    await this.page.waitForSelector(`${this.introSelector}.visible`, { timeout });
  }

  async particleCount() {
    return await this.page.locator(`${this.particlesSelector} > .particle`).count();
  }
}

test.describe('P vs NP: Visual Exploration - FSM states and transitions', () => {
  // Collect console messages and page errors for assertions.
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture all console events and separate error-level messages.
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push({ type: msg.type(), text });
      }
    });

    // Capture uncaught exceptions (pageerror)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we assert that there were no uncaught page errors or console errors.
    // This validates that the page executed without producing runtime exceptions during interactions.
    expect(pageErrors, 'No uncaught page errors should have occurred').toEqual([]);
    expect(consoleErrors, 'No console.error messages should have been emitted').toEqual([]);
  });

  test('Initial Idle State: page renders and initial animations/particles are created', async ({ page }) => {
    // This test validates the S0_Idle state:
    // - DOMContentLoaded should trigger page setup (particles creation, observer wiring, initial timeout)
    // - The toggle button text should be the initial "Show Possible Connection"
    // - The connection line should not have the "visible" class initially
    // - #intro receives .visible after the scheduled timeout
    // - Particle elements are created (50 as per implementation)
    const app = new PvsNPPage(page);

    await app.goto();

    // Basic DOM presence checks
    await expect(page.locator(app.toggleSelector)).toBeVisible();
    await expect(page.locator(app.connectionSelector)).toBeVisible(); // element present though possibly transparent

    // Initial toggle button text
    const initialText = await app.getToggleText();
    expect(initialText).toBe('Show Possible Connection');

    // Connection line should NOT be visible initially
    const initiallyVisible = await app.isConnectionVisible();
    expect(initiallyVisible).toBe(false);

    // Computed opacity should reflect hidden state (CSS sets opacity: 0 when not visible)
    const initialOpacity = await app.connectionOpacity();
    expect(parseFloat(initialOpacity)).toBeCloseTo(0, 3);

    // Wait for intro to become visible via the setTimeout in the script (should occur after ~300ms)
    await app.waitForIntroVisible(2000);
    await expect(page.locator('#intro')).toHaveClass(/visible/);

    // Particles should be created; implementation creates 50. Validate count >= 50 (robust to small changes).
    const count = await app.particleCount();
    expect(count).toBeGreaterThanOrEqual(50);
  });

  test('ToggleConnection event: transitions from Idle -> ConnectionVisible and back', async ({ page }) => {
    // This test validates both transitions described in the FSM:
    // - Clicking #solveToggle when connection is hidden should add .visible and change button text to "Hide Connection"
    // - Clicking again should remove .visible and change button text back to "Show Possible Connection"
    const app = new PvsNPPage(page);

    await app.goto();

    // Ensure initial state before interaction
    expect(await app.isConnectionVisible()).toBe(false);
    expect(await app.getToggleText()).toBe('Show Possible Connection');

    // Click to show connection (S0_Idle -> S1_ConnectionVisible)
    await app.clickToggle();

    // After click, connection should have 'visible' class
    await page.waitForFunction(
      (sel) => document.querySelector(sel)?.classList.contains('visible'),
      app.connectionSelector
    );

    expect(await app.isConnectionVisible()).toBe(true);

    // Button text should update to 'Hide Connection' per FSM evidence
    const afterShowText = await app.getToggleText();
    expect(afterShowText).toBe('Hide Connection');

    // The computed opacity should reflect visible state (CSS sets opacity: 0.5 for .visible)
    const visibleOpacity = await app.connectionOpacity();
    expect(parseFloat(visibleOpacity)).toBeCloseTo(0.5, 3);

    // Click again to hide connection (S1_ConnectionVisible -> S0_Idle)
    await app.clickToggle();

    // After second click, the 'visible' class should be removed
    await page.waitForFunction(
      (sel) => !document.querySelector(sel)?.classList.contains('visible'),
      app.connectionSelector
    );

    expect(await app.isConnectionVisible()).toBe(false);

    // Button text should be back to original
    const afterHideText = await app.getToggleText();
    expect(afterHideText).toBe('Show Possible Connection');

    // Computed opacity should be back to 0
    const afterHideOpacity = await app.connectionOpacity();
    expect(parseFloat(afterHideOpacity)).toBeCloseTo(0, 3);
  });

  test('Rapid toggles: repeated clicks alternate state without errors', async ({ page }) => {
    // This test executes a series of rapid toggles to validate stability and idempotency.
    // It ensures that repeated user interactions do not cause runtime errors and the UI state tracks parity of clicks.
    const app = new PvsNPPage(page);
    await app.goto();

    const clicks = 7; // odd number => final state should be visible (true)
    for (let i = 0; i < clicks; i++) {
      await app.clickToggle();
      // short pause to allow DOM updates and transitions to apply
      await page.waitForTimeout(50);
    }

    const expectedVisible = clicks % 2 === 1;
    expect(await app.isConnectionVisible()).toBe(expectedVisible);

    // Verify toggle text matches expected final state
    const finalText = await app.getToggleText();
    if (expectedVisible) {
      expect(finalText).toBe('Hide Connection');
    } else {
      expect(finalText).toBe('Show Possible Connection');
    }
  });

  test('Edge case: Verify toggling when element is already in target state does not throw', async ({ page }) => {
    // This test ensures that clicking when the connection is already visible/hide does not cause exceptions.
    // It toggles to visible, then clicks the button again rapidly twice (hide -> show) ensuring no uncaught exceptions.
    const app = new PvsNPPage(page);
    await app.goto();

    // Bring to visible
    if (!(await app.isConnectionVisible())) {
      await app.clickToggle();
      await page.waitForTimeout(100);
      expect(await app.isConnectionVisible()).toBe(true);
    }

    // Now click twice quickly: should result in visible -> hidden -> visible
    await app.clickToggle(); // hide
    await app.clickToggle(); // show
    await page.waitForTimeout(200);

    expect(await app.isConnectionVisible()).toBe(true);
    expect(await app.getToggleText()).toBe('Hide Connection');
  });

  test('Observes console and page errors during interactions (none expected)', async ({ page }) => {
    // This test explicitly validates that no console.error messages or uncaught page errors
    // were emitted during a sequence of typical interactions.
    const app = new PvsNPPage(page);

    await app.goto();

    // Perform a few interactions
    await app.waitForIntroVisible();
    await app.clickToggle();
    await page.waitForTimeout(100);
    await app.clickToggle();
    await page.waitForTimeout(100);

    // At this point, the afterEach hook will assert there are no pageErrors or consoleErrors.
    // Additionally, assert that there are zero console messages of type 'error' detected locally here.
    const foundConsoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(foundConsoleErrors.length).toBe(0);

    // Also assert that the console captured at least some messages (not required, but useful to ensure listener worked).
    // There might be zero if the page is silent; that's acceptable. We assert the arrays exist and are arrays.
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);
  });
});