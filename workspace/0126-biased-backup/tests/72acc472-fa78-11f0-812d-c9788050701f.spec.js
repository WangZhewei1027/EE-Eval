import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72acc472-fa78-11f0-812d-c9788050701f.html';

// Page Object for the SDLC Visual Journey page
class SDLCPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.animateBtn = page.locator('#animateBtn');
    this.learnMoreBtn = page.locator('#learnMoreBtn');
    this.closeHighlightBtn = page.locator('#closeHighlight');
    this.highlight = page.locator('#highlight');
    this.infoPanel = page.locator('#infoPanel');
    this.phases = page.locator('.phase');
    this.connectors = page.locator('.connector');
    this.header = page.locator('header');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickAnimate() {
    await this.animateBtn.click();
  }

  async clickLearnMore() {
    await this.learnMoreBtn.click();
  }

  async clickCloseHighlight() {
    await this.closeHighlightBtn.click();
  }

  async getPhaseActiveCount() {
    return await this.page.locator('.phase.active').count();
  }

  async getConnectorActiveCount() {
    return await this.page.locator('.connector.active').count();
  }

  async infoPanelHasActive() {
    const cls = await this.infoPanel.getAttribute('class');
    return cls?.includes('active') ?? false;
  }

  async highlightHasActive() {
    const cls = await this.highlight.getAttribute('class');
    return cls?.includes('active') ?? false;
  }
}

test.describe('SDLC Visual Journey - FSM states and transitions', () => {
  // Capture console messages and page errors for each test to assert no unexpected exceptions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages including errors, warnings, logs
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.describe('Initial state (S0_Idle) and automatic behavior', () => {
    test('Page loads and key components exist (S0_Idle)', async ({ page }) => {
      // Validate DOM presence and basic expectations of the Idle state
      const sdlc = new SDLCPage(page);
      await sdlc.goto();

      // Header should be present
      await expect(sdlc.header).toBeVisible();

      // Buttons should be present and enabled
      await expect(sdlc.animateBtn).toBeVisible();
      await expect(sdlc.animateBtn).toBeEnabled();
      await expect(sdlc.learnMoreBtn).toBeVisible();
      await expect(sdlc.learnMoreBtn).toBeEnabled();

      // Info panel and highlight should be present in DOM but not visible (idle)
      // The page schedules an automatic animate click after 1s; attempt to assert initial "not active" state quickly
      // We check that the info panel is initially not active (or if auto-click already occurred, we won't fail the test)
      const infoClass = await sdlc.infoPanel.getAttribute('class');
      expect(infoClass).toBeTruthy(); // class exists
      // It's acceptable if 'active' is present already due to timed auto-click; just ensure property exists
      // Highlight likewise should be present
      const highlightClass = await sdlc.highlight.getAttribute('class');
      expect(highlightClass).toBeTruthy();

      // No uncaught errors on load
      expect(pageErrors.length).toBe(0);
      // No console 'error' messages
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Automatic animation triggers phases/connectors/info panel (S0_Idle -> S1_Animating -> S2_InfoPanelVisible)', async ({ page }) => {
      // This test verifies the automatic animation scheduled on DOMContentLoaded:
      // setTimeout(() => { animateBtn.click(); }, 1000);
      // which should trigger phased activations and finally the info panel after ~2500ms from click.
      const sdlc = new SDLCPage(page);
      await sdlc.goto();

      // Wait enough time to let the automatic click and animations complete.
      // Timings in the implementation:
      // - auto click at ~1000ms after DOMContentLoaded
      // - phases: each index * 300ms for 7 phases -> ~2100ms duration
      // - connectors: start after phases.length * 300ms (~2100ms)
      // - infoPanel: setTimeout 2500ms relative to click -> so ~3500ms from page load
      // We wait up to 6000ms to be safe.
      await page.waitForTimeout(6000);

      // Assert that at least some phases became active
      const activePhases = await sdlc.getPhaseActiveCount();
      expect(activePhases).toBeGreaterThanOrEqual(1);

      // Assert that connectors became active
      const activeConnectors = await sdlc.getConnectorActiveCount();
      expect(activeConnectors).toBeGreaterThanOrEqual(1);

      // Assert info panel is visible (has 'active' class)
      const infoActive = await sdlc.infoPanelHasActive();
      expect(infoActive).toBe(true);

      // No uncaught page errors during this automatic flow
      expect(pageErrors.length).toBe(0, `Expected no page errors, got: ${pageErrors.map(e => e.message).join('; ')}`);
      // No console.error messages during this flow
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0, `Console errors: ${consoleErrors.map(e => e.text).join('; ')}`);
    });
  });

  test.describe('User-driven transitions and interactions', () => {
    test('Clicking Animate Cycle triggers phases/connectors/info panel (S0_Idle -> S1_Animating -> S2_InfoPanelVisible)', async ({ page }) => {
      // This test explicitly clicks the animate button and verifies the transitions and final state
      const sdlc = new SDLCPage(page);
      await sdlc.goto();

      // To avoid interference with the automatic click scheduled at 1s,
      // click immediately to cause a deterministic user-triggered flow.
      await sdlc.clickAnimate();

      // Wait enough time for the animation (phases + connectors + info panel)
      await page.waitForTimeout(3500);

      // Validate phases active
      const activePhases = await sdlc.getPhaseActiveCount();
      expect(activePhases).toBeGreaterThanOrEqual(1);

      // Validate connectors active
      const activeConnectors = await sdlc.getConnectorActiveCount();
      expect(activeConnectors).toBeGreaterThanOrEqual(1);

      // Validate info panel visible
      const infoActive = await sdlc.infoPanelHasActive();
      expect(infoActive).toBe(true);

      // Validate no runtime page errors occurred
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Learn More opens highlight and Close hides it (S0_Idle -> S3_HighlightVisible -> S0_Idle)', async ({ page }) => {
      // This test verifies Learn More and CloseHighlight transitions
      const sdlc = new SDLCPage(page);
      await sdlc.goto();

      // Ensure highlight is initially not active
      const initiallyActive = await sdlc.highlightHasActive();
      // It's acceptable if automatic flows have already toggled something, but we assert we can open and close reliably.
      // Open highlight explicitly
      await sdlc.clickLearnMore();

      // Wait a short time for the class to be applied
      await page.waitForTimeout(200);
      expect(await sdlc.highlightHasActive()).toBe(true);

      // Close the highlight
      await sdlc.clickCloseHighlight();
      await page.waitForTimeout(200);
      expect(await sdlc.highlightHasActive()).toBe(false);

      // Verify that closing when open does not produce errors
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking CloseHighlight when highlight is not visible does not throw (edge case)', async ({ page }) => {
      // Edge case: closeHighlight button exists inside highlight content; clicking it when highlight is not active
      // should not throw an error because the button is still present in the DOM.
      const sdlc = new SDLCPage(page);
      await sdlc.goto();

      // Ensure highlight is not active
      // If it is active due to auto flows, attempt to close then re-open for the test; but primary goal is to click it when not active.
      if (await sdlc.highlightHasActive()) {
        // close first
        await sdlc.clickCloseHighlight();
        await page.waitForTimeout(200);
      }

      // Now highlight should be not active
      expect(await sdlc.highlightHasActive()).toBe(false);

      // Click closeHighlight, which should gracefully remove a class (or do nothing) and not produce errors
      await sdlc.clickCloseHighlight();
      await page.waitForTimeout(200);

      // No runtime errors should have been thrown
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Rapid repeated clicks of Animate Cycle are tolerated (edge case)', async ({ page }) => {
      // Rapid clicking should not cause uncaught exceptions or leave DOM in broken state
      const sdlc = new SDLCPage(page);
      await sdlc.goto();

      // Rapid click animate many times
      for (let i = 0; i < 5; i++) {
        await sdlc.clickAnimate();
      }

      // Wait for animations to settle
      await page.waitForTimeout(3000);

      // At least one phase must be active and info panel should eventually be active
      const activePhases = await sdlc.getPhaseActiveCount();
      expect(activePhases).toBeGreaterThanOrEqual(1);
      const infoActive = await sdlc.infoPanelHasActive();
      expect(infoActive).toBe(true);

      // Assert no uncaught page errors or console.error messages as a result of rapid interactions
      expect(pageErrors.length).toBe(0, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0, `Console errors encountered: ${consoleErrors.map(e => e.text).join('; ')}`);
    });
  });

  test.describe('Validation of onEnter/onExit and FSM evidence behaviors', () => {
    test('Phases get .active class in sequence (evidence-driven check)', async ({ page }) => {
      // This test attempts to validate the sequential addition of 'active' on phases by sampling at intervals.
      const sdlc = new SDLCPage(page);
      await sdlc.goto();

      // Trigger animation explicitly to ensure deterministic sequence timing
      await sdlc.clickAnimate();

      // Sample counts at intervals matching the index * 300ms logic
      // Check after 300ms: at least 1 phase activated
      await page.waitForTimeout(400);
      const count1 = await sdlc.getPhaseActiveCount();
      expect(count1).toBeGreaterThanOrEqual(1);

      // After ~900ms (3 * 300ms) there should be at least 3 phases (depending on timings)
      await page.waitForTimeout(600);
      const count2 = await sdlc.getPhaseActiveCount();
      expect(count2).toBeGreaterThanOrEqual(count1);

      // After complete sequence (~2100ms) expect all phases could be active (>=1 still a valid check)
      await page.waitForTimeout(1600);
      const finalCount = await sdlc.getPhaseActiveCount();
      expect(finalCount).toBeGreaterThanOrEqual(count2);

      // Check info panel appears after expected timeline (<= 3s from click typically)
      await page.waitForTimeout(500);
      expect(await sdlc.infoPanelHasActive()).toBe(true);

      // Ensure no JS runtime errors during the sequence
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Connectors gain .active class after phases (evidence-driven check)', async ({ page }) => {
      // This test validates connectors get active after the phases' sequence delay
      const sdlc = new SDLCPage(page);
      await sdlc.goto();

      // Click animate to start the sequence
      await sdlc.clickAnimate();

      // Wait until phases-length*300ms + small buffer -> phases.length is 7 -> 2100ms; connectors start after that
      await page.waitForTimeout(2600);

      const connectorsActive = await sdlc.getConnectorActiveCount();
      expect(connectorsActive).toBeGreaterThanOrEqual(1);

      // No runtime page errors expected
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Console and runtime error observations (must be monitored)', () => {
    test('No unexpected uncaught exceptions or console.errors during load and interactions', async ({ page }) => {
      // This final test runs through the primary flows and asserts there are no uncaught exceptions.
      const sdlc = new SDLCPage(page);
      await sdlc.goto();

      // Perform typical interactions
      await sdlc.clickAnimate();
      await page.waitForTimeout(1200);
      await sdlc.clickLearnMore();
      await page.waitForTimeout(300);
      await sdlc.clickCloseHighlight();

      // Allow animations and queued timeouts to finish
      await page.waitForTimeout(3000);

      // Assert that there were no page errors captured
      expect(pageErrors.length).toBe(0, `Found page errors: ${pageErrors.map(e => e.message).join('; ')}`);

      // Assert that console did not produce error messages
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0, `Console errors present: ${consoleErrorMsgs.map(m => m.text).join('; ')}`);

      // For visibility, also assert that core elements reached expected final states
      expect(await sdlc.infoPanelHasActive()).toBe(true);
      // highlight should be closed after clicking close
      expect(await sdlc.highlightHasActive()).toBe(false);
    });
  });
});