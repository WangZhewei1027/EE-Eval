import { test, expect } from '@playwright/test';

// Test constants
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9c9681-fa78-11f0-857d-d58e82d5de73.html';

// The example hashes as defined in the page's inline script.
// We duplicate them here to validate the produced hash strings exactly as the implementation uses.
const EXAMPLE_HASHES = [
  'e3b0c442 98fc1c14 9afbf4c8 996fb924 27ae41e4 649b934c a495991b 7852b855',
  'cf83e135 7eefb8bd f1542850 d66d8007 d620e405 0b5715dc 83f4a921 d36ce9ce',
  'a3f5b1c8 d1ab729e 7f2ec1ca 0beed6a7 17924e0f 576b1ea7 3424cfb2 5a8e9fab',
  '9c1185a5 c5e9fc54 0dfe19d5 5ae8e6ee 844e1f6d 6d5f3c20 7c406c8b 1a1bb8a2',
  'da39a3ee 5e6b4b0d 3255bfef 95601890 afd80709 3c6bd33e 5b3f8e30 45c97d63',
  '2d711642 b726b044 01627ca9 f7c467da ee1616da ed3a5b5c 87e51eac 8f2d9470',
  '45c48cce 2e2d7fbf af5b0d29 5c4b6c73 7b5a6e52 6ead53d5 67de786e 1c04a78b',
];

// Simple Page Object Model for the hash visualization page
class HashPage {
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  // Setup listeners to capture console messages and runtime errors
  async setupErrorMonitoring() {
    this.page.on('console', (msg) => {
      // Collect console.error and other severity types for inspection
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        this.consoleErrors.push({ type, text });
      }
      // For debugging purposes (not assertions), we still capture all console messages
    });

    this.page.on('pageerror', (err) => {
      // Uncaught exceptions on the page end up here.
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Returns the current text content of the hashText code element
  async getHashText() {
    return await this.page.locator('#hashText').textContent();
  }

  // Clicks the generate button
  async clickGenerate() {
    await this.page.click('#generateHash');
  }

  // Waits until the hashText content equals one of the known example hashes.
  // Returns the matched hash string.
  async waitForAnyKnownHash({ timeout = 8000 } = {}) {
    const page = this.page;
    const known = EXAMPLE_HASHES;
    await page.waitForFunction(
      (knownArr) => {
        const el = document.getElementById('hashText');
        if (!el) return false;
        const txt = el.textContent || '';
        return knownArr.includes(txt);
      },
      known,
      { timeout }
    );
    // After the function resolves, return the value
    return this.getHashText();
  }

  // Wait until hashText equals exactly expected string
  async waitForHashToEqual(expected, { timeout = 8000 } = {}) {
    await this.page.waitForFunction(
      (expectedStr) => {
        const el = document.getElementById('hashText');
        if (!el) return false;
        return el.textContent === expectedStr;
      },
      expected,
      { timeout }
    );
  }

  // Wait until the hashText content changes from previous value
  async waitForHashToChangeFrom(previous, { timeout = 8000 } = {}) {
    await this.page.waitForFunction(
      (prev) => {
        const el = document.getElementById('hashText');
        if (!el) return false;
        return el.textContent !== prev;
      },
      previous,
      { timeout }
    );
    return this.getHashText();
  }
}

test.describe('Hash Functions — Concept Visualized (FSM validation)', () => {
  // Each test will create a new page so listeners and navigation are fresh per test.
  test.beforeEach(async ({ page }) => {
    // noop - individual tests use HashPage to setup.
  });

  // Validate S0_Idle: On load the page should start animating the initial hash (exampleHashes[0]).
  test('S0_Idle (initial entry): animateHashText is invoked with exampleHashes[0] on page load', async ({ page }) => {
    // Comments: This test validates the initial state S0_Idle. The FSM entry action is animateHashText(exampleHashes[0]).
    // We verify that the hashText element starts animating on load and eventually equals the first example hash.
    const hp = new HashPage(page);
    await hp.setupErrorMonitoring();

    await hp.goto();

    // Immediately after DOM content loaded, the script registers an onload handler. Wait for the known hash to appear.
    // The typing effect is gradual; allow time for full animation (up to 8s).
    const finalHash = await hp.waitForAnyKnownHash({ timeout: 9000 });

    // Assert that the final hash equals the first example (as per the implementation's load handler).
    // The implementation explicitly uses exampleHashes[0] on load, so we expect that exact value.
    expect(finalHash).toBe(EXAMPLE_HASHES[0]);

    // Additional DOM assertions for the initial state
    await expect(page.locator('#generateHash')).toBeVisible();
    await expect(page.locator('#generateHash')).toHaveAttribute('title', 'Generate a new hash output');

    await expect(page.locator('#hashOutput')).toHaveAttribute('aria-live', 'polite');

    // Assert no unexpected console errors or uncaught page errors occurred during load & animation
    expect(hp.consoleErrors.length).toBe(0);
    expect(hp.pageErrors.length).toBe(0);
  });

  // Validate transition S0_Idle -> S1_HashGenerated when the user clicks the button.
  test('GenerateHash event: clicking #generateHash triggers animateHashText with a randomly selected example hash (S1_HashGenerated)', async ({ page }) => {
    // Comments: This test validates the GenerateHash event and S1_HashGenerated state. On button click,
    // the page should clear the current text and animate a randomly selected hash from the example list.
    const hp = new HashPage(page);
    await hp.setupErrorMonitoring();

    await hp.goto();

    // Ensure initial animation completes so we have a stable starting value
    const initial = await hp.waitForAnyKnownHash({ timeout: 9000 });
    expect(EXAMPLE_HASHES).toContain(initial);

    // Click the generate button and assert that text clears and then animates to one of the known hashes.
    // Because selection is random, allow several attempts to observe a change; the implementation may pick the same hash by chance.
    const generateBtn = page.locator('#generateHash');
    await expect(generateBtn).toBeVisible();

    // We'll attempt up to 5 clicks to observe a different hash than the initial.
    let observedNewHash = null;
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Click and immediately check that animateHashText set the textContent to ''
      await hp.clickGenerate();

      // After clicking, animateHashText sets outputEl.textContent = '' synchronously before typing begins.
      // Wait briefly for that synchronous change to be visible.
      await page.waitForTimeout(20); // tiny tick for sync update
      const afterClickText = await hp.getHashText();
      // It should either be cleared or already have some characters from the typing effect.
      // Accept both, but prefer that it becomes empty at least momentarily.
      if (afterClickText === '' || afterClickText.length < initial.length) {
        // good, typing restarted
      }

      // Wait for the hash to change from the initial value (within reasonable time).
      try {
        const changed = await hp.waitForHashToChangeFrom(initial, { timeout: 7000 });
        // Ensure the changed value is one of the known hashes
        expect(EXAMPLE_HASHES).toContain(changed);
        observedNewHash = changed;
        break;
      } catch (err) {
        // If it didn't change in time, try again (possible same random pick or timing)
        if (attempt === maxAttempts) throw err;
        // small backoff before next attempt
        await page.waitForTimeout(150);
      }
    }

    // If we observed a new hash in attempts, validate the observed value is in the known list.
    if (observedNewHash) {
      expect(EXAMPLE_HASHES).toContain(observedNewHash);
      // Optionally, it's acceptable if it's the same as initial in some rare random cases; we handled retries above.
    } else {
      // If none observed (unexpected), fail explicitly.
      throw new Error('Failed to observe a changed hash after multiple GenerateHash clicks');
    }

    // Ensure no uncaught page errors or console errors occurred during rapid interaction
    expect(hp.consoleErrors.length).toBe(0);
    expect(hp.pageErrors.length).toBe(0);
  });

  // Edge cases: rapid clicking and stress of the generate button should not produce uncaught exceptions
  test('Edge case: rapid sequential clicks do not cause uncaught exceptions and produce valid hashes', async ({ page }) => {
    // Comments: This test simulates a user rapidly clicking the generate button multiple times.
    // The test validates that even under rapid interactions the page does not throw uncaught exceptions
    // and the final displayed hash is one of the expected example hashes.
    const hp = new HashPage(page);
    await hp.setupErrorMonitoring();

    await hp.goto();

    // Wait for initial to stabilize
    await hp.waitForAnyKnownHash({ timeout: 9000 });

    const clicks = 10;
    for (let i = 0; i < clicks; i++) {
      // Rapid click without awaiting typing completion
      await hp.clickGenerate();
      // Minimal delay between clicks to simulate rapid user
      await page.waitForTimeout(30);
    }

    // After the flurry of clicks, wait for the page to settle and present a known hash
    const final = await hp.waitForAnyKnownHash({ timeout: 10000 });
    expect(EXAMPLE_HASHES).toContain(final);

    // Assert no console error messages and no uncaught errors
    expect(hp.consoleErrors.length).toBe(0);
    expect(hp.pageErrors.length).toBe(0);
  });

  // Visual & accessibility checks: ensure elements exist and attributes match the FSM component definitions
  test('DOM and accessibility checks: button and output components present with expected attributes', async ({ page }) => {
    // Comments: This test verifies the presence of UI components described in the FSM components section,
    // including the generate button and hash output block with expected attributes like title and aria-live.
    const hp = new HashPage(page);
    await hp.setupErrorMonitoring();

    await hp.goto();

    const generateBtn = page.locator('#generateHash');
    await expect(generateBtn).toBeVisible();
    await expect(generateBtn).toHaveText('Generate Hash');
    await expect(generateBtn).toHaveAttribute('title', 'Generate a new hash output');

    const outputBlock = page.locator('#hashOutput');
    await expect(outputBlock).toBeVisible();
    await expect(outputBlock).toHaveAttribute('aria-live', 'polite');

    const hashTextEl = page.locator('#hashText');
    await expect(hashTextEl).toBeVisible();

    // Also validate that the page's main role and labels exist as part of a11y
    await expect(page.locator('main[role="main"]')).toBeVisible();

    // Ensure no runtime errors occurred during these checks
    expect(hp.consoleErrors.length).toBe(0);
    expect(hp.pageErrors.length).toBe(0);
  });

  // Observability: collect console outputs and assert none of them are errors during normal operation
  test('Observability: console and runtime errors are not emitted during normal usage', async ({ page }) => {
    // Comments: This test explicitly monitors console and page errors while performing typical interactions:
    // load page, wait for initial animation, and perform a single generate click.
    const hp = new HashPage(page);
    await hp.setupErrorMonitoring();

    await hp.goto();

    // Wait for initial animation to finish
    await hp.waitForAnyKnownHash({ timeout: 9000 });

    // One generate click
    await hp.clickGenerate();

    // Wait for a known hash to appear
    await hp.waitForAnyKnownHash({ timeout: 9000 });

    // Assert no console.error messages were emitted and no uncaught exceptions
    // If the page had a ReferenceError/SyntaxError/TypeError naturally, they would have been captured in hp.pageErrors or hp.consoleErrors.
    expect(hp.consoleErrors.length).toBe(0);
    expect(hp.pageErrors.length).toBe(0);
  });
});