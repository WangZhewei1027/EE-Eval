import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9606d0-fa78-11f0-857d-d58e82d5de73.html';

// Page Object Model for the Hash Map Visualization page
class HashMapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.bucketsLocator = page.locator('#buckets');
    this.bucketItems = page.locator('#buckets > .bucket');
    this.shuffleBtn = page.locator('#shuffleBtn');
  }

  // Wait until buckets are rendered (initial render)
  async waitForInitialRender() {
    await this.page.waitForSelector('#buckets > .bucket', { timeout: 3000 });
  }

  // Return number of bucket elements
  async bucketsCount() {
    return await this.bucketItems.count();
  }

  // Return an array of objects describing each bucket: { idx, itemCount, isHighlighted, ariaLabel, isEmptyPlaceholderPresent }
  async snapshotBuckets() {
    const count = await this.bucketItems.count();
    const out = [];
    for (let i = 0; i < count; i++) {
      const bucket = this.bucketItems.nth(i);
      const idx = await bucket.getAttribute('data-idx');
      const aria = await bucket.getAttribute('aria-label');
      const isHighlighted = await bucket.evaluate((el) => el.classList.contains('highlighted'));
      // Count pair elements inside chain (role=listitem)
      const pairCount = await bucket.locator('.pair').count();
      // detect empty placeholder text presence
      const emptyPresent = await bucket.evaluate((el) => {
        return Array.from(el.children).some(c => c.textContent && c.textContent.trim() === 'Empty');
      });
      out.push({
        idx: Number(idx),
        ariaLabel: aria,
        isHighlighted,
        pairCount,
        emptyPresent,
      });
    }
    return out;
  }

  // Return snapshot of values per bucket in order: [{ idx, keys: [...], values: [...] }, ...]
  async snapshotKeysAndValues() {
    const count = await this.bucketItems.count();
    const out = [];
    for (let i = 0; i < count; i++) {
      const bucket = this.bucketItems.nth(i);
      const idx = Number(await bucket.getAttribute('data-idx'));
      const pairLocators = bucket.locator('.pair');
      const pairCount = await pairLocators.count();
      const keys = [];
      const values = [];
      for (let j = 0; j < pairCount; j++) {
        const pair = pairLocators.nth(j);
        const key = await pair.locator('.key').innerText();
        const value = await pair.locator('.value').innerText();
        keys.push(key);
        values.push(value);
      }
      out.push({ idx, keys, values });
    }
    return out;
  }

  // Click Shuffle button and wait for re-render (we wait for at least one bucket to be present again)
  async clickShuffle() {
    await Promise.all([
      this.page.waitForTimeout(60), // small pause to let click handlers run; renderBuckets is synchronous-ish but animation may take a bit
      this.shuffleBtn.click()
    ]);
    // Ensure buckets are present after click
    await this.page.waitForSelector('#buckets > .bucket');
  }

  // Return highlighted bucket indices currently present
  async highlightedBucketIndices() {
    const snaps = await this.snapshotBuckets();
    return snaps.filter(s => s.isHighlighted).map(s => s.idx);
  }
}

test.describe('Hash Map Visualization — FSM and Interaction Tests', () => {
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset captured logs
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      const type = msg.type(); // e.g., 'log', 'error', 'warning'
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push({ type, text });
    });

    // Capture page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the served HTML page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Nothing special to tear down per test beyond Playwright's own cleanup
  });

  test('S0_Initial: initial render shows 8 buckets, renders pairs and highlights a bucket', async ({ page }) => {
    // This test validates the Initial State (S0_Initial) entry actions:
    // - renderBuckets() produced 8 bucket elements
    // - highlightRandomBucket() applied the .highlighted class to at least one non-empty bucket
    // - buckets have appropriate aria attributes and Empty placeholders where applicable
    const app = new HashMapPage(page);

    // Wait for initial render triggered by requestAnimationFrame(init)
    await app.waitForInitialRender();

    // Check buckets count is exactly 8 (bucketsCount constant in implementation)
    const bucketsCnt = await app.bucketsCount();
    expect(bucketsCnt).toBe(8);

    // Snapshot bucket details
    const snaps = await app.snapshotBuckets();

    // At least one bucket should be present and have aria-label that mentions index
    expect(snaps.length).toBe(8);
    for (const s of snaps) {
      expect(typeof s.idx).toBe('number');
      expect(s.ariaLabel).toBeTruthy();
      // aria-label should include "Bucket index"
      expect(s.ariaLabel.toLowerCase()).toContain('bucket index');
      // pairCount or emptyPresent should be consistent
      expect((s.pairCount > 0) || s.emptyPresent).toBeTruthy();
    }

    // There should be at least one highlighted bucket (highlightRandomBucket was called on entry)
    const highlighted = snaps.filter(s => s.isHighlighted);
    expect(highlighted.length).toBeGreaterThanOrEqual(1);

    // There should be total pair elements equal to the number of entries in the JS data (12 entries)
    const totalPairs = snaps.reduce((acc, s) => acc + s.pairCount, 0);
    expect(totalPairs).toBe(12);

    // Ensure empty placeholders exist for truly empty buckets
    const empties = snaps.filter(s => s.emptyPresent);
    expect(empties.length).toBeGreaterThanOrEqual(0); // allow zero or more; at least valid property check

    // No uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);

    // No console 'error' messages on initial load
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: clicking Shuffle Values triggers shuffleValues, re-renders and highlights a bucket (S0 -> S1)', async ({ page }) => {
    // This test validates the transition defined by the FSM (ShuffleClick):
    // - shuffleValues() should be invoked (we infer via re-render and potential value changes)
    // - renderBuckets() is called again (buckets remain present)
    // - highlightRandomBucket() should add a highlighted bucket after shuffle
    const app = new HashMapPage(page);
    await app.waitForInitialRender();

    // Capture snapshot of keys and values prior to shuffle
    const before = await app.snapshotKeysAndValues();

    // Ensure keys are preserved (keys remain the same per bucket, since only values shuffle)
    const keysBeforeFlat = before.flatMap(b => b.keys).sort();
    // Click the shuffle button
    await app.clickShuffle();

    // After shuffle - wait for re-render
    const after = await app.snapshotKeysAndValues();

    // Keys should still be the same multiset
    const keysAfterFlat = after.flatMap(b => b.keys).sort();
    expect(keysAfterFlat).toEqual(keysBeforeFlat);

    // Values per bucket may change order if chain length > 1.
    // We check that for buckets with more than one pair, the multiset of values is preserved but order may differ.
    for (let i = 0; i < before.length; i++) {
      const bBefore = before[i];
      const bAfter = after.find(b => b.idx === bBefore.idx);
      expect(bAfter).toBeTruthy();

      // The multiset of values should be identical for each bucket (shuffle only swaps values inside same chain)
      const valsBeforeSorted = [...bBefore.values].sort();
      const valsAfterSorted = [...bAfter.values].sort();
      expect(valsAfterSorted).toEqual(valsBeforeSorted);
    }

    // At least one bucket that had length > 1 should ideally change order after shuffle.
    // Because shuffle is random, it's possible the order remains the same. We attempt a robust check:
    const bucketsWithMultiple = before.filter(b => b.values.length > 1);
    if (bucketsWithMultiple.length > 0) {
      const orderChanged = bucketsWithMultiple.some(b => {
        const corresponding = after.find(a => a.idx === b.idx);
        // If values arrays are not strictly equal in order, then order changed
        return JSON.stringify(b.values) !== JSON.stringify(corresponding.values);
      });
      // Accept either changed order OR no change (rare). We assert that multiset invariant holds (done above).
      // But also assert that after shuffle, at least one bucket is highlighted (highlightRandomBucket called)
      const highlightedAfter = await app.highlightedBucketIndices();
      expect(highlightedAfter.length).toBeGreaterThanOrEqual(1);
      // If orderChanged is false, we won't fail to avoid flakiness due to randomness.
    }

    // Ensure total number of pairs still 12 after shuffle and render
    const totalPairsAfter = after.reduce((acc, s) => acc + s.values.length, 0);
    expect(totalPairsAfter).toBe(12);

    // Ensure no new page errors or console error logs occurred due to clicking the button
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge Cases: repeated shuffles stable - shapes and counts unchanged; aria attributes preserved', async ({ page }) => {
    // This test repeatedly presses the Shuffle button and confirms:
    // - bucket count remains 8
    // - total number of pairs remains constant
    // - aria attributes on button and buckets remain present and reasonable
    const app = new HashMapPage(page);
    await app.waitForInitialRender();

    // Read initial attributes
    const initialBuckets = await app.snapshotBuckets();
    const initialTotalPairs = initialBuckets.reduce((a, b) => a + b.pairCount, 0);
    expect(initialTotalPairs).toBe(12);

    // Check button ARIA attributes
    const ariaPressed = await app.shuffleBtn.getAttribute('aria-pressed');
    const ariaLive = await app.shuffleBtn.getAttribute('aria-live');
    expect(ariaPressed).toBe('false');
    expect(ariaLive).toBe('polite');

    // Click shuffle multiple times to stress test
    for (let i = 0; i < 5; i++) {
      await app.clickShuffle();
      // After each shuffle, basic invariants:
      const snaps = await app.snapshotBuckets();
      expect(snaps.length).toBe(8);
      const totalPairs = snaps.reduce((a, b) => a + b.pairCount, 0);
      expect(totalPairs).toBe(initialTotalPairs);

      // Each bucket aria-label should remain present and mention "Bucket index"
      for (const s of snaps) {
        expect(s.ariaLabel).toBeTruthy();
        expect(s.ariaLabel.toLowerCase()).toContain('bucket index');
      }

      // No page errors or console errors during any shuffle
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    }
  });

  test('Error observation: capture console and page errors during load and interactions', async ({ page }) => {
    // This test focuses on observing console logs and page errors.
    // It asserts that there are zero critical errors by default but records messages for debugging.
    const app = new HashMapPage(page);
    await app.waitForInitialRender();

    // Capture summary of console messages for debugging context (not failing test unless errors present)
    const errorMsgs = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    const warnings = consoleMessages.filter(m => m.type === 'warning').map(m => m.text);
    // If there are any page errors or console errors, include them in the assertion failure message
    if (pageErrors.length > 0 || errorMsgs.length > 0) {
      // Compose helpful failure info
      const errInfo = [
        `pageErrors: ${pageErrors.map(e => String(e)).join(' | ')}`,
        `consoleErrors: ${errorMsgs.join(' | ')}`,
        `consoleWarnings: ${warnings.join(' | ')}`
      ].join('\n');
      // Fail with details so maintainers can inspect environment issues
      throw new Error('Detected page errors or console errors:\n' + errInfo);
    }

    // Otherwise assert none found
    expect(pageErrors.length).toBe(0);
    expect(errorMsgs.length).toBe(0);

    // Also assert there were non-error console messages (e.g., accessibility semantics might log), but this is optional
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });
});