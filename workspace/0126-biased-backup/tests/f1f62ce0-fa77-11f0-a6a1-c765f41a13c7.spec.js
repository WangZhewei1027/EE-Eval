import { test, expect } from '@playwright/test';

const PAGE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f62ce0-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object to encapsulate interactions and queries against the visualization page
class TernaryVizPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pageErrors = [];
    this.consoleErrors = [];

    // collect runtime errors and console errors for assertions
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
  }

  async goto() {
    await this.page.goto(PAGE_URL, { waitUntil: 'load' });
    // ensure initial DOM is present
    await expect(this.page.locator('#toggleBtn')).toBeVisible();
    await expect(this.page.locator('#resetBtn')).toBeVisible();
    // wait for nodes to be rendered by initial reset()
    await this.page.waitForSelector('.node', { timeout: 5000 });
  }

  // Controls
  async clickToggle() {
    await this.page.click('#toggleBtn');
  }
  async clickReset() {
    await this.page.click('#resetBtn');
  }
  async pressSpace() {
    await this.page.keyboard.press(' ');
  }
  async pressR() {
    await this.page.keyboard.press('r');
  }

  // Observers
  async getExStepText() {
    return (await this.page.locator('#exStep').innerText()).trim();
  }
  async getExplainText() {
    return (await this.page.locator('#explainText').innerText()).trim();
  }
  async getToggleLabel() {
    return (await this.page.locator('#toggleLabel').innerText()).trim();
  }
  async toggleHasActive() {
    const cls = await this.page.locator('#toggleBtn').getAttribute('class');
    return typeof cls === 'string' && cls.split(/\s+/).includes('active');
  }
  async getStepCount() {
    return (await this.page.locator('#stepCount').innerText()).trim();
  }
  async getLIdx() {
    return (await this.page.locator('#lIdx').innerText()).trim();
  }
  async getRIdx() {
    return (await this.page.locator('#rIdx').innerText()).trim();
  }
  async getTargetValue() {
    return (await this.page.locator('#targetValue').innerText()).trim();
  }
  async nodeCount() {
    return await this.page.locator('.node').count();
  }
  async nodeHasClass(index, cls) {
    const node = this.page.locator('.node').nth(index);
    const classes = (await node.getAttribute('class')) || '';
    return classes.split(/\s+/).includes(cls);
  }
  async anyNodeHasClass(cls) {
    const nodes = this.page.locator('.node');
    const count = await nodes.count();
    for (let i = 0; i < count; i++) {
      const classes = (await nodes.nth(i).getAttribute('class')) || '';
      if (classes.split(/\s+/).includes(cls)) return true;
    }
    return false;
  }
  async getLeftCutWidth() {
    const val = await this.page.locator('#leftCut').evaluate((el) => getComputedStyle(el).width);
    return val;
  }
  async getRightCutWidth() {
    const val = await this.page.locator('#rightCut').evaluate((el) => getComputedStyle(el).width);
    return val;
  }

  // Wait until step 1 compare is visible (highlight step)
  async waitForFirstCompare(timeout = 5000) {
    // exStep becomes "Step 1: Compare"
    await this.page.waitForFunction(() => {
      const el = document.getElementById('exStep');
      return el && /Step\s*1:?\s*Compare/i.test(el.textContent || '');
    }, null, { timeout });
    // ensure m1 and m2 classes applied to some nodes
    await this.page.waitForFunction(() => {
      const nodes = Array.from(document.querySelectorAll('.node'));
      return nodes.some(n => n.classList.contains('m1')) && nodes.some(n => n.classList.contains('m2'));
    }, null, { timeout });
  }

  // Wait until the visualization completes (Found | Not Found | Done)
  async waitForCompletion(timeout = 30000) {
    await this.page.waitForFunction(() => {
      const t = document.getElementById('exStep');
      if (!t) return false;
      const txt = (t.textContent || '').toLowerCase();
      return txt.includes('found') || txt.includes('not found') || txt.includes('done');
    }, null, { timeout });
  }

  getCollectedPageErrors() {
    return this.pageErrors;
  }
  getCollectedConsoleErrors() {
    return this.consoleErrors;
  }
}

test.describe('Ternary Search Visualization (f1f62ce0...) - FSM validation', () => {
  let viz;

  test.beforeEach(async ({ page }) => {
    viz = new TernaryVizPage(page);
    await viz.goto();
  });

  test.afterEach(async ({}, testInfo) => {
    // On failure, surface any page errors / console error messages for debugging
    if (testInfo.status !== testInfo.expectedStatus) {
      // print details to test logs (Playwright will include stderr)
      // eslint-disable-next-line no-console
      console.log('Page errors:', viz.getCollectedPageErrors());
      // eslint-disable-next-line no-console
      console.log('Console errors:', viz.getCollectedConsoleErrors());
    }
    // Always assert that no uncaught page errors occurred during the test execution
    expect(viz.getCollectedPageErrors().length, 'No uncaught runtime errors should have occurred').toBe(0);
    expect(viz.getCollectedConsoleErrors().length, 'No console.error messages should have been emitted').toBe(0);
  });

  test('Initial Ready state (S0_Ready) - reset() executed on load', async () => {
    // The page calls reset() on boot. Validate the initial ready state:
    // - exStep shows "Ready"
    // - stepCount is 0
    // - bounds show full interval [0 .. 18] (N = 19 -> r = 18)
    // - toggle button is not active and shows "Animate"
    // - nodes are present and target value is displayed (not the placeholder "—")
    const exStep = await viz.getExStepText();
    expect(exStep).toMatch(/ready/i);

    const step = await viz.getStepCount();
    expect(step).toBe('0');

    const lIdx = await viz.getLIdx();
    const rIdx = await viz.getRIdx();
    expect(lIdx).toBe('0');
    expect(rIdx).toBe('18'); // N - 1 = 18

    const toggleLabel = await viz.getToggleLabel();
    expect(toggleLabel).toBe('Animate');
    const active = await viz.toggleHasActive();
    expect(active).toBe(false);

    const nodeCount = await viz.nodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(10); // sanity check for generated array (N = 19 expected)

    const target = await viz.getTargetValue();
    expect(target.length).toBeGreaterThan(0);
    expect(target).not.toBe('—');
  });

  test('ToggleAnimation starts animation (S0_Ready -> S1_Running) and highlights m1/m2', async () => {
    // Click the animate toggle. Validate visual evidence of running:
    // - toggle button becomes active with label "Pause"
    // - exStep moves to "Step 1: Compare"
    // - at least one node has class "m1" and one has "m2"
    await viz.clickToggle();

    // toggle should reflect running immediately
    await expect(viz.page.locator('#toggleLabel')).toHaveText('Pause');
    expect(await viz.toggleHasActive()).toBe(true);

    // wait for the first compare to be shown and nodes highlighted
    await viz.waitForFirstCompare(7000);

    const step = await viz.getStepCount();
    // step should have incremented to "1"
    expect(step).toBe('1');

    // check that some nodes are highlighted as m1 and m2
    const someM1 = await viz.anyNodeHasClass('m1');
    const someM2 = await viz.anyNodeHasClass('m2');
    expect(someM1).toBe(true);
    expect(someM2).toBe(true);
  });

  test('ToggleAnimation pauses and resumes (S1_Running <-> S2_Paused) via button and Space key', async () => {
    // Start animation
    await viz.clickToggle();
    await expect(viz.page.locator('#toggleLabel')).toHaveText('Pause');
    expect(await viz.toggleHasActive()).toBe(true);

    // Pause via toggle button
    await viz.clickToggle();
    await expect(viz.page.locator('#toggleLabel')).toHaveText('Animate');
    expect(await viz.toggleHasActive()).toBe(false);

    // Press Space to resume
    await viz.pressSpace();
    // Wait briefly for resume to take effect and first compare to appear
    await viz.waitForFirstCompare(7000);
    expect(await viz.toggleHasActive()).toBe(true);
    await expect(viz.page.locator('#toggleLabel')).toHaveText('Pause');

    // Press Space again to pause
    await viz.pressSpace();
    await expect(viz.page.locator('#toggleLabel')).toHaveText('Animate');
    expect(await viz.toggleHasActive()).toBe(false);
  });

  test('ResetVisualization returns to Ready (S2_Paused -> S0_Ready and S1_Running -> S0_Ready)', async () => {
    // Start then reset while running
    await viz.clickToggle();
    await expect(viz.page.locator('#toggleLabel')).toHaveText('Pause');
    expect(await viz.toggleHasActive()).toBe(true);

    // Reset while running
    await viz.clickReset();

    // After reset, should be ready state
    await expect(viz.page.locator('#toggleLabel')).toHaveText('Animate');
    expect(await viz.toggleHasActive()).toBe(false);
    expect(await viz.getStepCount()).toBe('0');
    expect((await viz.getExStepText()).toLowerCase()).toMatch(/ready/);

    // Start again, pause, then reset while paused
    await viz.clickToggle();
    await viz.waitForFirstCompare(7000);
    await viz.clickToggle(); // pause
    expect(await viz.toggleHasActive()).toBe(false);

    await viz.clickReset();
    await expect(viz.page.locator('#toggleLabel')).toHaveText('Animate');
    expect(await viz.getStepCount()).toBe('0');
    expect((await viz.getExStepText()).toLowerCase()).toMatch(/ready/);
  });

  test('Keyboard R resets visualization (KeyboardR event)', async () => {
    // Start to change state
    await viz.clickToggle();
    await viz.waitForFirstCompare(7000);

    // Press 'r' to reset
    await viz.pressR();

    // Validate reset happened
    await expect(viz.page.locator('#toggleLabel')).toHaveText('Animate');
    expect(await viz.toggleHasActive()).toBe(false);
    expect(await viz.getStepCount()).toBe('0');
    expect((await viz.getExStepText()).toLowerCase()).toMatch(/ready/);
  });

  test('Algorithm completes to either Found or Not Found (S1_Running -> S3_Completed)', async () => {
    // This test runs the animation until it reaches a terminal explanation:
    // "Found", "Not Found", or "Done" and asserts the DOM reflects completion.
    await viz.clickToggle();
    // Wait for the algorithm to finish (could take several steps; allow generous timeout)
    await viz.waitForCompletion(30000);

    const exStep = (await viz.getExStepText()).toLowerCase();
    // Should be one of the terminal messages
    const isFound = exStep.includes('found');
    const isNotFound = exStep.includes('not found') || exStep.includes('interval exhausted') || exStep.includes('done');

    expect(isFound || isNotFound).toBe(true);

    // The toggle button must not be active when completed
    expect(await viz.toggleHasActive()).toBe(false);
    await expect(viz.page.locator('#toggleLabel')).toHaveText('Animate');

    if (isFound) {
      // verify some node has .match class
      const hasMatch = await viz.anyNodeHasClass('match');
      expect(hasMatch).toBe(true);
    } else {
      // Not found: ensure that the exStep indicates not found and that at least one cut overlay has non-zero width OR nodes are dimmed
      const leftW = await viz.getLeftCutWidth();
      const rightW = await viz.getRightCutWidth();
      const leftZero = leftW === '0px' || leftW === '0';
      const rightZero = rightW === '0px' || rightW === '0';
      const anyDim = await viz.anyNodeHasClass('dim');
      // at least some visual cue of pruning should be present
      expect(anyDim || !leftZero || !rightZero).toBe(true);
    }
  });

  test('Edge case: pressing Reset repeatedly and interaction stability', async () => {
    // Rapidly press Reset multiple times and ensure DOM remains stable and no runtime errors occur
    for (let i = 0; i < 5; i++) {
      await viz.clickReset();
    }

    expect(await viz.getStepCount()).toBe('0');
    expect((await viz.getExStepText()).toLowerCase()).toMatch(/ready/);
    expect(await viz.nodeCount()).toBeGreaterThanOrEqual(10);
  });

  test('Observability: No uncaught exceptions should appear during normal interactions', async () => {
    // Perform a sequence of interactions to surface potential runtime errors:
    // start -> wait for first compare -> pause -> reset -> start and allow a short period of running
    await viz.clickToggle();
    await viz.waitForFirstCompare(7000);
    await viz.clickToggle(); // pause
    await viz.clickReset();
    await viz.clickToggle();
    // let it run for a short time
    await viz.page.waitForTimeout(1200);

    // No page errors or console.error messages were recorded (this is asserted in afterEach)
    expect(viz.getCollectedPageErrors().length).toBe(0);
    expect(viz.getCollectedConsoleErrors().length).toBe(0);
  });
});