import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f9af53-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object encapsulating common interactions and queries for the app
class HashAppPage {
  constructor(page) {
    this.page = page;
  }

  // Click the Generate Next button
  async clickGenerate() {
    await this.page.click('#generateBtn');
  }

  // Trigger space key (keyboard shortcut)
  async pressSpace() {
    await this.page.keyboard.press('Space');
  }

  // Read whether the global isAnimating flag is true
  async isAnimating() {
    return await this.page.evaluate(() => !!window.isAnimating);
  }

  // Read the current idx used by the app (index into examples)
  async getIdx() {
    return await this.page.evaluate(() => typeof idx === 'number' ? idx : -999);
  }

  // Wait until the hex output has reached (or exceeded) 64 hex characters (full SHA-256)
  async waitForFullHex(timeout = 5000) {
    await this.page.waitForFunction(
      () => {
        const el = document.getElementById('hexOutput');
        if (!el) return false;
        return el.textContent && el.textContent.replace(/\s/g, '').length >= 64;
      },
      { timeout }
    );
  }

  // Wait until at least one tile has the 'show' class (digest reveal started)
  async waitForTilesToShow(minCount = 1, timeout = 5000) {
    await this.page.waitForFunction(
      (min) => {
        const tiles = Array.from(document.querySelectorAll('.tile'));
        return tiles.filter(t => t.classList.contains('show')).length >= min;
      },
      minCount,
      { timeout }
    );
  }

  // Get number of tiles that currently have 'show'
  async countShownTiles() {
    return await this.page.evaluate(() => Array.from(document.querySelectorAll('.tile.show')).length);
  }

  // Get total tile count rendered
  async totalTiles() {
    return await this.page.evaluate(() => document.querySelectorAll('.tile').length);
  }

  // Get the hex output text content
  async getHexOutput() {
    return await this.page.$eval('#hexOutput', el => el.textContent || '');
  }

  // Get generated message text from chips (reconstruct)
  async getMessageText() {
    return await this.page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('#messageDisplay .chip'));
      if (!chips.length) return '';
      return chips.map(c => c.textContent === '␣' ? ' ' : c.textContent).join('');
    });
  }

  // Check whether avalanche hint is present under .input-card (text includes 'Avalanche')
  async avalancheHintPresent() {
    return await this.page.evaluate(() => {
      const hint = document.querySelector('.input-card .note:not([id])');
      return hint ? /Avalanche/i.test(hint.textContent || '') : false;
    });
  }

  // Get the generate button's disabled state
  async isGenerateDisabled() {
    return await this.page.$eval('#generateBtn', b => b.disabled === true);
  }

  // Get the core label text
  async getCoreLabel() {
    return await this.page.$eval('#coreLabel', el => el.textContent || '');
  }

  // Return list of tile data-i attributes
  async getTileIndices() {
    return await this.page.evaluate(() => Array.from(document.querySelectorAll('.tile')).map(t => t.dataset.i));
  }
}

// Shared setup for console and page error collection
test.describe('Hash Functions — Visual Exploration (FSM & UI)', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console.error messages
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // swallow any errors while collecting console messages
      }
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // After each test ensure we did not encounter fatal runtime errors
    // We assert there are no uncaught page errors and no console.error messages.
    // This ensures the app ran without ReferenceError / SyntaxError / TypeError surfacing.
    expect(pageErrors.length, 'No uncaught page errors (pageerror events)').toBe(0);
    expect(consoleErrors.length, 'No console.error messages emitted during test').toBe(0);
  });

  test('Initial load triggers init() and produces the first digest (S0_Idle -> S1_Animating -> S2_DigestRevealed -> S0_Idle)', async ({ page }) => {
    // This test validates that on DOMContentLoaded the init() runs, which calls generateNext()
    // The full lifecycle should produce message chips, animate tiles, reveal a 64-char hex digest,
    // and leave the UI ready for the next input (generateBtn re-enabled, isAnimating false).

    const app = new HashAppPage(page);

    // Wait for the first digest reveal to complete (hex reveals gradually; wait until full)
    await app.waitForFullHex(7000);

    // Ensure message chips are present and reconstruct to a non-empty message
    const message = await app.getMessageText();
    expect(message.length).toBeGreaterThan(0);

    // Ensure tiles were created (32) and many of them have been shown
    const total = await app.totalTiles();
    expect(total).toBe(32); // per SHA-256 32 bytes -> 32 tiles

    await app.waitForTilesToShow(8, 5000); // at least some tiles should have appeared
    const shown = await app.countShownTiles();
    expect(shown).toBeGreaterThanOrEqual(1);

    // Hex output should end up as a 64-character hex string (256-bit digest)
    const hex = await app.getHexOutput();
    // strip whitespace and validate length
    const cleaned = hex.replace(/\s/g, '');
    expect(cleaned.length).toBeGreaterThanOrEqual(64);
    expect(/^[0-9a-fA-F]+$/.test(cleaned)).toBeTruthy();

    // isAnimating should now be false (back to S0_Idle, ready for next)
    const anim = await app.isAnimating();
    expect(anim).toBe(false);

    // Generate button should be enabled
    const disabled = await app.isGenerateDisabled();
    expect(disabled).toBe(false);

    // Core label should be 'SHA-256'
    const coreLabel = await app.getCoreLabel();
    expect(coreLabel).toMatch(/SHA-256/i);
  });

  test('Clicking Generate Next triggers an animation and digest reveal; isAnimating toggles properly', async ({ page }) => {
    // Validates FSM transition on user "GenerateNext" click.
    // We click Generate Next, ensure isAnimating becomes true immediately,
    // and after the flow completes, tiles are revealed and isAnimating returns to false.

    const app = new HashAppPage(page);

    // Wait for initial automatic generation to finish first (ensures stable starting state)
    await app.waitForFullHex(7000);

    // Record current index
    const beforeIdx = await app.getIdx();

    // Click Generate Next and immediately observe isAnimating
    await app.clickGenerate();

    // Immediately after clicking, the page should have set isAnimating = true
    // Use a short wait-for to allow microtask to set the flag
    await page.waitForFunction(() => window.isAnimating === true, { timeout: 1000 });

    const animDuring = await app.isAnimating();
    expect(animDuring).toBe(true);

    // Wait until the digest is revealed (full hex)
    await app.waitForFullHex(7000);
    await app.waitForTilesToShow(16, 7000); // expect many tiles visible after reveal

    // After reveal, isAnimating should be false and idx should have advanced by 1 mod examples length
    await page.waitForFunction(() => window.isAnimating === false, { timeout: 2000 });
    const animAfter = await app.isAnimating();
    expect(animAfter).toBe(false);

    const afterIdx = await app.getIdx();
    // idx should have incremented by 1 (modulo behavior)
    expect(afterIdx).toBe((beforeIdx + 1) % 8);
  });

  test('Space keypress triggers generate (keyboard shortcut) and behaves like clicking the button', async ({ page }) => {
    // Validates the SpaceKeyPress event handler that should trigger generateBtn.click()

    const app = new HashAppPage(page);

    // Wait for initial generation to settle
    await app.waitForFullHex(7000);

    const beforeIdx = await app.getIdx();

    // Press Space to trigger next generation
    await app.pressSpace();

    // isAnimating should be true quickly after
    await page.waitForFunction(() => window.isAnimating === true, { timeout: 1000 });
    expect(await app.isAnimating()).toBe(true);

    // Wait for digest to be revealed
    await app.waitForFullHex(8000);
    await app.waitForTilesToShow(24, 8000);

    // After completion, index should have advanced
    await page.waitForFunction(() => window.isAnimating === false, { timeout: 2000 });
    const afterIdx = await app.getIdx();
    expect(afterIdx).toBe((beforeIdx + 1) % 8);
  });

  test('Avalanche hint appears for similar successive examples and then fades (visual hint handling)', async ({ page }) => {
    // This verifies that when moving from an example to a highly similar next example,
    // the UI temporarily shows an avalanche hint note which is later removed.

    const app = new HashAppPage(page);

    // Wait for initial run (idx should be 0 after automatic init)
    await app.waitForFullHex(7000);
    const idx0 = await app.getIdx();
    expect(idx0).toBeGreaterThanOrEqual(0);

    // Click generate to move to the next example which, per examples list, is similar for idx 0 -> 1
    await app.clickGenerate();

    // Wait for digest to reveal for the second example
    await app.waitForFullHex(7000);

    // Avalanche hint should be present shortly after reveal
    const hintDetected = await page.waitForFunction(() => {
      const hint = document.querySelector('.input-card .note:not([id])');
      return hint && /Avalanche/i.test((hint.textContent || ''));
    }, { timeout: 3000 }).then(() => true).catch(() => false);

    expect(hintDetected).toBe(true);

    // The hint should be removed after its fade-out (app schedules removal after ~2700ms)
    // Wait a little longer to assert it disappears
    await page.waitForTimeout(3000);
    const hintStillPresent = await app.avalancheHintPresent();
    expect(hintStillPresent).toBe(false);
  });

  test('Rapid repeated clicks do not start concurrent animations (debounce behavior)', async ({ page }) => {
    // This tests the guard in generateNext that prevents starting a new animation
    // if isAnimating is already true. We click repeatedly and ensure only one advancement occurs.

    const app = new HashAppPage(page);

    // Wait for initial generation
    await app.waitForFullHex(7000);
    const startIdx = await app.getIdx();

    // Rapidly click the button multiple times
    await Promise.all([
      page.click('#generateBtn'),
      page.click('#generateBtn'),
      page.click('#generateBtn'),
      page.click('#generateBtn')
    ]);

    // Immediately the page should have set isAnimating = true
    await page.waitForFunction(() => window.isAnimating === true, { timeout: 1000 });

    // Wait for the digest reveal to complete
    await app.waitForFullHex(8000);
    await app.waitForTilesToShow(20, 8000);

    // After it completes, idx should only have advanced by 1 (not multiple times)
    await page.waitForFunction(() => window.isAnimating === false, { timeout: 2000 });
    const endIdx = await app.getIdx();
    expect(endIdx).toBe((startIdx + 1) % 8);
  });

  test('Tiles have correct data-i indices and content format after reveal', async ({ page }) => {
    // Ensures tile elements have dataset indices 0..31 and each tile displays a two-character hex byte.
    const app = new HashAppPage(page);

    // Wait for a full reveal
    await app.waitForFullHex(7000);
    await app.waitForTilesToShow(32, 7000);

    const indices = await app.getTileIndices();
    // Verify indices length and that they are '0'..'31'
    expect(indices.length).toBe(32);
    const expected = Array.from({ length: 32 }, (_, i) => String(i));
    expect(indices).toEqual(expected);

    // Verify tile contents are two hex characters
    const tilesValid = await page.evaluate(() => {
      const tiles = Array.from(document.querySelectorAll('.tile'));
      return tiles.every(t => {
        const txt = (t.textContent || '').trim();
        return /^[0-9A-Fa-f]{2}$/.test(txt);
      });
    });
    expect(tilesValid).toBe(true);
  });

  test('No runtime ReferenceError / SyntaxError / TypeError surfaced during interactions (observed via pageerror/console.error)', async ({ page }) => {
    // This test purposefully exercises a few interactions and then asserts no pageerror/console.error events occurred.
    const app = new HashAppPage(page);

    // Perform a couple of interactions: click, space, click
    await app.waitForFullHex(7000);
    await app.clickGenerate();
    await app.waitForFullHex(7000);
    await app.pressSpace();
    await app.waitForFullHex(7000);

    // The afterEach hook will assert that pageErrors and consoleErrors arrays are empty.
    // Here we do an explicit quick-check as well to provide immediate failure context if something happened.
    // (Note: The actual assertion is done in afterEach to keep consistent reporting)
    // We still assert now to fail sooner if errors exist.
    // Access the arrays via page events; because we collected them at top-level in the describe scope,
    // they are available and will be asserted in afterEach.
    expect(Array.isArray(pageErrors)).toBeTruthy();
    expect(Array.isArray(consoleErrors)).toBeTruthy();
  });
});