import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f605d0-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object for interacting with the Binary Search visualization page
class BinarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = '#runBtn';
    this.btnLabel = '#btnLabel';
    this.arrayWrap = '#arrayWrap';
    this.log = '#log';
    this.targetBadge = '#targetBadge';
    this.iterBadge = '#iterBadge';
    this.band = '#band';
    this.halo = '#halo';
    this.foundGlow = '#foundGlow';
    this.nStat = '#nStat';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the core elements to be present
    await this.page.waitForSelector(this.runBtn);
    await this.page.waitForSelector(this.arrayWrap);
    await this.page.waitForSelector(this.log);
  }

  async clickRun() {
    await this.page.click(this.runBtn);
  }

  async getBtnLabelText() {
    return this.page.locator(this.btnLabel).innerText();
  }

  async isRunBtnDisabled() {
    return this.page.$eval(this.runBtn, (b) => b.disabled === true);
  }

  async getNodeCount() {
    return this.page.$$eval(`${this.arrayWrap} .node`, (nodes) => nodes.length);
  }

  async getIterBadgeText() {
    return this.page.locator(this.iterBadge).innerText();
  }

  async getTargetBadgeText() {
    return this.page.locator(this.targetBadge).innerText();
  }

  async getLogText() {
    return this.page.$eval(this.log, (el) => el.innerText);
  }

  async getLogParagraphs() {
    return this.page.$$eval(`${this.log} p`, (ps) => ps.map(p => p.innerText));
  }

  async getBandStyle() {
    // Returns an object { left: 'xx%', right: 'yy%' }
    return this.page.$eval(this.band, (b) => ({ left: b.style.left, right: b.style.right }));
  }

  async hasFoundGlowShow() {
    return this.page.$eval(this.foundGlow, (el) => el.classList.contains('show'));
  }

  async hasHaloShow() {
    return this.page.$eval('#halo', (el) => el.classList.contains('show'));
  }

  async getNStatText() {
    return this.page.locator(this.nStat).innerText();
  }
}

test.describe('Binary Search — Visualized (FSM: Idle -> Running -> Completed)', () => {
  // Use a fresh page for each test provided by Playwright's fixtures.
  // We'll capture console messages and page errors in each test separately to avoid cross-test leakage.

  test('Initial Idle state: renderArray() and initial log are present', async ({ page }) => {
    // This test validates the S0_Idle state entry actions:
    // - renderArray() was called (we check nodes created)
    // - initial log message is present
    // - UI shows initial labels/stats
    const bsp = new BinarySearchPage(page);
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await bsp.goto();

    // Verify no page errors happened during load
    expect(pageErrors.length).toBe(0);

    // Check nodes rendered: expected 15 elements as in the implementation
    const nodeCount = await bsp.getNodeCount();
    expect(nodeCount).toBe(15);

    // Check nStat shows 15 as well
    const nStat = await bsp.getNStatText();
    expect(nStat).toBe('15');

    // Check initial badges and labels
    expect(await bsp.getIterBadgeText()).toBe('0');
    expect(await bsp.getBtnLabelText()).toBe('Animate');
    expect(await bsp.getTargetBadgeText()).toBe('—');

    // The initial log message is appended by the entry action
    const logText = await bsp.getLogText();
    expect(logText).toContain('Ready. Press Animate to begin a clear demonstration of binary search (one control).');

    // The band should be set to cover full array initially (left/right are strings ending with '%')
    const bandStyle = await bsp.getBandStyle();
    expect(bandStyle.left).toMatch(/%$/);
    expect(bandStyle.right).toMatch(/%$/);

    // No console-level errors should have been emitted
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Click Animate transitions to Running, animates, then completes to Completed', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Running on AnimateClick and S1_Running -> S2_Completed on AnimationComplete.
    // It also verifies entry actions: animateSearch() changes UI (btn disabled & label), iterBadge updates, and final "Animation complete." log.
    const bsp = new BinarySearchPage(page);
    const consoleTexts = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      // collect console text for assertions
      consoleTexts.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await bsp.goto();

    // Pre-click assertions
    expect(await bsp.getBtnLabelText()).toBe('Animate');
    expect(await bsp.getIterBadgeText()).toBe('0');

    // Click Animate to start animation
    await bsp.clickRun();

    // Immediately after clicking, the UI should enter Running state:
    // - button disabled
    // - label set to 'Running...'
    await page.waitForFunction(
      (sel) => document.querySelector(sel).textContent.trim() === 'Running...',
      {},
      bsp.btnLabel
    );
    expect(await bsp.isRunBtnDisabled()).toBe(true);
    expect(await bsp.getBtnLabelText()).toBe('Running...');

    // During running we expect iteration logs to be produced. Wait for at least one "Iteration" log paragraph (timeout chosen conservatively).
    await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        return el && el.innerText.includes('Iteration');
      },
      { timeout: 6000 },
      bsp.log
    );

    // Confirm iterBadge increased from 0 (should be at least '1')
    const iterTextDuring = await bsp.getIterBadgeText();
    const iterNumber = Number(iterTextDuring);
    expect(iterNumber).toBeGreaterThanOrEqual(1);

    // Also check that halo becomes visible at some point during running (visual feedback)
    // It's possible halo toggles on/off; we wait up to a few seconds for it to be shown at least once.
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && el.classList.contains('show');
      },
      { timeout: 6000 },
      '#halo'
    );
    expect(await bsp.hasHaloShow()).toBe(true);

    // Wait for end of animation: the code appends 'Animation complete.' to the log when done.
    await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        return el && el.innerText.includes('Animation complete.');
      },
      { timeout: 10000 },
      bsp.log
    );

    // After completion, button label should be 'Replay' and button should be enabled
    await page.waitForFunction(
      (sel) => document.querySelector(sel).textContent.trim() === 'Replay',
      {},
      bsp.btnLabel
    );
    expect(await bsp.getBtnLabelText()).toBe('Replay');
    expect(await bsp.isRunBtnDisabled()).toBe(false);

    // Logs should contain start, iteration(s), found message, and final completion message
    const logParagraphs = await bsp.getLogParagraphs();
    // Must contain 'Start binary search for target X.' (Start)
    expect(logParagraphs.some(p => p.startsWith('Start binary search for target'))).toBe(true);
    // Must contain at least one 'Iteration' message
    expect(logParagraphs.some(p => p.startsWith('Iteration'))).toBe(true);
    // Must contain 'Found target at index' message
    expect(logParagraphs.some(p => p.startsWith('Found target at index'))).toBe(true);
    // Must contain 'Animation complete.'
    expect(logParagraphs.some(p => p === 'Animation complete.')).toBe(true);

    // The target badge should now show a numeric value (the chosen target)
    const targetText = await bsp.getTargetBadgeText();
    expect(targetText).toMatch(/^\d+$/);

    // The found-glow should be visible in the DOM after a successful search
    const foundGlowShow = await bsp.hasFoundGlowShow();
    expect(foundGlowShow).toBe(true);

    // Ensure no uncaught page errors occurred
    expect(pageErrors.length).toBe(0);

    // No console 'error' messages
    const consoleErrors = consoleTexts.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking Animate while Running is ignored (guard prevents double-start)', async ({ page }) => {
    // This test validates the guard: runBtn.addEventListener('click', () => { if (running) return; animateSearch(); });
    // We assert that rapid double-click results in only one "Start binary search..." log entry (single animation).
    const bsp = new BinarySearchPage(page);
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await bsp.goto();

    // Rapidly click the button twice
    await bsp.clickRun();
    // Slightly delay the second click but still within the running phase
    await page.waitForTimeout(30);
    await bsp.clickRun();

    // Wait for animation to start and complete by observing completion message
    await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        return el && el.innerText.includes('Animation complete.');
      },
      { timeout: 10000 },
      bsp.log
    );

    // Extract log paragraphs
    const logs = await bsp.getLogParagraphs();

    // Count the number of start messages. There should be exactly one start "Start binary search for target X."
    const startCount = logs.filter(p => p.startsWith('Start binary search for target')).length;
    expect(startCount).toBe(1);

    // And there should be only one 'Animation complete.' corresponding to the one run
    const completeCount = logs.filter(p => p === 'Animation complete.').length;
    expect(completeCount).toBe(1);

    // No page errors occurred
    expect(pageErrors.length).toBe(0);

    // No console 'error' messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Resize event recomputes the band bounds during animation', async ({ page }) => {
    // This test validates the window resize handler which recomputes band bounds based on visible (non-dim) nodes.
    const bsp = new BinarySearchPage(page);
    const pageErrors = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await bsp.goto();

    // Capture initial band style
    const initialBand = await bsp.getBandStyle();

    // Start animation
    await bsp.clickRun();

    // Wait for first iteration to be logged so band has been updated by animateSearch
    await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        return el && el.innerText.includes('Iteration');
      },
      { timeout: 6000 },
      bsp.log
    );

    // Capture band during running (should have changed from initial possibly)
    const bandDuring = await bsp.getBandStyle();

    // Now simulate a resize: reduce viewport width to force recomputation
    const originalViewport = page.viewportSize() || { width: 1280, height: 720 };
    const newViewport = { width: Math.max(320, Math.floor(originalViewport.width / 2)), height: originalViewport.height };
    await page.setViewportSize(newViewport);

    // Allow some time for resize handler to execute and update band
    await page.waitForTimeout(300);

    const bandAfterResize = await bsp.getBandStyle();

    // The band style should be valid percentage values at each stage, and resize should result in a recomputed band (i.e., left/right strings present)
    expect(initialBand.left).toMatch(/%$/);
    expect(initialBand.right).toMatch(/%$/);
    expect(bandDuring.left).toMatch(/%$/);
    expect(bandDuring.right).toMatch(/%$/);
    expect(bandAfterResize.left).toMatch(/%$/);
    expect(bandAfterResize.right).toMatch(/%$/);

    // It's reasonable to expect that the band changed after resize (left/right values differ)
    const changed = initialBand.left !== bandAfterResize.left || initialBand.right !== bandAfterResize.right || bandDuring.left !== bandAfterResize.left || bandDuring.right !== bandAfterResize.right;
    expect(changed).toBe(true);

    // Cleanup: restore viewport (not strictly necessary but polite)
    await page.setViewportSize(originalViewport);

    // Wait for animation completion before finishing the test to avoid concurrent test interactions
    await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        return el && el.innerText.includes('Animation complete.');
      },
      { timeout: 10000 },
      bsp.log
    );

    // Ensure no page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Replay works repeatedly and logs multiple completions', async ({ page }) => {
    // This test checks that after completion, clicking Replay triggers animation again.
    // We assert that 'Animation complete.' appears multiple times across replays.
    const bsp = new BinarySearchPage(page);
    const pageErrors = [];
    await bsp.goto();
    page.on('pageerror', (err) => pageErrors.push(err));

    // Run first animation
    await bsp.clickRun();
    await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        return el && el.innerText.includes('Animation complete.');
      },
      { timeout: 10000 },
      bsp.log
    );

    // Click replay (button label should be 'Replay' now)
    await bsp.clickRun();

    // Wait for second completion
    await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        // We expect at least two occurrences of 'Animation complete.' in the log after second run.
        return el && (el.innerText.match(/Animation complete\./g) || []).length >= 2;
      },
      { timeout: 12000 },
      bsp.log
    );

    // Verify the log contains at least two completion messages
    const logText = await bsp.getLogText();
    const occurrences = (logText.match(/Animation complete\./g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);

    // Ensure no page errors occurred
    expect(pageErrors.length).toBe(0);
  });
});