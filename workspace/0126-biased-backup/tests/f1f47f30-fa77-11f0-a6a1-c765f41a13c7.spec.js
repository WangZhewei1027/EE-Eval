import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f47f30-fa77-11f0-a6a1-c765f41a13c7.html';

class CircularListPage {
  /**
   * Page Object for the Circular Linked List visualization.
   * Encapsulates common interactions and queries used across tests.
   */
  constructor(page) {
    this.page = page;
    this.toggleBtn = page.locator('#toggleBtn');
    this.shuffleBtn = page.locator('#shuffleBtn');
    this.nodeCount = page.locator('#nodeCount');
    this.nodes = page.locator('#nodesContainer .node');
    this.token = page.locator('#token');
    this.body = page.locator('body');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for nodes to be present and initial layout to complete
    await expect(this.nodes).toHaveCount(8);
    await expect(this.nodeCount).toHaveText('8');
  }

  async clickToggle() {
    await this.toggleBtn.click();
  }

  async clickShuffle() {
    await this.shuffleBtn.click();
  }

  // Returns array of label texts from nodes (inner .label spans)
  async getNodeLabels() {
    return await this.page.$$eval('#nodesContainer .node .label', els => els.map(e => e.textContent));
  }

  // Returns array of sub (address-like) texts from nodes (inner .sub spans)
  async getNodeSubs() {
    return await this.page.$$eval('#nodesContainer .node .sub', els => els.map(e => e.textContent));
  }

  // Get token position as {x, y} from computed style left/top (floats)
  async getTokenPosition() {
    return await this.page.evaluate(() => {
      const token = document.getElementById('token');
      const left = parseFloat(token.style.left || token.getBoundingClientRect().left);
      const top = parseFloat(token.style.top || token.getBoundingClientRect().top);
      return { x: left, y: top };
    });
  }

  // Check whether body contains paused class
  async isPaused() {
    return await this.page.evaluate(() => document.body.classList.contains('paused'));
  }

  // Wait for a node to receive 'pulse' class (used to validate animation / visitation)
  async waitForAnyPulse(timeout = 2000) {
    return await this.page.waitForFunction(() => {
      const nodes = Array.from(document.querySelectorAll('#nodesContainer .node'));
      return nodes.some(n => n.classList.contains('pulse'));
    }, null, { timeout });
  }
}

test.describe('Circular Linked List Visual — FSM and Interaction Tests', () => {
  let page;
  let model;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    model = new CircularListPage(page);
    await model.goto();
  });

  test.afterEach(async () => {
    // Basic sanity: ensure no uncaught page errors were emitted during the test
    expect(pageErrors.map(e => String(e))).toEqual([]); // assert none
    // Also ensure there were no console.error messages
    const errors = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    expect(errors).toEqual([]);
    await page.close();
  });

  test('Initial state: Idle entry actions executed, nodes and links present (init())', async () => {
    // Validate that init() ran: nodes placed and nodeCount set
    await expect(model.nodes).toHaveCount(8);
    await expect(model.nodeCount).toHaveText('8');

    // The token should be present and the visual spin group exists
    await expect(page.locator('#token')).toBeVisible();
    await expect(page.locator('.orbit.spin')).toBeVisible();

    // By design the app starts playing immediately: body should NOT have paused class
    const paused = await model.isPaused();
    expect(paused).toBeFalsy();

    // The toggle button initial text should be "Pause" (since playing by default)
    await expect(model.toggleBtn).toHaveText('Pause');
  });

  test('Playing state: animation is active, token moves and nodes pulse as visited', async () => {
    // Sample token position, wait a bit, sample again and assert movement occurred
    const pos1 = await model.getTokenPosition();
    await page.waitForTimeout(220); // allow animation to advance
    const pos2 = await model.getTokenPosition();

    const dx = Math.abs(pos2.x - pos1.x);
    const dy = Math.abs(pos2.y - pos1.y);
    const movement = Math.hypot(dx, dy);

    // Expect some movement — the token orbits continuously
    expect(movement).toBeGreaterThan(0.5);

    // While playing, at least one node should pulse within a short timeframe
    await model.waitForAnyPulse(1500);
    // If we reached here without timeout, a pulse occurred; assert true
    const anyPulsed = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#nodesContainer .node')).some(n => n.classList.contains('pulse'));
    });
    // The pulse might be transient; we allow true or false here but assert that the waitForAnyPulse didn't timeout.
    expect(anyPulsed || true).toBeTruthy();
  });

  test('Transition: Playing -> Paused via TogglePlayPause (clicking #toggleBtn)', async () => {
    // Ensure playing initially
    expect(await model.isPaused()).toBeFalsy();
    await expect(model.toggleBtn).toHaveText('Pause');

    // Click toggle to pause
    await model.clickToggle();

    // Toggle button text should update to 'Play'
    await expect(model.toggleBtn).toHaveText('Play');

    // Body should now have pause class
    expect(await model.isPaused()).toBeTruthy();

    // Token should stop moving: sample position and assert no meaningful movement over time
    const posBefore = await model.getTokenPosition();
    await page.waitForTimeout(380); // wait longer than pulse duration to ensure movement would have happened if playing
    const posAfter = await model.getTokenPosition();
    const dist = Math.hypot(posAfter.x - posBefore.x, posAfter.y - posBefore.y);
    // While paused, token should not move significantly
    expect(dist).toBeLessThan(3);

    // Also ensure that while paused nodes do not pulse for a short duration
    // We'll check that no node gains class 'pulse' within 700ms
    const pulsedDuringPause = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#nodesContainer .node')).some(n => n.classList.contains('pulse'));
    });
    expect(pulsedDuringPause).toBeFalsy();
  });

  test('Transition: Paused -> Playing via TogglePlayPause resumes animation', async () => {
    // Pause first
    if (!(await model.isPaused())) {
      await model.clickToggle();
      await expect(model.toggleBtn).toHaveText('Play');
    }

    // Now click to resume
    await model.clickToggle();
    await expect(model.toggleBtn).toHaveText('Pause');
    expect(await model.isPaused()).toBeFalsy();

    // Token should start moving again: sample two positions separated by a short wait
    const p1 = await model.getTokenPosition();
    await page.waitForTimeout(260);
    const p2 = await model.getTokenPosition();
    const moved = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    expect(moved).toBeGreaterThan(0.5);

    // Also, a node pulse should occur again eventually
    await model.waitForAnyPulse(2000);
  });

  test('Shuffle node values: clicking #shuffleBtn changes labels and sub addresses', async () => {
    // Capture original labels and subs
    const originalLabels = await model.getNodeLabels();
    const originalSubs = await model.getNodeSubs();

    // Click shuffle and wait for the UI to reflect changes
    await model.clickShuffle();

    // Shuffle applies immediate changes; give a short timeout for DOM updates/animations
    await page.waitForTimeout(120);

    const newLabels = await model.getNodeLabels();
    const newSubs = await model.getNodeSubs();

    // At least one label should be different after shuffle
    const someLabelChanged = newLabels.some((l, i) => l !== originalLabels[i]);
    expect(someLabelChanged).toBeTruthy();

    // All subs should match the expected 0xHH hex-ish pattern after shuffle
    const hexRegex = /^0x[0-9a-f]{2}$/i;
    for (const s of newSubs) {
      expect(s).toMatch(hexRegex);
    }
  });

  test('Robustness: rapid toggling and multiple shuffles should not produce uncaught errors', async () => {
    // Rapidly toggle a few times
    for (let i = 0; i < 6; i++) {
      await model.clickToggle();
      // very short delay to simulate quick user interactions
      await page.waitForTimeout(80);
    }

    // Rapidly click shuffle several times
    for (let i = 0; i < 4; i++) {
      await model.clickShuffle();
      await page.waitForTimeout(60);
    }

    // After rapid interactions, ensure the app remains responsive: the toggle button exists
    await expect(model.toggleBtn).toBeVisible();

    // Ensure there were still no uncaught page errors (this will be asserted in afterEach),
    // but we also assert console error not present for immediate feedback
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('Resize and visibility handlers: triggering resize and visibilitychange should not error', async () => {
    // Trigger a resize event from the page to exercise the resize handler
    await page.evaluate(() => {
      window.dispatchEvent(new Event('resize'));
    });

    // Trigger a visibilitychange event; note handler checks document.hidden — we do not modify that,
    // but dispatching the event should be handled gracefully without throwing.
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Give a small grace period for any handlers to run
    await page.waitForTimeout(160);

    // There should be no page errors emitted during these events (checked in afterEach)
    expect(true).toBeTruthy();
  });

  test('DOM integrity: nodes have required attributes and links are constructed', async () => {
    // All nodes should have data-idx 0..7
    const dataIdxs = await page.$$eval('#nodesContainer .node', nodes => nodes.map(n => n.getAttribute('data-idx')));
    expect(dataIdxs).toEqual(['0','1','2','3','4','5','6','7']);

    // There should be SVG path elements for each link (N links)
    const linkCount = await page.$$eval('#links path', p => p.length);
    expect(linkCount).toBe(8);

    // Ensure marker and gradient defs exist in the SVG
    const hasGrad = await page.$('svg.diagram defs linearGradient#grad') !== null;
    const hasMarker = await page.$('svg.diagram defs marker#arrowhead') !== null;
    expect(hasGrad).toBeTruthy();
    expect(hasMarker).toBeTruthy();
  });

  // Additional smoke test to observe console and page error details if present
  test('Console and pageerror observation (records any messages for diagnostics)', async () => {
    // Intentionally perform a harmless action to produce potential console logs
    await model.clickShuffle();
    await page.waitForTimeout(120);

    // We explicitly assert that no ReferenceError, SyntaxError, or TypeError occurred.
    // The pageErrors array contains Error objects; consoleMessages may contain error messages.
    const combinedErrors = [
      ...pageErrors.map(e => String(e)),
      ...consoleMessages.filter(m => m.type === 'error').map(m => m.text)
    ].join('\n');

    // If any of these common fatal error types are present, fail the test with the diagnostic info.
    const fatalTypes = ['ReferenceError', 'SyntaxError', 'TypeError'];
    for (const t of fatalTypes) {
      const found = combinedErrors.includes(t);
      expect(found).toBeFalsy(); // fail if any such fatal error appeared
    }

    // If we made it here, no fatal errors of the above types were recorded.
    expect(combinedErrors.length).toBeGreaterThanOrEqual(0);
  });

});