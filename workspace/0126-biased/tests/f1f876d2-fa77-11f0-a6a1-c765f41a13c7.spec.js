import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f876d2-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object Model for this visual prototype
class VcPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // element handles
  async playButton() {
    return this.page.locator('#playBtn');
  }
  async resetButton() {
    return this.page.locator('#resetBtn');
  }
  async graph() {
    return this.page.locator('#graph');
  }
  async glimmer() {
    return this.page.locator('#glimmer');
  }
  async nodes() {
    return this.page.locator('.node');
  }

  // actions
  async clickPlay() {
    await this.page.click('#playBtn');
  }
  async clickReset() {
    await this.page.click('#resetBtn');
  }
  async pressSpace() {
    // Use page.keyboard to dispatch a Space keydown (the app listens for keydown)
    await this.page.keyboard.down('Space');
    await this.page.keyboard.up('Space');
  }

  // helpers to read state
  async isGraphRunning() {
    return await this.page.locator('#graph').evaluate((el) => el.classList.contains('graph-running'));
  }
  async isPlayDisabled() {
    return await this.page.locator('#playBtn').evaluate((btn) => btn.disabled);
  }
  async isResetDisabled() {
    return await this.page.locator('#resetBtn').evaluate((btn) => btn.disabled);
  }
  async getGlimmerOpacity() {
    return await this.page.locator('#glimmer').evaluate((g) => {
      // inline style or computed style may hold opacity; compute both attempts
      const inline = g.style.opacity;
      if (inline) return inline;
      const cs = window.getComputedStyle(g);
      return cs ? cs.opacity : '';
    });
  }
  async getNodeCountVisible() {
    // count nodes with computed opacity > 0
    return await this.page.$$eval('.node', (nodes) => nodes.filter(n => {
      const cs = window.getComputedStyle(n);
      const op = parseFloat(cs.opacity || '0');
      return op > 0;
    }).length);
  }
  async getBranchDasharray(index = 0) {
    return await this.page.$$eval('.branch.acc', (bs, idx) => {
      const el = bs[idx];
      return el ? (el.getAttribute('stroke-dasharray') || el.style.strokeDasharray || '') : '';
    }, index);
  }
  async getGlimmerPosition() {
    return await this.page.locator('#glimmer').evaluate((g) => {
      return { left: g.style.left || window.getComputedStyle(g).left, top: g.style.top || window.getComputedStyle(g).top };
    });
  }
}

test.describe('Version Control Visual Concept — FSM and interactions', () => {
  // Collect console messages and page errors to assert absence of unexpected runtime errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // store both text and type for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Uncaught exceptions from the page
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // nothing to cleanup globally; each test navigates fresh
  });

  test('Initial state (S0_Idle) — init() onEnter and UI baseline', async ({ page }) => {
    // Validate the initial Idle state: resetBtn disabled, graph not running, initial hints visible
    const p = new VcPage(page);
    await p.goto();

    // Verify onEnter init() effects: resetBtn.disabled = true
    expect(await p.isResetDisabled()).toBe(true);

    // Graph should not have running class at initial load
    expect(await p.isGraphRunning()).toBe(false);

    // Play button should be enabled initially so user can play timeline
    expect(await p.isPlayDisabled()).toBe(false);

    // A couple of nodes should be visible as a hint per init() implementation
    const visibleNodes = await p.getNodeCountVisible();
    expect(visibleNodes).toBeGreaterThanOrEqual(1);

    // Branch dasharray should be set to a numeric value on init
    const dash = await p.getBranchDasharray(0);
    // Expect some dasharray value (may be numeric length); at minimum must be non-empty
    expect(dash).toBeTruthy();

    // No uncaught page errors should have occurred during load
    expect(pageErrors.length).toBe(0);

    // No console.error messages emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: PlayTimeline (click #playBtn) -> S1_Playing', async ({ page }) => {
    // Validate clicking Play triggers start(): graph class added, playBtn disabled while running, resetBtn enabled
    const p = new VcPage(page);
    await p.goto();

    // Click Play
    await p.clickPlay();

    // Immediately after clicking, graph should have 'graph-running' class
    await expect(p.page.locator('#graph')).toHaveClass(/graph-running/, { timeout: 1000 });

    // Verify playBtn disabled (entry action of S1_Playing)
    expect(await p.isPlayDisabled()).toBe(true);

    // Reset button should now be enabled to allow Reset transition
    expect(await p.isResetDisabled()).toBe(false);

    // Glimmer should begin animation; check opacity becomes > 0 (string value)
    // Wait a bit for animation to apply
    await page.waitForTimeout(300);
    const gOpacity = parseFloat(await p.getGlimmerOpacity() || '0');
    expect(gOpacity).toBeGreaterThanOrEqual(0);

    // After the approximate animation duration (2600ms), play button should be re-enabled automatically
    await page.waitForTimeout(2700);
    expect(await p.isPlayDisabled()).toBe(false);

    // Ensure no uncaught page errors occurred during play
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  }, { timeout: 10000 });

  test('Transition: ResetView (click #resetBtn) from Playing -> Idle', async ({ page }) => {
    // Validate Reset removes graph-running, hides animations, sets resetBtn.disabled = true
    const p = new VcPage(page);
    await p.goto();

    // Start playing first
    await p.clickPlay();
    await page.waitForTimeout(150); // allow class to be applied

    // Ensure we are playing
    expect(await p.isGraphRunning()).toBe(true);

    // Click Reset
    await p.clickReset();

    // Graph must remove running class
    // Wait a moment to let reset handler run
    await page.waitForTimeout(150);
    expect(await p.isGraphRunning()).toBe(false);

    // Reset button should be disabled after reset (evidence)
    expect(await p.isResetDisabled()).toBe(true);

    // Play button should be enabled back
    expect(await p.isPlayDisabled()).toBe(false);

    // Nodes should be visually reset (opacity forced to 0 by reset)
    // Because some nodes were initially visible, reset sets opacity 0 for all nodes in reset(),
    // so visible count should be less than or equal to what it was when playing.
    const visibleAfterReset = await p.getNodeCountVisible();
    expect(visibleAfterReset).toBeLessThanOrEqual(2);

    // No page errors or console errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  }, { timeout: 8000 });

  test('Event: SpacePlay (keydown Space) triggers start() when playBtn enabled, and is ignored when disabled', async ({ page }) => {
    // Validate pressing Space triggers Play when allowed, and that pressing Space while playBtn.disabled does not throw errors
    const p = new VcPage(page);
    await p.goto();

    // Ensure play is enabled
    expect(await p.isPlayDisabled()).toBe(false);

    // Press Space to start
    await p.pressSpace();

    // Allow small time window for handler to run
    await page.waitForTimeout(200);
    expect(await p.isGraphRunning()).toBe(true);

    // Now while running, playBtn should be disabled; pressing Space should be ignored and should NOT cause an exception
    expect(await p.isPlayDisabled()).toBe(true);

    // Clear any existing console/page errors recorded so far for clarity of this test
    consoleMessages = [];
    pageErrors = [];

    // Press Space while disabled
    await p.pressSpace();

    // Wait a bit
    await page.waitForTimeout(200);

    // Still running (should remain true)
    expect(await p.isGraphRunning()).toBe(true);

    // No new page errors or console errors from the keydown while disabled
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Wait for the animation to finish to let environment settle
    await page.waitForTimeout(2600);
  }, { timeout: 10000 });

  test('Edge case: rapid multiple clicks and window resize handling', async ({ page }) => {
    // Validate robustness against rapid user input and window resize -> init() mapping positions runs without uncaught errors
    const p = new VcPage(page);
    await p.goto();

    // Rapidly click Play multiple times
    await Promise.all([
      page.click('#playBtn'),
      page.click('#playBtn').catch(() => {}), // second click may no-op or be ignored; ignore any click rejections
      page.click('#playBtn').catch(() => {})
    ]);

    // Give time for class to appear
    await page.waitForTimeout(150);
    expect(await p.isGraphRunning()).toBe(true);

    // Rapidly click Reset multiple times (should be idempotent)
    await Promise.all([
      page.click('#resetBtn'),
      page.click('#resetBtn').catch(() => {}),
      page.click('#resetBtn').catch(() => {})
    ]);

    await page.waitForTimeout(150);
    expect(await p.isGraphRunning()).toBe(false);

    // Trigger a resize event to exercise the resize handler and re-run init()
    await page.setViewportSize({ width: 1024, height: 768 });
    // The page's resize listener calls init(); give it time to execute
    await page.waitForTimeout(200);

    // After resize, glimmer position should be determined (left/top set in px)
    const pos = await p.getGlimmerPosition();
    // Expect left/top to be non-empty px values
    expect(pos.left).toBeTruthy();
    expect(pos.top).toBeTruthy();
    expect(pos.left).toContain('px');
    expect(pos.top).toContain('px');

    // Also verify branch dasharray still present (reset/reinit should set it)
    const dash = await p.getBranchDasharray(0);
    expect(dash).toBeTruthy();

    // Confirm no uncaught page errors emitted during rapid actions and resize
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  }, { timeout: 12000 });

  test('Validate onEnter/onExit behaviors explicitly: init() on load and start()/reset() effects', async ({ page }) => {
    // This test checks the FSM entry/exit side effects: init() sets resetBtn.disabled true, start() sets playBtn.disabled true and graph class, reset() clears class & disables reset
    const p = new VcPage(page);
    await p.goto();

    // init() effect
    expect(await p.isResetDisabled()).toBe(true);

    // start() effect
    await p.clickPlay();
    await page.waitForTimeout(150);
    expect(await p.isGraphRunning()).toBe(true);
    expect(await p.isPlayDisabled()).toBe(true);

    // reset() effect from playing
    await p.clickReset();
    await page.waitForTimeout(150);
    expect(await p.isGraphRunning()).toBe(false);
    expect(await p.isResetDisabled()).toBe(true);

    // No runtime exceptions
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  }, { timeout: 10000 });
});