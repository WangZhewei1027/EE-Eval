import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f7b381-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object to encapsulate interactions and queries for the app
class RelationalDiagramPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      body: 'body',
      btnAnimate: '#btn-animate',
      btnLabels: '#btn-labels',
      flowDotA: '.flow-dot.flow-a',
      flowDotB: '.flow-dot.flow-b',
      dashFlows: '.dashflow',
      labelSample: '.card.orders .columns .col small.label', // sample label element
      blobs: '.blob',
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click helpers
  async clickAnimate() {
    await this.page.click(this.selectors.btnAnimate);
  }

  async clickLabels() {
    await this.page.click(this.selectors.btnLabels);
  }

  // State queries
  async isAnimateOn() {
    return this.page.evaluate(() => document.body.classList.contains('animate'));
  }

  async isLabelsOn() {
    return this.page.evaluate(() => document.body.classList.contains('show-labels'));
  }

  async ariaPressed(selector) {
    return this.page.getAttribute(selector, 'aria-pressed');
  }

  async hasToggleOnClass(selector) {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return !!el && el.classList.contains('toggle-on');
    }, selector);
  }

  async flowAnimationPlayState(dotSelector) {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      // property might be returned as 'running' or 'paused'
      return cs.getPropertyValue('animation-play-state') || cs.animationPlayState || null;
    }, dotSelector);
  }

  async dashflowPlayState() {
    // returns first dashflow animation-play-state
    return this.page.evaluate(() => {
      const el = document.querySelector('.dashflow');
      if (!el) return null;
      return window.getComputedStyle(el).getPropertyValue('animation-play-state') || null;
    });
  }

  async labelOpacity() {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).getPropertyValue('opacity');
    }, this.selectors.labelSample);
  }

  async blobTransforms() {
    return this.page.evaluate((sel) => {
      return Array.from(document.querySelectorAll(sel)).map(b => b.style.transform || window.getComputedStyle(b).transform);
    }, this.selectors.blobs);
  }
}

test.describe('Relational Diagram — FSM interactions (Animate / Labels)', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions in tests
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test('Initial state S0_Idle: DOM and accessibility initial values', async ({ page }) => {
    const app = new RelationalDiagramPage(page);
    // Navigate and wait for load (onload handler in page should run)
    await app.goto();

    // Verify no runtime page errors occurred during load
    expect(pageErrors.length).toBe(0);

    // Body should not have animate or show-labels class initially
    expect(await app.isAnimateOn()).toBe(false);
    expect(await app.isLabelsOn()).toBe(false);

    // Buttons should exist and have aria-pressed "false"
    expect(await app.ariaPressed(app.selectors.btnAnimate)).toBe('false');
    expect(await app.ariaPressed(app.selectors.btnLabels)).toBe('false');

    // Buttons should not have 'toggle-on' class
    expect(await app.hasToggleOnClass(app.selectors.btnAnimate)).toBe(false);
    expect(await app.hasToggleOnClass(app.selectors.btnLabels)).toBe(false);

    // Flow dots and dashflow animations should be paused by default
    const flowAState = await app.flowAnimationPlayState(app.selectors.flowDotA);
    const flowBState = await app.flowAnimationPlayState(app.selectors.flowDotB);
    const dashState = await app.dashflowPlayState();
    // Accept either 'paused' or browser-specific representation; ensure they are not 'running'
    expect(flowAState).not.toBe('running');
    expect(flowBState).not.toBe('running');
    expect(dashState).not.toBe('running');

    // Labels should be hidden (opacity 0 per CSS)
    const labelOpacity = await app.labelOpacity();
    // CSS sets opacity:0 initially
    expect(Number(labelOpacity)).toBeLessThanOrEqual(0.01);

    // Ensure there are no console.error messages emitted during initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('ToggleAnimation: S0_Idle -> S1_Animating and back to S0_Idle (click behavior & visual feedback)', async ({ page }) => {
    const app = new RelationalDiagramPage(page);
    await app.goto();

    // Click animate to start animation (S0 -> S1)
    await app.clickAnimate();

    // After clicking, body should have 'animate' class
    expect(await app.isAnimateOn()).toBe(true);

    // Button aria-pressed should now be "true" and it should have toggle-on class
    expect(await app.ariaPressed(app.selectors.btnAnimate)).toBe('true');
    expect(await app.hasToggleOnClass(app.selectors.btnAnimate)).toBe(true);

    // Flow dots and dashflow should be running now
    // We allow slight delay for CSS to update; poll with small timeout
    await page.waitForTimeout(50);
    const flowAState = await app.flowAnimationPlayState(app.selectors.flowDotA);
    const flowBState = await app.flowAnimationPlayState(app.selectors.flowDotB);
    const dashState = await app.dashflowPlayState();
    expect(flowAState).toBe('running');
    expect(flowBState).toBe('running');
    expect(dashState).toBe('running');

    // Blobs should receive the subtle transform applied when animation toggled on
    const transformsOn = await app.blobTransforms();
    const hasScale = transformsOn.some(t => typeof t === 'string' && t.includes('scale(1.02)'));
    expect(hasScale).toBe(true);

    // Click animate again to stop (S1 -> S0)
    await app.clickAnimate();

    // After second click, body should no longer have 'animate'
    expect(await app.isAnimateOn()).toBe(false);

    // Button aria-pressed should be back to "false" and no toggle-on class
    expect(await app.ariaPressed(app.selectors.btnAnimate)).toBe('false');
    expect(await app.hasToggleOnClass(app.selectors.btnAnimate)).toBe(false);

    // Flow animations should be paused again
    await page.waitForTimeout(50);
    const flowAStateOff = await app.flowAnimationPlayState(app.selectors.flowDotA);
    const flowBStateOff = await app.flowAnimationPlayState(app.selectors.flowDotB);
    const dashStateOff = await app.dashflowPlayState();
    expect(flowAStateOff).not.toBe('running');
    expect(flowBStateOff).not.toBe('running');
    expect(dashStateOff).not.toBe('running');

    // Ensure no page errors during toggling
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('ToggleLabels: S0_Idle -> S2_LabelsVisible and back to S0_Idle (visibility & a11y)', async ({ page }) => {
    const app = new RelationalDiagramPage(page);
    await app.goto();

    // Toggle labels on
    await app.clickLabels();

    // Body should now have 'show-labels'
    expect(await app.isLabelsOn()).toBe(true);

    // Button aria-pressed should be "true" and button has toggle-on class
    expect(await app.ariaPressed(app.selectors.btnLabels)).toBe('true');
    expect(await app.hasToggleOnClass(app.selectors.btnLabels)).toBe(true);

    // Label element computed opacity should be ~1
    // Give a tiny timeout to let style changes reflect
    await page.waitForTimeout(20);
    const labelOpacityOn = await app.labelOpacity();
    expect(Number(labelOpacityOn)).toBeGreaterThan(0.9);

    // Toggle labels off
    await app.clickLabels();

    // Body should no longer have 'show-labels'
    expect(await app.isLabelsOn()).toBe(false);

    // Aria and class should be updated
    expect(await app.ariaPressed(app.selectors.btnLabels)).toBe('false');
    expect(await app.hasToggleOnClass(app.selectors.btnLabels)).toBe(false);

    // Label opacity should be back to ~0
    await page.waitForTimeout(20);
    const labelOpacityOff = await app.labelOpacity();
    expect(Number(labelOpacityOff)).toBeLessThanOrEqual(0.01);

    // Ensure no runtime errors were emitted
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Independent toggles and composability: labels and animate together and separately', async ({ page }) => {
    const app = new RelationalDiagramPage(page);
    await app.goto();

    // Turn on animate
    await app.clickAnimate();
    expect(await app.isAnimateOn()).toBe(true);

    // Turn on labels while animate is on
    await app.clickLabels();
    expect(await app.isLabelsOn()).toBe(true);

    // Both buttons should report aria-pressed true
    expect(await app.ariaPressed(app.selectors.btnAnimate)).toBe('true');
    expect(await app.ariaPressed(app.selectors.btnLabels)).toBe('true');

    // Now turn off animate only
    await app.clickAnimate();
    expect(await app.isAnimateOn()).toBe(false);

    // Labels should remain active
    expect(await app.isLabelsOn()).toBe(true);
    expect(await app.ariaPressed(app.selectors.btnLabels)).toBe('true');

    // Finally turn off labels
    await app.clickLabels();
    expect(await app.isLabelsOn()).toBe(false);

    // No page errors or console.error messages
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: rapid toggling and idempotency (multiple clicks)', async ({ page }) => {
    const app = new RelationalDiagramPage(page);
    await app.goto();

    // Rapidly click animate 3 times (odd -> on)
    await app.page.click(app.selectors.btnAnimate);
    await app.page.click(app.selectors.btnAnimate);
    await app.page.click(app.selectors.btnAnimate);

    // The state should reflect the odd number of toggles -> on
    expect(await app.isAnimateOn()).toBe(true);
    expect(await app.ariaPressed(app.selectors.btnAnimate)).toBe('true');

    // Rapidly click labels 4 times (even -> off)
    await app.page.click(app.selectors.btnLabels);
    await app.page.click(app.selectors.btnLabels);
    await app.page.click(app.selectors.btnLabels);
    await app.page.click(app.selectors.btnLabels);

    // Even toggles -> should be off
    expect(await app.isLabelsOn()).toBe(false);
    expect(await app.ariaPressed(app.selectors.btnLabels)).toBe('false');

    // Check combined final state (animate on, labels off)
    expect(await app.isAnimateOn()).toBe(true);
    expect(await app.isLabelsOn()).toBe(false);

    // Ensure no page errors during rapid interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Clean up by turning animate off for test isolation
    if (await app.isAnimateOn()) {
      await app.clickAnimate();
    }
    expect(await app.isAnimateOn()).toBe(false);
  });

  test('Implementation evidence checks: aria toggling and DOM mutation side-effects', async ({ page }) => {
    const app = new RelationalDiagramPage(page);
    await app.goto();

    // Verify the JS sets aria-pressed attributes when toggling
    await app.clickAnimate();
    expect(await app.ariaPressed(app.selectors.btnAnimate)).toBe('true');

    await app.clickLabels();
    expect(await app.ariaPressed(app.selectors.btnLabels)).toBe('true');

    // Verify that when animate is on the CSS-driven animation-play-state becomes running
    await page.waitForTimeout(30);
    expect(await app.flowAnimationPlayState(app.selectors.flowDotA)).toBe('running');

    // Verify some DOM mutation side-effect applied by animate handler: toggling toggle-on class presence
    expect(await app.hasToggleOnClass(app.selectors.btnAnimate)).toBe(true);
    expect(await app.hasToggleOnClass(app.selectors.btnLabels)).toBe(true);

    // Turn both off and verify attributes update
    await app.clickAnimate();
    await app.clickLabels();
    expect(await app.ariaPressed(app.selectors.btnAnimate)).toBe('false');
    expect(await app.ariaPressed(app.selectors.btnLabels)).toBe('false');

    // Ensure no unhandled exceptions occurred on page
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});