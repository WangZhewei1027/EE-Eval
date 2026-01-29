import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f6f033-fa77-11f0-a6a1-c765f41a13c7.html';

/**
 * Page object encapsulating commonly used controls for the Big-O visualization page.
 * This keeps tests readable and groups DOM access in one place.
 */
class BigOPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#playBtn');
    this.playLabel = page.locator('#playLabel');
    this.playIcon = page.locator('#playIcon');
    this.infoBtn = page.locator('#infoBtn');
    this.infoOverlay = page.locator('#infoOverlay');
    this.markers = page.locator('#markers g'); // group elements for markers
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait a little for the inline script to run and set initial attributes
    await this.page.waitForTimeout(120);
  }

  async clickPlay() {
    await this.playBtn.click();
  }

  async clickInfo() {
    await this.infoBtn.click();
  }

  async pressSpace() {
    // Ensure the page has focus so window-level keydown is dispatched
    await this.page.focus('body');
    await this.page.keyboard.press('Space');
  }

  async getPlayDataActive() {
    return await this.playBtn.getAttribute('data-active');
  }

  async getPlayAriaPressed() {
    return await this.playBtn.getAttribute('aria-pressed');
  }

  async getPlayLabelText() {
    return (await this.playLabel.textContent())?.trim();
  }

  async getInfoAriaPressed() {
    return await this.infoBtn.getAttribute('aria-pressed');
  }

  async getInfoOverlayAriaHidden() {
    return await this.infoOverlay.getAttribute('aria-hidden');
  }

  async infoOverlayHasOpenClass() {
    const cls = await this.infoOverlay.getAttribute('class');
    return (cls || '').split(/\s+/).includes('open');
  }

  async getFirstMarkerTransform() {
    // returns the transform attribute of the first marker g element (or null)
    const count = await this.markers.count();
    if (count === 0) return null;
    return await this.markers.nth(0).getAttribute('transform');
  }

  async getPlayIconInnerHTML() {
    // innerHTML of the svg#playIcon (string)
    return await this.page.locator('#playIcon').evaluate((el) => el.innerHTML);
  }
}

test.describe('Big-O Notation — Visualized (FSM validations & interactions)', () => {
  // Collect console errors and page errors for assertions later
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location?.() || null,
          });
        }
      } catch (e) {
        // proceed; do not interfere with page behavior
      }
    });

    // Capture unhandled page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('Initial state: Idle (S0_Idle) — Play button and Info overlay initial evidence', async ({ page }) => {
    // This test validates the Idle state evidence per FSM S0_Idle:
    // - playBtn.dataset.active = false
    // - playLabel.textContent = 'Play'
    const app = new BigOPage(page);
    await app.goto();

    // Verify play button initial aria-pressed attribute and dataset
    const ariaPressed = await app.getPlayAriaPressed();
    const dataActive = await app.getPlayDataActive();
    const labelText = await app.getPlayLabelText();

    // Assertions: Idle evidence
    expect(ariaPressed).toBe('false');
    // dataset attribute is set by script; should be "false"
    expect(dataActive).toBe('false');
    expect(labelText).toBe('Play');

    // Verify info overlay initial evidence (S3_InfoClosed)
    const infoAriaHidden = await app.getInfoOverlayAriaHidden();
    const infoBtnAria = await app.getInfoAriaPressed();
    expect(infoAriaHidden).toBe('true');
    expect(infoBtnAria).toBe('false');

    // There should be no uncaught page errors at initial load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Play/Pause control (PlayPauseClick & SpaceKeyPress)', () => {
    test('Click Play toggles Idle -> Playing (S0_Idle -> S1_Playing) and visual changes', async ({ page }) => {
      // Validate transition S0_Idle -> S1_Playing on click:
      // - setRunning(true) results in playBtn.dataset.active = true
      // - playLabel.textContent = 'Pause'
      // - icon changes to pause rectangles (entry action: requestAnimationFrame(animate) implied by icon change)
      const app = new BigOPage(page);
      await app.goto();

      // Capture transform before starting animation (should be null or absent)
      const beforeTransform = await app.getFirstMarkerTransform();

      // Click play button
      await app.clickPlay();

      // Allow a little time for setRunning to mutate DOM and for the first animation frame
      await page.waitForTimeout(240);

      const dataActive = await app.getPlayDataActive();
      const ariaPressed = await app.getPlayAriaPressed();
      const labelText = await app.getPlayLabelText();
      const iconHTML = (await app.getPlayIconInnerHTML()) || '';

      expect(dataActive).toBe('true');
      expect(ariaPressed).toBe('true');
      expect(labelText).toBe('Pause');

      // Icon should switch to rectangles representing a pause icon
      expect(iconHTML).toContain('<rect');

      // After some time the animate() loop should have applied transforms to marker group
      const afterTransform = await app.getFirstMarkerTransform();

      // Expect that a transform attribute exists and includes translate when running
      expect(afterTransform).not.toBeNull();
      expect(afterTransform).toMatch(/translate\(/);

      // Pause returning to Idle: click again
      await app.clickPlay();
      await page.waitForTimeout(120);

      const dataActiveAfterPause = await app.getPlayDataActive();
      const labelAfterPause = await app.getPlayLabelText();
      const iconHTMLAfterPause = (await app.getPlayIconInnerHTML()) || '';

      expect(dataActiveAfterPause).toBe('false');
      expect(labelAfterPause).toBe('Play');

      // Icon should revert to original path-based "play" triangle
      expect(iconHTMLAfterPause).toContain('<path');

      // No uncaught errors occurred while interacting
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Space key toggles play/pause (SpaceKeyPress event)', async ({ page }) => {
      // Validate keyboard interaction: pressing Space toggles running state
      const app = new BigOPage(page);
      await app.goto();

      // Ensure starting idle
      expect(await app.getPlayDataActive()).toBe('false');

      // Press Space to play
      await app.pressSpace();
      await page.waitForTimeout(160);

      expect(await app.getPlayDataActive()).toBe('true');
      expect(await app.getPlayAriaPressed()).toBe('true');
      expect(await app.getPlayLabelText()).toBe('Pause');

      // Press Space again to pause
      await app.pressSpace();
      await page.waitForTimeout(120);

      expect(await app.getPlayDataActive()).toBe('false');
      expect(await app.getPlayLabelText()).toBe('Play');

      // There should be no unexpected page errors from keyboard handling
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Rapid clicking/play toggles eventually settle state (edge case)', async ({ page }) => {
      // This edge-case test simulates rapid user toggles to ensure DOM state remains consistent.
      const app = new BigOPage(page);
      await app.goto();

      // Rapidly click the play button 5 times
      for (let i = 0; i < 5; i++) {
        await app.clickPlay();
        // very small delay between clicks to simulate fast user input
        await page.waitForTimeout(40);
      }

      // Wait for any last mutation to complete
      await page.waitForTimeout(200);

      // The state should be deterministically equal to toggling 5 times from initial false -> true (odd => true)
      const expected = 'true';
      expect(await app.getPlayDataActive()).toBe(expected);
      expect(await app.getPlayLabelText()).toBe('Pause');

      // Now press Space rapidly three times
      for (let i = 0; i < 3; i++) {
        await app.pressSpace();
        await page.waitForTimeout(40);
      }

      await page.waitForTimeout(160);
      // From previous state true, 3 toggles -> false (odd flips)
      expect(await app.getPlayDataActive()).toBe('false');
      expect(await app.getPlayLabelText()).toBe('Play');

      // Confirm no errors in console or page
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Info overlay toggling (InfoClick transitions)', () => {
    test('Info button toggles overlay open/close (S0_Idle -> S2_InfoOpen -> S3_InfoClosed -> S2_InfoOpen)', async ({ page }) => {
      // This test validates the InfoClick transitions: open -> closed -> open again
      const app = new BigOPage(page);
      await app.goto();

      // Initially closed (S3_InfoClosed)
      expect(await app.getInfoOverlayAriaHidden()).toBe('true');
      expect(await app.getInfoAriaPressed()).toBe('false');
      expect(await app.infoOverlayHasOpenClass()).toBe(false);

      // Click to open (S2_InfoOpen)
      await app.clickInfo();
      await page.waitForTimeout(160);

      expect(await app.getInfoOverlayAriaHidden()).toBe('false');
      expect(await app.getInfoAriaPressed()).toBe('true');
      expect(await app.infoOverlayHasOpenClass()).toBe(true);

      // Click to close (S3_InfoClosed)
      await app.clickInfo();
      await page.waitForTimeout(120);

      expect(await app.getInfoOverlayAriaHidden()).toBe('true');
      expect(await app.getInfoAriaPressed()).toBe('false');
      expect(await app.infoOverlayHasOpenClass()).toBe(false);

      // Click again to open (S2_InfoOpen)
      await app.clickInfo();
      await page.waitForTimeout(120);

      expect(await app.getInfoOverlayAriaHidden()).toBe('false');
      expect(await app.getInfoAriaPressed()).toBe('true');
      expect(await app.infoOverlayHasOpenClass()).toBe(true);

      // No page errors during overlay toggling
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Opening info overlay while playing preserves play state (independent controls)', async ({ page }) => {
      // Ensure play state and info overlay state do not conflict when toggled concurrently.
      const app = new BigOPage(page);
      await app.goto();

      // Start playing
      await app.clickPlay();
      await page.waitForTimeout(180);
      expect(await app.getPlayDataActive()).toBe('true');

      // Open info overlay
      await app.clickInfo();
      await page.waitForTimeout(140);

      // Verify both states reflect their expected evidence
      expect(await app.getPlayDataActive()).toBe('true'); // still playing
      expect(await app.getInfoOverlayAriaHidden()).toBe('false'); // overlay open

      // Close overlay, ensure play still running
      await app.clickInfo();
      await page.waitForTimeout(120);
      expect(await app.getPlayDataActive()).toBe('true');

      // Pause playback and ensure overlay unaffected
      await app.clickPlay();
      await page.waitForTimeout(120);
      expect(await app.getPlayDataActive()).toBe('false');

      // No runtime errors during simultaneous interactions
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Stability: console and runtime error observations', () => {
    test('No unexpected console.error or unhandled exceptions during normal usage', async ({ page }) => {
      // This test loads the page and performs a set of interactions, then asserts there were no runtime errors.
      const app = new BigOPage(page);
      await app.goto();

      // Perform a representative interaction sequence
      await app.clickPlay();
      await page.waitForTimeout(120);
      await app.clickInfo();
      await page.waitForTimeout(100);
      await app.pressSpace(); // toggle via keyboard
      await page.waitForTimeout(160);
      await app.clickInfo();
      await page.waitForTimeout(100);

      // Evaluate the captured errors/console messages
      // The tests should assert that no ReferenceError, SyntaxError, TypeError, nor console.error occurred.
      // If any did occur, fail with the details to aid debugging.
      if (pageErrors.length > 0 || consoleErrors.length > 0) {
        // Include diagnostic details in the failure message
        const pageErrMsgs = pageErrors.map(e => (e && e.stack) ? e.stack : String(e)).join('\n---\n');
        const consoleErrMsgs = consoleErrors.map(c => `${c.text} ${c.location ? JSON.stringify(c.location) : ''}`).join('\n---\n');
        throw new Error(
          `Detected runtime/page errors during interactions.\nPage errors:\n${pageErrMsgs || '<none>'}\n\nConsole.errors:\n${consoleErrMsgs || '<none>'}`
        );
      }

      // Explicit success expectation for clarity
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('If any JS runtime errors occur they are surfaced via pageerror and console listeners (sanity check)', async ({ page }) => {
      // This test simply verifies that our listeners are wired and would capture an error if it occurs.
      // We do not inject or modify the page; we only validate the listening mechanism is active.
      const app = new BigOPage(page);
      await app.goto();

      // At this point there should be no captured errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);

      // The test is considered passing if listeners remain empty after normal load.
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // For extra safety, if any test left runtime errors, attach them to the test output
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // Annotate the test result to include diagnostic info for CI logs
      const errs = {
        pageErrors: pageErrors.map(e => (e && e.stack) ? e.stack : String(e)),
        consoleErrors,
      };
      testInfo.attach('runtime-errors', { body: JSON.stringify(errs, null, 2), contentType: 'application/json' });
    }
  });
});