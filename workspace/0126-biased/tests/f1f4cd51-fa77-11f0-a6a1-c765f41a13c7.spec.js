import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f4cd51-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Set — A Visual Elegy (FSM validation)', () => {
  // Containers for console and page errors observed during each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors for assertions later
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application HTML exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test we will assert that no uncaught page errors occurred
    // and no console messages of type 'error' were emitted.
    // These assertions are grouped here to consistently check the runtime.
    expect(pageErrors, 'No uncaught page errors should have occurred').toHaveLength(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors, 'No console.error messages should have been emitted').toHaveLength(0);
  });

  test.describe('State S0_Idle (Initial load / entry actions)', () => {
    test('Initial load populates a 12-card board and runs initEnsure (entry action)', async ({ page }) => {
      // Verify board container exists
      const board = page.locator('#board');
      await expect(board).toBeVisible();

      // Wait until 12 cards are rendered into the board
      const cards = page.locator('#board .card');
      await expect(cards).toHaveCount(12);

      // Ensure set count is shown and seed is present (initEnsure should have populated these)
      const setCount = page.locator('#setCount');
      const seed = page.locator('#boardSeed');
      await expect(setCount).toBeVisible();
      await expect(seed).toBeVisible();

      // The application calls revealNext after a small delay if sets exist.
      // Wait up to 2.5s for the caption to update to 'Highlighted set:' indicating revealNext ran.
      const caption = page.locator('#caption');
      await expect(caption).toBeVisible();
      await expect.candidate(() => caption.textContent?.includes('Highlighted set:'), {
        timeout: 2500
      }).toBeTruthy();
      // Additionally ensure set count reflects a number (not the placeholder '—')
      const setCountText = await setCount.textContent();
      expect(setCountText).toMatch(/Sets found:\s*\d+/);
    });
  });

  test.describe('State S1_SetRevealed (RevealSet event and transitions)', () => {
    test('Clicking Reveal Set highlights exactly three cards and cycles through sets', async ({ page }) => {
      const revealBtn = page.locator('#revealBtn');
      const caption = page.locator('#caption');
      const setCount = page.locator('#setCount');
      const cards = page.locator('#board .card');

      // Ensure initial conditions: board present and at least one set exists
      await expect(cards).toHaveCount(12);
      const setCountText = await setCount.textContent();
      const match = setCountText?.match(/Sets found:\s*(\d+)/);
      expect(match, 'Sets found label should contain a number').not.toBeNull();
      const totalSets = parseInt(match[1], 10);
      expect(totalSets).toBeGreaterThan(0);

      // Wait for initial reveal (the page triggers a reveal after ~1200ms). If present, caption contains 'Highlighted set:'.
      // This ensures S1_SetRevealed entry action revealNext() executed.
      await expect.candidate(() => caption.textContent?.includes('Highlighted set:'), { timeout: 2500 }).toBeTruthy();

      // When a set is revealed, exactly three .card elements should have the 'match' class
      const matchedCards = page.locator('#board .card.match');
      await expect(matchedCards).toHaveCount(3);

      // Extract the currently revealed set index from caption, if available
      const initialCaption = (await caption.textContent()) || '';
      const initialMatch = initialCaption.match(/Set\s+(\d+)\s+of\s+(\d+)/);
      let initialIndex = 0;
      if (initialMatch) initialIndex = parseInt(initialMatch[1], 10);

      // Click the Reveal Set button repeatedly and ensure the caption cycles through sets
      // Click totalSets + 2 times to ensure wrapping behavior
      const clicks = totalSets + 2;
      for (let i = 1; i <= clicks; i++) {
        await revealBtn.click();
        // Wait for the caption to update to a Highlighted set and include the correct "Set X of N"
        await expect.captionContainsSetIndex(page, totalSets, { timeout: 1500 });
      }

      // After cycling, ensure still exactly three .card.match elements are present
      await expect(matchedCards).toHaveCount(3);
    });

    test('Reveal Set handles edge-case when no sets exist gracefully (if it occurs)', async ({ page }) => {
      // This application intentionally tries to ensure at least one set exists,
      // but we include a conditional test that validates the graceful behavior described in the FSM:
      // If there are zero found sets, clicking Reveal should show a helpful message.
      const revealBtn = page.locator('#revealBtn');
      const caption = page.locator('#caption');
      const setCount = page.locator('#setCount');

      const setCountText = await setCount.textContent();
      const match = setCountText?.match(/Sets found:\s*(\d+)/);
      const totalSets = match ? parseInt(match[1], 10) : null;

      // If for some reason there are zero sets (rare), clicking reveal should set caption to the 'No sets to reveal' message.
      if (totalSets === 0) {
        await revealBtn.click();
        await expect(caption).toHaveText('No sets to reveal. Try shuffling.');
      } else {
        // Otherwise, perform a normal click and assert we get a highlighted-set caption
        await revealBtn.click();
        await expect.candidate(() => caption.textContent?.includes('Highlighted set:'), { timeout: 1500 }).toBeTruthy();
      }
    });
  });

  test.describe('State S2_BoardShuffled (ShuffleBoard event and transitions)', () => {
    test('Clicking Shuffle Board regenerates the board and updates seed and sets found', async ({ page }) => {
      const shuffleBtn = page.locator('#shuffleBtn');
      const setCount = page.locator('#setCount');
      const seedEl = page.locator('#boardSeed');
      const caption = page.locator('#caption');
      const cards = page.locator('#board .card');

      // Read pre-shuffle seed and sets
      const beforeSeedText = await seedEl.textContent();
      const beforeSetText = await setCount.textContent();
      const beforeSeedMatch = beforeSeedText?.match(/Seed:\s*(\d+)/);
      const beforeSeed = beforeSeedMatch ? beforeSeedMatch[1] : null;

      // Click shuffle; the implementation disables the button and re-enables after ~420ms.
      await shuffleBtn.click();

      // Immediately after click the shuffle button should be disabled per implementation
      await expect(shuffleBtn).toBeDisabled();

      // Wait for the shuffle action to complete (callback after ~420ms) and for the button to re-enable.
      await expect(shuffleBtn).toBeEnabled({ timeout: 1500 });

      // After shuffle completes, there should still be 12 cards rendered
      await expect(cards).toHaveCount(12);

      // The seed text should change to a new numeric seed value (or at least differ from previous)
      const afterSeedText = await seedEl.textContent();
      const afterSeedMatch = afterSeedText?.match(/Seed:\s*(\d+)/);
      const afterSeed = afterSeedMatch ? afterSeedMatch[1] : null;
      expect(afterSeed, 'Seed should be present after shuffle').not.toBeNull();
      if (beforeSeed !== null && afterSeed !== null) {
        // It's possible, though extremely unlikely, for the random seed to be identical; assert that either it changed or at least the set count changed.
        if (beforeSeed === afterSeed) {
          const afterSetText = await setCount.textContent();
          expect(afterSetText).not.toBe(beforeSetText);
        }
      }

      // After shuffle, previous matches should be cleared; there should be zero .card.match immediately after shuffle
      const matchedCardsPostShuffle = page.locator('#board .card.match');
      await expect(matchedCardsPostShuffle).toHaveCount(0);

      // After shuffle, clicking Reveal should highlight a set again
      const revealBtn = page.locator('#revealBtn');
      await revealBtn.click();
      await expect.candidate(() => caption.textContent?.includes('Highlighted set:'), { timeout: 1500 }).toBeTruthy();
      await expect(page.locator('#board .card.match')).toHaveCount(3);
    });
  });
});

// Helper: extend expect to wait until caption contains updated Set X of N info
// We implement a custom helper using expect.candidate pattern: add a property to expect that allows calling a function returning boolean.
// Since Playwright doesn't provide expect.candidate, we polyfill a simple implementation using polling via setTimeout in a promise.
// To keep everything in a single file as requested, define it here.
expect.candidate = async (predicateFn, options = {}) => {
  const timeout = options.timeout ?? 2000;
  const interval = 80;
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function poll() {
      try {
        if (predicateFn()) return resolve(true);
      } catch (e) {
        // swallow until timeout
      }
      if (Date.now() - start > timeout) return reject(new Error('candidate predicate timed out'));
      setTimeout(poll, interval);
    })();
  });
};

// Small utility to specifically wait for caption to contain "Set X of N"
expect.extend = expect.extend || ((obj) => obj); // no-op if not used

expect.captionContainsSetIndex = async (page, totalSets, opts = {}) => {
  const timeout = opts.timeout ?? 1500;
  const start = Date.now();
  const caption = page.locator('#caption');
  while (Date.now() - start < timeout) {
    const text = (await caption.textContent()) || '';
    const m = text.match(/Set\s+(\d+)\s+of\s+(\d+)/);
    if (m) {
      const idx = parseInt(m[1], 10);
      const tot = parseInt(m[2], 10);
      if (tot === totalSets && idx >= 1 && idx <= tot) return;
    }
    await new Promise(r => setTimeout(r, 80));
  }
  throw new Error('Timed out waiting for caption to contain "Set X of N"');
};