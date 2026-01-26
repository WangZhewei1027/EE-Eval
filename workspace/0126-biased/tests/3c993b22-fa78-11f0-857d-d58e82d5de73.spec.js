import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c993b22-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object for interacting with the Semaphore demo.
 * Encapsulates selectors and common operations.
 */
class SemaphorePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      btnCycle: '#btn-cycle',
      btnAuto: '#btn-auto',
      lightRed: '#light-red',
      lightYellow: '#light-yellow',
      lightGreen: '#light-green',
      semaphoreTitle: '.semaphore-title',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait until lights housing and controls are visible
    await Promise.all([
      this.page.waitForSelector(this.selectors.lightRed),
      this.page.waitForSelector(this.selectors.btnCycle),
      this.page.waitForSelector(this.selectors.btnAuto),
      this.page.waitForSelector(this.selectors.semaphoreTitle),
    ]);
  }

  async clickCycle() {
    await this.page.click(this.selectors.btnCycle);
  }

  async clickAuto() {
    await this.page.click(this.selectors.btnAuto);
  }

  async getTitleText() {
    return this.page.textContent(this.selectors.semaphoreTitle);
  }

  async isCycleDisabled() {
    return this.page.$eval(this.selectors.btnCycle, (b) => b.disabled === true);
  }

  async getAutoAriaPressed() {
    return this.page.$eval(this.selectors.btnAuto, (b) => b.getAttribute('aria-pressed'));
  }

  async getActiveIndex() {
    // return 0 for red, 1 for yellow, 2 for green, -1 if none
    return this.page.evaluate(() => {
      const ids = ['light-red', 'light-yellow', 'light-green'];
      for (let i = 0; i < ids.length; i++) {
        const el = document.getElementById(ids[i]);
        if (!el) continue;
        if (el.classList.contains('active')) return i;
      }
      return -1;
    });
  }

  async getLightClasses(id) {
    return this.page.$eval(id, (el) => el.className);
  }
}

test.describe('Semaphore Concept - FSM and UI integration tests', () => {
  let consoleErrors;
  let pageErrors;
  let sem;

  test.beforeEach(async ({ page }) => {
    // Collect console errors and page errors for each test
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Capture console messages of type "error"
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    sem = new SemaphorePage(page);
    await sem.goto();
  });

  test.afterEach(async () => {
    // Assert there were no uncaught runtime errors in the page console or pageerror events.
    // This helps ensure the application runs without ReferenceError/SyntaxError/TypeError at runtime.
    expect(consoleErrors, `Page console errors: ${JSON.stringify(consoleErrors, null, 2)}`).toHaveLength(0);
    expect(pageErrors, `Page runtime errors: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
  });

  test('Initial state S0_Red: Red light active and title shows "Red"', async () => {
    // Validate initial active light is Red according to FSM S0_Red entry action setActiveLight(0)
    const title = await sem.getTitleText();
    expect(title?.trim()).toBe('Red');

    const activeIndex = await sem.getActiveIndex();
    expect(activeIndex).toBe(0);

    // Ensure corresponding DOM class demonstrates active styling for red light
    const redClasses = await sem.getLightClasses('#light-red');
    expect(redClasses.split(/\s+/)).toContain('active');

    // Ensure other lights are not active
    const yellowClasses = await sem.getLightClasses('#light-yellow');
    expect(yellowClasses.split(/\s+/)).not.toContain('active');

    const greenClasses = await sem.getLightClasses('#light-green');
    expect(greenClasses.split(/\s+/)).not.toContain('active');
  });

  test('CycleSignal transitions through S0_Red -> S1_Yellow -> S2_Green -> S0_Red', async () => {
    // From Red -> click Cycle -> Yellow
    await sem.clickCycle();
    await sem.page.waitForTimeout(100); // allow transition to update DOM
    let title = (await sem.getTitleText())?.trim();
    expect(title).toBe('Yellow');
    let idx = await sem.getActiveIndex();
    expect(idx).toBe(1);

    // Yellow -> click Cycle -> Green
    await sem.clickCycle();
    await sem.page.waitForTimeout(100);
    title = (await sem.getTitleText())?.trim();
    expect(title).toBe('Green');
    idx = await sem.getActiveIndex();
    expect(idx).toBe(2);

    // Green -> click Cycle -> Red (wrap-around)
    await sem.clickCycle();
    await sem.page.waitForTimeout(100);
    title = (await sem.getTitleText())?.trim();
    expect(title).toBe('Red');
    idx = await sem.getActiveIndex();
    expect(idx).toBe(0);
  });

  test('StartAuto toggles auto-cycling on and off, disables manual cycle while running', async () => {
    // Ensure starting state is Red
    expect((await sem.getTitleText())?.trim()).toBe('Red');

    // Start auto
    await sem.clickAuto();
    await sem.page.waitForTimeout(50);
    // Check button label and aria-pressed updated
    const pressed = await sem.getAutoAriaPressed();
    expect(pressed).toBe('true');

    // The cycle button should be disabled while auto is running
    const disabled = await sem.isCycleDisabled();
    expect(disabled).toBe(true);

    // Wait for one interval (2800ms) plus buffer; verify it advanced by one step (Red->Yellow)
    await sem.page.waitForTimeout(3000);
    let title = (await sem.getTitleText())?.trim();
    expect(['Yellow', 'Green', 'Red']).toContain(title); // sanity check
    // Given one tick, from Red we expect Yellow
    expect(title).toBe('Yellow');

    // Try clicking the cycle button while auto is running: it should be ignored (also disabled)
    await sem.clickCycle();
    await sem.page.waitForTimeout(100);
    const titleAfterManualAttempt = (await sem.getTitleText())?.trim();
    expect(titleAfterManualAttempt).toBe(title); // unchanged

    // Now stop auto
    await sem.clickAuto();
    await sem.page.waitForTimeout(100);
    const pressedAfter = await sem.getAutoAriaPressed();
    expect(pressedAfter).toBe('false');

    // Cycle button should be enabled again
    const disabledAfter = await sem.isCycleDisabled();
    expect(disabledAfter).toBe(false);

    // Capture current title, wait longer than an interval to assert auto stopped (no further changes)
    const snapshotTitle = (await sem.getTitleText())?.trim();
    await sem.page.waitForTimeout(3000);
    const titleFinal = (await sem.getTitleText())?.trim();
    expect(titleFinal).toBe(snapshotTitle);
  });

  test('Rapid manual cycling wraps correctly (edge case)', async () => {
    // From Red (index 0), 4 rapid clicks should end at index (0+4)%3 = 1 => Yellow
    await sem.page.click('#btn-cycle');
    await sem.page.click('#btn-cycle');
    await sem.page.click('#btn-cycle');
    await sem.page.click('#btn-cycle');
    // Small wait to let DOM update
    await sem.page.waitForTimeout(150);
    const idx = await sem.getActiveIndex();
    const title = (await sem.getTitleText())?.trim();
    expect(idx).toBe(1);
    expect(title).toBe('Yellow');
  });

  test('Toggling auto repeatedly starts and stops reliably (no accumulation of intervals)', async () => {
    // Start auto
    await sem.clickAuto();
    await sem.page.waitForTimeout(50);
    expect(await sem.getAutoAriaPressed()).toBe('true');

    // Stop auto quickly
    await sem.clickAuto();
    await sem.page.waitForTimeout(50);
    expect(await sem.getAutoAriaPressed()).toBe('false');

    // Start auto again
    await sem.clickAuto();
    await sem.page.waitForTimeout(50);
    expect(await sem.getAutoAriaPressed()).toBe('true');

    // Wait for one tick to verify single interval behavior
    await sem.page.waitForTimeout(3000);
    const titleAfterOneTick = (await sem.getTitleText())?.trim();

    // Stop auto
    await sem.clickAuto();
    await sem.page.waitForTimeout(50);
    expect(await sem.getAutoAriaPressed()).toBe('false');

    // Snapshot and wait to ensure no further ticks occur after stop
    const snapshot = titleAfterOneTick;
    await sem.page.waitForTimeout(3000);
    const finalTitle = (await sem.getTitleText())?.trim();
    expect(finalTitle).toBe(snapshot);
  });

  test('Accessibility attributes and semantic content presence', async () => {
    // Ensure buttons and lights have expected attributes per extracted components
    const btnCycleExists = await sem.page.$(sem.selectors.btnCycle);
    expect(btnCycleExists).not.toBeNull();

    const btnAutoExists = await sem.page.$(sem.selectors.btnAuto);
    expect(btnAutoExists).not.toBeNull();

    const autoAria = await sem.getAutoAriaPressed();
    // initial aria-pressed as per components extraction is "false"
    expect(autoAria).toBe('false');

    // Ensure lights have aria-label attributes
    const redAria = await sem.page.$eval('#light-red', (el) => el.getAttribute('aria-label'));
    const yellowAria = await sem.page.$eval('#light-yellow', (el) => el.getAttribute('aria-label'));
    const greenAria = await sem.page.$eval('#light-green', (el) => el.getAttribute('aria-label'));
    expect(redAria).toBe('Red Signal');
    expect(yellowAria).toBe('Yellow Signal');
    expect(greenAria).toBe('Green Signal');

    // Ensure semaphore title uses aria-live region
    const liveAttr = await sem.page.$eval('.semaphore-title', (el) => el.getAttribute('aria-live'));
    expect(liveAttr).toBe('polite');
  });

  test('No unexpected console or runtime errors occur during interactions (observe console & page errors)', async () => {
    // This test intensively exercises the UI while monitoring console and page errors.
    // Perform sequences of interactions: manual cycles, start/stop auto, rapid clicks
    await sem.clickCycle();
    await sem.page.waitForTimeout(50);
    await sem.clickCycle();
    await sem.page.waitForTimeout(50);

    await sem.clickAuto(); // start
    await sem.page.waitForTimeout(100);
    await sem.clickAuto(); // stop
    await sem.page.waitForTimeout(100);

    // Rapid cycles
    for (let i = 0; i < 6; i++) {
      await sem.clickCycle();
    }
    await sem.page.waitForTimeout(200);

    // Final assertions for sanity (one of the lights must be active and title consistent)
    const idx = await sem.getActiveIndex();
    expect([0, 1, 2]).toContain(idx);
    const title = (await sem.getTitleText())?.trim();
    expect(['Red', 'Yellow', 'Green']).toContain(title);

    // Note: runtime errors (console and page errors) are asserted in afterEach.
  });
});