import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c996230-fa78-11f0-857d-d58e82d5de73.html';

// Page object to encapsulate interactions and queries for the Monitor demo
class MonitorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.btn = page.locator('#btnToggle');
    this.h1 = page.locator('#screen-content h1');
    this.p = page.locator('#screen-content p');
    this.content = page.locator('#screen-content');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the core elements are present before continuing
    await expect(this.btn).toBeVisible();
    await expect(this.content).toBeVisible();
  }

  async getTitle() {
    return (await this.h1.textContent())?.trim();
  }

  async getDescription() {
    return (await this.p.textContent())?.trim();
  }

  async clickToggle() {
    await this.btn.click();
  }

  async getAriaPressed() {
    return await this.btn.getAttribute('aria-pressed');
  }

  // Read inline transition style on the content element
  async getContentTransitionStyle() {
    return await this.page.$eval('#screen-content', (el) => el.style.transition || '');
  }

  // Read inline opacity style on the content element
  async getContentOpacity() {
    return await this.page.$eval('#screen-content', (el) => el.style.opacity || '');
  }
}

test.describe('Monitor - Visual Showcase (FSM) end-to-end', () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Attach console and error listeners, navigate to the page for each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // collect all console events for later inspection
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', (err) => {
      // collect unhandled page errors
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we will assert that there are no unexpected runtime errors
    // captured on the page. The application is expected to run without
    // ReferenceError/SyntaxError/TypeError. If any such errors occur they will
    // surface here and cause the test to fail.
    const errorTypes = ['ReferenceError', 'SyntaxError', 'TypeError'];
    for (const err of pageErrors) {
      const msg = String(err && err.message ? err.message : err);
      for (const t of errorTypes) {
        expect(msg).not.toContain(t);
      }
    }

    // Also ensure no console.error messages were emitted by the page
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length, `console.error should be empty, saw: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test.describe('Initial State validations (S0_Initial)', () => {
    test('Initial DOM contains expected title and description', async ({ page }) => {
      // Validate Initial State content exactly matches FSM evidence
      const monitor = new MonitorPage(page);
      await monitor.goto();

      // Check the heading and paragraph text for initial state
      const title = await monitor.getTitle();
      expect(title).toBe('Monitor');

      const desc = await monitor.getDescription();
      expect(desc).toBe('An epitome of visual clarity, elegance, and precision.');

      // Button should exist and start with aria-pressed=false
      const aria = await monitor.getAriaPressed();
      expect(aria).toBe('false');

      // Ensure the content container exists and has aria-live set (from HTML)
      const ariaLive = await page.locator('#btnToggle').getAttribute('aria-live');
      expect(ariaLive).toBe('polite');
    });
  });

  test.describe('Transitions & events (ToggleMessage)', () => {
    test('Click toggles to S1_Toggled ("Experience") and updates aria-pressed immediately', async ({ page }) => {
      // Validate transition from Initial -> Toggled
      const monitor = new MonitorPage(page);
      await monitor.goto();

      // Click: aria-pressed should toggle immediately before visual update completes
      await monitor.clickToggle();
      const ariaAfterClick = await monitor.getAriaPressed();
      expect(ariaAfterClick).toBe('true');

      // Text content is updated in a callback after 600ms (fadeOut). Wait a bit longer.
      await page.waitForTimeout(800);

      const titleAfter = await monitor.getTitle();
      const descAfter = await monitor.getDescription();

      expect(titleAfter).toBe('Experience');
      expect(descAfter).toBe('Immersive visuals with flawless design and smooth animations.');

      // Confirm the inline transition style was applied during the animation lifecycle
      const transitionStyle = await monitor.getContentTransitionStyle();
      expect(transitionStyle).toContain('opacity');
    });

    test('Click again toggles back to S0_Initial ("Monitor") and aria-pressed flips back', async ({ page }) => {
      // Validate transition from Toggled -> Initial (toggle back)
      const monitor = new MonitorPage(page);
      await monitor.goto();

      // First click to go to Toggled
      await monitor.clickToggle();
      await page.waitForTimeout(800);

      // Now click again to return
      await monitor.clickToggle();
      const ariaAfterSecondClick = await monitor.getAriaPressed();
      expect(ariaAfterSecondClick).toBe('false');

      // Wait for the fade toggle to complete
      await page.waitForTimeout(800);

      const titleFinal = await monitor.getTitle();
      const descFinal = await monitor.getDescription();

      expect(titleFinal).toBe('Monitor');
      expect(descFinal).toBe('An epitome of visual clarity, elegance, and precision.');
    });

    test('Rapid double-click resolves consistently with final toggled state (edge case)', async ({ page }) => {
      // This tests clicking rapidly twice so the toggled variable flips twice before the async text update.
      // The callback uses the toggled variable at the time of callback; the final visible message should
      // reflect the final toggled state.
      const monitor = new MonitorPage(page);
      await monitor.goto();

      // Click twice rapidly without waiting between clicks
      await Promise.all([
        page.click('#btnToggle'),
        page.click('#btnToggle'),
      ]);

      // Because two quick clicks flip toggled twice, it should end up back in false state.
      // Expect aria-pressed to reflect the last click result ('false').
      // Note: aria-pressed updates synchronously in the click handler.
      const aria = await monitor.getAriaPressed();
      expect(aria).toBe('false');

      // Wait long enough for the fadeOut callback and fadeIn to complete
      await page.waitForTimeout(900);

      // Final visible content should be the original initial state
      const title = await monitor.getTitle();
      const desc = await monitor.getDescription();
      expect(title).toBe('Monitor');
      expect(desc).toBe('An epitome of visual clarity, elegance, and precision.');
    });

    test('Click during transition: click, wait mid-fade, click again -> final state reflects final toggled value', async ({ page }) => {
      // Simulate clicking, waiting mid-transition, then clicking again.
      // The callback that updates the DOM runs after 600ms. If toggled flips during that window,
      // the displayed message should reflect the toggled value at callback time.
      const monitor = new MonitorPage(page);
      await monitor.goto();

      // Start toggle
      await monitor.clickToggle();

      // Wait 300ms (mid fadeOut)
      await page.waitForTimeout(300);

      // Click again while the first fade is still in progress
      await monitor.clickToggle();

      // Final aria should reflect the second click (false)
      const aria = await monitor.getAriaPressed();
      expect(aria).toBe('false');

      // Wait for the remaining animation and updates
      await page.waitForTimeout(800);

      // Validate final visible content matches the final toggled state (initial)
      expect(await monitor.getTitle()).toBe('Monitor');
      expect(await monitor.getDescription()).toBe('An epitome of visual clarity, elegance, and precision.');
    });
  });

  test.describe('Accessibility, ARIA, and visual behaviors', () => {
    test('Button ARIA attributes & content roles are correctly set', async ({ page }) => {
      // Validate ARIA attributes and relationships as per FSM components
      const monitor = new MonitorPage(page);
      await monitor.goto();

      // Button aria-controls should point to the screen content id
      const ariaControls = await monitor.page.locator('#btnToggle').getAttribute('aria-controls');
      expect(ariaControls).toBe('screen-content');

      // The screen content should have aria-live attribute on outer container (declared in HTML)
      const screenLive = await monitor.page.locator('#screen-content').getAttribute('aria-live');
      // According to the provided HTML screen-content has aria-live="polite"
      expect(screenLive).toBe('polite');

      // Verify the monitor container role and labeling exist
      const mainRole = await monitor.page.locator('.container').getAttribute('role');
      expect(mainRole).toBe('main');
      const label = await monitor.page.locator('.container').getAttribute('aria-label');
      expect(label).toBe('Monitor presentation panel');
    });

    test('During transition inline styles reflect fade-out then fade-in timings', async ({ page }) => {
      // Verify the inline style transition values applied by the script during the fade sequence
      const monitor = new MonitorPage(page);
      await monitor.goto();

      // No inline transition initially
      const initialTransition = await monitor.getContentTransitionStyle();
      // It's acceptable for it to be empty string to begin with
      expect(typeof initialTransition).toBe('string');

      // Trigger the transition
      await monitor.clickToggle();

      // Immediately after click, fadeOut sets transition to 0.6s (opacity 0.6s)
      const transitionDuring = await monitor.getContentTransitionStyle();
      expect(transitionDuring).toContain('0.6s');

      // Wait for the fadeOut callback to fire (>=600ms) and fadeIn to apply
      await page.waitForTimeout(700);

      const transitionAfter = await monitor.getContentTransitionStyle();
      // fadeIn sets opacity transition to 0.8s; assert that we see 0.8s somewhere
      expect(transitionAfter).toContain('0.8s');
    });
  });

  test.describe('Runtime observations: console and page errors', () => {
    test('Page should not emit ReferenceError/SyntaxError/TypeError nor console.error messages', async ({ page }) => {
      // This test focuses on capturing runtime problems. It intentionally does not
      // try to fix or patch the page; it only observes and asserts the absence
      // of critical runtime errors.
      const monitor = new MonitorPage(page);
      await monitor.goto();

      // Perform a couple of interactions to exercise event handlers and potential error paths
      await monitor.clickToggle();
      await page.waitForTimeout(200);
      await monitor.clickToggle();
      await page.waitForTimeout(900);

      // Review collected pageErrors and console messages (captured in beforeEach)
      // pageErrors contains Error objects from unhandled exceptions
      expect(pageErrors.length).toBe(0);

      // consoleMessages may include informational logs but should not include 'error' type entries
      const errorConsoleItems = consoleMessages.filter((c) => c.type === 'error');
      expect(errorConsoleItems.length).toBe(0);
    });
  });
});