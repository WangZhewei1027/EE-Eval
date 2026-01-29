import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c991411-fa78-11f0-857d-d58e82d5de73.html';

// Page object model for the thread visual page
class ThreadPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  async getToggleButton() {
    return this.page.locator('#toggleMotion');
  }

  async getRegenButton() {
    return this.page.locator('#regenThread');
  }

  async getToggleButtonText() {
    return (await this.getToggleButton().innerText()).trim();
  }

  async getToggleAriaPressed() {
    return (await this.getToggleButton().getAttribute('aria-pressed'));
  }

  async getRegenButtonText() {
    return (await this.getRegenButton().innerText()).trim();
  }

  // Returns the canvas dataURL (PNG) as string
  async getCanvasDataURL() {
    return await this.page.$eval('#threadCanvas', (canvas) => {
      // toDataURL is synchronous; returns base64 png representation
      return canvas.toDataURL();
    });
  }

  // Convenience: compute a short stable fingerprint of the canvas dataURL
  // We take a slice of the base64 payload to avoid huge strings while still preserving change sensitivity.
  async getCanvasFingerprint() {
    const dataURL = await this.getCanvasDataURL();
    // Data URL format: data:image/png;base64,XXXXX
    const payload = dataURL.split(',')[1] || dataURL;
    // return a slice (start + end) to avoid entire huge string comparisons but still detect change
    return payload.slice(0, 200) + '...' + payload.slice(-200);
  }

  // Click helpers
  async clickToggle() {
    await this.getToggleButton().click();
  }

  async clickRegen() {
    await this.getRegenButton().click();
  }
}

test.describe('Thread - Visual Concept (FSM validation)', () => {
  // Collect console errors and page errors per test to assert runtime health / observe any runtime exceptions.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleErrors = [];
    pageErrors = [];

    // Listen to page console; capture messages with severity "error"
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location()
          });
        }
      } catch (e) {
        // Defensive: if msg.type() throws, still record minimal info
        consoleErrors.push({ text: String(msg) });
      }
    });

    // Listen to uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err?.message,
        stack: err?.stack
      });
    });
  });

  test('Initial state S0_Idle: toggle button, regen button and canvas exist and initial attributes are correct', async ({ page }) => {
    // Purpose: Validate initial FSM state S0_Idle and UI components existence and attributes.
    const threadPage = new ThreadPage(page);
    await threadPage.goto();

    // Basic presence assertions
    const toggle = await threadPage.getToggleButton();
    const regen = await threadPage.getRegenButton();

    await expect(toggle).toBeVisible();
    await expect(regen).toBeVisible();

    // Validate toggle initial text and aria-pressed (evidence for running = true in S0_Idle)
    const toggleText = await threadPage.getToggleButtonText();
    expect(toggleText).toBe('Pause Animation'); // as per HTML initial state

    const ariaPressed = await threadPage.getToggleAriaPressed();
    expect(ariaPressed).toBe('true');

    // Regen button text
    const regenText = await threadPage.getRegenButtonText();
    expect(regenText).toBe('New Thread');

    // Canvas presence and fingerprint (ensure there is drawable content)
    const fingerprint = await threadPage.getCanvasFingerprint();
    expect(fingerprint).toBeTruthy(); // non-empty fingerprint indicates canvas produced an image

    // Assert there were no runtime errors logged during initial load
    expect(consoleErrors).toEqual([]); // no console.error messages expected
    expect(pageErrors).toEqual([]); // no uncaught exceptions expected
  });

  test('ToggleAnimation: clicking toggles to Animation Paused (S1_AnimationPaused) and stops frame updates', async ({ page }) => {
    // Purpose: Validate transition S0_Idle -> S1_AnimationPaused on ToggleAnimation event.
    const threadPage = new ThreadPage(page);
    await threadPage.goto();

    // Confirm animation is running by observing canvas change between two frames
    const beforeRun = await threadPage.getCanvasFingerprint();
    await page.waitForTimeout(250); // give a short time for animation to progress
    const afterRun = await threadPage.getCanvasFingerprint();
    expect(afterRun).not.toBe(beforeRun); // running should cause changes over time

    // Click the toggle to pause
    await threadPage.clickToggle();
    // Validate onExit / entry effects: button text and aria-pressed update (exit_actions in FSM mention toggleBtn.textContent -> Play Animation and aria-pressed false)
    await page.waitForTimeout(50); // allow DOM update
    const toggledText = await threadPage.getToggleButtonText();
    expect(toggledText).toBe('Play Animation');

    const toggledAria = await threadPage.getToggleAriaPressed();
    expect(toggledAria).toBe('false');

    // Capture canvas before and after a delay to assert it remains the same when paused
    const pausedBefore = await threadPage.getCanvasFingerprint();
    await page.waitForTimeout(300);
    const pausedAfter = await threadPage.getCanvasFingerprint();

    // When paused, canvas should not change (or changes drastically less); assert equality of fingerprints
    expect(pausedAfter).toBe(pausedBefore);

    // Ensure no runtime errors were emitted while toggling
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('ToggleAnimation: clicking while paused resumes animation (S1_AnimationPaused -> S0_Idle) and frames update', async ({ page }) => {
    // Purpose: Validate transition S1_AnimationPaused -> S0_Idle on ToggleAnimation event and requestAnimationFrame resumption.
    const threadPage = new ThreadPage(page);
    await threadPage.goto();

    // Ensure we are paused first: if not, pause
    const initialAria = await threadPage.getToggleAriaPressed();
    if (initialAria === 'true') {
      await threadPage.clickToggle(); // pause
      await page.waitForTimeout(60);
    }

    // Confirm paused - button should indicate Play Animation
    let pausedText = await threadPage.getToggleButtonText();
    expect(pausedText).toBe('Play Animation');

    // Now click to resume
    await threadPage.clickToggle();
    await page.waitForTimeout(60); // allow DOM update for button
    const resumedText = await threadPage.getToggleButtonText();
    expect(resumedText).toBe('Pause Animation');

    const resumedAria = await threadPage.getToggleAriaPressed();
    expect(resumedAria).toBe('true');

    // Observe canvas frames to ensure animation has resumed (frames should change across time)
    const beforeResume = await threadPage.getCanvasFingerprint();
    await page.waitForTimeout(250);
    const afterResume = await threadPage.getCanvasFingerprint();
    expect(afterResume).not.toBe(beforeResume);

    // Assert no runtime errors during resume
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('RegenerateThread event: regenerating while paused changes visual pattern without introducing errors', async ({ page }) => {
    // Purpose: Validate transition S0_Idle -> S0_Idle on RegenerateThread event: threads[] are replaced.
    // To make visual comparison deterministic, pause the animation, capture canvas, click regen, then capture again.
    const threadPage = new ThreadPage(page);
    await threadPage.goto();

    // Ensure paused: if running, pause via toggle
    const initialAria = await threadPage.getToggleAriaPressed();
    if (initialAria === 'true') {
      await threadPage.clickToggle(); // pause
      await page.waitForTimeout(80);
    }

    // Sanity: button should show Play Animation
    const pausedText = await threadPage.getToggleButtonText();
    expect(pausedText).toBe('Play Animation');

    // Capture canvas fingerprint before regen
    const beforeRegen = await threadPage.getCanvasFingerprint();

    // Click regen button to regenerate threads
    await threadPage.clickRegen();
    // Allow a short delay for the regeneration code to execute and redraw
    await page.waitForTimeout(120);

    // Capture after regen
    const afterRegen = await threadPage.getCanvasFingerprint();

    // Because regen replaces threads with new random phases, the static canvas (paused) should differ
    // Assert that at least a majority of the fingerprint changed (simple inequality check)
    expect(afterRegen).not.toBe(beforeRegen);

    // Reinforce: toggling regen multiple times should not cause runtime errors
    for (let i = 0; i < 3; i++) {
      await threadPage.clickRegen();
      await page.waitForTimeout(50);
    }

    // Ensure no runtime errors were recorded during regeneration bursts
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Edge cases: multiple rapid toggles and regen clicks do not produce uncaught exceptions', async ({ page }) => {
    // Purpose: stress controls and ensure robust handling (edge case scenario)
    const threadPage = new ThreadPage(page);
    await threadPage.goto();

    // Rapidly toggle animation state a few times
    for (let i = 0; i < 6; i++) {
      await threadPage.clickToggle();
      // very short delay to simulate user clicking quickly
      await page.waitForTimeout(40);
    }

    // Rapidly click regen many times
    for (let i = 0; i < 8; i++) {
      await threadPage.clickRegen();
      await page.waitForTimeout(30);
    }

    // Final small wait to allow any asynchronous issues to surface
    await page.waitForTimeout(200);

    // Collect and assert that there were no page errors or console errors produced by rapid interactions
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Accessibility & attributes: control aria-labels and roles remain intact', async ({ page }) => {
    // Purpose: validate attributes described in FSM (aria-labels and roles)
    const threadPage = new ThreadPage(page);
    await threadPage.goto();

    const toggle = await threadPage.getToggleButton();
    const regen = await threadPage.getRegenButton();

    const toggleAriaLabel = await toggle.getAttribute('aria-label');
    expect(toggleAriaLabel).toBe('Pause or resume thread animation');

    const regenAriaLabel = await regen.getAttribute('aria-label');
    expect(regenAriaLabel).toBe('Regenerate thread pattern for a new visual arrangement');

    // Ensure main container has expected role and label
    const mainRole = await page.locator('.container').getAttribute('role');
    const mainAriaLabel = await page.locator('.container').getAttribute('aria-label');
    expect(mainRole).toBe('main');
    expect(mainAriaLabel).toContain('Thread Concept Visual');

    // No runtime errors should appear for attribute reads
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});