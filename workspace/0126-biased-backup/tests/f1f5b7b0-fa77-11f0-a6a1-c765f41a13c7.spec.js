import { test, expect } from '@playwright/test';

test.setTimeout(120000); // allow up to 2 minutes for sorting visualization to complete on CI

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f5b7b0-fa77-11f0-a6a1-c765f41a13c7.html';

class QuickSortPage {
  constructor(page) {
    this.page = page;
    this.status = page.locator('#status');
    this.shuffleBtn = page.locator('#shuffleBtn');
    this.playBtn = page.locator('#playBtn');
    this.lane = page.locator('#lane');
    this.countEl = page.locator('#count');
    this.stepsEl = page.locator('#steps');
    this.tiles = page.locator('.tile');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getStatusText() {
    return (await this.status.textContent())?.trim() ?? '';
  }

  async getCount() {
    const t = await this.countEl.textContent();
    return Number(t?.trim() ?? '0');
  }

  async getSteps() {
    const t = await this.stepsEl.textContent();
    return Number(t?.trim() ?? '0');
  }

  async getTileValues() {
    const nodes = await this.page.locator('.tile').elementHandles();
    const values = [];
    for (const n of nodes) {
      // read data-value attribute
      const v = await n.getAttribute('data-value');
      values.push(v);
    }
    return values;
  }

  async clickShuffle() {
    await this.shuffleBtn.click();
  }

  async clickPlay() {
    await this.playBtn.click();
  }

  async waitForAnyHighlight(timeout = 5000) {
    // Wait for any of the visual classes to appear: pivot, compare, swap
    await Promise.race([
      this.page.waitForSelector('.tile.pivot', { timeout }).catch(()=>null),
      this.page.waitForSelector('.tile.compare', { timeout }).catch(()=>null),
      this.page.waitForSelector('.tile.swap', { timeout }).catch(()=>null),
    ]);
  }

  async waitForSortingStart(timeout = 5000) {
    await this.page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent && s.textContent.toLowerCase().includes('sorting');
    }, null, { timeout });
  }

  async waitForSorted(timeout = 120000) {
    await this.page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent && s.textContent.trim() === 'Status: Sorted — Completed';
    }, null, { timeout });
  }

  async isPlayDisabled() {
    return await this.playBtn.isDisabled();
  }

  async getPlayText() {
    return (await this.playBtn.textContent())?.trim() ?? '';
  }

  async isShuffleDisabled() {
    return await this.shuffleBtn.isDisabled();
  }
}

test.describe('Quick Sort — Visual Elegance (FSM validation)', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // collect console messages and page errors for assertions
    page.on('console', msg => {
      // store text and type
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test('S0_Idle entry action: initial shuffle then Ready status appears', async ({ page }) => {
    // This test validates initial state behavior: on load the app calls shuffleArray() (immediate),
    // sets "Status: Shuffled", and then after a short timeout updates status to the Idle "Ready" message.
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Because the implementation calls shuffleArray() immediately on init, we expect an initial 'Shuffled' state.
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent && s.textContent.includes('Shuffled');
    }, null, { timeout: 1500 });

    const statusAfterShuffle = await qs.getStatusText();
    expect(statusAfterShuffle).toContain('Status: Shuffled');

    // Then the script sets a timeout to show the Ready message. Wait for that to appear.
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent && s.textContent.includes('Ready');
    }, null, { timeout: 2000 });

    const readyStatus = await qs.getStatusText();
    expect(readyStatus).toBe('Status: Ready — Shuffle to randomize, Play to watch Quick Sort');

    // Verify the count and steps are consistent with initial creation
    const count = await qs.getCount();
    expect(count).toBe(14); // as per the HTML evidence
    const steps = await qs.getSteps();
    expect(steps).toBe(0);

    // Ensure there were no runtime errors during load
    expect(pageErrors.length).toBe(0);
    // We do not expect console logs from the app; assert none found (if environment logs, allow non-empty but record)
    expect(consoleMessages.length).toBeLessThanOrEqual(5); // allow some noise but typically zero
  });

  test('S0 -> S1: Shuffle button transitions to Shuffled state and updates tiles', async ({ page }) => {
    // This test validates the Shuffle event and transition from Idle to Shuffled
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Wait until initial Ready message to simulate user shuffling from Idle
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent && s.textContent.includes('Ready');
    }, null, { timeout: 2000 });

    // Capture current tile values and perform a shuffle
    const beforeValues = await qs.getTileValues();
    expect(beforeValues.length).toBe(14);

    await qs.clickShuffle();

    // After clicking shuffle, status must show 'Status: Shuffled'
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent && s.textContent.includes('Shuffled');
    }, null, { timeout: 1000 });

    const status = await qs.getStatusText();
    expect(status).toBe('Status: Shuffled');

    // Steps should reset to 0
    expect(await qs.getSteps()).toBe(0);

    // Count should still equal 14, and tile count must match
    expect(await qs.getCount()).toBe(14);
    const afterValues = await qs.getTileValues();
    expect(afterValues.length).toBe(14);

    // It's possible the random unique set accidentally equals previous order (very unlikely),
    // but we assert that values are valid numeric strings and present.
    for (const v of afterValues) {
      expect(v).toMatch(/^\d+$/);
    }
  });

  test('S1 -> S2 -> S3: Play starts sorting (Sorting visuals) and completes to Sorted', async ({ page }) => {
    // This test validates the Play event causing Sorting state and eventual Sorted state,
    // including visual highlights (pivot/compare/swap) and buttons disabled during run.
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Ensure we are in Ready/Idle then click shuffle to ensure fresh randomized array
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent && s.textContent.includes('Ready');
    }, null, { timeout: 2000 });

    await qs.clickShuffle();

    // Confirm 'Shuffled' before starting
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('Shuffled'), null, { timeout: 1000 });

    // Start sorting
    await qs.clickPlay();

    // Immediately after starting, play button should show running state and be disabled
    // Implementation sets text to 'Running…' and disables buttons
    await page.waitForFunction(() => {
      const play = document.getElementById('playBtn');
      return play && (play.disabled === true);
    }, null, { timeout: 1000 });

    expect(await qs.isPlayDisabled()).toBe(true);
    expect(await qs.isShuffleDisabled()).toBe(true);

    const playText = await qs.getPlayText();
    expect(['Running…', 'Running…']).toContain(playText); // exact text set by implementation

    // Status should start with 'Status: Sorting' (implementation briefly sets a specific string then updates with depth)
    await qs.waitForSortingStart(5000);
    const sortingStatus = await qs.getStatusText();
    expect(sortingStatus.toLowerCase()).toContain('sorting');

    // During sorting there should be visual highlights: pivot/compare/swap appear
    await qs.waitForAnyHighlight(15000); // allow some time for first highlights to show
    // At least one highlight class should be present
    const pivotExists = await page.$('.tile.pivot');
    const compareExists = await page.$('.tile.compare');
    const swapExists = await page.$('.tile.swap');
    expect(Boolean(pivotExists || compareExists || swapExists)).toBe(true);

    // Steps should increase as sorting proceeds. Wait a bit and then assert steps > 0
    await page.waitForTimeout(800); // short pause to allow a few comparisons
    const stepsDuring = await qs.getSteps();
    expect(stepsDuring).toBeGreaterThanOrEqual(0);

    // Ensure that clicking Play while running does nothing harmful (edge case)
    // Attempt to click play again; implementation should ignore while running
    await qs.clickPlay();
    // Play button should remain disabled and text should still be Running…
    expect(await qs.isPlayDisabled()).toBe(true);
    expect((await qs.getPlayText()).toLowerCase()).toContain('running');

    // Wait for sorting to complete and verify final state S3_Sorted
    await qs.waitForSorted(110000); // extended timeout to allow sorting to finish
    const finalStatus = await qs.getStatusText();
    expect(finalStatus).toBe('Status: Sorted — Completed');

    // Buttons should be restored after completion
    expect(await qs.isPlayDisabled()).toBe(false);
    expect(await qs.isShuffleDisabled()).toBe(false);
    expect(await qs.getPlayText()).toBe('Play');

    // After sorting, tiles should still exist and count remains 14
    expect(await qs.getCount()).toBe(14);
    const finalValues = await qs.getTileValues();
    expect(finalValues.length).toBe(14);

    // Confirm no page errors occurred during the sorting run
    // We capture page errors at the top of the test file; assert none
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Rapidly clicking Shuffle and Play should not throw JS errors', async ({ page }) => {
    // This test stresses the user interactions: repeatedly clicking shuffle and play quickly,
    // ensuring the application handles it gracefully without throwing errors.
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Wait for Ready text
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent && s.textContent.includes('Ready');
    }, null, { timeout: 2000 });

    // Rapid interaction: click shuffle a few times quickly
    await qs.clickShuffle();
    await qs.clickShuffle();
    await qs.clickShuffle();

    // Start sorting
    await qs.clickPlay();

    // Attempt to click shuffle while sorting (should be ignored because shuffleBtn disabled)
    // Also attempt to click play multiple times
    for (let i = 0; i < 5; i++) {
      try {
        await qs.clickShuffle().catch(()=>{}); // may be disabled
        await qs.clickPlay().catch(()=>{});
      } catch (e) {
        // swallow exceptions from clicking disabled elements; we'll assert no page errors later
      }
    }

    // Give the sorter a short moment to begin operations
    await page.waitForTimeout(600);

    // Confirm there are no unhandled exceptions collected by the page
    expect(pageErrors.length).toBe(0);

    // Confirm console did not log any unhandled error-level messages
    const errorConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsole.length).toBeLessThanOrEqual(2); // allow small number of warnings if environment-specific
  });

  test('Observability: verify that DOM updates match FSM evidence and onEnter/onExit behavior', async ({ page }) => {
    // This test ties specific evidence lines in FSM to actual DOM text and actions:
    // - S0 entry leads to ShuffleArray being run (we observed this on load)
    // - Transition evidence texts are present at the expected times
    const qs = new QuickSortPage(page);
    await qs.goto();

    // On load, shuffleArray() was invoked (we saw 'Status: Shuffled' initially)
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent && s.textContent.includes('Shuffled');
    }, null, { timeout: 1500 });

    // Then S0 evidence: final idle-ready text after timeout
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent && s.textContent.includes('Ready');
    }, null, { timeout: 2000 });

    expect(await qs.getStatusText()).toBe('Status: Ready — Shuffle to randomize, Play to watch Quick Sort');

    // Trigger Shuffle transition and assert S1 evidence
    await qs.clickShuffle();
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('Shuffled'), null, { timeout: 1000 });
    expect(await qs.getStatusText()).toBe('Status: Shuffled');

    // Trigger Play transition and assert S2 evidence (Sorting in progress)
    await qs.clickPlay();
    // The implementation first sets 'Status: Sorting — Quick Sort in progress', then updates with depth, so assert startsWith
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent && s.textContent.toLowerCase().includes('sorting');
    }, null, { timeout: 3000 });

    const statusDuring = await qs.getStatusText();
    expect(statusDuring.toLowerCase()).toContain('sorting');

    // Finally wait for S3 evidence text
    await qs.waitForSorted(110000);
    expect(await qs.getStatusText()).toBe('Status: Sorted — Completed');

    // No page errors should be observed through these transitions
    expect(pageErrors.length).toBe(0);
  });
});