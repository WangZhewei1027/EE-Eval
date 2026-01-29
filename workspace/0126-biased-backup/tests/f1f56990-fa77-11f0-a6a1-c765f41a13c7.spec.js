import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f56990-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object Model for the Suffix Tree demo
class SuffixTreePage {
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#playBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.svgRoot = page.locator('#svgRoot');
    this.e1 = page.locator('#e1');
    this.e2 = page.locator('#e2');
    this.labels = page.locator('svg .label');
    this.chips = page.locator('svg .chip-label');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure page scripts run and onload handlers have fired
    await this.page.waitForTimeout(300);
  }

  async getPlayText() {
    return (await this.playBtn.innerText()).trim();
  }

  async getPlayAriaPressed() {
    return await this.playBtn.getAttribute('aria-pressed');
  }

  async clickPlay() {
    await this.playBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  // Wait until play button text equals expected (polling)
  async waitForPlayText(expected, timeout = 7000) {
    await this.page.waitForFunction(
      (sel, exp) => document.querySelector(sel) && document.querySelector(sel).textContent.trim() === exp,
      '#playBtn',
      expected,
      { timeout }
    );
  }

  async svgHasClass(cls) {
    return await this.svgRoot.evaluate((el, c) => el.classList.contains(c), cls);
  }

  async elementHasClass(selector, cls) {
    return await this.page.locator(selector).evaluate((el, c) => el.classList.contains(c), cls);
  }

  // helper to get strokeDashoffset of an edge
  async getStrokeDashoffset(edgeSelector) {
    return await this.page.locator(edgeSelector).evaluate(el => el.style.strokeDashoffset || window.getComputedStyle(el).strokeDashoffset || '');
  }

  // get number of elements with class 'revealed' inside edges
  async countRevealedEdges() {
    return await this.page.evaluate(() => Array.from(document.querySelectorAll('.edge')).filter(e => e.classList.contains('revealed')).length);
  }
}

test.describe('Suffix Tree — Visual Concept (FSM) tests', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // capture console messages, especially errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });
  });

  test.afterEach(async ({ page }) => {
    // detach listeners by navigating away to about:blank to avoid test bleed
    await page.goto('about:blank');
  });

  test('Initial Idle state: UI is rendered and buttons are in Idle state', async ({ page }) => {
    // Verify initial Idle entry actions (renderPage()) by asserting DOM elements exist and initial attributes
    const model = new SuffixTreePage(page);
    await model.goto();

    // The Animate button should be present with text 'Animate' and aria-pressed='false'
    await expect(model.playBtn).toBeVisible();
    expect(await model.getPlayText()).toBe('Animate');
    expect(await model.getPlayAriaPressed()).toBe('false');

    // The Reset button should be present and have the expected title
    await expect(model.resetBtn).toBeVisible();
    expect(await model.resetBtn.getAttribute('title')).toBe('Reset view');

    // svgRoot should not have the 'reveal' class in Idle
    expect(await model.svgHasClass('reveal')).toBeFalsy();

    // edges should have strokeDasharray/strokeDashoffset prepared
    const offsetE1 = await model.getStrokeDashoffset('#e1');
    // strokeDashoffset should be present (string), we assert it's not empty
    expect(offsetE1).not.toBe('');

    // No page errors or console errors after initial render
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Transition Idle -> Animating: clicking Animate sets aria-pressed and adds reveal class and starts edge reveal', async ({ page }) => {
    // Clicking Animate should trigger animate() entry action
    const model = new SuffixTreePage(page);
    await model.goto();

    // Click Animate
    await model.clickPlay();

    // Immediately after clicking: button text should change to 'Animating…' and aria-pressed true
    await page.waitForFunction(() => document.querySelector('#playBtn')?.textContent.trim().startsWith('Animating'), null, { timeout: 1000 });
    expect((await model.getPlayText()).startsWith('Animating')).toBeTruthy();
    expect(await model.getPlayAriaPressed()).toBe('true');

    // svgRoot should have 'reveal' class
    expect(await model.svgHasClass('reveal')).toBeTruthy();

    // The first edge (e1) should be revealed quickly (first timeout uses delay=0)
    await page.waitForFunction(() => document.getElementById('e1')?.classList.contains('revealed') === true, null, { timeout: 1200 });
    expect(await model.elementHasClass('#e1', 'revealed')).toBeTruthy();

    // At least one label should be shown (the corresponding label should have class 'show')
    const revealedCount = await model.countRevealedEdges();
    expect(revealedCount).toBeGreaterThanOrEqual(1);

    // No synchronous page errors or console errors as a result of clicking Animate
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Animating -> Replay: after animation completes, play button becomes Replay and aria-pressed false', async ({ page }) => {
    // This validates completion of the animation sequence and exit_actions (reset not invoked here)
    const model = new SuffixTreePage(page);
    await model.goto();

    // Start animation
    await model.clickPlay();

    // Wait for the play button to become 'Replay' which is set near animation end
    // The animation sequence spans several timeouts; give generous timeout
    await model.waitForPlayText('Replay', 8000);

    // After animation completes: play button should display 'Replay' and aria-pressed should be 'false'
    expect(await model.getPlayText()).toBe('Replay');
    expect(await model.getPlayAriaPressed()).toBe('false');

    // Several edges should now be revealed (most or all)
    const revealed = await model.countRevealedEdges();
    expect(revealed).toBeGreaterThanOrEqual(4);

    // Labels and chips should have been given 'show' class for many items
    const labelShows = await page.evaluate(() => Array.from(document.querySelectorAll('svg .label')).filter(el => el.classList.contains('show')).length);
    expect(labelShows).toBeGreaterThanOrEqual(1);

    // No uncaught page errors and no console errors by animation end
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  }, { timeout: 20000 });

  test('Reset during Animating: clicking Reset while animating cancels timers and restores Idle', async ({ page }) => {
    // Validate transition S1_Animating -> S0_Idle via ResetClick and exit_actions reset()
    const model = new SuffixTreePage(page);
    await model.goto();

    // Start animation
    await model.clickPlay();

    // Give a tiny moment for animation to start
    await page.waitForTimeout(120);

    // Now click Reset to interrupt
    await model.clickReset();

    // Immediately, play button text should revert to 'Animate' and aria-pressed 'false'
    await page.waitForFunction(() => document.querySelector('#playBtn')?.textContent.trim() === 'Animate', null, { timeout: 1000 });
    expect(await model.getPlayText()).toBe('Animate');
    expect(await model.getPlayAriaPressed()).toBe('false');

    // svgRoot should no longer have 'reveal'
    expect(await model.svgHasClass('reveal')).toBeFalsy();

    // Edges should have 'revealed' removed
    const revealedNow = await model.countRevealedEdges();
    // After reset, ideally zero edges have 'revealed'
    expect(revealedNow).toBeLessThanOrEqual(1);

    // Wait longer to ensure no later 'Replay' mutation occurs (timers should be cleared)
    await page.waitForTimeout(2200);
    // Play button should remain 'Animate' (i.e., no lingering timers changed it to 'Replay')
    expect(await model.getPlayText()).toBe('Animate');

    // No new console or page errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  }, { timeout: 15000 });

  test('Replay -> Idle via Reset: after completion, Reset returns to Idle', async ({ page }) => {
    // Validate transition S2_Replay -> S0_Idle on ResetClick
    const model = new SuffixTreePage(page);
    await model.goto();

    // Animate to completion
    await model.clickPlay();
    await model.waitForPlayText('Replay', 8000);

    // Confirm we're in Replay state
    expect(await model.getPlayText()).toBe('Replay');

    // Click Reset
    await model.clickReset();

    // Button should go back to Animate and aria-pressed false
    await page.waitForFunction(() => document.querySelector('#playBtn')?.textContent.trim() === 'Animate', null, { timeout: 1000 });
    expect(await model.getPlayText()).toBe('Animate');
    expect(await model.getPlayAriaPressed()).toBe('false');

    // svgRoot shouldn't have reveal class anymore
    expect(await model.svgHasClass('reveal')).toBeFalsy();

    // No console/page errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  }, { timeout: 20000 });

  test('Edge cases: double-click Animate quickly and clicking Reset while idle', async ({ page }) => {
    // Validate robustness: double click shouldn't throw and reset when idle is a no-op
    const model = new SuffixTreePage(page);
    await model.goto();

    // Double click Animate quickly
    await model.clickPlay();
    // Immediately attempt second click; code guards with `if(playing) return;` so this should be harmless
    await model.clickPlay();

    // Ensure we are in an animating state shortly after
    await page.waitForFunction(() => document.querySelector('#playBtn')?.textContent.trim().startsWith('Animating'), null, { timeout: 1000 });
    expect((await model.getPlayText()).startsWith('Animating')).toBeTruthy();

    // Now click Reset to stop it
    await model.clickReset();
    await page.waitForFunction(() => document.querySelector('#playBtn')?.textContent.trim() === 'Animate', null, { timeout: 1000 });
    expect(await model.getPlayText()).toBe('Animate');

    // Clicking Reset again when idle should do nothing and not throw
    await model.clickReset();
    expect(await model.getPlayText()).toBe('Animate');

    // Ensure no page errors and console errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  }, { timeout: 15000 });

  test('Smoke test: ensure important SVG nodes (root, nodes, leaves) exist and are accessible', async ({ page }) => {
    // Confirm DOM structure expected by FSM exists (evidence elements)
    const model = new SuffixTreePage(page);
    await model.goto();

    // root node and some leaves exist
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.locator('#nodeA')).toBeVisible();
    await expect(page.locator('#leafB')).toBeVisible();
    await expect(page.locator('#leafDollarRoot')).toBeVisible();

    // Edge labels exist and start hidden (opacity 0)
    const firstLabelOpacity = await page.locator('svg .label').first().evaluate(el => parseFloat(window.getComputedStyle(el).opacity));
    expect(firstLabelOpacity).toBeLessThan(0.5);

    // No page errors or console errors during structure inspection
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

});