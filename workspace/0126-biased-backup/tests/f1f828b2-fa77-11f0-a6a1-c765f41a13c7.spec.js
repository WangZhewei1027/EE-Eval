import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f828b2-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object model for the visual stage page
class StagePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.stage = page.locator('#stage');
    this.replay = page.locator('#replay');
    this.toggle = page.locator('#toggleInfo');
    this.info = page.locator('#info');
    this.certificate = page.locator('#certificate');
    this.lock = page.locator('#lock');
    this.clientPacket = page.locator('#clientPacket');
    this.serverPacket = page.locator('#serverPacket');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Returns true if stage has 'play' class
  async isPlaying() {
    return await this.page.evaluate(() => {
      const s = document.getElementById('stage');
      return s && s.classList.contains('play');
    });
  }

  // Click the replay button
  async clickReplay() {
    await this.replay.click();
  }

  // Click the toggle info button
  async clickToggleInfo() {
    await this.toggle.click();
  }

  // Press a key while focused on a selector
  async pressKeyOn(locator, key) {
    await locator.focus();
    await this.page.keyboard.press(key);
  }

  // Returns true if info panel visible (class 'visible' present)
  async isInfoVisible() {
    return await this.page.evaluate(() => {
      const info = document.getElementById('info');
      return info && info.classList.contains('visible');
    });
  }

  // Returns current aria-hidden value of info as boolean
  async infoAriaHidden() {
    return await this.page.evaluate(() => {
      const info = document.getElementById('info');
      return info ? info.getAttribute('aria-hidden') : null;
    });
  }

  // Wait for stage to become playing
  async waitForPlay(timeout = 3000) {
    await this.page.waitForFunction(() => {
      const s = document.getElementById('stage');
      return s && s.classList.contains('play');
    }, { timeout });
  }

  // Wait for stage to NOT be playing (no 'play' class)
  async waitForNotPlay(timeout = 500) {
    await this.page.waitForFunction(() => {
      const s = document.getElementById('stage');
      return s && !s.classList.contains('play');
    }, { timeout });
  }

  // Wait for lock visual update: expects path stroke changed to green-ish '#38d9a9'
  async waitForLockVisual(timeout = 4000) {
    await this.page.waitForFunction(() => {
      const lock = document.getElementById('lock');
      if (!lock) return false;
      const sv = lock.querySelector('svg');
      if (!sv) return false;
      const p = sv.querySelector('path');
      if (!p) return false;
      return p.getAttribute('stroke') === '#38d9a9';
    }, { timeout });
  }
}

test.describe('HTTPS visual explainer - FSM driven interactions', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and errors emitted by the page
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') consoleErrors.push(text);
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // nothing to teardown globally; listeners are bound to page and removed when page closes
  });

  test('Initial load triggers Idle -> Playing (entry action playAnimation)', async ({ page }) => {
    // This test verifies that the page auto-plays the animation on load as described in the FSM entry action.
    const sp = new StagePage(page);
    await sp.goto();

    // Wait for the stage to become playing (auto-play scheduled at load + 600ms + small delay)
    await sp.waitForPlay(3000);
    expect(await sp.isPlaying()).toBe(true);

    // Basic DOM checks to ensure components exist
    await expect(sp.replay).toBeVisible();
    await expect(sp.toggle).toBeVisible();
    await expect(sp.info).toBeHidden(); // initially info should be hidden
    await expect(sp.clientPacket).toBeVisible();
    await expect(sp.serverPacket).toBeVisible();
    await expect(sp.certificate).toBeVisible();
    await expect(sp.lock).toBeVisible();

    // Ensure no uncaught page errors occurred during initial load
    expect(pageErrors.length, `No uncaught page errors expected on load, got: ${pageErrors.map(e=>String(e)).join('; ')}`).toBe(0);

    // Ensure console did not emit error-level logs
    expect(consoleErrors.length, `No console.error expected on load, got: ${consoleErrors.join('; ')}`).toBe(0);
  });

  test('Replay button restarts animation (S0 -> S1 and S1 -> S0 transitions)', async ({ page }) => {
    // This test simulates clicking the Replay button while animation is playing and verifies
    // the transient removal and re-addition of the .play class as the playAnimation() toggles it.
    const sp = new StagePage(page);
    await sp.goto();

    // Ensure animation is playing first
    await sp.waitForPlay(3000);
    expect(await sp.isPlaying()).toBe(true);

    // Click replay and verify the stage briefly loses 'play' and then regains it (restart)
    await sp.clickReplay();

    // Because playAnimation removes 'play' then re-adds it, we should observe NOT playing then playing
    // Wait for NOT play (short timeout)
    await sp.waitForNotPlay(500);
    expect(await sp.isPlaying()).toBe(false);

    // Then wait for it to be playing again
    await sp.waitForPlay(1500);
    expect(await sp.isPlaying()).toBe(true);

    // Confirm no page-level errors produced by clicking replay
    expect(pageErrors.length, `No page errors expected after replay click`).toBe(0);
    expect(consoleErrors.length, `No console.error expected after replay click`).toBe(0);
  });

  test('Toggle Info shows and hides the details panel (S0 <-> S2 transitions) and accessibility via keyboard', async ({ page }) => {
    // This test validates the ToggleInfoClick event and the resulting info panel visibility and aria attribute changes.
    const sp = new StagePage(page);
    await sp.goto();

    // Ensure info panel starts hidden
    expect(await sp.isInfoVisible()).toBe(false);
    expect(await sp.infoAriaHidden()).toBe('true');

    // Click to show
    await sp.clickToggleInfo();
    // The info panel toggles 'visible' class and aria-hidden to false
    await page.waitForFunction(() => document.getElementById('info').classList.contains('visible'));
    expect(await sp.isInfoVisible()).toBe(true);
    expect(await sp.infoAriaHidden()).toBe('false');

    // Click again to hide
    await sp.clickToggleInfo();
    await page.waitForFunction(() => !document.getElementById('info').classList.contains('visible'));
    expect(await sp.isInfoVisible()).toBe(false);
    expect(await sp.infoAriaHidden()).toBe('true');

    // Keyboard accessibility: pressing Enter on the toggle should behave like click
    await sp.pressKeyOn(sp.toggle, 'Enter');
    await page.waitForFunction(() => document.getElementById('info').classList.contains('visible'));
    expect(await sp.isInfoVisible()).toBe(true);

    // Hide again to reset
    await sp.clickToggleInfo();
    await page.waitForFunction(() => !document.getElementById('info').classList.contains('visible'));

    // Confirm no uncaught errors during toggling via mouse/keyboard
    expect(pageErrors.length, `No page errors expected during toggling`).toBe(0);
    expect(consoleErrors.length, `No console.error expected during toggling`).toBe(0);
  });

  test('Replay button responds to keyboard (Enter) and lock updates after handshake completes', async ({ page }) => {
    // This test ensures keyboard activation of the replay control works and that the lock visual is updated
    // after the handshake sequence completes (the MutationObserver schedules updateLockVisual ~2200ms).
    const sp = new StagePage(page);
    await sp.goto();

    // Ensure playing initially
    await sp.waitForPlay(3000);
    expect(await sp.isPlaying()).toBe(true);

    // Trigger replay via Enter key
    await sp.pressKeyOn(sp.replay, 'Enter');

    // Confirm animation restart: removal then re-add
    await sp.waitForNotPlay(500);
    await sp.waitForPlay(1500);
    expect(await sp.isPlaying()).toBe(true);

    // Wait for lock visual update that is scheduled roughly 2200ms after .play is added
    await sp.waitForLockVisual(4000);

    // After update, inspect the lock svg path attributes to confirm update occurred
    const stroke = await page.evaluate(() => {
      const sv = document.getElementById('lock')?.querySelector('svg');
      const p = sv?.querySelector('path');
      return p ? p.getAttribute('stroke') : null;
    });
    expect(stroke).toBe('#38d9a9');

    // Ensure still no uncaught page errors
    expect(pageErrors.length, `No page errors expected during keyboard replay and lock update`).toBe(0);
    expect(consoleErrors.length, `No console.error expected during keyboard replay and lock update`).toBe(0);
  });

  test('Edge case: rapid repeated interactions should not throw runtime errors', async ({ page }) => {
    // This test performs rapid clicks and toggles to try to surface potential race conditions.
    const sp = new StagePage(page);
    await sp.goto();

    // Interleave rapid replay and toggle clicks
    for (let i = 0; i < 6; i++) {
      await Promise.all([
        sp.replay.click().catch(()=>{}), // catch in case of transient errors but we still assert later
        sp.toggle.click().catch(()=>{})
      ]);
    }

    // Give some time for any scheduled work (animations / MutationObserver) to run
    await page.waitForTimeout(1000);

    // Validate app still stable: stage exists, info exists
    await expect(sp.stage).toBeVisible();
    await expect(sp.info).toBeVisible(); // info might be visible depending on odd number of toggles - but control exists

    // Assert there were no uncaught page errors across these rapid interactions
    expect(pageErrors.length, `No uncaught page errors expected after rapid interactions: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

    // Check for console.error messages - if any exist, fail and include collected messages
    expect(consoleErrors.length, `No console.error expected after rapid interactions`).toBe(0);
  });

  test('Sanity checks for expected event handler evidence and attributes', async ({ page }) => {
    // This test verifies that the buttons have the expected attributes (title) and that keyboard handlers are present (by pressing Enter)
    const sp = new StagePage(page);
    await sp.goto();

    // Check attributes from FSM components
    const replayTitle = await sp.replay.getAttribute('title');
    const toggleTitle = await sp.toggle.getAttribute('title');
    expect(replayTitle).toBe('Replay the TLS handshake animation');
    expect(toggleTitle).toBe('Show or hide short explanation');

    // Keyboard activation on replay should not throw and should restart animation
    await sp.pressKeyOn(sp.replay, 'Enter');
    await sp.waitForNotPlay(500);
    await sp.waitForPlay(1500);
    expect(await sp.isPlaying()).toBe(true);

    // Ensure no page errors or console errors were observed
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observe console output and report if any runtime errors occurred (final verification)', async ({ page }) => {
    // This final test is dedicated to gathering console and pageerror evidence. It ensures we observe console/page errors
    // but does not attempt to fix or patch the app. We only assert the observed arrays for reporting.
    const sp = new StagePage(page);
    await sp.goto();

    // Perform a normal click and toggle to generate possible logs
    await sp.clickReplay();
    await sp.clickToggleInfo();

    // give time for any async ops to surface
    await page.waitForTimeout(1200);

    // Build summary (embedded in assertions)
    // We expect zero uncaught page errors and no console.error by design; if any exist they will fail the test and show the messages.
    expect(pageErrors.length, `Expected no uncaught page errors, got ${pageErrors.length}: ${pageErrors.map(e=>String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error logs, got ${consoleErrors.length}: ${consoleErrors.join('; ')}`).toBe(0);

    // Also assert that some normal console messages (if any) were captured as info - but not required.
    // This assertion is permissive: it only ensures our consoleMessages array is defined and is an array.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});