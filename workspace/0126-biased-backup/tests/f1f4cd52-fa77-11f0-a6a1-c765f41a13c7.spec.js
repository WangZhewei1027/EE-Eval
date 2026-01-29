import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f4cd52-fa77-11f0-a6a1-c765f41a13c7.html';

/**
 * Page Object for the Multiset interactive app.
 * Encapsulates common queries and actions to keep tests readable.
 */
class MultiSetPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.frameSelector = '#frame';
    this.orbitSelector = '#orbit';
    this.stacksSelector = '#stacks';
    this.legendSelector = '#legend';
    this.btnToggle = '#btnToggle';
    this.btnShuffle = '#btnShuffle';
    this.viewLabel = '#viewLabel';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // wait for initial render activities to settle
    await this.page.waitForSelector(this.frameSelector, { state: 'visible' });
  }

  async isStackMode() {
    return await this.page.$eval(this.frameSelector, (el) => el.classList.contains('stack-mode'));
  }

  async getViewLabelText() {
    return await this.page.textContent(this.viewLabel);
  }

  // Returns the counts array exposed on window._multiset if available
  async getExposedCounts() {
    return await this.page.evaluate(() => {
      try {
        if (window._multiset && Array.isArray(window._multiset.counts)) {
          return window._multiset.counts;
        }
        // fallback: parse legend DOM if exposed object missing
        const legend = Array.from(document.querySelectorAll('#legend .legend-count')).map(n => parseInt(n.textContent.replace(/[^0-9]/g,''),10));
        if (legend.length) return legend;
        return null;
      } catch (e) {
        return null;
      }
    });
  }

  // Parse legend counts displayed in the right panel; returns array of numbers
  async getLegendCounts() {
    return await this.page.$$eval('#legend .legend-count', els =>
      els.map(el => parseInt(el.textContent.replace(/[^0-9]/g,''), 10))
    );
  }

  // Count number of token elements rendered inside orbit view (across all rings)
  async getOrbitTokenCount() {
    // tokens inside orbit are .orbit-item > .token ; central mini tokens are .swatch inside center but we count main tokens
    return await this.page.$$eval('#orbit .token', els => els.length);
  }

  // Collect info about stacks: returns array where each entry is number of .stack-token children in that column
  async getStackColumnsCounts() {
    return await this.page.$$eval('#stacks .stack-column', cols =>
      cols.map(col => {
        // children that have class 'stack-token' (placeholders included)
        return Array.from(col.querySelectorAll('.stack-token')).length;
      })
    );
  }

  async clickToggle() {
    await this.page.click(this.btnToggle);
  }

  async clickShuffle() {
    await this.page.click(this.btnShuffle);
  }

  // Helper to wait for small animations and re-renders to complete
  async waitForVisualUpdate() {
    // rely on short timeout for DOM updates (the app uses animations ~520ms and transitions up to 900ms)
    await this.page.waitForTimeout(220);
  }
}

test.describe('Multiset Visual Concept — FSM behavior and UI tests', () => {
  // capture console errors and page errors for each test and assert none occurred
  test.beforeEach(async ({ page }) => {
    // Silence Playwright warning if scripts attempt to use animation APIs etc; we only collect errors
    page.context().setDefaultTimeout(60000);
  });

  test('Initial state should be Orbit View and renderOrbit() effects present', async ({ page }) => {
    // Collect console errors and page errors
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new MultiSetPage(page);
    await app.goto();

    // Validate FSM entry action for S0_OrbitView: renderOrbit() should have run
    // Evidence: orbit container should contain token elements and a central summary (mini tokens)
    const isStack = await app.isStackMode();
    expect(isStack).toBe(false); // orbit mode active

    const label = await app.getViewLabelText();
    expect(label).toBe('Orbit');

    // Legend should be rendered with 5 items
    const legendCounts = await app.getLegendCounts();
    expect(legendCounts.length).toBe(5);
    // All counts should be numbers >= 0
    legendCounts.forEach(cnt => expect(Number.isFinite(cnt)).toBe(true));

    // Orbit should have token elements equal to sum of legend counts (each multiplicity produces tokens)
    const totalFromLegend = legendCounts.reduce((a,b) => a+b, 0);
    const orbitTokens = await app.getOrbitTokenCount();
    expect(orbitTokens).toBe(totalFromLegend);

    // Central summary mini tokens: there should be 5 .swatch mini items in the orbit center.
    const centralMiniCount = await page.$$eval('#orbit > div .swatch', els => els.length).catch(()=>0);
    // It may place swatches as direct child of orbit after rings; ensure at least 5 mini swatches exist
    expect(centralMiniCount).toBeGreaterThanOrEqual(5);

    // No unexpected console or page errors occurred during initial load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ToggleView transitions: Orbit -> Stack -> Orbit and entry actions renderStacks()/renderOrbit()', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new MultiSetPage(page);
    await app.goto();

    // Snapshot counts to compare DOM behavior
    const countsBefore = await app.getExposedCounts();
    expect(Array.isArray(countsBefore)).toBe(true);

    // Click Toggle to switch to Stack View (S0 -> S1)
    await app.clickToggle();
    await app.waitForVisualUpdate();

    // After toggling, frame should have stack-mode class
    const isStackNow = await app.isStackMode();
    expect(isStackNow).toBe(true);

    // view label should read "Stacks"
    const labelAfter = await app.getViewLabelText();
    expect(labelAfter).toBe('Stacks');

    // renderStacks() evidence: stacks container should have 5 columns (one per type)
    const stackColumns = await page.$$eval('#stacks .stack-column', cols => cols.length);
    expect(stackColumns).toBe(5);

    // Each column should contain either counts[i] .stack-token elements or a single placeholder token for zero counts
    const stackedCounts = await app.getStackColumnsCounts();
    expect(stackedCounts.length).toBe(5);
    // Each stackedCount must be >= 1 (a placeholder may be present)
    stackedCounts.forEach(c => expect(c).toBeGreaterThanOrEqual(1));

    // Toggle back to Orbit view (S1 -> S0)
    await app.clickToggle();
    await app.waitForVisualUpdate();

    const isStackAfterToggleBack = await app.isStackMode();
    expect(isStackAfterToggleBack).toBe(false);

    const labelBack = await app.getViewLabelText();
    expect(labelBack).toBe('Orbit');

    // Orbit tokens count should match sum of legend counts again
    const legendCountsAfter = await app.getLegendCounts();
    const totalLegendAfter = legendCountsAfter.reduce((a,b)=>a+b,0);
    const orbitTokensAfter = await app.getOrbitTokenCount();
    expect(orbitTokensAfter).toBe(totalLegendAfter);

    // No unexpected console or page errors during toggling
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ShuffleCounts event randomizes multiplicities and updates legend & views (attempts up to 3 times to observe change)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new MultiSetPage(page);
    await app.goto();

    // Ensure starting in orbit mode for this check
    const startStackMode = await app.isStackMode();
    if (startStackMode) {
      await app.clickToggle();
      await app.waitForVisualUpdate();
    }

    const countsBefore = await app.getExposedCounts();
    expect(Array.isArray(countsBefore)).toBe(true);

    // Click shuffle and wait; attempt up to 3 times to observe changed counts (since random can occasionally repeat)
    let countsAfter = null;
    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      await app.clickShuffle();
      // the app triggers an animation — wait a little for re-render
      await page.waitForTimeout(300);
      countsAfter = await app.getExposedCounts();
      if (!countsAfter) break;
      // If counts changed, break; otherwise try again
      const isDifferent = countsAfter.length === countsBefore.length && countsAfter.some((v,i)=> v !== countsBefore[i]);
      if (isDifferent) break;
    }

    // If countsAfter is null something unexpected occurred; fail early
    expect(Array.isArray(countsAfter)).toBe(true);

    // Assert that at least eventually we saw a change in multiplicities or that the app re-rendered and legend matches counts.
    const legendCounts = await app.getLegendCounts();
    // legendCounts must match countsAfter if countsAfter is available
    if (countsAfter) {
      expect(legendCounts.length).toBe(countsAfter.length);
      for (let i = 0; i < legendCounts.length; i++) {
        expect(legendCounts[i]).toBe(countsAfter[i]);
      }
    }

    // Also verify that orbit tokens reflect the new totals
    const totalLegend = legendCounts.reduce((a,b)=>a+b,0);
    const orbitTokens = await app.getOrbitTokenCount();
    expect(orbitTokens).toBe(totalLegend);

    // Now switch to stacks and trigger another shuffle to test same-state self-transition in S1_StackView
    await app.clickToggle(); // go to stacks
    await app.waitForVisualUpdate();
    const countsBeforeStackShuffle = await app.getExposedCounts();
    expect(Array.isArray(countsBeforeStackShuffle)).toBe(true);

    attempts = 0;
    let countsAfterStackShuffle = null;
    while (attempts < 3) {
      attempts++;
      await app.clickShuffle();
      await page.waitForTimeout(300);
      countsAfterStackShuffle = await app.getExposedCounts();
      if (!countsAfterStackShuffle) break;
      const different = countsAfterStackShuffle.some((v,i)=> v !== countsBeforeStackShuffle[i]);
      if (different) break;
    }

    expect(Array.isArray(countsAfterStackShuffle)).toBe(true);

    // After shuffle in stack mode, stack columns should update to reflect new multiplicities
    const stackedCounts = await app.getStackColumnsCounts();
    // For each column, the number of .stack-token children should equal countsAfterStackShuffle[i] or be 1 placeholder if zero
    for (let i = 0; i < stackedCounts.length; i++) {
      const expected = countsAfterStackShuffle[i] === 0 ? 1 : countsAfterStackShuffle[i];
      expect(stackedCounts[i]).toBe(expected);
    }

    // No unexpected console or page errors during shuffle operations
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Exposed API usage: window._multiset exists and toggleView/randomize functions change state (no injection or patching)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new MultiSetPage(page);
    await app.goto();

    // Confirm exposed object exists and has properties
    const exposed = await page.evaluate(() => {
      return {
        hasObject: !!window._multiset,
        hasCounts: window._multiset ? Array.isArray(window._multiset.counts) : false,
        hasRandomize: !!(window._multiset && window._multiset.randomize),
        hasToggle: !!(window._multiset && window._multiset.toggleView)
      };
    });
    expect(exposed.hasObject).toBe(true);
    expect(exposed.hasCounts).toBe(true);
    expect(exposed.hasRandomize).toBe(true);
    expect(exposed.hasToggle).toBe(true);

    // Use the exposed toggleView to flip the view and check UI updates
    const initialMode = await app.isStackMode();
    await page.evaluate(() => window._multiset.toggleView());
    await app.waitForVisualUpdate();
    const modeAfterToggle = await app.isStackMode();
    expect(modeAfterToggle).toBe(!initialMode);

    // Call randomize via exposed API and ensure counts change or legend updates accordingly
    const countsBefore = await app.getExposedCounts();
    await page.evaluate(() => window._multiset.randomize());
    await page.waitForTimeout(300);
    const countsAfter = await app.getExposedCounts();
    expect(Array.isArray(countsAfter)).toBe(true);
    // countsAfter should be an array of same length; they might occasionally be same due to randomness, so assert structure
    expect(countsAfter.length).toBe(countsBefore.length);

    // Validate legend reflects exposed counts
    const legend = await app.getLegendCounts();
    for (let i = 0; i < legend.length; i++) {
      expect(legend[i]).toBe(countsAfter[i]);
    }

    // No unexpected console or page errors when using exposed API
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: ensure at least one non-zero multiplicity after randomizeCounts and placeholder behavior for zero multiplicities', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new MultiSetPage(page);
    await app.goto();

    // Force multiple randomizations to attempt getting zeros; we must not patch or inject, use provided shuffle
    let counts = null;
    for (let i = 0; i < 8; i++) {
      await app.clickShuffle();
      await page.waitForTimeout(200);
      counts = await app.getExposedCounts();
      // Ensure returned value is an array
      expect(Array.isArray(counts)).toBe(true);
      // Per implementation, if all zeros, the function ensures at least one non-zero by setting one to 2
      const allZero = counts.every(v => v === 0);
      expect(allZero).toBe(false);
    }

    // Now switch to stacks and verify placeholder behavior for any zero counts
    await app.clickToggle();
    await app.waitForVisualUpdate();
    const countsNow = await app.getExposedCounts();
    const stackedCounts = await app.getStackColumnsCounts();
    // For any type with countsNow[i] === 0, the corresponding column should have opacity style and contain exactly 1 placeholder token
    for (let i = 0; i < countsNow.length; i++) {
      if (countsNow[i] === 0) {
        // ensure corresponding stackedCount is 1 placeholder
        expect(stackedCounts[i]).toBe(1);
      } else {
        expect(stackedCounts[i]).toBe(countsNow[i]);
      }
    }

    // No unexpected console or page errors during repeated shuffles
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Final test to ensure there are no uncaught exceptions in the page lifecycle
  test('No uncaught page errors or console.error during full scenario', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new MultiSetPage(page);
    await app.goto();

    // perform a sequence of interactions simulating user exploration
    await app.clickShuffle();
    await app.waitForVisualUpdate();
    await app.clickToggle();
    await app.waitForVisualUpdate();
    await app.clickShuffle();
    await app.waitForVisualUpdate();
    await app.clickToggle();
    await app.waitForVisualUpdate();

    // Give some time for any late errors to surface
    await page.waitForTimeout(300);

    // Assert there were no page errors or console.error messages
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});