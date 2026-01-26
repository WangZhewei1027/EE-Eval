import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f7da90-fa77-11f0-a6a1-c765f41a13c7.html';

// Small page object to interact with the app and query stateful observables.
// Encapsulates common selectors and helper assertions used across tests.
class IndexingApp {
  constructor(page) {
    this.page = page;
    this.toggleBtn = page.locator('#toggleBtn');
    this.infoBtn = page.locator('#infoBtn');
    this.closeOverlay = page.locator('#closeOverlay');
    this.overlay = page.locator('#overlay');
    this.pulse = page.locator('#pulseLayer');
    this.stack = page.locator('#stack');
    this.appRoot = page.locator('#app');
  }

  // Wait until the page's core elements are present
  async waitForReady() {
    await Promise.all([
      this.appRoot.waitFor({ state: 'visible' }),
      this.toggleBtn.waitFor({ state: 'visible' }),
      this.infoBtn.waitFor({ state: 'visible' }),
      this.overlay.waitFor({ state: 'attached' })
    ]);
    // Give the animation a small moment to start so inline styles applied by rAF show up.
    await this.page.waitForTimeout(150);
  }

  // Get overlay visibility according to attributes and CSS
  async isOverlayShown() {
    const hasClass = await this.overlay.evaluate((el) => el.classList.contains('show'));
    const aria = await this.overlay.getAttribute('aria-hidden');
    const display = await this.overlay.evaluate((el) => getComputedStyle(el).display);
    return { classShow: hasClass, ariaHidden: aria, display };
  }

  // Get toggle button aria-pressed and visible text
  async getToggleState() {
    const ariaPressed = await this.toggleBtn.getAttribute('aria-pressed');
    // innerText returns visible text; use innerHTML to detect 'Play'/'Pause' labels with embedded SVGs
    const innerText = await this.toggleBtn.innerText();
    return { ariaPressed, innerText };
  }

  // Read pulse inline opacity style (set by script) and computed style
  async getPulseOpacity() {
    const inline = await this.pulse.evaluate((el) => el.style.opacity || null);
    const computed = await this.pulse.evaluate((el) => getComputedStyle(el).opacity);
    return { inline, computed };
  }

  // Click helpers
  async togglePlayPause() {
    await this.toggleBtn.click();
    // Let UI update
    await this.page.waitForTimeout(80);
  }

  async showOverlay() {
    await this.infoBtn.click();
    // allow transition/frame to update
    await this.page.waitForTimeout(80);
  }

  async closeOverlayByButton() {
    await this.closeOverlay.click();
    await this.page.waitForTimeout(80);
  }

  async pressEscape() {
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(80);
  }
}

test.describe('Indexing visualization — FSM validation and interactions', () => {
  // collectors for console errors and page errors
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // capture console errors (e.g., runtime errors logged via console.error)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // capture uncaught exceptions from the page context
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(BASE, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // After each test ensure no uncaught page errors were emitted during the interaction
    // This asserts there were no unexpected runtime exceptions.
    expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e => e.stack || e.message).join('\n')}`).toHaveLength(0);
    // Also assert there were no console.error messages captured.
    expect(consoleErrors, `Unexpected console.error messages: ${consoleErrors.map(e => e.text).join('\n')}`).toHaveLength(0);
  });

  test('Initial render — Idle / Playing detection and basic DOM checks', async ({ page }) => {
    // Validate that the page renders required root and region elements and initial animation is running.
    const app = new IndexingApp(page);
    await app.waitForReady();

    // Validate main app root exists and has aria-live
    await expect(app.appRoot).toBeVisible();
    expect(await app.appRoot.getAttribute('aria-live')).toBe('polite');

    // The overlay should start hidden
    const overlayState = await app.isOverlayShown();
    expect(overlayState.classShow).toBe(false);
    expect(overlayState.ariaHidden).toBe('true');
    expect(overlayState.display).toBe('none');

    // The animation loop in the script sets pulse.style.opacity to 0.95 when playing.
    const pulseOpacity = await app.getPulseOpacity();
    // We expect either inline style equals '0.95' or computed style not equal to the paused value '0.6'.
    // Accept both to be robust against computed vs inline differences.
    expect(pulseOpacity.inline === '0.95' || pulseOpacity.computed !== '0.6').toBeTruthy();

    // Toggle button should exist and initially have aria-pressed attribute (default in HTML is "false")
    const toggleState = await app.getToggleState();
    expect(toggleState.ariaPressed).toBeDefined();
    // The textual label should contain "Play" initially (script may modify on reduced motion but default shows Play)
    expect(toggleState.innerText.toLowerCase()).toContain('play');
  });

  test('TogglePlayPause transitions: Playing -> Paused -> Playing', async ({ page }) => {
    // This test validates the TogglePlayPause event and the S1 <-> S2 transitions:
    // - click toggleBtn when playing -> expectation: paused state (aria-pressed toggled, button shows "Pause" text and pulse opacity reduced)
    // - click again -> expectation: playing resumed (button shows "Play", pulse opacity restored)

    const app = new IndexingApp(page);
    await app.waitForReady();

    // Ensure we start from playing-like behavior (pulse not at pause opacity)
    const before = await app.getPulseOpacity();
    expect(before.computed).not.toBe('0.6');

    // Click once to toggle (should pause)
    await app.togglePlayPause();

    // After pausing: aria-pressed attribute is set to "true" by the script (they set String(!playing))
    const statePaused = await app.getToggleState();
    expect(statePaused.ariaPressed).toBe('true');
    // The visible label should include 'Pause' (script injects SVG + "Pause" on paused state)
    expect(statePaused.innerText).toContain('Pause');

    // Pulse inline style should indicate the "paused" visual (script sets opacity '0.6')
    const pausedPulse = await app.getPulseOpacity();
    // Some environments may normalize to computed style; check computed also.
    expect(pausedPulse.inline === '0.6' || pausedPulse.computed === '0.6').toBeTruthy();

    // Click again to resume
    await app.togglePlayPause();

    const stateResumed = await app.getToggleState();
    // aria-pressed toggles back to 'false'
    expect(stateResumed.ariaPressed).toBe('false');
    expect(stateResumed.innerText.toLowerCase()).toContain('play');

    const resumedPulse = await app.getPulseOpacity();
    // on resume, script sets inline opacity back to '0.95' and restarts rAF
    expect(resumedPulse.inline === '0.95' || resumedPulse.computed !== '0.6').toBeTruthy();
  });

  test('Overlay show and close via UI and Escape key (S3 <-> S4 transitions)', async ({ page }) => {
    // Validate the overlay show (ShowOverlay) and close via close button (CloseOverlay)
    // Also validate close via Escape key (EscapeCloseOverlay).
    const app = new IndexingApp(page);
    await app.waitForReady();

    // Initially overlay should be hidden
    let overlayState = await app.isOverlayShown();
    expect(overlayState.classShow).toBe(false);
    expect(overlayState.ariaHidden).toBe('true');

    // Show overlay via info button
    await app.showOverlay();

    overlayState = await app.isOverlayShown();
    expect(overlayState.classShow).toBe(true);
    expect(overlayState.ariaHidden).toBe('false');
    // When visible, CSS display should not be 'none'
    expect(overlayState.display).not.toBe('none');

    // Close overlay by clicking the close button
    await app.closeOverlayByButton();
    overlayState = await app.isOverlayShown();
    expect(overlayState.classShow).toBe(false);
    expect(overlayState.ariaHidden).toBe('true');
    expect(overlayState.display).toBe('none');

    // Show again and close via Escape key
    await app.showOverlay();
    overlayState = await app.isOverlayShown();
    expect(overlayState.classShow).toBe(true);

    await app.pressEscape();
    overlayState = await app.isOverlayShown();
    expect(overlayState.classShow).toBe(false);
    expect(overlayState.ariaHidden).toBe('true');
  });

  test('Edge cases: rapid toggles and unrelated key presses should not create runtime errors', async ({ page }) => {
    // This exercise simulates quick, repeated interactions to exercise potential timing/rAF race conditions.
    const app = new IndexingApp(page);
    await app.waitForReady();

    // Rapidly click toggle button multiple times
    for (let i = 0; i < 6; i++) {
      await app.toggleBtn.click();
      // small but deliberate jitter
      await page.waitForTimeout(30);
    }

    // Ensure toggle button still exists and is interactive
    await expect(app.toggleBtn).toBeEnabled();

    // Send unrelated key to the document; should not close overlay nor throw
    await page.keyboard.press('KeyA');
    await page.waitForTimeout(40);

    // Ensure overlay remains hidden after unrelated key
    const overlayState = await app.isOverlayShown();
    expect(overlayState.classShow).toBe(false);

    // No uncaught errors should have been emitted (this is also asserted in afterEach)
  });

  test('Accessibility and attribute checks for components defined in FSM', async ({ page }) => {
    // Verify presence and attributes of components described in the FSM:
    // - #toggleBtn with aria-pressed and title
    // - #infoBtn with title
    // - #closeOverlay with aria-label (exists inside overlay)
    const app = new IndexingApp(page);
    await app.waitForReady();

    // toggle button attributes
    expect(await app.toggleBtn.getAttribute('title')).toBe('Start or pause visualization');
    const ariaPressed = await app.toggleBtn.getAttribute('aria-pressed');
    expect(ariaPressed).not.toBeNull();

    // info button attributes
    expect(await app.infoBtn.getAttribute('title')).toBe('Show a short explanation');

    // closeOverlay exists and has aria-label 'Close explanation'
    await expect(app.closeOverlay).toBeVisible();
    expect(await app.closeOverlay.getAttribute('aria-label')).toBe('Close explanation');
  });
});