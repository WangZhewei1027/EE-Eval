import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f45821-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object Model for the Doubly Linked List visualization page
class DllPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#playBtn');
    this.playLabel = page.locator('#playLabel');
    this.dirBtn = page.locator('#dirBtn');
    this.dirLabel = page.locator('#dirLabel');
    this.status = page.locator('#status');
    this.idxLabel = page.locator('#idxLabel');
    this.nodes = page.locator('.node');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getPlayAria() {
    return (await this.playBtn.getAttribute('aria-pressed')) ?? '';
  }

  async getPlayLabelText() {
    return (await this.playLabel.textContent())?.trim() ?? '';
  }

  async clickPlay() {
    await this.playBtn.click();
  }

  async getDirAria() {
    return (await this.dirBtn.getAttribute('aria-pressed')) ?? '';
  }

  async getDirLabelText() {
    return (await this.dirLabel.textContent())?.trim() ?? '';
  }

  async clickDir() {
    await this.dirBtn.click();
  }

  async getStatusText() {
    return (await this.status.textContent())?.trim() ?? '';
  }

  async getIdx() {
    const txt = (await this.idxLabel.textContent())?.trim() ?? '';
    const n = parseInt(txt, 10);
    return Number.isNaN(n) ? txt : n;
  }

  async getCurrentNodeIndexFromDOM() {
    // find .node.current and return its data-idx or index
    const count = await this.nodes.count();
    for (let i = 0; i < count; i++) {
      const n = this.nodes.nth(i);
      const hasClass = await n.evaluate((el) => el.classList.contains('current'));
      if (hasClass) {
        const idxAttr = await n.getAttribute('data-idx');
        return idxAttr !== null ? Number(idxAttr) : i;
      }
    }
    return null;
  }

  async waitForIdxToBe(expected, options = { timeout: 4000 }) {
    await expect.poll(async () => {
      return await this.getIdx();
    }, options).toBe(expected);
  }
}

test.describe('Doubly Linked List — Visual Concept (FSM and interactions)', () => {
  // Capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Intentionally observe console and page errors without modifying the page.
    page.context().setDefaultTimeout(12000);
  });

  test('Initial state: page loads and starts in Playing (S0_Playing) with traversal active', async ({ page }) => {
    // Collect console messages and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const app = new DllPage(page);
    // Load the page and let the inline scripts initialize
    await app.goto();

    // Wait for the initial layout and script initialization (script uses setTimeout(init,160))
    // Wait for the play button to be present
    await expect(app.playBtn).toBeVisible();

    // Validate play button initial attributes per implementation
    const playAria = await app.getPlayAria();
    const playLabel = await app.getPlayLabelText();
    expect(playAria).toBe('false'); // evidence: playing = true results in aria-pressed='false'
    expect(playLabel).toBe('Pause'); // initial label in markup and start() sets 'Pause'

    // Status should indicate traversing forward initially
    const statusText = await app.getStatusText();
    expect(statusText).toContain('Traversing →');

    // idxLabel should start at 0
    const idx = await app.getIdx();
    expect(idx).toBe(0);

    // The first node should have class 'current' in DOM
    const currentNode = await app.getCurrentNodeIndexFromDOM();
    expect(currentNode).toBe(0);

    // Because the visualization starts playing, within ~1300ms the index should advance to 1
    await app.waitForIdxToBe(1, { timeout: 5000 });

    // Assert no uncaught errors occurred during load and initial playback
    expect(pageErrors, `Expected no page errors during initial load, saw: ${pageErrors.map(e=>String(e)).join('\n')}`).toHaveLength(0);

    // Also assert that there are no console error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Play/Pause click toggles Playing <-> Paused and respects start()/stop() behavior', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => { consoleMessages.push({ type: msg.type(), text: msg.text() }); });
    page.on('pageerror', (err) => { pageErrors.push(err); });

    const app = new DllPage(page);
    await app.goto();
    await expect(app.playBtn).toBeVisible();

    // Ensure we are initially playing
    const initialPlayAria = await app.getPlayAria();
    expect(initialPlayAria).toBe('false');

    // Record current index and then click pause
    const beforeIdx = await app.getIdx();
    await app.clickPlay(); // should call stop()

    // After clicking, stop() sets aria-pressed='true' and label to 'Play'
    await expect.poll(async () => await app.getPlayAria(), { timeout: 2000 }).toBe('true');
    await expect.poll(async () => await app.getPlayLabelText(), { timeout: 2000 }).toBe('Play');

    // According to FSM, status might be expected to change to 'Paused', but implementation does not set status to 'Paused'
    // Here we assert the actual implemented behavior: traversal has paused (idx should not change)
    const idxAfterPause = await app.getIdx();
    // wait 1800ms (greater than step interval) and assert index remains same
    await page.waitForTimeout(1800);
    const idxAfterWait = await app.getIdx();
    expect(idxAfterWait).toBe(idxAfterPause);
    expect(idxAfterPause).toBe(beforeIdx);

    // Now click play again to resume (should call start())
    await app.clickPlay();
    await expect.poll(async () => await app.getPlayAria(), { timeout: 2000 }).toBe('false');
    await expect.poll(async () => await app.getPlayLabelText(), { timeout: 2000 }).toBe('Pause');

    // After resuming, the index should advance from the paused index
    const idxBeforeResumeAdvance = await app.getIdx();
    await app.waitForIdxToBe(((idxBeforeResumeAdvance + 1) % 7), { timeout: 5000 });

    // Verify no page errors or console errors occurred
    expect(pageErrors).toHaveLength(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Direction toggle (dirBtn) changes direction label and aria-pressed and affects traversal direction', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => { consoleMessages.push({ type: msg.type(), text: msg.text() }); });
    page.on('pageerror', (err) => { pageErrors.push(err); });

    const app = new DllPage(page);
    await app.goto();
    await expect(app.playBtn).toBeVisible();
    await expect(app.dirBtn).toBeVisible();

    // Pause the traversal to capture deterministic current index
    const playAriaBefore = await app.getPlayAria();
    if (playAriaBefore === 'false') {
      // currently playing -> click to pause
      await app.clickPlay();
      await expect.poll(async () => await app.getPlayAria(), { timeout: 2000 }).toBe('true');
    }

    // Capture current index while paused
    const pausedIdx = await app.getIdx();
    // Capture current direction label and aria
    const dirLabelBefore = await app.getDirLabelText();
    const dirAriaBefore = await app.getDirAria();

    // Toggle direction
    await app.clickDir();

    // After toggle, dirLabel should change to the opposite text
    const dirLabelAfter = await app.getDirLabelText();
    expect(dirLabelAfter === dirLabelBefore).toBe(false);

    // aria-pressed is set to String(!forward) in implementation. We cannot read 'forward' variable, but we can assert aria toggled between 'true'/'false' string values.
    const dirAriaAfter = await app.getDirAria();
    expect(dirAriaAfter === dirAriaBefore).toBe(false);

    // Now resume traversal and validate that the next step moves in the new direction.
    // Compute expected index after one step: if direction was toggled to Reverse, expected = (pausedIdx - 1 + 7) % 7; else if toggled to Forward expected = (pausedIdx + 1) % 7
    // Determine whether label indicates Reverse now
    const isNowReverse = dirLabelAfter.includes('Reverse');
    const expectedIdxAfterOneStep = isNowReverse ? ((pausedIdx - 1 + 7) % 7) : ((pausedIdx + 1) % 7);

    // Resume playback
    await app.clickPlay();
    await expect.poll(async () => await app.getPlayAria(), { timeout: 2000 }).toBe('false');

    // Wait for one step to occur and assert index progressed in expected direction
    await app.waitForIdxToBe(expectedIdxAfterOneStep, { timeout: 6000 });

    // Final sanity: status text should reflect direction arrow after a highlight occurs
    const statusText = await app.getStatusText();
    if (isNowReverse) {
      expect(statusText).toContain('Traversing ←');
    } else {
      expect(statusText).toContain('Traversing →');
    }

    // No page errors or console errors are expected
    expect(pageErrors).toHaveLength(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: rapid toggling and window resize do not throw runtime errors', async ({ page }) => {
    // This test validates robustness: rapid clicks and resize should not produce uncaught errors.
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => { consoleMessages.push({ type: msg.type(), text: msg.text() }); });
    page.on('pageerror', (err) => { pageErrors.push(err); });

    const app = new DllPage(page);
    await app.goto();
    await expect(app.playBtn).toBeVisible();
    await expect(app.dirBtn).toBeVisible();

    // Rapidly toggle direction multiple times
    for (let i = 0; i < 6; i++) {
      await app.clickDir();
      // tiny delay to simulate user spamming but allow browser to process
      await page.waitForTimeout(60);
    }

    // Rapidly toggle play/pause multiple times
    for (let i = 0; i < 6; i++) {
      await app.clickPlay();
      await page.waitForTimeout(60);
    }

    // Force a window resize event to trigger resize handlers (resizeSvg, renderArrows)
    // Changing viewport size will trigger the page's resize listener
    const originalViewport = page.viewportSize() || { width: 1280, height: 720 };
    await page.setViewportSize({ width: originalViewport.width - 100, height: originalViewport.height - 80 });
    // Give handlers time to run
    await page.waitForTimeout(300);
    // Restore viewport
    await page.setViewportSize(originalViewport);
    await page.waitForTimeout(300);

    // Confirm that no runtime page errors happened during the stress interactions
    // We specifically check for ReferenceError, SyntaxError, TypeError occurrences.
    const hasFatalErrors = pageErrors.some(err => {
      const msg = String(err || '');
      return /ReferenceError|SyntaxError|TypeError/.test(msg);
    });

    expect(hasFatalErrors).toBe(false);

    // Also assert there are no console error messages logged
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('DOM integrity checks: arrows SVG paths and node counts are present and consistent', async ({ page }) => {
    // This test validates the expected DOM components exist and basic relationships.
    const pageErrors = [];
    page.on('pageerror', (err) => { pageErrors.push(err); });

    const app = new DllPage(page);
    await app.goto();

    // nodes count should be 7 as in markup
    const nodesCount = await app.nodes.count();
    expect(nodesCount).toBe(7);

    // SVG overlay should exist and have some children after initialization (renderArrows runs)
    const svgLocator = page.locator('#arrows-svg');
    await expect(svgLocator).toBeVisible();

    // Wait briefly for arrows to be rendered (renderArrows is called in init timeout)
    await page.waitForTimeout(400);
    const svgChildCount = await svgLocator.evaluate((el) => el.childNodes.length);
    // There should be at least some path/dot children (each adjacent pair creates 2 paths + 2 dots, so > 0)
    expect(svgChildCount).toBeGreaterThan(0);

    // Verify each node has its expected sub-elements (.idx, .val, .ptr)
    for (let i = 0; i < nodesCount; i++) {
      const node = page.locator('.node').nth(i);
      await expect(node.locator('.idx')).toBeVisible();
      await expect(node.locator('.val')).toBeVisible();
      await expect(node.locator('.ptr')).toBeVisible();
    }

    // Ensure no page errors occurred while inspecting DOM
    expect(pageErrors).toHaveLength(0);
  });
});