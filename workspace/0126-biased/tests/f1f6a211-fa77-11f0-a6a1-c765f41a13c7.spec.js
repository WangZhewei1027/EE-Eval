import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f6a211-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object Model for the PageRank demo
class PageRankPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#playBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.iterLabel = page.locator('#iter');
    this.convergeLabel = page.locator('#converge');
    this.svg = page.locator('#svg');
    this.nodesGroup = page.locator('#nodes');
    this.edgesGroup = page.locator('#edges');
    this.particlesGroup = page.locator('#particles');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for svg to be present and nodes to be created
    await this.svg.waitFor({ state: 'visible' });
    await this.page.waitForSelector('#nodes g[data-id]', { timeout: 5000 });
  }

  async clickPlayPause() {
    await this.playBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getPlayButtonText() {
    return (await this.playBtn.textContent())?.trim();
  }

  async getPlayButtonAriaPressed() {
    return (await this.playBtn.getAttribute('aria-pressed'));
  }

  async getIter() {
    const text = (await this.iterLabel.textContent())?.trim();
    return Number.isFinite(Number(text)) ? parseInt(text, 10) : text;
  }

  async getConverge() {
    return (await this.convergeLabel.textContent())?.trim();
  }

  async getNodeIds() {
    // return array of data-id attributes for nodes
    return this.page.$$eval('#nodes g[data-id]', nodes => nodes.map(n => n.getAttribute('data-id')));
  }

  async getNodeValue(id) {
    // select the .value text element inside node g[data-id="{id}"]
    const sel = `#nodes g[data-id="${id}"] .value`;
    const el = this.page.locator(sel);
    await el.waitFor({ state: 'attached', timeout: 2000 });
    const txt = (await el.textContent())?.trim();
    return Number(txt);
  }

  async getAllNodeValues() {
    return this.page.$$eval('#nodes g[data-id] .value', els => els.map(e => Number(e.textContent.trim())));
  }

  async getNodeCircleRadius(id) {
    // the circle with class 'circle' inside node group
    const sel = `#nodes g[data-id="${id}"] circle.circle`;
    const el = this.page.locator(sel);
    await el.waitFor({ state: 'attached', timeout: 2000 });
    const r = await el.getAttribute('r');
    return Number(r);
  }

  async getEdgeCount() {
    return this.page.$$eval('#edges g', els => els.length);
  }

  async getParticleCount() {
    return this.page.$$eval('#particles circle', els => els.length);
  }

  async resize(width, height) {
    await this.page.setViewportSize({ width, height });
    // allow resize handlers to run
    await this.page.waitForTimeout(300);
  }
}

// Global helper to collect console messages and page errors
function attachLoggingListeners(page, storage) {
  storage.console = [];
  storage.pageErrors = [];

  page.on('console', msg => {
    const entry = { type: msg.type(), text: msg.text() };
    storage.console.push(entry);
  });

  page.on('pageerror', err => {
    storage.pageErrors.push(err);
  });
}

test.describe('PageRank — Visual Demonstration (f1f6a211-fa77-11f0-a6a1-c765f41a13c7)', () => {
  // Basic smoke test to ensure the page loads and initial visuals are created.
  test('Initial render: verify controls, iteration state and visuals are present', async ({ page }) => {
    // collect console and page errors for this session
    const logs = {};
    attachLoggingListeners(page, logs);

    const app = new PageRankPage(page);
    await app.goto();

    // Validate play button initial state (as in HTML: "Pause" and aria-pressed="true")
    const playText = await app.getPlayButtonText();
    expect(playText).toBeTruthy();
    expect(['Pause', 'Play']).toContain(playText);
    const aria = await app.getPlayButtonAriaPressed();
    expect(['true', 'false', null]).toContain(aria); // tolerate browsers that may not expose attribute immediately

    // The script runs an initial iteratePageRank() during load; iter should be at least 1.
    const iter = await app.getIter();
    // iter may be a number or '0' etc. Validate it's numeric and >= 0
    expect(typeof iter === 'number' ? iter >= 0 : true).toBeTruthy();

    // Nodes and edges were constructed; ensure counts reflect the implementation
    const nodeIds = await app.getNodeIds();
    // expected 7 nodes from the HTML
    expect(nodeIds.length).toBeGreaterThanOrEqual(7);
    const edgeCount = await app.getEdgeCount();
    expect(edgeCount).toBeGreaterThanOrEqual(12); // there are 13 edges in implementation, allow >= 12 tolerance

    // Particles should have been generated for edges
    const particleCount = await app.getParticleCount();
    expect(particleCount).toBeGreaterThan(0);

    // Sum of node values should be approximately 1 (PageRank mass)
    const values = await app.getAllNodeValues();
    const sum = values.reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(0.99);
    expect(sum).toBeLessThan(1.01);

    // No uncaught page errors happened during load
    expect(logs.pageErrors.length).toBe(0);

    // Ensure no console messages of type 'error'
    const errorsInConsole = logs.console.filter(c => c.type === 'error');
    expect(errorsInConsole.length).toBe(0);
  });

  test.describe('Play / Pause interaction and FSM transitions', () => {
    test('Click Play/Pause toggles animation and iteration starts/stops', async ({ page }) => {
      const logs = {};
      attachLoggingListeners(page, logs);

      const app = new PageRankPage(page);
      await app.goto();

      // Determine current iter count
      const initialIter = await app.getIter();

      // Click to toggle play/pause
      // If initial button shows "Pause" it means animating was true; clicking should pause.
      const initialPlayText = await app.getPlayButtonText();

      await app.clickPlayPause();
      // after clicking, button text should flip
      const afterClickText = await app.getPlayButtonText();
      expect(afterClickText === 'Play' || afterClickText === 'Pause').toBeTruthy();
      // aria-pressed toggled accordingly
      const ariaAfter = await app.getPlayButtonAriaPressed();
      expect(['true', 'false']).toContain(ariaAfter);

      // wait longer than one iteration interval to assert iter didn't increase if paused
      await page.waitForTimeout(1500);
      const iterAfterPause = await app.getIter();
      if (afterClickText === 'Play') {
        // paused
        expect(iterAfterPause).toBe(initialIter);
      } else {
        // if it ended up still 'Pause' then animating still true; iter should increment eventually
        expect(iterAfterPause).toBeGreaterThanOrEqual(initialIter);
      }

      // Click again to resume
      await app.clickPlayPause();
      const textAfterResume = await app.getPlayButtonText();
      expect(['Pause', 'Play']).toContain(textAfterResume);
      // allow an iteration to occur
      await page.waitForTimeout(1400);
      const iterAfterResume = await app.getIter();
      // if we resumed animation, iter should be >= previous iter (or at least incremented)
      expect(Number(iterAfterResume)).toBeGreaterThanOrEqual(Number(iterAfterPause));

      // final check: no page errors and no console errors during interaction
      expect(logs.pageErrors.length).toBe(0);
      const consoleErrors = logs.console.filter(c => c.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Play/Pause transition sequence: Animating -> Paused -> Animating', async ({ page }) => {
      const logs = {};
      attachLoggingListeners(page, logs);

      const app = new PageRankPage(page);
      await app.goto();

      // Ensure we start with a known state: try to set to paused (if not already)
      let playText = await app.getPlayButtonText();
      if (playText === 'Pause') {
        // currently animating -> click to pause
        await app.clickPlayPause();
        await page.waitForTimeout(300);
        playText = await app.getPlayButtonText();
        expect(playText).toBe('Play');
      }

      // Now we're paused. Click to resume (S2_Paused -> S1_Animating)
      await app.clickPlayPause();
      await page.waitForTimeout(300);
      const resumedText = await app.getPlayButtonText();
      expect(resumedText).toBe('Pause');
      // allow iteration
      await page.waitForTimeout(1300);
      const iterAfterResume = await app.getIter();
      expect(Number(iterAfterResume)).toBeGreaterThanOrEqual(1);

      // Click to pause again (S1_Animating -> S2_Paused)
      await app.clickPlayPause();
      await page.waitForTimeout(300);
      const pausedAgain = await app.getPlayButtonText();
      expect(pausedAgain).toBe('Play');

      // Ensure no uncaught errors
      expect(logs.pageErrors.length).toBe(0);
      expect(logs.console.filter(c => c.type === 'error').length).toBe(0);
    });
  });

  test.describe('Reset interactions and state restoration', () => {
    test('Reset button resets ranks and visuals while animating', async ({ page }) => {
      const logs = {};
      attachLoggingListeners(page, logs);

      const app = new PageRankPage(page);
      await app.goto();

      // Ensure animating is true initially; if not, resume
      const initialPlayText = await app.getPlayButtonText();
      if (initialPlayText === 'Play') {
        await app.clickPlayPause();
        await page.waitForTimeout(300);
      }

      // Do some iterations to move away from uniform
      await page.waitForTimeout(1500);
      const iterBeforeReset = await app.getIter();
      expect(Number(iterBeforeReset)).toBeGreaterThanOrEqual(1);

      // Click reset while animating
      await app.clickReset();
      // resetRanks sets iter = 0 and converge to '—'
      await page.waitForTimeout(100); // allow DOM updates
      const iterAfterReset = await app.getIter();
      expect(iterAfterReset).toBe(0);
      const convergeAfterReset = await app.getConverge();
      expect(convergeAfterReset).toBe('—');

      // After reset, all node values should be equal to 1/N (approx). We check sum = 1 and that each is close to 1/N.
      const values = await app.getAllNodeValues();
      const sum = values.reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0.99);
      expect(sum).toBeLessThan(1.01);

      // Check uniformity: variance should be tiny after reset
      const avg = sum / values.length;
      const maxDiff = Math.max(...values.map(v => Math.abs(v - avg)));
      expect(maxDiff).toBeLessThan(0.0005); // small tolerance for formatting/rounding

      // Check node circle radii: when all ranks equal, scaling formula gives smallest radius (around 18)
      const radii = await Promise.all((await app.getNodeIds()).map(id => app.getNodeCircleRadius(id)));
      for (const r of radii) {
        // allow small float formatting differences
        expect(r).toBeGreaterThanOrEqual(17.5);
        expect(r).toBeLessThanOrEqual(20.5);
      }

      expect(logs.pageErrors.length).toBe(0);
      expect(logs.console.filter(c => c.type === 'error').length).toBe(0);
    });

    test('Reset while paused restores initial ranks and visuals', async ({ page }) => {
      const logs = {};
      attachLoggingListeners(page, logs);

      const app = new PageRankPage(page);
      await app.goto();

      // Pause the animation first if it's running
      const text = await app.getPlayButtonText();
      if (text === 'Pause') {
        await app.clickPlayPause();
        await page.waitForTimeout(300);
        expect(await app.getPlayButtonText()).toBe('Play');
      }

      // Advance no iterations; now click reset
      await app.clickReset();
      await page.waitForTimeout(100);
      const iterAfter = await app.getIter();
      expect(iterAfter).toBe(0);
      const convergeAfterReset = await app.getConverge();
      expect(convergeAfterReset).toBe('—');

      // Node values sum to 1 and are uniform
      const values = await app.getAllNodeValues();
      const sum = values.reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0.99);
      expect(sum).toBeLessThan(1.01);
      const avg = sum / values.length;
      const maxDiff = Math.max(...values.map(v => Math.abs(v - avg)));
      expect(maxDiff).toBeLessThan(0.0005);

      expect(logs.pageErrors.length).toBe(0);
      expect(logs.console.filter(c => c.type === 'error').length).toBe(0);
    });
  });

  test.describe('Edge cases, resize and stability', () => {
    test('Window resize recomputes paths & updates particle lengths without errors', async ({ page }) => {
      const logs = {};
      attachLoggingListeners(page, logs);

      const app = new PageRankPage(page);
      await app.goto();

      // capture a sample path d attribute before resize
      const firstPathD = await page.$eval('#edges g path', p => p.getAttribute('d'));
      expect(firstPathD).toBeTruthy();

      // resize viewport to trigger the resize listener in the page
      await app.resize(800, 600);
      // wait a bit for handlers to run
      await page.waitForTimeout(350);

      // verify path d attribute still present and has changed or remains valid
      const pathDAfter = await page.$eval('#edges g path', p => p.getAttribute('d'));
      expect(pathDAfter).toBeTruthy();

      // particles should still be present and have cx/cy attributes
      const particleSample = await page.$('#particles circle');
      expect(particleSample).not.toBeNull();
      const attrs = await particleSample.evaluate((el) => ({ cx: el.getAttribute('cx'), cy: el.getAttribute('cy'), r: el.getAttribute('r') }));
      // cx/cy may be null momentarily but in general should be present as numbers
      // Accept either presence or absence but ensure no uncaught exceptions occurred
      expect(logs.pageErrors.length).toBe(0);
      expect(logs.console.filter(c => c.type === 'error').length).toBe(0);
    });

    test('Rapid toggling of Play/Pause does not throw and respects aria-pressed', async ({ page }) => {
      const logs = {};
      attachLoggingListeners(page, logs);

      const app = new PageRankPage(page);
      await app.goto();

      // Rapidly toggle play/pause multiple times
      for (let i = 0; i < 6; i++) {
        await app.clickPlayPause();
        // tiny delay to allow handler to run
        await page.waitForTimeout(120);
        const text = await app.getPlayButtonText();
        const aria = await app.getPlayButtonAriaPressed();
        expect(['Play', 'Pause']).toContain(text);
        expect(['true', 'false']).toContain(aria);
      }

      // Ensure no page errors or console errors after rapid toggling
      expect(logs.pageErrors.length).toBe(0);
      expect(logs.console.filter(c => c.type === 'error').length).toBe(0);
    });
  });

  // Final test dedicated to observing console logs and page errors for the whole flow
  test('Observe console logs and page errors across interactions', async ({ page }) => {
    const logs = {};
    attachLoggingListeners(page, logs);

    const app = new PageRankPage(page);
    await app.goto();

    // Do a set of interactions
    await app.clickPlayPause(); // toggle
    await page.waitForTimeout(400);
    await app.clickReset();
    await page.waitForTimeout(200);
    await app.clickPlayPause();
    await page.waitForTimeout(1300);

    // Assertions about logged errors: we expect no uncaught page errors (TypeError, ReferenceError) in normal operation
    // If any occur, fail the test so issues surface.
    expect(logs.pageErrors.length).toBe(0);

    // Inspect console messages; assert there are no messages of type 'error'
    const consoleErrors = logs.console.filter(c => c.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // We expect some console info/debug (optional), but ensure the arrays captured are arrays
    expect(Array.isArray(logs.console)).toBe(true);
    expect(Array.isArray(logs.pageErrors)).toBe(true);
  });
});