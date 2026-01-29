import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html';
const URL = `${BASE}/f1f78c71-fa77-11f0-a6a1-c765f41a13c7.html`;

/**
 * Page object encapsulating interactions and queries for the Semaphore demo.
 */
class SemaphorePage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(URL, { waitUntil: 'load' });
    // wait for the semaphore svg to be present - application populates and manipulates it on load
    await this.page.waitForSelector('#sema');
  }

  async getToggle() {
    return this.page.locator('#toggle');
  }
  async clickToggle() {
    await this.getToggle().click();
  }
  async getReveal() {
    return this.page.locator('#reveal');
  }
  async clickReveal() {
    await this.getReveal().click();
  }
  async getMast() {
    return this.page.locator('#mast');
  }
  async clickMast() {
    await this.getMast().click();
  }
  async decodedText() {
    return this.page.locator('#decodedText');
  }
  async decodedContainer() {
    return this.page.locator('#decoded');
  }
  async message() {
    return this.page.locator('#message');
  }
  async messageText() {
    return this.page.locator('#messageText');
  }
  async overlay() {
    return this.page.locator('.overlay');
  }
  async leftArmTransform() {
    return this.page.locator('#leftArm').getAttribute('transform');
  }
  async rightArmTransform() {
    return this.page.locator('#rightArm').getAttribute('transform');
  }
  async leftFlagHasMoving() {
    return this.page.evaluate(() => {
      const flag = document.querySelector('#leftArm .flag');
      return flag ? flag.classList.contains('moving') : false;
    });
  }
  async rightFlagHasMoving() {
    return this.page.evaluate(() => {
      const flag = document.querySelector('#rightArm .flag');
      return flag ? flag.classList.contains('moving') : false;
    });
  }

  // wait for any flag to acquire the 'moving' class (indicates tween/animation in progress)
  async waitForMotion(timeout = 2000) {
    await this.page.waitForFunction(() => {
      const l = document.querySelector('#leftArm .flag');
      const r = document.querySelector('#rightArm .flag');
      return (l && l.classList.contains('moving')) || (r && r.classList.contains('moving'));
    }, { timeout });
  }

  // wait until moving classes are removed
  async waitForNoMotion(timeout = 2000) {
    await this.page.waitForFunction(() => {
      const l = document.querySelector('#leftArm .flag');
      const r = document.querySelector('#rightArm .flag');
      const lm = l ? l.classList.contains('moving') : false;
      const rm = r ? r.classList.contains('moving') : false;
      return !lm && !rm;
    }, { timeout });
  }
}

test.describe('Semaphore — FSM and Interactive behavior', () => {
  // collect console and page errors per test to assert runtime stability / surface errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // collect console messages (info/warn/error) so tests can assert what happened at runtime
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // collect unhandled page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test.describe('Initial load and Idle state (S0_Idle)', () => {
    test('loads the page and initializes to idle: transforms applied and placeholder shown', async ({ page }) => {
      // Arrange
      const app = new SemaphorePage(page);
      await app.goto();

      // Assert: ensure no runtime page errors occurred during load
      expect(pageErrors.length, `Expected no page errors but found: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

      // The decoded placeholder should be set to the initial placeholder
      await expect(app.decodedText()).toHaveText('— — —');

      // The overlay should start hidden (aria-hidden = "true")
      await expect(app.overlay()).toHaveAttribute('aria-hidden', 'true');

      // The toggle button should start in non-playing state (aria-pressed="false") and say "Play"
      await expect(app.getToggle()).toHaveAttribute('aria-pressed', 'false');
      await expect(app.getToggle()).toHaveText(/Play/);

      // The SVG arm transforms should include the pivot coordinates set by the script:
      // left pivot at "-120 -8", right pivot at "0 -8".
      const leftTransform = await app.leftArmTransform();
      const rightTransform = await app.rightArmTransform();
      expect(leftTransform, `left transform should include pivot "-120 -8", got: ${leftTransform}`).toContain('-120 -8');
      expect(rightTransform, `right transform should include pivot "0 -8", got: ${rightTransform}`).toContain('0 -8');

      // Also ensure no console errors were emitted
      const errors = consoleMessages.filter(m => m.type === 'error');
      expect(errors.length, `console errors detected: ${JSON.stringify(errors)}`).toBe(0);
    });

    test('idle pulse subtly changes transforms over time (wobble present)', async ({ page }) => {
      const app = new SemaphorePage(page);
      await app.goto();

      // capture the initial transform snapshot
      const initialLeft = await app.leftArmTransform();
      // wait a short while for the idlePulse animation to apply wobble
      await page.waitForTimeout(200);
      const laterLeft = await app.leftArmTransform();

      // They should not be identical (idle wobble modifies the rotation values slightly)
      // This validates the "Start in a slow idle animation" entry action behavior.
      expect(initialLeft).not.toBeNull();
      expect(laterLeft).not.toBeNull();
      // It's sufficient that they differ as floats should change
      expect(initialLeft === laterLeft).toBe(false);
    });
  });

  test.describe('Play/Pause transitions (S0_Idle <-> S1_Playing)', () => {
    test('Toggle Play: enters Playing state and schedules animation (scheduleNext invoked via visible motion)', async ({ page }) => {
      const app = new SemaphorePage(page);
      await app.goto();

      // Precondition: ensure we start paused
      await expect(app.getToggle()).toHaveAttribute('aria-pressed', 'false');

      // Act: click Play
      await app.clickToggle();

      // Immediately expect toggled attributes to reflect playing state
      await expect(app.getToggle()).toHaveAttribute('aria-pressed', 'true');
      await expect(app.getToggle()).toHaveText(/Pause/);

      // Waiting for RAF-driven tween to set 'moving' class on a flag (indicates scheduleNext/step running)
      await app.waitForMotion(2000);

      // Assert that at least one flag shows the visual 'moving' class (glow while motion happening)
      const leftMoving = await app.leftFlagHasMoving();
      const rightMoving = await app.rightFlagHasMoving();
      expect(leftMoving || rightMoving).toBe(true);
    });

    test('Toggle Pause: leaving Playing state cancels animation and removes moving glows', async ({ page }) => {
      const app = new SemaphorePage(page);
      await app.goto();

      // Start playing first
      await app.clickToggle();
      await app.waitForMotion(2000);

      // Act: click toggle to pause
      await app.clickToggle();

      // The toggle should now represent paused state
      await expect(app.getToggle()).toHaveAttribute('aria-pressed', 'false');
      await expect(app.getToggle()).toHaveText(/Play/);

      // The script attempts to cancel RAF and remove moving glows; wait and verify no motion classes remain
      await app.waitForNoMotion(2000);

      const leftMoving = await app.leftFlagHasMoving();
      const rightMoving = await app.rightFlagHasMoving();
      expect(leftMoving || rightMoving).toBe(false);
    });

    test('Play then Pause roundtrip should still leave decoded placeholder intact', async ({ page }) => {
      const app = new SemaphorePage(page);
      await app.goto();

      // Ensure initial placeholder
      await expect(app.decodedText()).toHaveText('— — —');

      // Play then pause
      await app.clickToggle();
      await app.waitForMotion(2000);
      await app.clickToggle();
      await app.waitForNoMotion(2000);

      // Placeholder should still be present or have shown letters during play; ensure it remains a short text
      const text = await app.decodedText().innerText();
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThanOrEqual(1);
      expect(text.length).toBeLessThanOrEqual(9);
    });
  });

  test.describe('Reveal decoded message transitions (S1_Playing <-> S2_Revealed)', () => {
    test('Reveal when paused: shows overlay with decoded word and toggles attributes', async ({ page }) => {
      const app = new SemaphorePage(page);
      await app.goto();

      // Ensure paused
      await expect(app.getToggle()).toHaveAttribute('aria-pressed', 'false');

      // Click reveal
      await app.clickReveal();

      // reveal button aria-pressed must be true
      await expect(app.getReveal()).toHaveAttribute('aria-pressed', 'true');

      // overlay should be exposed (aria-hidden = "false")
      await expect(app.overlay()).toHaveAttribute('aria-hidden', 'false');

      // message element should get the .show class and contain the decoded word 'SEMAPHORE'
      await expect(app.message()).toHaveClass(/show/);
      await expect(app.messageText()).toHaveText('SEMAPHORE');

      // Click reveal again to hide
      await app.clickReveal();

      // Now overlay should be hidden again and message class removed
      await expect(app.getReveal()).toHaveAttribute('aria-pressed', 'false');
      await expect(app.overlay()).toHaveAttribute('aria-hidden', 'true');
      const classes = await app.message().getAttribute('class');
      expect(classes).not.toContain('show');
    });

    test('Reveal while playing: message shows but playing state persists (no automatic pause)', async ({ page }) => {
      const app = new SemaphorePage(page);
      await app.goto();

      // Start playing
      await app.clickToggle();
      await app.waitForMotion(2000);

      // Click reveal while playing
      await app.clickReveal();

      // The message should be shown
      await expect(app.overlay()).toHaveAttribute('aria-hidden', 'false');
      await expect(app.message()).toHaveClass(/show/);
      await expect(app.messageText()).toHaveText('SEMAPHORE');

      // The playing toggle should remain in playing state (script does not modify 'playing' on reveal)
      await expect(app.getToggle()).toHaveAttribute('aria-pressed', 'true');

      // Close reveal
      await app.clickReveal();
      await expect(app.overlay()).toHaveAttribute('aria-hidden', 'true');

      // Ensure playing is still true after hiding the message
      await expect(app.getToggle()).toHaveAttribute('aria-pressed', 'true');

      // cleanup: pause for further tests
      await app.clickToggle();
      await app.waitForNoMotion(2000);
    });
  });

  test.describe('Mast click event (ClickMast)', () => {
    test('Clicking the mast briefly highlights the current letter and then removes highlight', async ({ page }) => {
      const app = new SemaphorePage(page);
      await app.goto();

      // Determine current decoded text before clicking mast. The initial placeholder is '— — —'
      const before = (await app.decodedText().innerText()).trim();

      // Click the mast; this should immediately show the most recent letter and add 'active' class to decoded
      await app.clickMast();

      // The decoded container should have 'active' class briefly
      await expect(app.decodedContainer()).toHaveClass(/active/);

      // decodedText should now be a single letter from the sequence "SEMAPHORE"
      const after = (await app.decodedText().innerText()).trim();
      expect(after.length).toBeGreaterThanOrEqual(1);
      expect('SEMAPHORE'.includes(after)).toBe(true);

      // After roughly 800ms the script removes the 'active' class - wait and assert removal
      await page.waitForTimeout(900);
      const classes = await app.decodedContainer().getAttribute('class');
      expect(classes).not.toMatch(/\bactive\b/);
    });
  });

  test.describe('Runtime observations and edge cases', () => {
    test('No unexpected runtime exceptions (pageerror) and no console.error messages during interaction sequences', async ({ page }) => {
      const app = new SemaphorePage(page);
      await app.goto();

      // perform a few interactions to exercise code paths
      await app.clickToggle(); // play
      await app.waitForMotion(2000);
      await app.clickMast();
      await page.waitForTimeout(100);
      await app.clickReveal(); // show overlay while playing
      await page.waitForTimeout(100);
      await app.clickReveal(); // hide overlay
      await app.clickToggle(); // pause
      await app.waitForNoMotion(2000);

      // Now assert that no page errors were captured
      expect(pageErrors.length, `page errors detected: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

      // Ensure there are no console.error messages
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `console.error messages detected: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });

    test('Reveal toggling idempotency and correctness on repeated clicks (edge case)', async ({ page }) => {
      const app = new SemaphorePage(page);
      await app.goto();

      // Click reveal a few times in quick succession
      await app.clickReveal();
      await page.waitForTimeout(50);
      await app.clickReveal();
      await page.waitForTimeout(50);
      await app.clickReveal();
      await page.waitForTimeout(100);

      // After an odd number of toggles (3), the overlay should be visible
      await expect(app.overlay()).toHaveAttribute('aria-hidden', 'false');
      await expect(app.messageText()).toHaveText('SEMAPHORE');

      // Close it
      await app.clickReveal();
      await expect(app.overlay()).toHaveAttribute('aria-hidden', 'true');
    });
  });
});